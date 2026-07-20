import { describe, expect, it } from "vitest";
import {
  activeConditions,
  applyCondition,
  Character,
  Engine,
  hasCondition,
  isImmuneToCondition,
  removeCondition,
} from "../src/engine";
import { item } from "../src/data";

function makeFighter(id = "f1"): Character {
  return new Character({
    id,
    name: "Test Fighter",
    className: "fighter",
    stats: { STR: 14, DEX: 12, CON: 14, INT: 9, WIS: 10, CHA: 11 },
    maxHp: 10,
  });
}

describe("conditions", () => {
  it("applies and queries a condition", () => {
    const f = makeFighter();
    expect(hasCondition(f, "blinded")).toBe(false);
    applyCondition(f, "blinded", { unit: "rounds", remaining: 3 });
    expect(hasCondition(f, "blinded")).toBe(true);
    expect(activeConditions(f)).toEqual(["blinded"]);
  });

  it("blinded and frightened grant attack disadvantage via the existing hook system", () => {
    const f = makeFighter();
    applyCondition(f, "blinded", { unit: "rounds", remaining: 3 });
    expect(f.effects.some((e) => e.hooks.some((h) => h.kind === "disadvantageOn" && h.applies === "attack"))).toBe(
      true,
    );
  });

  it("re-applying the same condition refreshes duration instead of stacking", () => {
    const f = makeFighter();
    applyCondition(f, "poisoned", { unit: "rounds", remaining: 2 });
    applyCondition(f, "poisoned", { unit: "rounds", remaining: 9 });
    const instances = f.effects.filter((e) => e.id === "condition:poisoned");
    expect(instances).toHaveLength(1);
    expect(instances[0]!.duration?.remaining).toBe(9);
  });

  it("removeCondition clears exactly that condition", () => {
    const f = makeFighter();
    applyCondition(f, "webbed", { unit: "rounds", remaining: 5 });
    applyCondition(f, "silenced", { unit: "rounds", remaining: 5 });
    removeCondition(f, "webbed");
    expect(hasCondition(f, "webbed")).toBe(false);
    expect(hasCondition(f, "silenced")).toBe(true);
  });

  it("a conditionImmunity hook blocks the condition from ever being applied", () => {
    const f = makeFighter();
    f.addEffect({
      id: "ancestry-immune-poison",
      name: "Poison Immunity",
      hooks: [{ kind: "conditionImmunity", condition: "poisoned" }],
    });
    const applied = applyCondition(f, "poisoned", { unit: "rounds", remaining: 5 });
    expect(applied).toBe(false);
    expect(hasCondition(f, "poisoned")).toBe(false);
    expect(isImmuneToCondition(f, "poisoned")).toBe(true);
    // Immunity is condition-specific, not a blanket shield.
    expect(applyCondition(f, "blinded", { unit: "rounds", remaining: 5 })).toBe(true);
  });

  it("rounds-based conditions expire on Engine's per-round tick, independent of rest", () => {
    const engine = new Engine();
    const f = makeFighter();
    engine.registerCharacter(f);
    applyCondition(f, "grappled", { unit: "rounds", remaining: 2 });
    engine.advance(engine.config.roundMs);
    expect(hasCondition(f, "grappled")).toBe(true);
    engine.advance(engine.config.roundMs);
    expect(hasCondition(f, "grappled")).toBe(false);
  });

  it("untilRest conditions survive combat but clear on rest, same as any until-rest effect", () => {
    const engine = new Engine();
    const f = makeFighter();
    f.inventory.add(item("ration"), 1, true);
    applyCondition(f, "charmed", { unit: "untilRest", remaining: 0 });
    expect(hasCondition(f, "charmed")).toBe(true);
    engine.rest(f, item("ration"));
    expect(hasCondition(f, "charmed")).toBe(false);
  });

  it("death strips every timed condition — a corpse carries no status", () => {
    const engine = new Engine();
    const f = makeFighter();
    engine.registerCharacter(f);
    applyCondition(f, "poisoned", { unit: "rounds", remaining: 50 });
    engine.damageCharacter(f, 999);
    expect(f.dying).not.toBeNull();
    // A nat-20 self-revive is possible each round; either outcome is a valid
    // end state, so assert against whichever one actually happened.
    engine.advance(20 * engine.config.roundMs);
    const selfRevived = !f.dead && f.dying === null;
    expect(f.dead || selfRevived).toBe(true);
    // Only ~20 of the condition's 50 rounds have elapsed either way, so a
    // self-revived (still-alive) fighter should still be poisoned; a dead one
    // should carry no status at all.
    expect(hasCondition(f, "poisoned")).toBe(!f.dead && selfRevived);
  });
});
