/** Boot: generate all runtime textures, create the game context, start the dungeon. */

import Phaser from "phaser";
import { GameContext } from "../context";
import { DUNGEONS } from "../level/dungeons";
import { generateTextures } from "../textures";
import { RENDER_SCALE, GAME_W, GAME_H } from "../display";
import { SaveRepository } from "../SaveRepository";
import { showAlert, showConfirm } from "../ui/modal";
import { currentInputFamily } from "../input/inputFamily";
import { textButton } from "../ui/button";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    // The framebuffer is render-scaled; keep the title screen in the same
    // logical 960x540 view used by the dungeon, HUD, and showroom scenes.
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_W / 2, GAME_H / 2);

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

    this.add.text(
      w / 2,
      h / 2 - 55,
      currentInputFamily() === "touch" ? "Playable with Touch Controls" : "Desktop Keyboard Recommended",
      {
      fontFamily: 'Consolas, monospace',
      fontSize: "10px",
      color: "#ffd45f",
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    // New Game Button — the first tap a mobile player ever makes here, so it
    // gets the shared textButton's larger hit rect and pressed feedback.
    textButton(
      this,
      w / 2,
      h / 2 - 20,
      "[ Start New Game ]",
      () => {
        const startRun = () => {
          // Campaign progression starts at dungeon 0 so its first reward is always
          // appropriate for a new party.  The independent seed makes the actual
          // dungeon type and its room selections fresh every time.
          this.registry.set("dungeonIndex", 0);
          this.registry.set("runSeed", Math.floor(Math.random() * 0x1_0000_0000));
          this.registry.set("ctx", new GameContext());
          this.scene.start("Dungeon");
        };
        if (SaveRepository.exists(0) || SaveRepository.exists(1) || SaveRepository.exists(2) || SaveRepository.exists(3)) {
          showConfirm(this, "Starting a new game will eventually overwrite your autosave and progress. Proceed?", startRun);
          return;
        }
        startRun();
      },
      {
        fontSize: "16px",
        idleColor: "#ffd45f",
        pressedColor: "#fff4cf",
        resolution: RENDER_SCALE,
        padding: { x: 10, y: 5 },
      },
    );

    // Load slots
    this.add.text(w / 2, h / 2 + 30, "RESUME EXPEDITION", {
      fontFamily: 'Consolas, monospace',
      fontSize: "12px",
      color: "#a0a4b0",
      fontStyle: "bold",
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const makeLoadBtn = (y: number, label: string, slotId: number) => {
      const hasSaved = SaveRepository.exists(slotId);
      let btnText = `[ ${label}: empty ]`;
      let slotData: any = null;
      if (hasSaved) {
        try {
          slotData = SaveRepository.load(slotId);
          if (slotData) {
            const leader = slotData.party.find((p: any) => !p.dead) || slotData.party[0];
            const leaderName = leader ? `${leader.name} (Lvl ${leader.level})` : "Party";
            const room = slotData.roomId
              ? slotData.roomId.replace(/^room-/, "Room ").replace(/^sanctuary$/, "Sanctuary")
              : slotData.currentRoom != null
                ? `Room ${slotData.currentRoom}`
                : "In progress";
            btnText = `[ Load ${label}: ${leaderName} | ${room} ]`;
          } else {
            btnText = `[ Load ${label}: empty ]`;
          }
        } catch (e: any) {
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

      if (hasSaved && slotData) {
        btn.setInteractive({ useHandCursor: true })
        .on("pointerover", () => btn.setColor("#ffffff"))
        .on("pointerout", () => btn.setColor("#ffd45f"))
        .on("pointerdown", () => {
          this.registry.set("loadState", slotData);
          this.scene.start("Dungeon");
        });
      }
      return btn;
    };

    makeLoadBtn(h / 2 + 65, "Slot 1", 1);
    makeLoadBtn(h / 2 + 95, "Slot 2", 2);
    makeLoadBtn(h / 2 + 125, "Slot 3", 3);
    makeLoadBtn(h / 2 + 155, "Auto-Save", 0);

    // Export/Import
    const exportBtn = this.add.text(w / 2 - 80, h / 2 + 195, "[ Export Saves ]", {
      fontFamily: 'Consolas, monospace',
      fontSize: "11px",
      color: "#a0a4b0",
      padding: { x: 5, y: 3 },
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const importBtn = this.add.text(w / 2 + 80, h / 2 + 195, "[ Import Saves ]", {
      fontFamily: 'Consolas, monospace',
      fontSize: "11px",
      color: "#a0a4b0",
      padding: { x: 5, y: 3 },
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    exportBtn.setInteractive({ useHandCursor: true })
      .on("pointerover", () => exportBtn.setColor("#ffffff"))
      .on("pointerout", () => exportBtn.setColor("#a0a4b0"))
      .on("pointerdown", () => {
        try {
          const json = SaveRepository.exportAll();
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `shadowdork_saves_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e: any) {
          showAlert(this, `Failed to export saves: ${e.message}`);
        }
      });

    importBtn.setInteractive({ useHandCursor: true })
      .on("pointerover", () => importBtn.setColor("#ffffff"))
      .on("pointerout", () => importBtn.setColor("#a0a4b0"))
      .on("pointerdown", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const contents = evt.target?.result as string;
            const res = SaveRepository.importAll(contents);
            if (res.success) {
              showAlert(this, `Successfully imported ${res.count} save slot(s)!`, () => this.scene.restart());
            } else {
              showAlert(this, `Import failed: ${res.error}`);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });

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
