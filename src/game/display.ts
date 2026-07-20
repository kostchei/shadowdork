/**
 * High-DPI rendering. The canvas framebuffer is the logical 960x540 game
 * multiplied by RENDER_SCALE, and every camera zooms by RENDER_SCALE, so
 * all gameplay and layout code keeps working in logical coordinates and
 * nothing changes apparent size. Text objects rasterise at RENDER_SCALE
 * (`resolution` in their style) so UI text is sharp while the pixel art
 * keeps its chunky integer scaling.
 */

export const GAME_W = 960;
export const GAME_H = 540;

/** `?dpr=N` forces the render scale, e.g. to test hi-DPI output on a 1x display. */
const override = new URLSearchParams(window.location.search).get("dpr");
if (override !== null && !(Number(override) > 0)) {
  throw new Error(`Invalid dpr override "${override}"`);
}

/**
 * Physical pixels per logical game pixel when the game fills the screen.
 * Derived from the *viewport* the canvas fits into (`innerWidth/Height`), not
 * `window.screen`: the fitted canvas only ever covers the browser viewport, so
 * sizing the framebuffer to the physical monitor over-allocates massively on
 * mobile — an 844x390 viewport was allocating a 3840x2160 (scale 4) framebuffer.
 */
const dpr = window.devicePixelRatio || 1;
const displayScale = Math.min(
  (window.innerWidth * dpr) / GAME_W,
  (window.innerHeight * dpr) / GAME_H,
);

/**
 * Coarse pointers (touch phones/tablets) are fill-rate and thermally bound and
 * gain little from a 4x framebuffer, so cap their automatic scale at 2. Desktop
 * stays capped at 4 (a full 4K frame) to bound the fill cost.
 */
const coarsePointer =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
const scaleCap = coarsePointer ? 2 : 4;

/** Framebuffer scale. `?dpr=N` overrides for testing hi-DPI on a 1x display. */
export const RENDER_SCALE =
  override !== null
    ? Number(override)
    : Math.min(scaleCap, Math.max(1, displayScale));
