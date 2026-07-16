/**
 * Random tables as a first-class subsystem. Tables are data; rolling one
 * returns a structured entry. Unknown table ids throw.
 */

import type { Dice } from "./dice";
import type { EffectHook } from "./effects";

export interface TableEntry {
  /** Inclusive roll range this entry covers. */
  min: number;
  max: number;
  text: string;
  /** Structured consequences the caller applies (talent hooks, stat gains...). */
  effects?: readonly EffectHook[];
  /** Free-form structured data for non-effect entries (mishaps, treasure). */
  data?: Record<string, unknown>;
}

export interface RollableTable {
  id: string;
  name: string;
  /** Dice expression rolled against the entries, e.g. "2d6", "1d12". */
  dice: string;
  entries: readonly TableEntry[];
}

export interface TableRollResult {
  table: RollableTable;
  roll: number;
  entry: TableEntry;
}

export class TableRegistry {
  private tables = new Map<string, RollableTable>();

  register(table: RollableTable): void {
    if (this.tables.has(table.id)) throw new Error(`Duplicate table id "${table.id}"`);
    validateTable(table);
    this.tables.set(table.id, table);
  }

  get(id: string): RollableTable {
    const t = this.tables.get(id);
    if (!t) throw new Error(`Unknown table "${id}"`);
    return t;
  }

  roll(dice: Dice, tableId: string, modifier = 0): TableRollResult {
    const table = this.get(tableId);
    const raw = dice.roll(table.dice) + modifier;
    // Clamp to the table's covered range so modifiers can't roll off the ends.
    const first = table.entries[0]!;
    const last = table.entries[table.entries.length - 1]!;
    const roll = Math.min(Math.max(raw, first.min), last.max);
    const entry = table.entries.find((e) => roll >= e.min && roll <= e.max);
    if (!entry) throw new Error(`Table "${tableId}" has no entry for roll ${roll}`);
    return { table, roll, entry };
  }
}

function validateTable(table: RollableTable): void {
  if (table.entries.length === 0) throw new Error(`Table "${table.id}" has no entries`);
  let prev = table.entries[0]!.min - 1;
  for (const e of table.entries) {
    if (e.min !== prev + 1 || e.max < e.min) {
      throw new Error(
        `Table "${table.id}" entries must be contiguous ascending; bad range ${e.min}-${e.max}`,
      );
    }
    prev = e.max;
  }
}
