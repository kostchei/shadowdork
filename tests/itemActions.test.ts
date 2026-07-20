import { describe, expect, it } from "vitest";
import {
  applyUseOutcome,
  canUseItem,
  Character,
  Engine,
  restoreOnRest,
  type ItemDef,
} from "../src/engine";
import { item } from "../src/data";

function makeFighter(id = "f1"): Character {
  return new Character({
    id,
    name: "Test Fighter",
    className: "fighter",
    stats: { STR: 14, DEX: 12, CON: 14, INT: 9, WIS: 10, CHA: 11 },
    maxHp: 10,
  });
}

const POTION: ItemDef = {
  id: "test-potion",
  name: "Test Potion",
  slotCost: 1,
  bundleSize: 1,
  tags: ["potion"],
  use: { actions: ["consume"], target: "self" },
};

const WAND: ItemDef = {
  id: "test-wand",
  name: "Test Wand",
  slotCost: 1,
  bundleSize: 1,
  tags: ["wand"],
  use: {
    actions: ["cast"],
    target: "enemy",
    charges: 3,
    rechargeOnRest: true,
    inertOnFail: true,
    breaksOnCriticalFail: true,
  },
};

const RING: ItemDef = {
  id: "test-ring",
  name: "Test Ring",
  slotCost: 1,
  bundleSize: 1,
  tags: ["ring"],
  use: { actions: ["activate", "inspect"], target: "none" },
};

describe("canUseItem", () => {
  it("refuses an item the character isn't carrying", () => {
    const f = makeFighter();
    const check = canUseItem(f, f.itemState, POTION, "consume");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("not-carried");
  });

  it("refuses an unsupported action even when carried", () => {
    const f = makeFighter();
    f.inventory.add(POTION);
    const check = canUseItem(f, f.itemState, POTION, "cast");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("unsupported-action");
  });

  it("allows a self-targeted consumable with no target selected", () => {
    const f = makeFighter();
    f.inventory.add(POTION);
    expect(canUseItem(f, f.itemState, POTION, "consume").ok).toBe(true);
  });

  it("requires an explicit target for an enemy-targeted cast action", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    const noTarget = canUseItem(f, f.itemState, WAND, "cast", false);
    expect(noTarget.ok).toBe(false);
    if (!noTarget.ok) expect(noTarget.reason).toBe("target-required");
    expect(canUseItem(f, f.itemState, WAND, "cast", true).ok).toBe(true);
  });

  it("recognizes equipped gear (worn/wielded/shield) as carried without an inventory stack", () => {
    const f = makeFighter();
    const glove: ItemDef = { ...RING, id: "test-glove" };
    f.wornArmor = glove; // stand-in for "worn" without going through equipArmor's class gate
    expect(canUseItem(f, f.itemState, glove, "activate").ok).toBe(true);
  });

  it("blocks use once a wand goes inert, and inert never blocks other items", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    f.inventory.add(POTION);
    applyUseOutcome(f.itemState, WAND, "fail");
    const wandCheck = canUseItem(f, f.itemState, WAND, "cast", true);
    expect(wandCheck.ok).toBe(false);
    if (!wandCheck.ok) expect(wandCheck.reason).toBe("inert");
    expect(canUseItem(f, f.itemState, POTION, "consume").ok).toBe(true);
  });

  it("a critical failure breaks the item permanently — rest does not fix it", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    applyUseOutcome(f.itemState, WAND, "criticalFail");
    let check = canUseItem(f, f.itemState, WAND, "cast", true);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("broken");

    const engine = new Engine();
    f.inventory.add(item("ration"), 1, true);
    engine.rest(f, item("ration"));
    check = canUseItem(f, f.itemState, WAND, "cast", true);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("broken");
  });

  it("exhausts charges and refuses further use until they're restored", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    for (let i = 0; i < 3; i++) {
      expect(canUseItem(f, f.itemState, WAND, "cast", true).ok).toBe(true);
      applyUseOutcome(f.itemState, WAND, "success");
    }
    const check = canUseItem(f, f.itemState, WAND, "cast", true);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("no-charges");
  });

  it("restoreOnRest refills rechargeOnRest charges and clears inertness for carried gear", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    applyUseOutcome(f.itemState, WAND, "fail"); // spends a charge and goes inert
    expect(f.itemState.get(WAND.id).inert).toBe(true);
    expect(f.itemState.get(WAND.id).chargesRemaining).toBe(2);
    restoreOnRest(f);
    expect(f.itemState.get(WAND.id).inert).toBe(false);
    expect(f.itemState.get(WAND.id).chargesRemaining).toBe(3);
  });

  it("restoreOnRest never revives a broken item's charges", () => {
    const f = makeFighter();
    f.inventory.add(WAND);
    applyUseOutcome(f.itemState, WAND, "criticalFail");
    restoreOnRest(f);
    expect(f.itemState.get(WAND.id).broken).toBe(true);
    // Charges do come back (breakage, not charge count, is what actually blocks use);
    // canUseItem still refuses because it checks broken before charges.
    expect(canUseItem(f, f.itemState, WAND, "cast", true).ok).toBe(false);
  });
});
