/**
 * The dungeon: level construction, input, physics, and the game loop that
 * feeds real time into the engine clock. All rules resolution goes through
 * the engine; this scene renders consequences.
 */

import Phaser from "phaser";
import { classDef, createCharacter, item, monster } from "../../data";
import type { Character } from "../../engine";
import { GameContext } from "../context";
import { CharacterSprite } from "../entities/CharacterSprite";
import { MonsterSprite, MONSTER_ATTACK_COOLDOWN_MS } from "../entities/MonsterSprite";
import {
  floatText,
  meleeSwing,
  monsterSwing,
  MoraleTracker,
  type MeleeDeps,
} from "../systems/combat";
import { CAMPFIRE_RADIUS, LightSystem } from "../systems/light";
import { PartyManager } from "../systems/party";
import { CLOSE_PX, zoneBetween } from "../systems/position";
import { castSelectedSpell, type SpellDeps } from "../systems/spells";
import {
  DUNGEON_H,
  DUNGEON_W,
  dungeonAt,
  type DungeonDefinition,
} from "../level/dungeons";
import { TILE } from "../textures";

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
  private pickups: Pickup[] = [];
  private npcs: RescuableNpc[] = [];
  private campfires: { x: number; y: number; free: boolean }[] = [];
  private door!: { x: number; y: number };
  private morale = new MoraleTracker();
  private dyingLabels = new Map<string, Phaser.GameObjects.Text>();
  private gameOver = false;
  private won = false;
  private lastHurtAt = new Map<string, number>();

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super("Dungeon");
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");

    this.gameOver = false;
    this.won = false;
    this.monsters = [];
    this.pickups = [];
    this.npcs = [];
    this.campfires = [];
    this.climbTiles = [];
    this.spikes = [];
    this.dyingLabels = new Map();
    this.morale = new MoraleTracker();

    const storedIndex = this.registry.get("dungeonIndex");
    const dungeonIndex = typeof storedIndex === "number" ? storedIndex : 0;
    this.activeDungeon = dungeonAt(dungeonIndex);

    this.physics.world.setBounds(0, 0, DUNGEON_W * TILE, DUNGEON_H * TILE);
    this.cameras.main.setBounds(0, 0, DUNGEON_W * TILE, DUNGEON_H * TILE);
    this.cameras.main.setBackgroundColor(this.activeDungeon.theme.background);
    this.createAtmosphere(dungeonIndex);

    this.walls = this.physics.add.staticGroup();
    this.weakWalls = this.physics.add.staticGroup();
    this.party = new PartyManager(this.ctx);
    this.light = new LightSystem(this, this.ctx, this.activeDungeon.theme.darkness);

    this.buildLevel();
    this.setupInput();

    // Colliders
    const partyGroup = this.add.group(this.party.members);
    const monsterGroup = this.add.group(this.monsters);
    this.physics.add.collider(partyGroup, this.walls);
    this.physics.add.collider(partyGroup, this.weakWalls);
    this.physics.add.collider(monsterGroup, this.walls);
    this.physics.add.collider(monsterGroup, this.weakWalls);

    this.cameras.main.startFollow(this.party.leader, true, 0.12, 0.12);

    this.ctx.say(
      `${this.activeDungeon.name}. ${this.activeDungeon.objective}. Watch your torch.`,
      "#f0e090",
    );
    this.cameras.main.fadeIn(450, 0, 0, 0);

    this.scene.launch("Hud");
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
            const fighter = this.spawnCharacter("pc-fighter", "Brakka", "fighter", px, py);
            this.party.add(fighter);
            break;
          }
          case "2":
            this.addNpc("thief", "Vex", px, py, "cage");
            break;
          case "3":
            this.addNpc("priest", "Odessa", px, py, "shrine");
            break;
          case "4":
            this.addNpc("wizard", "Milo", px, py);
            break;
          case "g":
          case "s":
          case "r":
          case "O": {
            const defId = { g: "goblin", s: "skeleton", r: "giant-rat", O: "gloom-ogre" }[ch];
            const groupId = `${defId}-${Math.floor(x / 12)}`;
            const m = new MonsterSprite(this, px, py, monster(defId), groupId, this.ctx.engine.dice);
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
            this.addPickup(px, py, "crown-of-the-deep", 1);
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
            this.campfires.push({ x: px, y: py, free: ch === "F" });
            this.light.addSource(CAMPFIRE_RADIUS, () => ({ x: px, y: py }));
            this.add.particles(px, py + 2, "pixel", {
              color: [0xffa500, 0xff4500, 0xffd700],
              speedY: { min: -40, max: -15 },
              speedX: { min: -10, max: 10 },
              scale: { start: 1.5, end: 0 },
              lifespan: { min: 600, max: 1200 },
              frequency: 120,
              blendMode: "ADD",
            }).setDepth(4);
            break;
          }
          case "b": {
            const brazier = this.add.image(px, py + 3, "brazier").setDepth(5);
            this.light.addSource(TILE * 2.8, () => ({ x: px, y: py - 8 }));
            this.tweens.add({
              targets: brazier,
              scaleY: { from: 0.96, to: 1.06 },
              alpha: { from: 0.86, to: 1 },
              duration: 360 + ((x * 29) % 150),
              yoyo: true,
              repeat: -1,
            });
            this.add.particles(px, py - 4, "pixel", {
              color: [0xff4500, 0xff8c00, 0xffd700],
              speedY: { min: -30, max: -10 },
              speedX: { min: -6, max: 6 },
              scale: { start: 1.2, end: 0 },
              lifespan: { min: 400, max: 900 },
              frequency: 180,
              blendMode: "ADD",
            }).setDepth(4);
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
    this.physics.add.collider(sprite, this.walls);
    this.pickups.push({ sprite, itemId, qty });
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error("Keyboard input unavailable");
    this.keys = kb.addKeys(
      "A,D,W,LEFT,RIGHT,UP,SPACE,J,X,K,C,Q,E,T,H,R,TAB,ONE,TWO,THREE,FOUR",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown-TAB", (ev: KeyboardEvent) => ev.preventDefault());
  }

  override update(time: number, delta: number): void {
    if (this.gameOver || this.won) {
      if (this.keys.R!.isDown) this.restartRun();
      return;
    }

    this.ctx.engine.advance(delta);
    this.updateLeaderInput(time, delta);
    this.party.updateFollowers(time);
    this.updateMonsters(time, delta);
    this.updatePickups();
    this.updateSpikes(time);
    this.updateDying();
    this.updateFollowerCombat();
    for (const m of this.party.members) m.tick(delta);
    this.light.update();
    this.checkLevelUps();
    this.checkEndConditions();
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
    if (this.keys.J!.isDown || this.keys.X!.isDown) {
      const swung = meleeSwing(this.meleeDeps(), leader);
      if (swung && leader.character.className === "fighter") this.breakWeakWalls(leader);
    }

    // Cast / cycle spell
    if (this.justDown("Q") && leader.character.knownSpells.length > 0) {
      leader.spellIndex = (leader.spellIndex + 1) % leader.character.knownSpells.length;
      const slot = leader.character.knownSpells[leader.spellIndex]!;
      this.ctx.say(`Prepared: ${slot.spellId}${slot.status === "lost" ? " (LOST)" : ""}`);
    }
    if ((this.keys.K!.isDown || this.keys.C!.isDown) && leader.character.knownSpells.length > 0) {
      castSelectedSpell(this.spellDeps(), leader);
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
      this.cameras.main.shake(120, 0.006);
      this.ctx.say("Brakka smashes through the crumbling wall!", "#d0a060");
    }
  }

  private lightTorch(leader: CharacterSprite): void {
    if (leader.torchLit) {
      this.ctx.say(`${leader.character.name} already carries a lit torch.`);
      return;
    }
    const weapon = item(leader.cls.weaponId);
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
    leader.character.inventory.remove("torch", 1);
    const c = leader.character;
    leader.torchTimerId = this.light.lightTorch(
      c.id,
      () => (c.dead || !this.torchStillHeld(leader) ? null : { x: leader.x, y: leader.y }),
      () => {
        this.ctx.say(`${c.name}'s torch gutters out. The dark presses close.`, "#d07070");
        leader.torchTimerId = null;
      },
    );
    this.ctx.say(
      `${c.name} lights a torch (${c.inventory.count("torch")} left). It burns in real time.`,
      "#f0c060",
    );
  }

  private torchStillHeld(sprite: CharacterSprite): boolean {
    return sprite.torchTimerId !== null;
  }

  private interact(leader: CharacterSprite): void {
    // 1. Stabilize a dying ally
    const dying = this.party.members.find(
      (m) => m !== leader && m.character.dying && zoneBetween(leader, m) === "close",
    );
    if (dying) {
      if (!leader.canSwing()) return;
      leader.startSwingCooldown();
      const result = this.ctx.engine.stabilize(leader.character, dying.character);
      if (result.success) {
        floatText(this, dying.x, dying.y - 20, `${result.natural} stable!`, "#60e080");
        this.ctx.say(`${dying.character.name} is stabilized at 1 HP.`, "#60e080");
      } else {
        floatText(this, dying.x, dying.y - 20, `${result.natural} — failed`, "#d07070");
        this.ctx.say(`Stabilize failed (rolled ${result.total} vs DC 15). Try again!`, "#d07070");
      }
      return;
    }

    // 2. Rescue an NPC
    const npc = this.npcs.find(
      (n) => !n.rescued && Phaser.Math.Distance.Between(leader.x, leader.y, n.x, n.y) < TILE * 1.6,
    );
    if (npc) {
      npc.rescued = true;
      npc.sprite.destroy();
      npc.prop?.destroy();
      const recruit = this.spawnCharacter(`pc-${npc.className}`, npc.name, npc.className, npc.x, npc.y);
      this.party.add(recruit);
      this.physics.add.collider(recruit, this.walls);
      this.physics.add.collider(recruit, this.weakWalls);
      this.ctx.say(
        `${npc.name} the ${classDef(npc.className).displayName} joins the party! (${this.party.size}/4)`,
        "#60e080",
      );
      return;
    }

    // 3. Disarm spikes (thief)
    if (leader.character.className === "thief") {
      const nearSpikes = this.spikes.filter(
        (s) => s.active && Phaser.Math.Distance.Between(leader.x, leader.y, s.x, s.y) < TILE * 2,
      );
      if (nearSpikes.length > 0) {
        const result = this.ctx.engine.check({
          actor: leader.character,
          stat: "DEX",
          dc: 12,
          kind: "stat",
        });
        if (result.success) {
          for (const s of nearSpikes) s.destroy();
          this.ctx.say(`${leader.character.name} disarms the spike trap. (rolled ${result.total})`, "#60e080");
        } else {
          this.ctx.say(`Disarm failed (rolled ${result.total} vs DC 12).`, "#d07070");
        }
        return;
      }
    }

    // 4. Rest at campfire
    const fire = this.campfires.find(
      (f) => Phaser.Math.Distance.Between(leader.x, leader.y, f.x, f.y) < TILE * 2.5,
    );
    if (fire) {
      this.restParty(fire.free);
      return;
    }

    // 5. Exit door
    if (Phaser.Math.Distance.Between(leader.x, leader.y, this.door.x, this.door.y) < TILE * 1.6) {
      this.won = true;
      this.ctx.events.emit("won");
      return;
    }

    this.ctx.say("Nothing to do here.");
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

  private killMonster(m: MonsterSprite): void {
    floatText(this, m.x, m.y - 10, "slain", "#c0c0c0");
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

  private updateFollowerCombat(): void {
    for (const m of this.party.members) {
      if (m === this.party.leader || !m.alive || m.mode === "hold") continue;
      const foe = this.monsters.find(
        (mon) => mon.aliveInFight && Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= CLOSE_PX,
      );
      if (foe) {
        m.facing = foe.x >= m.x ? 1 : -1;
        m.setFlipX(m.facing === -1);
        meleeSwing(this.meleeDeps(), m);
      }
    }
  }

  private updatePickups(): void {
    for (const p of this.pickups) {
      if (!p.sprite.active) continue;
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

      // Sparkles explosion
      const sparklesColor = def.id === "gem" || def.id === "jeweled-idol" || def.id === "crown-of-the-deep"
        ? [0x69e4df, 0xc5ffff, 0xffffff]
        : [0xffd700, 0xffea70, 0xffffff];
      const sparkles = this.add.particles(pxCoord, pyCoord, "pixel", {
        color: sparklesColor,
        speed: { min: 30, max: 90 },
        scale: { start: 1.8, end: 0 },
        lifespan: { min: 250, max: 550 },
        blendMode: "ADD",
      }).setDepth(25);
      sparkles.explode(12);
      this.time.delayedCall(600, () => sparkles.destroy());
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
    for (const s of this.spikes) {
      if (!s.active) continue;
      for (const m of this.party.aliveMembers()) {
        if (Math.abs(m.x - s.x) < 20 && Math.abs(m.y - s.y) < 26) {
          const last = this.lastHurtAt.get(m.character.id) ?? -Infinity;
          if (time - last < 800) continue;
          this.lastHurtAt.set(m.character.id, time);
          const dmg = this.ctx.engine.dice.roll("1d6");
          floatText(this, m.x, m.y - 16, `-${dmg} spikes`, "#ff5050");
          const wentDown = this.ctx.engine.damageCharacter(m.character, dmg);
          m.setVelocityY(-260);
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

  private restartRun(): void {
    const currentIndex = this.registry.get("dungeonIndex");
    this.registry.set("dungeonIndex", (typeof currentIndex === "number" ? currentIndex : 0) + 1);
    this.registry.set("ctx", new GameContext());
    this.scene.stop("Hud");
    this.scene.restart();
  }
}
