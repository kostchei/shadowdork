/**
 * Light and visibility. Darkness is a screen-space overlay; light sources
 * erase soft circles from it, and a second additive layer paints each
 * source's colour cast over the lit area. Torches burn on the engine's
 * real-time clock.
 * Characters derive a lit/dim/dark state that feeds check resolution.
 */

import Phaser from "phaser";
import type { GameContext } from "../context";
import { TILE } from "../textures";
import { lightResolutionScale, lightUpdateStride, tintLayerEnabled } from "./quality";

export const TORCH_RADIUS = TILE * 6.5;
export const CAMPFIRE_RADIUS = TILE * 4.5;
/**
 * Dark-adapted eyes: with every torch out, the party still reads outlines
 * to half a torch's reach — but it stays mechanically dark.
 */
export const SELF_GLOW_RADIUS = TORCH_RADIUS / 2;

/** Desaturated pale yellow — torchlight's cast, whatever colour the flame is. */
export const TORCH_TINT = 0xd8caa0;
/** Blue-grey "you can see, but it is definitely dark" cast. */
export const DARK_SIGHT_TINT = 0x64748e;

export type LightLevel = "lit" | "dim" | "dark";

export interface LightSourceOptions {
  /** Colour cast painted additively over the lit area. */
  tint: number;
  /** Strength of that cast (0..1). */
  tintAlpha: number;
  /**
   * Dim sources (dark-adapted eyes) only thin the darkness instead of
   * cutting through it, and never count toward lit/dim checks.
   */
  dim?: boolean;
  /** Marks a carried torch flame so snuffAll can target exactly those. */
  torch?: boolean;
}

export interface LightSource extends LightSourceOptions {
  id: string;
  radius: number;
  /** Return null when the source is gone (owner died, spell ended). */
  position: () => { x: number; y: number } | null;
}

export class LightSystem {
  private rt: Phaser.GameObjects.RenderTexture;
  private tintRt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private sources = new Map<string, LightSource>();
  private torchSources = new Map<string, string>();
  private nextId = 0;
  private ctx: GameContext;
  private scene: Phaser.Scene;
  private darknessColor: number;
  private darknessAlpha: number;
  /** Fraction of device resolution the lighting textures draw at (quality.ts). */
  private readonly texScale: number;
  /** Redraw cadence: 1 = every tick, 2 = every other tick, etc. */
  private readonly updateStride: number;
  private readonly tintEnabled: boolean;
  private tickCount = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext, darknessColor = 0x000008, darknessAlpha = 0.84) {
    this.scene = scene;
    this.ctx = ctx;
    this.darknessColor = darknessColor;
    this.darknessAlpha = darknessAlpha;
    this.texScale = lightResolutionScale();
    this.updateStride = lightUpdateStride();
    this.tintEnabled = tintLayerEnabled();
    const cam = scene.cameras.main;
    // The camera renders zoomed (high-DPI); both overlays are device-resolution
    // textures counter-scaled and offset so the zoom maps them exactly onto the
    // viewport. At zoom 1 the offset is 0 and the scale is 1. Their internal
    // resolution is further scaled by texScale (quality.ts): the display scale
    // compensates so a half-resolution texture still covers the full viewport,
    // just magnified — a soft blur trade for half the fill cost.
    const offX = (cam.width / 2) * (1 - 1 / cam.zoom);
    const offY = (cam.height / 2) * (1 - 1 / cam.zoom);
    const dispScale = 1 / (cam.zoom * this.texScale);
    // Colour casts sit under the darkness overlay: fully visible where light
    // has erased it, faintly visible through a dim source's thinned dark.
    this.tintRt = scene.add.renderTexture(offX, offY, cam.width * this.texScale, cam.height * this.texScale);
    this.tintRt
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setScale(dispScale)
      .setDepth(899)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.34)
      .setVisible(this.tintEnabled);
    this.rt = scene.add.renderTexture(offX, offY, cam.width * this.texScale, cam.height * this.texScale);
    this.rt.setOrigin(0, 0).setScrollFactor(0).setScale(dispScale).setDepth(900);
    this.brush = scene.make.image({ key: "light-radial", add: false });
    this.brush.setOrigin(0.5, 0.5);
  }

  addSource(
    radius: number,
    position: LightSource["position"],
    options: LightSourceOptions,
  ): string {
    const id = `light-${this.nextId++}`;
    this.sources.set(id, { id, radius, position, ...options });
    return id;
  }

  removeSource(id: string): void {
    if (!this.sources.delete(id)) throw new Error(`Unknown light source "${id}"`);
  }

  /** Changes ambient darkness without rebuilding the screen-space overlays. */
  setDarknessAlpha(alpha: number): void {
    this.darknessAlpha = Phaser.Math.Clamp(alpha, 0, 1);
  }

  /**
   * Light a torch that follows `carrier`. Burns in real time on the engine
   * clock; onExpire fires when it gutters out.
   */
  lightTorch(
    carrierId: string,
    position: LightSource["position"],
    onExpire: () => void,
  ): string {
    const sourceId = this.addSource(TORCH_RADIUS, position, {
      tint: TORCH_TINT,
      tintAlpha: 0.5,
      torch: true,
    });
    const timerId = `torch-${sourceId}-${carrierId}`;
    this.torchSources.set(timerId, sourceId);
    this.ctx.engine.clock.addTimer(timerId, this.ctx.engine.config.torchMs, () => {
      // A mishap may have snuffed this source before the timer ran out.
      if (this.sources.has(sourceId)) this.removeSource(sourceId);
      this.torchSources.delete(timerId);
      onExpire();
    });
    return timerId;
  }

  torchRemainingMs(timerId: string): number {
    return this.ctx.engine.clock.timerRemaining(timerId);
  }

  hasTimer(timerId: string): boolean {
    return this.ctx.engine.clock.hasTimer(timerId);
  }

  /** Extinguish every carried torch flame (wizard mishap). */
  snuffAll(): void {
    for (const timerId of [...this.torchSources.keys()]) this.snuffTorch(timerId);
  }

  snuffTorch(timerId: string): void {
    const sourceId = this.torchSources.get(timerId);
    if (!sourceId) return;
    this.sources.delete(sourceId);
    if (this.ctx.engine.clock.hasTimer(timerId)) this.ctx.engine.clock.cancelTimer(timerId);
    this.torchSources.delete(timerId);
  }

  levelAt(x: number, y: number): LightLevel {
    let best: LightLevel = "dark";
    for (const s of this.sources.values()) {
      const pos = s.position();
      if (!pos) continue;
      if (s.dim === true) continue; // dark-adapted eyes don't count as light
      const d = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
      if (d <= s.radius * 0.7) return "lit";
      if (d <= s.radius * 1.1) best = "dim";
    }
    return best;
  }

  /**
   * The closest real (non-dim) light to a point — the "sun" that casts its
   * shadow. Dark-adapted self-glow doesn't count; it lights nothing. Returns
   * null when nothing but darkness is in range.
   */
  nearestLight(x: number, y: number): { x: number; y: number; radius: number } | null {
    let best: { x: number; y: number; radius: number } | null = null;
    let bestDist = Infinity;
    for (const s of this.sources.values()) {
      if (s.dim === true) continue;
      const pos = s.position();
      if (!pos) continue;
      const d = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: pos.x, y: pos.y, radius: s.radius };
      }
    }
    return best;
  }

  update(): void {
    // Prune dead sources every tick regardless of redraw cadence, so a
    // skipped-frame stale texture never keeps a departed source's light stuck
    // on screen once the next redraw does run.
    for (const [id, s] of [...this.sources]) {
      if (!s.position()) this.sources.delete(id);
    }
    this.tickCount++;
    if (this.tickCount % this.updateStride !== 0) return;

    const cam = this.scene.cameras.main;
    // World-to-texture: the textures are drawn at (device resolution * texScale),
    // so positions and brush sizes scale by the camera zoom and texScale.
    const z = cam.zoom * this.texScale;
    const offX = (cam.width / 2) * (1 - 1 / cam.zoom);
    const offY = (cam.height / 2) * (1 - 1 / cam.zoom);
    this.rt.clear();
    if (this.tintEnabled) this.tintRt.clear();
    // Near-black preserves the mechanical danger while keeping silhouettes,
    // platforms, and foreground art readable on ordinary displays.
    this.rt.fill(this.darknessColor, this.darknessAlpha);
    for (const s of this.sources.values()) {
      const pos = s.position();
      if (!pos) continue;
      const sx = (pos.x - cam.scrollX - offX) * z;
      const sy = (pos.y - cam.scrollY - offY) * z;
      this.brush.setScale((s.radius * 2 * z) / 256);
      if (s.dim === true) {
        // Thin the darkness rather than cut it: outlines, not visibility.
        this.brush.setAlpha(0.55);
        this.rt.erase(this.brush, sx, sy);
        this.brush.setAlpha(1);
      } else {
        this.rt.erase(this.brush, sx, sy);
        // Second, tighter pass gives real flames a bright hot core.
        this.brush.setScale((s.radius * 1.15 * z) / 256);
        this.rt.erase(this.brush, sx, sy);
      }
      if (!this.tintEnabled) continue;
      this.brush.setScale((s.radius * 2 * z) / 256);
      this.brush.setTint(s.tint).setAlpha(s.tintAlpha);
      this.tintRt.draw(this.brush, sx, sy);
      this.brush.setTint(0xffffff).setAlpha(1);
    }
  }
}
