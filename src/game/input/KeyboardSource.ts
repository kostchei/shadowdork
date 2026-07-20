import type { ActionInput } from "./ActionInput";

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
      const down = key.isDown();
      const source = `kb-${key.name}`;
      for (const action of actions) this.input.set(action, source, down);
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
