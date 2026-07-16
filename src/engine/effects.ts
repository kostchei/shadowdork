/**
 * Talents and conditions as data-driven effect hooks.
 * Talents are rolled on class tables and mutate the rules via these hooks —
 * never as hardcoded booleans on the character.
 */

import type { StatName } from "./character";

export type CheckKind =
  | "attack"
  | "spellcast"
  | "initiative"
  | "morale"
  | "stat" // generic ability check (climb, disarm, stabilize...)
  | "any";

export type EffectHook =
  | { kind: "checkBonus"; applies: CheckKind; bonus: number }
  | { kind: "advantageOn"; applies: CheckKind }
  | { kind: "disadvantageOn"; applies: CheckKind }
  | { kind: "critRange"; value: number } // attacks crit on natural >= value
  | { kind: "statBonus"; stat: StatName; bonus: number }
  | { kind: "acBonus"; bonus: number }
  | { kind: "damageBonus"; bonus: number }
  /** Weapon Mastery scaling: +floor(level / 2) damage. */
  | { kind: "damageBonusHalfLevel" }
  | { kind: "maxHpBonus"; bonus: number };

export type DurationUnit = "rounds" | "crawlingRounds" | "realMs" | "untilRest" | "focus";

export interface Duration {
  unit: DurationUnit;
  /** Remaining amount in the given unit. Ignored for untilRest/focus. */
  remaining: number;
}

/** A named source of hooks: a talent (permanent) or a condition (has a duration). */
export interface Effect {
  id: string;
  name: string;
  hooks: EffectHook[];
  /** Absent = permanent (talents, ancestry features). */
  duration?: Duration;
}

export function sumCheckBonus(effects: readonly Effect[], kind: CheckKind): number {
  let total = 0;
  for (const e of effects) {
    for (const h of e.hooks) {
      if (h.kind === "checkBonus" && (h.applies === kind || h.applies === "any")) {
        total += h.bonus;
      }
    }
  }
  return total;
}

export function grantsAdvantage(effects: readonly Effect[], kind: CheckKind): boolean {
  return effects.some((e) =>
    e.hooks.some((h) => h.kind === "advantageOn" && (h.applies === kind || h.applies === "any")),
  );
}

export function grantsDisadvantage(effects: readonly Effect[], kind: CheckKind): boolean {
  return effects.some((e) =>
    e.hooks.some(
      (h) => h.kind === "disadvantageOn" && (h.applies === kind || h.applies === "any"),
    ),
  );
}

/** Lowest crit threshold among hooks; default 20. */
export function critThreshold(effects: readonly Effect[]): number {
  let threshold = 20;
  for (const e of effects) {
    for (const h of e.hooks) {
      if (h.kind === "critRange" && h.value < threshold) threshold = h.value;
    }
  }
  return threshold;
}

export function sumHook(
  effects: readonly Effect[],
  kind: "acBonus" | "damageBonus" | "maxHpBonus",
): number {
  let total = 0;
  for (const e of effects) {
    for (const h of e.hooks) {
      if (h.kind === kind) total += h.bonus;
    }
  }
  return total;
}

export function hasHook(effects: readonly Effect[], kind: EffectHook["kind"]): boolean {
  return effects.some((e) => e.hooks.some((h) => h.kind === kind));
}

export function sumStatBonus(effects: readonly Effect[], stat: StatName): number {
  let total = 0;
  for (const e of effects) {
    for (const h of e.hooks) {
      if (h.kind === "statBonus" && h.stat === stat) total += h.bonus;
    }
  }
  return total;
}
