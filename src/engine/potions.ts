/** Pure potion rules. Rendering and target selection stay in the game layer. */

import type { Character } from "./character";
import type { Dice } from "./dice";
import { hasHook, type Effect, type EffectHook } from "./effects";
import type { ItemDef } from "./inventory";
import { canUseItem } from "./itemActions";

export const POTION_EFFECT_IDS = {
  invisibility: "potion:invisibility",
  waterBreathing: "potion:water-breathing",
  flying: "potion:flying",
  giantStrength: "potion:giant-strength",
} as const;

export interface PotionUseResult {
  itemId: string;
  healed: number;
  effect?: Effect;
  message: string;
}

function timedPotion(id: string, name: string, hooks: EffectHook[], rounds: number): Effect {
  return { id, name, hooks, duration: { unit: "rounds", remaining: rounds } };
}

function addReplacing(character: Character, effect: Effect): void {
  character.removeEffect(effect.id);
  character.addEffect(effect);
}

export function hasCapability(
  character: Character,
  capability: "invisible" | "waterBreathing" | "canFly",
): boolean {
  return hasHook(character.effects, capability);
}

/** Drink one of the five fully implemented core potions. */
export function usePotion(
  user: Character,
  target: Character,
  def: ItemDef,
  dice: Pick<Dice, "roll">,
): PotionUseResult {
  const legal = canUseItem(user, user.itemState, def, "consume", true);
  if (!legal.ok) throw new Error(legal.message);
  if (target.dead) throw new Error(`${target.name} is dead and cannot drink a potion.`);

  let result: PotionUseResult;
  switch (def.id) {
    case "potion-healing": {
      if (target.hp >= target.maxHp && !target.dying) throw new Error(`${target.name} is already at full HP.`);
      const before = target.hp;
      target.heal(dice.roll("1d6"));
      const healed = target.hp - before;
      result = { itemId: def.id, healed, message: `${target.name} recovers ${healed} HP.` };
      break;
    }
    case "potion-invisibility": {
      const effect = timedPotion(POTION_EFFECT_IDS.invisibility, "Invisible", [{ kind: "invisible" }], 5);
      addReplacing(target, effect);
      result = { itemId: def.id, healed: 0, effect, message: `${target.name} fades from sight for 5 rounds.` };
      break;
    }
    case "potion-water-breathing": {
      const effect = timedPotion(POTION_EFFECT_IDS.waterBreathing, "Water Breathing", [{ kind: "waterBreathing" }], 20);
      addReplacing(target, effect);
      result = { itemId: def.id, healed: 0, effect, message: `${target.name} can breathe water for 20 rounds.` };
      break;
    }
    case "potion-flying": {
      const effect = timedPotion(POTION_EFFECT_IDS.flying, "Flying", [{ kind: "canFly" }], 5);
      addReplacing(target, effect);
      result = { itemId: def.id, healed: 0, effect, message: `${target.name} can fly for 5 rounds.` };
      break;
    }
    case "potion-giant-strength": {
      const effect = timedPotion(POTION_EFFECT_IDS.giantStrength, "Giant Strength", [{ kind: "statMinimum", stat: "STR", value: 18 }], 5);
      addReplacing(target, effect);
      result = { itemId: def.id, healed: 0, effect, message: `${target.name}'s Strength becomes 18 for 5 rounds.` };
      break;
    }
    default:
      throw new Error(`${def.name} does not have an implemented potion effect.`);
  }

  user.inventory.remove(def.id, 1);
  return result;
}
