/**
 * Directional cast shadows. Every registered object drops a soft ground blob.
 *
 * "deep" objects keep a fixed shadow — they read as recessed and self-shadowed,
 * so their shadow does not swing with the light. "cast" objects lean and stretch
 * away from the nearest light source (the torch, a campfire, a brazier): tight and
 * dark directly underfoot, smearing longer and fainter toward the edge of the
 * light. The lean is horizontal, matching the side-on floor plane.
 *
 * Mobile entities (characters, monsters) own their own shadow sprite and project
 * it directly via projectShadow; this system owns the shadows of un-owned scene
 * objects — props, pickups, markers, NPCs.
 */

import Phaser from "phaser";
import { TILE } from "../textures";
import type { LightSystem } from "./light";

/** How far a cast shadow slides toward the far side at the edge of the light. */
const MAX_LEAN_PX = TILE * 1.5;
/** Horizontal scale a cast shadow reaches as it stretches to the edge. */
const MAX_STRETCH = 2.0;

export type ShadowKind = "deep" | "cast";

export interface LeaningShadowOptions {
  /** The object's footprint width at rest (1 = the base blob). */
  baseScaleX?: number;
  /** Vertical squash of the blob. */
  baseScaleY?: number;
  /** Opacity directly underfoot, before the distance fade. */
  baseAlpha?: number;
}

/**
 * Position a shadow image as a leaning ground blob relative to `light`. With no
 * light in range it settles into a faint static pool underfoot (it is dark there
 * anyway, so the shadow all but disappears).
 */
export function projectShadow(
  shadow: Phaser.GameObjects.Image,
  footX: number,
  footY: number,
  light: { x: number; y: number; radius: number } | null,
  options: LeaningShadowOptions = {},
): void {
  const baseScaleX = options.baseScaleX ?? 1;
  const baseScaleY = options.baseScaleY ?? 1;
  const baseAlpha = options.baseAlpha ?? 0.6;
  if (!light) {
    shadow.setPosition(footX, footY).setScale(baseScaleX, baseScaleY).setAlpha(baseAlpha * 0.5);
    return;
  }
  const dx = footX - light.x; // + => object sits right of the light => shadow leans right
  const t = Phaser.Math.Clamp(Math.abs(dx) / light.radius, 0, 1); // 0 underfoot, 1 at the edge
  const dir = dx >= 0 ? 1 : -1;
  const lean = dir * MAX_LEAN_PX * t;
  const stretchX = baseScaleX * (1 + (MAX_STRETCH - 1) * t);
  const alpha = baseAlpha * (1 - 0.55 * t); // longer shadows read fainter
  shadow.setPosition(footX + lean * 0.5, footY).setScale(stretchX, baseScaleY).setAlpha(alpha);
}

export interface ShadowRegistration {
  /** Report the caster's position, or null once it is gone (pruned + destroyed). */
  position: () => { x: number; y: number } | null;
  kind: ShadowKind;
  /** Pixels below the reported position where the shadow rests on the floor. */
  footOffset?: number;
  depth?: number;
  options?: LeaningShadowOptions;
}

interface Caster {
  position: () => { x: number; y: number } | null;
  footOffset: number;
  kind: ShadowKind;
  shadow: Phaser.GameObjects.Image;
  options: LeaningShadowOptions;
}

export class ShadowSystem {
  private casters: Caster[] = [];
  private scene: Phaser.Scene;
  private light: LightSystem;

  constructor(scene: Phaser.Scene, light: LightSystem) {
    this.scene = scene;
    this.light = light;
  }

  register(reg: ShadowRegistration): void {
    const shadow = this.scene.add
      .image(0, 0, "entity-shadow")
      .setDepth(reg.depth ?? 4)
      .setVisible(false);
    this.casters.push({
      position: reg.position,
      footOffset: reg.footOffset ?? 0,
      kind: reg.kind,
      shadow,
      options: reg.options ?? {},
    });
  }

  update(): void {
    const survivors: Caster[] = [];
    for (const c of this.casters) {
      const pos = c.position();
      if (!pos) {
        c.shadow.destroy();
        continue;
      }
      const footX = pos.x;
      const footY = pos.y + c.footOffset;
      if (c.kind === "deep") {
        const sx = c.options.baseScaleX ?? 1;
        const sy = c.options.baseScaleY ?? 1;
        const a = c.options.baseAlpha ?? 0.6;
        c.shadow.setPosition(footX, footY).setScale(sx, sy).setAlpha(a);
      } else {
        projectShadow(c.shadow, footX, footY, this.light.nearestLight(footX, footY), c.options);
      }
      c.shadow.setVisible(true);
      survivors.push(c);
    }
    this.casters = survivors;
  }
}
