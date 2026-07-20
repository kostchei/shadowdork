/**
 * Web Audio plumbing: one context, one mastering bus, gesture unlock, mute.
 *
 * The signal path is a real mastering chain, not a bare gain:
 *
 *   masterGain ──┐
 *                ├─► saturation ─► lowShelf ─► highShelf ─► compressor ─► out
 *   reverbReturn ┘
 *
 * `masterGain()` stays the public dry sum node — every sfx/ambience layer
 * connects to it exactly as before. The saturation (soft-clip) adds harmonics so
 * low sines are actually felt on small speakers, the shelves add weight and air,
 * and the compressor glues the mix and doubles as a safety limiter. A single
 * shared, procedurally generated reverb (no asset) gives everything a room.
 *
 * Browsers create AudioContexts suspended until a user gesture — installUnlock
 * resumes on the first pointer/key input and on returning to a hidden tab.
 */

/** Dry sum level, kept under 1 to leave the compressor headroom. */
const MASTER_LEVEL = 0.42;
/** Wet reverb return level, mixed pre-compressor with the dry sum. */
const REVERB_RETURN = 0.5;
/** Reverb impulse length in seconds — a small stone room, not a cathedral. */
const REVERB_SECONDS = 1.4;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let muted = false;

export function audioCtx(): AudioContext {
  if (!ctx) {
    if (typeof AudioContext === "undefined") {
      throw new Error("Web Audio API unavailable in this browser");
    }
    ctx = new AudioContext();
  }
  return ctx;
}

/**
 * Soft-clip transfer curve, S-shaped tanh (pure, testable). `drive` sets the
 * knee: higher = more harmonics/warmth. Output stays bounded in (-1, 1).
 */
export function saturationCurve(samples: number, drive = 1.6): Float32Array<ArrayBuffer> {
  if (samples < 2) throw new Error(`saturation curve needs >= 2 samples, got ${samples}`);
  const curve = new Float32Array(samples);
  const k = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // -1 … 1
    curve[i] = Math.tanh(drive * x) / k; // normalized so ±1 maps to ±1
  }
  return curve;
}

/**
 * A decaying-noise impulse response for a plate-ish reverb (pure, testable).
 * Exponential energy decay so later samples are far quieter than earlier ones.
 */
export function reverbImpulse(length: number, decay = 3.2): Float32Array {
  if (length < 1) throw new Error(`reverb impulse needs >= 1 sample, got ${length}`);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const env = Math.pow(1 - i / length, decay);
    out[i] = (Math.random() * 2 - 1) * env;
  }
  return out;
}

/** Build (once) and wire the mastering chain, returning its input node. */
function buildBusInput(c: AudioContext): AudioNode {
  const shaper = c.createWaveShaper();
  shaper.curve = saturationCurve(1024);
  shaper.oversample = "2x";

  const low = c.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 120;
  low.gain.value = 4.5; // weight

  const high = c.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 8000;
  high.gain.value = 3; // air / range

  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;

  shaper.connect(low).connect(high).connect(comp).connect(c.destination);
  return shaper;
}

/** All game sound routes through this single dry-sum gain before the bus. */
export function masterGain(): GainNode {
  if (!master) {
    const c = audioCtx();
    const busInput = buildBusInput(c);
    master = c.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(busInput);

    // Shared reverb: send bus → convolver → return gain → back into the dry sum
    // (so mute, which rides masterGain, silences the wet tail as well).
    const conv = c.createConvolver();
    const len = Math.floor(c.sampleRate * REVERB_SECONDS);
    const buf = c.createBuffer(2, len, c.sampleRate);
    buf.getChannelData(0).set(reverbImpulse(len));
    buf.getChannelData(1).set(reverbImpulse(len));
    conv.buffer = buf;
    reverbIn = c.createGain();
    reverbIn.gain.value = 1;
    const ret = c.createGain();
    ret.gain.value = REVERB_RETURN;
    reverbIn.connect(conv).connect(ret).connect(master);
  }
  return master;
}

/** Send target for per-sound wet reverb (build masterGain first). */
export function reverbBus(): GainNode {
  masterGain();
  if (!reverbIn) throw new Error("reverb bus not initialized");
  return reverbIn;
}

export function setMuted(m: boolean): void {
  muted = m;
  const g = masterGain();
  const t = audioCtx().currentTime;
  // Short ramp instead of a hard cut — avoids the click of a step discontinuity.
  g.gain.cancelScheduledValues(t);
  g.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, t, 0.01);
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Suspend the audio graph for a mode transition (pause, an overlay, an
 * interrupt). No-op if audio was never started — suspending must never be
 * what *creates* the AudioContext, since that would force a gesture-locked
 * context into existence outside a user gesture.
 */
export function suspendAudio(): void {
  if (ctx && ctx.state === "running") void ctx.suspend();
}

/** Resume audio suspended by `suspendAudio`. No-op if it was never started. */
export function resumeAudioContext(): void {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function installUnlock(): void {
  const resume = () => {
    const c = audioCtx();
    if (c.state === "suspended") void c.resume();
  };
  const once = () => {
    resume();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
}
