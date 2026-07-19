import { describe, it, expect } from "vitest";
import { Inventory } from "../src/engine/inventory";
import { item } from "../src/data/items";
import {
  SELL_RATE,
  buyPrice,
  sellPrice,
  isSellable,
  stockItems,
  buyBlocker,
  buy,
  sell,
  type Wallet,
} from "../src/game/systems/shop";

/** Minimal wallet matching GameContext's spend/earn contract, no Phaser. */
class TestWallet implements Wallet {
  constructor(private gold: number) {}
  get spendableGold(): number {
    return this.gold;
  }
  earnGold(qty: number): void {
    if (qty < 1) throw new Error("bad earn");
    this.gold += qty;
  }
  spendGold(qty: number): void {
    if (qty > this.gold) throw new Error("overspend");
    this.gold -= qty;
  }
}

describe("shop pricing", () => {
  it("buy price is the item's valueGp", () => {
    expect(buyPrice(item("longsword"))).toBe(9);
    expect(buyPrice(item("leather-armor"))).toBe(10);
  });

  it("sell price is floor(valueGp * SELL_RATE), at least 1", () => {
    expect(SELL_RATE).toBe(0.5);
    expect(sellPrice(item("leather-armor"))).toBe(5); // floor(10 * 0.5)
    expect(sellPrice(item("longsword"))).toBe(4); // floor(9 * 0.5)
    expect(sellPrice(item("rope"))).toBe(1); // floor(1 * 0.5) -> clamped to 1
  });

  it("throws for an unpriced item instead of inventing a price", () => {
    expect(item("wand-fireball").valueGp).toBeUndefined();
    expect(() => buyPrice(item("wand-fireball"))).toThrow();
    expect(() => sellPrice(item("wand-fireball"))).toThrow();
    expect(isSellable(item("wand-fireball"))).toBe(false);
    expect(isSellable(item("longsword"))).toBe(true);
  });

  it("stock resolves to real, priced items", () => {
    const stock = stockItems();
    expect(stock.length).toBeGreaterThan(0);
    for (const def of stock) expect(typeof buyPrice(def)).toBe("number");
  });
});

describe("buying", () => {
  it("spends gold and adds the item", () => {
    const wallet = new TestWallet(20);
    const inv = new Inventory(10);
    buy(wallet, inv, item("longsword"));
    expect(wallet.spendableGold).toBe(11); // 20 - 9
    expect(inv.has("longsword")).toBe(true);
  });

  it("is blocked and throws when gold is insufficient", () => {
    const wallet = new TestWallet(3);
    const inv = new Inventory(10);
    expect(buyBlocker(wallet, inv, item("longsword"))).toBe("gold");
    expect(() => buy(wallet, inv, item("longsword"))).toThrow();
    expect(wallet.spendableGold).toBe(3); // untouched
    expect(inv.has("longsword")).toBe(false);
  });

  it("is blocked and throws when there is no room", () => {
    const wallet = new TestWallet(500);
    const inv = new Inventory(1);
    inv.add(item("plate-mail"), 1, true); // fills 3 slots in a 1-slot pack
    expect(buyBlocker(wallet, inv, item("longsword"))).toBe("room");
    expect(() => buy(wallet, inv, item("longsword"))).toThrow();
    expect(wallet.spendableGold).toBe(500);
  });
});

describe("coins-are-XP invariance", () => {
  // Mirrors GameContext: an XP-driving coin bank plus a separate wallet.
  // The shop must only ever move the wallet — never the bank (which grants XP).
  class BankAndWallet implements Wallet {
    banked = 0;
    private gold: number;
    constructor(gold: number) {
      this.gold = gold;
    }
    get spendableGold(): number {
      return this.gold;
    }
    earnGold(qty: number): void {
      this.gold += qty;
    }
    spendGold(qty: number): void {
      this.gold -= qty;
    }
  }

  it("buying spends the wallet but never the XP bank", () => {
    const w = new BankAndWallet(50);
    w.banked = 300; // 3 XP already earned from collecting
    buy(w, new Inventory(10), item("longsword"));
    expect(w.spendableGold).toBe(41);
    expect(w.banked).toBe(300); // XP basis untouched — progress kept
  });

  it("selling pays the wallet but grants no XP", () => {
    const w = new BankAndWallet(0);
    w.banked = 300;
    const inv = new Inventory(10);
    inv.add(item("longsword"), 1);
    sell(w, inv, item("longsword"));
    expect(w.spendableGold).toBe(4);
    expect(w.banked).toBe(300); // selling never raises the XP bank
  });
});

describe("selling", () => {
  it("removes one unit and pays the wallet", () => {
    const wallet = new TestWallet(0);
    const inv = new Inventory(10);
    inv.add(item("longsword"), 1);
    const paid = sell(wallet, inv, item("longsword"));
    expect(paid).toBe(4);
    expect(wallet.spendableGold).toBe(4);
    expect(inv.has("longsword")).toBe(false);
  });

  it("refuses to sell an unpriced item", () => {
    const wallet = new TestWallet(0);
    const inv = new Inventory(10);
    inv.add(item("wand-fireball"), 1);
    expect(() => sell(wallet, inv, item("wand-fireball"))).toThrow();
  });

  it("refuses to sell what is not carried", () => {
    const wallet = new TestWallet(0);
    const inv = new Inventory(10);
    expect(() => sell(wallet, inv, item("longsword"))).toThrow();
  });
});
