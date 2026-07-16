/**
 * Time as a system: real-time ms (light sources), rounds (combat/death timers),
 * crawling rounds (exploration ticks). The game loop feeds advance(deltaMs);
 * the clock fires callbacks when timers expire and ticks condition durations.
 */

export interface EngineConfig {
  /** Real-time torch duration. Rules default: 1 hour. House-rule via config, not code. */
  torchMs: number;
  /** Real-time length of one combat round (death timers, cooldown pacing). */
  roundMs: number;
  /** Real-time length of one crawling round (exploration bookkeeping). */
  crawlingRoundMs: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  torchMs: 60 * 60 * 1000,
  roundMs: 3000,
  crawlingRoundMs: 10 * 60 * 1000,
};

export interface RealTimer {
  id: string;
  remainingMs: number;
  onExpire: () => void;
  paused: boolean;
}

export class GameClock {
  readonly config: EngineConfig;
  /** Total unpaused elapsed ms. */
  elapsedMs = 0;
  round = 0;
  crawlingRound = 0;
  paused = false;

  private roundAccum = 0;
  private crawlAccum = 0;
  private timers = new Map<string, RealTimer>();
  private roundListeners: (() => void)[] = [];
  private crawlListeners: (() => void)[] = [];

  constructor(config: EngineConfig = DEFAULT_CONFIG) {
    if (config.torchMs <= 0 || config.roundMs <= 0 || config.crawlingRoundMs <= 0) {
      throw new Error("All EngineConfig durations must be positive");
    }
    this.config = config;
  }

  onRound(fn: () => void): void {
    this.roundListeners.push(fn);
  }

  onCrawlingRound(fn: () => void): void {
    this.crawlListeners.push(fn);
  }

  addTimer(id: string, durationMs: number, onExpire: () => void): void {
    if (this.timers.has(id)) throw new Error(`Duplicate timer id "${id}"`);
    if (durationMs <= 0) throw new Error(`Timer "${id}" duration must be positive`);
    this.timers.set(id, { id, remainingMs: durationMs, onExpire, paused: false });
  }

  hasTimer(id: string): boolean {
    return this.timers.has(id);
  }

  timerRemaining(id: string): number {
    const t = this.timers.get(id);
    if (!t) throw new Error(`Unknown timer "${id}"`);
    return t.remainingMs;
  }

  cancelTimer(id: string): void {
    if (!this.timers.delete(id)) throw new Error(`Unknown timer "${id}"`);
  }

  setTimerPaused(id: string, paused: boolean): void {
    const t = this.timers.get(id);
    if (!t) throw new Error(`Unknown timer "${id}"`);
    t.paused = paused;
  }

  advance(deltaMs: number): void {
    if (deltaMs < 0) throw new Error(`deltaMs must be >= 0, got ${deltaMs}`);
    if (this.paused || deltaMs === 0) return;
    this.elapsedMs += deltaMs;

    this.roundAccum += deltaMs;
    while (this.roundAccum >= this.config.roundMs) {
      this.roundAccum -= this.config.roundMs;
      this.round++;
      for (const fn of this.roundListeners) fn();
    }

    this.crawlAccum += deltaMs;
    while (this.crawlAccum >= this.config.crawlingRoundMs) {
      this.crawlAccum -= this.config.crawlingRoundMs;
      this.crawlingRound++;
      for (const fn of this.crawlListeners) fn();
    }

    const expired: RealTimer[] = [];
    for (const t of this.timers.values()) {
      if (t.paused) continue;
      t.remainingMs -= deltaMs;
      if (t.remainingMs <= 0) expired.push(t);
    }
    for (const t of expired) {
      this.timers.delete(t.id);
      t.onExpire();
    }
  }
}
