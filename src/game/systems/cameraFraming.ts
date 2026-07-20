/**
 * Directional camera composition: keeps most of the view ahead of the leader
 * (horizontal) and switches between a floor-hugging and a centred vertical
 * framing depending on whether there is meaningful traversable space below
 * their feet. Pure calculations live here so the 80/20 math and the
 * floor/elevated cases are unit-testable without booting Phaser; the
 * stateful controller only adds delta-time damping and jump-hold hysteresis
 * on top.
 */

/**
 * Mirrors GAME_W/GAME_H from ../display and TILE from ../textures. Kept as
 * local constants (rather than importing those modules) so this module has
 * no `window`/DOM/Phaser dependency and stays unit-testable without booting
 * a browser environment.
 */
const GAME_W = 960;
const GAME_H = 540;
const TILE = 32;

export type VerticalMode = "floor" | "elevated";

export interface CameraFramingTarget {
  offsetX: number;
  offsetY: number;
  verticalMode: VerticalMode;
}

/** Share of the logical view kept ahead of the leader's facing direction. */
export const CAMERA_FORWARD_SHARE = 0.8;
/** Fraction of GAME_W the camera centre shifts ahead of the leader (80/20 split). */
export const CAMERA_FORWARD_CENTRE_SHIFT = CAMERA_FORWARD_SHARE - 0.5;
/** Target on-screen margin between the leader's feet and the bottom edge in floor framing. */
export const FLOOR_FEET_MARGIN_PX = TILE / 2;
/** Vertical distance from a character's origin to its feet, matching the shadow offset in CharacterSprite. */
export const FEET_OFFSET_PX = 15;
/** Damping half-life-ish time constant for horizontal look-ahead changes. */
export const LOOK_EASE_MS = 350;
/** Damping time constant for floor/elevated vertical transitions. */
export const VERTICAL_EASE_MS = 450;
/** A jump/hop shorter than this keeps the previous grounded framing mode instead of flapping to elevated. */
export const AIRBORNE_MODE_DELAY_MS = 180;
/** Contiguous open tiles below a supporting surface before it counts as a meaningful drop. */
export const ELEVATED_DROP_TILES = 3;

const isSolidMass = (grid: readonly string[], x: number, y: number): boolean => {
  const cell = grid[y]?.[x];
  return cell === "#" || cell === "%";
};

/** Horizontal follow offset for the given facing direction (negative = camera centre ahead to the right). */
export function horizontalOffsetFor(facing: 1 | -1, viewW: number = GAME_W): number {
  return -facing * CAMERA_FORWARD_CENTRE_SHIFT * viewW;
}

/** Vertical follow offset for a resolved framing mode. */
export function verticalOffsetForMode(mode: VerticalMode, viewH: number = GAME_H): number {
  if (mode === "floor") return viewH - FLOOR_FEET_MARGIN_PX - viewH / 2 - FEET_OFFSET_PX;
  return 0;
}

/**
 * Whether the surface currently supporting the leader should use elevated
 * framing. A one-way platform is always elevated by design; otherwise this
 * measures the open (non-solid) run below the supporting tile and treats a
 * long enough drop as "meaningful open space below" — the same signal a
 * rooftop ledge, canopy platform, or cave/desert bridge all share, without
 * needing separate per-skin or per-room bookkeeping.
 */
export function isElevatedSupport(
  grid: readonly string[],
  supportTileX: number,
  supportTileY: number,
): boolean {
  const supportChar = grid[supportTileY]?.[supportTileX];
  if (supportChar === "=") return true;
  if (!isSolidMass(grid, supportTileX, supportTileY)) return false;

  let openRun = 0;
  for (let y = supportTileY + 1; y < grid.length && openRun < ELEVATED_DROP_TILES; y++) {
    if (isSolidMass(grid, supportTileX, y)) break;
    openRun++;
  }
  return openRun >= ELEVATED_DROP_TILES;
}

const damp = (current: number, target: number, easeMs: number, deltaMs: number): number => {
  if (easeMs <= 0 || deltaMs <= 0) return target;
  const t = 1 - Math.exp(-deltaMs / easeMs);
  return current + (target - current) * t;
};

export interface CameraFramingUpdateParams {
  facing: 1 | -1;
  grounded: boolean;
  climbing: boolean;
  /** Elevated/floor classification of the surface currently supporting the leader (ignored while airborne). */
  supportIsElevated: boolean;
}

/**
 * Smoothed camera-framing state. Owns only the easing and mode hysteresis;
 * `DungeonScene` is responsible for querying the grid and leader state each
 * tick and applying the result to `cameras.main`.
 */
export class CameraFramingController {
  private offsetX = 0;
  private offsetY = 0;
  private mode: VerticalMode = "floor";
  private airborneSinceMs: number | null = null;

  get verticalMode(): VerticalMode {
    return this.mode;
  }

  /** Snap immediately to the given facing/mode — used on leader swap, teleport, load, and restart. */
  reset(facing: 1 | -1, mode: VerticalMode): CameraFramingTarget {
    this.mode = mode;
    this.offsetX = horizontalOffsetFor(facing);
    this.offsetY = verticalOffsetForMode(mode);
    this.airborneSinceMs = null;
    return { offsetX: this.offsetX, offsetY: this.offsetY, verticalMode: this.mode };
  }

  update(nowMs: number, deltaMs: number, params: CameraFramingUpdateParams): CameraFramingTarget {
    const { facing, grounded, climbing, supportIsElevated } = params;
    const airborne = !grounded && !climbing;

    if (airborne) {
      if (this.airborneSinceMs === null) this.airborneSinceMs = nowMs;
    } else {
      this.airborneSinceMs = null;
    }

    if (climbing) {
      this.mode = "elevated";
    } else if (grounded) {
      this.mode = supportIsElevated ? "elevated" : "floor";
    } else {
      const sustained = this.airborneSinceMs !== null && nowMs - this.airborneSinceMs >= AIRBORNE_MODE_DELAY_MS;
      if (sustained) this.mode = "elevated";
      // else: preserve the last grounded mode through a brief hop.
    }

    const targetOffsetX = horizontalOffsetFor(facing);
    const targetOffsetY = verticalOffsetForMode(this.mode);
    this.offsetX = damp(this.offsetX, targetOffsetX, LOOK_EASE_MS, deltaMs);
    this.offsetY = damp(this.offsetY, targetOffsetY, VERTICAL_EASE_MS, deltaMs);

    return { offsetX: this.offsetX, offsetY: this.offsetY, verticalMode: this.mode };
  }
}
