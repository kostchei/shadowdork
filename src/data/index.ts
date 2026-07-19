import {
  Character,
  rollAlignment,
  rollStats,
  STAT_NAMES,
  type ClassName,
  type Engine,
  type StatName,
  type Stats,
  type Alignment,
} from "../engine";
import { classDef } from "./classes";
import { item } from "./items";
import { WIZARD_MISHAP_TABLES } from "./tables/mishaps";
import {
  FIGHTER_TALENTS,
  PRIEST_TALENTS,
  THIEF_TALENTS,
  WIZARD_TALENTS,
} from "./tables/talents";

import { ALL_TREASURE_TABLES } from "./tables/treasure";

export { classDef, type ClassDef } from "./classes";
export { allItems, item } from "./items";
export { monster } from "./monsters";
export { highestAvailableSpellIndex, spell, spellsForClass } from "./spells";
export { isPlebName, plebNameForSeed, randomPlebName } from "./names";
export { ALL_TREASURE_TABLES } from "./tables/treasure";

/** Register all data tables with an engine instance. Call once at boot. */
export function registerTables(engine: Engine): void {
  engine.tables.register(FIGHTER_TALENTS);
  engine.tables.register(THIEF_TALENTS);
  engine.tables.register(PRIEST_TALENTS);
  engine.tables.register(WIZARD_TALENTS);
  for (const table of WIZARD_MISHAP_TABLES) engine.tables.register(table);
  for (const table of ALL_TREASURE_TABLES) engine.tables.register(table);
}

const PRIME_STAT: Record<ClassName, StatName> = {
  fighter: "STR",
  thief: "DEX",
  priest: "WIS",
  wizard: "INT",
};

/**
 * Guarantee the class prime stat carries one of the rolled 15s by swapping the
 * best qualifying stat in. This also guarantees fighters can carry their
 * complete starting kit within the strength-based gear-slot rules.
 */
function ensurePrimeStat(stats: Stats, cls: ClassName): void {
  const prime = PRIME_STAT[cls];
  if (stats[prime] >= 15) return;
  let best: StatName | null = null;
  for (const s of STAT_NAMES) {
    if (s === prime) continue;
    if (stats[s] >= 15 && (best === null || stats[s] > stats[best])) best = s;
  }
  // rollStats guarantees two 15s; the prime isn't one, so one must exist.
  if (best === null) throw new Error("rollStats produced no 15+ stat to swap");
  const tmp = stats[prime];
  stats[prime] = stats[best];
  stats[best] = tmp;
}

/**
 * Build a level-1 character of the given class: 3d6 stats (silently rerolled
 * until heroic — see rollStats), prime stat guaranteed 15+, max HP at level 1,
 * class armor kit, starting gear and spells. AC is computed from armor + DEX,
 * never stored.
 */
export function createCharacter(
  engine: Engine,
  id: string,
  name: string,
  cls: ClassName,
  ancestry = "human",
  alignment?: Alignment,
): Character {
  const def = classDef(cls);
  const stats = rollStats(engine.dice);
  ensurePrimeStat(stats, cls);

  const conMod = Math.floor((stats.CON - 10) / 2);
  const hitDieSides = parseInt(def.hitDie.split("d")[1] || "8", 10);
  const maxHp = Math.max(1, hitDieSides + conMod);
  const c = new Character({
    id,
    name,
    className: cls,
    stats,
    maxHp,
    ancestry,
    alignment: alignment ?? rollAlignment(engine.dice),
  });
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
  const startingWeapon = item(def.startingWeaponId);
  c.inventory.add(startingWeapon, 1, true);
  c.equipWeapon(startingWeapon);
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
    c.inventory.add(item("javelin"), 3, true);
    c.inventory.add(item("backpack"), 1, true);
    c.inventory.add(item("flint-and-steel"), 1, true);
    c.inventory.add(item("torch"), 2, true);
    c.inventory.add(item("ration"), 3, true);
  } else {
    c.inventory.add(item("torch"), 2, true);
    c.inventory.add(item("ration"), 2, true);
  }
  // Class sidearms: the thief shoots from the shadows, the wizard keeps knives.
  if (cls === "thief") c.inventory.add(item("shortbow"), 1, true);
  if (cls === "wizard") c.inventory.add(item("dagger"), 2, true);

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
