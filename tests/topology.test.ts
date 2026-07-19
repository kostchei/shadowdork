import { describe, expect, it } from "vitest";
import {
  NODE_COUNT,
  TOPOLOGIES,
  adjacency,
  degrees,
  isConnected,
  topologyById,
} from "../src/game/level/topology";

describe("topology catalogue", () => {
  it("ships all Tier 1 and Tier 2 forms", () => {
    const ids = TOPOLOGIES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(
      new Set([
        "railroad", "arrow", "cross", "fauchard-fork", "moose", "v",
        "five-circle", "lollipop", "foglio-snail", "paw", "banner", "bull",
        "stingray", "house", "hourglass",
        "kite",
      ]),
    );
    expect(TOPOLOGIES.filter((t) => t.tier === 1)).toHaveLength(6);
    expect(TOPOLOGIES.filter((t) => t.tier === 2)).toHaveLength(9);
    expect(TOPOLOGIES.filter((t) => t.tier === 3)).toHaveLength(1);
  });

  it.each(TOPOLOGIES)("$id is a connected simple graph on five nodes", (form) => {
    expect(isConnected(form)).toBe(true);
    // No self-loops, no parallel edges.
    const seen = new Set<string>();
    for (const [a, b] of form.edges) {
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(NODE_COUNT);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // Every node participates in at least one edge.
    expect(degrees(form).every((d) => d >= 1)).toBe(true);
  });

  it("keeps railroad a minority via selection weight", () => {
    const total = TOPOLOGIES.reduce((sum, t) => sum + t.weight, 0);
    const railroad = topologyById("railroad").weight;
    expect(railroad / total).toBeLessThan(0.2);
  });

  it("exposes the expected degree signatures", () => {
    expect(degrees(topologyById("railroad"))).toEqual([1, 2, 2, 2, 1]);
    expect(degrees(topologyById("cross")).filter((d) => d === 4)).toHaveLength(1); // one hub
    // Fauchard Fork is the only Tier 1 form with a cycle: 5 edges over 5 nodes.
    expect(topologyById("fauchard-fork").edges).toHaveLength(5);
    expect(adjacency(topologyById("fauchard-fork"))[4]).toHaveLength(2);
  });
});
