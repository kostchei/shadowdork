/**
 * Renderer-free validation of an expanded non-linear dungeon.
 *
 * This is deliberately stricter than a grid-shape check: it ensures every
 * connector has usable endpoint tiles and that a gate's requirement has a real
 * source region. Runtime may open, reveal, or break the blocker, so closed
 * connector tiles count as conditionally traversable for the completion proof.
 */

import type { DungeonDefinition, ExpandedConnector } from "./dungeons";
import { roomAtTolerant } from "./geometry";

export interface PhysicalValidationResult {
  ok: boolean;
  diagnostics: string[];
}

function inBounds(dungeon: DungeonDefinition, x: number, y: number): boolean {
  return x >= 0 && x < dungeon.width && y >= 0 && y < dungeon.height;
}

function tile(dungeon: DungeonDefinition, x: number, y: number): string | undefined {
  return dungeon.grid[y]?.[x];
}

function usable(ch: string | undefined): boolean {
  return ch !== undefined && ch !== "#";
}

function findGlyph(dungeon: DungeonDefinition, glyph: string): { x: number; y: number } | undefined {
  for (let y = 0; y < dungeon.height; y++) {
    const x = dungeon.grid[y]!.indexOf(glyph);
    if (x >= 0) return { x, y };
  }
  return undefined;
}

function directionAllows(connector: ExpandedConnector, roomId: string): boolean {
  if (roomId === connector.fromRoomId) return connector.direction !== "to-from";
  if (roomId === connector.toRoomId) return connector.direction !== "from-to";
  return false;
}

/** State search over physical room endpoints and the actual persisted gate model. */
function validateCompletionSearch(dungeon: DungeonDefinition, diagnostics: string[]): void {
  const spawn = findGlyph(dungeon, "P");
  const reward = findGlyph(dungeon, "K");
  const exit = findGlyph(dungeon, "D");
  if (!spawn || !reward || !exit) return;
  const startRoom = roomAtTolerant(dungeon.regions, spawn.x, spawn.y)?.id;
  const rewardRoom = roomAtTolerant(dungeon.regions, reward.x, reward.y)?.id;
  const exitRoom = roomAtTolerant(dungeon.regions, exit.x, exit.y)?.id;
  if (!startRoom || !rewardRoom || !exitRoom) {
    diagnostics.push("landmark-outside-room");
    return;
  }

  const requirements = [...new Map(
    (dungeon.connectors ?? []).flatMap((c) => c.requirement ? [[c.requirement.id, c.requirement] as const] : []),
  ).values()];
  if (requirements.length > 30) throw new Error("Physical requirement count exceeds bitmask width");
  const reqIndex = new Map(requirements.map((r, i) => [r.id, i]));
  const acquire = (roomId: string): number => requirements.reduce(
    (mask, r, i) => r.sourceRoomId === roomId ? mask | (1 << i) : mask,
    0,
  );
  type SearchState = { roomId: string; mask: number; reward: boolean };
  const start: SearchState = { roomId: startRoom, mask: acquire(startRoom), reward: startRoom === rewardRoom };
  const key = (s: SearchState) => `${s.roomId}|${s.mask}|${s.reward ? 1 : 0}`;
  const queue = [start];
  const seen = new Set([key(start)]);
  const states = new Map<string, SearchState>([[key(start), start]]);
  const edges = new Map<string, string[]>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = key(cur);
    const outgoing = edges.get(curKey) ?? [];
    edges.set(curKey, outgoing);
    for (const connector of dungeon.connectors ?? []) {
      if (!directionAllows(connector, cur.roomId)) continue;
      if (connector.state === "locked" || connector.state === "switched") {
        const reqId = connector.requirement?.id;
        const bit = reqId ? reqIndex.get(reqId) : undefined;
        if (bit === undefined || (cur.mask & (1 << bit)) === 0) continue;
      }
      const nextRoom = connector.fromRoomId === cur.roomId ? connector.toRoomId : connector.fromRoomId;
      const next: SearchState = {
        roomId: nextRoom,
        mask: cur.mask | acquire(nextRoom),
        reward: cur.reward || nextRoom === rewardRoom,
      };
      const nextKey = key(next);
      outgoing.push(nextKey);
      if (!seen.has(nextKey)) {
        seen.add(nextKey);
        states.set(nextKey, next);
        queue.push(next);
      }
    }
  }
  const completing = new Set<string>();
  const reverse = new Map<string, string[]>();
  for (const [from, tos] of edges) for (const to of tos) {
    const incoming = reverse.get(to) ?? [];
    incoming.push(from);
    reverse.set(to, incoming);
  }
  const reverseQueue: string[] = [];
  for (const [stateKey, state] of states) {
    if (state.reward && state.roomId === exitRoom) {
      completing.add(stateKey);
      reverseQueue.push(stateKey);
    }
  }
  while (reverseQueue.length > 0) {
    for (const previous of reverse.get(reverseQueue.shift()!) ?? []) {
      if (!completing.has(previous)) {
        completing.add(previous);
        reverseQueue.push(previous);
      }
    }
  }
  const complete = completing.has(key(start));
  if (!complete) diagnostics.push("no-state-aware-completion-path");
  for (const [stateKey, state] of states) {
    if (!completing.has(stateKey)) {
      diagnostics.push(`physical-stranding-state:${state.roomId}`);
      break;
    }
  }
}

/** Validate geometry and the data required for physical connector interactions. */
export function validatePhysicalDungeon(dungeon: DungeonDefinition): PhysicalValidationResult {
  const diagnostics: string[] = [];
  if (dungeon.grid.length !== dungeon.height || dungeon.grid.some((row) => row.length !== dungeon.width)) {
    diagnostics.push("grid-dimensions-mismatch");
  }

  const count = (glyph: string) => dungeon.grid.reduce((n, row) => n + [...row].filter((ch) => ch === glyph).length, 0);
  for (const glyph of ["P", "K", "D"]) if (count(glyph) !== 1) diagnostics.push(`expected-one-${glyph}`);

  for (const connector of dungeon.connectors ?? []) {
    for (const [name, point] of [["entry", connector.entry], ["landing", connector.landing]] as const) {
      if (!inBounds(dungeon, point.x, point.y) || !usable(tile(dungeon, point.x, point.y))) {
        diagnostics.push(`invalid-${name}:${connector.id}`);
      }
    }
    if (connector.blocker) {
      if (!inBounds(dungeon, connector.blocker.x, connector.blocker.y)) {
        diagnostics.push(`blocker-out-of-bounds:${connector.id}`);
      }
      if ((connector.state === "locked" || connector.state === "switched") && !connector.requirement) {
        diagnostics.push(`missing-requirement:${connector.id}`);
      }
    }
    if (connector.requirement && !dungeon.regions.some((r) => r.id === connector.requirement!.sourceRoomId)) {
      diagnostics.push(`missing-requirement-source:${connector.id}`);
    }
    if (connector.vertical) {
      const segments = connector.waypoints.slice(0, -1).map((point, i) => [point, connector.waypoints[i + 1]!] as const);
      for (const [a, b] of segments) {
        if (a.x !== b.x) continue;
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const shaft = Array.from({ length: maxY - minY + 1 }, (_, i) => tile(dungeon, a.x, minY + i));
        if (!shaft.some((ch) => ch === "|")) {
          diagnostics.push(`missing-universal-climb:${connector.id}`);
          break;
        }
        if (!shaft.every((ch) => ch === "|" || usable(ch))) {
          diagnostics.push(`follower-unsafe-vertical:${connector.id}`);
          break;
        }
      }
    }
  }
  if (dungeon.roomContents) {
    const contentIds = new Set(dungeon.roomContents.map((content) => content.roomId));
    for (const region of dungeon.regions) {
      if (!contentIds.has(region.id)) diagnostics.push(`missing-room-content:${region.id}`);
    }
    for (const content of dungeon.roomContents) {
      if (content.pressures.length === 0) diagnostics.push(`unpressured-room:${content.roomId}`);
    }
    const pressures = new Set(dungeon.roomContents.flatMap((content) => content.pressures));
    for (const required of ["light", "hp", "inventory"] as const) {
      if (!pressures.has(required)) diagnostics.push(`missing-run-pressure:${required}`);
    }
  }
  if (dungeon.talkableNpcs) {
    const npcTiles = dungeon.grid.reduce((count, row) => count + [...row].filter((ch) => ch === "N").length, 0);
    if (npcTiles !== dungeon.talkableNpcs.length) diagnostics.push("talkable-npc-metadata-mismatch");
    for (const npc of dungeon.talkableNpcs) {
      if (tile(dungeon, npc.tile.x, npc.tile.y) !== "N") diagnostics.push(`missing-talkable-npc-tile:${npc.id}`);
    }
  }
  for (const junction of dungeon.junctions ?? []) {
    if (!inBounds(dungeon, junction.tile.x, junction.tile.y) || !usable(tile(dungeon, junction.tile.x, junction.tile.y))) {
      diagnostics.push(`invalid-junction:${junction.id}`);
    }
    if (junction.roomIds.length < 3) diagnostics.push(`undersubscribed-junction:${junction.id}`);
    const touching = (dungeon.connectors ?? []).filter((connector) =>
      connector.waypoints.some((point) => point.x === junction.tile.x && point.y === junction.tile.y),
    );
    if (touching.length < 2) diagnostics.push(`unrouted-junction:${junction.id}`);
    // A blocker on any shared arm walls off its siblings; junction edges must stay open.
    if (touching.some((connector) => connector.blocker)) diagnostics.push(`blocked-junction:${junction.id}`);
  }
  validateCompletionSearch(dungeon, diagnostics);
  return { ok: diagnostics.length === 0, diagnostics };
}
