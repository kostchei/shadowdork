/** Pure mechanical rules shared by the five Cursed Scroll alternate classes. */

import type { Character } from "./character";
import type { Dice } from "./dice";
import { hasHook } from "./effects";

export const SHIELD_WALL_EFFECT_ID = "class:sea-wolf:shield-wall";
export const HIDDEN_EFFECT_ID = "class:hidden";
export const POISONED_WEAPON_EFFECT_ID = "class:poisoned-weapon";

export function initializeClassState(character: Character): void {
  character.classState.flourishUses = character.className === "pit-fighter" ? 3 : 0;
  character.classState.familiarAlive = character.className === "witch";
  character.classState.omenUses = character.className === "seer" ? 1 : 0;
  character.classState.cauldronItems ??= [];
}

export function restoreClassResources(character: Character): void {
  if (character.className === "pit-fighter") character.classState.flourishUses = 3;
  if (character.className === "seer") character.classState.omenUses = 1;
  cancelShieldWall(character);
}

export function isShieldWallActive(character: Character): boolean {
  return Boolean(
    character.carriedShield &&
    !character.shieldStowed &&
    character.effects.some((effect) => effect.id === SHIELD_WALL_EFFECT_ID),
  );
}

export function activateShieldWall(character: Character): void {
  if (character.className !== "sea-wolf") throw new Error("Only a Sea Wolf can form a Shield Wall");
  if (!character.carriedShield || character.shieldStowed) throw new Error("Shield Wall requires a readied shield");
  if (isShieldWallActive(character)) return;
  character.addEffect({
    id: SHIELD_WALL_EFFECT_ID,
    name: "Shield Wall (AC 20; movement or attacking ends it)",
    hooks: [{ kind: "acMinimum", value: 20 }],
  });
}

export function cancelShieldWall(character: Character): boolean {
  const active = character.effects.some((effect) => effect.id === SHIELD_WALL_EFFECT_ID);
  character.removeEffect(SHIELD_WALL_EFFECT_ID);
  return active;
}

export interface FlourishResult {
  healed: number;
  usesRemaining: number;
}

/** Trigger after a valid melee hit; full-health hits do not waste a use. */
export function triggerFlourish(character: Character, dice: Pick<Dice, "roll">): FlourishResult | null {
  if (character.className !== "pit-fighter" || character.classState.flourishUses <= 0) return null;
  if (character.dead || character.dying || character.hp >= character.maxHp) return null;
  const before = character.hp;
  character.heal(dice.roll("1d6"));
  character.classState.flourishUses--;
  return { healed: character.hp - before, usesRemaining: character.classState.flourishUses };
}

export function isHidden(character: Character): boolean {
  return hasHook(character.effects, "hidden");
}

export function hideCharacter(character: Character): void {
  character.removeEffect(HIDDEN_EFFECT_ID);
  character.addEffect({ id: HIDDEN_EFFECT_ID, name: "Hidden", hooks: [{ kind: "hidden" }] });
}

export function revealCharacter(character: Character): boolean {
  const hidden = isHidden(character);
  character.removeEffect(HIDDEN_EFFECT_ID);
  return hidden;
}

/** Ras-Godai doubles its weapon dice against an unaware target. */
export function assassinExtraDamageDice(character: Character, targetIsUnaware: boolean): number {
  return character.className === "ras-godai" && isHidden(character) && targetIsUnaware ? 1 : 0;
}

/** Untrained poisoners spill on 1-2; Ras-Godai training only spills on natural 1. */
export function poisonApplicationAccident(character: Character, natural: number): boolean {
  return natural <= (character.className === "ras-godai" ? 1 : 2);
}

export function armPoisonedWeapon(character: Character, damage = "1d6"): void {
  character.removeEffect(POISONED_WEAPON_EFFECT_ID);
  character.addEffect({
    id: POISONED_WEAPON_EFFECT_ID,
    name: `Poisoned Weapon (+${damage} on next melee hit)`,
    hooks: [{ kind: "poisonedWeapon", damage }],
    duration: { unit: "untilRest", remaining: 0 },
  });
}

export function poisonedWeaponDamage(character: Character): string | null {
  for (const effect of character.effects) {
    for (const hook of effect.hooks) if (hook.kind === "poisonedWeapon") return hook.damage;
  }
  return null;
}

export function destinedLuckBonus(character: Character, dice: Pick<Dice, "roll">): number {
  return character.className === "seer" ? dice.roll("1d6") : 0;
}
