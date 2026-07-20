However, some apparent breadth is data-only:
Numerous potions, scrolls, wands, relics, and magic items exist in [items.ts (line 61)](D:/Code/shadowdork/src/data/items.ts:61), but the inventory interface can only use rations or equip weapons, armor, and shields. Everything else reports that it cannot be equipped in [Dungeon.ts (line 1487)](D:/Code/shadowdork/src/game/scenes/Dungeon.ts:1487).
Four core treasure tables and three Cursed Scroll treasure tables exist, but gameplay never rolls them.
Witch and Seer companions exist, but they receive Wizard and Priest spells respectively in [classes.ts (line 144)](D:/Code/shadowdork/src/data/classes.ts:144).
Pit Fighter, Sea Wolf, and Ras-Godai features are partly labels rather than complete mechanics.
My recommended order
1. Make magical treasure usable
This is the largest immediate opportunity.
Start with roughly twelve genuinely functional items:
Healing, invisibility, flying, water-breathing, and giant-strength potions
Spell scrolls that vanish after one attempted casting
Wands that become inert on failure and break on a natural 1
Immovable Rod
Bag of Holding
Ring of Feather Falling
One weapon with a boon and curse
One conscious item with a personality and demand
Then begin rolling the existing treasure tables instead of awarding the same Starfall Blade, Aegis Mail, gold, or spell cycle in [progression.ts (line 52)](D:/Code/shadowdork/src/game/progression.ts:52).
Magic items should usually change how a room can be solved. “+2 damage” is less interesting than “pins a platform in place, but rings like a gong whenever you kill something.”
2. Upgrade magical mishaps
Mishaps are already implemented in [mishaps.ts (line 10)](D:/Code/shadowdork/src/data/tables/mishaps.ts:10), but most current outcomes are variations of damage, disadvantage, extinguished light, launching upward, or attracting monsters.
The source material’s memorable mishaps alter the situation:
Spell hits the caster or an ally
Gear vanishes or is stolen
A sinkhole opens
A hostile creature or portal appears
The caster becomes a beacon
A spell is forgotten
A magical tear grows each round
Witch mishaps create swamp gas, a salt prison, transformation, uncontrolled laughter, or a summoned nemesis
Implement separate Wizard and Diabolical/Witch tables, with 10–12 spatial outcomes per tier band.
One important improvement: when a natural 1 appears, freeze briefly and offer “Spend Luck / Accept Mishap.” Currently the consequence can occur before luck provides a meaningful choice. The short prompt would work equally well on desktop and touchscreens.
3. Add interaction before combat
The core rules’ reaction system is a major omission. Every generated encounter currently arrives “already hunting” in [encounters.ts (line 22)](D:/Code/shadowdork/src/game/systems/encounters.ts:22).
Random encounters should roll:
Starting distance
Current activity: eating, guarding, sleeping, building, hunting
Reaction: hostile, suspicious, neutral, curious, or friendly
Give the player a small contextual choice:
Hide
Ambush
Parley
Offer food or treasure
Threaten
Retreat
This single system multiplies the usefulness of Charisma, stealth, languages, treasure, rumors, NPCs, and utility spells. It also makes monsters feel like inhabitants instead of moving damage sources.
4. Make mundane gear into exploration verbs
Rope, grappling hooks, iron spikes, and similar items already exist, but are effectively unused—and some are explicitly stripped from old saves in [state.ts (line 105)](D:/Code/shadowdork/src/game/state.ts:105).
Useful contextual actions would include:
Spike a door shut to delay an encounter
Anchor a rope to create a permanent climbing path
Grapple across a gap
Jam a crusher or moving platform
Pour oil and ignite it
Throw food to distract a beast
Use a mirror to inspect around a corner
Recover or extinguish dropped torches
This fits the Lost Vikings-style design especially well: equipment becomes portable puzzle vocabulary without adding twitch execution.
5. Add focused utility spells, not a giant spell dump
There are currently seven Wizard and seven Priest spells in [spells.ts (line 3)](D:/Code/shadowdork/src/data/spells.ts:3). More would help, but select spells that create new spatial or social possibilities.
My first additions would be:
Spidersilk: wall walking
Witchlight: movable light source
Cauldron: repair or temporarily store objects
Fog: concealment
Cat’s Eye/Chant: reveal secrets and hidden creatures
Bogboil: create blocking terrain
Broomstick: controlled flight
Howl: force morale
Cast Out: create a no-entry zone
Trance: grant luck
Potion: cure poison or stabilize
Wolfshape: alternate traversal and combat form
Read the Runes or Speak With Dead: expose secrets and optional routes
Also implement Focus properly. Powerful effects should continue while the caster maintains them and risk ending when distracted or hurt. That creates interesting positioning without another resource bar.
6. Make the Cursed Scroll classes authentic
The alternate classes currently add visual/theme variety more than mechanical variety.
Examples:
Witch should cast actual Witch spells and use Diabolical Mishaps.
Seer should use Seer spells, especially fate, luck, protection, and transformation.
Ras-Godai needs a real hide/unaware system before its assassin feature matters.
Sea Wolf’s Shield Wall should be an activated stance, not a passive AC bonus.
Pit Fighter’s Flourish says it heals on melee hits, but currently grants a damage bonus.
Diablerie is also missing Warlocks, patron boons, and Knights of St. Ydris.
Red Sands is missing Desert Riders and much of poison play.
I would finish the existing five alternate classes before adding more classes.
7. Add Oaths and Patron Bargains
These are probably the best campaign rules in the three zines for a digital adaptation.
For Midnight Sun, allow one oath per destination:
Complete the vault without magical light
Cast the greatest treasure into the sea
Kill a named enemy
Rescue every prisoner
Never retreat from an undead foe
Success grants a permanent or destination-length boon; failure imposes a curse.
For Diablerie, patrons should offer a boon paired with an intrusive demand:
Extinguish a shrine
Feed a nightmare to the Willowman
Preserve a forbidden spellbook
Sacrifice a specific treasure
Spare or betray a particular NPC
These provide run-specific objectives with almost no additional control complexity.
8. Restore a meaningful treasure/economy loop
The game currently tops every survivor up to the next level when descending into each vault in [Dungeon.ts (line 2885)](D:/Code/shadowdork/src/game/scenes/Dungeon.ts:2885). That substantially weakens treasure XP: players level whether or not they recovered treasure.
I would change progression to:
Treasure and boons provide normal XP.
Gold can be spent without losing previously earned XP.
Carousing converts gold into additional XP plus a random story consequence.
Completing an entire Cursed Scroll destination can grant a bonus level or talent roll.
Penance, supplies, training, rumors, and healing compete for gold.
Carousing outcomes can introduce allies, rivals, fines, stolen gear, luck tokens, treasure maps, or the next optional vault. This makes the safe zone part of the game rather than just a shop screen.
9. Add monster conditions and special attacks
Most monsters currently resolve to variations of moving close and attacking. Add a reusable condition layer:
Poison
Webbed
Grappled or dragged
Blinded
Frightened
Asleep
Paralyzed
Corroded equipment
Swallowed
Charmed
Light extinguished
Spell suppressed
Then give every monster family one defining rule. A spider should play differently from a skeleton, scorpion, living shadow, or rust monster. This will improve combat more than adding additional ordinary stat blocks.
10. Make resting a dangerous choice
Core Shadowdark camping uses three torches for an eight-hour campfire and risks interruption. The current gear-menu rest consumes one leader ration and heals the party’s HP immediately in [Dungeon.ts (line 1439)](D:/Code/shadowdork/src/game/scenes/Dungeon.ts:1439).
A better dungeon rest:
Costs one ration per resting character
Costs three torches unless at a permanent fire
Advances the encounter clock
May be interrupted
Failure consumes resources without restoring that character
Lets the player assign one person to watch, improving the surprise result
That produces a meaningful “push onward or camp?” decision.
Lower-priority additions
These are worthwhile later:
Enduring wounds, but preferably as an opt-in “take a scar to survive” choice. Permanent random limb loss will likely feel punitive in a persistent mobile campaign.
Poisons, particularly because they make the Ras-Godai and antidotes meaningful.
Rumors, rival crawler parties, and treasure maps.
Pit fighting as a safe-zone side activity.
Boats, mounts, navigation, and full hex travel only if you intend to build an overworld. They do not improve the current dungeon loop enough to justify early development.
A 0-level Gauntlet as a separate challenge mode, not the default campaign.
The strongest initial package
If choosing one development milestone, I would build:
Usable potions, scrolls, wands, and six distinctive magic items.
Reaction/activity rolls with Hide, Parley, Bribe, Ambush, and Retreat.
Ten new spatial utility spells plus Focus.
Expanded Wizard and Witch mishaps.
Functional Witch and Seer class identities.
One oath or patron bargain attached to every Cursed Scroll destination.