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

function buildGloomBelow(): readonly string[] {
  const g = gridBuilder();

  // Entrance: guarded cage and the first warm island of light.
  g.put(2, 14, "P");
  g.put(4, 14, "t");
  g.put(6, 14, "b");
  g.put(9, 14, "g");
  g.put(12, 14, "g");
  g.put(17, 14, "r");
  g.hline(14, 17, 12, "=");
  g.put(15, 11, "2");
  g.put(17, 11, "c");
  g.put(19, 14, "q");
  g.divider(21);

  // Puzzle: high shrine and a barrier with two class-led solutions.
  g.hline(24, 26, 12, "=");
  g.hline(27, 30, 9, "=");
  g.put(28, 8, "3");
  g.put(30, 8, "G");
  g.vline(36, 4, 11, "|");
  g.vline(36, 12, 14, "%");
  g.put(33, 14, "n");
  g.put(39, 14, "*");
  g.divider(42);

  // Setback: bait between spike beds, followed by an ambush.
  g.hline(46, 48, 15, ".");
  g.hline(46, 48, 16, "^");
  g.put(50, 14, "c");
  g.hline(52, 54, 15, ".");
  g.hline(52, 54, 16, "^");
  g.put(57, 14, "s");
  g.put(59, 14, "s");
  g.put(62, 14, "g");
  g.put(61, 14, "4");
  g.put(56, 14, "t");
  g.put(45, 14, ":");
  g.divider(64);

  // Climax and vault.
  g.put(67, 14, "b");
  g.put(69, 14, "g");
  g.put(74, 14, "O");
  g.put(78, 14, "g");
  g.hline(79, 82, 12, "=");
  g.put(81, 11, "I");
  g.divider(85);
  g.put(87, 14, "s");
  g.hline(88, 91, 13, "=");
  g.put(89, 12, "K");
  g.put(91, 12, "G");
  g.put(93, 14, "c");
  g.put(95, 14, "c");
  g.put(96, 14, "v");
  g.divider(98);

  g.put(104, 14, "F");
  g.put(106, 14, "n");
  g.put(112, 14, "D");
  return g.finish();
}

function buildEmberCrypt(): readonly string[] {
  const g = gridBuilder();

  // A brighter, combat-forward crypt entrance with an overhead rescue route.
  g.put(2, 14, "P");
  g.put(4, 14, "b");
  g.put(7, 14, "s");
  g.put(11, 14, "s");
  g.hline(14, 19, 11, "=");
  g.put(17, 10, "2");
  g.put(19, 10, "G");
  g.put(14, 14, "r");
  g.put(6, 14, "q");
  g.divider(21);

  // Broken stair puzzle: platform route above, smash-through shortcut below.
  g.hline(23, 26, 12, "=");
  g.hline(28, 31, 9, "=");
  g.hline(33, 36, 6, "=");
  g.put(34, 5, "3");
  g.put(36, 5, "I");
  g.vline(38, 9, 14, "%");
  g.put(25, 14, "n");
  g.put(40, 14, "b");
  g.divider(42);

  // A low crypt of alternating safe shelves and spike trenches.
  g.hline(45, 47, 15, ".");
  g.hline(45, 47, 16, "^");
  g.hline(48, 51, 12, "=");
  g.put(50, 11, "c");
  g.hline(53, 55, 15, ".");
  g.hline(53, 55, 16, "^");
  g.put(57, 14, "4");
  g.put(59, 14, "g");
  g.put(61, 14, "s");
  g.put(63, 14, "t");
  g.divider(64);

  // The ogre owns the upper dais; weak pillars create a safer floor route.
  g.put(67, 14, "g");
  g.hline(70, 78, 11, "=");
  g.put(74, 10, "O");
  g.put(79, 14, "g");
  g.vline(69, 12, 14, "%");
  g.vline(80, 12, 14, "%");
  g.put(82, 14, "b");
  g.divider(85);

  // Reliquary staircase makes the reward visible before it is reachable.
  g.hline(87, 90, 12, "=");
  g.hline(92, 95, 9, "=");
  g.put(93, 8, "K");
  g.put(95, 8, "G");
  g.put(88, 11, "s");
  g.put(96, 14, "c");
  g.put(87, 14, "v");
  g.divider(98);

  g.put(102, 14, "F");
  g.put(106, 14, "t");
  g.put(112, 14, "D");
  return g.finish();
}

function buildMoldWarrens(): readonly string[] {
  const g = gridBuilder();

  // The warrens open on rats, fungus, and a low rescue shelf.
  g.put(2, 14, "P");
  g.put(5, 14, "b");
  g.put(8, 14, "r");
  g.put(11, 14, "r");
  g.put(14, 14, "g");
  g.hline(15, 19, 12, "=");
  g.put(17, 11, "2");
  g.put(19, 11, "t");
  g.put(7, 14, "*");
  g.divider(21);

  // Two-tier mushroom gallery with a breakable lower route.
  g.hline(23, 27, 12, "=");
  g.hline(29, 33, 9, "=");
  g.hline(35, 39, 6, "=");
  g.put(37, 5, "3");
  g.put(39, 5, "G");
  g.vline(34, 10, 14, "%");
  g.put(26, 14, "*");
  g.put(31, 14, "n");
  g.put(40, 14, "*");
  g.divider(42);

  // Jagged floor routes reward deliberate jumps instead of a straight sprint.
  g.hline(44, 46, 15, ".");
  g.hline(44, 46, 16, "^");
  g.hline(48, 51, 11, "=");
  g.put(49, 10, "c");
  g.hline(53, 56, 15, ".");
  g.hline(53, 56, 16, "^");
  g.put(58, 14, "4");
  g.put(60, 14, "g");
  g.put(62, 14, "r");
  g.divider(64);

  // Dense multi-height boss arena with a lit flank.
  g.put(66, 14, "b");
  g.put(69, 14, "g");
  g.hline(70, 73, 11, "=");
  g.put(72, 10, "g");
  g.put(76, 14, "O");
  g.hline(79, 82, 9, "=");
  g.put(81, 8, "I");
  g.put(83, 14, "r");
  g.divider(85);

  // A fungal shrine vault: treasure is stacked vertically, not in a line.
  g.hline(87, 91, 12, "=");
  g.hline(92, 96, 9, "=");
  g.put(89, 11, "s");
  g.put(94, 8, "K");
  g.put(96, 8, "G");
  g.put(93, 14, "c");
  g.put(96, 14, "*");
  g.divider(98);

  g.put(103, 14, "F");
  g.put(106, 14, "n");
  g.put(112, 14, "D");
  return g.finish();
}

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: "gloom-below",
    name: "The Gloom Below",
    tagline: "Old stone. Thin light. Hungry eyes.",
    objective: "Recover the Crown of the Deep",
    grid: buildGloomBelow(),
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
    grid: buildEmberCrypt(),
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
    grid: buildMoldWarrens(),
    theme: {
      background: 0x07100d,
      stoneTint: 0x9ebda6,
      accent: 0x79d486,
      haze: 0x285a48,
      darkness: 0x020806,
    },
  },
];

export function dungeonAt(index: number): DungeonDefinition {
  if (!Number.isInteger(index)) throw new Error(`Dungeon index must be an integer, got ${index}`);
  return DUNGEONS[((index % DUNGEONS.length) + DUNGEONS.length) % DUNGEONS.length]!;
}
