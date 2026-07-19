import type { VisualSkin, VisualSkinId, ZonePackId } from "./visual/model";
import { skinsForZone, ZONE_PACKS } from "./visual/skins";

function hashSeed(seed: number): number {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

/** Roll 1d6 (1..6) for the number of vaults to play in a Cursed Scroll destination. */
export function rollVaultCountForScroll(seed: number): number {
  return 1 + (hashSeed(seed ^ 0x3c6ef35f) % 6);
}

/**
 * Pick a biome (skin) within the current Cursed Scroll, enforcing that each
 * biome is used a maximum of 2x during the scroll run.
 */
export function pickSkinForScrollRun(
  zone: ZonePackId,
  skinHistory: readonly VisualSkinId[],
  seed: number,
): VisualSkin {
  const allSkins = skinsForZone(zone);
  const counts = new Map<VisualSkinId, number>();
  for (const s of allSkins) counts.set(s.id, 0);
  for (const id of skinHistory) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // Filter to biomes used fewer than 2 times
  let available = allSkins.filter((s) => (counts.get(s.id) ?? 0) < 2);
  if (available.length === 0) available = [...allSkins];

  const index = hashSeed(seed) % available.length;
  return available[index]!;
}

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
