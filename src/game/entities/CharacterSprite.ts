/**
 * A party member: Arcade sprite bound to an engine Character.
 * Movement, facing, swing cooldowns, torch hand, and class verbs live here;
 * every rules question is answered by the engine.
 */

import Phaser from "phaser";
import type { Character } from "../../engine";
import { classDef, type ClassDef } from "../../data";
import type { GameContext } from "../context";
import type { MonsterSprite } from "./MonsterSprite";
import { crackleBed, type AmbienceHandle } from "../audio/ambience";
import { footstep, landThud } from "../audio/sfx";
import { floatText } from "../systems/combat";
import { flameFollowing } from "../fx/vfx";
import type { LightSystem } from "../systems/light";
import { DARK_SIGHT_TINT, SELF_GLOW_RADIUS } from "../systems/light";
import { ensureCharacterAppearance, TILE } from "../textures";
import { appearanceForCharacter, characterAppearanceKey } from "./appearance";

/** Falls up to this many tiles are free; beyond, 1d6 per 3 tiles (RAW ~10 ft). */
const SAFE_FALL_TILES = 4;
const TILES_PER_FALL_DIE = 3;

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
  /** Kept in sync by PartyManager — the leader's footsteps sound loudest. */
  isLeader = false;

  /** Last monster that swung at this character — fuels retaliation. */
  lastAttackedBy: MonsterSprite | null = null;
  lastAttackedAt = 0;

  /** Active torch timer id, if this character is carrying a lit torch. */
  torchTimerId: string | null = null;
  /** Selected spell index into character.knownSpells (casters). */
  spellIndex = 0;

  private lastGroundedAt = 0;
  private shadow: Phaser.GameObjects.Image;
  private torchEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private torchCrackle: AmbienceHandle | null = null;
  /** Highest point (lowest y) reached while airborne — falls measure from here. */
  private fallPeakY: number | null = null;
  /** Horizontal distance walked since the last footstep sound. */
  private stepAccum = 0;
  private prevStepX = 0;
  private appearanceKey = "";

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
    this.syncAppearance();

    light.addSource(SELF_GLOW_RADIUS, () => (this.character.dead ? null : { x: this.x, y: this.y }), {
      tint: DARK_SIGHT_TINT,
      tintAlpha: 0.45,
      dim: true,
    });
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
    const weapon = this.character.weapon;
    if (!weapon.damage) throw new Error(`${weapon.name} has no damage dice`);
    return weapon.damage;
  }

  /** How far this character's melee swing lands, in pixels. */
  get weaponReachPx(): number {
    const weapon = this.character.weapon;
    if (weapon.reachTiles === undefined) throw new Error(`${weapon.name} has no reach`);
    return weapon.reachTiles * TILE;
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
    this.trackFalling();
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
      this.syncAppearance();
      const isMoving = Math.abs(this.body?.velocity.x ?? 0) > 10;
      if (isMoving && this.grounded) {
        this.play(`${this.appearanceKey}-walk`, true);
        // Boots on stone: one grit-burst per stride, quieter for followers.
        this.stepAccum += Math.abs(this.x - this.prevStepX);
        if (this.stepAccum > TILE * 0.9) {
          this.stepAccum = 0;
          footstep({ gain: this.isLeader ? 1 : 0.3 });
        }
      } else {
        this.stepAccum = 0;
        this.play(`${this.appearanceKey}-idle`, true);
      }
      this.prevStepX = this.x;
    }

    if (this.torchLit) {
      if (!this.torchEmitter) {
        this.torchEmitter = flameFollowing(this.scene, this, this.facing * 6, -4);
        this.torchCrackle = crackleBed({ level: 0.35, popMeanMs: 1300, rumbleLevel: 0.06 });
      }
      // The torch hand leads: keep the flame on the facing side.
      this.torchEmitter.followOffset.x = this.facing * 6;
    } else if (this.torchEmitter) {
      this.torchEmitter.destroy();
      this.torchEmitter = null;
      this.torchCrackle!.destroy();
      this.torchCrackle = null;
    }
  }

  private syncAppearance(): void {
    const appearance = appearanceForCharacter(this.character);
    const nextKey = characterAppearanceKey(appearance);
    if (nextKey === this.appearanceKey) return;
    this.appearanceKey = ensureCharacterAppearance(this.scene, appearance);
    this.setTexture(`${this.appearanceKey}-idle-0`);
  }

  /** RAW falling damage: 1d6 per ~10 ft. Short hops are free; long drops bite. */
  private trackFalling(): void {
    if (this.character.dead || this.climbing) {
      this.fallPeakY = null;
      return;
    }
    if (!this.grounded) {
      if (this.fallPeakY === null || this.y < this.fallPeakY) this.fallPeakY = this.y;
      return;
    }
    if (this.fallPeakY === null) return;
    const tilesFallen = (this.y - this.fallPeakY) / TILE;
    this.fallPeakY = null;
    if (tilesFallen <= SAFE_FALL_TILES) return;
    const diceCount = Math.max(1, Math.floor((tilesFallen - SAFE_FALL_TILES) / TILES_PER_FALL_DIE) + 1);
    const dmg = this.ctx.engine.dice.roll(`${diceCount}d6`);
    landThud();
    floatText(this.scene, this.x, this.y - 16, `-${dmg} fall`, "#ff8050");
    const wentDown = this.ctx.engine.damageCharacter(this.character, dmg);
    if (wentDown) {
      this.ctx.say(`${this.character.name} hits the stone hard and goes down!`, "#ff5050");
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
    // Scene shutdown destroys sprites without ticking — release the audio too.
    if (this.torchCrackle) {
      this.torchCrackle.destroy();
      this.torchCrackle = null;
    }
    super.destroy(fromScene);
  }
}
