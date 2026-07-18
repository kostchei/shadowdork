import { describe, expect, it } from "vitest";
import { Engine, statModifier, type ClassName } from "../src/engine";
import { createCharacter, registerTables } from "../src/data";

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
});
