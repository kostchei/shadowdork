import Phaser from "phaser";
import { TILE } from "../../textures";
import type { EnvironmentTextureKeys, VisualSkin } from "../model";
import {
  creviceGrime,
  curvatureDivergence,
  displaceShadow,
  domainWarp,
  heightFieldNormal,
  latticeNoise,
  lipShadowAlpha,
  roundedBoxSdf,
  sdfBevelHeight,
  valueNoise,
} from "./math";

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

const SURFACE_LIGHT = { x: -0.65, y: -1 } as const;

function scaledColor(color: number, factor: number): number {
  const scale = Math.max(0, factor);
  const red = Math.min(255, Math.round(((color >>> 16) & 0xff) * scale));
  const green = Math.min(255, Math.round(((color >>> 8) & 0xff) * scale));
  const blue = Math.min(255, Math.round((color & 0xff) * scale));
  return (red << 16) | (green << 8) | blue;
}

function castPolygonShadow(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Phaser.Geom.Point[],
  elevation: number,
  alpha = 0.58,
): void {
  const shadow = points.map((point) => {
    const displaced = displaceShadow(point, elevation, SURFACE_LIGHT, 1);
    return new Phaser.Geom.Point(displaced.x, displaced.y);
  });
  graphics.fillStyle(0x020306, alpha);
  graphics.fillPoints(shadow, true);
}

function sdfBevelField(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  seed: number,
  baseColor: number,
): void {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const halfSize = { x: width / 2, y: height / 2 };
  const distance = (px: number, py: number): number => {
    const warped = domainWarp({ x: px, y: py }, seed, 0.75, 0.16);
    return roundedBoxSdf({ x: warped.x - centerX, y: warped.y - centerY }, halfSize, radius);
  };
  const sampleHeight = (px: number, py: number): number => {
    const bevel = sdfBevelHeight(distance(px, py), Math.max(1.5, radius + 0.5));
    const roughness = valueNoise(px * 0.22, py * 0.22, seed + 1709) * 0.08;
    return Math.max(0, bevel + roughness * bevel);
  };

  for (let py = y; py < y + height; py += 2) {
    for (let px = x; px < x + width; px += 2) {
      if (distance(px + 1, py + 1) > 0) continue;
      const normal = heightFieldNormal(sampleHeight, px + 1, py + 1, 1);
      const curvature = curvatureDivergence(sampleHeight, px + 1, py + 1, 1);
      const lightLength = Math.hypot(SURFACE_LIGHT.x, SURFACE_LIGHT.y, 1);
      const light = Math.max(0, (
        normal.x * SURFACE_LIGHT.x + normal.y * SURFACE_LIGHT.y + normal.z
      ) / lightLength);
      const crevice = Math.max(0, -curvature) * 1.8;
      const grime = creviceGrime(px, py, seed) * 0.12;
      const shade = 0.62 + light * 0.55 - Math.min(0.28, crevice) - grime;
      graphics.fillStyle(scaledColor(baseColor, shade), 0.96);
      graphics.fillRect(px, py, Math.min(2, x + width - px), Math.min(2, y + height - py));
    }
  }
}

function noiseCurve(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  length: number,
  seed: number,
  color: number,
  width = 1,
  leafy = false,
): void {
  const steps = Math.max(5, Math.ceil(length / 4));
  graphics.lineStyle(width, color, 0.9);
  graphics.beginPath();
  graphics.moveTo(x, y);
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const wave = Math.sin(t * Math.PI * 2 + seed * 0.17) * 1.4;
    const jitter = latticeNoise(seed, step, 613) * 1.1;
    const px = x + wave * t + jitter;
    const py = y + length * t;
    graphics.lineTo(px, py);
    if (leafy && step > 1 && step < steps && step % 2 === 0) {
      const side = step % 4 === 0 ? -1 : 1;
      graphics.fillStyle(color, 0.86);
      graphics.fillTriangle(px, py, px + side * 4, py - 2, px + side * 2, py + 2);
    }
  }
  graphics.strokePath();
}

function frostBloom(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
): void {
  const rotation = latticeNoise(seed, 0, 947) * 0.2;
  graphics.lineStyle(1, 0xc8f1ff, 0.82);
  for (let arm = 0; arm < 6; arm++) {
    const angle = rotation + arm * Math.PI / 3;
    const ex = cx + Math.cos(angle) * radius;
    const ey = cy + Math.sin(angle) * radius;
    graphics.lineBetween(cx, cy, ex, ey);
    for (const fraction of [0.48, 0.72]) {
      const bx = cx + Math.cos(angle) * radius * fraction;
      const by = cy + Math.sin(angle) * radius * fraction;
      const branch = radius * 0.23;
      for (const sign of [-1, 1]) {
        const branchAngle = angle + Math.PI + sign * Math.PI / 5;
        graphics.lineBetween(bx, by, bx + Math.cos(branchAngle) * branch, by + Math.sin(branchAngle) * branch);
      }
    }
  }
  graphics.fillStyle(0xe5f8ff, 0.9);
  graphics.fillCircle(cx, cy, 1);
}

function frozenTusk(
  graphics: Phaser.GameObjects.Graphics,
  rootX: number,
  rootY: number,
  height: number,
  bend: number,
): void {
  const left: Phaser.Geom.Point[] = [];
  const right: Phaser.Geom.Point[] = [];
  for (let step = 0; step <= 6; step++) {
    const t = step / 6;
    const centerX = rootX + bend * t * t;
    const centerY = rootY + height * t;
    const halfWidth = 3.5 * (1 - t) + 0.2;
    left.push(new Phaser.Geom.Point(centerX - halfWidth, centerY));
    right.push(new Phaser.Geom.Point(centerX + halfWidth, centerY));
  }
  graphics.fillStyle(0x78bad4, 0.95);
  graphics.fillPoints([...left, ...right.reverse()], true);
  graphics.lineStyle(1, 0xe0f7ff, 0.8);
  graphics.beginPath();
  graphics.moveTo(rootX - 1, rootY + 1);
  for (let step = 1; step <= 6; step++) {
    const t = step / 6;
    graphics.lineTo(rootX + bend * t * t - 1, rootY + height * t);
  }
  graphics.strokePath();
}

function polarBloom(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  petals: number,
  color: number,
): void {
  for (let petal = 0; petal < petals; petal++) {
    const angle = petal * Math.PI * 2 / petals;
    const spread = Math.PI / petals * 0.62;
    const tipX = cx + Math.cos(angle) * radius;
    const tipY = cy + Math.sin(angle) * radius;
    graphics.fillStyle(color, petal % 2 === 0 ? 0.92 : 0.72);
    graphics.fillTriangle(
      cx + Math.cos(angle - spread) * 2,
      cy + Math.sin(angle - spread) * 2,
      tipX,
      tipY,
      cx + Math.cos(angle + spread) * 2,
      cy + Math.sin(angle + spread) * 2,
    );
    graphics.fillCircle(cx + Math.cos(angle) * radius * 0.55, cy + Math.sin(angle) * radius * 0.55, 2);
  }
  graphics.fillStyle(0x261329, 1);
  graphics.fillCircle(cx, cy, 3);
  graphics.fillStyle(0xd9ef72, 0.9);
  graphics.fillCircle(cx, cy, 1);
}

function serpentFace(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  const outline = [
    [cx, cy - 10], [cx + 8, cy - 4], [cx + 6, cy + 7],
    [cx, cy + 11], [cx - 6, cy + 7], [cx - 8, cy - 4],
  ].map(([x, y]) => new Phaser.Geom.Point(x, y));
  graphics.fillStyle(0x438b50, 1);
  graphics.fillPoints(outline, true);
  graphics.fillStyle(0x73cf7d, 0.9);
  graphics.fillTriangle(cx - 7, cy - 4, cx - 2, cy - 7, cx - 3, cy + 1);
  graphics.fillTriangle(cx + 7, cy - 4, cx + 2, cy - 7, cx + 3, cy + 1);
  graphics.fillStyle(0xf4c84c, 1);
  graphics.fillCircle(cx - 3, cy - 2, 1);
  graphics.fillCircle(cx + 3, cy - 2, 1);
  graphics.fillStyle(0xe8e1bf, 0.95);
  graphics.fillTriangle(cx - 5, cy + 5, cx - 2, cy + 5, cx - 4, cy + 10);
  graphics.fillTriangle(cx + 5, cy + 5, cx + 2, cy + 5, cx + 4, cy + 10);
  graphics.lineStyle(1, 0xd44f94, 1);
  graphics.lineBetween(cx, cy + 7, cx, cy + 13);
  graphics.lineBetween(cx, cy + 13, cx - 2, cy + 15);
  graphics.lineBetween(cx, cy + 13, cx + 2, cy + 15);
}

function gargoyle(graphics: Phaser.GameObjects.Graphics, cx: number, floorY: number): void {
  graphics.fillStyle(0x292635, 1);
  graphics.fillTriangle(cx - 5, floorY - 18, cx - 14, floorY - 26, cx - 8, floorY - 8);
  graphics.fillTriangle(cx + 5, floorY - 18, cx + 14, floorY - 26, cx + 8, floorY - 8);
  graphics.fillCircle(cx, floorY - 15, 7);
  graphics.fillCircle(cx, floorY - 25, 5);
  graphics.fillTriangle(cx - 5, floorY - 28, cx - 8, floorY - 34, cx - 1, floorY - 29);
  graphics.fillTriangle(cx + 5, floorY - 28, cx + 8, floorY - 34, cx + 1, floorY - 29);
  graphics.fillRect(cx - 8, floorY - 8, 6, 7);
  graphics.fillRect(cx + 2, floorY - 8, 6, 7);
  graphics.fillTriangle(cx - 8, floorY - 1, cx - 2, floorY - 1, cx - 6, floorY + 2);
  graphics.fillTriangle(cx + 8, floorY - 1, cx + 2, floorY - 1, cx + 6, floorY + 2);
  graphics.fillStyle(0xffc05d, 0.95);
  graphics.fillCircle(cx - 2, floorY - 25, 1);
  graphics.fillCircle(cx + 2, floorY - 25, 1);
  graphics.lineStyle(1, 0x625d70, 0.8);
  graphics.lineBetween(cx - 3, floorY - 20, cx + 3, floorY - 20);
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
  castPolygonShadow(graphics, points, 2.5);
  graphics.fillStyle(base, 1);
  graphics.fillPoints(points, true);
  sdfBevelField(graphics, x + 1, y + 1, width - 2, height - 2, 2.5, seed, base);
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

function generateBurningMines(scene: Phaser.Scene): void {
  const p = "skin-burning-mines";
  
  // Wall variants (0..2)
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      // Dark granite/basalt rock base
      g.fillStyle(0x111216, 1);
      g.fillRect(0, 0, 32, 32);

      // Chiseled dark granite block structure
      basaltBlock(g, 1, 1, 30, 30, 28 + variant * 5);
      g.fillStyle(0x1e2129, 0.85);
      g.fillRect(2, 2, 28, 13);
      g.fillRect(2, 16, 28, 14);

      // Mine cut highlights (subtle copper/gold specks and dark soot)
      g.fillStyle(0x383e4c, 0.6);
      g.fillRect(3, 3, 12, 1);
      g.fillRect(16, 17, 12, 1);

      // Fiery ore veins / magma cracks running through wall
      if (variant === 0) {
        // Diagonal magma seam with hot core
        g.lineStyle(2, 0xd44000, 0.9);
        g.beginPath(); g.moveTo(2, 6); g.lineTo(12, 14); g.lineTo(8, 22); g.lineTo(24, 30); g.strokePath();
        g.lineStyle(1, 0xffa000, 0.95);
        g.beginPath(); g.moveTo(3, 6); g.lineTo(12, 14); g.lineTo(9, 22); g.lineTo(24, 30); g.strokePath();
        // Gold ore flecks
        g.fillStyle(0xe5a00d, 0.9);
        g.fillRect(14, 8, 2, 2); g.fillRect(20, 18, 2, 2);
      } else if (variant === 1) {
        // Horizontal ore cut with glowing embers
        g.lineStyle(2, 0xc83200, 0.85);
        g.beginPath(); g.moveTo(0, 16); g.lineTo(14, 15); g.lineTo(32, 17); g.strokePath();
        g.lineStyle(1, 0xff7700, 0.95);
        g.beginPath(); g.moveTo(0, 16); g.lineTo(14, 15); g.lineTo(32, 17); g.strokePath();
        g.fillStyle(0xffd000, 0.85);
        g.fillRect(6, 15, 3, 1); g.fillRect(22, 16, 3, 1);
        // Copper ore nodes
        g.fillStyle(0xc27828, 0.9);
        g.fillRect(4, 6, 3, 2); g.fillRect(25, 24, 2, 2);
      } else {
        // Branching volcanic veins
        g.lineStyle(2, 0xdd4800, 0.9);
        g.beginPath(); g.moveTo(16, 0); g.lineTo(14, 12); g.lineTo(26, 20); g.lineTo(20, 32); g.strokePath();
        g.beginPath(); g.moveTo(14, 12); g.lineTo(4, 24); g.strokePath();
        g.lineStyle(1, 0xffbe00, 0.95);
        g.beginPath(); g.moveTo(16, 0); g.lineTo(14, 12); g.lineTo(26, 20); g.lineTo(20, 32); g.strokePath();
        g.fillStyle(0xffea60, 0.8);
        g.fillRect(14, 12, 2, 2); g.fillRect(5, 23, 2, 2);
      }

      // Soot / ash shading at bottom edge
      g.fillStyle(0x08090b, 0.6);
      g.fillRect(0, 30, 32, 2);
    });
  }

  // Platform (32x12): Mine shaft iron grate over glowing furnace rim
  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    // Dark iron beam framework
    g.fillStyle(0x0f1014, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x2d313b, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x565c6b, 0.85); g.fillRect(0, 0, 32, 1);
    // Industrial iron rivets
    g.fillStyle(0x8a92a3, 0.8);
    for (let x = 3; x < 32; x += 7) g.fillRect(x, 2, 2, 1);
    // Mine grate slots
    g.fillStyle(0x0a0b0e, 0.9);
    for (let x = 2; x < 32; x += 4) g.fillRect(x, 4, 2, 5);
    // Glowing heat rim along bottom lip
    g.fillStyle(0xd63e04, 0.9); g.fillRect(0, 9, 32, 2);
    g.fillStyle(0xff9100, 0.75);
    for (let x = 1; x < 32; x += 6) g.fillRect(x, 10, 3, 1);
    g.fillStyle(0x050608, lipShadowAlpha(1, 0.9, 2)); g.fillRect(0, 11, 32, 1);
  });

  // Weak Wall (32x32): Fractured mine wall with high-heat lava bursting through
  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0e0f13, 1); g.fillRect(0, 0, 32, 32);
    basaltBlock(g, 1, 1, 30, 30, 33);
    // Intense bright magma fissures
    g.lineStyle(3, 0xd43200, 0.95);
    g.beginPath(); g.moveTo(4, 2); g.lineTo(15, 12); g.lineTo(10, 22); g.lineTo(18, 30); g.strokePath();
    g.beginPath(); g.moveTo(15, 12); g.lineTo(28, 16); g.lineTo(24, 28); g.strokePath();
    g.lineStyle(1, 0xffeb3b, 1);
    g.beginPath(); g.moveTo(4, 2); g.lineTo(15, 12); g.lineTo(10, 22); g.lineTo(18, 30); g.strokePath();
    g.beginPath(); g.moveTo(15, 12); g.lineTo(28, 16); g.lineTo(24, 28); g.strokePath();
    // Magma hot spots
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(15, 12, 2); g.fillCircle(28, 16, 1.5);
  });

  // Climb (32x32): Forged iron mine ladder with heat-tempered rungs
  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x16181e, 1); g.fillRect(0, 0, 32, 32);
    // Heavy vertical iron rails
    g.fillStyle(0x090a0d, 1); g.fillRect(5, 0, 5, 32); g.fillRect(22, 0, 5, 32);
    g.fillStyle(0x3e4452, 1); g.fillRect(6, 0, 2, 32); g.fillRect(23, 0, 2, 32);
    g.fillStyle(0x737b8c, 0.7); g.fillRect(7, 0, 1, 32); g.fillRect(24, 0, 1, 32);
    // Heat-glowing rungs
    for (let y = 3; y < 32; y += 8) {
      g.fillStyle(0x942200, 1); g.fillRect(6, y, 20, 4);
      g.fillStyle(0xe65100, 1); g.fillRect(7, y + 1, 18, 2);
      g.fillStyle(0xffb74d, 0.9); g.fillRect(8, y + 1, 16, 1);
    }
  });

  // Portcullis (32x32): Heavy spiked iron mine gate with heat blistered bars
  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x090a0d, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    // Crossbeam rivets
    g.fillStyle(0x4a505e, 0.8);
    for (let x = 3; x < 30; x += 6) { g.fillRect(x, 3, 2, 2); g.fillRect(x, 27, 2, 2); }
    // Vertical forged bars with fiery heat spikes
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x22252c, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x5a6273, 0.85); g.fillRect(x + 1, 3, 1, 23);
      // Heat glow on bottom half
      g.fillStyle(0xdd3600, 0.85); g.fillRect(x, 20, 4, 9);
      g.fillStyle(0xff9800, 0.9); g.fillRect(x + 1, 22, 2, 7);
      g.fillStyle(0x121418, 1); g.fillTriangle(x, 29, x + 4, 29, x + 2, 32);
    }
  });

  // Door (32x64): Blast furnace door with glowing intake grates
  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    // Outer arch frame
    g.fillStyle(0x08090b, 1); g.fillRect(1, 4, 30, 60);
    g.fillStyle(0x1d2028, 1); g.fillRect(3, 6, 26, 56);
    // Inner iron panels
    g.fillStyle(0x121419, 1); g.fillRect(5, 9, 22, 24); g.fillRect(5, 35, 22, 25);
    // Iron banding and rivets
    g.fillStyle(0x363b47, 1); g.fillRect(3, 7, 26, 3); g.fillRect(3, 31, 26, 4); g.fillRect(3, 58, 26, 3);
    g.fillStyle(0x737b8c, 0.8);
    for (const y of [8, 32, 59]) { g.fillRect(6, y, 2, 2); g.fillRect(15, y, 2, 2); g.fillRect(24, y, 2, 2); }

    // Dual furnace glowing air intake grates
    for (const cy of [15, 41]) {
      g.fillStyle(0x0a0b0d, 1); g.fillRect(8, cy, 16, 12);
      g.fillStyle(0xd83800, 1); g.fillRect(9, cy + 1, 14, 10);
      g.fillStyle(0xffab00, 0.95); g.fillRect(10, cy + 3, 12, 6);
      g.fillStyle(0xffffff, 0.9); g.fillRect(12, cy + 5, 8, 2);
      // Iron grate bars over flame
      g.fillStyle(0x1a1d24, 1);
      for (let bx = 11; bx <= 21; bx += 4) g.fillRect(bx, cy, 2, 12);
    }
    // Heavy central locking wheel
    g.fillStyle(0x2d323e, 1); g.fillCircle(16, 33, 5);
    g.fillStyle(0x606878, 0.9); g.fillCircle(16, 33, 2);
  });

  // Backdrop (320x180): Subterranean mine vault & magma cascades
  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    // Pitch black cavern ceiling down to deep red/orange furnace haze
    g.fillStyle(0x0a090c, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x260905, 0.75); g.fillRect(0, 80, 320, 100);
    g.fillStyle(0x521206, 0.65); g.fillRect(0, 130, 320, 50);

    // Rough chiseled cavern roof stalactites
    g.fillStyle(0x13151b, 1);
    for (let x = 0; x < 320; x += 28) {
      const h = 25 + Math.abs(latticeNoise(x, 5, 89)) * 45;
      g.fillTriangle(x, 0, x + 28, 0, x + 14, h);
    }

    // Heavy iron support arches framing the mine shaft
    g.lineStyle(8, 0x181a22, 1);
    g.beginPath(); g.arc(80, 120, 70, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
    g.beginPath(); g.arc(240, 120, 70, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
    g.lineStyle(2, 0x3d4352, 0.7);
    g.beginPath(); g.arc(80, 120, 70, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
    g.beginPath(); g.arc(240, 120, 70, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();

    // Tiered basalt mine ledges and stone structures
    g.fillStyle(0x181a20, 1);
    g.fillRect(15, 100, 75, 80);
    g.fillRect(230, 105, 80, 75);
    g.fillRect(110, 135, 100, 45);

    // Glowing magma falls / cascades pouring down the center rockface
    g.fillStyle(0xc83200, 0.95);
    g.fillRect(150, 65, 8, 85);
    g.fillRect(168, 75, 6, 75);
    g.fillStyle(0xff8800, 0.9);
    g.fillRect(152, 68, 4, 82);
    g.fillRect(169, 77, 3, 73);
    g.fillStyle(0xffeb3b, 0.85);
    g.fillRect(153, 75, 2, 70);

    // Molten magma pool at the base with bright breaking heat lines
    g.fillStyle(0x942200, 1); g.fillRect(0, 150, 320, 30);
    g.fillStyle(0xe65100, 0.95); g.fillRect(0, 153, 320, 27);
    g.fillStyle(0xffa726, 0.85);
    for (let x = 0; x < 320; x += 14) {
      const y = 154 + Math.abs(latticeNoise(x, 12, 147)) * 8;
      g.fillRect(x, y, 10, 2);
    }
    g.fillStyle(0xffffff, 0.75);
    for (let x = 8; x < 320; x += 35) g.fillRect(x, 158 + (x % 7), 12, 1);

    // Hanging mine lanterns with glowing fires
    for (const lanternX of [70, 250]) {
      g.lineStyle(1, 0x5a6273, 0.8); g.lineBetween(lanternX, 40, lanternX, 85);
      g.fillStyle(0x14161c, 1); g.fillRect(lanternX - 4, 85, 8, 10);
      g.fillStyle(0xff9800, 1); g.fillCircle(lanternX, 90, 3);
      g.fillStyle(0xffeb3b, 0.9); g.fillCircle(lanternX, 90, 1.5);
    }

    // Ore cart tracks along upper ledge
    g.lineStyle(1, 0x4a505e, 0.85);
    g.lineBetween(15, 100, 90, 100);
    g.lineBetween(230, 105, 310, 105);
    // Ore cart silhouette on left ledge
    g.fillStyle(0x0b0c0f, 1); g.fillRect(40, 91, 16, 9);
    g.fillStyle(0xffb74d, 0.85); g.fillRect(42, 89, 12, 3); // Ore pile
  });

  // Decorations:
  // gong (30x24): Heavy anvil on ash block with red-hot ingot
  texture(scene, `${p}-gong`, 30, 24, (g) => {
    // Ash/stone base
    g.fillStyle(0x181a20, 1); g.fillRect(4, 18, 22, 6);
    // Anvil shape
    g.fillStyle(0x323745, 1); g.fillRect(9, 10, 12, 8); // pillar
    g.fillRect(6, 6, 18, 5); // top deck
    g.fillTriangle(6, 6, 2, 6, 6, 10); // horn
    g.fillStyle(0x606878, 0.85); g.fillRect(6, 6, 18, 1);
    // Red-hot glowing ingot on anvil deck
    g.fillStyle(0xdb3a00, 1); g.fillRect(11, 3, 8, 3);
    g.fillStyle(0xffa700, 0.95); g.fillRect(12, 4, 6, 1);
  });

  // rack (30x18): Mine cart loaded with glowing raw ore
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    // Iron rails
    g.lineStyle(1, 0x404654, 1); g.lineBetween(1, 16, 29, 16);
    // Wheels
    g.fillStyle(0x22252e, 1); g.fillCircle(7, 15, 2.5); g.fillCircle(23, 15, 2.5);
    // Cart tub
    g.fillStyle(0x181a20, 1); g.fillRect(4, 6, 22, 8);
    g.fillStyle(0x383e4b, 1); g.fillRect(4, 6, 22, 1); g.fillRect(4, 13, 22, 1);
    // Glowing gold/copper ore payload
    g.fillStyle(0xd97706, 1); g.fillCircle(11, 5, 3); g.fillCircle(15, 4, 3.5); g.fillCircle(19, 5, 3);
    g.fillStyle(0xf59e0b, 0.95); g.fillCircle(11, 4, 1.5); g.fillCircle(15, 3, 2); g.fillCircle(19, 4, 1.5);
  });

  // banner (18x40): Soot-stained leather banner with fiery emblem
  texture(scene, `${p}-banner`, 18, 40, (g) => {
    // Iron hanging bar
    g.fillStyle(0x383e4b, 1); g.fillRect(0, 0, 18, 3);
    // Soot-stained leather cloth
    g.fillStyle(0x261612, 1); g.fillRect(2, 3, 14, 30);
    g.fillTriangle(2, 33, 16, 33, 9, 39);
    // Fiery mine brand / emblem
    g.fillStyle(0xd94300, 0.95); g.fillTriangle(9, 8, 4, 22, 14, 22);
    g.fillStyle(0xffab00, 0.9); g.fillTriangle(9, 12, 6, 20, 12, 20);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(9, 17, 1.5);
  });

  // crenel (30x35): Industrial iron exhaust vent / furnace chimney emitting sparks
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    // Vent housing
    g.fillStyle(0x14161c, 1); g.fillRect(5, 12, 20, 23);
    g.fillStyle(0x2c313e, 1); g.fillRect(3, 8, 24, 4);
    g.fillStyle(0x525b6c, 0.85); g.fillRect(3, 8, 24, 1);
    // Glowing vent interior grate
    g.fillStyle(0xd83800, 0.95); g.fillRect(8, 16, 14, 15);
    g.fillStyle(0xffaa00, 0.9); g.fillRect(10, 18, 10, 11);
    g.fillStyle(0x14161c, 1);
    for (let y = 17; y < 31; y += 4) g.fillRect(8, y, 14, 2);
    // Embers / sparks rising
    g.fillStyle(0xffd54f, 0.9);
    g.fillRect(8, 5, 2, 2); g.fillRect(18, 3, 2, 2); g.fillRect(14, 1, 1.5, 1.5);
  });
}

function generateMugdulblubKeep(scene: Phaser.Scene): void {
  const p = "skin-mugdulblub-keep";
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      g.fillStyle(0x0a0f0c, 1); g.fillRect(0, 0, TILE, TILE);
      const seed = 100 + variant * 10;
      const tL = domainWarp({ x: 2, y: 2 }, seed, 2.2, 0.1);
      const tR = domainWarp({ x: 30, y: 2 }, seed + 1, 2.2, 0.1);
      const bR = domainWarp({ x: 30, y: 30 }, seed + 2, 2.2, 0.1);
      const bL = domainWarp({ x: 2, y: 30 }, seed + 3, 2.2, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));
      const base = creviceGrime(16, 16, seed) > 0.45 ? 0x223028 : 0x2e4035;
      castPolygonShadow(g, points, 2.8);
      g.fillStyle(base, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 3, 3, 26, 26, 4.5, seed, base);
      g.lineStyle(1, 0x4d6655, 0.8); g.strokePoints(points, true);
      // Slime drips
      g.fillStyle(0x6eb043, 0.85);
      for (let x = 6; x < 30; x += 8) {
        const h = 4 + Math.abs(latticeNoise(seed, x, 43)) * 12;
        g.fillTriangle(x, 2, x + 5, 2, x + 2, 2 + h);
      }
      // Layered algae curtains use independently warped hanging curves so they
      // read as wet growth instead of another masonry stripe.
      noiseCurve(g, 5, 1, 24, seed + 31, 0x39783d, 2);
      noiseCurve(g, 25, 1, 28, seed + 47, 0x4e9446, 1);
    });
  }

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x131f17, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x3d5943, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x75b84c, 0.9);
    for (let x = 2; x < 30; x += 6) g.fillTriangle(x, 10, x + 4, 10, x + 2, 12);
  });

  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0a0f0c, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x28382d, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x6bb043, 1);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(10, 22); g.lineTo(26, 28); g.strokePath();
  });

  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x19261d, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3e2b1d, 1); g.fillRect(6, 0, 3, 32); g.fillRect(23, 0, 3, 32);
    g.fillStyle(0x4a6b3b, 1);
    for (let y = 4; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });

  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x0b140e, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x27382d, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x567e40, 0.8); g.fillRect(x + 1, 3, 1, 22);
    }
  });

  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x0a0f0c, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x223027, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x4b7038, 0.85); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    g.fillStyle(0x6ab043, 0.9); g.fillCircle(16, 34, 6);
  });

  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    g.fillStyle(0x070c09, 1); g.fillRect(0, 0, 320, 180);
    // Dissolving wax-like arches
    g.fillStyle(0x152219, 1);
    for (let x = 20; x < 320; x += 80) {
      g.fillRect(x, 40, 24, 120);
      g.fillCircle(x + 12, 40, 18);
      for (let strand = 0; strand < 4; strand++) {
        noiseCurve(g, x + 3 + strand * 7, 30, 48 + strand * 8, x + strand * 17, 0x376d39, 2);
      }
    }
    // Water line across bottom with slow rising bubbles
    g.fillStyle(0x122416, 1); g.fillRect(0, 150, 320, 30);
    g.fillStyle(0x75c24e, 0.8);
    for (let b = 0; b < 15; b++) {
      const bx = (b * 23) % 320; const by = 152 + (b * 7) % 24;
      g.fillCircle(bx, by, (b % 3) + 1);
    }
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x35542b, 1); g.fillCircle(15, 12, 10);
    g.fillStyle(0x73bd4c, 0.85); g.fillCircle(15, 12, 5);
  });
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x1d2e20, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0x547a46, 1); g.lineBetween(7, 15, 7, 3); g.lineBetween(16, 15, 22, 3);
  });
  texture(scene, `${p}-banner`, 28, 38, (g) => {
    g.fillStyle(0x162419, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x2d4732, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0x66b043, 0.85); g.fillCircle(14, 16, 5);
  });
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x1d2c22, 1); g.fillRect(4, 0, 22, 28);
    g.fillTriangle(4, 28, 26, 28, 15, 35);
    g.fillStyle(0x61a83e, 0.8); g.fillRect(6, 2, 18, 4);
  });
}

function generateDjurumApproach(scene: Phaser.Scene): void {
  const p = "skin-djurum-approach";
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      const seed = 180 + variant * 17;
      g.fillStyle(0x581d1a, 1); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xb9442f, 1); g.fillRect(0, 0, 32, 10);
      g.fillStyle(0xe36b3f, 0.95);
      for (let x = 0; x < 32; x += 4) {
        const y = 2 + Math.abs(latticeNoise(x, variant, seed)) * 4;
        g.fillRect(x, y, 5, 5);
      }
      g.fillStyle(0x2d0d0d, lipShadowAlpha(1, 0.9, 2.4)); g.fillRect(0, 10, 32, 5);
      g.lineStyle(1, 0x8e2b24, 0.72); g.lineBetween(0, 20, 32, 18 + variant * 2);
    });
  }

  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-support-${variant}`, TILE, TILE, (g) => {
      const seed = 210 + variant * 23;
      g.fillStyle(variant === 1 ? 0x742820 : 0x61201c, 1); g.fillRect(0, 0, 32, 32);
      for (let y = 2; y < 32; y += 6) {
        const edge = latticeNoise(variant, y, seed) * 2;
        g.fillStyle(y % 12 === 2 ? 0xa93c2b : 0x842b23, 0.88);
        g.fillRect(edge, y, 32 - Math.max(0, edge), 3);
      }
      g.fillStyle(0xf08b58, 0.3);
      for (let speck = 0; speck < 7; speck++) {
        g.fillRect(Math.abs(latticeNoise(seed, speck, 19)) * 30, Math.abs(latticeNoise(seed, speck, 31)) * 30, 1, 1);
      }
    });
  }

  texture(scene, `${p}-overhang`, TILE, TILE, (g) => {
    g.fillStyle(0x461514, 0.96); g.fillRect(0, 24, 32, 8);
    g.fillStyle(0xb6402f, 1); g.fillRect(0, 23, 32, 4);
    g.fillStyle(0x24090a, lipShadowAlpha(1, 0.92, 2)); g.fillRect(0, 28, 32, 4);
  });

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x551b18, 1); g.fillRect(0, 3, 32, 9);
    g.fillStyle(0xcf4d32, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x29090a, 0.8); g.fillRect(0, 8, 32, 4);
  });
  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x642019, 1); g.fillRect(1, 1, 30, 30);
    g.lineStyle(2, 0xf07848, 0.9); g.lineBetween(4, 2, 14, 15); g.lineBetween(14, 15, 9, 30); g.lineBetween(14, 15, 29, 22);
  });
  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x6b3b24, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x39241b, 1); g.fillRect(6, 0, 3, 32); g.fillRect(23, 0, 3, 32);
    g.fillStyle(0xb87845, 1); for (let y = 3; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });
  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x3b2219, 0.96); g.fillRect(0, 1, 32, 6);
    for (let x = 4; x < 30; x += 6) { g.fillStyle(0x493025, 1); g.fillRect(x, 2, 4, 28); }
  });
  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x4c291d, 1); g.fillRect(2, 5, 28, 59);
    g.fillStyle(0x7c4528, 1); g.fillRect(5, 9, 22, 55);
    g.fillStyle(0xd28a48, 0.9); g.fillTriangle(9, 33, 23, 33, 16, 20);
  });

  texture(scene, `${p}-backdrop-night`, 320, 180, (g) => {
    g.fillStyle(0x19070b, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x48131b, 1); g.fillCircle(265, 38, 18);
    g.fillStyle(0x531a19, 1); g.fillTriangle(0, 180, 110, 84, 190, 180); g.fillTriangle(120, 180, 245, 104, 320, 180);
    g.fillStyle(0x8f291f, 0.72); g.fillRect(0, 150, 320, 30);
  });
  texture(scene, `${p}-backdrop-day`, 320, 180, (g) => {
    g.fillStyle(0xc76f67, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0xffcf7b, 0.96); g.fillCircle(260, 34, 15);
    g.fillStyle(0x8f2f29, 1); g.fillTriangle(0, 180, 110, 82, 190, 180); g.fillTriangle(120, 180, 245, 102, 320, 180);
    g.fillStyle(0xb83f2c, 0.94); g.fillRect(0, 151, 320, 29);
    g.fillStyle(0xe97643, 0.7); for (let x = 0; x < 320; x += 22) g.fillRect(x, 154 + x % 9, 16, 2);
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => { g.fillStyle(0x8c572f, 1); g.fillCircle(15, 12, 10); g.fillStyle(0xe4a458, 0.8); g.fillCircle(15, 12, 3); });
  texture(scene, `${p}-rack`, 30, 18, (g) => { g.fillStyle(0x4b3023, 1); g.fillRect(2, 13, 26, 4); g.lineStyle(2, 0x9a6b43, 1); g.lineBetween(7, 14, 12, 2); g.lineBetween(23, 14, 18, 2); });
  texture(scene, `${p}-banner`, 28, 38, (g) => { g.fillStyle(0x57261b, 1); g.fillRect(5, 2, 18, 29); g.fillTriangle(5, 31, 14, 38, 23, 31); g.fillStyle(0xe0a050, 0.9); g.fillCircle(14, 16, 5); });
  texture(scene, `${p}-crenel`, 30, 35, (g) => { g.fillStyle(0x5b3422, 1); g.fillTriangle(3, 35, 14, 2, 18, 35); g.fillTriangle(14, 35, 25, 10, 29, 35); });
}

function generateRimeSeaCaves(scene: Phaser.Scene): void {
  const p = "skin-rime-sea-caves";
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      g.fillStyle(0x060f17, 1); g.fillRect(0, 0, TILE, TILE);
      const seed = 200 + variant * 10;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.5, 0.12);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.5, 0.12);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.5, 0.12);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.5, 0.12);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));
      const base = creviceGrime(16, 16, seed) > 0.45 ? 0x1b2d3c : 0x273e52;
      castPolygonShadow(g, points, 2.2, 0.48);
      g.fillStyle(base, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 3.5, seed, base);
      // Frost glaze rim
      g.lineStyle(1.5, 0x75c7e8, 0.9); g.strokePoints(points, true);
      g.fillStyle(0xd6f3ff, 0.7);
      for (let s = 0; s < 4; s++) g.fillCircle(4 + s * 7, 4 + (s % 2) * 20, 1);
      frostBloom(g, variant % 2 === 0 ? 10 : 22, variant === 1 ? 10 : 21, 7, seed);
    });
  }

  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-support-${variant}`, TILE, TILE, (g) => {
      const seed = 260 + variant * 13;
      g.fillStyle(variant === 1 ? 0x172d40 : 0x102536, 1); g.fillRect(0, 0, 32, 32);
      for (let y = 2; y < 32; y += 6) {
        const shift = latticeNoise(variant, y, seed) * 2;
        g.fillStyle(y % 12 === 2 ? 0x24455c : 0x1c374b, 0.9);
        g.fillRect(1 + shift, y, 30 - Math.abs(shift), 3);
      }
      g.lineStyle(1, 0x6aa9c3, 0.5); g.lineBetween(3, 3, 27, 29);
    });
  }

  texture(scene, `${p}-overhang`, TILE, TILE, (g) => {
    g.fillStyle(0x10283a, 0.95); g.fillRect(0, 23, 32, 7);
    g.fillStyle(0x8bdcf4, 0.9); g.fillRect(0, 23, 32, 2);
    g.fillStyle(0xcdf5ff, 0.82);
    for (let x = 3; x < 31; x += 6) g.fillTriangle(x, 29, x + 4, 29, x + 2, 32);
  });

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x132536, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x75c7e8, 1); g.fillRect(0, 0, 32, 3);
    g.fillStyle(0xd6f3ff, 0.9);
    for (let x = 2; x < 30; x += 5) g.fillTriangle(x, 10, x + 3, 10, x + 1, 12);
  });

  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x060f17, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x1f364d, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x8be0ff, 1);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(16, 16); g.lineTo(12, 24); g.lineTo(28, 28); g.strokePath();
  });

  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x112333, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x274561, 1); g.fillRect(6, 0, 4, 32); g.fillRect(22, 0, 4, 32);
    g.fillStyle(0x75c7e8, 1);
    for (let y = 3; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });

  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x06111c, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x233d54, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x75c7e8, 0.85); g.fillTriangle(x, 29, x + 4, 29, x + 2, 32);
    }
  });

  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x060f17, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x1d344a, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x75c7e8, 0.9); g.fillRect(4, 20, 24, 3); g.fillRect(4, 43, 24, 3);
    g.fillStyle(0xd6f3ff, 0.95); g.fillCircle(16, 32, 5);
  });

  texture(scene, `${p}-backdrop-night`, 320, 180, (g) => {
    g.fillStyle(0x050d17, 1); g.fillRect(0, 0, 320, 180);
    // Jagged frozen sea cave mouth & ice floes
    g.fillStyle(0x13273d, 1);
    for (let x = 0; x < 320; x += 40) {
      const h = 40 + Math.abs(latticeNoise(x, 2, 11)) * 40;
      g.fillTriangle(x, 0, x + 40, 0, x + 20, h);
    }
    g.fillStyle(0x356e91, 1); g.fillRect(0, 145, 320, 35);
    g.fillStyle(0x8ae0ff, 0.85);
    for (let i = 0; i < 8; i++) g.fillRect(i * 40 + 10, 148, 22, 4);
    for (let i = 0; i < 7; i++) frostBloom(g, 24 + i * 47, 35 + (i % 3) * 28, 8 + (i % 2) * 3, 230 + i);
  });

  texture(scene, `${p}-backdrop-day`, 320, 180, (g) => {
    g.fillStyle(0x8dc4db, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0xe9f7ff, 0.85); g.fillCircle(260, 34, 16);
    g.fillStyle(0x547f9a, 1); g.fillRect(0, 132, 320, 48);
    g.fillStyle(0xcaf1ff, 0.96);
    for (let i = 0; i < 9; i++) {
      const x = i * 38 - 8;
      g.fillTriangle(x, 152, x + 34, 146 + (i % 3) * 3, x + 27, 161);
    }
    g.fillStyle(0xffffff, 0.35); g.fillRect(0, 132, 320, 2);
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x3a6a8c, 1); g.fillTriangle(5, 20, 25, 20, 15, 2);
    g.fillStyle(0x8ae0ff, 0.9); g.fillTriangle(9, 18, 21, 18, 15, 6);
  });
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x182f45, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0x75c7e8, 1); g.lineBetween(6, 14, 12, 2); g.lineBetween(24, 14, 18, 2);
  });
  texture(scene, `${p}-banner`, 28, 38, (g) => {
    g.fillStyle(0x0e2030, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x1b3c59, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0x75c7e8, 0.9); g.fillTriangle(9, 10, 19, 10, 14, 24);
  });
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x19334c, 1); g.fillRect(1, 0, 28, 5);
    frozenTusk(g, 9, 2, 30, -4);
    frozenTusk(g, 21, 2, 30, 4);
  });
}

function generateFrostJarlTomb(scene: Phaser.Scene): void {
  const p = "skin-frost-jarl-tomb";

  // Wall variants (0..2)
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      // Glacial slate base
      g.fillStyle(0x0c1c28, 1);
      g.fillRect(0, 0, 32, 32);

      const seed = 500 + variant * 14;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.6, 0.1);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.6, 0.1);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.6, 0.1);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.6, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));

      const baseColor = variant === 0 ? 0x162c3d : variant === 1 ? 0x1b364a : 0x214159;
      castPolygonShadow(g, points, 3.0, 0.65);
      g.fillStyle(baseColor, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 2.5, seed, baseColor);
      g.lineStyle(1, 0x3d6888, 0.85); g.strokePoints(points, true);

      // Frost-bloom crystals on rock surface
      frostBloom(g, 6, 6, 4, seed);
      frostBloom(g, 24, 24, 5, seed + 1);

      // Glowing silver-blue runic inscriptions
      g.lineStyle(1, 0x8cd6ff, 0.9);
      if (variant === 0) {
        g.beginPath(); g.moveTo(8, 12); g.lineTo(16, 8); g.lineTo(24, 12); g.lineTo(16, 24); g.strokePath();
      } else if (variant === 1) {
        g.beginPath(); g.moveTo(16, 6); g.lineTo(16, 26); g.moveTo(8, 14); g.lineTo(24, 14); g.strokePath();
      } else {
        g.beginPath(); g.moveTo(10, 8); g.lineTo(22, 24); g.moveTo(22, 8); g.lineTo(10, 24); g.strokePath();
      }
      g.fillStyle(0xd6f0ff, 0.95);
      g.fillCircle(16, 16, 1.5);
    });
  }

  // Platform (32x12): Frost-crusted timber planks with longship rib supports
  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x0e1821, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x36281e, 1); g.fillRect(0, 0, 32, 4); // Timber plank
    g.fillStyle(0x8cb6d4, 0.9); g.fillRect(0, 0, 32, 1); // Frost crust top
    // Longship rib brackets under beam
    g.fillStyle(0x1a2e3d, 1);
    for (let x = 3; x < 32; x += 10) g.fillTriangle(x, 4, x + 6, 4, x + 3, 11);
  });

  // Weak Wall (32x32): Shattered tomb wall revealing glowing ice crystals
  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0c1c28, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x182f42, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x64b5f6, 0.95);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    g.lineStyle(1, 0xffffff, 0.95);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    g.fillStyle(0x80d8ff, 0.9);
    g.fillTriangle(14, 14, 18, 10, 16, 18);
  });

  // Climb (32x32): Iron-shod oak burial ladder with frost rungs
  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x0c1c28, 1); g.fillRect(0, 0, 32, 32);
    // Vertical iron-shod oak beams
    g.fillStyle(0x2d1f17, 1); g.fillRect(5, 0, 5, 32); g.fillRect(22, 0, 5, 32);
    g.fillStyle(0x4a5b6c, 1); g.fillRect(5, 0, 1, 32); g.fillRect(26, 0, 1, 32);
    // Frost-crusted rungs
    for (let y = 3; y < 32; y += 8) {
      g.fillStyle(0x3d2b20, 1); g.fillRect(6, y, 20, 3);
      g.fillStyle(0xb3e5fc, 0.9); g.fillRect(6, y, 20, 1);
    }
  });

  // Portcullis (32x32): Heavy oak and iron burial grate with frosted tips
  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x09141e, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x281e18, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x4a5d6e, 0.85); g.fillRect(x + 1, 3, 1, 23);
      // Frosted spikes
      g.fillStyle(0xe1f5fe, 0.95); g.fillTriangle(x, 29, x + 4, 29, x + 2, 32);
    }
  });

  // Door (32x64): Monumental Jarl portal with twin dragon prows and glowing crest
  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x08131c, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x281f19, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x3d4e5e, 1); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    // Dragon prow carved emblem
    g.fillStyle(0x80d8ff, 0.95); g.fillTriangle(16, 26, 8, 38, 24, 38);
    g.fillStyle(0x182f42, 1); g.fillTriangle(16, 30, 11, 36, 21, 36);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(16, 33, 2);
  });

  // Backdrop (320x180): Glacial burial vault with longship ribs and aurora haze
  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    // Deep arctic night sky down to icy blue mist
    g.fillStyle(0x050c14, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x0d2233, 0.85); g.fillRect(0, 90, 320, 90);

    // Glacial ice dome roof
    g.fillStyle(0x122c42, 1);
    for (let x = 0; x < 320; x += 32) {
      const h = 25 + Math.abs(latticeNoise(x, 9, 131)) * 40;
      g.fillTriangle(x, 0, x + 32, 0, x + 16, h);
    }

    // Colossal longship hull timber ribs forming vault arches
    for (let rib = 0; rib < 5; rib++) {
      const rx = 30 + rib * 65;
      g.lineStyle(6, 0x2b1e17, 1);
      g.beginPath(); g.arc(rx, 140, 60, Math.PI * 1.15, Math.PI * 1.85); g.strokePath();
      g.lineStyle(1.5, 0x80d8ff, 0.75);
      g.beginPath(); g.arc(rx, 140, 60, Math.PI * 1.15, Math.PI * 1.85); g.strokePath();
    }

    // Snow-covered burial mound ledges
    g.fillStyle(0x132636, 1);
    g.fillRect(15, 115, 75, 65);
    g.fillRect(230, 115, 75, 65);
    g.fillRect(100, 140, 120, 40);

    // Glowing runestones standing on ledges
    for (const rsX of [50, 270]) {
      g.fillStyle(0x1f394d, 1); g.fillRect(rsX - 6, 85, 12, 30);
      g.lineStyle(1.5, 0x80d8ff, 0.95);
      g.lineBetween(rsX, 90, rsX, 110);
      g.lineBetween(rsX - 3, 97, rsX + 3, 97);
    }

    // Icy floor snow crust with aurora blue glow
    g.fillStyle(0x274966, 0.9); g.fillRect(0, 152, 320, 28);
    g.fillStyle(0x80d8ff, 0.85);
    for (let x = 0; x < 320; x += 20) {
      const y = 153 + Math.abs(latticeNoise(x, 18, 221)) * 6;
      g.fillRect(x, y, 14, 1.5);
    }
  });

  // Decorations:
  // gong (30x24): Carved runestone pillar with glowing runic inscriptions
  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x162c3d, 1); g.fillRect(10, 4, 10, 18);
    g.fillStyle(0x214159, 1); g.fillRect(8, 20, 14, 4);
    g.lineStyle(1.5, 0x80d8ff, 0.95);
    g.lineBetween(15, 6, 15, 18); g.lineBetween(12, 10, 18, 10);
  });

  // rack (30x18): Viking weapon rack with frosted battleaxes and round shields
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x2d1f17, 1); g.fillRect(2, 13, 26, 4);
    g.fillStyle(0x4a5d6e, 1); g.fillCircle(8, 9, 5); g.fillCircle(22, 9, 5);
    g.fillStyle(0x80d8ff, 0.9); g.fillCircle(8, 9, 2); g.fillCircle(22, 9, 2);
  });

  // banner (18x40): Woven clan banner with wolf heraldry and frost trim
  texture(scene, `${p}-banner`, 18, 40, (g) => {
    g.fillStyle(0x3d4e5e, 1); g.fillRect(0, 0, 18, 3);
    g.fillStyle(0x1a2e3d, 1); g.fillRect(2, 3, 14, 30);
    g.fillTriangle(2, 33, 16, 33, 9, 39);
    g.fillStyle(0x80d8ff, 0.95); g.fillTriangle(9, 10, 5, 22, 13, 22);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(9, 16, 2);
  });

  // crenel (30x35): Carved dragon-prow timber beam with rising frost particles
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x2b1e17, 1); g.fillRect(6, 10, 18, 25);
    g.fillStyle(0x80d8ff, 0.95); g.fillTriangle(15, 2, 6, 12, 24, 12);
    g.fillStyle(0xffffff, 0.9); g.fillRect(10, 1, 2, 2); g.fillRect(18, 1, 2, 2);
  });
}

function generateOvergrownZiggurat(scene: Phaser.Scene): void {
  const p = "skin-overgrown-basalt-ziggurat";
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      g.fillStyle(0x05120a, 1); g.fillRect(0, 0, TILE, TILE);
      const seed = 300 + variant * 10;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.8, 0.1);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.8, 0.1);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.8, 0.1);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.8, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));
      const base = creviceGrime(16, 16, seed) > 0.45 ? 0x18241d : 0x223328;
      castPolygonShadow(g, points, 3.2, 0.62);
      g.fillStyle(base, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 2.5, seed, base);
      g.lineStyle(1, 0x3d5945, 0.85); g.strokePoints(points, true);
      // Noise-warped vines cross the block face and sprout alternating leaves.
      noiseCurve(g, 6, 0, 31, seed + 11, 0x489654, 2, true);
      noiseCurve(g, 25, 0, 28, seed + 29, 0x62b866, 1, true);
      g.fillStyle(0x315f38, 0.75); g.fillCircle(4, 5, 3); g.fillCircle(27, 25, 4);
    });
  }

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x132117, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x386b40, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x52ab60, 0.9);
    for (let x = 2; x < 30; x += 7) g.fillTriangle(x, 10, x + 5, 10, x + 2, 12);
  });

  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x05120a, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x1f2e24, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x479653, 1);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
  });

  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x0f2115, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3b2718, 1); g.fillRect(6, 0, 4, 32); g.fillRect(22, 0, 4, 32);
    g.fillStyle(0x499655, 1);
    for (let y = 4; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });

  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x07170c, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x223628, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x459451, 0.8); g.fillRect(x + 1, 3, 1, 22);
    }
  });

  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x05120a, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x1e2e23, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x479653, 0.85); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    serpentFace(g, 16, 33);
  });

  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    g.fillStyle(0x040e08, 1); g.fillRect(0, 0, 320, 180);
    // Stepped ziggurat silhouette
    g.fillStyle(0x132619, 1);
    g.fillRect(80, 100, 160, 80);
    g.fillRect(110, 70, 100, 30);
    g.fillRect(135, 45, 50, 25);
    for (let vine = 0; vine < 8; vine++) {
      noiseCurve(g, 18 + vine * 41, 0, 62 + (vine % 3) * 18, 330 + vine, 0x285d34, 3, true);
    }
    // Jungle canopy green mist
    g.fillStyle(0x357843, 0.4); g.fillRect(0, 140, 320, 40);
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x264d2d, 1); g.fillCircle(15, 12, 10);
    polarBloom(g, 15, 12, 9, 5, 0xd44f94);
  });
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x1b2b1e, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0x469452, 1); g.lineBetween(6, 15, 16, 3); g.lineBetween(24, 15, 16, 3);
  });
  texture(scene, `${p}-banner`, 28, 38, (g) => {
    g.fillStyle(0x112115, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x234229, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0x5ebd6c, 0.9); g.fillTriangle(9, 10, 19, 10, 14, 25);
  });
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x172b1d, 1); g.fillRect(6, 0, 18, 30);
    g.fillStyle(0x4fa65b, 0.85); g.fillRect(8, 2, 14, 6);
  });
}

function generateDrownedStarCenote(scene: Phaser.Scene): void {
  const p = "skin-drowned-star-cenote";

  // Wall variants (0..2)
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      // Deep teal/navy limestone base
      g.fillStyle(0x04131a, 1);
      g.fillRect(0, 0, 32, 32);

      const seed = 350 + variant * 12;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.8, 0.1);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.8, 0.1);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.8, 0.1);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.8, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));

      const baseColor = variant === 0 ? 0x0c2733 : variant === 1 ? 0x0f3442 : 0x143e4f;
      castPolygonShadow(g, points, 3.0, 0.65);
      g.fillStyle(baseColor, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 2.5, seed, baseColor);

      // Waterline moss & cyan bioluminescent star-algae flecks
      g.lineStyle(1, 0x1e5569, 0.85);
      g.strokePoints(points, true);

      // Hanging water droplets / glowing cyan star nodes
      g.fillStyle(0x00f2d6, 0.85);
      if (variant === 0) {
        g.fillCircle(8, 10, 1.5); g.fillCircle(22, 20, 2); g.fillCircle(14, 26, 1);
      } else if (variant === 1) {
        g.fillCircle(5, 24, 2); g.fillCircle(19, 8, 1.5); g.fillCircle(27, 14, 1);
      } else {
        g.fillCircle(12, 6, 2); g.fillCircle(26, 24, 1.5); g.fillCircle(7, 18, 1);
      }

      // Wet algae moss patches
      g.fillStyle(0x00665c, 0.7);
      g.fillCircle(4, 4, 3); g.fillCircle(28, 28, 4);
    });
  }

  // Platform (32x12): Carved wet stone pier with dripping teal water
  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x061922, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x114254, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x00f2d6, 0.9);
    for (let x = 2; x < 30; x += 7) g.fillTriangle(x, 10, x + 5, 10, x + 2, 12);
    g.fillStyle(0x00a896, 0.75);
    for (let x = 4; x < 30; x += 9) g.fillRect(x, 4, 2, 6);
  });

  // Weak Wall (32x32): Fractured limestone with glowing cyan star-water bursting
  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x04131a, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x0d2f3d, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x00f2d6, 0.95);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    g.lineStyle(1, 0xffffff, 0.9);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    g.fillStyle(0x00f2d6, 0.9);
    g.fillCircle(14, 14, 2.5); g.fillCircle(8, 22, 2);
  });

  // Climb (32x32): Braided jungle roots and hanging vine ladder with glowing buds
  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x061922, 1); g.fillRect(0, 0, 32, 32);
    // Braided root cables
    g.fillStyle(0x283b2c, 1); g.fillRect(5, 0, 5, 32); g.fillRect(22, 0, 5, 32);
    g.fillStyle(0x3e5c45, 1); g.fillRect(6, 0, 3, 32); g.fillRect(23, 0, 3, 32);
    // Cross vine rungs
    g.fillStyle(0x4d7556, 1);
    for (let y = 3; y < 32; y += 8) g.fillRect(7, y, 18, 3);
    // Bioluminescent cyan flower buds on vines
    g.fillStyle(0x00f2d6, 0.95);
    for (let y = 4; y < 32; y += 8) { g.fillCircle(5, y + 1, 1.5); g.fillCircle(26, y + 1, 1.5); }
  });

  // Portcullis (32x32): Verdigris bronze gate encrusted with barnacles and moss
  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x04131a, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x133e38, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x247368, 0.85); g.fillRect(x + 1, 3, 1, 23);
      // Verdigris / barnacle spots
      g.fillStyle(0x52b8aa, 0.9); g.fillRect(x, 12 + (x % 5), 3, 2);
    }
  });

  // Door (32x64): Submerged stone vault portal carved with star-pool glyph
  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x04131a, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x0e2c38, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x1a4a5e, 0.85); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    // Glowing star-pool emblem
    g.fillStyle(0x00f2d6, 0.95); g.fillCircle(16, 33, 7);
    g.fillStyle(0x0e2c38, 1); g.fillCircle(16, 33, 4);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(16, 33, 2);
    // Radiating star points
    g.fillStyle(0x00f2d6, 0.85);
    g.fillTriangle(16, 22, 14, 27, 18, 27);
    g.fillTriangle(16, 44, 14, 39, 18, 39);
    g.fillTriangle(5, 33, 10, 31, 10, 35);
    g.fillTriangle(27, 33, 22, 31, 22, 35);
  });

  // Backdrop (320x180): Deep cenote cavern with circular overhead skylight beam
  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    // Deep abyssal navy sky down to glowing turquoise pool
    g.fillStyle(0x030d12, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x072533, 0.85); g.fillRect(0, 90, 320, 90);

    // Cavern skylight dome & stalactites
    g.fillStyle(0x091d26, 1);
    for (let x = 0; x < 320; x += 30) {
      const h = 20 + Math.abs(latticeNoise(x, 7, 112)) * 40;
      g.fillTriangle(x, 0, x + 30, 0, x + 15, h);
    }

    // Circular overhead cenote skylight (center-top)
    g.fillStyle(0x165b6e, 0.9); g.fillCircle(160, 25, 32);
    g.fillStyle(0x00f2d6, 0.8); g.fillCircle(160, 25, 22);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(160, 25, 12);

    // Volumetric skylight beam rays descending into the pool
    g.fillStyle(0x00f2d6, 0.18);
    g.fillTriangle(160, 25, 40, 180, 280, 180);
    g.fillStyle(0xffffff, 0.12);
    g.fillTriangle(160, 25, 90, 180, 230, 180);

    // Submerged stone ledges & ruins
    g.fillStyle(0x0b2936, 1);
    g.fillRect(10, 110, 70, 70);
    g.fillRect(240, 110, 70, 70);
    g.fillRect(100, 140, 120, 40);

    // Translucent glowing teal star-pool surface
    g.fillStyle(0x00a896, 0.85); g.fillRect(0, 150, 320, 30);
    g.fillStyle(0x00f2d6, 0.95); g.fillRect(0, 152, 320, 28);
    g.fillStyle(0xffffff, 0.8);
    for (let x = 0; x < 320; x += 18) {
      const y = 153 + Math.abs(latticeNoise(x, 15, 199)) * 6;
      g.fillRect(x, y, 12, 1.5);
    }

    // Floating star motes in light beam
    g.fillStyle(0x00f2d6, 0.9);
    for (let mote = 0; mote < 12; mote++) {
      const mx = 120 + Math.abs(latticeNoise(mote, 2, 77)) * 80;
      const my = 40 + Math.abs(latticeNoise(mote, 5, 88)) * 90;
      g.fillCircle(mx, my, 1.5);
    }
  });

  // Decorations:
  // gong (30x24): Star-shaped pedestal with glowing bioluminescent pearl
  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x0a2733, 1); g.fillRect(6, 16, 18, 8);
    g.fillStyle(0x134659, 1); g.fillTriangle(15, 6, 4, 18, 26, 18);
    g.fillStyle(0x00f2d6, 0.95); g.fillCircle(15, 10, 5);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(14, 9, 2);
  });

  // rack (30x18): Submerged stone altar with glowing luminescent sea-kelp
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x0b2936, 1); g.fillRect(4, 12, 22, 6);
    g.fillStyle(0x134659, 1); g.fillRect(2, 10, 26, 3);
    g.lineStyle(2, 0x00f2d6, 0.9);
    g.beginPath(); g.moveTo(6, 10); g.lineTo(9, 2); g.lineTo(12, 8); g.strokePath();
    g.beginPath(); g.moveTo(18, 10); g.lineTo(21, 1); g.lineTo(24, 7); g.strokePath();
  });

  // banner (18x40): Tattered aquamarine silk banner with starfish emblem
  texture(scene, `${p}-banner`, 18, 40, (g) => {
    g.fillStyle(0x134659, 1); g.fillRect(0, 0, 18, 3);
    g.fillStyle(0x007a78, 1); g.fillRect(2, 3, 14, 30);
    g.fillTriangle(2, 33, 16, 33, 9, 39);
    g.fillStyle(0x00f2d6, 0.95); g.fillCircle(9, 16, 5);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(9, 16, 2);
  });

  // crenel (30x35): Water-spouting stone nozzle with glowing cyan droplets
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x0b2936, 1); g.fillRect(6, 12, 18, 23);
    g.fillStyle(0x175369, 1); g.fillRect(4, 8, 22, 4);
    g.fillStyle(0x00f2d6, 0.95); g.fillCircle(15, 18, 4);
    g.fillStyle(0x00f2d6, 0.85); g.fillRect(14, 22, 2, 10); g.fillCircle(15, 33, 2);
  });
}

function generateNulnFungalGrottos(scene: Phaser.Scene): void {
  const p = "skin-nuln-fungal-grottos";
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      g.fillStyle(0x05100a, 1); g.fillRect(0, 0, TILE, TILE);
      const seed = 400 + variant * 10;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.6, 0.1);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.6, 0.1);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.6, 0.1);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.6, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));
      const base = creviceGrime(16, 16, seed) > 0.45 ? 0x15241b : 0x1f3326;
      castPolygonShadow(g, points, 2.4, 0.52);
      g.fillStyle(base, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 5, seed, base);
      g.lineStyle(1, 0x3d664a, 0.8); g.strokePoints(points, true);
      // Shelf fungi are stacked fan wedges with luminous cap rims.
      for (const shelf of [{ x: 3, y: 9, r: 6 }, { x: 23, y: 23, r: 7 }]) {
        g.fillStyle(0x347d4b, 1);
        g.fillTriangle(shelf.x, shelf.y, shelf.x + shelf.r * 2, shelf.y - 3, shelf.x + shelf.r * 2, shelf.y + 3);
        g.lineStyle(2, 0x82f29e, 0.82);
        g.lineBetween(shelf.x + 1, shelf.y, shelf.x + shelf.r * 2, shelf.y - 3);
      }
    });
  }

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x132419, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x48a862, 1); g.fillRect(0, 0, 32, 3);
    g.fillStyle(0x82f29e, 0.9);
    for (let x = 3; x < 30; x += 6) {
      g.fillRect(x, 7, 1, 4);
      g.fillCircle(x, 7, 2 + (x % 2));
    }
  });

  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x05100a, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x1c3022, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0x57cf76, 1);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(16, 16); g.lineTo(10, 24); g.lineTo(28, 28); g.strokePath();
  });

  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x0f2115, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x274a30, 1); g.fillRect(6, 0, 4, 32); g.fillRect(22, 0, 4, 32);
    g.fillStyle(0x57cf76, 1);
    for (let y = 3; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });

  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x07170c, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x1f3d27, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x57cf76, 0.85); g.fillCircle(x + 2, 15, 2);
    }
  });

  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x05100a, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x192e20, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x57cf76, 0.9); g.fillRect(4, 20, 24, 3); g.fillRect(4, 43, 24, 3);
    g.fillStyle(0x82f29e, 0.95); g.fillCircle(16, 34, 7); g.fillStyle(0x192e20, 1); g.fillCircle(16, 34, 4);
  });

  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    g.fillStyle(0x040d08, 1); g.fillRect(0, 0, 320, 180);
    // Glowing giant mushroom umbrellas
    g.fillStyle(0x143320, 1);
    for (let x = 30; x < 320; x += 70) {
      g.fillRect(x + 18, 60, 8, 120);
      g.fillCircle(x + 22, 60, 26);
    }
    g.fillStyle(0x57cf76, 0.7);
    for (let x = 30; x < 320; x += 70) g.fillCircle(x + 22, 60, 14);
    g.fillStyle(0xb5ffd0, 0.38);
    for (let spore = 0; spore < 45; spore++) {
      const sx = Math.abs(latticeNoise(spore, 7, 401)) * 320;
      const sy = 20 + Math.abs(latticeNoise(spore, 13, 409)) * 130;
      g.fillCircle(sx, sy, 1 + spore % 2);
    }
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => {
    polarBloom(g, 15, 12, 11, 7, 0x9b426f);
  });
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x192b1e, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0x57cf76, 1); g.lineBetween(7, 14, 12, 3); g.lineBetween(23, 14, 18, 3);
  });
  texture(scene, `${p}-banner`, 28, 38, (g) => {
    g.fillStyle(0x0e1c12, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x1c3b24, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0x57cf76, 0.9); g.fillCircle(14, 16, 6);
  });
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.fillStyle(0x183321, 1); g.fillRect(11, 0, 8, 26);
    g.fillStyle(0x57cf76, 0.85); g.fillCircle(15, 6, 9);
  });
}

function generateLibrariansChasm(scene: Phaser.Scene): void {
  const p = "skin-librarians-chasm";

  // Wall variants (0..2)
  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      // Abyssal mahogany / dark slate base
      g.fillStyle(0x0e0c14, 1);
      g.fillRect(0, 0, 32, 32);

      const seed = 600 + variant * 16;
      const tL = domainWarp({ x: 1, y: 1 }, seed, 1.5, 0.1);
      const tR = domainWarp({ x: 31, y: 1 }, seed + 1, 1.5, 0.1);
      const bR = domainWarp({ x: 31, y: 31 }, seed + 2, 1.5, 0.1);
      const bL = domainWarp({ x: 1, y: 31 }, seed + 3, 1.5, 0.1);
      const points = [tL, tR, bR, bL].map((pt) => new Phaser.Geom.Point(pt.x, pt.y));

      const baseColor = variant === 0 ? 0x1b1824 : variant === 1 ? 0x221e2d : 0x292436;
      castPolygonShadow(g, points, 3.0, 0.65);
      g.fillStyle(baseColor, 1);
      g.fillPoints(points, true);
      sdfBevelField(g, 2, 2, 28, 28, 2.5, seed, baseColor);
      g.lineStyle(1, 0x473e57, 0.85); g.strokePoints(points, true);

      // Bookshelf shelf inset with colorful leather book spines
      g.fillStyle(0x110e17, 0.95); g.fillRect(4, 14, 24, 12);
      g.fillStyle(0x3d271d, 1); g.fillRect(4, 24, 24, 2); // Wood shelf ledge

      // Book spines on shelf
      const bookColors = [0x8c2b2b, 0x2b598c, 0x2b8c45, 0x8c752b, 0x602b8c];
      for (let bx = 5; bx < 26; bx += 4) {
        const c = bookColors[(bx + variant * 3) % bookColors.length] ?? 0x8c2b2b;
        g.fillStyle(c, 1); g.fillRect(bx, 15, 3, 9);
        g.fillStyle(0xe6c875, 0.8); g.fillRect(bx, 17, 3, 1); // Gold foil stripe
      }
    });
  }

  // Platform (32x12): Archive bridge planking with hanging chain supports
  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x0b0912, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x2d2018, 1); g.fillRect(0, 0, 32, 4); // Dark wood planks
    g.fillStyle(0xd9ab55, 0.85); for (let x = 3; x < 32; x += 8) g.fillRect(x, 2, 2, 1); // Brass studs
    // Hanging chain brackets under platform
    g.lineStyle(1.5, 0x4a4354, 0.9);
    g.lineBetween(4, 4, 4, 12); g.lineBetween(28, 4, 28, 12);
  });

  // Weak Wall (32x32): Crumbling bookcase wall with falling paper scrolls and warm light
  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0e0c14, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x1f1a28, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0xffa726, 0.95);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    g.lineStyle(1, 0xfff3e0, 0.95);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.lineTo(8, 22); g.lineTo(26, 28); g.strokePath();
    // Loose parchment scrolls
    g.fillStyle(0xeadab9, 0.9);
    g.fillRect(12, 12, 6, 3); g.fillRect(18, 20, 5, 3);
  });

  // Climb (32x32): Chained library rolling ladder with brass rungs
  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x0e0c14, 1); g.fillRect(0, 0, 32, 32);
    // Vertical dark mahogany rails
    g.fillStyle(0x281a13, 1); g.fillRect(5, 0, 5, 32); g.fillRect(22, 0, 5, 32);
    g.fillStyle(0x4a3a2d, 1); g.fillRect(6, 0, 2, 32); g.fillRect(23, 0, 2, 32);
    // Brass rungs
    for (let y = 3; y < 32; y += 8) {
      g.fillStyle(0xcda851, 1); g.fillRect(6, y, 20, 3);
      g.fillStyle(0xffecb3, 0.9); g.fillRect(7, y, 18, 1);
    }
  });

  // Portcullis (32x32): Heavy iron archive grate with brass lockwork
  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x0a0810, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x231d2b, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0x564966, 0.85); g.fillRect(x + 1, 3, 1, 23);
      // Brass lock caps
      g.fillStyle(0xd4af37, 0.95); g.fillRect(x, 14, 4, 2);
    }
  });

  // Door (32x64): Monumental archive portal framed by bookshelf arches
  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x09070f, 1); g.fillRect(1, 5, 30, 60);
    g.fillStyle(0x231913, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x423024, 1); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    // Central brass keyhole crest & book medallion
    g.fillStyle(0xd4af37, 0.95); g.fillCircle(16, 33, 7);
    g.fillStyle(0x1a120d, 1); g.fillCircle(16, 33, 4);
    g.fillStyle(0xffe082, 0.95); g.fillRect(15, 30, 2, 6);
  });

  // Backdrop (320x180): Monumental vertical library abyss with hanging index stacks
  texture(scene, `${p}-backdrop`, 320, 180, (g) => {
    // Deep abyssal void background
    g.fillStyle(0x06050a, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0x120d1c, 0.8); g.fillRect(0, 60, 320, 120);

    // Cavern roof book arches
    g.fillStyle(0x181224, 1);
    for (let x = 0; x < 320; x += 32) {
      const h = 20 + Math.abs(latticeNoise(x, 11, 145)) * 35;
      g.fillTriangle(x, 0, x + 32, 0, x + 16, h);
    }

    // Colossal multi-tier library book stacks (vertical towers)
    for (const stack of [{ x: 15, w: 60, h: 100 }, { x: 130, w: 70, h: 120 }, { x: 240, w: 65, h: 95 }]) {
      const y = 160 - stack.h;
      g.fillStyle(0x1c1529, 1); g.fillRect(stack.x, y, stack.w, stack.h);
      // Bookshelf lines across towers
      g.fillStyle(0x3d281c, 1);
      for (let sy = y + 15; sy < y + stack.h; sy += 22) g.fillRect(stack.x + 2, sy, stack.w - 4, 3);
      // Warm yellow windows/lamps on stacks
      g.fillStyle(0xffb74d, 0.7);
      for (let sy = y + 22; sy < y + stack.h - 10; sy += 22) {
        g.fillRect(stack.x + 10, sy, 4, 6); g.fillRect(stack.x + stack.w - 14, sy, 4, 6);
      }
    }

    // Hanging iron chains across the abyss
    g.lineStyle(1.5, 0x4a4354, 0.85);
    g.lineBetween(0, 45, 320, 45);
    g.lineBetween(0, 95, 320, 95);

    // Warm candle / oil lamp lights
    for (const lx of [80, 210]) {
      g.lineStyle(1, 0x6e637d, 0.8); g.lineBetween(lx, 45, lx, 75);
      g.fillStyle(0x231d2b, 1); g.fillRect(lx - 4, 75, 8, 8);
      g.fillStyle(0xffa726, 0.95); g.fillCircle(lx, 79, 3);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(lx, 79, 1);
    }

    // Floating paper / parchment motes in air
    g.fillStyle(0xedd9b4, 0.85);
    for (let mote = 0; mote < 15; mote++) {
      const mx = Math.abs(latticeNoise(mote, 3, 51)) * 300 + 10;
      const my = Math.abs(latticeNoise(mote, 8, 92)) * 120 + 30;
      g.fillRect(mx, my, 2, 3);
    }

    // Abyssal index floor shadow
    g.fillStyle(0x06050a, 0.95); g.fillRect(0, 160, 320, 20);
  });

  // Decorations:
  // gong (30x24): Scholar's lectern with an open illuminated tome
  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x2d1f18, 1); g.fillRect(12, 12, 6, 10); // Pillar
    g.fillRect(8, 20, 14, 4); // Base
    g.fillTriangle(6, 12, 24, 12, 15, 6); // Slanted deck
    // Open illuminated book
    g.fillStyle(0xeadbb7, 0.95); g.fillRect(5, 5, 20, 6);
    g.fillStyle(0x2b598c, 1); g.fillRect(14, 5, 2, 6); // Spine
  });

  // rack (30x18): Archive scroll rack filled with rolled parchment & leather volumes
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x281a13, 1); g.fillRect(2, 12, 26, 5); // Shelf
    g.fillStyle(0xe5c687, 0.95);
    for (let rx = 5; rx < 25; rx += 5) {
      g.fillCircle(rx, 9, 2.5); g.fillStyle(0x8c2b2b, 1); g.fillRect(rx - 1, 7, 2, 4); g.fillStyle(0xe5c687, 0.95);
    }
  });

  // banner (18x40): Deep velvet scholar banner with astronomical glyphs
  texture(scene, `${p}-banner`, 18, 40, (g) => {
    g.fillStyle(0x423024, 1); g.fillRect(0, 0, 18, 3);
    g.fillStyle(0x351b47, 1); g.fillRect(2, 3, 14, 30);
    g.fillTriangle(2, 33, 16, 33, 9, 39);
    g.fillStyle(0xffca28, 0.95); g.fillCircle(9, 16, 5);
    g.fillStyle(0x351b47, 1); g.fillCircle(9, 16, 3);
    g.fillStyle(0xffca28, 0.9); g.fillCircle(9, 16, 1);
  });

  // crenel (30x35): Chained brass oil lantern emitting a warm flame glow
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    g.lineStyle(1.5, 0x4a4354, 0.9); g.lineBetween(15, 0, 15, 12);
    g.fillStyle(0x231d2b, 1); g.fillRect(8, 12, 14, 18);
    g.fillStyle(0xd4af37, 1); g.fillRect(8, 12, 14, 3); g.fillRect(8, 27, 14, 3);
    g.fillStyle(0xffb74d, 0.95); g.fillCircle(15, 20, 4);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(15, 20, 1.5);
  });
}

function generateRooftopScamper(scene: Phaser.Scene): void {
  const p = "skin-rooftop-scamper";
  for (let variant = 0; variant < 2; variant++) {
    texture(scene, `${p}-wall-${variant}`, TILE, TILE, (g) => {
      // A roof edge is one capped façade cell, never a column of shingles.
      g.fillStyle(variant === 0 ? 0x403944 : 0x383442, 1); g.fillRect(0, 0, TILE, TILE);
      g.lineStyle(1, 0x5d5360, 0.45); g.lineBetween(1, 18, 31, 18);
      if (variant === 0) {
        // Staggered rectangular shingles with bright bevels and deep lower lips.
        for (let row = 0; row < 1; row++) {
          const y = row * 16;
          const offset = row % 2 === 0 ? -4 : 0;
          for (let x = offset; x < TILE; x += 12) {
            castPolygonShadow(g, [
              new Phaser.Geom.Point(x + 1, y + 1),
              new Phaser.Geom.Point(x + 11, y + 1),
              new Phaser.Geom.Point(x + 11, y + 13),
              new Phaser.Geom.Point(x + 1, y + 13),
            ], 2, 0.62);
            g.fillStyle(0x090912, lipShadowAlpha(0, 0.95, 2));
            g.fillRect(x + 1, y + 12, 10, 4);
            g.fillStyle(0x944935, 1);
            g.fillRect(x + 1, y + 1, 10, 12);
            sdfBevelField(g, x + 1, y + 1, 10, 12, 2, 500 + row * 41 + x, 0x944935);
            g.fillStyle(0xc46953, 0.9);
            g.fillRect(x + 2, y + 2, 8, 2);
            g.lineStyle(1, 0x6b3028, 0.9);
            g.strokeRect(x + 1, y + 1, 10, 12);
          }
        }
      } else {
        // Spanish barrel tiles: convex caps alternate with concave troughs,
        // and each staggered row ends in a rounded, shadowed overhang.
        g.fillStyle(0x302b39, 1); g.fillRect(1, 1, 30, 30);
        g.fillStyle(0x383442, 1); g.fillRect(1, 14, 30, 17);
        for (let row = 0; row < 1; row++) {
          const y = row * 16;
          const offset = row % 2 === 0 ? -5 : 0;
          for (let x = offset; x < TILE; x += 10) {
            castPolygonShadow(g, [
              new Phaser.Geom.Point(x + 1, y + 1),
              new Phaser.Geom.Point(x + 9, y + 1),
              new Phaser.Geom.Point(x + 9, y + 13),
              new Phaser.Geom.Point(x + 1, y + 13),
            ], 2.5, 0.66);
            g.fillStyle(0x17141f, 0.95);
            g.fillRect(x + 8, y + 1, 3, 13);
            g.fillCircle(x + 5, y + 13, 5);
            g.fillStyle(0x944935, 1);
            g.fillRect(x + 1, y + 1, 8, 11);
            g.fillCircle(x + 5, y + 12, 4);
            g.fillStyle(0xc46953, 0.9);
            g.fillRect(x + 3, y + 2, 3, 9);
            g.lineStyle(1, 0xe08a6c, 0.75);
            g.beginPath();
            g.arc(x + 5, y + 12, 3, 0, Math.PI);
            g.strokePath();
          }
        }
      }
    });
  }

  for (let variant = 0; variant < 3; variant++) {
    texture(scene, `${p}-support-${variant}`, TILE, TILE, (g) => {
      g.fillStyle(variant === 1 ? 0x4a4045 : 0x403942, 1); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x27232e, 0.72); g.fillRect(0, 15, 32, 2);
      const offset = variant % 2 === 0 ? 0 : 8;
      g.lineStyle(1, 0x65565b, 0.62);
      for (let x = -offset; x < 32; x += 16) g.lineBetween(x, 0, x, 15);
      for (let x = offset; x < 32; x += 16) g.lineBetween(x, 17, x, 32);
      if (variant === 2) {
        g.fillStyle(0x171923, 1); g.fillRect(9, 5, 14, 20);
        g.fillStyle(0xd7a65f, 0.55); g.fillRect(11, 7, 5, 7); g.fillRect(17, 7, 4, 7);
      }
    });
  }

  texture(scene, `${p}-overhang`, TILE, TILE, (g) => {
    g.fillStyle(0x17151f, 0.92); g.fillRect(0, 24, 32, 8);
    g.fillStyle(0x944935, 1); g.fillRect(0, 23, 32, 4);
    g.fillStyle(0xd69a72, 0.82); g.fillRect(0, 23, 32, 1);
    g.fillStyle(0x090912, lipShadowAlpha(1, 0.95, 2)); g.fillRect(0, 28, 32, 4);
  });

  texture(scene, `${p}-platform`, TILE, 12, (g) => {
    g.fillStyle(0x1d1a29, 1); g.fillRect(0, 2, 32, 10);
    g.fillStyle(0x944935, 1); g.fillRect(0, 0, 32, 4);
    g.fillStyle(0xd69a72, 0.9); g.fillRect(0, 0, 32, 1);
    g.fillStyle(0x090912, lipShadowAlpha(1, 0.9, 2)); g.fillRect(0, 8, 32, 4);
  });

  texture(scene, `${p}-weak`, TILE, TILE, (g) => {
    g.fillStyle(0x0c0c18, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x423d4c, 1); g.fillRect(2, 2, 28, 28);
    g.lineStyle(2, 0xd69a72, 1);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(16, 16); g.lineTo(10, 24); g.lineTo(28, 28); g.strokePath();
  });

  texture(scene, `${p}-climb`, TILE, TILE, (g) => {
    g.fillStyle(0x161524, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x403730, 1); g.fillRect(6, 0, 4, 32); g.fillRect(22, 0, 4, 32);
    g.fillStyle(0xd69a72, 1);
    for (let y = 3; y < 32; y += 8) g.fillRect(7, y, 18, 3);
  });

  texture(scene, `${p}-portcullis`, TILE, TILE, (g) => {
    g.fillStyle(0x0c0b17, 0.95); g.fillRect(1, 1, 30, 6); g.fillRect(1, 25, 30, 5);
    for (let x = 4; x < 30; x += 6) {
      g.fillStyle(0x302d3d, 1); g.fillRect(x, 2, 4, 27);
      g.fillStyle(0xd69a72, 0.85); g.fillRect(x + 1, 3, 1, 22);
    }
  });

  texture(scene, `${p}-door`, TILE, TILE * 2, (g) => {
    g.fillStyle(0x0c0c18, 1); g.fillRect(1, 5, 30, 59);
    g.fillStyle(0x383342, 1); g.fillRect(4, 8, 24, 56);
    g.fillStyle(0x944935, 0.9); g.fillRect(4, 20, 24, 4); g.fillRect(4, 43, 24, 4);
    g.fillStyle(0xffbe73, 0.95); g.fillCircle(16, 32, 5);
  });

  texture(scene, `${p}-backdrop-night`, 320, 180, (g) => {
    g.fillStyle(0x080812, 1); g.fillRect(0, 0, 320, 180);
    // Moonlit roof ridges & chimneys
    g.fillStyle(0x1a1829, 1);
    for (let x = 0; x < 320; x += 50) {
      g.fillTriangle(x, 180, x + 50, 180, x + 25, 100);
      g.fillRect(x + 35, 90, 8, 30);
    }
    // Full moon
    g.fillStyle(0xfff2d6, 0.9); g.fillCircle(260, 45, 20);
  });

  texture(scene, `${p}-backdrop-day`, 320, 180, (g) => {
    g.fillStyle(0x8fa8bd, 1); g.fillRect(0, 0, 320, 180);
    g.fillStyle(0xdbe5e8, 0.7); g.fillCircle(55, 38, 18);
    g.fillCircle(78, 40, 13); g.fillCircle(98, 37, 17);
    g.fillStyle(0x596170, 1);
    for (let x = 0; x < 320; x += 50) {
      g.fillTriangle(x, 180, x + 50, 180, x + 25, 104 + (x % 3) * 7);
      g.fillRect(x + 35, 92, 8, 30);
    }
    g.fillStyle(0xf7dfad, 0.95); g.fillCircle(260, 35, 14);
  });

  texture(scene, `${p}-gong`, 30, 24, (g) => {
    g.fillStyle(0x54473d, 1); g.fillRect(14, 2, 2, 22);
    g.fillStyle(0xd69a72, 0.9); g.fillTriangle(6, 10, 24, 10, 15, 2);
  });
  texture(scene, `${p}-rack`, 30, 18, (g) => {
    g.fillStyle(0x292433, 1); g.fillRect(2, 13, 26, 4);
    g.lineStyle(2, 0xd69a72, 1); g.lineBetween(6, 14, 15, 3); g.lineBetween(24, 14, 15, 3);
  });
  texture(scene, `${p}-banner`, 28, 38, (g) => {
    g.fillStyle(0x171524, 1); g.fillRect(2, 0, 24, 4);
    g.fillStyle(0x573b33, 1); g.fillRect(5, 4, 18, 27); g.fillTriangle(5, 31, 14, 38, 23, 31);
    g.fillStyle(0xd69a72, 0.9); g.fillTriangle(9, 10, 19, 10, 14, 24);
  });
  texture(scene, `${p}-crenel`, 30, 35, (g) => {
    gargoyle(g, 15, 33);
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
  daytime = false,
): EnvironmentTextureKeys {
  if (!skin) return genericKeys(legacyBackdrop);

  let prefix = "";
  let wallVariantCount = 3;
  let openSky = false;
  if (skin.id === "iron-fortress") {
    prefix = "skin-iron-fortress";
    generateIronFortress(scene);
  } else if (skin.id === "burning-mines") {
    prefix = "skin-burning-mines";
    generateBurningMines(scene);
  } else if (skin.id === "mugdulblub-keep") {
    prefix = "skin-mugdulblub-keep";
    generateMugdulblubKeep(scene);
  } else if (skin.id === "djurum-approach") {
    prefix = "skin-djurum-approach";
    openSky = true;
    generateDjurumApproach(scene);
  } else if (skin.id === "rime-sea-caves") {
    prefix = "skin-rime-sea-caves";
    openSky = true;
    generateRimeSeaCaves(scene);
  } else if (skin.id === "frost-jarl-tomb") {
    prefix = "skin-frost-jarl-tomb";
    generateFrostJarlTomb(scene);
  } else if (skin.id === "overgrown-basalt-ziggurat") {
    prefix = "skin-overgrown-basalt-ziggurat";
    generateOvergrownZiggurat(scene);
  } else if (skin.id === "drowned-star-cenote") {
    prefix = "skin-drowned-star-cenote";
    generateDrownedStarCenote(scene);
  } else if (skin.id === "nuln-fungal-grottos") {
    prefix = "skin-nuln-fungal-grottos";
    generateNulnFungalGrottos(scene);
  } else if (skin.id === "librarians-chasm") {
    prefix = "skin-librarians-chasm";
    generateLibrariansChasm(scene);
  } else if (skin.id === "rooftop-scamper") {
    prefix = "skin-rooftop-scamper";
    wallVariantCount = 2;
    openSky = true;
    generateRooftopScamper(scene);
  } else {
    return genericKeys(legacyBackdrop);
  }

  return {
    wall: (variant) => `${prefix}-wall-${variant % wallVariantCount}`,
    supportWall: openSky ? (variant) => `${prefix}-support-${variant % 3}` : undefined,
    overhang: openSky ? `${prefix}-overhang` : undefined,
    climbBackdrop: openSky ? `${prefix}-support-1` : undefined,
    openSky: openSky || undefined,
    platform: `${prefix}-platform`,
    weakWall: `${prefix}-weak`,
    climb: `${prefix}-climb`,
    portcullis: `${prefix}-portcullis`,
    door: `${prefix}-door`,
    backdrop: openSky ? `${prefix}-backdrop-${daytime ? "day" : "night"}` : `${prefix}-backdrop`,
    foregroundTint: 0xffffff,
    decorations: {
      mushrooms: `${prefix}-gong`,
      bones: `${prefix}-rack`,
      banner: `${prefix}-banner`,
      stalactite: `${prefix}-crenel`,
    },
  };
}
