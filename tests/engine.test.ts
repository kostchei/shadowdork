import { describe, expect, it } from "vitest";
import {
  Character,
  DC,
  Dice,
  Engine,
  Inventory,
  resolveCheck,
  rollStats,
  statModifier,
  xpToNextLevel,
} from "../src/engine";
import { createCharacter, item, registerTables, spell } from "../src/data";
import { appearanceForCharacter, characterAppearanceKey } from "../src/game/entities/appearance";

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
    const wiz = createCharacter(engine, "w", "Wizard", "wizard");
    expect(wiz.inventory.capacity).toBe(Math.max(wiz.stats.STR, 10));
    // Starting gear: staff + 2 torches + ration = 4 slots (wizards wear no armor).
    expect(wiz.inventory.slotsUsed()).toBe(4);
    wiz.inventory.add(item("torch"), wiz.inventory.slotsFree());
    expect(() => wiz.inventory.add(item("torch"))).toThrow(/Cannot carry/);
  });

  it("first 100 coins are free, then 1 slot per 100", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    f.inventory = new Inventory(f.inventory.capacity);
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
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    const conMod = Math.max(0, statModifier(f.stats.CON));
    expect(f.inventory.capacity).toBe(Math.max(f.stats.STR, 10) + conMod);
    const t = createCharacter(engine, "t", "Thief", "thief");
    expect(t.inventory.capacity).toBe(Math.max(t.stats.STR, 10)); // no hauler
  });
});

describe("character generation", () => {
  it("rolled stat arrays always pass the heroic gate", () => {
    const dice = new Dice(11);
    for (let i = 0; i < 200; i++) {
      const stats = rollStats(dice);
      const scores = Object.values(stats);
      expect(scores.filter((s) => s >= 15).length).toBeGreaterThanOrEqual(2);
      expect(scores.filter((s) => s < 6).length).toBeLessThanOrEqual(1);
      for (const s of scores) {
        expect(s).toBeGreaterThanOrEqual(3);
        expect(s).toBeLessThanOrEqual(18);
      }
    }
  });

  it("derives level-1 HP from the hit die + CON and never below 1", () => {
    for (let seed = 0; seed < 50; seed++) {
      const engine = makeEngine(seed);
      const w = createCharacter(engine, "w", "Wizard", "wizard"); // d4 hit die
      expect(w.maxHp).toBeGreaterThanOrEqual(1);
      expect(w.maxHp).toBeLessThanOrEqual(4 + statModifier(w.stats.CON));
    }
  });

  it("maxes level-1 HP based on class hit die + CON modifier", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter"); // d8 hit die
    const expected = Math.max(1, 8 + statModifier(f.stats.CON));
    expect(f.maxHp).toBe(expected);
  });

  it("starts every character with a luck token", () => {
    const engine = makeEngine();
    expect(createCharacter(engine, "f", "Fighter", "fighter").luckToken).toBe(true);
  });
});

describe("armor and AC", () => {
  it("computes AC from armor base + capped DEX + shield", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter"); // chainmail + shield
    // Clear starting talents to test AC in isolation
    f.effects = f.effects.filter((e) => !e.id.startsWith("talent-start"));
    f.inventory.add(item("shield"), 1, true);
    f.equipShield(item("shield"));
    const dex = statModifier(f.stats.DEX);
    expect(f.ac).toBe(13 + dex + 2);
    f.shieldStowed = true;
    expect(f.ac).toBe(13 + dex);
    f.equipArmor(item("plate-mail")); // dexCap 0
    expect(f.ac).toBe(15);
  });

  it("unarmored AC is 10 + DEX", () => {
    const engine = makeEngine();
    const w = createCharacter(engine, "w", "Wizard", "wizard");
    expect(w.ac).toBe(10 + statModifier(w.stats.DEX));
  });

  it("forbidden armor throws", () => {
    const engine = makeEngine();
    const w = createCharacter(engine, "w", "Wizard", "wizard");
    expect(() => w.equipArmor(item("leather-armor"))).toThrow(/cannot wear/);
    const t = createCharacter(engine, "t", "Thief", "thief");
    expect(() => t.equipArmor(item("plate-mail"))).toThrow(/cannot wear/);
  });
});

describe("equipped appearance state", () => {
  it("equips class starting weapons as authoritative character state", () => {
    const engine = makeEngine();
    expect(createCharacter(engine, "f", "Fighter", "fighter").weapon.id).toBe("spear");
    expect(createCharacter(engine, "t", "Thief", "thief").weapon.id).toBe("dagger");
    expect(createCharacter(engine, "p", "Priest", "priest").weapon.id).toBe("mace");
    expect(createCharacter(engine, "w", "Wizard", "wizard").weapon.id).toBe("staff");
  });

  it("changes the visual signature when equipment changes", () => {
    const f = createCharacter(makeEngine(), "f", "Fighter", "fighter");
    expect(characterAppearanceKey(appearanceForCharacter(f))).toBe("char-fighter-chain-spear-none");
    f.equipWeapon(item("longsword"));
    f.equipArmor(item("plate-mail"));
    f.equipShield(item("shield"));
    expect(characterAppearanceKey(appearanceForCharacter(f))).toBe("char-fighter-plate-longsword-readied");
    f.shieldStowed = true;
    expect(characterAppearanceKey(appearanceForCharacter(f))).toBe("char-fighter-plate-longsword-stowed");
  });

  it("supports thief-wearable mithral without allowing mundane chain or plate", () => {
    const t = createCharacter(makeEngine(), "t", "Thief", "thief");
    t.equipArmor(item("mithral-chainmail"));
    expect(appearanceForCharacter(t).armor).toBe("mithral");
    expect(() => t.equipArmor(item("chainmail"))).toThrow(/cannot wear/);
    expect(() => t.equipArmor(item("plate-mail"))).toThrow(/cannot wear/);
  });

  it("rejects non-weapons and exposes weapon rules through the equipped item", () => {
    const f = createCharacter(makeEngine(), "f", "Fighter", "fighter");
    expect(() => f.equipWeapon(item("ration"))).toThrow(/not a melee weapon/);
    f.equipWeapon(item("longsword"));
    expect(f.weapon.damage).toBe("1d8");
    expect(f.weapon.reachTiles).toBe(1.8);
  });
});

describe("attack fidelity", () => {
  it("finesse weapons attack with DEX when it beats STR", () => {
    const engine = makeEngine();
    const t = new Character({
      id: "t",
      name: "Sneak",
      className: "thief",
      stats: { STR: 8, DEX: 16, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      maxHp: 6,
    });
    const r = engine.attack({ attacker: t, targetAc: 10, damage: "1d4", weapon: item("dagger") });
    expect(r.check.modifier).toBe(3); // DEX +3, not STR -1
  });

  it("backstab extra dice raise the damage ceiling", () => {
    const engine = makeEngine(3);
    const t = new Character({
      id: "t",
      name: "Sneak",
      className: "thief",
      stats: { STR: 10, DEX: 16, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      maxHp: 6,
    });
    let sawAboveSingleDie = false;
    for (let i = 0; i < 200; i++) {
      const r = engine.attack({
        attacker: t,
        targetAc: 1,
        damage: "1d4",
        weapon: item("dagger"),
        extraDamageDice: 2,
      });
      if (r.check.success && !r.check.crit && r.damage > 4) sawAboveSingleDie = true;
    }
    expect(sawAboveSingleDie).toBe(true);
  });

  it("a lowered crit range no longer auto-hits", () => {
    const actor = new Character({
      id: "c",
      name: "Critter",
      className: "fighter",
      stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      maxHp: 10,
    });
    actor.addEffect({ id: "t", name: "crit 19", hooks: [{ kind: "critRange", value: 19 }] });
    const dice = new Dice(2);
    for (let i = 0; i < 500; i++) {
      const r = resolveCheck(dice, { actor, stat: "STR", dc: 999, kind: "attack" });
      if (r.natural === 19) {
        expect(r.success).toBe(false); // hits DC 999 only on a natural 20
        expect(r.crit).toBe(false);
      }
      if (r.natural === 20) expect(r.success).toBe(true);
    }
  });

  it("fighter weapon mastery scales damage with half level", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    const base = f.damageBonus; // +1 mastery at level 1
    f.level = 4;
    expect(f.damageBonus).toBe(base + 2);
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
    f.takeDamage(2);
    const result = engine.levelUp(f, "1d8", "fighter-talents");
    expect(result.newLevel).toBe(2);
    expect(f.maxHp).toBeGreaterThan(before);
    expect(f.hp).toBe(f.maxHp); // leveling heals to full
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
    f.inventory.remove("ration", f.inventory.count("ration"));
    expect(() => engine.rest(f, item("ration"))).toThrow(/no Ration/);
  });

  it("freeRest restores HP and spells without a ration", () => {
    const engine = makeEngine();
    const w = createCharacter(engine, "w", "Wizard", "wizard");
    w.inventory.remove("ration", w.inventory.count("ration"));
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

describe("fighter class feature rules", () => {
  it("rolls 2 starting talents for Humans", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter", "human");
    // Starting features/talents effects: Weapon Mastery (1), Grit (1), plus 2 starting talent rolls = 4 total effects.
    expect(f.effects.length).toBe(4);
  });

  it("applies Grit advantage to Strength or Dexterity checks but not attacks", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    // Ensure Grit is configured on f.
    const grit = f.effects.find((e) => e.id === "feat-fighter-grit");
    expect(grit).toBeDefined();
    const hook = grit?.hooks[0];
    expect(hook?.kind).toBe("advantageOnStat");
    const stat = (hook as any).stat;

    // Resolve an ability check of the Grit stat
    const r1 = resolveCheck(new Dice(1), {
      actor: f,
      stat,
      dc: DC.NORMAL,
      kind: "stat",
    });
    expect(r1.advantageReasons).toContain("grit");
    expect(r1.mode).toBe("advantage");

    // Attack roll should NOT get Grit advantage
    const r2 = resolveCheck(new Dice(1), {
      actor: f,
      stat,
      dc: DC.NORMAL,
      kind: "attack",
    });
    expect(r2.advantageReasons).not.toContain("grit");
    expect(r2.mode).toBe("normal");
  });

  it("applies Weapon Mastery half level bonus to attacks", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    // Clear starting talents/features to test Weapon Mastery in isolation
    f.effects = f.effects.filter((e) => e.id === "feat-fighter-weapon-mastery");
    f.level = 4; // half level = 2
    // Resolve an attack check
    const r = resolveCheck(new Dice(1), {
      actor: f,
      stat: "STR",
      dc: DC.NORMAL,
      kind: "attack",
    });
    // Base modifier + Weapon Mastery checkBonus (1) + checkBonusHalfLevel (2)
    const expectedMod = statModifier(f.stats.STR) + 1 + 2;
    expect(r.modifier).toBe(expectedMod);
  });

  it("auto-resolves statBonusChoice and armorAcBonusChoice", () => {
    const engine = makeEngine();
    const f = createCharacter(engine, "f", "Fighter", "fighter");
    
    // Test statBonusChoice resolution
    f.addEffect({
      id: "test-stat-choice",
      name: "Test Choice",
      hooks: [{ kind: "statBonusChoice", stats: ["STR", "DEX"], bonus: 2 }],
    });
    const resolved = f.effects.find((e) => e.id === "test-stat-choice");
    expect(resolved).toBeDefined();
    expect(resolved!.hooks[0]!.kind).toBe("statBonus");
    // It should have picked the highest of STR and DEX
    const expectedStat = f.stats.STR >= f.stats.DEX ? "STR" : "DEX";
    expect((resolved!.hooks[0]! as any).stat).toBe(expectedStat);

    // Test armorAcBonusChoice resolution
    f.addEffect({
      id: "test-armor-choice",
      name: "Test Armor Choice",
      hooks: [{ kind: "armorAcBonusChoice", bonus: 1 }],
    });
    const resolvedArmor = f.effects.find((e) => e.id === "test-armor-choice");
    expect(resolvedArmor).toBeDefined();
    expect(resolvedArmor!.hooks[0]!.kind).toBe("armorAcBonus");
    expect((resolvedArmor!.hooks[0]! as any).armorId).toBe("chainmail");
  });

  it("swaps stats for Fighter if neither STR nor DEX is heroic (>= 15)", () => {
    const engine = makeEngine();
    let foundSeed = -1;
    let originalStats: any = null;
    for (let seed = 0; seed < 1000; seed++) {
      const d = new Dice(seed);
      const rolled = rollStats(d);
      if (rolled.STR < 15 && rolled.DEX < 15) {
        foundSeed = seed;
        originalStats = rolled;
        break;
      }
    }
    expect(foundSeed).toBeGreaterThanOrEqual(0);

    const candidates: ("CON" | "INT" | "WIS" | "CHA")[] = ["CON", "INT", "WIS", "CHA"];
    let bestStat: "CON" | "INT" | "WIS" | "CHA" | null = null;
    let maxVal = -1;
    for (const s of candidates) {
      if (originalStats[s] >= 15 && originalStats[s] > maxVal) {
        maxVal = originalStats[s];
        bestStat = s;
      }
    }
    expect(bestStat).not.toBeNull();

    const seededEngine = new Engine({ seed: foundSeed });
    registerTables(seededEngine);
    const f = createCharacter(seededEngine, "f", "Fighter", "fighter");

    expect(f.stats.STR).toBe(originalStats[bestStat!]);
    expect(f.stats[bestStat!]).toBe(originalStats.STR);
  });
});
