/**
 * Persistent ambience beds built from noise and filters — no loops, no assets.
 * Each bed returns a handle the caller owns; destroy() ramps out and releases
 * every node and timer. Poisson processes drive the aperiodic events (pops,
 * drips) so nothing ever sounds like it's on a loop.
 */

import { audioCtx, masterGain, reverbBus } from "./context";
import { noiseSource, startNoise, type NoiseKind } from "./noise";
import { waterPlink } from "./sfx";
import type { DungeonTheme } from "../level/dungeons";

export interface AmbienceHandle {
  /** The bed's output node — SpatialEmitter re-routes through this. */
  readonly gain: GainNode;
  setLevel(v: number): void;
  destroy(): void;
}

/** Exponentially distributed interval for a Poisson process (pure, testable). */
export function expInterval(meanMs: number, u: number): number {
  if (u < 0 || u >= 1) throw new Error(`u must be in [0,1), got ${u}`);
  return -meanMs * Math.log(1 - u);
}

/** Fire repeatedly at Poisson-random intervals; returns a cancel function. */
function poisson(meanMs: number, fire: () => void): () => void {
  let alive = true;
  let timer = 0;
  const schedule = () => {
    const delay = Math.max(30, expInterval(meanMs, Math.random()));
    timer = window.setTimeout(() => {
      if (!alive) return;
      fire();
      schedule();
    }, delay);
  };
  schedule();
  return () => {
    alive = false;
    clearTimeout(timer);
  };
}

const FADE_S = 0.6;

/** Shared bed scaffolding: level gain, fade-in/out, node + timer teardown. */
class Bed implements AmbienceHandle {
  readonly c = audioCtx();
  readonly gain: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly cancels: (() => void)[] = [];
  private readonly baseLevel: number;
  private levelScale = 1;

  constructor(baseLevel: number) {
    this.baseLevel = baseLevel;
    this.gain = this.c.createGain();
    this.gain.gain.setValueAtTime(0, this.c.currentTime);
    this.gain.gain.linearRampToValueAtTime(baseLevel, this.c.currentTime + FADE_S);
    this.gain.connect(masterGain());
    this.nodes.push(this.gain);
  }

  own<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  ownTimer(cancel: () => void): void {
    this.cancels.push(cancel);
  }

  /** A looped noise layer through an optional filter, into the bed gain. */
  loopedNoise(kind: NoiseKind, build?: (head: AudioNode) => AudioNode): AudioBufferSourceNode {
    const src = this.own(noiseSource(kind, { loop: true }));
    const tail = build ? build(src) : src;
    tail.connect(this.gain);
    startNoise(src);
    return src;
  }

  get level(): number {
    return this.baseLevel * this.levelScale;
  }

  setLevel(v: number): void {
    this.levelScale = v;
    this.gain.gain.setTargetAtTime(this.baseLevel * v, this.c.currentTime, 0.1);
  }

  destroy(): void {
    for (const cancel of this.cancels) cancel();
    const t = this.c.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, FADE_S / 4);
    window.setTimeout(() => {
      for (const n of this.nodes) n.disconnect();
    }, FADE_S * 1000);
  }
}

export interface WindOpts {
  level?: number;
  /** Lowpass center — lower reads darker/heavier air. */
  cutoffBase?: number;
  cutoffSwing?: number;
  lfoHz?: number;
}

/**
 * Whispering wind, straight from the design doc:
 * S(t) = white(t) × LPF(f_c(t)),  f_c(t) = base + swing·sin(2π·f_LFO·t)
 */
export function windBed(opts: WindOpts = {}): AmbienceHandle {
  const bed = new Bed(opts.level ?? 0.06);
  const base = opts.cutoffBase ?? 1200;
  const swing = opts.cutoffSwing ?? 800;
  bed.loopedNoise("white", (head) => {
    const lpf = bed.own(bed.c.createBiquadFilter());
    lpf.type = "lowpass";
    lpf.frequency.value = base;
    const lfo = bed.own(bed.c.createOscillator());
    lfo.frequency.value = opts.lfoHz ?? 0.13;
    const depth = bed.own(bed.c.createGain());
    depth.gain.value = swing;
    lfo.connect(depth).connect(lpf.frequency);
    lfo.start();
    head.connect(lpf);
    return lpf;
  });
  return bed;
}

export interface CrackleOpts {
  level?: number;
  /** Mean ms between pops (Poisson). */
  popMeanMs?: number;
  /** Rumble under the pops; 0 for a dry campfire-style crackle. */
  rumbleLevel?: number;
}

/**
 * Fire/lava: brown-noise rumble plus a Poisson process injecting ~10 ms
 * highpassed white bursts — the doc's bursting-bubble pops.
 */
export function crackleBed(opts: CrackleOpts = {}): AmbienceHandle {
  const bed = new Bed(opts.level ?? 0.5);
  const rumble = opts.rumbleLevel ?? 0.25;
  if (rumble > 0) {
    bed.loopedNoise("brown", (head) => {
      const lpf = bed.own(bed.c.createBiquadFilter());
      lpf.type = "lowpass";
      lpf.frequency.value = 200;
      const g = bed.own(bed.c.createGain());
      g.gain.value = rumble;
      head.connect(lpf).connect(g);
      return g;
    });
  }
  const hpf = bed.own(bed.c.createBiquadFilter());
  hpf.type = "highpass";
  hpf.frequency.value = 1800;
  hpf.connect(bed.gain);
  bed.ownTimer(
    poisson(opts.popMeanMs ?? 900, () => {
      const c = bed.c;
      const t = c.currentTime;
      const src = noiseSource("white", { loop: false });
      const g = c.createGain();
      const peak = 0.12 * (0.5 + Math.random());
      g.gain.setValueAtTime(peak, t);
      g.gain.setTargetAtTime(0, t + 0.004, 0.004);
      src.connect(g).connect(hpf);
      startNoise(src, t);
      src.stop(t + 0.03);
      src.onended = () => {
        src.disconnect();
        g.disconnect();
      };
    }),
  );
  return bed;
}

export interface DripOpts {
  /** Mean ms between drips (Poisson). */
  meanMs?: number;
  level?: number;
}

/** Cave water: Poisson-scheduled plinks, each with its own random pitch. */
export function dripBed(opts: DripOpts = {}): AmbienceHandle {
  const bed = new Bed(opts.level ?? 1);
  bed.ownTimer(
    poisson(opts.meanMs ?? 4000, () => {
      // Plinks are one-shots with their own cleanup; the bed's level scales them.
      waterPlink({ gain: 0.4 * bed.level, pan: Math.random() * 1.4 - 0.7 });
    }),
  );
  return bed;
}

/**
 * Two barely detuned low sines beating against each other — wrongness drone —
 * over a sub-octave partner for cavernous weight. A slow reverb send opens the
 * space up so it reads as a vast dark hollow rather than a tone in a vacuum.
 */
export function droneBed(opts: { level?: number; reverb?: number } = {}): AmbienceHandle {
  const bed = new Bed(opts.level ?? 0.035);
  for (const f of [55, 55.7, 27.5]) {
    const osc = bed.own(bed.c.createOscillator());
    osc.frequency.value = f;
    osc.connect(bed.gain);
    osc.start();
  }
  const send = opts.reverb ?? 0;
  if (send > 0) {
    const wet = bed.own(bed.c.createGain());
    wet.gain.value = send;
    bed.gain.connect(wet).connect(reverbBus());
  }
  return bed;
}

/** Each dungeon backdrop gets its own soundscape mix. */
export function themeAmbience(backdrop: DungeonTheme["backdrop"]): AmbienceHandle[] {
  switch (backdrop) {
    case "greek-temple":
      return [windBed({ level: 0.07 })];
    case "aztec":
      return [windBed({ level: 0.04 }), dripBed({ meanMs: 7000 })];
    case "natural-caverns":
      return [windBed({ level: 0.025, cutoffBase: 700, cutoffSwing: 400 }), dripBed({ meanMs: 2500 })];
    case "eldritch-depths":
      return [
        windBed({ level: 0.05, cutoffBase: 450, cutoffSwing: 250, lfoHz: 0.07 }),
        droneBed({ reverb: 0.5 }),
      ];
  }
}
