import { describe, expect, it } from "vitest";
import {
  DUNGEONS,
  DUNGEON_H,
  DUNGEON_W,
  dungeonAt,
} from "../src/game/level/dungeons";

const LEGAL_TILES = new Set(".#%=|^P234gsrOcGIKtnfFDb*qv:");

describe("dungeon library", () => {
  it("offers multiple distinct layouts", () => {
    expect(DUNGEONS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(DUNGEONS.map((dungeon) => dungeon.id)).size).toBe(DUNGEONS.length);
    expect(new Set(DUNGEONS.map((dungeon) => dungeon.grid.join(""))).size).toBe(DUNGEONS.length);
  });

  it.each(DUNGEONS)("validates $name", (dungeon) => {
    expect(dungeon.grid).toHaveLength(DUNGEON_H);
    expect(dungeon.grid.every((row) => row.length === DUNGEON_W)).toBe(true);

    const allTiles = dungeon.grid.join("");
    expect([...allTiles].every((tile) => LEGAL_TILES.has(tile))).toBe(true);
    for (const required of ["P", "2", "3", "4", "K", "F", "D"]) {
      expect([...allTiles].filter((tile) => tile === required)).toHaveLength(1);
    }
  });

  it("wraps dungeon indices in either direction", () => {
    expect(dungeonAt(DUNGEONS.length)).toBe(DUNGEONS[0]);
    expect(dungeonAt(-1)).toBe(DUNGEONS[DUNGEONS.length - 1]);
    expect(() => dungeonAt(1.5)).toThrow(/integer/);
  });
});
