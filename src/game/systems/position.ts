/**
 * Zone-based distance, mapped to pixels. Shadowdark zones, not a grid:
 * close ~5ft, near ~30ft, far = line of sight.
 */

import Phaser from "phaser";
import { TILE } from "../textures";

export const CLOSE_PX = TILE * 1.6;
export const NEAR_PX = TILE * 6;
export const FAR_PX = TILE * 16;

export type Zone = "close" | "near" | "far" | "beyond";

export function zoneBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Zone {
  const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  if (d <= CLOSE_PX) return "close";
  if (d <= NEAR_PX) return "near";
  if (d <= FAR_PX) return "far";
  return "beyond";
}
