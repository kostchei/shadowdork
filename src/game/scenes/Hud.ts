/**
 * HUD overlay scene: party panel, torch bar, message log, level-up flashes,
 * win/lose overlays. Reads state from the Dungeon scene every frame.
 */

import Phaser from "phaser";
import { spell } from "../../data";
import type { GameContext } from "../context";
import type { DungeonScene } from "./Dungeon";

const PANEL_STYLE = {
  fontFamily: "monospace",
  fontSize: "13px",
  color: "#d0d0d8",
  stroke: "#000000",
  strokeThickness: 3,
} as const;

export class HudScene extends Phaser.Scene {
  private ctx!: GameContext;
  private dungeon!: DungeonScene;
  private partyText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("Hud");
  }

  create(): void {
    this.dungeon = this.scene.get("Dungeon") as DungeonScene;
    this.ctx = this.registry.get("ctx") as GameContext;
    if (!this.ctx) throw new Error("GameContext missing from registry");
    this.overlay = null;

    this.partyText = this.add.text(10, 8, "", PANEL_STYLE).setDepth(1000);
    this.logText = this.add.text(10, this.scale.height - 110, "", {
      ...PANEL_STYLE,
      fontSize: "12px",
      wordWrap: { width: this.scale.width - 220 },
    }).setDepth(1000);
    this.helpText = this.add
      .text(
        this.scale.width - 10,
        this.scale.height - 8,
        "A/D move · W jump · J attack · K cast · Q spell · T torch · E interact · H hold · Tab/1-4 swap",
        { ...PANEL_STYLE, fontSize: "11px", color: "#7a7a8a" },
      )
      .setOrigin(1, 1)
      .setDepth(1000);

    this.ctx.events.on("gameover", () => this.showOverlay("THE DARK CLAIMS YOU", "#ff4040"));
    this.ctx.events.on("won", () => this.showOverlay("YOU ESCAPE WITH THE CROWN", "#ffd040"));
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ctx.events.off("gameover");
      this.ctx.events.off("won");
    });
  }

  private showOverlay(title: string, color: string): void {
    if (this.overlay) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const parts = this.dungeon.party.members.map(
      (m) =>
        `${m.character.name} the ${m.cls.displayName} — level ${m.character.level}, ${
          m.character.dead ? "DEAD" : `${m.character.hp}/${m.character.maxHp} HP`
        }`,
    );
    this.overlay = this.add.container(0, 0, [
      this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75),
      this.add
        .text(w / 2, h / 2 - 60, title, { ...PANEL_STYLE, fontSize: "32px", color })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 10, parts.join("\n"), { ...PANEL_STYLE, align: "center" })
        .setOrigin(0.5),
      this.add
        .text(w / 2, h / 2 + 80, "Press R to descend again", {
          ...PANEL_STYLE,
          fontSize: "16px",
          color: "#9a9aaa",
        })
        .setOrigin(0.5),
    ]);
    this.overlay.setDepth(2000);
  }

  override update(): void {
    if (!this.dungeon.party) return;
    const lines: string[] = [];
    const members = this.dungeon.party.members;
    members.forEach((m, i) => {
      const c = m.character;
      const isLeader = this.dungeon.party.leaderIndex === i;
      let status: string;
      if (c.dead) status = "DEAD";
      else if (c.dying) status = `DYING ${c.dying.roundsRemaining}!`;
      else status = `${c.hp}/${c.maxHp} HP`;
      let line = `${isLeader ? "▶" : " "} ${i + 1}. ${c.name} [${m.cls.displayName}] L${c.level} ${status}  XP ${c.xp}/${c.level * 10}`;
      if (m.torchLit && m.torchTimerId) {
        const remaining = this.ctx.engine.clock.timerRemaining(m.torchTimerId);
        line += `  🔥${Math.ceil(remaining / 1000)}s`;
      }
      if (c.knownSpells.length > 0 && !c.dead) {
        const slot = c.knownSpells[m.spellIndex % c.knownSpells.length]!;
        line += `  ✦${spell(slot.spellId).name}${slot.status === "lost" ? " (LOST)" : ""}`;
      }
      const slots = c.inventory;
      line += `  ⬛${slots.slotsUsed()}/${slots.capacity}`;
      lines.push(line);
    });
    lines.push(`  💰 ${this.ctx.totalCoins} coins banked (100 = 1 XP)`);
    this.partyText.setText(lines.join("\n"));

    const msgs = this.ctx.messages.slice(-6);
    this.logText.setText(msgs.map((m) => m.text).join("\n"));
    this.logText.setY(this.scale.height - 24 - this.logText.height);
  }
}
