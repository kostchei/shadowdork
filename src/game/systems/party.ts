/**
 * Party management: one leader under direct control, followers on simple AI
 * (follow / hold, auto-fighting when monsters close in). Swap leader instantly.
 */

import Phaser from "phaser";
import type { GameContext } from "../context";
import type { CharacterSprite } from "../entities/CharacterSprite";

const FOLLOW_GAP_PX = 56;
const TELEPORT_CATCHUP_PX = 700;

export class PartyManager {
  readonly members: CharacterSprite[] = [];
  private leaderIdx = 0;
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  get leader(): CharacterSprite {
    const l = this.members[this.leaderIdx];
    if (!l) throw new Error("Party has no members");
    return l;
  }

  get size(): number {
    return this.members.length;
  }

  get leaderIndex(): number {
    return this.leaderIdx;
  }

  add(member: CharacterSprite): void {
    this.members.push(member);
  }

  /** Any member who can still act (not dead, not down). */
  aliveMembers(): CharacterSprite[] {
    return this.members.filter((m) => m.alive);
  }

  /** Party wipe = nobody alive AND nobody dying (dying can still be lost). */
  isWiped(): boolean {
    return this.members.every((m) => m.character.dead);
  }

  allDownOrDead(): boolean {
    return this.members.every((m) => !m.alive);
  }

  /** Swap to a specific member (1-based hotkey index). Throws on bad index. */
  selectLeader(index: number): boolean {
    const m = this.members[index];
    if (!m) throw new Error(`No party member at index ${index}`);
    if (!m.alive) return false;
    this.leaderIdx = index;
    this.ctx.say(`You take control of ${m.character.name} the ${m.cls.displayName}.`);
    return true;
  }

  cycleLeader(): boolean {
    for (let step = 1; step <= this.members.length; step++) {
      const idx = (this.leaderIdx + step) % this.members.length;
      if (this.members[idx]!.alive) {
        this.leaderIdx = idx;
        this.ctx.say(
          `You take control of ${this.members[idx]!.character.name} the ${this.members[idx]!.cls.displayName}.`,
        );
        return true;
      }
    }
    return false;
  }

  /** If the leader goes down, control passes to the next alive member. */
  ensureLeaderAlive(): void {
    if (!this.leader.alive) this.cycleLeader();
  }

  updateFollowers(now: number): void {
    const leader = this.leader;
    for (const m of this.members) m.isLeader = m === leader;
    for (const m of this.members) {
      if (m === leader || !m.alive) continue;
      m.noteGrounded(now);
      if (m.mode === "hold") {
        m.moveHorizontal(0, 0);
        continue;
      }
      const dx = leader.x - m.x;
      const body = m.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(dx) > TELEPORT_CATCHUP_PX) {
        // Hopelessly separated — catch up (Lost Vikings mercy rule).
        m.setPosition(leader.x, leader.y - 8);
        m.setVelocity(0, 0);
        continue;
      }
      if (Math.abs(dx) > FOLLOW_GAP_PX) {
        const dir: -1 | 1 = dx > 0 ? 1 : -1;
        m.moveHorizontal(dir, 0);
        const wallAhead = dir === 1 ? body.blocked.right : body.blocked.left;
        if ((wallAhead || leader.y < m.y - 40) && body.blocked.down) {
          m.tryJump(now);
        }
      } else {
        m.moveHorizontal(0, 0);
      }
    }
  }
}
