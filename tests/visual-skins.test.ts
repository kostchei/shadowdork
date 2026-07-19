import { describe, expect, it, vi } from "vitest";
import { VISUAL_SKINS, parseVisualSkinId, visualSkinById, visualSkinForRun } from "../src/game/visual/skins";
import {
  creviceGrime,
  curvatureDivergence,
  displaceShadow,
  domainWarp,
  fbm,
  heightFieldNormal,
  latticeNoise,
  lipShadowAlpha,
  roundedBoxSdf,
  sdfBevelHeight,
  valueNoise,
} from "../src/game/visual/textures/math";
import {
  openSurfaceTileRole,
  dangerRuleForSkin,
  openTerrainDangerDc,
  OPEN_TERRAIN_MAX_FLAGS,
  safeZonePresentation,
  selectOpenTerrainRoomRoles,
  selectUndergroundRoomId,
} from "../src/game/visual/openTerrain";

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

  it("builds rounded SDF bevels with stable normals and curvature", () => {
    expect(roundedBoxSdf({ x: 0, y: 0 }, { x: 8, y: 6 }, 2)).toBeLessThan(0);
    expect(roundedBoxSdf({ x: 9, y: 0 }, { x: 8, y: 6 }, 2)).toBeGreaterThan(0);
    expect(sdfBevelHeight(1, 3)).toBe(0);
    expect(sdfBevelHeight(-0.5, 3)).toBeLessThan(sdfBevelHeight(-2, 3));
    expect(sdfBevelHeight(-4, 3)).toBe(1);

    const plane = (x: number, y: number) => x * 0.25 + y * 0.1;
    const normal = heightFieldNormal(plane, 3, 4);
    expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 8);
    expect(normal.x).toBeLessThan(0);
    expect(normal.y).toBeLessThan(0);
    expect(curvatureDivergence(plane, 3, 4)).toBeCloseTo(0, 8);
  });

  it("displaces elevated shadows away from a normalized light direction", () => {
    const shadow = displaceShadow({ x: 10, y: 20 }, 4, { x: -3, y: -4 }, 2);
    expect(shadow.x).toBeCloseTo(14.8, 8);
    expect(shadow.y).toBeCloseTo(26.4, 8);
    expect(Math.hypot(shadow.x - 10, shadow.y - 20)).toBeCloseTo(8, 8);
    expect(displaceShadow({ x: 2, y: 3 }, 4, { x: 0, y: 0 })).toEqual({ x: 2, y: 3 });
  });
});

describe("ensureVisualSkinTextures", () => {
  it("generates unique skin textures for lead and open-surface skins", async () => {
    const { ensureVisualSkinTextures } = await import("../src/game/visual/textures/materials");
    const leadSkinIds = [
      "iron-fortress",
      "mugdulblub-keep",
      "djurum-approach",
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
      const openSky = ["djurum-approach", "rime-sea-caves", "rooftop-scamper"].includes(skinId);
      expect(keys.wall(0)).toBe(`skin-${skinId}-wall-0`);
      expect(keys.wall(1)).toBe(`skin-${skinId}-wall-1`);
      expect(keys.wall(wallVariantCount)).toBe(`skin-${skinId}-wall-0`);
      expect(keys.platform).toBe(`skin-${skinId}-platform`);
      expect(keys.weakWall).toBe(`skin-${skinId}-weak`);
      expect(keys.climb).toBe(`skin-${skinId}-climb`);
      expect(keys.portcullis).toBe(`skin-${skinId}-portcullis`);
      expect(keys.door).toBe(`skin-${skinId}-door`);
      expect(keys.backdrop).toBe(`skin-${skinId}-backdrop${openSky ? "-night" : ""}`);
      expect(keys.openSky).toBe(openSky || undefined);
      if (openSky) {
        expect(keys.supportWall?.(0)).toBe(`skin-${skinId}-support-0`);
        expect(keys.overhang).toBe(`skin-${skinId}-overhang`);
        expect(keys.climbBackdrop).toBe(`skin-${skinId}-support-1`);
        const dayKeys = ensureVisualSkinTextures(mockScene, skinRecord, "backdrop-temple", true);
        expect(dayKeys.backdrop).toBe(`skin-${skinId}-backdrop-day`);
      }
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
        ...(openSky
          ? [
              `skin-${skinId}-backdrop-day`,
              `skin-${skinId}-backdrop-night`,
              `skin-${skinId}-overhang`,
              ...Array.from({ length: 3 }, (_, variant) => `skin-${skinId}-support-${variant}`),
            ]
          : [keys.backdrop]),
        ...Object.values(keys.decorations),
      ]);
      expect(generatedKeys).toEqual(expectedKeys);
    }
  });
});

describe("open-surface terrain support", () => {
  const grid = [
    "#####",
    "##.##",
    "#...#",
    "#####",
  ];

  it("separates supported surfaces from façade mass", () => {
    expect(openSurfaceTileRole(grid, 0, 0)).toBe("surface-edge");
    expect(openSurfaceTileRole(grid, 0, 1)).toBe("support");
  });

  it("collapses unsupported ceiling mass to one exposed overhang", () => {
    expect(openSurfaceTileRole(grid, 1, 0)).toBe("hidden-ceiling");
    expect(openSurfaceTileRole(grid, 1, 1)).toBe("overhang");
    expect(openSurfaceTileRole(grid, 2, 0)).toBe("overhang");
  });

  it("makes the setback the single underground room in a five-room dungeon", () => {
    const regions = ["entrance", "challenge", "setback", "climax", "reward"].map((beat, index) => ({
      id: `room-${index + 1}`,
      title: beat,
      hud: beat,
      x1: index * 10,
      y1: 0,
      x2: index * 10 + 8,
      y2: 8,
      labelX: index * 10 + 4,
      beat: beat as "entrance" | "challenge" | "setback" | "climax" | "reward",
    }));

    for (const seed of [0, 1, 42, 0xffffffff]) {
      expect(selectUndergroundRoomId(regions, seed)).toBe("room-3");
    }
    expect(regions.filter((region) => region.id === selectUndergroundRoomId(regions, 42))).toHaveLength(1);
  });

  it("falls back deterministically for room layouts without narrative beats", () => {
    const regions = Array.from({ length: 5 }, (_, index) => ({
      id: `legacy-${index}`,
      title: "Legacy",
      hud: "Legacy",
      x1: index,
      y1: 0,
      x2: index,
      y2: 0,
      labelX: index,
    }));
    expect(selectUndergroundRoomId(regions, 7)).toBe("legacy-2");
    expect(selectUndergroundRoomId(regions, 7)).toBe(selectUndergroundRoomId(regions, 7));
    expect(selectUndergroundRoomId([], 7)).toBeUndefined();
  });

  it("escalates danger checks from DC 9 to 12 and then 15", () => {
    expect([0, 1, 2, 3, 20].map(openTerrainDangerDc)).toEqual([9, 12, 15, 15, 15]);
    expect(() => openTerrainDangerDc(-1)).toThrow(/non-negative/);
    expect(OPEN_TERRAIN_MAX_FLAGS).toBe(4);
  });

  it("uses biome icons and makes the desert safer at night", () => {
    expect(dangerRuleForSkin("rooftop-scamper", true)).toMatchObject({ icon: "⚑", saveStats: ["DEX", "CHA"] });
    const desertDay = dangerRuleForSkin("djurum-approach", true);
    expect(desertDay).toMatchObject({ icon: "☀" });
    expect(desertDay?.saveStats).toBeUndefined();
    expect(dangerRuleForSkin("djurum-approach", false)).toMatchObject({ icon: "💧", saveStats: ["DEX", "CON"] });
    expect(dangerRuleForSkin("rime-sea-caves", false)).toMatchObject({ icon: "❄", saveStats: ["WIS", "CON"] });
    expect(dangerRuleForSkin("canopy-village", true)).toMatchObject({ icon: "🍃", saveStats: ["DEX", "CON"] });
    expect(dangerRuleForSkin("rot-bramble", true)).toMatchObject({ icon: "🌫", saveStats: ["CON", "WIS"] });
    expect(dangerRuleForSkin("willowman-hollow", true)).toBeUndefined();
    expect(dangerRuleForSkin("iron-fortress", true)).toBeUndefined();
  });

  it("gives every open biome a named safe-zone shelter", () => {
    expect(safeZonePresentation("rooftop-scamper", 2)).toEqual({ kind: "inn", name: "THE MASKED INN" });
    expect(safeZonePresentation("rooftop-scamper", 3)).toEqual({ kind: "brothel", name: "THE VELVET HOUSE" });
    expect(safeZonePresentation("djurum-approach", 2)).toEqual({ kind: "cave-pool", name: "THE HIDDEN SPRING" });
    expect(safeZonePresentation("djurum-approach", 3)).toEqual({ kind: "oasis", name: "THE PALM OASIS" });
    expect(safeZonePresentation("rime-sea-caves", 0)?.kind).toBe("rock-shelter");
    expect(safeZonePresentation("canopy-village", 0)?.kind).toBe("rock-shelter");
    expect(safeZonePresentation("rot-bramble", 0)?.kind).toBe("inn");
    expect(safeZonePresentation("willowman-hollow", 0)).toBeUndefined();
    expect(safeZonePresentation("iron-fortress", 0)).toBeUndefined();
  });

  it("never puts the desert palm oasis inside its underground room", () => {
    const regions = ["entrance", "challenge", "setback", "climax", "reward"].map((beat, index) => ({
      id: `room-${index + 1}`,
      title: beat,
      hud: beat,
      x1: index,
      y1: 0,
      x2: index,
      y2: 0,
      labelX: index,
      beat: beat as "entrance" | "challenge" | "setback" | "climax" | "reward",
    }));
    const cave = selectOpenTerrainRoomRoles(regions, "djurum-approach", 2);
    expect(cave.safeZoneRoomId).toBe(cave.undergroundRoomId);
    const oasis = selectOpenTerrainRoomRoles(regions, "djurum-approach", 3);
    expect(oasis.safeZoneRoomId).toBe("room-3");
    expect(oasis.undergroundRoomId).toBe("room-2");
    expect(oasis.safeZoneRoomId).not.toBe(oasis.undergroundRoomId);
  });
});
