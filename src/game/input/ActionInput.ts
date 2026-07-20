/**
 * Semantic input service.
 *
 * Gameplay code asks about named *actions* ("moveLeft", "attack", "interact")
 * instead of physical keys. Any number of independent *sources* — a keyboard
 * key, an on-screen touch button, a second finger on a second button — can own
 * the same action at once, each identified by a stable source id.
 *
 * An action is `held` while at least one source owns it. `pressed` / `released`
 * are the frame edges of that *aggregate* ownership: `pressed` fires when the
 * owner count goes 0 -> >0, `released` when it goes >0 -> 0. Edges are cleared
 * by `endFrame`, which the owner calls once per update tick after all sources
 * have reported and all consumers have read.
 *
 * Touch never synthesises keyboard events: it reports ownership through the same
 * `press` / `release` API a keyboard source uses, so cancellation (a finger
 * lifting, the tab backgrounding, a mode transition) is uniform via
 * `releaseSource` / `releaseAll`.
 */
export class ActionInput<Action extends string = string> {
  /** action -> set of source ids currently owning it (empty sets are pruned lazily). */
  private readonly owners = new Map<Action, Set<string>>();
  private readonly pressedEdge = new Set<Action>();
  private readonly releasedEdge = new Set<Action>();

  /** A source begins owning an action. Idempotent per source. */
  press(action: Action, source: string): void {
    let set = this.owners.get(action);
    if (!set) {
      set = new Set();
      this.owners.set(action, set);
    }
    if (set.has(source)) return;
    const wasHeld = set.size > 0;
    set.add(source);
    if (!wasHeld) this.pressedEdge.add(action);
  }

  /** A source stops owning an action. No-op if it was not owning it. */
  release(action: Action, source: string): void {
    const set = this.owners.get(action);
    if (!set || !set.has(source)) return;
    set.delete(source);
    if (set.size === 0) this.releasedEdge.add(action);
  }

  /** Drive ownership from a boolean, for poll-style sources (a keyboard scan). */
  set(action: Action, source: string, down: boolean): void {
    if (down) this.press(action, source);
    else this.release(action, source);
  }

  /** True while at least one source owns the action. */
  held(action: Action): boolean {
    const set = this.owners.get(action);
    return set !== undefined && set.size > 0;
  }

  /** True on the tick the action's ownership rose from zero. */
  pressed(action: Action): boolean {
    return this.pressedEdge.has(action);
  }

  /** True on the tick the action's ownership fell to zero. */
  released(action: Action): boolean {
    return this.releasedEdge.has(action);
  }

  /** True while any of the listed actions is held (e.g. "any control down"). */
  anyHeld(actions: readonly Action[]): boolean {
    return actions.some((a) => this.held(a));
  }

  /** True on the tick any of the listed actions became held. */
  anyPressed(actions: readonly Action[]): boolean {
    return actions.some((a) => this.pressed(a));
  }

  /**
   * Release every action owned by a source — a finger lifting, or the keyboard
   * losing focus. Only actions that drop to zero owners emit a released edge.
   */
  releaseSource(source: string): void {
    for (const [action, set] of this.owners) {
      if (set.delete(source) && set.size === 0) this.releasedEdge.add(action);
    }
  }

  /**
   * Release everything, for mode transitions and backgrounding. Every currently
   * held action emits a released edge so consumers can react to the drop.
   */
  releaseAll(): void {
    for (const [action, set] of this.owners) {
      if (set.size > 0) {
        set.clear();
        this.releasedEdge.add(action);
      }
    }
  }

  /** Clear this tick's pressed/released edges. Call once at the end of update. */
  endFrame(): void {
    this.pressedEdge.clear();
    this.releasedEdge.clear();
  }
}
