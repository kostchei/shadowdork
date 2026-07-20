/**
 * Central gameplay mode / input-scope controller.
 *
 * The dungeon used to track "is a modal thing open?" with a handful of
 * independent booleans (`gamePaused`, `startPaused`, `statsOverlayOpen`,
 * `gearOverlayOpen`, `shopOverlayOpen`, `gameOver`, `won`), each of which had to
 * remember to pause physics, pause animations, close the *other* overlays, and
 * hide its own HUD panel. Every new overlay multiplied the interactions.
 *
 * There is exactly one mode at a time. A transition always does the same four
 * things, in the same order:
 *
 *   1. Exit the outgoing mode (hide its overlay).
 *   2. Release every held action, so a key or finger held across the transition
 *      cannot leak into the mode being entered.
 *   3. Enter the incoming mode (show its overlay).
 *   4. Apply the incoming mode's world-pause policy (physics, animation, time).
 *
 * The controller is renderer-free: it talks to a {@link ModeHost} the scene
 * implements, so the transition rules are unit-testable without Phaser.
 */
export type GameMode =
  /** Title/briefing card before the run starts. World frozen. */
  | "briefing"
  /** Normal play. The only mode where the world ticks and world input applies. */
  | "playing"
  /** ESC menu: save/load/controls. */
  | "paused"
  /** Character sheet overlay. */
  | "stats"
  /** Inventory / equipment overlay. */
  | "gear"
  /** Safe-zone shop overlay. */
  | "shop"
  /** Vault cleared: summary, and possibly the scroll-destination choice. */
  | "victory"
  /** Party wiped. */
  | "gameover"
  /** Device held in portrait; the fixed-landscape canvas is unplayable. */
  | "orientation-blocked"
  /** Tab/window backgrounded (blur, hidden, or pagehide). */
  | "backgrounded";

/**
 * The scene-side effects a transition performs. Implemented by `DungeonScene`;
 * a fake stands in for it in tests.
 */
export interface ModeHost {
  /** Freeze or resume physics, animation, and engine time. */
  setWorldPaused(paused: boolean): void;
  /** Drop every action any source currently holds (keyboard keys, fingers). */
  releaseHeldInput(): void;
  /** Show the overlay that owns input in this mode (no-op for `playing`). */
  enterMode(mode: GameMode): void;
  /** Hide the overlay for the mode being left (no-op for `playing`). */
  exitMode(mode: GameMode): void;
  /** Suspend or resume the audio graph, tracking the world-pause policy. */
  setAudioSuspended(suspended: boolean): void;
}

/** Modes that freeze the world. Victory and game over deliberately let it run. */
const WORLD_PAUSING: ReadonlySet<GameMode> = new Set<GameMode>([
  "briefing",
  "paused",
  "stats",
  "gear",
  "shop",
  "orientation-blocked",
  "backgrounded",
]);

/** Dismissable overlays — the modes `toggle` can flip back to `playing`. */
const OVERLAY_MODES: ReadonlySet<GameMode> = new Set<GameMode>([
  "paused",
  "stats",
  "gear",
  "shop",
]);

/** Run-ending modes. Only a scene restart leaves them. */
const TERMINAL_MODES: ReadonlySet<GameMode> = new Set<GameMode>(["victory", "gameover"]);

/**
 * Externally-driven interrupts — not opened by a menu tap, but by the device
 * rotating or the tab losing focus. `enterInterrupt`/`exitInterrupt` (not
 * `toggle`) are how these are entered and left.
 */
const INTERRUPT_MODES: ReadonlySet<GameMode> = new Set<GameMode>(["orientation-blocked", "backgrounded"]);

/** True when the mode freezes physics, animation, and rules time. */
export function pausesWorld(mode: GameMode): boolean {
  return WORLD_PAUSING.has(mode);
}

/** True when the mode is a dismissable overlay rather than play or an ending. */
export function isOverlayMode(mode: GameMode): boolean {
  return OVERLAY_MODES.has(mode);
}

/** True when the run has ended and only a restart can leave the mode. */
export function isTerminalMode(mode: GameMode): boolean {
  return TERMINAL_MODES.has(mode);
}

/** True when the mode is an externally-driven interrupt (orientation, backgrounding). */
export function isInterruptMode(mode: GameMode): boolean {
  return INTERRUPT_MODES.has(mode);
}

export class ModeController {
  private current: GameMode;
  /** The mode an interrupt (orientation/backgrounding) suspended, for `exitInterrupt`. */
  private beforeInterrupt: GameMode | null = null;

  constructor(
    private readonly host: ModeHost,
    initial: GameMode = "briefing",
  ) {
    this.current = initial;
  }

  get mode(): GameMode {
    return this.current;
  }

  /** True while the current mode freezes the world. */
  get worldPaused(): boolean {
    return pausesWorld(this.current);
  }

  is(mode: GameMode): boolean {
    return this.current === mode;
  }

  isAny(...modes: readonly GameMode[]): boolean {
    return modes.includes(this.current);
  }

  /**
   * True when an overlay toggle (stats, gear, shop, pause) should be honoured:
   * during play, or while another overlay already owns input. A finished run
   * ignores them so the victory/game-over screen keeps input.
   */
  get acceptsOverlayToggle(): boolean {
    return this.current === "playing" || isOverlayMode(this.current);
  }

  /**
   * Enter `next`. Same mode is a no-op — transitions are never re-run, so an
   * overlay is not destroyed and rebuilt by a redundant call.
   *
   * A terminal mode (victory, game over) can only be left by `reset`, which the
   * scene does through a full restart; requesting any other mode from one is a
   * no-op rather than a silent state corruption.
   */
  set(next: GameMode): void {
    if (next === this.current) return;
    if (isTerminalMode(this.current) && !isTerminalMode(next)) return;
    const prev = this.current;
    this.current = next;
    this.host.exitMode(prev);
    this.host.releaseHeldInput();
    this.host.enterMode(next);
    const paused = pausesWorld(next);
    this.host.setWorldPaused(paused);
    this.host.setAudioSuspended(paused);
  }

  /**
   * Open `mode`, or close it back to `playing` if it is already the current
   * mode. This replaces the old "close whichever other overlay happens to be
   * open" chains: switching straight from gear to stats is one transition,
   * and mutual exclusion is structural rather than remembered.
   */
  toggle(mode: GameMode): void {
    this.set(this.current === mode ? "playing" : mode);
  }

  /**
   * Enter an externally-driven interrupt (device rotated to portrait, tab
   * backgrounded) — never a menu tap, so it goes through `set` like any other
   * transition but remembers what it interrupted. Layering interrupts (the
   * tab is backgrounded while already orientation-blocked) is a no-op: only
   * the first remembers the way back. A terminal mode is not interruptible —
   * victory/game-over already let the world run and have nothing to protect.
   */
  enterInterrupt(mode: "orientation-blocked" | "backgrounded"): void {
    if (isTerminalMode(this.current) || isInterruptMode(this.current)) return;
    this.beforeInterrupt = this.current;
    this.set(mode);
  }

  /**
   * Leave the current interrupt. No-op if not currently interrupted — the
   * caller is responsible for confirming the interrupting condition actually
   * cleared (e.g. checking both orientation *and* visibility before calling
   * this, so a tab regaining focus while still portrait-blocked does not
   * resume). Restores whatever mode was interrupted — except `playing`, which
   * lands on `paused` instead: gameplay never resumes on its own, only a
   * deliberate resume tap can restart it.
   */
  exitInterrupt(): void {
    if (!isInterruptMode(this.current) || this.beforeInterrupt === null) return;
    const restore = this.beforeInterrupt;
    this.beforeInterrupt = null;
    this.set(restore === "playing" ? "paused" : restore);
  }
}
