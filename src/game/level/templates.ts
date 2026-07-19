/** Deterministic, content-family keyed room templates for expanded dungeons. */

import type { ConnectorKind, ContentFamily, DungeonRoomNode } from "./model";

export interface RoomStamp {
  width: number;
  monsterGlyph: string;
  put(localX: number, ch: string): void;
  canStand(localX: number): boolean;
}

export type RoomPressure = "light" | "hp" | "inventory" | "time" | "position";

export interface RoomTemplate {
  id: string;
  family: ContentFamily;
  pressures: readonly RoomPressure[];
  minDegree: number;
  maxDegree: number;
  connectorKinds?: readonly ConnectorKind[];
  npc?: true;
  stamp(s: RoomStamp, place: (preferredX: number, ch: string) => number | undefined): void;
}

export interface RoomStampResult {
  templateId: string;
  pressures: readonly RoomPressure[];
  npcLocalX?: number;
}

const templates: readonly RoomTemplate[] = [
  { id: "discovery-brazier", family: "discovery", pressures: ["light"], minDegree: 1, maxDegree: 4,
    stamp: (_s, place) => { place(8, "b"); place(12, "t"); } },
  { id: "discovery-witness", family: "discovery", pressures: ["light", "time"], minDegree: 1, maxDegree: 4, npc: true,
    stamp: (_s, place) => { place(9, "N"); place(13, "c"); } },
  { id: "challenge-guard", family: "challenge", pressures: ["hp"], minDegree: 1, maxDegree: 4,
    stamp: (s, place) => { place(8, s.monsterGlyph); place(13, "c"); } },
  { id: "challenge-pair", family: "challenge", pressures: ["hp", "position"], minDegree: 1, maxDegree: 3,
    stamp: (s, place) => { place(7, s.monsterGlyph); place(12, s.monsterGlyph); place(15, "t"); } },
  { id: "hazard-spikes", family: "hazard", pressures: ["hp", "position"], minDegree: 1, maxDegree: 4,
    stamp: (_s, place) => { place(8, "^"); place(12, "^"); place(15, "n"); } },
  { id: "hazard-rubble", family: "hazard", pressures: ["time", "position"], minDegree: 1, maxDegree: 4,
    stamp: (_s, place) => { place(10, "%"); place(14, "t"); } },
  { id: "opportunity-cache", family: "opportunity", pressures: ["inventory"], minDegree: 1, maxDegree: 4,
    stamp: (_s, place) => { place(8, "c"); place(12, "G"); } },
  { id: "opportunity-shrine", family: "opportunity", pressures: ["inventory"], minDegree: 1, maxDegree: 3,
    stamp: (_s, place) => { place(9, "b"); place(13, "n"); } },
  { id: "pressure-arena", family: "pressure", pressures: ["hp", "light"], minDegree: 1, maxDegree: 4,
    stamp: (s, place) => { place(7, s.monsterGlyph); place(12, s.monsterGlyph); place(10, "b"); } },
  { id: "pressure-dark", family: "pressure", pressures: ["hp", "time"], minDegree: 1, maxDegree: 3,
    stamp: (s, place) => { place(8, s.monsterGlyph); place(13, s.monsterGlyph); } },
  { id: "twist-false-wall", family: "twist", pressures: ["time", "position"], minDegree: 1, maxDegree: 4,
    stamp: (_s, place) => { place(9, "%"); place(14, "c"); } },
  { id: "twist-dispute", family: "twist", pressures: ["inventory", "time"], minDegree: 1, maxDegree: 4, npc: true,
    stamp: (_s, place) => { place(9, "N"); place(13, "I"); } },
];

export const ROOM_TEMPLATES: readonly RoomTemplate[] = templates;

function hash(seed: number, text: string): number {
  let value = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    value = Math.imul(value ^ text.charCodeAt(i), 0x45d9f3b) >>> 0;
  }
  return value;
}

function placeOnFloor(s: RoomStamp, preferredX: number, ch: string): number | undefined {
  for (let dx = 0; dx < s.width; dx++) {
    for (const x of [preferredX + dx, preferredX - dx]) {
      if (x > 0 && x < s.width - 1 && s.canStand(x)) {
        s.put(x, ch);
        return x;
      }
    }
  }
  return undefined;
}

export function chooseRoomTemplate(
  room: DungeonRoomNode,
  seed: number,
  degree: number,
  connectorKinds: readonly ConnectorKind[],
  npcMode: "required" | "forbidden" | "optional" = "optional",
): RoomTemplate {
  const compatible = templates.filter((template) =>
    template.family === room.contentFamily &&
    degree >= template.minDegree && degree <= template.maxDegree &&
    (npcMode === "optional" || (npcMode === "required" ? template.npc === true : template.npc !== true)) &&
    (!template.connectorKinds || connectorKinds.some((kind) => template.connectorKinds!.includes(kind))),
  );
  if (compatible.length === 0) throw new Error(`No compatible ${room.contentFamily} template for ${room.id}`);
  return compatible[hash(seed, `room-template:${room.id}`) % compatible.length]!;
}

/** Stamp deterministic family content, then layer invariant campaign landmarks. */
export function stampRoom(
  room: DungeonRoomNode,
  opts: { isEntrance: boolean; isReward: boolean; isExit: boolean; allowNpc: boolean },
  s: RoomStamp,
  template: RoomTemplate,
): RoomStampResult {
  const placed = (preferredX: number, ch: string): number | undefined => {
    if (ch === "N" && !opts.allowNpc) return undefined;
    return placeOnFloor(s, preferredX, ch);
  };

  if (opts.isEntrance) {
    placeOnFloor(s, 2, "P");
    placeOnFloor(s, 4, "b");
    placeOnFloor(s, 6, "t");
  }

  let npcLocalX: number | undefined;
  const trackingPlace = (preferredX: number, ch: string): number | undefined => {
    const x = placed(preferredX, ch);
    if (ch === "N" && x !== undefined) npcLocalX = x;
    return x;
  };
  template.stamp(s, trackingPlace);

  if (opts.isReward) {
    placeOnFloor(s, s.width - 4, "K");
    placeOnFloor(s, s.width - 6, "c");
    placeOnFloor(s, s.width - 8, "v");
  }
  if (opts.isExit) {
    placeOnFloor(s, 2, "F");
    placeOnFloor(s, 4, "h");
    placeOnFloor(s, s.width - 3, "D");
  }
  return { templateId: template.id, pressures: template.pressures, npcLocalX };
}

export function templateHash(seed: number, text: string): number {
  return hash(seed, text);
}
