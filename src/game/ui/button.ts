/**
 * A tappable text control with a touch-target-sized invisible hit rectangle
 * (not bound to the rendered glyph) and pressed/disabled states that don't
 * rely on colour alone. Shared by scenes that aren't driven through the
 * semantic ActionInput service — Boot has no ActionInput/ModeController — and
 * by the confirm/alert modals. HudScene's own `actionButton` covers the same
 * ground for GameAction taps specifically and is left as-is.
 */

import Phaser from "phaser";

const MIN_HIT_W = 40;
const MIN_HIT_H = 36;

export interface TextButtonOptions {
  fontFamily?: string;
  fontSize?: string;
  idleColor?: string;
  hoverColor?: string;
  pressedColor?: string;
  disabledColor?: string;
  padding?: { x: number; y: number };
  resolution?: number;
  disabled?: boolean;
}

const DEFAULTS = {
  fontFamily: "Consolas, monospace",
  fontSize: "12px",
  idleColor: "#a0a4b0",
  hoverColor: "#ffffff",
  pressedColor: "#ffd45f",
  disabledColor: "#4a4d55",
  padding: { x: 8, y: 4 },
  resolution: 1,
} satisfies Required<Omit<TextButtonOptions, "disabled">>;

export function textButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
  options: TextButtonOptions = {},
): Phaser.GameObjects.Text {
  const o = { ...DEFAULTS, ...options };
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: o.fontFamily,
      fontSize: o.fontSize,
      color: options.disabled ? o.disabledColor : o.idleColor,
      padding: o.padding,
      resolution: o.resolution,
    })
    .setOrigin(0.5);

  if (options.disabled) {
    btn.setAlpha(0.55);
    return btn;
  }

  const hitW = Math.max(btn.width, MIN_HIT_W);
  const hitH = Math.max(btn.height, MIN_HIT_H);
  btn.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle((btn.width - hitW) / 2, (btn.height - hitH) / 2, hitW, hitH),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });

  const release = () => btn.setColor(o.idleColor).setScale(1);
  btn
    .on("pointerover", () => btn.setColor(o.hoverColor))
    .on("pointerout", release)
    .on("pointerup", release)
    .on("pointerdown", () => {
      btn.setColor(o.pressedColor).setScale(0.94);
      onTap();
    });
  return btn;
}
