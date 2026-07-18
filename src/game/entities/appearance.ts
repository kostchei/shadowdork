/** Pure equipment-to-art mapping. Kept Phaser-free so it is easy to test. */

import type { ArmorVisual, Character, ClassName, WeaponVisual } from "../../engine";

export type ShieldVisual = "none" | "readied" | "stowed";
export type WornArmorVisual = ArmorVisual | "unarmored";

export interface CharacterAppearance {
  className: ClassName;
  weapon: WeaponVisual;
  armor: WornArmorVisual;
  shield: ShieldVisual;
}

export function appearanceForCharacter(character: Character): CharacterAppearance {
  const weapon = character.weapon.weaponVisual;
  if (!weapon) throw new Error(`${character.weapon.name} has no weapon visual`);
  const armor = character.wornArmor?.armorVisual ?? "unarmored";
  const shield: ShieldVisual = character.carriedShield
    ? character.shieldStowed ? "stowed" : "readied"
    : "none";
  return { className: character.className, weapon, armor, shield };
}

export function characterAppearanceKey(appearance: CharacterAppearance): string {
  return `char-${appearance.className}-${appearance.armor}-${appearance.weapon}-${appearance.shield}`;
}
