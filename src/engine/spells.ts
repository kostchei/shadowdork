/**
 * Spellcasting state machine. No slots: casting is a spell check
 * (d20 + INT/WIS vs DC 10 + tier). Failure loses the spell until rest.
 * Nat 1: wizards roll the mishap table; priests are cut off (atonement).
 * Nat 20: effect/duration doubled.
 */

import { getBaseRole, type Character, type StatName } from "./character";
import { resolveCheck, type CheckResult } from "./check";
import type { Dice } from "./dice";
import type { TableRegistry, TableRollResult } from "./tables";

export type SpellClass = "wizard" | "priest" | "witch" | "seer";

export interface SpellDef {
  id: string;
  name: string;
  tier: number;
  class: SpellClass;
  /** "self" | "close" | "near" | "far" */
  range: string;
  /** Ends when the caster takes damage or drops focus. */
  focus: boolean;
  /** Dice healed/dealt, when applicable, e.g. "1d4". */
  dice?: string;
  /** Real-time duration for lingering spells (e.g. light), ms. */
  durationMs?: number;
  description: string;
  /** Game-facing selection shape; omitted spells resolve unambiguously. */
  target?: "self" | "ally" | "enemy" | "point" | "object" | "direction";
  /** A second explicit decision such as Prismatic Orb's energy. */
  choices?: readonly string[];
}

export type CastOutcome = "success" | "crit" | "fail" | "pendingMishap" | "mishap";
export type CastSource = "known" | "item";
export type MishapDecision = "spendLuck" | "accept";

export interface CastResult {
  spell: SpellDef;
  check: CheckResult;
  outcome: CastOutcome;
  /** Effect doubled (crit). */
  doubled: boolean;
  /** Wizard nat-1 consequence, rolled live. */
  mishap?: TableRollResult;
  /** Guards a pending natural 1 from being accepted after it was rerolled, or applied twice. */
  mishapResolution?: "accepted" | "discarded";
}

const CAST_STAT: Record<SpellClass, StatName> = {
  wizard: "INT",
  priest: "WIS",
  witch: "CHA",
  seer: "WIS",
};
export const WIZARD_MISHAP_TABLE_TIER_1_2 = "wizard-mishaps-tier-1-2";
export const WIZARD_MISHAP_TABLE_TIER_3_4 = "wizard-mishaps-tier-3-4";
export const WIZARD_MISHAP_TABLE_TIER_5 = "wizard-mishaps-tier-5";
export const WITCH_MISHAP_TABLE_TIER_1_2 = "witch-mishaps-tier-1-2";
export const WITCH_MISHAP_TABLE_TIER_3_4 = "witch-mishaps-tier-3-4";
export const WITCH_MISHAP_TABLE_TIER_5 = "witch-mishaps-tier-5";

/** Select the increasingly dangerous mishap table for the spell's tier. */
export function wizardMishapTableId(tier: number): string {
  if (tier <= 0 || tier > 5) throw new Error(`Invalid spell tier ${tier}`);
  if (tier <= 2) return WIZARD_MISHAP_TABLE_TIER_1_2;
  if (tier <= 4) return WIZARD_MISHAP_TABLE_TIER_3_4;
  return WIZARD_MISHAP_TABLE_TIER_5;
}

export function witchMishapTableId(tier: number): string {
  if (tier <= 0 || tier > 5) throw new Error(`Invalid spell tier ${tier}`);
  if (tier <= 2) return WITCH_MISHAP_TABLE_TIER_1_2;
  if (tier <= 4) return WITCH_MISHAP_TABLE_TIER_3_4;
  return WITCH_MISHAP_TABLE_TIER_5;
}

export function mishapTableId(caster: Character, tier: number): string | undefined {
  if (caster.className === "witch") return witchMishapTableId(tier);
  return getBaseRole(caster.className) === "wizard" ? wizardMishapTableId(tier) : undefined;
}

export function castingStat(spellClass: SpellClass): StatName {
  return CAST_STAT[spellClass];
}

function casterStat(caster: Character, spell: SpellDef): StatName {
  return CAST_STAT[spell.class];
}

function canCastSpellClass(caster: Character, spellClass: SpellClass): boolean {
  return caster.className === spellClass;
}

/** Beginning any new spell ends the caster's previous Focus effect. */
function dropFocus(caster: Character): void {
  caster.effects = caster.effects.filter((effect) => effect.duration?.unit !== "focus");
}

function pendingMishap(
  dice: Dice,
  tables: TableRegistry,
  caster: Character,
  spell: SpellDef,
  check: CheckResult,
): CastResult {
  const tableId = mishapTableId(caster, spell.tier);
  const mishap = tableId ? tables.roll(dice, tableId) : undefined;
  return { spell, check, outcome: "pendingMishap", doubled: false, mishap };
}

export function castSpell(
  dice: Dice,
  tables: TableRegistry,
  caster: Character,
  spell: SpellDef,
  opts: { advantage?: readonly string[]; disadvantage?: readonly string[] } = {},
): CastResult {
  const known = caster.knownSpell(spell.id);
  if (known.status === "lost") {
    throw new Error(`${spell.name} is lost until ${caster.name} rests`);
  }
  if (!canCastSpellClass(caster, spell.class)) {
    throw new Error(`${caster.name} (${caster.className}) cannot cast ${spell.class} spells`);
  }
  dropFocus(caster);

  const check = resolveCheck(dice, {
    actor: caster,
    stat: casterStat(caster, spell),
    dc: 10 + spell.tier,
    kind: "spellcast",
    advantage: opts.advantage,
    disadvantage: opts.disadvantage,
  });

  if (check.fumble) {
    return pendingMishap(dice, tables, caster, spell, check);
  }

  if (!check.success) {
    known.status = "lost";
    return { spell, check, outcome: "fail", doubled: false };
  }

  return {
    spell,
    check,
    outcome: check.natural === 20 ? "crit" : "success",
    doubled: check.natural === 20,
  };
}

/**
 * Cast a spell supplied by an item. This uses the normal class list, DC,
 * advantage, critical, and mishap rules but never reads or mutates a known
 * spell slot; the caller owns scroll/wand consumption state.
 */
export function castSpellFromItem(
  dice: Dice,
  tables: TableRegistry,
  caster: Character,
  spell: SpellDef,
  opts: { advantage?: readonly string[]; disadvantage?: readonly string[] } = {},
): CastResult {
  if (!canCastSpellClass(caster, spell.class)) {
    throw new Error(`${caster.name} (${caster.className}) cannot cast ${spell.class} spells`);
  }
  dropFocus(caster);

  const check = resolveCheck(dice, {
    actor: caster,
    stat: casterStat(caster, spell),
    dc: 10 + spell.tier,
    kind: "spellcast",
    advantage: opts.advantage,
    disadvantage: opts.disadvantage,
  });

  if (check.fumble) {
    return pendingMishap(dice, tables, caster, spell, check);
  }
  if (!check.success) return { spell, check, outcome: "fail", doubled: false };
  return {
    spell,
    check,
    outcome: check.natural === 20 ? "crit" : "success",
    doubled: check.natural === 20,
  };
}

/** Commit a previewed natural-1 consequence exactly once. */
export function acceptPendingMishap(
  caster: Character,
  pending: CastResult,
  source: CastSource,
): CastResult {
  if (pending.outcome !== "pendingMishap") throw new Error("Cast has no pending mishap");
  if (pending.mishapResolution) throw new Error(`Pending mishap was already ${pending.mishapResolution}`);
  pending.mishapResolution = "accepted";
  if (source === "known") {
    const known = caster.knownSpell(pending.spell.id);
    known.status = "lost";
    if (getBaseRole(caster.className) === "priest") known.requiresAtonement = true;
  }
  return { ...pending, outcome: "mishap", mishapResolution: "accepted" };
}

/** Permanently invalidate a preview because Luck is rerolling that check. */
export function discardPendingMishap(pending: CastResult): void {
  if (pending.outcome !== "pendingMishap") throw new Error("Cast has no pending mishap");
  if (pending.mishapResolution) throw new Error(`Pending mishap was already ${pending.mishapResolution}`);
  pending.mishapResolution = "discarded";
}

/** Atomically spend Luck and invalidate the exact consequence being rerolled. */
export function spendLuckOnPendingMishap(caster: Character, pending: CastResult): void {
  if (!caster.luckToken) throw new Error(`${caster.name} has no Luck token`);
  discardPendingMishap(pending);
  caster.luckToken = false;
}

/** Player decisions valid for this exact unresolved natural-1 result. */
export function availableMishapDecisions(
  caster: Character,
  pending: CastResult,
): readonly MishapDecision[] {
  if (pending.outcome !== "pendingMishap" || pending.mishapResolution) return [];
  return caster.luckToken ? ["spendLuck", "accept"] : ["accept"];
}

/** Rest recovery: every lost spell (except those awaiting atonement) becomes available. */
export function recoverSpells(caster: Character): void {
  for (const s of caster.knownSpells) {
    if (s.status === "lost" && !s.requiresAtonement) s.status = "available";
  }
}

/** Complete divine penance; affected spells still require a subsequent rest. */
export function completePenance(caster: Character): number {
  let completed = 0;
  for (const s of caster.knownSpells) {
    if (!s.requiresAtonement) continue;
    s.requiresAtonement = false;
    completed++;
  }
  return completed;
}
