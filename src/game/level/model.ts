/**
 * The Phaser-free data model for non-linear five-room dungeons.
 *
 * This is the abstract layer: graph nodes, connector specifications, keys and
 * switches, and the validated progression contract. It knows nothing about tiles,
 * cameras, or sprites — tile expansion (Milestone 2) consumes an AbstractDungeon
 * and produces geometry. Keeping this layer pure is what lets Milestone 1 be
 * property-tested at thousands of seeds without rendering anything.
 */

import type { TopologyId } from "./topology";

/** The five narrative beats. Labels on graph nodes, not a required spatial order. */
export type Beat = "entrance" | "challenge" | "setback" | "climax" | "reward";

/** Content family from the reference's second d6 roll (see the plan). */
export type ContentFamily =
  | "discovery"
  | "challenge"
  | "hazard"
  | "opportunity"
  | "pressure"
  | "twist";

export type ConnectorKind =
  | "passage"
  | "stairs"
  | "ladder"
  | "rope"
  | "vine"
  | "lift"
  | "slide"
  | "controlled-drop"
  | "bridge"
  | "jump"
  | "portcullis"
  | "weak-wall"
  | "secret-door"
  | "junction"
  | "portal";

export type ConnectorState =
  | "open"
  | "guarded"
  | "locked"
  | "switched"
  | "breakable"
  | "secret"
  | "one-way";

/** `from-to` allows only from->to travel; `to-from` only to->from. */
export type ConnectorDirection = "two-way" | "from-to" | "to-from";

/** Where two rooms sit relative to each other in the macro-grid. */
export type RelativeDirection = "above" | "below" | "beside" | "non-adjacent";

export interface MacroPoint {
  column: 0 | 1 | 2 | 3 | 4;
  row: 0 | 1 | 2 | 3;
}

export interface DungeonRoomNode {
  id: string;
  /** Topology node index 0-4, stable across embedding transforms. */
  node: number;
  position: MacroPoint;
  beat: Beat;
  contentFamily: ContentFamily;
  tags: readonly string[];
  /** True when the cell touches the macro-grid perimeter (entrance/exit eligible). */
  boundary: boolean;
}

/**
 * A gate's means of opening. A `key` is carried after visiting its source room; a
 * `switch` is thrown while present in its source room. Both must be obtainable
 * before the connection they guard, or the dungeon is self-locking.
 */
export interface Requirement {
  id: string;
  kind: "key" | "switch";
  /** Room where the key is found or the switch is thrown. */
  sourceRoomId: string;
}

export interface DungeonConnection {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  /** Filler macro-cells the physical connector routes through (endpoints excluded). */
  routedCells: readonly MacroPoint[];
  kind: ConnectorKind;
  state: ConnectorState;
  direction: ConnectorDirection;
  /** Present when state is `locked` or `switched`. */
  requirementId?: string;
  /**
   * A class-favoured shortcut (vine, difficult climb, etc.). The universal
   * completion proof ignores these; class verbs reduce cost, never gate progress.
   */
  classFavoured: boolean;
}

export interface AbstractDungeon {
  seed: number;
  topologyId: TopologyId;
  /** Which orientation transform was applied to the canonical embedding. */
  orientation: string;
  themeId: string;
  macroWidth: 5;
  macroHeight: 4;
  rooms: readonly DungeonRoomNode[];
  connections: readonly DungeonConnection[];
  requirements: readonly Requirement[];
  entranceRoomId: string;
  /** Optional seeded second opening; never required for completion. */
  secondaryEntranceRoomId?: string;
  climaxRoomId: string;
  rewardRoomId: string;
  exitRoomId: string;
}

export function roomById(dungeon: AbstractDungeon, id: string): DungeonRoomNode {
  const room = dungeon.rooms.find((r) => r.id === id);
  if (!room) throw new Error(`No room with id "${id}"`);
  return room;
}
