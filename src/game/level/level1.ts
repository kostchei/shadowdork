/**
 * "The Gloom Below" — a Five Room Dungeon (Johnn Four's structure), then a rest spot:
 *
 *   Room 1  Entrance & Guardian   — goblin guardians; the caged Thief.
 *   Room 2  Puzzle / Roleplay     — a sheer barrier: Thief climbs the vines OR the
 *                                   Fighter smashes the cracked base; Priest shrine above.
 *   Room 3  Trick / Setback       — spike-trap gauntlet with bait treasure between the
 *                                   pits; skeleton ambush; the Wizard mid-losing-battle.
 *   Room 4  Climax                — the Gloom Ogre and its goblin minions.
 *   Room 5  Reward / Revelation   — the vault: the Crown of the Deep (and one last guard).
 *   Rest spot                     — safe camp: free full recovery + fresh torches; exit door.
 *
 * Legend:
 *   #  wall            %  weak wall (fighter breaks)   |  climbable (thief)
 *   =  one-way platform (jump up through, stand on top)
 *   ^  spikes          P  player start (fighter)
 *   2  caged thief     3  priest at shrine             4  wizard mid-fight
 *   g  goblin  s skeleton  r giant rat  O gloom ogre
 *   c  coins   G gem   I jeweled idol   K crown (legendary)
 *   t  torch pickup    n  ration pickup
 *   f  campfire (rest costs a ration)   F  rest spot (free recovery + fresh torch)
 *   D  exit door
 */

export const LEVEL_W = 120;
export const LEVEL_H = 17;

function buildLevel(): string[] {
  const grid: string[][] = Array.from({ length: LEVEL_H }, () =>
    Array.from({ length: LEVEL_W }, () => "."),
  );

  const put = (x: number, y: number, ch: string): void => {
    if (x < 0 || x >= LEVEL_W || y < 0 || y >= LEVEL_H) {
      throw new Error(`Out of bounds placement (${x},${y})`);
    }
    grid[y]![x] = ch;
  };
  const hline = (x1: number, x2: number, y: number, ch: string): void => {
    for (let x = x1; x <= x2; x++) put(x, y, ch);
  };
  const vline = (x: number, y1: number, y2: number, ch: string): void => {
    for (let y = y1; y <= y2; y++) put(x, y, ch);
  };
  /** Room divider: solid above, a walk-through doorway at floor level. */
  const divider = (x: number): void => vline(x, 1, 11, "#");

  // Shell: ceiling, floor, side walls.
  hline(0, LEVEL_W - 1, 0, "#");
  hline(0, LEVEL_W - 1, 15, "#");
  hline(0, LEVEL_W - 1, 16, "#");
  vline(0, 0, 16, "#");
  vline(LEVEL_W - 1, 0, 16, "#");

  // ── Room 1: Entrance & Guardian (x1-20) ─────────────────────────────
  put(2, 14, "P");
  put(4, 14, "t");
  put(9, 14, "g");
  put(12, 14, "g");
  put(17, 14, "r");
  hline(14, 17, 12, "="); // cage ledge
  put(15, 11, "2");
  put(17, 11, "c");
  divider(21);

  // ── Room 2: Puzzle — the Barrier (x22-41) ───────────────────────────
  // Priest shrine on a high ledge, reachable by stepping stones.
  hline(24, 26, 12, "=");
  hline(27, 30, 9, "=");
  put(28, 8, "3");
  put(30, 8, "G");
  // The barrier: vine-covered wall with a cracked base and open air at the top.
  // Thief: jump, catch the vines (W), climb over. Fighter: smash the base.
  vline(36, 4, 11, "|");
  vline(36, 12, 14, "%");
  put(33, 14, "n");
  divider(42);

  // ── Room 3: Trick / Setback — the Gauntlet (x43-63) ─────────────────
  // Bait treasure sits between two spike pits; skeletons wait beyond.
  hline(46, 48, 15, ".");
  hline(46, 48, 16, ".");
  hline(46, 48, 16, "^");
  put(50, 14, "c"); // the bait
  hline(52, 54, 15, ".");
  hline(52, 54, 16, ".");
  hline(52, 54, 16, "^");
  put(57, 14, "s");
  put(59, 14, "s");
  put(62, 14, "g");
  put(61, 14, "4"); // the Wizard, mid-losing-battle
  put(56, 14, "t");
  divider(64);

  // ── Room 4: Climax — the Gloom Ogre (x65-84) ────────────────────────
  put(69, 14, "g");
  put(74, 14, "O");
  put(78, 14, "g");
  hline(79, 82, 12, "=");
  put(81, 11, "I");
  divider(85);

  // ── Room 5: Reward / Revelation — the Vault (x86-97) ────────────────
  put(87, 14, "s"); // one last guardian in the treasure
  hline(88, 91, 13, "=");
  put(89, 12, "K");
  put(91, 12, "G");
  put(93, 14, "c");
  put(95, 14, "c");
  divider(98);

  // ── Rest spot (x99-118): safe camp + exit ───────────────────────────
  put(104, 14, "F");
  put(106, 14, "n");
  put(112, 14, "D");

  const rows = grid.map((r) => r.join(""));
  for (const row of rows) {
    if (row.length !== LEVEL_W) throw new Error("Level row width mismatch");
  }
  return rows;
}

export const LEVEL1: readonly string[] = buildLevel();
