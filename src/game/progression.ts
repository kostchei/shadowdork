import { getBaseRole, type Alignment, type ClassName } from "../engine";
import { characterTitle } from "../engine";
import type { SaveSlot, SavedCharacter } from "./state";
import type { VisualSkinId, ZonePackId } from "./visual/model";
import { resolveSkinForZone } from "./visual/skins";
import { classDef, plebNameForSeed, spellsForClass } from "../data";
import { resolveClassForZone } from "./systems/companion";

export type RewardKind = "companion" | "magic-weapon" | "magic-armor" | "gold" | "spells";

export interface PartyProgress {
  name?: string;
  className: string;
  level: number;
  knownSpellIds: readonly string[];
  dead?: boolean;
}

export interface CompanionReward {
  kind: "companion";
  title: string;
  description: string;
  className: ClassName;
  name: string;
  alignment: Alignment;
}

export interface ItemReward {
  kind: "magic-weapon" | "magic-armor";
  title: string;
  description: string;
  itemId: "starfall-blade" | "aegis-mail";
}

export interface GoldReward {
  kind: "gold";
  title: string;
  description: string;
  amount: 500;
}

export interface SpellReward {
  kind: "spells";
  title: string;
  description: string;
  spellId: string;
  className: "wizard" | "priest";
}

export type DungeonReward = CompanionReward | ItemReward | GoldReward | SpellReward;

const REWARD_CYCLE: readonly RewardKind[] = [
  "companion",
  "magic-weapon",
  "magic-armor",
  "gold",
  "spells",
];

const COMPANION_CLASSES = ["thief", "priest", "wizard"] as const;

const STARTING_SPELLS: Record<"wizard" | "priest", readonly string[]> = {
  wizard: classDef("wizard").startingSpellIds,
  priest: classDef("priest").startingSpellIds,
};

/** Shadowdark unlock bands: tiers 1-5 arrive at levels 1, 3, 5, 7, and 9. */
export function maximumSpellTier(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error("Caster level must be a positive integer");
  return Math.min(5, Math.ceil(level / 2));
}

function stableIndex(seed: number, size: number): number {
  if (size < 1) throw new Error("Cannot choose from an empty reward pool");
  let value = (seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) % size;
}

function missingCompanion(
  party: readonly PartyProgress[],
  dungeonIndex: number,
  zone?: ZonePackId,
): CompanionReward | null {
  const missing = COMPANION_CLASSES.filter(
    (baseRole) => !party.some((member) => !member.dead && getBaseRole(member.className as ClassName) === baseRole),
  );
  if (missing.length === 0) return null;
  const partySalt = party.reduce((acc, m, i) => acc + m.className.charCodeAt(0) * (i + 1), 0);
  const pickIndex = stableIndex(dungeonIndex * 1337 + partySalt + 42, missing.length);
  const baseRole = missing[pickIndex]!;
  const roll50 = stableIndex(dungeonIndex * 773 + partySalt + 19, 100) < 50;
  const className = resolveClassForZone(baseRole, zone, roll50);
  const usedNames = new Set(party.flatMap((member) => member.name ? [member.name] : []));
  const name = plebNameForSeed(dungeonIndex * 977 + stableIndex(dungeonIndex + 31, 997), usedNames);
  const alignmentRoll = stableIndex(dungeonIndex * 131 + 17, 6) + 1;
  const alignment: Alignment = alignmentRoll <= 3 ? "law" : alignmentRoll <= 5 ? "neutral" : "chaos";
  const title = characterTitle(className, alignment, 1);
  return {
    kind: "companion",
    title: `${name} the ${title}`,
    description: `${name} joins the surviving party for future dungeons.`,
    className,
    name,
    alignment,
  };
}

function unknownSpell(party: readonly PartyProgress[], dungeonIndex: number): SpellReward | null {
  const casters = party.flatMap((member, partyIndex) => {
    const base = getBaseRole(member.className as ClassName);
    if (member.dead || (base !== "wizard" && base !== "priest")) return [];
    const className: "wizard" | "priest" = base;
    const firstDiscovery = member.knownSpellIds.every((id) => STARTING_SPELLS[className].includes(id));
    const maxTier = firstDiscovery ? 1 : maximumSpellTier(member.level);
    const eligible = spellsForClass(className).filter(
      (candidate) =>
        candidate.tier <= maxTier &&
        !STARTING_SPELLS[className].includes(candidate.id) &&
        !member.knownSpellIds.includes(candidate.id),
    );
    return eligible.length > 0 ? [{ member, partyIndex, className, eligible }] : [];
  });
  if (casters.length === 0) return null;

  const partySalt = party.reduce(
    (total, member, index) => total + member.level * (index + 3) + member.knownSpellIds.length * 17,
    0,
  );
  const caster = casters[stableIndex(dungeonIndex * 131 + partySalt, casters.length)]!;
  const chosen = caster.eligible[
    stableIndex(dungeonIndex * 977 + caster.partyIndex * 37 + caster.member.level, caster.eligible.length)
  ]!;
  return {
    kind: "spells",
    title: `${chosen.name} ${caster.className === "priest" ? "Litany" : "Grimoire"}`,
    description: `${caster.member.className === "priest" ? "The Cleric" : "The Wizard"} learns the tier ${chosen.tier} spell ${chosen.name}.`,
    spellId: chosen.id,
    className: caster.className,
  };
}

export function chooseDungeonReward(
  dungeonIndex: number,
  party: readonly PartyProgress[],
  zone?: ZonePackId,
): DungeonReward {
  if (!Number.isInteger(dungeonIndex)) throw new Error("Dungeon index must be an integer");
  const kind = REWARD_CYCLE[((dungeonIndex % REWARD_CYCLE.length) + REWARD_CYCLE.length) % REWARD_CYCLE.length]!;
  const companion = missingCompanion(party, dungeonIndex, zone);

  if (kind === "companion") {
    return companion ?? {
      kind: "gold",
      title: "The Deep Treasury",
      description: "The full party recovers 500 gold.",
      amount: 500,
    };
  }
  if (kind === "magic-weapon") {
    return {
      kind,
      title: "Starfall Blade",
      description: "A magical blade that strikes harder than mortal steel.",
      itemId: "starfall-blade",
    };
  }
  if (kind === "magic-armor") {
    return {
      kind,
      title: "Aegis Mail",
      description: "Weightless enchanted armour wearable by any adventurer.",
      itemId: "aegis-mail",
    };
  }
  if (kind === "gold") {
    return {
      kind,
      title: "The Deep Treasury",
      description: "A hoard of 500 gold.",
      amount: 500,
    };
  }

  return unknownSpell(party, dungeonIndex) ?? companion ?? {
    kind: "gold",
    title: "The Deep Treasury",
    description: "Every secret here is already known, so the vault yields 500 gold.",
    amount: 500,
  };
}

export function progressFromSavedParty(party: readonly SavedCharacter[]): PartyProgress[] {
  return party.map((member) => ({
    name: member.name,
    className: member.className,
    level: member.level,
    knownSpellIds: member.knownSpells.map((known) => known.spellId),
    dead: member.dead,
  }));
}

import { pickSkinForScrollRun } from "./biomeChoice";

export function nextDungeonSave(
  current: Pick<SaveSlot, "coinsBanked" | "spendableGold" | "messages" | "runSeed">,
  dungeonIndex: number,
  party: SavedCharacter[],
  chosenZone: ZonePackId,
  vaultsInScrollOrTs?: number,
  vaultsCompletedInScroll?: number,
  skinHistoryInScroll?: VisualSkinId[],
  timestamp = Date.now(),
): SaveSlot {
  let vaultsInScroll: number | undefined;
  let ts = timestamp;
  if (
    typeof vaultsInScrollOrTs === "number" &&
    vaultsCompletedInScroll === undefined &&
    skinHistoryInScroll === undefined &&
    vaultsInScrollOrTs > 100
  ) {
    ts = vaultsInScrollOrTs;
  } else {
    vaultsInScroll = vaultsInScrollOrTs;
  }

  const nextIndex = dungeonIndex + 1;
  const layoutSeed = ((current.runSeed ?? 0) + nextIndex) >>> 0;
  const skin = pickSkinForScrollRun(chosenZone, skinHistoryInScroll ?? [], layoutSeed);
  const updatedHistory = [...(skinHistoryInScroll ?? []), skin.id];
  return {
    ...current,
    slotId: 0,
    timestamp: ts,
    dungeonIndex: nextIndex,
    runSeed: current.runSeed,
    zone: chosenZone,
    vaultsInScroll,
    vaultsCompletedInScroll,
    skinHistoryInScroll: updatedHistory,
    skinId: skin.id,
    currentRoom: 1,
    hasCrown: false,
    kills: 0,
    party: party.filter((member) => !member.dead),
    rescuedIds: party.filter((member) => !member.dead).map((member) => member.className),
  };
}
