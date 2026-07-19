import { describe, expect, it } from "vitest";
import { pickSkinForScrollRun, rollBiomeOffer, rollVaultCountForScroll } from "../src/game/biomeChoice";
import { ZONE_PACKS } from "../src/game/visual/skins";

describe("rollBiomeOffer", () => {
  it("offers between one and six scrolls", () => {
    for (let seed = 0; seed < 500; seed++) {
      for (let index = 0; index < 6; index++) {
        const offer = rollBiomeOffer(index, seed);
        expect(offer.optionCount).toBeGreaterThanOrEqual(1);
        expect(offer.optionCount).toBeLessThanOrEqual(6);
        expect(offer.zones.length).toBe(offer.optionCount);
      }
    }
  });

  it("offers distinct scrolls drawn from the six-scroll pool", () => {
    for (let seed = 0; seed < 500; seed++) {
      const offer = rollBiomeOffer(seed % 6, seed);
      const unique = new Set(offer.zones);
      expect(unique.size).toBe(offer.zones.length);
      for (const zone of offer.zones) expect(ZONE_PACKS).toContain(zone);
    }
  });

  it("does not exclude the current scroll: some rolls re-offer every scroll", () => {
    // Across many seeds, at least one offer must be a full spread of all six.
    let sawFullSpread = false;
    for (let seed = 0; seed < 1000 && !sawFullSpread; seed++) {
      if (rollBiomeOffer(0, seed).optionCount === ZONE_PACKS.length) sawFullSpread = true;
    }
    expect(sawFullSpread).toBe(true);
  });

  it("is deterministic for a given index and seed", () => {
    const a = rollBiomeOffer(3, 123456);
    const b = rollBiomeOffer(3, 123456);
    expect(a).toEqual(b);
  });

  it("varies the offer as the campaign advances on a fixed seed", () => {
    const offers = new Set<string>();
    for (let index = 0; index < 12; index++) {
      offers.add(JSON.stringify(rollBiomeOffer(index, 42)));
    }
    // Different dungeon indices should not all collapse to the same offer.
    expect(offers.size).toBeGreaterThan(1);
  });

  it("rejects invalid inputs rather than falling back", () => {
    expect(() => rollBiomeOffer(-1, 0)).toThrow();
    expect(() => rollBiomeOffer(1.5, 0)).toThrow();
    expect(() => rollBiomeOffer(0, 1.5)).toThrow();
  });
});

describe("rollVaultCountForScroll", () => {
  it("returns 1d6 vaults (between 1 and 6)", () => {
    for (let seed = 0; seed < 500; seed++) {
      const count = rollVaultCountForScroll(seed);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(6);
    }
  });
});

describe("pickSkinForScrollRun", () => {
  it("enforces max 2x usage per biome skin within a scroll destination", () => {
    const zone = "diablerie";
    const history: ("rot-bramble" | "mugdulblub-keep" | "willowman-hollow")[] = [
      "rot-bramble",
      "rot-bramble",
    ];
    // rot-bramble is at 2 uses, so pickSkinForScrollRun must pick mugdulblub-keep or willowman-hollow
    for (let seed = 0; seed < 50; seed++) {
      const skin = pickSkinForScrollRun(zone, history, seed);
      expect(skin.id).not.toBe("rot-bramble");
    }
  });
});
