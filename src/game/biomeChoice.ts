import type { ZonePackId } from "./visual/model";
import { ZONE_PACKS } from "./visual/skins";

/**
 * The descent choice presented after clearing a dungeon: a 1d6 number of
 * cursed-scroll options, sampled from all six with no exclusion, so the current
 * scroll may legitimately reappear. Deterministic given the run seed and index,
 * and it never consumes rules RNG (`src/engine/dice.ts` is untouched).
 */
export interface BiomeOffer {
  /** The 1d6 roll: how many scrolls are offered (1..6). */
  optionCount: number;
  /** The distinct scrolls offered, in presentation order. */
  zones: readonly ZonePackId[];
}

/** A small deterministic PRNG (mulberry32) for the quiet biome-offer stream. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function rollBiomeOffer(dungeonIndex: number, runSeed: number): BiomeOffer {
  if (!Number.isInteger(dungeonIndex) || dungeonIndex < 0) {
    throw new Error("Dungeon index must be a non-negative integer");
  }
  if (!Number.isInteger(runSeed)) throw new Error("Run seed must be an integer");

  // A seed distinct from the layout seed keeps the offer independent of geometry.
  const offerSeed = (Math.imul(runSeed >>> 0, 0x9e3779b1) ^ Math.imul(dungeonIndex + 1, 0x85ebca77)) >>> 0;
  const rng = mulberry32(offerSeed);

  const optionCount = 1 + Math.floor(rng() * 6); // 1..6
  const pool = [...ZONE_PACKS];
  // Seeded Fisher-Yates; the pool of six always covers a max roll of six.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return { optionCount, zones: pool.slice(0, optionCount) };
}
