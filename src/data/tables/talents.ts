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
    { min: 2, max: 2, text: "Crowd favorite: +2 max HP", effects: [{ kind: "maxHpBonus", bonus: 2 }] },
    { min: 3, max: 6, text: "Arena veteran: +1 melee attacks", effects: [{ kind: "checkBonus", applies: "attack", bonus: 1 }] },
    { min: 7, max: 9, text: "Iron body: +2 Strength or Constitution", effects: [{ kind: "statBonusChoice", stats: ["STR", "CON"], bonus: 2 }] },
    { min: 10, max: 11, text: "Scarred hide: +1 AC", effects: [{ kind: "acBonus", bonus: 1 }] },
    { min: 12, max: 12, text: "Unbreakable: +4 max HP", effects: [{ kind: "maxHpBonus", bonus: 4 }] },
  ],
};

export const SEA_WOLF_TALENTS: RollableTable = {
  id: "sea-wolf-talents", name: "Sea Wolf Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Boarding master: advantage on initiative", effects: [{ kind: "advantageOn", applies: "initiative" }] },
    { min: 3, max: 6, text: "Salt-hardened: +1 attacks", effects: [{ kind: "checkBonus", applies: "attack", bonus: 1 }] },
    { min: 7, max: 9, text: "Deck legs: +2 Strength or Dexterity", effects: [{ kind: "statBonusChoice", stats: ["STR", "DEX"], bonus: 2 }] },
    { min: 10, max: 11, text: "Shield brother: +1 AC", effects: [{ kind: "acBonus", bonus: 1 }] },
    { min: 12, max: 12, text: "Storm survivor: +4 max HP", effects: [{ kind: "maxHpBonus", bonus: 4 }] },
  ],
};

export const RAS_GODAI_TALENTS: RollableTable = {
  id: "ras-godai-talents", name: "Ras-Godai Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Killing eye: critical hits on 19-20", effects: [{ kind: "critRange", value: 19 }] },
    { min: 3, max: 6, text: "Venom hand: +1 attacks", effects: [{ kind: "checkBonus", applies: "attack", bonus: 1 }] },
    { min: 7, max: 9, text: "Sand shadow: +2 Dexterity", effects: [{ kind: "statBonus", stat: "DEX", bonus: 2 }] },
    { min: 10, max: 11, text: "Unseen step: advantage on stealth", effects: [{ kind: "advantageOn", applies: "stealth" }] },
    { min: 12, max: 12, text: "Perfect assassin: +1 AC and damage", effects: [{ kind: "acBonus", bonus: 1 }, { kind: "damageBonus", bonus: 1 }] },
  ],
};

export const WITCH_TALENTS: RollableTable = {
  id: "witch-talents", name: "Witch Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Patron's conduit: advantage on spellcasting", effects: [{ kind: "advantageOn", applies: "spellcast" }] },
    { min: 3, max: 6, text: "Black tongue: +1 spellcasting", effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 1 }] },
    { min: 7, max: 9, text: "Beguiling presence: +2 Charisma", effects: [{ kind: "statBonus", stat: "CHA", bonus: 2 }] },
    { min: 10, max: 11, text: "Familiar's warning: +1 AC", effects: [{ kind: "acBonus", bonus: 1 }] },
    { min: 12, max: 12, text: "Patron's favor: +2 spellcasting", effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 2 }] },
  ],
};

export const SEER_TALENTS: RollableTable = {
  id: "seer-talents", name: "Seer Talents", dice: "2d6", entries: [
    { min: 2, max: 2, text: "Clear vision: advantage on spellcasting", effects: [{ kind: "advantageOn", applies: "spellcast" }] },
    { min: 3, max: 6, text: "Certain omen: +1 spellcasting", effects: [{ kind: "checkBonus", applies: "spellcast", bonus: 1 }] },
    { min: 7, max: 9, text: "Old soul: +2 Wisdom", effects: [{ kind: "statBonus", stat: "WIS", bonus: 2 }] },
    { min: 10, max: 11, text: "Fate's shelter: +1 AC", effects: [{ kind: "acBonus", bonus: 1 }] },
    { min: 12, max: 12, text: "Chosen destiny: +4 max HP", effects: [{ kind: "maxHpBonus", bonus: 4 }] },
  ],
};
