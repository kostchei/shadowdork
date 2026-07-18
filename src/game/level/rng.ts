/**
 * Deterministic, stage-separated randomness for dungeon generation.
 *
 * The plan requires that changing a room template must not perturb the topology
 * roll: cosmetic random draws must not shift gameplay generation. A single RNG
 * stream cannot promise that — one extra `next()` anywhere reorders everything
 * downstream. Instead every pipeline stage derives an independent stream from the
 * run seed and a stable stage label, so draws in one stage never affect another.
 */

/** mulberry32 — small, fast, seedable. Mirrors the generator in dungeons.ts. */
export function seededRng(seed: number) {
  let a = seed >>> 0;
  if (a === 0) a = 1;
  const raw = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Uniform float in [0, 1). */
    next: raw,
    /** Inclusive integer in [min, max]. */
    between: (min: number, max: number): number => min + Math.floor(raw() * (max - min + 1)),
    /** Uniform pick from a non-empty array. */
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error("Cannot pick from an empty array");
      return arr[Math.floor(raw() * arr.length)]!;
    },
    /** Weighted pick; weights must be positive and sum > 0. */
    weighted: <T>(entries: readonly { value: T; weight: number }[]): T => {
      const total = entries.reduce((sum, e) => sum + e.weight, 0);
      if (total <= 0) throw new Error("Weighted pick needs a positive weight total");
      let roll = raw() * total;
      for (const e of entries) {
        roll -= e.weight;
        if (roll < 0) return e.value;
      }
      return entries[entries.length - 1]!.value; // float slack only
    },
    /** Fisher-Yates copy. */
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

export type Rng = ReturnType<typeof seededRng>;

/**
 * FNV-1a over the stage label, mixed with the run seed. Distinct labels give
 * well-separated seeds even when the run seeds are consecutive integers.
 */
export function hash32(seed: number, stage: string): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < stage.length; i++) {
    h ^= stage.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** An RNG stream scoped to one generation stage of one run seed. */
export function rngFor(seed: number, stage: string): Rng {
  return seededRng(hash32(seed, stage));
}
