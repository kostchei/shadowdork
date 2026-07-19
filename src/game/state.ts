import type {
  Alignment,
  Character,
  DyingState,
  Effect,
  Engine,
  KnownSpell,
  Stats,
  VoiceRegister,
} from "../engine";
import { Character as EngineCharacter } from "../engine";
import { item } from "../data";
import type { VisualSkinId, ZonePackId } from "./visual/model";

export interface SavedInventoryItem {
  itemId: string;
  qty: number;
}

export interface SavedCharacter {
  id: string;
  name: string;
  className: string;
  /** Optional for backward compatibility with saves created before character identity data. */
  alignment?: Alignment;
  ancestry?: string;
  /** Optional for backward compatibility with saves created before character voices. */
  voiceRegister?: VoiceRegister;
  stats: Stats;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  knownSpells: KnownSpell[];
  effects: Effect[];
  inventory: SavedInventoryItem[];
  wornArmorId: string | null;
  wieldedWeaponId: string | null;
  carriedShieldId: string | null;
  shieldStowed: boolean;
  luckToken: boolean;
  dying: DyingState | null;
  dead: boolean;
}

export interface SaveSlot {
  slotId: number;
  timestamp: number;
  dungeonIndex: number;
  /** Stable layout seed for this expedition; absent in saves from before procedural runs. */
  runSeed?: number;
  /** The cursed-scroll biome the party is currently in; absent in saves from before biome choice. */
  zone?: ZonePackId;
  /** The specific visual skin resolved within that scroll for this dungeon. */
  skinId?: VisualSkinId;
  /** Region id of the room last occupied, e.g. "room-3" or "sanctuary". */
  roomId?: string;
  /** @deprecated Legacy 1-based room index (1-6); read only to migrate old saves. */
  currentRoom?: number;
  /** Requirements acquired or switches activated in the current non-linear layout. */
  activatedRequirementIds?: string[];
  /** Non-linear connector ids opened, revealed, or broken during this run. */
  openedConnectorIds?: string[];
  /** Deterministic talkable-NPC conversation progress keyed by NPC id. */
  npcInteractionStates?: Record<string, "unmet" | "heard" | "resolved" | "hostile-npc" | "hostile-allies" | "departed">;
  /** Stable ids of rooms revealed on the compact expedition map. */
  discoveredRoomIds?: string[];
  /** Remaining real-time pressure in open terrain; absent for older saves and enclosed dungeons. */
  survivalRemainingMs?: number;
  /** Open-terrain danger track and progress toward its next travel-and-kill trigger. */
  dangerFlags?: number;
  dangerChecks?: number;
  dangerDistancePx?: number;
  dangerKillPending?: boolean;
  hasCrown: boolean;
  kills: number;
  coinsBanked: number;
  party: SavedCharacter[];
  rescuedIds: string[]; // Classes of characters already rescued
  messages: { text: string; color: string }[];
}

export function serializeCharacter(c: Character): SavedCharacter {
  const inventory: SavedInventoryItem[] = c.inventory.all().map((stack) => ({
    itemId: stack.def.id,
    qty: stack.qty,
  }));

  return {
    id: c.id,
    name: c.name,
    className: c.className,
    alignment: c.alignment,
    ancestry: c.ancestry,
    voiceRegister: c.voiceRegister,
    stats: c.stats,
    level: c.level,
    xp: c.xp,
    hp: c.hp,
    maxHp: c.maxHp, // Character.maxHp includes effects, but constructor sets baseMaxHp
    knownSpells: c.knownSpells.map((s) => ({ ...s })),
    effects: c.effects.map((e) => ({ ...e })),
    inventory,
    wornArmorId: c.wornArmor?.id ?? null,
    wieldedWeaponId: c.wieldedWeapon?.id ?? null,
    carriedShieldId: c.carriedShield?.id ?? null,
    shieldStowed: c.shieldStowed,
    luckToken: c.luckToken,
    dying: c.dying ? { ...c.dying } : null,
    dead: c.dead,
  };
}

export function deserializeCharacter(state: SavedCharacter, engine: Engine): Character {
  const c = new EngineCharacter({
    id: state.id,
    name: state.name,
    className: state.className as any,
    alignment: state.alignment ?? "neutral",
    ancestry: state.ancestry ?? "human",
    voiceRegister: state.voiceRegister,
    stats: state.stats,
    maxHp: state.hp, // Set initial hp to prevent maxHp calculation issues during init
  });

  // Re-assign correct levels, base max Hp, and other values
  c.level = state.level;
  c.xp = state.xp;
  (c as any).baseMaxHp = state.maxHp;
  c.hp = state.hp;
  c.luckToken = state.luckToken;
  c.dead = state.dead;
  c.dying = state.dying ? { ...state.dying } : null;
  c.knownSpells = state.knownSpells.map((s) => ({ ...s }));
  c.effects = state.effects.map((e) => ({ ...e }));
  c.shieldStowed = state.shieldStowed;

  // Restore inventory
  for (const itemState of state.inventory) {
    c.inventory.add(item(itemState.itemId), itemState.qty, true);
  }

  // Restore equipment
  if (state.wornArmorId) c.wornArmor = item(state.wornArmorId);
  if (state.wieldedWeaponId) c.wieldedWeapon = item(state.wieldedWeaponId);
  if (state.carriedShieldId) c.carriedShield = item(state.carriedShieldId);

  return c;
}
