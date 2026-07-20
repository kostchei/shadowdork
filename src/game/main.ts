import Phaser from "phaser";
import { installUnlock } from "./audio/context";
import { RENDER_SCALE, GAME_H, GAME_W } from "./display";
import { loadMobilePrefs } from "./MobilePrefs";
import { BootScene } from "./scenes/Boot";
import { DungeonScene } from "./scenes/Dungeon";
import { HudScene } from "./scenes/Hud";
import { EquipmentShowroomScene } from "./scenes/EquipmentShowroom";

// Before anything reads quality.ts's auto-detected default or the audio
// graph exists — restores whatever the player last chose.
loadMobilePrefs();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_W * RENDER_SCALE,
  height: GAME_H * RENDER_SCALE,
  pixelArt: true,
  // preserveDrawingBuffer is only needed so tooling can read pixels back
  // (e.g. the /__shot screenshot path). It forces the GPU to keep the backbuffer
  // around every frame, so keep it out of production builds.
  render: { preserveDrawingBuffer: import.meta.env.DEV },
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
      voice: typeof import("./audio/voice");
    };
  }
}
// Audio contexts start suspended until a user gesture — arm the resume now.
installUnlock();

// Optional fullscreen control — only shown where the API exists.
const fullscreenBtn = document.getElementById("fullscreen-btn");
if (fullscreenBtn && document.documentElement.requestFullscreen) {
  fullscreenBtn.hidden = false;
  fullscreenBtn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen can be denied (no user gesture in some browsers' eyes,
        // or the platform simply refuses it) — the button just stays usable.
      });
    }
  });
}

// Dev/debug handles: let tooling drive the game and audio graph. Kept out of
// production so the global surface isn't exposed to shipped builds.
if (import.meta.env.DEV) {
  window.__game = game;
  void (async () => {
    window.__audio = {
      context: await import("./audio/context"),
      sfx: await import("./audio/sfx"),
      ambience: await import("./audio/ambience"),
      voice: await import("./audio/voice"),
    };
  })();
}
