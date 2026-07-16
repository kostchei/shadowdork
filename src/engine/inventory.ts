/** Gear-slot inventory. Capacity = max(STR score, 10). Overflow throws — no soft encumbrance. */

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
  /** Damage dice for weapons, e.g. "1d8". */
  damage?: string;
  twoHanded?: boolean;
}

export interface ItemStack {
  def: ItemDef;
  qty: number;
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

  add(def: ItemDef, qty = 1): void {
    if (qty < 1) throw new Error(`Quantity must be >= 1, got ${qty}`);
    if (!this.canAdd(def, qty)) {
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
