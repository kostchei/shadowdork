/** Compact, high-contrast HUD that keeps the dungeon visible. */

import Phaser from "phaser";
import { spell } from "../../data";
import { RENDER_SCALE, GAME_H, GAME_W } from "../display";
import { MAX_LEVEL, xpToNextLevel, type LevelUpResult } from "../../engine";
import type { GameContext } from "../context";
import { ROOM_BANDS } from "../level/dungeons";
import { TILE } from "../textures";
import type { DungeonScene } from "./Dungeon";

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

const ROOM_LABELS = ["THE GATE", "THE TEST", "THE SETBACK", "THE CLIMAX", "THE REWARD", "SANCTUARY"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
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
  private torchWarning!: Phaser.GameObjects.Text;
  private luckHint!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
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
    const accent = this.dungeon.activeDungeon.theme.accent;
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
      .text(w - 18, 13, this.dungeon.activeDungeon.name.toUpperCase(), {
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

    this.ctx.events.on("gameover", () => this.showOverlay("THE DARK CLAIMS YOU", "#ff6159"));
    this.ctx.events.on("won", () => this.showOverlay("THE CROWN IS YOURS", "#ffd45f"));
    this.ctx.events.on("levelup", (payload: { name: string; result: LevelUpResult }) =>
      this.levelUpCeremony(payload.name, payload.result),
    );
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ctx.events.off("gameover");
      this.ctx.events.off("won");
      this.ctx.events.off("levelup");
    });
  }

  private drawChrome(memberCount: number): void {
    const accent = this.dungeon.activeDungeon.theme.accent;
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
    const accent = this.dungeon.activeDungeon.theme.accent;
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
    const accent = this.dungeon.activeDungeon.theme.accent;
    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.7);
    const box = this.add.graphics();
    box.fillStyle(0x05060a, 0.94);
    box.fillRoundedRect(w / 2 - 200, h / 2 - 120, 400, 250, 8);
    box.lineStyle(2, accent, 0.9);
    box.strokeRoundedRect(w / 2 - 200, h / 2 - 120, 400, 250, 8);

    const title = this.add.text(w / 2, h / 2 - 80, "GAME PAUSED", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#ffd45f",
      stroke: "#000000",
      strokeThickness: 3,
      resolution: RENDER_SCALE,
    }).setOrigin(0.5);

    const sub = this.add.text(w / 2, h / 2 - 40, "Press ESC to resume", {
      ...UI_STYLE,
      fontSize: "13px",
      color: "#a0a4b0"
    }).setOrigin(0.5);

    const helpTitle = this.add.text(w / 2, h / 2, "CONTROLS QUICK REFERENCE", {
      ...UI_STYLE,
      fontSize: "12px",
      color: titleColor,
      fontStyle: "bold"
    }).setOrigin(0.5);

    const helpText = this.add.text(w / 2, h / 2 + 62,
      "A/D or Arrows : Move Left/Right\n" +
      "W/Space : Jump\n" +
      "J / X / Left Ctrl : Melee Attack\n" +
      "K : Cast Spell  |  Q : Cycle Spells\n" +
      "E : Interact (Rescue / Rest / Exit)\n" +
      "T : Light Torch  |  H : Toggle Hold/Follow\n" +
      "L : Spend Luck (when prompted)  |  Tab/1-4 : Swap Leader\n" +
      "C : Character Stats  |  I : Gear/Inventory", {
      ...DATA_STYLE,
      fontSize: "10px",
      align: "center",
      lineSpacing: 4
    }).setOrigin(0.5);

    this.pauseOverlay = this.add.container(0, 0, [bg, box as any, title, sub, helpTitle, helpText]).setDepth(2000);
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
    const accent = this.dungeon.activeDungeon.theme.accent;
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
      `HP : ${c.hp} / ${c.maxHp}\n\n` +
      `AC : ${c.ac}\n\n` +
      `XP : ${xpVal}`;

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

  showGearOverlay(c: any): void {
    if (this.gearOverlay) return;
    const w = GAME_W;
    const h = GAME_H;
    const accent = this.dungeon.activeDungeon.theme.accent;
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

    const sub = this.add.text(w / 2, h / 2 - 120, `Capacity: ${c.inventory.slotsUsed()} / ${c.inventory.capacity} Slots Used`, {
      ...UI_STYLE,
      fontSize: "12px",
      color: "#a0a4b0"
    }).setOrigin(0.5);

    const armorName = c.wornArmor ? c.wornArmor.name : "None (AC 10)";
    const shieldName = c.carriedShield ? `${c.carriedShield.name}${c.shieldStowed ? " (Stowed)" : ""}` : "None";
    const eqText = 
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
    const gearList = stacks.map((s: any) => {
      const slots = s.def.slotCost === 0 ? "free" : `${s.def.slotCost} slot${s.def.slotCost > 1 ? "s" : ""}`;
      return `* ${s.qty}x ${s.def.name} (${slots})`;
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

    const footer = this.add.text(w / 2, h / 2 + 150, "Press I to close", {
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
    const summary = `Coins ${this.ctx.totalCoins}  |  Kills ${this.ctx.kills}  |  Run seed ${runIndex}`;
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
        .text(w / 2, h / 2 - 62, this.dungeon.activeDungeon.name, {
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

  override update(time: number): void {
    if (!this.dungeon.party) return;
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
        this.hpBars.lineStyle(1, this.dungeon.activeDungeon.theme.accent, 0.9);
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

    this.objectiveText.setText(
      this.dungeon.hasCrown ? "CROWN SECURED - REACH THE EXIT" : this.dungeon.activeDungeon.objective.toUpperCase(),
    );
    this.objectiveText.setColor(this.dungeon.hasCrown ? "#72d887" : "#e3c56d");

    const leaderX = leader.x / TILE;
    const band = ROOM_BANDS.find((roomBand) => leaderX >= roomBand.x1 && leaderX <= roomBand.x2 + 1);
    if (band) this.roomText.setText(`ROOM ${ROMAN[band.room - 1]}  |  ${ROOM_LABELS[band.room - 1]}`);

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
