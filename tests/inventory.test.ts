import { describe, expect, it } from "vitest";
import { Inventory, stackSlots, type ItemDef } from "../src/engine/inventory";
import { item } from "../src/data/items";

const ration = item("ration");
const longsword = item("longsword");

describe("stack slot presentation", () => {
  it("reports the actual slots occupied by bundled quantities", () => {
    expect(stackSlots(ration, 1)).toBe(1);
    expect(stackSlots(ration, 3)).toBe(1);
    expect(stackSlots(ration, 4)).toBe(2);
  });
});

describe("Inventory.canSwap", () => {
  it("accepts a longsword when a full pack holds exactly the ration being spent", () => {
    // Capacity 1, entirely filled by a single ration. A plain canAdd would reject
    // the longsword, but paying the ration first frees the only slot.
    const inv = new Inventory(1);
    inv.add(ration);
    expect(inv.canAdd(longsword)).toBe(false);
    expect(inv.canSwap("ration", longsword)).toBe(true);
  });

  it("rejects the swap when removing one unit frees no slot", () => {
    // Capacity 1 filled by a stack of 3 rations (bundleSize 3 => still one slot).
    // Spending a single ration leaves 2, which still occupies the slot, so the longsword
    // has nowhere to go.
    const inv = new Inventory(1);
    inv.add(ration, 3);
    expect(inv.slotsFree()).toBe(0);
    expect(inv.canSwap("ration", longsword)).toBe(false);
  });

  it("rejects the swap when the item to remove is absent", () => {
    const inv = new Inventory(2);
    inv.add(item("torch"));
    expect(inv.canSwap("ration", longsword)).toBe(false);
  });

  it("does not mutate the inventory", () => {
    const inv = new Inventory(1);
    inv.add(ration);
    inv.canSwap("ration", longsword);
    expect(inv.count("ration")).toBe(1);
    expect(inv.count("longsword")).toBe(0);
  });
});

describe("capacity-granting items", () => {
  const bag: ItemDef = {
    id: "test-bag",
    name: "Test Bag",
    slotCost: 1,
    bundleSize: 1,
    tags: ["magic"],
    capacityBonus: 5,
  };
  const stone: ItemDef = {
    id: "stone",
    name: "Stone",
    slotCost: 1,
    bundleSize: 1,
    tags: ["gear"],
  };

  it("lets a full inventory add a bag, then use its bonus capacity", () => {
    const inventory = new Inventory(1);
    inventory.add(stone);
    inventory.add(bag);
    expect(inventory.capacity).toBe(6);
    inventory.add(stone, 4);
    expect(inventory.slotsUsed()).toBe(6);
  });

  it("refuses to remove a bag while its contents exceed base capacity", () => {
    const inventory = new Inventory(1);
    inventory.add(bag);
    inventory.add(stone, 4);
    expect(() => inventory.remove(bag.id)).toThrow("empty it first");
    expect(inventory.has(bag.id)).toBe(true);
  });
});
