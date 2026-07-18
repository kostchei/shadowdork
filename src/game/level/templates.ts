/**
 * Room-content templates for tile expansion.
 *
 * A template stamps a room's contents (spawn, monsters, treasure, hazards,
 * sanctuary fittings) in room-local coordinates, so the same beat can be placed
 * into any macro-cell the embedding chose. Geometry — walls, floors, connector
 * openings — is the expander's job; templates only decorate the carved interior.
 *
 * This is the minimal Milestone 2 set: enough per-beat identity to prove that a
 * Railroad and a vertical form render and play from the same data model. The
 * richer content-family/tag catalogue is Milestone 4.
 */

import type { Beat } from "./model";

export interface RoomStamp {
  /** Interior width of the cell in tiles. */
  width: number;
  /** Themed encounter monster glyph for this dungeon (e.g. "g", "s"). */
  monsterGlyph: string;
  /** Place a tile at the standing row, cell-local x. */
  put(localX: number, ch: string): void;
  /**
   * True when local x is a usable standing spot: the standing row and the head
   * row above it are open, and the tile below is solid floor (not a shaft hole).
   */
  canStand(localX: number): boolean;
}

/** Place a content tile on the nearest usable standing spot to preferredX. */
function placeOnFloor(s: RoomStamp, preferredX: number, ch: string): void {
  for (let dx = 0; dx < s.width; dx++) {
    for (const x of [preferredX + dx, preferredX - dx]) {
      if (x > 0 && x < s.width - 1 && s.canStand(x)) {
        s.put(x, ch);
        return;
      }
    }
  }
}

/**
 * Stamp a room's contents for its beat. `isReward`/`isExit` layer the campaign
 * reward and the sanctuary (campfire, shrine, exit door) onto whichever rooms the
 * generator chose for them, independent of the beat.
 */
export function stampRoom(
  beat: Beat,
  opts: { isEntrance: boolean; isReward: boolean; isExit: boolean },
  s: RoomStamp,
): void {
  const mid = Math.floor(s.width / 2);

  if (opts.isEntrance) {
    placeOnFloor(s, 2, "P"); // party spawn
    placeOnFloor(s, 4, "b"); // brazier: light to see the mouth
    placeOnFloor(s, 6, "t"); // spare torch
  }

  switch (beat) {
    case "entrance":
      break; // spawn handled above
    case "challenge":
      placeOnFloor(s, mid - 2, s.monsterGlyph);
      placeOnFloor(s, mid + 3, "c");
      break;
    case "setback":
      placeOnFloor(s, mid - 3, "^"); // spike hazard
      placeOnFloor(s, mid + 2, "%"); // breakable masonry: an alternate way
      break;
    case "climax":
      placeOnFloor(s, mid - 2, s.monsterGlyph);
      placeOnFloor(s, mid + 2, s.monsterGlyph);
      placeOnFloor(s, mid, "b"); // brazier lights the arena
      break;
    case "reward":
      break; // reward marker handled below
  }

  if (opts.isReward) {
    placeOnFloor(s, s.width - 4, "K"); // campaign reward marker
    placeOnFloor(s, s.width - 6, "c");
    placeOnFloor(s, s.width - 8, "v"); // banner flourish
  }

  if (opts.isExit) {
    placeOnFloor(s, 2, "F"); // sanctuary campfire (rest)
    placeOnFloor(s, 4, "h"); // shrine (priest atonement)
    placeOnFloor(s, s.width - 3, "D"); // exit door
  }
}
