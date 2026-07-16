/**
 * Monster stat blocks and monster-side rolls. Monsters are simpler than
 * characters — flat attack bonus, no talents — but share the nat-1/nat-20 rules.
 */

import type { Dice } from "./dice";

export interface MonsterDef {
  id: string;
  name: string;
  ac: number;
  hitDice: string;
  attackBonus: number;
  damage: string;
  wisMod: number;
  /** Monsters see fine in the dark. */
  darkvision: boolean;
  undead: boolean;
  xpTier: "minor" | "major" | "legendary";
}

export interface MonsterAttackResult {
  natural: number;
  total: number;
  hit: boolean;
  crit: boolean;
  damage: number;
}

export function monsterAttackRoll(
  dice: Dice,
  monster: MonsterDef,
  targetAc: number,
  mode: "normal" | "advantage" | "disadvantage" = "normal",
): MonsterAttackResult {
  const roll = dice.d20(mode);
  const total = roll.natural + monster.attackBonus;
  const crit = roll.natural === 20;
  const hit = roll.natural !== 1 && (crit || total >= targetAc);
  let damage = 0;
  if (hit) {
    damage = dice.roll(monster.damage);
    if (crit) damage += dice.roll(monster.damage); // crits double damage dice
  }
  return { natural: roll.natural, total, hit, crit, damage };
}

/**
 * Morale check: DC 15 WIS. Fired when half the group has fallen or the
 * group's leader drops. Failure = flight or surrender.
 */
export function moraleCheck(dice: Dice, monster: MonsterDef): { natural: number; holds: boolean } {
  const roll = dice.d20("normal");
  if (roll.natural === 1) return { natural: 1, holds: false };
  if (roll.natural === 20) return { natural: 20, holds: true };
  return { natural: roll.natural, holds: roll.natural + monster.wisMod >= 15 };
}
