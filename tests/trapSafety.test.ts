import { describe, expect, it } from "vitest";
import { nearestSafeStandingTile } from "../src/game/systems/trapSafety";

describe("post-stabilization trap safety", () => {
  const grid = [
    ".......",
    ".......",
    "..^....",
    "#######",
  ];

  it("moves off a spike tile onto the nearest supported floor", () => {
    const safe = nearestSafeStandingTile(grid, { x: 2, y: 2 }, (x, y) => grid[y]?.[x] === "^");
    expect(safe).toEqual({ x: 1, y: 2 });
  });

  it("also avoids runtime hazards not encoded in the grid", () => {
    const safe = nearestSafeStandingTile(grid, { x: 3, y: 2 }, (x) => x >= 2 && x <= 4);
    expect(safe).toEqual({ x: 1, y: 2 });
  });

  it("returns undefined when no safe supported landing exists", () => {
    expect(nearestSafeStandingTile(["...", "^^^", "###"], { x: 1, y: 1 }, () => true, 2)).toBeUndefined();
  });
});
