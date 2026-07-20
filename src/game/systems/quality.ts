/**
 * Runtime quality settings for the GPU/CPU-bound systems that scale worst on
 * phones: the two full-screen lighting render textures, cast-shadow leaning
 * math, and particle bursts. Lighting alone can approach ~95MB of framebuffer
 * at render scale 4 (see display.ts) before other GPU allocations, so coarse
 * pointers default to the cheaper tier.
 *
 * `?quality=low|high` overrides for testing, mirroring display.ts's `?dpr=`.
 */

import { RENDER_SCALE } from "../display";

export type QualityLevel = "high" | "low";

const hasWindow = typeof window !== "undefined";

const override = hasWindow ? new URLSearchParams(window.location.search).get("quality") : null;
if (override !== null && override !== "high" && override !== "low") {
  throw new Error(`Invalid quality override "${override}"`);
}

const coarsePointer =
  hasWindow && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

function deriveDefault(): QualityLevel {
  return coarsePointer || RENDER_SCALE <= 1.5 ? "low" : "high";
}

let current: QualityLevel = (override as QualityLevel | null) ?? deriveDefault();

export function qualityLevel(): QualityLevel {
  return current;
}

/** Called by mobile-preferences restore (see prefs.ts) once a saved choice loads. */
export function setQualityLevel(level: QualityLevel): void {
  current = level;
}

/** Lighting render textures draw at this fraction of the camera's device-pixel size. */
export function lightResolutionScale(): number {
  return current === "low" ? 0.5 : 1;
}

/** Lighting textures redraw every Nth tick (1 = every frame, unskipped). */
export function lightUpdateStride(): number {
  return current === "low" ? 2 : 1;
}

/** The additive colour-cast layer over lit areas — skippable, it's a second full texture pass. */
export function tintLayerEnabled(): boolean {
  return current === "high";
}

/** Leaning/stretching cast shadows fall back to cheap static "deep" pooling at low quality. */
export function castShadowsEnabled(): boolean {
  return current === "high";
}

/** Multiplier applied to particle/vfx spawn counts and emitter frequency. */
export function particleDensity(): number {
  return current === "low" ? 0.4 : 1;
}
