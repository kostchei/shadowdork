/** Append-only event log. Every roll, XP award, and timer expiry is recorded here. */

export interface GameEvent {
  seq: number;
  /** Elapsed real-time ms at the moment of the event (engine clock, not wall clock). */
  atMs: number;
  type: string;
  data: Record<string, unknown>;
}

export class EventLog {
  private events: GameEvent[] = [];
  private seq = 0;
  private listeners: ((e: GameEvent) => void)[] = [];

  append(atMs: number, type: string, data: Record<string, unknown>): GameEvent {
    const e: GameEvent = { seq: this.seq++, atMs, type, data };
    this.events.push(e);
    for (const fn of this.listeners) fn(e);
    return e;
  }

  onEvent(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  all(): readonly GameEvent[] {
    return this.events;
  }

  /** Most recent events, newest last. */
  tail(n: number): readonly GameEvent[] {
    return this.events.slice(-n);
  }
}
