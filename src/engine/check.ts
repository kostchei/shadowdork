/**
 * The single resolution service: d20 + stat modifier vs DC or AC, roll high.
 * Everything — attacks, spell checks, morale, stabilization — calls resolveCheck.
 */

import type { Advantage } from "./dice";
import { Dice } from "./dice";
import type { Character } from "./character";
import type { StatName } from "./character";
import {
  grantsAdvantage,
  grantsDisadvantage,
  sumCheckBonus,
  type CheckKind,
} from "./effects";

export const DC = {
  EASY: 9,
  NORMAL: 12,
  HARD: 15,
  EXTREME: 18,
} as const;

export interface CheckInput {
  actor: Character;
  stat: StatName;
  dc: number;
  kind: CheckKind;
  /** Situational adv/dis sources with human-readable reasons (for the log/UI). */
  advantage?: readonly string[];
  disadvantage?: readonly string[];
  /** Attacks: crit threshold from the attacker (talents can lower it below 20). */
  critThreshold?: number;
}

export interface CheckResult {
  success: boolean;
  /** Natural roll >= crit threshold (attacks) or natural 20 (everything else). */
  crit: boolean;
  /** Natural 1 — auto-fail, triggers mishaps on spell checks. */
  fumble: boolean;
  natural: number;
  total: number;
  modifier: number;
  dc: number;
  mode: Advantage;
  rolls: number[];
  advantageReasons: string[];
  disadvantageReasons: string[];
}

export function resolveCheck(dice: Dice, input: CheckInput): CheckResult {
  const { actor, stat, dc, kind } = input;

  const advReasons = [...(input.advantage ?? [])];
  const disReasons = [...(input.disadvantage ?? [])];
  if (grantsAdvantage(actor.effects, kind)) advReasons.push("talent");
  if (grantsDisadvantage(actor.effects, kind)) disReasons.push("condition");
  if (kind === "stat" && actor.effects.some((e) => e.hooks.some((h) => h.kind === "advantageOnStat" && h.stat === stat))) {
    advReasons.push("grit");
  }

  // Any advantage + any disadvantage cancel to a normal roll.
  let mode: Advantage = "normal";
  if (advReasons.length > 0 && disReasons.length === 0) mode = "advantage";
  else if (disReasons.length > 0 && advReasons.length === 0) mode = "disadvantage";

  const roll = dice.d20(mode);
  const modifier = actor.mod(stat) + sumCheckBonus(actor.effects, kind, actor.level);
  const total = roll.natural + modifier;

  const critAt = kind === "attack" || kind === "meleeAttack" ? (input.critThreshold ?? actor.critThreshold) : 20;
  const fumble = roll.natural === 1;

  // Only a natural 20 auto-succeeds; a talent-lowered crit range still has to hit.
  const success = fumble ? false : roll.natural === 20 ? true : total >= dc;
  const crit = success && roll.natural >= critAt;

  return {
    success,
    crit,
    fumble,
    natural: roll.natural,
    total,
    modifier,
    dc,
    mode,
    rolls: roll.rolls,
    advantageReasons: advReasons,
    disadvantageReasons: disReasons,
  };
}
