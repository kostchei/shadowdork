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
export function createCharacter(engine: Engine, id: string, name: string, cls: ClassName): Character {
  const def = classDef(cls);
  const stats = rollStats(engine.dice);
  const conMod = Math.floor((stats.CON - 10) / 2);
  const maxHp = Math.max(1, engine.dice.roll(def.hitDie) + conMod);
  const c = new Character({ id, name, className: cls, stats, maxHp });
  for (const f of def.features) c.addEffect(structuredClone(f) as typeof f);
  for (const spellId of def.startingSpellIds) c.learnSpell(spellId);
  c.inventory.add(item(def.weaponId));
  if (def.armorId) {
    const armor = item(def.armorId);
    c.inventory.add(armor);
    c.equipArmor(armor);
  }
  if (def.startsWithShield) {
    const shield = item("shield");
    c.inventory.add(shield);
    c.equipShield(shield);
  }
  c.inventory.add(item("torch"), 2);
  c.inventory.add(item("ration"), 1);
  engine.registerCharacter(c);
  return c;
}
