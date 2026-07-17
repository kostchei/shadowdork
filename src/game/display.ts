/**
 * High-DPI rendering. The canvas framebuffer is the logical 960x540 game
 * multiplied by the device-pixel ratio, and every camera zooms by DPR, so
 * all gameplay and layout code keeps working in logical coordinates. Text
 * objects rasterise at DPR (`resolution` in their style) so UI text is
 * sharp while the pixel art keeps its chunky integer scaling.
 */

export const GAME_W = 960;
export const GAME_H = 540;

/** `?dpr=2` forces a ratio, so hi-DPI rendering can be tested on 1x displays. */
const override = new URLSearchParams(window.location.search).get("dpr");
if (override !== null && !(Number(override) > 0)) {
  throw new Error(`Invalid dpr override "${override}"`);
}

/** Capped at 2: beyond that the fill cost grows with no visible gain at this art scale. */
export const DPR = Math.min(override !== null ? Number(override) : window.devicePixelRatio || 1, 2);
