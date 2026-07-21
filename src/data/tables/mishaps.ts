/** Wizard and Diabolical Witch mishaps, split into three spell-tier bands. */

import type { EffectHook, RollableTable, TableEntry } from "../../engine";
import {
  WITCH_MISHAP_TABLE_TIER_1_2,
  WITCH_MISHAP_TABLE_TIER_3_4,
  WITCH_MISHAP_TABLE_TIER_5,
  WIZARD_MISHAP_TABLE_TIER_1_2,
  WIZARD_MISHAP_TABLE_TIER_3_4,
  WIZARD_MISHAP_TABLE_TIER_5,
} from "../../engine";

function entry(
  roll: number,
  text: string,
  data: Record<string, unknown> = {},
  effects?: readonly EffectHook[],
): TableEntry {
  return { min: roll, max: roll, text, data, effects };
}

export const WIZARD_MISHAPS_TIER_1_2: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_1_2,
  name: "Wizard Mishaps (Tier 1-2)",
  dice: "1d12",
  entries: [
    entry(1, "The spell detonates in your hands. Take 2d6 damage.", { damageDice: "2d6" }),
    entry(2, "The spell veers into the nearest ally for 1d6 damage.", { redirectDamageDice: "1d6", redirectTarget: "ally" }),
    entry(3, "One loose carried item vanishes into a crack in reality.", { vanishGear: 1 }),
    entry(4, "Arcane static fouls your thoughts until you rest.", {}, [{ kind: "disadvantageOn", applies: "spellcast" }]),
    entry(5, "Every carried flame is abruptly snuffed out.", { snuffLights: true }),
    entry(6, "A cold magical beacon marks you for 5 rounds.", { beaconRounds: 5, attractMonsters: true }),
    entry(7, "The floor buckles into a shallow sinkhole beneath you.", { sinkhole: true, fallbackDamageDice: "1d6" }),
    entry(8, "A hostile goblin tumbles through a palm-sized portal.", { summonMonsterId: "goblin", summonCount: 1 }),
    entry(9, "A second prepared spell slips from your mind until rest.", { loseSpell: "temporary" }),
    entry(10, "Reality rejects you and flings you skyward.", { launch: true }),
    entry(11, "The failed spell rings like a dinner bell through nearby rooms.", { attractMonsters: true }),
    entry(12, "The spell tears free and casts itself at the nearest valid target.", { repeatCast: true }),
  ],
};

export const WIZARD_MISHAPS_TIER_3_4: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_3_4,
  name: "Wizard Mishaps (Tier 3-4)",
  dice: "1d12",
  entries: [
    entry(1, "The spell implodes through you. Take 3d6 damage.", { damageDice: "3d6" }),
    entry(2, "Power arcs into the nearest ally for 2d6 damage.", { redirectDamageDice: "2d6", redirectTarget: "ally" }),
    entry(3, "Two carried items vanish into the astral dark.", { vanishGear: 2 }),
    entry(4, "A black surge burns you and kills every flame.", { damageDice: "2d6", snuffLights: true }),
    entry(5, "You blaze as an arcane beacon for 8 rounds.", { beaconRounds: 8, attractMonsters: true }),
    entry(6, "Stone folds into a hungry sinkhole beneath the party.", { sinkhole: true, sinkholeRadius: "close", fallbackDamageDice: "2d6" }),
    entry(7, "Two hostile goblins spill from a ragged portal.", { summonMonsterId: "goblin", summonCount: 2, portal: true }),
    entry(8, "A portal yawns open and calls every nearby creature.", { portal: true, attractMonsters: true }),
    entry(9, "Another prepared spell is lost until you rest.", { loseSpell: "temporary" }),
    entry(10, "A growing magical tear lashes the room for 4 rounds.", { magicTearRounds: 4, tearDamageDice: "1d6" }),
    entry(11, "The spell erupts twice at uncontrolled targets.", { repeatCast: true, repeatCount: 2 }),
    entry(12, "Your wards collapse: -2 AC and spellcasting disadvantage until rest.", {}, [
      { kind: "acBonus", bonus: -2 },
      { kind: "disadvantageOn", applies: "spellcast" },
    ]),
  ],
};

export const WIZARD_MISHAPS_TIER_5: RollableTable = {
  id: WIZARD_MISHAP_TABLE_TIER_5,
  name: "Wizard Mishaps (Tier 5)",
  dice: "1d12",
  entries: [
    entry(1, "Catastrophic feedback rips through you. Take 5d6 damage.", { damageDice: "5d6" }),
    entry(2, "A killing arc strikes the nearest ally for 4d6 damage.", { redirectDamageDice: "4d6", redirectTarget: "ally" }),
    entry(3, "Three carried items are erased from the world.", { vanishGear: 3 }),
    entry(4, "All light dies and you become a beacon for what hunts beyond.", { snuffLights: true, beaconRounds: 10, attractMonsters: true }),
    entry(5, "A deep sinkhole tears open beneath everyone close to you.", { sinkhole: true, sinkholeRadius: "close", fallbackDamageDice: "3d6" }),
    entry(6, "A portal disgorges three hostile creatures.", { summonMonsterId: "goblin", summonCount: 3, portal: true }),
    entry(7, "A hungry portal opens and refuses to close for 5 rounds.", { portal: true, magicTearRounds: 5, tearDamageDice: "1d8" }),
    entry(8, "Every other prepared spell is lost until rest.", { loseSpell: "all-temporary" }),
    entry(9, "A magical tear repeatedly casts the failed spell for 3 rounds.", { magicTearRounds: 3, repeatCast: true }),
    entry(10, "One other spell is torn permanently from your grimoire.", { loseSpell: "permanent" }),
    entry(11, "The spell repeats three times while the dungeon answers.", { repeatCast: true, repeatCount: 3, attractMonsters: true }),
    entry(12, "Unbound magic consumes the room. Take 6d6 damage and extinguish all light.", { damageDice: "6d6", snuffLights: true }),
  ],
};

export const WITCH_MISHAPS_TIER_1_2: RollableTable = {
  id: WITCH_MISHAP_TABLE_TIER_1_2,
  name: "Diabolical Witch Mishaps (Tier 1-2)",
  dice: "1d12",
  entries: [
    entry(1, "Your hands become frog claws until rest.", { transformation: "frog claws" }, [{ kind: "disadvantageOn", applies: "attack" }]),
    entry(2, "Uncontrollable laughter silences you for 3 rounds.", { laughterRounds: 3 }),
    entry(3, "Your patron steals one loose carried item.", { vanishGear: 1, patronTheft: true }),
    entry(4, "A close cloud of swamp gas poisons the party.", { swampGasDice: "1d4", swampGasRounds: 3 }),
    entry(5, "A ring of salt traps you for 3 rounds.", { saltPrisonRounds: 3 }),
    entry(6, "A hostile bittermold familiar crawls from your shadow.", { summonMonsterId: "bittermold", summonCount: 1 }),
    entry(7, "Your patron marks its displeasure until you rest.", { patronDispleasure: true }, [{ kind: "disadvantageOn", applies: "spellcast" }]),
    entry(8, "Your voice becomes a goat's bleat until rest.", { transformation: "goat voice" }, [{ kind: "disadvantageOn", applies: "morale" }]),
    entry(9, "Black laughter draws every nearby monster.", { laughterRounds: 2, attractMonsters: true }),
    entry(10, "Salt bursts outward, blinding everyone close for 2 rounds.", { saltBurstRounds: 2 }),
    entry(11, "Swamp fire snuffs mundane lights and burns you for 1d6.", { damageDice: "1d6", snuffLights: true }),
    entry(12, "The patron hurls the spell at the nearest valid target.", { repeatCast: true }),
  ],
};

export const WITCH_MISHAPS_TIER_3_4: RollableTable = {
  id: WITCH_MISHAP_TABLE_TIER_3_4,
  name: "Diabolical Witch Mishaps (Tier 3-4)",
  dice: "1d12",
  entries: [
    entry(1, "Your body twists into a stooped bog-form until rest.", { transformation: "bog-form" }, [{ kind: "acBonus", bonus: -2 }]),
    entry(2, "Hideous laughter silences and frightens you for 4 rounds.", { laughterRounds: 4, frightened: true }),
    entry(3, "Your patron takes two carried items as an offering.", { vanishGear: 2, patronTheft: true }),
    entry(4, "Dense swamp gas floods the close area for 4 rounds.", { swampGasDice: "1d6", swampGasRounds: 4 }),
    entry(5, "A salt prison seals you in place for 5 rounds.", { saltPrisonRounds: 5 }),
    entry(6, "Two hostile bittermold familiars answer the wrong call.", { summonMonsterId: "bittermold", summonCount: 2 }),
    entry(7, "Patron displeasure severs your confidence until rest.", { patronDispleasure: true }, [
      { kind: "disadvantageOn", applies: "spellcast" },
      { kind: "disadvantageOn", applies: "morale" },
    ]),
    entry(8, "A bramble snout and cloven feet ruin delicate movement until rest.", { transformation: "bramble beast" }, [{ kind: "disadvantageOn", applies: "stealth" }]),
    entry(9, "A cackling portal calls hostile familiars and nearby monsters.", { summonMonsterId: "bittermold", summonCount: 1, portal: true, attractMonsters: true }),
    entry(10, "Salt and sulfur blind the close area for 3 rounds.", { saltBurstRounds: 3, swampGasDice: "1d4" }),
    entry(11, "The spell is offered to your patron and repeats twice.", { repeatCast: true, repeatCount: 2 }),
    entry(12, "A diabolical tear leaks poison for 4 rounds.", { magicTearRounds: 4, tearDamageDice: "1d6", poisonTear: true }),
  ],
};

export const WITCH_MISHAPS_TIER_5: RollableTable = {
  id: WITCH_MISHAP_TABLE_TIER_5,
  name: "Diabolical Witch Mishaps (Tier 5)",
  dice: "1d12",
  entries: [
    entry(1, "Your patron reshapes you into a hulking toad-thing until rest.", { transformation: "toad-thing" }, [
      { kind: "acBonus", bonus: -2 },
      { kind: "disadvantageOn", applies: "attack" },
    ]),
    entry(2, "Endless laughter silences you for 6 rounds and summons danger.", { laughterRounds: 6, attractMonsters: true }),
    entry(3, "Your patron claims three carried items, but leaves your life.", { vanishGear: 3, patronTheft: true }),
    entry(4, "A poisonous swamp cloud consumes the near area for 5 rounds.", { swampGasDice: "1d8", swampGasRounds: 5, swampGasRadius: "near" }),
    entry(5, "A many-layered salt prison binds you for 8 rounds.", { saltPrisonRounds: 8 }),
    entry(6, "Three hostile familiars claw through a sulfurous portal.", { summonMonsterId: "bittermold", summonCount: 3, portal: true }),
    entry(7, "Your patron brands you faithless until the next safe rest.", { patronDispleasure: true }, [
      { kind: "disadvantageOn", applies: "spellcast" },
      { kind: "acBonus", bonus: -2 },
    ]),
    entry(8, "Horn, hoof, and tail make you a beacon to monsters until rest.", { transformation: "horned beast", attractMonsters: true }, [{ kind: "disadvantageOn", applies: "stealth" }]),
    entry(9, "A patron's gate remains open and leaks hostile familiars.", { portal: true, magicTearRounds: 5, summonMonsterId: "bittermold", summonCount: 2 }),
    entry(10, "A salt storm blinds and grapples everyone close for 4 rounds.", { saltBurstRounds: 4, saltPrisonParty: true }),
    entry(11, "Your patron repeats the spell three times for its own amusement.", { repeatCast: true, repeatCount: 3 }),
    entry(12, "Patron wrath deals 4d6 damage, but the curse ends at rest rather than destroying the campaign.", { damageDice: "4d6", patronDispleasure: true }),
  ],
};

export const WIZARD_MISHAP_TABLES: readonly RollableTable[] = [
  WIZARD_MISHAPS_TIER_1_2,
  WIZARD_MISHAPS_TIER_3_4,
  WIZARD_MISHAPS_TIER_5,
];

export const WITCH_MISHAP_TABLES: readonly RollableTable[] = [
  WITCH_MISHAPS_TIER_1_2,
  WITCH_MISHAPS_TIER_3_4,
  WITCH_MISHAPS_TIER_5,
];

export const ALL_MISHAP_TABLES: readonly RollableTable[] = [
  ...WIZARD_MISHAP_TABLES,
  ...WITCH_MISHAP_TABLES,
];
