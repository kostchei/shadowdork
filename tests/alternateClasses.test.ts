import { describe, expect, it } from "vitest";
import {
  Engine,
  applyTalentResult,
  activateShieldWall,
  armPoisonedWeapon,
  assassinExtraDamageDice,
  cancelShieldWall,
  destinedLuckBonus,
  chooseOldGods,
  goBerserk,
  hideCharacter,
  isShieldWallActive,
  poisonApplicationAccident,
  resourceMaximum,
  restoreFamiliar,
  resolveBlackLotusPower,
  poisonedWeaponDamage,
  restoreClassResources,
  triggerFlourish,
} from "../src/engine";
import { classDef, createCharacter, registerTables, spell, spellsForClass } from "../src/data";
import { deserializeCharacter, serializeCharacter } from "../src/game/state";

function makeEngine(seed = 42): Engine {
  const engine = new Engine({ seed });
  registerTables(engine);
  return engine;
}

function applyRoll(engine: Engine, character: ReturnType<typeof createCharacter>, tableId: string, roll: number): void {
  const table = engine.tables.get(tableId);
  const entry = table.entries.find((candidate) => roll >= candidate.min && roll <= candidate.max)!;
  applyTalentResult(engine.dice, engine.tables, character, { table, roll, entry }, `test-${tableId}-${roll}`);
}

describe("alternate class mechanics", () => {
  it("uses unique talent and spell lists with the correct casting stats", () => {
    expect(classDef("pit-fighter").talentTableId).toBe("pit-fighter-talents");
    expect(classDef("sea-wolf").talentTableId).toBe("sea-wolf-talents");
    expect(classDef("ras-godai").talentTableId).toBe("ras-godai-talents");
    expect(classDef("witch").startingSpellIds).toEqual(["cauldron", "witchlight", "fog"]);
    expect(classDef("seer").startingSpellIds).toEqual(["chant"]);
    expect(spellsForClass("witch").every((candidate) => candidate.class === "witch")).toBe(true);
    expect(spellsForClass("seer").every((candidate) => candidate.class === "seer")).toBe(true);
    expect(spellsForClass("witch").length).toBeGreaterThanOrEqual(6);
    expect(spellsForClass("seer").length).toBeGreaterThanOrEqual(6);

    const engine = makeEngine();
    const witch = createCharacter(engine, "w", "Witch", "witch");
    const seer = createCharacter(engine, "s", "Seer", "seer");
    expect(witch.stats.CHA).toBeGreaterThanOrEqual(15);
    expect(seer.stats.WIS).toBeGreaterThanOrEqual(15);
    expect(() => engine.cast(witch, spell("cauldron"))).not.toThrow();
    witch.learnSpell("magic-missile");
    expect(() => engine.cast(witch, spell("magic-missile"))).toThrow(/cannot cast wizard spells/);
    seer.learnSpell("cure-wounds");
    expect(() => engine.cast(seer, spell("cure-wounds"))).toThrow(/cannot cast priest spells/);
  });

  it("makes Shield Wall an active, shield-gated AC 20 stance", () => {
    const seaWolf = createCharacter(makeEngine(), "sea", "Sea", "sea-wolf");
    activateShieldWall(seaWolf);
    expect(isShieldWallActive(seaWolf)).toBe(true);
    expect(seaWolf.ac).toBeGreaterThanOrEqual(20);
    seaWolf.shieldStowed = true;
    expect(seaWolf.ac).toBeLessThan(20);
    expect(cancelShieldWall(seaWolf)).toBe(true);
  });

  it("spends and restores three Flourishes only when healing a melee hit", () => {
    const pit = createCharacter(makeEngine(), "pit", "Pit", "pit-fighter");
    pit.takeDamage(4);
    const result = triggerFlourish(pit, { roll: () => 4 });
    expect(result).toEqual({ healed: 4, usesRemaining: 2 });
    expect(triggerFlourish(pit, { roll: () => 4 })).toBeNull();
    restoreClassResources(pit);
    expect(pit.classState.flourishUses).toBe(3);
  });

  it("models Ras-Godai hiding, unaware-target damage, and poison training", () => {
    const engine = makeEngine();
    const ras = createCharacter(engine, "ras", "Ras", "ras-godai");
    expect(assassinExtraDamageDice(ras, true)).toBe(0);
    hideCharacter(ras);
    expect(assassinExtraDamageDice(ras, true)).toBe(1);
    expect(assassinExtraDamageDice(ras, false)).toBe(0);
    expect(poisonApplicationAccident(ras, 1)).toBe(true);
    applyRoll(engine, ras, "ras-godai-talents", 2);
    expect(poisonApplicationAccident(ras, 2)).toBe(false);
    const fighter = createCharacter(makeEngine(), "f", "F", "fighter");
    expect(poisonApplicationAccident(fighter, 2)).toBe(true);
    armPoisonedWeapon(ras);
    expect(poisonedWeaponDamage(ras)).toBe("1d6");
  });

  it("gives Seers a d6 Destined bonus and persists alternate resources", () => {
    const engine = makeEngine();
    const seer = createCharacter(engine, "seer", "Seer", "seer");
    expect(destinedLuckBonus(seer, { roll: () => 6 })).toBe(6);
    seer.classState.omenUses = 0;
    const restored = deserializeCharacter(serializeCharacter(seer), engine);
    expect(restored.classState).toEqual(seer.classState);

    const witch = createCharacter(engine, "witch", "Witch", "witch");
    witch.classState.familiarAlive = false;
    const witchSave = serializeCharacter(witch);
    expect(deserializeCharacter(witchSave, engine).classState.familiarAlive).toBe(false);
    delete witchSave.classState;
    expect(deserializeCharacter(witchSave, engine).classState.familiarAlive).toBe(true);
  });

  it("matches every authentic alternate-class table range and the Black Lotus subtable", () => {
    const engine = makeEngine();
    expect(engine.tables.get("pit-fighter-talents").entries.map(({ min, max }) => [min, max])).toEqual([[2, 2], [3, 6], [7, 9], [10, 11], [12, 12]]);
    expect(engine.tables.get("witch-talents").entries.map(({ min, max }) => [min, max])).toEqual([[2, 2], [3, 7], [8, 9], [10, 11], [12, 12]]);
    expect(engine.tables.get("black-lotus-talents").entries).toHaveLength(12);
    expect(engine.tables.get("black-lotus-talents").entries[5]!.text).toMatch(/triple damage/i);
    expect(engine.tables.get("seer-talents").entries[3]!.text).toMatch(/Destined die category/i);
  });

  it("applies resource, chained-passive, spell, and die-step talent mechanics", () => {
    const pitEngine = makeEngine(11);
    const pit = createCharacter(pitEngine, "p2", "P2", "pit-fighter", "dwarf");
    applyRoll(pitEngine, pit, "pit-fighter-talents", 10);
    pit.takeDamage(20);
    expect(triggerFlourish(pit, { roll: () => 3 })?.healed).toBe(6);
    applyRoll(pitEngine, pit, "pit-fighter-talents", 2);
    const pitHp = pit.hp;
    pitEngine.damageCharacter(pit, 4, { attack: true });
    expect(pit.hp).toBe(pitHp);

    const seaEngine = makeEngine(12);
    const sea = createCharacter(seaEngine, "sw2", "SW2", "sea-wolf", "dwarf");
    applyRoll(seaEngine, sea, "sea-wolf-talents", 10);
    chooseOldGods(sea, ["odin", "loki"]);
    expect(sea.classState.oldGods).toEqual(["odin", "loki"]);
    applyRoll(seaEngine, sea, "sea-wolf-talents", 2);
    goBerserk(sea);
    const before = sea.hp;
    seaEngine.damageCharacter(sea, 99);
    expect(sea.hp).toBe(before);

    const rasEngine = makeEngine(13);
    const ras = createCharacter(rasEngine, "rg2", "RG2", "ras-godai", "dwarf");
    hideCharacter(ras);
    applyRoll(rasEngine, ras, "black-lotus-talents", 6);
    expect(assassinExtraDamageDice(ras, true)).toBe(2);
    applyRoll(rasEngine, ras, "black-lotus-talents", 8);
    expect(resolveBlackLotusPower(ras, "waterWalk", { roll: () => 3 })).toMatchObject({ success: true, durationRounds: 3 });
    expect(ras.effects.some((effect) => effect.hooks.some((hook) => hook.kind === "waterWalking"))).toBe(true);

    const witchEngine = makeEngine(14);
    const witch = createCharacter(witchEngine, "w2", "W2", "witch", "dwarf");
    witch.level = 3;
    applyRoll(witchEngine, witch, "witch-talents", 10);
    expect(witch.knownSpells.some((known) => known.spellId === "spidersilk")).toBe(true);

    const seerEngine = makeEngine(15);
    const seer = createCharacter(seerEngine, "s2", "S2", "seer", "dwarf");
    applyRoll(seerEngine, seer, "seer-talents", 10);
    expect(destinedLuckBonus(seer, { roll: (expr) => expr === "1d8" ? 8 : 0 })).toBe(8);
    expect(resourceMaximum(seer, "omen")).toBeGreaterThanOrEqual(3);
  });

  it("restores a dead familiar through the authentic permanent HP sacrifice", () => {
    const engine = makeEngine();
    const witch = createCharacter(engine, "w3", "W3", "witch", "dwarf");
    witch.increaseMaxHp(4);
    witch.classState.familiarAlive = false;
    const before = witch.maxHp;
    expect(restoreFamiliar(witch, { roll: () => 2 })).toBe(Math.min(before - 1, 2));
    expect(witch.classState.familiarAlive).toBe(true);
    expect(witch.maxHp).toBe(before - Math.min(before - 1, 2));
  });
});
