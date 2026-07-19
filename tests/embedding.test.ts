import { describe, expect, it } from "vitest";
import {
  MACRO_COLUMNS,
  MACRO_ROWS,
  MAX_ROUTE_FILLERS,
  ORIENTATIONS,
  embed,
  occupiedCells,
} from "../src/game/level/embedding";
import { TOPOLOGIES } from "../src/game/level/topology";

const cases = TOPOLOGIES.flatMap((form) => ORIENTATIONS.map((o) => ({ form, orientation: o })));

describe("macro-grid embedding", () => {
  it.each(cases)("embeds $form.id in $orientation", ({ form, orientation }) => {
    const embedding = embed(form, orientation);

    // Five distinct in-bounds room cells.
    const roomKeys = new Set<string>();
    for (const cell of embedding.cells.values()) {
      expect(cell.column).toBeGreaterThanOrEqual(0);
      expect(cell.column).toBeLessThan(MACRO_COLUMNS);
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(MACRO_ROWS);
      roomKeys.add(`${cell.column},${cell.row}`);
    }
    expect(roomKeys.size).toBe(5);

    // Every graph edge is embedded, routed within the filler budget.
    expect(embedding.edges).toHaveLength(form.edges.length);
    for (const e of embedding.edges) {
      expect(e.routedCells.length).toBeLessThanOrEqual(MAX_ROUTE_FILLERS);
    }

    // No crossings: rooms and all routed filler cells occupy distinct cells.
    const { rooms, fillers } = occupiedCells(embedding);
    const occupied = [...rooms, ...fillers].map((c) => `${c.column},${c.row}`);
    expect(new Set(occupied).size).toBe(occupied.length);

    const routedCounts = new Map<string, number>();
    for (const edge of embedding.edges) for (const cell of edge.routedCells) {
      const key = `${cell.column},${cell.row}`;
      routedCounts.set(key, (routedCounts.get(key) ?? 0) + 1);
    }
    const junctionKeys = new Set(embedding.junctionCells.map((cell) => `${cell.column},${cell.row}`));
    for (const [key, count] of routedCounts) {
      if (count > 1) expect(junctionKeys.has(key), `undeclared shared filler ${key}`).toBe(true);
    }

    // At least two boundary rooms so entrance and exit can differ.
    expect(embedding.boundaryNodes.size).toBeGreaterThanOrEqual(2);
  });

  it("mirrors columns under flip-x", () => {
    const id = embed(TOPOLOGIES[0]!, "identity");
    const fx = embed(TOPOLOGIES[0]!, "flip-x");
    for (const node of id.cells.keys()) {
      const a = id.cells.get(node)!;
      const b = fx.cells.get(node)!;
      expect(b.column).toBe(MACRO_COLUMNS - 1 - a.column);
      expect(b.row).toBe(a.row);
    }
  });
});
