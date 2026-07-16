import type { ClassName, Effect, StatName, Stats } from "../engine";

export interface ClassDef {
  name: ClassName;
  displayName: string;
  hitDie: string;
  baseAc: number;
  weaponId: string;
  talentTableId: string;
  castStat?: StatName;
  startingSpellIds: readonly string[];
  /** Baseline class features as permanent effect hooks. */
  features: readonly Effect[];
  /** Fixed starting array (3d6-down-the-line flavor without the swing). */
  startingStats: Stats;
  startingMaxHp: number;
}

const CLASS_LIST: readonly ClassDef[] = [
  {
    name: "fighter",
    displayName: "Fighter",
    hitDie: "1d8",
    baseAc: 15,
    weaponId: "longsword",
    talentTableId: "fighter-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-fighter-weapon-training",
        name: "Weapon training: +1 to attacks",
        hooks: [{ kind: "checkBonus", applies: "attack", bonus: 1 }],
      },
    ],
    startingStats: { STR: 16, DEX: 12, CON: 14, INT: 9, WIS: 10, CHA: 11 },
    startingMaxHp: 10,
  },
  {
    name: "thief",
    displayName: "Thief",
    hitDie: "1d4",
    baseAc: 13,
    weaponId: "dagger",
    talentTableId: "thief-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-thief-nimble",
        name: "Nimble: advantage on initiative",
        hooks: [{ kind: "advantageOn", applies: "initiative" }],
      },
    ],
    startingStats: { STR: 10, DEX: 16, CON: 12, INT: 12, WIS: 11, CHA: 13 },
    startingMaxHp: 6,
  },
  {
    name: "priest",
    displayName: "Priest",
    hitDie: "1d6",
    baseAc: 14,
    weaponId: "mace",
    talentTableId: "priest-talents",
    castStat: "WIS",
    startingSpellIds: ["cure-wounds", "light", "turn-undead"],
    features: [],
    startingStats: { STR: 12, DEX: 10, CON: 12, INT: 11, WIS: 16, CHA: 13 },
    startingMaxHp: 8,
  },
  {
    name: "wizard",
    displayName: "Wizard",
    hitDie: "1d4",
    baseAc: 10,
    weaponId: "staff",
    talentTableId: "wizard-talents",
    castStat: "INT",
    startingSpellIds: ["magic-missile", "burning-hands", "mage-armor"],
    features: [],
    startingStats: { STR: 9, DEX: 12, CON: 11, INT: 16, WIS: 12, CHA: 10 },
    startingMaxHp: 5,
  },
];

const CLASSES = new Map(CLASS_LIST.map((c) => [c.name, c]));

export function classDef(name: ClassName): ClassDef {
  const def = CLASSES.get(name);
  if (!def) throw new Error(`Unknown class "${name}"`);
  return def;
}
