import { describe, expect, it } from "vitest";
import {
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
  return resolveNpcInteraction({ spec: spec(outcome, extra), state, leaderName: "Ada", inventory });
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

  it.each<TalkableNpcOutcome>(["give-torch", "warning", "trade", "betrayal", "companion-eligible", "reveal-route", "revelation"])(
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

  it("spawns the ambush for betrayal", () => {
    const actions = run("betrayal", "heard");
    expect(actions).toContainEqual({ type: "spawn-betrayal" });
  });
});
