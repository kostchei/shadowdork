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
