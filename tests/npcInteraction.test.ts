import { describe, expect, it } from "vitest";
import {
  betrayalCharismaDc,
  persistedBetrayalFoe,
  resolveNpcInteraction,
  type LeaderInventorySnapshot,
  type NpcAction,
  type NpcInteractionState,
} from "../src/game/level/npcInteraction";
import type { TalkableNpcOutcome, TalkableNpcSpec } from "../src/game/level/dungeons";

const FULL_INVENTORY: LeaderInventorySnapshot = { hasRation: true, canAddTorch: true, gemFitsAfterTrade: true };

function spec(outcome: TalkableNpcOutcome, extra: Partial<TalkableNpcSpec> = {}): TalkableNpcSpec {
  return {
    id: "npc-1",
    roomId: "room-1",
    tile: { x: 3, y: 3 },
    name: "Wren",
    role: "scout",
    alignment: "neutral",
    introduction: "intro",
    resolution: "resolution",
    outcome,
    ...extra,
  };
}

function run(
  outcome: TalkableNpcOutcome,
  state: NpcInteractionState,
  inventory: LeaderInventorySnapshot = FULL_INVENTORY,
  extra: Partial<TalkableNpcSpec> = {},
): NpcAction[] {
  return resolveNpcInteraction({
    spec: spec(outcome, extra),
    state,
    leaderName: "Ada",
    inventory,
    betrayalCheck: outcome === "betrayal" && state === "heard"
      ? { success: false, natural: 4, total: 5, dc: 11 }
      : undefined,
    leaderLevel: 2,
  });
}

function types(actions: NpcAction[]): string[] {
  return actions.map((a) => a.type);
}

/** The state a scene would end in after applying the returned actions. */
function nextState(actions: NpcAction[], prior: NpcInteractionState): NpcInteractionState {
  let s = prior;
  for (const a of actions) if (a.type === "set-state") s = a.state;
  return s;
}

describe("resolveNpcInteraction — conversation state machine", () => {
  it("greets an unmet NPC, advances to heard, and persists", () => {
    const actions = run("warning", "unmet");
    expect(types(actions)).toEqual(["set-state", "say", "persist"]);
    expect(nextState(actions, "unmet")).toBe("heard");
    expect(actions.some((a) => a.type === "say" && a.text.includes("intro"))).toBe(true);
  });

  it("only re-states the resolution once resolved, without persisting again", () => {
    const actions = run("trade", "resolved");
    expect(types(actions)).toEqual(["say"]);
    expect(actions.some((a) => a.type === "persist")).toBe(false);
  });

  it.each<TalkableNpcOutcome>(["give-torch", "warning", "trade", "companion-eligible", "reveal-route", "revelation"])(
    "drives %s from heard to resolved and persists",
    (outcome) => {
      const actions = run(outcome, "heard", FULL_INVENTORY, { targetConnectorId: "conn-0-1" });
      expect(nextState(actions, "heard")).toBe("resolved");
      expect(actions.some((a) => a.type === "mark-resolved")).toBe(true);
      expect(actions.some((a) => a.type === "persist")).toBe(true);
    },
  );
});

describe("resolveNpcInteraction — outcome effects", () => {
  it("grants a torch when there is room", () => {
    const actions = run("give-torch", "heard");
    expect(actions).toContainEqual({ type: "grant-item", itemId: "torch" });
  });

  it("does not grant, resolve, or persist a torch with no room", () => {
    const actions = run("give-torch", "heard", { ...FULL_INVENTORY, canAddTorch: false });
    expect(types(actions)).toEqual(["say"]);
    expect(nextState(actions, "heard")).toBe("heard");
  });

  it("trades a ration for a gem in order", () => {
    const actions = run("trade", "heard");
    const effectTypes = types(actions);
    expect(effectTypes.indexOf("consume-item")).toBeLessThan(effectTypes.indexOf("grant-item"));
    expect(actions).toContainEqual({ type: "consume-item", itemId: "ration", count: 1 });
    expect(actions).toContainEqual({ type: "grant-item", itemId: "gem" });
  });

  it("blocks the trade with no ration and stays heard", () => {
    const actions = run("trade", "heard", { ...FULL_INVENTORY, hasRation: false });
    expect(types(actions)).toEqual(["say"]);
    expect(nextState(actions, "heard")).toBe("heard");
  });

  it("blocks the trade when the gem will not fit even after the ration is spent", () => {
    const actions = run("trade", "heard", { ...FULL_INVENTORY, gemFitsAfterTrade: false });
    expect(types(actions)).toEqual(["say"]);
    expect(nextState(actions, "heard")).toBe("heard");
  });

  it("requests the target connector for reveal-route without operating a requirement", () => {
    const actions = run("reveal-route", "heard", FULL_INVENTORY, { targetConnectorId: "conn-2-3" });
    expect(actions).toContainEqual(
      expect.objectContaining({ type: "open-connector", connectorId: "conn-2-3", operateRequirement: false }),
    );
  });

  it("operates the requirement for revelation", () => {
    const actions = run("revelation", "heard", FULL_INVENTORY, { targetConnectorId: "conn-2-3" });
    expect(actions).toContainEqual(
      expect.objectContaining({ type: "open-connector", connectorId: "conn-2-3", operateRequirement: true }),
    );
  });

  it("spawns and persists the ambush when the Charisma check fails", () => {
    const actions = run("betrayal", "heard");
    expect(actions).toContainEqual({ type: "spawn-betrayal", foe: "allies" });
    expect(nextState(actions, "heard")).toBe("hostile-allies");
  });

  it("defuses betrayal and does not spawn an ambush when the Charisma check succeeds", () => {
    const actions = resolveNpcInteraction({
      spec: spec("betrayal", { alignment: "law" }),
      state: "heard",
      leaderName: "Ada",
      inventory: FULL_INVENTORY,
      betrayalCheck: { success: true, natural: 12, total: 14, dc: 9 },
      leaderLevel: 3,
    });
    expect(types(actions)).not.toContain("spawn-betrayal");
    expect(nextState(actions, "heard")).toBe("resolved");
  });

  it("makes the betraying NPC fight personally against a level 3+ leader", () => {
    const actions = resolveNpcInteraction({
      spec: spec("betrayal"),
      state: "heard",
      leaderName: "Ada",
      inventory: FULL_INVENTORY,
      betrayalCheck: { success: false, natural: 3, total: 4, dc: 11 },
      leaderLevel: 3,
    });
    expect(actions).toContainEqual({ type: "spawn-betrayal", foe: "npc" });
    expect(nextState(actions, "heard")).toBe("hostile-npc");
  });
});

describe("betrayalCharismaDc", () => {
  it.each(["law", "neutral", "chaos"] as const)("uses DC 9 for matching %s alignments", (alignment) => {
    expect(betrayalCharismaDc(alignment, alignment)).toBe(9);
  });

  it("uses DC 11 when alignments differ without being opposed", () => {
    expect(betrayalCharismaDc("neutral", "law")).toBe(11);
    expect(betrayalCharismaDc("chaos", "neutral")).toBe(11);
  });

  it("uses DC 13 for Law versus Chaos in either direction", () => {
    expect(betrayalCharismaDc("law", "chaos")).toBe(13);
    expect(betrayalCharismaDc("chaos", "law")).toBe(13);
  });
});

describe("persistedBetrayalFoe — reload reconstitution", () => {
  it("re-spawns the foe only after a failed check makes the betrayer hostile", () => {
    expect(persistedBetrayalFoe("betrayal", "hostile-npc")).toBe("npc");
    expect(persistedBetrayalFoe("betrayal", "hostile-allies")).toBe("allies");
    expect(persistedBetrayalFoe("betrayal", "resolved")).toBeNull();
    expect(persistedBetrayalFoe("betrayal", "heard")).toBeNull();
    expect(persistedBetrayalFoe("betrayal", "unmet")).toBeNull();
  });

  it("never re-spawns a foe for non-betrayal outcomes", () => {
    for (const outcome of ["give-torch", "warning", "trade", "reveal-route", "revelation", "companion-eligible"] as const) {
      expect(persistedBetrayalFoe(outcome, "hostile-npc")).toBeNull();
    }
  });
});
