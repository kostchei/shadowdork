/**
 * Replayable Five Room Dungeons assembled from the game's existing verbs.
 *
 * Every layout keeps the same compact character legend, which lets the scene
 * render any dungeon without knowing how it was authored. Layouts intentionally
 * vary their combat rhythm, verticality, hazards, and light placement while
 * remaining completable by the starting Fighter.
 */

export const DUNGEON_W = 120;
export const DUNGEON_H = 17;

export interface DungeonTheme {
  background: number;
  stoneTint: number;
  accent: number;
  haze: number;
  darkness: number;
}

export interface DungeonDefinition {
  id: string;
  name: string;
  tagline: string;
  objective: string;
  grid: readonly string[];
  theme: DungeonTheme;
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
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!,
  };
}

function buildRoom1(g: GridBuilder, rng: ReturnType<typeof seededRng>, npc?: string): void {
  // Always place player starting point at x=2, y=14
  g.put(2, 14, "P");

  const variant = rng.between(0, 3);
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

function buildRoom2(g: GridBuilder, rng: ReturnType<typeof seededRng>, npc?: string): void {
  const variant = rng.between(0, 3);
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

function buildRoom3(g: GridBuilder, rng: ReturnType<typeof seededRng>, npc?: string): void {
  const variant = rng.between(0, 3);
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

function buildRoom4(g: GridBuilder, rng: ReturnType<typeof seededRng>, npc?: string): void {
  g.put(67, 14, "b");
  g.put(69, 14, "g");

  const variant = rng.between(0, 3);
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
    g.put(83, 14, "r");
  } else {
    // Pit of the Beast
    g.put(74, 14, "O");
    g.hline(67, 69, 11, "=");
    g.hline(79, 81, 11, "=");
    g.put(68, 10, "s");
    g.put(80, 10, "s");
    if (npc) {
      g.put(77, 14, npc);
    } else {
      g.put(77, 14, "c");
    }
  }
  g.divider(85);
}

function buildRoom5(g: GridBuilder, rng: ReturnType<typeof seededRng>): void {
  const variant = rng.between(0, 3);
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

function buildSanctuary(g: GridBuilder, rng: ReturnType<typeof seededRng>): void {
  const variant = rng.between(0, 2);
  g.put(103, 14, "F"); // Sanctuary Campfire
  if (variant === 0) {
    g.put(106, 14, "n");
    g.put(112, 14, "D"); // Door
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

export function generateSeededGrid(dungeonId: string, seed: number): readonly string[] {
  void dungeonId;
  const g = gridBuilder();
  const rng = seededRng(seed);

  // Assign recruits and items deterministically based on seed
  // Thief (2) in Room 1 or 2
  const npc1Room = rng.between(1, 2);
  // Priest (3) in Room 2 or 3 (never overlaps with same room as Thief)
  const npc2Room = rng.between(npc1Room + 1, 3);
  // Wizard (4) in Room 3 or 4 (never overlaps with same room as Priest)
  const npc3Room = rng.between(npc2Room + 1, 4);

  const npcAt = (roomIdx: number): string | undefined => {
    if (roomIdx === npc1Room) return "2";
    if (roomIdx === npc2Room) return "3";
    if (roomIdx === npc3Room) return "4";
    return undefined;
  };

  buildRoom1(g, rng, npcAt(1));
  buildRoom2(g, rng, npcAt(2));
  buildRoom3(g, rng, npcAt(3));
  buildRoom4(g, rng, npcAt(4));
  buildRoom5(g, rng);
  buildSanctuary(g, rng);

  return g.finish();
}

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: "gloom-below",
    name: "The Gloom Below",
    tagline: "Old stone. Thin light. Hungry eyes.",
    objective: "Recover the Crown of the Deep",
    grid: generateSeededGrid("gloom-below", 0),
    theme: {
      background: 0x090b13,
      stoneTint: 0xaeb5d0,
      accent: 0xd6a64b,
      haze: 0x39476d,
      darkness: 0x03040a,
    },
  },
  {
    id: "ember-crypt",
    name: "The Ember Crypt",
    tagline: "The dead keep their fires burning.",
    objective: "Climb the reliquary and seize its crown",
    grid: generateSeededGrid("ember-crypt", 1),
    theme: {
      background: 0x140b0a,
      stoneTint: 0xd0a692,
      accent: 0xf0733e,
      haze: 0x723726,
      darkness: 0x080302,
    },
  },
  {
    id: "mold-warrens",
    name: "The Mold Warrens",
    tagline: "Everything down here is growing.",
    objective: "Cross the warrens and rob the fungal shrine",
    grid: generateSeededGrid("mold-warrens", 2),
    theme: {
      background: 0x07100d,
      stoneTint: 0x9ebda6,
      accent: 0x79d486,
      haze: 0x285a48,
      darkness: 0x020806,
    },
  },
  {
    id: "crystal-chasm",
    name: "The Crystal Chasm",
    tagline: "A glowing labyrinth of razor-sharp crystal.",
    objective: "Infiltrate the crystal vault and retrieve its crown",
    grid: generateSeededGrid("crystal-chasm", 3),
    theme: {
      background: 0x0d0716,
      stoneTint: 0xcda3e2,
      accent: 0xd94cef,
      haze: 0x49185a,
      darkness: 0x050207,
    },
  },
  {
    id: "sunken-bastion",
    name: "The Sunken Bastion",
    tagline: "Water drips in the dark. The deep is waiting.",
    objective: "Dive into the bastion and claim the submerged crown",
    grid: generateSeededGrid("sunken-bastion", 4),
    theme: {
      background: 0x060f16,
      stoneTint: 0x9cc3d6,
      accent: 0x3bd5e7,
      haze: 0x1f4d62,
      darkness: 0x020508,
    },
  },
];

export function dungeonAt(index: number): DungeonDefinition {
  if (!Number.isInteger(index)) throw new Error(`Dungeon index must be an integer, got ${index}`);
  const wrappedIndex = ((index % DUNGEONS.length) + DUNGEONS.length) % DUNGEONS.length;
  const baseDungeon = DUNGEONS[wrappedIndex]!;
  (baseDungeon as any).grid = generateSeededGrid(baseDungeon.id, index);
  return baseDungeon;
}
