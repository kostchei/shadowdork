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
  } else if (skin.id === "overgrown-basalt-ziggurat") {
    prefix = "skin-overgrown-basalt-ziggurat";
    generateOvergrownZiggurat(scene);
  } else if (skin.id === "nuln-fungal-grottos") {
    prefix = "skin-nuln-fungal-grottos";
    generateNulnFungalGrottos(scene);
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
