import { describe, expect, it } from "vitest";
import {
  Character,
  DC,
  Dice,
  Engine,
  resolveCheck,
  statModifier,
  xpToNextLevel,
} from "../src/engine";
import { createCharacter, item, registerTables, spell } from "../src/data";

function makeEngine(seed = 42): Engine {
  const engine = new Engine({ seed });
  registerTables(engine);
  return engine;
}

describe("dice", () => {
  it("is deterministic under a seed", () => {
    const a = new Dice(7);
    const b = new Dice(7);
    for (let i = 0; i < 50; i++) expect(a.die(20)).toBe(b.die(20));
  });

  it("parses dice expressions", () => {
    const d = new Dice(1);
    const r = d.rollDetailed("2d6+3");
    expect(r.rolls).toHaveLength(2);
    expect(r.modifier).toBe(3);
    expect(r.total).toBe(r.rolls[0]! + r.rolls[1]! + 3);
  });

  it("throws on invalid expressions", () => {
    const d = new Dice(1);
    expect(() => d.roll("banana")).toThrow('Invalid dice expression: "banana"');
    expect(() => d.roll("0d6")).toThrow();
  });

  it("advantage takes the higher of two dice, disadvantage the lower", () => {
    const d = new Dice(3);
    for (let i = 0; i < 100; i++) {
      const adv = d.d20("advantage");
      expect(adv.rolls).toHaveLength(2);
      expect(adv.natural).toBe(Math.max(...adv.rolls));
      const dis = d.d20("disadvantage");
      expect(dis.natural).toBe(Math.min(...dis.rolls));
    }
  });
});

describe("stat modifiers", () => {
  it("maps scores 3..18 to -4..+4", () => {
    expect(statModifier(3)).toBe(-4);
    expect(statModifier(10)).toBe(0);
    expect(statModifier(11)).toBe(0);
    expect(statModifier(14)).toBe(2);
    expect(statModifier(18)).toBe(4);
  });

  it("throws on invalid scores", () => {
    expect(() => statModifier(0)).toThrow();
    expect(() => statModifier(21)).toThrow();
  });
});

describe("resolveCheck", () => {
  function fighter(): Character {
    return new Character({
      id: "f1",
      name: "Test Fighter",
      className: "fighter",
      stats: { STR: 16, DEX: 12, CON: 14, INT: 9, WIS: 10, CHA: 11 },
      maxHp: 10,
      baseAc: 15,
    });
  }

  it("nat 1 auto-fails and nat 20 auto-succeeds regardless of modifiers", () => {
    const actor = fighter();
    let sawFumble = false;
    let sawCrit = false;
    const dice = new Dice(9);
    for (let i = 0; i < 500; i++) {
      const r = resolveCheck(dice, { actor, stat: "STR", dc: 999, kind: "stat" });
      if (r.natural === 20) {
        expect(r.success).toBe(true);
        sawCrit = true;
      }
      const r2 = resolveCheck(dice, { actor, stat: "STR", dc: -999, kind: "stat" });
      if (r2.natural === 1) {
        expect(r2.success).toBe(false);
        expect(r2.fumble).toBe(true);
        sawFumble = true;
      }
    }
    expect(sawFumble).toBe(true);
    expect(sawCrit).toBe(true);
  });

  it("advantage and disadvantage cancel to a normal roll", () => {
    const actor = fighter();
    const r = resolveCheck(new Dice(1), {
      actor,
      stat: "STR",
      dc: DC.NORMAL,
      kind: "attack",
      advantage: ["above target"],
      disadvantage: ["in darkness"],
    });
    expect(r.mode).toBe("normal");
    expect(r.rolls).toHaveLength(1);
  });

  it("talent hooks add to matching checks and grant advantage", () => {
    const actor = fighter();
    actor.addEffect({
      id: "t1",
      name: "+2 attacks",
      hooks: [{ kind: "checkBonus", applies: "attack", bonus: 2 }],
    });
    actor.addEffect({
      id: "t2",
      name: "adv on attacks",
      hooks: [{ kind: "advantageOn", applies: "attack" }],
    });
    const r = resolveCheck(new Dice(5), { actor, stat: "STR", dc: DC.NORMAL, kind: "attack" });
    expect(r.modifier).toBe(3 + 2); // STR 16 => +3, talent +2
    expect(r.mode).toBe("advantage");
    const other = resolveCheck(new Dice(5), { actor, stat: "STR", dc: DC.NORMAL, kind: "stat" });
    expect(other.modifier).toBe(3);
    expect(other.mode).toBe("normal");
  });
});

describe("spellcasting state machine", () => {
  it("loses the spell on a failed check and recovers it on rest", () => {
    // Find a seed where the wizard fails (non-nat-1) a cast.
    for (let seed = 0; seed < 200; seed++) {
      const engine = makeEngine(seed);
      const wiz = createCharacter(engine, "w", "Wizard", "wizard");
      wiz.inventory.add(item("ration"), 1);
      const result = engine.cast(wiz, spell("magic-missile"));
      if (result.outcome === "fail") {
        expect(wiz.knownSpell("magic-missile").status).toBe("lost");
        expect(() => engine.cast(wiz, spell("magic-missile"))).toThrow(/lost until/);
        engine.rest(wiz, item("ration"));
        expect(wiz.knownSpell("magic-missile").status).toBe("available");
        return;
      }
    }
    throw new Error("No seed produced a plain failure in 200 tries");
  });

  it("nat 1 wizard cast rolls the mishap table", () => {
    for (let seed = 0; seed < 500; seed++) {
      const engine = makeEngine(seed);
      const wiz = createCharacter(engine, "w", "Wizard", "wizard");
      const result = engine.cast(wiz, spell("magic-missile"));
      if (result.check.natural === 1) {
        expect(result.outcome).toBe("mishap");
        expect(result.mishap).toBeDefined();
        expect(wiz.knownSpell("magic-missile").status).toBe("lost");
        return;
      }
    }
    throw new Error("No seed produced a nat 1 in 500 tries");
  });

  it("priests cannot cast wizard spells and vice versa", () => {
    const engine = makeEngine();
    const priest = createCharacter(engine, "p", "Priest", "priest");
    expect(() => priest.knownSpell("magic-missile")).toThrow(/does not know/);
  });
});

describe("inventory gear slots", () => {
  it("capacity is max(STR, 10) and overflow throws", () => {
    const engine = makeEngine();
    const wiz = createCharacter(engine, "w", "Wizard", "wizard"); // STR 9 => capacity 10
    expect(wiz.inventory.capacity).toBe(10);
    // Starting gear: staff + 2 torches + ration = 4 slots.
    expect(wiz.inventory.slotsUsed()).toBe(4);
    wiz.inventory.add(item("ration"), 6); // 10 slots used
    expect(() => wiz.inventory.add(item("torch"))).toThrow(/Cannot carry/);
  });

  it("first 100 coins are free, then 1 slot per 100", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    const before = f.inventory.slotsUsed();
    f.inventory.add(item("coins"), 100);
    expect(f.inventory.slotsUsed()).toBe(before); // free
    f.inventory.add(item("coins"), 1);
    expect(f.inventory.slotsUsed()).toBe(before + 1); // 101st coin starts a slot
    f.inventory.add(item("coins"), 199);
    expect(f.inventory.slotsUsed()).toBe(before + 2); // 300 total = 2 charged slots
  });

  it("fighters haul extra slots equal to their CON modifier", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter"); // STR 16, CON 14 (+2)
    expect(f.inventory.capacity).toBe(18);
    const t = createCharacter(engine, "t", "Thief", "thief"); // STR 10, no hauler
    expect(t.inventory.capacity).toBe(10);
  });
});

describe("advancement", () => {
  it("levels up at level x 10 XP, rolls HP and a talent", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    expect(xpToNextLevel(1)).toBe(10);
    engine.awardXp(f, 9);
    expect(engine.canLevelUp(f)).toBe(false);
    const award = engine.awardXp(f, 1);
    expect(award.leveledUp).toBe(true);
    const before = f.maxHp;
    const result = engine.levelUp(f, "1d8", "fighter-talents");
    expect(result.newLevel).toBe(2);
    expect(f.maxHp).toBeGreaterThan(before);
    expect(f.xp).toBe(0);
    expect(f.effects.some((e) => e.id.startsWith("talent-L2"))).toBe(true);
  });

  it("throws when leveling without enough XP", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    expect(() => engine.levelUp(f, "1d8", "fighter-talents")).toThrow(/cannot level up/);
  });
});

describe("death timers", () => {
  it("dropping to 0 HP starts a countdown ending in death or a nat-20 self-revive", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    const wentDown = engine.damageCharacter(f, 999);
    expect(wentDown).toBe(true);
    expect(f.dying).not.toBeNull();
    expect(f.dying!.roundsRemaining).toBeGreaterThanOrEqual(1);
    engine.advance(10 * engine.config.roundMs);
    const selfRevived = !f.dead && f.dying === null && f.hp === 1;
    expect(f.dead || selfRevived).toBe(true);
  });

  it("healing clears the death timer", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    engine.damageCharacter(f, 999);
    f.heal(5);
    expect(f.dying).toBeNull();
    engine.advance(20 * engine.config.roundMs);
    expect(f.dead).toBe(false);
  });
});

describe("rest", () => {
  it("requires a ration", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    f.inventory.remove("ration", 1);
    expect(() => engine.rest(f, item("ration"))).toThrow(/no Ration/);
  });

  it("freeRest restores HP and spells without a ration", () => {
    const engine = makeEngine();
    const w = createCharacter(engine, "w", "Wizard", "wizard");
    w.inventory.remove("ration", 1);
    w.takeDamage(3);
    w.knownSpell("magic-missile").status = "lost";
    engine.freeRest(w);
    expect(w.hp).toBe(w.maxHp);
    expect(w.knownSpell("magic-missile").status).toBe("available");
  });
});

describe("tables", () => {
  it("throws on unknown table ids", () => {
    const engine = makeEngine();
    expect(() => engine.rollTable("no-such-table")).toThrow('Unknown table "no-such-table"');
  });

  it("2d6 talent tables cover 2..12", () => {
    const engine = makeEngine();
    for (let i = 0; i < 100; i++) {
      const r = engine.rollTable("fighter-talents");
      expect(r.roll).toBeGreaterThanOrEqual(2);
      expect(r.roll).toBeLessThanOrEqual(12);
      expect(r.entry.text.length).toBeGreaterThan(0);
    }
  });
});

describe("timers (torch semantics)", () => {
  it("real-time timers expire and support pause", () => {
    const engine = makeEngine();
    let expired = false;
    engine.clock.addTimer("torch-1", 1000, () => {
      expired = true;
    });
    engine.advance(500);
    engine.clock.setTimerPaused("torch-1", true);
    engine.advance(5000);
    expect(expired).toBe(false);
    engine.clock.setTimerPaused("torch-1", false);
    engine.advance(600);
    expect(expired).toBe(true);
    expect(engine.clock.hasTimer("torch-1")).toBe(false);
  });
});
