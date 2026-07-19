import { describe, expect, it } from "vitest";
import {
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
});
