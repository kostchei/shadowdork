/**
 * Game-side spellcasting: turns engine CastResults into projectiles, heals,
 * light, routed undead, and live mishap consequences.
 */

import Phaser from "phaser";
import {
  applyCondition,
  hasCondition,
  moraleCheck,
  removeCondition,
  type CastResult,
  type CastSource,
  type EffectHook,
} from "../../engine";
import { spellCast, spellMishap, whoosh } from "../audio/sfx";
import { item, spell } from "../../data";
import type { CharacterSprite } from "../entities/CharacterSprite";
import type { MonsterSprite } from "../entities/MonsterSprite";
import { applyDamageToMonster, floatText, type MeleeDeps } from "./combat";
import { TORCH_RADIUS } from "./light";
import { CLOSE_PX, FAR_PX, NEAR_PX, zoneBetween } from "./position";
import { TILE } from "../textures";

export interface SpellDeps extends MeleeDeps {
  party: () => CharacterSprite[];
  /** Alternate origin used by Witch familiars; defaults to the caster. */
  spellOrigin?: (caster: CharacterSprite) => { x: number; y: number };
  /** Reveal a nearby secret or unexplored chamber for divination spells. */
  revealSecrets?: (caster: CharacterSprite) => string | null;
  answerDivination?: (kind: string) => string;
  /** Renderer-safe hostile creation supplied by Dungeon; absent uses an alert fallback. */
  spawnHostile?: (monsterId: string, x: number, y: number) => void;
}

export interface SpellSelection {
  ally?: CharacterSprite;
  point?: { x: number; y: number };
  choice?: string;
  objectItemId?: string;
  direction?: -1 | 1;
}

function previewPendingMishap(deps: SpellDeps, caster: CharacterSprite, result: CastResult): void {
  floatText(deps.scene, caster.x, caster.y - 40, "NAT 1 — CHOOSE", "#ffb040", 16);
  deps.ctx.say(
    result.mishap ? `Mishap threatens: ${result.mishap.entry.text}` : "Divine displeasure threatens. Spend Luck or accept it.",
    "#ffb040",
  );
}

/** Cast the caster's selected spell. A preferred target applies to targeted attack spells. */
export function castSelectedSpell(
  deps: SpellDeps,
  caster: CharacterSprite,
  preferredTarget?: MonsterSprite,
  selection: SpellSelection = {},
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
  if (result.outcome === "pendingMishap") {
    previewPendingMishap(deps, caster, result);
    return result;
  }
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
  resolveSpellEffect(deps, caster, result, preferredTarget, selection);
  return result;
}

/** Cast a spell supplied by a scroll or wand without touching known-spell state. */
export function castItemSpell(
  deps: SpellDeps,
  caster: CharacterSprite,
  def: ReturnType<typeof spell>,
  preferredTarget?: MonsterSprite,
  selection: SpellSelection = {},
): CastResult | null {
  if (!caster.canSwing()) return null;
  caster.startSwingCooldown();
  const inDark = deps.light.levelAt(caster.x, caster.y) === "dark";
  const result = deps.ctx.engine.castItem(caster.character, def, {
    disadvantage: inDark ? ["darkness"] : [],
  });
  const die = result.check.natural;

  if (result.outcome === "pendingMishap") {
    previewPendingMishap(deps, caster, result);
    return result;
  }

  if (result.outcome === "fail") {
    whoosh({ gain: 0.6 });
    floatText(deps.scene, caster.x, caster.y - 40, `${die} — item fizzles`, "#d07070");
    deps.ctx.say(`${def.name} fizzles. (rolled ${die}+${result.check.modifier} vs DC ${result.check.dc})`, "#d07070");
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
      deps.ctx.say(`${caster.character.name}'s divine invocation backfires.`, "#ff4060");
    }
    return result;
  }

  spellCast();
  floatText(
    deps.scene,
    caster.x,
    caster.y - 40,
    result.doubled ? `${die}! CRIT CAST` : `${die} cast`,
    result.doubled ? "#ffd040" : "#70a0f0",
  );
  resolveSpellEffect(deps, caster, result, preferredTarget, selection);
  return result;
}

/** Commit and render a previously previewed natural-1 consequence. */
export function acceptCastMishap(
  deps: SpellDeps,
  caster: CharacterSprite,
  pending: CastResult,
  source: CastSource,
): CastResult {
  const result = deps.ctx.engine.acceptMishap(caster.character, pending, source);
  spellMishap();
  deps.scene.cameras.main.shake(250, 0.01);
  floatText(deps.scene, caster.x, caster.y - 40, "MISHAP!", "#ff4060", 16);
  if (result.mishap) {
    deps.ctx.say(`Mishap: ${result.mishap.entry.text}`, "#ff4060");
    applyMishap(deps, caster, result);
  } else {
    deps.ctx.say(
      `${caster.character.name}'s deity is displeased — ${result.spell.name} is cut off until atonement.`,
      "#ff4060",
    );
  }
  return result;
}

function resolveSpellEffect(
  deps: SpellDeps,
  caster: CharacterSprite,
  result: CastResult,
  preferredTarget?: MonsterSprite,
  selection: SpellSelection = {},
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
    case "feather-fall": {
      caster.character.removeEffect("spell-feather-fall");
      caster.character.addEffect({
        id: "spell-feather-fall",
        name: "Feather Fall (next dangerous fall)",
        hooks: [],
        duration: { unit: "rounds", remaining: 10 * mult },
      });
      ctx.say(`${caster.character.name} feels lighter than air.`, "#a7d8ff");
      return;
    }
    case "sleep": {
      const victims = deps.monsters().filter(
        (monster) =>
          monster.aliveInFight &&
          !monster.def.leader &&
          Phaser.Math.Distance.Between(caster.x, caster.y, monster.x, monster.y) <= NEAR_PX,
      );
      for (const victim of victims) {
        victim.sleep(30_000 * mult);
        floatText(scene, victim.x, victim.y - 18, "ASLEEP", "#9da7ec");
      }
      ctx.say(
        victims.length > 0
          ? `${victims.length} lesser ${victims.length === 1 ? "creature falls" : "creatures fall"} asleep.`
          : "The lullaby finds no lesser creature in range.",
        "#9da7ec",
      );
      return;
    }
    case "misty-step": {
      const direction = caster.facing;
      const bounds = scene.physics.world.bounds;
      caster.setPosition(
        Phaser.Math.Clamp(caster.x + direction * NEAR_PX * mult, bounds.left + 64, bounds.right - 64),
        caster.y,
      );
      const mist = scene.add.particles(caster.x, caster.y, "pixel", {
        color: [0xb8c4df, 0x6f789a, 0xffffff],
        speed: { min: 20, max: 90 },
        scale: { start: 2.2, end: 0 },
        lifespan: 450,
        duration: 180,
        maxParticles: 24,
      }).setDepth(25);
      scene.time.delayedCall(700, () => mist.destroy());
      ctx.say(`${caster.character.name} steps through the mist.`, "#b8c4df");
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
          Phaser.Math.Distance.Between(target.x, target.y, monster.x, monster.y) <= NEAR_PX,
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
    case "acid-arrow": {
      const target = isValidSpellTarget(caster, preferredTarget, FAR_PX)
        ? preferredTarget
        : nearestMonster(deps, caster, FAR_PX);
      if (!target) {
        ctx.say("The acid arrow finds no foe in range.");
        return;
      }
      caster.character.addEffect({
        id: "focus:acid-arrow",
        name: `Focus: Acid Arrow (${target.def.name})`,
        hooks: [
          { kind: "focusSpell", spellId: def.id, tier: def.tier },
          { kind: "focusTarget", targetId: target.groupId + ":" + target.x + ":" + target.y },
        ],
        duration: { unit: "focus", remaining: 0 },
      });
      const tick = () => {
        const active = caster.character.effects.some((effect) => effect.id === "focus:acid-arrow");
        if (!active || !target.aliveInFight) return false;
        const damage = ctx.engine.dice.roll("1d6") * mult;
        floatText(scene, target.x, target.y - 18, `${damage} acid`, "#9acd55");
        applyDamageToMonster(deps, target, damage);
        return true;
      };
      tick();
      const timer = scene.time.addEvent({
        delay: ctx.engine.config.roundMs,
        loop: true,
        callback: () => { if (!tick()) timer.destroy(); },
      });
      return;
    }
    case "lightning-bolt": {
      const direction = selection.direction ?? caster.facing;
      const inLine = (point: { x: number; y: number }) =>
        (point.x - caster.x) * direction > 0 &&
        Math.abs(point.x - caster.x) <= FAR_PX &&
        Math.abs(point.y - caster.y) <= 28;
      const monsters = deps.monsters().filter((monster) => monster.aliveInFight && inLine(monster));
      const allies = deps.party().filter((member) => member !== caster && !member.character.dead && inLine(member));
      for (const monster of monsters) applyDamageToMonster(deps, monster, ctx.engine.dice.roll("3d6") * mult);
      for (const ally of allies) ctx.engine.damageCharacter(ally.character, ctx.engine.dice.roll("3d6") * mult);
      ctx.say(`Lightning tears ${direction < 0 ? "left" : "right"}, striking ${monsters.length + allies.length} creature${monsters.length + allies.length === 1 ? "" : "s"}.`, "#86c8ff");
      return;
    }
    case "cloudkill": {
      const point = selection.point ?? preferredTarget ?? { x: caster.x + caster.facing * NEAR_PX, y: caster.y };
      const cloud = scene.add.circle(point.x, point.y, NEAR_PX, 0x9aaa36, 0.28).setDepth(7);
      let rounds = 5 * mult;
      const timer = scene.time.addEvent({
        delay: ctx.engine.config.roundMs,
        loop: true,
        callback: () => {
          rounds--;
          for (const monster of deps.monsters().filter((candidate) => candidate.aliveInFight && Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) <= NEAR_PX)) {
            monster.spellDisadvantageNextAction = true;
            const level = Number(/^([0-9]+)d/.exec(monster.def.hitDice)?.[1] ?? 99);
            if (level <= 9 && rounds < 5 * mult - 1) applyDamageToMonster(deps, monster, monster.hp);
            else applyDamageToMonster(deps, monster, ctx.engine.dice.roll("2d6") * mult);
          }
          for (const ally of deps.party().filter((member) => !member.character.dead && Phaser.Math.Distance.Between(point.x, point.y, member.x, member.y) <= NEAR_PX)) {
            applyCondition(ally.character, "blinded", { unit: "rounds", remaining: 1 });
            ctx.engine.damageCharacter(ally.character, ctx.engine.dice.roll("2d6") * mult);
          }
          if (rounds <= 0) { timer.destroy(); cloud.destroy(); }
        },
      });
      ctx.say("A yellow poison cloud spreads around the chosen point for 5 rounds.", "#a8b84e");
      return;
    }
    case "prismatic-orb": {
      const target = isValidSpellTarget(caster, preferredTarget, FAR_PX) ? preferredTarget : nearestMonster(deps, caster, FAR_PX);
      if (!target) { ctx.say("No target is in range for Prismatic Orb."); return; }
      const energy = selection.choice ?? "fire";
      const id = target.def.id.toLowerCase();
      const anathema =
        (energy === "cold" && /(fire|flame|demon|imp)/.test(id)) ||
        (energy === "fire" && /(frost|ice|winter|draugr)/.test(id)) ||
        (energy === "electricity" && /(sea|water|deep|nymph)/.test(id));
      const damage = ctx.engine.dice.roll("3d8") * mult * (anathema ? 2 : 1);
      applyDamageToMonster(deps, target, damage);
      ctx.say(`${energy} energy strikes ${target.def.name} for ${damage}${anathema ? " — ANATHEMA!" : ""}.`, "#e7a9ff");
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
      const wounded = selection.ally ?? deps
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
    case "holy-weapon": {
      caster.character.removeEffect("spell-holy-weapon");
      caster.character.addEffect({
        id: "spell-holy-weapon",
        name: "Holy Weapon (+1 attack and damage)",
        hooks: [
          { kind: "checkBonus", applies: "attack", bonus: mult },
          { kind: "damageBonus", bonus: mult },
        ],
        duration: { unit: "rounds", remaining: 5 * mult },
      });
      ctx.say(`${caster.character.name}'s weapon shines with sacred power (+${mult}).`, "#f0e090");
      return;
    }
    case "shield-of-faith": {
      caster.character.removeEffect("spell-shield-of-faith");
      caster.character.addEffect({
        id: "spell-shield-of-faith",
        name: "Shield of Faith (+2 AC)",
        hooks: [{ kind: "acBonus", bonus: 2 * mult }],
        duration: { unit: "rounds", remaining: 5 * mult },
      });
      ctx.say(`Faith surrounds ${caster.character.name} (+${2 * mult} AC).`, "#f0e090");
      return;
    }
    case "bless": {
      const blessed = selection.ally ?? deps.party()
        .filter(
          (member) =>
            !member.character.dead &&
            !member.character.luckToken &&
            Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) <= CLOSE_PX,
        )[0];
      if (!blessed) {
        ctx.say("Everyone close already holds a luck token.", "#f0e090");
        return;
      }
      blessed.character.luckToken = true;
      floatText(scene, blessed.x, blessed.y - 22, "LUCK RESTORED", "#ffe486");
      ctx.say(`${blessed.character.name} receives a fresh luck token.`, "#f0e090");
      return;
    }
    case "smite": {
      const target = isValidSpellTarget(caster, preferredTarget, NEAR_PX)
        ? preferredTarget
        : nearestMonster(deps, caster, NEAR_PX);
      if (!target) {
        ctx.say("No foe stands within reach of the divine flame.");
        return;
      }
      const dmg = ctx.engine.dice.roll(def.dice!) * mult;
      floatText(scene, target.x, target.y - 16, `${dmg}`, "#ffe06a");
      applyDamageToMonster(deps, target, dmg);
      ctx.say(`Divine flame smites the ${target.def.name} for ${dmg}.`, "#f0e090");
      return;
    }
    case "cauldron": {
      const stored = caster.character.classState.cauldronItems;
      if (stored.length > 0) {
        for (const entry of stored) {
          const defn = item(entry.itemId);
          if (caster.character.inventory.canAdd(defn, entry.qty)) caster.character.inventory.add(defn, entry.qty);
        }
        caster.character.classState.cauldronItems = [];
        ctx.say("The cauldron expels its stored gear.", "#c8a5e8");
        return;
      }
      const itemId = selection.objectItemId;
      if (!itemId) {
        ctx.say("The cauldron croaks once, then vanishes without an offering.", "#a0a4b0");
        return;
      }
      const defn = item(itemId);
      const state = caster.character.itemState.get(itemId);
      if (state.broken && !defn.tags.includes("magic")) {
        caster.character.itemState.repair(itemId);
        ctx.say(`${defn.name} emerges repaired.`, "#72d887");
        return;
      }
      if (defn.slotCost > 3 || !caster.character.inventory.has(itemId)) {
        ctx.say(`${defn.name} cannot fit in the cauldron.`, "#d07070");
        return;
      }
      caster.character.inventory.remove(itemId, 1);
      caster.character.classState.cauldronItems = [{ itemId, qty: 1 }];
      ctx.say(`${defn.name} is held safely inside the vanished cauldron.`, "#c8a5e8");
      return;
    }
    case "spidersilk": {
      caster.character.addEffect({
        id: "focus:spidersilk",
        name: "Focus: Spidersilk (wall walking)",
        hooks: [{ kind: "canClimbWalls" }, { kind: "focusSpell", spellId: def.id, tier: def.tier }],
        duration: { unit: "focus", remaining: 0 },
      });
      ctx.say(`${caster.character.name}'s hands and feet cling like a spider's.`, "#c8a5e8");
      return;
    }
    case "cats-eye": {
      caster.character.addEffect({
        id: "focus:cats-eye",
        name: "Focus: Cat's Eye",
        hooks: [{ kind: "seeInvisible" }, { kind: "focusSpell", spellId: def.id, tier: def.tier }],
        duration: { unit: "focus", remaining: 0 },
      });
      const revealed = deps.revealSecrets?.(caster);
      ctx.say(revealed ? `Cat's Eye reveals ${revealed}.` : "Invisible outlines and hidden seams sharpen into view.", "#c8a5e8");
      return;
    }
    case "bogboil": {
      const point = selection.point ?? preferredTarget ?? { x: caster.x + caster.facing * NEAR_PX, y: caster.y };
      const bog = scene.add.rectangle(point.x, point.y, NEAR_PX * 1.25, TILE * 0.8, 0x5f4a2a, 0.72).setDepth(8);
      scene.physics.add.existing(bog, true);
      for (const member of deps.party()) scene.physics.add.collider(member, bog);
      for (const monster of deps.monsters()) scene.physics.add.collider(monster, bog);
      scene.time.delayedCall(ctx.engine.config.roundMs * 5 * mult, () => bog.destroy());
      ctx.say("The chosen ground boils into impassable quicksand for 5 rounds.", "#9a7748");
      return;
    }
    case "witchlight": {
      const origin = deps.spellOrigin?.(caster) ?? { x: caster.x, y: caster.y };
      caster.character.addEffect({
        id: "focus:witchlight",
        name: "Focus: Witchlight",
        hooks: [
          { kind: "emitsLight" },
          { kind: "focusSpell", spellId: def.id, tier: def.tier },
          { kind: "focusPoint", x: origin.x, y: origin.y },
        ],
        duration: { unit: "focus", remaining: 0 },
      });
      deps.light.addSource(
        TORCH_RADIUS,
        () => caster.character.effects.some((effect) => effect.id === "focus:witchlight") && !caster.character.dead
          ? (() => {
              const effect = caster.character.effects.find((candidate) => candidate.id === "focus:witchlight");
              const point = effect?.hooks.find((hook) => hook.kind === "focusPoint");
              return point && point.kind === "focusPoint" ? { x: point.x, y: point.y } : origin;
            })()
          : null,
        { tint: 0x9a7cff, tintAlpha: 0.55 },
      );
      ctx.say(`A violet witchlight answers ${caster.character.name}.`, "#b699ff");
      return;
    }
    case "fog": {
      caster.character.addEffect({
        id: "focus:fog",
        name: "Focus: Fog (concealed)",
        hooks: [{ kind: "obscured" }, { kind: "focusSpell", spellId: def.id, tier: def.tier }],
        duration: { unit: "focus", remaining: 0 },
      });
      ctx.say(`Fog closes around ${caster.character.name}, concealing every movement.`, "#b8c4df");
      return;
    }
    case "chant": {
      caster.character.addEffect({
        id: "focus:chant",
        name: "Focus: Chant (secrets and hidden creatures revealed)",
        hooks: [{ kind: "seeInvisible" }, { kind: "focusSpell", spellId: def.id, tier: def.tier }],
        duration: { unit: "focus", remaining: 0 },
      });
      ctx.say(`${caster.character.name}'s chant makes hidden outlines shimmer.`, "#f0d98f");
      return;
    }
    case "trance": {
      const blessed = selection.ally ?? deps.party()
        .filter((member) => member !== caster && !member.character.dead && !member.character.luckToken)
        .filter((member) => Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) <= CLOSE_PX)[0];
      if (!blessed) {
        ctx.say("Every nearby crawler already holds Luck.", "#f0d98f");
        return;
      }
      blessed.character.luckToken = true;
      floatText(scene, blessed.x, blessed.y - 22, "LUCK RESTORED", "#ffe486");
      ctx.say(`${blessed.character.name} sees a favorable path through fate.`, "#f0d98f");
      return;
    }
    case "seer-potion": {
      const target = selection.ally ?? deps.party()
        .filter((member) => !member.character.dead)
        .filter((member) => Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) <= CLOSE_PX)
        .sort((a, b) => Number(Boolean(b.character.dying)) - Number(Boolean(a.character.dying)))[0];
      if (!target) {
        ctx.say("No living ally is close enough for the remedy.", "#d07070");
        return;
      }
      if (hasCondition(target.character, "poisoned")) {
        removeCondition(target.character, "poisoned");
        floatText(scene, target.x, target.y - 22, "POISON CURED", "#72d887");
      } else if (target.character.dying) {
        target.character.heal(1);
        applyCondition(target.character, "sleeping", { unit: "untilRest", remaining: 0 });
        floatText(scene, target.x, target.y - 22, "STABILIZED", "#72d887");
      } else {
        ctx.say("The conjured remedy finds no poison or mortal wound.", "#a0a4b0");
        return;
      }
      ctx.say(`${caster.character.name}'s brief potion saves ${target.character.name}.`, "#72d887");
      return;
    }
    case "howl": {
      const victims = deps.monsters().filter(
        (monster) => monster.aliveInFight && !monster.def.leader && Phaser.Math.Distance.Between(caster.x, caster.y, monster.x, monster.y) <= NEAR_PX,
      );
      let fled = 0;
      for (const victim of victims) {
        if (!moraleCheck(ctx.engine.dice, victim.def).holds) { victim.flee(); fled++; }
      }
      ctx.say(victims.length > 0 ? `${fled} of ${victims.length} foes flee the howl.` : "The howl echoes unanswered.", "#c8a5e8");
      return;
    }
    case "broomstick": {
      caster.character.addEffect({
        id: "focus:broomstick",
        name: "Focus: Broomstick (flying)",
        hooks: [{ kind: "canFly" }, { kind: "focusSpell", spellId: def.id, tier: def.tier }],
        duration: { unit: "focus", remaining: 0 },
      });
      ctx.say(`${caster.character.name} rises into controlled flight.`, "#c8a5e8");
      return;
    }
    case "wolfshape": {
      caster.character.addEffect({
        id: "focus:wolfshape",
        name: "Focus: Wolfshape",
        hooks: [
          { kind: "statMinimum", stat: "STR", value: 14 },
          { kind: "statMinimum", stat: "DEX", value: 15 },
          { kind: "statMinimum", stat: "CON", value: 13 },
          { kind: "acMinimum", value: caster.character.level >= 5 ? 15 : 13 },
          { kind: "damageBonus", bonus: caster.character.level >= 5 ? 4 : 2 },
          { kind: "speedBonus", bonus: 45 },
          { kind: "focusSpell", spellId: def.id, tier: def.tier },
        ],
        duration: { unit: "focus", remaining: 0 },
      });
      ctx.say(`${caster.character.name} folds into the shape of a hunting wolf.`, "#c8a5e8");
      return;
    }
    case "cast-out": {
      const target = isValidSpellTarget(caster, preferredTarget, FAR_PX) ? preferredTarget : nearestMonster(deps, caster, FAR_PX);
      if (!target) { ctx.say("No creature is in range to cast out."); return; }
      caster.character.addEffect({
        id: "focus:cast-out",
        name: "Focus: Cast Out (close no-entry zone)",
        hooks: [
          { kind: "focusSpell", spellId: def.id, tier: def.tier },
          { kind: "focusTarget", targetId: target.groupId + ":" + target.x + ":" + target.y },
        ],
        duration: { unit: "focus", remaining: 0 },
      });
      target.spellCastOutCasterId = caster.character.id;
      if (Phaser.Math.Distance.Between(caster.x, caster.y, target.x, target.y) < NEAR_PX) {
        target.setVelocityX(target.x < caster.x ? -target.speed : target.speed);
      }
      ctx.say(`${target.def.name} cannot come within near range while ${caster.character.name} focuses.`, "#f0d98f");
      return;
    }
    case "read-runes": {
      const answer = deps.answerDivination?.(selection.choice ?? "secret") ?? "No.";
      ctx.say(`The runes answer: ${answer}`, "#f0d98f");
      return;
    }
    case "speak-with-dead": {
      const answer = deps.answerDivination?.(selection.choice ?? "danger") ?? "The corpse has nothing more to say.";
      ctx.say(`The corpse wheezes: “${answer}”`, "#b8c4df");
      return;
    }
    case "evoke-rage": {
      const target = selection.ally ?? deps.party().find((member) => !member.character.dead && member !== caster && zoneBetween(caster, member) === "close");
      if (!target) { ctx.say("No willing ally is close enough."); return; }
      const rounds = ctx.engine.dice.roll("1d4") * mult;
      target.lastOffensiveActionAt = scene.time.now;
      target.character.addEffect({
        id: "spell:evoke-rage",
        name: `Evoke Rage (${rounds} rounds)`,
        hooks: [
          { kind: "advantageOnStat", stat: "STR" },
          { kind: "advantageOn", applies: "attack" },
          { kind: "extraDamageDice", dice: "1d4" },
          { kind: "moraleImmune" },
        ],
        duration: { unit: "rounds", remaining: rounds },
      });
      ctx.say(`${target.character.name} enters a berserk rage for ${rounds} rounds.`, "#e68a65");
      return;
    }
    case "fate": {
      const target = isValidSpellTarget(caster, preferredTarget, NEAR_PX) ? preferredTarget : nearestMonster(deps, caster, NEAR_PX);
      if (!target) { ctx.say("No creature's fate is within reach."); return; }
      const damage = ctx.engine.dice.roll("1d10") * mult;
      target.spellDisadvantageNextAction = true;
      applyDamageToMonster(deps, target, damage);
      ctx.say(`${target.def.name}'s fate twists for ${damage}; its next action has disadvantage.`, "#f0d98f");
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
  if (typeof data.redirectDamageDice === "string") {
    const redirected = deps.party()
      .filter((member) => member.alive && member !== caster)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(caster.x, caster.y, a.x, a.y) -
          Phaser.Math.Distance.Between(caster.x, caster.y, b.x, b.y),
      )[0] ?? caster;
    const damage = ctx.engine.dice.roll(data.redirectDamageDice);
    floatText(scene, redirected.x, redirected.y - 16, `-${damage} redirected`, "#ff4060");
    ctx.engine.damageCharacter(redirected.character, damage);
  }
  if (effects && effects.length > 0) {
    caster.character.addEffect({
      id: `mishap-${result.mishap!.table.id}-${result.mishap!.roll}-${Math.floor(ctx.engine.clock.elapsedMs)}`,
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
  if (typeof data.vanishGear === "number") {
    let vanished = 0;
    for (let count = 0; count < data.vanishGear; count++) {
      const stacks = [...caster.character.inventory.all()];
      if (stacks.length === 0) break;
      const start = ctx.engine.dice.between(0, stacks.length - 1);
      let removed = false;
      for (let offset = 0; offset < stacks.length; offset++) {
        const stack = stacks[(start + offset) % stacks.length]!;
        try {
          caster.character.inventory.remove(stack.def.id, 1);
          if (caster.character.wieldedWeapon?.id === stack.def.id) caster.character.wieldedWeapon = null;
          if (caster.character.wornArmor?.id === stack.def.id) caster.character.wornArmor = null;
          if (caster.character.carriedShield?.id === stack.def.id) caster.character.carriedShield = null;
          vanished++;
          removed = true;
          break;
        } catch {
          // A capacity-granting container cannot vanish while doing so would
          // invalidate inventory; try another item, then use the safe fallback.
        }
      }
      if (!removed) break;
    }
    if (vanished > 0) ctx.say(`${vanished} carried ${vanished === 1 ? "item vanishes" : "items vanish"}.`, "#ff8a60");
    else ctx.say("The magic claws at your gear, but finds nothing it can safely take.", "#a0a4b0");
  }
  if (typeof data.beaconRounds === "number") {
    const sourceId = deps.light.addSource(
      TORCH_RADIUS * 1.25,
      () => (caster.character.dead ? null : { x: caster.x, y: caster.y }),
      { tint: 0xb65cff, tintAlpha: 0.7 },
    );
    scene.time.delayedCall(data.beaconRounds * ctx.engine.config.roundMs, () => deps.light.removeSource(sourceId));
  }
  if (data.sinkhole === true) {
    const radius = data.sinkholeRadius === "close" ? CLOSE_PX : 26;
    const victims = deps.party().filter(
      (member) => member.alive && Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) <= radius,
    );
    const crack = scene.add.circle(caster.x, caster.y + 15, radius, 0x120d16, 0.82).setDepth(7);
    scene.tweens.add({ targets: crack, alpha: 0, scale: 1.35, duration: 1400, onComplete: () => crack.destroy() });
    for (const victim of victims) {
      victim.setVelocityY(180);
      if (typeof data.fallbackDamageDice === "string") {
        const damage = ctx.engine.dice.roll(data.fallbackDamageDice);
        ctx.engine.damageCharacter(victim.character, damage);
        floatText(scene, victim.x, victim.y - 16, `-${damage} sinkhole`, "#bd6f55");
      }
    }
  }
  if (data.portal === true) {
    const portal = scene.add.circle(caster.x + caster.facing * 38, caster.y - 4, 22, 0x6d1f8f, 0.7).setDepth(18);
    scene.tweens.add({ targets: portal, angle: 180, alpha: 0, scale: 1.7, duration: 1300, onComplete: () => portal.destroy() });
  }
  if (typeof data.summonMonsterId === "string" && typeof data.summonCount === "number") {
    if (deps.spawnHostile) {
      for (let index = 0; index < data.summonCount; index++) {
        deps.spawnHostile(data.summonMonsterId, caster.x + caster.facing * (42 + index * 24), caster.y);
      }
    } else {
      for (const monster of deps.monsters()) if (monster.aliveInFight) monster.aiState = "aggro";
      ctx.say("The portal cannot find stable ground; its howl alerts the dungeon instead.", "#ff8a60");
    }
  }
  if (typeof data.loseSpell === "string") {
    const candidates = caster.character.knownSpells.filter((known) => known.spellId !== result.spell.id);
    if (data.loseSpell === "all-temporary") {
      for (const known of candidates) known.status = "lost";
    } else if (candidates.length > 0) {
      const index = ctx.engine.dice.between(0, candidates.length - 1);
      const chosen = candidates[index]!;
      if (data.loseSpell === "permanent" && caster.character.knownSpells.length > 1) {
        caster.character.knownSpells = caster.character.knownSpells.filter((known) => known !== chosen);
        ctx.say(`${spell(chosen.spellId).name} is permanently torn from ${caster.character.name}'s mind.`, "#ff4060");
      } else {
        chosen.status = "lost";
        ctx.say(`${spell(chosen.spellId).name} is also lost until rest.`, "#ff8a60");
      }
    }
  }
  if (typeof data.laughterRounds === "number") {
    applyCondition(caster.character, "silenced", { unit: "rounds", remaining: data.laughterRounds });
    if (data.frightened === true) applyCondition(caster.character, "frightened", { unit: "rounds", remaining: data.laughterRounds });
  }
  if (typeof data.saltPrisonRounds === "number") {
    applyCondition(caster.character, "grappled", { unit: "rounds", remaining: data.saltPrisonRounds });
    caster.setVelocity(0, 0);
    const prison = scene.add.circle(caster.x, caster.y + 10, 25, 0xf1eee2, 0.22).setStrokeStyle(3, 0xf5f0df, 0.9).setDepth(17);
    scene.time.delayedCall(data.saltPrisonRounds * ctx.engine.config.roundMs, () => prison.destroy());
  }
  if (typeof data.swampGasDice === "string") {
    const radius = data.swampGasRadius === "near" ? NEAR_PX : CLOSE_PX;
    const rounds = typeof data.swampGasRounds === "number" ? data.swampGasRounds : 2;
    const cloud = scene.add.circle(caster.x, caster.y, radius, 0x557a32, 0.24).setDepth(16);
    scene.time.delayedCall(rounds * ctx.engine.config.roundMs, () => cloud.destroy());
    for (const member of deps.party()) {
      if (!member.alive || Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) > radius) continue;
      const damage = ctx.engine.dice.roll(data.swampGasDice);
      ctx.engine.damageCharacter(member.character, damage);
      applyCondition(member.character, "poisoned", { unit: "rounds", remaining: rounds });
      floatText(scene, member.x, member.y - 16, `-${damage} swamp gas`, "#8db34c");
    }
  }
  if (typeof data.saltBurstRounds === "number") {
    for (const member of deps.party()) {
      if (!member.alive || Phaser.Math.Distance.Between(caster.x, caster.y, member.x, member.y) > CLOSE_PX) continue;
      applyCondition(member.character, "blinded", { unit: "rounds", remaining: data.saltBurstRounds });
      if (data.saltPrisonParty === true) {
        applyCondition(member.character, "grappled", { unit: "rounds", remaining: data.saltBurstRounds });
      }
    }
  }
  const tear = typeof data.magicTearRounds === "number"
    ? scene.add.circle(caster.x + caster.facing * 30, caster.y - 12, 13, 0xd54cff, 0.78).setDepth(18)
    : null;
  if (tear && typeof data.magicTearRounds === "number" && typeof data.tearDamageDice === "string") {
    for (let round = 1; round <= data.magicTearRounds; round++) {
      scene.time.delayedCall(round * ctx.engine.config.roundMs, () => {
        if (!tear.active) return;
        const victim = deps.party().filter((member) => member.alive)
          .sort((a, b) => Phaser.Math.Distance.Between(tear.x, tear.y, a.x, a.y) - Phaser.Math.Distance.Between(tear.x, tear.y, b.x, b.y))[0];
        if (victim) {
          const damage = ctx.engine.dice.roll(data.tearDamageDice as string);
          ctx.engine.damageCharacter(victim.character, damage);
          floatText(scene, victim.x, victim.y - 16, `-${damage} tear`, "#d54cff");
          if (data.poisonTear === true) applyCondition(victim.character, "poisoned", { unit: "rounds", remaining: 2 });
        }
        if (round === data.magicTearRounds) tear.destroy();
      });
    }
  } else if (tear && typeof data.magicTearRounds === "number") {
    scene.time.delayedCall(data.magicTearRounds * ctx.engine.config.roundMs, () => tear.destroy());
  }
  if (data.patronDispleasure === true && (!effects || effects.length === 0)) {
    caster.character.addEffect({
      id: `patron-displeasure-${Math.floor(ctx.engine.clock.elapsedMs)}`,
      name: "Patron Displeasure",
      hooks: [{ kind: "disadvantageOn", applies: "spellcast" }],
      duration: { unit: "untilRest", remaining: 0 },
    });
  }
  if (data.repeatCast === true) {
    const count = typeof data.repeatCount === "number" ? data.repeatCount : 1;
    for (let repeat = 0; repeat < count; repeat++) {
      const invoke = () => resolveSpellEffect(deps, caster, { ...result, outcome: "success", doubled: false });
      if (typeof data.magicTearRounds === "number") {
        scene.time.delayedCall((repeat + 1) * ctx.engine.config.roundMs, invoke);
      } else {
        invoke();
      }
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
