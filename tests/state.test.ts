import { describe, expect, it } from "vitest";
import { Engine, voiceRegisterForIdentity } from "../src/engine";
import { createCharacter, item, registerTables } from "../src/data";
import { serializeCharacter, deserializeCharacter } from "../src/game/state";

function makeEngine(seed = 42): Engine {
  const engine = new Engine({ seed });
  registerTables(engine);
  return engine;
}

describe("Save slots / serialization", () => {
  it("assigns all three voice registers deterministically from identity", () => {
    const registers = new Set(
      Array.from({ length: 30 }, (_, index) => voiceRegisterForIdentity(`id-${index}`, `Pleb ${index}`)),
    );
    expect(registers).toEqual(new Set(["low", "medium", "high"]));
    expect(voiceRegisterForIdentity("same", "Mara")).toBe(voiceRegisterForIdentity("same", "Mara"));
  });

  it("serializes and deserializes character state exactly", () => {
    const engine1 = makeEngine();
    
    // Create character
    const thief = createCharacter(engine1, "t", "Vex", "thief");
    thief.xp = 5;
    thief.hp = 3;
    
    // Add extra items to inventory
    thief.inventory.add(item("torch"), 3);
    thief.inventory.add(item("ration"), 2);
    
    // Equip gear
    thief.equipWeapon(item("dagger"));
    thief.equipArmor(item("leather-armor"));
    
    // Set luck token
    thief.luckToken = false;

    // Serialize
    const serialized = serializeCharacter(thief);
    expect(serialized.name).toBe("Vex");
    expect(serialized.className).toBe("thief");
    expect(serialized.alignment).toBe(thief.alignment);
    expect(serialized.ancestry).toBe(thief.ancestry);
    expect(serialized.voiceRegister).toBe(thief.voiceRegister);
    expect(serialized.hp).toBe(3);
    expect(serialized.wornArmorId).toBe("leather-armor");
    expect(serialized.wieldedWeaponId).toBe("dagger");
    expect(serialized.luckToken).toBe(false);

    // Deserialize into fresh engine
    const engine2 = makeEngine();
    const restored = deserializeCharacter(serialized, engine2);
    
    expect(restored.id).toBe("t");
    expect(restored.name).toBe("Vex");
    expect(restored.className).toBe("thief");
    expect(restored.alignment).toBe(thief.alignment);
    expect(restored.ancestry).toBe(thief.ancestry);
    expect(restored.voiceRegister).toBe(thief.voiceRegister);
    expect(restored.level).toBe(1);
    expect(restored.xp).toBe(5);
    expect(restored.hp).toBe(3);
    expect(restored.maxHp).toBe(thief.maxHp);
    expect(restored.luckToken).toBe(false);
    expect(restored.dead).toBe(false);
    expect(restored.shieldStowed).toBe(false);

    // Check inventory
    expect(restored.inventory.count("torch")).toBe(5);
    expect(restored.inventory.count("ration")).toBe(3);

    // Check equipped gear
    expect(restored.wornArmor?.id).toBe("leather-armor");
    expect(restored.weapon.id).toBe("dagger");
  });

  it("derives a stable voice register for legacy saves without one", () => {
    const engine = makeEngine();
    const character = createCharacter(engine, "legacy", "Mara", "fighter");
    const saved = serializeCharacter(character);
    delete saved.voiceRegister;

    const first = deserializeCharacter(saved, engine);
    const second = deserializeCharacter(saved, makeEngine());
    expect(["low", "medium", "high"]).toContain(first.voiceRegister);
    expect(second.voiceRegister).toBe(first.voiceRegister);
  });

  it("handles deceased character state serialization", () => {
    const engine = makeEngine();
    const priest = createCharacter(engine, "p", "Odessa", "priest");
    priest.hp = 0;
    priest.dead = true;

    const serialized = serializeCharacter(priest);
    expect(serialized.dead).toBe(true);
    expect(serialized.hp).toBe(0);

    const restored = deserializeCharacter(serialized, engine);
    expect(restored.dead).toBe(true);
    expect(restored.hp).toBe(0);
  });
});
