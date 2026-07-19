/** Cohesive runtime-generated pixel art; the game remains asset-pipeline free. */

import Phaser from "phaser";
import type { ClassName } from "../engine";
import { allItems } from "../data/items";
import type { CharacterAppearance } from "./entities/appearance";
import { characterAppearanceKey } from "./entities/appearance";

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

function drawBrick(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  // Base brick color (neutral stone gray, multiply-tinted by active theme)
  g.fillStyle(0x5e6170, 1);
  g.fillRect(x, y, w, h);

  // Bevel highlight (top and left edges)
  g.fillStyle(0x868a9d, 1);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y, 1, h);

  // Shadow bevel (bottom and right edges)
  g.fillStyle(0x3e404b, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x + w - 1, y, 1, h);

  // Add deterministic rock texture noise
  for (let i = 2; i < w - 2; i += 3) {
    for (let j = 2; j < h - 2; j += 3) {
      const val = ((x + i) * 17 + (y + j) * 23) % 100;
      if (val < 16) {
        g.fillStyle(0x2e2f38, 0.45); // dark pit
        g.fillRect(x + i, y + j, 1, 1);
      } else if (val > 84) {
        g.fillStyle(0xa1a6be, 0.4); // crystal speckle
        g.fillRect(x + i, y + j, 1, 1);
      }
    }
  }
}

function stoneTile(scene: Phaser.Scene, variant: number): void {
  texture(scene, `tile-wall-${variant}`, TILE, TILE, (g) => {
    // Mortar background
    g.fillStyle(0x2c2d35, 1);
    g.fillRect(0, 0, TILE, TILE);

    if (variant === 0) {
      // Running bond bricks
      drawBrick(g, 1, 1, 30, 14);
      drawBrick(g, 1, 16, 14, 15);
      drawBrick(g, 16, 16, 15, 15);
    } else if (variant === 1) {
      // Stack bond grid blocks
      drawBrick(g, 1, 1, 14, 14);
      drawBrick(g, 16, 1, 15, 14);
      drawBrick(g, 1, 16, 14, 15);
      drawBrick(g, 16, 16, 15, 15);
    } else {
      // Large heavy block with cracks
      drawBrick(g, 1, 1, 30, 30);
      // Crack lines
      g.fillStyle(0x2c2d35, 1);
      g.fillRect(10, 1, 1, 6);
      g.fillRect(11, 7, 2, 1);
      g.fillRect(12, 8, 1, 8);
      g.fillRect(13, 16, 4, 1);
      g.fillRect(17, 17, 1, 8);
    }
  });
}

export const CHARACTER_W = 40;
export const CHARACTER_H = 36;

function drawFace(g: Phaser.GameObjects.Graphics, skin: number, bodyYOffset = 0): void {
  g.fillStyle(skin, 1);
  g.fillRect(15, 6 + bodyYOffset, 10, 9);
  g.fillStyle(0x201b20, 1);
  g.fillRect(17, 9 + bodyYOffset, 2, 2);
  g.fillRect(22, 9 + bodyYOffset, 2, 2);
}

function drawFeet(
  g: Phaser.GameObjects.Graphics,
  cls: ClassName,
  type: "idle" | "walk" | "brace",
  frame: number,
): void {
  g.fillStyle(cls === "fighter" ? 0x352b32 : cls === "thief" ? 0x20292a : cls === "priest" ? 0x473c39 : 0x282342, 1);
  if (type === "idle" || type === "brace") {
    g.fillRect(12, 30, 6, 3);
    g.fillRect(22, 30, 6, 3);
  } else if (frame === 0) {
    g.fillRect(10, 30, 6, 3);
    g.fillRect(24, 30, 6, 3);
  } else if (frame === 2) {
    g.fillRect(14, 30, 6, 3);
    g.fillRect(20, 30, 6, 3);
  } else {
    g.fillRect(17, 30, 6, 3);
  }
}

function drawShield(
  g: Phaser.GameObjects.Graphics,
  shield: CharacterAppearance["shield"],
  y: (value: number) => number,
  foreground: boolean,
  isBracing = false,
): void {
  if (shield === "none") return;
  if (isBracing) {
    if (!foreground) return;
    g.fillStyle(0x584047, 1);
    g.fillRect(10, y(-1), 20, 5);
    g.fillStyle(0xa0a7ae, 1);
    g.fillRect(11, y(0), 18, 3);
    g.fillStyle(0x71313b, 1);
    g.fillRect(18, y(0), 4, 3);
    g.fillStyle(0xe1c15c, 1);
    g.fillCircle(20, y(1), 2);
    return;
  }
  if ((shield === "readied") !== foreground) return;
  const x = shield === "stowed" ? 7 : 5;
  g.fillStyle(0x584047, 1);
  g.fillCircle(x + 5, y(21), 7);
  g.fillStyle(0xa0a7ae, 1);
  g.fillCircle(x + 5, y(21), 5);
  g.fillStyle(0x71313b, 1);
  g.fillRect(x + 3, y(17), 4, 8);
  g.fillStyle(0xe1c15c, 1);
  g.fillCircle(x + 5, y(21), 2);
}

function drawWeapon(
  g: Phaser.GameObjects.Graphics,
  appearance: CharacterAppearance,
  y: (value: number) => number,
  isBracing = false,
): void {
  if (isBracing) return;
  const metal = 0xd4d8de;
  const wood = 0x8e6138;
  switch (appearance.weapon) {
    case "spear":
      g.lineStyle(2, wood, 1);
      g.lineBetween(30, y(31), 36, y(5));
      g.fillStyle(metal, 1);
      g.fillTriangle(34, y(7), 38, y(0), 38, y(9));
      break;
    case "javelin":
      g.lineStyle(2, 0x9c6d3e, 1);
      g.lineBetween(30, y(29), 35, y(9));
      g.fillStyle(metal, 1);
      g.fillTriangle(34, y(10), 37, y(4), 37, y(12));
      break;
    case "longsword":
      g.fillStyle(0x6a432d, 1);
      g.fillRect(30, y(25), 3, 6);
      g.fillStyle(0xd4a84b, 1);
      g.fillRect(27, y(23), 8, 2);
      g.fillStyle(metal, 1);
      g.fillTriangle(29, y(23), 33, y(7), 35, y(21));
      g.fillStyle(0xf4f5f6, 1);
      g.fillRect(32, y(11), 1, 10);
      break;
    case "dagger":
      g.fillStyle(0x69422d, 1);
      g.fillRect(29, y(24), 3, 5);
      g.fillStyle(0xd7ad4b, 1);
      g.fillRect(27, y(22), 7, 2);
      g.fillStyle(metal, 1);
      g.fillTriangle(29, y(22), 34, y(15), 33, y(23));
      break;
    case "mace":
      g.fillStyle(wood, 1);
      g.fillRect(30, y(18), 3, 13);
      g.fillStyle(0x9ca4ae, 1);
      g.fillRect(28, y(12), 7, 7);
      g.fillRect(27, y(14), 9, 3);
      g.fillStyle(0xd6dce2, 1);
      g.fillRect(30, y(13), 3, 2);
      break;
    case "staff":
      g.fillStyle(wood, 1);
      g.fillRect(31, y(7), 3, 25);
      g.fillStyle(0x4b3023, 1);
      g.fillRect(33, y(10), 1, 20);
      if (appearance.className === "wizard") {
        g.fillStyle(0x55b9ca, 1);
        g.fillTriangle(28, y(7), 33, y(0), 37, y(7));
        g.fillStyle(0xb9fbff, 1);
        g.fillTriangle(32, y(5), 33, y(1), 35, y(5));
      }
      break;
  }
}

function drawArmor(
  g: Phaser.GameObjects.Graphics,
  appearance: CharacterAppearance,
  y: (value: number) => number,
): void {
  const { armor, className } = appearance;
  if (armor === "unarmored") {
    const cloth = className === "fighter" ? 0x78303a : className === "thief" ? 0x6b4a32 : className === "priest" ? 0xd7d0b0 : 0x3c438f;
    g.fillStyle(cloth, 1);
    g.fillRect(11, y(15), 18, 15);
    return;
  }
  if (armor === "leather") {
    g.fillStyle(0x5b3b2b, 1);
    g.fillRect(10, y(15), 20, 15);
    g.fillStyle(0x8a5a37, 1);
    g.fillRect(12, y(16), 16, 5);
    g.fillRect(19, y(16), 2, 13);
    g.fillStyle(0xc49a58, 1);
    g.fillRect(12, y(17), 1, 1);
    g.fillRect(27, y(17), 1, 1);
    return;
  }
  if (armor === "plate") {
    g.fillStyle(0x737b86, 1);
    g.fillRect(8, y(15), 24, 14);
    g.fillCircle(10, y(17), 4);
    g.fillCircle(30, y(17), 4);
    g.fillStyle(0xb8c0c8, 1);
    g.fillRect(11, y(15), 18, 7);
    g.fillRect(12, y(25), 4, 6);
    g.fillRect(24, y(25), 4, 6);
    g.fillStyle(0xe3e6e8, 1);
    g.fillRect(14, y(16), 12, 2);
    return;
  }
  const base = armor === "mithral" ? 0x86bfc8 : 0x69717a;
  const light = armor === "mithral" ? 0xcdfaff : 0xaab1b8;
  g.fillStyle(base, 1);
  g.fillRect(9, y(15), 22, 15);
  g.fillStyle(light, 1);
  for (let row = 16; row < 29; row += 3) {
    const start = row % 2 === 0 ? 10 : 12;
    for (let x = start; x < 30; x += 4) g.fillRect(x, y(row), 2, 1);
  }
  if (armor === "mithral") {
    g.fillStyle(0xffffff, 1);
    g.fillRect(12, y(17), 1, 1);
    g.fillRect(27, y(22), 1, 1);
  }
}

function drawClassIdentity(
  g: Phaser.GameObjects.Graphics,
  appearance: CharacterAppearance,
  bodyYOffset: number,
  y: (value: number) => number,
): void {
  const cls = appearance.className;
  const skin = cls === "fighter" || cls === "priest" ? 0xd8ad86 : 0xc99d78;
  if (cls === "fighter") {
    g.fillStyle(0x7b2632, 1);
    g.fillRect(15, y(16), 10, 14);
    g.fillStyle(0xc54b3c, 1);
    g.fillRect(16, y(16), 8, 4);
    drawFace(g, skin, bodyYOffset);
    g.fillStyle(0x8f969f, 1);
    g.fillRect(13, y(3), 14, 5);
    g.fillRect(12, y(6), 3, 6);
    g.fillRect(25, y(6), 3, 6);
    g.fillStyle(0xe0bd58, 1);
    g.fillRect(19, y(18), 3, 3);
  } else if (cls === "thief") {
    drawFace(g, skin, bodyYOffset);
    g.fillStyle(0x285a48, 1);
    g.fillTriangle(10, y(14), 20, y(1), 30, y(14));
    g.fillRect(10, y(13), 4, 16);
    g.fillRect(26, y(13), 4, 16);
    g.fillStyle(0x3c8062, 1);
    g.fillTriangle(12, y(13), 20, y(3), 28, y(13));
    g.fillStyle(0xe6d27b, 1);
    g.fillRect(17, y(10), 2, 1);
    g.fillRect(22, y(10), 2, 1);
    g.fillStyle(0x7d5438, 1);
    g.fillRect(10, y(21), 20, 3);
  } else if (cls === "priest") {
    g.fillStyle(0xd7d0b0, 1);
    g.fillRect(15, y(15), 10, 15);
    g.fillStyle(0x8e3044, 1);
    g.fillRect(14, y(21), 12, 4);
    drawFace(g, skin, bodyYOffset);
    g.fillStyle(0xe7d98a, 1);
    g.fillRect(14, y(3), 12, 4);
    g.fillRect(18, y(1), 4, 8);
  } else {
    g.fillStyle(0x3c438f, 1);
    g.fillRect(11, y(15), 18, 15);
    g.fillStyle(0x505fc1, 1);
    g.fillTriangle(10, y(8), 21, y(0), 29, y(13));
    g.fillRect(11, y(11), 18, 4);
    drawFace(g, skin, bodyYOffset);
    g.fillStyle(0xe5c85d, 1);
    g.fillRect(21, y(5), 2, 2);
    g.fillRect(15, y(21), 3, 3);
  }
  g.fillStyle(skin, 1);
  g.fillRect(28, y(20), 4, 4);
}

function drawCharacterFrame(
  g: Phaser.GameObjects.Graphics,
  appearance: CharacterAppearance,
  type: "idle" | "walk" | "brace",
  frame: number,
): void {
  // Determine body bounce offset
  let bodyYOffset = 0;
  if (type === "idle" && frame === 1) {
    bodyYOffset = 1;
  } else if (type === "walk" && (frame === 1 || frame === 3)) {
    bodyYOffset = -1;
  } else if (type === "brace") {
    bodyYOffset = 4;
  }

  const y = (val: number) => val + bodyYOffset;
  const bracing = type === "brace";
  drawShield(g, appearance.shield, y, false, bracing);
  drawWeapon(g, appearance, y, bracing);
  drawFeet(g, appearance.className, type, frame);
  drawArmor(g, appearance, y);
  drawClassIdentity(g, appearance, bodyYOffset, y);
  drawShield(g, appearance.shield, y, true, bracing);
}

export function ensureCharacterAppearance(scene: Phaser.Scene, appearance: CharacterAppearance): string {
  const key = characterAppearanceKey(appearance);
  if (!scene.textures.exists(`${key}-idle-0`)) {
    for (let f = 0; f < 2; f++) {
      texture(scene, `${key}-idle-${f}`, CHARACTER_W, CHARACTER_H, (g) => drawCharacterFrame(g, appearance, "idle", f));
    }
    for (let f = 0; f < 4; f++) {
      texture(scene, `${key}-walk-${f}`, CHARACTER_W, CHARACTER_H, (g) => drawCharacterFrame(g, appearance, "walk", f));
    }
    texture(scene, `${key}-brace-0`, CHARACTER_W, CHARACTER_H, (g) => drawCharacterFrame(g, appearance, "brace", 0));
  }
  if (!scene.anims.exists(`${key}-idle`)) {
    scene.anims.create({
      key: `${key}-brace`,
      frames: [{ key: `${key}-brace-0` }],
      frameRate: 1,
      repeat: -1,
    });
    scene.anims.create({
      key: `${key}-idle`,
      frames: [0, 1].map((f) => ({ key: `${key}-idle-${f}` })),
      frameRate: 3,
      repeat: -1,
    });
    scene.anims.create({
      key: `${key}-walk`,
      frames: [0, 1, 2, 3].map((f) => ({ key: `${key}-walk-${f}` })),
      frameRate: 8,
      repeat: -1,
    });
  }
  return key;
}

function characterTextures(scene: Phaser.Scene): void {
  const defaults: readonly CharacterAppearance[] = [
    { className: "fighter", armor: "chain", weapon: "spear", shield: "none" },
    { className: "thief", armor: "leather", weapon: "dagger", shield: "none" },
    { className: "priest", armor: "chain", weapon: "mace", shield: "readied" },
    { className: "wizard", armor: "unarmored", weapon: "staff", shield: "none" },
  ];
  for (const appearance of defaults) {
    ensureCharacterAppearance(scene, appearance);
    texture(scene, `char-${appearance.className}`, CHARACTER_W, CHARACTER_H, (g) =>
      drawCharacterFrame(g, appearance, "idle", 0));
  }
}

function drawMonsterFrame(g: Phaser.GameObjects.Graphics, id: string, type: "idle" | "walk", frame: number): void {
  let bodyYOffset = 0;
  if (type === "idle" && frame === 1) {
    bodyYOffset = 1;
  } else if (type === "walk" && (frame === 1 || frame === 3)) {
    bodyYOffset = -1;
  }
  const y = (val: number) => val + bodyYOffset;

  if (id === "goblin") {
    // Draw feet
    g.fillStyle(0x2e3b25, 1);
    if (type === "idle" || frame === 1 || frame === 3) {
      g.fillRect(5, 19, 5, 5);
      g.fillRect(13, 19, 5, 5);
    } else if (frame === 0) {
      g.fillRect(3, 19, 5, 5);
      g.fillRect(15, 19, 5, 5);
    } else {
      g.fillRect(7, 19, 5, 5);
      g.fillRect(11, 19, 5, 5);
    }

    g.fillStyle(0x537c3b, 1);
    g.fillRect(4, y(7), 15, 13);
    g.fillTriangle(0, y(5), 7, y(8), 5, y(13));
    g.fillTriangle(22, y(5), 16, y(8), 18, y(13));
    g.fillStyle(0xb5c84d, 1);
    g.fillRect(6, y(10), 3, 2);
    g.fillRect(14, y(10), 3, 2);
    g.fillStyle(0x6b2931, 1);
    g.fillRect(8, y(15), 7, 2);
    g.fillStyle(0x9c713f, 1);
    g.fillRect(18, y(13), 3, 10);
  } else if (id === "skeleton") {
    // Draw feet
    g.fillStyle(0xa9a995, 1);
    if (type === "idle" || frame === 1 || frame === 3) {
      g.fillRect(7, 25, 3, 5);
      g.fillRect(15, 25, 3, 5);
    } else if (frame === 0) {
      g.fillRect(5, 25, 3, 5);
      g.fillRect(17, 25, 3, 5);
    } else {
      g.fillRect(9, 25, 3, 5);
      g.fillRect(13, 25, 3, 5);
    }

    g.fillStyle(0xa9a995, 1);
    g.fillRect(10, y(13), 5, 12);
    g.fillRect(5, y(15), 15, 3);
    g.fillStyle(0xe2dfc6, 1);
    g.fillRect(5, y(2), 15, 12);
    g.fillRect(7, y(0), 11, 2);
    g.fillStyle(0x27242a, 1);
    g.fillRect(8, y(5), 3, 4);
    g.fillRect(15, y(5), 3, 4);
    g.fillRect(10, y(11), 6, 2);
    g.fillStyle(0x727067, 1);
    g.fillRect(7, y(19), 12, 2);
    g.fillRect(8, y(23), 10, 2);
  } else if (id === "giant-rat") {
    // Draw feet
    g.fillStyle(0x302527, 1);
    if (type === "idle" || frame === 1 || frame === 3) {
      g.fillRect(9, 15, 4, 2);
      g.fillRect(19, 15, 4, 2);
    } else if (frame === 0) {
      g.fillRect(7, 15, 4, 2);
      g.fillRect(21, 15, 4, 2);
    } else {
      g.fillRect(11, 15, 4, 2);
      g.fillRect(17, 15, 4, 2);
    }

    g.lineStyle(2, 0x8c6b57, 1);
    g.beginPath();
    g.arc(23, y(10), 8, -0.6, 1.8);
    g.strokePath();
    g.fillStyle(0x5f493e, 1);
    g.fillEllipse(13, y(10), 22, 13);
    g.fillStyle(0x8a6b5b, 1);
    g.fillTriangle(5, y(6), 8, y(0), 11, y(6));
    g.fillStyle(0xf05b62, 1);
    g.fillRect(5, y(7), 2, 2);
    g.fillStyle(0xcda58d, 1);
    g.fillRect(0, y(11), 5, 2);
  } else if (id === "gloom-ogre") {
    // Draw feet
    g.fillStyle(0x312637, 1);
    if (type === "idle" || frame === 1 || frame === 3) {
      g.fillRect(6, 45, 12, 7);
      g.fillRect(27, 45, 12, 7);
    } else if (frame === 0) {
      g.fillRect(3, 45, 12, 7);
      g.fillRect(30, 45, 12, 7);
    } else {
      g.fillRect(9, 45, 12, 7);
      g.fillRect(24, 45, 12, 7);
    }

    g.fillStyle(0x584065, 1);
    g.fillRect(4, y(17), 36, 28);
    g.fillRect(0, y(21), 8, 22);
    g.fillRect(36, y(21), 8, 22);
    g.fillStyle(0x765784, 1);
    g.fillRect(7, y(3), 30, 23);
    g.fillTriangle(5, y(8), 12, y(0), 14, y(9));
    g.fillTriangle(39, y(8), 32, y(0), 30, y(9));
    g.fillStyle(0xd7dd58, 1);
    g.fillRect(12, y(10), 6, 5);
    g.fillRect(27, y(10), 6, 5);
    g.fillStyle(0x241b28, 1);
    g.fillRect(13, y(12), 3, 3);
    g.fillRect(29, y(12), 3, 3);
    g.fillRect(13, y(20), 20, 4);
    g.fillStyle(0xc8bd9a, 1);
    g.fillTriangle(15, y(20), 19, y(20), 17, y(25));
    g.fillTriangle(27, y(20), 31, y(20), 29, y(25));
    g.fillStyle(0x9d6b3e, 1);
    g.fillRect(2, y(32), 40, 5);
  }
}

function monsterTextures(scene: Phaser.Scene): void {
  const monsters = ["goblin", "skeleton", "giant-rat", "gloom-ogre"];
  const dimensions: Record<string, { w: number; h: number }> = {
    goblin: { w: 22, h: 24 },
    skeleton: { w: 24, h: 30 },
    "giant-rat": { w: 28, h: 17 },
    "gloom-ogre": { w: 44, h: 52 },
  };
  for (const mon of monsters) {
    const dim = dimensions[mon]!;
    texture(scene, `monster-${mon}`, dim.w, dim.h, (g) => drawMonsterFrame(g, mon, "idle", 0));
    for (let f = 0; f < 2; f++) {
      texture(scene, `monster-${mon}-idle-${f}`, dim.w, dim.h, (g) => drawMonsterFrame(g, mon, "idle", f));
    }
    for (let f = 0; f < 4; f++) {
      texture(scene, `monster-${mon}-walk-${f}`, dim.w, dim.h, (g) => drawMonsterFrame(g, mon, "walk", f));
    }
  }
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
  texture(scene, "tile-portcullis", TILE, TILE, (g) => {
    g.fillStyle(0x242733, 0.9);
    g.fillRect(2, 1, 28, 5);
    g.fillRect(2, 27, 28, 4);
    g.fillStyle(0x8e94a3, 1);
    for (let x = 5; x < 30; x += 6) {
      g.fillRect(x, 3, 3, 27);
      g.fillStyle(0xc3c8d1, 0.72);
      g.fillRect(x, 4, 1, 24);
      g.fillStyle(0x8e94a3, 1);
    }
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

  backdropTextures(scene);

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

/** Circle that wraps across the tile's vertical edges so tileSprites seam cleanly. */
function wrapCircle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  tileW: number,
): void {
  const wx = ((x % tileW) + tileW) % tileW;
  g.fillCircle(wx, y, r);
  if (wx < r) g.fillCircle(wx + tileW, y, r);
  if (wx > tileW - r) g.fillCircle(wx - tileW, y, r);
}

/**
 * Math-built parallax backdrops, one per dungeon theme. All are drawn in
 * neutral grey-blues so the theme's stoneTint colours them at render time.
 */
function backdropTextures(scene: Phaser.Scene): void {
  const W = 320;
  const H = 180;

  // Endless corridor of columns receding to a one-point vanishing band.
  texture(scene, "bg-columns", W, H, (g) => {
    const rows = 6;
    const counts = [16, 10, 8, 5, 4, 2]; // each divides 320 → seamless tiling
    const midY = 86;
    for (let k = 0; k < rows; k++) {
      const t = k / (rows - 1); // 0 = deepest, 1 = nearest
      const count = counts[rows - 1 - k]!;
      const spacing = W / count;
      const halfH = 12 + t * t * 74;
      const width = 2 + t * t * 13;
      const shade = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(58, 63, 82),
        new Phaser.Display.Color(150, 158, 186),
        1,
        t,
      );
      const color = Phaser.Display.Color.GetColor(shade.r, shade.g, shade.b);
      const alpha = 0.16 + t * 0.4;
      for (let i = 0; i < count; i++) {
        const jitter = ((k * 31 + i * 17) % 7) - 3;
        const cx = i * spacing + (k % 2 === 0 ? spacing / 2 : 0);
        const top = midY - halfH + jitter;
        g.fillStyle(color, alpha);
        g.fillRect(cx - width / 2, top, width, halfH * 2);
        // Capital and base read only on the near rows.
        if (t > 0.4) {
          g.fillRect(cx - width / 2 - 2, top, width + 4, 3);
          g.fillRect(cx - width / 2 - 2, top + halfH * 2 - 3, width + 4, 3);
          // Fluting shadow line
          g.fillStyle(0x1c2030, alpha * 0.8);
          g.fillRect(cx + width / 2 - 2, top + 3, 1, halfH * 2 - 6);
        }
      }
    }
    // Faint glow at the vanishing band — the corridor never quite ends.
    g.fillStyle(0xaab4d0, 0.06);
    g.fillEllipse(W / 2, midY, W * 0.9, 26);
    g.fillEllipse(W / 2, midY, W * 0.5, 14);
  });

  texture(scene, "bg-greek-temple", W, H, (g) => {
    type Order = "doric" | "ionic" | "corinthian";
    const drawColumn = (
      cx: number,
      baseY: number,
      height: number,
      baseWidth: number,
      order: Order,
      alpha: number,
    ): void => {
      const fluteCount = order === "doric" ? 20 : 24;
      const taper = order === "doric" ? 0.15 : order === "ionic" ? 0.1 : 0.05;
      const topY = baseY - height;
      const topWidth = baseWidth * (1 - taper);
      const light = 0x9aa4bf;
      const shadow = 0x353b52;

      g.fillStyle(light, alpha);
      g.fillTriangle(cx - baseWidth / 2, baseY, cx + baseWidth / 2, baseY, cx + topWidth / 2, topY);
      g.fillTriangle(cx - baseWidth / 2, baseY, cx + topWidth / 2, topY, cx - topWidth / 2, topY);

      const fluteStep = Math.max(2, Math.floor(baseWidth / (fluteCount / 2)));
      g.fillStyle(shadow, alpha * 0.72);
      for (let x = cx - baseWidth / 2 + fluteStep; x < cx + baseWidth / 2; x += fluteStep) {
        const progress = (x - (cx - baseWidth / 2)) / baseWidth;
        const shaftTopX = cx - topWidth / 2 + progress * topWidth;
        g.fillTriangle(x, baseY - 2, x + 1, baseY - 2, shaftTopX, topY + 3);
      }

      g.fillStyle(light, alpha * 1.12);
      g.fillRect(cx - topWidth / 2 - 3, topY - 4, topWidth + 6, 3);
      g.fillRect(cx - baseWidth / 2 - 3, baseY - 3, baseWidth + 6, 3);
      if (order !== "doric") g.fillRect(cx - topWidth / 2 - 5, topY - 7, topWidth + 10, 2);
      if (order === "corinthian") {
        g.fillStyle(light, alpha * 0.65);
        g.fillCircle(cx - topWidth / 3, topY - 7, 2);
        g.fillCircle(cx + topWidth / 3, topY - 7, 2);
      }
    };
    const drawPediment = (cx: number, baseY: number, span: number, pitchDegrees: number, alpha: number): void => {
      const peakHeight = (span / 2) * Math.tan((pitchDegrees * Math.PI) / 180);
      g.fillStyle(0x8f99b4, alpha);
      g.fillTriangle(cx - span / 2, baseY, cx + span / 2, baseY, cx, baseY - peakHeight);
      g.fillStyle(0x30364c, alpha * 0.8);
      g.fillTriangle(cx - span / 2 + 3, baseY - 2, cx + span / 2 - 3, baseY - 2, cx, baseY - peakHeight + 4);
      g.fillStyle(0xaab4d0, alpha * 0.9);
      g.fillRect(cx - span / 2 - 2, baseY, span + 4, 3);
    };

    for (const temple of [
      { cx: 80, baseY: 166, span: 136, height: 86, order: "doric" as const, alpha: 0.38 },
      { cx: 248, baseY: 160, span: 112, height: 68, order: "ionic" as const, alpha: 0.3 },
    ]) {
      drawPediment(temple.cx, temple.baseY - temple.height - 7, temple.span, 14, temple.alpha);
      for (let index = -2; index <= 2; index++) {
        drawColumn(temple.cx + index * (temple.span / 5), temple.baseY, temple.height, 13, temple.order, temple.alpha);
      }
    }

    drawColumn(0, H, 112, 24, "corinthian", 0.28);
    drawColumn(W, H, 112, 24, "corinthian", 0.28);
  });

  // Fractal stepped pyramids and a nested-square frieze.
  texture(scene, "bg-aztec", W, H, (g) => {
    const pyramid = (cx: number, baseY: number, baseW: number, tiers: number, alpha: number) => {
      const tierH = Math.max(3, Math.round(baseW / (tiers * 3)));
      for (let s = 0; s < tiers; s++) {
        const w = baseW * (1 - s / tiers);
        g.fillStyle(s % 2 === 0 ? 0x8a92ac : 0x6a7290, alpha);
        g.fillRect(cx - w / 2, baseY - (s + 1) * tierH, w, tierH);
      }
      // Doorway
      g.fillStyle(0x14161e, alpha);
      g.fillRect(cx - baseW * 0.04, baseY - tierH * 1.6, baseW * 0.08, tierH * 1.6);
    };
    // Three fractal generations; the outermost pair sits at x=0 AND x=320 so
    // the silhouette wraps seamlessly.
    pyramid(W / 2, H, 230, 7, 0.34);
    pyramid(W * 0.14, H, 120, 5, 0.24);
    pyramid(W * 0.86, H, 120, 5, 0.24);
    pyramid(0, H, 70, 4, 0.18);
    pyramid(W, H, 70, 4, 0.18);
    pyramid(W * 0.34, H, 46, 3, 0.14);
    pyramid(W * 0.66, H, 46, 3, 0.14);

    // Nested-square frieze band across the top (spacing divides 320).
    const nested = (cx: number, cy: number, size: number, depth: number, alpha: number) => {
      g.lineStyle(1, 0x9aa2bc, alpha);
      g.strokeRect(cx - size / 2, cy - size / 2, size, size);
      if (depth > 0) {
        g.strokeRect(cx - size / 4, cy - size / 4, size / 2, size / 2);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          nested(cx + (dx * size) / 2, cy + (dy * size) / 2, size / 3, depth - 1, alpha * 0.7);
        }
      }
    };
    for (let i = 0; i < 8; i++) nested(i * 40 + 20, 26, 15, 1, 0.3);
  });

  texture(scene, "bg-natural-caverns", W, H, (g) => {
    const rock = 0x8594a8;
    const shadow = 0x293448;
    const highlight = 0xb2c1cf;
    const drawStalactite = (cx: number, topY: number, height: number, radius: number, rings: number, alpha: number): void => {
      const steps = 18;
      for (let step = 0; step < steps; step++) {
        const t1 = step / steps;
        const t2 = (step + 1) / steps;
        const r1 = radius * Math.pow(1 - t1, 0.75) * (1 + Math.sin(t1 * Math.PI * rings) * 0.045);
        const r2 = radius * Math.pow(1 - t2, 0.75) * (1 + Math.sin(t2 * Math.PI * rings) * 0.045);
        const y1 = topY + height * t1;
        const y2 = topY + height * t2;
        g.fillStyle(rock, alpha);
        g.fillTriangle(cx - r1, y1, cx + r1, y1, cx - r2, y2);
        g.fillTriangle(cx + r1, y1, cx + r2, y2, cx - r2, y2);
        g.fillStyle(shadow, alpha * 0.55);
        g.fillTriangle(cx + r1 * 0.18, y1, cx + r1, y1, cx + r2, y2);
      }
    };
    const drawStalagmite = (cx: number, baseY: number, height: number, radius: number, shapeRatio: number, alpha: number): void => {
      const steps = 16;
      for (let step = 0; step < steps; step++) {
        const t1 = step / steps;
        const t2 = (step + 1) / steps;
        const r1 = radius * Math.pow(1 - t1, shapeRatio);
        const r2 = radius * Math.pow(1 - t2, shapeRatio);
        const y1 = baseY - height * t1;
        const y2 = baseY - height * t2;
        g.fillStyle(rock, alpha);
        g.fillTriangle(cx - r1, y1, cx + r1, y1, cx - r2, y2);
        g.fillTriangle(cx + r1, y1, cx + r2, y2, cx - r2, y2);
        g.fillStyle(highlight, alpha * 0.25);
        g.fillTriangle(cx - r1 * 0.62, y1, cx - r1 * 0.12, y1, cx - r2 * 0.12, y2);
      }
    };
    const drawDrapery = (leftX: number, topY: number, width: number, height: number, folds: number, alpha: number): void => {
      const strips = Math.ceil(width / 4);
      for (let strip = 0; strip < strips; strip++) {
        const t1 = strip / strips;
        const t2 = (strip + 1) / strips;
        const x1 = leftX + width * t1;
        const x2 = leftX + width * t2;
        const wave1 = Math.sin(t1 * Math.PI * folds) * height * 0.12;
        const wave2 = Math.sin(t2 * Math.PI * folds) * height * 0.12;
        const lower1 = topY + height * (0.72 + 0.28 * t1) + wave1;
        const lower2 = topY + height * (0.72 + 0.28 * t2) + wave2;
        g.fillStyle(strip % 2 === 0 ? rock : shadow, alpha);
        g.fillTriangle(x1, topY + t1 * height * 0.12, x2, topY + t2 * height * 0.12, x1, lower1);
        g.fillTriangle(x2, topY + t2 * height * 0.12, x2, lower2, x1, lower1);
      }
    };
    const drawColumn = (cx: number, topY: number, bottomY: number, width: number, alpha: number): void => {
      const steps = 20;
      for (let step = 0; step < steps; step++) {
        const t1 = step / steps;
        const t2 = (step + 1) / steps;
        const r1 = width * (0.62 + 0.38 * Math.pow(Math.abs(t1 - 0.5) * 2, 0.8));
        const r2 = width * (0.62 + 0.38 * Math.pow(Math.abs(t2 - 0.5) * 2, 0.8));
        const y1 = topY + (bottomY - topY) * t1;
        const y2 = topY + (bottomY - topY) * t2;
        g.fillStyle(rock, alpha);
        g.fillTriangle(cx - r1, y1, cx + r1, y1, cx - r2, y2);
        g.fillTriangle(cx + r1, y1, cx + r2, y2, cx - r2, y2);
      }
      g.fillStyle(highlight, alpha * 0.28);
      g.fillRect(cx - width * 0.5, topY + 5, 2, bottomY - topY - 10);
    };

    drawDrapery(22, 0, 88, 74, 4.5, 0.24);
    drawDrapery(204, 0, 74, 60, 3.5, 0.2);
    drawStalactite(8, 0, 82, 19, 6, 0.35);
    drawStalactite(142, 0, 60, 14, 4, 0.3);
    drawStalactite(316, 0, 96, 23, 7, 0.36);
    drawStalagmite(40, H, 64, 22, 0.65, 0.34);
    drawStalagmite(170, H, 78, 17, 1.1, 0.35);
    drawStalagmite(285, H, 52, 25, 1.8, 0.3);
    drawColumn(118, 58, H, 15, 0.25);
    drawColumn(228, 72, H, 12, 0.2);
    for (let ridge = 0; ridge < 5; ridge++) {
      const x = 56 + ridge * 51;
      g.fillStyle(highlight, 0.11 + (ridge % 2) * 0.025);
      g.fillTriangle(x - 18, H, x + 16, H, x + Math.sin(ridge * 2.1) * 9, H - 34 - (ridge % 3) * 8);
    }
  });

  // Tentacle swirls: logarithmic spirals plus sine-wave feelers from below.
  texture(scene, "bg-eldritch-depths", W, H, (g) => {
    const drawImpossibleFrame = (cx: number, cy: number, size: number, phase: number, alpha: number): void => {
      for (let depth = 0; depth < 4; depth++) {
        const scale = 1 - depth * 0.2;
        const half = size * scale * 0.5;
        const skew = Math.sin(phase + depth * 1.7) * size * 0.13;
        const lift = depth * size * 0.045;
        g.lineStyle(Math.max(1, 4 - depth), depth % 2 === 0 ? 0x91b6c4 : 0x425d70, alpha * (1 - depth * 0.12));
        g.beginPath();
        g.moveTo(cx - half + skew, cy + half - lift);
        g.lineTo(cx - half - skew, cy - half - lift);
        g.lineTo(cx + half + skew, cy - half + lift);
        g.lineTo(cx + half - skew, cy + half + lift);
        g.closePath();
        g.strokePath();
      }
      g.fillStyle(0x182d3c, alpha * 0.9);
      g.fillTriangle(cx - size * 0.5, cy + size * 0.5, cx - size * 0.25, cy + size * 0.31, cx + size * 0.42, cy + size * 0.5);
      g.fillStyle(0x9abfcc, alpha * 0.7);
      g.fillTriangle(cx + size * 0.5, cy - size * 0.5, cx + size * 0.25, cy - size * 0.31, cx - size * 0.42, cy - size * 0.5);
    };
    const drawImpossibleTriangle = (cx: number, cy: number, size: number, alpha: number): void => {
      const height = size * 0.84;
      g.lineStyle(7, 0x283f50, alpha);
      g.beginPath();
      g.moveTo(cx, cy - height / 2);
      g.lineTo(cx + size / 2, cy + height / 2);
      g.lineTo(cx - size / 2, cy + height / 2);
      g.closePath();
      g.strokePath();
      g.lineStyle(2, 0xa1c5ce, alpha * 0.72);
      g.beginPath();
      g.moveTo(cx, cy - height / 2);
      g.lineTo(cx + size / 2, cy + height / 2);
      g.lineTo(cx - size / 2, cy + height / 2);
      g.closePath();
      g.strokePath();
      g.fillStyle(0x283f50, alpha);
      g.fillTriangle(cx - 5, cy - height / 2 - 2, cx + 7, cy - height / 2 + 8, cx - size / 2 - 2, cy + height / 2 + 2);
    };
    const spiral = (cx: number, cy: number, R: number, phase: number, alpha: number) => {
      const maxTheta = Math.PI * 4.5;
      for (let theta = 0; theta < maxTheta; theta += 0.07) {
        const t = theta / maxTheta;
        const r = R * (1 - t);
        const px = cx + Math.cos(theta + phase) * r;
        const py = cy + Math.sin(theta + phase) * r * 0.78;
        g.fillStyle(0x8894b0, alpha * (0.35 + 0.65 * t));
        wrapCircle(g, px, py, 0.8 + (1 - t) * 3, W);
      }
    };

    for (let band = 0; band < 5; band++) {
      const baseY = 18 + band * 31;
      g.lineStyle(1, 0x8fd6d2, 0.05 + band * 0.012);
      g.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = baseY + Math.sin(x * 0.055 + band * 1.9) * (4 + band);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    drawImpossibleFrame(86, 94, 104, 0.4, 0.28);
    drawImpossibleFrame(274, 76, 76, 2.1, 0.23);
    drawImpossibleTriangle(180, 56, 62, 0.21);

    spiral(64, 58, 44, 0.4, 0.3);
    spiral(208, 96, 58, 2.1, 0.26);
    spiral(300, 40, 34, 4.0, 0.3);
    spiral(140, 150, 30, 1.2, 0.22);

    // Feelers rising off the tile's bottom edge, swaying with height.
    for (let i = 0; i < 6; i++) {
      const baseX = i * (W / 6) + 26;
      const tipY = 34 + ((i * 37) % 48);
      for (let y = H; y > tipY; y -= 2) {
        const t = (H - y) / (H - tipY); // 0 at base, 1 at tip
        const sway = Math.sin(y * 0.045 + i * 1.7) * (10 + 22 * t);
        g.fillStyle(0x7e8aa6, 0.24 * (1 - t * 0.55));
        wrapCircle(g, baseX + sway, y, 1 + (1 - t) * 5, W);
      }
    }
    for (let bubble = 0; bubble < 22; bubble++) {
      const x = (bubble * 73 + bubble * bubble * 19) % W;
      const y = (bubble * 47 + 23) % H;
      const radius = 1 + (bubble % 4) * 0.7;
      g.lineStyle(1, 0xb8eeee, 0.08 + (bubble % 3) * 0.035);
      g.strokeCircle(x, y, radius);
    }
  });

  // Hash-noise bump grain layered over any backdrop for surface texture.
  texture(scene, "bg-bumps", 160, 90, (g) => {
    for (let i = 0; i < 150; i++) {
      const x = (i * 97 + i * i * 31) % 160;
      const y = (i * 57 + i * i * 13) % 90;
      const v = (i * 41) % 100;
      if (v < 45) {
        g.fillStyle(0xffffff, 0.1 + (v % 3) * 0.05);
        g.fillRect(x, y, 1 + (v % 2), 1);
      } else if (v < 72) {
        g.fillStyle(0x05060a, 0.22);
        g.fillRect(x, y, 1, 1 + (v % 2));
      } else {
        // Soft bump: lit crest offset from its own shadow.
        g.fillStyle(0x05060a, 0.14);
        wrapCircle(g, x + 1, y + 1, 2.4, 160);
        g.fillStyle(0xd8deee, 0.1);
        wrapCircle(g, x, y, 2, 160);
      }
    }
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

  for (const def of allItems()) {
    if (!def.weaponVisual && !def.armorVisual && !def.shield) continue;
    pickup(`pickup-${def.id}`, (g) => {
      if (def.armorVisual) {
        const colors = {
          leather: [0x5b3b2b, 0xa57345],
          chain: [0x626b75, 0xaab1b8],
          plate: [0x7c858f, 0xdce1e5],
          mithral: [0x78b7c2, 0xd7fbff],
        } as const;
        const [base, light] = colors[def.armorVisual];
        g.fillStyle(base, 1);
        g.fillRect(4, 6, 12, 12);
        g.fillRect(2, 7, 4, 6);
        g.fillRect(14, 7, 4, 6);
        g.fillStyle(light, 1);
        g.fillRect(6, 7, 8, 2);
        if (def.armorVisual === "chain" || def.armorVisual === "mithral") {
          for (let x = 5; x < 16; x += 3) g.fillRect(x, 12 + (x % 2), 1, 1);
        }
        return;
      }
      if (def.shield) {
        g.fillStyle(0x727b85, 1);
        g.fillCircle(10, 10, 8);
        g.fillStyle(0x8e3440, 1);
        g.fillRect(8, 4, 4, 12);
        g.fillStyle(0xe2c45d, 1);
        g.fillCircle(10, 10, 2);
        return;
      }
      g.fillStyle(0x8e6138, 1);
      if (def.weaponVisual === "mace") {
        g.fillRect(9, 7, 3, 11);
        g.fillStyle(0xaab1b8, 1);
        g.fillRect(6, 3, 9, 6);
      } else if (def.weaponVisual === "dagger") {
        g.fillRect(8, 13, 3, 5);
        g.fillStyle(0xd9dde2, 1);
        g.fillTriangle(8, 14, 13, 5, 12, 14);
      } else if (def.weaponVisual === "longsword") {
        g.fillRect(7, 15, 3, 4);
        g.fillStyle(0xd9dde2, 1);
        g.fillTriangle(8, 16, 14, 2, 12, 16);
      } else {
        g.lineStyle(2, 0x8e6138, 1);
        g.lineBetween(5, 18, 14, 2);
        if (def.weaponVisual !== "staff") {
          g.fillStyle(0xd9dde2, 1);
          g.fillTriangle(12, 4, 16, 0, 15, 6);
        } else {
          g.fillStyle(0x70d7df, 1);
          g.fillCircle(14, 2, 3);
        }
      }
    });
  }

  for (const def of allItems()) {
    if (scene.textures.exists(`pickup-${def.id}`)) continue;
    if (def.tags.includes("potion")) {
      pickup(`pickup-${def.id}`, (g) => {
        g.fillStyle(0x3a2518, 1);
        g.fillRect(8, 2, 4, 3);
        g.fillStyle(0x33aaee, 1);
        g.fillCircle(10, 12, 6);
        g.fillStyle(0xccffff, 1);
        g.fillCircle(8, 10, 2);
      });
    } else if (def.tags.includes("scroll")) {
      pickup(`pickup-${def.id}`, (g) => {
        g.fillStyle(0xe5d09b, 1);
        g.fillRect(4, 3, 12, 14);
        g.fillStyle(0x882222, 1);
        g.fillRect(5, 5, 10, 2);
        g.fillRect(6, 9, 8, 1);
        g.fillRect(6, 12, 8, 1);
      });
    } else if (def.tags.includes("wand") || def.tags.includes("ring") || def.tags.includes("relic") || def.tags.includes("utility") || def.tags.includes("artifact")) {
      pickup(`pickup-${def.id}`, (g) => {
        g.fillStyle(0x8d5e26, 1);
        g.fillRect(4, 7, 12, 12);
        g.fillStyle(0x5be26d, 1);
        g.fillCircle(10, 10, 4);
      });
    }
  }

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
  texture(scene, "leader-marker", 16, 10, (g) => {
    g.fillStyle(0x11131a, 0.9);
    g.fillTriangle(0, 1, 16, 1, 8, 10);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(3, 2, 13, 2, 8, 7);
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  environmentTextures(scene);
  characterTextures(scene);
  monsterTextures(scene);
  propAndPickupTextures(scene);
  effectTextures(scene);
}
