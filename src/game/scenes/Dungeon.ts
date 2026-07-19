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
import {
  createCharacter,
  highestAvailableSpellIndex,
  item,
  monster,
  randomPlebName,
  spell,
} from "../../data";
import { DC, MAX_LEVEL, xpToReachNextLevel, type Alignment, type StatName } from "../../engine";
import { GameContext } from "../context";
import { RENDER_SCALE } from "../display";
import { CharacterSprite } from "../entities/CharacterSprite";
import { MonsterSprite, MONSTER_ATTACK_COOLDOWN_MS } from "../entities/MonsterSprite";
import { flameAt, sparkleBurst } from "../fx/vfx";
import {
  carriedRangedWeapon,
  floatText,
  meleeSwing,
  monsterSwing,
  MoraleTracker,
  rangedShot,
  type MeleeDeps,
} from "../systems/combat";
import { EncounterSystem } from "../systems/encounters";
import { CAMPFIRE_RADIUS, LightSystem } from "../systems/light";
import { ShadowSystem } from "../systems/shadows";
import { PartyManager } from "../systems/party";
import { CLOSE_PX, FAR_PX, zoneBetween } from "../systems/position";
import { castSelectedSpell, type SpellDeps } from "../systems/spells";
import { TrapSystem } from "../systems/traps";
import {
  dungeonAt,
  type DungeonDefinition,
  type ExpandedConnector,
  type TalkableNpcSpec,
} from "../level/dungeons";
import { expandDungeon } from "../level/expand";
import { generateAbstractDungeon, type GenerateOptions } from "../level/generate";
import {
  betrayalCharismaDc,
  persistedBetrayalFoe,
  resolveNpcInteraction,
  type NpcAction,
  type BetrayalFoeKind,
  type NpcInteractionState,
} from "../level/npcInteraction";
import { companionPartySnapshot, chooseCompanionRecruit, type CompanionCandidate, type CompanionClass } from "../systems/companion";
import type { TopologyId } from "../level/topology";
import type { Orientation } from "../level/embedding";
import type { EnvironmentTextureKeys, VisualPalette, VisualSkin } from "../visual/model";
import {
  parseVisualSkinId,
  visualSkinById,
  resolveSkinForZone,
  zoneForRun,
  zonePackInfo,
} from "../visual/skins";
import { ensureVisualSkinTextures } from "../visual/textures/materials";
import {
  openSurfaceTileRole,
  openTerrainSurvivalDurationMs,
  dangerRuleForSkin,
  openTerrainDangerDc,
  OPEN_TERRAIN_DANGER_DISTANCE_TILES,
  OPEN_TERRAIN_MAX_FLAGS,
  safeZonePresentation,
  selectOpenTerrainRoomRoles,
  survivalPressureForSkin,
  type OpenTerrainSurvivalPressure,
} from "../visual/openTerrain";
import { roomAt, roomAtTolerant } from "../level/geometry";
import {
  canTraverseConnector,
  openConnector,
  roomsAlertedByNoise,
} from "../level/connectors";
import { TILE } from "../textures";
import { serializeCharacter, deserializeCharacter, type SaveSlot } from "../state";
import { SaveRepository } from "../SaveRepository";
import {
  chooseDungeonReward,
  nextDungeonSave,
  progressFromSavedParty,
  type DungeonReward,
} from "../progression";
import { rollBiomeOffer, type BiomeOffer } from "../biomeChoice";

/**
 * How long after being hit a character keeps swinging back. Monsters attack
 * every 1.5s, so an ongoing fight refreshes this; once the aggressor stops
 * or leaves reach, retaliation lapses.
 */
const RETALIATE_WINDOW_MS = 4000;
/** Gold granted when a companion vault reward cannot recruit (full or duplicate class). */
const COMPANION_SUBSTITUTE_GOLD = 500;
const SURVIVAL_TIMER_ID = "open-terrain-survival";

/** Compact-map marker precedence: player > landmark beat > plain room > empty. */
function mapMarkerPriority(marker: string): number {
  if (marker === "@") return 3;
  if (marker === "o") return 1;
  if (marker === "·") return 0;
  return 2; // E / X / R landmark beats
}

interface TalkableNpc {
  spec: TalkableNpcSpec;
  sprite: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Text;
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
  shadows!: ShadowSystem;
  activeDungeon!: DungeonDefinition;
  visualSkin?: VisualSkin;
  private environmentTextures!: EnvironmentTextureKeys;
  private openSkyDaytime = false;
  private undergroundRoomId?: string;
  private safeZoneId?: string;
  private survivalPressure?: OpenTerrainSurvivalPressure;
  private terminalGameOverTitle = "THE DARK CLAIMS YOU";
  private dangerFlags = 0;
  private dangerChecks = 0;
  private dangerDistancePx = 0;
  private dangerKillPending = false;
  private dangerLastLeaderPos?: { x: number; y: number };

  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private weakWalls!: Phaser.Physics.Arcade.StaticGroup;
  private portcullises!: Phaser.Physics.Arcade.StaticGroup;
  private connectorGates = new Map<Phaser.Physics.Arcade.Image, ExpandedConnector>();
  private connectorWeakWalls = new Map<Phaser.Physics.Arcade.Image, ExpandedConnector>();
  private activatedRequirements = new Set<string>();
  private openedConnectors = new Set<string>();
  private connectorActorState = new WeakMap<Phaser.GameObjects.Components.Transform, {
    roomId: string;
    x: number;
    y: number;
  }>();
  private climbTiles: Phaser.GameObjects.Rectangle[] = [];
  private spikes: Phaser.Physics.Arcade.Image[] = [];
  private monsters: MonsterSprite[] = [];
  private monsterGroup!: Phaser.GameObjects.Group;
  private partyGroup!: Phaser.GameObjects.Group;
  private trapSystem!: TrapSystem;
  private fireEmitters: SpatialEmitter[] = [];
  private pickups: Pickup[] = [];
  private talkableNpcs: TalkableNpc[] = [];
  private npcInteractionStates = new Map<string, NpcInteractionState>();
  private discoveredRoomIds = new Set<string>();
  private campfires: { x: number; y: number; free: boolean }[] = [];
  private shrines: { x: number; y: number }[] = [];
  private door!: { x: number; y: number };
  private rewardMarker: { x: number; y: number; sprite: Phaser.GameObjects.Image } | null = null;
  private rewardClaimed = false;
  private currentReward!: DungeonReward;
  private morale = new MoraleTracker();
  /** Per-follower support-AI state, keyed by character id. */
  private followerAi = new Map<string, { nextMoraleAt: number; rescueTargetId: string | null }>();
  private dyingLabels = new Map<string, Phaser.GameObjects.Text>();
  private gameOver = false;
  won = false;
  /** The descent choice rolled on victory; the HUD renders it as scroll cards. */
  biomeOffer: BiomeOffer | null = null;
  /** Which offered scroll is currently highlighted. */
  biomeSelectionIndex = 0;
  /** Guards the descent transition so a held R key cannot advance (or level) twice. */
  private descending = false;
  private lastHurtAt = new Map<string, number>();
  private encounterWaves = 0;
  private interactPrompt!: Phaser.GameObjects.Text;
  loadedState: SaveSlot | null = null;
  private lastRoomId = "room-1";
  private leaderMarker!: Phaser.GameObjects.Image;
  /** Read by the HUD to show the reroll hint. */
  luckWindow: LuckWindow | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private leftControlDown = false;

  private gamePaused = false;
  private statsOverlayOpen = false;
  private gearOverlayOpen = false;
  private gearSelectionIndex = 0;
  private startPaused = true;
  private usedCharacterNames = new Set<string>();
  private startingFighterName = "";

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
      this.registry.set("runSeed", this.loadedState!.runSeed ?? 0);
      
      const newCtx = new GameContext();
      newCtx.totalCoins = this.loadedState!.coinsBanked;
      newCtx.kills = this.loadedState!.kills;
      newCtx.messages.push(...this.loadedState!.messages);
      this.registry.set("ctx", newCtx);
    }

    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");

    this.gameOver = false;
    this.terminalGameOverTitle = "THE DARK CLAIMS YOU";
    this.dangerFlags = this.loadedState?.dangerFlags ?? 0;
    this.dangerChecks = this.loadedState?.dangerChecks ?? 0;
    this.dangerDistancePx = this.loadedState?.dangerDistancePx ?? 0;
    this.dangerKillPending = this.loadedState?.dangerKillPending ?? false;
    this.dangerLastLeaderPos = undefined;
    this.won = false;
    this.biomeOffer = null;
    this.biomeSelectionIndex = 0;
    this.descending = false;
    this.gamePaused = false;
    // A capture-only query flag keeps the normal title flow unchanged while
    // allowing deterministic, unobscured art-direction screenshots.
    this.startPaused = new URLSearchParams(window.location.search).get("autostart") !== "1";
    this.statsOverlayOpen = false;
    this.gearOverlayOpen = false;
    this.gearSelectionIndex = 0;
    this.monsters = [];
    this.pickups = [];
    this.talkableNpcs = [];
    this.npcInteractionStates = new Map(
      Object.entries(this.loadedState?.npcInteractionStates ?? {}) as [string, NpcInteractionState][],
    );
    this.discoveredRoomIds = new Set(this.loadedState?.discoveredRoomIds ?? []);
    this.campfires = [];
    this.shrines = [];
    this.climbTiles = [];
    this.spikes = [];
    this.dyingLabels = new Map();
    this.morale = new MoraleTracker();
    this.followerAi = new Map();
    this.luckWindow = null;
    this.leftControlDown = false;
    this.encounterWaves = 0;
    this.rewardMarker = null;
    this.connectorGates = new Map();
    this.connectorWeakWalls = new Map();
    this.activatedRequirements = new Set(this.loadedState?.activatedRequirementIds ?? []);
    this.openedConnectors = new Set(this.loadedState?.openedConnectorIds ?? []);
    this.connectorActorState = new WeakMap();
    this.rewardClaimed = this.loadedState?.hasCrown ?? false;
    this.usedCharacterNames = new Set(this.loadedState?.party.map((member) => member.name) ?? []);
    this.startingFighterName = this.loadedState ? "" : this.nextPlebName();

    const storedIndex = this.registry.get("dungeonIndex");
    const dungeonIndex = typeof storedIndex === "number" ? storedIndex : 0;
    const storedSeed = this.registry.get("runSeed");
    const runSeed = typeof storedSeed === "number" ? storedSeed : 0;
    const layoutSeed = (runSeed + dungeonIndex) >>> 0;
    this.activeDungeon = this.resolveActiveDungeon(layoutSeed);
    const requestedSkin = parseVisualSkinId(new URLSearchParams(window.location.search).get("skin"));
    if (requestedSkin) {
      // A dev/QA override always wins so the regression matrix stays reachable.
      this.visualSkin = visualSkinById(requestedSkin);
    } else if (this.loadedState?.skinId) {
      // A save from the biome-choice era carries the exact skin it advanced into.
      this.visualSkin = visualSkinById(this.loadedState.skinId);
    } else if (!this.loadedState) {
      // A fresh campaign starts in a random scroll; the skin within it is seeded.
      this.visualSkin = resolveSkinForZone(zoneForRun(runSeed), layoutSeed);
    } else {
      // A legacy save predating biome choice keeps the original four-theme look.
      this.visualSkin = undefined;
    }
    this.openSkyDaytime = (layoutSeed & 1) === 0;
    this.environmentTextures = ensureVisualSkinTextures(
      this,
      this.visualSkin,
      `bg-${this.activeDungeon.theme.backdrop}`,
      this.openSkyDaytime,
    );
    const openTerrainRooms = this.environmentTextures.openSky
      ? selectOpenTerrainRoomRoles(this.activeDungeon.regions, this.visualSkin?.id, layoutSeed)
      : {};
    this.undergroundRoomId = openTerrainRooms.undergroundRoomId;
    this.safeZoneId = openTerrainRooms.safeZoneRoomId;
    this.survivalPressure = survivalPressureForSkin(this.visualSkin?.id);
    this.lastRoomId = this.resolveLoadedRoomId();
    this.discoveredRoomIds.add(this.lastRoomId);
    this.currentReward = chooseDungeonReward(
      dungeonIndex,
      this.loadedState
        ? progressFromSavedParty(this.loadedState.party)
        : [{ name: this.startingFighterName, className: "fighter", level: 1, knownSpellIds: [] }],
    );

    // The soundscape follows the backdrop; SHUTDOWN fires on restart too, so
    // beds never stack across runs.
    const ambience = themeAmbience(this.activeDungeon.theme.backdrop);
    this.fireEmitters = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const bed of ambience) bed.destroy();
      for (const e of this.fireEmitters) e.destroy();
    });

    const worldW = this.activeDungeon.width * TILE;
    const worldH = this.activeDungeon.height * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    // The framebuffer is render-scaled; zooming keeps the same 960x540 world view.
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(this.presentationPalette.background);
    this.createAtmosphere(layoutSeed);

    this.walls = this.physics.add.staticGroup();
    this.weakWalls = this.physics.add.staticGroup();
    this.portcullises = this.physics.add.staticGroup();
    this.party = new PartyManager(this.ctx);
    this.light = new LightSystem(
      this,
      this.ctx,
      this.presentationPalette.darkness,
      this.environmentTextures.openSky
        && this.openSkyDaytime
        && this.lastRoomId !== this.undergroundRoomId
        ? 0.28
        : 0.84,
    );
    this.shadows = new ShadowSystem(this, this.light);
    this.startSurvivalTimer();

    this.buildLevel();
    this.createSafeZoneVignette(layoutSeed);
    this.createConnectorTelegraphs();
    this.activateRoomRequirements(this.lastRoomId, false);
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
      this.presentationPalette.accent,
    );
    this.setupInput();

    // Colliders
    this.partyGroup = this.add.group(this.party.members);
    this.monsterGroup = this.add.group(this.monsters);
    this.physics.add.collider(this.partyGroup, this.walls);
    this.physics.add.collider(this.partyGroup, this.weakWalls);
    this.physics.add.collider(this.partyGroup, this.portcullises);
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
    this.physics.add.collider(this.monsterGroup, this.portcullises);
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
      .setTint(this.presentationPalette.accent)
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

    const deadline = this.survivalPressure
      ? ` ${this.survivalPressure.label}: ${Math.ceil(openTerrainSurvivalDurationMs(this.ctx.engine.config.torchMs) / 60_000)} minutes.`
      : "";
    this.ctx.say(
      `${this.dungeonDisplayName}. ${this.activeDungeon.objective}.${deadline} Watch your torch. ESC shows controls.`,
      "#f0e090",
    );
    this.cameras.main.fadeIn(450, 0, 0, 0);

    if (this.startPaused) {
      this.physics.world.isPaused = true;
      this.anims.pauseAll();
    }
    this.scene.launch("Hud");
  }

  get awaitingStart(): boolean {
    return this.startPaused;
  }

  get presentationPalette(): VisualPalette {
    return this.visualSkin?.palette ?? this.activeDungeon.theme;
  }

  get dungeonDisplayName(): string {
    return this.visualSkin?.displayName ?? this.activeDungeon.name;
  }

  private nextPlebName(): string {
    const name = randomPlebName(this.ctx.engine.dice, this.usedCharacterNames);
    this.usedCharacterNames.add(name);
    return name;
  }

  /** Spawn an encounter wave off-screen, already hunting the party. */
  private spawnEncounterWave(monsterId: string, count: number, x: number): void {
    if (this.gameOver || this.won) return;
    const clampedX = Phaser.Math.Clamp(x, TILE * 1.5, (this.activeDungeon.width - 2) * TILE);
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
    return this.rewardClaimed;
  }

  get rewardLabel(): string {
    return this.currentReward.title;
  }

  get gameOverTitle(): string {
    return this.terminalGameOverTitle;
  }

  get survivalClock(): { label: string; remainingMs: number } | undefined {
    if (!this.survivalPressure) return undefined;
    const remainingMs = this.ctx.engine.clock.hasTimer(SURVIVAL_TIMER_ID)
      ? this.ctx.engine.clock.timerRemaining(SURVIVAL_TIMER_ID)
      : 0;
    return { label: this.survivalPressure.label, remainingMs };
  }

  get dangerTrack(): { icon: string; count: number; maximum: number } | undefined {
    const rule = dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime);
    return rule ? { icon: rule.icon, count: this.dangerFlags, maximum: OPEN_TERRAIN_MAX_FLAGS } : undefined;
  }

  get safeZoneRoomId(): string | undefined {
    return this.safeZoneId;
  }

  private safeZoneAnchor(): { x: number; y: number } | undefined {
    const region = this.activeDungeon.regions.find((entry) => entry.id === this.safeZoneId);
    if (!region) return undefined;
    const centerX = (region.x1 + region.x2) / 2;
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = region.y1; y <= region.y2; y++) {
      for (let x = region.x1; x <= region.x2; x++) {
        const cell = this.activeDungeon.grid[y]?.[x];
        const below = this.activeDungeon.grid[y + 1]?.[x];
        if ((cell === "." || cell === "P") && (below === "#" || below === "%" || below === "=")) {
          candidates.push({ x, y, score: Math.abs(x - centerX) + Math.abs(y - region.y2) * 0.2 });
        }
      }
    }
    const tile = candidates.sort((a, b) => a.score - b.score)[0];
    return tile
      ? { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 }
      : { x: region.labelX * TILE, y: region.y2 * TILE };
  }

  private createSafeZoneVignette(seed: number): void {
    const presentation = safeZonePresentation(this.visualSkin?.id, seed);
    const anchor = this.safeZoneAnchor();
    if (!presentation || !anchor) return;
    const { x, y } = anchor;
    const g = this.add.graphics().setDepth(2);

    if (presentation.kind === "inn" || presentation.kind === "brothel") {
      const brothel = presentation.kind === "brothel";
      g.fillStyle(brothel ? 0x49263f : 0x51382c, 0.96);
      g.fillRoundedRect(x - 76, y - 112, 152, 112, 6);
      g.fillStyle(0x251c22, 1);
      g.fillRect(x - 16, y - 58, 32, 58);
      g.fillStyle(brothel ? 0xd55f91 : 0xe5b96a, 0.84);
      g.fillRoundedRect(x - 61, y - 78, 28, 31, 4);
      g.fillRoundedRect(x + 33, y - 78, 28, 31, 4);
      g.lineStyle(5, brothel ? 0x8f315f : 0x8e5638, 1);
      g.lineBetween(x - 82, y - 106, x, y - 132);
      g.lineBetween(x, y - 132, x + 82, y - 106);
      this.add.text(x, y - 98, presentation.name, {
        fontFamily: "Georgia, serif",
        fontSize: "10px",
        color: brothel ? "#f3a4c4" : "#f0cf86",
        stroke: "#160f12",
        strokeThickness: 3,
        resolution: RENDER_SCALE,
      }).setOrigin(0.5).setDepth(3);
    } else if (presentation.kind === "cave-pool" || presentation.kind === "oasis") {
      g.fillStyle(0x2c91a3, 0.72);
      g.fillEllipse(x - 18, y - 3, 142, 25);
      g.lineStyle(3, 0x79d8d2, 0.75);
      g.strokeEllipse(x - 18, y - 3, 130, 17);
      if (presentation.kind === "oasis") {
        g.fillStyle(0x6d4827, 1);
        g.fillRect(x + 42, y - 92, 10, 88);
        g.lineStyle(8, 0x2f7a45, 1);
        for (const [dx, dy] of [[-42, -15], [-31, -32], [0, -42], [33, -31], [43, -10]] as const) {
          g.lineBetween(x + 47, y - 88, x + 47 + dx, y - 88 + dy);
        }
      }
    } else {
      g.fillStyle(0x27343e, 1);
      g.fillEllipse(x - 45, y - 45, 100, 92);
      g.fillEllipse(x + 40, y - 52, 116, 104);
      g.fillStyle(0x10181e, 1);
      g.fillEllipse(x, y - 16, 118, 64);
      this.add.image(x, y - 2, "campfire").setDepth(4);
      this.add.image(x, y - 16, "light-radial")
        .setScale(0.72)
        .setTint(0xffb45c)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.16)
        .setDepth(3);
      this.light.addSource(CAMPFIRE_RADIUS, () => ({ x, y: y - 8 }), {
        tint: 0xe0a868,
        tintAlpha: 0.45,
      });
      flameAt(this, x, y - 6, "campfire");
    }

    this.add.text(x, y - 145, `SAFE ZONE\n${presentation.name}`, {
      fontFamily: "Georgia, serif",
      fontSize: "13px",
      align: "center",
      color: "#8fe0a3",
      stroke: "#07130b",
      strokeThickness: 4,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5).setDepth(4);
  }

  private startSurvivalTimer(): void {
    if (!this.survivalPressure) return;
    const restored = this.loadedState?.survivalRemainingMs;
    const duration = restored === undefined
      ? openTerrainSurvivalDurationMs(this.ctx.engine.config.torchMs)
      : Math.max(1, restored);
    this.ctx.engine.clock.addTimer(SURVIVAL_TIMER_ID, duration, () => {
      if (this.won || this.gameOver) return;
      this.gameOver = true;
      this.terminalGameOverTitle = this.survivalPressure!.failureTitle;
      this.ctx.say(this.survivalPressure!.failureMessage, "#ff6159");
      this.ctx.events.emit("gameover");
    });
  }

  private updateOpenTerrainDanger(currentRoom: string): void {
    const rule = dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime);
    if (!rule) return;
    const leader = this.party.leader;
    const previous = this.dangerLastLeaderPos;
    this.dangerLastLeaderPos = { x: leader.x, y: leader.y };

    if (currentRoom === this.safeZoneId) {
      if (this.dangerFlags > 0 || this.dangerChecks > 0 || this.dangerKillPending) {
        this.ctx.say("Shelter clears the expedition's danger track.", "#72d887");
      }
      this.dangerFlags = 0;
      this.dangerChecks = 0;
      this.dangerDistancePx = 0;
      this.dangerKillPending = false;
      return;
    }

    if (previous) {
      const step = Math.hypot(leader.x - previous.x, leader.y - previous.y);
      // Room teleports and load placement are not travel; ordinary movement is.
      this.dangerDistancePx += Math.min(step, TILE * 2);
    }
    if (
      this.dangerKillPending
      && this.dangerDistancePx >= OPEN_TERRAIN_DANGER_DISTANCE_TILES * TILE
    ) {
      this.resolveOpenTerrainDanger(rule);
    }
  }

  private resolveOpenTerrainDanger(rule: NonNullable<ReturnType<typeof dangerRuleForSkin>>): void {
    const checkIndex = this.dangerChecks++;
    const dc = openTerrainDangerDc(checkIndex);
    this.dangerDistancePx = 0;
    this.dangerKillPending = false;

    let avoided = false;
    if (rule.saveStats) {
      const actor = this.party.leader.character;
      const stat = rule.saveStats.reduce((best, candidate) =>
        actor.mod(candidate) > actor.mod(best) ? candidate : best,
      ) as StatName;
      if (rule.encounter) this.ctx.say(rule.encounter, "#e3c56d");
      const result = this.ctx.engine.check({ actor, stat, dc, kind: "stat" });
      avoided = result.success;
      this.ctx.say(
        `${actor.name}: ${stat} ${result.total} vs DC ${dc} — ${avoided ? "danger avoided" : `${rule.icon} gained`}.`,
        avoided ? "#72d887" : "#ff9c4a",
      );
    } else {
      this.ctx.say(`The journey takes its toll: ${rule.icon} gained.`, "#ff9c4a");
    }
    if (avoided) return;

    this.dangerFlags++;
    if (this.dangerFlags >= OPEN_TERRAIN_MAX_FLAGS) {
      this.gameOver = true;
      this.terminalGameOverTitle = rule.failureTitle;
      this.ctx.say(rule.failureMessage, "#ff6159");
      this.ctx.events.emit("gameover");
    }
  }

  private createAtmosphere(dungeonIndex: number): void {
    const worldW = this.activeDungeon.width * TILE;
    const worldH = this.activeDungeon.height * TILE;
    const theme = this.presentationPalette;

    if (this.environmentTextures.openSky) {
      // Exterior skins own the full horizon; do not wash them back into the
      // legacy cavern silhouette. Day/night is baked into the selected key.
      this.add
        .tileSprite(0, 0, worldW, worldH, this.environmentTextures.backdrop)
        .setOrigin(0)
        .setScrollFactor(0.12, 0.05)
        .setAlpha(1)
        .setDepth(-30);
      this.add
        .tileSprite(0, 0, worldW, worldH, "bg-bumps")
        .setOrigin(0)
        .setScrollFactor(0.45, 0.25)
        .setTint(this.openSkyDaytime ? 0xffffff : theme.accent)
        .setAlpha(this.openSkyDaytime ? 0.06 : 0.14)
        .setDepth(-24);
    } else {
      this.add
        .tileSprite(0, 0, worldW, worldH, "bg-cavern")
        .setOrigin(0)
        .setScrollFactor(0.12, 0.05)
        .setTint(theme.haze)
        .setAlpha(0.72)
        .setDepth(-30);
      // Themed math-built backdrop: columns, tentacle swirls, or aztec fractals.
      this.add
        .tileSprite(0, 0, worldW, worldH, this.environmentTextures.backdrop)
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
    }
    const undergroundRegion = this.activeDungeon.regions.find(
      (region) => region.id === this.undergroundRoomId,
    );
    if (undergroundRegion) {
      const x = undergroundRegion.x1 * TILE;
      const y = undergroundRegion.y1 * TILE;
      const width = (undergroundRegion.x2 - undergroundRegion.x1 + 1) * TILE;
      const height = (undergroundRegion.y2 - undergroundRegion.y1 + 1) * TILE;
      this.add
        .tileSprite(x, y, width, height, "bg-cavern")
        .setOrigin(0)
        .setTint(theme.haze)
        .setAlpha(0.94)
        .setDepth(-18);
    }
    this.add
      .tileSprite(0, worldH - 190, worldW, 190, "bg-fog")
      .setOrigin(0)
      .setScrollFactor(0.28, 0.12)
      .setTint(theme.accent)
      .setAlpha(0.14)
      .setDepth(-20);

    // Deterministic motes make each theme feel alive without affecting play.
    for (let i = 0; i < 36; i++) {
      const x = ((i * 173 + dungeonIndex * 97) % (worldW - 80)) + 40;
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

    // Room labels are drawn from the active dungeon's regions, so the backdrop
    // annotates whatever layout was generated rather than a fixed room band.
    for (const region of this.activeDungeon.regions) {
      // Anchor near the top of the region (56px into the first row for the legacy
      // layout), so tall vertical rooms still read their label from above.
      const labelY = region.y1 * TILE + 24;
      const safeZone = region.id === this.safeZoneId;
      this.add
        .text(region.labelX * TILE, labelY, safeZone ? `${region.title}\nSAFE ZONE` : region.title, {
          fontFamily: "Georgia, serif",
          fontSize: "18px",
          color: safeZone ? "#8fe0a3" : `#${theme.accent.toString(16).padStart(6, "0")}`,
          align: "center",
          letterSpacing: 3,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5)
        .setAlpha(0.22)
        .setDepth(-5);
    }
  }

  private buildLevel(): void {
    const theme = this.presentationPalette;
    const textures = this.environmentTextures;
    const foregroundTint = this.visualSkin ? textures.foregroundTint : theme.stoneTint;
    for (let y = 0; y < this.activeDungeon.height; y++) {
      const row = this.activeDungeon.grid[y]!;
      for (let x = 0; x < this.activeDungeon.width; x++) {
        const ch = row[x]!;
        const px = x * TILE + TILE / 2;
        const py = y * TILE + TILE / 2;
        switch (ch) {
          case "#": {
            const variant = x * 17 + y * 31;
            let textureKey = textures.wall(variant);
            let visible = true;
            if (textures.supportWall) {
              const underground = roomAt(this.activeDungeon.regions, x, y)?.id === this.undergroundRoomId;
              if (underground) {
                textureKey = textures.supportWall(variant);
              } else {
                const role = openSurfaceTileRole(this.activeDungeon.grid, x, y);
                if (role === "support") textureKey = textures.supportWall(variant);
                else if (role === "overhang") textureKey = textures.overhang ?? textureKey;
                else if (role === "hidden-ceiling") {
                  textureKey = textures.overhang ?? textureKey;
                  visible = false;
                }
              }
            }
            const wall = this.walls.create(px, py, textureKey).setTint(foregroundTint).setDepth(1);
            if (!visible) wall.setVisible(false);
            break;
          }
          case "%":
            {
              const wall = this.weakWalls.create(px, py, textures.weakWall).setTint(foregroundTint).setDepth(2);
              const connector = this.activeDungeon.connectors?.find(
                (entry) => entry.blocker?.x === x && entry.blocker?.y === y,
              );
              if (connector && this.openedConnectors.has(connector.id)) wall.destroy();
              else if (connector) this.connectorWeakWalls.set(wall, connector);
            }
            break;
          case "=": {
            // One-way platform: solid on top only, jump up through it.
            const tile = this.walls.create(px, py - TILE / 2 + 6, textures.platform);
            tile.setTint(foregroundTint).setDepth(2);
            const body = (tile as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody;
            body.checkCollision.down = false;
            body.checkCollision.left = false;
            body.checkCollision.right = false;
            break;
          }
          case "|": {
            // Non-solid: the ladder is a climb route, not a wall. Render it, but
            // keep it out of the `walls` collision group so the party can walk
            // through and under it. Traversal is driven entirely by the climb
            // zone in the lane beside it (see the scene's climb handling).
            if (textures.climbBackdrop) {
              this.add.image(px, py, textures.climbBackdrop).setTint(foregroundTint).setDepth(1);
            }
            this.add.image(px, py, textures.climb).setTint(foregroundTint).setDepth(2);
            const zone = this.add.rectangle(px - TILE, py, TILE, TILE, 0, 0);
            this.climbTiles.push(zone);
            break;
          }
          case "+": {
            const gate = this.portcullises.create(px, py, textures.portcullis);
            gate.setTint(foregroundTint).setDepth(6);
            const connector = this.activeDungeon.connectors?.find(
              (entry) => entry.blocker?.x === x && entry.blocker?.y === y,
            );
            if (connector && this.openedConnectors.has(connector.id)) gate.destroy();
            else if (connector) this.connectorGates.set(gate, connector);
            break;
          }
          case "^": {
            const s = this.physics.add.staticImage(px, py + TILE / 2 - 6, "spikes");
            this.spikes.push(s as unknown as Phaser.Physics.Arcade.Image);
            break;
          }
          case "P": {
            if (!this.loadedState) {
              const fighter = this.spawnCharacter(
                "pc-fighter",
                this.startingFighterName,
                "fighter",
                px,
                py,
              );
              this.party.add(fighter);
            }
            break;
          }
          case "N": {
            const spec = this.activeDungeon.talkableNpcs?.find(
              (candidate) => candidate.tile.x === x && candidate.tile.y === y,
            );
            if (!spec) throw new Error(`Talkable NPC at (${x},${y}) has no deterministic spec`);
            this.addTalkableNpc(spec, px, py);
            break;
          }
          case "g":
          case "s":
          case "r":
          case "O": {
            const defId = { g: "goblin", s: "skeleton", r: "giant-rat", O: "gloom-ogre" }[ch];
            // One morale group per room: a leader in the room commands all of it.
            const region = roomAt(this.activeDungeon.regions, x, y);
            if (!region) throw new Error(`Monster at (${x},${y}) sits outside every room region`);
            const m = new MonsterSprite(this, px, py, monster(defId), region.id, this.ctx.engine.dice);
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
            if (!this.rewardClaimed) this.addRewardMarker(px, py);
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
            // Deep prop: a fixed self-shadow that doesn't swing with the light.
            this.shadows.register({
              position: () => ({ x: px, y: py }),
              kind: "deep",
              footOffset: TILE / 2 - 2,
              depth: 4,
              options: { baseScaleX: 1.3, baseAlpha: 0.45 },
            });
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
            this.shadows.register({
              position: () => ({ x: px, y: py }),
              kind: "deep",
              footOffset: TILE / 2 - 2,
              depth: 4,
              options: { baseScaleX: 1.1, baseAlpha: 0.45 },
            });
            break;
          }
          case "b": {
            const brazier = this.add.image(px, py + 3, "brazier").setDepth(5);
            this.shadows.register({
              position: () => ({ x: px, y: py }),
              kind: "deep",
              footOffset: TILE / 2 - 2,
              depth: 4,
              options: { baseScaleX: 1.0, baseAlpha: 0.45 },
            });
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
            this.add.image(px, py + 5, textures.decorations.mushrooms).setDepth(3).setTint(this.visualSkin ? 0xffffff : theme.accent);
            break;
          case "q":
            this.add.image(px, py + 9, textures.decorations.bones).setDepth(3);
            break;
          case "v":
            this.add.image(px, py - 2, textures.decorations.banner).setDepth(3).setTint(this.visualSkin ? 0xffffff : theme.accent);
            break;
          case ":":
            this.add.image(px, py - 7, textures.decorations.stalactite).setDepth(3).setTint(this.visualSkin ? 0xffffff : theme.stoneTint);
            break;
          case "D": {
            this.add.image(px, py - TILE / 2, textures.door).setDepth(5);
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
      const spawnPos = this.getRoomEntrancePos(this.lastRoomId);
      // The backward-compatible hasCrown flag now means the vault reward was claimed.

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

  /** Direction/state cues are authored from connector metadata, not tile guesses. */
  private createConnectorTelegraphs(): void {
    for (const junction of this.activeDungeon.junctions ?? []) {
      this.add.text(
        junction.tile.x * TILE + TILE / 2,
        junction.tile.y * TILE - TILE,
        "◇ JUNCTION",
        {
          fontFamily: "Consolas, monospace",
          fontSize: "10px",
          color: "#8bd6d0",
          stroke: "#050508",
          strokeThickness: 3,
          resolution: RENDER_SCALE,
        },
      ).setOrigin(0.5).setAlpha(0.82).setDepth(5);
    }
    for (const connector of this.activeDungeon.connectors ?? []) {
      if (connector.direction === "two-way") continue;
      const forward = connector.direction === "from-to";
      const points = forward ? connector.waypoints : [...connector.waypoints].reverse();
      const origin = points[0]!;
      const next = points[1] ?? origin;
      const dx = Math.sign(next.x - origin.x);
      const dy = Math.sign(next.y - origin.y);
      const arrow = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "↓" : "↑") : (dx > 0 ? "→" : "←");
      const kind = connector.kind === "controlled-drop"
        ? "CONTROLLED DROP"
        : connector.kind === "slide" ? "SLIDE" : "ONE WAY";
      this.add.text(
        (origin.x + dx * 2) * TILE + TILE / 2,
        (origin.y + dy * 2) * TILE - TILE * 0.75,
        `${arrow} ${kind}`,
        {
          fontFamily: "Consolas, monospace",
          fontSize: "10px",
          color: "#e8b85c",
          stroke: "#050508",
          strokeThickness: 3,
          resolution: RENDER_SCALE,
        },
      ).setOrigin(0.5).setAlpha(0.78).setDepth(5);
    }
  }

  private spawnCharacter(
    id: string,
    name: string,
    cls: "fighter" | "thief" | "priest" | "wizard",
    x: number,
    y: number,
    alignment?: Alignment,
  ): CharacterSprite {
    const character = createCharacter(this.ctx.engine, id, name, cls, "human", alignment);
    return new CharacterSprite(this, this.ctx, x, y, character, this.light);
  }

  private addTalkableNpc(spec: TalkableNpcSpec, x: number, y: number): void {
    const state = this.npcInteractionStates.get(spec.id) ?? "unmet";
    const persistedFoe = persistedBetrayalFoe(spec.outcome, state);
    if (persistedFoe) {
      // The betrayer departed, but their ambush is a saved consequence: re-create
      // the foe at their post instead of silently dropping it on reload.
      this.createBetrayalFoe(x, y, spec, persistedFoe);
      return;
    }
    if (state === "departed") return;
    if (
      state === "resolved" &&
      spec.outcome === "companion-eligible" &&
      this.loadedState?.party.some((member) => member.name === spec.name)
    ) return;
    const sprite = this.add.image(x, y, "char-wizard").setDepth(8).setTint(0xd6b36a);
    const marker = this.add.text(x, y - 30, state === "resolved" ? "·" : "!", {
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      color: state === "resolved" ? "#8a8068" : "#ffe090",
      stroke: "#050508",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5).setDepth(10);
    this.talkableNpcs.push({ spec, sprite, marker });
    this.shadows.register({
      position: () => (sprite.active ? { x: sprite.x, y: sprite.y } : null),
      kind: "cast",
      footOffset: 15,
      depth: 7,
      options: { baseScaleX: 0.9, baseAlpha: 0.6 },
    });
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
    // Small, flat, movable: a torch-driven cast shadow, gone when collected.
    this.shadows.register({
      position: () => (sprite.active ? { x: sprite.x, y: sprite.y } : null),
      kind: "cast",
      footOffset: 11,
      depth: 5,
      options: { baseScaleX: 0.7, baseAlpha: 0.5 },
    });
  }

  private addRewardMarker(x: number, y: number): void {
    const reward = this.currentReward;
    const texture = reward.kind === "companion"
      ? `char-${reward.className}`
      : reward.kind === "gold"
        ? "pickup-coins"
        : reward.kind === "spells"
          ? "spell-bolt"
          : `pickup-${reward.itemId}`;
    const sprite = this.add.image(x, y, texture).setDepth(8);
    if (reward.kind === "companion") sprite.setTint(0xa9a8bd);
    this.tweens.add({
      targets: sprite,
      y: y - 5,
      alpha: { from: 0.78, to: 1 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.rewardMarker = { x, y, sprite };
    // Marker hovers, but its shadow stays pooled on the floor and leans with the torch.
    this.shadows.register({
      position: () => (sprite.active ? { x, y } : null),
      kind: "cast",
      footOffset: 16,
      depth: 7,
      options: { baseScaleX: 0.85, baseAlpha: 0.55 },
    });
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
    if (this.startPaused) {
      if (this.startControlDown()) this.dismissStartPause();
      return;
    }

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
      if (this.won && this.biomeOffer) this.updateBiomeChoiceInput();
      if (this.keys.R!.isDown) this.restartRun();
      return;
    }

    // Keep all rules time (rounds, torches, spell effects) in lockstep with gameplay.
    this.ctx.engine.advance(delta);
    if (this.gameOver || this.won) return;

    // Directional connectors apply to the whole party (including followers) and
    // monsters. Check before room-transition persistence observes the new room.
    this.enforceConnectorTraversal();

    // Auto-save on room transition
    const currentRoom = this.currentRoomId;
    this.updateOpenTerrainDanger(currentRoom);
    if (this.gameOver) return;
    if (currentRoom !== this.lastRoomId) {
      this.lastRoomId = currentRoom;
      this.discoveredRoomIds.add(currentRoom);
      this.activateRoomRequirements(currentRoom, true);
      this.saveToSlot(0);
    }
    this.updateLeaderInput(time, delta);
    this.party.updateFollowers(time, (m, dir, targetY) => this.followerCanStep(m, dir, targetY));
    this.updateFollowerClimbs();
    this.updateFollowerSupport(time);
    this.trapSystem.update(time);
    this.updateMonsters(time, delta);
    this.updatePickups();
    this.updateSpikes(time);
    this.updateDying();
    this.updatePartyCombat(time);
    for (const m of this.party.members) m.tick(delta);
    // Cast shadows follow the nearest light — projected after movement settles.
    for (const m of this.party.members) m.updateShadow(this.light);
    for (const m of this.monsters) m.updateShadow(this.light);
    this.shadows.update();
    this.light.setDarknessAlpha(
      this.environmentTextures.openSky
        && this.openSkyDaytime
        && currentRoom !== this.undergroundRoomId
        ? 0.28
        : 0.84,
    );
    this.light.update();
    const listener = this.party.leader;
    for (const e of this.fireEmitters) e.setListener({ x: listener.x, y: listener.y });
    this.updateLeaderMarker(time);
    this.updateInteractPrompt();
    this.updateLuckWindow(time);
    this.checkLevelUps();
    this.checkEndConditions();
  }

  togglePause(): void {
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

  private startControlDown(): boolean {
    return ["A", "D", "W", "LEFT", "RIGHT", "UP", "DOWN", "SPACE", "J", "X", "K"]
      .some((key) => this.keys[key]!.isDown) || this.leftControlDown;
  }

  private dismissStartPause(): void {
    this.startPaused = false;
    this.physics.world.isPaused = false;
    this.anims.resumeAll();
    const hud = this.scene.get("Hud") as HudScene;
    hud.hideStartOverlay();
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

  /** Move the descent-choice cursor with arrows or select a scroll by number. */
  private updateBiomeChoiceInput(): void {
    const offer = this.biomeOffer;
    if (!offer) return;
    const count = offer.zones.length;
    if (this.justDown("LEFT")) this.biomeSelectionIndex = (this.biomeSelectionIndex + count - 1) % count;
    if (this.justDown("RIGHT")) this.biomeSelectionIndex = (this.biomeSelectionIndex + 1) % count;
    const numberKeys: readonly [string, number][] = [["ONE", 0], ["TWO", 1], ["THREE", 2], ["FOUR", 3]];
    for (const [key, index] of numberKeys) {
      if (index < count && this.justDown(key)) this.biomeSelectionIndex = index;
    }
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
      if (outcome.swung) this.emitNoiseAt(leader.x, leader.y);
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
      const connector = this.connectorWeakWalls.get(img);
      if (connector) openConnector(connector, this.activatedRequirements, this.openedConnectors);
      img.destroy();
    }
    if (hits.length > 0) {
      sfx.crunch();
      this.cameras.main.shake(120, 0.006);
      this.ctx.say("Brakka smashes through the crumbling wall!", "#d0a060");
      this.emitNoiseAt(leader.x, leader.y);
      this.saveToSlot(0);
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

    // 2. Talkable social encounters are distinct from immediate rescues.
    const talkable = this.talkableNpcs.find(
      (npc) => Phaser.Math.Distance.Between(leader.x, leader.y, npc.sprite.x, npc.sprite.y) < TILE * 1.8,
    );
    if (talkable) {
      const state = this.npcInteractionStates.get(talkable.spec.id) ?? "unmet";
      return {
        label: `${state === "unmet" ? "speak with" : state === "heard" ? "continue with" : "recall words from"} ${talkable.spec.name}`,
        run: () => this.advanceNpcInteraction(talkable, leader),
      };
    }

    // 3. Claim the single campaign reward in the fifth room.
    const reward = this.rewardMarker;
    if (
      reward &&
      !this.rewardClaimed &&
      Phaser.Math.Distance.Between(leader.x, leader.y, reward.x, reward.y) < TILE * 1.8
    ) {
      return {
        label: `claim ${this.currentReward.title}`,
        run: () => this.claimDungeonReward(),
      };
    }

    const trapInteraction = this.trapSystem.findInteraction(leader);
    if (trapInteraction) return trapInteraction;

    const gate = this.portcullises.getChildren().find((candidate) => {
      const image = candidate as Phaser.Physics.Arcade.Image;
      return image.active && Phaser.Math.Distance.Between(leader.x, leader.y, image.x, image.y) < TILE * 1.8;
    }) as Phaser.Physics.Arcade.Image | undefined;
    if (gate) {
      const connector = this.connectorGates.get(gate);
      const requirement = connector?.requirement;
      if (requirement && !this.activatedRequirements.has(requirement.id)) {
        return {
          label: requirement.kind === "key" ? "requires its key" : "requires its switch",
          run: () => this.ctx.say(
            requirement.kind === "key" ? "The portcullis needs its key." : "The portcullis needs its switch.",
            "#e0c060",
          ),
        };
      }
      return {
        label: connector?.state === "secret" ? "reveal the secret door" : "raise the portcullis",
        run: () => {
          if (connector) {
            const result = openConnector(connector, this.activatedRequirements, this.openedConnectors);
            if (result === "requires-key" || result === "requires-switch") return;
          }
          gate.destroy();
          sfx.doorThump();
          this.ctx.say(
            connector?.state === "secret"
              ? `${leader.character.name} finds a concealed release.`
              : `${leader.character.name} heaves the portcullis open.`,
            "#d0c080",
          );
          this.emitNoiseAt(leader.x, leader.y);
          this.saveToSlot(0);
        },
      };
    }

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
          this.ctx.engine.atone(leader.character);
          this.ctx.say(
            `${leader.character.name} completes their penance — the lost spells will return after rest.`,
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
        label: this.rewardClaimed ? `leave with ${this.currentReward.title}` : "claim the vault reward first",
        run: () => {
          if (!this.rewardClaimed) {
            this.ctx.say("The dungeon is not complete — claim the reward in room five first.", "#e0c060");
            return;
          }
          sfx.doorThump();
          this.won = true;
          const dungeonIndex = this.registry.get("dungeonIndex") ?? 0;
          const runSeed = this.registry.get("runSeed") ?? 0;
          this.biomeOffer = rollBiomeOffer(dungeonIndex, runSeed);
          this.biomeSelectionIndex = 0;
          this.ctx.events.emit("won");
        },
      };
    }

    return null;
  }

  private advanceNpcInteraction(npc: TalkableNpc, leader: CharacterSprite): void {
    const { spec } = npc;
    const inventory = leader.character.inventory;
    const state = this.npcInteractionStates.get(spec.id) ?? "unmet";
    const betrayalDc = spec.outcome === "betrayal" && state === "heard"
      ? betrayalCharismaDc(leader.character.alignment, spec.alignment)
      : undefined;
    const betrayalCheck = betrayalDc === undefined
      ? undefined
      : this.ctx.engine.check({ actor: leader.character, stat: "CHA", dc: betrayalDc, kind: "stat" });
    const actions = resolveNpcInteraction({
      spec,
      state,
      leaderName: leader.character.name,
      inventory: {
        hasRation: inventory.has("ration"),
        canAddTorch: inventory.canAdd(item("torch")),
        gemFitsAfterTrade: inventory.canSwap("ration", item("gem")),
      },
      betrayalCheck,
      leaderLevel: leader.character.level,
    });
    for (const action of actions) this.applyNpcAction(action, npc, leader);
  }

  /** Execute one resolved NPC action against live scene state. */
  private applyNpcAction(action: NpcAction, npc: TalkableNpc, leader: CharacterSprite): void {
    switch (action.type) {
      case "say":
        this.ctx.say(action.text, action.color);
        break;
      case "grant-item":
        leader.character.inventory.add(item(action.itemId));
        break;
      case "consume-item":
        leader.character.inventory.remove(action.itemId, action.count);
        break;
      case "open-connector":
        if (this.openNpcTargetConnector(action.connectorId, action.operateRequirement)) {
          this.ctx.say(action.successText, action.successColor);
        }
        break;
      case "spawn-betrayal":
        this.spawnNpcBetrayal(npc, action.foe);
        break;
      case "set-state":
        this.npcInteractionStates.set(npc.spec.id, action.state);
        break;
      case "mark-resolved":
        npc.marker.setText("·").setColor("#8a8068");
        break;
      case "persist":
        this.saveToSlot(0);
        break;
    }
  }

  private openNpcTargetConnector(connectorId: string | undefined, operateRequirement: boolean): boolean {
    const connector = (this.activeDungeon.connectors ?? []).find((candidate) => candidate.id === connectorId);
    if (!connector) return false;
    if (operateRequirement && connector.requirement) {
      this.activatedRequirements.add(connector.requirement.id);
    }
    const result = openConnector(connector, this.activatedRequirements, this.openedConnectors);
    if (result === "requires-key" || result === "requires-switch") return false;
    for (const [gate, mapped] of this.connectorGates) if (mapped.id === connector.id) gate.destroy();
    for (const [wall, mapped] of this.connectorWeakWalls) if (mapped.id === connector.id) wall.destroy();
    return true;
  }

  /**
   * Create an alerted betrayal ambusher and register it with morale + the monster
   * list. Group/trap membership is added by the caller: live betrayals wire it up
   * immediately, while reload-time spawns rely on buildLevel's post-pass.
   */
  private createBetrayalFoe(x: number, y: number, spec: TalkableNpcSpec, kind: BetrayalFoeKind): MonsterSprite {
    const base = monster(this.activeDungeon.encounterMonsterId);
    const def = kind === "npc" ? { ...base, name: spec.name, leader: true } : base;
    const foe = new MonsterSprite(
      this,
      x,
      y,
      def,
      spec.roomId,
      this.ctx.engine.dice,
      kind === "npc" ? "char-wizard" : undefined,
    );
    this.morale.register(foe);
    this.monsters.push(foe);
    foe.alert();
    return foe;
  }

  private spawnNpcBetrayal(npc: TalkableNpc, kind: BetrayalFoeKind): void {
    const foe = this.createBetrayalFoe(npc.sprite.x, npc.sprite.y, npc.spec, kind);
    this.monsterGroup.add(foe);
    this.trapSystem.registerActor(foe);
    npc.sprite.destroy();
    npc.marker.destroy();
    this.talkableNpcs = this.talkableNpcs.filter((candidate) => candidate !== npc);
    this.ctx.say(
      kind === "npc" ? `${npc.spec.name} draws steel!` : `${npc.spec.name}'s allies spring the ambush!`,
      "#d07070",
    );
    this.emitNoiseAt(foe.x, foe.y);
  }

  private claimDungeonReward(): void {
    if (this.rewardClaimed || !this.rewardMarker) return;
    const reward = this.currentReward;
    let message = "";

    if (reward.kind === "companion") {
      const eligibleNpc = this.talkableNpcs.find((npc) =>
        npc.spec.outcome === "companion-eligible" &&
        npc.spec.companionClass &&
        this.npcInteractionStates.get(npc.spec.id) === "resolved",
      );
      const npcCandidate: CompanionCandidate | null = eligibleNpc
        ? {
            id: `pc-${eligibleNpc.spec.id}`,
            name: eligibleNpc.spec.name,
            className: eligibleNpc.spec.companionClass!,
            alignment: eligibleNpc.spec.alignment,
            fromNpc: true,
          }
        : null;
      const decision = chooseCompanionRecruit(
        npcCandidate,
        { id: `pc-${reward.className}`, name: reward.name, className: reward.className, alignment: reward.alignment, fromNpc: false },
        companionPartySnapshot(this.party.members.map((member) => ({
          className: member.character.className as CompanionClass,
          dead: member.character.dead,
        }))),
      );
      if (decision.kind === "skip") {
        this.grantGoldReward(COMPANION_SUBSTITUTE_GOLD);
        if (eligibleNpc) this.departNpc(eligibleNpc);
        message = decision.reason === "party-full"
          ? `Four already march together — the recruit leaves ${COMPANION_SUBSTITUTE_GOLD} gold and parts ways.`
          : `A ${decision.className} already travels with you — the recruit leaves ${COMPANION_SUBSTITUTE_GOLD} gold instead.`;
      } else {
        const { candidate } = decision;
        for (const casualty of this.party.pruneDeadMembers()) casualty.destroy();
        const recruit = this.spawnCharacter(
          candidate.id,
          candidate.name,
          candidate.className,
          this.rewardMarker.x,
          this.rewardMarker.y,
          candidate.alignment,
        );
        this.party.add(recruit);
        this.partyGroup.add(recruit);
        this.trapSystem.registerActor(recruit);
        if (candidate.fromNpc && eligibleNpc) {
          this.departNpc(eligibleNpc);
        }
        message = `${candidate.name} joins the party and will travel to future dungeons! (${this.party.size}/4)`;
      }
    } else if (reward.kind === "magic-weapon" || reward.kind === "magic-armor") {
      const def = item(reward.itemId);
      const recipients = [
        this.party.leader,
        ...this.party.aliveMembers().filter((member) => member !== this.party.leader),
      ];
      const recipient = recipients.find((member) => member.character.inventory.canAdd(def));
      if (!recipient) {
        this.ctx.say(`No living party member has room for ${def.name}. Make room in the gear screen first.`, "#d07070");
        return;
      }
      recipient.character.inventory.add(def);
      message = `${recipient.character.name} receives ${def.name}. Open Gear (I) to equip it.`;
    } else if (reward.kind === "spells") {
      const caster = this.party.aliveMembers().find(
        (member) =>
          member.character.className === reward.className &&
          !member.character.knownSpells.some((known) => known.spellId === reward.spellId),
      );
      if (caster) {
        caster.character.learnSpell(reward.spellId);
        message = `${caster.character.name} learns ${spell(reward.spellId).name}! Cycle spells with Q.`;
      } else {
        this.grantGoldReward(500);
        message = "No living caster can master the secret, so the reliquary yields 500 gold instead.";
      }
    } else if (reward.kind === "gold") {
      const xp = this.grantGoldReward(reward.amount);
      message = `The party claims ${reward.amount} gold${xp > 0 ? ` and gains ${xp} XP` : ""}!`;
    }

    const { x, y, sprite } = this.rewardMarker;
    sprite.destroy();
    this.rewardMarker = null;
    this.rewardClaimed = true;
    sfx.pickupChime(true, this.spatial({ x, y }));
    sparkleBurst(this, x, y, true);
    this.ctx.say(message, "#e8c840");
    this.saveToSlot(0);
  }

  private departNpc(npc: TalkableNpc): void {
    this.npcInteractionStates.set(npc.spec.id, "departed");
    npc.sprite.destroy();
    npc.marker.destroy();
    this.talkableNpcs = this.talkableNpcs.filter((candidate) => candidate !== npc);
  }

  private grantGoldReward(amount: number): number {
    const xp = this.ctx.bankCoins(amount);
    if (xp > 0) {
      for (const member of this.party.members) {
        if (!member.character.dead) this.ctx.engine.awardXp(member.character, xp);
      }
    }
    return xp;
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

  private updateMonsters(time: number, delta: number): void {
    for (const m of this.monsters) {
      if (!m.active) continue;
      if (m.aiState === "fleeing") {
        m.updateAi(delta, this.party.leader);
        if (m.x < TILE || m.x > (this.activeDungeon.width - 2) * TILE) m.destroy();
        continue;
      }
      if (m.isSleeping) {
        m.updateAi(delta, null);
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

  /** Alert the current room and rooms one open connector away. */
  private emitNoiseAt(x: number, y: number): void {
    const region = roomAtTolerant(
      this.activeDungeon.regions,
      Math.floor(x / TILE),
      Math.floor(y / TILE),
    );
    if (!region) return;
    const alerted = roomsAlertedByNoise(
      region.id,
      this.activeDungeon.connectors ?? [],
      {
        activatedRequirementIds: this.activatedRequirements,
        openedConnectorIds: this.openedConnectors,
      },
    );
    for (const monster of this.monsters) {
      if (monster.active && monster.aiState === "patrol" && alerted.has(monster.groupId)) {
        monster.alert();
      }
    }
  }

  /**
   * Reject a room-to-room crossing when its connector is closed or points the
   * other way. The last in-room position is retained across connector/filler
   * cells, so a rejected actor returns to the side they entered from.
   */
  private enforceConnectorTraversal(): void {
    const connectors = this.activeDungeon.connectors;
    if (!connectors || connectors.length === 0) return;
    const actors: (CharacterSprite | MonsterSprite)[] = [
      ...this.party.members.filter((member) => member.active),
      ...this.monsters.filter((monster) => monster.active),
    ];
    const persisted = {
      activatedRequirementIds: this.activatedRequirements,
      openedConnectorIds: this.openedConnectors,
    };
    for (const actor of actors) {
      const region = roomAt(
        this.activeDungeon.regions,
        Math.floor(actor.x / TILE),
        Math.floor(actor.y / TILE),
      );
      const previous = this.connectorActorState.get(actor);
      if (!previous) {
        if (region) this.connectorActorState.set(actor, { roomId: region.id, x: actor.x, y: actor.y });
        continue;
      }
      if (!region) continue;
      if (region.id === previous.roomId) {
        previous.x = actor.x;
        previous.y = actor.y;
        continue;
      }
      const candidates = connectors.filter((connector) =>
        (connector.fromRoomId === previous.roomId && connector.toRoomId === region.id) ||
        (connector.toRoomId === previous.roomId && connector.fromRoomId === region.id),
      );
      if (candidates.some((connector) => canTraverseConnector(connector, previous.roomId, persisted))) {
        this.connectorActorState.set(actor, { roomId: region.id, x: actor.x, y: actor.y });
      } else {
        actor.setPosition(previous.x, previous.y);
        actor.setVelocity(0, 0);
      }
    }
  }

  private killMonster(m: MonsterSprite): void {
    sfx.deathKnell(m.def.undead, this.spatial(m));
    floatText(this, m.x, m.y - 10, "slain", "#c0c0c0");
    this.ctx.kills++;
    if (this.survivalPressure && this.currentRoomId !== this.safeZoneId) {
      this.dangerKillPending = true;
    }
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

  /**
   * Followers refuse to walk off ledges: a step is legal only when solid
   * ground exists within a safe drop (4 tiles, matching free-fall range)
   * ahead, or when their destination is genuinely below them.
   */
  private followerCanStep(m: CharacterSprite, dir: -1 | 1, targetY: number): boolean {
    const SAFE_DROP_TILES = 4;
    const grid = this.activeDungeon.grid;
    const tx = Math.floor((m.x + dir * TILE * 0.75) / TILE);
    const footTy = Math.floor((m.y + 16) / TILE);
    const solid = (ch: string | undefined) => ch === "#" || ch === "%" || ch === "=";
    for (let dy = 0; dy <= SAFE_DROP_TILES; dy++) {
      const row = grid[footTy + dy];
      if (row && solid(row[tx])) return true;
    }
    return targetY > m.y + TILE * 2;
  }

  /** Followers use the same universal ladders/ropes as the leader. */
  private updateFollowerClimbs(): void {
    const leader = this.party.leader;
    for (const member of this.party.members) {
      if (member === leader || !member.alive || member.mode === "hold") continue;
      const touching = this.climbTiles.some(
        (zone) => Math.abs(zone.x - member.x) <= TILE && Math.abs(zone.y - member.y) <= TILE * 1.5,
      );
      const verticalGap = leader.y - member.y;
      if (touching && Math.abs(verticalGap) > TILE) {
        const body = member.body as Phaser.Physics.Arcade.Body;
        member.climbing = true;
        body.setAllowGravity(false);
        member.setVelocityY(Math.sign(verticalGap) * 100);
      } else if (member.climbing) {
        member.climbing = false;
        (member.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      }
    }
  }

  private followerAiState(id: string): { nextMoraleAt: number; rescueTargetId: string | null } {
    let s = this.followerAi.get(id);
    if (!s) {
      s = { nextMoraleAt: 0, rescueTargetId: null };
      this.followerAi.set(id, s);
    }
    return s;
  }

  /** Point a follower at their highest-tier ready spell; false if none remain. */
  private selectHighestSpell(m: CharacterSprite): boolean {
    const idx = highestAvailableSpellIndex(m.character);
    if (idx < 0) return false;
    m.spellIndex = idx;
    return true;
  }

  /** Follower stabilize — same engine roll as the leader's, no luck window. */
  private followerStabilize(m: CharacterSprite, dying: CharacterSprite): void {
    // Another follower may already have healed or stabilized this target this frame.
    if (!m.canSwing() || !dying.character.dying) return;
    m.startSwingCooldown();
    const result = this.ctx.engine.stabilize(m.character, dying.character);
    if (result.success) {
      floatText(this, dying.x, dying.y - 20, `${result.natural} stable!`, "#60e080");
      this.ctx.say(`${m.character.name} stabilizes ${dying.character.name} at 1 HP.`, "#60e080");
    } else {
      floatText(this, dying.x, dying.y - 20, `${result.natural} — failed`, "#d07070");
    }
  }

  /**
   * Support AI for followers: rally (morale check) to stabilize the dying,
   * priests cast for wounded allies, wizards cast at an aggro'd boss. Caster
   * followers always lead with their highest-tier available spell.
   */
  private updateFollowerSupport(time: number): void {
    const leader = this.party.leader;

    for (const m of this.party.members) {
      if (m === leader || !m.alive) continue;
      const c = m.character;
      const state = this.followerAiState(c.id);
      // Re-evaluate for every follower: a prior follower can stabilize in this same update.
      const dying = this.party.members.find((p) => p.character.dying && !p.character.dead);

      // 1. Rescue the dying. Courage first: a WIS morale check to run in.
      if (dying && dying !== m) {
        if (state.rescueTargetId !== dying.character.id && time >= state.nextMoraleAt) {
          state.nextMoraleAt = time + 3000;
          const morale = this.ctx.engine.check({
            actor: c,
            stat: "WIS",
            dc: DC.NORMAL,
            kind: "stat",
          });
          if (morale.success) {
            state.rescueTargetId = dying.character.id;
            this.ctx.say(`${c.name} rushes to help ${dying.character.name}!`, "#70d070");
          } else {
            floatText(this, m.x, m.y - 24, `${morale.natural} — hesitates!`, "#d07070", 11);
          }
        }
        if (state.rescueTargetId === dying.character.id) {
          if (zoneBetween(m, dying) === "close") {
            m.aiMoveTarget = null;
            this.followerStabilize(m, dying);
          } else {
            m.aiMoveTarget = { x: dying.x, y: dying.y };
          }
          continue; // A rescue outranks spellcasting.
        }
      } else {
        state.rescueTargetId = null;
        m.aiMoveTarget = null;
      }

      // 2. Priest: mend whoever has slipped under half HP (or is dying).
      if (c.className === "priest" && m.canSwing()) {
        const wounded = this.party.members.find(
          (p) =>
            !p.character.dead &&
            (p.character.dying !== null || p.character.hp < p.character.maxHp / 2) &&
            zoneBetween(m, p) !== "beyond",
        );
        if (wounded && this.selectHighestSpell(m)) {
          castSelectedSpell(this.spellDeps(), m);
          continue;
        }
      }

      // 3. Wizard: unload on the boss once battle is joined.
      if (c.className === "wizard" && m.canSwing()) {
        const boss = this.monsters.find(
          (mon) =>
            mon.aliveInFight &&
            mon.def.leader === true &&
            mon.aiState === "aggro" &&
            Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= FAR_PX,
        );
        if (boss && this.selectHighestSpell(m)) {
          m.facing = boss.x >= m.x ? 1 : -1;
          m.setFlipX(m.facing === -1);
          castSelectedSpell(this.spellDeps(), m, boss);
        }
      }
    }
  }

  private updatePartyCombat(time: number): void {
    for (const m of this.party.members) {
      if (!m.alive) continue;
      const reach = m.weaponReachPx;

      // Followers — FOLLOW or HOLD — swing at whatever wanders into reach.
      let foe: MonsterSprite | undefined;
      if (m !== this.party.leader) {
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
        continue;
      }

      // Archers pick off riled monsters from range when nothing is in reach.
      if (m !== this.party.leader) {
        const bow = carriedRangedWeapon(m);
        if (bow) {
          const mark = this.monsters.find(
            (mon) =>
              mon.aliveInFight &&
              mon.aiState === "aggro" &&
              Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= FAR_PX,
          );
          if (mark) rangedShot(this.meleeDeps(), m, mark, bow);
        }
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

  /**
   * Descent reward: top each living survivor's XP up to their next-level
   * threshold, then run a normal level-up. Any XP already earned this run counts
   * toward it. Capped at MAX_LEVEL. Messages carry into the next dungeon's log;
   * the level-up heals to full.
   */
  private grantDescentLevels(): void {
    for (const m of this.party.members) {
      const c = m.character;
      if (c.dead || c.level >= MAX_LEVEL) continue;
      const needed = xpToReachNextLevel(c);
      if (needed > 0) this.ctx.engine.awardXp(c, needed);
      const result = this.ctx.engine.levelUp(c, m.cls.hitDie, m.cls.talentTableId);
      this.ctx.say(
        `The descent tempers ${c.name} → level ${result.newLevel}. +${result.hpGained} HP. Talent (${result.talent.roll}): ${result.talent.entry.text}`,
        "#ffd040",
      );
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

  /** The region the leader currently occupies (falls back to the last one). */
  get currentRoomId(): string {
    const leaderX = Math.floor(this.party.leader.x / TILE);
    const leaderY = Math.floor(this.party.leader.y / TILE);
    const region = roomAtTolerant(this.activeDungeon.regions, leaderX, leaderY);
    return region ? region.id : this.lastRoomId;
  }

  /** Four-by-five discovered-room map; connectors stay hidden to preserve secrets. */
  get compactMap(): string {
    const columns = 5;
    const rows = 4;
    const cells = Array.from({ length: rows }, () => Array<string>(columns).fill("·"));
    for (const region of this.activeDungeon.regions) {
      if (!this.discoveredRoomIds.has(region.id) && region.id !== this.currentRoomId) continue;
      const centerX = (region.x1 + region.x2) / 2;
      const centerY = (region.y1 + region.y2) / 2;
      const column = Math.min(columns - 1, Math.floor(centerX / (this.activeDungeon.width / columns)));
      const row = Math.min(rows - 1, Math.floor(centerY / (this.activeDungeon.height / rows)));
      const marker = region.id === this.currentRoomId
        ? "@"
        : region.id === this.safeZoneId
          ? "S"
        : region.beat === "entrance"
          ? "E"
          : region.beat === "climax"
            ? "X"
            : region.beat === "reward"
              ? "R"
              : "o";
      // Two rooms can bucket into one grid cell; keep the more informative marker so
      // the player position and landmark beats are never clobbered by a plain room.
      if (mapMarkerPriority(marker) > mapMarkerPriority(cells[row]![column]!)) {
        cells[row]![column] = marker;
      }
    }
    return cells.map((row) => row.join(" ")).join("\n");
  }

  /**
   * The layout to render. `?nl=<seed>` renders a non-linear dungeon expanded from
   * the abstract generator instead of a hand-authored one; `?nltopo` / `?nlorient`
   * force a specific form/orientation for demonstration. New seeded runs use the
   * generated layout; old saves without a room id retain their authored layout.
   */
  private resolveActiveDungeon(layoutSeed: number): DungeonDefinition {
    const params = new URLSearchParams(window.location.search);
    if (this.loadedState && !this.loadedState.roomId) return dungeonAt(layoutSeed);
    const parsed = parseInt(params.get("nl") ?? String(layoutSeed), 10);
    const nlSeed = (Number.isFinite(parsed) ? parsed : layoutSeed) >>> 0;
    const opts: GenerateOptions = {};
    const topo = params.get("nltopo");
    const orient = params.get("nlorient");
    if (topo) opts.topology = topo as TopologyId;
    if (orient) opts.orientation = orient as Orientation;
    return expandDungeon(generateAbstractDungeon(nlSeed, opts));
  }

  /** Keys are collected and switches activated on entering their source room. */
  private activateRoomRequirements(roomId: string, announce: boolean): void {
    for (const connector of this.activeDungeon.connectors ?? []) {
      const requirement = connector.requirement;
      if (!requirement || requirement.sourceRoomId !== roomId || this.activatedRequirements.has(requirement.id)) continue;
      this.activatedRequirements.add(requirement.id);
      if (announce) {
        this.ctx.say(
          requirement.kind === "key" ? "You find the gate key." : "You throw the gate switch.",
          "#d0e080",
        );
      }
    }
  }

  /** Resolve which room to spawn into on load, migrating pre-roomId saves. */
  private resolveLoadedRoomId(): string {
    const state = this.loadedState;
    if (!state) {
      for (let y = 0; y < this.activeDungeon.grid.length; y++) {
        const x = this.activeDungeon.grid[y]!.indexOf("P");
        const entrance = x >= 0 ? roomAt(this.activeDungeon.regions, x, y) : undefined;
        if (entrance) return entrance.id;
      }
      return this.activeDungeon.regions[0]?.id ?? "room-1";
    }
    if (state.roomId) return state.roomId;
    if (typeof state.currentRoom === "number") {
      return this.activeDungeon.regions[state.currentRoom - 1]?.id ?? this.activeDungeon.regions[0]!.id;
    }
    return this.activeDungeon.regions[0]?.id ?? "room-1";
  }

  private getRoomEntrancePos(roomId: string): { x: number; y: number } {
    const region = this.activeDungeon.regions.find((r) => r.id === roomId) ?? this.activeDungeon.regions[0];
    if (!region) return { x: TILE * 1.5, y: TILE * 12.5 };
    const startX = region.x1 + 1;
    // Prefer a floor landing: an open cell sitting on solid ground.
    for (let y = region.y1; y <= region.y2; y++) {
      const cell = this.activeDungeon.grid[y]?.[startX];
      const cellUnder = this.activeDungeon.grid[y + 1]?.[startX];
      if (cell === "." && cellUnder === "#") {
        return { x: startX * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      }
    }
    // Otherwise the lowest open cell in the region.
    for (let y = region.y2; y >= region.y1; y--) {
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
      runSeed: this.registry.get("runSeed") ?? 0,
      zone: this.visualSkin?.zone,
      skinId: this.visualSkin?.id,
      roomId: this.currentRoomId,
      activatedRequirementIds: [...this.activatedRequirements],
      openedConnectorIds: [...this.openedConnectors],
      npcInteractionStates: Object.fromEntries(this.npcInteractionStates),
      discoveredRoomIds: [...this.discoveredRoomIds],
      survivalRemainingMs: this.survivalClock?.remainingMs,
      dangerFlags: this.survivalPressure ? this.dangerFlags : undefined,
      dangerChecks: this.survivalPressure ? this.dangerChecks : undefined,
      dangerDistancePx: this.survivalPressure ? this.dangerDistancePx : undefined,
      dangerKillPending: this.survivalPressure ? this.dangerKillPending : undefined,
      hasCrown: this.hasCrown,
      kills: this.ctx.kills,
      coinsBanked: this.ctx.totalCoins,
      party: this.party.members.map((m) => serializeCharacter(m.character)),
      rescuedIds: this.party.members.map((m) => m.character.className),
      messages: [...this.ctx.messages],
    };
    try {
      SaveRepository.save(slotId, state);
      this.ctx.say(slotId === 0 ? "Checkpoint auto-saved." : `Game saved to Slot ${slotId}.`, "#60e080");
    } catch (e: any) {
      this.ctx.say(`Failed to save: ${e.message}`, "#d07070");
    }
  }

  loadFromSlot(slotId: number): void {
    try {
      const state = SaveRepository.load(slotId);
      if (!state) {
        this.ctx.say(`No saved game found in Slot ${slotId}.`, "#d07070");
        return;
      }
      this.registry.set("loadState", state);
      this.scene.stop("Hud");
      this.scene.restart();
    } catch (e: any) {
      this.ctx.say(`Failed to load: ${e.message}`, "#d07070");
    }
  }

  private restartRun(): void {
    // A held R key re-enters this method before the scene restart takes effect;
    // guard so the descent (and its one-level reward) applies exactly once.
    if (this.descending) return;
    this.descending = true;

    const currentIndex = this.registry.get("dungeonIndex");
    const dungeonIndex = typeof currentIndex === "number" ? currentIndex : 0;
    const nextIndex = dungeonIndex + 1;

    if (this.won) {
      if (!this.biomeOffer) throw new Error("Cannot advance: no biome offer was rolled on victory");
      const chosenZone = this.biomeOffer.zones[this.biomeSelectionIndex];
      if (!chosenZone) throw new Error("Biome selection index is out of range");
      // Descending to the next dungeon levels every surviving party member once.
      this.grantDescentLevels();
      const survivors = this.party.members
        .map((member) => serializeCharacter(member.character))
        .filter((member) => !member.dead);
      const nextState = nextDungeonSave(
        {
          coinsBanked: this.ctx.totalCoins,
          messages: [...this.ctx.messages],
          runSeed: this.registry.get("runSeed") ?? 0,
        },
        dungeonIndex,
        survivors,
        chosenZone,
      );
      try {
        SaveRepository.save(0, nextState);
      } catch {
        // A storage failure must not prevent an in-memory campaign transition.
      }
      this.registry.set("loadState", nextState);
    } else {
      // A party wipe begins a genuinely fresh expedition, including a new layout seed.
      this.registry.set("dungeonIndex", 0);
      this.registry.set("runSeed", Math.floor(Math.random() * 0x1_0000_0000));
      this.registry.set("loadState", null);
      this.registry.set("ctx", new GameContext());
    }
    this.scene.stop("Hud");
    this.scene.restart();
  }
}
