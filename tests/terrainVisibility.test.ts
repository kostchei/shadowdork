import { describe, expect, it } from "vitest";
import { exposedTerrainFaces } from "../src/game/visual/terrainVisibility";

describe("exposedTerrainFaces", () => {
  it("marks the top row of a solid cave floor as an exposed floor", () => {
    const grid = [
      "..........",
      "##########",
      "##########",
      "##########",
    ];
    const faces = exposedTerrainFaces(grid, 5, 1);
    expect(faces.floor).toBe(true);
    expect(faces.enclosed).toBe(false);
  });

  it("marks solid cells beneath the top row as enclosed with no detailed tile", () => {
    const grid = [
      "..........",
      "##########",
      "##########",
      "##########",
    ];
    const faces = exposedTerrainFaces(grid, 5, 2);
    expect(faces.floor).toBe(false);
    expect(faces.ceiling).toBe(false);
    expect(faces.leftWall).toBe(false);
    expect(faces.rightWall).toBe(false);
    expect(faces.enclosed).toBe(true);
  });

  it("marks the bottom row of a low ceiling as an exposed ceiling underside", () => {
    const grid = [
      "##########",
      "##########",
      "..........",
    ];
    const faces = exposedTerrainFaces(grid, 5, 1);
    expect(faces.ceiling).toBe(true);
    expect(faces.enclosed).toBe(false);
  });

  it("does not repeat the ceiling texture for solid cells above the exposed underside", () => {
    const grid = [
      "##########",
      "##########",
      "##########",
      "..........",
    ];
    const faces = exposedTerrainFaces(grid, 5, 1);
    expect(faces.ceiling).toBe(false);
    expect(faces.enclosed).toBe(true);
  });

  it("keeps vertical cave walls' exposed face", () => {
    const grid = [
      "..........",
      "..#.......",
      "..#.......",
      "..........",
    ];
    const faces = exposedTerrainFaces(grid, 2, 1);
    expect(faces.floor).toBe(true);
    expect(faces.leftWall).toBe(true);
    expect(faces.rightWall).toBe(true);
  });

  it("does not synthetically extend a high authored ceiling — a deep-mass row far above stays enclosed, not a fake ceiling face", () => {
    const grid = Array.from({ length: 20 }, () => "##########");
    grid[0] = "..........";
    // Row 10 sits deep inside the mass; it has no exposed ceiling face just
    // because a real ceiling exists many rows above.
    const faces = exposedTerrainFaces(grid, 5, 10);
    expect(faces.ceiling).toBe(false);
    expect(faces.floor).toBe(false);
    expect(faces.enclosed).toBe(true);
  });

  it("gives an open-sky room no generated ceiling face for solid ground below it", () => {
    // Ground floor with nothing but open sky above for many rows: the floor
    // row is exposed on top; nothing invents a ceiling anywhere above it
    // because there is no solid cell up there to classify.
    const grid = [
      "..........",
      "..........",
      "..........",
      "##########",
    ];
    const faces = exposedTerrainFaces(grid, 5, 3);
    expect(faces.floor).toBe(true);
  });

  it("shows a desert surface edge without exposing a deep decorated cross-section", () => {
    const grid = [
      "..........",
      "##########",
      "##########",
      "##########",
      "##########",
      "##########",
    ];
    expect(exposedTerrainFaces(grid, 4, 1).enclosed).toBe(false);
    expect(exposedTerrainFaces(grid, 4, 3).enclosed).toBe(true);
    expect(exposedTerrainFaces(grid, 4, 4).enclosed).toBe(true);
  });

  it("keeps a rooftop façade / support column visible at every exposed edge", () => {
    const grid = [
      "...##.....",
      "...##.....",
      "...##.....",
      "..........",
    ];
    const top = exposedTerrainFaces(grid, 3, 0);
    expect(top.floor).toBe(true);
    expect(top.leftWall).toBe(true);
    const bottom = exposedTerrainFaces(grid, 3, 2);
    expect(bottom.ceiling).toBe(true);
    expect(bottom.leftWall).toBe(true);
  });

  it("treats the map edge as open, matching unchanged collision coverage for boundary cells", () => {
    const grid = [
      "##########",
      "#........#",
      "##########",
    ];
    // The boundary wall's outward face (off-grid neighbor) is treated as
    // open so the world's edge wall keeps its exposed face, same as before
    // this classifier existed — collision is identical either way.
    const faces = exposedTerrainFaces(grid, 0, 1);
    expect(faces.leftWall).toBe(true);
    expect(faces.enclosed).toBe(false);
  });
});
