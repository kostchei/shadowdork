import { describe, expect, it } from "vitest";
import { roomAt, roomAtTolerant } from "../src/game/level/geometry";
import { DUNGEONS, LEGACY_REGIONS, ROOM_BANDS, dungeonAt } from "../src/game/level/dungeons";

describe("room geometry", () => {
  it("derives one region per legacy band, aligned to the same x-range", () => {
    expect(LEGACY_REGIONS).toHaveLength(ROOM_BANDS.length);
    LEGACY_REGIONS.forEach((region, i) => {
      const band = ROOM_BANDS[i]!;
      expect(region.x1).toBe(band.x1);
      expect(region.x2).toBe(band.x2);
      // Interior play area, not the shell walls.
      expect(region.y1).toBeGreaterThan(0);
      expect(region.y2).toBeLessThan(DUNGEONS[0]!.height);
    });
    expect(LEGACY_REGIONS.at(-1)!.id).toBe("sanctuary");
  });

  it("resolves the same room a band lookup would, for every interior column", () => {
    const regions = LEGACY_REGIONS;
    for (const band of ROOM_BANDS) {
      const expectedId = band.room === 6 ? "sanctuary" : `room-${band.room}`;
      for (let x = band.x1; x <= band.x2; x++) {
        expect(roomAt(regions, x, 14)?.id).toBe(expectedId);
      }
    }
  });

  it("returns no region on divider columns but tolerates the leader edge", () => {
    const regions = LEGACY_REGIONS;
    const divider = ROOM_BANDS[0]!.x2 + 1; // column 21, between room 1 and 2
    expect(roomAt(regions, divider, 14)).toBeUndefined();
    // A leader standing on the divider still reads as the room to its left.
    expect(roomAtTolerant(regions, divider, 14)?.id).toBe("room-1");
  });

  it("attaches dimensions and regions to every generated dungeon", () => {
    for (let index = 0; index < 8; index++) {
      const d = dungeonAt(index);
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBe(d.grid.length);
      expect(d.regions.length).toBeGreaterThanOrEqual(5);
      // Every monster tile must fall inside some region (the scene asserts this).
      d.grid.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if ("gsrO".includes(row[x]!)) {
            expect(roomAt(d.regions, x, y), `monster at ${x},${y}`).toBeDefined();
          }
        }
      });
    }
  });
});
