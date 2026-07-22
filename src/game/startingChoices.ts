import type { ClassName } from "../engine";
import type { VisualSkin, ZonePackId } from "./visual/model";
import { skinsForZone } from "./visual/skins";

const CORE_CLASSES = ["fighter", "thief", "priest", "wizard"] as const satisfies readonly ClassName[];

const LOCAL_CLASSES: Partial<Record<ZonePackId, readonly ClassName[]>> = {
  diablerie: ["witch"],
  "red-sands": ["pit-fighter", "ras-godai"],
  "midnight-sun": ["sea-wolf", "seer"],
};

/** Classes a new character can choose in a destination, including its local traditions. */
export function startingClassesForZone(zone: ZonePackId): readonly ClassName[] {
  return [...CORE_CLASSES, ...(LOCAL_CLASSES[zone] ?? [])];
}

/** The three named starting locations within a Cursed Scroll destination. */
export function startingLocationsForZone(zone: ZonePackId): readonly VisualSkin[] {
  return skinsForZone(zone);
}

export function isValidStartingChoice(zone: ZonePackId, skinId: string, className: ClassName): boolean {
  return startingLocationsForZone(zone).some((skin) => skin.id === skinId)
    && startingClassesForZone(zone).includes(className);
}
