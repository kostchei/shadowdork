/**
 * Wizard spell mishap table (rolled live on a natural 1). Text is original;
 * each entry carries structured data the game layer applies.
 */

import type { RollableTable } from "../../engine";
import { WIZARD_MISHAP_TABLE } from "../../engine";

export const WIZARD_MISHAPS: RollableTable = {
  id: WIZARD_MISHAP_TABLE,
  name: "Wizard Mishaps",
  dice: "1d8",
  entries: [
    {
      min: 1,
      max: 1,
      text: "The spell detonates in your hands — take 2d6 damage.",
      data: { damageDice: "2d6" },
    },
    {
      min: 2,
      max: 2,
      text: "Backlash sears your nerves — take 1d6 damage.",
      data: { damageDice: "1d6" },
    },
    {
      min: 3,
      max: 3,
      text: "Magic drains from you — disadvantage on spellcasting until you rest.",
      effects: [{ kind: "disadvantageOn", applies: "spellcast" }],
      data: { durationUnit: "untilRest" },
    },
    {
      min: 4,
      max: 4,
      text: "Your limbs go leaden — disadvantage on attacks until you rest.",
      effects: [{ kind: "disadvantageOn", applies: "attack" }],
      data: { durationUnit: "untilRest" },
    },
    {
      min: 5,
      max: 5,
      text: "A thunderclap of wild magic — every light source you carry is snuffed out.",
      data: { snuffLights: true },
    },
    {
      min: 6,
      max: 6,
      text: "Reality hiccups — you are flung into the air.",
      data: { launch: true },
    },
    {
      min: 7,
      max: 7,
      text: "Arcane static crawls over your skin — -1 AC until you rest.",
      effects: [{ kind: "acBonus", bonus: -1 }],
      data: { durationUnit: "untilRest" },
    },
    {
      min: 8,
      max: 8,
      text: "The dark notices you — nearby monsters are drawn to your position.",
      data: { attractMonsters: true },
    },
  ],
};
