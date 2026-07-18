import type { SaveSlot } from "./state";

export const SAVE_SCHEMA_VERSION = 1;

export interface ExportedSaves {
  schemaVersion: number;
  timestamp: number;
  autosave: SaveSlot | null;
  slot1: SaveSlot | null;
  slot2: SaveSlot | null;
  slot3: SaveSlot | null;
}

export class SaveRepository {
  private static getKey(slotId: number): string {
    return slotId === 0 ? "shadowdork_autosave" : `shadowdork_slot_${slotId}`;
  }

  /**
   * Helper to check if localStorage is accessible
   */
  public static isAvailable(): boolean {
    try {
      const testKey = "__shadowdork_storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Save a slot state to local storage
   */
  public static save(slotId: number, state: SaveSlot): void {
    if (!this.isAvailable()) {
      throw new Error("Storage is unavailable (cookies or local storage might be disabled).");
    }

    // Attach current schema version
    const payload = {
      ...state,
      schemaVersion: SAVE_SCHEMA_VERSION,
    };

    try {
      const key = this.getKey(slotId);
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e: any) {
      if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
        throw new Error("Local storage quota exceeded. Unable to save game.");
      }
      throw new Error(`Failed to save game: ${e.message}`);
    }
  }

  /**
   * Load and validate slot state from local storage.
   * Returns null if slot does not exist.
   * Throws an error if payload is corrupt or invalid.
   */
  public static load(slotId: number): SaveSlot | null {
    if (!this.isAvailable()) {
      return null;
    }

    const key = this.getKey(slotId);
    const rawData = localStorage.getItem(key);
    if (!rawData) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawData);
      
      // Basic legacy check: if no schemaVersion exists, treat it as version 1
      if (parsed && typeof parsed === "object") {
        if (!parsed.schemaVersion) {
          parsed.schemaVersion = 1;
        }
      }

      if (!this.validateSaveSlot(parsed)) {
        throw new Error("Save data structure is corrupt or incomplete.");
      }

      return parsed;
    } catch (e: any) {
      throw new Error(`Corrupt save file in Slot ${slotId}: ${e.message}`);
    }
  }

  /**
   * Delete a save slot
   */
  public static delete(slotId: number): void {
    if (!this.isAvailable()) return;
    const key = this.getKey(slotId);
    localStorage.removeItem(key);
  }

  /**
   * Check if a slot has a saved game
   */
  public static exists(slotId: number): boolean {
    if (!this.isAvailable()) return false;
    const key = this.getKey(slotId);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Exports all saves into a single JSON string
   */
  public static exportAll(): string {
    const backup: ExportedSaves = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      timestamp: Date.now(),
      autosave: this.load(0),
      slot1: this.load(1),
      slot2: this.load(2),
      slot3: this.load(3),
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Imports all saves from a JSON string payload.
   * Performs validation before writing to storage.
   */
  public static importAll(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== "object") {
        return { success: false, count: 0, error: "Invalid backup file structure." };
      }

      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
        return { success: false, count: 0, error: `Unsupported backup schema version: ${parsed.schemaVersion}` };
      }

      const slotsToImport: { slotId: number; data: SaveSlot }[] = [];

      const checkAndQueue = (slotId: number, slotData: any) => {
        if (slotData) {
          if (this.validateSaveSlot(slotData)) {
            slotsToImport.push({ slotId, data: slotData });
          } else {
            throw new Error(`Slot ${slotId === 0 ? "Auto-Save" : slotId} is corrupt.`);
          }
        }
      };

      checkAndQueue(0, parsed.autosave);
      checkAndQueue(1, parsed.slot1);
      checkAndQueue(2, parsed.slot2);
      checkAndQueue(3, parsed.slot3);

      if (slotsToImport.length === 0) {
        return { success: false, count: 0, error: "No valid save slots found in the backup file." };
      }

      // Write to storage only if ALL queued slots are valid
      for (const item of slotsToImport) {
        this.save(item.slotId, item.data);
      }

      return { success: true, count: slotsToImport.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || "Failed to parse import data." };
    }
  }

  /**
   * Validates structural integrity of a SaveSlot object
   */
  public static validateSaveSlot(obj: any): obj is SaveSlot {
    if (!obj || typeof obj !== "object") return false;

    // Check critical fields
    if (typeof obj.slotId !== "number") return false;
    if (typeof obj.timestamp !== "number") return false;
      if (typeof obj.dungeonIndex !== "number") return false;
      if (obj.runSeed !== undefined && typeof obj.runSeed !== "number") return false;
    // New saves identify the current room by stable region id. Keep accepting
    // the legacy numeric field so pre-roomId saves remain loadable.
    if (typeof obj.roomId !== "string" && typeof obj.currentRoom !== "number") return false;
    if (typeof obj.hasCrown !== "boolean") return false;
    if (typeof obj.kills !== "number") return false;
    if (typeof obj.coinsBanked !== "number") return false;
    
    // Check party list
    if (!Array.isArray(obj.party)) return false;
    for (const char of obj.party) {
      if (!char || typeof char !== "object") return false;
      if (typeof char.id !== "string") return false;
      if (typeof char.name !== "string") return false;
      if (typeof char.className !== "string") return false;
      if (
        char.alignment !== undefined &&
        char.alignment !== "law" &&
        char.alignment !== "neutral" &&
        char.alignment !== "chaos"
      ) return false;
      if (char.ancestry !== undefined && typeof char.ancestry !== "string") return false;
      if (typeof char.level !== "number") return false;
      if (typeof char.hp !== "number") return false;
      if (typeof char.maxHp !== "number") return false;
      if (!char.stats || typeof char.stats !== "object") return false;
    }

    return true;
  }
}
