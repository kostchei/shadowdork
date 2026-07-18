import type { ClassName, Effect, StatName } from "../engine";

export interface ClassDef {
  name: ClassName;
  displayName: string;
  hitDie: string;
  startingWeaponId: string;
  /** Starting armor kit: worn armor id (null = unarmored) and optional shield. */
  armorId: string | null;
  startsWithShield: boolean;
  talentTableId: string;
  castStat?: StatName;
  startingSpellIds: readonly string[];
  /** Baseline class features as permanent effect hooks. */
  features: readonly Effect[];
}

const CLASS_LIST: readonly ClassDef[] = [
  {
    name: "fighter",
    displayName: "Fighter",
    hitDie: "1d8",
    startingWeaponId: "spear",
    armorId: "chainmail",
    startsWithShield: false,
    talentTableId: "fighter-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-fighter-weapon-mastery",
        name: "Weapon Mastery: +1 to attack and damage, +half level to attack and damage",
        hooks: [
          { kind: "checkBonus", applies: "attack", bonus: 1 },
          { kind: "checkBonusHalfLevel", applies: "attack" },
          { kind: "damageBonus", bonus: 1 },
          { kind: "damageBonusHalfLevel" },
        ],
      },
    ],
  },
  {
    name: "thief",
    displayName: "Thief",
    hitDie: "1d4",
    startingWeaponId: "dagger",
    armorId: "leather-armor",
    startsWithShield: false,
    talentTableId: "thief-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-thief-nimble",
        name: "Nimble: advantage on initiative",
        hooks: [{ kind: "advantageOn", applies: "initiative" }],
      },
    ],
  },
  {
    name: "priest",
    displayName: "Priest",
    hitDie: "1d6",
    startingWeaponId: "mace",
    armorId: "chainmail",
    startsWithShield: true,
    talentTableId: "priest-talents",
    castStat: "WIS",
    startingSpellIds: ["cure-wounds", "light", "turn-undead"],
    features: [],
  },
  {
    name: "wizard",
    displayName: "Wizard",
    hitDie: "1d4",
    startingWeaponId: "staff",
    armorId: null,
    startsWithShield: false,
    talentTableId: "wizard-talents",
    castStat: "INT",
    startingSpellIds: ["magic-missile", "burning-hands", "mage-armor"],
    features: [],
  },
];

const CLASSES = new Map(CLASS_LIST.map((c) => [c.name, c]));

export function classDef(name: ClassName): ClassDef {
  const def = CLASSES.get(name);
  if (!def) throw new Error(`Unknown class "${name}"`);
  return def;
}
