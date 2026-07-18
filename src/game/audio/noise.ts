/**
 * Noise from primitives. The pure generators return Float32Arrays (testable in
 * node); the buffer cache turns them into looped AudioBuffers for the graph.
 */

import { audioCtx } from "./context";

export type NoiseKind = "white" | "pink" | "brown";

/** Uniform white noise in [-1, 1). */
export function whiteNoise(length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

/**
 * Pink noise (~-3 dB/octave) via Paul Kellet's economy filter: seven leaky
 * integrators at staggered rates summed, each tracking a fresh white sample.
 */
export function pinkNoise(length: number): Float32Array {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    out[i] = pink * 0.11;
  }
  return out;
}

/**
 * Brown noise (~-6 dB/octave): leaky-integrated white, rescaled to peak ±1.
 * The leak keeps the random walk from wandering off to DC.
 */
export function brownNoise(length: number): Float32Array {
  const out = new Float32Array(length);
  let acc = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1;
    acc = (acc + 0.02 * w) / 1.02;
    out[i] = acc;
    const mag = Math.abs(acc);
    if (mag > peak) peak = mag;
  }
  if (peak === 0) throw new Error("brown noise produced silence");
  for (let i = 0; i < length; i++) out[i]! /= peak;
  return out;
}

const GENERATORS: Record<NoiseKind, (length: number) => Float32Array> = {
  white: whiteNoise,
  pink: pinkNoise,
  brown: brownNoise,
};

const BUFFER_SECONDS = 2;
const buffers = new Map<NoiseKind, AudioBuffer>();

/** A cached 2-second mono buffer of the given noise color. */
export function noiseBuffer(kind: NoiseKind): AudioBuffer {
  let buf = buffers.get(kind);
  if (!buf) {
    const c = audioCtx();
    const length = c.sampleRate * BUFFER_SECONDS;
    buf = c.createBuffer(1, length, c.sampleRate);
    buf.getChannelData(0).set(GENERATORS[kind](length));
    buffers.set(kind, buf);
  }
  return buf;
}

/**
 * A playable source over the cached buffer. Looped sources start at a random
 * offset so concurrent layers of the same color never phase-lock.
 */
export function noiseSource(kind: NoiseKind, opts: { loop: boolean }): AudioBufferSourceNode {
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = opts.loop;
  if (opts.loop) src.loopStart = 0;
  return src;
}

/** Start a source; looped ones begin at a random point in the buffer. */
export function startNoise(src: AudioBufferSourceNode, when = 0): void {
  const offset = src.loop ? Math.random() * BUFFER_SECONDS : 0;
  src.start(when, offset);
}
