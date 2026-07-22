import type { Inventory, ItemDef } from "../../engine";

export interface InventoryCarrier {
  character: { inventory: Inventory };
}

/**
 * Choose who receives an auto-looted item. The member who touched it keeps
 * priority; if their pack is full, the first companion with room takes it.
 */
export function chooseAutoLootCarrier<T extends InventoryCarrier>(
  preferred: T,
  party: readonly T[],
  def: ItemDef,
  qty = 1,
): T | undefined {
  if (preferred.character.inventory.canAdd(def, qty)) return preferred;
  return party.find((member) => member !== preferred && member.character.inventory.canAdd(def, qty));
}
