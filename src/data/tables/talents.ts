/**
 * Class talent tables (2d6, rolled at level-up). Entry text is original
 * paraphrase; effects are structured hooks the engine applies directly.
 */

import type { RollableTable } from "../../engine";

export const FIGHTER_TALENTS: RollableTable = {
  id: "fighter-talents",
  name: "Fighter Talents",
  dice: "2d6",
  entries: [
    {
      min: 2,
      max: 2,
      text: "Gain Weapon Mastery with one additional weapon type: +1 to attack and damage",
      effects: [
        { kind: "checkBonus", applies: "attack", bonus: 1 },
        { kind: "damageBonus", bonus: 1 },
      ],
    },
    {
      min: 3,
      max: 6,
      text: "+1 to melee and ranged attacks",
      effects: [{ kind: "checkBonus", applies: "attack", bonus: 1 }],
    },
    {
      min: 7,
      max: 9,
      text: "+2 to Strength, Dexterity, or Constitution stat",
      effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON"], bonus: 2 }],
    },
    {
      min: 10,
      max: 11,
      text: "Choose one kind of armor. You get +1 AC from that armor",
      effects: [{ kind: "armorAcBonusChoice", bonus: 1 }],
    },
    {
      min: 12,
      max: 12,
      text: "Choose a talent or +2 points to distribute to stats",
      effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON"], bonus: 2 }],
    },
  ],
};

export const THIEF_TALENTS: RollableTable = {
  id: "thief-talents",
  name: "Thief Talents",
  dice: "2d6",
  entries: [
    {
      min: 2,
      max: 2,
      text: "Killer's eye: crit on 19-20",
      effects: [{ kind: "critRange", value: 19 }],
    },
    {
      min: 3,
      max: 6,
      text: "Wary step: +1 to stat checks",
      effects: [{ kind: "checkBonus", applies: "stat", bonus: 1 }],
    },
    {
      min: 7,
      max: 9,
      text: "Cat-quick: +2 Dexterity",
      effects: [{ kind: "statBonus", stat: "DEX", bonus: 2 }],
    },
    {
      min: 10,
      max: 11,
      text: "Opportunist: +1 to attack rolls",
      effects: [{ kind: "checkBonus", applies: "attack", bonus: 1 }],
    },
    {
      min: 12,
      max: 12,
      text: "Shadow dancer: +1 AC and +1 to stat checks",
      effects: [
        { kind: "acBonus", bonus: 1 },
        { kind: "checkBonus", applies: "stat", bonus: 1 },
      ],
    },
  ],
};

export const PRIEST_TALENTS: RollableTable = {
  id: "priest-talents",
  name: "Priest Talents",
  dice: "2d6",
  entries: [
    {
      min: 2,
      max: 2,
      text: "Chosen vessel: advantage on spellcasting",
      effects: [{ kind: "advantageOn", applies: "spellcast" }],
    },
    {
      min: 3,
      max: 6,
      text: "Fervent prayer: +1 to spellcasting checks",
      effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 1 }],
    },
    {
      min: 7,
      max: 9,
      text: "Blessed constitution: +2 Wisdom",
      effects: [{ kind: "statBonus", stat: "WIS", bonus: 2 }],
    },
    {
      min: 10,
      max: 11,
      text: "Shield of faith: +1 AC",
      effects: [{ kind: "acBonus", bonus: 1 }],
    },
    {
      min: 12,
      max: 12,
      text: "Saint's endurance: +4 max HP",
      effects: [{ kind: "maxHpBonus", bonus: 4 }],
    },
  ],
};

export const WIZARD_TALENTS: RollableTable = {
  id: "wizard-talents",
  name: "Wizard Talents",
  dice: "2d6",
  entries: [
    {
      min: 2,
      max: 2,
      text: "Conduit: advantage on spellcasting",
      effects: [{ kind: "advantageOn", applies: "spellcast" }],
    },
    {
      min: 3,
      max: 6,
      text: "Honed will: +1 to spellcasting checks",
      effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 1 }],
    },
    {
      min: 7,
      max: 9,
      text: "Keen mind: +2 Intelligence",
      effects: [{ kind: "statBonus", stat: "INT", bonus: 2 }],
    },
    {
      min: 10,
      max: 11,
      text: "Warded: +1 AC",
      effects: [{ kind: "acBonus", bonus: 1 }],
    },
    {
      min: 12,
      max: 12,
      text: "Archmage's spark: +2 to spellcasting checks",
      effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 2 }],
    },
  ],
};

export const PIT_FIGHTER_TALENTS: RollableTable = {
  id: "pit-fighter-talents", name: "Pit Fighter Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "1/day, ignore all damage and effects from one attack", effects: [{ kind: "resourceBonus", resource: "ignoreAttack", bonus: 1 }] },
    { min: 3, max: 6, text: "+1 to melee weapon damage", effects: [{ kind: "meleeDamageBonus", bonus: 1 }] },
    { min: 7, max: 9, text: "+2 to Strength or Constitution, or +1 to melee attacks", effects: [{ kind: "statBonusChoice", stats: ["STR", "CON"], bonus: 2 }] },
    { min: 10, max: 11, text: "Increase Flourish healing by 1d6", effects: [{ kind: "flourishExtraDie", bonus: 1 }] },
    { min: 12, max: 12, text: "Choose a talent or +2 points to distribute to stats", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], bonus: 2 }] },
  ],
};

export const SEA_WOLF_TALENTS: RollableTable = {
  id: "sea-wolf-talents", name: "Sea Wolf Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "1/day, go berserk: immune to damage for 3 rounds", effects: [{ kind: "resourceBonus", resource: "berserk", bonus: 1 }] },
    { min: 3, max: 6, text: "Attacks deal +1 damage", effects: [{ kind: "damageBonus", bonus: 1 }] },
    { min: 7, max: 9, text: "+2 to Strength or Constitution, or +1 to attacks", effects: [{ kind: "statBonusChoice", stats: ["STR", "CON"], bonus: 2 }] },
    { min: 10, max: 11, text: "Duality: choose two different Old Gods effects each day", effects: [{ kind: "oldGodDuality" }] },
    { min: 12, max: 12, text: "Choose a talent or +2 points to distribute to stats", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], bonus: 2 }] },
  ],
};

export const RAS_GODAI_TALENTS: RollableTable = {
  id: "ras-godai-talents", name: "Ras-Godai Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Trained in the use of poisons", effects: [] },
    { min: 3, max: 6, text: "Roll an additional Black Lotus talent", talent: [{ kind: "rollTable", tableId: "black-lotus-talents", count: 1 }] },
    { min: 7, max: 9, text: "+2 to Strength or Dexterity, or +1 to melee attacks", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX"], bonus: 2 }] },
    { min: 10, max: 11, text: "Gain an additional use of Smoke Step", effects: [{ kind: "resourceBonus", resource: "smokeStep", bonus: 1 }] },
    { min: 12, max: 12, text: "Choose a talent or +2 points to distribute to stats", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], bonus: 2 }] },
  ],
};

const WITCH_SPELLS = [
  { id: "cauldron", tier: 1 }, { id: "witchlight", tier: 1 }, { id: "fog", tier: 1 },
  { id: "spidersilk", tier: 2 }, { id: "cats-eye", tier: 2 }, { id: "bogboil", tier: 2 },
  { id: "howl", tier: 3 }, { id: "broomstick", tier: 3 }, { id: "speak-with-dead", tier: 3 },
] as const;

const SEER_SPELLS = [
  { id: "chant", tier: 1 }, { id: "trance", tier: 1 }, { id: "seer-potion", tier: 1 }, { id: "evoke-rage", tier: 1 },
  { id: "fate", tier: 2 }, { id: "read-runes", tier: 2 }, { id: "cast-out", tier: 3 }, { id: "wolfshape", tier: 3 },
] as const;

export const WITCH_TALENTS: RollableTable = {
  id: "witch-talents", name: "Witch Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "1/day, teleport to your familiar's location as a move", effects: [{ kind: "resourceBonus", resource: "familiarTeleport", bonus: 1 }] },
    { min: 3, max: 7, text: "+2 to Charisma or +1 to witch spellcasting checks", effects: [{ kind: "statBonus", stat: "CHA", bonus: 2 }] },
    { min: 8, max: 9, text: "Gain advantage on casting one spell you know", talent: [{ kind: "advantageKnownSpell" }] },
    { min: 10, max: 11, text: "Learn an additional witch spell of any tier you can cast", talent: [{ kind: "learnSpell", spells: WITCH_SPELLS }] },
    { min: 12, max: 12, text: "Choose a talent or +2 points to distribute to stats", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], bonus: 2 }] },
  ],
};

export const SEER_TALENTS: RollableTable = {
  id: "seer-talents", name: "Seer Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Learn an additional seer spell from any tier you can cast", talent: [{ kind: "learnSpell", spells: SEER_SPELLS }] },
    { min: 3, max: 6, text: "Gain an additional use of Omen each day", effects: [{ kind: "resourceBonus", resource: "omen", bonus: 1 }] },
    { min: 7, max: 9, text: "+2 to Wisdom or Charisma, or +1 to spellcasting checks", effects: [{ kind: "statBonusChoice", stats: ["WIS", "CHA"], bonus: 2 }] },
    { min: 10, max: 11, text: "Increase Destined die category by one", effects: [{ kind: "destinedDieStep", bonus: 1 }] },
    { min: 12, max: 12, text: "Choose a talent or +2 points to distribute to stats", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], bonus: 2 }] },
  ],
};

export const BLACK_LOTUS_TALENTS: RollableTable = {
  id: "black-lotus-talents", name: "Black Lotus Talents", dice: "1d12", entries: [
    { min: 1, max: 1, text: "Gain two Black Lotus talents", talent: [{ kind: "rollTable", tableId: "black-lotus-talents", count: 2 }] },
    { min: 2, max: 2, text: "1/day, paralyze a damaged target of level 9 or less for 1d4 rounds", effects: [{ kind: "resourceBonus", resource: "paralyze", bonus: 1 }] },
    { min: 3, max: 3, text: "Advantage on Dexterity checks to avoid entrapment or injury", effects: [{ kind: "advantageOnStat", stat: "DEX" }] },
    { min: 4, max: 4, text: "+1 AC while wielding a melee weapon in each hand", effects: [{ kind: "dualWieldAcBonus", bonus: 1 }] },
    { min: 5, max: 5, text: "Gain an additional hit points die", talent: [{ kind: "gainHitDie", dice: "1d6" }] },
    { min: 6, max: 6, text: "Deal triple damage with Assassin", effects: [{ kind: "assassinDamageMultiplier", value: 3 }] },
    { min: 7, max: 7, text: "Visible enemies make morale checks against DC 18", effects: [{ kind: "enemyMoraleDcMinimum", value: 18 }] },
    { min: 8, max: 8, text: "1/day, walk on water for 1d4 rounds", effects: [{ kind: "resourceBonus", resource: "waterWalk", bonus: 1 }] },
    { min: 9, max: 9, text: "1/day, put a living creature of level 5 or less within near to sleep (DC 15 CON)", effects: [{ kind: "resourceBonus", resource: "sleep", bonus: 1 }] },
    { min: 10, max: 10, text: "1/day, walk on sheer surfaces for 1d4 rounds", effects: [{ kind: "resourceBonus", resource: "wallWalk", bonus: 1 }] },
    { min: 11, max: 11, text: "+1 melee weapon damage", effects: [{ kind: "meleeDamageBonus", bonus: 1 }] },
    { min: 12, max: 12, text: "1/day, become unseen and unheard by a creature of level 9 or less (DC 15 WIS)", effects: [{ kind: "resourceBonus", resource: "unseen", bonus: 1 }] },
  ],
};
