import { describe, expect, it } from "vitest";
import { Character, Engine, hasCapability, usePotion } from "../src/engine";
import { item } from "../src/data";

function fighter(id: string, str = 10): Character {
  return new Character({
    id,
    name: id,
    className: "fighter",
    stats: { STR: str, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    maxHp: 10,
  });
}

const fixedDice = (value: number) => ({ roll: () => value });

describe("core potions", () => {
  it("heals an ally, revives dying, and consumes exactly one potion", () => {
    const user = fighter("user");
    const target = fighter("target");
    user.inventory.add(item("potion-healing"), 2);
    target.hp = 0;
    target.dying = { roundsRemaining: 3 };

    const result = usePotion(user, target, item("potion-healing"), fixedDice(4));

    expect(result.healed).toBe(4);
    expect(target.hp).toBe(4);
    expect(target.dying).toBeNull();
    expect(user.inventory.count("potion-healing")).toBe(1);
  });

  it("does not waste healing on a full-health target", () => {
    const user = fighter("user");
    user.inventory.add(item("potion-healing"));
    expect(() => usePotion(user, user, item("potion-healing"), fixedDice(6))).toThrow("full HP");
    expect(user.inventory.has("potion-healing")).toBe(true);
  });

  it.each([
    ["potion-invisibility", "invisible"],
    ["potion-water-breathing", "waterBreathing"],
    ["potion-flying", "canFly"],
  ] as const)("grants and expires the %s capability", (itemId, capability) => {
    const user = fighter("user");
    const engine = new Engine({ config: { roundMs: 100, crawlingRoundMs: 1000, torchMs: 1000 } });
    engine.registerCharacter(user);
    user.inventory.add(item(itemId));

    usePotion(user, user, item(itemId), fixedDice(1));
    expect(hasCapability(user, capability)).toBe(true);

    const rounds = itemId === "potion-water-breathing" ? 20 : 5;
    engine.advance(rounds * 100);
    expect(hasCapability(user, capability)).toBe(false);
  });

  it("sets Strength to at least 18 without permanently changing the base score", () => {
    const user = fighter("user", 8);
    const engine = new Engine({ config: { roundMs: 100, crawlingRoundMs: 1000, torchMs: 1000 } });
    engine.registerCharacter(user);
    user.inventory.add(item("potion-giant-strength"));

    usePotion(user, user, item("potion-giant-strength"), fixedDice(1));
    expect(user.stats.STR).toBe(8);
    expect(user.mod("STR")).toBe(4);
    engine.advance(500);
    expect(user.stats.STR).toBe(8);
    expect(user.mod("STR")).toBe(-1);
  });

  it("rejects unsupported potion definitions without consuming them", () => {
    const user = fighter("user");
    user.inventory.add(item("potion-polymorph"));
    expect(() => usePotion(user, user, item("potion-polymorph"), fixedDice(1))).toThrow("cannot be used");
    expect(user.inventory.has("potion-polymorph")).toBe(true);
  });
});
