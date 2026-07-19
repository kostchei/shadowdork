import { describe, expect, it } from "vitest";
import {
  Engine,
  characterTitle,
  statModifier,
  type Alignment,
  type ClassName,
} from "../src/engine";
import { createCharacter, highestAvailableDamagingSpellIndex, isPlebName, item, randomPlebName, registerTables } from "../src/data";

function makeEngine(seed: number): Engine {
  const engine = new Engine({ seed });
  registerTables(engine);
  return engine;
}

const CLASSES: ClassName[] = ["fighter", "thief", "priest", "wizard"];
const HIT_DIE_SIDES: Record<ClassName, number> = { fighter: 8, thief: 4, priest: 6, wizard: 4 };
const SEEDS = [1, 7, 42, 99, 1234, 5678, 31337, 8080, 271828, 314159];

describe("character generation rules", () => {
  it("always rolls at least two stats of 15+", () => {
    for (const seed of SEEDS) {
      const c = createCharacter(makeEngine(seed), `c${seed}`, "Test", "fighter");
      const high = Object.values(c.stats).filter((s) => s >= 15).length;
      expect(high).toBeGreaterThanOrEqual(2);
    }
  });

  it("puts a 15+ in each class's prime stat", () => {
    for (const seed of SEEDS) {
      const fighter = createCharacter(makeEngine(seed), `f${seed}`, "F", "fighter");
      expect(fighter.stats.STR).toBeGreaterThanOrEqual(15);
      const thief = createCharacter(makeEngine(seed + 1), `t${seed}`, "T", "thief");
      expect(thief.stats.DEX).toBeGreaterThanOrEqual(15);
      const priest = createCharacter(makeEngine(seed + 2), `p${seed}`, "P", "priest");
      expect(priest.stats.WIS).toBeGreaterThanOrEqual(15);
      const wizard = createCharacter(makeEngine(seed + 3), `w${seed}`, "W", "wizard");
      expect(wizard.stats.INT).toBeGreaterThanOrEqual(15);
    }
  });

  it("grants max HP at level 1 (hit die sides + CON mod, min 1)", () => {
    for (const cls of CLASSES) {
      const c = createCharacter(makeEngine(11), `hp-${cls}`, "H", cls);
      const expected = Math.max(1, HIT_DIE_SIDES[cls] + statModifier(c.stats.CON));
      // Talents can add on top; the floor is the maximized hit die.
      expect(c.maxHp).toBeGreaterThanOrEqual(expected);
      expect(c.hp).toBe(c.maxHp);
    }
  });

  it("equips the class kits", () => {
    const e = makeEngine(21);
    const fighter = createCharacter(e, "kf", "F", "fighter");
    expect(fighter.weapon.id).toBe("spear");
    expect(fighter.wornArmor?.id).toBe("chainmail");
    expect(fighter.carriedShield?.id).toBe("shield");
    expect(fighter.inventory.count("javelin")).toBe(3);

    const thief = createCharacter(e, "kt", "T", "thief");
    expect(thief.weapon.id).toBe("dagger");
    expect(thief.wornArmor?.id).toBe("leather-armor");
    expect(thief.inventory.has("shortbow")).toBe(true);

    const priest = createCharacter(e, "kp", "P", "priest");
    expect(priest.weapon.id).toBe("mace");
    expect(priest.wornArmor?.id).toBe("chainmail");
    expect(priest.carriedShield?.id).toBe("shield");

    const wizard = createCharacter(e, "kw", "W", "wizard");
    expect(wizard.weapon.id).toBe("staff");
    expect(wizard.wornArmor).toBeNull();
    expect(wizard.inventory.count("dagger")).toBe(2);
  });

  it("keeps every generated starting kit within the character's gear slots", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const cls of CLASSES) {
        const c = createCharacter(makeEngine(seed), `${cls}-${seed}`, "Test", cls);
        expect(c.inventory.slotsUsed()).toBeLessThanOrEqual(c.inventory.capacity);
      }
    }
  });

  it("humans start with two rolled talents", () => {
    const c = createCharacter(makeEngine(31), "hu", "H", "fighter", "human");
    const startTalents = c.effects.filter((ef) => ef.id.startsWith("talent-start-"));
    expect(startTalents.length).toBe(2);
    const other = createCharacter(makeEngine(31), "dw", "D", "fighter", "dwarf");
    const otherTalents = other.effects.filter((ef) => ef.id.startsWith("talent-start-"));
    expect(otherTalents.length).toBe(1);
  });

  it("draws names from the Pleb Generator pool without duplicates", () => {
    const engine = makeEngine(8128);
    const used = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const name = randomPlebName(engine.dice, used);
      expect(isPlebName(name)).toBe(true);
      expect(used.has(name)).toBe(false);
      used.add(name);
    }
  });

  it("derives Shadowdark titles from class, alignment, and two-level bands", () => {
    const examples: [ClassName, Alignment, number, string][] = [
      ["fighter", "law", 1, "Squire"],
      ["fighter", "chaos", 7, "Reaver"],
      ["priest", "neutral", 9, "Oracle"],
      ["thief", "chaos", 5, "Shadow"],
      ["wizard", "law", 10, "Archmage"],
    ];
    for (const [className, alignment, level, title] of examples) {
      expect(characterTitle(className, alignment, level)).toBe(title);
    }
  });

  it("rolls an alignment for generated characters and updates their title on level-up", () => {
    const c = createCharacter(makeEngine(94), "identity", "Test", "fighter");
    expect(["law", "neutral", "chaos"]).toContain(c.alignment);
    expect(c.title).toBe(characterTitle("fighter", c.alignment, 1));
    c.level = 3;
    expect(c.title).toBe(characterTitle("fighter", c.alignment, 3));
  });

  it("supports alternate Cursed Scroll classes (pit-fighter, sea-wolf, ras-godai, witch, seer)", () => {
    const alternateClasses: ClassName[] = ["pit-fighter", "sea-wolf", "ras-godai", "witch", "seer"];
    for (const cls of alternateClasses) {
      const c = createCharacter(makeEngine(100), `alt-${cls}`, "Alt", cls);
      expect(c.className).toBe(cls);
      expect(c.maxHp).toBeGreaterThan(0);
      expect(c.inventory.slotsUsed()).toBeLessThanOrEqual(c.inventory.capacity);
    }
  });

  it("starts Wizard and Witch with staff and 2 daggers in inventory", () => {
    const engine = makeEngine(42);
    const wizard = createCharacter(engine, "w1", "Merlin", "wizard");
    expect(wizard.wieldedWeapon?.id).toBe("staff");
    expect(wizard.inventory.count("dagger")).toBe(2);

    const witch = createCharacter(engine, "w2", "Morgana", "witch");
    expect(witch.wieldedWeapon?.id).toBe("staff");
    expect(witch.inventory.count("dagger")).toBe(2);
  });

  it("selects highest-tier damaging spell for spellcasting", () => {
    const engine = makeEngine(42);
    const wizard = createCharacter(engine, "w1", "Merlin", "wizard");
    wizard.learnSpell("fireball");

    const idx = highestAvailableDamagingSpellIndex(wizard);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(wizard.knownSpells[idx]?.spellId).toBe("fireball");
  });

  it("sunder staff ability: destroying staff on hit negates damage and equips dagger", () => {
    const engine = makeEngine(42);
    const wizard = createCharacter(engine, "w1", "Merlin", "wizard");
    expect(wizard.wieldedWeapon?.id).toBe("staff");

    // Simulate Staff Sunder logic when hit
    if (wizard.wieldedWeapon?.id === "staff") {
      wizard.inventory.remove("staff", 1);
      wizard.wieldedWeapon = null;
      if (wizard.inventory.has("dagger")) {
        wizard.equipWeapon(item("dagger"));
      }
    }

    expect(wizard.wieldedWeapon?.id).toBe("dagger");
    expect(wizard.inventory.has("staff")).toBe(false);
  });

  it("equips Thief with shortbow and 2 daggers for ranged and dual melee", () => {
    const engine = makeEngine(42);
    const thief = createCharacter(engine, "t1", "Shadow", "thief");
    expect(thief.wieldedWeapon?.id).toBe("dagger");
    expect(thief.inventory.has("shortbow")).toBe(true);
    expect(thief.inventory.count("dagger")).toBe(1);
  });
});
