/**
 * Random encounters on the crawling clock — the Shadowdark pillar that makes
 * time itself dangerous. Each crawling round the danger cadence may trigger a
 * 1-in-6 check; in TOTAL darkness (no party member in light) the check runs
 * every crawling round regardless. A wave gets a starting distance, an
 * activity, and a reaction (assuming the party isn't surprised — that's a
 * separate, later system) instead of spawning already hunting; the game
 * layer turns those into a contextual reaction popup once the sprites exist.
 */

import Phaser from "phaser";
import type { GameContext } from "../context";
import type { DungeonDefinition } from "../level/dungeons";
import {
  rollActivity,
  rollDistance,
  rollReaction,
  type EncounterDistance,
  type MonsterActivity,
  type MonsterReaction,
} from "../../engine";

/** How far off-camera each rolled distance band spawns the wave. */
const DISTANCE_OFFSET_PX: Record<EncounterDistance, number> = { close: 24, near: 120, far: 260 };

export interface EncounterDeps {
  ctx: GameContext;
  dungeon: DungeonDefinition;
  camera: () => Phaser.Cameras.Scene2D.Camera;
  partyInTotalDarkness: () => boolean;
  /** Spawn `count` encounter monsters near screen edge x, with their rolled activity/reaction/distance. */
  spawnWave: (
    monsterId: string,
    count: number,
    x: number,
    activity: MonsterActivity,
    reaction: MonsterReaction,
    distance: EncounterDistance,
  ) => void;
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
    const distance = rollDistance(ctx.engine.dice);
    const offsetPx = DISTANCE_OFFSET_PX[distance];
    const spawnX = fromLeft ? cam.worldView.left - offsetPx : cam.worldView.right + offsetPx;
    const count = ctx.engine.dice.roll("1d3");
    const activity = rollActivity(ctx.engine.dice);
    const reaction = rollReaction(ctx.engine.dice);
    ctx.say(
      dark ? "Something moves in the pitch black..." : "You sense something nearby...",
      "#c07be0",
    );
    this.deps.spawnWave(dungeon.encounterMonsterId, count, spawnX, activity, reaction, distance);
  }
}
