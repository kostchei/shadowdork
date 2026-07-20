import { describe, expect, it } from "vitest";
import {
  ModeController,
  isInterruptMode,
  isOverlayMode,
  isTerminalMode,
  pausesWorld,
  type GameMode,
  type ModeHost,
} from "../src/game/modes/GameModeController";
import { ActionInput } from "../src/game/input/ActionInput";

/** Records every host call in order so transitions can be asserted as a sequence. */
function recordingHost() {
  const calls: string[] = [];
  const host: ModeHost = {
    setWorldPaused: (paused) => calls.push(`world:${paused ? "paused" : "running"}`),
    releaseHeldInput: () => calls.push("release"),
    enterMode: (mode) => calls.push(`enter:${mode}`),
    exitMode: (mode) => calls.push(`exit:${mode}`),
    setAudioSuspended: (suspended) => calls.push(`audio:${suspended ? "suspended" : "resumed"}`),
  };
  return { host, calls };
}

describe("mode classification", () => {
  it("pauses the world for the briefing, every overlay, and both interrupts", () => {
    for (const mode of [
      "briefing",
      "paused",
      "stats",
      "gear",
      "shop",
      "actionChoice",
      "orientation-blocked",
      "backgrounded",
    ] as GameMode[]) {
      expect(pausesWorld(mode)).toBe(true);
    }
  });

  it("lets the world run during play and after the run ends", () => {
    for (const mode of ["playing", "victory", "gameover"] as GameMode[]) {
      expect(pausesWorld(mode)).toBe(false);
    }
  });

  it("treats only the dismissable panels as overlays", () => {
    expect(isOverlayMode("gear")).toBe(true);
    expect(isOverlayMode("actionChoice")).toBe(true);
    expect(isOverlayMode("playing")).toBe(false);
    expect(isOverlayMode("briefing")).toBe(false);
    expect(isOverlayMode("victory")).toBe(false);
    expect(isOverlayMode("orientation-blocked")).toBe(false);
    expect(isOverlayMode("backgrounded")).toBe(false);
  });

  it("treats victory and game over as terminal", () => {
    expect(isTerminalMode("victory")).toBe(true);
    expect(isTerminalMode("gameover")).toBe(true);
    expect(isTerminalMode("paused")).toBe(false);
  });

  it("treats orientation-blocked and backgrounded as interrupts, nothing else", () => {
    expect(isInterruptMode("orientation-blocked")).toBe(true);
    expect(isInterruptMode("backgrounded")).toBe(true);
    expect(isInterruptMode("paused")).toBe(false);
    expect(isInterruptMode("playing")).toBe(false);
  });
});

describe("ModeController transitions", () => {
  it("starts in the mode it was given without touching the host", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "briefing");
    expect(modes.mode).toBe("briefing");
    expect(modes.worldPaused).toBe(true);
    expect(calls).toEqual([]);
  });

  it("exits, releases input, enters, then applies the pause and audio policy — in that order", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "playing");
    modes.set("gear");
    expect(calls).toEqual(["exit:playing", "release", "enter:gear", "world:paused", "audio:suspended"]);
  });

  it("releases held input on every transition so a key cannot leak across modes", () => {
    const actions = new ActionInput();
    const modes = new ModeController({
      setWorldPaused: () => {},
      releaseHeldInput: () => actions.releaseAll(),
      enterMode: () => {},
      exitMode: () => {},
      setAudioSuspended: () => {},
    }, "playing");

    actions.press("moveRight", "kb-D");
    expect(actions.held("moveRight")).toBe(true);
    modes.set("paused");
    expect(actions.held("moveRight")).toBe(false);
    expect(actions.released("moveRight")).toBe(true);
  });

  it("resumes the world and audio when returning to play", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "stats");
    modes.set("playing");
    expect(modes.worldPaused).toBe(false);
    expect(calls).toEqual(["exit:stats", "release", "enter:playing", "world:running", "audio:resumed"]);
  });

  it("is a no-op when asked for the mode it is already in", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "gear");
    modes.set("gear");
    expect(calls).toEqual([]);
  });

  it("makes overlays mutually exclusive in a single transition", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "gear");
    modes.set("stats");
    expect(modes.mode).toBe("stats");
    // The old code closed gear via a second toggle that re-ran the pause dance;
    // one transition now covers it.
    expect(calls).toEqual(["exit:gear", "release", "enter:stats", "world:paused", "audio:suspended"]);
  });

  it("toggles an overlay closed back to play", () => {
    const { host } = recordingHost();
    const modes = new ModeController(host, "playing");
    modes.toggle("stats");
    expect(modes.mode).toBe("stats");
    modes.toggle("stats");
    expect(modes.mode).toBe("playing");
  });

  it("toggling a different overlay switches rather than closing", () => {
    const { host } = recordingHost();
    const modes = new ModeController(host, "stats");
    modes.toggle("gear");
    expect(modes.mode).toBe("gear");
  });

  it("refuses to leave a terminal mode", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "playing");
    modes.set("gameover");
    calls.length = 0;
    modes.set("playing");
    modes.toggle("gear");
    expect(modes.mode).toBe("gameover");
    expect(calls).toEqual([]);
  });

  it("ignores overlay toggles once the run has ended", () => {
    const { host } = recordingHost();
    const modes = new ModeController(host, "playing");
    expect(modes.acceptsOverlayToggle).toBe(true);
    modes.set("victory");
    expect(modes.acceptsOverlayToggle).toBe(false);
  });

  it("ignores overlay toggles during the briefing", () => {
    const { host } = recordingHost();
    expect(new ModeController(host, "briefing").acceptsOverlayToggle).toBe(false);
  });

  it("accepts overlay toggles while another overlay is open", () => {
    const { host } = recordingHost();
    expect(new ModeController(host, "shop").acceptsOverlayToggle).toBe(true);
  });
});

describe("ModeController interrupts (orientation / backgrounding)", () => {
  it("remembers playing and restores to paused, never straight back to playing", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "playing");
    calls.length = 0;
    modes.enterInterrupt("backgrounded");
    expect(modes.mode).toBe("backgrounded");
    expect(calls).toEqual(["exit:playing", "release", "enter:backgrounded", "world:paused", "audio:suspended"]);

    calls.length = 0;
    modes.exitInterrupt();
    expect(modes.mode).toBe("paused");
    expect(calls).toEqual(["exit:backgrounded", "release", "enter:paused", "world:paused", "audio:suspended"]);
  });

  it("restores an open overlay exactly, not paused", () => {
    const { host } = recordingHost();
    const modes = new ModeController(host, "gear");
    modes.enterInterrupt("orientation-blocked");
    modes.exitInterrupt();
    expect(modes.mode).toBe("gear");
  });

  it("restores the briefing exactly", () => {
    const { host } = recordingHost();
    const modes = new ModeController(host, "briefing");
    modes.enterInterrupt("backgrounded");
    modes.exitInterrupt();
    expect(modes.mode).toBe("briefing");
  });

  it("a second interrupt while already interrupted is a no-op", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "playing");
    modes.enterInterrupt("backgrounded");
    calls.length = 0;
    modes.enterInterrupt("orientation-blocked");
    expect(modes.mode).toBe("backgrounded");
    expect(calls).toEqual([]);
    // The remembered mode is still the original one, not the no-op interrupt.
    modes.exitInterrupt();
    expect(modes.mode).toBe("paused");
  });

  it("exitInterrupt is a no-op when not currently interrupted", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "gear");
    modes.exitInterrupt();
    expect(modes.mode).toBe("gear");
    expect(calls).toEqual([]);
  });

  it("a terminal mode cannot be interrupted", () => {
    const { host, calls } = recordingHost();
    const modes = new ModeController(host, "victory");
    calls.length = 0;
    modes.enterInterrupt("backgrounded");
    expect(modes.mode).toBe("victory");
    expect(calls).toEqual([]);
  });

  it("releases held input on entering an interrupt, same as any transition", () => {
    const actions = new ActionInput();
    const modes = new ModeController(
      {
        setWorldPaused: () => {},
        releaseHeldInput: () => actions.releaseAll(),
        enterMode: () => {},
        exitMode: () => {},
        setAudioSuspended: () => {},
      },
      "playing",
    );
    actions.press("moveRight", "touch");
    modes.enterInterrupt("orientation-blocked");
    expect(actions.held("moveRight")).toBe(false);
  });
});

describe("on-screen taps through the same action service", () => {
  /** Mirrors the scene: press queued taps, run the tick, release them after. */
  function tick(actions: ActionInput, taps: string[], body: () => void): void {
    for (const action of taps) actions.press(action, "touch");
    try {
      body();
    } finally {
      for (const action of taps) actions.release(action, "touch");
      actions.endFrame();
    }
  }

  it("a tap reads as both pressed and held for exactly one tick", () => {
    const actions = new ActionInput();
    let sawPressed = false;
    let sawHeld = false;
    tick(actions, ["restart"], () => {
      sawPressed = actions.pressed("restart");
      sawHeld = actions.held("restart");
    });
    expect(sawPressed).toBe(true);
    expect(sawHeld).toBe(true);
    expect(actions.held("restart")).toBe(false);
    expect(actions.pressed("restart")).toBe(false);
  });

  it("a tap does not steal an action a key is still holding", () => {
    const actions = new ActionInput();
    actions.press("menuUp", "kb-UP");
    tick(actions, ["menuUp"], () => {});
    expect(actions.held("menuUp")).toBe(true);
  });

  it("a mode transition during the tick cancels the tap cleanly", () => {
    const actions = new ActionInput();
    tick(actions, ["gear"], () => {
      // A transition inside the tick releases everything; the post-tick release
      // of the tap must not then double-fire an edge.
      actions.releaseAll();
      expect(actions.held("gear")).toBe(false);
    });
    expect(actions.held("gear")).toBe(false);
  });
});
