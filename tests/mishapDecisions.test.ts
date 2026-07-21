import { describe, expect, it } from "vitest";
import {
  WITCH_MISHAP_TABLE_TIER_1_2,
  WITCH_MISHAP_TABLE_TIER_3_4,
  WITCH_MISHAP_TABLE_TIER_5,
  WIZARD_MISHAP_TABLE_TIER_1_2,
  WIZARD_MISHAP_TABLE_TIER_3_4,
  WIZARD_MISHAP_TABLE_TIER_5,
  Engine,
  availableMishapDecisions,
  sumCheckBonus,
} from "../src/engine";
import { createCharacter, registerTables, spell } from "../src/data";

function makeEngine(seed: number): Engine {
  const engine = new Engine({ seed });
  registerTables(engine);
  return engine;
}

describe("pending mishap decisions", () => {
  it("freezes spell loss and consequences until the pending mishap is accepted", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const engine = makeEngine(seed);
      const wizard = createCharacter(engine, "wizard", "Vess", "wizard");
      const pending = engine.cast(wizard, spell("magic-missile"));
      if (pending.outcome !== "pendingMishap") continue;

      expect(wizard.knownSpell("magic-missile").status).toBe("available");
      expect(availableMishapDecisions(wizard, pending)).toEqual(["spendLuck", "accept"]);
      expect(pending.mishapResolution).toBeUndefined();
      const accepted = engine.acceptMishap(wizard, pending, "known");
      expect(accepted.outcome).toBe("mishap");
      expect(availableMishapDecisions(wizard, pending)).toEqual([]);
      expect(wizard.knownSpell("magic-missile").status).toBe("lost");
      expect(() => engine.acceptMishap(wizard, pending, "known")).toThrow("already accepted");
      return;
    }
    throw new Error("No natural 1 found");
  });

  it("spending Luck invalidates the previewed mishap and a successful reroll leaves no spell loss", () => {
    for (let seed = 0; seed < 5000; seed++) {
      const engine = makeEngine(seed);
      const wizard = createCharacter(engine, "wizard", "Vess", "wizard");
      const pending = engine.cast(wizard, spell("magic-missile"));
      if (pending.outcome !== "pendingMishap") continue;

      engine.spendLuckOnMishap(wizard, pending);
      const reroll = engine.cast(wizard, spell("magic-missile"));
      if (reroll.outcome !== "success" && reroll.outcome !== "crit") continue;

      expect(wizard.luckToken).toBe(false);
      expect(pending.mishapResolution).toBe("discarded");
      expect(wizard.knownSpell("magic-missile").status).toBe("available");
      expect(() => engine.acceptMishap(wizard, pending, "known")).toThrow("already discarded");
      return;
    }
    throw new Error("No natural-1 then successful reroll sequence found");
  });

  it("requires a real Luck token and cannot discard the same pending result twice", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const engine = makeEngine(seed);
      const wizard = createCharacter(engine, "wizard", "Vess", "wizard");
      const pending = engine.cast(wizard, spell("magic-missile"));
      if (pending.outcome !== "pendingMishap") continue;
      wizard.luckToken = false;
      expect(availableMishapDecisions(wizard, pending)).toEqual(["accept"]);
      expect(() => engine.spendLuckOnMishap(wizard, pending)).toThrow("no Luck token");
      wizard.luckToken = true;
      engine.spendLuckOnMishap(wizard, pending);
      wizard.luckToken = true;
      expect(() => engine.spendLuckOnMishap(wizard, pending)).toThrow("already discarded");
      return;
    }
    throw new Error("No natural 1 found");
  });
});

describe("expanded mishap tables", () => {
  const wizardTables = [
    WIZARD_MISHAP_TABLE_TIER_1_2,
    WIZARD_MISHAP_TABLE_TIER_3_4,
    WIZARD_MISHAP_TABLE_TIER_5,
  ];
  const witchTables = [
    WITCH_MISHAP_TABLE_TIER_1_2,
    WITCH_MISHAP_TABLE_TIER_3_4,
    WITCH_MISHAP_TABLE_TIER_5,
  ];

  it("provides twelve contiguous outcomes in every Wizard and Witch tier band", () => {
    const engine = makeEngine(1);
    for (const id of [...wizardTables, ...witchTables]) {
      const table = engine.tables.get(id);
      expect(table.dice).toBe("1d12");
      expect(table.entries).toHaveLength(12);
      expect(table.entries.map((entry) => entry.min)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it("covers spatial, inventory, light, summoning, spell-state, and repeated-casting families", () => {
    const engine = makeEngine(2);
    const keys = new Set(
      wizardTables.flatMap((id) => engine.tables.get(id).entries)
        .flatMap((entry) => Object.keys(entry.data ?? {})),
    );
    for (const key of ["redirectDamageDice", "vanishGear", "snuffLights", "beaconRounds", "sinkhole", "summonMonsterId", "portal", "loseSpell", "magicTearRounds", "repeatCast"]) {
      expect(keys.has(key), `missing consequence family ${key}`).toBe(true);
    }
  });

  it("uses CHA and Diabolical tables for Witch natural 1s", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const engine = makeEngine(seed);
      const witch = createCharacter(engine, "witch", "Mara", "witch");
      const result = engine.cast(witch, spell("cauldron"));
      if (result.outcome !== "pendingMishap") continue;
      expect(result.check.modifier).toBe(
        witch.mod("CHA") + sumCheckBonus(witch.effects, "spellcast", witch.level),
      );
      expect(result.mishap?.table.id).toBe(WITCH_MISHAP_TABLE_TIER_1_2);
      expect(witch.knownSpell("cauldron").status).toBe("available");
      engine.acceptMishap(witch, result, "known");
      expect(witch.knownSpell("cauldron").status).toBe("lost");
      return;
    }
    throw new Error("No Witch natural 1 found");
  });
});
