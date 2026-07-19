import Phaser from "phaser";
import { TILE } from "../../textures";
import type { EnvironmentTextureKeys, VisualSkin } from "../model";
import { creviceGrime, domainWarp, latticeNoise, lipShadowAlpha } from "./math";

const PREFIX = "skin-iron-fortress";

function texture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function basaltBlock(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
): void {
  const topLeft = domainWarp({ x, y }, seed, 1.6, 0.11);
  const topRight = domainWarp({ x: x + width, y }, seed + 1, 1.6, 0.11);
  const bottomRight = domainWarp({ x: x + width, y: y + height }, seed + 2, 1.6, 0.11);
  const bottomLeft = domainWarp({ x, y: y + height }, seed + 3, 1.6, 0.11);
  const points = [topLeft, topRight, bottomRight, bottomLeft].map((point) => new Phaser.Geom.Point(point.x, point.y));
  const grime = creviceGrime(x + width / 2, y + height / 2, seed);
  const base = grime > 0.48 ? 0x292b30 : 0x33363b;
  graphics.fillStyle(base, 1);
  graphics.fillPoints(points, true);
  graphics.lineStyle(1, 0x54585d, 0.85);
  graphics.beginPath();
  graphics.moveTo(topLeft.x, topLeft.y);
  graphics.lineTo(topRight.x, topRight.y);
  graphics.lineTo(bottomRight.x, bottomRight.y);
  graphics.strokePath();
  graphics.lineStyle(2, 0x101216, lipShadowAlpha(1, 0.9, 2.5));
  graphics.lineBetween(bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y);
  for (let speck = 0; speck < 5; speck++) {
    const sx = x + 2 + Math.abs(latticeNoise(seed, speck, 91)) * Math.max(1, width - 4);
    const sy = y + 2 + Math.abs(latticeNoise(seed, speck, 173)) * Math.max(1, height - 4);
    graphics.fillStyle(speck % 2 === 0 ? 0x111317 : 0x62666a, 0.35);
    graphics.fillRect(sx, sy, 1, 1);
  }
}

function wallTexture(scene: Phaser.Scene, variant: number): void {
  texture(scene, `${PREFIX}-wall-${variant}`, TILE, TILE, (graphics) => {
    graphics.fillStyle(0x0e1014, 1);
    graphics.fillRect(0, 0, TILE, TILE);
    if (variant === 0) {
      basaltBlock(graphics, 1, 1, 30, 14, 11);
      basaltBlock(graphics, 1, 16, 14, 15, 12);
      basaltBlock(graphics, 16, 16, 15, 15, 13);
    } else if (variant === 1) {
      basaltBlock(graphics, 1, 1, 14, 14, 21);
      basaltBlock(graphics, 16, 1, 15, 14, 22);
      basaltBlock(graphics, 1, 16, 14, 15, 23);
      basaltBlock(graphics, 16, 16, 15, 15, 24);
    } else {
      basaltBlock(graphics, 1, 1, 30, 30, 31);
      graphics.lineStyle(2, 0x090a0d, 0.9);
      graphics.beginPath();
      graphics.moveTo(8, 1);
      graphics.lineTo(11, 9);
      graphics.lineTo(9, 17);
      graphics.lineTo(18, 23);
      graphics.lineTo(17, 31);
      graphics.strokePath();
    }
    // Blackened iron reinforcing strap and rivets.
    graphics.fillStyle(0x17191d, 0.92);
    graphics.fillRect(0, 14, 32, 3);
    graphics.fillStyle(0x77736b, 0.8);
    graphics.fillCircle(4, 15, 1);
    graphics.fillCircle(28, 15, 1);
  });
}

function generateIronFortress(scene: Phaser.Scene): void {
  for (let variant = 0; variant < 3; variant++) wallTexture(scene, variant);

  texture(scene, `${PREFIX}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x0f1115, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x3f4247, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x77736b, 0.8); for (let x = 4; x < 32; x += 8) g.fillCircle(x, 2, 1);
    g.fillStyle(0x050609, lipShadowAlpha(1, 0.95, 2)); g.fillRect(0, 7, 32, 5);
    for (let x = 3; x < 32; x += 10) g.fillTriangle(x, 10, x + 6, 10, x + 3, 12);
  });

  texture(scene, `${PREFIX}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0e1014, 1); g.fillRect(0, 0, 32, 32);
    basaltBlock(g, 1, 1, 30, 30, 47);
    g.lineStyle(2, 0x08090c, 1);
    g.beginPath(); g.moveTo(5, 1); g.lineTo(13, 10); g.lineTo(9, 19); g.lineTo(18, 24); g.lineTo(15, 32); g.strokePath();
    g.beginPath(); g.moveTo(13, 10); g.lineTo(26, 15); g.lineTo(22, 28); g.strokePath();
  });

  texture(scene, `${PREFIX}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x202329, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x090a0d, 1); g.fillRect(5, 0, 4, 32); g.fillRect(23, 0, 4, 32);
    g.fillStyle(0x5c5d5e, 1);
    for (let y = 3; y < 32; y += 8) g.fillRect(6, y, 20, 3);
    g.fillStyle(0x979184, 0.75); for (let y = 4; y < 32; y += 8) g.fillRect(7, y, 17, 1);
  });

  texture(scene, `${PREFIX}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x08090c, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x282a2e, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x77736b, 0.72); g.fillRect(x + 1, 3, 1, 22);
      g.fillStyle(0x17191d, 1); g.fillTriangle(x, 29, x + 4, 29, x + 2, 32);
    }
  });

  texture(scene, `${PREFIX}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x08090c, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x25272b, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x090a0d, 0.95); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    g.fillStyle(0x737068, 0.85); for (const y of [12, 27, 51, 60]) { g.fillCircle(7, y, 2); g.fillCircle(25, y, 2); }
    // Sneering dwarf-face boss.
    g.fillStyle(0x111318, 1); g.fillCircle(16, 34, 8);
    g.fillStyle(0x77736b, 0.82); g.fillTriangle(9, 31, 14, 29, 13, 33); g.fillTriangle(23, 31, 18, 29, 19, 33);
    g.fillRect(12, 38, 8, 2); g.fillTriangle(13, 40, 16, 44, 19, 40);
  });

  texture(scene, `${PREFIX}-backdrop`, 320, 180, (g) => {
    g.fillStyle(0x09080a, 1); g.fillRect(0, 0, 320, 180);
    // Cathedral cavern roof.
    g.fillStyle(0x17171b, 1);
    for (let x = 0; x < 320; x += 32) {
      const depth = 35 + Math.abs(latticeNoise(x, 3, 77)) * 55;
      g.fillTriangle(x, 0, x + 32, 0, x + 16, depth);
    }
    // Fortress towers and peaked basalt buildings.
    g.fillStyle(0x202126, 1);
    for (const tower of [{ x: 18, w: 48, h: 92 }, { x: 124, w: 62, h: 112 }, { x: 246, w: 50, h: 84 }]) {
      const y = 156 - tower.h;
      g.fillRect(tower.x, y, tower.w, tower.h);
      for (let cx = tower.x; cx < tower.x + tower.w; cx += 10) g.fillRect(cx, y - 7, 6, 9);
      g.fillStyle(0x090a0d, 1); g.fillRect(tower.x + tower.w / 2 - 5, y + tower.h - 28, 10, 28);
      g.fillStyle(0x202126, 1);
    }
    g.fillStyle(0x292a2f, 1); g.fillRect(62, 98, 64, 58); g.fillTriangle(58, 98, 130, 98, 94, 70);
    g.fillRect(184, 109, 64, 47); g.fillTriangle(180, 109, 252, 109, 216, 83);
    // Magma river across the base, with brighter broken surface lips.
    g.fillStyle(0x7d210c, 1); g.fillRect(0, 156, 320, 24);
    g.fillStyle(0xe35f1d, 0.9);
    for (let x = 0; x < 320; x += 12) {
      const y = 157 + Math.abs(latticeNoise(x, 8, 131)) * 7;
      g.fillRect(x, y, 9, 2);
    }
    g.fillStyle(0xffb13b, 0.72); for (let x = 5; x < 320; x += 31) g.fillRect(x, 160 + (x % 9), 13, 1);
    // Arched iron bridge.
    g.lineStyle(7, 0x292a2e, 1); g.beginPath(); g.arc(160, 164, 48, Math.PI, Math.PI * 2); g.strokePath();
    g.lineStyle(2, 0x6b6258, 0.7); g.beginPath(); g.arc(160, 162, 48, Math.PI, Math.PI * 2); g.strokePath();
  });

  texture(scene, `${PREFIX}-gong`, 30, 24, (g) => {
    g.fillStyle(0x37302a, 1); g.fillRect(13, 2, 3, 22);
    g.fillStyle(0x8c612d, 1); g.fillCircle(14, 11, 10);
    g.fillStyle(0xd79b42, 0.85); g.fillCircle(11, 8, 5); g.fillStyle(0x3c281b, 1); g.fillCircle(14, 11, 2);
  });
  texture(scene, `${PREFIX}-rack`, 30, 18, (g) => {
    g.fillStyle(0x27201d, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0x77736b, 1); g.lineBetween(7, 15, 7, 1); g.lineBetween(16, 15, 22, 1); g.lineBetween(25, 15, 19, 3);
  });
  texture(scene, `${PREFIX}-banner`, 28, 38, (g) => {
    g.fillStyle(0x1a1b20, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x52170f, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0xd17832, 0.9); g.fillTriangle(9, 11, 19, 11, 14, 25);
  });
  texture(scene, `${PREFIX}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x17191d, 1); g.fillRect(1, 9, 28, 26);
    for (let x = 1; x < 29; x += 9) g.fillTriangle(x, 10, x + 8, 10, x + 4, 0);
    g.fillStyle(0x5a5a58, 0.55); g.fillRect(2, 10, 26, 2);
  });
}

const genericKeys = (backdrop: string): EnvironmentTextureKeys => ({
  wall: (variant) => `tile-wall-${variant % 3}`,
  platform: "tile-platform",
  weakWall: "tile-weak",
  climb: "tile-climb",
  portcullis: "tile-portcullis",
  door: "door",
  backdrop,
  foregroundTint: 0xffffff,
  decorations: { mushrooms: "deco-mushrooms", bones: "deco-bones", banner: "deco-banner", stalactite: "deco-stalactite" },
});

export function ensureVisualSkinTextures(
  scene: Phaser.Scene,
  skin: VisualSkin | undefined,
  legacyBackdrop: string,
): EnvironmentTextureKeys {
  if (skin?.id !== "iron-fortress") return genericKeys(legacyBackdrop);
  generateIronFortress(scene);
  return {
    wall: (variant) => `${PREFIX}-wall-${variant % 3}`,
    platform: `${PREFIX}-platform`,
    weakWall: `${PREFIX}-weak`,
    climb: `${PREFIX}-climb`,
    portcullis: `${PREFIX}-portcullis`,
    door: `${PREFIX}-door`,
    backdrop: `${PREFIX}-backdrop`,
    foregroundTint: 0xffffff,
    decorations: {
      mushrooms: `${PREFIX}-gong`,
      bones: `${PREFIX}-rack`,
      banner: `${PREFIX}-banner`,
      stalactite: `${PREFIX}-crenel`,
    },
  };
}
