import type { ActionInput } from "./ActionInput";
import { noteKeyboardActivity } from "./inputFamily";

/**
 * A physical key the {@link KeyboardSource} scans each tick. `name` is the key
 * name used in the binding table; `isDown` reports its current state. Phaser's
 * `Key` exposes `isDown` as a boolean field, and the raw ControlLeft flag is
 * wrapped the same way, so both feed this uniform shape.
 */
export interface PolledKey {
  readonly name: string;
  isDown(): boolean;
}

/**
 * Drives an {@link ActionInput} from a set of polled keyboard keys and a binding
 * table. Each tick, `poll` scans every key and reports ownership of every action
 * that key drives, using a per-key source id (`kb-<NAME>`) so that two keys
 * bound to one action own it independently — releasing A while LEFT is still
 * held keeps `moveLeft` held, exactly like a second finger would.
 *
 * It does not read Phaser's `JustDown`: edges are derived by {@link ActionInput}
 * from the aggregate ownership transitions, which keeps keyboard and touch on
 * one code path.
 */
export class KeyboardSource<Action extends string> {
  /** Keys held through a cancellation, ignored until they are physically released. */
  private readonly suppressed = new Set<string>();

  constructor(
    private readonly input: ActionInput<Action>,
    private readonly keys: readonly PolledKey[],
    private readonly bindings: Readonly<Record<string, readonly Action[]>>,
  ) {}

  /** Report current key state into the action input. Call once at tick start. */
  poll(): void {
    for (const key of this.keys) {
      const actions = this.bindings[key.name];
      if (!actions) continue;
      let down = key.isDown();
      const suppressed = this.suppressed.has(key.name);
      if (suppressed) {
        // Still held from before the cancellation: keep reporting "up" until it
        // is physically released, then let it act again.
        if (!down) this.suppressed.delete(key.name);
        down = false;
      }
      if (down) noteKeyboardActivity();
      const source = `kb-${key.name}`;
      for (const action of actions) this.input.set(action, source, down);
    }
  }

  /**
   * Cancel every key that is currently down, so that a mode transition (or the
   * tab backgrounding) does not simply see them re-pressed on the next poll.
   *
   * Without this, releasing held actions on a transition is worse than useless:
   * a polled key would immediately re-assert ownership, which the semantic layer
   * reads as a brand-new *press* edge in the mode just entered. Walking right
   * with D held and opening the gear panel would fire D's `drop` action and
   * throw the leader's weapon on the floor.
   */
  suppressHeldKeys(): void {
    for (const key of this.keys) {
      if (key.isDown()) this.suppressed.add(key.name);
    }
  }
}

/** Something with a boolean `isDown` field — Phaser's `Key`, without the dependency. */
interface DownFlag {
  isDown: boolean;
}

/**
 * Build {@link PolledKey}s from a Phaser `addKeys` record plus any extra keys
 * fed from raw listeners (e.g. ControlLeft). Keeps `KeyboardSource` free of a
 * Phaser import so it stays unit-testable.
 */
export function polledKeysFrom(
  keys: Record<string, DownFlag>,
  extra: readonly PolledKey[] = [],
): PolledKey[] {
  const polled: PolledKey[] = Object.entries(keys).map(([name, key]) => ({
    name,
    isDown: () => key.isDown,
  }));
  return [...polled, ...extra];
}
