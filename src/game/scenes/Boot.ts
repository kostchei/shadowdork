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
    if (!this.textures.exists("tile-wall-0")) {
      generateTextures(this);
      this.createAnimations();
    }
    if (this.registry.get("dungeonIndex") === undefined) {
      this.registry.set("dungeonIndex", Math.floor(Math.random() * DUNGEONS.length));
    }
    this.registry.set("ctx", new GameContext());
    this.scene.start("Dungeon");
  }

  private createAnimations(): void {
    const classes = ["fighter", "thief", "priest", "wizard"];
    for (const cls of classes) {
      this.anims.create({
        key: `char-${cls}-idle`,
        frames: [
          { key: `char-${cls}-idle-0` },
          { key: `char-${cls}-idle-1` },
        ],
        frameRate: 3,
        repeat: -1,
      });
      this.anims.create({
        key: `char-${cls}-walk`,
        frames: [
          { key: `char-${cls}-walk-0` },
          { key: `char-${cls}-walk-1` },
          { key: `char-${cls}-walk-2` },
          { key: `char-${cls}-walk-3` },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    const monsters = ["goblin", "skeleton", "giant-rat", "gloom-ogre"];
    for (const mon of monsters) {
      this.anims.create({
        key: `monster-${mon}-idle`,
        frames: [
          { key: `monster-${mon}-idle-0` },
          { key: `monster-${mon}-idle-1` },
        ],
        frameRate: 3,
        repeat: -1,
      });
      this.anims.create({
        key: `monster-${mon}-walk`,
        frames: [
          { key: `monster-${mon}-walk-0` },
          { key: `monster-${mon}-walk-1` },
          { key: `monster-${mon}-walk-2` },
          { key: `monster-${mon}-walk-3` },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}
