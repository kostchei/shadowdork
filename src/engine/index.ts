/**
 * Engine facade. Owns the dice, clock, tables, and event log; exposes the
 * rules operations the game layer calls. Pure TS — no Phaser imports.
 */

import { awardXp, canLevelUp, levelUp, type LevelUpResult, type XpAward } from "./advancement";
import { Character } from "./character";
import { ignoreAttackDamage, pitFighterLastStandThreshold, restoreClassResources } from "./classAbilities";
import { DC, resolveCheck, type CheckInput, type CheckResult } from "./check";
import { Dice } from "./dice";
import { EventLog } from "./events";
import type { ItemDef } from "./inventory";
import { restoreOnRest } from "./itemActions";
import {
  castSpell,
  castSpellFromItem,
  acceptPendingMishap,
  spendLuckOnPendingMishap,
  type CastSource,
  completePenance,
  recoverSpells,
  type CastResult,
  type SpellDef,
} from "./spells";
import { TableRegistry, type TableRollResult } from "./tables";
import { DEFAULT_CONFIG, GameClock, type EngineConfig } from "./time";

export * from "./advancement";
export * from "./character";
export * from "./check";
export * from "./classAbilities";
export * from "./conditions";
export * from "./dice";
export * from "./effects";
export * from "./encounterReaction";
export * from "./events";
export * from "./inventory";
export * from "./itemActions";
export * from "./monster";
export * from "./potions";
export * from "./spells";
export * from "./tables";
export * from "./talents";
export * from "./time";

export interface AttackInput {
  attacker: Character;
  targetAc: number;
  /** Damage dice of the weapon/spell used, e.g. "1d8". */
  damage: string;
  /** Attack stat. Melee defaults to STR; finesse picks the better of STR/DEX; ranged is DEX. */
  weapon?: ItemDef;
  /** Extra weapon damage dice on a hit (thief backstab: 1 + half level). */
  extraDamageDice?: number;
  advantage?: readonly string[];
  disadvantage?: readonly string[];
}

export interface AttackResult {
  check: CheckResult;
  damage: number;
}

export class Engine {
  readonly dice: Dice;
  readonly tables = new TableRegistry();
  readonly clock: GameClock;
  readonly log = new EventLog();

  private characters = new Map<string, Character>();

  constructor(opts: { seed?: number; config?: EngineConfig } = {}) {
    this.dice = new Dice(opts.seed);
    this.clock = new GameClock(opts.config ?? DEFAULT_CONFIG);
    this.clock.onRound(() => this.tickRound());
  }

  get config(): EngineConfig {
    return this.clock.config;
  }

  registerCharacter(c: Character): void {
    if (this.characters.has(c.id)) throw new Error(`Duplicate character id "${c.id}"`);
    this.characters.set(c.id, c);
  }

  character(id: string): Character {
    const c = this.characters.get(id);
    if (!c) throw new Error(`Unknown character "${id}"`);
    return c;
  }

  allCharacters(): readonly Character[] {
    return [...this.characters.values()];
  }

  /** Game loop entry point: advances all engine time. */
  advance(deltaMs: number): void {
    this.clock.advance(deltaMs);
    for (const c of this.characters.values()) {
      c.effects = c.effects.filter((e) => {
        if (e.duration?.unit !== "realMs") return true;
        e.duration.remaining -= deltaMs;
        if (e.duration.remaining > 0) return true;
        this.log.append(this.clock.elapsedMs, "effect.expired", { who: c.id, effect: e.id });
        return false;
      });
    }
  }

  private tickRound(): void {
    for (const c of this.characters.values()) {
      this.checkFocus(c, "round");
      // Round-based conditions tick down.
      c.effects = c.effects.filter((e) => {
        if (e.duration?.unit !== "rounds") return true;
        e.duration.remaining--;
        if (e.duration.remaining > 0) return true;
        this.log.append(this.clock.elapsedMs, "effect.expired", { who: c.id, effect: e.id });
        return false;
      });
      // Death timers count down in rounds; a natural 20 self-revives at 1 HP.
      if (c.dying && !c.dead) {
        if (this.dice.d20().natural >= pitFighterLastStandThreshold(c)) {
          c.dying = null;
          c.hp = 1;
          this.log.append(this.clock.elapsedMs, "dying.selfRevive", { who: c.id });
          continue;
        }
        c.dying.roundsRemaining--;
        this.log.append(this.clock.elapsedMs, "dying.tick", {
          who: c.id,
          roundsRemaining: c.dying.roundsRemaining,
        });
        if (c.dying.roundsRemaining <= 0) {
          c.dead = true;
          c.dying = null;
          // A corpse carries no status — every timed effect (conditions, buffs) ends here.
          c.effects = c.effects.filter((e) => !e.duration);
          this.log.append(this.clock.elapsedMs, "character.died", { who: c.id });
        }
      }
    }
  }

  /** Focus is rechecked each round and whenever damage distracts the caster. */
  private checkFocus(character: Character, reason: "round" | "damage"): boolean {
    const focus = character.effects.find((effect) =>
      effect.duration?.unit === "focus" && effect.hooks.some((hook) => hook.kind === "focusSpell"),
    );
    if (!focus || character.dead || character.dying) return true;
    const hook = focus.hooks.find((candidate) => candidate.kind === "focusSpell");
    if (!hook || hook.kind !== "focusSpell") return true;
    const stat = character.className === "wizard" ? "INT" : character.className === "witch" ? "CHA" : "WIS";
    const result = resolveCheck(this.dice, {
      actor: character,
      stat,
      dc: 10 + hook.tier,
      kind: "spellcast",
    });
    this.log.append(this.clock.elapsedMs, "focus.check", {
      who: character.id,
      spell: hook.spellId,
      reason,
      natural: result.natural,
      success: result.success,
    });
    if (result.success) return true;
    character.effects = character.effects.filter((effect) => effect.duration?.unit !== "focus");
    return false;
  }

  check(input: CheckInput): CheckResult {
    const result = resolveCheck(this.dice, input);
    this.log.append(this.clock.elapsedMs, "check", {
      who: input.actor.id,
      kind: input.kind,
      stat: input.stat,
      dc: input.dc,
      natural: result.natural,
      total: result.total,
      success: result.success,
      crit: result.crit,
      fumble: result.fumble,
    });
    return result;
  }

  attack(input: AttackInput): AttackResult {
    // Ranged weapons use DEX. Finesse melee weapons use the better of STR/DEX.
    const finesse = input.weapon?.finesse === true;
    const ranged = input.weapon?.tags.includes("ranged") === true;
    const a = input.attacker;
    const stat = ranged || (finesse && a.mod("DEX") > a.mod("STR")) ? "DEX" : "STR";
    const melee = !ranged;
    const check = this.check({
      actor: a,
      stat,
      dc: input.targetAc,
      kind: melee ? "meleeAttack" : "attack",
      advantage: input.advantage,
      disadvantage: input.disadvantage,
    });
    let damage = 0;
    if (check.success) {
      const diceRolls = 1 + (input.extraDamageDice ?? 0);
      for (let i = 0; i < diceRolls; i++) damage += this.dice.roll(input.damage);
      for (const effect of a.effects) {
        for (const hook of effect.hooks) {
          if (hook.kind === "extraDamageDice") damage += this.dice.roll(hook.dice);
        }
      }
      damage += a.damageBonus;
      if (melee) for (const effect of a.effects) for (const hook of effect.hooks) {
        if (hook.kind === "meleeDamageBonus") damage += hook.bonus;
      }
      // Crits double the damage dice (all of them, backstab dice included).
      if (check.crit) for (let i = 0; i < diceRolls; i++) damage += this.dice.roll(input.damage);
      damage = Math.max(1, damage);
    }
    this.log.append(this.clock.elapsedMs, "attack", {
      who: a.id,
      stat,
      hit: check.success,
      crit: check.crit,
      damage,
    });
    return { check, damage };
  }

  cast(caster: Character, spell: SpellDef, opts?: Parameters<typeof castSpell>[4]): CastResult {
    const result = castSpell(this.dice, this.tables, caster, spell, opts);
    this.log.append(this.clock.elapsedMs, "cast", {
      who: caster.id,
      spell: spell.id,
      outcome: result.outcome,
      natural: result.check.natural,
      mishap: result.mishap?.entry.text,
    });
    return result;
  }

  castItem(caster: Character, spell: SpellDef, opts?: Parameters<typeof castSpellFromItem>[4]): CastResult {
    const result = castSpellFromItem(this.dice, this.tables, caster, spell, opts);
    this.log.append(this.clock.elapsedMs, "cast.item", {
      who: caster.id,
      spell: spell.id,
      outcome: result.outcome,
      natural: result.check.natural,
      mishap: result.mishap?.entry.text,
    });
    return result;
  }

  acceptMishap(caster: Character, pending: CastResult, source: CastSource): CastResult {
    const result = acceptPendingMishap(caster, pending, source);
    this.log.append(this.clock.elapsedMs, "cast.mishap.accepted", {
      who: caster.id,
      spell: result.spell.id,
      source,
      mishap: result.mishap?.entry.text,
    });
    return result;
  }

  spendLuckOnMishap(caster: Character, pending: CastResult): void {
    spendLuckOnPendingMishap(caster, pending);
    this.log.append(this.clock.elapsedMs, "cast.mishap.luck", {
      who: caster.id,
      spell: pending.spell.id,
    });
  }

  /** Complete divine penance; affected spells still require a later rest. */
  atone(character: Character): number {
    const completed = completePenance(character);
    this.log.append(this.clock.elapsedMs, "spells.atone", { who: character.id, completed });
    return completed;
  }

  rollTable(tableId: string, modifier = 0): TableRollResult {
    const result = this.tables.roll(this.dice, tableId, modifier);
    this.log.append(this.clock.elapsedMs, "table.roll", {
      table: tableId,
      roll: result.roll,
      entry: result.entry.text,
    });
    return result;
  }

  awardXp(character: Character, amount: number): XpAward {
    const result = awardXp(character, amount);
    this.log.append(this.clock.elapsedMs, "xp.award", {
      who: character.id,
      amount,
      xp: character.xp,
      leveledUp: result.leveledUp,
    });
    return result;
  }

  levelUp(character: Character, hitDie: string, talentTableId: string): LevelUpResult {
    const result = levelUp(this.dice, this.tables, character, hitDie, talentTableId);
    this.log.append(this.clock.elapsedMs, "level.up", {
      who: character.id,
      level: result.newLevel,
      hpGained: result.hpGained,
      talent: result.talent.entry.text,
    });
    return result;
  }

  canLevelUp(character: Character): boolean {
    return canLevelUp(character);
  }

  /** Damage that can drop a character to dying. Returns true if they went down. */
  damageCharacter(character: Character, amount: number, opts: { attack?: boolean } = {}): boolean {
    if (character.dead) throw new Error(`${character.name} is already dead`);
    if (opts.attack && (character.classState.resourceUses.ignoreAttack ?? 0) > 0) {
      ignoreAttackDamage(character);
      this.log.append(this.clock.elapsedMs, "pit-fighter.ignore-attack", { who: character.id, amount });
      return false;
    }
    if (character.effects.some((effect) => effect.hooks.some((hook) => hook.kind === "damageImmune"))) return false;
    character.takeDamage(amount);
    // Damage is a distraction: a failed spell check ends Focus without losing the known spell.
    if (character.hp === 0) {
      character.effects = character.effects.filter((effect) => effect.duration?.unit !== "focus");
    } else {
      this.checkFocus(character, "damage");
    }
    if (character.hp === 0 && !character.dying) {
      const relentless = character.classState.resourceUses.relentless ?? 0;
      if (character.className === "pit-fighter" && relentless > 0) {
        character.classState.resourceUses.relentless = relentless - 1;
        const result = resolveCheck(this.dice, { actor: character, stat: "CON", dc: DC.EXTREME, kind: "stat" });
        if (result.success) {
          character.hp = 1;
          this.log.append(this.clock.elapsedMs, "pit-fighter.relentless", { who: character.id, success: true });
          return false;
        }
      }
      const rounds = Math.max(1, this.dice.roll("1d4") + character.mod("CON"));
      character.dying = { roundsRemaining: rounds };
      this.log.append(this.clock.elapsedMs, "dying.start", { who: character.id, rounds });
      return true;
    }
    return false;
  }

  /** DC 15 INT check by a rescuer to stop a death timer (target stabilizes at 1 HP). */
  stabilize(rescuer: Character, target: Character): CheckResult {
    if (!target.dying) throw new Error(`${target.name} is not dying`);
    const result = this.check({ actor: rescuer, stat: "INT", dc: DC.HARD, kind: "stat" });
    if (result.success) {
      target.dying = null;
      target.hp = 1;
      this.log.append(this.clock.elapsedMs, "stabilized", {
        who: target.id,
        by: rescuer.id,
      });
    }
    return result;
  }

  /**
   * Rest: requires a ration in the resting character's inventory. Restores all
   * HP, recovers lost spells (not atonement-locked), clears until-rest effects.
   */
  rest(character: Character, rationDef: ItemDef): void {
    if (character.dead) throw new Error(`${character.name} is dead`);
    if (!character.inventory.has(rationDef.id)) {
      throw new Error(`${character.name} has no ${rationDef.name} — resting requires one`);
    }
    character.inventory.remove(rationDef.id, 1);
    character.heal(character.maxHp);
    recoverSpells(character);
    character.effects = character.effects.filter(
      (e) => e.duration?.unit !== "untilRest" && e.duration?.unit !== "focus",
    );
    restoreOnRest(character);
    restoreClassResources(character);
    this.log.append(this.clock.elapsedMs, "rest", { who: character.id });
  }

  /**
   * Rest-spot recovery: a safe haven between dungeons. Free — no ration.
   * Full HP, lost spells recovered, until-rest effects cleared.
   */
  freeRest(character: Character): void {
    if (character.dead) throw new Error(`${character.name} is dead`);
    character.heal(character.maxHp);
    recoverSpells(character);
    character.effects = character.effects.filter(
      (e) => e.duration?.unit !== "untilRest" && e.duration?.unit !== "focus",
    );
    restoreOnRest(character);
    restoreClassResources(character);
    this.log.append(this.clock.elapsedMs, "rest.free", { who: character.id });
  }
}
