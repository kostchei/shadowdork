/**
 * Game-side spellcasting: turns engine CastResults into projectiles, heals,
 * light, routed undead, and live mishap consequences.
 */

import Phaser from "phaser";
import type { CastResult, EffectHook } from "../../engine";
import { spellCast, spellMishap, whoosh } from "../audio/sfx";
import { spell } from "../../data";
import type { GameContext } from "../context";
import type { CharacterSprite } from "../entities/CharacterSprite";
import type { MonsterSprite } from "../entities/MonsterSprite";
import { applyDamageToMonster, floatText, type MeleeDeps } from "./combat";
import type { LightSystem } from "./light";
import { TORCH_RADIUS } from "./light";
import { CLOSE_PX, FAR_PX, NEAR_PX, zoneBetween } from "./position";

export interface SpellDeps extends MeleeDeps {
  party: () => CharacterSprite[];
}

/** Cast the caster's selected spell. A preferred target applies to targeted attack spells. */
export function castSelectedSpell(
  deps: SpellDeps,
  caster: CharacterSprite,
  preferredTarget?: MonsterSprite,
): CastResult | null {
  if (!caster.canSwing()) return null;
  const known = caster.character.knownSpells;
  if (known.length === 0) {
    deps.ctx.say(`${caster.character.name} knows no spells.`);
    return null;
  }
  const slot = known[caster.spellIndex % known.length]!;
  const def = spell(slot.spellId);
  if (slot.status === "lost") {
    deps.ctx.say(`${def.name} is lost until ${caster.character.name} rests.`, "#d07070");
    return null;
  }
  caster.startSwingCooldown();

  const inDark = deps.light.levelAt(caster.x, caster.y) === "dark";
  const result = deps.ctx.engine.cast(caster.character, def, {
    disadvantage: inDark ? ["darkness"] : [],
  });

  const die = result.check.natural;
  if (result.outcome === "fail") {
    whoosh({ gain: 0.6 });
    floatText(deps.scene, caster.x, caster.y - 40, `${die} — spell lost!`, "#d07070");
    deps.ctx.say(`${def.name} fizzles — lost until rest. (rolled ${die}+${result.check.modifier} vs DC ${result.check.dc})`, "#d07070");
    return result;
  }
  if (result.outcome === "mishap") {
    spellMishap();
    deps.scene.cameras.main.shake(250, 0.01);
    floatText(deps.scene, caster.x, caster.y - 40, "NAT 1 — MISHAP!", "#ff4060", 16);
    if (result.mishap) {
      deps.ctx.say(`Mishap: ${result.mishap.entry.text}`, "#ff4060");
      applyMishap(deps, caster, result);
    } else {
      deps.ctx.say(
        `${caster.character.name}'s deity is displeased — ${def.name} is cut off until atonement.`,
        "#ff4060",
      );
    }
    return result;
  }

  const doubled = result.doubled;
  spellCast();
  floatText(
    deps.scene,
    caster.x,
    caster.y - 40,
    doubled ? `${die}! CRIT CAST` : `${die} cast`,
    doubled ? "#ffd040" : "#70a0f0",
  );
  resolveSpellEffect(deps, caster, result, preferredTarget);
  return result;
}

function resolveSpellEffect(
  deps: SpellDeps,
  caster: CharacterSprite,
  result: CastResult,
  preferredTarget?: MonsterSprite,
): void {
  const def = result.spell;
  const mult = result.doubled ? 2 : 1;
  const { ctx, scene } = deps;

  switch (def.id) {
    case "magic-missile": {
      const target = isValidSpellTarget(caster, preferredTarget, FAR_PX)
        ? preferredTarget
        : nearestMonster(deps, caster, FAR_PX);
      if (!target) {
        ctx.say("The bolt streaks away into the dark — nothing in range.");
        return;
      }
      const dmg = ctx.engine.dice.roll(def.dice!) * mult;
      fireBolt(scene, caster, target, () => {
        floatText(scene, target.x, target.y - 16, `${dmg}`, "#8090f8");
        applyDamageToMonster(deps, target, dmg);
      });
      return;
    }
    case "burning-hands": {
      const victims = deps.monsters().filter(
        (m) => m.aliveInFight && zoneBetween(caster, m) === "close",
      );
      // Fire spray particles
      const fireParticles = scene.add.particles(caster.x + caster.facing * 10, caster.y, "pixel", {
        color: [0xff4500, 0xff8c00, 0xffd700],
        speedX: { min: caster.facing * 80, max: caster.facing * 180 },
        speedY: { min: -40, max: 40 },
        scale: { start: 2.5, end: 0 },
        lifespan: { min: 200, max: 450 },
        duration: 250,
        maxParticles: 25,
        blendMode: "ADD",
      }).setDepth(25);
      scene.time.delayedCall(800, () => fireParticles.destroy());

      if (victims.length === 0) {
        ctx.say("Flames fan out over nothing.");
        return;
      }
      for (const m of victims) {
        const dmg = ctx.engine.dice.roll(def.dice!) * mult;
        floatText(scene, m.x, m.y - 16, `${dmg}`, "#f09040");
        applyDamageToMonster(deps, m, dmg);
      }
      return;
    }
    case "fireball": {
      const target = isValidSpellTarget(caster, preferredTarget, FAR_PX)
        ? preferredTarget
        : nearestMonster(deps, caster, FAR_PX);
      if (!target) {
        ctx.say("The fireball vanishes into the dark — nothing is in range.");
        return;
      }
      const victims = deps.monsters().filter(
        (monster) =>
          monster.aliveInFight &&
          Phaser.Math.Distance.Between(target.x, target.y, monster.x, monster.y) <= CLOSE_PX,
      );
      fireBolt(scene, caster, target, () => {
        const burst = scene.add.particles(target.x, target.y, "pixel", {
          color: [0xff3c18, 0xff8c20, 0xffe06a],
          speed: { min: 70, max: 230 },
          scale: { start: 3.5, end: 0 },
          lifespan: { min: 280, max: 620 },
          duration: 220,
          maxParticles: 45,
          blendMode: "ADD",
        }).setDepth(25);
        scene.time.delayedCall(900, () => burst.destroy());
        for (const victim of victims) {
          const dmg = ctx.engine.dice.roll(def.dice!) * mult;
          floatText(scene, victim.x, victim.y - 16, `${dmg}`, "#ff7a38");
          applyDamageToMonster(deps, victim, dmg);
        }
        ctx.say(`Fire engulfs ${victims.length} ${victims.length === 1 ? "foe" : "foes"}!`, "#ff9b45");
      });
      return;
    }
    case "mage-armor": {
      caster.character.removeEffect("spell-mage-armor");
      caster.character.addEffect({
        id: "spell-mage-armor",
        name: "Mage Armor (+3 AC)",
        hooks: [{ kind: "acBonus", bonus: 3 }],
        duration: { unit: "realMs", remaining: def.durationMs! * mult },
      });
      ctx.say(`Force hardens around ${caster.character.name} (+3 AC).`, "#70a0f0");
      return;
    }
    case "cure-wounds": {
      const wounded = deps
        .party()
        .filter((p) => !p.character.dead && zoneBetween(caster, p) !== "beyond")
        .sort(
          (a, b) => a.character.hp / a.character.maxHp - b.character.hp / b.character.maxHp,
        )[0];
      if (!wounded) throw new Error("cure-wounds found no valid target");
      const heal = ctx.engine.dice.roll(def.dice!) * mult;
      const wasDying = wounded.character.dying !== null;
      wounded.character.heal(heal);
      floatText(scene, wounded.x, wounded.y - 16, `+${heal}`, "#60e080");

      // Healing sparkle particles
      const healParticles = scene.add.particles(wounded.x, wounded.y, "pixel", {
        color: [0x60e080, 0xa0ffd0, 0xffffff],
        speedY: { min: -60, max: -20 },
        speedX: { min: -15, max: 15 },
        scale: { start: 2, end: 0 },
        lifespan: { min: 400, max: 800 },
        duration: 300,
        maxParticles: 20,
        blendMode: "ADD",
      }).setDepth(25);
      scene.time.delayedCall(1000, () => healParticles.destroy());

      if (wasDying && !wounded.character.dying) {
        ctx.say(`${wounded.character.name} is pulled back from the brink!`, "#60e080");
      }
      return;
    }
    case "light": {
      const durationMs = def.durationMs! * mult;
      const sourceId = deps.light.addSource(
        TORCH_RADIUS * 1.1,
        () => (caster.character.dead ? null : { x: caster.x, y: caster.y }),
        { tint: 0xc4d8ec, tintAlpha: 0.45 },
      );
      scene.time.delayedCall(durationMs, () => deps.light.removeSource(sourceId));
      ctx.say(`Holy light blazes around ${caster.character.name} — no torch, no hands.`, "#f0e090");
      return;
    }
    case "turn-undead": {
      const undead = deps
        .monsters()
        .filter((m) => m.aliveInFight && m.def.undead && zoneBetween(caster, m) !== "beyond")
        .filter((m) => Phaser.Math.Distance.Between(caster.x, caster.y, m.x, m.y) <= NEAR_PX * (mult === 2 ? 2 : 1));
      
      // Holy golden burst particles
      const holyParticles = scene.add.particles(caster.x, caster.y, "pixel", {
        color: [0xffd700, 0xffea70, 0xffffff],
        speed: { min: 50, max: 150 },
        scale: { start: 2, end: 0 },
        lifespan: 400,
        duration: 200,
        maxParticles: 30,
        blendMode: "ADD",
      }).setDepth(25);
      scene.time.delayedCall(800, () => holyParticles.destroy());

      if (undead.length === 0) {
        ctx.say("No undead stir within reach of the litany.");
        return;
      }
      for (const m of undead) {
        m.flee();
        floatText(scene, m.x, m.y - 20, "turned!", "#f0e090");
      }
      ctx.say(`${undead.length} undead recoil and flee the holy word!`, "#f0e090");
      return;
    }
    case "bless": {
      const blessed = deps.party().filter((member) => !member.character.dead);
      for (const member of blessed) {
        member.character.removeEffect("spell-bless");
        member.character.addEffect({
          id: "spell-bless",
          name: "Blessed (+1 attacks and spells)",
          hooks: [
            { kind: "checkBonus", applies: "attack", bonus: mult },
            { kind: "checkBonus", applies: "spellcast", bonus: mult },
          ],
          duration: { unit: "realMs", remaining: def.durationMs! * mult },
        });
        floatText(scene, member.x, member.y - 22, `BLESSED +${mult}`, "#ffe486");
      }
      ctx.say(`Divine favour settles over the party (+${mult} attacks and spells).`, "#f0e090");
      return;
    }
    default:
      throw new Error(`No game effect implemented for spell "${def.id}"`);
  }
}

function applyMishap(deps: SpellDeps, caster: CharacterSprite, result: CastResult): void {
  const data = result.mishap!.entry.data ?? {};
  const effects = result.mishap!.entry.effects;
  const { ctx, scene } = deps;

  if (typeof data.damageDice === "string") {
    const dmg = ctx.engine.dice.roll(data.damageDice);
    floatText(scene, caster.x, caster.y - 16, `-${dmg}`, "#ff4060");
    const wentDown = ctx.engine.damageCharacter(caster.character, dmg);
    if (wentDown) ctx.say(`${caster.character.name} is downed by their own magic!`, "#ff4060");
  }
  if (effects && effects.length > 0) {
    caster.character.addEffect({
      id: `mishap-${result.mishap!.roll}-${Date.now()}`,
      name: result.mishap!.entry.text,
      hooks: [...effects] as EffectHook[],
      duration: { unit: "untilRest", remaining: 0 },
    });
  }
  if (data.snuffLights === true) {
    deps.light.snuffAll();
    for (const p of deps.party()) {
      p.torchTimerId = null;
      if (p.character.carriedShield && p.character.shieldStowed) {
        p.character.shieldStowed = false;
      }
    }
    ctx.say("Every flame in the party is snuffed out. The dark rushes in.", "#ff4060");
  }
  if (data.launch === true) {
    caster.setVelocityY(-560);
  }
  if (data.attractMonsters === true) {
    for (const m of deps.monsters()) {
      if (m.aliveInFight) m.aiState = "aggro";
    }
  }
}

function isValidSpellTarget(
  caster: CharacterSprite,
  target: MonsterSprite | undefined,
  maxDist: number,
): target is MonsterSprite {
  return Boolean(
    target &&
      target.aliveInFight &&
      Phaser.Math.Distance.Between(caster.x, caster.y, target.x, target.y) <= maxDist,
  );
}

function nearestMonster(
  deps: SpellDeps,
  from: CharacterSprite,
  maxDist: number,
): MonsterSprite | undefined {
  return deps
    .monsters()
    .filter(
      (m) => m.aliveInFight && Phaser.Math.Distance.Between(from.x, from.y, m.x, m.y) <= maxDist,
    )
    .sort(
      (a, b) =>
        Phaser.Math.Distance.Between(from.x, from.y, a.x, a.y) -
        Phaser.Math.Distance.Between(from.x, from.y, b.x, b.y),
    )[0];
}

function fireBolt(
  scene: Phaser.Scene,
  from: CharacterSprite,
  to: MonsterSprite,
  onHit: () => void,
): void {
  const bolt = scene.add.image(from.x, from.y - 8, "spell-bolt").setDepth(20);
  bolt.setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));

  // Magic trail particles
  const particles = scene.add.particles(0, 0, "pixel", {
    color: [0x7ed9dd, 0x505fc1, 0xffffff],
    speed: { min: -10, max: 10 },
    scale: { start: 1.5, end: 0 },
    lifespan: 300,
    frequency: 20,
    blendMode: "ADD",
  }).setDepth(19);
  particles.startFollow(bolt);

  scene.tweens.add({
    targets: bolt,
    x: to.x,
    y: to.y,
    duration: 180,
    onComplete: () => {
      particles.destroy();
      bolt.destroy();
      onHit();
    },
  });
}
