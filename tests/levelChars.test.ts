import { describe, expect, it } from "vitest";
import DUNGEON_SOURCE from "../src/game/scenes/Dungeon.ts?raw";
import { DUNGEONS, LEGAL_TILES, dungeonAt, generateLayout } from "../src/game/level/dungeons";
import { expandDungeon } from "../src/game/level/expand";
import { generateAbstractDungeon } from "../src/game/level/generate";

/**
 * Legacy glyphs kept in LEGAL_TILES for backwards compatibility but rejected by
 * validateGrid, so no builder can emit them and the renderer need not draw them.
 */
const RETIRED_TILES = new Set(["2", "3", "4"]);

/** Every glyph the buildLevel switch has an explicit `case` for. */
function handledChars(): Set<string> {
  const body = DUNGEON_SOURCE.slice(
    DUNGEON_SOURCE.indexOf("private buildLevel"),
    DUNGEON_SOURCE.indexOf("Unknown level char"),
  );
  if (body.length === 0) throw new Error("Could not locate the buildLevel char switch");
  return new Set([...body.matchAll(/case "(.)":/g)].map((m) => m[1]!));
}

function charsIn(grid: readonly string[]): Set<string> {
  const seen = new Set<string>();
  for (const row of grid) for (const ch of row) seen.add(ch);
  return seen;
}

describe("level char coverage", () => {
  it("handles every legal tile glyph", () => {
    const handled = handledChars();
    for (const ch of LEGAL_TILES) {
      if (RETIRED_TILES.has(ch)) continue;
      expect(handled.has(ch), `buildLevel has no case for "${ch}"`).toBe(true);
    }
  });

  it("handles every glyph the hand-authored builders actually emit", () => {
    const handled = handledChars();
    const emitted = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const base = DUNGEONS[seed % DUNGEONS.length]!;
      for (const ch of charsIn(generateLayout(base.pools, seed, base.trapKinds).grid)) {
        emitted.add(ch);
      }
      for (const ch of charsIn(dungeonAt(seed).grid)) emitted.add(ch);
    }
    for (const ch of emitted) {
      expect(handled.has(ch), `buildLevel has no case for emitted "${ch}"`).toBe(true);
    }
    // The boss glyph is the one this test exists for: it must really show up.
    expect(emitted.has("O")).toBe(true);
  });

  it("handles every glyph the procedural expander emits", () => {
    const handled = handledChars();
    for (let seed = 0; seed < 40; seed++) {
      for (const ch of charsIn(expandDungeon(generateAbstractDungeon(seed)).grid)) {
        expect(handled.has(ch), `buildLevel has no case for expanded "${ch}"`).toBe(true);
      }
    }
  });
});
