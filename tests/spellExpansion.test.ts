import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { createCharacter, registerTables, spell, spellsForClass } from "../src/data";
import { deserializeCharacter, serializeCharacter } from "../src/game/state";

function engine(seed = 1): Engine {
  const value = new Engine({ seed, config: { torchMs: 60_000, roundMs: 1_000, crawlingRoundMs: 10_000 } });
  registerTables(value);
  return value;
}

describe("Phase 2 spell expansion", () => {
  it("uses the core Wizard damage ladder's authoritative tiers and decisions", () => {
    expect(spell("acid-arrow")).toMatchObject({ tier: 2, range: "far", focus: true, dice: "1d6", target: "enemy" });
    expect(spell("lightning-bolt")).toMatchObject({ tier: 3, range: "far", dice: "3d6", target: "direction" });
    expect(spell("cloudkill")).toMatchObject({ tier: 4, range: "far", dice: "2d6", target: "point" });
    expect(spell("prismatic-orb")).toMatchObject({ tier: 5, range: "far", dice: "3d8", choices: ["fire", "cold", "electricity"] });
  });

  it("contains every selected Cursed Scroll Witch and Seer spell at its source tier", () => {
    const witch = new Map(spellsForClass("witch").map((entry) => [entry.id, entry.tier]));
    expect(Object.fromEntries(witch)).toMatchObject({
      cauldron: 1, fog: 1, witchlight: 1,
      spidersilk: 2, "cats-eye": 2, bogboil: 2,
      broomstick: 3, howl: 3, "speak-with-dead": 3,
    });
    const seer = new Map(spellsForClass("seer").map((entry) => [entry.id, entry.tier]));
    expect(Object.fromEntries(seer)).toMatchObject({
      chant: 1, trance: 1, "seer-potion": 1, "evoke-rage": 1,
      fate: 2, "read-runes": 2, "cast-out": 3, wolfshape: 3,
    });
  });

  it("failed Focus checks end Focus without losing the known spell", () => {
    for (let seed = 0; seed < 2_000; seed++) {
      const rules = engine(seed);
      const witch = createCharacter(rules, `witch-${seed}`, "Mara", "witch");
      witch.learnSpell("spidersilk");
      witch.addEffect({
        id: "focus:test",
        name: "Focus: Spidersilk",
        hooks: [{ kind: "focusSpell", spellId: "spidersilk", tier: 2 }],
        duration: { unit: "focus", remaining: 0 },
      });
      rules.advance(rules.config.roundMs);
      if (witch.effects.some((effect) => effect.id === "focus:test")) continue;
      expect(witch.knownSpell("spidersilk").status).toBe("available");
      return;
    }
    throw new Error("No failed Focus check found");
  });

  it("persists Cauldron storage but drops scene-bound Focus on load", () => {
    const rules = engine();
    const witch = createCharacter(rules, "witch-save", "Mara", "witch");
    witch.classState.cauldronItems = [{ itemId: "rope", qty: 1 }];
    witch.addEffect({
      id: "focus:test",
      name: "Focus",
      hooks: [{ kind: "focusSpell", spellId: "fog", tier: 1 }],
      duration: { unit: "focus", remaining: 0 },
    });
    const loaded = deserializeCharacter(serializeCharacter(witch), rules);
    expect(loaded.classState.cauldronItems).toEqual([{ itemId: "rope", qty: 1 }]);
    expect(loaded.effects.some((effect) => effect.duration?.unit === "focus")).toBe(false);
  });
});
