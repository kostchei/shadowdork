/**
 * Safe-zone shop economy. Pure and Phaser-free so the buy/sell rules can be
 * unit-tested. Pricing derives from each item's `valueGp`; the wallet lives on
 * GameContext as `spendableGold`, kept separate from the XP-driving coin bank.
 * See docs/shops-plan.md.
 */

import type { Inventory, ItemDef } from "../../engine";
import { item } from "../../data/items";

/** The slice of GameContext the shop touches — the spendable wallet. Narrowing
 * to this keeps the shop rules Phaser-free and unit-testable. */
export interface Wallet {
  readonly spendableGold: number;
  earnGold(qty: number): void;
  spendGold(qty: number): void;
}

/** Fraction of an item's value recovered when sold back. */
export const SELL_RATE = 0.5;

/** Item ids stocked at every safe-zone shop (v1: one shared list). */
export const SHOP_STOCK: readonly string[] = [
  "torch",
  "ration",
  "rope",
  "grappling-hook",
  "iron-spikes",
  "potion-healing",
  "serpent-venom",
  "longsword",
  "leather-armor",
];

/** Purchase price. Throws for an unpriced item rather than inventing a price. */
export function buyPrice(def: ItemDef): number {
  if (def.valueGp === undefined) throw new Error(`${def.name} has no valueGp — not for sale`);
  return def.valueGp;
}

/** Sale price, at least 1 for any priced item. Throws for an unpriced item. */
export function sellPrice(def: ItemDef): number {
  if (def.valueGp === undefined) throw new Error(`${def.name} has no valueGp — cannot be sold`);
  return Math.max(1, Math.floor(def.valueGp * SELL_RATE));
}

export function isSellable(def: ItemDef): boolean {
  return def.valueGp !== undefined && def.valueGp > 0;
}

/** The stocked items, resolved from ids (throws on an unknown id). */
export function stockItems(): readonly ItemDef[] {
  return SHOP_STOCK.map((id) => item(id));
}

/** A single row in the shop overlay (buy or sell side). */
export interface ShopRow {
  id: string;
  name: string;
  price: number;
  /** Set on buy rows: why the purchase is blocked, or null if affordable. */
  block?: BuyBlock;
  /** Set on sell rows: how many the member carries. */
  qty?: number;
  kind?: "item" | "porter";
}

/** Everything the HUD needs to render the shop, built by the scene. */
export interface ShopView {
  zoneName: string;
  gold: number;
  memberName: string;
  mode: "buy" | "sell";
  buy: readonly ShopRow[];
  sell: readonly ShopRow[];
  /** Cursor index into the active side's list. */
  cursor: number;
}

/** Why a purchase is blocked, or null if it can proceed. */
export type BuyBlock = "gold" | "room" | "hired" | "attempted" | null;

export function buyBlocker(wallet: Wallet, inv: Inventory, def: ItemDef): BuyBlock {
  if (wallet.spendableGold < buyPrice(def)) return "gold";
  if (!inv.canAdd(def)) return "room";
  return null;
}

/** Spend from the wallet and add one unit. Throws if blocked (check first). */
export function buy(wallet: Wallet, inv: Inventory, def: ItemDef): void {
  const block = buyBlocker(wallet, inv, def);
  if (block === "gold") throw new Error(`Not enough gold for ${def.name}`);
  if (block === "room") throw new Error(`No room for ${def.name}`);
  wallet.spendGold(buyPrice(def));
  inv.add(def);
}

/** Remove one unit and pay the wallet. Returns the coin earned. No XP. */
export function sell(wallet: Wallet, inv: Inventory, def: ItemDef): number {
  if (!isSellable(def)) throw new Error(`${def.name} cannot be sold`);
  if (!inv.has(def.id)) throw new Error(`No ${def.name} to sell`);
  const price = sellPrice(def);
  inv.remove(def.id, 1);
  wallet.earnGold(price);
  return price;
}
