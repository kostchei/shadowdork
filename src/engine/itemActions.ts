/**
 * Resolves whether an item action is legal right now, and applies the
 * bookkeeping consequence of attempting one (spending a charge, going inert,
 * breaking). Pure and renderer-free — the game layer decides *what* using an
 * item does (heal, cast, place terrain, ...); this only guards *whether* the
 * attempt is allowed and keeps charge/inertness/breakage state consistent.
 */

import type { Character } from "./character";
import { itemTargetNeedsSelection, type ItemActionKind, type ItemDef, type ItemStateTracker } from "./inventory";

export type UseFailureReason =
  | "not-carried"
  | "unsupported-action"
  | "target-required"
  | "inert"
  | "broken"
  | "no-charges";

export type UseCheck = { ok: true } | { ok: false; reason: UseFailureReason; message: string };

const FAILURE_MESSAGE: Record<UseFailureReason, (def: ItemDef) => string> = {
  "not-carried": (def) => `Not carrying ${def.name}.`,
  "unsupported-action": (def) => `${def.name} cannot be used that way.`,
  "target-required": (def) => `${def.name} needs a target first.`,
  inert: (def) => `${def.name} is inert until its wielder rests.`,
  broken: (def) => `${def.name} is broken.`,
  "no-charges": (def) => `${def.name} has no charges left.`,
};

function fail(reason: UseFailureReason, def: ItemDef): UseCheck {
  return { ok: false, reason, message: FAILURE_MESSAGE[reason](def) };
}

/** Does the character have this item on their person at all — carried, worn, or wielded? */
function isCarried(character: Character, itemId: string): boolean {
  return (
    character.inventory.has(itemId) ||
    character.wornArmor?.id === itemId ||
    character.wieldedWeapon?.id === itemId ||
    character.carriedShield?.id === itemId
  );
}

/**
 * Whether `action` can be attempted on `def` right now. `hasTarget` reports
 * whether the caller already resolved a target for actions whose target kind
 * needs one selected (ally/enemy/point/object/surface) — self/none never do.
 */
export function canUseItem(
  character: Character,
  tracker: ItemStateTracker,
  def: ItemDef,
  action: ItemActionKind,
  hasTarget = false,
): UseCheck {
  if (!isCarried(character, def.id)) return fail("not-carried", def);
  const use = def.use;
  if (!use || !use.actions.includes(action)) return fail("unsupported-action", def);
  if (itemTargetNeedsSelection(use.target) && !hasTarget) return fail("target-required", def);

  const state = tracker.get(def.id);
  if (state.broken) return fail("broken", def);
  if (state.inert) return fail("inert", def);
  if (use.charges !== undefined) {
    const remaining = state.chargesRemaining ?? use.charges;
    if (remaining <= 0) return fail("no-charges", def);
  }
  return { ok: true };
}

export type UseOutcome = "success" | "fail" | "criticalFail";

/**
 * Apply the bookkeeping side of an attempted use: spend a charge, go inert on
 * a plain failure, break permanently on a critical failure. Call only after
 * {@link canUseItem} passed — this does not re-check legality.
 */
export function applyUseOutcome(
  tracker: ItemStateTracker,
  def: ItemDef,
  outcome: UseOutcome,
): void {
  const use = def.use;
  if (!use) return;
  if (use.charges !== undefined) {
    const remaining = tracker.get(def.id).chargesRemaining ?? use.charges;
    tracker.setCharges(def.id, Math.max(0, remaining - 1));
  }
  if (outcome === "fail" && use.inertOnFail) tracker.markInert(def.id);
  if (outcome === "criticalFail" && use.breaksOnCriticalFail) tracker.markBroken(def.id);
}

/** Rest recovery for every charged/inert item the character carries, wears, or wields. */
export function restoreOnRest(character: Character): void {
  const defs: ItemDef[] = character.inventory.all().map((s) => s.def);
  if (character.wornArmor) defs.push(character.wornArmor);
  if (character.wieldedWeapon) defs.push(character.wieldedWeapon);
  if (character.carriedShield) defs.push(character.carriedShield);

  for (const def of defs) {
    const use = def.use;
    if (!use) continue;
    if (use.inertOnFail) character.itemState.clearInert(def.id);
    if (use.rechargeOnRest && use.charges !== undefined) character.itemState.setCharges(def.id, use.charges);
  }
}
