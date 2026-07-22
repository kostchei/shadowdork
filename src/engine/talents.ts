/** Resolves talent-table results, including chained tables and class-specific duplicate rules. */

import type { Character } from "./character";
import type { Dice } from "./dice";
import type { TableRegistry, TableRollResult } from "./tables";

export interface AppliedTalent {
  result: TableRollResult;
  effectId: string;
}

function alreadyHasRoll(character: Character, tableId: string, roll: number): boolean {
  return character.effects.some((effect) => effect.id.includes(`:${tableId}:${roll}:`));
}

function duplicateResource(tableId: string, roll: number): "ignoreAttack" | "berserk" | "familiarTeleport" | null {
  if (roll !== 2) return null;
  if (tableId === "pit-fighter-talents") return "ignoreAttack";
  if (tableId === "sea-wolf-talents") return "berserk";
  if (tableId === "witch-talents") return "familiarTeleport";
  return null;
}

export function applyTalentResult(
  dice: Dice,
  tables: TableRegistry,
  character: Character,
  initial: TableRollResult,
  sourceId: string,
): AppliedTalent[] {
  const applied: AppliedTalent[] = [];

  const apply = (result: TableRollResult, suffix: string, rerollOnBlackLotusOne = false): void => {
    if (rerollOnBlackLotusOne && result.table.id === "black-lotus-talents" && result.roll === 1) {
      apply(tables.roll(dice, result.table.id), `${suffix}-reroll`, true);
      return;
    }

    const duplicate = alreadyHasRoll(character, result.table.id, result.roll);
    const duplicateBonus = duplicateResource(result.table.id, result.roll);
    const mustReroll = duplicate && (
      (result.table.id === "ras-godai-talents" && result.roll === 2) ||
      (result.table.id === "sea-wolf-talents" && result.roll >= 10 && result.roll <= 11)
    );
    if (mustReroll) {
      apply(tables.roll(dice, result.table.id), `${suffix}-reroll`);
      return;
    }

    const effectId = `${sourceId}:${result.table.id}:${result.roll}:${suffix}`;
    const hooks = duplicate && duplicateBonus
      ? [{ kind: "resourceBonus" as const, resource: duplicateBonus, bonus: 1 }]
      : [...(result.entry.effects ?? [])];
    character.addEffect({ id: effectId, name: result.entry.text, hooks });
    applied.push({ result, effectId });

    for (const instruction of result.entry.talent ?? []) {
      if (instruction.kind === "learnSpell") {
        const maxTier = Math.min(5, Math.ceil(character.level / 2));
        const choice = instruction.spells.find((spell) => spell.tier <= maxTier && !character.knownSpells.some((known) => known.spellId === spell.id));
        if (choice) character.learnSpell(choice.id);
      } else if (instruction.kind === "advantageKnownSpell") {
        const choice = character.knownSpells.find((known) =>
          !character.effects.some((effect) => effect.hooks.some((hook) => hook.kind === "advantageOnSpell" && hook.spellId === known.spellId)),
        );
        if (choice) character.addEffect({ id: `${effectId}:spell`, name: `Advantage casting ${choice.spellId}`, hooks: [{ kind: "advantageOnSpell", spellId: choice.spellId }] });
      } else if (instruction.kind === "gainHitDie") {
        character.increaseMaxHp(dice.roll(instruction.dice));
      } else {
        for (let i = 0; i < instruction.count; i++) {
          const next = tables.roll(dice, instruction.tableId);
          apply(next, `${suffix}-${instruction.tableId}-${i}`, result.table.id === "black-lotus-talents" && result.roll === 1);
        }
      }
    }
  };

  apply(initial, "0");
  return applied;
}

export function rollAndApplyTalent(
  dice: Dice,
  tables: TableRegistry,
  character: Character,
  tableId: string,
  sourceId: string,
): AppliedTalent[] {
  return applyTalentResult(dice, tables, character, tables.roll(dice, tableId), sourceId);
}
