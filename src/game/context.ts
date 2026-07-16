/** Shared game context: the engine instance plus cross-scene message bus. */

import Phaser from "phaser";
import { Engine } from "../engine";
import { registerTables } from "../data";

export interface GameMessage {
  text: string;
  color: string;
}

export class GameContext {
  readonly engine: Engine;
  readonly events = new Phaser.Events.EventEmitter();
  readonly messages: GameMessage[] = [];

  constructor() {
    this.engine = new Engine({
      // Playtest house rule: torches burn 3 real minutes instead of 1 hour.
      config: { torchMs: 3 * 60 * 1000, roundMs: 3000, crawlingRoundMs: 10 * 60 * 1000 },
    });
    registerTables(this.engine);
  }

  say(text: string, color = "#c8c8d0"): void {
    this.messages.push({ text, color });
    if (this.messages.length > 60) this.messages.shift();
    this.events.emit("message");
  }

  /** Running total of coins looted this run. Every full 100 banked = 1 XP. */
  private coinsBanked = 0;

  get totalCoins(): number {
    return this.coinsBanked;
  }

  /** Bank looted coins; returns the XP earned by crossing 100-coin thresholds. */
  bankCoins(qty: number): number {
    if (qty < 1) throw new Error(`Coin quantity must be >= 1, got ${qty}`);
    const before = Math.floor(this.coinsBanked / 100);
    this.coinsBanked += qty;
    return Math.floor(this.coinsBanked / 100) - before;
  }
}
