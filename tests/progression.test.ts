import { describe, expect, it } from "vitest";
import type { SavedCharacter } from "../src/game/state";
import {
  chooseDungeonReward,
  maximumSpellTier,
  nextDungeonSave,
  type PartyProgress,
} from "../src/game/progression";
import { isPlebName, item, spell } from "../src/data";
import { skinsForZone } from "../src/game/visual/skins";

const fighter: PartyProgress = { className: "fighter", level: 1, knownSpellIds: [] };
const thief: PartyProgress = { className: "thief", level: 1, knownSpellIds: [] };
const priest: PartyProgress = {
  className: "priest",
  level: 1,
  knownSpellIds: ["cure-wounds", "light", "turn-undead"],
};
const wizard: PartyProgress = {
  className: "wizard",
  level: 1,
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
    expect(reward.kind).toBe("companion");
    if (reward.kind !== "companion") throw new Error("Expected a companion reward");
    expect(["thief", "priest", "wizard"]).toContain(reward.className);
    expect(isPlebName(reward.name)).toBe(true);
    expect(reward.title).toContain(reward.name);
  });

  it("cycles through all five reward categories", () => {
    const fullParty = [fighter, thief, priest, wizard];
    expect(chooseDungeonReward(1, fullParty).kind).toBe("magic-weapon");
    expect(chooseDungeonReward(2, fullParty).kind).toBe("magic-armor");
    expect(chooseDungeonReward(3, fullParty).kind).toBe("gold");
    expect(chooseDungeonReward(4, fullParty).kind).toBe("spells");
  });

  it("rolls the vault treasure tables instead of always the same item", () => {
    const fullParty = [fighter, thief, priest, wizard];
    const weaponSlotItemIds = new Set<string>();
    const armorSlotItemIds = new Set<string>();
    // Every 5th dungeonIndex lands back on "magic-weapon"/"magic-armor" (the
    // cycle is length 5); sample several cycles so a real spread of items
    // shows up instead of the old single hardcoded Starfall Blade/Aegis Mail.
    for (let cycle = 0; cycle < 12; cycle++) {
      const weaponReward = chooseDungeonReward(1 + cycle * 5, fullParty);
      const armorReward = chooseDungeonReward(2 + cycle * 5, fullParty);
      if (weaponReward.kind === "magic-weapon") weaponSlotItemIds.add(weaponReward.itemId);
      if (armorReward.kind === "magic-armor") armorSlotItemIds.add(armorReward.itemId);
    }
    expect(weaponSlotItemIds.size).toBeGreaterThan(1);
    expect(armorSlotItemIds.size).toBeGreaterThan(1);
    expect(weaponSlotItemIds).not.toEqual(new Set(["starfall-blade"]));
    expect(armorSlotItemIds).not.toEqual(new Set(["aegis-mail"]));
  });

  it("bands vault treasure by the party's furthest-advanced level", () => {
    const lowParty = [fighter, thief, priest, wizard];
    const highParty = [
      { ...fighter, level: 10 },
      { ...thief, level: 10 },
      { ...priest, level: 10 },
      { ...wizard, level: 10 },
    ];
    // Sample many cycles at each tier; a levelled-up party should see at least
    // one reward a fresh level-1 party never rolls (and vice versa isn't
    // required, since low-tier loot can still appear high-tier tables' text
    // never does at level 1) — the meaningful signal is the two samples differ.
    const lowItems = new Set<string>();
    const highItems = new Set<string>();
    for (let cycle = 0; cycle < 20; cycle++) {
      const lowReward = chooseDungeonReward(1 + cycle * 5, lowParty);
      const highReward = chooseDungeonReward(1 + cycle * 5, highParty);
      if (lowReward.kind === "magic-weapon") lowItems.add(lowReward.itemId);
      if (highReward.kind === "magic-weapon") highItems.add(highReward.itemId);
    }
    expect(lowItems).not.toEqual(highItems);
  });

  it("gives a Cursed Scroll destination a chance at its own flavor treasure", () => {
    const fullParty = [fighter, thief, priest, wizard];
    const itemIds = new Set<string>();
    for (let cycle = 0; cycle < 30; cycle++) {
      const reward = chooseDungeonReward(1 + cycle * 5, fullParty, "diablerie");
      if (reward.kind === "magic-weapon") itemIds.add(reward.itemId);
    }
    // carved-flame-bone only exists in DIABOLICAL_TREASURE (CS1's flavor table).
    expect(itemIds.has("carved-flame-bone")).toBe(true);
  });

  it("keeps a rolled vault-treasure reward stable when the same save is reloaded", () => {
    const fullParty = [fighter, thief, priest, wizard];
    expect(chooseDungeonReward(1, fullParty, "red-sands")).toEqual(
      chooseDungeonReward(1, fullParty, "red-sands"),
    );
  });

  it("only ever grants vault treasure itemIds that resolve to a real item", () => {
    const fullParty = [fighter, thief, priest, wizard];
    for (let cycle = 0; cycle < 40; cycle++) {
      for (const zone of [undefined, "diablerie", "red-sands", "midnight-sun", "city-of-masks"] as const) {
        const weaponReward = chooseDungeonReward(1 + cycle * 5, fullParty, zone);
        const armorReward = chooseDungeonReward(2 + cycle * 5, fullParty, zone);
        for (const reward of [weaponReward, armorReward]) {
          if (reward.kind === "magic-weapon" || reward.kind === "magic-armor") {
            expect(() => item(reward.itemId)).not.toThrow();
          }
        }
      }
    }
  });

  it("always makes a caster's first discovered spell tier 1, even at high level", () => {
    const veteranWizard = { ...wizard, level: 9 };
    const reward = chooseDungeonReward(4, [fighter, thief, priest, veteranWizard]);
    expect(reward.kind).toBe("spells");
    if (reward.kind !== "spells") throw new Error("Expected a spell reward");
    expect(spell(reward.spellId).tier).toBe(1);
  });

  it("limits later random discoveries to tiers unlocked by caster level", () => {
    expect([1, 1, 2, 2, 3, 3, 4, 4, 5, 5].map((_, index) => maximumSpellTier(index + 1)))
      .toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);

    const developingPriest: PartyProgress = {
      ...priest,
      level: 3,
      knownSpellIds: [...priest.knownSpellIds, "holy-weapon"],
    };
    const reward = chooseDungeonReward(9, [fighter, thief, developingPriest]);
    expect(reward.kind).toBe("spells");
    if (reward.kind !== "spells") throw new Error("Expected a spell reward");
    expect(reward.className).toBe("priest");
    expect(spell(reward.spellId).tier).toBeLessThanOrEqual(2);
  });

  it("keeps the random reward stable when the same save is reloaded", () => {
    const party = [fighter, thief, { ...priest, level: 3 }, { ...wizard, level: 3 }];
    expect(chooseDungeonReward(9, party)).toEqual(chooseDungeonReward(9, party));
  });

  it("turns an unusable spell reward into the next missing caster", () => {
    const reward = chooseDungeonReward(4, [fighter, thief]);
    expect(reward.kind).toBe("companion");
    if (reward.kind !== "companion") throw new Error("Expected a companion reward");
    expect(["priest", "wizard"]).toContain(reward.className);
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
      { coinsBanked: 740, messages: [{ text: "Vault opened", color: "#fff" }], runSeed: 99 },
      7,
      [brakka, vex, fallen],
      "red-sands",
      1234,
    );

    expect(next).toMatchObject({
      slotId: 0,
      timestamp: 1234,
      dungeonIndex: 8,
      zone: "red-sands",
      currentRoom: 1,
      hasCrown: false,
      kills: 0,
      coinsBanked: 740,
      rescuedIds: ["fighter", "thief"],
    });
    expect(next.party.map((member) => member.name)).toEqual(["Brakka", "Vex"]);
    // The stored skin belongs to the chosen scroll.
    expect(next.skinId).toBeDefined();
    expect(skinsForZone("red-sands").some((s) => s.id === next.skinId)).toBe(true);
  });
});
