import { describe, expect, it } from "vitest";
import { expInterval } from "../src/game/audio/ambience";
import { brownNoise, pinkNoise, whiteNoise } from "../src/game/audio/noise";
import { cutoffFor, distanceTaper, gainFor, panFor, spatialOpts } from "../src/game/audio/spatial";
import { reverbImpulse, saturationCurve } from "../src/game/audio/context";
import { pitchForVoiceRegister, VOWELS, syllableCount } from "../src/game/audio/voice";

const N = 16384;

/** Lag-1 autocorrelation: ~0 for white, high for pink, ~1 for brown. */
function lag1Autocorr(x: Float32Array): number {
  let mean = 0;
  for (let i = 0; i < x.length; i++) mean += x[i]!;
  mean /= x.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i]! - mean;
    den += d * d;
    if (i > 0) num += d * (x[i - 1]! - mean);
  }
  return num / den;
}

function maxAbs(x: Float32Array): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]!));
  return m;
}

describe("noise generators", () => {
  it("white noise stays in range with near-zero mean and no memory", () => {
    const w = whiteNoise(N);
    expect(w.length).toBe(N);
    expect(maxAbs(w)).toBeLessThanOrEqual(1);
    let mean = 0;
    for (const v of w) mean += v;
    expect(Math.abs(mean / N)).toBeLessThan(0.05);
    expect(Math.abs(lag1Autocorr(w))).toBeLessThan(0.1);
  });

  it("brown noise is normalized and heavily correlated (deep rumble)", () => {
    const b = brownNoise(N);
    const peak = maxAbs(b);
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.99); // rescaled so the loudest sample touches ±1
    expect(lag1Autocorr(b)).toBeGreaterThan(0.95);
  });

  it("pink noise sits between white and brown in spectral character", () => {
    const p = pinkNoise(N);
    expect(maxAbs(p)).toBeLessThan(1.5);
    const corr = lag1Autocorr(p);
    expect(corr).toBeGreaterThan(0.2);
    expect(corr).toBeLessThan(0.98);
    expect(corr).toBeGreaterThan(Math.abs(lag1Autocorr(whiteNoise(N))));
    expect(corr).toBeLessThan(lag1Autocorr(brownNoise(N)));
  });

  it("poisson intervals average to the requested mean", () => {
    const mean = 900;
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += expInterval(mean, Math.random());
    expect(sum / n).toBeGreaterThan(mean * 0.85);
    expect(sum / n).toBeLessThan(mean * 1.15);
    expect(() => expInterval(mean, 1)).toThrow();
  });

  it("is intentionally non-deterministic — no two arrays match", () => {
    const a = whiteNoise(256);
    const b = whiteNoise(256);
    expect(a).not.toEqual(b);
  });
});

describe("spatialization math", () => {
  it("keeps close sounds at full presence", () => {
    expect(distanceTaper(0)).toBe(0);
    expect(distanceTaper(96)).toBe(0);
    expect(gainFor(0)).toBe(1);
    expect(cutoffFor(0)).toBe(18000);
  });

  it("far sounds hit the gain floor and the muffle ceiling", () => {
    expect(distanceTaper(640)).toBe(1);
    expect(distanceTaper(5000)).toBe(1); // clamped, never negative gain
    expect(gainFor(1)).toBeCloseTo(0.15);
    expect(cutoffFor(1)).toBeCloseTo(800);
  });

  it("mid-distance lands between the extremes, duller AND quieter", () => {
    const t = distanceTaper(368); // halfway between 96 and 640
    expect(t).toBeCloseTo(0.5);
    expect(gainFor(t)).toBeGreaterThan(0.15);
    expect(gainFor(t)).toBeLessThan(1);
    expect(cutoffFor(t)).toBeGreaterThan(800);
    expect(cutoffFor(t)).toBeLessThan(18000);
  });

  it("pans by the sign and size of the horizontal offset", () => {
    expect(panFor(0)).toBe(0);
    expect(panFor(240)).toBeCloseTo(0.4);
    expect(panFor(-240)).toBeCloseTo(-0.4);
    expect(panFor(10000)).toBe(0.8); // capped shy of hard-panning
    expect(panFor(-10000)).toBe(-0.8);
  });

  it("spatialOpts skips the muffle filter when the source is close", () => {
    const near = spatialOpts({ x: 10, y: 0 }, { x: 0, y: 0 });
    expect(near.cutoff).toBeUndefined();
    expect(near.gain).toBe(1);
    const far = spatialOpts({ x: 700, y: 0 }, { x: 0, y: 0 });
    expect(far.cutoff).toBeCloseTo(800);
    expect(far.pan).toBe(0.8);
  });
});

describe("master bus math", () => {
  it("saturation curve is monotonic, odd-ish, and bounded in [-1, 1]", () => {
    const curve = saturationCurve(1024);
    expect(curve[0]).toBeCloseTo(-1); // ±1 in maps to ±1 out (normalized)
    expect(curve[curve.length - 1]!).toBeCloseTo(1);
    expect(curve[512]!).toBeCloseTo(0, 2); // passes through the origin
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!); // monotonic
      expect(Math.abs(curve[i]!)).toBeLessThanOrEqual(1 + 1e-6);
    }
    // Soft-clip compresses the mid-range: input 0.5 maps to > 0.5 (more level).
    const mid = curve[Math.round(0.75 * (curve.length - 1))]!; // input +0.5
    expect(mid).toBeGreaterThan(0.5);
    expect(() => saturationCurve(1)).toThrow();
  });

  it("reverb impulse decays — the tail is far quieter than the onset", () => {
    const ir = reverbImpulse(4096);
    const energy = (from: number, to: number) => {
      let e = 0;
      for (let i = from; i < to; i++) e += ir[i]! * ir[i]!;
      return e;
    };
    const head = energy(0, 512);
    const tail = energy(ir.length - 512, ir.length);
    expect(head).toBeGreaterThan(tail * 10);
    expect(maxAbs(ir)).toBeLessThanOrEqual(1);
    expect(() => reverbImpulse(0)).toThrow();
  });
});

describe("wordless voice", () => {
  it("uses three close but ordered character voice registers", () => {
    const low = pitchForVoiceRegister("low");
    const medium = pitchForVoiceRegister("medium");
    const high = pitchForVoiceRegister("high");
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect((high - low) / medium).toBeLessThan(0.12);
  });

  it("maps text length to a short, capped syllable run", () => {
    expect(syllableCount("")).toBe(0);
    expect(syllableCount("   ")).toBe(0);
    expect(syllableCount("go")).toBe(1);
    expect(syllableCount("the goblin snarls")).toBeGreaterThan(1);
    // A whole sentence never murmurs longer than the phrase cap.
    expect(syllableCount("the ancient dragon awakens and roars with fury")).toBeLessThanOrEqual(5);
    expect(syllableCount("supercalifragilisticexpialidocious")).toBeLessThanOrEqual(5);
  });

  it("has five three-formant vowels with rising F1 < F2 < F3", () => {
    expect(VOWELS.length).toBe(5);
    for (const [f1, f2, f3] of VOWELS) {
      expect(f1).toBeLessThan(f2);
      expect(f2).toBeLessThan(f3);
    }
  });
});
