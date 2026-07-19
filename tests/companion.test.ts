import { describe, expect, it } from "vitest";
import {
  companionPartySnapshot,
  chooseCompanionRecruit,
  PARTY_CAP,
  type CompanionCandidate,
  type PartySnapshot,
} from "../src/game/systems/companion";

const npc: CompanionCandidate = {
  id: "pc-npc-1",
  name: "Wren",
  className: "thief",
  alignment: "neutral",
  fromNpc: true,
};

const fallback: CompanionCandidate = {
  id: "pc-priest",
  name: "Cleric",
  className: "priest",
  alignment: "law",
  fromNpc: false,
};

function party(classes: PartySnapshot["classes"]): PartySnapshot {
  return { size: classes.length, classes };
}

describe("chooseCompanionRecruit", () => {
  it("recruits the eligible NPC when the party has room and lacks its class", () => {
    const decision = chooseCompanionRecruit(npc, fallback, party(["fighter", "wizard"]));
    expect(decision).toEqual({ kind: "recruit", candidate: npc });
  });

  it("falls back to the reward default when no NPC is eligible", () => {
    const decision = chooseCompanionRecruit(null, fallback, party(["fighter", "wizard"]));
    expect(decision).toEqual({ kind: "recruit", candidate: fallback });
  });

  it("skips outright when the NPC duplicates an existing class (no silent fallback)", () => {
    const decision = chooseCompanionRecruit(npc, fallback, party(["fighter", "thief"]));
    expect(decision).toEqual({ kind: "skip", reason: "duplicate-class", className: "thief" });
  });

  it("skips when the party is already at capacity", () => {
    const decision = chooseCompanionRecruit(
      { ...npc, className: "wizard" },
      fallback,
      { size: PARTY_CAP, classes: ["fighter", "priest", "thief", "wizard"] },
    );
    expect(decision).toEqual({ kind: "skip", reason: "party-full", className: "wizard" });
  });

  it("checks capacity before duplicate class", () => {
    // Full party that also duplicates the class: capacity wins the message.
    const decision = chooseCompanionRecruit(npc, fallback, {
      size: PARTY_CAP,
      classes: ["fighter", "priest", "wizard", "thief"],
    });
    expect(decision.kind).toBe("skip");
    if (decision.kind === "skip") expect(decision.reason).toBe("party-full");
  });

  it("validates the fallback too when it would duplicate a class", () => {
    const decision = chooseCompanionRecruit(null, fallback, party(["fighter", "priest"]));
    expect(decision).toEqual({ kind: "skip", reason: "duplicate-class", className: "priest" });
  });

  it("does not let dead companions consume capacity or block their replacement class", () => {
    const snapshot = companionPartySnapshot([
      { className: "fighter", dead: false },
      { className: "thief", dead: true },
    ]);
    expect(snapshot).toEqual({ size: 1, classes: ["fighter"] });
    expect(chooseCompanionRecruit(npc, fallback, snapshot)).toEqual({ kind: "recruit", candidate: npc });
  });

  it("treats alternate classes as matching their base role for duplicate class checks", () => {
    const decision = chooseCompanionRecruit(
      { ...npc, className: "ras-godai" },
      fallback,
      party(["thief"]),
    );
    expect(decision).toEqual({ kind: "skip", reason: "duplicate-class", className: "ras-godai" });
  });
});

import { resolveClassForZone } from "../src/game/systems/companion";

describe("resolveClassForZone", () => {
  it("resolves base classes to alternate classes 50% of the time in matching destinations", () => {
    expect(resolveClassForZone("fighter", "red-sands", true)).toBe("pit-fighter");
    expect(resolveClassForZone("fighter", "red-sands", false)).toBe("fighter");

    expect(resolveClassForZone("thief", "red-sands", true)).toBe("ras-godai");
    expect(resolveClassForZone("thief", "red-sands", false)).toBe("thief");

    expect(resolveClassForZone("fighter", "midnight-sun", true)).toBe("sea-wolf");
    expect(resolveClassForZone("priest", "midnight-sun", true)).toBe("seer");

    expect(resolveClassForZone("wizard", "diablerie", true)).toBe("witch");
  });

  it("retains base class when zone does not match", () => {
    expect(resolveClassForZone("fighter", "diablerie", true)).toBe("fighter");
    expect(resolveClassForZone("wizard", "midnight-sun", true)).toBe("wizard");
    expect(resolveClassForZone("priest", "red-sands", true)).toBe("priest");
  });
});
