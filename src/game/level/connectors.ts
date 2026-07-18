import type { ExpandedConnector } from "./dungeons";

/** The connector facts that survive save/resume. Initial geometry stays in the level. */
export interface PersistedConnectorState {
  activatedRequirementIds: ReadonlySet<string>;
  openedConnectorIds: ReadonlySet<string>;
}

export function connectorIsOpen(
  connector: ExpandedConnector,
  state: PersistedConnectorState,
): boolean {
  switch (connector.state) {
    case "open":
    case "guarded":
    case "one-way":
      return true;
    case "locked":
    case "switched":
    case "secret":
    case "breakable":
      return state.openedConnectorIds.has(connector.id);
  }
}

/** Whether an actor may leave fromRoom through this connector right now. */
export function canTraverseConnector(
  connector: ExpandedConnector,
  fromRoom: string,
  state: PersistedConnectorState,
): boolean {
  if (!connectorIsOpen(connector, state)) return false;
  if (fromRoom === connector.fromRoomId) return connector.direction !== "to-from";
  if (fromRoom === connector.toRoomId) return connector.direction !== "from-to";
  return false;
}

export function otherConnectorRoom(
  connector: ExpandedConnector,
  roomId: string,
): string | undefined {
  if (connector.fromRoomId === roomId) return connector.toRoomId;
  if (connector.toRoomId === roomId) return connector.fromRoomId;
  return undefined;
}

export type ConnectorOpenResult = "opened" | "already-open" | "requires-key" | "requires-switch";

/** Shared state transition for gates, secret doors, and weak walls. */
export function openConnector(
  connector: ExpandedConnector,
  activatedRequirementIds: ReadonlySet<string>,
  openedConnectorIds: Set<string>,
): ConnectorOpenResult {
  if (connectorIsOpen(connector, { activatedRequirementIds, openedConnectorIds })) {
    return "already-open";
  }
  const requirement = connector.requirement;
  if (requirement && !activatedRequirementIds.has(requirement.id)) {
    return requirement.kind === "key" ? "requires-key" : "requires-switch";
  }
  openedConnectorIds.add(connector.id);
  return "opened";
}

/**
 * Noise ignores travel direction, but only crosses physically open connectors.
 * The default one-hop budget keeps alert propagation local.
 */
export function roomsAlertedByNoise(
  originRoomId: string,
  connectors: readonly ExpandedConnector[],
  state: PersistedConnectorState,
  maxHops = 1,
): ReadonlySet<string> {
  const alerted = new Set<string>([originRoomId]);
  let frontier = [originRoomId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const roomId of frontier) {
      for (const connector of connectors) {
        if (!connectorIsOpen(connector, state)) continue;
        const other = otherConnectorRoom(connector, roomId);
        if (other && !alerted.has(other)) {
          alerted.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return alerted;
}
