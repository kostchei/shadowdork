/**
 * Real-time combat over dice-authoritative resolution. Every swing calls the
 * engine; this file turns results into damage, floating dice, morale, and
 * death timers. Positional context makes adv/dis legible through movement.
 */

import Phaser from "phaser";
import {
  POISONED_WEAPON_EFFECT_ID,
  assassinExtraDamageDice,
  getBaseRole,
  monsterAttackRoll,
  moraleCheck,
  oldGodKillHealing,
  poisonedWeaponDamage,
  hasHook,
  revealCharacter,
  type CheckResult,
  type ItemDef,
} from "../../engine";
import { item } from "../../data";
import type { GameContext } from "../context";
import { RENDER_SCALE } from "../display";
import type { CharacterSprite } from "../entities/CharacterSprite";
import type { MonsterSprite } from "../entities/MonsterSprite";
import { bowShot, swordClang, swordCrit, thud, whoosh } from "../audio/sfx";
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
  ctx?: GameContext,
  scene?: Phaser.Scene,
): AttackContext {
  const advantage: string[] = [];
  const disadvantage: string[] = [];

  if (attacker.y + 20 < target.y) advantage.push("high ground");

  // Backstab: Thief getting behind a monster (unaware or engaged with another player)
  const isThief = getBaseRole(attacker.character.className) === "thief";
  const targetFacing = target.flipX ? -1 : 1;
  const attackerBehind = Math.sign(attacker.x - target.x) === -targetFacing;

  if (isThief && attackerBehind) {
    const unawareOrFlanked = target.aiState === "patrol" || target.targetPlayer !== attacker;
    if (unawareOrFlanked) {
      if (ctx) {
        // DEX check vs DC 15 with advantage for Thief
        const check = ctx.engine.check({
          actor: attacker.character,
          stat: "DEX",
          dc: 15,
          kind: "stat",
          advantage: ["thief backstab"],
        });
        if (check.success) {
          advantage.push("backstab");
          if (scene) floatText(scene, attacker.x, attacker.y - 32, "BACKSTAB!", "#70d070", 14);
        }
      } else {
        advantage.push("backstab");
      }
    }
  }

  if (!attacker.grounded) disadvantage.push("airborne");
  if (target.spellObscured) disadvantage.push("fog");
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
  /** Total damage dealt by a successful hit. */
  damage?: number;
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
  attacker.lastOffensiveActionAt = scene.time.now;

  const posCtx = buildAttackContext(attacker, target, light, ctx, scene);
  // Backstab: advantage AND extra weapon dice (1 + half level), per RAW.
  const backstab = posCtx.advantage.includes("backstab");
  const unaware = target.aiState === "patrol" || target.isSleeping;
  const assassinDice = assassinExtraDamageDice(attacker.character, unaware);
  const result = ctx.engine.attack({
    attacker: attacker.character,
    targetAc: target.def.ac,
    damage: attacker.weaponDamage,
    weapon: attacker.character.weapon,
    extraDamageDice: (backstab ? 1 + Math.floor(attacker.character.level / 2) : 0) + assassinDice,
    advantage: posCtx.advantage,
    disadvantage: posCtx.disadvantage,
  });

  const wasHidden = revealCharacter(attacker.character);
  const die = result.check.natural;
  let totalDamage = result.damage;
  if (result.check.success) {
    const poisonDice = poisonedWeaponDamage(attacker.character);
    if (poisonDice) {
      const poison = ctx.engine.dice.roll(poisonDice);
      totalDamage += poison;
      attacker.character.removeEffect(POISONED_WEAPON_EFFECT_ID);
      floatText(deps.scene, target.x, target.y - 32, `+${poison} poison`, "#8bd450", 11);
    }
    const label = result.check.crit ? `${die}! CRIT ${totalDamage}` : `${die} → ${totalDamage}`;
    floatText(deps.scene, target.x, target.y - 16, label, result.check.crit ? "#ffd040" : "#ff7050");
    if (result.check.crit) deps.scene.cameras.main.shake(150, 0.008);
    else deps.scene.cameras.main.shake(80, 0.003);
    if (result.check.crit) swordCrit();
    else swordClang();
    applyDamageToMonster(deps, target, totalDamage, attacker);
  } else {
    whoosh();
    floatText(deps.scene, target.x, target.y - 16, `${die} miss`, "#8888aa");
  }
  if (posCtx.advantage.length > 0 && posCtx.disadvantage.length === 0) {
    floatText(deps.scene, attacker.x, attacker.y - 34, posCtx.advantage[0]!, "#70d070", 11);
  } else if (posCtx.disadvantage.length > 0 && posCtx.advantage.length === 0) {
    floatText(deps.scene, attacker.x, attacker.y - 34, posCtx.disadvantage[0]!, "#d07070", 11);
  }
  if (wasHidden && assassinDice > 0) {
    floatText(scene, attacker.x, attacker.y - 46, "ASSASSIN!", "#d9b3ff", 12);
  }
  return { swung: true, check: result.check, damage: result.check.success ? totalDamage : undefined };
}

export function applyDamageToMonster(deps: MeleeDeps, target: MonsterSprite, damage: number, attacker?: CharacterSprite): void {
  target.wake();
  target.hp -= damage;
  target.setTintFill(0xffffff);
  deps.scene.time.delayedCall(80, () => target.clearTint());
  hitBurst(deps.scene, target.x, target.y, target.def.undead);

  if (target.hp <= 0) {
    if (attacker) {
      const healed = oldGodKillHealing(attacker.character, deps.ctx.engine.dice);
      if (healed > 0) floatText(deps.scene, attacker.x, attacker.y - 44, `+${healed} ODIN`, "#72d887", 11);
    }
    deps.onMonsterKilled(target);
  } else if (target.aiState === "patrol") {
    target.aiState = "aggro";
  }
}

/** The first ranged or throwable weapon in a character's pack (shortbow or dagger). */
export function carriedRangedWeapon(attacker: CharacterSprite): ItemDef | null {
  if (attacker.character.inventory.has("shortbow")) return item("shortbow");
  if (attacker.character.inventory.has("dagger")) return item("dagger");
  return null;
}

/** Loose an arrow or throw a dagger: attack roll at range, projectile flight, damage on arrival. */
export function rangedShot(
  deps: MeleeDeps,
  attacker: CharacterSprite,
  target: MonsterSprite,
  weapon: ItemDef,
): void {
  if (!attacker.canSwing()) return;
  attacker.startSwingCooldown();
  attacker.lastOffensiveActionAt = deps.scene.time.now;
  const { scene, ctx, light } = deps;
  if (!weapon.damage) throw new Error(`${weapon.name} has no damage dice`);

  attacker.facing = target.x >= attacker.x ? 1 : -1;
  attacker.setFlipX(attacker.facing === -1);
  const disadvantage: string[] = [];
  if (light.levelAt(attacker.x, attacker.y) === "dark") disadvantage.push("darkness");

  const result = ctx.engine.attack({
    attacker: attacker.character,
    targetAc: target.def.ac,
    damage: weapon.damage,
    weapon,
    advantage: [],
    disadvantage,
  });

  const isDagger = weapon.id === "dagger";
  if (isDagger) {
    whoosh({ gain: 0.7 });
  } else {
    bowShot();
  }
  const projectile = isDagger
    ? scene.add.image(attacker.x + attacker.facing * 8, attacker.y - 8, "slash").setDepth(20).setDisplaySize(12, 6)
    : scene.add.rectangle(attacker.x + attacker.facing * 8, attacker.y - 8, 10, 2, 0xd8cfa8).setDepth(20);
  projectile.setRotation(Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y));
  scene.tweens.add({
    targets: projectile,
    x: target.x,
    y: target.y - 6,
    duration: 160,
    onComplete: () => {
      projectile.destroy();
      if (!target.active || !target.aliveInFight) return;
      const die = result.check.natural;
      if (result.check.success) {
        const label = result.check.crit ? `${die}! CRIT ${result.damage}` : `${die} → ${result.damage}`;
        floatText(scene, target.x, target.y - 16, label, result.check.crit ? "#ffd040" : "#ff7050");
        applyDamageToMonster(deps, target, result.damage, attacker);
      } else {
        whoosh({ gain: 0.6 });
        floatText(scene, target.x, target.y - 16, `${die} miss`, "#8888aa");
      }
    },
  });
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
  const obscured = hasHook(target.character.effects, "obscured");
  const forcedDisadvantage = monster.spellDisadvantageNextAction || obscured;
  const result = monsterAttackRoll(
    ctx.engine.dice,
    monster.def,
    target.character.ac,
    forcedDisadvantage ? "disadvantage" : inDark ? "advantage" : "normal",
  );
  monster.spellDisadvantageNextAction = false;
  if (result.hit) {
    // Staff Sunder Ability: if target is wielding a staff in 2 hands when hit, sacrifice/destroy staff to block all hit damage!
    const wielded = target.character.wieldedWeapon;
    if (wielded && wielded.id === "staff") {
      swordClang();
      scene.cameras.main.shake(120, 0.006);
      hitBurst(scene, target.x, target.y, false);
      floatText(scene, target.x, target.y - 16, "STAFF SUNDERED!", "#ffe06a", 15);
      
      // Destroy staff from inventory & clear wielded weapon
      target.character.inventory.remove("staff", 1);
      target.character.wieldedWeapon = null;
      
      // Auto-equip dagger if present in inventory
      if (target.character.inventory.has("dagger")) {
        target.character.equipWeapon(item("dagger"));
      }
      
      ctx.say(
        `${target.character.name}'s staff shatters in two hands to block the blow! (0 damage taken)`,
        "#ffe06a",
      );
      return;
    }

    thud();
    floatText(scene, target.x, target.y - 16, `-${result.damage}`, "#ff5050");
    const wentDown = ctx.engine.damageCharacter(target.character, result.damage, { attack: true });
    scene.cameras.main.shake(80, 0.004);
    hitBurst(scene, target.x, target.y, false);

    if (wentDown) {
      ctx.say(
        `${target.character.name} is down! Dying in ${target.character.dying!.roundsRemaining} rounds — stabilize or heal them!`,
        "#ff5050",
      );
    }
  } else {
    whoosh({ gain: 0.5 });
    floatText(scene, target.x, target.y - 16, "miss", "#8888aa");
  }
}
