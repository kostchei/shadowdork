import { Character, rollStats, type ClassName, type Engine } from "../engine";
import { classDef } from "./classes";
import { item } from "./items";
import { WIZARD_MISHAPS } from "./tables/mishaps";
import {
  FIGHTER_TALENTS,
  PRIEST_TALENTS,
  THIEF_TALENTS,
  WIZARD_TALENTS,
} from "./tables/talents";

export { classDef, type ClassDef } from "./classes";
export { allItems, item } from "./items";
export { monster } from "./monsters";
export { spell, spellsForClass } from "./spells";

/** Register all data tables with an engine instance. Call once at boot. */
export function registerTables(engine: Engine): void {
  engine.tables.register(FIGHTER_TALENTS);
  engine.tables.register(THIEF_TALENTS);
  engine.tables.register(PRIEST_TALENTS);
  engine.tables.register(WIZARD_TALENTS);
  engine.tables.register(WIZARD_MISHAPS);
}

/**
 * Build a level-1 character of the given class: 3d6 stats (silently rerolled
 * until heroic — see rollStats), HP = hit die + CON (min 1), class armor kit,
 * starting gear and spells. AC is computed from armor + DEX, never stored.
 */
export function createCharacter(
  engine: Engine,
  id: string,
  name: string,
  cls: ClassName,
  ancestry = "human",
): Character {
  const def = classDef(cls);
  const stats = rollStats(engine.dice);

  if (cls === "fighter") {
    if (stats.STR < 15 && stats.DEX < 15) {
      const candidates: ("CON" | "INT" | "WIS" | "CHA")[] = ["CON", "INT", "WIS", "CHA"];
      let bestStat: "CON" | "INT" | "WIS" | "CHA" | null = null;
      let maxVal = -1;
      for (const s of candidates) {
        if (stats[s] >= 15 && stats[s] > maxVal) {
          maxVal = stats[s];
          bestStat = s;
        }
      }
      if (bestStat) {
        const temp = stats.STR;
        stats.STR = stats[bestStat];
        stats[bestStat] = temp;
      }
    }
  }

  const conMod = Math.floor((stats.CON - 10) / 2);
  const hitDieSides = parseInt(def.hitDie.split("d")[1] || "8", 10);
  const maxHp = Math.max(1, hitDieSides + conMod);
  const c = new Character({ id, name, className: cls, stats, maxHp, ancestry });
  for (const f of def.features) c.addEffect(structuredClone(f) as typeof f);

  // Configure Grit for Fighter:
  if (cls === "fighter") {
    const gritStat = stats.DEX > stats.STR ? "DEX" : "STR";
    c.addEffect({
      id: "feat-fighter-grit",
      name: `Grit (${gritStat === "STR" ? "Strength" : "Dexterity"})`,
      hooks: [{ kind: "advantageOnStat", stat: gritStat }],
    });
  }

  for (const spellId of def.startingSpellIds) c.learnSpell(spellId);
  c.inventory.add(item(def.weaponId), 1, true);
  if (def.armorId) {
    const armor = item(def.armorId);
    c.inventory.add(armor, 1, true);
    c.equipArmor(armor);
  }
  if (def.startsWithShield) {
    const shield = item("shield");
    c.inventory.add(shield, 1, true);
    c.equipShield(shield);
  }

  if (cls === "fighter") {
    c.inventory.add(item("javelin"), 1, true);
    c.inventory.add(item("backpack"), 1, true);
    c.inventory.add(item("flint-and-steel"), 1, true);
    c.inventory.add(item("torch"), 2, true);
    c.inventory.add(item("ration"), 3, true);
    c.inventory.add(item("iron-spikes"), 10, true);
    c.inventory.add(item("grappling-hook"), 1, true);
    c.inventory.add(item("rope"), 1, true);
  } else {
    c.inventory.add(item("torch"), 2, true);
    c.inventory.add(item("ration"), 1, true);
  }

  // Roll starting talents (1 + 1 extra if human/ambitious)
  const talentCount = ancestry === "human" ? 2 : 1;
  for (let i = 0; i < talentCount; i++) {
    const talent = engine.tables.roll(engine.dice, def.talentTableId);
    if (talent.entry.effects) {
      c.addEffect({
        id: `talent-start-${i}-${talent.roll}`,
        name: talent.entry.text,
        hooks: [...talent.entry.effects],
      });
    }
  }

  engine.registerCharacter(c);
  return c;
}
