import { describe, expect, it } from "vitest";
import { generateAbstractDungeon } from "../src/game/level/generate";
import { validate } from "../src/game/level/progression";
import { ORIENTATIONS } from "../src/game/level/embedding";
import { TOPOLOGIES, type TopologyId } from "../src/game/level/topology";

const DIST_SAMPLE = 2000;

function sample(count: number) {
  return Array.from({ length: count }, (_, seed) => generateAbstractDungeon(seed));
}

describe("per-topology validity", () => {
  // Acceptance criterion: at least 1,000 seeds per released topology, across all
  // supported rotations/reflections. 4 orientations x 260 seeds = 1,040 per form.
  const PER_ORIENTATION = 260;

  it.each(TOPOLOGIES)("validates $id across every orientation and 1000+ seeds", (form) => {
    let total = 0;
    for (const orientation of ORIENTATIONS) {
      for (let seed = 0; seed < PER_ORIENTATION; seed++) {
        const d = generateAbstractDungeon(seed, { topology: form.id, orientation });
        expect(d.topologyId).toBe(form.id);
        expect(d.orientation).toBe(orientation);
        expect(validate(d).ok, `${form.id}/${orientation} seed ${seed}`).toBe(true);
        // Beat invariants hold for every accepted layout.
        expect(d.rooms).toHaveLength(5);
        expect(d.rooms.filter((r) => r.beat === "climax")).toHaveLength(1);
        expect(d.rooms.filter((r) => r.beat === "reward")).toHaveLength(1);
        expect(d.rooms.filter((r) => r.beat === "entrance")).toHaveLength(1);
        total++;
      }
    }
    expect(total).toBeGreaterThanOrEqual(1000);
  });
});

describe("abstract dungeon generation", () => {
  it("produces a validated dungeon for every seed via the default weighted roll", () => {
    for (let seed = 0; seed < DIST_SAMPLE; seed++) {
      const d = generateAbstractDungeon(seed);
      expect(validate(d).ok, `seed ${seed} (${d.topologyId}/${d.orientation})`).toBe(true);
    }
  });

  it("is deterministic in the seed, with and without overrides", () => {
    for (const seed of [0, 1, 7, 42, 199, 1999]) {
      expect(JSON.stringify(generateAbstractDungeon(seed))).toBe(
        JSON.stringify(generateAbstractDungeon(seed)),
      );
      const opts = { topology: "cross" as TopologyId, orientation: "flip-y" as const };
      expect(JSON.stringify(generateAbstractDungeon(seed, opts))).toBe(
        JSON.stringify(generateAbstractDungeon(seed, opts)),
      );
    }
  });

  it("exercises every Tier 1 topology and keeps railroad a minority", () => {
    const counts = new Map<TopologyId, number>();
    for (const d of sample(DIST_SAMPLE)) {
      counts.set(d.topologyId, (counts.get(d.topologyId) ?? 0) + 1);
    }
    for (const form of TOPOLOGIES) {
      expect(counts.get(form.id) ?? 0, `${form.id} never appeared`).toBeGreaterThan(0);
    }
    expect((counts.get("railroad") ?? 0) / DIST_SAMPLE).toBeLessThan(0.2);
  });

  it("varies entrance placement across seeds", () => {
    const cells = new Set(
      sample(DIST_SAMPLE).map((d) => {
        const e = d.rooms.find((r) => r.id === d.entranceRoomId)!;
        return `${e.position.column},${e.position.row}`;
      }),
    );
    expect(cells.size).toBeGreaterThan(3);
  });

  it("keeps starting point, order, and contents varying within one footprint", () => {
    // Hold space fixed (same topology + orientation, forced) and confirm start,
    // beat order, and contents each still diverge across seeds.
    const bucket = Array.from({ length: 400 }, (_, seed) =>
      generateAbstractDungeon(seed, { topology: "arrow", orientation: "identity" }),
    );
    const starts = new Set(bucket.map((d) => d.entranceRoomId));
    const orders = new Set(
      bucket.map((d) => d.rooms.map((r) => `${r.node}:${r.beat}`).sort().join("|")),
    );
    const contents = new Set(
      bucket.map((d) => d.rooms.map((r) => `${r.node}:${r.tags.join("+")}`).sort().join("|")),
    );
    expect(starts.size).toBeGreaterThan(1);
    expect(orders.size).toBeGreaterThan(1);
    expect(contents.size).toBeGreaterThan(1);
  });

  it("routes every connection through at most two filler cells", () => {
    for (const d of sample(500)) {
      for (const c of d.connections) {
        expect(c.routedCells.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("rejects non-integer seeds", () => {
    expect(() => generateAbstractDungeon(1.5)).toThrow(/integer/);
  });
});
