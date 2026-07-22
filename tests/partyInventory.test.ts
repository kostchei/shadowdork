import { describe, expect, it } from "vitest";
import { Inventory } from "../src/engine";
import { item } from "../src/data";
import { chooseAutoLootCarrier } from "../src/game/systems/partyInventory";

function carrier(capacity: number) {
  return { character: { inventory: new Inventory(capacity) } };
}

describe("party-aware auto-loot", () => {
  it("prefers the character who touched the pickup when it fits", () => {
    const touched = carrier(2);
    const companion = carrier(2);
    expect(chooseAutoLootCarrier(touched, [touched, companion], item("longsword"))).toBe(touched);
  });

  it("routes the pickup to a companion when the touching character is full", () => {
    const touched = carrier(1);
    const companion = carrier(2);
    touched.character.inventory.add(item("longsword"));
    expect(chooseAutoLootCarrier(touched, [touched, companion], item("torch"))).toBe(companion);
  });

  it("leaves the pickup when nobody can carry it", () => {
    const touched = carrier(1);
    const companion = carrier(1);
    touched.character.inventory.add(item("longsword"));
    companion.character.inventory.add(item("longsword"));
    expect(chooseAutoLootCarrier(touched, [touched, companion], item("torch"))).toBeUndefined();
  });
});
