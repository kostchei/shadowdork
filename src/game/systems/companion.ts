/**
 * Pure decision for who — if anyone — a companion vault reward recruits.
 *
 * A resolved `companion-eligible` NPC overrides the campaign's default recruit, but
 * its class is rolled independently of party composition, so the override can try to
 * add a duplicate class or overflow a full party. This module decides recruit-or-skip
 * against a party snapshot; the scene applies the result (spawn + sprite cleanup, or a
 * gold substitute). Keeping it Phaser-free makes every branch unit testable.
 */

import { getBaseRole, type Alignment, type BaseClassName, type ClassName } from "../../engine/character";
import type { ZonePackId } from "../visual/model";

export const PARTY_CAP = 4;

export type CompanionClass = ClassName;

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

export interface CompanionPartyMember {
  className: CompanionClass;
  dead: boolean;
}

/** Only survivors consume a future expedition slot or block a replacement class. */
export function companionPartySnapshot(members: readonly CompanionPartyMember[]): PartySnapshot {
  const survivors = members.filter((member) => !member.dead);
  return { size: survivors.length, classes: survivors.map((member) => member.className) };
}

export type CompanionDecision =
  | { kind: "recruit"; candidate: CompanionCandidate }
  | { kind: "skip"; reason: "party-full" | "duplicate-class"; className: CompanionClass };

/**
 * 50% chance in the matching Cursed Scroll destination to find the alternate class:
 * - Red Sands (CS2): fighter -> pit-fighter, thief -> ras-godai
 * - Midnight Sun (CS3): fighter -> sea-wolf, priest -> seer
 * - Diablerie (CS1): wizard -> witch
 */
export function resolveClassForZone(
  baseClass: BaseClassName,
  zone?: ZonePackId,
  roll50 = Math.random() < 0.5,
): ClassName {
  if (!zone || !roll50) return baseClass;
  if (zone === "red-sands") {
    if (baseClass === "fighter") return "pit-fighter";
    if (baseClass === "thief") return "ras-godai";
  } else if (zone === "midnight-sun") {
    if (baseClass === "fighter") return "sea-wolf";
    if (baseClass === "priest") return "seer";
  } else if (zone === "diablerie") {
    if (baseClass === "wizard") return "witch";
  }
  return baseClass;
}

/**
 * Prefer the eligible NPC when present, else the reward default, then validate the
 * chosen recruit against party capacity and class uniqueness (by base role).
 */
export function chooseCompanionRecruit(
  npc: CompanionCandidate | null,
  fallback: CompanionCandidate,
  party: PartySnapshot,
  cap: number = PARTY_CAP,
): CompanionDecision {
  const candidate = npc ?? fallback;
  if (party.size >= cap) return { kind: "skip", reason: "party-full", className: candidate.className };
  const candidateBase = getBaseRole(candidate.className);
  if (party.classes.some((existing) => getBaseRole(existing) === candidateBase)) {
    return { kind: "skip", reason: "duplicate-class", className: candidate.className };
  }
  return { kind: "recruit", candidate };
}
