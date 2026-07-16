import type { ItemDef } from "../engine";

/** All item definitions, keyed by id. Unknown lookups throw via item(). */
const ITEM_LIST: readonly ItemDef[] = [
  // Gear
  { id: "torch", name: "Torch", slotCost: 1, bundleSize: 1, tags: ["light"] },
  { id: "ration", name: "Ration", slotCost: 1, bundleSize: 1, tags: ["food"] },

  // Weapons
  { id: "longsword", name: "Longsword", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d8" },
  { id: "dagger", name: "Dagger", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4" },
  { id: "mace", name: "Mace", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d6" },
  { id: "staff", name: "Staff", slotCost: 1, bundleSize: 1, tags: ["weapon"], damage: "1d4", twoHanded: true },

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
