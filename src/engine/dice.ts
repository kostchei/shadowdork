/** Seedable RNG + dice rolling. All randomness in the game flows through a Dice instance. */

export type Advantage = "normal" | "advantage" | "disadvantage";

export interface D20Result {
  /** The die actually used after adv/dis selection. */
  natural: number;
  /** Both dice when adv/dis was in play, otherwise a single entry. */
  rolls: number[];
  mode: Advantage;
}

/** mulberry32 — small, fast, seedable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DICE_EXPR = /^(\d+)d(\d+)([+-]\d+)?$/;

export class Dice {
  private rng: () => number;

  constructor(seed?: number) {
    this.rng = mulberry32(seed ?? (Math.random() * 2 ** 32) >>> 0);
  }

  /** Integer in [1, sides]. */
  die(sides: number): number {
    if (!Number.isInteger(sides) || sides < 1) {
      throw new Error(`Invalid die: d${sides}`);
    }
    return 1 + Math.floor(this.rng() * sides);
  }

  /** Roll an expression like "2d6+1", "1d4", "3d6-2". Returns total. */
  roll(expr: string): number {
    return this.rollDetailed(expr).total;
  }

  rollDetailed(expr: string): { total: number; rolls: number[]; modifier: number } {
    const m = DICE_EXPR.exec(expr.replaceAll(" ", ""));
    if (!m) throw new Error(`Invalid dice expression: "${expr}"`);
    const count = Number(m[1]);
    const sides = Number(m[2]);
    const modifier = m[3] ? Number(m[3]) : 0;
    if (count < 1 || count > 100) throw new Error(`Invalid dice count in "${expr}"`);
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) rolls.push(this.die(sides));
    return { total: rolls.reduce((a, b) => a + b, 0) + modifier, rolls, modifier };
  }

  /** d20 with advantage/disadvantage as a first-class input. */
  d20(mode: Advantage = "normal"): D20Result {
    if (mode === "normal") {
      const r = this.die(20);
      return { natural: r, rolls: [r], mode };
    }
    const a = this.die(20);
    const b = this.die(20);
    const natural = mode === "advantage" ? Math.max(a, b) : Math.min(a, b);
    return { natural, rolls: [a, b], mode };
  }

  /** Pick an integer in [min, max] inclusive. */
  between(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`Invalid range [${min}, ${max}]`);
    }
    return min + Math.floor(this.rng() * (max - min + 1));
  }
}
