/**
 * Pure resolution logic for talkable-NPC encounters.
 *
 * The scene owns the sprites, sounds, and inventory objects; this module owns the
 * decisions. Given the NPC spec, the current conversation state, and a snapshot of
 * the leader's relevant inventory capabilities, it returns an ordered list of
 * actions for the scene to execute. Keeping it Phaser-independent lets every
 * outcome — and its persisted-state transition — be unit tested directly.
 */

import type { TalkableNpcSpec } from "./dungeons";

export type NpcInteractionState = "unmet" | "heard" | "resolved";

/** A single ordered step the scene applies to reproduce the resolution. */
export type NpcAction =
  | { type: "say"; text: string; color: string }
  | { type: "grant-item"; itemId: string }
  | { type: "consume-item"; itemId: string; count: number }
  | {
      type: "open-connector";
      connectorId: string | undefined;
      operateRequirement: boolean;
      /** Printed only if the scene's open actually succeeds. */
      successText: string;
      successColor: string;
    }
  | { type: "spawn-betrayal" }
  | { type: "set-state"; state: NpcInteractionState }
  | { type: "mark-resolved" }
  | { type: "persist" };

/** Snapshot of the leader's inventory, evaluated by the scene before resolving. */
export interface LeaderInventorySnapshot {
  hasRation: boolean;
  canAddTorch: boolean;
  canAddGem: boolean;
}

export interface NpcInteractionInput {
  spec: TalkableNpcSpec;
  state: NpcInteractionState;
  leaderName: string;
  inventory: LeaderInventorySnapshot;
}

const RESOLUTION_COLOR = "#e8c878";
const REPEAT_COLOR = "#c8b888";
const SUCCESS_COLOR = "#d0e080";
const BLOCKED_COLOR = "#e0c060";

/** The trailing steps shared by every successful resolution. */
function resolve(spec: TalkableNpcSpec): NpcAction[] {
  return [
    { type: "set-state", state: "resolved" },
    { type: "mark-resolved" },
    { type: "say", text: `${spec.name}: “${spec.resolution}”`, color: RESOLUTION_COLOR },
    { type: "persist" },
  ];
}

/**
 * Decide how an interaction advances. Returns the actions to apply in order. When
 * the outcome cannot complete (no inventory room, missing trade goods) the NPC
 * stays `heard` and only a blocked-hint message is returned.
 */
export function resolveNpcInteraction({ spec, state, leaderName, inventory }: NpcInteractionInput): NpcAction[] {
  if (state === "unmet") {
    return [
      { type: "set-state", state: "heard" },
      { type: "say", text: `${spec.name}, ${spec.role}: “${spec.introduction}”`, color: RESOLUTION_COLOR },
      { type: "persist" },
    ];
  }
  if (state === "resolved") {
    return [{ type: "say", text: `${spec.name}: “${spec.resolution}”`, color: REPEAT_COLOR }];
  }

  switch (spec.outcome) {
    case "give-torch": {
      if (!inventory.canAddTorch) {
        return [{ type: "say", text: `${leaderName} has no room for the offered torch.`, color: BLOCKED_COLOR }];
      }
      return [
        { type: "grant-item", itemId: "torch" },
        { type: "say", text: `${spec.name} gives ${leaderName} a torch.`, color: SUCCESS_COLOR },
        ...resolve(spec),
      ];
    }
    case "reveal-route":
      return [
        {
          type: "open-connector",
          connectorId: spec.targetConnectorId,
          operateRequirement: false,
          successText: `${spec.name} reveals and opens a concealed route.`,
          successColor: SUCCESS_COLOR,
        },
        ...resolve(spec),
      ];
    case "revelation":
      return [
        {
          type: "open-connector",
          connectorId: spec.targetConnectorId,
          operateRequirement: true,
          successText: `${spec.name}'s phrase releases a distant mechanism.`,
          successColor: SUCCESS_COLOR,
        },
        ...resolve(spec),
      ];
    case "trade": {
      if (!inventory.hasRation) {
        return [{ type: "say", text: `${spec.name} still wants one ration for the gem.`, color: BLOCKED_COLOR }];
      }
      if (!inventory.canAddGem) {
        return [{ type: "say", text: `${leaderName} needs inventory space for the gem.`, color: BLOCKED_COLOR }];
      }
      return [
        { type: "consume-item", itemId: "ration", count: 1 },
        { type: "grant-item", itemId: "gem" },
        { type: "say", text: `${leaderName} trades a ration for a gem.`, color: SUCCESS_COLOR },
        ...resolve(spec),
      ];
    }
    case "warning":
      // Advice only: no mechanical effect beyond the resolution line.
      return [...resolve(spec)];
    case "betrayal":
      return [{ type: "spawn-betrayal" }, ...resolve(spec)];
    case "companion-eligible":
      return [
        { type: "say", text: `${spec.name} will join if the vault's reward calls for a companion.`, color: SUCCESS_COLOR },
        ...resolve(spec),
      ];
    default: {
      const unreachable: never = spec.outcome;
      throw new Error(`Unhandled NPC outcome ${unreachable}`);
    }
  }
}
