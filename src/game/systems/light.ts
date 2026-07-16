/**
 * Light and visibility. Darkness is a screen-space overlay; light sources
 * erase soft circles from it. Torches burn on the engine's real-time clock.
 * Characters derive a lit/dim/dark state that feeds check resolution.
 */

import Phaser from "phaser";
import type { GameContext } from "../context";
import { TILE } from "../textures";

export const TORCH_RADIUS = TILE * 5;
export const CAMPFIRE_RADIUS = TILE * 4;
/** Faint self-glow so the player can always find their characters. */
export const SELF_GLOW_RADIUS = TILE * 1.2;

export type LightLevel = "lit" | "dim" | "dark";

export interface LightSource {
  id: string;
  radius: number;
  /** Return null when the source is gone (owner died, spell ended). */
  position: () => { x: number; y: number } | null;
}

export class LightSystem {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private sources = new Map<string, LightSource>();
  private nextId = 0;
  private ctx: GameContext;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    const cam = scene.cameras.main;
    this.rt = scene.add.renderTexture(0, 0, cam.width, cam.height);
    this.rt.setOrigin(0, 0).setScrollFactor(0).setDepth(900);
    this.brush = scene.make.image({ key: "light-radial", add: false });
    this.brush.setOrigin(0.5, 0.5);
  }

  addSource(radius: number, position: LightSource["position"]): string {
    const id = `light-${this.nextId++}`;
    this.sources.set(id, { id, radius, position });
    return id;
  }

  removeSource(id: string): void {
    if (!this.sources.delete(id)) throw new Error(`Unknown light source "${id}"`);
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
    const sourceId = this.addSource(TORCH_RADIUS, position);
    const timerId = `torch-${sourceId}-${carrierId}`;
    this.ctx.engine.clock.addTimer(timerId, this.ctx.engine.config.torchMs, () => {
      this.removeSource(sourceId);
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

  /** Extinguish every active torch timer + source (wizard mishap). */
  snuffAll(): void {
    for (const id of [...this.sources.keys()]) {
      if (id.startsWith("light-")) this.sources.delete(id);
    }
  }

  levelAt(x: number, y: number): LightLevel {
    let best: LightLevel = "dark";
    for (const s of this.sources.values()) {
      const pos = s.position();
      if (!pos) continue;
      if (s.radius <= SELF_GLOW_RADIUS) continue; // self-glow doesn't count as light
      const d = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
      if (d <= s.radius * 0.7) return "lit";
      if (d <= s.radius * 1.1) best = "dim";
    }
    return best;
  }

  update(): void {
    const cam = this.scene.cameras.main;
    this.rt.clear();
    this.rt.fill(0x000008, 0.985);
    for (const [id, s] of [...this.sources.entries()]) {
      const pos = s.position();
      if (!pos) {
        this.sources.delete(id);
        continue;
      }
      this.brush.setScale((s.radius * 2) / 256);
      this.rt.erase(this.brush, pos.x - cam.scrollX, pos.y - cam.scrollY);
    }
  }
}
