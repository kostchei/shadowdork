/** Character model: six stats, class, effects (talents + conditions), HP/AC/XP, spells. */

import { critThreshold, sumHook, sumStatBonus, type Effect } from "./effects";
import { Inventory } from "./inventory";

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

export interface CharacterInit {
  id: string;
  name: string;
  className: ClassName;
  stats: Stats;
  maxHp: number;
  baseAc: number;
  alignment?: Alignment;
}

export class Character {
  readonly id: string;
  readonly name: string;
  readonly className: ClassName;
  readonly alignment: Alignment;
  readonly stats: Stats;

  level = 1;
  xp = 0;
  hp: number;
  private baseMaxHp: number;
  private baseAc: number;

  /** Permanent talents + temporary conditions, all as effect hooks. */
  effects: Effect[] = [];
  knownSpells: KnownSpell[] = [];
  inventory: Inventory;

  /** Set while at 0 HP; cleared by stabilization or healing. */
  dying: DyingState | null = null;
  dead = false;

  constructor(init: CharacterInit) {
    this.id = init.id;
    this.name = init.name;
    this.className = init.className;
    this.alignment = init.alignment ?? "neutral";
    this.stats = { ...init.stats };
    for (const s of STAT_NAMES) statModifier(this.stats[s]); // validate
    this.baseMaxHp = init.maxHp;
    this.hp = this.maxHp;
    this.baseAc = init.baseAc;
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

  get ac(): number {
    return this.baseAc + sumHook(this.effects, "acBonus");
  }

  get critThreshold(): number {
    return critThreshold(this.effects);
  }

  get damageBonus(): number {
    return sumHook(this.effects, "damageBonus");
  }

  addEffect(effect: Effect): void {
    this.effects.push(effect);
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
