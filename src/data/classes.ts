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
    startsWithShield: true,
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
  {
    name: "pit-fighter",
    displayName: "Pit Fighter",
    hitDie: "1d8",
    startingWeaponId: "longsword",
    armorId: "leather-armor",
    startsWithShield: true,
    talentTableId: "pit-fighter-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-pit-fighter-flourish",
        name: "Flourish: regain 1d6 HP on melee hit (3/day)",
        hooks: [],
      },
      {
        id: "feat-pit-fighter-implacable",
        name: "Implacable: advantage on CON checks to resist injury/poison",
        hooks: [{ kind: "advantageOnStat", stat: "CON" }],
      },
      { id: "feat-pit-fighter-last-stand", name: "Last Stand: rise from dying on 18-20", hooks: [] },
      { id: "feat-pit-fighter-relentless", name: "Relentless: 3/day DC 18 CON to remain at 1 HP", hooks: [] },
    ],
  },
  {
    name: "sea-wolf",
    displayName: "Sea Wolf",
    hitDie: "1d8",
    startingWeaponId: "spear",
    armorId: "chainmail",
    startsWithShield: true,
    talentTableId: "sea-wolf-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-sea-wolf-shield-wall",
        name: "Shield Wall: AC becomes 20 in defensive stance with a shield",
        hooks: [],
      },
      {
        id: "feat-sea-wolf-seafarer",
        name: "Seafarer: advantage on navigation and boating",
        hooks: [{ kind: "seafarer" }],
      },
      { id: "feat-sea-wolf-old-gods", name: "Old Gods: choose Odin, Freya, or Loki each day", hooks: [] },
    ],
  },
  {
    name: "ras-godai",
    displayName: "Ras-Godai",
    hitDie: "1d6",
    startingWeaponId: "dagger",
    armorId: "leather-armor",
    startsWithShield: false,
    talentTableId: "ras-godai-talents",
    startingSpellIds: [],
    features: [
      {
        id: "feat-ras-godai-assassin",
        name: "Assassin: advantage on stealth/hiding, double damage vs unaware targets",
        hooks: [{ kind: "advantageOn", applies: "stealth" }],
      },
      { id: "feat-ras-godai-smoke-step", name: "Smoke Step: teleport within near 3/day without an action", hooks: [] },
    ],
  },
  {
    name: "witch",
    displayName: "Witch",
    hitDie: "1d4",
    startingWeaponId: "staff",
    armorId: "leather-armor",
    startsWithShield: false,
    talentTableId: "witch-talents",
    castStat: "CHA",
    startingSpellIds: ["cauldron", "witchlight", "fog"],
    features: [
      {
        id: "feat-witch-familiar",
        name: "Familiar: small loyal animal serves as spellcasting origin",
        hooks: [],
      },
    ],
  },
  {
    name: "seer",
    displayName: "Seer",
    hitDie: "1d6",
    startingWeaponId: "staff",
    armorId: "leather-armor",
    startsWithShield: false,
    talentTableId: "seer-talents",
    castStat: "WIS",
    startingSpellIds: ["chant"],
    features: [
      {
        id: "feat-seer-destined",
        name: "Destined: add 1d6 when spending luck tokens",
        hooks: [],
      },
      { id: "feat-seer-omen", name: "Omen: 3/day, DC 9 WIS to gain a Luck token", hooks: [] },
    ],
  },
];

const CLASSES = new Map(CLASS_LIST.map((c) => [c.name, c]));

export function classDef(name: ClassName): ClassDef {
  const def = CLASSES.get(name);
  if (!def) throw new Error(`Unknown class "${name}"`);
  return def;
}
