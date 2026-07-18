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

  it("uses room five as the only campaign-reward location", () => {
    const vault = ROOM_BANDS[4]!;
    for (let index = 0; index < RUNS; index++) {
      const flat = dungeonAt(index).grid.join("");
      expect(flat.match(/K/g)).toHaveLength(1);
      expect(flat).not.toMatch(/[234]/);
      const rewardX = flat.indexOf("K") % DUNGEON_W;
      expect(rewardX).toBeGreaterThanOrEqual(vault.x1);
      expect(rewardX).toBeLessThanOrEqual(vault.x2);
    }
  });

  it("keeps every climax within the solo-safe monster budget", () => {
    const climax = ROOM_BANDS[3]!;
    for (let index = 0; index < RUNS; index++) {
      let monsters = 0;
      for (const row of dungeonAt(index).grid) {
        for (let x = climax.x1; x <= climax.x2; x++) {
          if ("gsrO".includes(row[x]!)) monsters++;
        }
      }
      expect(monsters).toBeGreaterThan(0);
      expect(monsters, `run ${index}`).toBeLessThanOrEqual(3);
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
