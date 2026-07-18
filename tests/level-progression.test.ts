import { describe, expect, it } from "vitest";
import type {
  AbstractDungeon,
  Beat,
  DungeonConnection,
  DungeonRoomNode,
  Requirement,
} from "../src/game/level/model";
import { isCompletable, validate } from "../src/game/level/progression";

function room(node: number, beat: Beat = "challenge"): DungeonRoomNode {
  return {
    id: `room-${node}`,
    node,
    position: { column: 0, row: 0 },
    beat,
    contentFamily: "challenge",
    tags: [],
    boundary: true,
  };
}

function conn(a: number, b: number, over: Partial<DungeonConnection> = {}): DungeonConnection {
  return {
    id: `conn-${a}-${b}`,
    fromRoomId: `room-${a}`,
    toRoomId: `room-${b}`,
    routedCells: [],
    kind: "passage",
    state: "open",
    direction: "two-way",
    classFavoured: false,
    ...over,
  };
}

function dungeon(over: Partial<AbstractDungeon>): AbstractDungeon {
  return {
    seed: 0,
    topologyId: "railroad",
    orientation: "identity",
    themeId: "gloom-below",
    macroWidth: 5,
    macroHeight: 4,
    rooms: [],
    connections: [],
    requirements: [],
    entranceRoomId: "room-0",
    climaxRoomId: "room-1",
    rewardRoomId: "room-2",
    exitRoomId: "room-2",
    ...over,
  };
}

describe("abstract progression validation", () => {
  it("accepts an all-open five-room path", () => {
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "climax"), room(3, "reward"), room(4)],
      connections: [conn(0, 1), conn(1, 2), conn(2, 3), conn(3, 4)],
      climaxRoomId: "room-2",
      rewardRoomId: "room-3",
      exitRoomId: "room-4",
    });
    const result = validate(d);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.completable).toBe(true);
  });

  it("rejects a key locked behind its own gate", () => {
    const req: Requirement = { id: "req-0-1", kind: "key", sourceRoomId: "room-1" };
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "reward")],
      connections: [conn(0, 1, { state: "locked", requirementId: "req-0-1", kind: "portcullis" }), conn(1, 2)],
      requirements: [req],
      climaxRoomId: "room-1",
      rewardRoomId: "room-2",
      exitRoomId: "room-2",
    });
    const result = validate(d);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("self-locking-requirement:req-0-1");
  });

  it("accepts a gate whose key sits on the entrance side", () => {
    const req: Requirement = { id: "req-1-2", kind: "key", sourceRoomId: "room-0" };
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "reward")],
      connections: [conn(0, 1), conn(1, 2, { state: "locked", requirementId: "req-1-2", kind: "portcullis" })],
      requirements: [req],
      climaxRoomId: "room-1",
      rewardRoomId: "room-2",
      exitRoomId: "room-2",
    });
    expect(validate(d).ok).toBe(true);
  });

  it("rejects a one-way slide that strands the party", () => {
    // From room-1 you may slide into the dead-end room-2 and never return; the
    // reward/exit is room-1, so the slide is a trap.
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1, "reward"), room(2)],
      connections: [conn(0, 1), conn(1, 2, { state: "one-way", direction: "from-to", kind: "slide" })],
      climaxRoomId: "room-1",
      rewardRoomId: "room-1",
      exitRoomId: "room-1",
    });
    const result = validate(d);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("stranding-state:room-2");
  });

  it("never relies on a secret for the universal proof", () => {
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "reward")],
      connections: [conn(0, 1), conn(1, 2, { state: "secret", kind: "secret-door" })],
      climaxRoomId: "room-1",
      rewardRoomId: "room-2",
      exitRoomId: "room-2",
    });
    expect(validate(d).ok).toBe(false); // secret excluded from universal proof
    expect(isCompletable(d)).toBe(true); // but completable if the secret is found
  });

  it("never relies on a class shortcut for the universal proof", () => {
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "reward")],
      connections: [conn(0, 1), conn(1, 2, { classFavoured: true, kind: "vine" })],
      climaxRoomId: "room-1",
      rewardRoomId: "room-2",
      exitRoomId: "room-2",
    });
    expect(validate(d).ok).toBe(false);
    expect(isCompletable(d)).toBe(true);
  });

  it("accepts an optional class shortcut alongside a universal route", () => {
    // A cycle: the long way (0-1-2-3) is universal; 0-3 is a class-only vine.
    const d = dungeon({
      rooms: [room(0, "entrance"), room(1), room(2, "climax"), room(3, "reward")],
      connections: [
        conn(0, 1),
        conn(1, 2),
        conn(2, 3),
        conn(0, 3, { classFavoured: true, kind: "vine" }),
      ],
      climaxRoomId: "room-2",
      rewardRoomId: "room-3",
      exitRoomId: "room-3",
    });
    expect(validate(d).ok).toBe(true);
    expect(isCompletable(d)).toBe(true);
  });
});
