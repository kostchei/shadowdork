/**
 * Embedding: place a topology's five nodes into the 4-row x 5-column macro-grid,
 * route each edge through at most two filler cells, and report how rooms sit
 * relative to one another so connector kinds can be chosen.
 *
 * Following the plan's steer, we do NOT run a general planar embedder. Each Tier 1
 * form has one hand-authored canonical placement (drawn from the plan's own
 * example layouts), and variety comes from the grid's symmetry group. The grid is
 * 5x4, not square, so only the four rectangle symmetries apply: identity, flip-x,
 * flip-y, and 180-degree rotation. 90-degree rotations are excluded.
 *
 * Edge routing is automatic: a breadth-first search finds the shortest orthogonal
 * path through unoccupied cells, and each route claims its filler cells so no two
 * connectors ever cross. Routes longer than two filler cells are rejected — the
 * "two-zone walk is fine, but no farther" pacing rule from the reference.
 */

import type { MacroPoint, RelativeDirection } from "./model";
import type { Edge, TopologyForm, TopologyId } from "./topology";

export const MACRO_COLUMNS = 5;
export const MACRO_ROWS = 4;
export const MAX_ROUTE_FILLERS = 2;

export type Orientation = "identity" | "flip-x" | "flip-y" | "rot180";
export const ORIENTATIONS: readonly Orientation[] = ["identity", "flip-x", "flip-y", "rot180"];

interface Placement {
  node: number;
  column: number;
  row: number;
}

/**
 * Canonical placements. Each entry is authored so that every edge routes through
 * zero to two filler cells with no crossings, and so a useful spread of rooms sits
 * on the grid boundary (entrance/exit eligible).
 */
const CANONICAL: Record<TopologyId, readonly Placement[]> = {
  // 5-path straight across the third row.
  railroad: [
    { node: 0, column: 0, row: 2 },
    { node: 1, column: 1, row: 2 },
    { node: 2, column: 2, row: 2 },
    { node: 3, column: 3, row: 2 },
    { node: 4, column: 4, row: 2 },
  ],
  // Plan's "Top-right Arrow": a leaf hangs above the hub. (Node 4 is the leaf.)
  arrow: [
    { node: 0, column: 0, row: 2 },
    { node: 1, column: 1, row: 2 },
    { node: 2, column: 2, row: 2 },
    { node: 3, column: 3, row: 2 },
    { node: 4, column: 2, row: 0 },
  ],
  // 5-star: hub at centre with spokes up, down, left, right.
  cross: [
    { node: 2, column: 2, row: 2 },
    { node: 0, column: 0, row: 2 },
    { node: 1, column: 2, row: 0 },
    { node: 3, column: 4, row: 2 },
    { node: 4, column: 2, row: 3 },
  ],
  // Diamond: node 1 forks to 2 and 3, both reconnect at node 4. Node 0 is the
  // entrance leaf on the left edge.
  "fauchard-fork": [
    { node: 0, column: 0, row: 1 },
    { node: 1, column: 1, row: 1 },
    { node: 2, column: 2, row: 0 },
    { node: 3, column: 2, row: 2 },
    { node: 4, column: 3, row: 1 },
  ],
  // Long main run 0-1-2-3 across the row, short optional branch 1-4 rising up.
  moose: [
    { node: 0, column: 0, row: 2 },
    { node: 1, column: 1, row: 2 },
    { node: 2, column: 2, row: 2 },
    { node: 3, column: 4, row: 2 },
    { node: 4, column: 1, row: 0 },
  ],
  // Two vertical approaches (0-1 and 3-4) converging on apex node 2 at the bottom.
  v: [
    { node: 0, column: 0, row: 0 },
    { node: 1, column: 0, row: 2 },
    { node: 2, column: 2, row: 3 },
    { node: 4, column: 4, row: 2 },
    { node: 3, column: 4, row: 0 },
  ],
  "five-circle": [
    { node: 0, column: 0, row: 1 }, { node: 1, column: 1, row: 1 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 2, row: 2 },
    { node: 4, column: 0, row: 2 },
  ],
  lollipop: [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 3, row: 1 },
    { node: 4, column: 4, row: 1 },
  ],
  "foglio-snail": [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 1, row: 1 },
    { node: 4, column: 0, row: 1 },
  ],
  paw: [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 3, row: 1 },
    { node: 4, column: 2, row: 2 },
  ],
  banner: [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 1, row: 1 },
    { node: 4, column: 0, row: 0 },
  ],
  bull: [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 2, row: 1 }, { node: 3, column: 0, row: 0 },
    { node: 4, column: 3, row: 1 },
  ],
  stingray: [
    { node: 0, column: 1, row: 0 }, { node: 1, column: 2, row: 0 },
    { node: 2, column: 1, row: 1 }, { node: 3, column: 2, row: 1 },
    { node: 4, column: 4, row: 1 },
  ],
  house: [
    { node: 0, column: 1, row: 3 }, { node: 1, column: 1, row: 2 },
    { node: 2, column: 2, row: 2 }, { node: 3, column: 2, row: 3 },
    { node: 4, column: 1, row: 1 },
  ],
  hourglass: [
    { node: 0, column: 0, row: 1 }, { node: 1, column: 0, row: 0 },
    { node: 2, column: 1, row: 1 }, { node: 3, column: 2, row: 1 },
    { node: 4, column: 2, row: 2 },
  ],
  kite: [
    { node: 0, column: 2, row: 0 }, { node: 1, column: 1, row: 1 },
    { node: 2, column: 3, row: 1 }, { node: 3, column: 2, row: 2 },
    { node: 4, column: 2, row: 3 },
  ],
};

const CANONICAL_JUNCTIONS: Partial<Record<TopologyId, Placement>> = {
  kite: { node: -1, column: 2, row: 1 },
};

export interface EmbeddedEdge {
  edge: Edge;
  routedCells: readonly MacroPoint[];
  direction: RelativeDirection;
  viaJunction: boolean;
}

export interface Embedding {
  topologyId: TopologyId;
  orientation: Orientation;
  /** node index -> macro cell. */
  cells: ReadonlyMap<number, MacroPoint>;
  /** node indices whose cell touches the grid perimeter. */
  boundaryNodes: ReadonlySet<number>;
  edges: readonly EmbeddedEdge[];
  /** Explicit shared filler cells; duplicate routes are legal only here. */
  junctionCells: readonly MacroPoint[];
}

function key(column: number, row: number): string {
  return `${column},${row}`;
}

function inBounds(column: number, row: number): boolean {
  return column >= 0 && column < MACRO_COLUMNS && row >= 0 && row < MACRO_ROWS;
}

function isBoundary(p: MacroPoint): boolean {
  return p.column === 0 || p.column === MACRO_COLUMNS - 1 || p.row === 0 || p.row === MACRO_ROWS - 1;
}

function transform(p: Placement, orientation: Orientation): Placement {
  const column =
    orientation === "flip-x" || orientation === "rot180" ? MACRO_COLUMNS - 1 - p.column : p.column;
  const row =
    orientation === "flip-y" || orientation === "rot180" ? MACRO_ROWS - 1 - p.row : p.row;
  return { node: p.node, column, row };
}

/** Net-displacement classification of `to` relative to `from`. */
function relativeDirection(from: MacroPoint, to: MacroPoint): RelativeDirection {
  const dCol = to.column - from.column;
  const dRow = to.row - from.row;
  if (dCol === 0 && dRow !== 0) return dRow < 0 ? "above" : "below";
  if (dRow === 0 && dCol !== 0) return "beside";
  return "non-adjacent";
}

/**
 * Shortest orthogonal path from `from` to `to` through cells that are neither
 * rooms nor already claimed by another route. Returns the intermediate (filler)
 * cells only, or null if none exists within the filler budget.
 */
function routeEdge(
  from: MacroPoint,
  to: MacroPoint,
  rooms: ReadonlySet<string>,
  claimed: ReadonlySet<string>,
): MacroPoint[] | null {
  const start = key(from.column, from.row);
  const goal = key(to.column, to.row);
  const queue: { column: number; row: number; path: MacroPoint[] }[] = [
    { column: from.column, row: from.row, path: [] },
  ];
  const seen = new Set<string>([start]);
  const steps: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dc, dr] of steps) {
      const nc = cur.column + dc;
      const nr = cur.row + dr;
      if (!inBounds(nc, nr)) continue;
      const k = key(nc, nr);
      if (seen.has(k)) continue;
      if (k === goal) return cur.path; // endpoints excluded from routedCells
      // Intermediate cells must be free filler.
      if (rooms.has(k) || claimed.has(k)) continue;
      if (cur.path.length >= MAX_ROUTE_FILLERS) continue;
      seen.add(k);
      queue.push({ column: nc, row: nr, path: [...cur.path, { column: nc as MacroPoint["column"], row: nr as MacroPoint["row"] }] });
    }
  }
  return null;
}

/**
 * Embed a form in a given orientation. Throws if any edge cannot be routed within
 * the filler budget without crossing another route — an authoring error for the
 * Tier 1 catalogue, but a signal the generator can catch for future dense forms.
 */
export function embed(form: TopologyForm, orientation: Orientation): Embedding {
  const placements = CANONICAL[form.id].map((p) => transform(p, orientation));
  const cells = new Map<number, MacroPoint>();
  const rooms = new Set<string>();
  for (const p of placements) {
    const cell: MacroPoint = { column: p.column as MacroPoint["column"], row: p.row as MacroPoint["row"] };
    cells.set(p.node, cell);
    rooms.add(key(p.column, p.row));
  }
  if (rooms.size !== placements.length) {
    throw new Error(`Embedding for ${form.id} places two rooms on one cell`);
  }

  const boundaryNodes = new Set<number>();
  for (const [node, cell] of cells) if (isBoundary(cell)) boundaryNodes.add(node);

  const claimed = new Set<string>();
  const edges: EmbeddedEdge[] = [];
  const canonicalJunction = CANONICAL_JUNCTIONS[form.id];
  const junctionCells = canonicalJunction
    ? [transform(canonicalJunction, orientation)].map((p) => ({
        column: p.column as MacroPoint["column"],
        row: p.row as MacroPoint["row"],
      }))
    : [];
  const junctionKeys = new Set(junctionCells.map((cell) => key(cell.column, cell.row)));
  // Route shorter edges first so tight adjacencies claim their cells before long
  // routes consume the shared filler between them.
  const ordered = [...form.edges].sort((a, b) => manhattan(cells, a) - manhattan(cells, b));
  for (const edge of ordered) {
    const from = cells.get(edge[0])!;
    const to = cells.get(edge[1])!;
    const usesJunction = form.id === "kite" && edge[0] < 4 && edge[1] < 4;
    const routed = usesJunction ? [...junctionCells] : routeEdge(from, to, rooms, claimed);
    if (!routed) {
      throw new Error(
        `Cannot route edge ${edge[0]}-${edge[1]} of ${form.id} (${orientation}) within ${MAX_ROUTE_FILLERS} filler cells`,
      );
    }
    for (const cell of routed) {
      const cellKey = key(cell.column, cell.row);
      if (!junctionKeys.has(cellKey)) claimed.add(cellKey);
    }
    edges.push({ edge, routedCells: routed, direction: relativeDirection(from, to), viaJunction: usesJunction });
  }
  // Restore the form's declared edge order for stable downstream indexing.
  edges.sort((a, b) => form.edges.indexOf(a.edge) - form.edges.indexOf(b.edge));

  return { topologyId: form.id, orientation, cells, boundaryNodes, edges, junctionCells };
}

function manhattan(cells: ReadonlyMap<number, MacroPoint>, edge: Edge): number {
  const a = cells.get(edge[0])!;
  const b = cells.get(edge[1])!;
  return Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
}

/** Every occupied or routed cell, for downstream tile expansion and diagnostics. */
export function occupiedCells(embedding: Embedding): {
  rooms: readonly MacroPoint[];
  fillers: readonly MacroPoint[];
} {
  const rooms = [...embedding.cells.values()];
  const fillersByKey = new Map<string, MacroPoint>();
  for (const e of embedding.edges) {
    for (const cell of e.routedCells) fillersByKey.set(key(cell.column, cell.row), cell);
  }
  const fillers = [...fillersByKey.values()];
  return { rooms, fillers };
}
