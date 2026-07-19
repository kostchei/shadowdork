/**
 * Wordless narration voice — formant synthesis, no words, no assets.
 *
 * A sawtooth "glottal" source is shaped by three parallel bandpass filters at
 * vowel formant frequencies (F1/F2/F3), enveloped one syllable at a time. The
 * result is a short murmur — an Animal-Crossing-style vocalization — that stands
 * in for spoken narration without shipping a TTS model or audio clips.
 *
 * The murmur's *shape* (how many syllables, which vowels) is derived from the
 * text so a given line always sounds the same; only pitch/timing jitter is
 * random (Math.random — cosmetic, never the engine's seeded dice).
 */

import { audioCtx, masterGain, reverbBus } from "./context";

/** [F1, F2, F3] formant frequencies (Hz) for five cardinal vowels (~male tract). */
export const VOWELS: readonly (readonly [number, number, number])[] = [
  [730, 1090, 2440], // a
  [530, 1840, 2480], // e
  [270, 2290, 3010], // i
  [570, 840, 2410], // o
  [300, 870, 2240], // u
];

/** Relative loudness of the three formants — F1 carries the body. */
const FORMANT_GAIN = [1.0, 0.55, 0.22];
const MAX_SYLLABLES = 5;
const SYL_DUR = 0.13;
const SYL_GAP = 0.05;

/**
 * How many syllables a line murmurs (pure, testable). Empty/whitespace → 0;
 * otherwise one-plus per word scaled by length, clamped to a short phrase.
 */
export function syllableCount(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  let n = 0;
  for (const w of words) n += Math.max(1, Math.round(w.length / 3));
  return Math.min(MAX_SYLLABLES, Math.max(1, n));
}

/** A stable small integer seed from the text (for deterministic vowel choice). */
function seedOf(text: string): number {
  let s = 0;
  for (let i = 0; i < text.length; i++) s = (s * 31 + text.charCodeAt(i)) & 0xffff;
  return s;
}

export interface SpeakOpts {
  /** Base pitch in Hz (speaker character). Default ~130 (low murmur). */
  pitch?: number;
  /** Stereo position, -1…1. */
  pan?: number;
  /** Linear gain multiplier. */
  gain?: number;
}

/** Murmur a wordless vocalization standing in for the given narration line. */
export function speak(text: string, opts: SpeakOpts = {}): void {
  const n = syllableCount(text);
  if (n === 0) return;

  const c = audioCtx();
  const t0 = c.currentTime;
  const seed = seedOf(text);
  const basePitch = (opts.pitch ?? 130) * (0.96 + Math.random() * 0.08);
  const nodes: AudioNode[] = [];

  // Output chain: sum → (pan?) → master, with a parallel reverb send.
  const out = c.createGain();
  out.gain.value = 0.5 * (opts.gain ?? 1);
  let head: AudioNode = masterGain();
  if (opts.pan !== undefined && opts.pan !== 0) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, opts.pan));
    p.connect(head);
    nodes.push(p);
    head = p;
  }
  out.connect(head);
  const wet = c.createGain();
  wet.gain.value = 0.2;
  out.connect(wet).connect(reverbBus());
  nodes.push(out, wet);

  let anchor: OscillatorNode | null = null;
  for (let i = 0; i < n; i++) {
    const at = t0 + i * (SYL_DUR + SYL_GAP);
    const last = i === n - 1;
    const vowel = VOWELS[(seed + i) % VOWELS.length]!;
    const pitch = basePitch * (0.97 + Math.random() * 0.06);

    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(pitch, at);
    // A gentle contour, dropping on the final syllable so phrases feel finished.
    osc.frequency.linearRampToValueAtTime(pitch * (last ? 0.82 : 0.98), at + SYL_DUR);

    const env = c.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + 0.03);
    env.gain.setTargetAtTime(0, at + SYL_DUR * 0.5, SYL_DUR * 0.4);
    env.connect(out);
    nodes.push(env);

    vowel.forEach((f, idx) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = idx === 0 ? 6 : 10;
      const w = c.createGain();
      w.gain.value = FORMANT_GAIN[idx]!;
      osc.connect(bp).connect(w).connect(env);
      nodes.push(bp, w);
    });

    osc.start(at);
    osc.stop(at + SYL_DUR + 0.05);
    nodes.push(osc);
    anchor = osc;
  }

  // The last-stopping oscillator tears the whole murmur graph down.
  anchor!.onended = () => {
    for (const nd of nodes) nd.disconnect();
  };
}
