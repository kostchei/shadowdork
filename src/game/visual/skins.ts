import type { VisualPalette, VisualSkin, VisualSkinId, ZonePackId, MaterialSetId } from "./model";

const skin = (
  id: VisualSkinId,
  zone: ZonePackId,
  displayName: string,
  materials: MaterialSetId,
  palette: VisualPalette,
  roomNouns: readonly string[],
): VisualSkin => ({ id, zone, displayName, materials, palette, roomNouns });

export const VISUAL_SKINS = [
  skin("rot-bramble", "diablerie", "The Rot-Bramble", "root-thorn", { background: 0x080b08, stoneTint: 0xa4af92, accent: 0x8eaa58, haze: 0x1c2718, darkness: 0x020402 }, ["THORN WAY", "BLACK HEDGE", "MARROW KNOT"]),
  skin("mugdulblub-keep", "diablerie", "The Dissolving Keep", "dissolving-stone", { background: 0x090b0d, stoneTint: 0xa9afaa, accent: 0x9ac673, haze: 0x263126, darkness: 0x030403 }, ["SUNKEN HALL", "SLIME VAULT", "MELTING KEEP"]),
  skin("willowman-hollow", "diablerie", "The Willowman's Hollow", "pale-root", { background: 0x08090b, stoneTint: 0xb3aa98, accent: 0xa6b2c4, haze: 0x25252b, darkness: 0x020203 }, ["ROOT HOLLOW", "PALE ARCH", "NIGHTMARE KNOT"]),
  skin("djurum-approach", "red-sands", "The Howling Approach", "wind-cut-red-stone", { background: 0x190706, stoneTint: 0xe08a78, accent: 0xf29a4a, haze: 0x5c1715, darkness: 0x090202 }, ["WIND GATE", "RED SCREE", "CAVE MOUTH"]),
  skin("iron-fortress", "red-sands", "The Iron Fortress", "basalt-iron", { background: 0x100706, stoneTint: 0xffffff, accent: 0xf07832, haze: 0x35140c, darkness: 0x050201 }, ["IRON COURT", "BARBED TOWER", "GATE OF FIRE"]),
  skin("burning-mines", "red-sands", "The Burning Mines", "burning-granite", { background: 0x0c0807, stoneTint: 0xa79a91, accent: 0xe38a37, haze: 0x32170d, darkness: 0x040202 }, ["FORGE HALL", "ORE CUT", "MAGMA WORKS"]),
  skin("rime-sea-caves", "midnight-sun", "The Rime-Caked Sea Caves", "glacial-rock", { background: 0x07101a, stoneTint: 0xb8d4df, accent: 0x75c7e8, haze: 0x173447, darkness: 0x020508 }, ["ICE BRIDGE", "FROZEN SURF", "SEA MOUTH"]),
  skin("frost-jarl-tomb", "midnight-sun", "The Frost Jarl's Tomb", "runestone-timber", { background: 0x0a0d14, stoneTint: 0xc0c8d0, accent: 0x8eb7d2, haze: 0x253242, darkness: 0x030407 }, ["RUNE HALL", "SHIP BURIAL", "JARL'S REST"]),
  skin("dverg-forges", "midnight-sun", "The Dverg Forges", "forge-stone", { background: 0x100b09, stoneTint: 0xaaa39e, accent: 0xe28b45, haze: 0x392018, darkness: 0x050302 }, ["VENT SHAFT", "ANVIL HALL", "DEEP FORGE"]),
  skin("overgrown-basalt-ziggurat", "river-of-night", "The Overgrown Ziggurat", "jungle-basalt", { background: 0x06100b, stoneTint: 0x8da899, accent: 0x61b870, haze: 0x153421, darkness: 0x020703 }, ["BASALT STEP", "SERPENT COURT", "ROOTED TEMPLE"]),
  skin("drowned-star-cenote", "river-of-night", "The Drowned Star Cenote", "wet-limestone", { background: 0x04101a, stoneTint: 0x8eb5b5, accent: 0x63d7c6, haze: 0x123747, darkness: 0x010609 }, ["STAR POOL", "AIR POCKET", "DROWNED VAULT"]),
  skin("canopy-village", "river-of-night", "The Canopy Village", "woven-canopy", { background: 0x07120b, stoneTint: 0x9da77b, accent: 0x78c55a, haze: 0x1c3c20, darkness: 0x020803 }, ["ROPE WALK", "HIGH HUT", "CANOPY BRIDGE"]),
  skin("librarians-chasm", "dwellers-in-the-deep", "The Librarians' Chasm", "abyssal-archive", { background: 0x070710, stoneTint: 0x9e99af, accent: 0xa68ad1, haze: 0x25203b, darkness: 0x020204 }, ["CHAINED STACK", "ARCHIVE BRIDGE", "BOTTOMLESS INDEX"]),
  skin("nuln-fungal-grottos", "dwellers-in-the-deep", "The Nuln Grottos", "fungal-cavern", { background: 0x06100b, stoneTint: 0xa0b59d, accent: 0x71d58b, haze: 0x193623, darkness: 0x020703 }, ["SPORE HALL", "CAP FOREST", "CORPSE BLOOM"]),
  skin("subterranean-sea-fort", "dwellers-in-the-deep", "The Subterranean Sea-Fort", "sea-fort", { background: 0x030b12, stoneTint: 0x7f9ca8, accent: 0x58c3c9, haze: 0x10303d, darkness: 0x010507 }, ["BLACK QUAY", "SEA WALL", "DROWNED BASTION"]),
  skin("rooftop-scamper", "city-of-masks", "The Rooftop Scamper", "roof-tile", { background: 0x0c0c18, stoneTint: 0xb5a7a0, accent: 0xd69a72, haze: 0x2b2943, darkness: 0x030306 }, ["TILE RIDGE", "CLOCK WALK", "GARGOYLE ROOF"]),
  skin("sunken-thieves-guild", "city-of-masks", "The Sunken Guild", "sewer-brick", { background: 0x07100f, stoneTint: 0x8fa49b, accent: 0x6fc0a7, haze: 0x19332f, darkness: 0x020706 }, ["SMUGGLER'S COVE", "FLOODED RING", "AQUEDUCT"]),
  skin("hidden-face-temple", "city-of-masks", "The Temple of the Hidden Face", "opulent-estate", { background: 0x100b12, stoneTint: 0xc0aeb5, accent: 0xd4a45f, haze: 0x392334, darkness: 0x050304 }, ["MASKED HALL", "SECRET SALON", "RITUAL UNDERCROFT"]),
] as const satisfies readonly VisualSkin[];

const SKINS_BY_ID = new Map<VisualSkinId, VisualSkin>(VISUAL_SKINS.map((entry) => [entry.id, entry]));

export function visualSkinById(id: VisualSkinId): VisualSkin {
  const result = SKINS_BY_ID.get(id);
  if (!result) throw new Error(`Unknown visual skin "${id}"`);
  return result;
}

export function parseVisualSkinId(value: string | null): VisualSkinId | undefined {
  return value && SKINS_BY_ID.has(value as VisualSkinId) ? value as VisualSkinId : undefined;
}

/** Stable selection for the eventual default rotation; it never consumes rules RNG. */
export function visualSkinForRun(seed: number): VisualSkin {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return VISUAL_SKINS[(value >>> 0) % VISUAL_SKINS.length]!;
}
