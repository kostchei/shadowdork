import { describe, expect, it } from "vitest";
import { allItems, item } from "../src/data/items";
import {
  TREASURE_0_3,
  TREASURE_4_6,
  TREASURE_7_9,
  TREASURE_10_PLUS,
} from "../src/data/tables/treasure";

const CORE_TABLES = [TREASURE_0_3, TREASURE_4_6, TREASURE_7_9, TREASURE_10_PLUS] as const;

function rolledItem(table: (typeof CORE_TABLES)[number], min: number) {
  const entry = table.entries.find((candidate) => candidate.min === min)!;
  return item((entry.data as { itemId: string }).itemId);
}

describe("core Shadowdark treasure tables", () => {
  it("covers every d100 result exactly once in every level band", () => {
    for (const table of CORE_TABLES) {
      for (let roll = 1; roll <= 100; roll++) {
        expect(
          table.entries.filter((entry) => roll >= entry.min && roll <= entry.max),
          `${table.id} roll ${roll}`,
        ).toHaveLength(1);
      }
    }
  });

  it("keeps the source rows that distinguish each band", () => {
    expect(TREASURE_0_3.entries[0]).toMatchObject({ min: 1, max: 1, text: "Bent tin fork (1 cp)" });
    expect(TREASURE_0_3.entries.at(-1)).toMatchObject({ min: 100, max: 100, text: "+1 magic weapon (benefit) (200 gp)" });
    expect(TREASURE_4_6.entries.find((entry) => entry.min === 46)).toMatchObject({
      max: 47,
      text: "Rare incense that is repulsive to undead (50 gp)",
    });
    expect(TREASURE_7_9.entries.find((entry) => entry.min === 50)).toMatchObject({
      max: 53,
      text: "Life-sized, jointed python of polished gold (80 gp)",
    });
    expect(TREASURE_10_PLUS.entries.find((entry) => entry.min === 1)).toMatchObject({
      max: 1,
      text: "Three tarnished silver plates (5 sp each)",
    });
  });

  it("gives every result a stable, unique inventory identity with its exact value", () => {
    const ids = new Set<string>();
    for (const table of CORE_TABLES) {
      for (const entry of table.entries) {
        const data = entry.data as { itemId: string; valueGp: number; qty?: number };
        expect(ids.has(data.itemId), data.itemId).toBe(false);
        ids.add(data.itemId);
        const def = item(data.itemId);
        expect(def).toMatchObject({
          id: data.itemId,
          description: entry.text,
        });
        expect((def.valueGp ?? 0) * (data.qty ?? 1)).toBe(data.valueGp);
      }
    }
  });

  it("preserves quantities without inflating the total result value", () => {
    const pair = TREASURE_10_PLUS.entries.find((entry) => entry.min === 66)!;
    const data = pair.data as { itemId: string; valueGp: number; qty?: number };
    expect(data.qty).toBe(2);
    expect(item(data.itemId)).toMatchObject({
      name: "Potion of Healing",
      valueGp: 150,
      rulesId: "potion-healing",
      use: { actions: ["consume", "inspect"] },
    });
    expect(item(data.itemId).valueGp! * data.qty!).toBe(300);
  });

  it("preserves fractional gp values instead of promoting copper and silver to gold", () => {
    const fork = TREASURE_0_3.entries[0]!.data as { itemId: string; valueGp: number };
    const boots = TREASURE_7_9.entries.find((entry) => entry.min === 2)!.data as {
      itemId: string;
      valueGp: number;
    };
    expect(item(fork.itemId).valueGp).toBe(0.01);
    expect(item(boots.itemId).valueGp).toBe(0.5);
  });

  it("stores treasure quality and generated magic qualities explicitly", () => {
    expect(rolledItem(TREASURE_0_3, 1).treasureQuality).toBe("poor");
    expect(rolledItem(TREASURE_0_3, 88).treasureQuality).toBe("normal");
    expect(rolledItem(TREASURE_0_3, 96)).toMatchObject({
      treasureQuality: "fabulous",
      magicBonus: 1,
      benefitRolls: 1,
      curseRolls: 1,
    });
    expect(rolledItem(TREASURE_0_3, 98)).toMatchObject({
      personality: { virtueRolls: 1, flawRolls: 1 },
    });
    expect(rolledItem(TREASURE_7_9, 100)).toMatchObject({
      magicBonus: 3,
      benefitRolls: 1,
      personality: { virtueRolls: 1 },
    });
    expect(rolledItem(TREASURE_10_PLUS, 94)).toMatchObject({ magicBonus: 3, benefitRolls: 2 });
  });

  it("preserves concrete qualities and personalities on named items", () => {
    const carpet = rolledItem(TREASURE_10_PLUS, 90);
    expect(carpet).toMatchObject({
      treasureQuality: "fabulous",
      personality: { alignment: "neutral" },
    });
    expect(carpet.benefits?.some((benefit) => benefit.includes("two riders"))).toBe(true);
    expect(carpet.personality?.trait).toContain("Playful");

    const staff = rolledItem(TREASURE_10_PLUS, 100);
    expect(staff).toMatchObject({
      treasureQuality: "legendary",
      magicBonus: 3,
    });
    expect(staff.benefits?.some((benefit) => benefit.includes("dimension door"))).toBe(true);
    expect(staff.curses?.some((curse) => curse.includes("wizard"))).toBe(true);
  });

  it("classifies every registered magic item", () => {
    for (const def of allItems().filter((candidate) => candidate.tags.includes("magic"))) {
      expect(def.treasureQuality, def.id).toBeDefined();
      expect(
        (def.benefits?.length ?? 0)
          + (def.curses?.length ?? 0)
          + (def.benefitRolls ?? 0)
          + (def.curseRolls ?? 0)
          + (def.magicBonus ?? 0),
        def.id,
      ).toBeGreaterThan(0);
    }
  });
});
