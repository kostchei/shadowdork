/** Readable, atmospheric HUD overlay for party state and run objectives. */

import Phaser from "phaser";
import { spell } from "../../data";
import { xpToNextLevel, MAX_LEVEL, type LevelUpResult } from "../../engine";
import type { GameContext } from "../context";
import { ROOM_BANDS } from "../level/dungeons";
import { TILE } from "../textures";
import type { DungeonScene } from "./Dungeon";

const TEXT_STYLE = {
  fontFamily: "Consolas, monospace",
  fontSize: "13px",
  color: "#e2e0dc",
  stroke: "#050508",
  strokeThickness: 3,
} as const;

const ROOM_LABELS = ["THE GATE", "THE TEST", "THE SETBACK", "THE CLIMAX", "THE REWARD", "SANCTUARY"];
const ROMAN = ["I", "II", "III", "IV", "V", "•"];

const PARTY_BOX = { x: 8, y: 8, w: 560, h: 158 };
const LOG_LINES = 3;

export class HudScene extends Phaser.Scene {
  private ctx!: GameContext;
  private dungeon!: DungeonScene;
  private partyText!: Phaser.GameObjects.Text;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private objectiveText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private torchWarning!: Phaser.GameObjects.Text;
  private luckHint!: Phaser.GameObjects.Text;
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
    this.logTexts = [];

    const w = this.scale.width;
    const h = this.scale.height;
    const accent = this.dungeon.activeDungeon.theme.accent;
    const chrome = this.add.graphics().setDepth(990);
    chrome.fillStyle(0x05060a, 0.82);
    chrome.fillRoundedRect(PARTY_BOX.x, PARTY_BOX.y, PARTY_BOX.w, PARTY_BOX.h, 5);
    chrome.fillRoundedRect(w - 404, 8, 396, 96, 5);
    chrome.fillRoundedRect(8, h - 78, 610, 70, 5);
    chrome.fillRoundedRect(w - 332, h - 72, 324, 64, 5);
    chrome.lineStyle(1, accent, 0.52);
    chrome.strokeRoundedRect(PARTY_BOX.x, PARTY_BOX.y, PARTY_BOX.w, PARTY_BOX.h, 5);
    chrome.strokeRoundedRect(w - 404, 8, 396, 96, 5);
    chrome.strokeRoundedRect(8, h - 78, 610, 70, 5);
    chrome.strokeRoundedRect(w - 332, h - 72, 324, 64, 5);

    this.hpBars = this.add.graphics().setDepth(995);
    this.partyText = this.add.text(18, 15, "", { ...TEXT_STYLE, lineSpacing: 3 }).setDepth(1000);
    for (let i = 0; i < LOG_LINES; i++) {
      this.logTexts.push(
        this.add
          .text(18, h - 69 + i * 20, "", {
            ...TEXT_STYLE,
            fontSize: "12px",
            wordWrap: { width: 590 },
          })
          .setDepth(1000),
      );
    }

    const titleColor = `#${accent.toString(16).padStart(6, "0")}`;
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
    this.roomText = this.add
      .text(w - 22, 82, "", { ...TEXT_STYLE, fontSize: "11px", color: "#8e929c" })
      .setOrigin(1, 0)
      .setDepth(1000);

    this.add
      .text(
        w - 322,
        h - 64,
        "MOVE A/D  JUMP W/Space  FIGHT J  CAST K/Q\nUSE E  TORCH T  LUCK L  PARTY Tab/1-4  HOLD H",
        { ...TEXT_STYLE, fontSize: "10px", color: "#8e929c", lineSpacing: 4 },
      )
      .setDepth(1000);

    this.torchWarning = this.add
      .text(w / 2, 118, "THE TORCH IS GUTTERING", {
        fontFamily: "Georgia, serif",
        fontSize: "17px",
        color: "#ff9c4a",
        stroke: "#050508",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.luckHint = this.add
      .text(w / 2, h - 104, "", {
        ...TEXT_STYLE,
        fontSize: "15px",
        color: "#ffd040",
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

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

  /** The slot-machine moment, actually staged: banner + talent, party-wide. */
  private levelUpCeremony(name: string, result: LevelUpResult): void {
    const w = this.scale.width;
    const banner = this.add.container(w / 2, 190, [
      this.add
        .text(0, 0, `${name.toUpperCase()} — LEVEL ${result.newLevel}!`, {
          fontFamily: "Georgia, serif",
          fontSize: "30px",
          color: "#ffd040",
          stroke: "#050508",
          strokeThickness: 5,
        })
        .setOrigin(0.5),
      this.add
        .text(0, 30, `+${result.hpGained} HP   ·   ${result.talent.entry.text} (rolled ${result.talent.roll})`, {
          ...TEXT_STYLE,
          fontSize: "14px",
          color: "#f0e6c8",
        })
        .setOrigin(0.5),
    ]);
    banner.setDepth(1500).setScale(0.4).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: "Back.out",
    });
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
    const runIndex = this.registry.get("dungeonIndex");
    const summary = `Coins banked ${this.ctx.totalCoins}   ·   Kills ${this.ctx.kills}   ·   Run seed ${runIndex}`;
    this.overlay = this.add.container(0, 0, [
      this.add.rectangle(w / 2, h / 2, w, h, 0x020205, 0.9),
      this.add
        .text(w / 2, h / 2 - 104, title, {
          fontFamily: "Georgia, serif",
          fontSize: "34px",
          color,
          stroke: "#000000",
          strokeThickness: 5,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 - 62, this.dungeon.activeDungeon.name, {
          ...TEXT_STYLE,
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          color: "#aaa6a0",
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 6, parts.join("\n"), {
          ...TEXT_STYLE,
          align: "center",
          lineSpacing: 5,
        })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 78, summary, { ...TEXT_STYLE, fontSize: "12px", color: "#8e929c" })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 112, "Press R to enter the next dungeon", {
          ...TEXT_STYLE,
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
    const lines: string[] = [];
    this.hpBars.clear();
    let minTorchMs = Infinity;

    members.forEach((member, i) => {
      const c = member.character;
      const isLeader = this.dungeon.party.leaderIndex === i;
      const status = c.dead ? "DEAD" : c.dying ? `DYING ${c.dying.roundsRemaining}` : `HP ${c.hp}/${c.maxHp}`;
      const xp = c.level >= MAX_LEVEL ? "XP MAX" : `XP ${c.xp}/${xpToNextLevel(c.level)}`;
      const luck = c.luckToken ? "  ★" : "";
      lines.push(
        `${isLeader ? ">" : " "} ${i + 1} ${c.name.padEnd(7)} ${member.cls.displayName.padEnd(7)} L${c.level}  ${status.padEnd(11)} AC ${String(c.ac).padEnd(2)}${luck}`,
      );

      const details: string[] = [`    ${xp.padEnd(9)} GEAR ${c.inventory.slotsUsed()}/${c.inventory.capacity}`];
      if (member.torchLit && member.torchTimerId) {
        const remaining = this.ctx.engine.clock.timerRemaining(member.torchTimerId);
        minTorchMs = Math.min(minTorchMs, remaining);
        details.push(`TORCH ${Math.ceil(remaining / 1000)}s`);
      }
      if (c.knownSpells.length > 0 && !c.dead) {
        const slot = c.knownSpells[member.spellIndex % c.knownSpells.length]!;
        details.push(`${spell(slot.spellId).name}${slot.status === "lost" ? " [LOST]" : ""}`);
      }
      lines.push(details.join("  "));

      const ratio = c.dead ? 0 : Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1);
      const barX = PARTY_BOX.x + PARTY_BOX.w - 122;
      const barY = 21 + i * 33;
      this.hpBars.fillStyle(0x22242b, 0.95).fillRect(barX, barY, 106, 6);
      this.hpBars
        .fillStyle(ratio > 0.5 ? 0x4aa36b : ratio > 0.25 ? 0xd19a45 : 0xc94e4e, 1)
        .fillRect(barX, barY, 106 * ratio, 6);
    });
    lines.push(`  COINS ${String(this.ctx.totalCoins).padStart(4)}`);
    this.partyText.setText(lines.join("\n"));

    this.objectiveText.setText(
      this.dungeon.hasCrown ? "CROWN SECURED - REACH THE EXIT" : this.dungeon.activeDungeon.objective.toUpperCase(),
    );
    this.objectiveText.setColor(this.dungeon.hasCrown ? "#72d887" : "#d8ba67");

    // Which room is the leader in?
    const leaderX = this.dungeon.party.leader.x / TILE;
    const band = ROOM_BANDS.find((b) => leaderX >= b.x1 && leaderX <= b.x2 + 1);
    if (band) {
      this.roomText.setText(`ROOM ${ROMAN[band.room - 1]} — ${ROOM_LABELS[band.room - 1]}`);
    }

    // Low-torch alarm: the core resource deserves drama.
    if (minTorchMs < 30_000) {
      this.torchWarning.setVisible(true).setAlpha(0.55 + 0.45 * Math.sin(time / 120));
      this.torchWarning.setColor(minTorchMs < 12_000 ? "#ff5a45" : "#ff9c4a");
    } else {
      this.torchWarning.setVisible(false);
    }

    // Luck reroll hint.
    const luckWindow = this.dungeon.luckWindow;
    if (luckWindow) {
      const secondsLeft = Math.max(0, (luckWindow.expiresAt - time) / 1000);
      this.luckHint
        .setVisible(true)
        .setText(`L — spend luck: ${luckWindow.label} (${secondsLeft.toFixed(1)}s)`)
        .setAlpha(0.6 + 0.4 * Math.sin(time / 90));
    } else {
      this.luckHint.setVisible(false);
    }

    const msgs = this.ctx.messages.slice(-LOG_LINES);
    this.logTexts.forEach((text, i) => {
      const msg = msgs[i];
      if (msg) text.setText(`- ${msg.text}`).setColor(msg.color);
      else text.setText("");
    });
  }
}
