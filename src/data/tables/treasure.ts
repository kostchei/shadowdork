/**
 * Shadowdark RPG & Cursed Scrolls (1-3) Loot & Treasure Tables.
 * Rollable d100 tables for level brackets (0-3, 4-6, 7-9, 10+)
 * plus Cursed Scrolls setting-specific drop tables.
 */

import type { RollableTable } from "../../engine";

export const TREASURE_0_3: RollableTable = {
  id: "treasure-0-3",
  name: "Treasure 0-3",
  dice: "d100",
  entries: [
    { min: 1, max: 1, text: "3 cp", data: { coins: 0, cp: 3 } },
    { min: 2, max: 3, text: "Wooden ring carved with knot pattern (5 cp)", data: { itemId: "coins", valueGp: 0.05 } },
    { min: 4, max: 5, text: "Heavy iron key (1 sp)", data: { itemId: "iron-spikes", valueGp: 0.1 } },
    { min: 6, max: 7, text: "Steel-banded wooden shield (10 gp)", data: { itemId: "shield", valueGp: 10 } },
    { min: 8, max: 9, text: "Golden anchor necklace (10 gp)", data: { itemId: "gem", valueGp: 10 } },
    { min: 10, max: 11, text: "Bag of 20 glass marbles (5 sp each)", data: { itemId: "coins", valueGp: 1 } },
    { min: 12, max: 13, text: "Serrated greatsword (12 gp)", data: { itemId: "longsword", valueGp: 12 } },
    { min: 14, max: 15, text: "Three silver-tipped javelins (4 gp each)", data: { itemId: "javelin", qty: 3, valueGp: 12 } },
    { min: 16, max: 17, text: "Bag of rare spices (15 gp)", data: { itemId: "gem", valueGp: 15 } },
    { min: 18, max: 19, text: "Mahogany pipe with ivory inlay (25 gp)", data: { itemId: "gem", valueGp: 25 } },
    { min: 20, max: 21, text: "Set of polished bone dice (25 gp)", data: { itemId: "gem", valueGp: 25 } },
    { min: 22, max: 23, text: "Copper flask etched with an owl (30 gp)", data: { itemId: "gem", valueGp: 30 } },
    { min: 24, max: 25, text: "Eyepatch made of batwing leather (30 gp)", data: { itemId: "gem", valueGp: 30 } },
    { min: 26, max: 27, text: "Leather bandoleer with 10 blue bottles (3 gp each)", data: { itemId: "gem", valueGp: 30 } },
    { min: 28, max: 29, text: "Small oil painting of an elf woman (35 gp)", data: { itemId: "gem", valueGp: 35 } },
    { min: 30, max: 31, text: "Opalescent pearl (40 gp)", data: { itemId: "gem", valueGp: 40 } },
    { min: 32, max: 33, text: "Ceremonial gold-capped warhammer (40 gp)", data: { itemId: "mace", valueGp: 40 } },
    { min: 34, max: 35, text: "Silver ring with miniature emerald (40 gp)", data: { itemId: "gem", valueGp: 40 } },
    { min: 36, max: 37, text: "Tapestry of a unicorn in a forest glade (45 gp)", data: { itemId: "jeweled-idol", valueGp: 45 } },
    { min: 38, max: 39, text: "Goblin-made clockwork dragon doll (45 gp)", data: { itemId: "gem", valueGp: 45 } },
    { min: 40, max: 41, text: "Half-complete suit of chainmail (50 gp)", data: { itemId: "chainmail", valueGp: 50 } },
    { min: 42, max: 43, text: "Mace inlaid with gold holy symbols (50 gp)", data: { itemId: "mace", valueGp: 50 } },
    { min: 44, max: 45, text: "Delicate ancient vase of Myrkhosian make (50 gp)", data: { itemId: "jeweled-idol", valueGp: 50 } },
    { min: 46, max: 47, text: "Rare incense repulsive to undead (50 gp)", data: { itemId: "gem", valueGp: 50 } },
    { min: 48, max: 49, text: "Minotaur hoof with a gold horseshoe (50 gp)", data: { itemId: "gem", valueGp: 50 } },
    { min: 50, max: 53, text: "Longsword with fiery pearl in pommel (50 gp)", data: { itemId: "longsword", valueGp: 50 } },
    { min: 54, max: 55, text: "Green crystal statuette of Memnon (50 gp)", data: { itemId: "jeweled-idol", valueGp: 50 } },
    { min: 56, max: 57, text: "Crimson holy symbol of Ramlaat with small ruby (55 gp)", data: { itemId: "gem", valueGp: 55 } },
    { min: 58, max: 59, text: "Six black candles traced with gold runes (10 gp each)", data: { itemId: "torch", qty: 6, valueGp: 60 } },
    { min: 60, max: 61, text: "Suit of dwarf-made chainmail (60 gp)", data: { itemId: "chainmail", valueGp: 60 } },
    { min: 62, max: 63, text: "Dragonbone crossbow carved as roaring dragon (60 gp)", data: { itemId: "shortbow", valueGp: 60 } },
    { min: 64, max: 65, text: "Half-complete suit of plate mail (65 gp)", data: { itemId: "plate-mail", valueGp: 65 } },
    { min: 66, max: 67, text: "Magnetic, iridescent chunk of meteorite (70 gp)", data: { itemId: "gem", valueGp: 70 } },
    { min: 68, max: 69, text: "Full-length mirror set in gold frame (70 gp)", data: { itemId: "jeweled-idol", valueGp: 70 } },
    { min: 70, max: 71, text: "Large green scarab encased in amber (75 gp)", data: { itemId: "gem", valueGp: 75 } },
    { min: 72, max: 73, text: "Lute carved from ironwood with gold hardware (75 gp)", data: { itemId: "gem", valueGp: 75 } },
    { min: 74, max: 75, text: "Ivory tusk carved with angels battling demons (80 gp)", data: { itemId: "jeweled-idol", valueGp: 80 } },
    { min: 76, max: 77, text: "Mithral shield inlaid with small blue pearls (80 gp)", data: { itemId: "shield", valueGp: 80 } },
    { min: 78, max: 79, text: "Two intact griffon eggs (40 gp each)", data: { itemId: "gem", qty: 2, valueGp: 80 } },
    { min: 80, max: 81, text: "Suit of blackened-steel plate mail (130 gp)", data: { itemId: "plate-mail", valueGp: 130 } },
    { min: 82, max: 83, text: "1st-tier spell scroll (80 gp)", data: { itemId: "scroll-cure-wounds", valueGp: 80 } },
    { min: 84, max: 85, text: "Potion of Healing (80 gp)", data: { itemId: "potion-healing", valueGp: 80 } },
    { min: 86, max: 87, text: "Potion of Water Breathing (80 gp)", data: { itemId: "potion-water-breathing", valueGp: 80 } },
    { min: 88, max: 89, text: "1st-tier spell scroll (80 gp)", data: { itemId: "scroll-light", valueGp: 80 } },
    { min: 90, max: 91, text: "Potion of Invisibility (80 gp)", data: { itemId: "potion-invisibility", valueGp: 80 } },
    { min: 92, max: 93, text: "Magic wand, 2nd-tier spell (100 gp)", data: { itemId: "wand-fireball", valueGp: 100 } },
    { min: 94, max: 95, text: "Egg of The Cockatrice (100 gp)", data: { itemId: "egg-of-cockatrice", valueGp: 100 } },
    { min: 96, max: 97, text: "+1 armor (benefit, curse) (150 gp)", data: { itemId: "aegis-mail", valueGp: 150 } },
    { min: 98, max: 99, text: "Bag of Holding (virtue, flaw) (150 gp)", data: { itemId: "bag-of-holding", valueGp: 150 } },
    { min: 100, max: 100, text: "+1 magic weapon (benefit) (200 gp)", data: { itemId: "starfall-blade", valueGp: 200 } },
  ],
};

export const TREASURE_4_6: RollableTable = {
  id: "treasure-4-6",
  name: "Treasure 4-6",
  dice: "d100",
  entries: [
    { min: 1, max: 1, text: "Scattering of 3 cp", data: { cp: 3 } },
    { min: 2, max: 3, text: "Wooden ring carved with knot pattern (5 cp)", data: { itemId: "coins", valueGp: 0.05 } },
    { min: 4, max: 45, text: "Ancient Myrkhosian silver relics & amber scarabs (50 gp)", data: { itemId: "gem", valueGp: 50 } },
    { min: 46, max: 79, text: "Suit of blackened plate or mithral shield (80 gp)", data: { itemId: "mithral-chainmail", valueGp: 80 } },
    { min: 80, max: 81, text: "Suit of blackened-steel plate mail (130 gp)", data: { itemId: "plate-mail", valueGp: 130 } },
    { min: 82, max: 83, text: "2nd-tier spell scroll (140 gp)", data: { itemId: "scroll-burning-hands", valueGp: 140 } },
    { min: 84, max: 85, text: "Potion of Healing (150 gp)", data: { itemId: "potion-healing", valueGp: 150 } },
    { min: 86, max: 87, text: "3rd-tier spell scroll (200 gp)", data: { itemId: "scroll-feather-fall", valueGp: 200 } },
    { min: 88, max: 89, text: "Potion of Flying (200 gp)", data: { itemId: "potion-flying", valueGp: 200 } },
    { min: 90, max: 91, text: "Potion of Giant Strength (200 gp)", data: { itemId: "potion-giant-strength", valueGp: 200 } },
    { min: 92, max: 93, text: "Magic wand, 3rd-tier spell (curse) (250 gp)", data: { itemId: "wand-fireball", valueGp: 250 } },
    { min: 94, max: 95, text: "Ring of Feather Falling (250 gp)", data: { itemId: "ring-feather-falling", valueGp: 250 } },
    { min: 96, max: 97, text: "+2 magic armor (benefit, curse) (300 gp)", data: { itemId: "aegis-mail", valueGp: 300 } },
    { min: 98, max: 99, text: "Kytherian Cog (300 gp)", data: { itemId: "kytherian-cog", valueGp: 300 } },
    { min: 100, max: 100, text: "+2 magic weapon (benefit, curse) (500 gp)", data: { itemId: "blade-of-vengeance", valueGp: 500 } },
  ],
};

export const TREASURE_7_9: RollableTable = {
  id: "treasure-7-9",
  name: "Treasure 7-9",
  dice: "d100",
  entries: [
    { min: 1, max: 50, text: "Chest of rare pearls, silk robes, and gold statues (80 gp)", data: { itemId: "jeweled-idol", valueGp: 80 } },
    { min: 51, max: 73, text: "Glittering faceted emeralds and obsidian horses (120 gp)", data: { itemId: "gem", valueGp: 120 } },
    { min: 74, max: 75, text: "Potion of Healing (150 gp)", data: { itemId: "potion-healing", valueGp: 150 } },
    { min: 76, max: 77, text: "Potion of Polymorph (200 gp)", data: { itemId: "potion-polymorph", valueGp: 200 } },
    { min: 78, max: 79, text: "Magic wand, 3rd-tier spell (250 gp)", data: { itemId: "wand-fireball", valueGp: 250 } },
    { min: 80, max: 81, text: "4th-tier spell scroll (260 gp)", data: { itemId: "scroll-feather-fall", valueGp: 260 } },
    { min: 82, max: 83, text: "Crystal Ball (260 gp)", data: { itemId: "crystal-ball", valueGp: 260 } },
    { min: 84, max: 85, text: "Magic wand, 4th-tier spell (flaw) (300 gp)", data: { itemId: "wand-fireball", valueGp: 300 } },
    { min: 86, max: 87, text: "Immovable Rod (300 gp)", data: { itemId: "immovable-rod", valueGp: 300 } },
    { min: 88, max: 89, text: "+2 magic armor (benefit) (300 gp)", data: { itemId: "aegis-mail", valueGp: 300 } },
    { min: 90, max: 91, text: "+2 mithral magic armor (benefit, virtue) (320 gp)", data: { itemId: "mithral-chainmail", valueGp: 320 } },
    { min: 92, max: 93, text: "Scorpion idol, Death's Sting blessing (320 gp)", data: { itemId: "jeweled-idol", valueGp: 320 } },
    { min: 94, max: 95, text: "Necromancy circle, Ghostwalk blessing (350 gp)", data: { itemId: "jeweled-idol", valueGp: 350 } },
    { min: 96, max: 97, text: "Owl statue, Arcane Eye blessing (350 gp)", data: { itemId: "jeweled-idol", valueGp: 350 } },
    { min: 98, max: 99, text: "+2 magic weapon (benefit, flaw) (500 gp)", data: { itemId: "blade-of-vengeance", valueGp: 500 } },
    { min: 100, max: 100, text: "+3 magic weapon (benefit, virtue) (900 gp)", data: { itemId: "greataxe-of-horde", valueGp: 900 } },
  ],
};

export const TREASURE_10_PLUS: RollableTable = {
  id: "treasure-10-plus",
  name: "Treasure 10+",
  dice: "d100",
  entries: [
    { min: 1, max: 61, text: "Gold sarcophagus with ruby & meteorite inlay (250 gp)", data: { itemId: "crown-of-the-deep", valueGp: 250 } },
    { min: 62, max: 63, text: "4th-tier spell scroll (260 gp)", data: { itemId: "scroll-feather-fall", valueGp: 260 } },
    { min: 64, max: 65, text: "Velvet bag holding a lustrous sapphire (280 gp)", data: { itemId: "gem", valueGp: 280 } },
    { min: 66, max: 67, text: "2 Potions of Healing (300 gp)", data: { itemId: "potion-healing", qty: 2, valueGp: 300 } },
    { min: 68, max: 69, text: "Silver torc with a sapphire and two pearls (360 gp)", data: { itemId: "jeweled-idol", valueGp: 360 } },
    { min: 70, max: 71, text: "Flawless, dazzling diamond (360 gp)", data: { itemId: "gem", valueGp: 360 } },
    { min: 72, max: 73, text: "Taxidermied adult dragon (360 gp)", data: { itemId: "crown-of-the-deep", valueGp: 360 } },
    { min: 74, max: 75, text: "5th-tier spell scroll (360 gp)", data: { itemId: "scroll-feather-fall", valueGp: 360 } },
    { min: 76, max: 77, text: "Potion of Extirpation (360 gp)", data: { itemId: "potion-extirpation", valueGp: 360 } },
    { min: 78, max: 79, text: "Magic wand, 5th-tier spell (360 gp)", data: { itemId: "wand-fireball", valueGp: 360 } },
    { min: 80, max: 81, text: "Giant diamond (Wish power) (720 gp)", data: { itemId: "gem", valueGp: 720 } },
    { min: 82, max: 83, text: "Portable Hole (720 gp)", data: { itemId: "portable-hole", valueGp: 720 } },
    { min: 84, max: 85, text: "Ruby-eyed gold idol (3 Demonskin blessings) (840 gp)", data: { itemId: "jeweled-idol", valueGp: 840 } },
    { min: 86, max: 87, text: "Scroll of the Covenant (3 Divine Halo blessings) (840 gp)", data: { itemId: "scroll-covenant", valueGp: 840 } },
    { min: 88, max: 89, text: "Brak's Cube of Perfection (840 gp)", data: { itemId: "brak-cube", valueGp: 840 } },
    { min: 90, max: 91, text: "Richly woven Flying Carpet (840 gp)", data: { itemId: "flying-carpet", valueGp: 840 } },
    { min: 92, max: 93, text: "+3 mithral magic armor (benefit, virtue) (900 gp)", data: { itemId: "mithral-chainmail", valueGp: 900 } },
    { min: 94, max: 95, text: "+3 magic weapon (2 benefits) (900 gp)", data: { itemId: "greataxe-of-horde", valueGp: 900 } },
    { min: 96, max: 97, text: "The fearsome Obsidian Witchknife (1,200 gp)", data: { itemId: "obsidian-witchknife", valueGp: 1200 } },
    { min: 98, max: 99, text: "The hallowed Armor of Saint Terragnis (1,200 gp)", data: { itemId: "armor-saint-terragnis", valueGp: 1200 } },
    { min: 100, max: 100, text: "The mighty Staff of Ord (1,200 gp)", data: { itemId: "staff-of-ord", valueGp: 1200 } },
  ],
};

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
