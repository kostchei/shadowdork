/**
 * Topology catalogue: five-node connected graphs, independent of tile geometry.
 *
 * A form describes potential room-to-room adjacency only. Whether a given edge
 * becomes an open passage, a gated door, a secret, or a one-way drop is decided
 * later by connector assignment. Milestone 1 ships the six Tier 1 forms that stay
 * readable with five rooms and need no corridor crossings.
 */

export type TopologyId =
  | "railroad"
  | "arrow"
  | "cross"
  | "fauchard-fork"
  | "moose"
  | "v";

export type Edge = readonly [number, number];

export interface TopologyForm {
  id: TopologyId;
  label: string;
  tier: 1 | 2 | 3;
  /** Undirected edges over node indices 0-4. */
  edges: readonly Edge[];
  /**
   * Selection weight. Railroad is deliberately low so it stays a minority: with
   * these weights it is 2 / (2 + 5*5) = ~7.4% of runs, comfortably under the 20%
   * cap even before richer forms ship.
   */
  weight: number;
}

export const TOPOLOGIES: readonly TopologyForm[] = [
  // 5-path. The accessibility-friendly baseline, kept a minority.
  {
    id: "railroad",
    label: "Railroad",
    tier: 1,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    weight: 2,
  },
  // A short main run with a leaf hung off an interior node — an early temptation.
  {
    id: "arrow",
    label: "Arrow",
    tier: 1,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    weight: 5,
  },
  // 5-star: a central hub with four spokes.
  {
    id: "cross",
    label: "Cross",
    tier: 1,
    edges: [
      [2, 0],
      [2, 1],
      [2, 3],
      [2, 4],
    ],
    weight: 5,
  },
  // The only Tier 1 form with a cycle: an early split that reconnects at node 4.
  {
    id: "fauchard-fork",
    label: "Fauchard Fork",
    tier: 1,
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
    ],
    weight: 5,
  },
  // A long main route (0-1-2-3) with a short optional branch (1-4).
  {
    id: "moose",
    label: "Moose",
    tier: 1,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
    ],
    weight: 5,
  },
  // Two approaches (0-1 and 3-4) converging on a shared apex node 2.
  {
    id: "v",
    label: "V for Vendetta",
    tier: 1,
    edges: [
      [1, 0],
      [1, 2],
      [4, 2],
      [4, 3],
    ],
    weight: 5,
  },
];

export const NODE_COUNT = 5;

export function topologyById(id: TopologyId): TopologyForm {
  const form = TOPOLOGIES.find((t) => t.id === id);
  if (!form) throw new Error(`Unknown topology "${id}"`);
  return form;
}

/** Adjacency list keyed by node index. */
export function adjacency(form: TopologyForm): number[][] {
  const adj: number[][] = Array.from({ length: NODE_COUNT }, () => []);
  for (const [a, b] of form.edges) {
    if (a === b) throw new Error(`Self-loop on node ${a} in ${form.id}`);
    adj[a]!.push(b);
    adj[b]!.push(a);
  }
  return adj;
}

export function degrees(form: TopologyForm): number[] {
  return adjacency(form).map((neighbours) => neighbours.length);
}

/** Every Tier 1 form must be a single connected component over all five nodes. */
export function isConnected(form: TopologyForm): boolean {
  const adj = adjacency(form);
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const n = stack.pop()!;
    for (const m of adj[n]!) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return seen.size === NODE_COUNT;
}
