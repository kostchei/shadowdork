/**
 * Spellcasting state machine. No slots: casting is a spell check
 * (d20 + INT/WIS vs DC 10 + tier). Failure loses the spell until rest.
 * Nat 1: wizards roll the mishap table; priests are cut off (atonement).
 * Nat 20: effect/duration doubled.
 */

import type { Character, StatName } from "./character";
import { resolveCheck, type CheckResult } from "./check";
import type { Dice } from "./dice";
import type { TableRegistry, TableRollResult } from "./tables";

export type SpellClass = "wizard" | "priest";

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
}

export type CastOutcome = "success" | "crit" | "fail" | "mishap";

export interface CastResult {
  spell: SpellDef;
  check: CheckResult;
  outcome: CastOutcome;
  /** Effect doubled (crit). */
  doubled: boolean;
  /** Wizard nat-1 consequence, rolled live. */
  mishap?: TableRollResult;
}

const CAST_STAT: Record<SpellClass, StatName> = { wizard: "INT", priest: "WIS" };
export const WIZARD_MISHAP_TABLE_TIER_1_2 = "wizard-mishaps-tier-1-2";
export const WIZARD_MISHAP_TABLE_TIER_3_4 = "wizard-mishaps-tier-3-4";
export const WIZARD_MISHAP_TABLE_TIER_5 = "wizard-mishaps-tier-5";

/** Select the increasingly dangerous mishap table for the spell's tier. */
export function wizardMishapTableId(tier: number): string {
  if (tier <= 0 || tier > 5) throw new Error(`Invalid spell tier ${tier}`);
  if (tier <= 2) return WIZARD_MISHAP_TABLE_TIER_1_2;
  if (tier <= 4) return WIZARD_MISHAP_TABLE_TIER_3_4;
  return WIZARD_MISHAP_TABLE_TIER_5;
}

export function castingStat(spellClass: SpellClass): StatName {
  return CAST_STAT[spellClass];
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
  if (caster.className !== spell.class) {
    throw new Error(`${caster.name} (${caster.className}) cannot cast ${spell.class} spells`);
  }

  const check = resolveCheck(dice, {
    actor: caster,
    stat: CAST_STAT[spell.class],
    dc: 10 + spell.tier,
    kind: "spellcast",
    advantage: opts.advantage,
    disadvantage: opts.disadvantage,
  });

  if (check.fumble) {
    known.status = "lost";
    if (spell.class === "wizard") {
      const mishap = tables.roll(dice, wizardMishapTableId(spell.tier));
      return { spell, check, outcome: "mishap", doubled: false, mishap };
    }
    known.requiresAtonement = true;
    return { spell, check, outcome: "mishap", doubled: false };
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
