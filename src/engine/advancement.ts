/**
 * Advancement: XP comes from treasure and boons only. Threshold to next level
 * is (current level x 10), resetting each level. Level-up rolls HP (class hit
 * die + CON) and 2d6 on the class talent table.
 */

import type { Character } from "./character";
import type { Dice } from "./dice";
import type { TableRegistry, TableRollResult } from "./tables";
import { applyTalentResult, type AppliedTalent } from "./talents";

export const MAX_LEVEL = 10;

export function xpToNextLevel(level: number): number {
  if (level < 1) throw new Error(`Invalid level ${level}`);
  return level * 10;
}

export interface LevelUpResult {
  newLevel: number;
  hpRolled: number;
  hpGained: number;
  talent: TableRollResult;
  /** Primary roll plus any chained/rerolled talents actually applied. */
  talents: AppliedTalent[];
}

export interface XpAward {
  amount: number;
  leveledUp: boolean;
}

/** Award XP. Returns whether a level-up is now pending (caller triggers levelUp for the UI moment). */
export function awardXp(character: Character, amount: number): XpAward {
  if (amount < 1) throw new Error(`XP award must be >= 1, got ${amount}`);
  character.xp += amount;
  return { amount, leveledUp: canLevelUp(character) };
}

export function canLevelUp(character: Character): boolean {
  return character.level < MAX_LEVEL && character.xp >= xpToNextLevel(character.level);
}

export function levelUp(
  dice: Dice,
  tables: TableRegistry,
  character: Character,
  hitDie: string,
  talentTableId: string,
): LevelUpResult {
  if (!canLevelUp(character)) {
    throw new Error(
      `${character.name} has ${character.xp}/${xpToNextLevel(character.level)} XP — cannot level up`,
    );
  }
  character.xp -= xpToNextLevel(character.level);
  character.level++;

  const hpRolled = dice.roll(hitDie);
  const hpGained = Math.max(1, hpRolled + character.mod("CON"));
  character.increaseMaxHp(hpGained);
  // Leveling restores the character to full (and pulls a dying one back up).
  character.heal(character.maxHp);

  const talent = tables.roll(dice, talentTableId);
  const talents = applyTalentResult(dice, tables, character, talent, `talent-L${character.level}`);

  return { newLevel: character.level, hpRolled, hpGained, talent, talents };
}

/**
 * XP needed to reach the next level from the character's current progress — the
 * descent reward tops this up so a normal level-up fires. Zero at the level cap.
 */
export function xpToReachNextLevel(character: Character): number {
  if (character.level >= MAX_LEVEL) return 0;
  return Math.max(0, xpToNextLevel(character.level) - character.xp);
}
