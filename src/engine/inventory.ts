/** Gear-slot inventory. Capacity = max(STR score, 10). Overflow throws — no soft encumbrance. */

export type WeaponVisual = "longsword" | "dagger" | "mace" | "staff" | "spear" | "javelin";
export type ArmorVisual = "leather" | "chain" | "plate" | "mithral";

export interface ItemDef {
  id: string;
  name: string;
  /** Slots one instance occupies. 0 = free to carry. */
  slotCost: number;
  /** How many units stack into one instance (e.g. coins: 100 per slot). */
  bundleSize: number;
  /** Units carried free before slots are charged (coins: first 100 free). */
  freeQty?: number;
  tags: readonly string[];
  /** XP value when picked up, for treasure items. */
  xpValue?: number;
  /** Base coin value. Buy price = valueGp; sell price = floor(valueGp * SELL_RATE).
   * Items without a valueGp are neither stocked nor sellable. */
  valueGp?: number;
  /** Damage dice for weapons, e.g. "1d8". */
  damage?: string;
  /** Melee reach in tiles — required for weapons. Monsters strike at 1.6. */
  reachTiles?: number;
  twoHanded?: boolean;
  /** Finesse weapons attack with the better of STR or DEX. */
  finesse?: boolean;
  /** Pixel-art silhouette used independently of the item's rules identity. */
  weaponVisual?: WeaponVisual;
  /** Wearable armor: base AC plus DEX modifier capped at dexCap. */
  armor?: {
    acBase: number;
    /** Max DEX modifier the armor allows (0 for plate, Infinity-like cap via 99). */
    dexCap: number;
    /** Class names permitted to wear it. */
    classes: readonly string[];
  };
  /** Pixel-art material used independently of the item's rules identity. */
  armorVisual?: ArmorVisual;
  /** Shields grant +2 AC and occupy a hand while readied. */
  shield?: boolean;
}

export interface ItemStack {
  def: ItemDef;
  qty: number;
}

export function partyCoinSlots(totalCoins: number, partySize = 1): number {
  const freeAllowance = Math.max(1, partySize) * 100;
  if (totalCoins <= freeAllowance) return 0;
  return Math.ceil((totalCoins - freeAllowance) / 100);
}

function stackSlots(def: ItemDef, qty: number): number {
  if (def.slotCost === 0) return 0;
  const charged = Math.max(0, qty - (def.freeQty ?? 0));
  return Math.ceil(charged / def.bundleSize) * def.slotCost;
}

export class Inventory {
  readonly capacity: number;
  private stacks: ItemStack[] = [];

  constructor(capacity: number) {
    if (capacity < 1) throw new Error(`Invalid inventory capacity ${capacity}`);
    this.capacity = capacity;
  }

  slotsUsed(): number {
    let used = 0;
    for (const s of this.stacks) used += stackSlots(s.def, s.qty);
    return used;
  }

  slotsFree(): number {
    return this.capacity - this.slotsUsed();
  }

  canAdd(def: ItemDef, qty = 1): boolean {
    if (def.slotCost === 0) return true;
    const existing = this.stacks.find((s) => s.def.id === def.id);
    const newSlots =
      this.slotsUsed() -
      (existing ? stackSlots(def, existing.qty) : 0) +
      stackSlots(def, (existing?.qty ?? 0) + qty);
    return newSlots <= this.capacity;
  }

  /**
   * Whether removing `removeQty` of `removeId` first would free enough room to then
   * add `addDef`. Evaluates the trade as one transaction: a full pack holding only
   * the item being spent can still receive its counterpart. Non-mutating.
   */
  canSwap(removeId: string, addDef: ItemDef, removeQty = 1, addQty = 1): boolean {
    const removeStack = this.stacks.find((s) => s.def.id === removeId);
    if (!removeStack || removeStack.qty < removeQty) return false;
    if (addDef.slotCost === 0) return true;
    const freed = stackSlots(removeStack.def, removeStack.qty) - stackSlots(removeStack.def, removeStack.qty - removeQty);
    const usedAfter = this.slotsUsed() - freed;
    const existingQty =
      removeId === addDef.id
        ? removeStack.qty - removeQty
        : this.stacks.find((s) => s.def.id === addDef.id)?.qty ?? 0;
    const newSlots = usedAfter - stackSlots(addDef, existingQty) + stackSlots(addDef, existingQty + addQty);
    return newSlots <= this.capacity;
  }

  add(def: ItemDef, qty = 1, force = false): void {
    if (qty < 1) throw new Error(`Quantity must be >= 1, got ${qty}`);
    if (!force && !this.canAdd(def, qty)) {
      throw new Error(
        `Cannot carry ${qty}x ${def.name}: ${this.slotsUsed()}/${this.capacity} slots used`,
      );
    }
    const existing = this.stacks.find((s) => s.def.id === def.id);
    if (existing) existing.qty += qty;
    else this.stacks.push({ def, qty });
  }

  count(itemId: string): number {
    return this.stacks.find((s) => s.def.id === itemId)?.qty ?? 0;
  }

  has(itemId: string, qty = 1): boolean {
    return this.count(itemId) >= qty;
  }

  remove(itemId: string, qty = 1): void {
    const stack = this.stacks.find((s) => s.def.id === itemId);
    if (!stack || stack.qty < qty) {
      throw new Error(`Cannot remove ${qty}x "${itemId}": have ${stack?.qty ?? 0}`);
    }
    stack.qty -= qty;
    if (stack.qty === 0) this.stacks = this.stacks.filter((s) => s !== stack);
  }

  all(): readonly ItemStack[] {
    return this.stacks;
  }
}
