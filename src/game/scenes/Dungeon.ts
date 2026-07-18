/**
 * The dungeon: level construction, input, physics, and the game loop that
 * feeds real time into the engine clock. All rules resolution goes through
 * the engine; this scene renders consequences.
 */

import Phaser from "phaser";
import { HudScene } from "./Hud";
import { crackleBed, themeAmbience } from "../audio/ambience";
import { isMuted, setMuted } from "../audio/context";
import * as sfx from "../audio/sfx";
import { SpatialEmitter, spatialOpts, type Vec2 } from "../audio/spatial";
import { classDef, createCharacter, item, monster, spell } from "../../data";
import { DC } from "../../engine";
import { GameContext } from "../context";
import { RENDER_SCALE } from "../display";
import { CharacterSprite } from "../entities/CharacterSprite";
import { MonsterSprite, MONSTER_ATTACK_COOLDOWN_MS } from "../entities/MonsterSprite";
import { flameAt, sparkleBurst } from "../fx/vfx";
import {
  floatText,
  meleeSwing,
  monsterSwing,
  MoraleTracker,
  type MeleeDeps,
} from "../systems/combat";
import { EncounterSystem } from "../systems/encounters";
import { CAMPFIRE_RADIUS, LightSystem } from "../systems/light";
import { PartyManager } from "../systems/party";
import { CLOSE_PX, zoneBetween } from "../systems/position";
import { castSelectedSpell, type SpellDeps } from "../systems/spells";
import { TrapSystem } from "../systems/traps";
import {
  DUNGEON_H,
  DUNGEON_W,
  ROOM_BANDS,
  dungeonAt,
  type DungeonDefinition,
} from "../level/dungeons";
import { TILE } from "../textures";
import { serializeCharacter, deserializeCharacter, type SaveSlot } from "../state";

/**
 * How long after being hit a character keeps swinging back. Monsters attack
 * every 1.5s, so an ongoing fight refreshes this; once the aggressor stops
 * or leaves reach, retaliation lapses.
 */
const RETALIATE_WINDOW_MS = 4000;

interface RescuableNpc {
  sprite: Phaser.GameObjects.Image;
  prop?: Phaser.GameObjects.Image;
  className: "thief" | "priest" | "wizard";
  name: string;
  x: number;
  y: number;
  rescued: boolean;
}

interface Pickup {
  sprite: Phaser.Physics.Arcade.Image;
  itemId: string;
  qty: number;
}

/** A short window in which L spends a luck token to reroll the leader's last failure. */
export interface LuckWindow {
  member: CharacterSprite;
  label: string;
  redo: () => void;
  expiresAt: number;
}

/** What pressing E would do right now — also drives the on-screen prompt. */
interface Interaction {
  label: string;
  run: () => void;
}

export class DungeonScene extends Phaser.Scene {
  ctx!: GameContext;
  party!: PartyManager;
  light!: LightSystem;
  activeDungeon!: DungeonDefinition;

  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private weakWalls!: Phaser.Physics.Arcade.StaticGroup;
  private climbTiles: Phaser.GameObjects.Rectangle[] = [];
  private spikes: Phaser.Physics.Arcade.Image[] = [];
  private monsters: MonsterSprite[] = [];
  private monsterGroup!: Phaser.GameObjects.Group;
  private partyGroup!: Phaser.GameObjects.Group;
  private trapSystem!: TrapSystem;
  private fireEmitters: SpatialEmitter[] = [];
  private pickups: Pickup[] = [];
  private npcs: RescuableNpc[] = [];
  private campfires: { x: number; y: number; free: boolean }[] = [];
  private shrines: { x: number; y: number }[] = [];
  private door!: { x: number; y: number };
  private morale = new MoraleTracker();
  private dyingLabels = new Map<string, Phaser.GameObjects.Text>();
  private gameOver = false;
  private won = false;
  private lastHurtAt = new Map<string, number>();
  private encounterWaves = 0;
  private interactPrompt!: Phaser.GameObjects.Text;
  loadedState: SaveSlot | null = null;
  private lastRoomIndex = 1;
  private leaderMarker!: Phaser.GameObjects.Image;
  /** Read by the HUD to show the reroll hint. */
  luckWindow: LuckWindow | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private leftControlDown = false;

  private gamePaused = false;
  private statsOverlayOpen = false;
  private gearOverlayOpen = false;
  private gearSelectionIndex = 0;

  constructor() {
    super("Dungeon");
  }

  create(): void {
    const loadStateJson = this.registry.get("loadState");
    this.loadedState = null;
    if (loadStateJson) {
      this.loadedState = typeof loadStateJson === "string" ? JSON.parse(loadStateJson) : loadStateJson;
      this.registry.set("loadState", null); // Consume it
      
      this.registry.set("dungeonIndex", this.loadedState!.dungeonIndex);
      
      const newCtx = new GameContext();
      newCtx.totalCoins = this.loadedState!.coinsBanked;
      newCtx.kills = this.loadedState!.kills;
      newCtx.messages.push(...this.loadedState!.messages);
      this.registry.set("ctx", newCtx);
    }

    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");

    this.gameOver = false;
    this.won = false;
    this.gamePaused = false;
    this.statsOverlayOpen = false;
    this.gearOverlayOpen = false;
    this.gearSelectionIndex = 0;
    this.monsters = [];
    this.pickups = [];
    this.npcs = [];
    this.campfires = [];
    this.shrines = [];
    this.climbTiles = [];
    this.spikes = [];
    this.dyingLabels = new Map();
    this.morale = new MoraleTracker();
    this.luckWindow = null;
    this.leftControlDown = false;
    this.encounterWaves = 0;
    this.lastRoomIndex = this.loadedState ? this.loadedState.currentRoom : 1;

    const storedIndex = this.registry.get("dungeonIndex");
    const dungeonIndex = typeof storedIndex === "number" ? storedIndex : 0;
    this.activeDungeon = dungeonAt(dungeonIndex);

    // The soundscape follows the backdrop; SHUTDOWN fires on restart too, so
    // beds never stack across runs.
    const ambience = themeAmbience(this.activeDungeon.theme.backdrop);
    this.fireEmitters = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const bed of ambience) bed.destroy();
      for (const e of this.fireEmitters) e.destroy();
    });

    this.physics.world.setBounds(0, 0, DUNGEON_W * TILE, DUNGEON_H * TILE);
    // The framebuffer is render-scaled; zooming keeps the same 960x540 world view.
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBounds(0, 0, DUNGEON_W * TILE, DUNGEON_H * TILE);
    this.cameras.main.setBackgroundColor(this.activeDungeon.theme.background);
    this.createAtmosphere(dungeonIndex);

    this.walls = this.physics.add.staticGroup();
    this.weakWalls = this.physics.add.staticGroup();
    this.party = new PartyManager(this.ctx);
    this.light = new LightSystem(this, this.ctx, this.activeDungeon.theme.darkness);

    this.buildLevel();
    this.lightTorch(this.party.leader, "You light a torch.");
    this.trapSystem = new TrapSystem(
      this,
      this.ctx,
      this.activeDungeon.traps,
      () => this.party.aliveMembers(),
      () => this.party.leader,
      () => [
        ...this.party.aliveMembers().map((member) => ({ x: member.x, y: member.y })),
        ...this.pickups.filter((pickup) => pickup.sprite.active).map((pickup) => ({
          x: pickup.sprite.x,
          y: pickup.sprite.y,
        })),
      ],
      (x, y) => this.light.levelAt(x, y),
      (member) => this.snuffTorch(member),
      this.activeDungeon.theme.accent,
    );
    this.setupInput();

    // Colliders
    this.partyGroup = this.add.group(this.party.members);
    this.monsterGroup = this.add.group(this.monsters);
    this.physics.add.collider(this.partyGroup, this.walls);
    this.physics.add.collider(this.partyGroup, this.weakWalls);
    this.physics.add.collider(this.partyGroup, this.partyGroup, undefined, (o1, o2) => {
      const s1 = o1 as CharacterSprite;
      const s2 = o2 as CharacterSprite;
      let fighter: CharacterSprite | null = null;
      let other: CharacterSprite | null = null;
      if (s1.character.className === "fighter" && s1.bracing) {
        fighter = s1;
        other = s2;
      } else if (s2.character.className === "fighter" && s2.bracing) {
        fighter = s2;
        other = s1;
      }
      if (fighter && other) {
        const falling = other.body!.velocity.y >= 0;
        const above = other.body!.bottom <= fighter.body!.top + 6;
        return falling && above;
      }
      return false;
    });
    this.physics.add.collider(this.monsterGroup, this.walls);
    this.physics.add.collider(this.monsterGroup, this.weakWalls);
    for (const member of this.party.members) this.trapSystem.registerActor(member);
    for (const monster of this.monsters) this.trapSystem.registerActor(monster);
    for (const pickup of this.pickups) this.trapSystem.registerActor(pickup.sprite);

    this.cameras.main.startFollow(this.party.leader, true, 0.12, 0.12);

    this.interactPrompt = this.add
      .text(0, 0, "", {
        fontFamily: "Consolas, monospace",
        fontSize: "12px",
        color: "#ffe9a0",
        stroke: "#050508",
        strokeThickness: 3,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5, 1)
      .setDepth(940)
      .setVisible(false);
    this.leaderMarker = this.add
      .image(0, 0, "leader-marker")
      .setTint(this.activeDungeon.theme.accent)
      .setDepth(939)
      .setVisible(false);

    // Random encounters ride the engine's crawling clock.
    new EncounterSystem({
      ctx: this.ctx,
      dungeon: this.activeDungeon,
      camera: () => this.cameras.main,
      partyInTotalDarkness: () =>
        this.party.aliveMembers().every((m) => this.light.levelAt(m.x, m.y) === "dark"),
      spawnWave: (monsterId, count, x) => this.spawnEncounterWave(monsterId, count, x),
    });

    this.ctx.say(
      `${this.activeDungeon.name}. ${this.activeDungeon.objective}. Watch your torch. ESC shows controls.`,
      "#f0e090",
    );
    this.cameras.main.fadeIn(450, 0, 0, 0);

    this.scene.launch("Hud");
  }

  /** Spawn an encounter wave off-screen, already hunting the party. */
  private spawnEncounterWave(monsterId: string, count: number, x: number): void {
    if (this.gameOver || this.won) return;
    const clampedX = Phaser.Math.Clamp(x, TILE * 1.5, (DUNGEON_W - 2) * TILE);
    const groupId = `encounter-${this.encounterWaves++}`;
    for (let i = 0; i < count; i++) {
      const m = new MonsterSprite(
        this,
        clampedX + i * 14,
        13 * TILE,
        monster(monsterId),
        groupId,
        this.ctx.engine.dice,
      );
      m.aiState = "aggro";
      this.morale.register(m);
      this.monsters.push(m);
      this.monsterGroup.add(m);
      this.trapSystem.registerActor(m);
    }
  }

  get hasCrown(): boolean {
    return this.party.members.some((member) =>
      member.character.inventory.has("crown-of-the-deep"),
    );
  }

  private createAtmosphere(dungeonIndex: number): void {
    const worldW = DUNGEON_W * TILE;
    const worldH = DUNGEON_H * TILE;
    const theme = this.activeDungeon.theme;

    this.add
      .tileSprite(0, 0, worldW, worldH, "bg-cavern")
      .setOrigin(0)
      .setScrollFactor(0.12, 0.05)
      .setTint(theme.haze)
      .setAlpha(0.72)
      .setDepth(-30);
    // Themed math-built backdrop: columns, tentacle swirls, or aztec fractals.
    this.add
      .tileSprite(0, 0, worldW, worldH, `bg-${theme.backdrop}`)
      .setOrigin(0)
      .setScrollFactor(0.22, 0.08)
      .setTint(theme.stoneTint)
      .setAlpha(0.42)
      .setDepth(-26);
    // Bump-noise grain so the walls of the void aren't a flat wash.
    this.add
      .tileSprite(0, 0, worldW, worldH, "bg-bumps")
      .setOrigin(0)
      .setScrollFactor(0.45, 0.25)
      .setTint(theme.accent)
      .setAlpha(0.2)
      .setDepth(-24);
    this.add
      .tileSprite(0, worldH - 190, worldW, 190, "bg-fog")
      .setOrigin(0)
      .setScrollFactor(0.28, 0.12)
      .setTint(theme.accent)
      .setAlpha(0.14)
      .setDepth(-20);

    // Deterministic motes make each theme feel alive without affecting play.
    for (let i = 0; i < 36; i++) {
      const x = ((i * 173 + dungeonIndex * 97) % (DUNGEON_W * TILE - 80)) + 40;
      const y = ((i * 71 + dungeonIndex * 43) % 330) + 90;
      const mote = this.add
        .image(x, y, "pixel")
        .setTint(theme.accent)
        .setAlpha(0.08 + (i % 4) * 0.025)
        .setDepth(-10)
        .setScale(i % 3 === 0 ? 1.5 : 1);
      this.tweens.add({
        targets: mote,
        y: y - 18 - (i % 5) * 4,
        alpha: { from: mote.alpha, to: 0.02 },
        duration: 2600 + (i % 7) * 420,
        delay: (i % 9) * 160,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }

    const roomLabels = [
      "I  THE GATE",
      "II  THE TEST",
      "III  THE SETBACK",
      "IV  THE CLIMAX",
      "V  THE REWARD",
      "SANCTUARY",
    ];
    const roomCenters = [11, 31, 53, 74, 91, 108];
    roomLabels.forEach((label, i) => {
      this.add
        .text(roomCenters[i]! * TILE, 56, label, {
          fontFamily: "Georgia, serif",
          fontSize: "18px",
          color: `#${theme.accent.toString(16).padStart(6, "0")}`,
          letterSpacing: 3,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5)
        .setAlpha(0.22)
        .setDepth(-5);
    });
  }

  private buildLevel(): void {
    const theme = this.activeDungeon.theme;
    for (let y = 0; y < DUNGEON_H; y++) {
      const row = this.activeDungeon.grid[y]!;
      for (let x = 0; x < DUNGEON_W; x++) {
        const ch = row[x]!;
        const px = x * TILE + TILE / 2;
        const py = y * TILE + TILE / 2;
        switch (ch) {
          case "#":
            this.walls
              .create(px, py, `tile-wall-${(x * 17 + y * 31) % 3}`)
              .setTint(theme.stoneTint)
              .setDepth(1);
            break;
          case "%":
            this.weakWalls.create(px, py, "tile-weak").setTint(theme.stoneTint).setDepth(2);
            break;
          case "=": {
            // One-way platform: solid on top only, jump up through it.
            const tile = this.walls.create(px, py - TILE / 2 + 6, "tile-platform");
            tile.setTint(theme.stoneTint).setDepth(2);
            const body = (tile as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody;
            body.checkCollision.down = false;
            body.checkCollision.left = false;
            body.checkCollision.right = false;
            break;
          }
          case "|": {
            this.walls.create(px, py, "tile-climb").setTint(theme.stoneTint).setDepth(2);
            const zone = this.add.rectangle(px - TILE, py, TILE, TILE, 0, 0);
            this.climbTiles.push(zone);
            break;
          }
          case "^": {
            const s = this.physics.add.staticImage(px, py + TILE / 2 - 6, "spikes");
            this.spikes.push(s as unknown as Phaser.Physics.Arcade.Image);
            break;
          }
          case "P": {
            if (!this.loadedState) {
              const fighter = this.spawnCharacter("pc-fighter", "Brakka", "fighter", px, py);
              this.party.add(fighter);
            }
            break;
          }
          case "2":
            if (!this.loadedState || !this.loadedState.party.some((c) => c.className === "thief")) {
              this.addNpc("thief", "Vex", px, py, "cage");
            }
            break;
          case "3":
            if (!this.loadedState || !this.loadedState.party.some((c) => c.className === "priest")) {
              this.addNpc("priest", "Odessa", px, py, "shrine");
            }
            break;
          case "4":
            if (!this.loadedState || !this.loadedState.party.some((c) => c.className === "wizard")) {
              this.addNpc("wizard", "Milo", px, py);
            }
            break;
          case "g":
          case "s":
          case "r":
          case "O": {
            const defId = { g: "goblin", s: "skeleton", r: "giant-rat", O: "gloom-ogre" }[ch];
            // One morale group per room: a leader in the room commands all of it.
            const band = ROOM_BANDS.find((b) => x >= b.x1 && x <= b.x2);
            if (!band) throw new Error(`Monster at x=${x} sits on a room divider`);
            const m = new MonsterSprite(this, px, py, monster(defId), `room-${band.room}`, this.ctx.engine.dice);
            this.morale.register(m);
            this.monsters.push(m);
            break;
          }
          case "c":
            this.addPickup(px, py, "coins", 100);
            break;
          case "G":
            this.addPickup(px, py, "gem", 1);
            break;
          case "I":
            this.addPickup(px, py, "jeweled-idol", 1);
            break;
          case "K":
            if (!this.loadedState || !this.loadedState.hasCrown) {
              this.addPickup(px, py, "crown-of-the-deep", 1);
            }
            break;
          case "t":
            this.addPickup(px, py, "torch", 1);
            break;
          case "n":
            this.addPickup(px, py, "ration", 1);
            break;
          case "f":
          case "F": {
            this.add.image(px, py + 6, "campfire").setDepth(5);
            this.add
              .image(px, py - 8, "light-radial")
              .setScale(0.82)
              .setTint(ch === "F" ? 0xffc66b : 0xff9845)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setAlpha(0.13)
              .setDepth(4);
            this.campfires.push({ x: px, y: py, free: ch === "F" });
            this.light.addSource(CAMPFIRE_RADIUS, () => ({ x: px, y: py }), {
              tint: 0xe0a868,
              tintAlpha: 0.45,
            });
            flameAt(this, px, py + 2, "campfire");
            this.fireEmitters.push(
              new SpatialEmitter(
                crackleBed({ level: 0.55, popMeanMs: 500, rumbleLevel: 0.3 }),
                { x: px, y: py },
              ),
            );
            break;
          }
          case "h": {
            this.add.image(px, py + 2, "shrine").setDepth(5);
            this.shrines.push({ x: px, y: py });
            break;
          }
          case "b": {
            const brazier = this.add.image(px, py + 3, "brazier").setDepth(5);
            this.add
              .image(px, py - 9, "light-radial")
              .setScale(0.6)
              .setTint(0xff8c3a)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setAlpha(0.14)
              .setDepth(4);
            this.light.addSource(TILE * 2.8, () => ({ x: px, y: py - 8 }), {
              tint: 0xdf9a52,
              tintAlpha: 0.42,
            });
            this.tweens.add({
              targets: brazier,
              scaleY: { from: 0.96, to: 1.06 },
              alpha: { from: 0.86, to: 1 },
              duration: 360 + ((x * 29) % 150),
              yoyo: true,
              repeat: -1,
            });
            flameAt(this, px, py - 4, "brazier");
            this.fireEmitters.push(
              new SpatialEmitter(
                crackleBed({ level: 0.4, popMeanMs: 850, rumbleLevel: 0.18 }),
                { x: px, y: py - 4 },
              ),
            );
            break;
          }
          case "*":
            this.add.image(px, py + 5, "deco-mushrooms").setDepth(3).setTint(theme.accent);
            break;
          case "q":
            this.add.image(px, py + 9, "deco-bones").setDepth(3);
            break;
          case "v":
            this.add.image(px, py - 2, "deco-banner").setDepth(3).setTint(theme.accent);
            break;
          case ":":
            this.add.image(px, py - 7, "deco-stalactite").setDepth(3).setTint(theme.stoneTint);
            break;
          case "D": {
            this.add.image(px, py - TILE / 2, "door").setDepth(5);
            this.door = { x: px, y: py };
            break;
          }
          case ".":
            break;
          default:
            throw new Error(`Unknown level char "${ch}" at (${x},${y})`);
        }
      }
    }

    if (this.loadedState) {
      const spawnPos = this.getRoomEntrancePos(this.loadedState.currentRoom);
      this.hasCrown = this.loadedState.hasCrown;

      this.loadedState.party.forEach((savedChar, idx) => {
        const char = deserializeCharacter(savedChar, this.ctx.engine);
        this.ctx.engine.registerCharacter(char);

        // Offset followers slightly to the left
        const px = spawnPos.x - idx * 24;
        const py = spawnPos.y;

        const sprite = new CharacterSprite(this, this.ctx, px, py, char, this.light);
        this.add.existing(sprite);
        this.party.add(sprite);
      });

      // Set the saved leader index
      const savedLeaderIndex = this.loadedState.party.findIndex((c) => !c.dead);
      if (savedLeaderIndex !== -1) {
        this.party.selectLeader(savedLeaderIndex);
      }
    }
  }

  private spawnCharacter(
    id: string,
    name: string,
    cls: "fighter" | "thief" | "priest" | "wizard",
    x: number,
    y: number,
  ): CharacterSprite {
    const character = createCharacter(this.ctx.engine, id, name, cls);
    return new CharacterSprite(this, this.ctx, x, y, character, this.light);
  }

  private addNpc(
    className: "thief" | "priest" | "wizard",
    name: string,
    x: number,
    y: number,
    propKey?: string,
  ): void {
    const sprite = this.add.image(x, y, `char-${className}`).setDepth(8).setTint(0x777788);
    const prop = propKey ? this.add.image(x, y + (propKey === "shrine" ? 14 : 0), propKey).setDepth(9) : undefined;
    this.npcs.push({ sprite, prop, className, name, x, y, rescued: false });
  }

  private addPickup(x: number, y: number, itemId: string, qty: number): void {
    const sprite = this.physics.add.image(x, y, `pickup-${itemId}`).setDepth(6);
    sprite.setBounce(0.2);
    this.tweens.add({
      targets: sprite,
      scale: { from: 0.94, to: 1.08 },
      alpha: { from: 0.82, to: 1 },
      duration: 720 + ((Math.floor(x) * 13) % 240),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.physics.add.collider(sprite, this.walls);
    this.pickups.push({ sprite, itemId, qty });
    if (this.trapSystem) this.trapSystem.registerActor(sprite);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error("Keyboard input unavailable");
    this.keys = kb.addKeys(
      "A,D,W,LEFT,RIGHT,UP,DOWN,SPACE,J,X,K,C,Q,E,T,H,L,M,R,TAB,ONE,TWO,THREE,FOUR,ESC,I",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown-TAB", (ev: KeyboardEvent) => ev.preventDefault());
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (ev.code === "ControlLeft") this.leftControlDown = true;
    });
    kb.on("keyup", (ev: KeyboardEvent) => {
      if (ev.code === "ControlLeft") this.leftControlDown = false;
    });
  }

  override update(time: number, delta: number): void {
    if (this.justDown("ESC")) {
      this.togglePause();
      return;
    }

    // Mute works everywhere — paused, overlays, game over.
    if (this.justDown("M")) {
      setMuted(!isMuted());
      this.ctx.say(isMuted() ? "Sound muted. (M to unmute)" : "Sound on.", "#a0a4b0");
    }

    if (this.gamePaused) {
      return;
    }

    if (this.justDown("C")) {
      this.toggleStatsOverlay();
    }
    if (this.justDown("I")) {
      this.toggleGearOverlay();
    }

    if (this.gearOverlayOpen) {
      this.updateGearOverlayInput();
      return;
    }
    if (this.statsOverlayOpen) {
      return;
    }

    if (this.gameOver || this.won) {
      if (this.keys.R!.isDown) this.restartRun();
      return;
    }

    this.updatePartyMove(time, delta);

    // Auto-save on room transition
    const currentRoom = this.currentRoomIndex;
    if (currentRoom !== this.lastRoomIndex) {
      this.lastRoomIndex = currentRoom;
      this.saveToSlot(0);
    }
    this.updateLeaderInput(time, delta);
    this.party.updateFollowers(time);
    this.trapSystem.update(time);
    this.updateMonsters(time, delta);
    this.updatePickups();
    this.updateSpikes(time);
    this.updateDying();
    this.updatePartyCombat(time);
    for (const m of this.party.members) m.tick(delta);
    this.light.update();
    const listener = this.party.leader;
    for (const e of this.fireEmitters) e.setListener({ x: listener.x, y: listener.y });
    this.updateLeaderMarker(time);
    this.updateInteractPrompt();
    this.updateLuckWindow(time);
    this.checkLevelUps();
    this.checkEndConditions();
  }

  private togglePause(): void {
    this.gamePaused = !this.gamePaused;
    this.physics.world.isPaused = this.gamePaused;
    if (this.gamePaused) {
      this.anims.pauseAll();
    } else {
      this.anims.resumeAll();
    }
    const hud = this.scene.get("Hud") as HudScene;
    if (this.gamePaused) {
      if (this.statsOverlayOpen) this.toggleStatsOverlay();
      if (this.gearOverlayOpen) this.toggleGearOverlay();
      hud.showPauseOverlay();
    } else {
      hud.hidePauseOverlay();
    }
  }

  private toggleStatsOverlay(): void {
    this.statsOverlayOpen = !this.statsOverlayOpen;
    this.physics.world.isPaused = this.statsOverlayOpen;
    if (this.statsOverlayOpen) {
      this.anims.pauseAll();
    } else {
      this.anims.resumeAll();
    }
    const hud = this.scene.get("Hud") as HudScene;
    if (this.statsOverlayOpen) {
      if (this.gamePaused) this.togglePause();
      if (this.gearOverlayOpen) this.toggleGearOverlay();
      hud.showStatsOverlay(this.party.leader.character);
    } else {
      hud.hideStatsOverlay();
    }
  }

  private toggleGearOverlay(): void {
    this.gearOverlayOpen = !this.gearOverlayOpen;
    this.physics.world.isPaused = this.gearOverlayOpen;
    if (this.gearOverlayOpen) {
      this.anims.pauseAll();
    } else {
      this.anims.resumeAll();
    }
    const hud = this.scene.get("Hud") as HudScene;
    if (this.gearOverlayOpen) {
      this.gearSelectionIndex = 0;
      if (this.gamePaused) this.togglePause();
      if (this.statsOverlayOpen) this.toggleStatsOverlay();
      this.refreshGearOverlay();
    } else {
      hud.hideGearOverlay();
    }
  }

  private equippableGear() {
    return this.party.leader.character.inventory.all().filter((stack) =>
      stack.def.weaponVisual !== undefined || stack.def.armor !== undefined || stack.def.shield === true);
  }

  private refreshGearOverlay(): void {
    const hud = this.scene.get("Hud") as HudScene;
    const gear = this.equippableGear();
    if (gear.length > 0) this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex, 0, gear.length);
    hud.hideGearOverlay();
    hud.showGearOverlay(this.party.leader.character, gear[this.gearSelectionIndex]?.def.id);
  }

  private updateGearOverlayInput(): void {
    const gear = this.equippableGear();
    if (gear.length === 0) return;
    if (this.justDown("UP")) {
      this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex - 1, 0, gear.length);
      this.refreshGearOverlay();
      return;
    }
    if (this.justDown("DOWN")) {
      this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex + 1, 0, gear.length);
      this.refreshGearOverlay();
      return;
    }
    if (!this.justDown("E")) return;
    const member = this.party.leader;
    const def = gear[this.gearSelectionIndex]!.def;
    try {
      if (def.weaponVisual) {
        if (member.torchLit && def.twoHanded) {
          throw new Error(`${member.character.name} cannot wield ${def.name} while carrying a torch`);
        }
        member.character.equipWeapon(def);
      } else if (def.armor) {
        member.character.equipArmor(def);
      } else if (def.shield) {
        member.character.equipShield(def);
        if (member.torchLit) member.character.shieldStowed = true;
      }
      this.ctx.say(`${member.character.name} equips ${def.name}.`, "#e0c060");
    } catch (error) {
      this.ctx.say(error instanceof Error ? error.message : String(error), "#d07070");
    }
    this.refreshGearOverlay();
  }

  private updateLeaderMarker(time: number): void {
    const leader = this.party.leader;
    this.leaderMarker
      .setVisible(leader.alive)
      .setPosition(leader.x, leader.y - 31)
      .setScale(1.12)
      .setAlpha(0.88 + 0.12 * Math.sin(time / 180));
  }

  /** Floating "E — do the thing" prompt above the leader. */
  private updateInteractPrompt(): void {
    const leader = this.party.leader;
    const interaction = leader.alive ? this.findInteraction(leader) : null;
    if (interaction) {
      this.interactPrompt
        .setText(`E — ${interaction.label}`)
        .setPosition(leader.x, leader.y - 42)
        .setVisible(true);
    } else {
      this.interactPrompt.setVisible(false);
    }
  }

  private updateLuckWindow(time: number): void {
    const w = this.luckWindow;
    if (!w) return;
    if (time > w.expiresAt || w.member !== this.party.leader || !w.member.alive) {
      this.luckWindow = null;
      return;
    }
    if (this.justDown("L")) {
      const c = w.member.character;
      if (!c.luckToken) throw new Error(`${c.name} has no luck token but a luck window was open`);
      c.luckToken = false;
      this.luckWindow = null;
      this.ctx.say(`${c.name} spends their luck — ${w.label}!`, "#ffd040");
      w.redo();
    }
  }

  /** Open a short reroll window if the member still holds their luck token. */
  private offerLuck(member: CharacterSprite, label: string, redo: () => void): void {
    if (!member.character.luckToken) return;
    this.luckWindow = { member, label, redo, expiresAt: this.time.now + 2500 };
  }

  private justDown(key: string): boolean {
    const k = this.keys[key];
    if (!k) throw new Error(`Key "${key}" not registered`);
    return Phaser.Input.Keyboard.JustDown(k);
  }

  private updateLeaderInput(time: number, delta: number): void {
    const leader = this.party.leader;

    // Leader swap
    if (this.justDown("TAB")) this.party.cycleLeader();
    const hotkeys: [string, number][] = [
      ["ONE", 0],
      ["TWO", 1],
      ["THREE", 2],
      ["FOUR", 3],
    ];
    for (const [key, idx] of hotkeys) {
      if (this.justDown(key) && idx < this.party.size) this.party.selectLeader(idx);
    }
    if (this.party.leader !== leader) {
      this.cameras.main.startFollow(this.party.leader, true, 0.12, 0.12);
      return;
    }
    if (!leader.alive) {
      this.party.ensureLeaderAlive();
      return;
    }

    // Movement
    const left = this.keys.A!.isDown || this.keys.LEFT!.isDown;
    const right = this.keys.D!.isDown || this.keys.RIGHT!.isDown;
    const up = this.keys.W!.isDown || this.keys.UP!.isDown || this.keys.SPACE!.isDown;

    // Ledge Grab Input Handling
    if (leader.ledgeGrabState) {
      const body = leader.body as Phaser.Physics.Arcade.Body;
      const grab = leader.ledgeGrabState;
      const down = this.keys.DOWN!.isDown;
      const oppositeDir = grab.side === "left" ? (right || this.keys.D!.isDown) : (left || this.keys.A!.isDown);

      if (up) {
        // Auto-mantle: move player onto the platform
        const tileX = Math.floor((leader.x + (grab.side === "left" ? -11 : 11)) / TILE);
        leader.y = grab.ledgeY - 16;
        leader.x = tileX * TILE + TILE / 2;
        body.setAllowGravity(true);
        leader.lastLedgeGrabReleaseAt = time;
        leader.ledgeGrabState = null;
      } else if (down || oppositeDir) {
        // Drop down
        body.setAllowGravity(true);
        leader.lastLedgeGrabReleaseAt = time;
        leader.ledgeGrabState = null;
      } else {
        // While hanging, hold position and velocity
        leader.setVelocity(0, 0);
        body.setAllowGravity(false);
        leader.y = grab.ledgeY + 15;
      }
      return;
    }

    // Fighter Bracing logic
    if (leader.character.className === "fighter") {
      const down = this.keys.DOWN!.isDown;
      if (down && leader.grounded) {
        leader.bracing = true;
        leader.setVelocityX(0);
      } else {
        leader.bracing = false;
      }
    }

    if (leader.bracing) {
      leader.noteGrounded(time);
      return;
    }

    // Thief climbing
    leader.touchingClimbable = this.climbTiles.some(
      (z) => Math.abs(z.x - leader.x) <= TILE && Math.abs(z.y - leader.y) <= TILE * 1.5,
    );
    const body = leader.body as Phaser.Physics.Arcade.Body;
    if (leader.canClimb && (up || leader.climbing)) {
      leader.climbing = true;
      body.setAllowGravity(false);
      leader.setVelocityY(up ? -120 : 60);
      if (!leader.touchingClimbable || body.blocked.down) {
        leader.climbing = false;
        body.setAllowGravity(true);
      }
    } else if (leader.climbing) {
      leader.climbing = false;
      body.setAllowGravity(true);
    }

    leader.moveHorizontal(left ? -1 : right ? 1 : 0, delta);
    leader.noteGrounded(time);
    if (up && !leader.climbing) leader.tryJump(time);

    // Follower mode toggle
    if (this.justDown("H")) {
      for (const m of this.party.members) {
        if (m === leader) continue;
        m.mode = m.mode === "follow" ? "hold" : "follow";
      }
      const mode = this.party.members.find((m) => m !== leader)?.mode;
      if (mode) this.ctx.say(`Followers: ${mode.toUpperCase()}.`);
    }

    // Attack
    if (this.keys.J!.isDown || this.keys.X!.isDown || this.leftControlDown) {
      const outcome = meleeSwing(this.meleeDeps(), leader);
      if (outcome.swung && leader.character.className === "fighter") this.breakWeakWalls(leader);
      if (outcome.check && !outcome.check.success) {
        this.offerLuck(leader, "the blade finds its mark", () => {
          leader.swingCooldown = 0;
          meleeSwing(this.meleeDeps(), leader);
        });
      }
    }

    // Cast / cycle spell
    if (this.justDown("Q") && leader.character.knownSpells.length > 0) {
      leader.spellIndex = (leader.spellIndex + 1) % leader.character.knownSpells.length;
      const slot = leader.character.knownSpells[leader.spellIndex]!;
      this.ctx.say(`Prepared: ${spell(slot.spellId).name}${slot.status === "lost" ? " (LOST)" : ""}`);
    }
    if (this.justDown("K") && leader.character.knownSpells.length > 0) {
      const result = castSelectedSpell(this.spellDeps(), leader);
      // Luck can save a plain failure; a nat-1 mishap already detonated — no take-backs.
      if (result?.outcome === "fail") {
        this.offerLuck(leader, "the weave holds", () => {
          leader.character.knownSpell(result.spell.id).status = "available";
          leader.swingCooldown = 0;
          castSelectedSpell(this.spellDeps(), leader);
        });
      }
    }

    // Torch
    if (this.justDown("T")) this.lightTorch(leader);

    // Interact
    if (this.justDown("E")) this.interact(leader);
  }

  private meleeDeps(): MeleeDeps {
    return {
      scene: this,
      ctx: this.ctx,
      light: this.light,
      monsters: () => this.monsters,
      onMonsterKilled: (m) => this.killMonster(m),
    };
  }

  private spellDeps(): SpellDeps {
    return { ...this.meleeDeps(), party: () => this.party.members };
  }

  private breakWeakWalls(leader: CharacterSprite): void {
    const hits = this.weakWalls.getChildren().filter((w) => {
      const img = w as Phaser.Physics.Arcade.Image;
      return (
        Math.abs(img.y - leader.y) < TILE * 1.2 &&
        (img.x - leader.x) * leader.facing > 0 &&
        Math.abs(img.x - leader.x) < TILE * 1.4
      );
    });
    for (const w of hits) {
      const img = w as Phaser.Physics.Arcade.Image;
      floatText(this, img.x, img.y, "CRUNCH", "#d0a060");
      img.destroy();
    }
    if (hits.length > 0) {
      sfx.crunch();
      this.cameras.main.shake(120, 0.006);
      this.ctx.say("Brakka smashes through the crumbling wall!", "#d0a060");
    }
  }

  private lightTorch(leader: CharacterSprite, message?: string): void {
    if (leader.torchLit) {
      this.ctx.say(`${leader.character.name} already carries a lit torch.`);
      return;
    }
    const weapon = leader.character.weapon;
    if (weapon.twoHanded) {
      this.ctx.say(
        `${leader.character.name} needs both hands for the ${weapon.name} — someone else must carry the light.`,
        "#d07070",
      );
      return;
    }
    if (!leader.character.inventory.has("torch")) {
      this.ctx.say(`${leader.character.name} has no torches left!`, "#d07070");
      return;
    }
    const c = leader.character;
    // The torch hand: a readied shield gets slung on the back. Light costs AC.
    if (!c.handFreeOfShield) {
      c.shieldStowed = true;
      this.ctx.say(`${c.name} slings the shield to carry the light (−2 AC).`, "#e0c060");
    }
    c.inventory.remove("torch", 1);
    leader.torchTimerId = this.light.lightTorch(
      c.id,
      () => (c.dead || !this.torchStillHeld(leader) ? null : { x: leader.x, y: leader.y }),
      () => {
        this.ctx.say(`${c.name}'s torch gutters out. The dark presses close.`, "#d07070");
        leader.torchTimerId = null;
        if (c.carriedShield && c.shieldStowed) {
          c.shieldStowed = false;
          this.ctx.say(`${c.name} readies the shield again (+2 AC).`);
        }
      },
    );
    sfx.torchIgnite();
    this.ctx.say(
      message ?? `${c.name} lights a torch (${c.inventory.count("torch")} left). It burns in real time.`,
      "#f0c060",
    );
  }

  private torchStillHeld(sprite: CharacterSprite): boolean {
    return sprite.torchTimerId !== null;
  }

  private snuffTorch(member: CharacterSprite): void {
    if (!member.torchTimerId) return;
    this.light.snuffTorch(member.torchTimerId);
    member.torchTimerId = null;
    if (member.character.carriedShield && member.character.shieldStowed) {
      member.character.shieldStowed = false;
    }
    sfx.splash();
    this.ctx.say(`${member.character.name}'s torch hisses out in the water.`, "#70b8d0");
  }

  private interact(leader: CharacterSprite): void {
    const interaction = this.findInteraction(leader);
    if (interaction) interaction.run();
    else this.ctx.say("Nothing to do here.");
  }

  /** Priority-ordered E action for the leader's position — also feeds the prompt. */
  private findInteraction(leader: CharacterSprite): Interaction | null {
    // 1. Stabilize a dying ally
    const dying = this.party.members.find(
      (m) => m !== leader && m.character.dying && zoneBetween(leader, m) === "close",
    );
    if (dying) {
      return {
        label: `stabilize ${dying.character.name}`,
        run: () => this.tryStabilize(leader, dying),
      };
    }

    // 2. Rescue an NPC
    const npc = this.npcs.find(
      (n) => !n.rescued && Phaser.Math.Distance.Between(leader.x, leader.y, n.x, n.y) < TILE * 1.6,
    );
    if (npc) {
      return {
        label: `rescue ${npc.name}`,
        run: () => {
          npc.rescued = true;
          npc.sprite.destroy();
          npc.prop?.destroy();
          const recruit = this.spawnCharacter(`pc-${npc.className}`, npc.name, npc.className, npc.x, npc.y);
          this.party.add(recruit);
          this.partyGroup.add(recruit);
          this.trapSystem.registerActor(recruit);
          this.ctx.say(
            `${npc.name} the ${classDef(npc.className).displayName} joins the party! (${this.party.size}/4)`,
            "#60e080",
          );
        },
      };
    }

    const trapInteraction = this.trapSystem.findInteraction(leader);
    if (trapInteraction) return trapInteraction;

    // 3. Disarm spikes (thief)
    if (leader.character.className === "thief") {
      const nearSpikes = this.spikes.filter(
        (s) => s.active && Phaser.Math.Distance.Between(leader.x, leader.y, s.x, s.y) < TILE * 2,
      );
      if (nearSpikes.length > 0) {
        return {
          label: "disarm the spikes",
          run: () => {
            const result = this.ctx.engine.check({
              actor: leader.character,
              stat: "DEX",
              dc: DC.NORMAL,
              kind: "stat",
            });
            if (result.success) {
              for (const s of nearSpikes) s.destroy();
              this.spikes = this.spikes.filter((s) => s.active);
              this.ctx.say(`${leader.character.name} disarms the spike trap. (rolled ${result.total})`, "#60e080");
            } else {
              this.ctx.say(`Disarm failed (rolled ${result.total} vs DC ${DC.NORMAL}).`, "#d07070");
            }
          },
        };
      }
    }

    // 4. Atone at a shrine (priest whose deity has cut them off)
    const shrine = this.shrines.find(
      (s) => Phaser.Math.Distance.Between(leader.x, leader.y, s.x, s.y) < TILE * 2,
    );
    if (shrine && leader.character.knownSpells.some((s) => s.requiresAtonement)) {
      return {
        label: "atone at the shrine",
        run: () => {
          for (const s of leader.character.knownSpells) {
            if (s.requiresAtonement) {
              s.requiresAtonement = false;
              s.status = "available";
            }
          }
          this.ctx.say(
            `${leader.character.name} kneels in penance — the deity's silence lifts.`,
            "#f0e090",
          );
        },
      };
    }

    // 5. Rest at campfire
    const fire = this.campfires.find(
      (f) => Phaser.Math.Distance.Between(leader.x, leader.y, f.x, f.y) < TILE * 2.5,
    );
    if (fire) {
      return {
        label: fire.free ? "rest (safe haven)" : "rest (1 ration each)",
        run: () => this.restParty(fire.free),
      };
    }

    // 6. Exit door
    if (Phaser.Math.Distance.Between(leader.x, leader.y, this.door.x, this.door.y) < TILE * 1.6) {
      return {
        label: this.hasCrown ? "leave with the crown" : "leave empty-handed",
        run: () => {
          sfx.doorThump();
          this.won = true;
          this.ctx.events.emit("won");
        },
      };
    }

    return null;
  }

  private tryStabilize(leader: CharacterSprite, dying: CharacterSprite): void {
    if (!leader.canSwing()) return;
    leader.startSwingCooldown();
    const result = this.ctx.engine.stabilize(leader.character, dying.character);
    if (result.success) {
      floatText(this, dying.x, dying.y - 20, `${result.natural} stable!`, "#60e080");
      this.ctx.say(`${dying.character.name} is stabilized at 1 HP.`, "#60e080");
    } else {
      floatText(this, dying.x, dying.y - 20, `${result.natural} — failed`, "#d07070");
      this.ctx.say(`Stabilize failed (rolled ${result.total} vs DC 15). Try again!`, "#d07070");
      this.offerLuck(leader, "steady hands", () => {
        leader.swingCooldown = 0;
        if (dying.character.dying) this.tryStabilize(leader, dying);
      });
    }
  }

  private restParty(free: boolean): void {
    const hostiles = this.monsters.some(
      (m) => m.aliveInFight && m.aiState === "aggro",
    );
    if (hostiles) {
      this.ctx.say("You can't rest with enemies bearing down on you!", "#d07070");
      return;
    }
    for (const m of this.party.members) {
      const c = m.character;
      if (c.dead) continue;
      if (free) {
        // The rest spot: a safe haven. Full recovery and a fresh torch, no cost.
        this.ctx.engine.freeRest(c);
        const torch = item("torch");
        if (c.inventory.canAdd(torch)) {
          c.inventory.add(torch);
          this.ctx.say(`${c.name} recovers fully and takes a fresh torch.`, "#60e080");
        } else {
          this.ctx.say(`${c.name} recovers fully — no room for a fresh torch!`, "#e0c060");
        }
      } else {
        if (!c.inventory.has("ration")) {
          this.ctx.say(`${c.name} has no ration — no rest, no recovery.`, "#d07070");
          continue;
        }
        this.ctx.engine.rest(c, item("ration"));
        this.ctx.say(`${c.name} rests: full HP, spells recovered, 1 ration consumed.`, "#60e080");
      }
    }
    this.saveToSlot(0); // Checkpoint auto-saved!
  }
  }

  private updateMonsters(time: number, delta: number): void {
    for (const m of this.monsters) {
      if (!m.active) continue;
      if (m.aiState === "fleeing") {
        m.updateAi(delta, this.party.leader);
        if (m.x < TILE || m.x > (DUNGEON_W - 2) * TILE) m.destroy();
        continue;
      }
      // Target the nearest active party member; monsters see fine in the dark.
      const target = this.party
        .aliveMembers()
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(m.x, m.y, a.x, a.y) -
            Phaser.Math.Distance.Between(m.x, m.y, b.x, b.y),
        )[0];
      m.updateAi(delta, target ?? null);
      if (
        target &&
        m.attackCooldown === 0 &&
        Phaser.Math.Distance.Between(m.x, m.y, target.x, target.y) <= CLOSE_PX
      ) {
        m.attackCooldown = MONSTER_ATTACK_COOLDOWN_MS;
        monsterSwing(this, this.ctx, this.light, m, target);
      }
    }
  }

  /** One-shots away from the leader pan, attenuate, and muffle by distance. */
  private spatial(p: Vec2): sfx.SfxOpts {
    const l = this.party.leader;
    return spatialOpts(p, { x: l.x, y: l.y });
  }

  private killMonster(m: MonsterSprite): void {
    sfx.deathKnell(m.def.undead, this.spatial(m));
    floatText(this, m.x, m.y - 10, "slain", "#c0c0c0");
    this.ctx.kills++;
    this.dropLoot(m);
    this.morale.onDeath(this.ctx, this, m, this.monsters);
    this.tweens.add({
      targets: m,
      alpha: 0,
      angle: 90,
      duration: 300,
      onComplete: () => m.destroy(),
    });
    (m.body as Phaser.Physics.Arcade.Body).enable = false;
    m.aiState = "fleeing"; // exclude from aliveInFight immediately
  }

  /** Auto-loot: monsters spill treasure where they fall; walking over it collects. */
  private dropLoot(m: MonsterSprite): void {
    const dice = this.ctx.engine.dice;
    switch (m.def.xpTier) {
      case "minor":
        this.addPickup(m.x, m.y - 6, "coins", dice.roll("3d10"));
        break;
      case "major":
        this.addPickup(m.x - 8, m.y - 6, "gem", 1);
        this.addPickup(m.x + 8, m.y - 6, "coins", dice.roll("6d10"));
        break;
      case "legendary":
        this.addPickup(m.x, m.y - 6, "jeweled-idol", 1);
        break;
    }
  }

  private updatePartyCombat(time: number): void {
    for (const m of this.party.members) {
      if (!m.alive) continue;
      const reach = m.weaponReachPx;

      // Followers on FOLLOW pick fights with whatever wanders into reach.
      let foe: MonsterSprite | undefined;
      if (m !== this.party.leader && m.mode === "follow") {
        foe = this.monsters.find(
          (mon) => mon.aliveInFight && Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= reach,
        );
      }

      // Everyone — leader and held followers included — swings back at whoever
      // hit them last, trading blows until the aggressor dies or leaves reach.
      if (!foe) {
        const aggressor = m.lastAttackedBy;
        if (
          aggressor &&
          aggressor.active &&
          aggressor.aliveInFight &&
          time - m.lastAttackedAt <= RETALIATE_WINDOW_MS &&
          Phaser.Math.Distance.Between(m.x, m.y, aggressor.x, aggressor.y) <= reach
        ) {
          foe = aggressor;
        }
      }

      if (foe) {
        m.facing = foe.x >= m.x ? 1 : -1;
        m.setFlipX(m.facing === -1);
        meleeSwing(this.meleeDeps(), m);
      }
    }
  }

  private updatePickups(): void {
    // Collected pickups leave the list — don't rescan dead sprites every frame.
    this.pickups = this.pickups.filter((p) => p.sprite.active);
    for (const p of this.pickups) {
      const collector = this.party
        .aliveMembers()
        .find((m) => Phaser.Math.Distance.Between(m.x, m.y, p.sprite.x, p.sprite.y) < 26);
      if (!collector) continue;
      const def = item(p.itemId);
      if (!collector.character.inventory.canAdd(def, p.qty)) {
        // Not a fallback — a rules outcome: slots are hard capacity.
        this.ctx.say(`${collector.character.name}'s gear slots are full! (${def.name} left behind)`, "#d07070");
        continue;
      }
      collector.character.inventory.add(def, p.qty);
      const pxCoord = p.sprite.x;
      const pyCoord = p.sprite.y;
      p.sprite.destroy();

      const jewel =
        def.id === "gem" || def.id === "jeweled-idol" || def.id === "crown-of-the-deep";
      sfx.pickupChime(jewel, this.spatial({ x: pxCoord, y: pyCoord }));
      sparkleBurst(this, pxCoord, pyCoord, jewel);
      // Coins bank toward 100-coin XP thresholds; other treasure is XP outright.
      const xp = def.id === "coins" ? this.ctx.bankCoins(p.qty) : (def.xpValue ?? 0);
      const label = p.qty > 1 ? `${p.qty} ${def.name}` : def.name;
      if (xp > 0) {
        floatText(this, collector.x, collector.y - 24, `${label} +${xp} XP`, "#e8c840");
        for (const m of this.party.members) {
          if (!m.character.dead) this.ctx.engine.awardXp(m.character, xp);
        }
        this.ctx.say(`Treasure! ${label} — party gains ${xp} XP.`, "#e8c840");
      } else if (def.id === "coins") {
        floatText(this, collector.x, collector.y - 24, `+${p.qty} coins`, "#e8c840");
      } else {
        floatText(this, collector.x, collector.y - 24, def.name, "#c0c0c0");
      }
    }
  }

  private updateSpikes(time: number): void {
    this.spikes = this.spikes.filter((s) => s.active);
    for (const s of this.spikes) {
      for (const m of this.party.aliveMembers()) {
        if (Math.abs(m.x - s.x) < 20 && Math.abs(m.y - s.y) < 26) {
          const last = this.lastHurtAt.get(m.character.id) ?? -Infinity;
          if (time - last < 800) continue;
          this.lastHurtAt.set(m.character.id, time);
          // RAW traps allow a save: DEX check to twist aside for half damage.
          const save = this.ctx.engine.check({
            actor: m.character,
            stat: "DEX",
            dc: DC.NORMAL,
            kind: "stat",
          });
          const rolled = this.ctx.engine.dice.roll("1d6");
          const dmg = save.success ? Math.floor(rolled / 2) : rolled;
          m.setVelocityY(-260);
          if (dmg === 0) {
            floatText(this, m.x, m.y - 16, `${save.natural} — twists clear!`, "#60e080");
            continue;
          }
          sfx.spikeTrap(this.spatial(m));
          floatText(
            this,
            m.x,
            m.y - 16,
            save.success ? `-${dmg} spikes (grazed)` : `-${dmg} spikes`,
            "#ff5050",
          );
          const wentDown = this.ctx.engine.damageCharacter(m.character, dmg);
          if (wentDown) this.ctx.say(`${m.character.name} is impaled and down!`, "#ff5050");
        }
      }
    }
  }

  private updateDying(): void {
    for (const m of this.party.members) {
      const c = m.character;
      const label = this.dyingLabels.get(c.id);
      if (c.dying) {
        const text = `☠ ${c.dying.roundsRemaining}`;
        if (label) {
          label.setPosition(m.x, m.y - 34).setText(text);
        } else {
          this.dyingLabels.set(
            c.id,
            this.add
              .text(m.x, m.y - 34, text, {
                fontFamily: "monospace",
                fontSize: "16px",
                color: "#ff4040",
                stroke: "#000",
                strokeThickness: 3,
                resolution: RENDER_SCALE,
              })
              .setOrigin(0.5, 1)
              .setDepth(950),
          );
        }
      } else if (label) {
        label.destroy();
        this.dyingLabels.delete(c.id);
      }
    }
  }

  private checkLevelUps(): void {
    for (const m of this.party.members) {
      const c = m.character;
      while (!c.dead && this.ctx.engine.canLevelUp(c)) {
        const result = this.ctx.engine.levelUp(c, m.cls.hitDie, m.cls.talentTableId);
        this.ctx.events.emit("levelup", { name: c.name, result });
        this.ctx.say(
          `LEVEL UP! ${c.name} → level ${result.newLevel}. +${result.hpGained} HP. Talent (${result.talent.roll}): ${result.talent.entry.text}`,
          "#ffd040",
        );
        sfx.levelUp();
        floatText(this, m.x, m.y - 40, `LEVEL ${result.newLevel}!`, "#ffd040", 18);
      }
    }
  }

  private checkEndConditions(): void {
    this.party.ensureLeaderAlive();
    if (this.party.allDownOrDead()) {
      const anyDying = this.party.members.some((m) => m.character.dying);
      if (!anyDying || this.party.isWiped()) {
        this.gameOver = true;
        this.ctx.events.emit("gameover");
      }
    }
  }

  get currentRoomIndex(): number {
    const leaderX = Math.floor(this.party.leader.x / TILE);
    const band = ROOM_BANDS.find((b) => leaderX >= b.x1 && leaderX <= b.x2 + 1);
    return band ? band.room : 1;
  }

  private getRoomEntrancePos(roomIndex: number): { x: number; y: number } {
    const band = ROOM_BANDS[roomIndex - 1];
    if (!band) return { x: TILE * 1.5, y: TILE * 12.5 };
    const startX = band.x1 + 1;
    for (let y = 0; y < DUNGEON_H - 1; y++) {
      const cell = this.activeDungeon.grid[y]?.[startX];
      const cellUnder = this.activeDungeon.grid[y+1]?.[startX];
      if (cell === "." && cellUnder === "#") {
        return { x: startX * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      }
    }
    for (let y = DUNGEON_H - 2; y >= 0; y--) {
      const cell = this.activeDungeon.grid[y]?.[startX];
      if (cell === ".") {
        return { x: startX * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      }
    }
    return { x: startX * TILE + TILE / 2, y: TILE * 12.5 };
  }

  saveToSlot(slotId: number): void {
    const state: SaveSlot = {
      slotId,
      timestamp: Date.now(),
      dungeonIndex: this.registry.get("dungeonIndex") ?? 0,
      currentRoom: this.currentRoomIndex,
      hasCrown: this.hasCrown,
      kills: this.ctx.kills,
      coinsBanked: this.ctx.totalCoins,
      party: this.party.members.map((m) => serializeCharacter(m.character)),
      rescuedIds: this.party.members.map((m) => m.character.className),
      messages: [...this.ctx.messages],
    };
    const key = slotId === 0 ? "shadowdork_autosave" : `shadowdork_slot_${slotId}`;
    localStorage.setItem(key, JSON.stringify(state));
    this.ctx.say(slotId === 0 ? "Checkpoint auto-saved." : `Game saved to Slot ${slotId}.`, "#60e080");
  }

  loadFromSlot(slotId: number): void {
    const key = slotId === 0 ? "shadowdork_autosave" : `shadowdork_slot_${slotId}`;
    const data = localStorage.getItem(key);
    if (!data) {
      this.ctx.say(`No saved game found in Slot ${slotId}.`, "#d07070");
      return;
    }
    this.registry.set("loadState", data);
    this.scene.stop("Hud");
    this.scene.restart();
  }

  private restartRun(): void {
    const currentIndex = this.registry.get("dungeonIndex");
    this.registry.set("dungeonIndex", (typeof currentIndex === "number" ? currentIndex : 0) + 1);
    this.registry.set("ctx", new GameContext());
    this.scene.stop("Hud");
    this.scene.restart();
  }
}
