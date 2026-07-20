/**
 * Self-contained in-scene confirm/alert modals, replacing native confirm()/
 * alert() calls. Native dialogs block the entire tab — jarring and unstyled
 * on mobile Safari especially — and don't fit any scene's own overlay
 * machinery (Boot has no mode controller at all). These build a small
 * container, own their own input, and destroy themselves on dismissal; the
 * caller never manages overlay state, just supplies callbacks.
 */

import Phaser from "phaser";
import { textButton } from "./button";

const PANEL_W = 440;
const DEPTH = 3000;

function buildPanel(scene: Phaser.Scene, message: string) {
  const cam = scene.cameras.main;
  const w = cam.width / cam.zoom;
  const h = cam.height / cam.zoom;
  const cx = w / 2;
  const cy = h / 2;

  // Interactive so the modal swallows taps instead of letting them fall
  // through to whatever's behind it (the title screen, the world).
  const scrim = scene.add.rectangle(cx, cy, w, h, 0x020205, 0.75).setInteractive();

  const text = scene.add
    .text(cx, cy - 20, message, {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#f0eee9",
      align: "center",
      wordWrap: { width: PANEL_W - 48 },
      lineSpacing: 4,
    })
    .setOrigin(0.5);

  const panelH = Math.max(110, text.height + 90);
  const panel = scene.add.graphics();
  panel.fillStyle(0x0a0a10, 0.98).fillRoundedRect(cx - PANEL_W / 2, cy - panelH / 2, PANEL_W, panelH, 8);
  panel.lineStyle(2, 0xffd45f, 0.85).strokeRoundedRect(cx - PANEL_W / 2, cy - panelH / 2, PANEL_W, panelH, 8);

  return { cx, cy, buttonY: cy + panelH / 2 - 32, scrim, panel, text };
}

/** confirm() replacement. Calls exactly one of onConfirm/onCancel, never both. */
export function showConfirm(
  scene: Phaser.Scene,
  message: string,
  onConfirm: () => void,
  onCancel: () => void = () => {},
): void {
  const { cx, buttonY, scrim, panel, text } = buildPanel(scene, message);
  const container = scene.add.container(0, 0, [scrim, panel as unknown as Phaser.GameObjects.GameObject, text]);
  container.setDepth(DEPTH);

  const dismiss = (action: () => void) => {
    container.destroy();
    action();
  };
  container.add([
    textButton(scene, cx - 74, buttonY, "[ Cancel ]", () => dismiss(onCancel)),
    textButton(scene, cx + 74, buttonY, "[ Confirm ]", () => dismiss(onConfirm), { idleColor: "#ff8888" }),
  ]);
}

/** alert() replacement. */
export function showAlert(scene: Phaser.Scene, message: string, onClose: () => void = () => {}): void {
  const { cx, buttonY, scrim, panel, text } = buildPanel(scene, message);
  const container = scene.add.container(0, 0, [scrim, panel as unknown as Phaser.GameObjects.GameObject, text]);
  container.setDepth(DEPTH);
  container.add(textButton(scene, cx, buttonY, "[ OK ]", () => dismissAlert(container, onClose)));
}

function dismissAlert(container: Phaser.GameObjects.Container, onClose: () => void): void {
  container.destroy();
  onClose();
}
