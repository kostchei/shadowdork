import type { SpellDef } from "../engine";

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
