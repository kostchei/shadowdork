import { describe, expect, it } from "vitest";
import type { ExpandedConnector } from "../src/game/level/dungeons";
import {
  canTraverseConnector,
  connectorIsOpen,
  openConnector,
  roomsAlertedByNoise,
} from "../src/game/level/connectors";

function connector(over: Partial<ExpandedConnector> = {}): ExpandedConnector {
  return {
    id: "a-b",
    fromRoomId: "a",
    toRoomId: "b",
    kind: "passage",
    state: "open",
    direction: "two-way",
    entry: { x: 1, y: 1 },
    landing: { x: 2, y: 1 },
    waypoints: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    vertical: false,
    ...over,
  };
}

const emptyState = () => ({
  activatedRequirementIds: new Set<string>(),
  openedConnectorIds: new Set<string>(),
});

describe("connector runtime state", () => {
  it.each([
    ["slide", "from-to", true, false],
    ["controlled-drop", "to-from", false, true],
    ["passage", "from-to", true, false],
  ] as const)("enforces %s %s travel", (kind, direction, fromTo, toFrom) => {
    const c = connector({ kind, state: "one-way", direction });
    const state = emptyState();
    expect(canTraverseConnector(c, "a", state)).toBe(fromTo);
    expect(canTraverseConnector(c, "b", state)).toBe(toFrom);
  });

  it.each([
    ["portcullis", "locked"],
    ["portcullis", "switched"],
    ["secret-door", "secret"],
    ["weak-wall", "breakable"],
  ] as const)("opens and persists %s/%s through the shared state", (kind, initialState) => {
    const requirement = initialState === "locked" || initialState === "switched"
      ? { id: "unlock", kind: initialState === "locked" ? "key" as const : "switch" as const, sourceRoomId: "a" }
      : undefined;
    const c = connector({ kind, state: initialState, requirement, blocker: { x: 2, y: 1 } });
    const opened = new Set<string>();
    const activated = new Set<string>();
    if (requirement) {
      expect(openConnector(c, activated, opened)).toBe(initialState === "locked" ? "requires-key" : "requires-switch");
      activated.add(requirement.id);
    }
    expect(openConnector(c, activated, opened)).toBe("opened");

    // This is exactly how DungeonScene rehydrates the arrays from SaveSlot.
    const resumed = {
      activatedRequirementIds: new Set([...activated]),
      openedConnectorIds: new Set([...opened]),
    };
    expect(connectorIsOpen(c, resumed)).toBe(true);
    expect(canTraverseConnector(c, "a", resumed)).toBe(true);
  });

  it("propagates noise one hop across open connectors only", () => {
    const open = connector();
    const closed = connector({ id: "b-c", fromRoomId: "b", toRoomId: "c", state: "secret", kind: "secret-door" });
    const state = emptyState();
    expect([...roomsAlertedByNoise("a", [open, closed], state)].sort()).toEqual(["a", "b"]);

    state.openedConnectorIds.add("b-c");
    expect([...roomsAlertedByNoise("a", [open, closed], state, 2)].sort()).toEqual(["a", "b", "c"]);
  });

  it("does not let directional travel bypass a closed connector", () => {
    const c = connector({
      kind: "portcullis",
      state: "locked",
      direction: "from-to",
      requirement: { id: "key", kind: "key", sourceRoomId: "a" },
      blocker: { x: 2, y: 1 },
    });
    const state = emptyState();
    state.activatedRequirementIds.add("key");
    expect(canTraverseConnector(c, "a", state)).toBe(false);
    openConnector(c, state.activatedRequirementIds, state.openedConnectorIds);
    expect(canTraverseConnector(c, "a", state)).toBe(true);
    expect(canTraverseConnector(c, "b", state)).toBe(false);
  });
});
