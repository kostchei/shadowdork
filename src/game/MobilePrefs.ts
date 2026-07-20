/**
 * Device/session preferences — render quality, muted — stored under their own
 * localStorage key, deliberately separate from SaveRepository's run-save
 * slots and schema versioning. A save migration, a slot delete, or a "clear
 * my saves" action must never touch these: they describe the device and the
 * player's session settings, not the run.
 */

import { qualityLevel, setQualityLevel, type QualityLevel } from "./systems/quality";
import { setMuted } from "./audio/context";

const KEY = "shadowdork_prefs";

interface StoredPrefs {
  quality?: QualityLevel;
  muted?: boolean;
}

function readRaw(): StoredPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(prefs: StoredPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a nice-to-have; a full quota or disabled storage
    // shouldn't block gameplay the way a failed run-save should.
  }
}

/**
 * Apply any saved preferences over the auto-detected defaults. Call once at
 * boot, before anything reads `qualityLevel()` or the audio graph exists.
 * A stored "unmuted" is never applied — that's already the default, and
 * applying it would force-create the AudioContext before any user gesture.
 */
export function loadMobilePrefs(): void {
  const prefs = readRaw();
  if (prefs.quality === "high" || prefs.quality === "low") setQualityLevel(prefs.quality);
  if (prefs.muted === true) setMuted(true);
}

export function saveQualityPref(level: QualityLevel): void {
  writeRaw({ ...readRaw(), quality: level });
}

export function saveMutedPref(muted: boolean): void {
  writeRaw({ ...readRaw(), muted });
}

/** For a future settings screen: the currently active quality level. */
export function currentQualityPref(): QualityLevel {
  return qualityLevel();
}
