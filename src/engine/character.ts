/** Character model: six stats, class, effects (talents + conditions), HP/AC/XP, spells. */

import { critThreshold, hasHook, sumHook, sumStatBonus, type Effect } from "./effects";
import type { Dice } from "./dice";
import { Inventory, type ItemDef } from "./inventory";

export type StatName = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export const STAT_NAMES: readonly StatName[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export type Stats = Record<StatName, number>;

export type ClassName = "fighter" | "thief" | "priest" | "wizard";
export type Alignment = "law" | "neutral" | "chaos";

export type SpellStatus = "available" | "lost";

export interface KnownSpell {
  spellId: string;
  status: SpellStatus;
  /** Priest crit-fail: the spell stays lost until atonement (v1: rest at a shrine). */
  requiresAtonement: boolean;
}

export interface DyingState {
  /** Rounds left before death. */
  roundsRemaining: number;
}

export function statModifier(score: number): number {
  if (!Number.isInteger(score) || score < 1 || score > 20) {
    throw new Error(`Invalid stat score: ${score}`);
  }
  return Math.floor((score - 10) / 2);
}

/**
 * Roll a starting stat array: 3d6 per stat, silently regenerated until the
 * set is heroic — at least two stats of 15+ and at most one stat under 6.
 */
export function rollStats(dice: Dice): Stats {
  const MAX_ATTEMPTS = 10_000;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const scores = STAT_NAMES.map(() => dice.roll("3d6"));
    const high = scores.filter((s) => s >= 15).length;
    const low = scores.filter((s) => s < 6).length;
    if (high >= 2 && low <= 1) {
      const stats = {} as Stats;
      STAT_NAMES.forEach((name, i) => (stats[name] = scores[i]!));
      return stats;
    }
  }
  throw new Error(`rollStats found no qualifying array in ${MAX_ATTEMPTS} attempts`);
}

export interface CharacterInit {
  id: string;
  name: string;
  className: ClassName;
  stats: Stats;
  maxHp: number;
  alignment?: Alignment;
  ancestry?: string;
}

export class Character {
  readonly id: string;
  readonly name: string;
  readonly className: ClassName;
  readonly alignment: Alignment;
  readonly stats: Stats;
  readonly ancestry: string;

  level = 1;
  xp = 0;
  hp: number;
  private baseMaxHp: number;

  /** Permanent talents + temporary conditions, all as effect hooks. */
  effects: Effect[] = [];
  knownSpells: KnownSpell[] = [];
  inventory: Inventory;

  /** Worn armor (class-gated via equipArmor). Null = unarmored: AC 10 + DEX. */
  wornArmor: ItemDef | null = null;
  /** A readied shield: +2 AC, occupies a hand. */
  carriedShield: ItemDef | null = null;
  /** Shield slung on the back (e.g. to carry a torch): hand free, no AC bonus. */
  shieldStowed = false;

  /** One reroll, Shadowdark luck. Spent through the game layer. */
  luckToken = true;

  /** Set while at 0 HP; cleared by stabilization or healing. */
  dying: DyingState | null = null;
  dead = false;

  constructor(init: CharacterInit) {
    this.id = init.id;
    this.name = init.name;
    this.className = init.className;
    this.alignment = init.alignment ?? "neutral";
    this.stats = { ...init.stats };
    this.ancestry = init.ancestry ?? "human";
    for (const s of STAT_NAMES) statModifier(this.stats[s]); // validate
    this.baseMaxHp = init.maxHp;
    this.hp = this.maxHp;
    // Gear slots = max(STR, 10); fighters haul + CON mod extra (Hauler).
    let capacity = Math.max(this.stats.STR, 10);
    if (init.className === "fighter") {
      capacity += Math.max(0, statModifier(this.stats.CON));
    }
    this.inventory = new Inventory(capacity);
  }

  mod(stat: StatName): number {
    return statModifier(this.stats[stat]) + sumStatBonus(this.effects, stat);
  }

  get maxHp(): number {
    return this.baseMaxHp + sumHook(this.effects, "maxHpBonus");
  }

  /** AC = armor base + DEX (capped by the armor) + readied shield + effect hooks + armor type hooks. */
  get ac(): number {
    const dex = this.mod("DEX");
    const armored = this.wornArmor?.armor;
    const base = armored ? armored.acBase + Math.min(dex, armored.dexCap) : 10 + dex;
    const shield = this.carriedShield && !this.shieldStowed ? 2 : 0;
    return base + shield + sumHook(this.effects, "acBonus") + this.armorAcBonus();
  }

  private armorAcBonus(): number {
    let total = 0;
    for (const e of this.effects) {
      for (const h of e.hooks) {
        if (h.kind === "armorAcBonus" && this.wornArmor?.id === h.armorId) {
          total += h.bonus;
        }
      }
    }
    return total;
  }

  /** Wear armor. Class permissions are the armor's, and they are law. */
  equipArmor(def: ItemDef): void {
    if (!def.armor) throw new Error(`${def.name} is not armor`);
    if (!def.armor.classes.includes(this.className)) {
      throw new Error(`A ${this.className} cannot wear ${def.name}`);
    }
    this.wornArmor = def;
  }

  /** Ready a shield (+2 AC, occupies a hand). */
  equipShield(def: ItemDef): void {
    if (!def.shield) throw new Error(`${def.name} is not a shield`);
    this.carriedShield = def;
    this.shieldStowed = false;
  }

  /** A hand is free unless a readied shield fills it. */
  get handFreeOfShield(): boolean {
    return this.carriedShield === null || this.shieldStowed;
  }

  get critThreshold(): number {
    return critThreshold(this.effects);
  }

  get damageBonus(): number {
    const halfLevel = hasHook(this.effects, "damageBonusHalfLevel")
      ? Math.floor(this.level / 2)
      : 0;
    return sumHook(this.effects, "damageBonus") + halfLevel;
  }

  addEffect(effect: Effect): void {
    const resolvedHooks = effect.hooks.map((h) => {
      if (h.kind === "statBonusChoice") {
        let bestStat = h.stats[0]!;
        let maxVal = -1;
        for (const s of h.stats) {
          const val = this.stats[s];
          if (val > maxVal) {
            maxVal = val;
            bestStat = s;
          }
        }
        return { kind: "statBonus" as const, stat: bestStat, bonus: h.bonus };
      }
      if (h.kind === "armorAcBonusChoice") {
        const armorId = this.wornArmor ? this.wornArmor.id : (this.className === "thief" ? "leather-armor" : "chainmail");
        return { kind: "armorAcBonus" as const, armorId, bonus: h.bonus };
      }
      return h;
    });
    this.effects.push({ ...effect, hooks: resolvedHooks });
  }

  removeEffect(id: string): void {
    this.effects = this.effects.filter((e) => e.id !== id);
  }

  increaseMaxHp(amount: number): void {
    if (amount < 1) throw new Error(`HP increase must be positive, got ${amount}`);
    this.baseMaxHp += amount;
    this.hp += amount;
  }

  learnSpell(spellId: string): void {
    if (this.knownSpells.some((s) => s.spellId === spellId)) {
      throw new Error(`${this.name} already knows spell "${spellId}"`);
    }
    this.knownSpells.push({ spellId, status: "available", requiresAtonement: false });
  }

  knownSpell(spellId: string): KnownSpell {
    const s = this.knownSpells.find((k) => k.spellId === spellId);
    if (!s) throw new Error(`${this.name} does not know spell "${spellId}"`);
    return s;
  }

  takeDamage(amount: number): void {
    if (amount < 0) throw new Error(`Damage must be >= 0, got ${amount}`);
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number): void {
    if (amount < 0) throw new Error(`Healing must be >= 0, got ${amount}`);
    if (this.dead) throw new Error(`${this.name} is dead and cannot be healed`);
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > 0) this.dying = null;
  }
}
