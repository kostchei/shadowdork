import { describe, expect, it } from "vitest";
import { Inventory } from "../src/engine/inventory";
import { item } from "../src/data/items";

const ration = item("ration");
const gem = item("gem");

describe("Inventory.canSwap", () => {
  it("accepts a gem when a full pack holds exactly the ration being spent", () => {
    // Capacity 1, entirely filled by a single ration. A plain canAdd would reject
    // the gem, but paying the ration first frees the only slot.
    const inv = new Inventory(1);
    inv.add(ration);
    expect(inv.canAdd(gem)).toBe(false);
    expect(inv.canSwap("ration", gem)).toBe(true);
  });

  it("rejects the swap when removing one unit frees no slot", () => {
    // Capacity 1 filled by a stack of 3 rations (bundleSize 3 => still one slot).
    // Spending a single ration leaves 2, which still occupies the slot, so the gem
    // has nowhere to go.
    const inv = new Inventory(1);
    inv.add(ration, 3);
    expect(inv.slotsFree()).toBe(0);
    expect(inv.canSwap("ration", gem)).toBe(false);
  });

  it("rejects the swap when the item to remove is absent", () => {
    const inv = new Inventory(2);
    inv.add(item("torch"));
    expect(inv.canSwap("ration", gem)).toBe(false);
  });

  it("does not mutate the inventory", () => {
    const inv = new Inventory(1);
    inv.add(ration);
    inv.canSwap("ration", gem);
    expect(inv.count("ration")).toBe(1);
    expect(inv.count("gem")).toBe(0);
  });
});
