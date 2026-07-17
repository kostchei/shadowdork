import type { ItemDef } from "../engine";

/** All item definitions, keyed by id. Unknown lookups throw via item(). */
const ITEM_LIST: readonly ItemDef[] = [
  // Gear
  { id: "torch", name: "Torch", slotCost: 1, bundleSize: 1, tags: ["light"] },
  { id: "ration", name: "Ration", slotCost: 1, bundleSize: 3, tags: ["food"] },
  { id: "backpack", name: "Backpack", slotCost: 0, bundleSize: 1, tags: ["gear"] },
  { id: "flint-and-steel", name: "Flint and Steel", slotCost: 1, bundleSize: 1, tags: ["gear"] },
  { id: "iron-spikes", name: "Iron Spikes", slotCost: 1, bundleSize: 10, tags: ["gear"] },
  { id: "grappling-hook", name: "Grappling Hook", slotCost: 1, bundleSize: 1, tags: ["gear"] },
  { id: "rope", name: "Rope (60')", slotCost: 1, bundleSize: 1, tags: ["gear"] },

  // Weapons — reachTiles: how far the swing lands; monsters strike at 1.6, so
  // the spear (and staff) can poke from beyond a monster's claws.
  { id: "longsword", name: "Longsword", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d8", reachTiles: 1.8 },
  { id: "dagger", name: "Dagger", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", finesse: true, reachTiles: 1.6 },
  { id: "mace", name: "Mace", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d6", reachTiles: 1.6 },
  { id: "staff", name: "Staff", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", twoHanded: true, reachTiles: 2.0 },
  { id: "spear", name: "Spear", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d6", finesse: true, reachTiles: 2.4 },
  { id: "javelin", name: "Javelin", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", finesse: true, reachTiles: 1.8 },

  // Armor — AC = acBase + DEX (capped); class permissions are RAW.
  {
    id: "leather-armor", name: "Leather Armor", slotCost: 1, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 11, dexCap: 99, classes: ["fighter", "priest", "thief"] },
  },
  {
    id: "chainmail", name: "Chainmail", slotCost: 2, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 13, dexCap: 99, classes: ["fighter", "priest"] },
  },
  {
    id: "plate-mail", name: "Plate Mail", slotCost: 3, bundleSize: 1, tags: ["armor"],
    armor: { acBase: 15, dexCap: 0, classes: ["fighter", "priest"] },
  },
  { id: "shield", name: "Shield", slotCost: 1, bundleSize: 1, tags: ["armor"], shield: true },

  // Treasure — treasure IS XP (minor 1, major 2-3, legendary 10)
  // First 100 coins ride free; every 100 after costs a slot. XP: 1 per 100 banked (handled by the game).
  { id: "coins", name: "Coins", slotCost: 1, bundleSize: 100, freeQty: 100, tags: ["treasure"], xpValue: 1 },
  { id: "gem", name: "Gem", slotCost: 1, bundleSize: 10, tags: ["treasure"], xpValue: 2 },
  { id: "jeweled-idol", name: "Jeweled Idol", slotCost: 2, bundleSize: 1, tags: ["treasure"], xpValue: 3 },
  { id: "crown-of-the-deep", name: "Crown of the Deep", slotCost: 1, bundleSize: 1, tags: ["treasure"], xpValue: 10 },
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
