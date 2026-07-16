import type { MonsterDef } from "../engine";

const MONSTER_LIST: readonly MonsterDef[] = [
  {
    id: "goblin",
    name: "Goblin",
    ac: 11,
    hitDice: "2d4",
    attackBonus: 2,
    damage: "1d4",
    wisMod: -1,
    darkvision: true,
    undead: false,
    xpTier: "minor",
  },
  {
    id: "skeleton",
    name: "Skeleton",
    ac: 13,
    hitDice: "2d6",
    attackBonus: 2,
    damage: "1d6",
    wisMod: 0,
    darkvision: true,
    undead: true,
    xpTier: "minor",
  },
  {
    id: "giant-rat",
    name: "Giant Rat",
    ac: 12,
    hitDice: "1d6",
    attackBonus: 1,
    damage: "1d4",
    wisMod: -2,
    darkvision: true,
    undead: false,
    xpTier: "minor",
  },
  {
    id: "gloom-ogre",
    name: "Gloom Ogre",
    ac: 14,
    hitDice: "4d8",
    attackBonus: 4,
    damage: "1d10",
    wisMod: 0,
    darkvision: true,
    undead: false,
    leader: true,
    xpTier: "major",
  },
];

const MONSTERS = new Map(MONSTER_LIST.map((m) => [m.id, m]));
if (MONSTERS.size !== MONSTER_LIST.length) throw new Error("Duplicate monster ids in data");

export function monster(id: string): MonsterDef {
  const def = MONSTERS.get(id);
  if (!def) throw new Error(`Unknown monster "${id}"`);
  return def;
}
