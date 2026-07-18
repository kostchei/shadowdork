import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveRepository, SAVE_SCHEMA_VERSION } from "../src/game/SaveRepository";
import type { SaveSlot } from "../src/game/state";

// Mock localStorage in global scope
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as any).localStorage = localStorageMock;

describe("SaveRepository", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const validSaveSlot: SaveSlot = {
    slotId: 1,
    timestamp: 123456789,
    dungeonIndex: 2,
    currentRoom: 3,
    hasCrown: false,
    kills: 10,
    coinsBanked: 500,
    party: [
      {
        id: "char1",
        name: "Valerie",
        className: "fighter",
        stats: { STR: 12, DEX: 10, CON: 11, INT: 10, WIS: 9, CHA: 10 },
        level: 2,
        xp: 150,
        hp: 12,
        maxHp: 15,
        knownSpells: [],
        effects: [],
        inventory: [],
        wornArmorId: null,
        wieldedWeaponId: null,
        carriedShieldId: null,
        shieldStowed: false,
        luckToken: true,
        dying: null,
        dead: false,
      },
    ],
    rescuedIds: ["fighter"],
    messages: [{ text: "Expedition started", color: "#ffffff" }],
  };

  it("checks availability", () => {
    expect(SaveRepository.isAvailable()).toBe(true);
  });

  it("saves and loads a valid save slot successfully", () => {
    SaveRepository.save(1, validSaveSlot);
    expect(SaveRepository.exists(1)).toBe(true);

    const loaded = SaveRepository.load(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.slotId).toBe(1);
    expect(loaded!.coinsBanked).toBe(500);
    expect((loaded as any).schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it("validates structural integrity of save slots correctly", () => {
    expect(SaveRepository.validateSaveSlot(validSaveSlot)).toBe(true);
    expect(SaveRepository.validateSaveSlot(null)).toBe(false);
    expect(SaveRepository.validateSaveSlot({})).toBe(false);

    const invalidSlot = { ...validSaveSlot, slotId: "not-a-number" };
    expect(SaveRepository.validateSaveSlot(invalidSlot)).toBe(false);

    const corruptParty = { ...validSaveSlot, party: [{ name: "missing-fields" }] };
    expect(SaveRepository.validateSaveSlot(corruptParty)).toBe(false);
  });

  it("deletes saves correctly", () => {
    SaveRepository.save(1, validSaveSlot);
    expect(SaveRepository.exists(1)).toBe(true);

    SaveRepository.delete(1);
    expect(SaveRepository.exists(1)).toBe(false);
    expect(SaveRepository.load(1)).toBeNull();
  });

  it("exports all saves to a single payload", () => {
    SaveRepository.save(1, validSaveSlot);
    const autosave = { ...validSaveSlot, slotId: 0 };
    SaveRepository.save(0, autosave);

    const exportedString = SaveRepository.exportAll();
    const parsed = JSON.parse(exportedString);

    expect(parsed.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(parsed.slot1).not.toBeNull();
    expect(parsed.slot1.slotId).toBe(1);
    expect(parsed.autosave).not.toBeNull();
    expect(parsed.autosave.slotId).toBe(0);
    expect(parsed.slot2).toBeNull();
  });

  it("imports all valid saves from a backup payload", () => {
    const backupData = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      timestamp: Date.now(),
      autosave: null,
      slot1: { ...validSaveSlot, slotId: 1, coinsBanked: 999 },
      slot2: null,
      slot3: null,
    };

    const res = SaveRepository.importAll(JSON.stringify(backupData));
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);

    const loaded = SaveRepository.load(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.coinsBanked).toBe(999);
  });

  it("rejects backup payloads with mismatching schema version", () => {
    const oldBackup = {
      schemaVersion: 99, // mismatch
      timestamp: Date.now(),
      slot1: validSaveSlot,
    };

    const res = SaveRepository.importAll(JSON.stringify(oldBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unsupported backup schema version");
    expect(SaveRepository.exists(1)).toBe(false);
  });

  it("rejects backup payloads with corrupt slot data", () => {
    const corruptBackup = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      timestamp: Date.now(),
      slot1: { ...validSaveSlot, slotId: "corrupt" },
    };

    const res = SaveRepository.importAll(JSON.stringify(corruptBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain("Slot 1 is corrupt");
  });
});
