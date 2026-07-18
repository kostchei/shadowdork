/**
 * Abstract progression validation by state search.
 *
 * Connectivity alone is insufficient: a dungeon can be fully connected yet
 * impossible because a key sits behind its own gate, or a one-way slide strands
 * the party. So the validator searches over states (room + which requirements are
 * satisfied + whether the reward is claimed), not room positions alone, and proves
 * the run is completable under the universal traversal model.
 *
 * The universal proof deliberately ignores class-favoured shortcuts and secret
 * edges: a standard dungeon must be finishable without a specific class and
 * without the player finding a secret. Class verbs and secrets may make routes
 * cheaper or shorter, never mandatory.
 */

import type { AbstractDungeon, DungeonConnection } from "./model";

export interface ValidationResult {
  ok: boolean;
  /** Named failures, most load-bearing first. Empty when ok. */
  diagnostics: string[];
  reachableRoomIds: ReadonlySet<string>;
  /** True when a state with the reward claimed can reach the exit. */
  completable: boolean;
}

interface ExploreOptions {
  /** Exclude class-favoured edges (the universal proof). */
  excludeClass: boolean;
  /** Exclude secret edges (the universal proof must not rely on secrets). */
  excludeSecret: boolean;
  /** Requirement ids whose gated edges are forbidden (self-lock probing). */
  forbidRequirements?: ReadonlySet<string>;
}

interface State {
  room: string;
  /** Bitmask of satisfied requirement ids, indexed by requirement order. */
  mask: number;
  rewardClaimed: boolean;
}

function stateKey(s: State): string {
  return `${s.room}|${s.mask}|${s.rewardClaimed ? 1 : 0}`;
}

/** Can this connection be traversed leaving `fromRoom`, given satisfied reqs? */
function traversable(
  conn: DungeonConnection,
  fromRoom: string,
  mask: number,
  reqIndex: ReadonlyMap<string, number>,
  opts: ExploreOptions,
): boolean {
  // Directional gate.
  if (conn.fromRoomId === fromRoom) {
    if (conn.direction === "to-from") return false;
  } else if (conn.toRoomId === fromRoom) {
    if (conn.direction === "from-to") return false;
  } else {
    return false; // connection not incident to this room
  }

  if (conn.classFavoured && opts.excludeClass) return false;

  switch (conn.state) {
    case "open":
    case "guarded": // monsters are soft locks; passable for reachability
    case "breakable": // weak walls have a universal interaction
    case "one-way": // gating is expressed by `direction`, handled above
      return true;
    case "secret":
      return !opts.excludeSecret;
    case "locked":
    case "switched": {
      const reqId = conn.requirementId;
      if (!reqId) throw new Error(`Connection ${conn.id} is ${conn.state} but has no requirementId`);
      if (opts.forbidRequirements?.has(reqId)) return false;
      const bit = reqIndex.get(reqId);
      if (bit === undefined) throw new Error(`Connection ${conn.id} references unknown requirement ${reqId}`);
      return (mask & (1 << bit)) !== 0;
    }
  }
}

/** Requirements satisfied by standing in `room` (keys picked up, switches thrown). */
function acquireMask(dungeon: AbstractDungeon, room: string, reqIndex: ReadonlyMap<string, number>): number {
  let add = 0;
  for (const r of dungeon.requirements) {
    if (r.sourceRoomId === room) add |= 1 << reqIndex.get(r.id)!;
  }
  return add;
}

interface Exploration {
  states: Map<string, State>;
  /** Forward transitions between state keys, for reverse-reachability. */
  edges: Map<string, string[]>;
  reachableRoomIds: Set<string>;
}

function explore(dungeon: AbstractDungeon, opts: ExploreOptions): Exploration {
  const reqIndex = new Map<string, number>();
  dungeon.requirements.forEach((r, i) => reqIndex.set(r.id, i));
  if (dungeon.requirements.length > 30) {
    throw new Error("Requirement count exceeds bitmask width");
  }

  const start: State = {
    room: dungeon.entranceRoomId,
    mask: acquireMask(dungeon, dungeon.entranceRoomId, reqIndex),
    rewardClaimed: dungeon.entranceRoomId === dungeon.rewardRoomId,
  };
  const states = new Map<string, State>([[stateKey(start), start]]);
  const edges = new Map<string, string[]>();
  const reachableRoomIds = new Set<string>([start.room]);
  const queue: State[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = stateKey(cur);
    const outgoing = edges.get(curKey) ?? [];
    edges.set(curKey, outgoing);

    for (const conn of dungeon.connections) {
      if (!traversable(conn, cur.room, cur.mask, reqIndex, opts)) continue;
      const nextRoom = conn.fromRoomId === cur.room ? conn.toRoomId : conn.fromRoomId;
      const next: State = {
        room: nextRoom,
        mask: cur.mask | acquireMask(dungeon, nextRoom, reqIndex),
        rewardClaimed: cur.rewardClaimed || nextRoom === dungeon.rewardRoomId,
      };
      const nextKey = stateKey(next);
      outgoing.push(nextKey);
      reachableRoomIds.add(nextRoom);
      if (!states.has(nextKey)) {
        states.set(nextKey, next);
        queue.push(next);
      }
    }
  }
  return { states, edges, reachableRoomIds };
}

/** State keys from which a completing state (reward claimed, at exit) is reachable. */
function completingStateKeys(dungeon: AbstractDungeon, exploration: Exploration): Set<string> {
  const reverse = new Map<string, string[]>();
  for (const [from, tos] of exploration.edges) {
    for (const to of tos) {
      const list = reverse.get(to) ?? [];
      list.push(from);
      reverse.set(to, list);
    }
  }
  const completing = new Set<string>();
  const queue: string[] = [];
  for (const [k, s] of exploration.states) {
    if (s.rewardClaimed && s.room === dungeon.exitRoomId) {
      completing.add(k);
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const prev of reverse.get(cur) ?? []) {
      if (!completing.has(prev)) {
        completing.add(prev);
        queue.push(prev);
      }
    }
  }
  return completing;
}

/** Run the universal completion proof and collect diagnostics. */
export function validate(dungeon: AbstractDungeon): ValidationResult {
  const opts: ExploreOptions = { excludeClass: true, excludeSecret: true };
  const exploration = explore(dungeon, opts);
  const diagnostics: string[] = [];
  const reachable = exploration.reachableRoomIds;

  // 1. Every room node reachable.
  for (const room of dungeon.rooms) {
    if (!reachable.has(room.id)) diagnostics.push(`unreachable-room:${room.id}`);
  }

  // 2. Landmark rooms reachable.
  if (!reachable.has(dungeon.climaxRoomId)) diagnostics.push("unreachable-climax");
  if (!reachable.has(dungeon.rewardRoomId)) diagnostics.push("unreachable-reward");
  if (!reachable.has(dungeon.exitRoomId)) diagnostics.push("unreachable-exit");

  // 3. Spawn can move (unless the whole dungeon is one room, which is invalid here).
  if (reachable.size <= 1 && dungeon.rooms.length > 1) diagnostics.push("spawn-isolated");

  // 4. A completing state (reward claimed, at exit) exists.
  const completable = [...exploration.states.values()].some(
    (s) => s.rewardClaimed && s.room === dungeon.exitRoomId,
  );
  if (!completable) diagnostics.push("no-completion-path");

  // 5. No reachable state may be a trap: every reachable state must still be able
  //    to reach a completing state. Since the start is itself a reachable state,
  //    this proves the run is completable and simultaneously catches one-way
  //    dead-ends and stranding locks that plain connectivity misses.
  const completing = completingStateKeys(dungeon, exploration);
  for (const [k, s] of exploration.states) {
    if (!completing.has(k)) {
      diagnostics.push(`stranding-state:${s.room}`);
      break; // one is enough to reject; naming the room aids debugging
    }
  }

  // 6. No key or switch locked behind its own gate.
  for (const req of dungeon.requirements) {
    const probe = explore(dungeon, { ...opts, forbidRequirements: new Set([req.id]) });
    if (!probe.reachableRoomIds.has(req.sourceRoomId)) {
      diagnostics.push(`self-locking-requirement:${req.id}`);
    }
  }

  return { ok: diagnostics.length === 0, diagnostics, reachableRoomIds: reachable, completable };
}

/**
 * Lower-level completability check under arbitrary options. Used by the generator
 * to compare the universal proof against a run that may use class shortcuts and
 * secrets (to confirm those add value without being mandatory).
 */
export function isCompletable(dungeon: AbstractDungeon, opts?: Partial<ExploreOptions>): boolean {
  const merged: ExploreOptions = { excludeClass: false, excludeSecret: false, ...opts };
  const exploration = explore(dungeon, merged);
  return [...exploration.states.values()].some(
    (s) => s.rewardClaimed && s.room === dungeon.exitRoomId,
  );
}
