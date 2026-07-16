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
  attackCooldown = 0;
  patrolDir: 1 | -1 = 1;
  private patrolOriginX: number;

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

  updateAi(delta: number, target: { x: number; y: number } | null): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.aiState === "fleeing") {
      // Run away from the target and despawn off-screen.
      const dir = target && target.x > this.x ? -1 : 1;
      this.setVelocityX(dir * this.speed * 1.4);
      this.setFlipX(dir === -1);
      return;
    }

    if (target) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (this.aiState === "patrol" && dist <= AGGRO_RANGE) this.aiState = "aggro";
      if (this.aiState === "aggro" && dist > AGGRO_RANGE * 2) this.aiState = "patrol";
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
  }

  flee(): void {
    this.aiState = "fleeing";
    this.setTint(0x9999cc);
  }
}
