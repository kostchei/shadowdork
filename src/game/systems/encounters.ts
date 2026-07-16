/**
 * Random encounters on the crawling clock — the Shadowdark pillar that makes
 * time itself dangerous. Each crawling round the danger cadence may trigger a
 * 1-in-6 check; in TOTAL darkness (no party member in light) the check runs
 * every crawling round regardless. Encounters spawn a themed wave just off
 * camera, already hunting.
 */

import Phaser from "phaser";
import type { GameContext } from "../context";
import type { DungeonDefinition } from "../level/dungeons";

export interface EncounterDeps {
  ctx: GameContext;
  dungeon: DungeonDefinition;
  camera: () => Phaser.Cameras.Scene2D.Camera;
  partyInTotalDarkness: () => boolean;
  /** Spawn `count` encounter monsters near screen edge x. */
  spawnWave: (monsterId: string, count: number, x: number) => void;
}

export class EncounterSystem {
  private crawlCount = 0;
  private deps: EncounterDeps;

  constructor(deps: EncounterDeps) {
    this.deps = deps;
    deps.ctx.engine.clock.onCrawlingRound(() => this.onCrawlingRound());
  }

  private onCrawlingRound(): void {
    this.crawlCount++;
    const { ctx, dungeon } = this.deps;
    const dark = this.deps.partyInTotalDarkness();
    // Danger cadence: deadly(1) checks every round, risky(2) every 2nd, unsafe(3) every 3rd.
    // Total darkness checks every round — the dark is hungry.
    const due = dark || this.crawlCount % dungeon.danger === 0;
    if (!due) return;

    if (ctx.engine.dice.die(6) !== 1) return;

    const cam = this.deps.camera();
    const fromLeft = ctx.engine.dice.die(2) === 1;
    const spawnX = fromLeft ? cam.worldView.left - 24 : cam.worldView.right + 24;
    const count = ctx.engine.dice.roll("1d3");
    ctx.say(
      dark
        ? "The darkness delivers something hungry..."
        : "Something has heard you. It is coming.",
      "#c07be0",
    );
    this.deps.spawnWave(dungeon.encounterMonsterId, count, spawnX);
  }
}
