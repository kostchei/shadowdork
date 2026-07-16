/** Shared particle effects. One place for every burst and flame in the game. */

import Phaser from "phaser";

const BLOOD_COLORS = [0xff3333, 0xcc0000, 0x880000];
const BONE_COLORS = [0xdeded7, 0xc2c2ba, 0x9e9e94];
const GOLD_COLORS = [0xffd700, 0xffea70, 0xffffff];
const JEWEL_COLORS = [0x69e4df, 0xc5ffff, 0xffffff];

/** Impact splatter on a hit — red for the living, bone-grey for undead. */
export function hitBurst(scene: Phaser.Scene, x: number, y: number, undead: boolean): void {
  const p = scene.add
    .particles(x, y - 8, "pixel", {
      color: undead ? BONE_COLORS : BLOOD_COLORS,
      speed: { min: 40, max: 120 },
      scale: { start: 2, end: 0 },
      lifespan: { min: 200, max: 400 },
      duration: 150,
      maxParticles: 15,
      blendMode: "NORMAL",
    })
    .setDepth(25);
  scene.time.delayedCall(500, () => p.destroy());
}

/** Pickup sparkle — jewel-toned for gems/idols/crowns, gold for the rest. */
export function sparkleBurst(scene: Phaser.Scene, x: number, y: number, jewel: boolean): void {
  const p = scene.add
    .particles(x, y, "pixel", {
      color: jewel ? JEWEL_COLORS : GOLD_COLORS,
      speed: { min: 30, max: 90 },
      scale: { start: 1.8, end: 0 },
      lifespan: { min: 250, max: 550 },
      blendMode: "ADD",
    })
    .setDepth(25);
  p.explode(12);
  scene.time.delayedCall(600, () => p.destroy());
}

export type FlameSize = "torch" | "brazier" | "campfire";

const FLAME_CONFIGS: Record<
  FlameSize,
  Phaser.Types.GameObjects.Particles.ParticleEmitterConfig
> = {
  torch: {
    color: [0xff7722, 0xffaa44, 0xffe077],
    speedY: { min: -25, max: -5 },
    speedX: { min: -15, max: 15 },
    scale: { start: 1.2, end: 0 },
    lifespan: { min: 300, max: 700 },
    frequency: 100,
    blendMode: "ADD",
  },
  brazier: {
    color: [0xff4500, 0xff8c00, 0xffd700],
    speedY: { min: -30, max: -10 },
    speedX: { min: -6, max: 6 },
    scale: { start: 1.2, end: 0 },
    lifespan: { min: 400, max: 900 },
    frequency: 180,
    blendMode: "ADD",
  },
  campfire: {
    color: [0xffa500, 0xff4500, 0xffd700],
    speedY: { min: -40, max: -15 },
    speedX: { min: -10, max: 10 },
    scale: { start: 1.5, end: 0 },
    lifespan: { min: 600, max: 1200 },
    frequency: 120,
    blendMode: "ADD",
  },
};

/** A persistent flame at a fixed point (braziers, campfires). Caller owns cleanup. */
export function flameAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: FlameSize,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(x, y, "pixel", FLAME_CONFIGS[size]).setDepth(4);
}

/** A flame that follows a sprite (a carried torch). Caller owns cleanup. */
export function flameFollowing(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite,
  offsetX: number,
  offsetY: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const p = scene.add.particles(0, 0, "pixel", FLAME_CONFIGS.torch).setDepth(12);
  p.startFollow(target, offsetX, offsetY);
  return p;
}
