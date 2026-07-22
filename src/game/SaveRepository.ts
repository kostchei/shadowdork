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

/**
 * A migration step transforms a raw (still-`any`) save payload written at
 * version `N` into the shape expected at version `N + 1`. Keyed by the
 * version it migrates *from*. Once a step ships, never edit it — it has to
 * keep working on save files that were actually written against it; add a
 * new step instead when the schema changes again.
 *
 * Nothing has needed one yet (the schema hasn't changed since version 1),
 * but the pipeline exists now so the next change doesn't have to invent it
 * under pressure — see `migrateSave` below for what happens without it.
 */
type SaveMigration = (data: any) => any;

const SAVE_MIGRATIONS: Readonly<Record<number, SaveMigration>> = {
  // 1: (data) => ({ ...data, newField: defaultValue }),
};

/**
 * Walk a raw save forward from `fromVersion` to `SAVE_SCHEMA_VERSION`,
 * applying each registered step in order. Throws if a save claims a version
 * newer than this build knows (the app was rolled back after the save was
 * written) or older than this build can bridge (a migration step was never
 * written or was removed) — both are real, user-visible failures, not
 * something to paper over with a fallback default that would corrupt state.
 */
function migrateSave(data: any, fromVersion: number): any {
  if (fromVersion > SAVE_SCHEMA_VERSION) {
    throw new Error(
      `Save was written by a newer version of the game (schema ${fromVersion}, this build supports ${SAVE_SCHEMA_VERSION}).`,
    );
  }
  let migrated = data;
  let version = fromVersion;
  while (version < SAVE_SCHEMA_VERSION) {
    const step = SAVE_MIGRATIONS[version];
    if (!step) {
      throw new Error(`No migration registered from save schema version ${version} to ${version + 1}.`);
    }
    migrated = step(migrated);
    version++;
  }
  return { ...migrated, schemaVersion: SAVE_SCHEMA_VERSION };
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
    } catch {
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
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Save data structure is corrupt or incomplete.");
      }
      // Saves written before the schemaVersion field existed are version 1.
      const migrated = migrateSave(parsed, parsed.schemaVersion ?? 1);

      if (!this.validateSaveSlot(migrated)) {
        throw new Error("Save data structure is corrupt or incomplete.");
      }

      return migrated;
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

      const slotsToImport: { slotId: number; data: SaveSlot }[] = [];

      // Each slot carries its own schemaVersion (set at export time) and is
      // migrated independently, the same as a normal load — a backup written
      // by an older build should import cleanly, not be hard-rejected just
      // because the schema has since moved on.
      const checkAndQueue = (slotId: number, slotData: any) => {
        if (!slotData) return;
        const label = slotId === 0 ? "Auto-Save" : slotId;
        let migrated: any;
        try {
          migrated = migrateSave(slotData, slotData.schemaVersion ?? 1);
        } catch (e: any) {
          throw new Error(`Slot ${label} is corrupt: ${e.message}`);
        }
        if (!this.validateSaveSlot(migrated)) {
          throw new Error(`Slot ${label} is corrupt.`);
        }
        slotsToImport.push({ slotId, data: migrated });
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
    if (obj.activatedRequirementIds !== undefined && (!Array.isArray(obj.activatedRequirementIds) || !obj.activatedRequirementIds.every((id: unknown) => typeof id === "string"))) return false;
    if (obj.openedConnectorIds !== undefined && (!Array.isArray(obj.openedConnectorIds) || !obj.openedConnectorIds.every((id: unknown) => typeof id === "string"))) return false;
    if (obj.npcInteractionStates !== undefined) {
      if (!obj.npcInteractionStates || typeof obj.npcInteractionStates !== "object" || Array.isArray(obj.npcInteractionStates)) return false;
      if (!Object.values(obj.npcInteractionStates).every((state) =>
        state === "unmet" || state === "heard" || state === "resolved" ||
        state === "hostile-npc" || state === "hostile-allies" || state === "departed"
      )) return false;
    }
    if (obj.discoveredRoomIds !== undefined && (!Array.isArray(obj.discoveredRoomIds) || !obj.discoveredRoomIds.every((id: unknown) => typeof id === "string"))) return false;
    if (obj.survivalRemainingMs !== undefined && (typeof obj.survivalRemainingMs !== "number" || obj.survivalRemainingMs < 0)) return false;
    if (obj.dangerFlags !== undefined && (!Number.isInteger(obj.dangerFlags) || obj.dangerFlags < 0 || obj.dangerFlags > 4)) return false;
    if (obj.dangerChecks !== undefined && (!Number.isInteger(obj.dangerChecks) || obj.dangerChecks < 0)) return false;
    if (obj.dangerFails !== undefined) {
      if (!obj.dangerFails || typeof obj.dangerFails !== "object" || Array.isArray(obj.dangerFails)) return false;
      if (!Object.values(obj.dangerFails).every((fails) =>
        Number.isInteger(fails) && (fails as number) >= 0 && (fails as number) <= 4,
      )) return false;
    }
    if (obj.dangerDistancePx !== undefined && (typeof obj.dangerDistancePx !== "number" || obj.dangerDistancePx < 0)) return false;
    if (obj.dangerKillPending !== undefined && typeof obj.dangerKillPending !== "boolean") return false;
    if (typeof obj.hasCrown !== "boolean") return false;
    if (typeof obj.kills !== "number") return false;
    if (typeof obj.coinsBanked !== "number") return false;
    if (obj.spendableGold !== undefined && (typeof obj.spendableGold !== "number" || obj.spendableGold < 0)) return false;
    if (obj.porterHireAttempted !== undefined && typeof obj.porterHireAttempted !== "boolean") return false;
    if (obj.porter !== undefined) {
      if (!obj.porter || typeof obj.porter !== "object" || Array.isArray(obj.porter)) return false;
      if (typeof obj.porter.name !== "string" || typeof obj.porter.ownerId !== "string") return false;
      if (typeof obj.porter.hp !== "number" || obj.porter.hp < 1) return false;
      if (!Array.isArray(obj.porter.inventory)) return false;
      if (!obj.porter.inventory.every((stack: unknown) => {
        if (!stack || typeof stack !== "object") return false;
        const candidate = stack as { itemId?: unknown; qty?: unknown };
        return typeof candidate.itemId === "string" && Number.isInteger(candidate.qty) && (candidate.qty as number) > 0;
      })) return false;
    }
    
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
