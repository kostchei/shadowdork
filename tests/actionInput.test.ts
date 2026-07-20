import { describe, it, expect, beforeEach } from "vitest";
import { ActionInput } from "../src/game/input/ActionInput";
import { KeyboardSource, type PolledKey } from "../src/game/input/KeyboardSource";
import { KEY_BINDINGS, START_DISMISS_ACTIONS, type GameAction } from "../src/game/input/actions";

describe("ActionInput core semantics", () => {
  let input: ActionInput<GameAction>;
  beforeEach(() => {
    input = new ActionInput<GameAction>();
  });

  it("press marks held and a pressed edge; edge clears next frame", () => {
    input.press("attack", "kb-J");
    expect(input.held("attack")).toBe(true);
    expect(input.pressed("attack")).toBe(true);
    expect(input.released("attack")).toBe(false);

    input.endFrame();
    // Still held while owned, but no longer a fresh press.
    expect(input.held("attack")).toBe(true);
    expect(input.pressed("attack")).toBe(false);
  });

  it("release marks a released edge and drops held", () => {
    input.press("attack", "kb-J");
    input.endFrame();
    input.release("attack", "kb-J");
    expect(input.held("attack")).toBe(false);
    expect(input.released("attack")).toBe(true);
    expect(input.pressed("attack")).toBe(false);
  });

  it("re-pressing an already-owned action does not emit a second edge", () => {
    input.press("moveLeft", "kb-A");
    input.endFrame();
    input.press("moveLeft", "kb-A"); // same source, still down
    expect(input.pressed("moveLeft")).toBe(false);
    expect(input.held("moveLeft")).toBe(true);
  });

  it("two sources own one action independently (keyboard parity for A + LEFT)", () => {
    input.press("moveLeft", "kb-A");
    expect(input.pressed("moveLeft")).toBe(true);
    input.endFrame();

    // Second source joins — no new press edge, action already held.
    input.press("moveLeft", "kb-LEFT");
    expect(input.pressed("moveLeft")).toBe(false);
    expect(input.held("moveLeft")).toBe(true);
    input.endFrame();

    // Releasing one source keeps the action held and emits no released edge.
    input.release("moveLeft", "kb-A");
    expect(input.held("moveLeft")).toBe(true);
    expect(input.released("moveLeft")).toBe(false);
    input.endFrame();

    // Releasing the last source finally releases the action.
    input.release("moveLeft", "kb-LEFT");
    expect(input.held("moveLeft")).toBe(false);
    expect(input.released("moveLeft")).toBe(true);
  });

  it("set(down) is press/release sugar and is idempotent while held", () => {
    input.set("cast", "kb-K", true);
    expect(input.pressed("cast")).toBe(true);
    input.endFrame();
    input.set("cast", "kb-K", true); // held across frames
    expect(input.pressed("cast")).toBe(false);
    input.set("cast", "kb-K", false);
    expect(input.released("cast")).toBe(true);
    expect(input.held("cast")).toBe(false);
  });

  it("releaseSource only releases actions that source owned", () => {
    input.press("moveLeft", "kb-A");
    input.press("attack", "kb-A"); // one physical key, two actions? modelled per source id
    input.press("moveLeft", "kb-LEFT");
    input.endFrame();

    input.releaseSource("kb-A");
    // moveLeft still owned by kb-LEFT.
    expect(input.held("moveLeft")).toBe(true);
    expect(input.released("moveLeft")).toBe(false);
    // attack was only kb-A → released.
    expect(input.held("attack")).toBe(false);
    expect(input.released("attack")).toBe(true);
  });

  it("releaseAll drops everything and emits released edges for held actions", () => {
    input.press("moveRight", "kb-D");
    input.press("attack", "kb-J");
    input.endFrame();

    input.releaseAll();
    expect(input.held("moveRight")).toBe(false);
    expect(input.held("attack")).toBe(false);
    expect(input.released("moveRight")).toBe(true);
    expect(input.released("attack")).toBe(true);
  });

  it("anyHeld / anyPressed aggregate over a set (start-dismiss gate)", () => {
    expect(input.anyHeld(START_DISMISS_ACTIONS)).toBe(false);
    input.press("moveUp", "kb-W");
    expect(input.anyHeld(START_DISMISS_ACTIONS)).toBe(true);
    expect(input.anyPressed(START_DISMISS_ACTIONS)).toBe(true);
    // A menu/system action must not trip the gate.
    input.releaseAll();
    input.endFrame();
    input.press("pause", "kb-ESC");
    expect(input.anyHeld(START_DISMISS_ACTIONS)).toBe(false);
  });
});

/** A fake key whose down-state the test flips, matching {@link PolledKey}. */
class FakeKey implements PolledKey {
  down = false;
  constructor(readonly name: string) {}
  isDown(): boolean {
    return this.down;
  }
}

const KEY_NAMES = [
  "A", "D", "W", "LEFT", "RIGHT", "UP", "DOWN", "SPACE",
  "J", "X", "CTRL", "K", "Q", "E", "T", "H", "L",
  "TAB", "ONE", "TWO", "THREE", "FOUR", "ESC", "M", "C", "I", "R",
] as const;
type KeyMap = { [K in (typeof KEY_NAMES)[number]]: FakeKey };

describe("KeyboardSource poll → action parity", () => {
  let input: ActionInput<GameAction>;
  let keys: KeyMap;
  let source: KeyboardSource<GameAction>;

  beforeEach(() => {
    input = new ActionInput<GameAction>();
    keys = Object.fromEntries(KEY_NAMES.map((n) => [n, new FakeKey(n)])) as KeyMap;
    source = new KeyboardSource(input, Object.values(keys), KEY_BINDINGS);
  });

  /** Mirror one frame: read keys, evaluate, clear edges. */
  const frame = () => {
    source.poll();
  };

  it("holding a movement key drives its action, releasing clears it", () => {
    keys.A.down = true;
    frame();
    expect(input.held("moveLeft")).toBe(true);
    expect(input.pressed("moveLeft")).toBe(true);
    input.endFrame();

    frame(); // still held
    expect(input.held("moveLeft")).toBe(true);
    expect(input.pressed("moveLeft")).toBe(false);
    input.endFrame();

    keys.A.down = false;
    frame();
    expect(input.held("moveLeft")).toBe(false);
    expect(input.released("moveLeft")).toBe(true);
  });

  it("A and LEFT both feed moveLeft; either alone keeps it held", () => {
    keys.A.down = true;
    keys.LEFT.down = true;
    frame();
    input.endFrame();
    keys.A.down = false;
    frame();
    expect(input.held("moveLeft")).toBe(true); // LEFT still down
    keys.LEFT.down = false;
    input.endFrame();
    frame();
    expect(input.held("moveLeft")).toBe(false);
  });

  it("J, X and CTRL all drive attack (held)", () => {
    for (const name of ["J", "X", "CTRL"] as const) {
      keys[name].down = true;
      frame();
      expect(input.held("attack")).toBe(true);
      keys[name].down = false;
      frame();
      input.endFrame();
    }
  });

  it("SPACE drives both moveUp and jumpOff", () => {
    keys.SPACE.down = true;
    frame();
    expect(input.held("moveUp")).toBe(true);
    expect(input.held("jumpOff")).toBe(true);
    expect(input.pressed("jumpOff")).toBe(true);
  });

  it("arrow keys double as menu navigation without W triggering menuUp", () => {
    keys.UP.down = true;
    frame();
    expect(input.pressed("menuUp")).toBe(true);
    expect(input.pressed("moveUp")).toBe(true);
    keys.UP.down = false;
    input.endFrame();
    frame();
    input.endFrame();

    keys.W.down = true;
    frame();
    expect(input.pressed("moveUp")).toBe(true);
    expect(input.held("menuUp")).toBe(false); // W is not bound to menuUp
  });

  it("R drives both rest (edge) and restart (held)", () => {
    keys.R.down = true;
    frame();
    expect(input.pressed("rest")).toBe(true);
    expect(input.held("restart")).toBe(true);
  });

  it("D drives moveRight and drop", () => {
    keys.D.down = true;
    frame();
    expect(input.held("moveRight")).toBe(true);
    expect(input.pressed("drop")).toBe(true);
  });

  it("every key in the poll set has at least one binding", () => {
    for (const name of KEY_NAMES) {
      expect(KEY_BINDINGS[name], `binding for ${name}`).toBeDefined();
    }
  });
});

describe("cancelling input that is still physically held", () => {
  let input: ActionInput<GameAction>;
  let keys: KeyMap;
  let source: KeyboardSource<GameAction>;

  beforeEach(() => {
    input = new ActionInput<GameAction>();
    keys = Object.fromEntries(KEY_NAMES.map((n) => [n, new FakeKey(n)])) as KeyMap;
    source = new KeyboardSource(input, Object.values(keys), KEY_BINDINGS);
  });

  /** What a mode transition does: drop ownership, then muzzle the held keys. */
  const cancel = () => {
    input.releaseAll();
    source.suppressHeldKeys();
  };

  it("does not re-press a key that was held through the cancellation", () => {
    keys.D.down = true;
    source.poll();
    expect(input.held("moveRight")).toBe(true);
    input.endFrame();

    cancel();
    source.poll();
    // D is still physically down, but must not read as a new press — this is the
    // walk-right-then-open-gear case, where D's other action is "drop".
    expect(input.held("drop")).toBe(false);
    expect(input.pressed("drop")).toBe(false);
    expect(input.held("moveRight")).toBe(false);
    input.endFrame();

    source.poll();
    expect(input.pressed("moveRight")).toBe(false);
  });

  it("lets the key act again once it is physically released and pressed anew", () => {
    keys.D.down = true;
    source.poll();
    input.endFrame();
    cancel();

    keys.D.down = false;
    source.poll();
    input.endFrame();

    keys.D.down = true;
    source.poll();
    expect(input.pressed("drop")).toBe(true);
    expect(input.held("moveRight")).toBe(true);
  });

  it("only suppresses keys that were actually down", () => {
    keys.A.down = true;
    cancel();
    keys.LEFT.down = true;
    source.poll();
    expect(input.pressed("moveLeft")).toBe(true); // LEFT was never suppressed
  });
});
