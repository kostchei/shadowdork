/** A monster: Arcade sprite carrying its stat block, rolled HP, and simple AI state. */

import Phaser from "phaser";
import type { Dice, MonsterDef } from "../../engine";

export type MonsterAiState = "patrol" | "aggro" | "fleeing";

const MONSTER_SPEED: Record<string, number> = {
  goblin: 90,
  skeleton: 70,
  "giant-rat": 110,
  "gloom-ogre": 60,
};

export const MONSTER_ATTACK_COOLDOWN_MS = 1500;
export const AGGRO_RANGE = 5 * 32;

export class MonsterSprite extends Phaser.Physics.Arcade.Sprite {
  readonly def: MonsterDef;
  readonly groupId: string;
  hp: number;
  aiState: MonsterAiState = "patrol";
  private asleepUntil = 0;
  private alertedUntil = 0;
  attackCooldown = 0;
  patrolDir: 1 | -1 = 1;
  private patrolOriginX: number;
  private shadow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: MonsterDef,
    groupId: string,
    dice: Dice,
  ) {
    super(scene, x, y, `monster-${def.id}`);
    this.def = def;
    this.groupId = groupId;
    this.hp = Math.max(1, dice.roll(def.hitDice));
    this.patrolOriginX = x;
    this.shadow = scene.add.image(x, y + 14, "entity-shadow").setDepth(7).setAlpha(0.62);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.setCollideWorldBounds(true);
  }

  get speed(): number {
    const s = MONSTER_SPEED[this.def.id];
    if (s === undefined) throw new Error(`No speed for monster ${this.def.id}`);
    return s;
  }

  get aliveInFight(): boolean {
    return this.active && this.aiState !== "fleeing";
  }

  get isSleeping(): boolean {
    return this.scene.time.now < this.asleepUntil;
  }

  updateAi(delta: number, target: { x: number; y: number } | null): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.42);
    this.shadow.setScale(this.def.id === "gloom-ogre" ? 1.45 : 0.8, 1);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.isSleeping) {
      this.setVelocityX(0);
      this.setTint(0x8a91c8);
      this.stop();
      return;
    }
    if (this.asleepUntil !== 0) {
      this.asleepUntil = 0;
      this.clearTint();
    }

    if (this.aiState === "fleeing") {
      // Run away from the target and despawn off-screen.
      const dir = target && target.x > this.x ? -1 : 1;
      this.setVelocityX(dir * this.speed * 1.4);
      this.setFlipX(dir === -1);
      this.play(`monster-${this.def.id}-walk`, true);
      return;
    }

    if (target) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (this.aiState === "patrol" && dist <= AGGRO_RANGE) this.aiState = "aggro";
      if (
        this.aiState === "aggro" &&
        dist > AGGRO_RANGE * 2 &&
        this.scene.time.now >= this.alertedUntil
      ) this.aiState = "patrol";
    } else if (this.aiState === "aggro") {
      this.aiState = "patrol";
    }

    if (this.aiState === "aggro" && target) {
      const dir = target.x > this.x + 6 ? 1 : target.x < this.x - 6 ? -1 : 0;
      this.setVelocityX(dir * this.speed);
      if (dir !== 0) this.setFlipX(dir === -1);
      // Hop over obstacles.
      if (dir !== 0 && (body.blocked.left || body.blocked.right) && body.blocked.down) {
        this.setVelocityY(-320);
      }
    } else {
      // Patrol a short beat around the spawn point.
      if (this.x > this.patrolOriginX + 48) this.patrolDir = -1;
      else if (this.x < this.patrolOriginX - 48) this.patrolDir = 1;
      if (body.blocked.left) this.patrolDir = 1;
      if (body.blocked.right) this.patrolDir = -1;
      this.setVelocityX(this.patrolDir * this.speed * 0.4);
      this.setFlipX(this.patrolDir === -1);
    }

    const isMoving = Math.abs(body.velocity.x) > 10;
    if (isMoving) {
      this.play(`monster-${this.def.id}-walk`, true);
    } else {
      this.play(`monster-${this.def.id}-idle`, true);
    }
  }

  flee(): void {
    this.aiState = "fleeing";
    this.setTint(0x9999cc);
  }

  sleep(durationMs: number): void {
    this.asleepUntil = Math.max(this.asleepUntil, this.scene.time.now + durationMs);
    this.aiState = "patrol";
    this.setVelocity(0, 0);
  }

  wake(): void {
    this.asleepUntil = 0;
    if (this.aiState !== "fleeing") this.aiState = "aggro";
    this.clearTint();
  }

  /** Noise keeps a monster investigating even while the party is beyond sight range. */
  alert(durationMs = 6000): void {
    if (this.aiState === "fleeing") return;
    this.alertedUntil = Math.max(this.alertedUntil, this.scene.time.now + durationMs);
    this.aiState = "aggro";
  }

  override destroy(fromScene?: boolean): void {
    if (this.shadow.active) this.shadow.destroy();
    super.destroy(fromScene);
  }
}
