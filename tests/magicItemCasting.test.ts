import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { createCharacter, item, registerTables, spell, spellForMagicItem } from "../src/data";
import { TREASURE_4_6 } from "../src/data/tables/treasure";

function engine(seed: number): Engine {
  const value = new Engine({ seed });
  registerTables(value);
  return value;
}

describe("scroll and wand spellcasting", () => {
  it("maps the initial scrolls and wand to real spells and usable item actions", () => {
    expect(spellForMagicItem("scroll-cure-wounds")?.id).toBe("cure-wounds");
    expect(spellForMagicItem("scroll-burning-hands")?.id).toBe("burning-hands");
    expect(spellForMagicItem("wand-fireball")?.id).toBe("fireball");
    const wandEntry = TREASURE_4_6.entries.find((entry) => entry.min === 92)!;
    const wandId = (wandEntry.data as { itemId: string }).itemId;
    expect(spellForMagicItem(wandId, "wand-fireball")?.id).toBe("fireball");
    expect(item("scroll-light").use?.actions).toContain("cast");
    expect(item("wand-fireball").use?.inertOnFail).toBe(true);
    expect(item("wand-fireball").use?.breaksOnCriticalFail).toBe(true);
  });

  it("allows a class-list spell the caster does not know and uses DC 10 + tier", () => {
    const e = engine(7);
    const wizard = createCharacter(e, "w", "Wizard", "wizard");
    expect(wizard.knownSpells.some((known) => known.spellId === "fireball")).toBe(false);

    const result = e.castItem(wizard, spell("fireball"));

    expect(result.check.dc).toBe(13);
    expect(wizard.knownSpells.some((known) => known.spellId === "fireball")).toBe(false);
  });

  it("rejects a spell from the other class list", () => {
    const e = engine(1);
    const priest = createCharacter(e, "p", "Priest", "priest");
    expect(() => e.castItem(priest, spell("fireball"))).toThrow("cannot cast wizard spells");
  });

  it("does not lose or alter a known spell when an item cast fails", () => {
    for (let seed = 0; seed < 200; seed++) {
      const e = engine(seed);
      const wizard = createCharacter(e, "w", "Wizard", "wizard");
      const knownBefore = structuredClone(wizard.knownSpells);
      const result = e.castItem(wizard, spell("burning-hands"));
      if (result.outcome !== "fail") continue;
      expect(wizard.knownSpells).toEqual(knownBefore);
      return;
    }
    throw new Error("No seed produced a plain item-cast failure");
  });

  it("rolls a wizard mishap on an item-cast natural 1 without losing a known spell", () => {
    for (let seed = 0; seed < 500; seed++) {
      const e = engine(seed);
      const wizard = createCharacter(e, "w", "Wizard", "wizard");
      const knownBefore = structuredClone(wizard.knownSpells);
      const result = e.castItem(wizard, spell("burning-hands"));
      if (result.check.natural !== 1) continue;
      expect(result.outcome).toBe("pendingMishap");
      expect(result.mishap).toBeDefined();
      expect(wizard.knownSpells).toEqual(knownBefore);
      expect(e.acceptMishap(wizard, result, "item").outcome).toBe("mishap");
      expect(wizard.knownSpells).toEqual(knownBefore);
      return;
    }
    throw new Error("No seed produced an item-cast natural 1");
  });
});
