/**
 * One-shot foley synthesized from primitives — FM strikes, noise bursts, and
 * enveloped sines. Every call jitters its parameters so no two fires are ever
 * identical (kills the machine-gun repetition of canned samples).
 *
 * Randomness here is Math.random on purpose: sound is cosmetic and must never
 * touch the engine's seeded dice. Every one-shot cleans up its own nodes.
 */

import { audioCtx, masterGain } from "./context";
import { noiseSource, startNoise, type NoiseKind } from "./noise";

export interface SfxOpts {
  /** Linear gain multiplier (e.g. spatial distance attenuation). */
  gain?: number;
  /** Stereo position, -1 hard left … 1 hard right. */
  pan?: number;
  /** Lowpass cutoff in Hz for distance muffling; omit for full brightness. */
  cutoff?: number;
}

function jitter(v: number, pct: number): number {
  return v * (1 + (Math.random() * 2 - 1) * pct);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Per-shot scaffolding: builds the output chain (lowpass? → panner? → master),
 * tracks every node, and tears the whole graph down when the anchor source ends.
 */
class Shot {
  readonly c: AudioContext;
  readonly t0: number;
  readonly dest: AudioNode;
  private readonly nodes: AudioNode[] = [];

  constructor(opts: SfxOpts) {
    this.c = audioCtx();
    this.t0 = this.c.currentTime;
    let head: AudioNode = masterGain();
    if (opts.pan !== undefined && opts.pan !== 0) {
      const p = this.c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(head);
      this.nodes.push(p);
      head = p;
    }
    if (opts.cutoff !== undefined) {
      const f = this.c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.cutoff;
      f.connect(head);
      this.nodes.push(f);
      head = f;
    }
    this.dest = head;
  }

  own<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  /** τ-style exponential decay: setTargetAtTime IS e^(-t/τ) on the AudioParam. */
  decayGain(peak: number, tau: number, at = this.t0): GainNode {
    const g = this.own(this.c.createGain());
    g.gain.setValueAtTime(0, this.t0);
    g.gain.setValueAtTime(peak, at);
    g.gain.setTargetAtTime(0, at, tau);
    return g;
  }

  /** The last-stopping source anchors cleanup for the whole shot. */
  finish(anchor: AudioScheduledSourceNode, stopAt: number): void {
    anchor.stop(stopAt);
    anchor.onended = () => {
      for (const n of this.nodes) n.disconnect();
    };
  }
}

/**
 * The workhorse metallic voice — FM synthesis per the design doc:
 * S(t) = e^(-t/τd) · sin(2π·fc·t + I·e^(-t/τm) · sin(2π·fm·t))
 * Inharmonic carrier:modulator ratios (√2 etc.) give the bell/clang character.
 */
interface FmStrikeCfg {
  fc: number;
  ratio: number;
  /** Peak frequency deviation in Hz (modulation index × fm). */
  deviation: number;
  modTau: number;
  ampTau: number;
  peak: number;
  delay?: number;
}

function fmStrike(shot: Shot, cfg: FmStrikeCfg, opts: SfxOpts): AudioScheduledSourceNode {
  const { c } = shot;
  const at = shot.t0 + (cfg.delay ?? 0);
  const fm = cfg.fc * cfg.ratio;

  const mod = shot.own(c.createOscillator());
  mod.frequency.value = fm;
  const modDepth = shot.own(c.createGain());
  modDepth.gain.setValueAtTime(cfg.deviation, at);
  modDepth.gain.setTargetAtTime(0, at, cfg.modTau);
  mod.connect(modDepth);

  const carrier = shot.own(c.createOscillator());
  carrier.frequency.value = cfg.fc;
  modDepth.connect(carrier.frequency);

  const amp = shot.decayGain(cfg.peak * (opts.gain ?? 1), cfg.ampTau, at);
  carrier.connect(amp).connect(shot.dest);

  const stopAt = at + cfg.ampTau * 8;
  mod.start(at);
  mod.stop(stopAt);
  carrier.start(at);
  carrier.stop(stopAt);
  return carrier;
}

interface BurstCfg {
  kind: NoiseKind;
  duration: number;
  peak: number;
  filter?: { type: BiquadFilterType; from: number; to?: number };
  delay?: number;
}

/** A short filtered noise burst — grit, splashes, pops. */
function noiseBurst(shot: Shot, cfg: BurstCfg, opts: SfxOpts): AudioScheduledSourceNode {
  const { c } = shot;
  const at = shot.t0 + (cfg.delay ?? 0);
  const src = shot.own(noiseSource(cfg.kind, { loop: false }));
  let head: AudioNode = src;
  if (cfg.filter) {
    const f = shot.own(c.createBiquadFilter());
    f.type = cfg.filter.type;
    f.frequency.setValueAtTime(cfg.filter.from, at);
    if (cfg.filter.to !== undefined) {
      f.frequency.exponentialRampToValueAtTime(cfg.filter.to, at + cfg.duration);
    }
    head.connect(f);
    head = f;
  }
  const amp = shot.own(c.createGain());
  const peak = cfg.peak * (opts.gain ?? 1);
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(peak, at + 0.005);
  amp.gain.setTargetAtTime(0, at + cfg.duration * 0.4, cfg.duration * 0.3);
  head.connect(amp).connect(shot.dest);
  startNoise(src, at);
  src.stop(at + cfg.duration + 0.1);
  return src;
}

/** A decaying sine partial (thuds, chimes, plinks). */
interface SineCfg {
  freq: number;
  tau: number;
  peak: number;
  /** Multiply frequency by this over the partial's life (plink chirp). */
  glideTo?: number;
  delay?: number;
}

function sinePartial(shot: Shot, cfg: SineCfg, opts: SfxOpts): AudioScheduledSourceNode {
  const at = shot.t0 + (cfg.delay ?? 0);
  const osc = shot.own(shot.c.createOscillator());
  osc.frequency.setValueAtTime(cfg.freq, at);
  if (cfg.glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(cfg.freq * cfg.glideTo, at + cfg.tau * 4);
  }
  const amp = shot.decayGain(cfg.peak * (opts.gain ?? 1), cfg.tau, at);
  osc.connect(amp).connect(shot.dest);
  osc.start(at);
  osc.stop(at + cfg.tau * 8);
  return osc;
}

// ── Combat ────────────────────────────────────────────────────────────────────

/** Sword on flesh-and-bone-and-armor: the doc's metallic FM clang. */
export function swordClang(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const fc = jitter(520, 0.15);
  const anchor = fmStrike(
    shot,
    {
      fc,
      ratio: 1.414 + rand(-0.05, 0.05),
      deviation: fc * rand(3, 5),
      modTau: 0.06,
      ampTau: jitter(0.22, 0.2),
      peak: 0.3,
    },
    opts,
  );
  shot.finish(anchor, shot.t0 + 2);
}

/** Crit: the clang plus a second inharmonic partial, ringing longer and higher. */
export function swordCrit(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const fc = jitter(660, 0.1);
  fmStrike(
    shot,
    { fc, ratio: 1.414, deviation: fc * 4, modTau: 0.08, ampTau: 0.4, peak: 0.28 },
    opts,
  );
  const anchor = fmStrike(
    shot,
    { fc: fc * 2.76, ratio: 1.34, deviation: fc, modTau: 0.12, ampTau: 0.5, peak: 0.12 },
    opts,
  );
  shot.finish(anchor, shot.t0 + 4);
}

/** Blunt impact — a monster's claw or a fist landing. */
export function thud(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  noiseBurst(
    shot,
    { kind: "pink", duration: 0.06, peak: 0.25, filter: { type: "lowpass", from: 400 } },
    opts,
  );
  const anchor = sinePartial(shot, { freq: jitter(90, 0.2), tau: 0.12, peak: 0.5 }, opts);
  shot.finish(anchor, shot.t0 + 1.2);
}

/** A miss — air parting around the blade. */
export function whoosh(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const anchor = noiseBurst(
    shot,
    {
      kind: "white",
      duration: jitter(0.14, 0.2),
      peak: 0.3,
      filter: { type: "bandpass", from: 400, to: 1400 },
    },
    opts,
  );
  shot.finish(anchor, shot.t0 + 0.5);
}

// ── Movement ──────────────────────────────────────────────────────────────────

/** Boot on stone: grit burst + heel thud, per the doc's footstep recipe. */
export function footstep(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  noiseBurst(
    shot,
    {
      kind: "pink",
      duration: rand(0.04, 0.08),
      peak: 0.08,
      filter: { type: "lowpass", from: jitter(1100, 0.2) },
    },
    opts,
  );
  const anchor = sinePartial(shot, { freq: 60, tau: 0.045, peak: 0.22 }, opts);
  shot.finish(anchor, shot.t0 + 0.6);
}

/** A hard landing after a real drop. */
export function landThud(opts: SfxOpts = {}): void {
  thud({ ...opts, gain: (opts.gain ?? 1) * 0.8 });
}

// ── Water ─────────────────────────────────────────────────────────────────────

/** The doc's plink: sine × fast exponential decay with a slight upward chirp. */
export function waterPlink(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const anchor = sinePartial(
    shot,
    { freq: jitter(900, 0.3), tau: 0.05, peak: 0.2, glideTo: 1.3 },
    opts,
  );
  shot.finish(anchor, shot.t0 + 0.6);
}

/** A torch (or a body) hitting water. */
export function splash(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const anchor = noiseBurst(
    shot,
    { kind: "white", duration: 0.4, peak: 0.3, filter: { type: "lowpass", from: 900 } },
    opts,
  );
  shot.finish(anchor, shot.t0 + 0.8);
  const trailing = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < trailing; i++) {
    setTimeout(() => waterPlink({ ...opts, gain: (opts.gain ?? 1) * 0.5 }), rand(120, 450));
  }
}

// ── Interactions ──────────────────────────────────────────────────────────────

/** Pickup sparkle: two clean additive partials; jewels get a third, higher voice. */
export function pickupChime(jewel: boolean, opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const base = jitter(jewel ? 1320 : 880, 0.05);
  sinePartial(shot, { freq: base, tau: 0.25, peak: 0.14 }, opts);
  const anchor = sinePartial(shot, { freq: base * 2.01, tau: 0.2, peak: 0.07 }, opts);
  if (jewel) sinePartial(shot, { freq: base * 3.02, tau: 0.3, peak: 0.05 }, opts);
  shot.finish(anchor, shot.t0 + 2);
}

/** Spike trap: a vicious short metallic stab, then the impact. */
export function spikeTrap(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const fc = jitter(1400, 0.15);
  fmStrike(
    shot,
    { fc, ratio: 3.7, deviation: fc * 5, modTau: 0.02, ampTau: 0.06, peak: 0.3 },
    opts,
  );
  const anchor = sinePartial(shot, { freq: 200, tau: 0.1, peak: 0.35, delay: 0.03 }, opts);
  shot.finish(anchor, shot.t0 + 1);
}

/** A heavy door or gate moving. */
export function doorThump(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  noiseBurst(
    shot,
    { kind: "brown", duration: 0.12, peak: 0.4, filter: { type: "lowpass", from: 300 } },
    opts,
  );
  const anchor = sinePartial(shot, { freq: 70, tau: 0.25, peak: 0.4 }, opts);
  shot.finish(anchor, shot.t0 + 2.5);
}

/** Torch catching: a noise "fwoosh" darkening as the flame settles. */
export function torchIgnite(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const anchor = noiseBurst(
    shot,
    { kind: "white", duration: 0.35, peak: 0.25, filter: { type: "lowpass", from: 3000, to: 600 } },
    opts,
  );
  shot.finish(anchor, shot.t0 + 0.8);
}

/** Breaking through a weak wall: rubble and a few sharp cracks. */
export function crunch(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const anchor = noiseBurst(
    shot,
    { kind: "brown", duration: 0.25, peak: 0.5, filter: { type: "lowpass", from: 500 } },
    opts,
  );
  const pops = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < pops; i++) {
    noiseBurst(
      shot,
      {
        kind: "white",
        duration: 0.012,
        peak: 0.2,
        filter: { type: "highpass", from: 2000 },
        delay: rand(0, 0.2),
      },
      opts,
    );
  }
  shot.finish(anchor, shot.t0 + 0.8);
}

// ── Magic & fate ──────────────────────────────────────────────────────────────

/** A spell going off: three quick rising shimmer notes. */
export function spellCast(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const base = jitter(300, 0.2);
  let anchor: AudioScheduledSourceNode | null = null;
  [1, 1.33, 1.78].forEach((mult, i) => {
    const f = base * mult;
    sinePartial(shot, { freq: f, tau: 0.2, peak: 0.1, delay: i * 0.07 }, opts);
    anchor = sinePartial(shot, { freq: f * 1.007, tau: 0.2, peak: 0.08, delay: i * 0.07 }, opts);
  });
  shot.finish(anchor!, shot.t0 + 2);
}

/** A mishap: an FM voice sliding down and out of tune. */
export function spellMishap(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const c = shot.c;
  const carrier = shot.own(c.createOscillator());
  carrier.frequency.setValueAtTime(400, shot.t0);
  carrier.frequency.exponentialRampToValueAtTime(140, shot.t0 + 0.6);
  const mod = shot.own(c.createOscillator());
  mod.frequency.setValueAtTime(400 * 1.5, shot.t0);
  mod.frequency.exponentialRampToValueAtTime(140 * 2.3, shot.t0 + 0.6);
  const depth = shot.own(c.createGain());
  depth.gain.value = 250;
  mod.connect(depth).connect(carrier.frequency);
  const amp = shot.decayGain(0.25 * (opts.gain ?? 1), 0.35);
  carrier.connect(amp).connect(shot.dest);
  mod.start(shot.t0);
  mod.stop(shot.t0 + 1);
  carrier.start(shot.t0);
  shot.finish(carrier, shot.t0 + 1);
}

/** Level up: a rising four-note fanfare in perfect fourths. */
export function levelUp(opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const notes = [330, 440, 587, 784];
  let anchor: AudioScheduledSourceNode | null = null;
  notes.forEach((f, i) => {
    const last = i === notes.length - 1;
    const tau = last ? 0.5 : 0.18;
    sinePartial(shot, { freq: f, tau, peak: 0.16, delay: i * 0.12 }, opts);
    anchor = sinePartial(shot, { freq: f * 2, tau, peak: 0.05, delay: i * 0.12 }, opts);
  });
  shot.finish(anchor!, shot.t0 + 5);
}

/** A death: low FM bell. Undead get a dissonant ratio and a dry bone rattle. */
export function deathKnell(undead: boolean, opts: SfxOpts = {}): void {
  const shot = new Shot(opts);
  const fc = jitter(110, 0.1);
  const anchor = fmStrike(
    shot,
    {
      fc,
      ratio: undead ? 1.93 : 1.414,
      deviation: fc * 2.5,
      modTau: 0.5,
      ampTau: 0.9,
      peak: 0.3,
    },
    opts,
  );
  if (undead) {
    for (let i = 0; i < 4; i++) {
      noiseBurst(
        shot,
        {
          kind: "white",
          duration: 0.015,
          peak: 0.12,
          filter: { type: "highpass", from: 3000 },
          delay: 0.05 + i * rand(0.05, 0.09),
        },
        opts,
      );
    }
  }
  shot.finish(anchor, shot.t0 + 8);
}
