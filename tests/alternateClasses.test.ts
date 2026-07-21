import { describe, expect, it } from "vitest";
import {
  Engine,
  activateShieldWall,
  armPoisonedWeapon,
  assassinExtraDamageDice,
  cancelShieldWall,
  destinedLuckBonus,
  hideCharacter,
  isShieldWallActive,
  poisonApplicationAccident,
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

describe("alternate class mechanics", () => {
  it("uses unique talent and spell lists with the correct casting stats", () => {
    expect(classDef("pit-fighter").talentTableId).toBe("pit-fighter-talents");
    expect(classDef("sea-wolf").talentTableId).toBe("sea-wolf-talents");
    expect(classDef("ras-godai").talentTableId).toBe("ras-godai-talents");
    expect(classDef("witch").startingSpellIds).toEqual(["cauldron", "witchlight", "fog"]);
    expect(classDef("seer").startingSpellIds).toEqual(["chant", "trance", "seer-potion"]);
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
    const ras = createCharacter(makeEngine(), "ras", "Ras", "ras-godai");
    expect(assassinExtraDamageDice(ras, true)).toBe(0);
    hideCharacter(ras);
    expect(assassinExtraDamageDice(ras, true)).toBe(1);
    expect(assassinExtraDamageDice(ras, false)).toBe(0);
    expect(poisonApplicationAccident(ras, 1)).toBe(true);
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
});
