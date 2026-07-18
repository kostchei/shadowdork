/**
 * Renderer-free validation of an expanded non-linear dungeon.
 *
 * This is deliberately stricter than a grid-shape check: it ensures every
 * connector has usable endpoint tiles and that a gate's requirement has a real
 * source region. Runtime may open, reveal, or break the blocker, so closed
 * connector tiles count as conditionally traversable for the completion proof.
 */

import type { DungeonDefinition } from "./dungeons";

export interface PhysicalValidationResult {
  ok: boolean;
  diagnostics: string[];
}

function inBounds(dungeon: DungeonDefinition, x: number, y: number): boolean {
  return x >= 0 && x < dungeon.width && y >= 0 && y < dungeon.height;
}

function tile(dungeon: DungeonDefinition, x: number, y: number): string | undefined {
  return dungeon.grid[y]?.[x];
}

function usable(ch: string | undefined): boolean {
  return ch !== undefined && ch !== "#";
}

/** Validate geometry and the data required for physical connector interactions. */
export function validatePhysicalDungeon(dungeon: DungeonDefinition): PhysicalValidationResult {
  const diagnostics: string[] = [];
  if (dungeon.grid.length !== dungeon.height || dungeon.grid.some((row) => row.length !== dungeon.width)) {
    diagnostics.push("grid-dimensions-mismatch");
  }

  const count = (glyph: string) => dungeon.grid.reduce((n, row) => n + [...row].filter((ch) => ch === glyph).length, 0);
  for (const glyph of ["P", "K", "D"]) if (count(glyph) !== 1) diagnostics.push(`expected-one-${glyph}`);

  for (const connector of dungeon.connectors ?? []) {
    for (const [name, point] of [["entry", connector.entry], ["landing", connector.landing]] as const) {
      if (!inBounds(dungeon, point.x, point.y) || !usable(tile(dungeon, point.x, point.y))) {
        diagnostics.push(`invalid-${name}:${connector.id}`);
      }
    }
    if (connector.blocker) {
      if (!inBounds(dungeon, connector.blocker.x, connector.blocker.y)) {
        diagnostics.push(`blocker-out-of-bounds:${connector.id}`);
      }
      if ((connector.state === "locked" || connector.state === "switched") && !connector.requirement) {
        diagnostics.push(`missing-requirement:${connector.id}`);
      }
    }
    if (connector.requirement && !dungeon.regions.some((r) => r.id === connector.requirement!.sourceRoomId)) {
      diagnostics.push(`missing-requirement-source:${connector.id}`);
    }
    if (connector.vertical) {
      const x = connector.entry.x;
      const minY = Math.min(connector.entry.y, connector.landing.y);
      const maxY = Math.max(connector.entry.y, connector.landing.y);
      if (!Array.from({ length: maxY - minY + 1 }, (_, i) => tile(dungeon, x, minY + i)).some((ch) => ch === "|")) {
        diagnostics.push(`missing-universal-climb:${connector.id}`);
      }
    }
  }
  return { ok: diagnostics.length === 0, diagnostics };
}
