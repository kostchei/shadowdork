/**
 * Reusable status conditions, built on the existing Effect/duration machinery
 * (see ./effects and ./time) rather than a parallel state system. Each
 * condition is a tagged Effect — `condition:<kind>` — so game code can query
 * "is X poisoned" without inspecting mechanical hooks. Only conditions the
 * existing hook vocabulary already models (advantage/disadvantage, AC, ...)
 * carry real hooks here; anything spatial (can't move, can't act, auto-fail
 * a save) is a query the movement/combat layer makes against `hasCondition`.
 *
 * Conditions use "rounds" or "untilRest" durations. Round-based conditions
 * expire on their own via Engine's per-round tick regardless of resting;
 * "untilRest" conditions are cleared by Engine.rest/freeRest like any other
 * until-rest effect. Rest deliberately does not cure round-based conditions
 * (e.g. poison) — that is what an antidote or the condition's own duration
 * is for, not a nap.
 */

import type { Character } from "./character";
import type { Duration, Effect, EffectHook } from "./effects";

export type ConditionKind =
  | "poisoned"
  | "webbed"
  | "grappled"
  | "blinded"
  | "frightened"
  | "sleeping"
  | "paralyzed"
  | "charmed"
  | "silenced"
  | "corroded"
  | "swallowed"
  | "magicSuppressed";

export const CONDITION_KINDS: readonly ConditionKind[] = [
  "poisoned",
  "webbed",
  "grappled",
  "blinded",
  "frightened",
  "sleeping",
  "paralyzed",
  "charmed",
  "silenced",
  "corroded",
  "swallowed",
  "magicSuppressed",
];

interface ConditionSpec {
  label: string;
  /** Short HUD abbreviation, e.g. "PSN". */
  abbr: string;
  hooks: readonly EffectHook[];
}

const CONDITION_SPECS: Record<ConditionKind, ConditionSpec> = {
  poisoned: { label: "Poisoned", abbr: "PSN", hooks: [] },
  webbed: { label: "Webbed", abbr: "WEB", hooks: [] },
  grappled: { label: "Grappled", abbr: "GRP", hooks: [] },
  blinded: { label: "Blinded", abbr: "BLD", hooks: [{ kind: "disadvantageOn", applies: "attack" }] },
  frightened: { label: "Frightened", abbr: "FRT", hooks: [{ kind: "disadvantageOn", applies: "attack" }] },
  sleeping: { label: "Sleeping", abbr: "SLP", hooks: [] },
  paralyzed: { label: "Paralyzed", abbr: "PAR", hooks: [] },
  charmed: { label: "Charmed", abbr: "CHM", hooks: [] },
  silenced: { label: "Silenced", abbr: "SIL", hooks: [] },
  corroded: { label: "Corroded", abbr: "COR", hooks: [] },
  swallowed: { label: "Swallowed", abbr: "SWL", hooks: [] },
  magicSuppressed: { label: "Suppressed", abbr: "SUP", hooks: [] },
};

/** The Effect id every instance of a condition uses — stable and unique per kind. */
export function conditionEffectId(kind: ConditionKind): string {
  return `condition:${kind}`;
}

export function conditionLabel(kind: ConditionKind): string {
  return CONDITION_SPECS[kind].label;
}

export function conditionAbbr(kind: ConditionKind): string {
  return CONDITION_SPECS[kind].abbr;
}

function makeConditionEffect(kind: ConditionKind, duration: Duration): Effect {
  const spec = CONDITION_SPECS[kind];
  return { id: conditionEffectId(kind), name: spec.label, hooks: [...spec.hooks], duration };
}

export function isImmuneToCondition(character: Character, kind: ConditionKind): boolean {
  return character.effects.some((e) =>
    e.hooks.some((h) => h.kind === "conditionImmunity" && h.condition === kind),
  );
}

/**
 * Apply a condition, refreshing (not stacking) an existing instance of the
 * same kind — the new duration replaces the old one outright. No-op against
 * an immune character. Returns whether the condition was actually applied.
 */
export function applyCondition(character: Character, kind: ConditionKind, duration: Duration): boolean {
  if (isImmuneToCondition(character, kind)) return false;
  character.removeEffect(conditionEffectId(kind));
  character.addEffect(makeConditionEffect(kind, duration));
  return true;
}

export function hasCondition(character: Character, kind: ConditionKind): boolean {
  return character.effects.some((e) => e.id === conditionEffectId(kind));
}

export function removeCondition(character: Character, kind: ConditionKind): void {
  character.removeEffect(conditionEffectId(kind));
}

/** Every condition currently active on the character, in the table's canonical order. */
export function activeConditions(character: Character): ConditionKind[] {
  return CONDITION_KINDS.filter((k) => hasCondition(character, k));
}

/** Strip every condition — used when a character dies; a corpse carries no status. */
export function clearAllConditions(character: Character): void {
  for (const k of CONDITION_KINDS) removeCondition(character, k);
}
