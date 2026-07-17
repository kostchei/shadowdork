/**
 * Real-time combat over dice-authoritative resolution. Every swing calls the
 * engine; this file turns results into damage, floating dice, morale, and
 * death timers. Positional context makes adv/dis legible through movement.
 */

import Phaser from "phaser";
import { monsterAttackRoll, moraleCheck, type CheckResult } from "../../engine";
import { item } from "../../data";
import type { GameContext } from "../context";
import { RENDER_SCALE } from "../display";
import type { CharacterSprite } from "../entities/CharacterSprite";
import type { MonsterSprite } from "../entities/MonsterSprite";
import { hitBurst } from "../fx/vfx";
import type { LightSystem } from "./light";

export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 14,
): void {
  // Slight jitter keeps stacked combat numbers legible (visual only, not rules).
  x += Phaser.Math.Between(-8, 8);
  const t = scene.add
    .text(x, y, text, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      stroke: "#000000",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    })
    .setOrigin(0.5, 1)
    .setDepth(950);
  scene.tweens.add({
    targets: t,
    y: y - 36,
    alpha: 0,
    duration: 900,
    ease: "Cubic.easeOut",
    onComplete: () => t.destroy(),
  });
}

export interface AttackContext {
  advantage: string[];
  disadvantage: string[];
}

export function buildAttackContext(
  attacker: CharacterSprite,
  target: MonsterSprite,
  light: LightSystem,
): AttackContext {
  const advantage: string[] = [];
  const disadvantage: string[] = [];

  if (attacker.y + 20 < target.y) advantage.push("high ground");
  // Backstab: thief striking a monster facing away.
  const targetFacing = target.flipX ? -1 : 1;
  const attackerBehind = Math.sign(attacker.x - target.x) === -targetFacing;
  if (attacker.character.className === "thief" && attackerBehind && target.aiState === "patrol") {
    advantage.push("backstab");
  }
  if (!attacker.grounded) disadvantage.push("airborne");
  if (light.levelAt(attacker.x, attacker.y) === "dark") disadvantage.push("darkness");

  return { advantage, disadvantage };
}

/**
 * Tracks monster groups for morale. Half the group down = check — unless a
 * living leader stands in the group (leader-led groups are immune while the
 * leader lives, and the whole group checks the moment the leader falls).
 */
export class MoraleTracker {
  private groups = new Map<string, { total: number; checked: boolean; leaders: number }>();

  register(monster: MonsterSprite): void {
    const g = this.groups.get(monster.groupId);
    const isLeader = monster.def.leader === true ? 1 : 0;
    if (g) {
      g.total++;
      g.leaders += isLeader;
    } else {
      this.groups.set(monster.groupId, { total: 1, checked: false, leaders: isLeader });
    }
  }

  /** Call when a monster dies. Rolls morale for survivors when the threshold hits. */
  onDeath(
    ctx: GameContext,
    scene: Phaser.Scene,
    dead: MonsterSprite,
    survivors: MonsterSprite[],
  ): void {
    const g = this.groups.get(dead.groupId);
    if (!g) throw new Error(`Monster group "${dead.groupId}" was never registered`);
    const alive = survivors.filter((m) => m.groupId === dead.groupId && m.aliveInFight);

    if (dead.def.leader) {
      // The leader falls: every survivor checks its nerve at once.
      g.leaders--;
      if (g.leaders === 0 && alive.length > 0) {
        ctx.say("Their leader is down — the warband wavers!", "#9999ee");
        g.checked = true;
        this.rollGroup(ctx, scene, alive);
      }
      return;
    }

    if (g.checked || g.total < 2) return;
    if (g.leaders > 0) return; // a standing leader holds the line
    if (alive.length === 0 || alive.length > g.total / 2) return;
    g.checked = true;
    this.rollGroup(ctx, scene, alive);
  }

  private rollGroup(ctx: GameContext, scene: Phaser.Scene, alive: MonsterSprite[]): void {
    for (const m of alive) {
      const result = moraleCheck(ctx.engine.dice, m.def);
      if (!result.holds) {
        m.flee();
        floatText(scene, m.x, m.y - 20, "flees!", "#9999ee");
        ctx.say(`The ${m.def.name} loses its nerve and flees!`, "#9999ee");
      } else {
        floatText(scene, m.x, m.y - 20, "holds!", "#ee9999");
      }
    }
  }
}

export interface MeleeDeps {
  scene: Phaser.Scene;
  ctx: GameContext;
  light: LightSystem;
  monsters: () => MonsterSprite[];
  onMonsterKilled: (m: MonsterSprite) => void;
}

export interface SwingOutcome {
  swung: boolean;
  /** Check result when a target was actually attacked. */
  check?: CheckResult;
}

/** One melee swing from a character. */
export function meleeSwing(deps: MeleeDeps, attacker: CharacterSprite): SwingOutcome {
  if (!attacker.canSwing()) return { swung: false };
  attacker.startSwingCooldown();

  const { scene, ctx, light } = deps;
  const reach = attacker.weaponReachPx;
  const slash = scene.add
    .image(attacker.x + attacker.facing * reach * 0.4, attacker.y, "slash")
    .setDepth(20)
    .setFlipX(attacker.facing === -1);
  scene.tweens.add({ targets: slash, alpha: 0, duration: 200, onComplete: () => slash.destroy() });

  const target = deps
    .monsters()
    .filter(
      (m) =>
        m.aliveInFight &&
        Phaser.Math.Distance.Between(attacker.x, attacker.y, m.x, m.y) <= reach &&
        (m.x - attacker.x) * attacker.facing > -12,
    )
    .sort(
      (a, b) =>
        Phaser.Math.Distance.Between(attacker.x, attacker.y, a.x, a.y) -
        Phaser.Math.Distance.Between(attacker.x, attacker.y, b.x, b.y),
    )[0];
  if (!target) return { swung: true };

  const posCtx = buildAttackContext(attacker, target, light);
  // Backstab: advantage AND extra weapon dice (1 + half level), per RAW.
  const backstab = posCtx.advantage.includes("backstab");
  const result = ctx.engine.attack({
    attacker: attacker.character,
    targetAc: target.def.ac,
    damage: attacker.weaponDamage,
    weapon: item(attacker.cls.weaponId),
    extraDamageDice: backstab ? 1 + Math.floor(attacker.character.level / 2) : 0,
    advantage: posCtx.advantage,
    disadvantage: posCtx.disadvantage,
  });

  const die = result.check.natural;
  if (result.check.success) {
    const label = result.check.crit ? `${die}! CRIT ${result.damage}` : `${die} → ${result.damage}`;
    floatText(deps.scene, target.x, target.y - 16, label, result.check.crit ? "#ffd040" : "#ff7050");
    if (result.check.crit) deps.scene.cameras.main.shake(150, 0.008);
    else deps.scene.cameras.main.shake(80, 0.003);
    applyDamageToMonster(deps, target, result.damage);
  } else {
    floatText(deps.scene, target.x, target.y - 16, `${die} miss`, "#8888aa");
  }
  if (posCtx.advantage.length > 0 && posCtx.disadvantage.length === 0) {
    floatText(deps.scene, attacker.x, attacker.y - 34, posCtx.advantage[0]!, "#70d070", 11);
  } else if (posCtx.disadvantage.length > 0 && posCtx.advantage.length === 0) {
    floatText(deps.scene, attacker.x, attacker.y - 34, posCtx.disadvantage[0]!, "#d07070", 11);
  }
  return { swung: true, check: result.check };
}

export function applyDamageToMonster(deps: MeleeDeps, target: MonsterSprite, damage: number): void {
  target.hp -= damage;
  target.setTintFill(0xffffff);
  deps.scene.time.delayedCall(80, () => target.clearTint());
  hitBurst(deps.scene, target.x, target.y, target.def.undead);

  if (target.hp <= 0) {
    deps.onMonsterKilled(target);
  } else if (target.aiState === "patrol") {
    target.aiState = "aggro";
  }
}

/** A monster swings at a character. Darkness favors the monster — it sees fine. */
export function monsterSwing(
  scene: Phaser.Scene,
  ctx: GameContext,
  light: LightSystem,
  monster: MonsterSprite,
  target: CharacterSprite,
): void {
  monster.attackCooldown = 1500;
  // Being attacked marks the aggressor so the character swings back.
  target.lastAttackedBy = monster;
  target.lastAttackedAt = scene.time.now;
  const inDark = light.levelAt(target.x, target.y) === "dark";
  const result = monsterAttackRoll(
    ctx.engine.dice,
    monster.def,
    target.character.ac,
    inDark && monster.def.darkvision ? "advantage" : "normal",
  );
  if (result.hit) {
    floatText(scene, target.x, target.y - 16, `-${result.damage}`, "#ff5050");
    const wentDown = ctx.engine.damageCharacter(target.character, result.damage);
    scene.cameras.main.shake(80, 0.004);
    hitBurst(scene, target.x, target.y, false);

    if (wentDown) {
      ctx.say(
        `${target.character.name} is down! Dying in ${target.character.dying!.roundsRemaining} rounds — stabilize or heal them!`,
        "#ff5050",
      );
    }
  } else {
    floatText(scene, target.x, target.y - 16, "miss", "#8888aa");
  }
}
