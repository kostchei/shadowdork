/** Cohesive runtime-generated pixel art; the game remains asset-pipeline free. */

import Phaser from "phaser";

export const TILE = 32;

function texture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function stoneTile(scene: Phaser.Scene, variant: number): void {
  texture(scene, `tile-wall-${variant}`, TILE, TILE, (g) => {
    g.fillStyle(0x555765, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x343641, 1);
    g.fillRect(0, 28, 32, 4);
    g.fillRect(29, 0, 3, 32);
    g.fillStyle(0x737686, 0.75);
    g.fillRect(1, 1, 28, 2);
    g.fillStyle(0x444651, 1);
    if (variant === 0) {
      g.fillRect(0, 15, 32, 2);
      g.fillRect(15, 0, 2, 15);
      g.fillRect(8, 17, 2, 11);
    } else if (variant === 1) {
      g.fillRect(0, 10, 32, 2);
      g.fillRect(20, 0, 2, 10);
      g.fillRect(11, 12, 2, 16);
      g.fillStyle(0x30313a, 1);
      g.fillRect(4, 21, 5, 2);
    } else {
      g.fillRect(0, 20, 32, 2);
      g.fillRect(9, 0, 2, 20);
      g.fillRect(23, 22, 2, 6);
      g.fillStyle(0x838696, 0.5);
      g.fillRect(17, 6, 7, 2);
    }
  });
}

function drawFace(g: Phaser.GameObjects.Graphics, skin: number): void {
  g.fillStyle(skin, 1);
  g.fillRect(7, 5, 10, 9);
  g.fillStyle(0x201b20, 1);
  g.fillRect(9, 8, 2, 2);
  g.fillRect(14, 8, 2, 2);
}

function characterTextures(scene: Phaser.Scene): void {
  texture(scene, "char-fighter", 24, 32, (g) => {
    g.fillStyle(0x352b32, 1);
    g.fillRect(5, 29, 6, 3);
    g.fillRect(14, 29, 6, 3);
    g.fillStyle(0x7b2632, 1);
    g.fillRect(4, 14, 16, 13);
    g.fillStyle(0xc54b3c, 1);
    g.fillRect(6, 14, 12, 5);
    drawFace(g, 0xd8ad86);
    g.fillStyle(0x9aa0a8, 1);
    g.fillRect(5, 2, 14, 5);
    g.fillRect(4, 5, 3, 6);
    g.fillRect(17, 5, 3, 6);
    g.fillStyle(0xe0bd58, 1);
    g.fillRect(11, 16, 3, 3);
    g.fillStyle(0xced2d8, 1);
    g.fillRect(19, 14, 3, 13);
  });

  texture(scene, "char-thief", 24, 32, (g) => {
    g.fillStyle(0x20292a, 1);
    g.fillRect(5, 29, 5, 3);
    g.fillRect(15, 29, 5, 3);
    g.fillStyle(0x285a48, 1);
    g.fillRect(5, 13, 14, 15);
    g.fillStyle(0x3c8062, 1);
    g.fillTriangle(3, 13, 12, 1, 21, 13);
    drawFace(g, 0xc99d78);
    g.fillStyle(0xe6d27b, 1);
    g.fillRect(9, 9, 2, 1);
    g.fillRect(14, 9, 2, 1);
    g.fillStyle(0x7d5438, 1);
    g.fillRect(4, 18, 17, 3);
    g.fillStyle(0xcbd2d8, 1);
    g.fillTriangle(19, 21, 24, 18, 21, 25);
  });

  texture(scene, "char-priest", 24, 32, (g) => {
    g.fillStyle(0x473c39, 1);
    g.fillRect(5, 29, 5, 3);
    g.fillRect(15, 29, 5, 3);
    g.fillStyle(0xd7d0b0, 1);
    g.fillRect(4, 13, 16, 16);
    g.fillStyle(0x8e3044, 1);
    g.fillRect(4, 18, 16, 4);
    drawFace(g, 0xd8ad86);
    g.fillStyle(0xe7d98a, 1);
    g.fillRect(6, 2, 12, 4);
    g.fillRect(10, 0, 4, 8);
    g.fillStyle(0xb89535, 1);
    g.fillRect(11, 15, 3, 10);
    g.fillRect(8, 18, 9, 3);
  });

  texture(scene, "char-wizard", 24, 32, (g) => {
    g.fillStyle(0x282342, 1);
    g.fillRect(5, 29, 5, 3);
    g.fillRect(15, 29, 5, 3);
    g.fillStyle(0x3c438f, 1);
    g.fillRect(4, 14, 16, 15);
    drawFace(g, 0xc99d78);
    g.fillStyle(0x505fc1, 1);
    g.fillTriangle(2, 7, 13, 0, 20, 12);
    g.fillRect(3, 10, 18, 4);
    g.fillStyle(0xe5c85d, 1);
    g.fillRect(13, 4, 2, 2);
    g.fillRect(7, 18, 3, 3);
    g.fillStyle(0x9e6b3c, 1);
    g.fillRect(20, 13, 2, 17);
    g.fillStyle(0x7ed9dd, 1);
    g.fillCircle(21, 11, 3);
  });
}

function monsterTextures(scene: Phaser.Scene): void {
  texture(scene, "monster-goblin", 22, 24, (g) => {
    g.fillStyle(0x2e3b25, 1);
    g.fillRect(5, 19, 5, 5);
    g.fillRect(13, 19, 5, 5);
    g.fillStyle(0x537c3b, 1);
    g.fillRect(4, 7, 15, 13);
    g.fillTriangle(0, 5, 7, 8, 5, 13);
    g.fillTriangle(22, 5, 16, 8, 18, 13);
    g.fillStyle(0xb5c84d, 1);
    g.fillRect(6, 10, 3, 2);
    g.fillRect(14, 10, 3, 2);
    g.fillStyle(0x6b2931, 1);
    g.fillRect(8, 15, 7, 2);
    g.fillStyle(0x9c713f, 1);
    g.fillRect(18, 13, 3, 10);
  });

  texture(scene, "monster-skeleton", 24, 30, (g) => {
    g.fillStyle(0xa9a995, 1);
    g.fillRect(7, 25, 3, 5);
    g.fillRect(15, 25, 3, 5);
    g.fillRect(10, 13, 5, 13);
    g.fillRect(5, 15, 15, 3);
    g.fillStyle(0xe2dfc6, 1);
    g.fillRect(5, 2, 15, 12);
    g.fillRect(7, 0, 11, 2);
    g.fillStyle(0x27242a, 1);
    g.fillRect(8, 5, 3, 4);
    g.fillRect(15, 5, 3, 4);
    g.fillRect(10, 11, 6, 2);
    g.fillStyle(0x727067, 1);
    g.fillRect(7, 19, 12, 2);
    g.fillRect(8, 23, 10, 2);
  });

  texture(scene, "monster-giant-rat", 28, 17, (g) => {
    g.lineStyle(2, 0x8c6b57, 1);
    g.beginPath();
    g.arc(23, 10, 8, -0.6, 1.8);
    g.strokePath();
    g.fillStyle(0x5f493e, 1);
    g.fillEllipse(13, 10, 22, 13);
    g.fillStyle(0x8a6b5b, 1);
    g.fillTriangle(5, 6, 8, 0, 11, 6);
    g.fillStyle(0xf05b62, 1);
    g.fillRect(5, 7, 2, 2);
    g.fillStyle(0xcda58d, 1);
    g.fillRect(0, 11, 5, 2);
    g.fillStyle(0x302527, 1);
    g.fillRect(9, 15, 4, 2);
    g.fillRect(19, 15, 4, 2);
  });

  texture(scene, "monster-gloom-ogre", 44, 52, (g) => {
    g.fillStyle(0x312637, 1);
    g.fillRect(6, 45, 12, 7);
    g.fillRect(27, 45, 12, 7);
    g.fillStyle(0x584065, 1);
    g.fillRect(4, 17, 36, 30);
    g.fillRect(0, 21, 8, 22);
    g.fillRect(36, 21, 8, 22);
    g.fillStyle(0x765784, 1);
    g.fillRect(7, 3, 30, 23);
    g.fillTriangle(5, 8, 12, 0, 14, 9);
    g.fillTriangle(39, 8, 32, 0, 30, 9);
    g.fillStyle(0xd7dd58, 1);
    g.fillRect(12, 10, 6, 5);
    g.fillRect(27, 10, 6, 5);
    g.fillStyle(0x241b28, 1);
    g.fillRect(13, 12, 3, 3);
    g.fillRect(29, 12, 3, 3);
    g.fillRect(13, 20, 20, 4);
    g.fillStyle(0xc8bd9a, 1);
    g.fillTriangle(15, 20, 19, 20, 17, 25);
    g.fillTriangle(27, 20, 31, 20, 29, 25);
    g.fillStyle(0x9d6b3e, 1);
    g.fillRect(2, 32, 40, 5);
  });
}

function environmentTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < 3; i++) stoneTile(scene, i);

  texture(scene, "tile-platform", TILE, 12, (g) => {
    g.fillStyle(0x5b5d6b, 1);
    g.fillRect(0, 0, 32, 10);
    g.fillStyle(0x858897, 1);
    g.fillRect(0, 0, 32, 3);
    g.fillStyle(0x343640, 1);
    g.fillRect(0, 9, 32, 3);
    g.fillTriangle(4, 10, 10, 10, 7, 12);
    g.fillTriangle(22, 10, 28, 10, 25, 12);
  });
  texture(scene, "tile-weak", TILE, TILE, (g) => {
    g.fillStyle(0x6d5744, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x98735a, 1);
    g.fillRect(1, 1, 30, 3);
    g.fillStyle(0x3a2c28, 1);
    g.fillRect(0, 29, 32, 3);
    g.lineStyle(2, 0x34272a, 1);
    g.lineBetween(5, 3, 13, 12);
    g.lineBetween(13, 12, 9, 28);
    g.lineBetween(13, 12, 24, 18);
    g.lineBetween(24, 18, 20, 30);
  });
  texture(scene, "tile-climb", TILE, TILE, (g) => {
    g.fillStyle(0x4f5260, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x343640, 1);
    g.fillRect(29, 0, 3, 32);
    g.lineStyle(3, 0x315d3d, 1);
    g.lineBetween(6, 0, 7, 32);
    g.lineBetween(16, 0, 14, 32);
    g.lineBetween(25, 0, 23, 32);
    g.lineStyle(2, 0x73a660, 1);
    for (let y = 5; y < 32; y += 9) g.lineBetween(4, y, 26, y + 3);
  });
  texture(scene, "spikes", TILE, 14, (g) => {
    g.fillStyle(0x3a363d, 1);
    g.fillRect(0, 11, 32, 3);
    for (let x = 0; x < 32; x += 8) {
      g.fillStyle(0xbfc2c6, 1);
      g.fillTriangle(x, 12, x + 4, 0, x + 8, 12);
      g.fillStyle(0x767b82, 1);
      g.fillTriangle(x + 4, 1, x + 8, 12, x + 5, 10);
    }
  });

  texture(scene, "bg-cavern", 320, 180, (g) => {
    g.fillStyle(0x171b25, 1);
    g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x252b38, 1);
    g.fillTriangle(0, 0, 44, 0, 20, 76);
    g.fillTriangle(58, 0, 118, 0, 86, 104);
    g.fillTriangle(172, 0, 220, 0, 199, 68);
    g.fillTriangle(264, 0, 320, 0, 294, 96);
    g.fillStyle(0x0e1119, 1);
    g.fillEllipse(45, 157, 110, 80);
    g.fillEllipse(166, 160, 150, 96);
    g.fillEllipse(298, 158, 120, 74);
    g.lineStyle(3, 0x303748, 0.55);
    g.lineBetween(0, 116, 320, 90);
    g.lineBetween(0, 137, 320, 119);
  });
  texture(scene, "bg-fog", 256, 96, (g) => {
    g.fillStyle(0xffffff, 0.18);
    g.fillEllipse(44, 76, 130, 45);
    g.fillEllipse(133, 60, 170, 58);
    g.fillEllipse(228, 80, 130, 40);
  });

  texture(scene, "deco-mushrooms", 30, 24, (g) => {
    g.fillStyle(0xbed5bf, 0.9);
    g.fillRect(6, 11, 3, 12);
    g.fillRect(19, 7, 3, 16);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 10, 13, 7);
    g.fillEllipse(20, 6, 17, 9);
    g.fillCircle(27, 17, 3);
  });
  texture(scene, "deco-bones", 30, 15, (g) => {
    g.lineStyle(3, 0xb8b29b, 1);
    g.lineBetween(4, 12, 19, 4);
    g.lineBetween(9, 3, 24, 12);
    g.fillStyle(0xd5ceb2, 1);
    g.fillCircle(3, 12, 3);
    g.fillCircle(20, 3, 3);
    g.fillCircle(8, 2, 3);
    g.fillCircle(25, 13, 3);
  });
  texture(scene, "deco-banner", 28, 38, (g) => {
    g.fillStyle(0x807d87, 1);
    g.fillRect(2, 0, 24, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(5, 4, 18, 27);
    g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0x29242c, 0.85);
    g.fillCircle(14, 17, 5);
    g.fillRect(12, 20, 4, 7);
  });
  texture(scene, "deco-stalactite", 30, 35, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(1, 0, 11, 0, 7, 31);
    g.fillTriangle(10, 0, 21, 0, 16, 22);
    g.fillTriangle(19, 0, 29, 0, 25, 34);
  });
}

function propAndPickupTextures(scene: Phaser.Scene): void {
  const pickup = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) =>
    texture(scene, key, 20, 20, draw);
  pickup("pickup-coins", (g) => {
    g.fillStyle(0x9d642d, 1);
    g.fillCircle(10, 13, 6);
    g.fillCircle(5, 11, 5);
    g.fillStyle(0xf1cf55, 1);
    g.fillCircle(13, 9, 6);
    g.fillRect(10, 6, 5, 2);
  });
  pickup("pickup-gem", (g) => {
    g.fillStyle(0x236d78, 1);
    g.fillTriangle(10, 2, 19, 9, 10, 19);
    g.fillStyle(0x69e4df, 1);
    g.fillTriangle(10, 2, 4, 9, 10, 16);
    g.fillStyle(0xc5ffff, 1);
    g.fillTriangle(10, 3, 15, 8, 10, 8);
  });
  pickup("pickup-jeweled-idol", (g) => {
    g.fillStyle(0x8d5e26, 1);
    g.fillRect(4, 7, 12, 12);
    g.fillStyle(0xd3a343, 1);
    g.fillRect(7, 4, 7, 13);
    g.fillStyle(0x5be26d, 1);
    g.fillCircle(10, 6, 3);
  });
  pickup("pickup-crown-of-the-deep", (g) => {
    g.fillStyle(0x8d6122, 1);
    g.fillRect(2, 11, 16, 7);
    g.fillStyle(0xf0d05e, 1);
    g.fillTriangle(2, 12, 5, 2, 9, 12);
    g.fillTriangle(7, 12, 10, 0, 13, 12);
    g.fillTriangle(11, 12, 16, 3, 18, 12);
    g.fillRect(4, 13, 12, 3);
    g.fillStyle(0xf45d8c, 1);
    g.fillCircle(10, 14, 2);
  });
  pickup("pickup-torch", (g) => {
    g.fillStyle(0x754527, 1);
    g.fillRect(8, 8, 4, 12);
    g.fillStyle(0xff702f, 1);
    g.fillTriangle(5, 8, 10, 0, 15, 8);
    g.fillStyle(0xffd35a, 1);
    g.fillTriangle(8, 8, 11, 3, 13, 8);
  });
  pickup("pickup-ration", (g) => {
    g.fillStyle(0x6e442b, 1);
    g.fillRect(3, 9, 14, 9);
    g.fillStyle(0xc78b50, 1);
    g.fillRect(4, 7, 12, 8);
    g.fillStyle(0xe8c889, 1);
    g.fillRect(6, 7, 8, 2);
  });

  texture(scene, "campfire", 32, 26, (g) => {
    g.lineStyle(4, 0x68452c, 1);
    g.lineBetween(3, 23, 28, 17);
    g.lineBetween(4, 17, 28, 23);
    g.fillStyle(0xe54f27, 1);
    g.fillTriangle(6, 18, 16, 0, 26, 18);
    g.fillStyle(0xffb52e, 1);
    g.fillTriangle(10, 18, 16, 5, 22, 18);
    g.fillStyle(0xffe071, 1);
    g.fillTriangle(13, 17, 17, 10, 19, 17);
  });
  texture(scene, "brazier", 26, 34, (g) => {
    g.fillStyle(0x5a4b47, 1);
    g.fillRect(4, 17, 18, 5);
    g.fillTriangle(7, 22, 19, 22, 16, 29);
    g.fillRect(11, 27, 5, 7);
    g.fillStyle(0xee4e2d, 1);
    g.fillTriangle(4, 17, 13, 0, 22, 17);
    g.fillStyle(0xffbf3e, 1);
    g.fillTriangle(8, 17, 14, 6, 18, 17);
  });
  texture(scene, "door", TILE, TILE * 2, (g) => {
    g.fillStyle(0x2d2022, 1);
    g.fillRect(1, 10, 30, 54);
    g.fillStyle(0x60442f, 1);
    g.fillRect(4, 13, 24, 51);
    g.fillStyle(0x8a6341, 1);
    g.fillRect(6, 16, 20, 4);
    g.fillRect(6, 39, 20, 4);
    g.fillStyle(0xc8a447, 1);
    g.fillCircle(23, 49, 3);
    g.lineStyle(2, 0x9d7e37, 1);
    g.strokeRect(1, 10, 30, 54);
  });
  texture(scene, "cage", 32, 36, (g) => {
    g.lineStyle(3, 0x777b83, 1);
    g.strokeRect(1, 1, 30, 34);
    for (let x = 7; x < 31; x += 6) g.lineBetween(x, 1, x, 35);
    g.lineStyle(1, 0xb4b8bd, 0.8);
    g.lineBetween(2, 3, 30, 3);
  });
  texture(scene, "shrine", 34, 31, (g) => {
    g.fillStyle(0x454652, 1);
    g.fillRect(2, 23, 30, 8);
    g.fillRect(9, 18, 16, 5);
    g.fillStyle(0x8c8e9d, 1);
    g.fillRect(12, 3, 10, 15);
    g.fillTriangle(10, 5, 17, 0, 24, 5);
    g.fillStyle(0xe0ba55, 1);
    g.fillRect(16, 6, 3, 8);
    g.fillRect(13, 9, 9, 3);
  });
}

function effectTextures(scene: Phaser.Scene): void {
  const size = 256;
  const canvas = scene.textures.createCanvas("light-radial", size, size);
  if (!canvas) throw new Error("Failed to create light-radial canvas");
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.48, "rgba(255,255,255,0.98)");
  grad.addColorStop(0.76, "rgba(255,255,255,0.64)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();

  texture(scene, "slash", 30, 30, (g) => {
    g.lineStyle(4, 0xf7e8c2, 1);
    g.beginPath();
    g.arc(15, 15, 12, -1.05, 0.9);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath();
    g.arc(15, 15, 8, -1.05, 0.9);
    g.strokePath();
  });
  texture(scene, "spell-bolt", 16, 10, (g) => {
    g.fillStyle(0x4c59bf, 0.65);
    g.fillEllipse(8, 5, 16, 10);
    g.fillStyle(0x91b7ff, 1);
    g.fillTriangle(0, 5, 11, 1, 15, 5);
    g.fillStyle(0xe0f2ff, 1);
    g.fillRect(7, 3, 7, 3);
  });
  texture(scene, "pixel", 2, 2, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
  });
  texture(scene, "entity-shadow", 30, 8, (g) => {
    g.fillStyle(0x000000, 0.48);
    g.fillEllipse(15, 4, 30, 8);
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  environmentTextures(scene);
  characterTextures(scene);
  monsterTextures(scene);
  propAndPickupTextures(scene);
  effectTextures(scene);
}
