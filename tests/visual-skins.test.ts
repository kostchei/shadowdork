import { describe, expect, it, vi } from "vitest";
import { VISUAL_SKINS, parseVisualSkinId, visualSkinById, visualSkinForRun } from "../src/game/visual/skins";
import { creviceGrime, domainWarp, fbm, latticeNoise, lipShadowAlpha, valueNoise } from "../src/game/visual/textures/math";

vi.mock("phaser", () => ({
  default: {
    Geom: {
      Point: class Point {
        constructor(public x: number, public y: number) {}
      },
    },
  },
}));


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

describe("ensureVisualSkinTextures", () => {
  it("generates unique skin textures for all six vertical slice lead skins", async () => {
    const { ensureVisualSkinTextures } = await import("../src/game/visual/textures/materials");
    const leadSkinIds = [
      "iron-fortress",
      "mugdulblub-keep",
      "rime-sea-caves",
      "overgrown-basalt-ziggurat",
      "nuln-fungal-grottos",
      "rooftop-scamper",
    ] as const;

    for (const skinId of leadSkinIds) {
      const generatedKeys = new Set<string>();
      const mockScene = {
        textures: {
          exists: (key: string) => generatedKeys.has(key),
        },
        add: {
          graphics: () => ({
            fillStyle: () => {},
            fillRect: () => {},
            fillCircle: () => {},
            fillTriangle: () => {},
            fillPoints: () => {},
            lineStyle: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            strokePath: () => {},
            strokeRect: () => {},
            strokePoints: () => {},
            lineBetween: () => {},
            arc: () => {},
            generateTexture: (key: string) => { generatedKeys.add(key); },
            destroy: () => {},
          }),
        },
      } as unknown as import("phaser").Scene;

      const skinRecord = visualSkinById(skinId);
      const keys = ensureVisualSkinTextures(mockScene, skinRecord, "backdrop-temple");
      const wallVariantCount = skinId === "rooftop-scamper" ? 2 : 3;
      expect(keys.wall(0)).toBe(`skin-${skinId}-wall-0`);
      expect(keys.wall(1)).toBe(`skin-${skinId}-wall-1`);
      expect(keys.wall(wallVariantCount)).toBe(`skin-${skinId}-wall-0`);
      expect(keys.platform).toBe(`skin-${skinId}-platform`);
      expect(keys.weakWall).toBe(`skin-${skinId}-weak`);
      expect(keys.climb).toBe(`skin-${skinId}-climb`);
      expect(keys.portcullis).toBe(`skin-${skinId}-portcullis`);
      expect(keys.door).toBe(`skin-${skinId}-door`);
      expect(keys.backdrop).toBe(`skin-${skinId}-backdrop`);
      expect(keys.decorations.mushrooms).toBe(`skin-${skinId}-gong`);
      expect(keys.decorations.bones).toBe(`skin-${skinId}-rack`);
      expect(keys.decorations.banner).toBe(`skin-${skinId}-banner`);
      expect(keys.decorations.stalactite).toBe(`skin-${skinId}-crenel`);
      const expectedKeys = new Set([
        ...Array.from({ length: wallVariantCount }, (_, variant) => `skin-${skinId}-wall-${variant}`),
        keys.platform,
        keys.weakWall,
        keys.climb,
        keys.portcullis,
        keys.door,
        keys.backdrop,
        ...Object.values(keys.decorations),
      ]);
      expect(generatedKeys).toEqual(expectedKeys);
    }
  });
});
