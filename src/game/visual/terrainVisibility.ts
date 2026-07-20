/**
 * Classifies which faces of a solid grid cell border open (non-solid) space.
 * Collision keeps every `#`/`%` cell as-is; this only decides whether a cell
 * has a surface worth drawing in detail or is buried rock that should
 * collapse into a flat silhouette instead of a repeated tile texture. A
 * surface is exposed by level geometry alone, never by camera position.
 */

export interface ExposedTerrainFaces {
  floor: boolean;
  ceiling: boolean;
  leftWall: boolean;
  rightWall: boolean;
  enclosed: boolean;
}

const isSolidMass = (grid: readonly string[], x: number, y: number): boolean => {
  const cell = grid[y]?.[x];
  return cell === "#" || cell === "%";
};

/**
 * `(x, y)` is expected to be a solid cell. Off-grid neighbors count as open,
 * matching the existing behavior of always drawing the world's boundary
 * walls (players can walk up to and see the map edge).
 */
export function exposedTerrainFaces(grid: readonly string[], x: number, y: number): ExposedTerrainFaces {
  const floor = !isSolidMass(grid, x, y - 1);
  const ceiling = !isSolidMass(grid, x, y + 1);
  const leftWall = !isSolidMass(grid, x - 1, y);
  const rightWall = !isSolidMass(grid, x + 1, y);
  return {
    floor,
    ceiling,
    leftWall,
    rightWall,
    enclosed: !floor && !ceiling && !leftWall && !rightWall,
  };
}
