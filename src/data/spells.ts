import type { Character, SpellDef } from "../engine";

const SPELL_LIST: readonly SpellDef[] = [
  {
    id: "magic-missile",
    name: "Magic Missile",
    tier: 1,
    class: "wizard",
    range: "far",
    focus: false,
    dice: "1d4",
    target: "enemy",
    description: "A bolt of force streaks unerringly to a target you can see.",
  },
  {
    id: "burning-hands",
    name: "Burning Hands",
    tier: 1,
    class: "wizard",
    range: "close",
    focus: false,
    dice: "1d6",
    target: "enemy",
    description: "Flames fan out, scorching everything close to you.",
  },
  {
    id: "mage-armor",
    name: "Mage Armor",
    tier: 1,
    class: "wizard",
    range: "self",
    focus: false,
    durationMs: 10 * 60 * 1000,
    description: "An invisible shell of force hardens around you (+3 AC).",
  },
  {
    id: "feather-fall",
    name: "Feather Fall",
    tier: 1,
    class: "wizard",
    range: "self",
    focus: false,
    description: "For a short time, the next dangerous fall ends in a safe landing.",
  },
  {
    id: "sleep",
    name: "Sleep",
    tier: 1,
    class: "wizard",
    range: "self",
    focus: false,
    description: "Lesser creatures nearby fall into a deep sleep until hurt or shaken awake.",
  },
  {
    id: "misty-step",
    name: "Misty Step",
    tier: 2,
    class: "wizard",
    range: "self",
    focus: false,
    description: "You vanish into smoke and reappear a near distance ahead.",
  },
  {
    id: "fireball",
    name: "Fireball",
    tier: 3,
    class: "wizard",
    range: "far",
    focus: false,
    dice: "4d6",
    target: "enemy",
    description: "A mote erupts around its target, burning enemies across a wide area.",
  },
  {
    id: "acid-arrow",
    name: "Acid Arrow",
    tier: 2,
    class: "wizard",
    range: "far",
    focus: true,
    dice: "1d6",
    target: "enemy",
    description: "A corrosive bolt hits one foe for 1d6 damage each round while focused.",
  },
  {
    id: "lightning-bolt",
    name: "Lightning Bolt",
    tier: 3,
    class: "wizard",
    range: "far",
    focus: false,
    dice: "3d6",
    target: "direction",
    description: "A blue-white ray hits every creature in a straight line out to far range.",
  },
  {
    id: "cloudkill",
    name: "Cloudkill",
    tier: 4,
    class: "wizard",
    range: "far",
    focus: false,
    dice: "2d6",
    target: "point",
    description: "A near-sized poison cloud persists for 5 rounds, blinding and damaging creatures inside.",
  },
  {
    id: "prismatic-orb",
    name: "Prismatic Orb",
    tier: 5,
    class: "wizard",
    range: "far",
    focus: false,
    dice: "3d8",
    target: "enemy",
    choices: ["fire", "cold", "electricity"],
    description: "Choose fire, cold, or electricity and strike one target; anathema energy deals double damage.",
  },
  {
    id: "cure-wounds",
    name: "Cure Wounds",
    tier: 1,
    class: "priest",
    range: "close",
    focus: false,
    dice: "1d6",
    target: "ally",
    description: "Divine warmth knits wounds closed.",
  },
  {
    id: "light",
    name: "Light",
    tier: 1,
    class: "priest",
    range: "close",
    focus: false,
    durationMs: 60 * 60 * 1000,
    description: "An object glows like a torch. Burns nothing, costs no hand.",
  },
  {
    id: "turn-undead",
    name: "Turn Undead",
    tier: 1,
    class: "priest",
    range: "near",
    focus: false,
    description: "Holy power drives the undead to flee your presence.",
  },
  {
    id: "holy-weapon",
    name: "Holy Weapon",
    tier: 1,
    class: "priest",
    range: "close",
    focus: false,
    description: "Sacred power grants one weapon +1 to attacks and damage for five rounds.",
  },
  {
    id: "shield-of-faith",
    name: "Shield of Faith",
    tier: 1,
    class: "priest",
    range: "self",
    focus: false,
    description: "Holy conviction grants +2 AC for five rounds.",
  },
  {
    id: "bless",
    name: "Bless",
    tier: 2,
    class: "priest",
    range: "close",
    focus: false,
    target: "ally",
    description: "Divine favour restores a luck token to one nearby ally.",
  },
  {
    id: "smite",
    name: "Smite",
    tier: 2,
    class: "priest",
    range: "near",
    focus: false,
    dice: "1d6",
    target: "enemy",
    description: "Punishing divine flame strikes one creature within near range.",
  },
  {
    id: "cauldron",
    name: "Cauldron",
    tier: 1,
    class: "witch",
    range: "close",
    focus: false,
    target: "object",
    description: "Conjure a cauldron for one round to repair a mundane item or hold up to 3 gear slots until the next casting.",
  },
  {
    id: "spidersilk",
    name: "Spidersilk",
    tier: 2,
    class: "witch",
    range: "self",
    focus: true,
    description: "Cling to and walk along supported vertical surfaces while focused.",
  },
  {
    id: "witchlight",
    name: "Witchlight",
    tier: 1,
    class: "witch",
    range: "near",
    focus: true,
    description: "A cold, movable light burns near your familiar while focused.",
  },
  {
    id: "fog",
    name: "Fog",
    tier: 1,
    class: "witch",
    range: "close",
    focus: true,
    description: "Concealing fog shrouds you and nearby allies while focused.",
  },
  {
    id: "cats-eye",
    name: "Cat's Eye",
    tier: 2,
    class: "witch",
    range: "self",
    focus: true,
    description: "See invisible creatures and secret doors while focused.",
  },
  {
    id: "bogboil",
    name: "Bogboil",
    tier: 2,
    class: "witch",
    range: "far",
    focus: false,
    target: "point",
    description: "Turn a near-sized patch of ground into boiling quicksand for 5 rounds.",
  },
  {
    id: "howl",
    name: "Howl",
    tier: 3,
    class: "witch",
    range: "near",
    focus: false,
    description: "A predatory cry forces nearby lesser foes to flee.",
  },
  {
    id: "broomstick",
    name: "Broomstick",
    tier: 3,
    class: "witch",
    range: "self",
    focus: true,
    description: "Fly under controlled movement while focused.",
  },
  {
    id: "speak-with-dead",
    name: "Speak With Dead",
    tier: 3,
    class: "witch",
    range: "close",
    focus: false,
    choices: ["danger", "secret", "reward"],
    description: "A nearby corpse truthfully answers up to three yes-or-no questions.",
  },
  {
    id: "chant",
    name: "Chant",
    tier: 1,
    class: "seer",
    range: "self",
    focus: true,
    description: "Reveal nearby secrets and hidden creatures while focused.",
  },
  {
    id: "trance",
    name: "Trance",
    tier: 1,
    class: "seer",
    range: "close",
    focus: false,
    target: "ally",
    description: "Place an ally in fate's favor, restoring a Luck token.",
  },
  {
    id: "seer-potion",
    name: "Potion",
    tier: 1,
    class: "seer",
    range: "close",
    focus: false,
    target: "ally",
    description: "Conjure a brief remedy that cures poison or stabilizes the dying.",
  },
  {
    id: "evoke-rage",
    name: "Evoke Rage",
    tier: 1,
    class: "seer",
    range: "close",
    focus: false,
    target: "ally",
    description: "A willing humanoid gains melee advantage, STR advantage, morale immunity, and +1d4 damage for 1d4 rounds.",
  },
  {
    id: "fate",
    name: "Fate",
    tier: 2,
    class: "seer",
    range: "near",
    focus: false,
    dice: "1d10",
    target: "enemy",
    description: "Twist a creature's fate for 1d10 damage and disadvantage on its next action.",
  },
  {
    id: "cast-out",
    name: "Cast Out",
    tier: 3,
    class: "seer",
    range: "far",
    focus: true,
    target: "enemy",
    description: "Choose one creature in far range; it cannot come within near range while you focus.",
  },
  {
    id: "read-runes",
    name: "Read the Runes",
    tier: 2,
    class: "seer",
    range: "near",
    focus: false,
    choices: ["danger", "secret", "reward"],
    description: "Expose a nearby secret, route, or unexplored chamber.",
  },
  {
    id: "wolfshape",
    name: "Wolfshape",
    tier: 3,
    class: "seer",
    range: "self",
    focus: true,
    description: "Transform with your gear into a swift wolf while retaining your mind and spellcasting.",
  },
];

const SPELLS = new Map(SPELL_LIST.map((s) => [s.id, s]));
if (SPELLS.size !== SPELL_LIST.length) throw new Error("Duplicate spell ids in data");

export function spell(id: string): SpellDef {
  const def = SPELLS.get(id);
  if (!def) throw new Error(`Unknown spell "${id}"`);
  return def;
}

const ITEM_SPELLS: Readonly<Record<string, string>> = {
  "scroll-cure-wounds": "cure-wounds",
  "scroll-light": "light",
  "scroll-burning-hands": "burning-hands",
  "scroll-feather-fall": "feather-fall",
  "wand-fireball": "fireball",
};

export function spellForMagicItem(itemId: string, rulesId?: string): SpellDef | undefined {
  const spellId = ITEM_SPELLS[rulesId ?? itemId];
  return spellId ? spell(spellId) : undefined;
}

export function spellsForClass(cls: SpellDef["class"]): readonly SpellDef[] {
  return SPELL_LIST.filter((s) => s.class === cls);
}

/** Return the known-spell index of the highest-tier spell that can be cast. */
export function highestAvailableSpellIndex(character: Character): number {
  let bestIndex = -1;
  let bestTier = -1;
  character.knownSpells.forEach((known, index) => {
    if (known.status !== "available" || known.requiresAtonement) return;
    const tier = spell(known.spellId).tier;
    if (tier > bestTier) {
      bestIndex = index;
      bestTier = tier;
    }
  });
  return bestIndex;
}

/** Return the known-spell index of the highest-tier damaging spell that can be cast. */
export function highestAvailableDamagingSpellIndex(character: Character): number {
  let bestIndex = -1;
  let bestTier = -1;
  character.knownSpells.forEach((known, index) => {
    if (known.status !== "available" || known.requiresAtonement) return;
    const def = spell(known.spellId);
    if (!def.dice) return;
    if (def.tier > bestTier) {
      bestIndex = index;
      bestTier = def.tier;
    }
  });
  return bestIndex >= 0 ? bestIndex : highestAvailableSpellIndex(character);
}
