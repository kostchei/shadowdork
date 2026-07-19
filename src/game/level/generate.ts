/**
 * Generation orchestrator for the abstract (pre-tile) dungeon.
 *
 * Runs the plan's pipeline as separable stages, each drawing from an independent
 * seeded stream so the four variance axes stay orthogonal: space (topology +
 * embedding + orientation), starting point (entrance), order (which beat lands on
 * which node), and contents (family + tags). Every candidate is proven completable
 * by the state-search validator before it is returned.
 *
 * Retries are deterministic and bounded: candidate `c` derives all its streams
 * from `hash(seed, ...#c)`, so the same seed always yields the same accepted
 * dungeon. If the budget is exhausted the generator throws — it never publishes a
 * partially validated dungeon, and (per project policy) never silently falls back.
 */

import type {
  AbstractDungeon,
  Beat,
  ContentFamily,
  ConnectorKind,
  DungeonConnection,
  DungeonRoomNode,
  MacroPoint,
  RelativeDirection,
  Requirement,
} from "./model";
import { embed, ORIENTATIONS, type Embedding, type Orientation } from "./embedding";
import { rngFor, type Rng } from "./rng";
import { validate } from "./progression";
import {
  adjacency,
  NODE_COUNT,
  TOPOLOGIES,
  topologyById,
  type TopologyForm,
  type TopologyId,
} from "./topology";

export const DEFAULT_CANDIDATE_BUDGET = 64;

const THEME_IDS = ["gloom-below", "ember-crypt", "mold-warrens", "drowned-angle"] as const;

const CONTENT_TAGS: Record<ContentFamily, readonly string[]> = {
  discovery: ["npc", "sentinel", "atmosphere", "exploration", "secret", "separated"],
  challenge: ["puzzle", "obstacle", "trick", "setback", "device", "betrayal"],
  hazard: ["trap", "switch", "environment", "timer", "targets", "gate"],
  opportunity: ["treasure", "weapon", "narrative", "healing", "lore", "spells"],
  pressure: ["combat", "boss", "stealth", "reinforcements", "outmatched", "injury"],
  twist: ["roleplay", "dispute", "revelation", "reversal", "escape", "death-risk"],
};

function roomId(node: number): string {
  return `room-${node}`;
}

/** Undirected adjacency over node indices, honouring which edges to omit. */
function undirectedReach(form: TopologyForm, from: number, omit?: readonly [number, number]): Set<number> {
  const adj = adjacency(form);
  const blocked = omit ? new Set([`${omit[0]}-${omit[1]}`, `${omit[1]}-${omit[0]}`]) : null;
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const n = stack.pop()!;
    for (const m of adj[n]!) {
      if (blocked?.has(`${n}-${m}`)) continue;
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return seen;
}

/** Edges whose removal keeps all five nodes connected — safe to make optional. */
function redundantEdges(form: TopologyForm): (readonly [number, number])[] {
  return form.edges.filter((e) => undirectedReach(form, 0, e).size === NODE_COUNT);
}

/** Graph distance in edges from `from` to every node (undirected). */
function graphDistances(form: TopologyForm, from: number): number[] {
  const adj = adjacency(form);
  const dist = Array.from({ length: NODE_COUNT }, () => Infinity);
  dist[from] = 0;
  const queue = [from];
  while (queue.length > 0) {
    const n = queue.shift()!;
    for (const m of adj[n]!) {
      if (dist[m] === Infinity) {
        dist[m] = dist[n]! + 1;
        queue.push(m);
      }
    }
  }
  return dist;
}

function pickKind(direction: RelativeDirection, rng: Rng): ConnectorKind {
  switch (direction) {
    case "beside":
      return rng.weighted<ConnectorKind>([
        { value: "passage", weight: 3 },
        { value: "bridge", weight: 1 },
      ]);
    case "above":
      return rng.weighted<ConnectorKind>([
        { value: "ladder", weight: 2 },
        { value: "stairs", weight: 2 },
        { value: "rope", weight: 1 },
      ]);
    case "below":
      return rng.weighted<ConnectorKind>([
        { value: "stairs", weight: 2 },
        { value: "ladder", weight: 1 },
        { value: "controlled-drop", weight: 1 },
      ]);
    case "non-adjacent":
      return "passage"; // routed through filler cells
  }
}

/**
 * Assign the five beats to nodes. The starting-point axis and the narrative-order
 * axis are kept independent by drawing from two separate streams: `entranceRng`
 * selects the entrance and nothing else, while `orderRng` decides which of the
 * remaining beats land where. A change in entrance draws therefore cannot perturb
 * beat placement, and vice versa (see the four variance axes in the plan).
 */
function assignBeats(
  form: TopologyForm,
  boundaryNodes: ReadonlySet<number>,
  entranceRng: Rng,
  orderRng: Rng,
): { beats: Map<number, Beat>; entrance: number; climax: number; reward: number; exit: number } {
  const deg = adjacency(form).map((a) => a.length);
  const nodes = [0, 1, 2, 3, 4];

  // Entrance: a boundary node, preferring a leaf (degree 1) for a clean mouth.
  const boundary = nodes.filter((n) => boundaryNodes.has(n));
  if (boundary.length === 0) throw new Error(`${form.id} embedding has no boundary room`);
  const entrancePool = boundary.filter((n) => deg[n] === 1);
  const entrance = entranceRng.pick(entrancePool.length > 0 ? entrancePool : boundary);

  const dist = graphDistances(form, entrance);

  // Climax: highest-degree node that is not the entrance (the hub or convergence).
  const others = nodes.filter((n) => n !== entrance);
  const maxDeg = Math.max(...others.map((n) => deg[n]!));
  const climax = orderRng.pick(others.filter((n) => deg[n] === maxDeg));

  // Reward: a boundary node distinct from entrance and climax, farthest from the
  // entrance so claiming it means travelling across the footprint.
  const rewardPool = boundary.filter((n) => n !== entrance && n !== climax);
  const rewardCandidates = rewardPool.length > 0 ? rewardPool : others.filter((n) => n !== climax);
  const maxDist = Math.max(...rewardCandidates.map((n) => dist[n]!));
  const reward = orderRng.pick(rewardCandidates.filter((n) => dist[n] === maxDist));

  // Exit: a boundary room, ideally not the entrance and giving meaningful travel.
  const exitPool = boundary.filter((n) => n !== entrance);
  const exitCandidates = exitPool.length > 0 ? exitPool : others;
  const exitDist = Math.max(...exitCandidates.map((n) => dist[n]!));
  const exit = orderRng.pick(exitCandidates.filter((n) => dist[n] === exitDist));

  const beats = new Map<number, Beat>();
  beats.set(entrance, "entrance");
  beats.set(climax, "climax");
  beats.set(reward, "reward");
  const remaining = nodes.filter((n) => !beats.has(n));
  const shuffled = orderRng.shuffle(remaining);
  const rest: Beat[] = ["challenge", "setback"];
  shuffled.forEach((n, i) => beats.set(n, rest[i] ?? "challenge"));

  return { beats, entrance, climax, reward, exit };
}

function familyForBeat(beat: Beat, rng: Rng): ContentFamily {
  // Draw exactly one value for every beat, even the ones whose family is fixed, so
  // the content stream advances the same amount regardless of which beat landed on
  // this node. That keeps the contents axis independent of the order axis: changing
  // beat assignment cannot shift the downstream content draws for later rooms.
  const roll = rng.next();
  switch (beat) {
    case "entrance":
      return "discovery";
    case "reward":
      return "opportunity";
    case "climax":
      return "pressure";
    case "challenge":
      return roll < 0.75 ? "challenge" : "twist";
    case "setback":
      return roll < 0.75 ? "hazard" : "challenge";
  }
}

function pickTags(family: ContentFamily, rng: Rng): string[] {
  const pool = rng.shuffle(CONTENT_TAGS[family]);
  const count = rng.between(1, 2);
  return pool.slice(0, count);
}

function tryBuild(seed: number, candidate: number, opts: GenerateOptions): AbstractDungeon | null {
  const suffix = `#${candidate}`;

  const form = opts.topology
    ? topologyById(opts.topology)
    : rngFor(seed, `topology${suffix}`).weighted(
        TOPOLOGIES.map((t) => ({ value: t, weight: t.weight })),
      );

  const embRng = rngFor(seed, `embedding${suffix}`);
  const orientation = opts.orientation ?? embRng.pick(ORIENTATIONS);
  let embedding: Embedding;
  try {
    embedding = embed(form, orientation);
  } catch {
    return null; // unroutable orientation — let the next candidate try
  }

  const { beats, entrance, climax, reward, exit } = assignBeats(
    form,
    embedding.boundaryNodes,
    rngFor(seed, `entrance${suffix}`),
    rngFor(seed, `order${suffix}`),
  );

  const contentRng = rngFor(seed, `content${suffix}`);
  const rooms: DungeonRoomNode[] = [];
  for (let node = 0; node < NODE_COUNT; node++) {
    const cell = embedding.cells.get(node)!;
    const beat = beats.get(node)!;
    const family = familyForBeat(beat, contentRng);
    rooms.push({
      id: roomId(node),
      node,
      position: cell as MacroPoint,
      beat,
      contentFamily: family,
      tags: pickTags(family, contentRng),
      boundary: embedding.boundaryNodes.has(node),
    });
  }

  const connRng = rngFor(seed, `connectors${suffix}`);
  const requirements: Requirement[] = [];
  const connections: DungeonConnection[] = [];

  // Edges routed through a shared junction cell cannot own an independent physical
  // blocker: closing one would wall off every sibling edge crossing the same arm.
  // They must therefore stay open passages and are excluded from every gating,
  // decorating, and degree-capping decision below.
  const junctionEdgeIds = new Set(
    embedding.edges.filter((e) => e.viaJunction).map((e) => `conn-${e.edge[0]}-${e.edge[1]}`),
  );
  const isJunctionEdge = (a: number, b: number) => junctionEdgeIds.has(`conn-${a}-${b}`);

  // Choose at most one gated edge, placing its key/switch on the entrance side so
  // it can never lock itself away.
  const gateEdgeIndex = connRng.next() < 0.35 ? connRng.between(0, form.edges.length - 1) : -1;
  const redundant = redundantEdges(form);
  // Decorate at most one redundant edge (optional route) so validator branches for
  // class shortcuts, secrets, and one-way edges are exercised without stranding.
  const decorateCandidates = redundant.filter(([a, b]) => !isJunctionEdge(a, b));
  const decorateEdge =
    decorateCandidates.length > 0 && connRng.next() < 0.5
      ? connRng.pick(decorateCandidates)
      : null;

  embedding.edges.forEach((embEdge, index) => {
    const [a, b] = embEdge.edge;
    const conn: DungeonConnection = {
      id: `conn-${a}-${b}`,
      fromRoomId: roomId(a),
      toRoomId: roomId(b),
      routedCells: embEdge.routedCells,
      kind: embEdge.viaJunction ? "junction" : pickKind(embEdge.direction, connRng),
      state: "open",
      direction: "two-way",
      classFavoured: false,
    };

    if (index === gateEdgeIndex && !embEdge.viaJunction) {
      const nearSide = undirectedReach(form, entrance, embEdge.edge);
      const keyNode = connRng.pick([...nearSide]);
      const useSwitch = connRng.next() < 0.5;
      const req: Requirement = {
        id: `req-${a}-${b}`,
        kind: useSwitch ? "switch" : "key",
        sourceRoomId: roomId(keyNode),
      };
      requirements.push(req);
      conn.state = useSwitch ? "switched" : "locked";
      conn.requirementId = req.id;
      conn.kind = "portcullis";
    } else if (decorateEdge && decorateEdge[0] === a && decorateEdge[1] === b) {
      const flavour = connRng.between(0, 2);
      if (flavour === 0) {
        conn.classFavoured = true;
        conn.kind = "vine";
      } else if (flavour === 1) {
        conn.state = "secret";
        conn.kind = "secret-door";
      } else {
        conn.state = "one-way";
        if (embEdge.direction === "beside" || embEdge.direction === "non-adjacent") {
          conn.direction = connRng.next() < 0.5 ? "from-to" : "to-from";
          conn.kind = "passage";
        } else {
          // Slides and controlled drops always point downhill in world space.
          conn.direction = embEdge.direction === "below" ? "from-to" : "to-from";
          conn.kind = connRng.next() < 0.5 ? "slide" : "controlled-drop";
        }
      }
    }

    connections.push(conn);
  });

  // Dense forms may describe more potential adjacency than should be readable at
  // once. Close only redundant, non-junction edges until every room has at most
  // three initially open connections; the universal route remains intact. Junction
  // edges are exempt: the hub already consolidates a room's many logical links into
  // a single physical exit, and closing a junction edge would block its siblings.
  if (form.tier === 3) {
    const optionalIds = new Set(
      redundant.filter(([a, b]) => !isJunctionEdge(a, b)).map(([a, b]) => `conn-${a}-${b}`),
    );
    const initiallyOpen = (connection: DungeonConnection) =>
      connection.state === "open" || connection.state === "guarded" || connection.state === "one-way";
    const openDegree = new Map<string, number>();
    for (const connection of connections) if (initiallyOpen(connection)) {
      openDegree.set(connection.fromRoomId, (openDegree.get(connection.fromRoomId) ?? 0) + 1);
      openDegree.set(connection.toRoomId, (openDegree.get(connection.toRoomId) ?? 0) + 1);
    }
    for (const connection of [...connections].reverse()) {
      if (!optionalIds.has(connection.id) || !initiallyOpen(connection)) continue;
      if ((openDegree.get(connection.fromRoomId) ?? 0) <= 3 && (openDegree.get(connection.toRoomId) ?? 0) <= 3) continue;
      connection.state = "secret";
      connection.kind = "secret-door";
      connection.direction = "two-way";
      connection.classFavoured = false;
      openDegree.set(connection.fromRoomId, (openDegree.get(connection.fromRoomId) ?? 1) - 1);
      openDegree.set(connection.toRoomId, (openDegree.get(connection.toRoomId) ?? 1) - 1);
    }
  }

  const themeId = rngFor(seed, `theme${suffix}`).pick(THEME_IDS);

  const dungeon: AbstractDungeon = {
    seed,
    topologyId: form.id,
    orientation,
    themeId,
    macroWidth: 5,
    macroHeight: 4,
    rooms,
    connections,
    requirements,
    entranceRoomId: roomId(entrance),
    climaxRoomId: roomId(climax),
    rewardRoomId: roomId(reward),
    exitRoomId: roomId(exit),
  };
  return dungeon;
}

export interface GenerateOptions {
  candidateBudget?: number;
  /** Force a topology instead of the weighted roll (authoring, debugging, tests). */
  topology?: TopologyId;
  /** Force an embedding orientation instead of the seeded roll. */
  orientation?: Orientation;
}

/** Generate a validated abstract dungeon, deterministic in `seed`. */
export function generateAbstractDungeon(seed: number, opts: GenerateOptions = {}): AbstractDungeon {
  if (!Number.isInteger(seed)) throw new Error(`Seed must be an integer, got ${seed}`);
  const budget = opts.candidateBudget ?? DEFAULT_CANDIDATE_BUDGET;
  const failures: string[] = [];
  for (let c = 0; c < budget; c++) {
    const candidate = tryBuild(seed, c, opts);
    if (!candidate) {
      failures.push(`c${c}:unbuildable`);
      continue;
    }
    const result = validate(candidate);
    if (result.ok) return candidate;
    failures.push(`c${c}:${result.diagnostics.join(",")}`);
  }
  throw new Error(
    `Dungeon generation exhausted ${budget} candidates for seed ${seed}: ${failures.join(" | ")}`,
  );
}
