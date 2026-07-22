export interface TilePosition { x: number; y: number }

const isSolid = (cell: string | undefined): boolean => cell === "#" || cell === "%" || cell === "=";

/** Find the nearest open, supported, non-hazard tile for a newly stabilized character. */
export function nearestSafeStandingTile(
  grid: readonly string[],
  origin: TilePosition,
  isHazard: (x: number, y: number) => boolean,
  maxRadius = 8,
): TilePosition | undefined {
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const dxMagnitude = radius - Math.abs(dy);
      const dxs = dxMagnitude === 0 ? [0] : [-dxMagnitude, dxMagnitude];
      for (const dx of dxs) {
        const x = origin.x + dx;
        const y = origin.y + dy;
        const cell = grid[y]?.[x];
        if (cell === undefined || isSolid(cell) || cell === "+" || isHazard(x, y)) continue;
        if (isSolid(grid[y + 1]?.[x])) return { x, y };
      }
    }
  }
  return undefined;
}
