import { describe, expect, it } from "vitest";
import { isValidStartingChoice, startingClassesForZone, startingLocationsForZone } from "../src/game/startingChoices";
import { ZONE_PACKS } from "../src/game/visual/skins";

describe("new-game starting choices", () => {
  it("offers every core class in every destination", () => {
    for (const zone of ZONE_PACKS) {
      expect(startingClassesForZone(zone)).toEqual(expect.arrayContaining(["fighter", "thief", "priest", "wizard"]));
    }
  });

  it("adds only the class traditions native to the chosen destination", () => {
    expect(startingClassesForZone("diablerie")).toContain("witch");
    expect(startingClassesForZone("red-sands")).toEqual(expect.arrayContaining(["pit-fighter", "ras-godai"]));
    expect(startingClassesForZone("midnight-sun")).toEqual(expect.arrayContaining(["sea-wolf", "seer"]));
    expect(startingClassesForZone("city-of-masks")).toHaveLength(4);
  });

  it("offers all three named locations inside each destination", () => {
    for (const zone of ZONE_PACKS) {
      const locations = startingLocationsForZone(zone);
      expect(locations).toHaveLength(3);
      expect(locations.every((location) => location.zone === zone)).toBe(true);
    }
  });

  it("validates location and class as one coherent selection", () => {
    expect(isValidStartingChoice("red-sands", "iron-fortress", "pit-fighter")).toBe(true);
    expect(isValidStartingChoice("diablerie", "iron-fortress", "witch")).toBe(false);
    expect(isValidStartingChoice("city-of-masks", "rooftop-scamper", "witch")).toBe(false);
  });
});
