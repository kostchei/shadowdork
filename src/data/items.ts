import type { ItemDef } from "../engine";
import { CORE_TREASURE_ITEM_SPECS } from "./tables/treasure";

/** All item definitions, keyed by id. Unknown lookups throw via item(). */
const BASE_ITEM_LIST: readonly ItemDef[] = [
  // Gear
  { id: "torch", name: "Torch", slotCost: 1, bundleSize: 1, tags: ["light"], valueGp: 2 },
  { id: "ration", name: "Ration", slotCost: 1, bundleSize: 3, tags: ["food"], valueGp: 1 },
  { id: "backpack", name: "Backpack", slotCost: 0, bundleSize: 1, tags: ["gear"], valueGp: 2 },
  { id: "flint-and-steel", name: "Flint and Steel", slotCost: 1, bundleSize: 1, tags: ["gear"], valueGp: 5 },
  { id: "iron-spikes", name: "Iron Spikes", slotCost: 1, bundleSize: 10, tags: ["gear"], valueGp: 1 },
  { id: "grappling-hook", name: "Grappling Hook", slotCost: 1, bundleSize: 1, tags: ["gear"], valueGp: 1 },
  { id: "rope", name: "Rope (60')", slotCost: 1, bundleSize: 1, tags: ["gear"], valueGp: 1 },

  // Weapons — reachTiles: how far the swing lands; monsters strike at 1.6, so
  // the spear (and staff) can poke from beyond a monster's claws.
  { id: "longsword", name: "Longsword", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d8", reachTiles: 1.8, weaponVisual: "longsword", valueGp: 9 },
  { id: "dagger", name: "Dagger", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", finesse: true, reachTiles: 1.6, weaponVisual: "dagger", valueGp: 5 },
  { id: "mace", name: "Mace", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d6", reachTiles: 1.6, weaponVisual: "mace", valueGp: 5 },
  { id: "staff", name: "Staff", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", twoHanded: true, reachTiles: 2.0, weaponVisual: "staff", valueGp: 2 },
  { id: "spear", name: "Spear", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d6", finesse: true, reachTiles: 2.4, weaponVisual: "spear", valueGp: 5 },
  { id: "javelin", name: "Javelin", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", finesse: true, reachTiles: 1.8, weaponVisual: "javelin", valueGp: 1 },
  // Ranged only: no reachTiles, so it can never be wielded for melee.
  { id: "shortbow", name: "Shortbow", slotCost: 1, bundleSize: 1, tags: ["weapon", "ranged"], damage: "1d4", finesse: true, valueGp: 6 },
  {
    id: "starfall-blade", name: "Starfall Blade", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic"],
    treasureQuality: "fabulous", magicBonus: 1, benefitRolls: 1,
    damage: "1d10", finesse: true, reachTiles: 1.9, weaponVisual: "longsword",
  },

  // Armor — AC = acBase + DEX (capped); class permissions are RAW.
  {
    id: "leather-armor", name: "Leather Armor", slotCost: 1, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 11, dexCap: 99, classes: ["fighter", "priest", "thief", "pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"] }, armorVisual: "leather", valueGp: 10,
  },
  {
    id: "chainmail", name: "Chainmail", slotCost: 2, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 13, dexCap: 99, classes: ["fighter", "priest", "pit-fighter", "sea-wolf"] }, armorVisual: "chain", valueGp: 60,
  },
  {
    id: "plate-mail", name: "Plate Mail", slotCost: 3, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 15, dexCap: 0, classes: ["fighter", "priest", "pit-fighter", "sea-wolf"] }, armorVisual: "plate", valueGp: 130,
  },
  {
    id: "mithral-chainmail", name: "Mithral Chainmail", slotCost: 1, bundleSize: 1, tags: ["armor", "magic"],
    treasureQuality: "fabulous", benefits: ["Occupies only one gear slot and can be worn by lightly armored classes."],
    armor: { acBase: 13, dexCap: 99, classes: ["fighter", "priest", "thief", "pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"] }, armorVisual: "mithral",
  },
  {
    id: "aegis-mail", name: "Aegis Mail", slotCost: 1, bundleSize: 1, tags: ["armor", "magic"],
    treasureQuality: "fabulous", magicBonus: 1, benefitRolls: 1, curseRolls: 1,
    armor: { acBase: 13, dexCap: 99, classes: ["fighter", "priest", "thief", "wizard", "pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"] }, armorVisual: "mithral",
  },
  { id: "shield", name: "Shield", slotCost: 1, bundleSize: 1, tags: ["armor"], shield: true, valueGp: 10 },

  // Treasure — treasure IS XP (minor 1, major 2-3, legendary 10)
  // First 100 coins ride free; every 100 after costs a slot. XP: 1 per 100 banked (handled by the game).
  // valueGp lets loose treasure be sold at a shop; "coins" is money already, so it has none.
  { id: "coins", name: "Coins", slotCost: 0, bundleSize: 100, freeQty: 100, tags: ["treasure"], xpValue: 1, treasureQuality: "normal" },
  { id: "gem", name: "Gem", slotCost: 0, bundleSize: 10, tags: ["treasure"], xpValue: 2, valueGp: 10, treasureQuality: "normal" },
  { id: "jeweled-idol", name: "Jeweled Idol", slotCost: 0, bundleSize: 1, tags: ["treasure"], xpValue: 3, valueGp: 50, treasureQuality: "fabulous" },
  { id: "crown-of-the-deep", name: "Crown of the Deep", slotCost: 0, bundleSize: 1, tags: ["treasure"], xpValue: 10, treasureQuality: "legendary" },

  // Potions & Consumables
  { id: "potion-healing", name: "Potion of Healing", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], valueGp: 75, treasureQuality: "normal", benefits: ["Restores hit points based on the drinker's level."], description: "Restore 1d6 HP to a living or dying party member.", use: { actions: ["consume", "inspect"], target: "ally" } },
  { id: "potion-invisibility", name: "Potion of Invisibility", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["The drinker becomes invisible until the duration ends, they attack, or they cast a spell."], description: "Become invisible for 5 rounds; attacking or casting ends it.", use: { actions: ["consume", "inspect"], target: "self" } },
  { id: "potion-water-breathing", name: "Potion of Water Breathing", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["The drinker can breathe underwater."], description: "Breathe underwater for 20 rounds.", use: { actions: ["consume", "inspect"], target: "self" } },
  { id: "potion-flying", name: "Potion of Flying", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["The drinker can fly a near distance as movement."], description: "Fly with the normal movement controls for 5 rounds.", use: { actions: ["consume", "inspect"], target: "self" } },
  { id: "potion-giant-strength", name: "Potion of Giant Strength", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["The drinker's Strength becomes 18 (+4) and their melee attacks deal double damage."], description: "Your Strength becomes at least 18 for 5 rounds.", use: { actions: ["consume", "inspect"], target: "self" } },
  { id: "potion-polymorph", name: "Potion of Polymorph", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["Casts polymorph on the drinker for one hour."] },
  { id: "potion-extirpation", name: "Potion of Extirpation", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "fabulous", benefits: ["Utterly removes one close-sized creature or object from reality; only wish can restore it."], personality: { alignment: "chaos", trait: "Protests its use and insists the chosen target is wrong." } },
  {
    id: "serpent-venom",
    name: "Serpent Venom",
    slotCost: 1,
    bundleSize: 1,
    tags: ["poison", "consumable"],
    valueGp: 45,
    description: "Coat a melee weapon for +1d6 poison on its next hit. Application accidents occur on 1-2; Ras-Godai only on a natural 1.",
    use: { actions: ["activate", "inspect"], target: "self" },
  },

  // Spell Scrolls
  { id: "scroll-cure-wounds", name: "Scroll of Cure Wounds", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"], treasureQuality: "normal", benefits: ["Contains one casting of cure wounds."], use: { actions: ["cast", "inspect"], target: "none" } },
  { id: "scroll-light", name: "Scroll of Light", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"], treasureQuality: "normal", benefits: ["Contains one casting of light."], use: { actions: ["cast", "inspect"], target: "none" } },
  { id: "scroll-burning-hands", name: "Scroll of Burning Hands", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"], treasureQuality: "normal", benefits: ["Contains one casting of burning hands."], use: { actions: ["cast", "inspect"], target: "none" } },
  { id: "scroll-feather-fall", name: "Scroll of Feather Fall", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"], treasureQuality: "normal", benefits: ["Contains one casting of feather fall."], use: { actions: ["cast", "inspect"], target: "none" } },
  { id: "scroll-covenant", name: "Scroll of the Covenant", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"], treasureQuality: "fabulous", benefits: ["Bestows three Divine Halo blessings."] },

  // Wands, Rings & Utility Items
  { id: "wand-fireball", name: "Wand of Fireballs", slotCost: 1, bundleSize: 1, tags: ["wand", "magic"], treasureQuality: "normal", benefits: ["Casts fireball using the wielder's spellcasting check."], curses: ["A failed casting makes the wand inert until rest; a critical failure breaks it permanently."], use: { actions: ["cast", "inspect"], target: "none", charges: 1, rechargeOnRest: true, inertOnFail: true, breaksOnCriticalFail: true } },
  { id: "ring-feather-falling", name: "Ring of Feather Falling", slotCost: 1, bundleSize: 1, tags: ["ring", "magic"], treasureQuality: "fabulous", benefits: ["Once per day, casts feather fall on its wearer when they fall."], personality: { alignment: "neutral", trait: "Fearful of heights and mentally hoots warnings near edges.", flaws: ["Fearful of heights."] }, description: "Automatically prevents one dangerous fall, then recharges on rest.", use: { actions: ["activate", "inspect"], target: "self", charges: 1, rechargeOnRest: true } },
  { id: "egg-of-cockatrice", name: "Egg of the Cockatrice", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "fabulous", benefits: ["Once per week, hatches a cockatrice that follows commands for 5 rounds; the egg repairs itself over a week."] },
  { id: "bag-of-holding", name: "Bag of Holding", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"], treasureQuality: "fabulous", benefits: ["Contains an interdimensional storage space."], curses: ["Putting it inside another Bag of Holding or Portable Hole destroys both and everything inside."], capacityBonus: 5, description: "Adds 5 gear slots while carried. It cannot be dropped while over capacity.", use: { actions: ["inspect"], target: "none" } },
  { id: "kytherian-cog", name: "Kytherian Cog", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "fabulous", benefits: ["The bearer starts every session with a luck token."] },
  { id: "crystal-ball", name: "Crystal Ball", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"], treasureQuality: "fabulous", benefits: ["A wizard can use it to cast scrying."], curses: ["A failed scrying check makes it cease functioning for one day."] },
  { id: "immovable-rod", name: "Immovable Rod", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"], treasureQuality: "fabulous", benefits: ["Its button fixes it in space, where it holds up to 5,000 pounds."] },
  { id: "portable-hole", name: "Portable Hole", slotCost: 0, bundleSize: 1, tags: ["utility", "magic"], treasureQuality: "fabulous", benefits: ["Opens into a six-foot-deep extradimensional space with 20 gear slots."], curses: ["Putting it inside a Bag of Holding or another Portable Hole destroys both and everything inside."] },
  { id: "brak-cube", name: "Brak's Cube of Perfection", slotCost: 1, bundleSize: 1, tags: ["artifact", "magic"], treasureQuality: "fabulous", benefits: ["Permanently raises one randomly selected stat to 18 (+4)."], curses: ["After use, teleports to a random location in the multiverse."] },
  { id: "flying-carpet", name: "Flying Carpet", slotCost: 2, bundleSize: 1, tags: ["utility", "magic"], treasureQuality: "fabulous", benefits: ["Carries two riders and flies double near on the driver's turn."], personality: { alignment: "neutral", trait: "Playful and mischievous; gets restless without frequent travel.", virtues: ["Enjoys visiting new places."] } },

  // Weapons & Armor Artifacts
  { id: "blade-of-vengeance", name: "Blade of Vengeance (+2)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic"], treasureQuality: "fabulous", magicBonus: 2, benefitRolls: 1, curseRolls: 1, damage: "1d8", finesse: true, reachTiles: 1.8, weaponVisual: "longsword" },
  { id: "greataxe-of-horde", name: "Greataxe of the Horde (+3)", slotCost: 2, bundleSize: 1, tags: ["weapon", "magic"], treasureQuality: "fabulous", magicBonus: 3, benefitRolls: 2, damage: "1d12", twoHanded: true, reachTiles: 2.0, weaponVisual: "mace" },
  { id: "scimitar-of-speed", name: "Scimitar of Speed (+1)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic"], treasureQuality: "fabulous", magicBonus: 1, benefitRolls: 1, damage: "1d6", finesse: true, reachTiles: 1.7, weaponVisual: "dagger" },
  { id: "obsidian-witchknife", name: "Obsidian Witchknife (+2)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic", "artifact"], treasureQuality: "legendary", magicBonus: 2, benefits: ["When casting while holding it, the wielder may take damage and add that amount to the spellcasting check."], curses: ["A lawful being cannot wield it."], damage: "1d10", finesse: true, reachTiles: 1.8, weaponVisual: "dagger" },
  { id: "armor-saint-terragnis", name: "Armor of Saint Terragnis (+3)", slotCost: 3, bundleSize: 1, tags: ["armor", "magic", "artifact"], treasureQuality: "legendary", magicBonus: 3, benefits: ["Hostile spells targeting the wearer are DC 18 to cast.", "Once per month, summons an avatar of Saint Terragnis for 10 rounds."], curses: ["Only a lawful worshipper of Saint Terragnis can wear it."], armor: { acBase: 15, dexCap: 0, classes: ["fighter", "priest"] }, armorVisual: "plate" },
  { id: "staff-of-ord", name: "Staff of Ord (+3)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic", "artifact"], treasureQuality: "legendary", magicBonus: 3, benefits: ["Functions as wands of dimension door, fireball, sending, and telekinesis without breaking on a natural 1.", "Hostile spells targeting the wielder are DC 18 to cast."], curses: ["Only a wizard can wield it."], damage: "1d4", twoHanded: true, reachTiles: 2.2, weaponVisual: "staff" },

  // Cursed Scrolls (1-3) Relics & Drops
  { id: "carved-flame-bone", name: "Carved Flame Bone", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "normal", benefits: ["Ignites in flame once per day for 1d4 rounds."] },
  { id: "eyeball-charm", name: "Eyeball Charm", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "normal", benefits: ["Repels insects and spiders."] },
  { id: "floating-wolf-idol", name: "Floating Wolf Idol", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "normal", benefits: ["Floats under its own magic."] },
  { id: "compass-rose", name: "Compass Rose", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "normal", benefits: ["Points due north while untouched."] },
  { id: "pickled-imp-jar", name: "Pickled Imp Jar", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "normal", curses: ["Attracts demonic creatures."] },
  { id: "vial-demon-blood", name: "Vial of Demon Blood", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], treasureQuality: "normal", benefits: ["Grants fire resistance for one hour."] },
  { id: "cursed-eye-token", name: "Cursed Eye Token", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"], treasureQuality: "poor", curses: ["Imposes disadvantage on the bearer's next check."] },
  { id: "cobra-bag", name: "Burlap Cobra Bag", slotCost: 1, bundleSize: 1, tags: ["utility"] },
  { id: "treasure-map-half", name: "Treasure Map Half", slotCost: 0, bundleSize: 1, tags: ["relic"] },
  { id: "scarab-jar", name: "Sealed Scarab Jar", slotCost: 0, bundleSize: 1, tags: ["relic"] },
  { id: "poison-wine-cup", name: "Poison Reservoir Cup", slotCost: 0, bundleSize: 1, tags: ["relic"] },
];

const BASE_ITEMS = new Map(BASE_ITEM_LIST.map((entry) => [entry.id, entry]));
const CORE_TREASURE_ITEMS: readonly ItemDef[] = CORE_TREASURE_ITEM_SPECS.map((spec) => {
  const base = spec.baseItemId ? BASE_ITEMS.get(spec.baseItemId) : undefined;
  if (spec.baseItemId && !base) throw new Error(`Unknown core treasure base item "${spec.baseItemId}"`);
  return {
    ...(base ?? { slotCost: 1, bundleSize: 1, tags: ["treasure"] }),
    id: spec.id,
    rulesId: base?.id,
    name: spec.name,
    description: spec.description,
    valueGp: spec.valueGp,
    treasureQuality: spec.treasureQuality,
    xpValue: { poor: 0, normal: 1, fabulous: 3, legendary: 10 }[spec.treasureQuality],
    magicBonus: spec.magicBonus ?? base?.magicBonus,
    benefitRolls: spec.benefitRolls ?? base?.benefitRolls,
    curseRolls: spec.curseRolls ?? base?.curseRolls,
    personality: spec.personality ?? base?.personality,
  };
});

const ITEM_LIST: readonly ItemDef[] = [...BASE_ITEM_LIST, ...CORE_TREASURE_ITEMS];

const ITEMS = new Map(ITEM_LIST.map((i) => [i.id, i]));
if (ITEMS.size !== ITEM_LIST.length) throw new Error("Duplicate item ids in data");

export function item(id: string): ItemDef {
  const def = ITEMS.get(id);
  if (!def) throw new Error(`Unknown item "${id}"`);
  return def;
}

export function allItems(): readonly ItemDef[] {
  return ITEM_LIST;
}
