import { describe, expect, it } from "vitest";
import { CELL_H, CELL_W, expandDungeon } from "../src/game/level/expand";
import { generateAbstractDungeon } from "../src/game/level/generate";
import { roomAt } from "../src/game/level/geometry";
import { validatePhysicalDungeon } from "../src/game/level/physical";
import { ORIENTATIONS } from "../src/game/level/embedding";
import { TOPOLOGIES } from "../src/game/level/topology";

const LEGAL_TILES = new Set([..."." , ..."#%=|+^P234NgsrOcGIKtnfFDb*qvh:"]);
const MONSTER_TILES = new Set(["g", "s", "r", "O"]);

function countTile(grid: readonly string[], ch: string): number {
  return grid.reduce((n, row) => n + [...row].filter((c) => c === ch).length, 0);
}

function firstTile(grid: readonly string[], ch: string): { x: number; y: number } | null {
  for (let y = 0; y < grid.length; y++) {
    const x = grid[y]!.indexOf(ch);
    if (x >= 0) return { x, y };
  }
  return null;
}

/** 4-connected flood over open space (everything but solid rock and weak walls). */
function openConnected(grid: readonly string[], from: { x: number; y: number }): Set<string> {
  const passable = (x: number, y: number): boolean => {
    const ch = grid[y]?.[x];
    return ch !== undefined && ch !== "#" && ch !== "%";
  };
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const stack = [from];
  while (stack.length > 0) {
    const p = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && passable(nx, ny)) {
        seen.add(key);
        stack.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

describe("tile expansion", () => {
  it("produces a rectangular grid of the macro-grid size, legal tiles only", () => {
    const d = expandDungeon(generateAbstractDungeon(0));
    expect(d.width).toBe(5 * CELL_W);
    expect(d.height).toBe(4 * CELL_H);
    expect(d.grid).toHaveLength(d.height);
    for (const row of d.grid) {
      expect(row.length).toBe(d.width);
      for (const ch of row) expect(LEGAL_TILES.has(ch), `tile ${ch}`).toBe(true);
    }
  });

  it("places exactly one spawn, reward, door, campfire, and shrine", () => {
    for (let seed = 0; seed < 60; seed++) {
      const d = expandDungeon(generateAbstractDungeon(seed));
      for (const ch of ["P", "K", "D", "F", "h"]) {
        expect(countTile(d.grid, ch), `tile ${ch} seed ${seed}`).toBe(1);
      }
    }
  });

  it("keeps every monster tile inside a room region (scene invariant)", () => {
    for (let seed = 0; seed < 60; seed++) {
      const d = expandDungeon(generateAbstractDungeon(seed));
      d.grid.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (MONSTER_TILES.has(row[x]!)) {
            expect(roomAt(d.regions, x, y), `monster ${x},${y} seed ${seed}`).toBeDefined();
          }
        }
      });
    }
  });

  it("connects spawn to reward and exit as open space, for every form and orientation", () => {
    for (const form of TOPOLOGIES) {
      for (const orientation of ORIENTATIONS) {
        for (let seed = 0; seed < 20; seed++) {
          const d = expandDungeon(
            generateAbstractDungeon(seed, { topology: form.id, orientation }),
          );
          const spawn = firstTile(d.grid, "P")!;
          const reward = firstTile(d.grid, "K")!;
          const door = firstTile(d.grid, "D")!;
          const reachable = openConnected(d.grid, spawn);
          const tag = `${form.id}/${orientation} seed ${seed}`;
          expect(reachable.has(`${reward.x},${reward.y}`), `reward unreachable ${tag}`).toBe(true);
          expect(reachable.has(`${door.x},${door.y}`), `exit unreachable ${tag}`).toBe(true);
        }
      }
    }
  });

  it("is deterministic in the source dungeon", () => {
    const a = expandDungeon(generateAbstractDungeon(7));
    const b = expandDungeon(generateAbstractDungeon(7));
    expect(a.grid.join("\n")).toBe(b.grid.join("\n"));
    expect(a.roomContents).toEqual(b.roomContents);
    expect(a.talkableNpcs).toEqual(b.talkableNpcs);
  });

  it("selects templates by all six content families and caps deterministic NPCs", () => {
    const families = new Set<string>();
    let runsWithNpc = 0;
    for (let seed = 0; seed < 100; seed++) {
      const expanded = expandDungeon(generateAbstractDungeon(seed));
      for (const content of expanded.roomContents ?? []) families.add(content.family);
      expect(expanded.roomContents).toHaveLength(5);
      expect(expanded.roomContents?.every((content) => content.pressures.length > 0)).toBe(true);
      const pressures = new Set(expanded.roomContents?.flatMap((content) => content.pressures));
      expect(pressures.has("light")).toBe(true);
      expect(pressures.has("hp")).toBe(true);
      expect(pressures.has("inventory")).toBe(true);
      expect(expanded.talkableNpcs?.length ?? 0).toBeLessThanOrEqual(1);
      if ((expanded.talkableNpcs?.length ?? 0) > 0) runsWithNpc++;
    }
    expect([...families].sort()).toEqual([
      "challenge", "discovery", "hazard", "opportunity", "pressure", "twist",
    ]);
    expect(runsWithNpc).toBeGreaterThanOrEqual(35);
    expect(runsWithNpc).toBeLessThanOrEqual(65);
  });

  it("generates every authored NPC outcome with valid targets", () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const expanded = expandDungeon(generateAbstractDungeon(seed));
      for (const npc of expanded.talkableNpcs ?? []) {
        outcomes.add(npc.outcome);
        if (npc.outcome === "reveal-route" || npc.outcome === "revelation") {
          expect(expanded.connectors?.some((connector) => connector.id === npc.targetConnectorId)).toBe(true);
        }
        if (npc.outcome === "companion-eligible") {
          expect(["thief", "priest", "wizard"]).toContain(npc.companionClass);
        }
      }
    }
    expect(outcomes).toEqual(new Set([
      "give-torch", "reveal-route", "warning", "trade", "betrayal", "revelation", "companion-eligible",
    ]));
  });

  it("retains semantic connector metadata and validates every physical form", () => {
    for (const form of TOPOLOGIES) {
      for (const orientation of ORIENTATIONS) {
        for (let seed = 0; seed < 20; seed++) {
          const abstract = generateAbstractDungeon(seed, { topology: form.id, orientation });
          const expanded = expandDungeon(abstract);
          expect(expanded.connectors).toHaveLength(abstract.connections.length);
          expect(validatePhysicalDungeon(expanded).ok, `${form.id}/${orientation}/${seed}`).toBe(true);
          for (const connector of expanded.connectors ?? []) {
            expect(connector.entry.x).toBeGreaterThanOrEqual(0);
            expect(connector.landing.y).toBeLessThan(expanded.height);
            if (connector.state === "locked" || connector.state === "switched") {
              expect(connector.requirement).toBeDefined();
              expect(connector.blocker).toBeDefined();
            }
          }
        }
      }
    }
  });

  it("retains the shared four-room junction in the staged kite topology", () => {
    const expanded = expandDungeon(
      generateAbstractDungeon(17, { topology: "kite", orientation: "identity" }),
    );
    expect(expanded.junctions).toHaveLength(1);
    const junction = expanded.junctions![0]!;
    expect(junction.roomIds).toHaveLength(4);
    const routedThroughJunction = expanded.connectors!.filter((connector) =>
      connector.waypoints.some((point) => point.x === junction.tile.x && point.y === junction.tile.y),
    );
    expect(routedThroughJunction.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a physical layout whose connector directions block reward/exit", () => {
    const expanded = expandDungeon(
      generateAbstractDungeon(11, { topology: "railroad", orientation: "identity" }),
    );
    const connectors = (expanded.connectors ?? []).map((connector) => ({
      ...connector,
      // Every edge points toward its `from` endpoint, so at least one edge on
      // the railroad must oppose the entrance-to-exit completion route.
      state: "one-way" as const,
      direction: "to-from" as const,
      kind: "controlled-drop" as const,
    }));
    const result = validatePhysicalDungeon({ ...expanded, connectors });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("no-state-aware-completion-path");
  });
});
