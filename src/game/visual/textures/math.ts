export interface Point {
  x: number;
  y: number;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Deterministic lattice noise in [-1, 1], suitable for cosmetic texture work. */
export function latticeNoise(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ (seed | 0);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Smooth value noise. It provides the same vector-warp role as Simplex at tile scale. */
export function valueNoise(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = latticeNoise(x0, y0, seed);
  const b = latticeNoise(x0 + 1, y0, seed);
  const c = latticeNoise(x0, y0 + 1, seed);
  const d = latticeNoise(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export function fbm(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    normalizer += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return normalizer === 0 ? 0 : sum / normalizer;
}

export function domainWarp(point: Point, seed: number, amplitude = 3, frequency = 0.05): Point {
  return {
    x: point.x + valueNoise(point.x * frequency, point.y * frequency, seed) * amplitude,
    y: point.y + valueNoise(point.x * frequency, point.y * frequency, seed + 7919) * amplitude,
  };
}

export function lipShadowAlpha(distanceBelowLip: number, strength = 0.65, sigma = 2.2): number {
  if (distanceBelowLip < 0) return 0;
  return strength * Math.exp(-(distanceBelowLip * distanceBelowLip) / (2 * sigma * sigma));
}

export function creviceGrime(x: number, y: number, seed: number): number {
  const broad = Math.abs(fbm(x * 0.09, y * 0.09, seed, 3));
  const fine = Math.abs(valueNoise(x * 0.34, y * 0.34, seed + 3571));
  return Math.min(1, broad * 0.72 + fine * 0.28);
}
