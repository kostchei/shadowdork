import Phaser from "phaser";
import { BootScene } from "./scenes/Boot";
import { DungeonScene } from "./scenes/Dungeon";
import { HudScene } from "./scenes/Hud";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  pixelArt: true,
  render: { preserveDrawingBuffer: true },
  backgroundColor: "#0a0a0f",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1000 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DungeonScene, HudScene],
});

declare global {
  interface Window {
    __game: Phaser.Game;
  }
}
window.__game = game;
