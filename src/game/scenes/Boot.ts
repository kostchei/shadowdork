/** Boot: generate all runtime textures, create the game context, start the dungeon. */

import Phaser from "phaser";
import { GameContext } from "../context";
import { DUNGEONS } from "../level/dungeons";
import { generateTextures } from "../textures";
import { RENDER_SCALE, GAME_W, GAME_H } from "../display";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    if (!this.textures.exists("tile-wall-0")) {
      generateTextures(this);
      this.createAnimations();
    }
    if (new URLSearchParams(window.location.search).get("showroom") === "equipment") {
      this.scene.start("EquipmentShowroom");
      return;
    }

    const w = GAME_W;
    const h = GAME_H;

    // Title screen background
    this.add.rectangle(w / 2, h / 2, w, h, 0x090b11);

    // Title
    this.add.text(w / 2, h / 2 - 130, "SHADOWDORK", {
      fontFamily: "Georgia, serif",
      fontSize: "44px",
      color: "#ffd45f",
      stroke: "#000000",
      strokeThickness: 5,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    this.add.text(w / 2, h / 2 - 80, "A side-scrolling Shadowdark dungeon crawler", {
      fontFamily: 'Consolas, monospace',
      fontSize: "12px",
      color: "#808490",
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    // New Game Button
    const newGameBtn = this.add.text(w / 2, h / 2 - 20, "[ Start New Game ]", {
      fontFamily: 'Consolas, monospace',
      fontSize: "16px",
      color: "#ffd45f",
      padding: { x: 10, y: 5 },
      resolution: RENDER_SCALE,
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on("pointerover", () => newGameBtn.setColor("#ffffff"))
    .on("pointerout", () => newGameBtn.setColor("#ffd45f"))
    .on("pointerdown", () => {
      this.registry.set("dungeonIndex", Math.floor(Math.random() * DUNGEONS.length));
      this.registry.set("ctx", new GameContext());
      this.scene.start("Dungeon");
    });

    // Load slots
    this.add.text(w / 2, h / 2 + 30, "RESUME EXPEDITION", {
      fontFamily: 'Consolas, monospace',
      fontSize: "12px",
      color: "#a0a4b0",
      fontStyle: "bold",
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const makeLoadBtn = (y: number, key: string, label: string, slotId: number) => {
      const data = localStorage.getItem(key);
      const hasSaved = data !== null;
      let btnText = `[ ${label}: empty ]`;
      if (hasSaved) {
        try {
          const slot = JSON.parse(data);
          const leader = slot.party.find((p: any) => !p.dead) || slot.party[0];
          const leaderName = leader ? `${leader.name} (Lvl ${leader.level})` : "Party";
          btnText = `[ Load ${label}: ${leaderName} | Room ${slot.currentRoom} ]`;
        } catch (e) {
          btnText = `[ Load ${label}: corrupt ]`;
        }
      }

      const btn = this.add.text(w / 2, y, btnText, {
        fontFamily: 'Consolas, monospace',
        fontSize: "12px",
        color: hasSaved ? "#ffd45f" : "#4a4d55",
        padding: { x: 8, y: 4 },
        resolution: RENDER_SCALE,
      }).setOrigin(0.5);

      if (hasSaved) {
        btn.setInteractive({ useHandCursor: true })
        .on("pointerover", () => btn.setColor("#ffffff"))
        .on("pointerout", () => btn.setColor("#ffd45f"))
        .on("pointerdown", () => {
          this.registry.set("loadState", data);
          this.scene.start("Dungeon");
        });
      }
      return btn;
    };

    makeLoadBtn(h / 2 + 65, "shadowdork_slot_1", "Slot 1", 1);
    makeLoadBtn(h / 2 + 95, "shadowdork_slot_2", "Slot 2", 2);
    makeLoadBtn(h / 2 + 125, "shadowdork_slot_3", "Slot 3", 3);
    makeLoadBtn(h / 2 + 155, "shadowdork_autosave", "Auto-Save", 0);
  }

  private createAnimations(): void {
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
