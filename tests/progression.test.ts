import { describe, expect, it } from "vitest";
import type { SavedCharacter } from "../src/game/state";
import {
  chooseDungeonReward,
  nextDungeonSave,
  type PartyProgress,
} from "../src/game/progression";

const fighter: PartyProgress = { className: "fighter", knownSpellIds: [] };
const thief: PartyProgress = { className: "thief", knownSpellIds: [] };
const priest: PartyProgress = {
  className: "priest",
  knownSpellIds: ["cure-wounds", "light", "turn-undead"],
};
const wizard: PartyProgress = {
  className: "wizard",
  knownSpellIds: ["magic-missile", "burning-hands", "mage-armor"],
};

function saved(id: string, className: string, dead = false): SavedCharacter {
  return {
    id,
    name: id,
    className,
    stats: { STR: 15, DEX: 12, CON: 12, INT: 12, WIS: 12, CHA: 10 },
    level: 1,
    xp: 0,
    hp: dead ? 0 : 8,
    maxHp: 8,
    knownSpells: [],
    effects: [],
    inventory: [],
    wornArmorId: null,
    wieldedWeaponId: null,
    carriedShieldId: null,
    shieldStowed: false,
    luckToken: true,
    dying: null,
    dead,
  };
}

describe("campaign rewards", () => {
  it("gives a solo first run one companion, not the whole party", () => {
    const reward = chooseDungeonReward(0, [fighter]);
    expect(reward).toMatchObject({ kind: "companion", className: "thief", name: "Vex" });
  });

  it("cycles through all five reward categories", () => {
    const fullParty = [fighter, thief, priest, wizard];
    expect(chooseDungeonReward(1, fullParty).kind).toBe("magic-weapon");
    expect(chooseDungeonReward(2, fullParty).kind).toBe("magic-armor");
    expect(chooseDungeonReward(3, fullParty).kind).toBe("gold");
    expect(chooseDungeonReward(4, fullParty).kind).toBe("spells");
  });

  it("turns an unusable spell reward into the next missing caster", () => {
    expect(chooseDungeonReward(4, [fighter, thief])).toMatchObject({
      kind: "companion",
      className: "priest",
    });
  });

  it("does not offer duplicate companions and falls back to gold", () => {
    const fullParty = [fighter, thief, priest, wizard];
    expect(chooseDungeonReward(5, fullParty)).toMatchObject({ kind: "gold", amount: 500 });
  });
});

describe("between-dungeon persistence", () => {
  it("carries living party members and campaign wealth into the next dungeon", () => {
    const brakka = saved("Brakka", "fighter");
    const vex = saved("Vex", "thief");
    const fallen = saved("Odessa", "priest", true);
    const next = nextDungeonSave(
      { coinsBanked: 740, messages: [{ text: "Vault opened", color: "#fff" }] },
      7,
      [brakka, vex, fallen],
      1234,
    );

    expect(next).toMatchObject({
      slotId: 0,
      timestamp: 1234,
      dungeonIndex: 8,
      currentRoom: 1,
      hasCrown: false,
      kills: 0,
      coinsBanked: 740,
      rescuedIds: ["fighter", "thief"],
    });
    expect(next.party.map((member) => member.name)).toEqual(["Brakka", "Vex"]);
  });
});
