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
    range: "near",
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
    description: "A mote erupts around its target, burning enemies across a wide area.",
  },
  {
    id: "cure-wounds",
    name: "Cure Wounds",
    tier: 1,
    class: "priest",
    range: "close",
    focus: false,
    dice: "1d6",
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
    description: "Punishing divine flame strikes one creature within near range.",
  },
];

const SPELLS = new Map(SPELL_LIST.map((s) => [s.id, s]));
if (SPELLS.size !== SPELL_LIST.length) throw new Error("Duplicate spell ids in data");

export function spell(id: string): SpellDef {
  const def = SPELLS.get(id);
  if (!def) throw new Error(`Unknown spell "${id}"`);
  return def;
}

export function spellsForClass(cls: "wizard" | "priest"): readonly SpellDef[] {
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
