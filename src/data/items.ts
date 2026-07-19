import type { ItemDef } from "../engine";

/** All item definitions, keyed by id. Unknown lookups throw via item(). */
const ITEM_LIST: readonly ItemDef[] = [
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
    armor: { acBase: 13, dexCap: 99, classes: ["fighter", "priest", "thief", "pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"] }, armorVisual: "mithral",
  },
  {
    id: "aegis-mail", name: "Aegis Mail", slotCost: 1, bundleSize: 1, tags: ["armor", "magic"],
    armor: { acBase: 14, dexCap: 99, classes: ["fighter", "priest", "thief", "wizard", "pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"] }, armorVisual: "mithral",
  },
  { id: "shield", name: "Shield", slotCost: 1, bundleSize: 1, tags: ["armor"], shield: true, valueGp: 10 },

  // Treasure — treasure IS XP (minor 1, major 2-3, legendary 10)
  // First 100 coins ride free; every 100 after costs a slot. XP: 1 per 100 banked (handled by the game).
  // valueGp lets loose treasure be sold at a shop; "coins" is money already, so it has none.
  { id: "coins", name: "Coins", slotCost: 0, bundleSize: 100, freeQty: 100, tags: ["treasure"], xpValue: 1 },
  { id: "gem", name: "Gem", slotCost: 0, bundleSize: 10, tags: ["treasure"], xpValue: 2, valueGp: 10 },
  { id: "jeweled-idol", name: "Jeweled Idol", slotCost: 0, bundleSize: 1, tags: ["treasure"], xpValue: 3, valueGp: 50 },
  { id: "crown-of-the-deep", name: "Crown of the Deep", slotCost: 0, bundleSize: 1, tags: ["treasure"], xpValue: 10 },

  // Potions & Consumables
  { id: "potion-healing", name: "Potion of Healing", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"], valueGp: 75 },
  { id: "potion-invisibility", name: "Potion of Invisibility", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "potion-water-breathing", name: "Potion of Water Breathing", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "potion-flying", name: "Potion of Flying", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "potion-giant-strength", name: "Potion of Giant Strength", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "potion-polymorph", name: "Potion of Polymorph", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "potion-extirpation", name: "Potion of Extirpation", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },

  // Spell Scrolls
  { id: "scroll-cure-wounds", name: "Scroll of Cure Wounds", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"] },
  { id: "scroll-light", name: "Scroll of Light", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"] },
  { id: "scroll-burning-hands", name: "Scroll of Burning Hands", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"] },
  { id: "scroll-feather-fall", name: "Scroll of Feather Fall", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"] },
  { id: "scroll-covenant", name: "Scroll of the Covenant", slotCost: 1, bundleSize: 1, tags: ["scroll", "magic"] },

  // Wands, Rings & Utility Items
  { id: "wand-fireball", name: "Wand of Fireballs", slotCost: 1, bundleSize: 1, tags: ["wand", "magic"] },
  { id: "ring-feather-falling", name: "Ring of Feather Falling", slotCost: 1, bundleSize: 1, tags: ["ring", "magic"] },
  { id: "egg-of-cockatrice", name: "Egg of the Cockatrice", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "bag-of-holding", name: "Bag of Holding", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"] },
  { id: "kytherian-cog", name: "Kytherian Cog", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "crystal-ball", name: "Crystal Ball", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"] },
  { id: "immovable-rod", name: "Immovable Rod", slotCost: 1, bundleSize: 1, tags: ["utility", "magic"] },
  { id: "portable-hole", name: "Portable Hole", slotCost: 0, bundleSize: 1, tags: ["utility", "magic"] },
  { id: "brak-cube", name: "Brak's Cube of Perfection", slotCost: 1, bundleSize: 1, tags: ["artifact", "magic"] },
  { id: "flying-carpet", name: "Flying Carpet", slotCost: 2, bundleSize: 1, tags: ["utility", "magic"] },

  // Weapons & Armor Artifacts
  { id: "blade-of-vengeance", name: "Blade of Vengeance (+2)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic"], damage: "1d8", finesse: true, reachTiles: 1.8, weaponVisual: "longsword" },
  { id: "greataxe-of-horde", name: "Greataxe of the Horde (+2)", slotCost: 2, bundleSize: 1, tags: ["weapon", "magic"], damage: "1d12", twoHanded: true, reachTiles: 2.0, weaponVisual: "mace" },
  { id: "scimitar-of-speed", name: "Scimitar of Speed (+1)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic"], damage: "1d6", finesse: true, reachTiles: 1.7, weaponVisual: "dagger" },
  { id: "obsidian-witchknife", name: "Obsidian Witchknife (+3)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic", "artifact"], damage: "1d10", finesse: true, reachTiles: 1.8, weaponVisual: "dagger" },
  { id: "armor-saint-terragnis", name: "Armor of Saint Terragnis (+3)", slotCost: 3, bundleSize: 1, tags: ["armor", "magic", "artifact"], armor: { acBase: 18, dexCap: 0, classes: ["fighter", "priest"] }, armorVisual: "plate" },
  { id: "staff-of-ord", name: "Staff of Ord (+3)", slotCost: 1, bundleSize: 1, tags: ["weapon", "magic", "artifact"], damage: "1d8", twoHanded: true, reachTiles: 2.2, weaponVisual: "staff" },

  // Cursed Scrolls (1-3) Relics & Drops
  { id: "carved-flame-bone", name: "Carved Flame Bone", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "eyeball-charm", name: "Eyeball Charm", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "floating-wolf-idol", name: "Floating Wolf Idol", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "compass-rose", name: "Compass Rose", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "pickled-imp-jar", name: "Pickled Imp Jar", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "vial-demon-blood", name: "Vial of Demon Blood", slotCost: 1, bundleSize: 1, tags: ["potion", "magic"] },
  { id: "cursed-eye-token", name: "Cursed Eye Token", slotCost: 0, bundleSize: 1, tags: ["relic", "magic"] },
  { id: "cobra-bag", name: "Burlap Cobra Bag", slotCost: 1, bundleSize: 1, tags: ["utility"] },
  { id: "treasure-map-half", name: "Treasure Map Half", slotCost: 0, bundleSize: 1, tags: ["relic"] },
  { id: "scarab-jar", name: "Sealed Scarab Jar", slotCost: 0, bundleSize: 1, tags: ["relic"] },
  { id: "poison-wine-cup", name: "Poison Reservoir Cup", slotCost: 0, bundleSize: 1, tags: ["relic"] },
];

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
