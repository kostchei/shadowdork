/**
 * Shadowdark RPG & Cursed Scrolls (1-3) Loot & Treasure Tables.
 * Rollable d100 tables for level brackets (0-3, 4-6, 7-9, 10+)
 * plus Cursed Scrolls setting-specific drop tables.
 */

import type { MagicItemPersonality, RollableTable, TreasureQuality } from "../../engine";

export interface CoreTreasureItemSpec {
  id: string;
  name: string;
  valueGp: number;
  description: string;
  baseItemId?: string;
  qty?: number;
  treasureQuality: TreasureQuality;
  magicBonus?: number;
  benefitRolls?: number;
  curseRolls?: number;
  personality?: MagicItemPersonality;
}

interface CoreTreasureRow {
  min: number;
  max: number;
  text: string;
  valueGp: number;
  baseItemId?: string;
  qty?: number;
}

function row(
  min: number,
  max: number,
  text: string,
  valueGp: number,
  baseItemId?: string,
  qty?: number,
): CoreTreasureRow {
  return { min, max, text, valueGp, baseItemId, qty };
}

const CORE_ROWS = {
  "0-3": [
    row(1, 1, "Bent tin fork (1 cp)", 0.01),
    row(2, 3, "Muddy torch (2 cp)", 0.02),
    row(4, 5, "Bag of smooth pebbles (2 cp)", 0.02),
    row(6, 7, "10 cp in a greasy pouch", 0.1),
    row(8, 9, "Rusty lantern with shattered glass (1 gp)", 1),
    row(10, 11, "Silver tooth (1 gp)", 1),
    row(12, 13, "Dull dagger (1 gp)", 1),
    row(14, 15, "Two empty glass vials (6 gp)", 6),
    row(16, 17, "60 sp in a rotten boot", 6),
    row(18, 19, "Cracked, handheld mirror (8 gp)", 8),
    row(20, 21, "Chipped greataxe (9 gp)", 9),
    row(22, 23, "10 gp in a moldy, wood box", 10),
    row(24, 25, "Chip of an emerald (10 gp)", 10),
    row(26, 27, "Longbow and bundle of 40 arrows (10 gp)", 10),
    row(28, 29, "Dusty, leather armor dyed black (10 gp)", 10),
    row(30, 31, "Scuffed, heavy shield (10 gp)", 10),
    row(32, 33, "Simple, well-made bastard sword (10 gp)", 10),
    row(34, 35, "12 gp in the pocket of a ripped cloak", 12),
    row(36, 37, "Wavy-bladed greatsword (12 gp)", 12),
    row(38, 39, "Pair of elf-forged shortswords (14 gp)", 14),
    row(40, 41, "Golden bowl (15 gp)", 15),
    row(42, 43, "Obsidian statuette of Shune the Vile (15 gp)", 15),
    row(44, 45, "Undersized pearl (20 gp)", 20),
    row(46, 47, "Jade-and-gold scarab pin (20 gp)", 20),
    row(48, 49, "Bag of 10 silver spikes (2 gp each)", 20),
    row(50, 53, "Mithral locket with a painting of a halfling (20 gp)", 20),
    row(54, 55, "Two finely forged dwarven shields (20 gp)", 20),
    row(56, 57, "Pair of silvered daggers (10 gp each)", 20),
    row(58, 59, "Copper-and-gold mead tankard (20 gp)", 20),
    row(60, 61, "Bundle of five red dragon scales (5 gp each)", 25),
    row(62, 63, "Light, warm cloak woven of spidersilk (25 gp)", 25),
    row(64, 65, "Fine set of ivory game pieces (25 gp)", 25),
    row(66, 67, "Half-finished suit of chainmail (30 gp)", 30),
    row(68, 69, "Matched trio of warhammers (10 gp each)", 30),
    row(70, 71, "Fragment of a sapphire (30 gp)", 30),
    row(72, 73, "Set of silk slippers and a robe (35 gp)", 35),
    row(74, 75, "Silver-and-gold circlet (40 gp)", 40),
    row(76, 77, "Radiant, polished pearl (40 gp)", 40),
    row(78, 79, "Mithral shield etched with soaring dragons (40 gp)", 40),
    row(80, 81, "Gold monkey idol with a ruby gripped in its teeth (60 gp)", 60),
    row(82, 83, "Fine suit of chainmail (60 gp)", 60),
    row(84, 85, "Cracked emerald (60 gp)", 60),
    row(86, 87, "Two lustrous pearls (40 gp each)", 80),
    row(88, 89, "1st-tier spell scroll (80 gp)", 80, "scroll-light"),
    row(90, 91, "Potion of Invisibility (80 gp)", 80, "potion-invisibility"),
    row(92, 93, "Magic wand, 2nd-tier spell (100 gp)", 100, "wand-fireball"),
    row(94, 95, "Egg of The Cockatrice (100 gp)", 100, "egg-of-cockatrice"),
    row(96, 97, "+1 armor (benefit, curse) (150 gp)", 150, "aegis-mail"),
    row(98, 99, "Bag of Holding (virtue, flaw) (150 gp)", 150, "bag-of-holding"),
    row(100, 100, "+1 magic weapon (benefit) (200 gp)", 200, "starfall-blade"),
  ],
  "4-6": [
    row(1, 1, "Scattering of 3 cp", 0.03),
    row(2, 3, "Wooden ring carved with knot pattern (5 cp)", 0.05),
    row(4, 5, "Heavy iron key (1 sp)", 0.1),
    row(6, 7, "Steel-banded wooden shield (10 gp)", 10),
    row(8, 9, "Golden anchor necklace (10 gp)", 10),
    row(10, 11, "Bag of 20 glass marbles (5 sp each)", 10),
    row(12, 13, "Serrated greatsword (12 gp)", 12),
    row(14, 15, "Three silver-tipped javelins (4 gp each)", 12),
    row(16, 17, "Bag of rare spices (15 gp)", 15),
    row(18, 19, "Mahogany pipe with ivory inlay (25 gp)", 25),
    row(20, 21, "Set of polished bone dice (25 gp)", 25),
    row(22, 23, "Copper flask etched with an owl (30 gp)", 30),
    row(24, 25, "Eyepatch made of batwing leather (30 gp)", 30),
    row(26, 27, "Leather bandoleer with 10 blue bottles (3 gp each)", 30),
    row(28, 29, "Small oil painting of an elf woman (35 gp)", 35),
    row(30, 31, "Opalescent pearl (40 gp)", 40),
    row(32, 33, "Ceremonial, gold-capped warhammer (40 gp)", 40),
    row(34, 35, "Silver ring with a miniature emerald (40 gp)", 40),
    row(36, 37, "Tapestry of a unicorn in a forest glade (45 gp)", 45),
    row(38, 39, "Goblin-made clockwork dragon doll (45 gp)", 45),
    row(40, 41, "Half-complete suit of chainmail (50 gp)", 50),
    row(42, 43, "Mace inlaid with gold holy symbols (50 gp)", 50),
    row(44, 45, "Delicate, ancient vase of Myrkhosian make (50 gp)", 50),
    row(46, 47, "Rare incense that is repulsive to undead (50 gp)", 50),
    row(48, 49, "Minotaur hoof with a gold horseshoe (50 gp)", 50),
    row(50, 53, "Longsword with a fiery pearl set in the pommel (50 gp)", 50),
    row(54, 55, "Green crystal statuette of Memnon (50 gp)", 50),
    row(56, 57, "Crimson holy symbol of Ramlaat with small ruby (55 gp)", 55),
    row(58, 59, "Six black candles traced with gold runes (10 gp each)", 60),
    row(60, 61, "Suit of dwarf-made chainmail (60 gp)", 60),
    row(62, 63, "Dragonbone crossbow carved as roaring dragon (60 gp)", 60),
    row(64, 65, "Half-complete suit of plate mail (65 gp)", 65),
    row(66, 67, "Magnetic, iridescent chunk of meteorite (70 gp)", 70),
    row(68, 69, "Full-length mirror set in gold frame (70 gp)", 70),
    row(70, 71, "Large, green scarab encased in amber (75 gp)", 75),
    row(72, 73, "Lute carved from ironwood with gold hardware (75 gp)", 75),
    row(74, 75, "Ivory tusk carved with angels battling demons (80 gp)", 80),
    row(76, 77, "Mithral shield inlaid with small, blue pearls (80 gp)", 80),
    row(78, 79, "Two intact griffon eggs (40 gp each)", 80),
    row(80, 81, "Suit of blackened-steel plate mail (130 gp)", 130),
    row(82, 83, "2nd-tier spell scroll (140 gp)", 140, "scroll-burning-hands"),
    row(84, 85, "Potion of Healing (150 gp)", 150, "potion-healing"),
    row(86, 87, "3rd-tier spell scroll (200 gp)", 200, "scroll-feather-fall"),
    row(88, 89, "Potion of Flying (200 gp)", 200, "potion-flying"),
    row(90, 91, "Potion of Giant Strength (200 gp)", 200, "potion-giant-strength"),
    row(92, 93, "Magic wand, 3rd-tier spell (curse) (250 gp)", 250, "wand-fireball"),
    row(94, 95, "Ring of Feather Falling (250 gp)", 250, "ring-feather-falling"),
    row(96, 97, "+2 magic armor (benefit, curse) (300 gp)", 300, "aegis-mail"),
    row(98, 99, "Kytherian Cog (300 gp)", 300, "kytherian-cog"),
    row(100, 100, "+2 magic weapon (benefit, curse) (500 gp)", 500, "blade-of-vengeance"),
  ],
  "7-9": [
    row(1, 1, "Broken glass shards (2 cp)", 0.02),
    row(2, 3, "Pair of muddy boots (5 sp)", 0.5),
    row(4, 5, "Rotting, leather pouch with 12 sp", 1.2),
    row(6, 7, "Greatsword made of blue steel (15 gp)", 15),
    row(8, 9, "Tall, thin mirror in a bronze frame (20 gp)", 20),
    row(10, 11, "Pair of bastard swords with griffon pommels (20 gp)", 20),
    row(12, 13, "Silver-and-gold statuette of an elf archer (25 gp)", 25),
    row(14, 15, "Taxidermied smilodon (30 gp)", 30),
    row(16, 17, "Cameo necklace of a human's profile (30 gp)", 30),
    row(18, 19, "Ivory horn mug carved with drinking dwarves (35 gp)", 35),
    row(20, 21, "Ironwood longbow engraved with silver leaves (35 gp)", 35),
    row(22, 23, "Mahogany chess board with silver pieces (40 gp)", 40),
    row(24, 25, "Mithral shield polished to a mirror-shine (45 gp)", 45),
    row(26, 27, "Iridescent, spiralled unicorn horn (50 gp)", 50),
    row(28, 29, "Basilisk egg in a silk bag (55 gp)", 55),
    row(30, 31, "Gold holy symbol of Madeera with a large pearl (60 gp)", 60),
    row(32, 33, "Red dragon mask with gold filigree (65 gp)", 65),
    row(34, 35, "Gold censer with hooded, skeletal figures (70 gp)", 70),
    row(36, 37, "Large, marble statue of an armored angel (70 gp)", 70),
    row(38, 39, "Chainmail with several rows of gold links (75 gp)", 75),
    row(40, 41, "Clutch of three green cockatrice eggs (25 gp each)", 75),
    row(42, 43, "Oak lockbox filled to the brim with 80 gp", 80),
    row(44, 45, "Blue silk robe embroidered with silver moons (80 gp)", 80),
    row(46, 47, "Radiant giant pearl (80 gp)", 80),
    row(48, 49, "Lantern made of intricate stained glass (80 gp)", 80),
    row(50, 53, "Life-sized, jointed python of polished gold (80 gp)", 80),
    row(54, 55, "Oil painting of a famous bard (85 gp)", 85),
    row(56, 57, "Chunk of meteorite sculpted into a tentacled idol (85 gp)", 85),
    row(58, 59, "Black silk surcoat embroidered with a gold lion (90 gp)", 90),
    row(60, 61, "Pair of lustrous pearls in a silver lockbox (90 gp)", 90),
    row(62, 63, "Gilded helm plumed with roc feathers (95 gp)", 95),
    row(64, 65, "Hand-drawn bestiary of rare creatures (95 gp)", 95),
    row(66, 67, "Wyvern hatchling encased in amber (110 gp)", 110),
    row(68, 69, "Pendant with three lambent pearls (120 gp)", 120),
    row(70, 71, "Life-sized, obsidian statue of a galloping horse (120 gp)", 120),
    row(72, 73, "Glittering, faceted emerald (120 gp)", 120),
    row(74, 75, "Potion of Healing (150 gp)", 150, "potion-healing"),
    row(76, 77, "Potion of Polymorph (200 gp)", 200, "potion-polymorph"),
    row(78, 79, "Magic wand, 3rd-tier spell (250 gp)", 250, "wand-fireball"),
    row(80, 81, "4th-tier spell scroll (260 gp)", 260, "scroll-feather-fall"),
    row(82, 83, "Crystal Ball (260 gp)", 260, "crystal-ball"),
    row(84, 85, "Magic wand, 4th-tier spell (flaw) (300 gp)", 300, "wand-fireball"),
    row(86, 87, "Immovable Rod (300 gp)", 300, "immovable-rod"),
    row(88, 89, "+2 magic armor (benefit) (300 gp)", 300, "aegis-mail"),
    row(90, 91, "+2 mithral magic armor (benefit, virtue) (320 gp)", 320, "mithral-chainmail"),
    row(92, 93, "Scorpion idol, one Death's Sting blessing (320 gp)", 320),
    row(94, 95, "Necromancy circle, one Ghostwalk blessing (350 gp)", 350),
    row(96, 97, "Owl statue, one Arcane Eye blessing (350 gp)", 350),
    row(98, 99, "+2 magic weapon (benefit, flaw) (500 gp)", 500, "blade-of-vengeance"),
    row(100, 100, "+3 magic weapon (benefit, virtue) (900 gp)", 900, "greataxe-of-horde"),
  ],
  "10-plus": [
    row(1, 1, "Three tarnished silver plates (5 sp each)", 1.5),
    row(2, 3, "Soapstone statuette of Gede with crumbled head (3 gp)", 3),
    row(4, 5, "Half-empty cask of dwarvish honey mead (5 gp)", 5),
    row(6, 7, "Damaged chainmail in need of repair (50 gp)", 50),
    row(8, 9, "Five matching, ceremonial greatswords (12 gp each)", 60),
    row(10, 11, "Chipped emerald worth half its value (60 gp)", 60),
    row(12, 13, "Gold ring with a large, black pearl (65 gp)", 65),
    row(14, 15, "Suit of crimson chainmail with matching shield (70 gp)", 70),
    row(16, 17, "Giant pearl in the mouth of a gold-dipped bat (100 gp)", 100),
    row(18, 19, "Stained glass pane of St. Terragnis vs. a dragon (110 gp)", 110),
    row(20, 21, "Marble throne with giant pearl in headrest (115 gp)", 115),
    row(22, 23, "Dagger with emerald in the pommel (120 gp)", 120),
    row(24, 25, "A trio of pearls with blue and violet hues (40 gp each)", 120),
    row(26, 27, "Suit of plate mail shaped to look like a minotaur (130 gp)", 130),
    row(28, 29, "Suit of blue plate mail with crashing wave motif (130 gp)", 130),
    row(30, 31, "Jade sculpture of a meditating elephant-man (140 gp)", 140),
    row(32, 33, "Masterwork lute by realm's most famous luthier (140 gp)", 140),
    row(34, 35, "Dragonbone greataxe with a ruby in pommel (220 gp)", 220),
    row(36, 37, "Gold scarab dotted with miniature emeralds (220 gp)", 220),
    row(38, 39, "Chest brimming with 230 gp", 230),
    row(40, 41, "Silvered staff tipped with a ruby held in a claw (220 gp)", 220),
    row(42, 43, "Only existing painting of an ancient king (240 gp)", 240),
    row(44, 45, "Gold pendant bearing a teardrop-cut ruby (240 gp)", 240),
    row(46, 47, "Giant, egg-shaped emerald (240 gp)", 240),
    row(48, 49, "Silk robe with four pearls as buttons (240 gp)", 240),
    row(50, 53, "Silver skull with a ruby in the eye (240 gp)", 240),
    row(54, 55, "Mithral suit of elvish chainmail (240 gp)", 240),
    row(56, 57, "Opalized giant conch shell with silver inlay (250 gp)", 250),
    row(58, 59, "Gold sarcophagus inscribed with lost language (250 gp)", 250),
    row(60, 61, "Chunk of meteorite wrapped around a ruby (250 gp)", 250),
    row(62, 63, "4th-tier spell scroll (260 gp)", 260, "scroll-feather-fall"),
    row(64, 65, "Velvet bag holding a lustrous sapphire (280 gp)", 280),
    row(66, 67, "2 Potions of Healing (300 gp)", 300, "potion-healing", 2),
    row(68, 69, "Silver torc with a sapphire and two pearls (360 gp)", 360),
    row(70, 71, "Flawless, dazzling diamond (360 gp)", 360),
    row(72, 73, "Taxidermied adult dragon (360 gp)", 360),
    row(74, 75, "5th-tier spell scroll (360 gp)", 360, "scroll-feather-fall"),
    row(76, 77, "Potion of Extirpation (360 gp)", 360, "potion-extirpation"),
    row(78, 79, "Magic wand, 5th-tier spell (virtue, flaw) (360 gp)", 360, "wand-fireball"),
    row(80, 81, "Giant diamond, casts wish once without fail (720 gp)", 720),
    row(82, 83, "Portable Hole (720 gp)", 720, "portable-hole"),
    row(84, 85, "Ruby-eyed, gold idol, 3 Demonskin blessings (840 gp)", 840),
    row(86, 87, "Scroll of the Covenant, 3 Divine Halo blessings (840 gp)", 840, "scroll-covenant"),
    row(88, 89, "Brak's Cube of Perfection (840 gp)", 840, "brak-cube"),
    row(90, 91, "Richly woven Flying Carpet (840 gp)", 840, "flying-carpet"),
    row(92, 93, "+3 mithral magic armor (benefit, virtue) (900 gp)", 900, "mithral-chainmail"),
    row(94, 95, "+3 magic weapon (2 benefits) (900 gp)", 900, "greataxe-of-horde"),
    row(96, 97, "The fearsome Obsidian Witchknife (1,200 gp)", 1200, "obsidian-witchknife"),
    row(98, 99, "The hallowed Armor of Saint Terragnis (1,200 gp)", 1200, "armor-saint-terragnis"),
    row(100, 100, "The mighty Staff of Ord (1,200 gp)", 1200, "staff-of-ord"),
  ],
} as const satisfies Record<string, readonly CoreTreasureRow[]>;

function treasureId(band: keyof typeof CORE_ROWS, min: number): string {
  return `core-treasure-${band}-${String(min).padStart(3, "0")}`;
}

function itemName(text: string): string {
  return text
    .replace(/ \([\d,]+ (?:cp|sp|gp)(?: each)?\)$/, "")
    .replace(/^2 Potions of /, "Potion of ");
}

const LEGENDARY_BASE_ITEMS = new Set([
  "obsidian-witchknife",
  "armor-saint-terragnis",
  "staff-of-ord",
]);

const FABULOUS_BASE_ITEMS = new Set([
  "aegis-mail",
  "starfall-blade",
  "bag-of-holding",
  "egg-of-cockatrice",
  "blade-of-vengeance",
  "kytherian-cog",
  "crystal-ball",
  "immovable-rod",
  "mithral-chainmail",
  "greataxe-of-horde",
  "potion-extirpation",
  "portable-hole",
  "scroll-covenant",
  "brak-cube",
  "flying-carpet",
]);

function treasureQuality(entry: CoreTreasureRow): TreasureQuality {
  if (entry.baseItemId && LEGENDARY_BASE_ITEMS.has(entry.baseItemId)) return "legendary";
  if (entry.text.includes("casts wish once without fail")) return "legendary";
  if (entry.baseItemId && FABULOUS_BASE_ITEMS.has(entry.baseItemId)) return "fabulous";
  if (entry.text.includes("blessing") || entry.text.includes("magic weapon") || entry.text.includes("magic armor")) {
    return "fabulous";
  }
  if (
    entry.valueGp < 10
    || /^(Broken|Muddy|Rotting|Damaged|Chipped)/.test(entry.text)
    || entry.text.includes("in need of repair")
  ) return "poor";
  return "normal";
}

function rollCount(text: string, quality: "benefit" | "curse"): number | undefined {
  const plural = text.match(new RegExp(`(\\d+) ${quality}s`));
  if (plural) return Number(plural[1]);
  return new RegExp(`(?:\\(|, )${quality}(?:,|\\))`).test(text) ? 1 : undefined;
}

function personalityData(text: string): MagicItemPersonality | undefined {
  const virtueRolls = text.includes("virtue") ? 1 : undefined;
  const flawRolls = text.includes("flaw") ? 1 : undefined;
  return virtueRolls || flawRolls ? { virtueRolls, flawRolls } : undefined;
}

function tableMagicBonus(text: string): number | undefined {
  const match = text.match(/^\+(\d) /);
  return match ? Number(match[1]) : undefined;
}

function table(band: keyof typeof CORE_ROWS, name: string): RollableTable {
  return {
    id: `treasure-${band}`,
    name,
    dice: "d100",
    entries: CORE_ROWS[band].map((entry) => ({
      min: entry.min,
      max: entry.max,
      text: entry.text,
      data: {
        itemId: treasureId(band, entry.min),
        valueGp: entry.valueGp,
        qty: entry.qty,
      },
    })),
  };
}

/** Stable inventory definitions for every core d100 result. */
export const CORE_TREASURE_ITEM_SPECS: readonly CoreTreasureItemSpec[] = (
  Object.entries(CORE_ROWS) as [keyof typeof CORE_ROWS, readonly CoreTreasureRow[]][]
).flatMap(([band, rows]) => rows.map((entry) => ({
  id: treasureId(band, entry.min),
  name: itemName(entry.text),
  valueGp: entry.valueGp / (entry.qty ?? 1),
  description: entry.text,
  baseItemId: entry.baseItemId,
  qty: entry.qty,
  treasureQuality: treasureQuality(entry),
  magicBonus: tableMagicBonus(entry.text),
  benefitRolls: rollCount(entry.text, "benefit"),
  curseRolls: rollCount(entry.text, "curse"),
  personality: personalityData(entry.text),
})));

export const TREASURE_0_3 = table("0-3", "Treasure 0-3");
export const TREASURE_4_6 = table("4-6", "Treasure 4-6");
export const TREASURE_7_9 = table("7-9", "Treasure 7-9");
export const TREASURE_10_PLUS = table("10-plus", "Treasure 10+");

export const DIABOLICAL_TREASURE: RollableTable = {
  id: "diabolical-treasure",
  name: "Diabolical Treasure (CS1)",
  dice: "1d6",
  entries: [
    { min: 1, max: 1, text: "Carved bone igniting in flames once/day for 1d4 rounds", data: { itemId: "carved-flame-bone", valueGp: 30 } },
    { min: 2, max: 2, text: "Eyeball charm repelling insects and spiders", data: { itemId: "eyeball-charm", valueGp: 40 } },
    { min: 3, max: 3, text: "Floating wolf idol", data: { itemId: "floating-wolf-idol", valueGp: 50 } },
    { min: 4, max: 4, text: "Dried rose pointing due north when untouched", data: { itemId: "compass-rose", valueGp: 25 } },
    { min: 5, max: 5, text: "Pickled imp jar attracting demonic creatures", data: { itemId: "pickled-imp-jar", valueGp: 60 } },
    { min: 6, max: 6, text: "Vial of demon blood granting fire resistance for 1 hour", data: { itemId: "vial-demon-blood", valueGp: 75 } },
  ],
};

export const DESERT_PLUNDER: RollableTable = {
  id: "desert-plunder",
  name: "Desert & Arena Plunder (CS2)",
  dice: "1d6",
  entries: [
    { min: 1, max: 1, text: "Cursed eye token (disadvantage on next check)", data: { itemId: "cursed-eye-token", valueGp: 10 } },
    { min: 2, max: 2, text: "Burlap bag tied shut with an angry cobra inside", data: { itemId: "cobra-bag", valueGp: 15 } },
    { min: 3, max: 3, text: "Torn half of a treasure map", data: { itemId: "treasure-map-half", valueGp: 35 } },
    { min: 4, max: 4, text: "Sealed clay jar with 20 gp and scarab beetle swarm", data: { itemId: "scarab-jar", valueGp: 20 } },
    { min: 5, max: 5, text: "Brass wine cup with secret poison reservoir", data: { itemId: "poison-wine-cup", valueGp: 45 } },
    { min: 6, max: 6, text: "Scimitar of Speed with lapis pommel", data: { itemId: "scimitar-of-speed", valueGp: 250 } },
  ],
};

export const SEAWOLF_PLUNDER: RollableTable = {
  id: "seawolf-plunder",
  name: "Sea Wolf Plunder (CS3)",
  dice: "1d6",
  entries: [
    { min: 1, max: 1, text: "Holy symbol of a silver lion on thin braided chain (10 gp)", data: { itemId: "gem", valueGp: 10 } },
    { min: 2, max: 2, text: "Silver incense burner full of fragrant myrrh chips (20 gp)", data: { itemId: "gem", valueGp: 20 } },
    { min: 3, max: 3, text: "Colorfully-inked prayer scroll in heavy silver tube (30 gp)", data: { itemId: "scroll-cure-wounds", valueGp: 30 } },
    { min: 4, max: 4, text: "White silk robes with cloth-of-gold embroidery (40 gp)", data: { itemId: "gem", valueGp: 40 } },
    { min: 5, max: 5, text: "Wavy silver dagger with crescent moon pommel (50 gp)", data: { itemId: "dagger", valueGp: 50 } },
    { min: 6, max: 6, text: "Runed kraken tooth horn summoning sea winds", data: { itemId: "jeweled-idol", valueGp: 100 } },
  ],
};

export const ALL_TREASURE_TABLES: readonly RollableTable[] = [
  TREASURE_0_3,
  TREASURE_4_6,
  TREASURE_7_9,
  TREASURE_10_PLUS,
  DIABOLICAL_TREASURE,
  DESERT_PLUNDER,
  SEAWOLF_PLUNDER,
];
