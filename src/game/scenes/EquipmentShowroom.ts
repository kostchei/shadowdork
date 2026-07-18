/** Developer-only equipment matrix: open with ?showroom=equipment. */

import Phaser from "phaser";
import { GAME_H, GAME_W, RENDER_SCALE } from "../display";
import { ensureCharacterAppearance } from "../textures";
import type { CharacterAppearance } from "../entities/appearance";

const weapons: readonly CharacterAppearance[] = [
  { className: "fighter", armor: "chain", weapon: "spear", shield: "none" },
  { className: "fighter", armor: "chain", weapon: "longsword", shield: "none" },
  { className: "thief", armor: "leather", weapon: "dagger", shield: "none" },
  { className: "priest", armor: "chain", weapon: "mace", shield: "none" },
  { className: "wizard", armor: "unarmored", weapon: "staff", shield: "none" },
  { className: "fighter", armor: "chain", weapon: "javelin", shield: "none" },
];

const armors: readonly CharacterAppearance[] = [
  { className: "thief", armor: "leather", weapon: "dagger", shield: "none" },
  { className: "fighter", armor: "chain", weapon: "spear", shield: "none" },
  { className: "fighter", armor: "plate", weapon: "longsword", shield: "none" },
  { className: "thief", armor: "mithral", weapon: "dagger", shield: "none" },
  { className: "wizard", armor: "unarmored", weapon: "staff", shield: "none" },
  { className: "priest", armor: "chain", weapon: "mace", shield: "readied" },
];

const textStyle = {
  fontFamily: "Consolas, monospace",
  fontSize: "11px",
  color: "#d9dce4",
  resolution: RENDER_SCALE,
} as const;

export class EquipmentShowroomScene extends Phaser.Scene {
  constructor() {
    super("EquipmentShowroom");
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_W / 2, GAME_H / 2);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x090b11);
    this.add.text(GAME_W / 2, 20, "EQUIPMENT APPEARANCE SHOWROOM", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f1d57a",
      resolution: RENDER_SCALE,
    }).setOrigin(0.5, 0);
    this.add.text(28, 60, "WEAPON SILHOUETTES — 3× INSPECTION", textStyle);
    this.drawRow(weapons, 118, (a) => a.weapon.toUpperCase());
    this.add.text(28, 235, "ARMOR MATERIALS AND SHIELD — 3× INSPECTION", textStyle);
    this.drawRow(armors, 293, (a) => `${a.armor.toUpperCase()}${a.shield !== "none" ? " + SHIELD" : ""}`);
    this.add.text(28, 420, "STARTING PARTY — GAME SCALE", textStyle);
    const defaults = [weapons[0]!, weapons[2]!, armors[5]!, weapons[4]!];
    defaults.forEach((appearance, i) => {
      const key = ensureCharacterAppearance(this, appearance);
      const x = 350 + i * 90;
      this.add.image(x, 477, `${key}-idle-0`);
      this.add.text(x, 504, appearance.className.toUpperCase(), { ...textStyle, fontSize: "9px" }).setOrigin(0.5);
    });
  }

  private drawRow(
    appearances: readonly CharacterAppearance[],
    y: number,
    label: (appearance: CharacterAppearance) => string,
  ): void {
    appearances.forEach((appearance, i) => {
      const key = ensureCharacterAppearance(this, appearance);
      const x = 90 + i * 155;
      this.add.ellipse(x, y + 30, 68, 15, 0x000000, 0.45);
      this.add.image(x, y, `${key}-idle-0`).setScale(3);
      this.add.text(x, y + 65, label(appearance), textStyle).setOrigin(0.5);
    });
  }
}
