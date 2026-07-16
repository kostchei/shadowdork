/** Boot: generate all runtime textures, create the game context, start the dungeon. */

import Phaser from "phaser";
import { GameContext } from "../context";
import { DUNGEONS } from "../level/dungeons";
import { generateTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    if (!this.textures.exists("tile-wall-0")) generateTextures(this);
    if (this.registry.get("dungeonIndex") === undefined) {
      this.registry.set("dungeonIndex", Math.floor(Math.random() * DUNGEONS.length));
    }
    this.registry.set("ctx", new GameContext());
    this.scene.start("Dungeon");
  }
}
