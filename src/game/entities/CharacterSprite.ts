/**
 * A party member: Arcade sprite bound to an engine Character.
 * Movement, facing, swing cooldowns, torch hand, and class verbs live here;
 * every rules question is answered by the engine.
 */

import Phaser from "phaser";
import type { Character } from "../../engine";
import { classDef, item, type ClassDef } from "../../data";
import type { GameContext } from "../context";
import type { LightSystem } from "../systems/light";
import { SELF_GLOW_RADIUS } from "../systems/light";

const CLASS_SPEED: Record<string, number> = {
  fighter: 160,
  thief: 200,
  priest: 150,
  wizard: 150,
};

export const JUMP_VELOCITY = -450;
export const COYOTE_MS = 110;
export const SWING_COOLDOWN_MS = 1000;

export type FollowerMode = "follow" | "hold";

export class CharacterSprite extends Phaser.Physics.Arcade.Sprite {
  readonly character: Character;
  readonly cls: ClassDef;
  private ctx: GameContext;

  facing: 1 | -1 = 1;
  swingCooldown = 0;
  mode: FollowerMode = "follow";
  climbing = false;

  /** Active torch timer id, if this character is carrying a lit torch. */
  torchTimerId: string | null = null;
  /** Selected spell index into character.knownSpells (casters). */
  spellIndex = 0;

  private lastGroundedAt = 0;
  private shadow: Phaser.GameObjects.Image;
  private torchEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(
    scene: Phaser.Scene,
    ctx: GameContext,
    x: number,
    y: number,
    character: Character,
    light: LightSystem,
  ) {
    super(scene, x, y, `char-${character.className}`);
    this.ctx = ctx;
    this.character = character;
    this.cls = classDef(character.className);
    this.shadow = scene.add.image(x, y + 15, "entity-shadow").setDepth(8).setAlpha(0.72);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setSize(20, 30).setDepth(10);
    this.setCollideWorldBounds(true);

    light.addSource(SELF_GLOW_RADIUS, () => (this.character.dead ? null : { x: this.x, y: this.y }));
  }

  get alive(): boolean {
    return !this.character.dead && !this.character.dying;
  }

  get speed(): number {
    const s = CLASS_SPEED[this.character.className];
    if (s === undefined) throw new Error(`No speed for class ${this.character.className}`);
    return s;
  }

  get weaponDamage(): string {
    const weapon = item(this.cls.weaponId);
    if (!weapon.damage) throw new Error(`${weapon.name} has no damage dice`);
    return weapon.damage;
  }

  get torchLit(): boolean {
    return this.torchTimerId !== null && this.ctx.engine.clock.hasTimer(this.torchTimerId);
  }

  get grounded(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  moveHorizontal(dir: -1 | 0 | 1, delta: number): void {
    void delta;
    if (!this.alive) {
      this.setVelocityX(0);
      return;
    }
    this.setVelocityX(dir * this.speed);
    if (dir !== 0) {
      this.facing = dir;
      this.setFlipX(dir === -1);
    }
  }

  tryJump(now: number): boolean {
    if (!this.alive || this.climbing) return false;
    if (this.grounded) this.lastGroundedAt = now;
    if (now - this.lastGroundedAt <= COYOTE_MS) {
      this.setVelocityY(JUMP_VELOCITY);
      this.lastGroundedAt = -Infinity;
      return true;
    }
    return false;
  }

  noteGrounded(now: number): void {
    if (this.grounded) this.lastGroundedAt = now;
  }

  tick(delta: number): void {
    this.swingCooldown = Math.max(0, this.swingCooldown - delta);
    this.shadow.setPosition(this.x, this.y + 15).setVisible(!this.character.dead);
    const speedRatio = Math.min(1, Math.abs(this.body?.velocity.x ?? 0) / this.speed);
    this.shadow.setScale(1 - speedRatio * 0.12, 1);
    if (this.character.dying) {
      this.setVelocityX(0);
      this.setTint(0x884444);
      this.setAngle(90);
      this.anims.stop();
    } else if (this.character.dead) {
      this.setVisible(false);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.anims.stop();
    } else {
      this.clearTint();
      this.setAngle(0);
      const isMoving = Math.abs(this.body?.velocity.x ?? 0) > 10;
      if (isMoving && this.grounded) {
        this.play(`char-${this.character.className}-walk`, true);
      } else {
        this.play(`char-${this.character.className}-idle`, true);
      }
    }

    if (this.torchLit) {
      if (!this.torchEmitter) {
        this.torchEmitter = this.scene.add.particles(0, 0, "pixel", {
          color: [0xff7722, 0xffaa44, 0xffe077],
          speedY: { min: -25, max: -5 },
          speedX: { min: -15, max: 15 },
          scale: { start: 1.2, end: 0 },
          lifespan: { min: 300, max: 700 },
          frequency: 100,
          blendMode: "ADD",
        }).setDepth(12);
        this.torchEmitter.startFollow(this, 6, -4);
      }
    } else if (this.torchEmitter) {
      this.torchEmitter.destroy();
      this.torchEmitter = null;
    }
  }

  canSwing(): boolean {
    return this.alive && this.swingCooldown === 0;
  }

  startSwingCooldown(): void {
    this.swingCooldown = SWING_COOLDOWN_MS;
  }

  /** Thief-only: true while overlapping a climbable tile. Set by the scene. */
  touchingClimbable = false;

  get canClimb(): boolean {
    return this.character.className === "thief" && this.touchingClimbable;
  }

  override destroy(fromScene?: boolean): void {
    if (this.shadow.active) this.shadow.destroy();
    if (this.torchEmitter) this.torchEmitter.destroy();
    super.destroy(fromScene);
  }
}
