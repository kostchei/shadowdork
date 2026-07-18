/** Wizard mishaps, split into Shadowdark's three spell-tier bands. */

import type { RollableTable } from "../../engine";
import {
  WIZARD_MISHAP_TABLE_TIER_1_2,
  WIZARD_MISHAP_TABLE_TIER_3_4,
  WIZARD_MISHAP_TABLE_TIER_5,
} from "../../engine";

export const WIZARD_MISHAPS_TIER_1_2: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_1_2,
  name: "Wizard Mishaps (Tier 1-2)",
  dice: "1d8",
  entries: [
    { min: 1, max: 1, text: "The spell detonates in your hands - take 2d6 damage.", data: { damageDice: "2d6" } },
    { min: 2, max: 2, text: "Backlash sears your nerves - take 1d6 damage.", data: { damageDice: "1d6" } },
    { min: 3, max: 3, text: "Magic drains from you - disadvantage on spellcasting until you rest.", effects: [{ kind: "disadvantageOn", applies: "spellcast" }], data: { durationUnit: "untilRest" } },
    { min: 4, max: 4, text: "Your limbs go leaden - disadvantage on attacks until you rest.", effects: [{ kind: "disadvantageOn", applies: "attack" }], data: { durationUnit: "untilRest" } },
    { min: 5, max: 5, text: "Wild magic snuffs every light source you carry.", data: { snuffLights: true } },
    { min: 6, max: 6, text: "Reality hiccups - you are flung into the air.", data: { launch: true } },
    { min: 7, max: 7, text: "Arcane static crawls over your skin - -1 AC until you rest.", effects: [{ kind: "acBonus", bonus: -1 }], data: { durationUnit: "untilRest" } },
    { min: 8, max: 8, text: "The dark notices you - nearby monsters are drawn to your position.", data: { attractMonsters: true } },
  ],
};

export const WIZARD_MISHAPS_TIER_3_4: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_3_4,
  name: "Wizard Mishaps (Tier 3-4)",
  dice: "1d8",
  entries: [
    { min: 1, max: 1, text: "The spell implodes - take 3d6 damage.", data: { damageDice: "3d6" } },
    { min: 2, max: 2, text: "A violent surge burns you for 2d6 damage and kills every carried flame.", data: { damageDice: "2d6", snuffLights: true } },
    { min: 3, max: 3, text: "Your grasp on magic fractures - disadvantage on spellcasting until you rest.", effects: [{ kind: "disadvantageOn", applies: "spellcast" }], data: { durationUnit: "untilRest" } },
    { min: 4, max: 4, text: "Your warding unravels - -2 AC until you rest.", effects: [{ kind: "acBonus", bonus: -2 }], data: { durationUnit: "untilRest" } },
    { min: 5, max: 5, text: "A beacon of failed magic flares, drawing every nearby monster.", data: { attractMonsters: true } },
    { min: 6, max: 6, text: "Space rejects you and hurls you skyward.", data: { launch: true } },
    { min: 7, max: 7, text: "Arcane tremors spoil your attacks until you rest.", effects: [{ kind: "disadvantageOn", applies: "attack" }], data: { durationUnit: "untilRest", attractMonsters: true } },
    { min: 8, max: 8, text: "Raw power tears through you - take 4d6 damage.", data: { damageDice: "4d6" } },
  ],
};

export const WIZARD_MISHAPS_TIER_5: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_5,
  name: "Wizard Mishaps (Tier 5)",
  dice: "1d8",
  entries: [
    { min: 1, max: 1, text: "Catastrophic feedback rips through you - take 4d6 damage.", data: { damageDice: "4d6" } },
    { min: 2, max: 2, text: "A black surge deals 3d6 damage and extinguishes every carried light.", data: { damageDice: "3d6", snuffLights: true } },
    { min: 3, max: 3, text: "Your command of magic collapses until you rest.", effects: [{ kind: "disadvantageOn", applies: "spellcast" }, { kind: "acBonus", bonus: -2 }], data: { durationUnit: "untilRest" } },
    { min: 4, max: 4, text: "The failed spell marks you as prey and draws nearby monsters.", effects: [{ kind: "disadvantageOn", applies: "attack" }], data: { durationUnit: "untilRest", attractMonsters: true } },
    { min: 5, max: 5, text: "Reality erupts, snuffing all light and throwing you upward.", data: { snuffLights: true, launch: true } },
    { min: 6, max: 6, text: "The spell consumes its caster - take 5d6 damage.", data: { damageDice: "5d6" } },
    { min: 7, max: 7, text: "A 2d6 backlash rings through the dungeon and summons danger.", data: { damageDice: "2d6", attractMonsters: true } },
    { min: 8, max: 8, text: "Unbound magic detonates inside you - take 6d6 damage.", data: { damageDice: "6d6" } },
  ],
};

export const WIZARD_MISHAP_TABLES: readonly RollableTable[] = [
  WIZARD_MISHAPS_TIER_1_2,
  WIZARD_MISHAPS_TIER_3_4,
  WIZARD_MISHAPS_TIER_5,
];
