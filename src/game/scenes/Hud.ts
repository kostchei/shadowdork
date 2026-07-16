/** Readable, atmospheric HUD overlay for party state and run objectives. */

import Phaser from "phaser";
import { spell } from "../../data";
import type { GameContext } from "../context";
import type { DungeonScene } from "./Dungeon";

const TEXT_STYLE = {
  fontFamily: "Consolas, monospace",
  fontSize: "13px",
  color: "#e2e0dc",
  stroke: "#050508",
  strokeThickness: 3,
} as const;

export class HudScene extends Phaser.Scene {
  private ctx!: GameContext;
  private dungeon!: DungeonScene;
  private partyText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private hpBars!: Phaser.GameObjects.Graphics;

  constructor() {
    super("Hud");
  }

  create(): void {
    this.dungeon = this.scene.get("Dungeon") as DungeonScene;
    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");
    this.overlay = null;

    const w = this.scale.width;
    const h = this.scale.height;
    const chrome = this.add.graphics().setDepth(990);
    chrome.fillStyle(0x05060a, 0.82);
    chrome.fillRoundedRect(8, 8, 470, 118, 5);
    chrome.fillRoundedRect(w - 404, 8, 396, 82, 5);
    chrome.fillRoundedRect(8, h - 78, 610, 70, 5);
    chrome.fillRoundedRect(w - 332, h - 72, 324, 64, 5);
    chrome.lineStyle(1, this.dungeon.activeDungeon.theme.accent, 0.52);
    chrome.strokeRoundedRect(8, 8, 470, 118, 5);
    chrome.strokeRoundedRect(w - 404, 8, 396, 82, 5);
    chrome.strokeRoundedRect(8, h - 78, 610, 70, 5);
    chrome.strokeRoundedRect(w - 332, h - 72, 324, 64, 5);

    this.hpBars = this.add.graphics().setDepth(995);
    this.partyText = this.add.text(18, 15, "", TEXT_STYLE).setDepth(1000);
    this.logText = this.add
      .text(18, h - 69, "", {
        ...TEXT_STYLE,
        fontSize: "12px",
        color: "#c8c5c0",
        lineSpacing: 2,
        wordWrap: { width: 590 },
      })
      .setDepth(1000);

    const titleColor = `#${this.dungeon.activeDungeon.theme.accent.toString(16).padStart(6, "0")}`;
    this.add
      .text(w - 22, 16, this.dungeon.activeDungeon.name.toUpperCase(), {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: titleColor,
        stroke: "#050508",
        strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.add
      .text(w - 22, 43, this.dungeon.activeDungeon.tagline, {
        ...TEXT_STYLE,
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#aaa6a0",
        fontStyle: "italic",
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.objectiveText = this.add
      .text(w - 22, 64, "", { ...TEXT_STYLE, fontSize: "11px", color: "#d8ba67" })
      .setOrigin(1, 0)
      .setDepth(1000);

    this.add
      .text(
        w - 322,
        h - 62,
        "MOVE  A/D or arrows    JUMP  W/Space\nFIGHT J    CAST K/Q    USE E    TORCH T\nPARTY Tab/1-4    FOLLOW/HOLD H",
        { ...TEXT_STYLE, fontSize: "10px", color: "#8e929c", lineSpacing: 3 },
      )
      .setDepth(1000);

    this.ctx.events.on("gameover", () => this.showOverlay("THE DARK CLAIMS YOU", "#ff6159"));
    this.ctx.events.on("won", () => this.showOverlay("THE CROWN IS YOURS", "#ffd45f"));
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ctx.events.off("gameover");
      this.ctx.events.off("won");
    });
  }

  private showOverlay(title: string, color: string): void {
    if (this.overlay) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const parts = this.dungeon.party.members.map((member) => {
      const c = member.character;
      return `${c.name} the ${member.cls.displayName}  |  level ${c.level}  |  ${
        c.dead ? "DEAD" : `${c.hp}/${c.maxHp} HP`
      }`;
    });
    this.overlay = this.add.container(0, 0, [
      this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.9),
      this.add
        .text(w / 2, h / 2 - 94, title, {
          fontFamily: "Georgia, serif",
          fontSize: "34px",
          color,
          stroke: "#000000",
          strokeThickness: 5,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 52, this.dungeon.activeDungeon.name, {
          ...TEXT_STYLE,
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          color: "#aaa6a0",
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 20, parts.join("\n"), {
          ...TEXT_STYLE,
          align: "center",
          lineSpacing: 5,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 104, "Press R to enter the next dungeon", {
          ...TEXT_STYLE,
          fontSize: "16px",
          color: "#d4b65f",
        })
        .setOrigin(0.5),
    ]);
    this.overlay.setDepth(2000);
  }

  override update(): void {
    if (!this.dungeon.party) return;
    const members = this.dungeon.party.members;
    const lines: string[] = [];
    this.hpBars.clear();

    members.forEach((member, i) => {
      const c = member.character;
      const isLeader = this.dungeon.party.leaderIndex === i;
      const status = c.dead ? "DEAD" : c.dying ? `DYING ${c.dying.roundsRemaining}` : `${c.hp}/${c.maxHp} HP`;
      let line = `${isLeader ? ">" : " "} ${i + 1} ${c.name.padEnd(7)} ${member.cls.displayName.padEnd(7)} L${c.level}  ${status.padEnd(9)}`;
      if (member.torchLit && member.torchTimerId) {
        const remaining = this.ctx.engine.clock.timerRemaining(member.torchTimerId);
        line += `  TORCH ${Math.ceil(remaining / 1000)}s`;
      }
      if (c.knownSpells.length > 0 && !c.dead) {
        const slot = c.knownSpells[member.spellIndex % c.knownSpells.length]!;
        line += `  ${spell(slot.spellId).name}${slot.status === "lost" ? " [LOST]" : ""}`;
      }
      lines.push(line);

      const ratio = c.dead ? 0 : Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1);
      const barX = 354;
      const barY = 19 + i * 18;
      this.hpBars.fillStyle(0x22242b, 0.95).fillRect(barX, barY, 106, 6);
      this.hpBars
        .fillStyle(ratio > 0.5 ? 0x4aa36b : ratio > 0.25 ? 0xd19a45 : 0xc94e4e, 1)
        .fillRect(barX, barY, 106 * ratio, 6);
    });
    lines.push(`  COINS ${String(this.ctx.totalCoins).padStart(4)}    GEAR ${members.reduce((n, m) => n + m.character.inventory.slotsUsed(), 0)} slots`);
    this.partyText.setText(lines.join("\n"));

    this.objectiveText.setText(
      this.dungeon.hasCrown ? "CROWN SECURED - REACH THE EXIT" : this.dungeon.activeDungeon.objective.toUpperCase(),
    );
    this.objectiveText.setColor(this.dungeon.hasCrown ? "#72d887" : "#d8ba67");

    const msgs = this.ctx.messages.slice(-3);
    this.logText.setText(msgs.map((message) => `- ${message.text}`).join("\n"));
  }
}
