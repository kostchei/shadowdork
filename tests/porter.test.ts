import { describe, expect, it } from "vitest";
import {
  PORTER_CAPACITY_SLOTS,
  PORTER_HIRE_PRICE,
  PORTER_UPKEEP_GP,
  porterHireBlock,
  porterHireDc,
  chooseMonsterTarget,
} from "../src/game/systems/porter";

describe("porter hiring rules", () => {
  it("uses DC 9 for the first porter and escalates future hires", () => {
    expect(porterHireDc(0)).toBe(9);
    expect(porterHireDc(1)).toBe(12);
    expect(porterHireDc(2)).toBe(15);
  });

  it("requires the 100 gp hiring fee and caps the current game at one porter", () => {
    expect(PORTER_HIRE_PRICE).toBe(100);
    expect(porterHireBlock(99, 0)).toBe("gold");
    expect(porterHireBlock(100, 0)).toBeNull();
    expect(porterHireBlock(500, 1)).toBe("already-hired");
    expect(porterHireBlock(500, 0, true)).toBe("attempted");
  });

  it("gives the porter ten loot slots for five gold per later vault", () => {
    expect(PORTER_CAPACITY_SLOTS).toBe(10);
    expect(PORTER_UPKEEP_GP).toBe(5);
  });

  it("rejects nonsensical porter counts", () => {
    expect(() => porterHireDc(-1)).toThrow();
    expect(() => porterHireDc(0.5)).toThrow();
  });

  it("targets even a distant adventurer before a nearby porter", () => {
    const adventurer = { id: "hero", distance: 100 };
    const porter = { id: "porter", distance: 1 };
    expect(chooseMonsterTarget([adventurer], porter, (target) => target.distance)).toBe(adventurer);
    expect(chooseMonsterTarget([], porter, (target) => target.distance)).toBe(porter);
  });
});
