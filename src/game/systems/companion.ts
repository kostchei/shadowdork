/**
 * Pure decision for who — if anyone — a companion vault reward recruits.
 *
 * A resolved `companion-eligible` NPC overrides the campaign's default recruit, but
 * its class is rolled independently of party composition, so the override can try to
 * add a duplicate class or overflow a full party. This module decides recruit-or-skip
 * against a party snapshot; the scene applies the result (spawn + sprite cleanup, or a
 * gold substitute). Keeping it Phaser-free makes every branch unit testable.
 */

import type { Alignment } from "../../engine/character";

export const PARTY_CAP = 4;

export type CompanionClass = "fighter" | "thief" | "priest" | "wizard";

export interface CompanionCandidate {
  /** Stable character id for the spawned recruit. */
  id: string;
  name: string;
  className: CompanionClass;
  alignment: Alignment;
  /** True when this candidate comes from an eligible NPC (its sprite must be cleared). */
  fromNpc: boolean;
}

export interface PartySnapshot {
  size: number;
  classes: readonly CompanionClass[];
}

export type CompanionDecision =
  | { kind: "recruit"; candidate: CompanionCandidate }
  | { kind: "skip"; reason: "party-full" | "duplicate-class"; className: CompanionClass };

/**
 * Prefer the eligible NPC when present, else the reward default, then validate the
 * chosen recruit against party capacity and class uniqueness. An invalid recruit is
 * skipped outright rather than silently substituted with a different class.
 */
export function chooseCompanionRecruit(
  npc: CompanionCandidate | null,
  fallback: CompanionCandidate,
  party: PartySnapshot,
  cap: number = PARTY_CAP,
): CompanionDecision {
  const candidate = npc ?? fallback;
  if (party.size >= cap) return { kind: "skip", reason: "party-full", className: candidate.className };
  if (party.classes.includes(candidate.className)) {
    return { kind: "skip", reason: "duplicate-class", className: candidate.className };
  }
  return { kind: "recruit", candidate };
}
