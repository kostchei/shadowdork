/**
 * Gear-slot inventory. Capacity = max(STR score, 10). Overflow throws — no
 * soft encumbrance. Also the typed usable-item model (equip/consume/cast/
 * activate/place/inspect) and the per-item-id instance state (charges,
 * inertness, breakage) that model needs — see ./itemActions for the resolver
 * that reads them.
 */

export type WeaponVisual = "longsword" | "dagger" | "mace" | "staff" | "spear" | "javelin";
export type ArmorVisual = "leather" | "chain" | "plate" | "mithral";

/** What can be done with an item. A single item may support several. */
export type ItemActionKind = "equip" | "consume" | "cast" | "activate" | "place" | "inspect";

/** What a `cast`/`activate`/`place` action needs pointed at it. */
export type ItemTargetKind = "self" | "ally" | "enemy" | "point" | "object" | "surface" | "none";

/** Target kinds that need the player to actually pick something before the action can run. */
const TARGETS_REQUIRING_SELECTION: ReadonlySet<ItemTargetKind> = new Set([
  "ally",
  "enemy",
  "point",
  "object",
  "surface",
]);

export function itemTargetNeedsSelection(target: ItemTargetKind): boolean {
  return TARGETS_REQUIRING_SELECTION.has(target);
}

export interface ItemUseDef {
  /** Actions this item supports; the caller picks one that fits the moment. */
  actions: readonly ItemActionKind[];
  target: ItemTargetKind;
  /** Uses before the item is spent. Absent = a plain single-use consumable
   * (removed from inventory on use) or an uncharged permanent item (a ring,
   * a cursed weapon). */
  charges?: number;
  /** Charges refill to full on rest instead of being spent for the run. */
  rechargeOnRest?: boolean;
  /** A normal failed cast/activate makes the item inert until the wielder rests (wands). */
  inertOnFail?: boolean;
  /** A critical failure destroys the item permanently (wands). */
  breaksOnCriticalFail?: boolean;
}

/** Per-item-id instance state: charges remaining, temporary inertness, permanent breakage. */
export interface ItemInstanceState {
  chargesRemaining?: number;
  inert: boolean;
  broken: boolean;
}

const DEFAULT_INSTANCE_STATE: ItemInstanceState = { inert: false, broken: false };

/** Tracks {@link ItemInstanceState} per item id for one character. Keyed by id, not
 * by stack instance — matching Inventory's own id-stacked model. */
export class ItemStateTracker {
  private state = new Map<string, ItemInstanceState>();

  get(itemId: string): ItemInstanceState {
    return this.state.get(itemId) ?? DEFAULT_INSTANCE_STATE;
  }

  private put(itemId: string, next: ItemInstanceState): void {
    this.state.set(itemId, next);
  }

  setCharges(itemId: string, charges: number): void {
    this.put(itemId, { ...this.get(itemId), chargesRemaining: charges });
  }

  markInert(itemId: string): void {
    this.put(itemId, { ...this.get(itemId), inert: true });
  }

  markBroken(itemId: string): void {
    this.put(itemId, { ...this.get(itemId), inert: false, broken: true });
  }

  /** Rest recovery: clears inertness (never breakage — that's permanent). */
  clearInert(itemId: string): void {
    const s = this.get(itemId);
    if (!s.broken) this.put(itemId, { ...s, inert: false });
  }

  /** Mundane repair magic clears broken/inert state without restoring charges. */
  repair(itemId: string): void {
    const s = this.get(itemId);
    this.put(itemId, { ...s, inert: false, broken: false });
  }

  entries(): readonly (readonly [string, ItemInstanceState])[] {
    return [...this.state.entries()];
  }

  /** Replace all tracked state, e.g. on load. */
  load(entries: readonly (readonly [string, ItemInstanceState])[]): void {
    this.state = new Map(entries.map(([id, s]) => [id, { ...s }]));
  }
}

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
  /** Short rules-facing text for the lightweight inventory inspection view. */
  description?: string;
  /** XP value when picked up, for treasure items. */
  xpValue?: number;
  /** Extra carrying capacity supplied while this item remains in inventory. */
  capacityBonus?: number;
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
  /** Absent = a plain carried item with no player-facing "use" (a weapon you
   * only equip through the existing equip flow, ordinary gear, treasure). */
  use?: ItemUseDef;
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

/** Actual slots occupied by a quantity, including bundles and any free allowance. */
export function stackSlots(def: ItemDef, qty: number): number {
  if (def.slotCost === 0) return 0;
  const charged = Math.max(0, qty - (def.freeQty ?? 0));
  return Math.ceil(charged / def.bundleSize) * def.slotCost;
}

export class Inventory {
  private readonly baseCapacity: number;
  private stacks: ItemStack[] = [];

  constructor(capacity: number) {
    if (capacity < 1) throw new Error(`Invalid inventory capacity ${capacity}`);
    this.baseCapacity = capacity;
  }

  get capacity(): number {
    return this.baseCapacity + this.stacks.reduce(
      (total, stack) => total + (stack.def.capacityBonus ?? 0) * stack.qty,
      0,
    );
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
    const addedCapacity = (def.capacityBonus ?? 0) * qty;
    return newSlots <= this.capacity + addedCapacity;
  }

  /**
   * Whether removing `removeQty` of `removeId` first would free enough room to then
   * add `addDef`. Evaluates the trade as one transaction: a full pack holding only
   * the item being spent can still receive its counterpart. Non-mutating.
   */
  canSwap(removeId: string, addDef: ItemDef, removeQty = 1, addQty = 1): boolean {
    const removeStack = this.stacks.find((s) => s.def.id === removeId);
    if (!removeStack || removeStack.qty < removeQty) return false;
    const freed = stackSlots(removeStack.def, removeStack.qty) - stackSlots(removeStack.def, removeStack.qty - removeQty);
    const usedAfter = this.slotsUsed() - freed;
    const existingQty =
      removeId === addDef.id
        ? removeStack.qty - removeQty
        : this.stacks.find((s) => s.def.id === addDef.id)?.qty ?? 0;
    const newSlots = usedAfter - stackSlots(addDef, existingQty) + stackSlots(addDef, existingQty + addQty);
    const capacityAfter =
      this.capacity -
      (removeStack.def.capacityBonus ?? 0) * removeQty +
      (addDef.capacityBonus ?? 0) * addQty;
    return newSlots <= capacityAfter;
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
    const capacityAfter = this.capacity - (stack.def.capacityBonus ?? 0) * qty;
    const slotsAfter = this.slotsUsed() - stackSlots(stack.def, stack.qty) + stackSlots(stack.def, stack.qty - qty);
    if (slotsAfter > capacityAfter) {
      throw new Error(`Cannot remove ${stack.def.name}: empty it first (${slotsAfter}/${capacityAfter} slots)`);
    }
    stack.qty -= qty;
    if (stack.qty === 0) this.stacks = this.stacks.filter((s) => s !== stack);
  }

  all(): readonly ItemStack[] {
    return this.stacks;
  }
}
