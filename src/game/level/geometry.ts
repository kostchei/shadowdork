/**
 * Room geometry as (x, y) tile regions rather than horizontal bands.
 *
 * The old world was one screen high and rooms were pure x-ranges, so "which room
 * is this?" was an x lookup (see the retired ROOM_BANDS). Non-linear dungeons put
 * rooms above and below one another, so room identity must be a rectangular region
 * test. This module is Phaser-free: the scene reads regions from the active
 * dungeon and asks `roomAt` instead of consulting module-level constants.
 */

import type { Beat } from "./model";

export interface RoomRegion {
  /** Stable id used in saves and morale-group keys, e.g. "room-1" or "sanctuary". */
  id: string;
  /** Backdrop label drawn across the region, e.g. "I  THE GATE". */
  title: string;
  /** HUD room readout, e.g. "ROOM I  |  THE GATE". */
  hud: string;
  /** Inclusive tile bounds. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Tile x the backdrop label anchors to. */
  labelX: number;
  /** Narrative beat, when the region came from the abstract generator. */
  beat?: Beat;
}

/** The region strictly containing tile (tx, ty), or undefined on walls/dividers. */
export function roomAt(
  regions: readonly RoomRegion[],
  tx: number,
  ty: number,
): RoomRegion | undefined {
  return regions.find((r) => tx >= r.x1 && tx <= r.x2 && ty >= r.y1 && ty <= r.y2);
}

/**
 * The leader's current room. Falls back to a one-tile x tolerance so a leader
 * standing exactly on the divider column between two rooms still resolves to a
 * room (matching the retired ROOM_BANDS `x2 + 1` behaviour), rather than reading
 * as "no room" and suppressing the room readout and auto-save-on-transition.
 */
export function roomAtTolerant(
  regions: readonly RoomRegion[],
  tx: number,
  ty: number,
): RoomRegion | undefined {
  return (
    roomAt(regions, tx, ty) ??
    regions.find((r) => tx >= r.x1 && tx <= r.x2 + 1 && ty >= r.y1 && ty <= r.y2)
  );
}

/** Centre tile of a region, for placing camera cues or spawn scans. */
export function regionCenter(r: RoomRegion): { x: number; y: number } {
  return { x: Math.round((r.x1 + r.x2) / 2), y: Math.round((r.y1 + r.y2) / 2) };
}
