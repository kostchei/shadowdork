/** Runtime-generated placeholder art. No asset pipeline — every texture is drawn here. */

import Phaser from "phaser";

export const TILE = 32;

function rectTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  fill: number,
  border?: number,
  draw?: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, w, h);
  if (border !== undefined) {
    g.lineStyle(2, border, 1);
    g.strokeRect(1, 1, w - 2, h - 2);
  }
  if (draw) draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene): void {
  // --- Tiles ---
  rectTexture(scene, "tile-wall", TILE, TILE, 0x3a3a46, 0x23232c, (g) => {
    g.lineStyle(1, 0x2c2c36, 1);
    g.lineBetween(0, 16, 32, 16);
    g.lineBetween(16, 0, 16, 16);
    g.lineBetween(8, 16, 8, 32);
  });
  rectTexture(scene, "tile-platform", TILE, 12, 0x4a4a58, 0x2c2c36, (g) => {
    g.lineStyle(2, 0x5c5c6c, 1);
    g.lineBetween(0, 2, 32, 2);
  });
  rectTexture(scene, "tile-weak", TILE, TILE, 0x5a4632, 0x3a2c1e, (g) => {
    g.lineStyle(1, 0x2a1f14, 1);
    g.lineBetween(6, 4, 14, 14);
    g.lineBetween(14, 14, 10, 26);
    g.lineBetween(20, 6, 24, 20);
  });
  rectTexture(scene, "tile-climb", TILE, TILE, 0x3a3a46, 0x23232c, (g) => {
    g.lineStyle(2, 0x4a7a3a, 1);
    g.lineBetween(6, 0, 6, 32);
    g.lineBetween(14, 0, 14, 32);
    g.lineBetween(24, 0, 24, 32);
    g.lineStyle(1, 0x6a9a5a, 1);
    for (let y = 4; y < 32; y += 8) g.lineBetween(4, y, 26, y + 2);
  });
  rectTexture(scene, "spikes", TILE, 12, 0x000000, undefined, (g) => {
    g.fillStyle(0x8a8a96, 1);
    for (let x = 0; x < 32; x += 8) g.fillTriangle(x, 12, x + 4, 0, x + 8, 12);
  });

  // --- Characters (24x30) ---
  const charBody = (color: number, headColor: number) => (g: Phaser.GameObjects.Graphics) => {
    g.fillStyle(headColor, 1);
    g.fillRect(6, 0, 12, 10);
    g.fillStyle(color, 1);
    g.fillRect(4, 10, 16, 14);
    g.fillRect(5, 24, 5, 6);
    g.fillRect(14, 24, 5, 6);
  };
  for (const [key, body, head] of [
    ["char-fighter", 0xb04a3a, 0xd8b090],
    ["char-thief", 0x3a7a4a, 0xc8a880],
    ["char-priest", 0xc8c0a0, 0xd8b090],
    ["char-wizard", 0x4a5aaa, 0xc8a880],
  ] as const) {
    const g = scene.add.graphics();
    charBody(body, head)(g);
    g.generateTexture(key, 24, 30);
    g.destroy();
  }

  // --- Monsters ---
  rectTexture(scene, "monster-goblin", 20, 20, 0x5a8a3a, 0x3a5a24, (g) => {
    g.fillStyle(0xd8d840, 1);
    g.fillRect(4, 5, 3, 3);
    g.fillRect(13, 5, 3, 3);
  });
  rectTexture(scene, "monster-skeleton", 22, 28, 0xd8d8c8, 0x9a9a8a, (g) => {
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(5, 5, 4, 4);
    g.fillRect(13, 5, 4, 4);
    g.fillRect(7, 14, 8, 2);
  });
  rectTexture(scene, "monster-giant-rat", 24, 14, 0x6a5040, 0x4a3830, (g) => {
    g.fillStyle(0xd84040, 1);
    g.fillRect(2, 4, 3, 3);
  });
  rectTexture(scene, "monster-gloom-ogre", 40, 48, 0x6a4a7a, 0x4a3456, (g) => {
    g.fillStyle(0xd8d840, 1);
    g.fillRect(8, 8, 6, 6);
    g.fillRect(26, 8, 6, 6);
    g.fillStyle(0x3a2a44, 1);
    g.fillRect(10, 24, 20, 4);
  });

  // --- Pickups ---
  const pickup = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, 20, 20);
    g.destroy();
  };
  pickup("pickup-coins", (g) => {
    g.fillStyle(0xe8c840, 1);
    g.fillCircle(10, 12, 6);
    g.fillCircle(6, 10, 5);
    g.fillCircle(14, 9, 5);
  });
  pickup("pickup-gem", (g) => {
    g.fillStyle(0x40d8d8, 1);
    g.fillTriangle(10, 2, 18, 10, 10, 18);
    g.fillTriangle(10, 2, 2, 10, 10, 18);
  });
  pickup("pickup-jeweled-idol", (g) => {
    g.fillStyle(0xc89030, 1);
    g.fillRect(5, 6, 10, 12);
    g.fillStyle(0x40d840, 1);
    g.fillCircle(10, 5, 4);
  });
  pickup("pickup-crown-of-the-deep", (g) => {
    g.fillStyle(0xe8d060, 1);
    g.fillRect(3, 10, 14, 7);
    g.fillTriangle(3, 10, 6, 3, 9, 10);
    g.fillTriangle(8, 10, 10, 2, 13, 10);
    g.fillTriangle(12, 10, 14, 3, 17, 10);
    g.fillStyle(0xd84080, 1);
    g.fillCircle(10, 13, 2);
  });
  pickup("pickup-torch", (g) => {
    g.fillStyle(0x8a6a4a, 1);
    g.fillRect(8, 8, 4, 11);
    g.fillStyle(0xe89030, 1);
    g.fillCircle(10, 6, 4);
  });
  pickup("pickup-ration", (g) => {
    g.fillStyle(0xb08050, 1);
    g.fillRect(4, 8, 12, 8);
    g.fillStyle(0x8a5a30, 1);
    g.fillRect(4, 8, 12, 3);
  });

  // --- Props ---
  rectTexture(scene, "campfire", 28, 20, 0x000000, undefined, (g) => {
    g.fillStyle(0x6a4a30, 1);
    g.fillRect(2, 14, 24, 4);
    g.fillStyle(0xe87020, 1);
    g.fillTriangle(6, 14, 14, 0, 22, 14);
    g.fillStyle(0xf8c040, 1);
    g.fillTriangle(9, 14, 14, 5, 19, 14);
  });
  rectTexture(scene, "door", TILE, TILE * 2, 0x5a4030, 0x3a2a1e, (g) => {
    g.fillStyle(0xc8a030, 1);
    g.fillCircle(26, 34, 3);
  });
  rectTexture(scene, "cage", 30, 34, 0x000000, undefined, (g) => {
    g.lineStyle(3, 0x8a8a96, 1);
    g.strokeRect(1, 1, 28, 32);
    for (let x = 7; x < 30; x += 6) g.lineBetween(x, 1, x, 33);
  });
  rectTexture(scene, "shrine", 30, 26, 0x000000, undefined, (g) => {
    g.fillStyle(0x8a8a96, 1);
    g.fillRect(4, 18, 22, 8);
    g.fillRect(11, 4, 8, 14);
    g.fillStyle(0x4a4a56, 1);
    g.fillRect(12, 6, 6, 4);
  });

  // --- Effects ---
  // Radial light gradient for the darkness mask.
  const size = 256;
  const canvas = scene.textures.createCanvas("light-radial", size, size);
  if (!canvas) throw new Error("Failed to create light-radial canvas");
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.6, "rgba(255,255,255,1)");
  grad.addColorStop(0.85, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();

  rectTexture(scene, "slash", 26, 26, 0x000000, undefined, (g) => {
    g.lineStyle(3, 0xf8f8f8, 1);
    g.beginPath();
    g.arc(13, 13, 11, -0.9, 0.9);
    g.strokePath();
  });
  rectTexture(scene, "spell-bolt", 12, 6, 0x000000, undefined, (g) => {
    g.fillStyle(0x8090f8, 1);
    g.fillRect(0, 0, 12, 6);
  });
  rectTexture(scene, "pixel", 2, 2, 0xffffff);
}
