import { describe, expect, it } from "vitest";
import {
  DUNGEONS,
  DUNGEON_H,
  DUNGEON_W,
  FEATURED_TRAP_CHANCE,
  LEGAL_TILES,
  ROOM_BANDS,
  dungeonAt,
  generateGrid,
  validateGrid,
  validateTraps,
} from "../src/game/level/dungeons";

describe("dungeon library", () => {
  it("offers multiple distinct layouts", () => {
    expect(DUNGEONS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(DUNGEONS.map((dungeon) => dungeon.id)).size).toBe(DUNGEONS.length);
    expect(new Set(DUNGEONS.map((dungeon) => dungeon.grid.join(""))).size).toBe(DUNGEONS.length);
  });

  it.each(DUNGEONS)("validates $name", (dungeon) => {
    expect(dungeon.grid).toHaveLength(DUNGEON_H);
    expect(dungeon.grid.every((row) => row.length === DUNGEON_W)).toBe(true);
    expect(() => validateGrid(dungeon.grid)).not.toThrow();
  });

  it("wraps dungeon indices in either direction without mutating the library", () => {
    const originalGrid = DUNGEONS[0]!.grid;
    expect(dungeonAt(DUNGEONS.length).id).toBe(DUNGEONS[0]!.id);
    expect(dungeonAt(-1).id).toBe(DUNGEONS[DUNGEONS.length - 1]!.id);
    expect(() => dungeonAt(1.5)).toThrow(/integer/);
    expect(DUNGEONS[0]!.grid).toBe(originalGrid);
  });

  it("keeps dungeon layouts inside their themed variant pools", () => {
    // Same pools + same seed = same grid; different dungeons' pools diverge.
    const a = generateGrid(DUNGEONS[0]!.pools, 42);
    const b = generateGrid(DUNGEONS[0]!.pools, 42);
    expect(a.join("")).toBe(b.join(""));
  });
});

describe("seeded run grids (property tests)", () => {
  const RUNS = 200;

  it(`validate for ${RUNS} consecutive run indices`, () => {
    for (let index = 0; index < RUNS; index++) {
      // dungeonAt runs validateGrid internally; any violation throws here.
      expect(() => dungeonAt(index)).not.toThrow();
    }
  });

  it("places every rescue in rooms 1-4, at least two before the climax", () => {
    const climax = ROOM_BANDS[3]!;
    for (let index = 0; index < RUNS; index++) {
      const grid = dungeonAt(index).grid.join("\n");
      let before4 = 0;
      for (const tile of ["2", "3", "4"]) {
        const flat = dungeonAt(index).grid.join("");
        const at = flat.indexOf(tile);
        expect(at).toBeGreaterThanOrEqual(0);
        const x = at % DUNGEON_W;
        expect(x).toBeLessThanOrEqual(climax.x2);
        if (x < climax.x1) before4++;
      }
      expect(before4, `run ${index}: ${grid}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("late reward rescues occur at a tuned rate, not as the default", () => {
    const climax = ROOM_BANDS[3]!;
    let rewardRuns = 0;
    const SAMPLE = 500;
    for (let index = 0; index < SAMPLE; index++) {
      const flat = dungeonAt(index).grid.join("");
      const hasLate = ["2", "3", "4"].some((tile) => {
        const x = flat.indexOf(tile) % DUNGEON_W;
        return x >= climax.x1 && x <= climax.x2;
      });
      if (hasLate) rewardRuns++;
    }
    // Designed rate is ~22%; deterministic seeds, so bounds are generous but firm.
    expect(rewardRuns / SAMPLE).toBeGreaterThan(0.1);
    expect(rewardRuns / SAMPLE).toBeLessThan(0.35);
  });

  it("trims the climax monster budget when a reward rescue is present", () => {
    const climax = ROOM_BANDS[3]!;
    for (let index = 0; index < RUNS; index++) {
      const grid = dungeonAt(index).grid;
      let monsters = 0;
      let rescue = false;
      for (const row of grid) {
        for (let x = climax.x1; x <= climax.x2; x++) {
          const ch = row[x]!;
          if ("gsrO".includes(ch)) monsters++;
          if ("234".includes(ch)) rescue = true;
        }
      }
      expect(monsters).toBeGreaterThan(0);
      if (rescue) expect(monsters, `run ${index}`).toBeLessThanOrEqual(3);
    }
  });

  it("uses featured traps as occasional single-room events", () => {
    const SAMPLE = 600;
    let trappedRuns = 0;
    const kinds = new Set<string>();
    for (let index = 0; index < SAMPLE; index++) {
      const dungeon = dungeonAt(index);
      expect(dungeon.traps.length).toBeLessThanOrEqual(1);
      expect(() => validateTraps(dungeon.traps)).not.toThrow();
      if (dungeon.traps[0]) {
        trappedRuns++;
        kinds.add(dungeon.traps[0].kind);
      }
    }
    const observedRate = trappedRuns / SAMPLE;
    expect(observedRate).toBeGreaterThan(FEATURED_TRAP_CHANCE - 0.1);
    expect(observedRate).toBeLessThan(FEATURED_TRAP_CHANCE + 0.1);
    expect(kinds).toEqual(
      new Set([
        "plate-gate",
        "alternating-spikes",
        "crusher-gallery",
        "dart-gallery",
        "counterweighted-lift",
        "light-runes",
        "undead-barrier",
        "flooded-chamber",
        "rolling-stone",
        "collapsing-floor",
      ]),
    );
  });

  it("rejects malformed grids", () => {
    const good = [...dungeonAt(0).grid];
    const noSpawn = good.map((row) => row.replace("P", "."));
    expect(() => validateGrid(noSpawn)).toThrow(/"P"/);
    const badTile = good.map((row, i) => (i === 8 ? `Z${row.slice(1)}` : row));
    expect(() => validateGrid(badTile)).toThrow(/Illegal tile/);
  });

  it("exposes a legal-tile alphabet the scene renderer agrees with", () => {
    for (const ch of ".#%=|^P234gsrOcGIKtnFDb*qvh:") {
      expect(LEGAL_TILES.has(ch), `tile ${ch}`).toBe(true);
    }
  });
});
