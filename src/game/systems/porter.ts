export const PORTER_HIRE_PRICE = 100;
export const PORTER_UPKEEP_GP = 5;
export const PORTER_CAPACITY_SLOTS = 10;

/** First porter is DC 9; future porters, if enabled, become progressively harder to recruit. */
export function porterHireDc(existingPorters: number): number {
  if (!Number.isInteger(existingPorters) || existingPorters < 0) {
    throw new Error("Existing porter count must be a non-negative integer");
  }
  return 9 + existingPorters * 3;
}

export type PorterHireBlock = "gold" | "already-hired" | "attempted" | null;

export function porterHireBlock(spendableGold: number, existingPorters: number, attempted = false): PorterHireBlock {
  if (existingPorters > 0) return "already-hired";
  if (attempted) return "attempted";
  if (spendableGold < PORTER_HIRE_PRICE) return "gold";
  return null;
}

/** Adventurers always take targeting priority; distance only breaks ties within that group. */
export function chooseMonsterTarget<T>(
  adventurers: readonly T[],
  porter: T | undefined,
  distance: (target: T) => number,
): T | undefined {
  return [...adventurers].sort((a, b) => distance(a) - distance(b))[0] ?? porter;
}
