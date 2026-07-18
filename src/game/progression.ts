import type { SaveSlot, SavedCharacter } from "./state";

export type RewardKind = "companion" | "magic-weapon" | "magic-armor" | "gold" | "spells";

export interface PartyProgress {
  className: string;
  knownSpellIds: readonly string[];
  dead?: boolean;
}

export interface CompanionReward {
  kind: "companion";
  title: string;
  description: string;
  className: "thief" | "priest" | "wizard";
  name: string;
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
  spellId: "fireball" | "bless";
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

const COMPANIONS = [
  { className: "thief", name: "Vex" },
  { className: "priest", name: "Odessa" },
  { className: "wizard", name: "Milo" },
] as const;

const SPELL_REWARDS = [
  { className: "wizard", spellId: "fireball", title: "The Fireball Grimoire" },
  { className: "priest", spellId: "bless", title: "The Litany of Blessing" },
] as const;

function missingCompanion(party: readonly PartyProgress[], dungeonIndex: number): CompanionReward | null {
  const missing = COMPANIONS.filter(
    (candidate) => !party.some((member) => !member.dead && member.className === candidate.className),
  );
  if (missing.length === 0) return null;
  const companion = missing[Math.floor(dungeonIndex / REWARD_CYCLE.length) % missing.length]!;
  const role = companion.className === "priest" ? "Cleric" : `${companion.className[0]!.toUpperCase()}${companion.className.slice(1)}`;
  return {
    kind: "companion",
    title: `${companion.name}, ${role}`,
    description: `${companion.name} joins the surviving party for future dungeons.`,
    ...companion,
  };
}

function unknownSpell(party: readonly PartyProgress[], dungeonIndex: number): SpellReward | null {
  const candidates = SPELL_REWARDS.filter((candidate) => {
    const caster = party.find(
      (member) => !member.dead && member.className === candidate.className,
    );
    return caster && !caster.knownSpellIds.includes(candidate.spellId);
  });
  if (candidates.length === 0) return null;
  const chosen = candidates[dungeonIndex % candidates.length]!;
  return {
    kind: "spells",
    title: chosen.title,
    description: `${chosen.className === "priest" ? "The Cleric" : "The Wizard"} learns ${chosen.spellId === "fireball" ? "Fireball" : "Bless"}.`,
    spellId: chosen.spellId,
    className: chosen.className,
  };
}

export function chooseDungeonReward(
  dungeonIndex: number,
  party: readonly PartyProgress[],
): DungeonReward {
  if (!Number.isInteger(dungeonIndex)) throw new Error("Dungeon index must be an integer");
  const kind = REWARD_CYCLE[((dungeonIndex % REWARD_CYCLE.length) + REWARD_CYCLE.length) % REWARD_CYCLE.length]!;
  const companion = missingCompanion(party, dungeonIndex);

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
    className: member.className,
    knownSpellIds: member.knownSpells.map((known) => known.spellId),
    dead: member.dead,
  }));
}

export function nextDungeonSave(
  current: Pick<SaveSlot, "coinsBanked" | "messages">,
  dungeonIndex: number,
  party: SavedCharacter[],
  timestamp = Date.now(),
): SaveSlot {
  return {
    ...current,
    slotId: 0,
    timestamp,
    dungeonIndex: dungeonIndex + 1,
    currentRoom: 1,
    hasCrown: false,
    kills: 0,
    party: party.filter((member) => !member.dead),
    rescuedIds: party.filter((member) => !member.dead).map((member) => member.className),
  };
}
