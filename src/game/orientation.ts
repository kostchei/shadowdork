/**
 * Landscape orientation gate. The game's canvas is a fixed 960x540 landscape
 * aspect; on a phone held in portrait it's unplayable. `index.html` shows a
 * pure-CSS "rotate your device" overlay off the same query so it appears
 * before any script runs — this module drives the matching in-game pause
 * (the "orientation-blocked" mode) so gameplay time and input don't advance
 * underneath it. Keep the query string identical to the one in index.html.
 */

const QUERY = "(orientation: portrait) and (pointer: coarse)";

const mql =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;

/** True while the game should be gated behind the rotate-device prompt. */
export function isPortraitBlocked(): boolean {
  return mql?.matches ?? false;
}

/** Subscribe to gate state changes. Returns an unsubscribe function. */
export function onOrientationChange(callback: (blocked: boolean) => void): () => void {
  if (!mql) return () => {};
  const handler = () => callback(mql.matches);
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}
