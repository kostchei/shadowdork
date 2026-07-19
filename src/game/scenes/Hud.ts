/** Compact, high-contrast HUD that keeps the dungeon visible. */

import Phaser from "phaser";
import { spell } from "../../data";
import { RENDER_SCALE, GAME_H, GAME_W } from "../display";
import {
  MAX_LEVEL,
  alignmentLabel,
  partyCoinSlots,
  xpToNextLevel,
  type Character,
  type LevelUpResult,
} from "../../engine";
import type { GameContext } from "../context";
import { roomAtTolerant } from "../level/geometry";
import { TILE } from "../textures";
import type { DungeonScene } from "./Dungeon";
import { SaveRepository } from "../SaveRepository";
import { speak } from "../audio/voice";
import { skinsForZone, zonePackInfo } from "../visual/skins";

const UI_STYLE = {
  fontFamily: '"Trebuchet MS", Arial, sans-serif',
  fontSize: "12px",
  color: "#f0eee9",
  resolution: RENDER_SCALE,
} as const;

const DATA_STYLE = {
  fontFamily: "Consolas, monospace",
  fontSize: "10px",
  color: "#c9cbd1",
  resolution: RENDER_SCALE,
} as const;

const MAX_PARTY = 4;
const LOG_LINES = 2;
const PARTY_BOX = { x: 8, y: 8, w: 520, headerH: 28, rowH: 22, detailH: 20 };
const MISSION_BOX = { x: 600, y: 8, w: 352, h: 70 };

function partyBoxHeight(memberCount: number): number {
  return PARTY_BOX.headerH + memberCount * PARTY_BOX.rowH + PARTY_BOX.detailH;
}

export class HudScene extends Phaser.Scene {
  private ctx!: GameContext;
  private dungeon!: DungeonScene;
  private chrome!: Phaser.GameObjects.Graphics;
  private hpBars!: Phaser.GameObjects.Graphics;
  private partyHeader!: Phaser.GameObjects.Text;
  private partyNames: Phaser.GameObjects.Text[] = [];
  private partyStats: Phaser.GameObjects.Text[] = [];
  private hpLabels: Phaser.GameObjects.Text[] = [];
  private leaderDetail!: Phaser.GameObjects.Text;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private objectiveText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private mapText!: Phaser.GameObjects.Text;
  private torchWarning!: Phaser.GameObjects.Text;
  private luckHint!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  /** Scroll-choice card labels on the victory overlay, one per offered scroll. */
  private biomeCards: Phaser.GameObjects.Text[] = [];
  private startOverlay: Phaser.GameObjects.Container | null = null;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private statsOverlay: Phaser.GameObjects.Container | null = null;
  private gearOverlay: Phaser.GameObjects.Container | null = null;
  private lastPartySize = -1;

  constructor() {
    super("Hud");
  }

  create(): void {
    this.dungeon = this.scene.get("Dungeon") as DungeonScene;
    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");
    this.overlay = null;
    this.biomeCards = [];
    this.startOverlay = null;
    this.pauseOverlay = null;
    this.statsOverlay = null;
    this.gearOverlay = null;
    this.lastPartySize = -1;
    this.partyNames = [];
    this.partyStats = [];
    this.hpLabels = [];
    this.logTexts = [];

    // The canvas is render-scaled; zoom the HUD camera so layout stays in 960x540.
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_W / 2, GAME_H / 2);

    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.presentationPalette.accent;
    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;

    this.chrome = this.add.graphics().setDepth(990);
    this.hpBars = this.add.graphics().setDepth(995);
    this.partyHeader = this.add
      .text(18, 14, "", { ...UI_STYLE, fontSize: "11px", color: titleColor, fontStyle: "bold" })
      .setDepth(1000);

    for (let i = 0; i < MAX_PARTY; i++) {
      const y = PARTY_BOX.y + PARTY_BOX.headerH + i * PARTY_BOX.rowH;
      this.partyNames.push(
        this.add.text(18, y, "", { ...UI_STYLE, fontSize: "11px" }).setDepth(1000).setVisible(false),
      );
      this.hpLabels.push(
        this.add
          .text(240, y + 6, "", {
            ...DATA_STYLE,
            fontSize: "9px",
            color: "#ffffff",
            stroke: "#050508",
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(1000)
          .setVisible(false),
      );
      this.partyStats.push(
        this.add
          .text(282, y, "", { ...UI_STYLE, fontSize: "10px", color: "#d9dbe1" })
          .setDepth(1000)
          .setVisible(false),
      );
    }

    this.leaderDetail = this.add
      .text(18, 0, "", { ...DATA_STYLE, fontSize: "9px", color: "#d6bb72" })
      .setDepth(1000);

    this.add
      .text(w - 18, 13, this.dungeon.dungeonDisplayName.toUpperCase(), {
        fontFamily: "Georgia, serif",
        fontSize: "19px",
        color: titleColor,
        stroke: "#050508",
        strokeThickness: 3,
        resolution: RENDER_SCALE,
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.objectiveText = this.add
      .text(w - 18, 38, "", { ...UI_STYLE, fontSize: "10px", color: "#e3c56d" })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.roomText = this.add
      .text(w - 18, 55, "", { ...DATA_STYLE, fontSize: "9px", color: "#9fa5b1" })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.mapText = this.add
      .text(w - 18, 78, "", { ...DATA_STYLE, fontSize: "8px", color: "#69c8d4", align: "right" })
      .setOrigin(1, 0)
      .setDepth(1000);

    // Positioned by drawChrome: the log rides under the party panel so the
    // bottom of the screen — where the party actually fights — stays visible.
    for (let i = 0; i < LOG_LINES; i++) {
      this.logTexts.push(
        this.add
          .text(18, 0, "", {
            ...UI_STYLE,
            fontSize: "11px",
            wordWrap: { width: 570 },
          })
          .setDepth(1000),
      );
    }

    this.torchWarning = this.add
      .text(w / 2, 102, "TORCH GUTTERING", {
        fontFamily: "Georgia, serif",
        fontSize: "16px",
        color: "#ff9c4a",
        stroke: "#050508",
        strokeThickness: 4,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.luckHint = this.add
      .text(w / 2, 0, "", {
        ...UI_STYLE,
        fontSize: "14px",
        color: "#ffd45f",
        stroke: "#050508",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.drawChrome(this.dungeon.party.members.length);

    this.ctx.events.on("gameover", () => this.showOverlay(this.dungeon.gameOverTitle, "#ff6159"));
    this.ctx.events.on("won", () => this.showWinOverlay());
    this.ctx.events.on("levelup", (payload: { name: string; result: LevelUpResult }) =>
      this.levelUpCeremony(payload.name, payload.result),
    );
    // Wordless narration: murmur the newest log line. Throttled so combat-log
    // bursts don't stack a dozen overlapping voices.
    let lastSpokeAt = -Infinity;
    this.ctx.events.on("message", () => {
      const msg = this.ctx.messages[this.ctx.messages.length - 1];
      if (!msg) return;
      if (this.time.now - lastSpokeAt < 350) return;
      lastSpokeAt = this.time.now;
      speak(msg.text, { gain: 0.5 });
    });
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ctx.events.off("gameover");
      this.ctx.events.off("won");
      this.ctx.events.off("levelup");
      this.ctx.events.off("message");
    });

    if (this.dungeon.awaitingStart) this.showStartOverlay(this.dungeon.party.leader.character);
  }

  showStartOverlay(c: Character): void {
    if (this.startOverlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.presentationPalette.accent;
    const accentColor = `#${accent.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.82);
    const box = this.add.graphics();
    box.fillStyle(0x05060a, 0.98).fillRoundedRect(74, 34, w - 148, h - 68, 9);
    box.lineStyle(2, accent, 0.95).strokeRoundedRect(74, 34, w - 148, h - 68, 9);

    const statLines = (["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const)
      .map((stat) => {
        const modifier = c.mod(stat);
        return `${stat}  ${String(c.stats[stat]).padStart(2, " ")}  (${modifier >= 0 ? "+" : ""}${modifier})`;
      })
      .join("\n");
    const equipped = [
      `Weapon  ${c.wieldedWeapon?.name ?? "Unarmed"}`,
      `Armour  ${c.wornArmor?.name ?? "None"}`,
      `Shield  ${c.carriedShield?.name ?? "None"}`,
      `AC      ${c.ac}`,
      `HP      ${c.hp}/${c.maxHp}`,
    ].join("\n");

    this.startOverlay = this.add.container(0, 0, [
      bg,
      box as any,
      this.add
        .text(w / 2, 61, `${c.name.toUpperCase()} THE ${c.title.toUpperCase()}`, {
          fontFamily: "Georgia, serif",
          fontSize: "29px",
          color: "#ffd45f",
          stroke: "#000000",
          strokeThickness: 3,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5),
      this.add
        .text(
          w / 2,
          98,
          `LEVEL ${c.level}  •  ${alignmentLabel(c.alignment).toUpperCase()} ${c.className.toUpperCase()}  •  ${c.ancestry.toUpperCase()}`,
          { ...UI_STYLE, fontSize: "12px", color: "#b8bbc4" },
        )
        .setOrigin(0.5),
      this.add.text(145, 135, "ROLLED STATS", {
        ...UI_STYLE,
        fontSize: "12px",
        color: accentColor,
        fontStyle: "bold",
      }),
      this.add.text(145, 160, statLines, {
        ...DATA_STYLE,
        fontSize: "14px",
        lineSpacing: 7,
      }),
      this.add.text(405, 135, "EQUIPPED GEAR", {
        ...UI_STYLE,
        fontSize: "12px",
        color: accentColor,
        fontStyle: "bold",
      }),
      this.add.text(405, 160, equipped, {
        ...DATA_STYLE,
        fontSize: "13px",
        lineSpacing: 9,
      }),
      this.add.text(145, 340, "HOW TO PLAY", {
        ...UI_STYLE,
        fontSize: "12px",
        color: accentColor,
        fontStyle: "bold",
      }),
      this.add.text(
        145,
        365,
        "A/D or ←/→  MOVE    W/↑/SPACE  JUMP    J/X/CTRL  ATTACK    K  CAST\n" +
          "E  INTERACT    T  TORCH    Q  NEXT SPELL    TAB/1-4  LEADER\n" +
          "C  STATS    I  GEAR    H  HOLD/FOLLOW    ESC  PAUSE\n" +
          "TIP: THE TORCH STAYS WITH WHOEVER LIGHTS IT — SWAP TO A MEMBER (TAB/1-4), PRESS T, THEN SWAP BACK",
        { ...DATA_STYLE, fontSize: "11px", lineSpacing: 5 },
      ),
      this.add
        .text(w / 2, 467, "PRESS A MOVEMENT OR ATTACK KEY TO BEGIN", {
          ...UI_STYLE,
          fontSize: "14px",
          color: "#ffd45f",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    ]).setDepth(2100);
  }

  hideStartOverlay(): void {
    this.startOverlay?.destroy();
    this.startOverlay = null;
  }

  private drawChrome(memberCount: number): void {
    const accent = this.dungeon.presentationPalette.accent;
    const partyH = partyBoxHeight(memberCount);
    const logY = PARTY_BOX.y + partyH + 6;
    this.lastPartySize = memberCount;
    this.chrome.clear();

    this.chrome.fillStyle(0x05060a, 0.76);
    this.chrome.fillRoundedRect(PARTY_BOX.x, PARTY_BOX.y, PARTY_BOX.w, partyH, 5);
    this.chrome.fillRoundedRect(MISSION_BOX.x, MISSION_BOX.y, MISSION_BOX.w, MISSION_BOX.h, 5);
    this.chrome.fillRoundedRect(8, logY, 584, 44, 5);

    this.chrome.fillStyle(accent, 0.8);
    this.chrome.fillRect(PARTY_BOX.x + 5, PARTY_BOX.y, PARTY_BOX.w - 10, 2);
    this.chrome.fillRect(MISSION_BOX.x + 5, MISSION_BOX.y, MISSION_BOX.w - 10, 2);

    this.chrome.lineStyle(1, accent, 0.62);
    this.chrome.strokeRoundedRect(PARTY_BOX.x, PARTY_BOX.y, PARTY_BOX.w, partyH, 5);
    this.chrome.strokeRoundedRect(MISSION_BOX.x, MISSION_BOX.y, MISSION_BOX.w, MISSION_BOX.h, 5);
    this.chrome.strokeRoundedRect(8, logY, 584, 44, 5);

    this.leaderDetail.setY(PARTY_BOX.y + PARTY_BOX.headerH + memberCount * PARTY_BOX.rowH + 2);
    this.logTexts.forEach((text, i) => text.setY(logY + 4 + i * 19));
    this.torchWarning.setY(Math.max(logY + 44, MISSION_BOX.y + MISSION_BOX.h) + 16);
    this.luckHint.setY(this.torchWarning.y + 26);
  }

  /** The talent roll gets a legible card instead of text floating over combat. */
  private levelUpCeremony(name: string, result: LevelUpResult): void {
    const w = GAME_W;
    const accent = this.dungeon.presentationPalette.accent;
    const panel = this.add.graphics();
    panel.fillStyle(0x05060a, 0.94).fillRoundedRect(-320, -35, 640, 78, 7);
    panel.lineStyle(2, accent, 0.9).strokeRoundedRect(-320, -35, 640, 78, 7);
    const banner = this.add.container(w / 2, 190, [
      panel,
      this.add
        .text(0, -17, `${name.toUpperCase()} - LEVEL ${result.newLevel}!`, {
          fontFamily: "Georgia, serif",
          fontSize: "28px",
          color: "#ffd45f",
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5),
      this.add
        .text(0, 17, `+${result.hpGained} HP  |  ${result.talent.entry.text}  |  roll ${result.talent.roll}`, {
          ...UI_STYLE,
          fontSize: "13px",
          color: "#f0e6c8",
        })
        .setOrigin(0.5),
    ]);
    banner.setDepth(1500).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 150,
      delay: 2300,
      duration: 500,
      onComplete: () => banner.destroy(),
    });
    this.dungeon.cameras.main.flash(220, 255, 214, 64);
  }

  showPauseOverlay(): void {
    if (this.pauseOverlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.presentationPalette.accent;
    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.7);
    const box = this.add.graphics();
    box.fillStyle(0x05060a, 0.94);
    box.fillRoundedRect(w / 2 - 240, h / 2 - 180, 480, 360, 8);
    box.lineStyle(2, accent, 0.9);
    box.strokeRoundedRect(w / 2 - 240, h / 2 - 180, 480, 360, 8);

    const title = this.add.text(w / 2, h / 2 - 150, "GAME PAUSED", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#ffd45f",
      stroke: "#000000",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const sub = this.add.text(w / 2, h / 2 - 120, "Press ESC to resume", {
      ...UI_STYLE,
      fontSize: "12px",
      color: "#a0a4b0"
    }).setOrigin(0.5);

    // Save/Load Columns
    const saveHeader = this.add.text(w / 2 - 110, h / 2 - 86, "SAVE GAME", {
      ...UI_STYLE,
      fontSize: "13px",
      color: titleColor,
      fontStyle: "bold"
    }).setOrigin(0.5);

    const loadHeader = this.add.text(w / 2 + 110, h / 2 - 86, "LOAD GAME", {
      ...UI_STYLE,
      fontSize: "13px",
      color: titleColor,
      fontStyle: "bold"
    }).setOrigin(0.5);

    const makeSaveButton = (x: number, y: number, slotId: number) => {
      const btn = this.add.text(x, y, `[ Save Slot ${slotId} ]`, {
        ...UI_STYLE,
        fontSize: "13px",
        color: "#a0a4b0",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => btn.setColor("#ffd45f"))
      .on("pointerout", () => btn.setColor("#a0a4b0"))
      .on("pointerdown", () => {
        this.dungeon.saveToSlot(slotId);
        this.hidePauseOverlay();
        this.dungeon.togglePause();
      });
      return btn;
    };

    const makeLoadButton = (x: number, y: number, slotId: number, name: string) => {
      const hasSaved = SaveRepository.exists(slotId);
      const btnText = hasSaved ? `[ Load ${name} ]` : "[ empty ]";
      const btn = this.add.text(x, y, btnText, {
        ...UI_STYLE,
        fontSize: "13px",
        color: hasSaved ? "#a0a4b0" : "#4a4d55",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);

      if (hasSaved) {
        btn.setInteractive({ useHandCursor: true })
        .on("pointerover", () => btn.setColor("#ffd45f"))
        .on("pointerout", () => btn.setColor("#a0a4b0"))
        .on("pointerdown", () => {
          this.dungeon.loadFromSlot(slotId);
          this.hidePauseOverlay();
          this.dungeon.togglePause();
        });
      }
      return btn;
    };

    const makeDeleteButton = (x: number, y: number, slotId: number) => {
      const hasSaved = SaveRepository.exists(slotId);
      if (!hasSaved) return null;
      const btn = this.add.text(x, y, "[x]", {
        ...UI_STYLE,
        fontSize: "12px",
        color: "#d07070",
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => btn.setColor("#ff8888"))
      .on("pointerout", () => btn.setColor("#d07070"))
      .on("pointerdown", () => {
        if (confirm(`Delete Slot ${slotId === 0 ? "Auto-Save" : slotId}? This cannot be undone.`)) {
          SaveRepository.delete(slotId);
          this.hidePauseOverlay();
          this.showPauseOverlay();
        }
      });
      return btn;
    };

    const save1 = makeSaveButton(w / 2 - 110, h / 2 - 50, 1);
    const save2 = makeSaveButton(w / 2 - 110, h / 2 - 20, 2);
    const save3 = makeSaveButton(w / 2 - 110, h / 2 + 10, 3);

    const load1 = makeLoadButton(w / 2 + 90, h / 2 - 50, 1, "Slot 1");
    const load2 = makeLoadButton(w / 2 + 90, h / 2 - 20, 2, "Slot 2");
    const load3 = makeLoadButton(w / 2 + 90, h / 2 + 10, 3, "Slot 3");
    const loadAuto = makeLoadButton(w / 2 + 90, h / 2 + 40, 0, "Auto-Save");

    const del1 = makeDeleteButton(w / 2 + 185, h / 2 - 50, 1);
    const del2 = makeDeleteButton(w / 2 + 185, h / 2 - 20, 2);
    const del3 = makeDeleteButton(w / 2 + 185, h / 2 + 10, 3);
    const delAuto = makeDeleteButton(w / 2 + 185, h / 2 + 40, 0);

    const exportBtn = this.add.text(w / 2 - 80, h / 2 + 65, "[ Export Saves ]", {
      ...UI_STYLE,
      fontSize: "11px",
      color: "#a0a4b0",
      padding: { x: 5, y: 3 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
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
        alert(`Failed to export saves: ${e.message}`);
      }
    });

    const importBtn = this.add.text(w / 2 + 80, h / 2 + 65, "[ Import Saves ]", {
      ...UI_STYLE,
      fontSize: "11px",
      color: "#a0a4b0",
      padding: { x: 5, y: 3 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
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
            alert(`Successfully imported ${res.count} save slot(s)!`);
            this.hidePauseOverlay();
            this.showPauseOverlay();
          } else {
            alert(`Import failed: ${res.error}`);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Controls
    const helpTitle = this.add.text(w / 2, h / 2 + 100, "CONTROLS QUICK REFERENCE", {
      ...UI_STYLE,
      fontSize: "11px",
      color: titleColor,
      fontStyle: "bold"
    }).setOrigin(0.5);

    const helpText = this.add.text(w / 2, h / 2 + 140,
      "A/D or Arrows : Move Left/Right  |  W/Space : Jump\n" +
      "J / X / Left Ctrl : Melee Attack  |  K : Cast Spell\n" +
      "E : Interact  |  T : Light Torch  |  H : Toggle Hold/Follow\n" +
      "C : Stats  |  I : Gear/Inventory  |  M : Mute Sound\n" +
      "Torch stays with whoever lights it — swap to a member (TAB/1-4), press T, swap back", {
      ...DATA_STYLE,
      fontSize: "9px",
      align: "center",
      lineSpacing: 3
    }).setOrigin(0.5);

    const containerChildren: any[] = [
      bg, box as any, title, sub,
      saveHeader, loadHeader,
      save1, save2, save3,
      load1, load2, load3, loadAuto,
      exportBtn, importBtn,
      helpTitle, helpText
    ];
    if (del1) containerChildren.push(del1);
    if (del2) containerChildren.push(del2);
    if (del3) containerChildren.push(del3);
    if (delAuto) containerChildren.push(delAuto);

    this.pauseOverlay = this.add.container(0, 0, containerChildren).setDepth(2000);
  }

  hidePauseOverlay(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy();
      this.pauseOverlay = null;
    }
  }

  showStatsOverlay(c: any): void {
    if (this.statsOverlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.presentationPalette.accent;
    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.7);
    const box = this.add.graphics();
    box.fillStyle(0x05060a, 0.94);
    box.fillRoundedRect(w / 2 - 220, h / 2 - 180, 440, 360, 8);
    box.lineStyle(2, accent, 0.9);
    box.strokeRoundedRect(w / 2 - 220, h / 2 - 180, 440, 360, 8);

    const title = this.add.text(w / 2, h / 2 - 150, `${c.name.toUpperCase()} - STATS`, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#ffd45f",
      stroke: "#000000",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const sub = this.add.text(w / 2, h / 2 - 120, `Level ${c.level} ${c.ancestry.toUpperCase()} ${c.className.toUpperCase()}`, {
      ...UI_STYLE,
      fontSize: "12px",
      color: "#a0a4b0"
    }).setOrigin(0.5);

    const statsList = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    const statLabels: string[] = [];
    for (const stat of statsList) {
      const val = c.stats[stat];
      const modVal = c.mod(stat);
      const modSign = modVal >= 0 ? `+${modVal}` : `${modVal}`;
      statLabels.push(`${stat}: ${val.toString().padStart(2, " ")} (${modSign})`);
    }

    const col1 = statLabels.slice(0, 3).join("\n\n");
    const col2 = statLabels.slice(3, 6).join("\n\n");

    const statText1 = this.add.text(w / 2 - 140, h / 2 - 80, col1, {
      ...DATA_STYLE,
      fontSize: "14px",
      lineSpacing: 8
    });

    const statText2 = this.add.text(w / 2 + 20, h / 2 - 80, col2, {
      ...DATA_STYLE,
      fontSize: "14px",
      lineSpacing: 8
    });

    const xpVal = c.level >= MAX_LEVEL ? "MAX" : `${c.xp}/${xpToNextLevel(c.level)}`;
    const secondaryDetails = 
      `HP : ${c.hp} / ${c.maxHp}\n` +
      `AC : ${c.ac}\n` +
      `XP : ${xpVal}\n` +
      `VOICE : ${c.voiceRegister.toUpperCase()}`;

    const secondaryText = this.add.text(w / 2 - 140, h / 2 + 40, secondaryDetails, {
      ...DATA_STYLE,
      fontSize: "13px",
      lineSpacing: 4
    });

    const featuresList = c.effects.map((e: any) => `* ${e.name}`).join("\n");
    const featuresTitle = this.add.text(w / 2 + 20, h / 2 + 35, "FEATURES & TALENTS", {
      ...UI_STYLE,
      fontSize: "11px",
      color: titleColor,
      fontStyle: "bold"
    });
    const featuresText = this.add.text(w / 2 + 20, h / 2 + 55, featuresList || "None", {
      ...DATA_STYLE,
      fontSize: "9px",
      wordWrap: { width: 180 },
      lineSpacing: 3
    });

    const footer = this.add.text(w / 2, h / 2 + 150, "Press C to close", {
      ...UI_STYLE,
      fontSize: "11px",
      color: "#808490"
    }).setOrigin(0.5);

    this.statsOverlay = this.add.container(0, 0, [
      bg, box as any, title, sub, statText1, statText2, secondaryText, featuresTitle, featuresText, footer
    ]).setDepth(2000);
  }

  hideStatsOverlay(): void {
    if (this.statsOverlay) {
      this.statsOverlay.destroy();
      this.statsOverlay = null;
    }
  }

  showGearOverlay(c: any, selectedItemId?: string): void {
    if (this.gearOverlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.presentationPalette.accent;
    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.7);
    const box = this.add.graphics();
    box.fillStyle(0x05060a, 0.94);
    box.fillRoundedRect(w / 2 - 220, h / 2 - 180, 440, 360, 8);
    box.lineStyle(2, accent, 0.9);
    box.strokeRoundedRect(w / 2 - 220, h / 2 - 180, 440, 360, 8);

    const title = this.add.text(w / 2, h / 2 - 150, `${c.name.toUpperCase()} - GEAR`, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#ffd45f",
      stroke: "#000000",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const isLeader = c.id === this.dungeon.party.leader.character.id;
    const totalCoins = this.dungeon.ctx.totalCoins;
    const partySize = this.dungeon.party.aliveMembers().length;
    const coinSlots = isLeader ? partyCoinSlots(totalCoins, partySize) : 0;
    const usedSlots = c.inventory.slotsUsed() + coinSlots;

    const sub = this.add.text(w / 2, h / 2 - 120, `Capacity: ${usedSlots} / ${c.inventory.capacity} Slots Used`, {
      ...UI_STYLE,
      fontSize: "12px",
      color: "#a0a4b0"
    }).setOrigin(0.5);

    const armorName = c.wornArmor ? c.wornArmor.name : "None (AC 10)";
    const weaponName = c.wieldedWeapon ? c.wieldedWeapon.name : "None";
    const shieldName = c.carriedShield ? `${c.carriedShield.name}${c.shieldStowed ? " (Stowed)" : ""}` : "None";
    const eqText = 
      `WEAPON : ${weaponName}\n\n` +
      `ARMOR  : ${armorName}\n\n` +
      `SHIELD : ${shieldName}`;

    const equipmentText = this.add.text(w / 2 - 140, h / 2 - 80, eqText, {
      ...DATA_STYLE,
      fontSize: "13px",
      lineSpacing: 4
    });

    const eqTitle = this.add.text(w / 2 - 140, h / 2 - 100, "EQUIPMENT", {
      ...UI_STYLE,
      fontSize: "11px",
      color: titleColor,
      fontStyle: "bold"
    });

    const stacks = c.inventory.all();
    const coinsLine = isLeader && totalCoins > 0
      ? `  ${totalCoins}x Coins (Purse) (${coinSlots === 0 ? "free" : `${coinSlots} slot${coinSlots > 1 ? "s" : ""}`})\n`
      : "";
    const gearList = coinsLine + stacks.map((s: any) => {
      const slots = s.def.slotCost === 0 ? "free" : `${s.def.slotCost} slot${s.def.slotCost > 1 ? "s" : ""}`;
      const equipped = c.wieldedWeapon?.id === s.def.id || c.wornArmor?.id === s.def.id ||
        (c.carriedShield?.id === s.def.id && !c.shieldStowed);
      const cursor = selectedItemId === s.def.id ? ">" : " ";
      return `${cursor} ${s.qty}x ${s.def.name}${equipped ? " [EQUIPPED]" : ""} (${slots})`;
    }).join("\n");

    const invTitle = this.add.text(w / 2 + 20, h / 2 - 100, "INVENTORY", {
      ...UI_STYLE,
      fontSize: "11px",
      color: titleColor,
      fontStyle: "bold"
    });

    const invText = this.add.text(w / 2 + 20, h / 2 - 80, gearList || "Empty", {
      ...DATA_STYLE,
      fontSize: "10px",
      wordWrap: { width: 180 },
      lineSpacing: 6
    });

    const footer = this.add.text(w / 2, h / 2 + 150, "Up/Down select  |  E use/equip  |  D drop  |  R rest  |  I close", {
      ...UI_STYLE,
      fontSize: "11px",
      color: "#808490"
    }).setOrigin(0.5);

    this.gearOverlay = this.add.container(0, 0, [
      bg, box as any, title, sub, eqTitle, equipmentText, invTitle, invText, footer
    ]).setDepth(2000);
  }

  hideGearOverlay(): void {
    if (this.gearOverlay) {
      this.gearOverlay.destroy();
      this.gearOverlay = null;
    }
  }

  private showOverlay(title: string, color: string): void {
    if (this.overlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const parts = this.dungeon.party.members.map((member) => {
      const c = member.character;
      return `${c.name} the ${member.cls.displayName}  |  level ${c.level}  |  ${
        c.dead ? "DEAD" : `${c.hp}/${c.maxHp} HP`
      }`;
    });
    const runIndex = this.registry.get("dungeonIndex");
    const summary = `Reward ${this.dungeon.rewardLabel}  |  Coins ${this.ctx.totalCoins}  |  Kills ${this.ctx.kills}  |  Run seed ${runIndex}`;
    this.overlay = this.add.container(0, 0, [
      this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.9),
      this.add
        .text(w / 2, h / 2 - 104, title, {
          fontFamily: "Georgia, serif",
          fontSize: "34px",
          color,
          stroke: "#000000",
          strokeThickness: 5,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 62, this.dungeon.dungeonDisplayName, {
          ...UI_STYLE,
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          color: "#aaa6a0",
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 6, parts.join("\n"), { ...DATA_STYLE, fontSize: "12px", align: "center", lineSpacing: 5 })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 78, summary, { ...DATA_STYLE, fontSize: "11px", color: "#9fa5b1" })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 112, "Press R to enter the next dungeon", {
          ...UI_STYLE,
          fontSize: "16px",
          color: "#d4b65f",
        })
        .setOrigin(0.5),
    ]);
    this.overlay.setDepth(2000);
  }

  /** Victory overlay: party summary, vault progress, or 1d6 cursed-scroll destination choice. */
  private showWinOverlay(): void {
    if (this.overlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const offer = this.dungeon.biomeOffer;

    const parts = this.dungeon.party.members.map((member) => {
      const c = member.character;
      return `${c.name} the ${member.cls.displayName}  |  level ${c.level}  |  ${
        c.dead ? "DEAD" : `${c.hp}/${c.maxHp} HP`
      }`;
    });
    const runIndex = this.registry.get("dungeonIndex");
    const summary = `Reward ${this.dungeon.rewardLabel}  |  Coins ${this.ctx.totalCoins}  |  Kills ${this.ctx.kills}  |  Run seed ${runIndex}`;

    const mainTitle = offer ? "DESTINATION COMPLETED" : "VAULT CLEARED!";
    const subPrompt = offer ? "CHOOSE YOUR NEXT DESTINATION" : `Vault ${this.dungeon.vaultsCompletedInScroll} of ${this.dungeon.vaultsInScroll} in ${this.dungeon.activeZoneName}`;

    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.92),
      this.add
        .text(w / 2, h / 2 - 156, mainTitle, {
          fontFamily: "Georgia, serif",
          fontSize: "30px",
          color: "#ffd45f",
          stroke: "#000000",
          strokeThickness: 5,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 122, this.dungeon.dungeonDisplayName, {
          ...UI_STYLE,
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          color: "#aaa6a0",
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 86, parts.join("\n"), { ...DATA_STYLE, fontSize: "11px", align: "center", lineSpacing: 4 })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 40, summary, { ...DATA_STYLE, fontSize: "11px", color: "#9fa5b1" })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 12, subPrompt, {
          ...UI_STYLE,
          fontSize: "16px",
          color: "#f0eee9",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 10, "The whole party levels up on descent.", {
          ...DATA_STYLE,
          fontSize: "10px",
          color: "#9fa5b1",
        })
        .setOrigin(0.5),
    ];

    if (offer) {
      // Lay the offered scrolls out in a centered row; up to six fit the 960 view.
      const count = offer.zones.length;
      const cardW = Math.min(150, Math.floor((w - 40) / count));
      const rowW = cardW * count;
      const startX = (w - rowW) / 2 + cardW / 2;
      this.biomeCards = offer.zones.map((zone, index) => {
        const info = zonePackInfo(zone);
        const skins = skinsForZone(zone);
        const biomes = skins.map((s) => `• ${s.displayName}`).join("\n");
        const card = this.add
          .text(
            startX + index * cardW,
            h / 2 + 52,
            `${index + 1}. ${info.scrollName}\n${info.flavor}\n\nBIOMES:\n${biomes}`,
            {
              ...DATA_STYLE,
              fontSize: "9px",
              align: "center",
              lineSpacing: 3,
              wordWrap: { width: cardW - 10 },
            },
          )
          .setOrigin(0.5);
        items.push(card);
        return card;
      });
      this.applyBiomeSelectionTint();

      const prompt = count > 1
        ? "◄ ► or 1-6 to choose   •   R to descend"
        : "R to descend";
      items.push(
        this.add
          .text(w / 2, h / 2 + 128, prompt, {
            ...UI_STYLE,
            fontSize: "15px",
            color: "#d4b65f",
          })
          .setOrigin(0.5),
      );
    } else {
      items.push(
        this.add
          .text(w / 2, h / 2 + 80, "Press R to descend to the next vault", {
            ...UI_STYLE,
            fontSize: "16px",
            color: "#ffd45f",
          })
          .setOrigin(0.5),
      );
    }

    this.overlay = this.add.container(0, 0, items);
    this.overlay.setDepth(2000);
  }

  /** Highlight the currently selected scroll card; dim the rest. */
  private applyBiomeSelectionTint(): void {
    const selected = this.dungeon.biomeSelectionIndex;
    this.biomeCards.forEach((card, index) => {
      card.setColor(index === selected ? "#ffd45f" : "#8a8e98");
    });
  }

  override update(time: number): void {
    if (!this.dungeon.party) return;
    if (this.biomeCards.length) this.applyBiomeSelectionTint();
    const members = this.dungeon.party.members;
    if (members.length !== this.lastPartySize) this.drawChrome(members.length);
    this.hpBars.clear();
    let minTorchMs = Infinity;

    this.partyHeader.setText(`PARTY   COINS ${this.ctx.totalCoins}   KILLS ${this.ctx.kills}`);
    for (let i = 0; i < MAX_PARTY; i++) {
      const member = members[i];
      const nameText = this.partyNames[i]!;
      const statText = this.partyStats[i]!;
      const hpText = this.hpLabels[i]!;
      if (!member) {
        nameText.setVisible(false);
        statText.setVisible(false);
        hpText.setVisible(false);
        continue;
      }

      const c = member.character;
      const isLeader = this.dungeon.party.leaderIndex === i;
      const xp = c.level >= MAX_LEVEL ? "MAX" : `${c.xp}/${xpToNextLevel(c.level)}`;
      const y = PARTY_BOX.y + PARTY_BOX.headerH + i * PARTY_BOX.rowH;
      const ratio = c.dead ? 0 : Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1);
      const hpColor = ratio > 0.5 ? 0x4fb878 : ratio > 0.25 ? 0xe0a34b : 0xda5555;
      let torch = "";
      if (member.torchLit && member.torchTimerId) {
        const remaining = this.ctx.engine.clock.timerRemaining(member.torchTimerId);
        minTorchMs = Math.min(minTorchMs, remaining);
        torch = ` T${Math.ceil(remaining / 1000)}s`;
      }

      nameText
        .setVisible(true)
        .setText(`${isLeader ? ">" : " "} ${i + 1} ${c.name} - ${member.cls.displayName} L${c.level}`)
        .setColor(c.dead ? "#7e7e86" : isLeader ? "#ffffff" : "#c6c8ce");
      statText
        .setVisible(true)
        .setText(`AC${c.ac}  XP${xp}  G${c.inventory.slotsUsed()}/${c.inventory.capacity}${torch}`)
        .setColor(c.dead ? "#70727a" : "#d9dbe1");
      hpText.setVisible(true).setText(c.dead ? "DEAD" : c.dying ? `DOWN ${c.dying.roundsRemaining}` : `${c.hp}/${c.maxHp}`);

      this.hpBars.fillStyle(0x1f2128, 1).fillRoundedRect(203, y + 3, 74, 12, 3);
      this.hpBars.fillStyle(hpColor, 1).fillRoundedRect(205, y + 5, 70 * ratio, 8, 2);
      if (isLeader && !c.dead) {
        this.hpBars.lineStyle(1, this.dungeon.presentationPalette.accent, 0.9);
        this.hpBars.strokeRoundedRect(202, y + 2, 76, 14, 3);
      }
    }

    const leader = this.dungeon.party.leader;
    const leaderDetails: string[] = [];
    if (leader.character.knownSpells.length > 0 && !leader.character.dead) {
      const slot = leader.character.knownSpells[leader.spellIndex % leader.character.knownSpells.length]!;
      leaderDetails.push(`K CAST ${spell(slot.spellId).name}${slot.status === "lost" ? " [LOST]" : ""}`);
    }
    if (leader.character.luckToken) leaderDetails.push("L LUCK READY");
    if (leader.mode === "hold") leaderDetails.push("HOLDING");
    this.leaderDetail.setText(leaderDetails.length > 0 ? leaderDetails.join("   |   ") : "Leader ready");

    const objective = this.dungeon.hasCrown
      ? "REWARD CLAIMED - REACH THE EXIT"
      : `VAULT REWARD: ${this.dungeon.rewardLabel.toUpperCase()}`;
    const survival = this.dungeon.survivalClock;
    const survivalSeconds = survival ? Math.ceil(survival.remainingMs / 1000) : 0;
    const danger = this.dungeon.dangerTrack;
    const dangerIcons = danger
      ? `${danger.icon.repeat(danger.count)}${"·".repeat(danger.maximum - danger.count)}`
      : "";
    const deadline = survival
      ? `${survival.label} ${dangerIcons} ${Math.floor(survivalSeconds / 60)}:${String(survivalSeconds % 60).padStart(2, "0")}`
      : "";
    this.objectiveText.setText(deadline ? `${deadline}  |  ${objective}` : objective);
    this.objectiveText.setColor(this.dungeon.hasCrown ? "#72d887" : "#e3c56d");

    const region = roomAtTolerant(
      this.dungeon.activeDungeon.regions,
      Math.floor(leader.x / TILE),
      Math.floor(leader.y / TILE),
    );
    if (region) {
      this.roomText.setText(
        region.id === this.dungeon.safeZoneRoomId ? `${region.hud}  |  SAFE ZONE` : region.hud,
      );
    }
    this.mapText
      .setVisible(this.dungeon.activeDungeon.connectors !== undefined)
      .setText(this.dungeon.compactMap);

    if (minTorchMs < 30_000) {
      this.torchWarning.setVisible(true).setAlpha(0.6 + 0.4 * Math.sin(time / 120));
      this.torchWarning.setColor(minTorchMs < 12_000 ? "#ff5a45" : "#ff9c4a");
    } else {
      this.torchWarning.setVisible(false);
    }

    const luckWindow = this.dungeon.luckWindow;
    if (luckWindow) {
      const secondsLeft = Math.max(0, (luckWindow.expiresAt - time) / 1000);
      this.luckHint
        .setVisible(true)
        .setText(`L - SPEND LUCK: ${luckWindow.label.toUpperCase()}  ${secondsLeft.toFixed(1)}s`)
        .setAlpha(0.65 + 0.35 * Math.sin(time / 90));
    } else {
      this.luckHint.setVisible(false);
    }

    const msgs = this.ctx.messages.slice(-LOG_LINES);
    this.logTexts.forEach((text, i) => {
      const msg = msgs[i];
      if (msg) text.setText(msg.text).setColor(msg.color);
      else text.setText("");
    });
  }
}
