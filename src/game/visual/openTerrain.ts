import type { RoomRegion } from "../level/geometry";
import type { VisualSkinId } from "./model";

export type OpenSurfaceTileRole = "surface-edge" | "support" | "overhang" | "hidden-ceiling";

export interface OpenTerrainSurvivalPressure {
  label: string;
  failureTitle: string;
  failureMessage: string;
}

export type DangerToken = "flag" | "sun" | "poison" | "snowflake";
export type DangerSaveStat = "DEX" | "CHA" | "CON" | "WIS";

export interface OpenTerrainDangerRule {
  token: DangerToken;
  icon: string;
  saveStats?: readonly [DangerSaveStat, DangerSaveStat];
  encounter?: string;
  failureTitle: string;
  failureMessage: string;
}

export const OPEN_TERRAIN_DANGER_DISTANCE_TILES = 12;
export const OPEN_TERRAIN_MAX_FLAGS = 4;

export type SafeZoneKind = "inn" | "brothel" | "cave-pool" | "oasis" | "rock-shelter";

export interface SafeZonePresentation {
  kind: SafeZoneKind;
  name: string;
}

export function safeZonePresentation(
  skinId: VisualSkinId | undefined,
  seed: number,
): SafeZonePresentation | undefined {
  switch (skinId) {
    case "rooftop-scamper":
      return (seed & 1) === 0
        ? { kind: "inn", name: "THE MASKED INN" }
        : { kind: "brothel", name: "THE VELVET HOUSE" };
    case "djurum-approach":
      return (seed & 1) === 0
        ? { kind: "cave-pool", name: "THE HIDDEN SPRING" }
        : { kind: "oasis", name: "THE PALM OASIS" };
    case "rime-sea-caves":
      return { kind: "rock-shelter", name: "THE FIRE OVERHANG" };
    default:
      return undefined;
  }
}

export function selectOpenTerrainRoomRoles(
  regions: readonly RoomRegion[],
  skinId: VisualSkinId | undefined,
  seed: number,
): { undergroundRoomId?: string; safeZoneRoomId?: string } {
  const primary = selectUndergroundRoomId(regions, seed);
  if (!primary || !skinId) return {};
  const presentation = safeZonePresentation(skinId, seed);
  if (!presentation) return {};

  // An open palm oasis cannot also be the underground room. Keep the setback
  // as the oasis and move the one tunnel room to the challenge beat.
  if (skinId === "djurum-approach" && presentation.kind === "oasis") {
    const alternate = regions.find((region) => region.beat === "challenge" && region.id !== primary)
      ?? regions.find((region) => region.id !== primary);
    return {
      safeZoneRoomId: primary,
      undergroundRoomId: alternate?.id ?? primary,
    };
  }
  return { safeZoneRoomId: primary, undergroundRoomId: primary };
}

export function openTerrainDangerDc(checkIndex: number): number {
  if (!Number.isInteger(checkIndex) || checkIndex < 0) throw new Error("Check index must be non-negative");
  return checkIndex === 0 ? 9 : checkIndex === 1 ? 12 : 15;
}

export function dangerRuleForSkin(
  skinId: VisualSkinId | undefined,
  daytime: boolean,
): OpenTerrainDangerRule | undefined {
  switch (skinId) {
    case "rooftop-scamper":
      return {
        token: "flag",
        icon: "⚑",
        saveStats: ["DEX", "CHA"],
        failureTitle: "THE CITY WATCH TAKES YOU",
        failureMessage: "Four watch patrols converge. There is nowhere left to run.",
      };
    case "djurum-approach":
      return daytime
        ? {
            token: "sun",
            icon: "☀",
            failureTitle: "YOU DIE OF THIRST",
            failureMessage: "Four stretches beneath the merciless sun exhaust your water.",
          }
        : {
            token: "poison",
            icon: "💧",
            saveStats: ["DEX", "CON"],
            encounter: "A hidden snake or scorpion strikes from the dark sand.",
            failureTitle: "VENOM TAKES YOU",
            failureMessage: "The fourth dose of desert venom stops the expedition.",
          };
    case "rime-sea-caves":
      return {
        token: "snowflake",
        icon: "❄",
        saveStats: ["WIS", "CON"],
        failureTitle: "YOU FREEZE TO DEATH",
        failureMessage: "The fourth mark of exposure is the last. The ice claims you.",
      };
    default:
      return undefined;
  }
}

const SURVIVAL_PRESSURES: Partial<Record<VisualSkinId, OpenTerrainSurvivalPressure>> = {
  "rooftop-scamper": {
    label: "CITY WATCH",
    failureTitle: "THE CITY WATCH TAKES YOU",
    failureMessage: "Lanterns surround the rooftop. The City Watch has caught you.",
  },
  "djurum-approach": {
    label: "THIRST",
    failureTitle: "YOU DIE OF THIRST",
    failureMessage: "Your water is gone. The desert takes the expedition.",
  },
  "rime-sea-caves": {
    label: "EXPOSURE",
    failureTitle: "YOU FREEZE TO DEATH",
    failureMessage: "The cold finally reaches your bones. The ice claims the expedition.",
  },
};

export function survivalPressureForSkin(
  skinId: VisualSkinId | undefined,
): OpenTerrainSurvivalPressure | undefined {
  return skinId ? SURVIVAL_PRESSURES[skinId] : undefined;
}

export function openTerrainSurvivalDurationMs(torchMs: number): number {
  if (torchMs <= 0) throw new Error("Torch duration must be positive");
  return torchMs * 2;
}

const isTerrainMass = (grid: readonly string[], x: number, y: number): boolean => {
  const cell = grid[y]?.[x];
  return cell === "#" || cell === "%";
};

/**
 * Classifies solid terrain by continuous support to the bottom of the field.
 * This works for buildings, desert ground, and ice floes: supported columns
 * expose one surface cap, while ceiling masses collapse to a thin overhang.
 */
export function openSurfaceTileRole(grid: readonly string[], x: number, y: number): OpenSurfaceTileRole {
  let supported = true;
  for (let scanY = y + 1; scanY < grid.length; scanY++) {
    if (!isTerrainMass(grid, x, scanY)) {
      supported = false;
      break;
    }
  }

  if (supported) return isTerrainMass(grid, x, y - 1) ? "support" : "surface-edge";
  return isTerrainMass(grid, x, y + 1) ? "hidden-ceiling" : "overhang";
}

/**
 * Picks the one enclosed room in an otherwise open-surface dungeon. The
 * setback is the natural descent beat; imported layouts without beats fall
 * back to a stable seed-based choice.
 */
export function selectUndergroundRoomId(
  regions: readonly RoomRegion[],
  seed: number,
): string | undefined {
  if (regions.length === 0) return undefined;
  return regions.find((region) => region.beat === "setback")?.id
    ?? regions[(seed >>> 0) % regions.length]!.id;
}
