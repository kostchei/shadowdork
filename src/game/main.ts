import Phaser from "phaser";
import { installUnlock } from "./audio/context";
import { RENDER_SCALE, GAME_H, GAME_W } from "./display";
import { BootScene } from "./scenes/Boot";
import { DungeonScene } from "./scenes/Dungeon";
import { HudScene } from "./scenes/Hud";
import { EquipmentShowroomScene } from "./scenes/EquipmentShowroom";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_W * RENDER_SCALE,
  height: GAME_H * RENDER_SCALE,
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
  scene: [BootScene, DungeonScene, HudScene, EquipmentShowroomScene],
});

declare global {
  interface Window {
    __game: Phaser.Game;
    __audio: {
      context: typeof import("./audio/context");
      sfx: typeof import("./audio/sfx");
      ambience: typeof import("./audio/ambience");
    };
  }
}
window.__game = game;

// Audio contexts start suspended until a user gesture — arm the resume now.
installUnlock();

// Dev/debug handle: lets tooling fire sounds and inspect the audio graph.
void (async () => {
  window.__audio = {
    context: await import("./audio/context"),
    sfx: await import("./audio/sfx"),
    ambience: await import("./audio/ambience"),
  };
})();
