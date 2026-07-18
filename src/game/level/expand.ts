/**
 * Tile expansion: turn an abstract (graph) dungeon into a concrete tile grid the
 * scene can render, plus the (x, y) room regions the scene reasons about.
 *
 * Each macro-cell becomes a fixed CELL_W x CELL_H block. Room cells are carved out
 * of solid rock as enclosed chambers with a floor; connectors are carved along the
 * macro path of each graph edge — a doorway for horizontal (beside) links, and a
 * staggered one-way-ledge shaft for vertical (above/below) links. The ledge
 * spacing (3 tiles) sits inside the jump height (~3.16 tiles) and the safe-fall
 * allowance (4 tiles), so every vertical connector is traversable up and down by
 * any class without fall damage.
 *
 * The result is shaped as a DungeonDefinition so the existing renderer consumes it
 * unchanged. This is the Milestone 2 bridge from the M1 pipeline to the screen.
 */

import type { AbstractDungeon, Beat, DungeonConnection, DungeonRoomNode, MacroPoint } from "./model";
import {
  DUNGEONS,
  type DungeonDefinition,
  type ExpandedConnector,
  type ExpandedRoomContent,
  type TalkableNpcOutcome,
  type TalkableNpcSpec,
  type VariantPools,
} from "./dungeons";
import type { RoomRegion } from "./geometry";
import { chooseRoomTemplate, stampRoom, templateHash, type RoomStamp } from "./templates";
import { validatePhysicalDungeon } from "./physical";

export const CELL_W = 20;
export const CELL_H = 12;

const NPC_NAMES = ["Aster Vale", "Brother Senn", "Mara Quill", "Old Kest", "Veyra Ash"] as const;
const NPC_ROLES = ["lost cartographer", "oathbound pilgrim", "rival delver", "ruin keeper"] as const;

function npcDialogue(outcome: TalkableNpcOutcome): { introduction: string; resolution: string } {
  switch (outcome) {
    case "give-torch": return {
      introduction: "Keep your voice down. The dark here listens.",
      resolution: "Take this torch. I would rather owe you light than a grave.",
    };
    case "reveal-route": return {
      introduction: "I found a seam in the stone, but dared not test it alone.",
      resolution: "There—the hidden catch. That route is open now.",
    };
    case "warning": return {
      introduction: "Steel carries farther than footsteps in these halls.",
      resolution: "Open doors carry noise. A closed gate may be the safer road.",
    };
  }
}

/** Encounter-monster id -> level tile glyph understood by the renderer. */
const MONSTER_GLYPH: Record<string, string> = {
  goblin: "g",
  skeleton: "s",
  "giant-rat": "r",
  "gloom-ogre": "O",
};

const BEAT_LABEL: Record<Beat, { title: string; ordinal: string }> = {
  entrance: { title: "THE GATE", ordinal: "I" },
  challenge: { title: "THE TEST", ordinal: "II" },
  setback: { title: "THE SETBACK", ordinal: "III" },
  climax: { title: "THE CLIMAX", ordinal: "IV" },
  reward: { title: "THE VAULT", ordinal: "V" },
};

const SOLID = new Set(["#", "%", "="]);

type Grid = string[][];

function makeGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "#"));
}

function set(grid: Grid, x: number, y: number, ch: string): void {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return;
  row[x] = ch;
}

function get(grid: Grid, x: number, y: number): string | undefined {
  return grid[y]?.[x];
}

const cellOx = (col: number): number => col * CELL_W;
const cellOy = (row: number): number => row * CELL_H;
const cellCenterX = (col: number): number => col * CELL_W + Math.floor(CELL_W / 2);
/** Standing row (feet) inside a cell; solid floor sits one row below it. */
const standingY = (row: number): number => row * CELL_H + CELL_H - 3;

/** Carve an enclosed chamber with a floor out of the solid rock. */
function carveRoom(grid: Grid, col: number, row: number): void {
  const ox = cellOx(col);
  const oy = cellOy(row);
  for (let y = oy + 1; y <= oy + CELL_H - 3; y++) {
    for (let x = ox + 1; x <= ox + CELL_W - 2; x++) set(grid, x, y, ".");
  }
  // Floor surface: the row just below the standing row stays solid (already "#").
}

/** A walkable doorway/corridor at floor level between two same-row cell centres. */
function carveHorizontalCorridor(grid: Grid, xA: number, xB: number, y: number): void {
  const lo = Math.min(xA, xB);
  const hi = Math.max(xA, xB);
  for (let x = lo; x <= hi; x++) {
    set(grid, x, y, ".");
    set(grid, x, y - 1, ".");
    set(grid, x, y + 1, "#"); // floor to walk on
  }
}

/**
 * A vertical shaft between two same-column cells: a ladder column with an open
 * climb lane beside it. Ladders are universal two-way traversal — the party climbs
 * up by holding up, and descending onto the ladder arrests the fall into a safe
 * controlled climb (see the scene's climb handling), so no vertical connector ever
 * inflicts fall damage.
 */
function carveVerticalShaft(grid: Grid, cx: number, yTop: number, yBot: number): void {
  for (let y = yTop; y <= yBot; y++) {
    set(grid, cx, y, "|"); // ladder: solid + climbable
    set(grid, cx - 1, y, "."); // climb/access lane beside the ladder
  }
}

type Phase = "horizontal" | "vertical";

/**
 * Carve one graph edge's connectors along its macro path. Horizontal corridors are
 * carved in a first pass and vertical ladders in a second, so at a routed corner
 * the ladder is laid last and stays intact where a corridor crosses it.
 */
function carveConnection(grid: Grid, path: readonly MacroPoint[], phase: Phase): void {
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (a.row === b.row) {
      if (phase === "horizontal") {
        carveHorizontalCorridor(grid, cellCenterX(a.column), cellCenterX(b.column), standingY(a.row));
      }
    } else if (a.column === b.column) {
      if (phase === "vertical") {
        const upper = Math.min(a.row, b.row);
        const lower = Math.max(a.row, b.row);
        carveVerticalShaft(grid, cellCenterX(a.column), standingY(upper), standingY(lower));
      }
    } else {
      throw new Error(`Non-orthogonal macro step ${a.column},${a.row} -> ${b.column},${b.row}`);
    }
  }
}

function endpointTile(point: MacroPoint): { x: number; y: number } {
  return { x: cellCenterX(point.column), y: standingY(point.row) };
}

/** First connector tile outside the source room, used for gates and secret doors. */
function blockerTile(path: readonly MacroPoint[]): { x: number; y: number } {
  const from = path[0]!;
  const next = path[1]!;
  if (from.row === next.row) {
    return {
      x: next.column > from.column ? cellOx(from.column) + CELL_W : cellOx(from.column),
      y: standingY(from.row),
    };
  }
  return {
    x: cellCenterX(from.column),
    y: next.row > from.row ? standingY(from.row) + 1 : standingY(from.row) - 1,
  };
}

function expandedConnector(
  conn: DungeonConnection,
  path: readonly MacroPoint[],
  requirement: AbstractDungeon["requirements"][number] | undefined,
): ExpandedConnector {
  const vertical = path.some((p, i) => i > 0 && p.column === path[i - 1]!.column && p.row !== path[i - 1]!.row);
  const closed = conn.state === "locked" || conn.state === "switched" || conn.state === "secret" || conn.state === "breakable";
  return {
    id: conn.id,
    fromRoomId: conn.fromRoomId,
    toRoomId: conn.toRoomId,
    kind: conn.kind,
    state: conn.state,
    direction: conn.direction,
    requirement,
    entry: endpointTile(path[0]!),
    landing: endpointTile(path[path.length - 1]!),
    waypoints: path.map(endpointTile),
    blocker: closed ? blockerTile(path) : undefined,
    vertical,
  };
}

function stampBlocker(grid: Grid, connector: ExpandedConnector): void {
  if (!connector.blocker) return;
  const { x, y } = connector.blocker;
  if (connector.state === "breakable") set(grid, x, y, "%");
  else set(grid, x, y, "+");
}

function themeBase(themeId: string): DungeonDefinition {
  const base = DUNGEONS.find((d) => d.id === themeId);
  if (!base) throw new Error(`Unknown theme id "${themeId}" for expansion`);
  return base;
}

const EMPTY_POOLS: VariantPools = {
  room1: [0],
  room2: [0],
  room3: [0],
  room4: [0],
  room5: [0],
  sanctuary: [0],
};

/** Expand an abstract dungeon into a renderable, region-annotated definition. */
export function expandDungeon(abstract: AbstractDungeon): DungeonDefinition {
  const width = abstract.macroWidth * CELL_W;
  const height = abstract.macroHeight * CELL_H;
  const grid = makeGrid(width, height);

  const base = themeBase(abstract.themeId);
  const monsterGlyph = MONSTER_GLYPH[base.encounterMonsterId] ?? "g";

  const roomByNode = new Map<string, DungeonRoomNode>();
  for (const room of abstract.rooms) roomByNode.set(room.id, room);

  // 1. Carve every room chamber.
  for (const room of abstract.rooms) carveRoom(grid, room.position.column, room.position.row);

  // 2. Carve connectors in global phases. Vertical shafts must be applied after
  // every horizontal corridor, otherwise a later corridor can refill a shaft's
  // access lane with floor rock at a routed crossing.
  const paths = abstract.connections.map((conn) => {
    const from = roomByNode.get(conn.fromRoomId)!;
    const to = roomByNode.get(conn.toRoomId)!;
    return [from.position, ...conn.routedCells, to.position] satisfies MacroPoint[];
  });
  for (const path of paths) carveConnection(grid, path, "horizontal");
  for (const path of paths) carveConnection(grid, path, "vertical");

  const requirements = new Map(abstract.requirements.map((r) => [r.id, r]));
  const connectors = abstract.connections.map((conn, i) =>
    expandedConnector(conn, paths[i]!, conn.requirementId ? requirements.get(conn.requirementId) : undefined),
  );

  // A separate deterministic stream controls social content, so changing a room
  // template never perturbs topology or connector selection. Standard runs get
  // zero or one talkable NPC, targeting half of seeds.
  const npcEligible = abstract.rooms.filter((room) =>
    room.contentFamily === "discovery" || room.contentFamily === "twist",
  );
  const npcRoom = npcEligible.length > 0 && templateHash(abstract.seed, "talkable-npc") % 2 === 0
    ? npcEligible[templateHash(abstract.seed, "talkable-npc-room") % npcEligible.length]
    : undefined;
  const roomContents: ExpandedRoomContent[] = [];
  const talkableNpcs: TalkableNpcSpec[] = [];

  // 3. Stamp room contents after all carving, so nothing floats over a shaft.
  for (const room of abstract.rooms) {
    const ox = cellOx(room.position.column);
    const y = standingY(room.position.row);
    const stamp: RoomStamp = {
      width: CELL_W,
      monsterGlyph,
      put: (localX, ch) => set(grid, ox + localX, y, ch),
      canStand: (localX) => {
        const x = ox + localX;
        return (
          get(grid, x, y) === "." &&
          get(grid, x, y - 1) === "." &&
          SOLID.has(get(grid, x, y + 1) ?? "")
        );
      },
    };
    const incident = abstract.connections.filter((connection) =>
      connection.fromRoomId === room.id || connection.toRoomId === room.id,
    );
    const selectedTemplate = chooseRoomTemplate(
      room,
      abstract.seed,
      incident.length,
      incident.map((connection) => connection.kind),
      room.id === npcRoom?.id ? "required" : "forbidden",
    );
    const stamped = stampRoom(
      room,
      {
        isEntrance: room.id === abstract.entranceRoomId,
        isReward: room.id === abstract.rewardRoomId,
        isExit: room.id === abstract.exitRoomId,
        allowNpc: room.id === npcRoom?.id,
      },
      stamp,
      selectedTemplate,
    );
    roomContents.push({
      roomId: room.id,
      family: room.contentFamily,
      templateId: stamped.templateId,
      pressures: stamped.pressures,
    });
    if (stamped.npcLocalX !== undefined) {
      const npcHash = templateHash(abstract.seed, `npc:${room.id}`);
      const outcome = (["give-torch", "reveal-route", "warning"] as const)[npcHash % 3]!;
      const dialogue = npcDialogue(outcome);
      talkableNpcs.push({
        id: `npc-${room.node}`,
        roomId: room.id,
        tile: { x: ox + stamped.npcLocalX, y },
        name: NPC_NAMES[npcHash % NPC_NAMES.length]!,
        role: NPC_ROLES[(npcHash >>> 4) % NPC_ROLES.length]!,
        introduction: dialogue.introduction,
        resolution: dialogue.resolution,
        outcome,
      });
    }
  }

  // 4. Closed connector states sit above room decoration and retain stable tile
  // coordinates for the scene's interaction/persistence layer.
  for (const connector of connectors) stampBlocker(grid, connector);

  const regions: RoomRegion[] = abstract.rooms.map((room) => {
    const ox = cellOx(room.position.column);
    const oy = cellOy(room.position.row);
    const label = BEAT_LABEL[room.beat];
    return {
      id: room.id,
      title: label.title,
      hud: `ROOM ${label.ordinal}  |  ${label.title}`,
      x1: ox,
      y1: oy,
      x2: ox + CELL_W - 1,
      y2: oy + CELL_H - 1,
      labelX: cellCenterX(room.position.column),
      beat: room.beat,
    };
  });

  const expanded: DungeonDefinition = {
    id: `nl-${abstract.topologyId}-${abstract.seed}`,
    name: base.name,
    tagline: base.tagline,
    objective: "Reach the vault, then the exit",
    grid: grid.map((row) => row.join("")),
    width,
    height,
    regions,
    connectors,
    roomContents,
    talkableNpcs,
    theme: base.theme,
    pools: EMPTY_POOLS,
    traps: [],
    trapKinds: [],
    danger: base.danger,
    encounterMonsterId: base.encounterMonsterId,
  };
  const physical = validatePhysicalDungeon(expanded);
  if (!physical.ok) throw new Error(`Invalid physical dungeon: ${physical.diagnostics.join(",")}`);
  return expanded;
}
