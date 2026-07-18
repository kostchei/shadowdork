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
export const JUMP_BUFFER_MS = 120;
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
  bracing = false;
  /** Kept in sync by PartyManager — the leader's footsteps sound loudest. */
  isLeader = false;
  /** AI destination override (rescues). While set, follower AI walks here instead of trailing the leader. */
  aiMoveTarget: { x: number; y: number } | null = null;

  /** Last monster that swung at this character — fuels retaliation. */
  lastAttackedBy: MonsterSprite | null = null;
  lastAttackedAt = 0;

  /** Active torch timer id, if this character is carrying a lit torch. */
  torchTimerId: string | null = null;
  /** Selected spell index into character.knownSpells (casters). */
  spellIndex = 0;

  private lastGroundedAt = 0;
  private lastJumpPressedAt = -Infinity;
  ledgeGrabState: { side: "left" | "right"; ledgeY: number } | null = null;
  lastLedgeGrabReleaseAt = -Infinity;
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
    } else if (this.grounded) {
      // Sticky edges: if standing still, prevent slipping off platform edges
      const dungeon = this.scene as any;
      if (dungeon && dungeon.activeDungeon && dungeon.activeDungeon.grid) {
        const grid = dungeon.activeDungeon.grid;
        const tileY = Math.floor((this.y + 16) / TILE);
        if (tileY >= 0 && tileY < grid.length) {
          const row = grid[tileY]!;
          const getTile = (px: number) => {
            const tx = Math.floor(px / TILE);
            return (tx >= 0 && tx < row.length) ? row[tx] : undefined;
          };
          const isSolid = (ch: string | undefined) => ch === "#" || ch === "%" || ch === "=";

          const centerSolid = isSolid(getTile(this.x));
          const leftSolid = isSolid(getTile(this.x - 10));
          const rightSolid = isSolid(getTile(this.x + 10));

          if (!centerSolid) {
            if (leftSolid && !rightSolid) {
              const leftTileX = Math.floor((this.x - 10) / TILE);
              const snapX = (leftTileX + 1) * TILE - 10;
              if (this.x > snapX) {
                this.x = snapX;
                this.setVelocityX(0);
              }
            } else if (rightSolid && !leftSolid) {
              const rightTileX = Math.floor((this.x + 10) / TILE);
              const snapX = rightTileX * TILE + 10;
              if (this.x < snapX) {
                this.x = snapX;
                this.setVelocityX(0);
              }
            }
          }
        }
      }
    }
  }

  tryJump(now: number): boolean {
    if (!this.alive || this.climbing) return false;
    if (this.grounded) this.lastGroundedAt = now;
    if (now - this.lastGroundedAt <= COYOTE_MS) {
      this.setVelocityY(JUMP_VELOCITY);
      this.lastGroundedAt = -Infinity;
      this.lastJumpPressedAt = -Infinity;
      return true;
    } else {
      this.lastJumpPressedAt = now;
    }
    return false;
  }

  noteGrounded(now: number): void {
    if (this.grounded) {
      this.lastGroundedAt = now;
      if (now - this.lastJumpPressedAt <= JUMP_BUFFER_MS) {
        this.setVelocityY(JUMP_VELOCITY);
        this.lastJumpPressedAt = -Infinity;
        this.lastGroundedAt = -Infinity;
      }
    }
  }

  tick(delta: number): void {
    this.swingCooldown = Math.max(0, this.swingCooldown - delta);
    if (this.ledgeGrabState) {
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
      this.play(`${this.appearanceKey}-idle`, true);
      this.shadow.setVisible(false);
      return;
    }
    if (this.bracing) {
      this.setVelocityX(0);
      this.play(`${this.appearanceKey}-brace`, true);
      this.shadow.setPosition(this.x, this.y + 15).setVisible(true);
      return;
    }
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
      
      // Ledge grab detection when falling
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body.velocity.y > 0 && !this.ledgeGrabState) {
        const now = this.scene.time.now;
        if (now - this.lastLedgeGrabReleaseAt > 500) {
          const side = body.blocked.left ? "left" : body.blocked.right ? "right" : null;
          if (side) {
            const dx = side === "left" ? -11 : 11;
            const tileX = Math.floor((this.x + dx) / TILE);
            const tileYChest = Math.floor((this.y + 2) / TILE);
            const tileYHead = Math.floor((this.y - 14) / TILE);
            const dungeon = this.scene as any;
            if (dungeon && dungeon.activeDungeon && dungeon.activeDungeon.grid) {
              const grid = dungeon.activeDungeon.grid;
              const getCell = (tx: number, ty: number) => {
                if (ty < 0 || ty >= grid.length) return undefined;
                const row = grid[ty]!;
                return (tx >= 0 && tx < row.length) ? row[tx] : undefined;
              };
              const isSolid = (ch: string | undefined) => ch === "#" || ch === "%" || ch === "=";
              const chestSolid = isSolid(getCell(tileX, tileYChest));
              const headSolid = isSolid(getCell(tileX, tileYHead));
              if (chestSolid && !headSolid) {
                const ledgeY = tileYChest * TILE;
                if (body.top >= ledgeY - 6 && body.top <= ledgeY + 14) {
                  this.ledgeGrabState = { side, ledgeY };
                  this.setVelocity(0, 0);
                  body.allowGravity = false;
                  this.y = ledgeY + 15;
                  this.x = side === "left" ? (tileX + 1) * TILE + 10 : tileX * TILE - 10;
                  this.fallPeakY = null; // Reset fall distance for damage
                }
              }
            }
          }
        }
      }
      return;
    }
    if (this.fallPeakY === null) return;
    const tilesFallen = (this.y - this.fallPeakY) / TILE;
    this.fallPeakY = null;
    if (tilesFallen <= SAFE_FALL_TILES) return;
    if (this.character.effects.some((effect) => effect.id === "spell-feather-fall")) {
      this.character.removeEffect("spell-feather-fall");
      landThud();
      floatText(this.scene, this.x, this.y - 16, "FEATHER FALL", "#a7d8ff");
      this.ctx.say(`${this.character.name} drifts safely to the ground.`, "#a7d8ff");
      return;
    }
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

  /** True while overlapping a ladder, rope, or vine. Set by the scene. */
  touchingClimbable = false;

  get canClimb(): boolean {
    return this.touchingClimbable;
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
