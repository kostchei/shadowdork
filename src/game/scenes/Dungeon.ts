/**
 * The dungeon: level construction, input, physics, and the game loop that
 * feeds real time into the engine clock. All rules resolution goes through
 * the engine; this scene renders consequences.
 */

import Phaser from "phaser";
import { HudScene } from "./Hud";
import { crackleBed, themeAmbience } from "../audio/ambience";
import { isMuted, setMuted, suspendAudio, resumeAudioContext } from "../audio/context";
import { saveMutedPref } from "../MobilePrefs";
import * as sfx from "../audio/sfx";
import { SpatialEmitter, spatialOpts, type Vec2 } from "../audio/spatial";
import {
  createCharacter,
  highestAvailableSpellIndex,
  highestAvailableDamagingSpellIndex,
  item,
  monster,
  randomPlebName,
  spell,
  spellForMagicItem,
} from "../../data";
import {
  DC,
  MAX_LEVEL,
  availableEncounterChoices,
  availableMishapDecisions,
  activateShieldWall,
  applyCondition,
  armPoisonedWeapon,
  applyUseOutcome,
  cancelShieldWall,
  canUseItem,
  partyCoinSlots,
  poisonApplicationAccident,
  xpToReachNextLevel,
  getBaseRole,
  hasHook,
  hasCondition,
  hasCapability,
  hideCharacter,
  isHidden,
  isShieldWallActive,
  destinedLuckBonus,
  triggerFlourish,
  usePotion,
  type Alignment,
  type CastResult,
  type CastSource,
  type ClassName,
  type EncounterChoice,
  type EncounterDistance,
  type MonsterActivity,
  type MonsterReaction,
  type StatName,
} from "../../engine";
import { GameContext } from "../context";
import { ActionInput } from "../input/ActionInput";
import { KeyboardSource, polledKeysFrom } from "../input/KeyboardSource";
import { KEY_BINDINGS, KEYBOARD_ADD_KEYS, START_DISMISS_ACTIONS, type GameAction } from "../input/actions";
import { noteTouchActivity } from "../input/inputFamily";
import { ModeController, isInterruptMode, type GameMode, type ModeHost } from "../modes/GameModeController";
import { isPortraitBlocked, onOrientationChange } from "../orientation";
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
import { CLOSE_PX, FAR_PX, NEAR_PX, zoneBetween } from "../systems/position";
import {
  acceptCastMishap,
  castItemSpell,
  castSelectedSpell,
  type SpellDeps,
  type SpellSelection,
} from "../systems/spells";
import { TrapSystem } from "../systems/traps";
import {
  buy as shopBuy,
  sell as shopSell,
  buyPrice,
  sellPrice,
  buyBlocker,
  isSellable,
  stockItems,
  type ShopRow,
  type ShopView,
} from "../systems/shop";
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
import { companionPartySnapshot, chooseCompanionRecruit, resolveClassForZone, type CompanionCandidate, type CompanionClass } from "../systems/companion";
import type { TopologyId } from "../level/topology";
import type { Orientation } from "../level/embedding";
import type { EnvironmentTextureKeys, VisualPalette, VisualSkin, VisualSkinId, ZonePackId } from "../visual/model";
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
  dangerRuleForSkin,
  openTerrainDangerDc,
  OPEN_TERRAIN_DANGER_DISTANCE_TILES,
  OPEN_TERRAIN_MAX_FLAGS,
  safeZonePresentation,
  selectOpenTerrainRoomRoles,
} from "../visual/openTerrain";
import { roomAt, roomAtTolerant } from "../level/geometry";
import { CameraFramingController, FEET_OFFSET_PX, isElevatedSupport } from "../systems/cameraFraming";
import { exposedTerrainFaces } from "../visual/terrainVisibility";
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
import {
  pickSkinForScrollRun,
  rollBiomeOffer,
  rollVaultCountForScroll,
  type BiomeOffer,
} from "../biomeChoice";

/**
 * How long after being hit a character keeps swinging back. Monsters attack
 * every 1.5s, so an ongoing fight refreshes this; once the aggressor stops
 * or leaves reach, retaliation lapses.
 */
const RETALIATE_WINDOW_MS = 4000;
/** Gold granted when a companion vault reward cannot recruit (full or duplicate class). */
const COMPANION_SUBSTITUTE_GOLD = 500;
/** Player-facing label for each wandering-encounter reaction choice. */
const ENCOUNTER_CHOICE_LABEL: Record<EncounterChoice, string> = {
  ambush: "Ambush (strike first, advantage)",
  parley: "Parley (CHA check)",
  offer: "Offer food or treasure",
  threaten: "Threaten (CHA check)",
  hide: "Hide (slip away unnoticed)",
  retreat: "Retreat (back off)",
};
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
  private terminalGameOverTitle = "THE DARK CLAIMS YOU";
  /** Danger-track fails accrued this zone, keyed by character.id. Resets in shelter. */
  private dangerFails = new Map<string, number>();
  private dangerDistancePx = 0;
  private dangerKillPending = false;
  private dangerLastLeaderPos?: { x: number; y: number };
  /** Floating per-character danger markers, keyed by character.id. */
  private dangerMarkers = new Map<string, Phaser.GameObjects.Text>();

  private cameraFraming = new CameraFramingController();
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
  /** The party is wiped: the run is over and only a restart leaves this. */
  private get gameOver(): boolean {
    return this.modes.is("gameover");
  }
  /** The vault is cleared: the victory/descent screen owns input. */
  get won(): boolean {
    return this.modes.is("victory");
  }
  /** The current Cursed Scroll destination zone pack. */
  activeZone: ZonePackId = "diablerie";
  /** Total number of vaults (1d6) in the current scroll destination. */
  vaultsInScroll = 1;
  /** Number of vaults completed so far in this scroll destination. */
  vaultsCompletedInScroll = 0;
  /** History of visual skins used in the current scroll destination (max 2x per skin). */
  skinHistoryInScroll: VisualSkinId[] = [];

  get activeZoneName(): string {
    return zonePackInfo(this.activeZone).scrollName;
  }

  /** The descent choice rolled on victory; the HUD renders it as scroll cards. */
  biomeOffer: BiomeOffer | null = null;
  /** Which offered scroll is currently highlighted. */
  biomeSelectionIndex = 0;
  /** Guards the descent transition so a held R key cannot advance (or level) twice. */
  private descending = false;
  private lastHurtAt = new Map<string, number>();
  private encounterWaves = 0;
  private interactPrompt!: Phaser.GameObjects.Text;
  /** The candidates offered while `actionChoice` mode is open; empty otherwise. */
  private actionChoiceOptions: Interaction[] = [];
  private actionChoiceCursor = 0;
  private actionChoiceTitle: string | undefined;
  private actionChoiceSubtitle: string | undefined;
  /** False for an encounter reaction roll — the player must pick one, no free dismiss. */
  private actionChoiceCancelable = true;
  loadedState: SaveSlot | null = null;
  private lastRoomId = "room-1";
  private leaderMarker!: Phaser.GameObjects.Image;
  /** Read by the HUD to show the reroll hint. */
  luckWindow: LuckWindow | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private leftControlDown = false;
  /** Semantic input: named actions with multi-source ownership (keyboard, touch). */
  private readonly actions = new ActionInput<GameAction>();
  private keyboard!: KeyboardSource<GameAction>;
  /**
   * Actions the HUD's on-screen controls asked for since the last tick. Pointer
   * events fire outside the update loop, so a tap is queued here and replayed as
   * a real press/release pair around the next tick — the same ownership path the
   * keyboard uses, never a synthesised key event.
   */
  private pendingTaps: GameAction[] = [];

  /** The single source of truth for which mode owns input and whether time runs. */
  private modes!: ModeController;

  private gearSelectionIndex = 0;
  // Safe-zone shop overlay state (transient — not persisted).
  private shopMode: "buy" | "sell" = "buy";
  private shopCursor = 0;
  private shopMemberIndex = 0;
  private safeZoneName?: string;
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
      // Legacy saves predate the wallet: seed it from the coin bank so an
      // existing hoard stays spendable rather than starting empty.
      newCtx.spendableGold = this.loadedState!.spendableGold ?? this.loadedState!.coinsBanked;
      newCtx.kills = this.loadedState!.kills;
      newCtx.messages.push(...this.loadedState!.messages);
      this.registry.set("ctx", newCtx);
    }

    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");

    // A capture-only query flag keeps the normal title flow unchanged while
    // allowing deterministic, unobscured art-direction screenshots.
    const autostart = new URLSearchParams(window.location.search).get("autostart") === "1";
    // A fresh controller per `create` — the scene restart *is* the reset, so the
    // controller never has to unwind a terminal mode.
    this.modes = new ModeController(this.modeHost(), autostart ? "playing" : "briefing");
    this.pendingTaps = [];
    this.terminalGameOverTitle = "THE DARK CLAIMS YOU";
    this.dangerFails = new Map(Object.entries(this.loadedState?.dangerFails ?? {}));
    this.dangerDistancePx = this.loadedState?.dangerDistancePx ?? 0;
    this.dangerKillPending = this.loadedState?.dangerKillPending ?? false;
    this.dangerLastLeaderPos = undefined;
    for (const marker of this.dangerMarkers.values()) marker.destroy();
    this.dangerMarkers = new Map();
    this.biomeOffer = null;
    this.biomeSelectionIndex = 0;
    this.descending = false;
    this.gearSelectionIndex = 0;
    this.shopMode = "buy";
    this.shopCursor = 0;
    this.shopMemberIndex = 0;
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
    // Drop any action ownership held over from a previous run life; the keyboard
    // poll repopulates real state on the next tick.
    this.actions.releaseAll();
    this.actions.endFrame();
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

    this.activeZone = this.loadedState?.zone ?? zoneForRun(runSeed);
    this.vaultsInScroll = this.loadedState?.vaultsInScroll ?? rollVaultCountForScroll(runSeed);
    this.vaultsCompletedInScroll = this.loadedState?.vaultsCompletedInScroll ?? 0;
    this.skinHistoryInScroll = [...(this.loadedState?.skinHistoryInScroll ?? [])];

    const requestedSkin = parseVisualSkinId(new URLSearchParams(window.location.search).get("skin"));
    if (requestedSkin) {
      // A dev/QA override always wins so the regression matrix stays reachable.
      this.visualSkin = visualSkinById(requestedSkin);
    } else if (this.loadedState?.skinId) {
      // A save from the biome-choice era carries the exact skin it advanced into.
      this.visualSkin = visualSkinById(this.loadedState.skinId);
    } else {
      // Pick a skin within the current scroll, respecting the max 2x per biome rule.
      const chosenSkin = pickSkinForScrollRun(this.activeZone, this.skinHistoryInScroll, layoutSeed);
      this.visualSkin = chosenSkin;
      if (!this.skinHistoryInScroll.includes(chosenSkin.id)) {
        this.skinHistoryInScroll.push(chosenSkin.id);
      }
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
    this.buildLevel();
    this.createSafeZoneVignette(layoutSeed);
    this.createConnectorTelegraphs();
    const torchbearer = this.party.aliveMembers().find((m) => getBaseRole(m.character.className) === "priest") || this.party.leader;
    this.lightTorch(torchbearer, `${torchbearer.character.name} lights a torch.`);
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
    this.trapSystem.onDisarmedCoins = (x, y) => {
      this.addPickup(x, y, "coins", this.ctx.engine.dice.roll("1d6"));
    };
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

    this.startCameraFollow(true);

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
      spawnWave: (monsterId, count, x, activity, reaction, distance) =>
        this.spawnEncounterWave(monsterId, count, x, activity, reaction, distance),
    });

    this.ctx.say(
      `${this.dungeonDisplayName}. ${this.activeDungeon.objective}. Watch your torch. ESC shows controls.`,
      "#f0e090",
    );
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // The controller's starting mode has not run a transition, so apply its
    // world-pause policy once here.
    this.setWorldPaused(this.modes.worldPaused);
    this.installLifecycleGuard();
    this.scene.launch("Hud");
  }

  get awaitingStart(): boolean {
    return this.modes.is("briefing");
  }

  /**
   * Wire the mode controller to the scene. Every transition runs these, so a
   * mode never has to remember to freeze time or close another overlay itself.
   */
  private modeHost(): ModeHost {
    return {
      setWorldPaused: (paused) => this.setWorldPaused(paused),
      releaseHeldInput: () => this.releaseHeldInput(),
      enterMode: (mode) => this.showModeOverlay(mode),
      exitMode: (mode) => this.hideModeOverlay(mode),
      setAudioSuspended: (suspended) => (suspended ? suspendAudio() : resumeAudioContext()),
    };
  }

  /**
   * Drop everything currently held and suppress the physical keys behind it, so
   * a key held across a transition neither leaks into the new mode nor re-fires
   * there as a fresh press on the next poll.
   */
  private releaseHeldInput(): void {
    this.actions.releaseAll();
    this.keyboard.suppressHeldKeys();
    this.pendingTaps = [];
  }

  private setWorldPaused(paused: boolean): void {
    this.physics.world.isPaused = paused;
    if (paused) this.anims.pauseAll();
    else this.anims.resumeAll();
  }

  private showModeOverlay(mode: GameMode): void {
    const hud = this.scene.get("Hud") as HudScene;
    switch (mode) {
      case "paused":
        hud.showPauseOverlay();
        return;
      case "stats":
        hud.showStatsOverlay(this.party.leader.character);
        return;
      case "gear":
        this.gearSelectionIndex = 0;
        this.refreshGearOverlay();
        return;
      case "shop":
        this.refreshShopOverlay();
        return;
      case "actionChoice":
        this.refreshActionChoiceOverlay();
        return;
      default:
        // briefing / playing / victory / gameover own no overlay of their own:
        // the briefing card is raised by the HUD on create, and the ending
        // screens are raised by the "won" / "gameover" context events.
        // orientation-blocked's rotate prompt is a pure-CSS overlay outside
        // Phaser entirely (see index.html); backgrounded shows nothing since
        // the OS is showing something else. Both still freeze the world via
        // the mode's world-pause policy, same as any other transition.
        return;
    }
  }

  private hideModeOverlay(mode: GameMode): void {
    const hud = this.scene.get("Hud") as HudScene;
    switch (mode) {
      case "briefing":
        hud.hideStartOverlay();
        return;
      case "paused":
        hud.hidePauseOverlay();
        return;
      case "stats":
        hud.hideStatsOverlay();
        return;
      case "gear":
        hud.hideGearOverlay();
        return;
      case "shop":
        hud.hideShopOverlay();
        return;
      case "actionChoice":
        hud.hideActionChoiceOverlay();
        return;
      default:
        return;
    }
  }

  /**
   * The complete gameplay lifecycle policy: on window blur, the tab going
   * hidden, pagehide (navigating away, or iOS parking the page in bfcache),
   * or the device rotating to portrait, drop every held input, freeze
   * physics/animation/engine time (via ModeHost, same as any other
   * transition), quiet audio, and autosave synchronously if a run is
   * actually in progress. Returning from any of these never resumes play on
   * its own — `exitInterrupt` lands on `paused` rather than `playing`, so a
   * deliberate tap is always required to pick back up.
   *
   * Multiple triggers can fire for one real interruption (blur *and*
   * visibilitychange for the same app-switch); both the entry and exit paths
   * are idempotent because `enterInterrupt`/`exitInterrupt` no-op once
   * already (or no longer) interrupted.
   */
  private installLifecycleGuard(): void {
    const enterBackground = () => {
      if (!this.modes.isAny("briefing", "victory", "gameover") && !isInterruptMode(this.modes.mode)) {
        this.saveToSlot(0);
      }
      this.modes.enterInterrupt("backgrounded");
    };
    const exitBackground = () => {
      if (this.modes.mode === "backgrounded") this.modes.exitInterrupt();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") enterBackground();
      else exitBackground();
    };
    window.addEventListener("blur", enterBackground);
    window.addEventListener("focus", exitBackground);
    window.addEventListener("pagehide", enterBackground);
    window.addEventListener("pageshow", exitBackground);
    document.addEventListener("visibilitychange", onVisibility);

    const onOrientation = (blocked: boolean) => {
      if (blocked) this.modes.enterInterrupt("orientation-blocked");
      else if (this.modes.mode === "orientation-blocked") this.modes.exitInterrupt();
    };
    const unsubscribeOrientation = onOrientationChange(onOrientation);
    if (isPortraitBlocked()) onOrientation(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("blur", enterBackground);
      window.removeEventListener("focus", exitBackground);
      window.removeEventListener("pagehide", enterBackground);
      window.removeEventListener("pageshow", exitBackground);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribeOrientation();
    });
  }

  /**
   * Queue a named action from an on-screen control. Replayed as a press before
   * the next tick and released after it, so held-style reads (`held("restart")`)
   * and edge reads (`pressed("menuUp")`) both see it exactly once.
   */
  tapAction(action: GameAction): void {
    noteTouchActivity();
    this.pendingTaps.push(action);
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

  /**
   * Spawn an encounter wave off-screen, in "patrol" — not yet hunting — and
   * (assuming the party isn't surprised, which is a separate later system)
   * hand the player a contextual reaction popup instead of it arriving
   * already aggro'd.
   */
  private spawnEncounterWave(
    monsterId: string,
    count: number,
    x: number,
    activity: MonsterActivity,
    reaction: MonsterReaction,
    distance: EncounterDistance,
  ): void {
    if (this.gameOver || this.won) return;
    const clampedX = Phaser.Math.Clamp(x, TILE * 1.5, (this.activeDungeon.width - 2) * TILE);
    const groupId = `encounter-${this.encounterWaves++}`;
    const wave: MonsterSprite[] = [];
    for (let i = 0; i < count; i++) {
      const m = new MonsterSprite(
        this,
        clampedX + i * 14,
        13 * TILE,
        monster(monsterId),
        groupId,
        this.ctx.engine.dice,
      );
      m.activity = activity;
      m.reaction = reaction;
      if (activity === "sleeping") m.sleep(60 * 60 * 1000); // asleep until woken by an ambush/threat/damage
      this.morale.register(m);
      this.monsters.push(m);
      this.monsterGroup.add(m);
      this.trapSystem.registerActor(m);
      wave.push(m);
    }
    this.openEncounterChoice(wave, activity, reaction, distance);
  }

  /** The contextual reaction popup a wandering encounter offers instead of arriving already hunting. */
  private openEncounterChoice(
    wave: MonsterSprite[],
    activity: MonsterActivity,
    reaction: MonsterReaction,
    distance: EncounterDistance,
  ): void {
    const leader = this.party.leader;
    const canOffer = leader.character.inventory.has("ration") || this.ctx.spendableGold >= 10;
    const choices = availableEncounterChoices(activity, canOffer);
    const monsterName = wave[0]!.def.name;
    const plural = wave.length > 1 ? `${wave.length} ${monsterName}s` : monsterName;
    const options: Interaction[] = choices.map((choice) => ({
      label: ENCOUNTER_CHOICE_LABEL[choice],
      run: () => this.resolveEncounterChoice(wave, choice, reaction),
    }));
    this.openActionChoice(options, {
      title: `${plural.toUpperCase()} — ${distance.toUpperCase()}`,
      subtitle: `They seem to be ${activity}.`,
      cancelable: false,
    });
  }

  /** Apply the consequence of the player's chosen response to a wandering-encounter wave. */
  private resolveEncounterChoice(
    wave: MonsterSprite[],
    choice: EncounterChoice,
    reaction: MonsterReaction,
  ): void {
    const live = wave.filter((m) => m.active);
    const leader = this.party.leader;
    const engage = () => {
      for (const m of live) {
        m.wake();
        // The wave spawns off-camera, well beyond AGGRO_RANGE*2 — a plain
        // aiState flip would immediately leash back to "patrol" on the next
        // AI tick. alert() sets an alertedUntil window that the leash check
        // respects, so an engaged wave actually closes the distance.
        m.alert(20_000);
      }
    };
    switch (choice) {
      case "hide":
        this.ctx.say("The party keeps to the shadows and slips past unnoticed.", "#9da7ec");
        return;
      case "retreat":
        this.ctx.say("The party backs away without engaging.", "#9da7ec");
        return;
      case "ambush": {
        engage();
        for (const member of this.party.members) {
          member.character.removeEffect("encounter-ambush");
          member.character.addEffect({
            id: "encounter-ambush",
            name: "Ambush (advantage on attacks)",
            hooks: [{ kind: "advantageOn", applies: "attack" }],
            duration: { unit: "rounds", remaining: 1 },
          });
        }
        this.ctx.say(`${leader.character.name}'s party strikes first!`, "#e0a34b");
        return;
      }
      case "threaten": {
        const dc = reaction === "friendly" ? DC.HARD : reaction === "curious" ? DC.NORMAL : DC.EASY;
        const check = this.ctx.engine.check({ actor: leader.character, stat: "CHA", dc, kind: "stat" });
        if (check.success) {
          for (const m of live) m.flee();
          this.ctx.say(`${leader.character.name}'s threats send them fleeing! (rolled ${check.total})`, "#60e080");
        } else {
          engage();
          this.ctx.say(`The threat falls flat — they attack! (rolled ${check.total} vs DC ${check.dc})`, "#d07070");
        }
        return;
      }
      case "parley": {
        const dc = reaction === "friendly" ? DC.EASY : reaction === "curious" ? DC.NORMAL : DC.HARD;
        const check = this.ctx.engine.check({ actor: leader.character, stat: "CHA", dc, kind: "stat" });
        if (check.success) {
          this.ctx.say(`Words are exchanged, and the party goes on its way. (rolled ${check.total})`, "#60e080");
        } else {
          engage();
          this.ctx.say(`The talk sours — they attack! (rolled ${check.total} vs DC ${check.dc})`, "#d07070");
        }
        return;
      }
      case "offer": {
        const hasRation = leader.character.inventory.has("ration");
        if (hasRation) {
          leader.character.inventory.remove("ration", 1);
          this.ctx.say(`${leader.character.name} tosses over some food — they take it and go.`, "#60e080");
        } else {
          this.ctx.spendGold(10);
          this.ctx.say(`${leader.character.name} tosses over a handful of coin — they take it and go.`, "#60e080");
        }
        for (const m of live) m.flee();
        return;
      }
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

  get dangerTrack(): { icon: string; count: number; maximum: number } | undefined {
    const rule = dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime);
    if (!rule) return undefined;
    let worst = 0;
    for (const member of this.party.members) {
      worst = Math.max(worst, this.dangerFails.get(member.character.id) ?? 0);
    }
    return { icon: rule.icon, count: worst, maximum: OPEN_TERRAIN_MAX_FLAGS };
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
    this.safeZoneName = presentation.name;
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

  private updateOpenTerrainDanger(currentRoom: string): void {
    const rule = dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime);
    if (!rule) return;
    const leader = this.party.leader;
    const previous = this.dangerLastLeaderPos;
    this.dangerLastLeaderPos = { x: leader.x, y: leader.y };

    if (currentRoom === this.safeZoneId) {
      const hadDanger = this.dangerKillPending
        || [...this.dangerFails.values()].some((fails) => fails > 0);
      if (hadDanger) {
        this.ctx.say("Shelter clears the expedition's danger track.", "#72d887");
      }
      this.dangerFails.clear();
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

  /**
   * A shared kill-and-travel trigger fires one save per living party member.
   * Each character rolls against a DC that escalates with their own accrued
   * fails, so danger is tracked and displayed per character. A character who
   * reaches the max is taken down by the hazard; the party wipe is handled by
   * the normal end-condition check.
   */
  private resolveOpenTerrainDanger(rule: NonNullable<ReturnType<typeof dangerRuleForSkin>>): void {
    this.dangerDistancePx = 0;
    this.dangerKillPending = false;
    if (rule.encounter) this.ctx.say(rule.encounter, "#e3c56d");

    for (const member of this.party.aliveMembers()) {
      const actor = member.character;
      const fails = this.dangerFails.get(actor.id) ?? 0;
      const dc = openTerrainDangerDc(fails);

      let avoided = false;
      if (rule.saveStats) {
        const stat = rule.saveStats.reduce((best, candidate) =>
          actor.mod(candidate) > actor.mod(best) ? candidate : best,
        ) as StatName;
        const seafarer = hasHook(actor.effects, "seafarer") && this.visualSkin?.id === "rime-sea-caves";
        const result = this.ctx.engine.check({
          actor,
          stat,
          dc,
          kind: "stat",
          advantage: seafarer ? ["Seafarer: ice and water"] : [],
        });
        avoided = result.success;
        this.ctx.say(
          `${actor.name}: ${stat} ${result.total} vs DC ${dc} — ${avoided ? "danger avoided" : `${rule.icon} gained`}.`,
          avoided ? "#72d887" : "#ff9c4a",
        );
      } else {
        this.ctx.say(`${actor.name}: the journey takes its toll — ${rule.icon} gained.`, "#ff9c4a");
      }
      if (avoided) continue;

      const next = fails + 1;
      this.dangerFails.set(actor.id, Math.min(next, OPEN_TERRAIN_MAX_FLAGS));
      if (next >= OPEN_TERRAIN_MAX_FLAGS) {
        // One member is lost to the hazard — the run continues while others
        // stand. Only a casualty that empties the party shows the themed
        // game-over screen; the wipe itself is handled by checkEndConditions.
        this.ctx.say(`${actor.name} ${rule.casualty}.`, "#ff6159");
        this.ctx.engine.damageCharacter(actor, actor.hp);
        if (this.party.allDownOrDead()) this.terminalGameOverTitle = rule.failureTitle;
      }
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
    // Enclosed rock has no exposed face worth drawing as a decorated tile; it
    // still needs collision (created below) but is covered by one merged,
    // seam-free fill so parallax scenery never shows through solid mass.
    const enclosedMass = this.add.graphics().setDepth(0);
    enclosedMass.fillStyle(theme.background, 1);
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
            let enclosed = false;
            if (textures.supportWall) {
              const underground = roomAt(this.activeDungeon.regions, x, y)?.id === this.undergroundRoomId;
              if (underground) {
                enclosed = exposedTerrainFaces(this.activeDungeon.grid, x, y).enclosed;
                textureKey = textures.supportWall(variant);
              } else {
                const role = openSurfaceTileRole(this.activeDungeon.grid, x, y);
                if (role === "support") textureKey = textures.supportWall(variant);
                else if (role === "overhang") textureKey = textures.overhang ?? textureKey;
                else if (role === "hidden-ceiling") {
                  textureKey = textures.overhang ?? textureKey;
                }
              }
            } else {
              enclosed = exposedTerrainFaces(this.activeDungeon.grid, x, y).enclosed;
            }
            const wall = this.walls.create(px, py, textureKey).setTint(foregroundTint).setDepth(1);
            if (enclosed) {
              wall.setVisible(false);
              enclosedMass.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
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
            // through and under it. Traversal is driven by the climb zone.
            if (textures.climbBackdrop) {
              this.add.image(px, py, textures.climbBackdrop).setTint(foregroundTint).setDepth(1);
            }
            this.add.image(px, py, textures.climb).setTint(foregroundTint).setDepth(2);
            const zone = this.add.rectangle(px, py, TILE * 2.6, TILE * 1.2, 0, 0);
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
            const bossId = this.activeDungeon.bossMonsterId ?? "gloom-ogre";
            const defId = { g: "goblin", s: "skeleton", r: "giant-rat", O: bossId }[ch];
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
    cls: ClassName,
    x: number,
    y: number,
    alignment?: Alignment,
  ): CharacterSprite {
    const zone = this.loadedState?.zone;
    const base = getBaseRole(cls);
    const resolvedClass = base === cls ? resolveClassForZone(base, zone) : cls;
    const character = createCharacter(this.ctx.engine, id, name, resolvedClass, "human", alignment);
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
    const textureKey = this.textures.exists(`pickup-${itemId}`) ? `pickup-${itemId}` : "pickup-ration";
    const sprite = this.physics.add.image(x, y, textureKey).setDepth(6);
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
    this.keys = kb.addKeys(KEYBOARD_ADD_KEYS) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown-TAB", (ev: KeyboardEvent) => ev.preventDefault());
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (ev.code === "ControlLeft") this.leftControlDown = true;
    });
    kb.on("keyup", (ev: KeyboardEvent) => {
      if (ev.code === "ControlLeft") this.leftControlDown = false;
    });
    // The keyboard feeds named actions. CTRL is not an addKeys key — it comes
    // from the raw ControlLeft listener above, wrapped as a polled key.
    const ctrl = { name: "CTRL", isDown: () => this.leftControlDown };
    this.keyboard = new KeyboardSource(
      this.actions,
      polledKeysFrom(this.keys, [ctrl]),
      KEY_BINDINGS,
    );
  }

  override update(time: number, delta: number): void {
    // Refresh named-action state from the keyboard and replay any on-screen taps
    // queued since the last tick, then guarantee the per-tick edge reset and the
    // tap release run no matter which early return the body takes.
    this.keyboard.poll();
    const taps = this.pendingTaps;
    this.pendingTaps = [];
    for (const action of taps) this.actions.press(action, "touch");
    try {
      this.tick(time, delta);
    } finally {
      for (const action of taps) this.actions.release(action, "touch");
      this.actions.endFrame();
    }
  }

  private tick(time: number, delta: number): void {
    if (this.modes.is("briefing")) {
      if (this.startControlDown()) this.modes.set("playing");
      return;
    }

    if (this.actions.pressed("pause") && this.modes.acceptsOverlayToggle) {
      this.modes.toggle("paused");
      return;
    }

    // Mute works everywhere — paused, overlays, game over.
    if (this.actions.pressed("mute")) {
      setMuted(!isMuted());
      saveMutedPref(isMuted());
      this.ctx.say(isMuted() ? "Sound muted. (M to unmute)" : "Sound on.", "#a0a4b0");
    }

    if (this.modes.is("paused")) {
      return;
    }

    // Interrupt modes own nothing and read no input — the world stays frozen
    // (setWorldPaused already froze physics/anim; this stops engine rules
    // time, which ticks independently of Phaser's physics pause) until the
    // interrupt clears and lands on "paused" for a deliberate resume tap.
    if (isInterruptMode(this.modes.mode)) {
      return;
    }

    // The shop overlay owns input while open (before the C/I/R toggles).
    if (this.modes.is("shop")) {
      this.updateShopOverlayInput();
      return;
    }

    // Likewise the action chooser, when more than one "E" interaction is valid.
    if (this.modes.is("actionChoice")) {
      this.updateActionChoiceInput();
      return;
    }

    if (this.modes.acceptsOverlayToggle) {
      if (this.actions.pressed("stats")) this.modes.toggle("stats");
      if (this.actions.pressed("gear")) this.modes.toggle("gear");
      if (this.actions.pressed("rest") && this.modes.is("playing")) this.attemptRest();
    }

    if (this.modes.is("gear")) {
      this.updateGearOverlayInput();
      return;
    }
    if (this.modes.is("stats")) {
      return;
    }

    if (this.gameOver || this.won) {
      if (this.won && this.biomeOffer) this.updateBiomeChoiceInput();
      if (this.actions.held("restart")) this.restartRun();
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
    this.updateCameraFraming(time, delta);
    this.party.updateFollowers(time, (m, dir, targetY) => this.followerCanStep(m, dir, targetY));
    this.updateFollowerClimbs();
    this.updateFollowerSupport(time);
    this.trapSystem.update(time);
    this.updateMonsters(time, delta);
    this.updatePickups();
    this.updateSpikes(time);
    this.updateDying();
    this.updateDangerMarkers();
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

  /** Toggle the ESC menu. Called by the HUD's save/load buttons. */
  togglePause(): void {
    this.modes.toggle("paused");
  }

  private startControlDown(): boolean {
    return this.actions.anyHeld(START_DISMISS_ACTIONS);
  }

  private allInventoryItems() {
    return this.party.leader.character.inventory.all();
  }

  private refreshGearOverlay(): void {
    const hud = this.scene.get("Hud") as HudScene;
    const items = this.allInventoryItems();
    if (items.length > 0) this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex, 0, items.length);
    else this.gearSelectionIndex = 0;
    hud.hideGearOverlay();
    hud.showGearOverlay(this.party.leader.character, items[this.gearSelectionIndex]?.def.id);
  }

  private attemptRest(): void {
    if (!this.party.leader?.alive) return;
    this.restParty(false);
    if (this.modes.is("gear")) this.refreshGearOverlay();
  }

  private updateGearOverlayInput(): void {
    const items = this.allInventoryItems();
    if (items.length === 0) return;
    if (this.actions.pressed("menuUp")) {
      this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex - 1, 0, items.length);
      this.refreshGearOverlay();
      return;
    }
    if (this.actions.pressed("menuDown")) {
      this.gearSelectionIndex = Phaser.Math.Wrap(this.gearSelectionIndex + 1, 0, items.length);
      this.refreshGearOverlay();
      return;
    }
    if (this.actions.pressed("rest")) {
      this.attemptRest();
      return;
    }
    // EQUIP / USE ('E')
    if (this.actions.pressed("interact")) {
      const member = this.party.leader;
      const def = items[this.gearSelectionIndex]?.def;
      if (def) {
        if (def.id === "ration") {
          this.attemptRest();
        } else if (def.use) {
          this.beginInventoryItemAction(member, def);
          return;
        } else {
          try {
            if (def.weaponVisual) {
              if (member.torchLit && def.twoHanded) {
                throw new Error(`${member.character.name} cannot wield ${def.name} while carrying a torch`);
              }
              member.character.equipWeapon(def);
              this.ctx.say(`${member.character.name} equips ${def.name}.`, "#e0c060");
            } else if (def.armor) {
              member.character.equipArmor(def);
              this.ctx.say(`${member.character.name} equips ${def.name}.`, "#e0c060");
            } else if (def.shield) {
              member.character.equipShield(def);
              if (member.torchLit) member.character.shieldStowed = true;
              this.ctx.say(`${member.character.name} equips ${def.name}.`, "#e0c060");
            } else {
              this.ctx.say(`${def.name} cannot be equipped.`, "#a0a4b0");
            }
          } catch (error) {
            this.ctx.say(error instanceof Error ? error.message : String(error), "#d07070");
          }
        }
        this.refreshGearOverlay();
      }
      return;
    }
    // DROP ('D')
    if (this.actions.pressed("drop")) {
      const member = this.party.leader;
      const stack = items[this.gearSelectionIndex];
      if (stack) {
        const def = stack.def;
        try {
          const countToDrop = Math.min(stack.qty, def.bundleSize || 1);
          member.character.inventory.remove(def.id, countToDrop);
          if (member.character.wieldedWeapon?.id === def.id) member.character.wieldedWeapon = null;
          if (member.character.wornArmor?.id === def.id) member.character.wornArmor = null;
          if (member.character.carriedShield?.id === def.id) member.character.carriedShield = null;
          this.addPickup(member.x, member.y, def.id, countToDrop);
          this.ctx.say(`${member.character.name} dropped ${def.name}.`, "#a0a4b0");
        } catch (error) {
          this.ctx.say(error instanceof Error ? error.message : String(error), "#d07070");
        }
        this.refreshGearOverlay();
      }
      return;
    }
  }

  private beginInventoryItemAction(user: CharacterSprite, def: ReturnType<typeof item>): void {
    const options: Interaction[] = [];
    if (def.use?.actions.includes("consume")) {
      options.push({ label: "Use", run: () => this.beginPotionUse(user, def) });
    }
    if (def.use?.actions.includes("cast")) {
      options.push({ label: "Cast", run: () => this.castFromMagicItem(user, def) });
    }
    if (def.use?.actions.includes("activate")) {
      options.push({
        label: def.id === "serpent-venom" ? "Coat weapon" : "Activate",
        run: () => def.id === "serpent-venom" ? this.applySerpentVenom(user, def) : this.ctx.say(`${def.name} activates automatically when needed.`),
      });
    }
    if (def.use?.actions.includes("inspect")) {
      options.push({ label: "Inspect", run: () => this.inspectInventoryItem(user, def) });
    }
    if (options.length === 0) {
      this.ctx.say(`${def.name} has no usable action here.`, "#a0a4b0");
    } else if (options.length === 1) {
      options[0]!.run();
    } else {
      this.openActionChoice(options, { title: def.name, subtitle: "Choose an item action" });
    }
  }

  private applySerpentVenom(user: CharacterSprite, def: ReturnType<typeof item>): void {
    if (!user.character.inventory.has(def.id)) return;
    const roll = this.ctx.engine.dice.roll("1d20");
    user.character.inventory.remove(def.id, 1);
    if (poisonApplicationAccident(user.character, roll)) {
      const resisted = this.ctx.engine.check({ actor: user.character, stat: "CON", dc: DC.NORMAL, kind: "stat" });
      if (resisted.success) {
        this.ctx.say(`${user.character.name} spills the venom but resists it (application ${roll}, CON ${resisted.total}).`, "#e0c060");
      } else {
        user.character.takeDamage(this.ctx.engine.dice.roll("1d4"));
        applyCondition(user.character, "poisoned", { unit: "rounds", remaining: 5 });
        this.ctx.say(`${user.character.name} poisons themself while applying the venom!`, "#8bd450");
      }
    } else {
      armPoisonedWeapon(user.character);
      this.ctx.say(`${user.character.name} coats their weapon with serpent venom.`, "#8bd450");
    }
    if (this.modes.is("gear")) this.refreshGearOverlay();
  }

  private inspectInventoryItem(user: CharacterSprite, def: ReturnType<typeof item>): void {
    const state = user.character.itemState.get(def.id);
    const boundSpell = spellForMagicItem(def.id);
    const chargeText = def.use?.charges === undefined
      ? ""
      : ` Charges: ${state.chargesRemaining ?? def.use.charges}/${def.use.charges}.`;
    const condition = state.broken ? " It is broken." : state.inert ? " It is inert until rest." : "";
    this.openActionChoice(
      [{ label: "Back to gear", run: () => this.modes.set("gear") }],
      { title: def.name, subtitle: `${def.description ?? boundSpell?.description ?? "No further properties are known."}${chargeText}${condition}`, cancelable: false },
    );
  }

  private beginPotionUse(user: CharacterSprite, def: ReturnType<typeof item>): void {
    if (def.id === "potion-healing") {
      const candidates = this.party.members.filter(
        (member) => !member.character.dead && (member.character.dying !== null || member.character.hp < member.character.maxHp),
      );
      if (candidates.length === 0) {
        this.ctx.say("Nobody needs healing.", "#a0a4b0");
        return;
      }
      if (candidates.length === 1) {
        this.finishPotionUse(user, candidates[0]!, def);
        return;
      }
      this.openActionChoice(
        candidates.map((target) => ({
          label: `${target.character.name} (${target.character.hp}/${target.character.maxHp} HP${target.character.dying ? ", DOWN" : ""})`,
          run: () => this.finishPotionUse(user, target, def),
        })),
        { title: `Use ${def.name} on whom?`, subtitle: "Choose a party member" },
      );
      return;
    }
    this.finishPotionUse(user, user, def);
  }

  private finishPotionUse(user: CharacterSprite, target: CharacterSprite, def: ReturnType<typeof item>): void {
    try {
      const result = usePotion(user.character, target.character, def, this.ctx.engine.dice);
      sfx.pickupChime(true, this.spatial({ x: target.x, y: target.y }));
      floatText(
        this,
        target.x,
        target.y - 28,
        result.healed > 0 ? `+${result.healed} HP` : result.effect?.name.toUpperCase() ?? "POTION",
        "#72d887",
      );
      this.ctx.say(result.message, "#72d887");
      if (this.modes.is("gear")) this.refreshGearOverlay();
    } catch (error) {
      this.ctx.say(error instanceof Error ? error.message : String(error), "#d07070");
    }
  }

  private castFromMagicItem(caster: CharacterSprite, def: ReturnType<typeof item>): void {
    const suppliedSpell = spellForMagicItem(def.id);
    if (!suppliedSpell) {
      this.ctx.say(`${def.name} has no spell bound to it.`, "#d07070");
      return;
    }
    const legal = canUseItem(caster.character, caster.character.itemState, def, "cast", true);
    if (!legal.ok) {
      this.ctx.say(legal.message, "#d07070");
      return;
    }
    if (caster.character.className !== suppliedSpell.class) {
      this.ctx.say(`${caster.character.name} cannot decipher ${suppliedSpell.class} magic.`, "#d07070");
      return;
    }

    try {
      const result = castItemSpell(this.spellDeps(), caster, suppliedSpell);
      if (!result) return;
      caster.character.removeEffect("potion:invisibility");
      this.resolveItemCastResult(caster, def, result);
    } catch (error) {
      this.ctx.say(error instanceof Error ? error.message : String(error), "#d07070");
    }
  }

  private resolveItemCastResult(
    caster: CharacterSprite,
    def: ReturnType<typeof item>,
    result: CastResult,
  ): void {
    if (result.outcome === "pendingMishap") {
      this.resolvePendingCastDecision(
        caster,
        result,
        "item",
        () => {
          caster.swingCooldown = 0;
          return castItemSpell(this.spellDeps(), caster, result.spell);
        },
        (finalResult) => this.resolveItemCastResult(caster, def, finalResult),
      );
      return;
    }

    if (def.tags.includes("scroll")) {
      caster.character.inventory.remove(def.id, 1);
      this.ctx.say(`${def.name}'s writing vanishes.`, "#a0a4b0");
      return;
    }
    applyUseOutcome(
      caster.character.itemState,
      def,
      result.outcome === "mishap" ? "criticalFail" : result.outcome === "fail" ? "fail" : "success",
    );
    if (result.outcome === "fail") this.ctx.say(`${def.name} goes inert until rest.`, "#d07070");
    if (result.outcome === "mishap") this.ctx.say(`${def.name} cracks and is permanently broken!`, "#ff4060");
  }

  private resolveKnownCastResult(
    caster: CharacterSprite,
    result: CastResult,
    rerollCast: () => CastResult | null = () => castSelectedSpell(this.spellDeps(), caster),
  ): void {
    if (result.outcome === "pendingMishap") {
      this.resolvePendingCastDecision(
        caster,
        result,
        "known",
        () => {
          caster.swingCooldown = 0;
          return rerollCast();
        },
        (finalResult) => this.resolveKnownCastResult(caster, finalResult, rerollCast),
      );
      return;
    }
    if (result.outcome === "fail" && caster === this.party.leader) {
      this.offerLuck(caster, "the weave holds", () => {
        caster.character.knownSpell(result.spell.id).status = "available";
        caster.swingCooldown = 0;
        const retry = rerollCast();
        if (retry) this.resolveKnownCastResult(caster, retry, rerollCast);
      });
    }
  }

  private resolvePendingCastDecision(
    caster: CharacterSprite,
    pending: CastResult,
    source: CastSource,
    reroll: () => CastResult | null,
    onFinal: (result: CastResult) => void,
  ): void {
    const accept = () => onFinal(acceptCastMishap(this.spellDeps(), caster, pending, source));
    const decisions = availableMishapDecisions(caster.character, pending);
    if (!decisions.includes("spendLuck")) {
      accept();
      return;
    }

    const preview = pending.mishap?.entry.text
      ?? `${pending.spell.name} will be lost until atonement and rest.`;
    this.openActionChoice(
      [
        {
          label: "Spend Luck — reroll",
          run: () => {
            this.ctx.engine.spendLuckOnMishap(caster.character, pending);
            const bonus = destinedLuckBonus(caster.character, this.ctx.engine.dice);
            this.ctx.say(
              `${caster.character.name} spends Luck${bonus > 0 ? ` and adds Destined +${bonus}` : ""} before the mishap takes hold!`,
              "#ffd040",
            );
            this.withDestinedBonus(caster.character, bonus, () => {
              const next = reroll();
              if (next) onFinal(next);
            });
          },
        },
        { label: "Accept Mishap", run: accept },
      ],
      {
        title: `NATURAL 1 — ${pending.spell.name}`,
        subtitle: `Threatened consequence: ${preview}`,
        cancelable: false,
      },
    );
  }

  private updateLeaderMarker(time: number): void {
    const leader = this.party.leader;
    this.leaderMarker
      .setVisible(leader.alive)
      .setPosition(leader.x, leader.y - 31)
      .setScale(1.12)
      .setAlpha(0.88 + 0.12 * Math.sin(time / 180));
  }

  /** Floating "E — do the thing" prompt above the leader or hover info at mouse pointer. */
  /** Alive party members buy/sell; falls back to all if somehow none are up. */
  private shopMembers(): CharacterSprite[] {
    const alive = this.party.aliveMembers();
    return alive.length > 0 ? alive : this.party.members;
  }

  private activeShopMember(): CharacterSprite {
    const members = this.shopMembers();
    this.shopMemberIndex = Phaser.Math.Wrap(this.shopMemberIndex, 0, members.length);
    return members[this.shopMemberIndex]!;
  }

  private openShop(): void {
    if (this.modes.is("shop")) return;
    this.shopMode = "buy";
    this.shopCursor = 0;
    this.shopMemberIndex = 0;
    // The transition closes whichever overlay was open and raises the shop.
    this.modes.set("shop");
  }

  private closeShop(): void {
    this.modes.set("playing");
  }

  private sellableStacks(member: CharacterSprite) {
    return member.character.inventory.all().filter((s) => isSellable(s.def));
  }

  private buildShopView(): ShopView {
    const member = this.activeShopMember();
    const inv = member.character.inventory;
    const buy: ShopRow[] = stockItems().map((def) => ({
      id: def.id,
      name: def.name,
      price: buyPrice(def),
      block: buyBlocker(this.ctx, inv, def),
    }));
    const sell: ShopRow[] = this.sellableStacks(member).map((s) => ({
      id: s.def.id,
      name: s.def.name,
      price: sellPrice(s.def),
      qty: s.qty,
    }));
    const list = this.shopMode === "buy" ? buy : sell;
    this.shopCursor = list.length > 0 ? Phaser.Math.Wrap(this.shopCursor, 0, list.length) : 0;
    return {
      zoneName: this.safeZoneName ?? "SHOP",
      gold: this.ctx.spendableGold,
      memberName: member.character.name,
      mode: this.shopMode,
      buy,
      sell,
      cursor: this.shopCursor,
    };
  }

  private refreshShopOverlay(): void {
    const hud = this.scene.get("Hud") as HudScene;
    hud.hideShopOverlay();
    hud.showShopOverlay(this.buildShopView());
  }

  private updateShopOverlayInput(): void {
    if (this.actions.pressed("gear")) {
      this.closeShop();
      return;
    }
    if (this.actions.pressed("menuLeft") || this.actions.pressed("menuRight")) {
      this.shopMode = this.shopMode === "buy" ? "sell" : "buy";
      this.shopCursor = 0;
      this.refreshShopOverlay();
      return;
    }
    if (this.actions.pressed("cycle")) {
      this.shopMemberIndex = Phaser.Math.Wrap(this.shopMemberIndex + 1, 0, this.shopMembers().length);
      this.shopCursor = 0;
      this.refreshShopOverlay();
      return;
    }
    const length = this.shopMode === "buy" ? stockItems().length : this.sellableStacks(this.activeShopMember()).length;
    if (length > 0 && this.actions.pressed("menuUp")) {
      this.shopCursor = Phaser.Math.Wrap(this.shopCursor - 1, 0, length);
      this.refreshShopOverlay();
      return;
    }
    if (length > 0 && this.actions.pressed("menuDown")) {
      this.shopCursor = Phaser.Math.Wrap(this.shopCursor + 1, 0, length);
      this.refreshShopOverlay();
      return;
    }
    if (this.actions.pressed("interact")) {
      if (this.shopMode === "buy") this.attemptBuy();
      else this.attemptSell();
    }
  }

  private attemptBuy(): void {
    const member = this.activeShopMember();
    const def = stockItems()[this.shopCursor];
    if (!def) return;
    try {
      shopBuy(this.ctx, member.character.inventory, def);
      sfx.pickupChime(false, this.spatial({ x: member.x, y: member.y }));
      this.ctx.say(
        `${member.character.name} buys ${def.name} for ${buyPrice(def)}g — ${this.ctx.spendableGold}g left.`,
        "#e8c840",
      );
    } catch (err) {
      this.ctx.say(err instanceof Error ? err.message : String(err), "#d07070");
    }
    this.refreshShopOverlay();
  }

  private attemptSell(): void {
    const member = this.activeShopMember();
    const stack = this.sellableStacks(member)[this.shopCursor];
    if (!stack) return;
    const def = stack.def;
    try {
      const paid = shopSell(this.ctx, member.character.inventory, def);
      // Drop any equipment references to a sold item once the last one is gone.
      const c = member.character;
      if (!c.inventory.has(def.id)) {
        if (c.wieldedWeapon?.id === def.id) c.wieldedWeapon = null;
        if (c.wornArmor?.id === def.id) c.wornArmor = null;
        if (c.carriedShield?.id === def.id) c.carriedShield = null;
      }
      sfx.pickupChime(true, this.spatial({ x: member.x, y: member.y }));
      this.ctx.say(
        `${member.character.name} sells ${def.name} for ${paid}g — ${this.ctx.spendableGold}g total.`,
        "#e8c840",
      );
    } catch (err) {
      this.ctx.say(err instanceof Error ? err.message : String(err), "#d07070");
    }
    this.refreshShopOverlay();
  }

  private updateInteractPrompt(): void {
    const leader = this.party.leader;
    const interactions = leader.alive ? this.findInteractions(leader) : [];
    if (interactions.length > 0) {
      const label = interactions.length === 1 ? interactions[0]!.label : `choose (${interactions.length} actions)`;
      this.interactPrompt
        .setText(`E — ${label}`)
        .setPosition(leader.x, leader.y - 42)
        .setVisible(true);
    } else {
      const pointer = this.input.activePointer;
      const hoverInfo = pointer ? this.trapSystem.getHoverInfo(pointer.worldX, pointer.worldY) : null;
      if (hoverInfo) {
        this.interactPrompt
          .setText(hoverInfo)
          .setPosition(pointer.worldX, pointer.worldY - 24)
          .setVisible(true);
      } else {
        this.interactPrompt.setVisible(false);
      }
    }
  }

  private updateLuckWindow(time: number): void {
    const w = this.luckWindow;
    if (!w) return;
    if (time > w.expiresAt || w.member !== this.party.leader || !w.member.alive) {
      this.luckWindow = null;
      return;
    }
    if (this.actions.pressed("luck")) {
      const c = w.member.character;
      if (!c.luckToken) throw new Error(`${c.name} has no luck token but a luck window was open`);
      c.luckToken = false;
      this.luckWindow = null;
      const bonus = destinedLuckBonus(c, this.ctx.engine.dice);
      this.ctx.say(
        `${c.name} spends their luck${bonus > 0 ? ` and adds Destined +${bonus}` : ""} — ${w.label}!`,
        "#ffd040",
      );
      this.withDestinedBonus(c, bonus, w.redo);
    }
  }

  private withDestinedBonus(character: CharacterSprite["character"], bonus: number, action: () => void): void {
    if (bonus <= 0) {
      action();
      return;
    }
    const id = `seer:destined:${this.time.now}`;
    character.addEffect({ id, name: `Destined (+${bonus})`, hooks: [{ kind: "checkBonus", applies: "any", bonus }] });
    try {
      action();
    } finally {
      character.removeEffect(id);
    }
  }

  /** Open a short reroll window if the member still holds their luck token. */
  private offerLuck(member: CharacterSprite, label: string, redo: () => void): void {
    if (!member.character.luckToken) return;
    this.luckWindow = { member, label, redo, expiresAt: this.time.now + 2500 };
  }

  /** Party-slot select actions, indexed 0..3. */
  private static readonly PARTY_ACTIONS: readonly GameAction[] = ["party1", "party2", "party3", "party4"];

  /** Move the descent-choice cursor with arrows or select a scroll by number. */
  /**
   * Move the scroll-destination selection directly, for a tap on a card. A list
   * pick has no keyboard analogue to route through {@link ActionInput} (the
   * 1-6 keys only cover four party actions), so the HUD names the index.
   */
  selectBiome(index: number): void {
    const offer = this.biomeOffer;
    if (!offer) throw new Error("No scroll destination offer to select from");
    if (index < 0 || index >= offer.zones.length) {
      throw new Error(`Scroll selection ${index} is out of range (${offer.zones.length} offered)`);
    }
    this.biomeSelectionIndex = index;
  }

  private updateBiomeChoiceInput(): void {
    const offer = this.biomeOffer;
    if (!offer) return;
    const count = offer.zones.length;
    if (this.actions.pressed("menuLeft")) this.biomeSelectionIndex = (this.biomeSelectionIndex + count - 1) % count;
    if (this.actions.pressed("menuRight")) this.biomeSelectionIndex = (this.biomeSelectionIndex + 1) % count;
    DungeonScene.PARTY_ACTIONS.forEach((action, index) => {
      if (index < count && this.actions.pressed(action)) this.biomeSelectionIndex = index;
    });
  }

  /** Start (or restart) smooth-follow on the current leader, resetting the framing controller. */
  private startCameraFollow(snap: boolean): void {
    this.cameras.main.startFollow(this.party.leader, true, 0.12, 0.12);
    if (!snap) return;
    const leader = this.party.leader;
    const tileX = Math.floor(leader.x / TILE);
    const tileY = Math.floor((leader.y + FEET_OFFSET_PX) / TILE);
    const elevated = leader.climbing || isElevatedSupport(this.activeDungeon.grid, tileX, tileY);
    const target = this.cameraFraming.reset(leader.facing, elevated ? "elevated" : "floor");
    this.cameras.main.setFollowOffset(target.offsetX, target.offsetY);
  }

  /** Derive the 80/20 horizontal look-ahead and the floor/elevated vertical framing each tick. */
  private updateCameraFraming(time: number, delta: number): void {
    const leader = this.party.leader;
    const tileX = Math.floor(leader.x / TILE);
    const tileY = Math.floor((leader.y + FEET_OFFSET_PX) / TILE);
    const supportIsElevated = isElevatedSupport(this.activeDungeon.grid, tileX, tileY);
    const target = this.cameraFraming.update(time, delta, {
      facing: leader.facing,
      grounded: leader.grounded,
      climbing: leader.climbing,
      supportIsElevated,
    });
    this.cameras.main.setFollowOffset(target.offsetX, target.offsetY);
  }

  private updateLeaderInput(time: number, delta: number): void {
    const leader = this.party.leader;

    // Leader swap
    if (this.actions.pressed("cycle")) this.party.cycleLeader();
    DungeonScene.PARTY_ACTIONS.forEach((action, idx) => {
      if (this.actions.pressed(action) && idx < this.party.size) this.party.selectLeader(idx);
    });
    if (this.party.leader !== leader) {
      this.startCameraFollow(true);
      return;
    }
    if (!leader.alive) {
      this.party.ensureLeaderAlive();
      return;
    }

    // Movement
    const left = this.actions.held("moveLeft");
    const right = this.actions.held("moveRight");
    const up = this.actions.held("moveUp");
    const down = this.actions.held("moveDown");
    const flying = hasCapability(leader.character, "canFly");

    if (flying && leader.ledgeGrabState) leader.ledgeGrabState = null;

    // Ledge Grab Input Handling
    if (!flying && leader.ledgeGrabState) {
      const body = leader.body as Phaser.Physics.Arcade.Body;
      const grab = leader.ledgeGrabState;
      const oppositeDir = grab.side === "left" ? right : left;

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
    if (!flying && leader.character.className === "fighter") {
      if (down && leader.grounded) {
        leader.bracing = true;
        leader.setVelocityX(0);
      } else {
        leader.bracing = false;
      }
    }

    if (!flying && leader.bracing) {
      leader.noteGrounded(time);
      return;
    }

    // Ladder climbing: instant attachment and fall arrest on contact
    const body = leader.body as Phaser.Physics.Arcade.Body;
    const wallWalking = hasHook(leader.character.effects, "canClimbWalls");
    const nearClimbTile = this.climbTiles.find(
      (z) => Math.abs(z.x - leader.x) <= TILE * 1.4 && Math.abs(z.y - leader.y) <= TILE * 1.4,
    );
    leader.touchingClimbable = nearClimbTile !== undefined || (wallWalking && (body.blocked.left || body.blocked.right));
    const downInput = down;

    if (flying) {
      leader.bracing = false;
      leader.climbing = false;
      leader.touchingClimbable = false;
      body.setAllowGravity(false);
      body.setGravityY(0);
      leader.setVelocityY(up ? -leader.speed : down ? leader.speed : 0);
    } else if (leader.touchingClimbable) {
      const isGrounded = body.blocked.down;
      const wantsJumpOff = leader.climbing && (this.actions.pressed("jumpOff") || (up && (left || right)));
      if (wantsJumpOff) {
        leader.climbing = false;
        body.setAllowGravity(true);
        leader.tryJump(time);
      } else if (!isGrounded || up || downInput || leader.climbing) {
        const climbTilesAbove = this.climbTiles.some(
          (z) => Math.abs(z.x - leader.x) <= TILE * 1.4 && z.y < leader.y - 6,
        );
        if (up && !climbTilesAbove && leader.climbing) {
          leader.climbing = false;
          body.setAllowGravity(true);
          leader.setVelocityY(-160);
        } else {
          leader.climbing = true;
          body.setAllowGravity(false);
          if (up) {
            leader.setVelocityY(-120);
          } else if (downInput) {
            leader.setVelocityY(120);
          } else {
            leader.setVelocityY(0);
          }
        }
      } else if (leader.climbing) {
        leader.climbing = false;
        body.setAllowGravity(true);
      }
    } else if (leader.climbing) {
      leader.climbing = false;
      body.setAllowGravity(true);
    }

    if ((left || right || up || down) && cancelShieldWall(leader.character)) {
      this.ctx.say(`${leader.character.name} leaves Shield Wall to move.`, "#a0a4b0");
    }
    leader.moveHorizontal(left ? -1 : right ? 1 : 0, delta);
    if (!flying) {
      leader.noteGrounded(time);
      if (up && !leader.climbing) leader.tryJump(time);
    }

    // Follower mode toggle
    if (this.actions.pressed("followerMode")) {
      for (const m of this.party.members) {
        if (m === leader) continue;
        m.mode = m.mode === "follow" ? "hold" : "follow";
      }
      const mode = this.party.members.find((m) => m !== leader)?.mode;
      if (mode) this.ctx.say(`Followers: ${mode.toUpperCase()}.`);
    }

    // Attack
    if (this.actions.held("attack")) {
      const outcome = meleeSwing(this.meleeDeps(), leader);
      if (outcome.swung) cancelShieldWall(leader.character);
      if (outcome.swung) leader.character.removeEffect("potion:invisibility");
      if (outcome.swung) this.emitNoiseAt(leader.x, leader.y);
      if (outcome.swung && leader.character.className === "fighter") this.breakWeakWalls(leader);
      if (outcome.damage !== undefined) {
        const flourish = triggerFlourish(leader.character, this.ctx.engine.dice);
        if (flourish) {
          floatText(this, leader.x, leader.y - 38, `+${flourish.healed} FLOURISH`, "#72d887", 12);
          this.ctx.say(`${leader.character.name} flourishes, healing ${flourish.healed} HP (${flourish.usesRemaining} left).`, "#72d887");
        }
      }
      if (outcome.check && !outcome.check.success) {
        this.offerLuck(leader, "the blade finds its mark", () => {
          leader.swingCooldown = 0;
          meleeSwing(this.meleeDeps(), leader);
        });
      }
    }

    // Cast / cycle spell
    if (this.actions.pressed("cycleSpell") && leader.character.knownSpells.length > 0) {
      leader.spellIndex = (leader.spellIndex + 1) % leader.character.knownSpells.length;
      const slot = leader.character.knownSpells[leader.spellIndex]!;
      this.ctx.say(`Prepared: ${spell(slot.spellId).name}${slot.status === "lost" ? " (LOST)" : ""}`);
    }
    if (this.actions.pressed("cast") && leader.character.knownSpells.length > 0) {
      cancelShieldWall(leader.character);
      this.beginLeaderSpellCast(leader);
    }

    // Torch
    if (this.actions.pressed("torch")) this.lightTorch(leader);

    // Interact
    if (this.actions.pressed("interact")) this.interact(leader);
  }

  /**
   * Leader casters make every ambiguous spell decision before rolling. The
   * shared action chooser pauses play and already supports arrows/confirm and
   * one-tap mobile buttons; followers retain fast automatic targeting.
   */
  private beginLeaderSpellCast(caster: CharacterSprite): void {
    const known = caster.character.knownSpells;
    const slot = known[caster.spellIndex % known.length];
    if (!slot) return;
    const def = spell(slot.spellId);
    const range = def.range === "far" ? FAR_PX : def.range === "near" ? NEAR_PX : CLOSE_PX;

    const commit = (target?: MonsterSprite, selection: SpellSelection = {}) => {
      const doCast = () => castSelectedSpell(this.spellDeps(), caster, target, selection);
      const castAgain = () => {
        caster.swingCooldown = 0;
        return doCast();
      };
      const result = doCast();
      if (!result) return;
      caster.character.removeEffect("potion:invisibility");
      this.resolveKnownCastResult(caster, result, castAgain);
    };

    const chooseSpellOption = (target?: MonsterSprite, selection: SpellSelection = {}) => {
      if (!def.choices?.length) {
        commit(target, selection);
        return;
      }
      this.openActionChoice(
        def.choices.map((choice) => ({
          label: choice[0]!.toUpperCase() + choice.slice(1),
          run: () => commit(target, { ...selection, choice }),
        })),
        { title: `${def.name}: choose`, subtitle: def.description },
      );
    };

    if (def.target === "enemy") {
      const targets = this.monsters
        .filter((monster) => monster.aliveInFight && Phaser.Math.Distance.Between(caster.x, caster.y, monster.x, monster.y) <= range)
        .sort((a, b) => Phaser.Math.Distance.Between(caster.x, caster.y, a.x, a.y) - Phaser.Math.Distance.Between(caster.x, caster.y, b.x, b.y));
      if (targets.length === 0) { this.ctx.say(`No enemy is in ${def.range} range for ${def.name}.`, "#d07070"); return; }
      if (targets.length === 1 && !def.choices?.length) { commit(targets[0]); return; }
      this.openActionChoice(
        targets.map((target) => ({ label: `${target.def.name} (${target.hp} HP)`, run: () => chooseSpellOption(target) })),
        { title: `${def.name}: choose target`, subtitle: `${def.range.toUpperCase()} range` },
      );
      return;
    }

    if (def.target === "ally") {
      const targets = this.party.members.filter((member) =>
        !member.character.dead &&
        Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) <= range &&
        !(def.id === "trance" && member === caster) &&
        (!(def.id === "trance" || def.id === "bless") || !member.character.luckToken) &&
        (def.id !== "cure-wounds" || member.character.dying !== null || member.character.hp < member.character.maxHp) &&
        (def.id !== "seer-potion" || member.character.dying !== null || hasCondition(member.character, "poisoned")),
      );
      if (targets.length === 0) { this.ctx.say(`No valid ally is in range for ${def.name}.`, "#d07070"); return; }
      if (targets.length === 1) { commit(undefined, { ally: targets[0] }); return; }
      this.openActionChoice(
        targets.map((target) => ({
          label: `${target.character.name} (${target.character.hp}/${target.character.maxHp} HP${target.character.luckToken ? ", Luck" : ""})`,
          run: () => commit(undefined, { ally: target }),
        })),
        { title: `${def.name}: choose ally`, subtitle: `${def.range.toUpperCase()} range` },
      );
      return;
    }

    if (def.target === "direction") {
      this.openActionChoice(
        [
          { label: "Left", run: () => commit(undefined, { direction: -1 }) },
          { label: "Right", run: () => commit(undefined, { direction: 1 }) },
        ],
        { title: `${def.name}: choose line`, subtitle: "All creatures in the line can be hit" },
      );
      return;
    }

    if (def.target === "point") {
      const points: { label: string; point: { x: number; y: number } }[] = [
        { label: `${def.range} left`, point: { x: caster.x - range, y: caster.y } },
        { label: `${def.range} right`, point: { x: caster.x + range, y: caster.y } },
        ...this.monsters
          .filter((monster) => monster.aliveInFight && Phaser.Math.Distance.Between(caster.x, caster.y, monster.x, monster.y) <= range)
          .map((monster) => ({ label: `At ${monster.def.name}`, point: { x: monster.x, y: monster.y } })),
      ];
      this.openActionChoice(
        points.map((entry) => ({ label: entry.label, run: () => commit(undefined, { point: entry.point }) })),
        { title: `${def.name}: choose area`, subtitle: "The game pauses while you choose" },
      );
      return;
    }

    if (def.target === "object") {
      if (caster.character.classState.cauldronItems.length > 0) { commit(); return; }
      const objects = caster.character.inventory.all().filter((stack) => stack.def.slotCost <= 3 && stack.def.id !== "coins");
      if (objects.length === 0) { commit(); return; }
      this.openActionChoice(
        objects.map((stack) => ({ label: stack.def.name, run: () => commit(undefined, { objectItemId: stack.def.id }) })),
        { title: `${def.name}: choose item`, subtitle: "Repair a broken mundane item or store one item" },
      );
      return;
    }

    chooseSpellOption();
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
    return {
      ...this.meleeDeps(),
      party: () => this.party.members,
      spellOrigin: (caster) =>
        caster.character.className === "witch" && caster.character.classState.familiarAlive
          ? { x: caster.x + caster.facing * TILE * 1.5, y: caster.y - TILE * 0.35 }
          : { x: caster.x, y: caster.y },
      revealSecrets: () => {
        const unseen = this.activeDungeon.regions.find((region) => !this.discoveredRoomIds.has(region.id));
        if (!unseen) return null;
        this.discoveredRoomIds.add(unseen.id);
        return unseen.hud;
      },
      answerDivination: (kind) => {
        if (kind === "danger") {
          const danger = this.monsters.some((monster) => monster.aliveInFight && monster.aiState === "aggro");
          return danger ? "Yes. Immediate danger hunts you." : "No. No awakened foe is close.";
        }
        if (kind === "secret") {
          const unseen = this.activeDungeon.regions.some((region) => !this.discoveredRoomIds.has(region.id));
          return unseen ? "Yes. An unseen route or chamber remains." : "No. The mapped rooms hold no further route.";
        }
        return this.rewardClaimed ? "Yes. The promised treasure is already yours." : `Yes. ${this.currentReward.title} remains unclaimed.`;
      },
      spawnHostile: (monsterId, x, y) => this.spawnMishapHostile(monsterId, x, y),
    };
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
    const interactions = this.findInteractions(leader);
    if (interactions.length === 0) {
      this.ctx.say("Nothing to do here.");
      return;
    }
    if (interactions.length === 1) {
      interactions[0]!.run();
      return;
    }
    this.openActionChoice(interactions);
  }

  /** Shared entry point for both the "E" interaction chooser and the encounter reaction popup. */
  private openActionChoice(
    options: Interaction[],
    opts: { title?: string; subtitle?: string; cancelable?: boolean } = {},
  ): void {
    this.actionChoiceOptions = options;
    this.actionChoiceCursor = 0;
    this.actionChoiceTitle = opts.title;
    this.actionChoiceSubtitle = opts.subtitle;
    this.actionChoiceCancelable = opts.cancelable ?? true;
    this.modes.set("actionChoice");
  }

  /**
   * Every contextual "E" action valid for the leader's position right now —
   * in priority order, which `interact` and the prompt both lean on when
   * there's exactly one. When there's more than one (e.g. a safe-zone room
   * that holds a shop, a shrine, and a campfire all at once), the caller
   * opens a chooser instead of the first candidate silently winning.
   */
  private findInteractions(leader: CharacterSprite): Interaction[] {
    const candidates: Interaction[] = [];

    const focused = leader.character.effects.find((effect) => effect.duration?.unit === "focus");
    if (focused) {
      candidates.push({
        label: `drop ${focused.name}`,
        run: () => {
          leader.character.effects = leader.character.effects.filter((effect) => effect.duration?.unit !== "focus");
          this.ctx.say(`${leader.character.name} releases their focus.`, "#a0a4b0");
        },
      });
    }
    const witchlight = leader.character.effects.find((effect) => effect.id === "focus:witchlight");
    if (witchlight) {
      const point = witchlight.hooks.find((hook) => hook.kind === "focusPoint");
      if (point && point.kind === "focusPoint") {
        candidates.push({
          label: "move Witchlight",
          run: () => this.openActionChoice(
            [
              { label: "Left", run: () => { point.x -= NEAR_PX; } },
              { label: "Right", run: () => { point.x += NEAR_PX; } },
              { label: "Up", run: () => { point.y -= NEAR_PX; } },
              { label: "Down", run: () => { point.y += NEAR_PX; } },
            ],
            { title: "Move Witchlight", subtitle: "Float it up to near on your turn" },
          ),
        });
      }
    }

    if (leader.character.className === "sea-wolf" && leader.character.carriedShield && !leader.character.shieldStowed) {
      candidates.push({
        label: isShieldWallActive(leader.character) ? "lower Shield Wall" : "form Shield Wall (AC 20)",
        run: () => {
          if (isShieldWallActive(leader.character)) {
            cancelShieldWall(leader.character);
            this.ctx.say(`${leader.character.name} lowers the shield.`, "#a0a4b0");
          } else {
            activateShieldWall(leader.character);
            this.ctx.say(`${leader.character.name} forms a Shield Wall: AC 20 until moving or attacking.`, "#72a7d8");
          }
        },
      });
    }

    if (leader.character.className === "ras-godai" && !isHidden(leader.character)) {
      candidates.push({
        label: "hide in the shadows",
        run: () => {
          const result = this.ctx.engine.check({ actor: leader.character, stat: "DEX", dc: DC.NORMAL, kind: "stealth" });
          if (result.success) {
            hideCharacter(leader.character);
            this.ctx.say(`${leader.character.name} disappears from unaware eyes.`, "#b99de8");
          } else {
            this.ctx.say(`${leader.character.name} fails to find concealment.`, "#d07070");
          }
        },
      });
    }

    if (leader.character.className === "seer" && leader.character.classState.omenUses > 0) {
      candidates.push({
        label: "read an omen (1/rest)",
        run: () => {
          leader.character.classState.omenUses--;
          const unseen = this.activeDungeon.regions.find((region) => !this.discoveredRoomIds.has(region.id));
          if (unseen) this.discoveredRoomIds.add(unseen.id);
          this.ctx.say(
            unseen
              ? `An omen reveals ${unseen.hud}: ${this.currentReward.title} waits deeper within.`
              : `The omen warns: ${this.currentReward.title} is close, and no room remains unseen.`,
            "#f0d98f",
          );
        },
      });
    }

    if (leader.character.className === "witch" && leader.character.classState.familiarAlive) {
      candidates.push({
        label: "send familiar to scout",
        run: () => {
          const unseen = this.activeDungeon.regions.find((region) => !this.discoveredRoomIds.has(region.id));
          if (unseen) this.discoveredRoomIds.add(unseen.id);
          const roll = this.ctx.engine.dice.roll("1d20");
          if (roll === 1) {
            leader.character.classState.familiarAlive = false;
            this.ctx.say(`${leader.character.name}'s familiar does not return from the dark.`, "#ff7080");
          } else {
            const carried = this.pickups
              .filter((pickup) => pickup.sprite.active && pickup.itemId !== "coins")
              .sort(
                (a, b) =>
                  Phaser.Math.Distance.Between(leader.x, leader.y, a.sprite.x, a.sprite.y) -
                  Phaser.Math.Distance.Between(leader.x, leader.y, b.sprite.x, b.sprite.y),
              )[0];
            let retrieved = "";
            if (carried) {
              const def = item(carried.itemId);
              if (leader.character.inventory.canAdd(def, carried.qty)) {
                leader.character.inventory.add(def, carried.qty);
                carried.sprite.destroy();
                retrieved = ` It carries back ${def.name}.`;
              }
            }
            this.ctx.say(
              `${unseen ? `The familiar scouts ${unseen.hud} and returns safely.` : "The familiar finds no unexplored room."}${retrieved}`,
              "#c8a5e8",
            );
          }
        },
      });
    }

    // 1. Stabilize a dying ally
    const dying = this.party.members.find(
      (m) => m !== leader && m.character.dying && zoneBetween(leader, m) === "close",
    );
    if (dying) {
      candidates.push({
        label: `stabilize ${dying.character.name}`,
        run: () => this.tryStabilize(leader, dying),
      });
    }

    // 2. Talkable social encounters are distinct from immediate rescues.
    const talkable = this.talkableNpcs.find(
      (npc) => Phaser.Math.Distance.Between(leader.x, leader.y, npc.sprite.x, npc.sprite.y) < TILE * 1.8,
    );
    if (talkable) {
      const state = this.npcInteractionStates.get(talkable.spec.id) ?? "unmet";
      candidates.push({
        label: `${state === "unmet" ? "speak with" : state === "heard" ? "continue with" : "recall words from"} ${talkable.spec.name}`,
        run: () => this.advanceNpcInteraction(talkable, leader),
      });
    }

    // 3. Claim the single campaign reward in the fifth room.
    const reward = this.rewardMarker;
    if (
      reward &&
      !this.rewardClaimed &&
      Phaser.Math.Distance.Between(leader.x, leader.y, reward.x, reward.y) < TILE * 1.8
    ) {
      candidates.push({
        label: `claim ${this.currentReward.title}`,
        run: () => this.claimDungeonReward(),
      });
    }

    // Safe-zone shop: available anywhere inside the shelter room.
    if (this.safeZoneId && this.currentRoomId === this.safeZoneId) {
      candidates.push({
        label: `shop${this.safeZoneName ? ` (${this.safeZoneName})` : ""}`,
        run: () => this.openShop(),
      });
    }

    const trapInteraction = this.trapSystem.findInteraction(leader);
    if (trapInteraction) candidates.push(trapInteraction);

    const gate = this.portcullises.getChildren().find((candidate) => {
      const image = candidate as Phaser.Physics.Arcade.Image;
      return image.active && Phaser.Math.Distance.Between(leader.x, leader.y, image.x, image.y) < TILE * 1.8;
    }) as Phaser.Physics.Arcade.Image | undefined;
    if (gate) {
      const connector = this.connectorGates.get(gate);
      const requirement = connector?.requirement;
      if (requirement && !this.activatedRequirements.has(requirement.id)) {
        candidates.push({
          label: requirement.kind === "key" ? "requires its key" : "requires its switch",
          run: () => this.ctx.say(
            requirement.kind === "key" ? "The portcullis needs its key." : "The portcullis needs its switch.",
            "#e0c060",
          ),
        });
        // Mundane gear as a puzzle-skip: iron spikes force the mechanism
        // without the key/switch, at the cost of the item.
        if (leader.character.inventory.has("iron-spikes")) {
          const conn = connector!;
          candidates.push({
            label: "force it open with iron spikes (-1)",
            run: () => {
              leader.character.inventory.remove("iron-spikes", 1);
              this.openedConnectors.add(conn.id);
              gate.destroy();
              sfx.doorThump();
              this.ctx.say(
                `${leader.character.name} wedges iron spikes into the mechanism and forces it open.`,
                "#d0c080",
              );
              this.emitNoiseAt(leader.x, leader.y);
              this.saveToSlot(0);
            },
          });
        }
      } else {
        candidates.push({
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
        });
      }
    }

    // 3. Disarm spikes (thief)
    if (leader.character.className === "thief") {
      const nearSpikes = this.spikes.filter(
        (s) => s.active && Phaser.Math.Distance.Between(leader.x, leader.y, s.x, s.y) < TILE * 2,
      );
      if (nearSpikes.length > 0) {
        candidates.push({
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
        });
      }
    }

    // 4. Atone at a shrine (priest whose deity has cut them off)
    const shrine = this.shrines.find(
      (s) => Phaser.Math.Distance.Between(leader.x, leader.y, s.x, s.y) < TILE * 2,
    );
    if (shrine && leader.character.knownSpells.some((s) => s.requiresAtonement)) {
      candidates.push({
        label: "atone at the shrine",
        run: () => {
          this.ctx.engine.atone(leader.character);
          this.ctx.say(
            `${leader.character.name} completes their penance — the lost spells will return after rest.`,
            "#f0e090",
          );
        },
      });
    }

    // 5. Rest at campfire
    const fire = this.campfires.find(
      (f) => Phaser.Math.Distance.Between(leader.x, leader.y, f.x, f.y) < TILE * 2.5,
    );
    if (fire) {
      if (
        leader.character.className === "witch" &&
        !leader.character.classState.familiarAlive &&
        this.ctx.spendableGold >= 25
      ) {
        candidates.push({
          label: "restore familiar (25 gold)",
          run: () => {
            this.ctx.spendGold(25);
            leader.character.classState.familiarAlive = true;
            this.ctx.say(`${leader.character.name} calls the familiar back through smoke and blood.`, "#c8a5e8");
          },
        });
      }
      candidates.push({
        label: fire.free ? "rest (safe haven)" : "rest (1 ration each)",
        run: () => this.restParty(fire.free),
      });
    }

    // 6. Exit door
    if (Phaser.Math.Distance.Between(leader.x, leader.y, this.door.x, this.door.y) < TILE * 1.6) {
      candidates.push({
        label: this.rewardClaimed ? `leave with ${this.currentReward.title}` : "claim the vault reward first",
        run: () => {
          if (!this.rewardClaimed) {
            this.ctx.say("The dungeon is not complete — claim the reward in room five first.", "#e0c060");
            return;
          }
          sfx.doorThump();
          const dungeonIndex = this.registry.get("dungeonIndex") ?? 0;
          const runSeed = this.registry.get("runSeed") ?? 0;
          const nextCompleted = this.vaultsCompletedInScroll + 1;
          if (nextCompleted >= this.vaultsInScroll) {
            // Destination Cursed Scroll completed! Roll 1d6 Destination Choices
            this.biomeOffer = rollBiomeOffer(dungeonIndex, runSeed);
            this.biomeSelectionIndex = 0;
          } else {
            // Still in progress in this Cursed Scroll
            this.biomeOffer = null;
          }
          // Enter the terminal mode only once the offer exists — the HUD builds
          // the victory screen from it when the event lands.
          this.modes.set("victory");
          this.ctx.events.emit("won");
        },
      });
    }

    return candidates;
  }

  private refreshActionChoiceOverlay(): void {
    const hud = this.scene.get("Hud") as HudScene;
    hud.hideActionChoiceOverlay();
    hud.showActionChoiceOverlay(this.actionChoiceOptions.map((o) => o.label), this.actionChoiceCursor, {
      title: this.actionChoiceTitle,
      subtitle: this.actionChoiceSubtitle,
      cancelable: this.actionChoiceCancelable,
    });
  }

  private updateActionChoiceInput(): void {
    if (this.actionChoiceCancelable && this.actions.pressed("gear")) {
      this.actionChoiceOptions = [];
      this.modes.set("playing");
      return;
    }
    const length = this.actionChoiceOptions.length;
    if (length > 0 && this.actions.pressed("menuUp")) {
      this.actionChoiceCursor = Phaser.Math.Wrap(this.actionChoiceCursor - 1, 0, length);
      this.refreshActionChoiceOverlay();
      return;
    }
    if (length > 0 && this.actions.pressed("menuDown")) {
      this.actionChoiceCursor = Phaser.Math.Wrap(this.actionChoiceCursor + 1, 0, length);
      this.refreshActionChoiceOverlay();
      return;
    }
    if (this.actions.pressed("interact")) {
      const chosen = this.actionChoiceOptions[this.actionChoiceCursor];
      this.actionChoiceOptions = [];
      this.modes.set("playing");
      if (chosen) chosen.run();
    }
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

  private spawnMishapHostile(monsterId: string, x: number, y: number): void {
    let definition;
    try {
      definition = monster(monsterId);
    } catch {
      definition = monster(this.activeDungeon.encounterMonsterId);
      this.ctx.say("The portal rejects its intended shape and summons a local horror instead.", "#ff8a60");
    }
    const bounds = this.physics.world.bounds;
    const foe = new MonsterSprite(
      this,
      Phaser.Math.Clamp(x, bounds.left + TILE, bounds.right - TILE),
      Phaser.Math.Clamp(y, bounds.top + TILE, bounds.bottom - TILE),
      definition,
      `mishap-${Math.floor(this.ctx.engine.clock.elapsedMs)}`,
      this.ctx.engine.dice,
    );
    this.monsters.push(foe);
    this.monsterGroup.add(foe);
    this.morale.register(foe);
    this.trapSystem.registerActor(foe);
    foe.alert();
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
    // Fog moves with its focused caster and obscures every party member inside.
    for (const member of this.party.members) member.character.removeEffect("spell:fog-zone");
    for (const monster of this.monsters) monster.spellObscured = false;
    for (const fogCaster of this.party.aliveMembers().filter((member) => member.character.effects.some((effect) => effect.id === "focus:fog"))) {
      for (const member of this.party.aliveMembers().filter((candidate) => Phaser.Math.Distance.Between(fogCaster.x, fogCaster.y, candidate.x, candidate.y) <= CLOSE_PX)) {
        member.character.addEffect({ id: "spell:fog-zone", name: "Fog (obscured)", hooks: [{ kind: "obscured" }] });
      }
      for (const monster of this.monsters.filter((candidate) => candidate.aliveInFight && Phaser.Math.Distance.Between(fogCaster.x, fogCaster.y, candidate.x, candidate.y) <= CLOSE_PX)) {
        monster.spellObscured = true;
      }
    }
    for (const member of this.party.aliveMembers()) {
      if (
        member.character.effects.some((effect) => effect.id === "spell:evoke-rage") &&
        time - member.lastOffensiveActionAt > this.ctx.engine.config.roundMs
      ) {
        member.character.removeEffect("spell:evoke-rage");
        this.ctx.say(`${member.character.name}'s rage ends when they fail to attack.`, "#a0a4b0");
      }
    }
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
      if (m.spellCastOutCasterId) {
        const seer = this.party.aliveMembers().find((member) => member.character.id === m.spellCastOutCasterId);
        const active = seer?.character.effects.some((effect) => effect.id === "focus:cast-out");
        if (!seer || !active) {
          m.spellCastOutCasterId = null;
        } else if (Phaser.Math.Distance.Between(m.x, m.y, seer.x, seer.y) < NEAR_PX) {
          m.updateAi(delta, null);
          m.setVelocityX(m.x < seer.x ? -m.speed : m.speed);
          continue;
        }
      }
      // Target the nearest active party member; monsters see fine in the dark.
      const target = this.party
        .aliveMembers()
        .filter((member) => !hasCapability(member.character, "invisible") && !isHidden(member.character))
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
    if (dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime) && this.currentRoomId !== this.safeZoneId) {
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
        (zone) => Math.abs(zone.x - member.x) <= TILE * 1.5 && Math.abs(zone.y - member.y) <= TILE * 1.5,
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
          if (hasHook(c.effects, "moraleImmune")) {
            state.rescueTargetId = dying.character.id;
            this.ctx.say(`${c.name} charges through fear to help ${dying.character.name}!`, "#70d070");
            continue;
          }
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

      // 2. Priest / Seer: Turn Undead (works with torch & shield out!) or mend wounded allies (stows shield for divine casting).
      const isPriest = getBaseRole(c.className) === "priest";
      if (isPriest && m.canSwing()) {
        const undeadNear = this.monsters.find(
          (mon) => mon.aliveInFight && mon.def.undead && zoneBetween(m, mon) !== "beyond",
        );
        const turnIdx = c.knownSpells.findIndex(
          (k) => k.spellId === "turn-undead" && k.status === "available" && !k.requiresAtonement,
        );
        if (undeadNear && turnIdx >= 0) {
          m.spellIndex = turnIdx;
          const result = castSelectedSpell(this.spellDeps(), m, undeadNear);
          if (result) {
            c.removeEffect("potion:invisibility");
            this.resolveKnownCastResult(m, result);
          }
          continue;
        }

        const wounded = this.party.members.find(
          (p) =>
            !p.character.dead &&
            (p.character.dying !== null || p.character.hp < p.character.maxHp / 2) &&
            zoneBetween(m, p) !== "beyond",
        );
        if (wounded && this.selectHighestSpell(m)) {
          if (c.carriedShield && !c.shieldStowed) {
            c.shieldStowed = true;
          }
          const result = castSelectedSpell(this.spellDeps(), m);
          if (result) {
            c.removeEffect("potion:invisibility");
            this.resolveKnownCastResult(m, result);
          }
          continue; // Focuses on healing/support; refrains from melee attack this round
        }
      }

      // 3. Wizard / Witch: cast spells at boss OR when > 1 monster on screen & in light bubble, always casting highest damaging spell.
      if (getBaseRole(c.className) === "wizard" && m.canSwing()) {
        const illuminatedMonsters = this.monsters.filter(
          (mon) =>
            mon.aliveInFight &&
            this.light.levelAt(mon.x, mon.y) !== "dark" &&
            Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= FAR_PX,
        );
        const boss = illuminatedMonsters.find((mon) => mon.def.leader === true && mon.aiState === "aggro") ||
          this.monsters.find(
            (mon) =>
              mon.aliveInFight &&
              mon.def.leader === true &&
              mon.aiState === "aggro" &&
              Phaser.Math.Distance.Between(m.x, m.y, mon.x, mon.y) <= FAR_PX,
          );

        // Cast spell at boss OR when > 1 monster on screen in light bubble
        if (boss || illuminatedMonsters.length > 1) {
          const target = boss || illuminatedMonsters[0];
          const idx = highestAvailableDamagingSpellIndex(m.character);
          if (idx >= 0) {
            m.spellIndex = idx;
            if (target) {
              m.facing = target.x >= m.x ? 1 : -1;
              m.setFlipX(m.facing === -1);
            }
            const result = castSelectedSpell(this.spellDeps(), m, target);
            if (result) {
              c.removeEffect("potion:invisibility");
              this.resolveKnownCastResult(m, result);
            }
          }
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
        const outcome = meleeSwing(this.meleeDeps(), m);
        if (outcome.swung) {
          cancelShieldWall(m.character);
          m.character.removeEffect("potion:invisibility");
        }
        if (outcome.damage !== undefined) {
          const flourish = triggerFlourish(m.character, this.ctx.engine.dice);
          if (flourish) floatText(this, m.x, m.y - 38, `+${flourish.healed} FLOURISH`, "#72d887", 12);
        }
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
          if (mark) {
            const wasReady = m.canSwing();
            rangedShot(this.meleeDeps(), m, mark, bow);
            if (wasReady) m.character.removeEffect("potion:invisibility");
          }
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

      if (def.id === "coins") {
        const partySize = this.party.aliveMembers().length;
        const currentCoinSlots = partyCoinSlots(this.ctx.totalCoins, partySize);
        const newCoinSlots = partyCoinSlots(this.ctx.totalCoins + p.qty, partySize);
        const extraSlotsNeeded = newCoinSlots - currentCoinSlots;
        const leader = this.party.leader;

        if (extraSlotsNeeded > 0 && leader && leader.character.inventory.slotsFree() < extraSlotsNeeded) {
          this.ctx.say(`Party gear slots are full! (Coins left behind)`, "#d07070");
          continue;
        }

        const pxCoord = p.sprite.x;
        const pyCoord = p.sprite.y;
        p.sprite.destroy();
        sfx.pickupChime(false, this.spatial({ x: pxCoord, y: pyCoord }));
        sparkleBurst(this, pxCoord, pyCoord, false);

        const xp = this.ctx.bankCoins(p.qty);
        // Collected coin is both XP (bankCoins, above) and spendable money.
        this.ctx.earnGold(p.qty);
        const label = `${p.qty} coins`;
        if (xp > 0) {
          floatText(this, collector.x, collector.y - 24, `${label} +${xp} XP`, "#e8c840");
          for (const m of this.party.members) {
            if (!m.character.dead) this.ctx.engine.awardXp(m.character, xp);
          }
          this.ctx.say(`Treasure! ${label} — party gains ${xp} XP.`, "#e8c840");
        } else {
          floatText(this, collector.x, collector.y - 24, `+${p.qty} coins`, "#e8c840");
        }
        continue;
      }

      if (!collector.character.inventory.canAdd(def, p.qty)) {
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
      const xp = def.xpValue ?? 0;
      const label = p.qty > 1 ? `${p.qty} ${def.name}` : def.name;
      if (xp > 0) {
        floatText(this, collector.x, collector.y - 24, `${label} +${xp} XP`, "#e8c840");
        for (const m of this.party.members) {
          if (!m.character.dead) this.ctx.engine.awardXp(m.character, xp);
        }
        this.ctx.say(`Treasure! ${label} — party gains ${xp} XP.`, "#e8c840");
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

  /**
   * Float a small tally above each character showing how many danger-track
   * fails they carry this zone. Cleared when the tally resets in shelter or the
   * character dies.
   */
  private updateDangerMarkers(): void {
    const rule = dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime);
    for (const m of this.party.members) {
      const id = m.character.id;
      const fails = this.dangerFails.get(id) ?? 0;
      const marker = this.dangerMarkers.get(id);
      if (rule && fails > 0 && !m.character.dead) {
        const text = rule.icon.repeat(fails);
        if (marker) {
          marker.setPosition(m.x, m.y - 46).setText(text).setVisible(true);
        } else {
          this.dangerMarkers.set(
            id,
            this.add
              .text(m.x, m.y - 46, text, {
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#ff9c4a",
                stroke: "#000",
                strokeThickness: 3,
                resolution: RENDER_SCALE,
              })
              .setOrigin(0.5, 1)
              .setDepth(949),
          );
        }
      } else if (marker) {
        marker.setVisible(false);
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
        this.modes.set("gameover");
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
      zone: this.activeZone,
      vaultsInScroll: this.vaultsInScroll,
      vaultsCompletedInScroll: this.vaultsCompletedInScroll,
      skinHistoryInScroll: [...this.skinHistoryInScroll],
      skinId: this.visualSkin?.id,
      roomId: this.currentRoomId,
      activatedRequirementIds: [...this.activatedRequirements],
      openedConnectorIds: [...this.openedConnectors],
      npcInteractionStates: Object.fromEntries(this.npcInteractionStates),
      discoveredRoomIds: [...this.discoveredRoomIds],
      dangerFails: dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime) ? Object.fromEntries(this.dangerFails) : undefined,
      dangerDistancePx: dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime) ? this.dangerDistancePx : undefined,
      dangerKillPending: dangerRuleForSkin(this.visualSkin?.id, this.openSkyDaytime) ? this.dangerKillPending : undefined,
      hasCrown: this.hasCrown,
      kills: this.ctx.kills,
      coinsBanked: this.ctx.totalCoins,
      spendableGold: this.ctx.spendableGold,
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
      const runSeed = this.registry.get("runSeed") ?? 0;
      let chosenZone = this.activeZone;
      let nextVaultsInScroll = this.vaultsInScroll;
      let nextVaultsCompleted = this.vaultsCompletedInScroll + 1;
      let nextSkinHistory = [...this.skinHistoryInScroll];

      if (this.biomeOffer) {
        // Scroll Destination completed! User chose next destination scroll
        chosenZone = this.biomeOffer.zones[this.biomeSelectionIndex]!;
        if (!chosenZone) throw new Error("Biome selection index is out of range");
        nextVaultsInScroll = rollVaultCountForScroll((runSeed + nextIndex) >>> 0);
        nextVaultsCompleted = 0;
        nextSkinHistory = [];
      }

      // Descending to the next dungeon levels every surviving party member once.
      this.grantDescentLevels();
      const survivors = this.party.members
        .map((member) => serializeCharacter(member.character))
        .filter((member) => !member.dead);
      const nextState = nextDungeonSave(
        {
          coinsBanked: this.ctx.totalCoins,
          spendableGold: this.ctx.spendableGold,
          messages: [...this.ctx.messages],
          runSeed,
        },
        dungeonIndex,
        survivors,
        chosenZone,
        nextVaultsInScroll,
        nextVaultsCompleted,
        nextSkinHistory,
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
