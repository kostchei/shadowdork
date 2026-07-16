/** Boot: generate all runtime textures, create the game context, start the dungeon. */

import Phaser from "phaser";
import { GameContext } from "../context";
import { generateTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    if (!this.textures.exists("tile-wall")) generateTextures(this);
    this.registry.set("ctx", new GameContext());
    this.scene.start("Dungeon");
  }
}
