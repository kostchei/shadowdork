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
 * Derived from the monitor, not window.devicePixelRatio alone: a 4K display
 * at 100% OS scaling has a DPR of 1 but still shows the fitted canvas at 4x.
 */
const dpr = window.devicePixelRatio || 1;
const displayScale = Math.min(
  (window.screen.width * dpr) / GAME_W,
  (window.screen.height * dpr) / GAME_H,
);

/** Framebuffer scale, capped at 4 (a full 4K frame) to bound the fill cost. */
export const RENDER_SCALE =
  override !== null ? Number(override) : Math.min(4, Math.max(1, displayScale));
