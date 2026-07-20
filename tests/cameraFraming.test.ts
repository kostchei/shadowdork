import { describe, expect, it } from "vitest";
import {
  AIRBORNE_MODE_DELAY_MS,
  CAMERA_FORWARD_CENTRE_SHIFT,
  CameraFramingController,
  ELEVATED_DROP_TILES,
  horizontalOffsetFor,
  isElevatedSupport,
  verticalOffsetForMode,
} from "../src/game/systems/cameraFraming";

const GAME_W = 960;
const GAME_H = 540;

describe("horizontalOffsetFor", () => {
  it("places the leader at 20% of the view when facing right", () => {
    const offset = horizontalOffsetFor(1, GAME_W);
    const leaderScreenX = offset + GAME_W / 2;
    expect(leaderScreenX).toBeCloseTo(GAME_W * 0.2, 5);
  });

  it("places the leader at 80% of the view when facing left", () => {
    const offset = horizontalOffsetFor(-1, GAME_W);
    const leaderScreenX = offset + GAME_W / 2;
    expect(leaderScreenX).toBeCloseTo(GAME_W * 0.8, 5);
  });

  it("shifts the camera centre by 30% of the view width", () => {
    expect(CAMERA_FORWARD_CENTRE_SHIFT).toBeCloseTo(0.3, 5);
    expect(horizontalOffsetFor(1, GAME_W)).toBeCloseTo(-0.3 * GAME_W, 5);
    expect(horizontalOffsetFor(-1, GAME_W)).toBeCloseTo(0.3 * GAME_W, 5);
  });
});

describe("verticalOffsetForMode", () => {
  it("raises the camera so feet sit near the bottom in floor framing", () => {
    const offset = verticalOffsetForMode("floor", GAME_H);
    // leader screen y (sprite origin) + feet offset should land near GAME_H - TILE/2
    const feetScreenY = offset + GAME_H / 2 + 15;
    expect(feetScreenY).toBeCloseTo(GAME_H - 16, 0);
  });

  it("centres the leader vertically in elevated framing", () => {
    expect(verticalOffsetForMode("elevated", GAME_H)).toBe(0);
  });
});

describe("isElevatedSupport", () => {
  const solidRow = (n: number) => "#".repeat(n);

  it("classifies a one-way platform as elevated in every biome", () => {
    const grid = ["..........", "..........", "=========="];
    expect(isElevatedSupport(grid, 3, 2)).toBe(true);
  });

  it("classifies ordinary solid cave/desert floor (deep mass below) as not elevated", () => {
    const grid = [".........."];
    for (let i = 0; i < ELEVATED_DROP_TILES + 5; i++) grid.push(solidRow(10));
    expect(isElevatedSupport(grid, 3, 1)).toBe(false);
  });

  it("classifies a ledge with a meaningful drop below it as elevated", () => {
    const grid: string[] = [];
    grid.push(".........."); // 0: open above
    grid.push("##########"); // 1: the ledge itself
    for (let i = 0; i < ELEVATED_DROP_TILES + 2; i++) grid.push("..........");
    grid.push(solidRow(10)); // eventual ground far below
    expect(isElevatedSupport(grid, 3, 1)).toBe(true);
  });

  it("does not elevate a short lip shorter than the drop threshold", () => {
    const grid: string[] = [];
    grid.push("..........");
    grid.push("##########"); // the ledge
    for (let i = 0; i < ELEVATED_DROP_TILES - 1; i++) grid.push("..........");
    grid.push(solidRow(10));
    expect(isElevatedSupport(grid, 3, 1)).toBe(false);
  });
});

describe("CameraFramingController", () => {
  it("does not snap when facing changes — the smoothed value eases toward the new target", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    const target = controller.update(0, 16, {
      facing: -1,
      grounded: true,
      climbing: false,
      supportIsElevated: false,
    });
    const fullyRight = horizontalOffsetFor(1);
    const fullyLeft = horizontalOffsetFor(-1);
    expect(target.offsetX).not.toBeCloseTo(fullyLeft, 1);
    expect(target.offsetX).toBeGreaterThan(fullyRight);
    expect(target.offsetX).toBeLessThan(fullyLeft);
  });

  it("converges to the new facing's target after enough time", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    let target = controller.update(0, 16, { facing: -1, grounded: true, climbing: false, supportIsElevated: false });
    for (let t = 16; t < 5000; t += 16) {
      target = controller.update(t, 16, { facing: -1, grounded: true, climbing: false, supportIsElevated: false });
    }
    expect(target.offsetX).toBeCloseTo(horizontalOffsetFor(-1), 1);
  });

  it("retains the last grounded mode through a brief jump", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    // Airborne for less than AIRBORNE_MODE_DELAY_MS.
    const target = controller.update(0, AIRBORNE_MODE_DELAY_MS - 20, {
      facing: 1,
      grounded: false,
      climbing: false,
      supportIsElevated: false,
    });
    expect(target.verticalMode).toBe("floor");
  });

  it("switches to elevated framing after a sustained fall", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    let now = 0;
    let target = controller.update(now, 16, { facing: 1, grounded: false, climbing: false, supportIsElevated: false });
    now += 16;
    while (now < AIRBORNE_MODE_DELAY_MS + 200) {
      target = controller.update(now, 16, { facing: 1, grounded: false, climbing: false, supportIsElevated: false });
      now += 16;
    }
    expect(target.verticalMode).toBe("elevated");
  });

  it("switches to elevated framing immediately while climbing", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    const target = controller.update(0, 16, { facing: 1, grounded: false, climbing: true, supportIsElevated: false });
    expect(target.verticalMode).toBe("elevated");
  });

  it("resets deterministically on leader swap / teleport, snapping to the new facing and mode", () => {
    const controller = new CameraFramingController();
    controller.reset(1, "floor");
    controller.update(0, 5000, { facing: -1, grounded: true, climbing: false, supportIsElevated: false });
    const snapped = controller.reset(1, "elevated");
    expect(snapped.offsetX).toBeCloseTo(horizontalOffsetFor(1), 5);
    expect(snapped.offsetY).toBeCloseTo(verticalOffsetForMode("elevated"), 5);
    expect(snapped.verticalMode).toBe("elevated");
  });
});
