/**
 * Which input family produced the most recent action — used to show or hide
 * hard-coded key-hint copy ("(ESC)", "Up/Down select | E use/equip | ...")
 * that's dead weight once a player is actually driving the game by touch.
 * Starts from a coarse-pointer guess and flips the instant either family is
 * actually used, so a hybrid device (a touchscreen laptop) tracks whichever
 * the player is really doing right now.
 */

export type InputFamily = "keyboard" | "touch";

const coarsePointer =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

let family: InputFamily = coarsePointer ? "touch" : "keyboard";

export function currentInputFamily(): InputFamily {
  return family;
}

export function noteKeyboardActivity(): void {
  family = "keyboard";
}

export function noteTouchActivity(): void {
  family = "touch";
}
