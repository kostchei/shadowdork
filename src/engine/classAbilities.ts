/** Pure mechanical rules shared by the five Cursed Scroll alternate classes. */

import type { Character } from "./character";
import type { Dice } from "./dice";
import { hasHook, type ClassResource } from "./effects";

export const SHIELD_WALL_EFFECT_ID = "class:sea-wolf:shield-wall";
export const HIDDEN_EFFECT_ID = "class:hidden";
export const POISONED_WEAPON_EFFECT_ID = "class:poisoned-weapon";
export type OldGod = "odin" | "freya" | "loki";

export function resourceMaximum(character: Character, resource: ClassResource): number {
  const base: Partial<Record<ClassResource, number>> = {};
  if (character.className === "ras-godai") base.smokeStep = 3;
  if (character.className === "seer") base.omen = 3;
  if (character.className === "pit-fighter") base.relentless = 3;
  let total = base[resource] ?? 0;
  for (const effect of character.effects) for (const hook of effect.hooks) {
    if (hook.kind === "resourceBonus" && hook.resource === resource) total += hook.bonus;
  }
  return total;
}

function refillResources(character: Character): void {
  const resources: ClassResource[] = ["ignoreAttack", "relentless", "berserk", "smokeStep", "paralyze", "waterWalk", "sleep", "wallWalk", "unseen", "familiarTeleport", "omen"];
  for (const resource of resources) character.classState.resourceUses[resource] = resourceMaximum(character, resource);
  character.classState.omenUses = character.classState.resourceUses.omen ?? 0;
}

function spendResource(character: Character, resource: ClassResource): number {
  const uses = character.classState.resourceUses[resource] ?? 0;
  if (uses <= 0) throw new Error(`${character.name} has no ${resource} uses remaining`);
  character.classState.resourceUses[resource] = uses - 1;
  if (resource === "omen") character.classState.omenUses = uses - 1;
  return uses - 1;
}

export function initializeClassState(character: Character): void {
  character.classState.flourishUses = character.className === "pit-fighter" ? 3 : 0;
  character.classState.familiarAlive = character.className === "witch";
  character.classState.resourceUses ??= {};
  character.classState.oldGods ??= [];
  if (character.className === "sea-wolf" && character.classState.oldGods.length === 0) character.classState.oldGods = ["odin"];
  refillResources(character);
  character.classState.cauldronItems ??= [];
}

export function restoreClassResources(character: Character): void {
  if (character.className === "pit-fighter") character.classState.flourishUses = 3;
  refillResources(character);
  if (character.className === "sea-wolf" && character.classState.oldGods.includes("freya") && !character.luckToken) character.luckToken = true;
  character.removeEffect("class:sea-wolf:berserk");
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
  const extraDice = character.effects.flatMap((effect) => effect.hooks).reduce((sum, hook) => sum + (hook.kind === "flourishExtraDie" ? hook.bonus : 0), 0);
  let healing = 0;
  for (let i = 0; i < 1 + extraDice; i++) healing += dice.roll("1d6");
  character.heal(healing);
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
  if (character.className !== "ras-godai" || !isHidden(character) || !targetIsUnaware) return 0;
  let multiplier = 2;
  for (const effect of character.effects) for (const hook of effect.hooks) {
    if (hook.kind === "assassinDamageMultiplier") multiplier = Math.max(multiplier, hook.value);
  }
  return multiplier - 1;
}

/** Untrained poisoners spill on 1-2; Ras-Godai training only spills on natural 1. */
export function poisonApplicationAccident(character: Character, natural: number): boolean {
  const trained = character.className === "ras-godai" && character.effects.some((effect) => effect.id.includes(":ras-godai-talents:2:"));
  return natural <= (trained ? 1 : 2);
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
  if (character.className === "sea-wolf" && character.classState.oldGods.includes("freya")) return dice.roll("1d6");
  if (character.className !== "seer") return 0;
  const steps = character.effects.flatMap((effect) => effect.hooks).reduce((sum, hook) => sum + (hook.kind === "destinedDieStep" ? hook.bonus : 0), 0);
  return dice.roll(`1d${Math.min(12, 6 + steps * 2)}`);
}

export function chooseOldGods(character: Character, gods: readonly OldGod[]): void {
  if (character.className !== "sea-wolf") throw new Error("Only a Sea Wolf follows the Old Gods");
  const duality = character.effects.some((effect) => effect.hooks.some((hook) => hook.kind === "oldGodDuality"));
  const limit = duality ? 2 : 1;
  const unique = [...new Set(gods)];
  if (unique.length !== limit) throw new Error(`Sea Wolf must choose ${limit} different Old God effect${limit === 1 ? "" : "s"}`);
  character.classState.oldGods = unique;
  character.removeEffect("class:sea-wolf:loki");
  if (unique.includes("loki")) character.addEffect({ id: "class:sea-wolf:loki", name: "Loki: advantage to sneak and hide", hooks: [{ kind: "advantageOn", applies: "stealth" }] });
  if (unique.includes("freya") && !character.luckToken) character.luckToken = true;
}

export function oldGodKillHealing(character: Character, dice: Pick<Dice, "roll">): number {
  if (character.className !== "sea-wolf" || !character.classState.oldGods.includes("odin") || character.hp >= character.maxHp) return 0;
  const before = character.hp;
  character.heal(dice.roll("1d4"));
  return character.hp - before;
}

export function ignoreAttackDamage(character: Character): number {
  spendResource(character, "ignoreAttack");
  return 0;
}

export function goBerserk(character: Character): void {
  spendResource(character, "berserk");
  character.addEffect({ id: "class:sea-wolf:berserk", name: "Berserk: immune to damage", hooks: [{ kind: "damageImmune" }], duration: { unit: "rounds", remaining: 3 } });
}

export function useSmokeStep(character: Character): number { return spendResource(character, "smokeStep"); }

export function useFamiliarTeleport(character: Character): number {
  if (!character.classState.familiarAlive) throw new Error(`${character.name}'s familiar is dead`);
  return spendResource(character, "familiarTeleport");
}

export function restoreFamiliar(character: Character, dice: Pick<Dice, "roll">): number {
  if (character.className !== "witch") throw new Error("Only a Witch has a familiar");
  if (character.classState.familiarAlive) throw new Error(`${character.name}'s familiar is already alive`);
  const sacrifice = Math.min(character.maxHp - 1, dice.roll("1d4"));
  character.permanentlyReduceMaxHp(sacrifice);
  character.classState.familiarAlive = true;
  return sacrifice;
}

export function useBlackLotusPower(character: Character, power: "paralyze" | "waterWalk" | "sleep" | "wallWalk" | "unseen"): number {
  return spendResource(character, power);
}

export interface BlackLotusPowerResult {
  success: boolean;
  remaining: number;
  durationRounds: number;
}

/** Resolve the level cap, saving throw, and duration of an activated Black Lotus talent. */
export function resolveBlackLotusPower(
  character: Character,
  power: "paralyze" | "waterWalk" | "sleep" | "wallWalk" | "unseen",
  dice: Pick<Dice, "roll">,
  target?: { level: number; saveTotal: number },
): BlackLotusPowerResult {
  const caps = { paralyze: 9, sleep: 5, unseen: 9 } as const;
  const cap = power === "paralyze" || power === "sleep" || power === "unseen" ? caps[power] : null;
  if (cap !== null && (!target || target.level > cap)) throw new Error(`${power} requires a target of level ${cap} or less`);
  const remaining = useBlackLotusPower(character, power);
  const success = cap === null || target!.saveTotal < 15;
  const durationRounds = success ? dice.roll("1d4") : 0;
  if (success && power === "waterWalk") character.addEffect({ id: "class:ras-godai:water-walk", name: "Walking on water", hooks: [{ kind: "waterWalking" }], duration: { unit: "rounds", remaining: durationRounds } });
  if (success && power === "wallWalk") character.addEffect({ id: "class:ras-godai:wall-walk", name: "Walking on sheer surfaces", hooks: [{ kind: "canClimbWalls" }], duration: { unit: "rounds", remaining: durationRounds } });
  return { success, remaining, durationRounds };
}

export function enemyMoraleDc(character: Character, enemiesCanSeeCharacter: boolean): number {
  if (!enemiesCanSeeCharacter) return 15;
  return character.effects.some((effect) => effect.hooks.some((hook) => hook.kind === "enemyMoraleDcMinimum" && hook.value >= 18)) ? 18 : 15;
}

export function pitFighterLastStandThreshold(character: Character): number {
  return character.className === "pit-fighter" ? 18 : 20;
}
