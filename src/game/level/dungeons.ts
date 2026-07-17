/**
 * Replayable Five Room Dungeons assembled from the game's existing verbs.
 *
 * Every layout keeps the same compact character legend, which lets the scene
 * render any dungeon without knowing how it was authored. Each dungeon draws
 * its rooms from a themed variant pool (so The Ember Crypt always reads as a
 * crypt), rescues follow a designed distribution (mostly front-loaded, with a
 * tuned chance of one late reward rescue), and the climax's monster budget is
 * chosen AFTER rescue placement so the boss room is always beatable by the
 * party guaranteed to exist on arrival. Every generated grid passes
 * validateGrid before it reaches the renderer — invalid grids throw.
 */

export const DUNGEON_W = 120;
export const DUNGEON_H = 17;

/** Room bands along x, exclusive of the shared shell walls. */
export const ROOM_BANDS: readonly { room: number; x1: number; x2: number }[] = [
  { room: 1, x1: 1, x2: 20 },
  { room: 2, x1: 22, x2: 41 },
  { room: 3, x1: 43, x2: 63 },
  { room: 4, x1: 65, x2: 84 },
  { room: 5, x1: 86, x2: 97 },
  { room: 6, x1: 99, x2: 118 }, // sanctuary
];

/** Chance a run places one rescue late, in the climax room, as a reward. */
export const REWARD_RESCUE_CHANCE = 0.22;

const MONSTER_TILES = new Set(["g", "s", "r", "O"]);
const RESCUE_TILES = new Set(["2", "3", "4"]);
export const LEGAL_TILES = new Set([..."." , ..."#%=|^P234gsrOcGIKtnfFDb*qvh:"]);

export interface DungeonTheme {
  background: number;
  stoneTint: number;
  accent: number;
  haze: number;
  darkness: number;
  /** Which math-built parallax backdrop the dungeon renders behind play. */
  backdrop: "columns" | "aztec" | "tentacles";
}

/** Which authored variants each room may draw, per dungeon (theme coupling). */
export interface VariantPools {
  room1: readonly number[];
  room2: readonly number[];
  room3: readonly number[];
  room4: readonly number[];
  room5: readonly number[];
  sanctuary: readonly number[];
}

export interface DungeonDefinition {
  id: string;
  name: string;
  tagline: string;
  objective: string;
  grid: readonly string[];
  theme: DungeonTheme;
  pools: VariantPools;
  /** Crawling danger level: 1 deadly (check every crawl round), 2 risky, 3 unsafe. */
  danger: 1 | 2 | 3;
  /** Monster spawned by random encounters in this dungeon. */
  encounterMonsterId: string;
}

interface GridBuilder {
  put(x: number, y: number, ch: string): void;
  hline(x1: number, x2: number, y: number, ch: string): void;
  vline(x: number, y1: number, y2: number, ch: string): void;
  divider(x: number): void;
  finish(): readonly string[];
}

function gridBuilder(): GridBuilder {
  const grid: string[][] = Array.from({ length: DUNGEON_H }, () =>
    Array.from({ length: DUNGEON_W }, () => "."),
  );
  const put = (x: number, y: number, ch: string): void => {
    if (x < 0 || x >= DUNGEON_W || y < 0 || y >= DUNGEON_H) {
      throw new Error(`Out of bounds dungeon placement (${x},${y})`);
    }
    grid[y]![x] = ch;
  };
  const hline = (x1: number, x2: number, y: number, ch: string): void => {
    for (let x = x1; x <= x2; x++) put(x, y, ch);
  };
  const vline = (x: number, y1: number, y2: number, ch: string): void => {
    for (let y = y1; y <= y2; y++) put(x, y, ch);
  };
  const divider = (x: number): void => vline(x, 1, 11, "#");

  // Shared shell: two-tile floor gives spike pits space to read clearly.
  hline(0, DUNGEON_W - 1, 0, "#");
  hline(0, DUNGEON_W - 1, 15, "#");
  hline(0, DUNGEON_W - 1, 16, "#");
  vline(0, 0, 16, "#");
  vline(DUNGEON_W - 1, 0, 16, "#");

  return {
    put,
    hline,
    vline,
    divider,
    finish: () => {
      const rows = grid.map((row) => row.join(""));
      if (rows.some((row) => row.length !== DUNGEON_W)) {
        throw new Error("Dungeon row width mismatch");
      }
      return rows;
    },
  };
}

/** mulberry32 — small, fast, seedable. */
function seededRng(seed: number) {
  let a = (seed ^ 0x12345678) >>> 0;
  if (a === 0) a = 1;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: rng,
    between: (min: number, max: number) => min + Math.floor(rng() * (max - min + 1)),
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error("Cannot pick from an empty variant pool");
      return arr[Math.floor(rng() * arr.length)]!;
    },
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

type Rng = ReturnType<typeof seededRng>;

function buildRoom1(g: GridBuilder, variant: number, npc?: string): void {
  // The player always enters at x=2, y=14.
  g.put(2, 14, "P");

  if (variant === 0) {
    // Gloom Entrance: guarded cage
    g.put(4, 14, "t");
    g.put(6, 14, "b");
    g.put(9, 14, "g");
    g.put(12, 14, "g");
    g.hline(14, 17, 12, "=");
    if (npc) {
      g.put(15, 11, npc);
      g.put(17, 11, "c");
    }
    g.put(17, 14, "r");
    g.put(19, 14, "q");
  } else if (variant === 1) {
    // Crypt Entrance: overhead rescue shelf
    g.put(4, 14, "b");
    g.put(7, 14, "s");
    g.put(11, 14, "s");
    g.hline(14, 19, 11, "=");
    if (npc) {
      g.put(17, 10, npc);
      g.put(19, 10, "G");
    }
    g.put(14, 14, "r");
    g.put(6, 14, "q");
  } else if (variant === 2) {
    // Warren Entrance: rat infested opening
    g.put(5, 14, "b");
    g.put(8, 14, "r");
    g.put(11, 14, "r");
    g.put(14, 14, "g");
    g.hline(15, 19, 12, "=");
    if (npc) {
      g.put(17, 11, npc);
      g.put(19, 11, "t");
    }
    g.put(7, 14, "*");
  } else {
    // Sunken Trench Entrance: spikes gap jump
    g.put(4, 14, "b");
    g.hline(6, 9, 12, "=");
    g.hline(8, 10, 15, ".");
    g.hline(8, 10, 16, "^");
    g.put(12, 14, "g");
    g.hline(14, 17, 11, "=");
    if (npc) {
      g.put(15, 10, npc);
    }
    g.put(19, 14, "t");
  }
  g.divider(21);
}

function buildRoom2(g: GridBuilder, variant: number, npc?: string): void {
  if (variant === 0) {
    // Freezing Crossing
    g.hline(24, 26, 12, "=");
    g.hline(27, 30, 9, "=");
    if (npc) {
      g.put(28, 8, npc);
      g.put(30, 8, "G");
    }
    g.vline(36, 4, 11, "|");
    g.vline(36, 12, 14, "%");
    g.put(33, 14, "n");
    g.put(39, 14, "*");
  } else if (variant === 1) {
    // Broken Stairs Ascent
    g.hline(23, 26, 12, "=");
    g.hline(28, 31, 9, "=");
    g.hline(33, 36, 6, "=");
    if (npc) {
      g.put(34, 5, npc);
      g.put(36, 5, "I");
    }
    g.vline(38, 9, 14, "%");
    g.put(25, 14, "n");
    g.put(40, 14, "b");
  } else if (variant === 2) {
    // Mushroom Gallery
    g.hline(23, 27, 12, "=");
    g.hline(29, 33, 9, "=");
    g.hline(35, 39, 6, "=");
    if (npc) {
      g.put(37, 5, npc);
      g.put(39, 5, "G");
    }
    g.vline(34, 10, 14, "%");
    g.put(26, 14, "*");
    g.put(31, 14, "n");
    g.put(40, 14, "*");
  } else {
    // Pillar Hall
    g.hline(23, 25, 12, "=");
    g.hline(27, 29, 10, "=");
    g.hline(31, 33, 8, "=");
    g.hline(35, 38, 11, "=");
    if (npc) {
      g.put(36, 10, npc);
      g.put(38, 10, "c");
    }
    g.put(25, 14, "g");
    g.put(30, 14, "s");
    g.put(39, 14, "t");
  }
  g.divider(42);
}

function buildRoom3(g: GridBuilder, variant: number, npc?: string): void {
  if (variant === 0) {
    // Spike Bed Ambush
    g.hline(46, 48, 15, ".");
    g.hline(46, 48, 16, "^");
    g.put(50, 14, "c");
    g.hline(52, 54, 15, ".");
    g.hline(52, 54, 16, "^");
    g.put(57, 14, "s");
    g.put(59, 14, "s");
    g.put(62, 14, "g");
    if (npc) {
      g.put(61, 14, npc);
    }
    g.put(56, 14, "t");
    g.put(45, 14, ":");
  } else if (variant === 1) {
    // Safe Shelves & Spike Trench
    g.hline(45, 47, 15, ".");
    g.hline(45, 47, 16, "^");
    g.hline(48, 51, 12, "=");
    g.put(50, 11, "c");
    g.hline(53, 55, 15, ".");
    g.hline(53, 55, 16, "^");
    if (npc) {
      g.put(57, 14, npc);
    }
    g.put(59, 14, "g");
    g.put(61, 14, "s");
    g.put(63, 14, "t");
  } else if (variant === 2) {
    // Jagged Floor Warren
    g.hline(44, 46, 15, ".");
    g.hline(44, 46, 16, "^");
    g.hline(48, 51, 11, "=");
    g.put(49, 10, "c");
    g.hline(53, 56, 15, ".");
    g.hline(53, 56, 16, "^");
    if (npc) {
      g.put(58, 14, npc);
    }
    g.put(60, 14, "g");
    g.put(62, 14, "r");
  } else {
    // Falling Floor Trap
    g.hline(45, 49, 12, "=");
    g.hline(46, 48, 15, ".");
    g.hline(46, 48, 16, "^");
    g.vline(51, 12, 14, "%");
    g.hline(53, 55, 12, "=");
    if (npc) {
      g.put(54, 11, npc);
    }
    g.put(57, 14, "r");
    g.put(59, 14, "r");
    g.put(62, 14, "t");
  }
  g.divider(64);
}

/**
 * The climax. `easier` is set when only two rescues precede this room —
 * the boss keeps the arena but sheds minions so the guaranteed-on-arrival
 * party can win it. A solo-Fighter brute path exists in every variant.
 */
function buildRoom4(g: GridBuilder, variant: number, npc: string | undefined, easier: boolean): void {
  g.put(67, 14, "b");
  if (!easier) g.put(69, 14, "g");

  if (variant === 0) {
    // Gloom Dais
    g.put(74, 14, "O");
    g.put(78, 14, "g");
    g.hline(79, 82, 12, "=");
    if (npc) {
      g.put(81, 11, npc);
    } else {
      g.put(81, 11, "I");
    }
  } else if (variant === 1) {
    // Crypt Dais
    g.hline(70, 78, 11, "=");
    g.put(74, 10, "O");
    g.put(79, 14, "g");
    g.vline(69, 12, 14, "%");
    g.vline(80, 12, 14, "%");
    if (npc) {
      g.put(82, 14, npc);
    } else {
      g.put(82, 14, "b");
    }
  } else if (variant === 2) {
    // Warren Arena
    g.hline(70, 73, 11, "=");
    g.put(72, 10, "g");
    g.put(76, 14, "O");
    g.hline(79, 82, 9, "=");
    if (npc) {
      g.put(81, 8, npc);
    } else {
      g.put(81, 8, "I");
    }
    if (!easier) g.put(83, 14, "r");
  } else {
    // Pit of the Beast
    g.put(74, 14, "O");
    g.hline(67, 69, 11, "=");
    g.hline(79, 81, 11, "=");
    g.put(68, 10, "s");
    if (!easier) g.put(80, 10, "s");
    if (npc) {
      g.put(77, 14, npc);
    } else {
      g.put(77, 14, "c");
    }
  }
  g.divider(85);
}

function buildRoom5(g: GridBuilder, variant: number): void {
  if (variant === 0) {
    // Gloom Shrine
    g.put(87, 14, "s");
    g.hline(88, 91, 13, "=");
    g.put(89, 12, "K");
    g.put(91, 12, "G");
    g.put(93, 14, "c");
    g.put(95, 14, "c");
    g.put(96, 14, "v");
  } else if (variant === 1) {
    // Crypt Reliquary
    g.hline(87, 90, 12, "=");
    g.hline(92, 95, 9, "=");
    g.put(93, 8, "K");
    g.put(95, 8, "G");
    g.put(88, 11, "s");
    g.put(96, 14, "c");
    g.put(87, 14, "v");
  } else if (variant === 2) {
    // Fungal Shrine
    g.hline(87, 91, 12, "=");
    g.hline(92, 96, 9, "=");
    g.put(89, 11, "s");
    g.put(94, 8, "K");
    g.put(96, 8, "G");
    g.put(93, 14, "c");
    g.put(96, 14, "*");
  } else {
    // Vault Chamber
    g.put(87, 14, "v");
    g.put(89, 14, "s");
    g.put(90, 14, "s");
    g.hline(92, 95, 12, "=");
    g.put(93, 11, "K");
    g.put(95, 11, "I");
    g.put(97, 14, "c");
  }
  g.divider(98);
}

function buildSanctuary(g: GridBuilder, variant: number): void {
  g.put(103, 14, "F"); // Sanctuary campfire
  g.put(101, 14, "h"); // Shrine: priest atonement
  if (variant === 0) {
    g.put(106, 14, "n");
    g.put(112, 14, "D");
  } else if (variant === 1) {
    g.put(106, 14, "t");
    g.put(108, 14, "*");
    g.put(112, 14, "D");
  } else {
    g.put(106, 14, "n");
    g.put(109, 14, ":");
    g.put(112, 14, "D");
  }
}

interface RescuePlacement {
  /** room number -> rescue tile ("2" thief, "3" priest, "4" wizard). */
  byRoom: Map<number, string>;
  /** How many rescues sit in rooms 1–3, i.e. precede the climax. */
  before4: number;
}

/**
 * Designed rescue distribution: all three rescues land in rooms 1–3 (one per
 * room, shuffled), except a tuned REWARD_RESCUE_CHANCE of runs where one
 * rescue becomes the climax room's reward (the bible's Chained Companion).
 */
function placeRescues(rng: Rng): RescuePlacement {
  const npcs = ["2", "3", "4"];
  const earlyRooms = rng.shuffle([1, 2, 3]);
  const byRoom = new Map<number, string>();

  if (rng.next() < REWARD_RESCUE_CHANCE) {
    const rewardIdx = rng.between(0, 2);
    byRoom.set(4, npcs[rewardIdx]!);
    const rest = npcs.filter((_, i) => i !== rewardIdx);
    byRoom.set(earlyRooms[0]!, rest[0]!);
    byRoom.set(earlyRooms[1]!, rest[1]!);
    return { byRoom, before4: 2 };
  }

  npcs.forEach((npc, i) => byRoom.set(earlyRooms[i]!, npc));
  return { byRoom, before4: 3 };
}

function bandOf(x: number): number {
  const band = ROOM_BANDS.find((b) => x >= b.x1 && x <= b.x2);
  if (!band) throw new Error(`x=${x} falls on a divider or shell wall`);
  return band.room;
}

/**
 * Hard validation gate: every grid the renderer ever sees passes this.
 * Structural rules AND the beatability budget — violations throw.
 */
export function validateGrid(grid: readonly string[]): void {
  if (grid.length !== DUNGEON_H) throw new Error(`Grid height ${grid.length}, expected ${DUNGEON_H}`);
  if (grid.some((row) => row.length !== DUNGEON_W)) {
    throw new Error(`Grid row width mismatch, expected ${DUNGEON_W}`);
  }

  const positions = new Map<string, { x: number; y: number }[]>();
  for (let y = 0; y < DUNGEON_H; y++) {
    for (let x = 0; x < DUNGEON_W; x++) {
      const ch = grid[y]![x]!;
      if (!LEGAL_TILES.has(ch)) throw new Error(`Illegal tile "${ch}" at (${x},${y})`);
      const list = positions.get(ch) ?? [];
      list.push({ x, y });
      positions.set(ch, list);
    }
  }

  for (const required of ["P", "2", "3", "4", "K", "F", "D", "h"]) {
    const n = positions.get(required)?.length ?? 0;
    if (n !== 1) throw new Error(`Expected exactly one "${required}", found ${n}`);
  }

  // Structural placement rules.
  if (bandOf(positions.get("P")![0]!.x) !== 1) throw new Error("Spawn must be in room 1");
  if (bandOf(positions.get("K")![0]!.x) !== 5) throw new Error("Crown must be in the vault (room 5)");
  if (bandOf(positions.get("F")![0]!.x) !== 6) throw new Error("Rest campfire must be in the sanctuary");
  if (bandOf(positions.get("D")![0]!.x) !== 6) throw new Error("Exit door must be in the sanctuary");

  // Beatability budget: a rescue in the climax band means the on-arrival
  // party is smaller, so the climax must carry a trimmed monster manifest.
  const climaxBand = ROOM_BANDS[3]!;
  const inClimax = (x: number) => x >= climaxBand.x1 && x <= climaxBand.x2;
  const rescueInClimax = [...RESCUE_TILES].some((t) =>
    (positions.get(t) ?? []).some((p) => inClimax(p.x)),
  );
  let climaxMonsters = 0;
  for (const t of MONSTER_TILES) {
    climaxMonsters += (positions.get(t) ?? []).filter((p) => inClimax(p.x)).length;
  }
  if (climaxMonsters === 0) throw new Error("Climax room has no monsters");
  if (rescueInClimax && climaxMonsters > 3) {
    throw new Error(
      `Climax holds a reward rescue but ${climaxMonsters} monsters — budget is 3 for a short-handed party`,
    );
  }
}

/** Build one validated grid for a dungeon's variant pools and a run seed. */
export function generateGrid(pools: VariantPools, seed: number): readonly string[] {
  const g = gridBuilder();
  const rng = seededRng(seed);
  const rescues = placeRescues(rng);
  const easierClimax = rescues.before4 < 3;

  buildRoom1(g, rng.pick(pools.room1), rescues.byRoom.get(1));
  buildRoom2(g, rng.pick(pools.room2), rescues.byRoom.get(2));
  buildRoom3(g, rng.pick(pools.room3), rescues.byRoom.get(3));
  buildRoom4(g, rng.pick(pools.room4), rescues.byRoom.get(4), easierClimax);
  buildRoom5(g, rng.pick(pools.room5));
  buildSanctuary(g, rng.pick(pools.sanctuary));

  const grid = g.finish();
  validateGrid(grid);
  return grid;
}

const ALL_SANCTUARIES = [0, 1, 2] as const;

/**
 * The dungeon library. Each dungeon's pools mix its signature variants with
 * the theme-neutral ones (index 3), so identity and layout stay coupled.
 * (The Crystal Chasm and Sunken Bastion recolors were removed: they return
 * when they have at least one mechanic of their own — see the scope doc.)
 */
const DUNGEON_BASES: readonly Omit<DungeonDefinition, "grid">[] = [
  {
    id: "gloom-below",
    name: "The Gloom Below",
    tagline: "Old stone. Thin light. Hungry eyes.",
    objective: "Recover the Crown of the Deep",
    danger: 2,
    encounterMonsterId: "goblin",
    pools: {
      room1: [0, 3],
      room2: [0, 3],
      room3: [0, 3],
      room4: [0, 3],
      room5: [0, 3],
      sanctuary: ALL_SANCTUARIES,
    },
    theme: {
      background: 0x090b13,
      stoneTint: 0xaeb5d0,
      accent: 0x8890c8,
      haze: 0x232742,
      darkness: 0x030408,
      backdrop: "columns",
    },
  },
  {
    id: "ember-crypt",
    name: "The Ember Crypt",
    tagline: "The dead keep their fires burning.",
    objective: "Climb the reliquary and seize its crown",
    danger: 3,
    encounterMonsterId: "skeleton",
    pools: {
      room1: [1, 3],
      room2: [1, 3],
      room3: [1, 3],
      room4: [1, 3],
      room5: [1, 3],
      sanctuary: ALL_SANCTUARIES,
    },
    theme: {
      background: 0x140b0a,
      stoneTint: 0xd0a692,
      accent: 0xe08040,
      haze: 0x3a1d12,
      darkness: 0x070302,
      backdrop: "aztec",
    },
  },
  {
    id: "mold-warrens",
    name: "The Mold Warrens",
    tagline: "Everything down here is growing.",
    objective: "Cross the warrens and rob the fungal shrine",
    danger: 1,
    encounterMonsterId: "giant-rat",
    pools: {
      room1: [2, 3],
      room2: [2, 3],
      room3: [2, 3],
      room4: [2, 3],
      room5: [2, 3],
      sanctuary: ALL_SANCTUARIES,
    },
    theme: {
      background: 0x07100d,
      stoneTint: 0x9ebda6,
      accent: 0x74c888,
      haze: 0x14301e,
      darkness: 0x020806,
      backdrop: "tentacles",
    },
  },
];

export const DUNGEONS: readonly DungeonDefinition[] = DUNGEON_BASES.map((base, i) => ({
  ...base,
  grid: generateGrid(base.pools, i),
}));

/**
 * The dungeon for a given run index. Pure: never mutates the library — the
 * returned definition carries a fresh grid seeded by the run index, already
 * validated by generateGrid.
 */
export function dungeonAt(index: number): DungeonDefinition {
  if (!Number.isInteger(index)) throw new Error(`Dungeon index must be an integer, got ${index}`);
  const wrapped = ((index % DUNGEONS.length) + DUNGEONS.length) % DUNGEONS.length;
  const base = DUNGEONS[wrapped]!;
  return { ...base, grid: generateGrid(base.pools, index) };
}
