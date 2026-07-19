import { describe, expect, it } from "vitest";
import { VISUAL_SKINS, parseVisualSkinId, visualSkinById, visualSkinForRun } from "../src/game/visual/skins";
import { creviceGrime, domainWarp, fbm, latticeNoise, lipShadowAlpha, valueNoise } from "../src/game/visual/textures/math";

describe("visual skin catalog", () => {
  it("defines six complete three-skin zone packs", () => {
    expect(VISUAL_SKINS).toHaveLength(18);
    expect(new Set(VISUAL_SKINS.map((skin) => skin.id)).size).toBe(18);
    const zoneCounts = new Map<string, number>();
    for (const skin of VISUAL_SKINS) zoneCounts.set(skin.zone, (zoneCounts.get(skin.zone) ?? 0) + 1);
    expect([...zoneCounts.values()].sort()).toEqual([3, 3, 3, 3, 3, 3]);
  });

  it("keeps records visual-only and complete", () => {
    const forbidden = ["damage", "dc", "collision", "encounter", "reward", "danger", "movement"];
    for (const skin of VISUAL_SKINS) {
      expect(skin.displayName.length).toBeGreaterThan(3);
      expect(skin.roomNouns.length).toBeGreaterThanOrEqual(3);
      expect(new Set(skin.roomNouns).size).toBe(skin.roomNouns.length);
      for (const field of forbidden) expect(field in skin, `${skin.id}.${field}`).toBe(false);
      for (const color of Object.values(skin.palette)) {
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it("parses overrides strictly and selects future defaults deterministically", () => {
    expect(parseVisualSkinId("iron-fortress")).toBe("iron-fortress");
    expect(parseVisualSkinId("Iron-Fortress")).toBeUndefined();
    expect(parseVisualSkinId("unknown")).toBeUndefined();
    expect(parseVisualSkinId(null)).toBeUndefined();
    expect(visualSkinById("iron-fortress").zone).toBe("red-sands");
    for (const seed of [0, 1, 42, 0xffffffff]) {
      expect(visualSkinForRun(seed)).toBe(visualSkinForRun(seed));
    }
    for (let seed = 0; seed < 1_000; seed++) {
      expect(VISUAL_SKINS).toContain(visualSkinForRun(seed));
    }
  });
});

describe("procedural texture math", () => {
  it("is deterministic and bounded", () => {
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const lattice = latticeNoise(x, y, 17);
      expect(lattice).toBe(latticeNoise(x, y, 17));
      expect(lattice).toBeGreaterThanOrEqual(-1);
      expect(lattice).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x / 3, y / 3, 19))).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm(x / 3, y / 3, 23))).toBeLessThanOrEqual(1);
      expect(creviceGrime(x, y, 29)).toBeGreaterThanOrEqual(0);
      expect(creviceGrime(x, y, 29)).toBeLessThanOrEqual(1);
    }
  });

  it("warps within its requested amplitude and produces a decaying lip shadow", () => {
    const point = { x: 12, y: 18 };
    const warped = domainWarp(point, 31, 4, 0.05);
    expect(Math.abs(warped.x - point.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(warped.y - point.y)).toBeLessThanOrEqual(4);
    expect(lipShadowAlpha(-1)).toBe(0);
    expect(lipShadowAlpha(0)).toBeGreaterThan(lipShadowAlpha(2));
    expect(lipShadowAlpha(2)).toBeGreaterThan(lipShadowAlpha(5));
  });
});
