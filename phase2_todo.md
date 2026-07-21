# Shadowdork Phase 2 - Gameplay Rules TODO

## Goal

Make Shadowdork more replayable and more faithful to the Shadowdark core rules
and Cursed Scrolls 1-3 by adding rules that create decisions, consequences, and
alternate solutions. This phase deliberately excludes graphics and sound work.

The highest-value work is not adding more passive bonuses or larger content
tables. It is turning magic, equipment, encounters, and campaign progression
into systems the player can actively use.

## Design constraints

- Preserve the low-twitch, Lost Vikings-style party puzzle identity.
- Every major rule should create a choice, a new solution, or a new risk.
- Use contextual actions and short prompts that work on desktop and mobile.
- Avoid large hotbars and control combinations that are difficult on touch.
- Keep light, gear slots, time, and treasure as the central resource pressures.
- Prefer a small set of fully functional spells and items over large data-only
  catalogs.
- Keep procedural runs deterministic under their run seed.
- Add pure, renderer-free rules tests before wiring a system into Phaser.
- Clearly document deliberate deviations from Shadowdark RAW.

## Existing foundation to preserve

- Real-time torch and darkness pressure.
- Crawling-round random encounter checks.
- Gear slots, equipment, shops, and persistent inventory.
- Treasure XP, class talents, and persistent parties.
- Death timers, stabilization, luck, morale, and fleeing monsters.
- Spell checks, spell loss, critical casting, wizard mishaps, and priest
  atonement.
- Fourteen implemented Wizard and Priest spells.
- Cursed Scroll destination and biome progression.
- Stateful traps, contextual interaction prompts, NPCs, and save-anywhere
  campaign state.

## Phase 2 completion criteria

Phase 2 is complete when:

- Consumable and utility magic items can be used, not merely stored.
- Random encounters can begin as social, uncertain, avoidable, or hostile.
- Mundane gear provides reusable exploration actions.
- Wizard, Witch, Priest, and Seer magic have distinct gameplay identities.
- Mishaps can alter rooms and encounters, not only deal damage or apply a
  numerical penalty.
- Each Cursed Scroll destination offers a destination-specific campaign rule.
- Treasure, gold, downtime, and leveling form a coherent progression loop.
- Resting in danger is a meaningful resource and encounter risk.
- Monster families have distinct special rules and conditions.
- All new interactions are usable with keyboard, controller-ready actions, and
  a touch-friendly contextual interface.

---

## P2-0 - Rules and data foundations

### Typed usable-item actions

- [x] Add a typed item-use model for potions, scrolls, wands, rings, utility
  items, relics, and charged items. (`ItemUseDef` on `ItemDef`, [inventory.ts](../src/engine/inventory.ts) — no concrete item wired yet, that's P2-1.)
- [x] Separate `equip`, `consume`, `cast`, `activate`, `place`, and `inspect`
  actions. (`ItemActionKind`.)
- [x] Represent charges, once-per-rest use, temporary inertness, and permanent
  breakage in saved state. (`ItemStateTracker`, `Character.itemState`, `SavedCharacter.itemState`.)
- [x] Add contextual target requirements: self, ally, enemy, point, object,
  surface, or no target. (`ItemTargetKind`, `itemTargetNeedsSelection`.)
- [x] Make invalid actions return a reason suitable for the HUD rather than
  silently doing nothing. (`canUseItem` → `UseCheck` with a `message`, [itemActions.ts](../src/engine/itemActions.ts).)
- [x] Add serialization and migration tests for all new item state. (`tests/state.test.ts`, `tests/itemActions.test.ts`.)

### Conditions and temporary states

- [x] Add reusable conditions for poisoned, webbed, grappled, blinded,
  frightened, sleeping, paralyzed, charmed, silenced, corroded, swallowed, and
  magic-suppressed. ([conditions.ts](../src/engine/conditions.ts).)
- [x] Give every condition an explicit duration and removal rule. (Reuses the
  existing `Effect`/`Duration` tick machinery in `Engine`; `applyCondition`/`removeCondition`.)
- [x] Show important conditions beside party HP. (Hud.ts party rows.)
- [ ] Show conditions in monster feedback — deferred to P2-9, when monsters
  gain the condition layer at all.
- [x] Ensure rest, healing, antidotes, death, and scene transitions resolve or
  persist each condition intentionally. (Death strips every timed effect;
  round-based conditions expire on their own timer regardless of rest;
  untilRest conditions clear on rest, matching existing until-rest effects.)
- [x] Add deterministic tests for stacking, cancellation, expiry, save/load,
  and immunity. (`tests/conditions.test.ts`.)

### Contextual choice UI

- [x] Generalize the current contextual `E` interaction into a short action
  chooser when more than one action is valid. (`findInteractions` in
  [Dungeon.ts](../src/game/scenes/Dungeon.ts) collects every valid candidate
  instead of the first cascade match winning outright — e.g. a safe-zone room
  with a shop, shrine, and campfire together now offers all three instead of
  only the shop.)
- [x] Support keyboard selection, controller-ready navigation, and large touch
  targets from the same action model. (New `actionChoice` mode; cursor+confirm
  via the same menuUp/menuDown/interact actions the shop/gear overlays use.)
- [x] Pause or slow dangerous simulation while a modal target or consequence
  choice is open. (`actionChoice` is world-pausing, same as shop/gear.)
- [x] Never require drag precision or a hidden long-press to perform a core
  action. (Tap-to-move-cursor + tap-to-confirm, same large hit targets as
  every other overlay.)

---

## P2-1 - Functional magical treasure

This is the first player-facing milestone. The existing item and treasure data
must become usable gameplay.

### Initial consumables

- [x] Potion of Healing: consume, heal, remove the item, and allow recovery from
  dying where appropriate.
- [x] Potion of Invisibility: end on attack or spellcasting.
- [x] Potion of Flying: grant bounded vertical movement for a short duration.
- [x] Potion of Water Breathing: ignore drowning rules for its duration. (The
  current flooded chamber has buoyancy but no drowning damage; the capability
  hook is live and ready for any future drowning clock.)
- [x] Potion of Giant Strength: temporarily increase Strength without corrupting
  the saved base stat.
- [x] Add a visible duration and a contextual `Use` action for every potion.

### Scrolls and wands

- [x] A caster may use a scroll or wand only when the spell belongs to their
  spell list, even if they do not know it.
- [x] Cast from an item using DC `10 + spell tier`.
- [x] A scroll's writing disappears after any casting attempt.
- [x] A scroll critical failure also triggers the caster's mishap table.
- [x] A wand becomes inert until rest after a normal failure.
- [x] A wand permanently breaks on a critical failure and triggers a mishap.
- [x] Item casting must not lose the character's known copy of the spell.
- [x] Implement the existing Cure Wounds, Light, Burning Hands, Feather Fall,
  and Fireball item entries first.

### First utility and personality items

- [ ] Immovable Rod: pin moving geometry, doors, lifts, crushers, or an anchor
  point where explicitly supported.
- [x] Bag of Holding: increase useful capacity without eliminating gear-slot
  pressure.
- [x] Ring of Feather Falling: automatically prevent a limited number of
  dangerous falls per rest or destination.
- [ ] Add one weapon with a strong benefit and a meaningful curse.
- [ ] Add one conscious item with an alignment, virtue, flaw, demand, and
  refusal condition.
- [x] Add a lightweight `Inspect` view that reveals known properties without
  becoming a large inventory encyclopedia.

### Treasure generation

- [ ] Route room, boss, NPC, secret, and vault rewards through the registered
  core and Cursed Scroll treasure tables.
- [ ] Preserve curated campaign rewards where necessary, but stop using the
  fixed companion/weapon/armor/gold/spell cycle as the only major reward path.
- [ ] Respect danger or level bands when choosing treasure tables.
- [ ] Roll item benefit, curse, and personality deterministically where a
  generated magic item calls for them.
- [ ] Prevent unlimited light, unlimited inventory, or other items that erase a
  core Shadowdark pressure.
- [ ] Add seeded distribution tests and save/load tests for generated treasure.

### Acceptance criteria

- A player can find, inspect, use, consume, cast from, equip, drop, and save at
  least twelve distinct functional magic items.
- At least four items create a new room solution rather than only a combat
  bonus.
- A failed wand or scroll attempt follows different rules from a failed known
  spell.

---

## P2-2 - Mishaps 2.0 and casting decisions

### Luck before consequences

- [x] On a natural 1 spell check, freeze resolution before applying the mishap.
- [x] Offer `Spend Luck` or `Accept Mishap` when the caster has a token.
- [x] Make the prompt work with keyboard and one-tap mobile actions. (Uses the
  shared world-pausing action chooser with wrapped preview text.)
- [x] Resolve the rerolled check fully and use the new result.
- [x] Add regression tests ensuring a mishap cannot apply twice or survive a
  successful luck reroll.

### Wizard mishaps

- [x] Expand each Wizard tier band to a full, varied table. (Each band is now a
  contiguous 1d12 table.)
- [x] Include redirected spells that strike the caster or a nearby ally.
- [x] Include lost or vanished gear.
- [x] Include suppressed light or a magical beacon.
- [x] Include a sinkhole or other room-geometry consequence.
- [x] Include hostile summons and portals.
- [x] Include temporary spell loss and rare permanent spell loss.
- [x] Include a growing magical tear or repeated uncontrolled casting at high
  tiers.
- [x] Ensure every spatial outcome has a safe fallback in unsupported room
  geometry.

### Diabolical Witch mishaps

- [x] Give Witch casting its own Diabolical Mishap tables. (Witches now cast
  with CHA and use their own 1d12 table for every tier band.)
- [x] Include temporary transformation, uncontrollable laughter, stolen gear,
  swamp gas, a salt prison, hostile familiars or imps, and patron displeasure.
- [x] Prefer destination-length curses over permanent campaign destruction when
  the original result would be excessively punitive in this format.
- [x] Make severe consequences clearly previewed before the player accepts the
  mishap instead of spending luck.

### Acceptance criteria

- Mishaps include damage, movement, targeting, inventory, light, summoning,
  terrain, spell-state, and campaign consequence families.
- Repeated mishaps do not feel like differently worded damage rolls.
- Every result is deterministic, save-safe, and leaves the run in a valid
  state.

---

## P2-3 - Encounter uncertainty, stealth, and parley

**Scoping note:** shipped assuming the party is never surprised — the
"Stealth and surprise" subsection below (hiding locations, detection,
unaware-target features) is real prerequisite work for surprise to exist at
all, and stays its own later slice. Every wandering encounter now offers the
reaction popup unconditionally instead of arriving already hunting.

### Encounter setup

- [x] Roll starting distance for wandering encounters. (`rollDistance`,
  [encounterReaction.ts](../src/engine/encounterReaction.ts); three bands —
  close/near/far — change the off-camera spawn offset.)
- [x] Roll current activity: eating, guarding, sleeping, building, or hunting.
  (`rollActivity`. "Nesting" and "socializing" from the original phrasing were
  folded into "building" and "guarding" — five slots, not seven.)
- [x] Roll reaction where hostility is not predetermined: hostile, suspicious,
  neutral, curious, or friendly. (`rollReaction`, a 2d6 bell curve so hostile
  and friendly are the rare tails.)
- [x] Allow Charisma to modify reaction when a character openly interacts.
  (Parley/Threaten resolve as a leader CHA check scaled by the rolled
  reaction — friendly is an easy DC, hostile is hard.)
- [ ] Preserve always-hostile exceptions for suitable undead and creatures.
- [ ] Give randomly encountered creatures an appropriate chance to carry
  treasure.

### Player choices

- [x] Offer Hide, Ambush, Parley, Offer (Bribe), Threaten, and Retreat when
  valid. (`availableEncounterChoices`; a sleeping wave only offers
  Ambush/Hide/Retreat — you can't parley with someone asleep. Resolution lives
  in `resolveEncounterChoice`, [Dungeon.ts](../src/game/scenes/Dungeon.ts).)
- [x] Let food or treasure affect the available options or result. (Offer
  drops out entirely if the leader has neither a ration nor 10+ gold; whichever
  is available is spent.) Languages, patron status, and monster type do not
  affect this yet.
- [ ] Allow surrender and non-lethal resolution for intelligent opponents.
- [ ] Let neutral or friendly encounters trade, warn about the current dungeon,
  request aid, or become temporary allies.
- [ ] Make a failed social action reveal the party and worsen the reaction when
  appropriate. (A failed Parley/Threaten currently just engages combat, not a
  distinct "worse than before" state.)

### Stealth and surprise

- [ ] Add hiding locations and an explicit hidden state.
- [ ] Searching the correct location automatically reveals a hidden creature.
- [ ] Otherwise use Wisdom to detect a sneaking or hidden creature.
- [ ] Give an undetected attacker one surprise action or a clearly bounded
  real-time equivalent before normal combat begins.
- [ ] Attacking from hiding reveals the attacker unless a feature says
  otherwise.
- [ ] Apply armor penalties to stealth.
- [ ] Make Ras-Godai and Thief unaware-target features depend on this shared
  system.

### Retreat

- [ ] Provide a deliberate retreat interaction rather than relying only on
  running offscreen.
- [ ] Define pursuit using monster speed, activity, morale, light, closed doors,
  spiked doors, distractions, and party burden.
- [ ] Preserve dropped treasure or gear as an optional escape cost.

### Acceptance criteria

- [x] A random encounter can end in combat (Ambush, or a failed Parley/
  Threaten) or avoidance (Hide, Retreat, or a successful Parley/Threaten/
  Offer) — not yet in information, trade, aid, or surrender specifically.
- [x] At least one full path (Hide, Retreat, or a successful Parley/Threaten/
  Offer) completes a wandering encounter without making an attack roll.
- [x] Encounter choices reuse the same cursor+confirm overlay as every other
  chooser, so they're already readable and operable on a narrow mobile
  viewport without a separate mobile pass.

---

## P2-4 - Mundane gear as exploration verbs

**Scoping note:** shipped one item end-to-end (Iron Spikes) as a vertical
slice rather than all eight; the rest stay open for a later pass. Iron Spikes
specifically forces open a locked/switched gate instead of literally
"spiking a door shut" — the level model has no door-closing or
monster-door-awareness system for a pursuer to be delayed by, so the
closest faithful, actually-representable analog was chosen: skip the
key/switch puzzle at the cost of the item. The option only appears (as an
additional popup choice alongside "requires its key/switch") when the leader
is carrying at least one.

- [x] Iron Spikes: force open a locked/switched portcullis/connector without
  its key or switch, consuming one spike. ([Dungeon.ts](../src/game/scenes/Dungeon.ts)
  `findInteractions` gate block.)
- [ ] Iron Spikes: jam supported machinery, or mark a route.
- [ ] Rope: anchor a persistent climb path, lower a companion, or secure a
  dangerous crossing.
- [ ] Grappling Hook: create a validated traversal connection at authored hook
  points.
- [ ] Oil: create a slippery patch or temporary fire hazard.
- [ ] Mirror: inspect around a corner or redirect a supported light puzzle.
- [ ] Food/Rations: distract or placate suitable beasts instead of only
  resting. (Ration-as-Offer inside the encounter popup is close but
  encounter-specific — a standalone "throw food at a wandering monster"
  verb outside that popup is still open.)
- [ ] Torch: throw, drop, extinguish, relight, or place it in a supported holder.
- [ ] Recover usable placed gear after the danger has passed.
- [ ] Persist placed gear and resulting connector states in saves. (The
  spiked-gate's `openedConnectors` entry does persist — that part of the
  pattern is proven for whichever future gear placement needs it.)
- [x] Restore formerly stripped rope, hook, and spike inventory safely through
  save migration. (Iron spikes only — [state.ts](../src/game/state.ts) no
  longer strips them. Rope and grappling hook are still stripped since they
  still have no wired use.)

### Acceptance criteria

- At least four mundane items solve or materially change authored room
  problems.
- Every class-specific shortcut retains a costly universal solution using
  equipment, risk, or resources.
- Placed gear cannot create invalid geometry, duplicate itself, or disappear
  across save/load.

---

## P2-5 - Spell expansion and Focus

Add a small set of spells that interact with traversal, information, morale,
light, conditions, and room state. Add only one core Wizard damage option per
tier after tier 1 so higher-tier progression always unlocks an offensive spell
without turning the spell list into a damage catalog.

### Core Wizard damage ladder

- [x] Tier 2 - Acid Arrow: a far-range corrosive bolt that deals 1d6 damage
  each round while the Wizard maintains Focus. This is the sustained
  single-target option and the first live test of Focus under combat pressure.
- [x] Tier 3 - Lightning Bolt: deal 3d6 damage to every creature in a straight
  line out to far range. Fireball already provides tier 3 area damage;
  Lightning Bolt adds a distinct positioning and friendly-fire problem.
- [x] Tier 4 - Cloudkill: create a near-sized persistent poison cloud at far
  range that spreads around corners, blinds creatures inside, and deals 2d6 at
  the start of their turns. Implement the core low-level-creature lethality
  rule only with clear area telegraphing and pathfinding that lets creatures
  attempt to escape.
- [x] Tier 5 - Prismatic Orb: choose fire, cold, or electricity, deal 3d8 to one
  far target, and double the damage when the chosen energy is anathema to the
  target. This makes monster knowledge and elemental identity matter.
- [x] Unlock these spells through normal spell discovery and maximum-tier
  progression; do not grant all four automatically.
- [x] Apply each spell to allies as well as enemies where the core area rule
  says `all creatures`.
- [ ] Give lines and persistent areas clear previews that work with mouse,
  keyboard, controller-ready selection, and touch.

### Initial Witch spells

- [x] Spidersilk: walk on supported vertical surfaces while focused.
- [x] Witchlight: control a movable close-radius light while focused.
- [x] Cauldron: repair a mundane item or temporarily store limited gear.
- [x] Fog: create moving concealment and ranged-attack disadvantage.
- [x] Cat's Eye: reveal invisible creatures and nearby secrets while focused.
- [x] Bogboil: create temporary blocking terrain.
- [x] Broomstick: focused flight with clear indoor boundaries.
- [x] Howl: force an immediate morale check.
- [x] Speak With Dead: ask bounded questions that can reveal seeded room facts.

### Initial Seer spells

- [x] Chant: reveal hidden and invisible things without granting darkvision.
- [x] Trance: grant one luck token to another character.
- [x] Potion: cure poison or stop dying while leaving the target unconscious.
- [x] Evoke Rage: grant a willing ally melee power and morale immunity while
  requiring aggression.
- [x] Fate: damage a target and remove luck-like protection where supported.
- [x] Read The Runes: reveal a truthful yes/no omen from authored run facts.
- [x] Cast Out: prevent one creature from entering the Seer's near zone while
  focused.
- [x] Wolfshape: grant a distinct traversal and combat form.

### Focus rules

- [x] Mark appropriate spells as Focus spells.
- [x] A caster may focus on only one spell at a time.
- [x] Make a spellcasting check to maintain Focus at the appropriate cadence.
- [x] Failure ends Focus but does not lose the spell solely because the Focus
  check failed.
- [x] Damage and other distractions trigger a Focus check rather than always
  ending the spell automatically.
- [x] Show the focused spell and its affected target or area in the HUD.
- [x] End Focus cleanly on death, unconsciousness, rest, scene transition, or a
  voluntary cancel action.

### Targeting

- [x] Support self, ally, enemy, point, and object spell targets.
- [x] Keep quick-cast behavior for unambiguous spells.
- [x] Open a compact target chooser only when more than one valid target or
  point exists.
- [x] Prevent utility spells from becoming mandatory single-solution gates.

### Acceptance criteria

- Wizard progression has at least one damaging spell available at every tier.
- The tier 2-5 damage additions use four different tactical shapes: sustained
  target, line, persistent area, and selectable element.
- Witch and Seer each have at least six unique, functioning spells.
- At least half of the new spells create non-damage decisions.
- Focus is understandable without consulting an external rules screen.

---

## P2-6 - Authentic Cursed Scroll classes

### Witch

- [x] Use Charisma for Witch casting.
- [x] Replace borrowed Wizard starting spells with Witch spells.
- [x] Use Witch spell-known progression and talent data.
- [x] Implement a familiar that can scout, carry a tiny object, and serve as a
  spell origin where safe.
- [x] Define familiar death and restoration costs.
- [x] Use Diabolical Mishaps.

### Seer

- [x] Replace borrowed Priest spells with Seer spells.
- [x] Use the Seer spell-known progression and talent table.
- [x] Implement Destined so spending luck adds its intended bonus.
- [x] Connect Seer abilities to persistent, limited-use omens.
- [ ] Connect Seer abilities to destination Oaths when the P2-7 Oath system is
  implemented.

### Ras-Godai

- [x] Make Assassin depend on the shared hidden/unaware state.
- [x] Implement the intended unaware-target damage.
- [x] Add poison training so normal poison accidents occur only on a natural 1.
- [x] Give the class its own talent table rather than the Thief table.

### Sea Wolf

- [x] Implement Shield Wall as an activated defensive stance requiring a
  readied shield.
- [x] Apply the intended AC behavior instead of a passive generic bonus.
- [x] Define movement, attack, and cancellation rules for the stance.
- [x] Adapt Seafarer into a dungeon-relevant feature: advantage on swimming,
  balancing on wet or icy surfaces, and resisting water-driven forced movement.
- [x] Give the class its own talent table.

### Pit Fighter

- [x] Implement Flourish as limited healing triggered by a valid melee hit.
- [x] Track daily or rest-based uses.
- [x] Implement Implacable for injury and poison resistance checks.
- [x] Give the class its own talent table.

### Additional classes - after the above are complete

- [ ] Evaluate Knight of St. Ydris as a Fighter/Priest alternative with
  possession-driven risk.
- [ ] Evaluate Warlock only after patrons and patron boons are implemented.
- [ ] Do not add a class whose defining feature has no usable game system.

---

## P2-7 - Destination rules: Oaths and Patron Bargains

### Midnight Sun Oaths

- [ ] Allow each eligible character to swear at most one oath per destination
  or other clearly displayed campaign interval.
- [ ] Generate Worthy, Mighty, and Legendary oath options from facts that are
  achievable in the current destination.
- [ ] Example objectives: surrender the greatest treasure, kill a named foe,
  rescue all prisoners, use no magical light, or never retreat from undead.
- [ ] Track progress visibly in the HUD and save state.
- [ ] Grant a bounded permanent or destination-length boon on fulfillment.
- [ ] Apply a clearly previewed penalty on failure.
- [ ] Never generate an oath made impossible by the dungeon seed.

### Diablerie Patrons

- [ ] Add Almazzat, Kytheros, Mugdulblub, Shune, Titania, and the Willowman as
  patron data.
- [ ] Pair each patron boon with requests, taboos, and possible displeasure.
- [ ] Offer bargains during destination entry, shrines, dreams, NPC meetings,
  or mishaps.
- [ ] Example demands: extinguish a shrine, preserve forbidden lore, sacrifice
  a named treasure, spare an NPC, betray an NPC, or feed the patron a secret.
- [ ] Let the player refuse a bargain.
- [ ] Track favor and patron consequences without adding a grindable reputation
  meter.

### Acceptance criteria

- Midnight Sun and Diablerie each change campaign decisions, not only palette,
  monsters, or companion appearance.
- Objectives, rewards, and penalties are known before commitment.
- Generated obligations are compatible with the current run and save correctly.

---

## P2-8 - Treasure, downtime, and progression loop

### Advancement policy

- [ ] Revisit the automatic level granted on every vault descent.
- [ ] Make treasure and boons the normal source of XP again.
- [ ] Preferred rule: vault descent preserves progress; completing an entire
  Cursed Scroll destination may grant a bonus level, talent roll, or major
  boon.
- [ ] Avoid awarding a guaranteed level so frequently that treasure choices no
  longer matter.
- [ ] Document the final progression rule as a deliberate RAW or house-rule
  decision.

### Carousing

- [ ] Add Carouse as a safe-zone downtime action.
- [ ] Offer escalating gold costs and outcome bonuses.
- [ ] Convert gold into XP plus a seeded consequence.
- [ ] Outcomes may grant luck, allies, favors, fines, lost wealth, debts,
  barred locations, temporary conditions, or a magic item.
- [ ] Present the consequence as a short event card, not a long dialogue tree.

### Learning and services

- [ ] Add one downtime activity per safe-zone visit.
- [ ] Support training a relevant auxiliary skill through an instructor.
- [ ] Lower the training DC after a failed attempt as in the core rule.
- [ ] Give gold competing uses: supplies, atonement, training, carousing,
  healing, and special services.

### Acceptance criteria

- Gold presents at least three meaningful competing expenditures.
- Treasure remains exciting after a character has enough basic equipment.
- A carousing outcome can change a later dungeon event.

---

## P2-9 - Monster identity and special attacks

- [ ] Give every monster family one defining behavior or condition.
- [ ] Spiders: web, restrain, climb, or drag isolated targets.
- [ ] Scorpions and viperians: poison and antidote play.
- [ ] Shadows: extinguish or avoid light and attack from darkness.
- [ ] Undead: morale immunity where appropriate, Turn Undead interactions, and
  relentless pursuit.
- [ ] Oozes: engulf, split, dissolve gear, or reshape traversal space.
- [ ] Rusting creatures: threaten metal equipment without silently deleting a
  prized item.
- [ ] Intelligent foes: retreat, surrender, call reinforcements, use doors,
  negotiate, and protect leaders.
- [ ] Bosses: add one state change or environmental interaction instead of only
  more HP and damage.
- [ ] Show a readable tell before severe control or equipment-damaging attacks.

### Acceptance criteria

- Encounter composition changes tactics because of monster rules, not only
  monster statistics.
- Conditions and special attacks remain legible in darkness and on mobile.
- Control effects do not remove player agency for long uninterrupted periods.

---

## P2-10 - Risky resting and camp procedure

- [x] Require one ration per resting character. (The old gear/hotkey path that
  spent only the leader's ration while healing everyone now shares the same
  per-character resolver as campfires.)
- [ ] Allow three torches to create an eight-hour stationary campfire.
- [ ] Advance the encounter clock for the full rest.
- [ ] Check for interruptions using the location's danger cadence.
- [ ] Let the party assign a watch character.
- [ ] Use watch position, ancestry, light, and Wisdom to affect surprise without
  guaranteeing safety.
- [ ] After a stressful interruption, require the appropriate Constitution
  check to receive rest benefits.
- [ ] On failure, consume the ration but do not restore that character.
- [ ] Recover HP, temporary stat damage, rest-based item uses, and eligible
  spells only on a successful rest.
- [ ] Preserve shrine or sacrifice requirements for atonement-locked Priest
  spells.
- [ ] Keep sanctuary rests as a clearly identified safe exception where the
  campaign structure requires one.

### Acceptance criteria

- Resting in a dungeon asks the player to weigh food, torches, danger, and spell
  recovery.
- Rest resolution works per character rather than healing the party through one
  leader ration.
- Interrupted rest cannot duplicate supplies, encounters, or recovery after
  save/load.

---

## P2-11 - Optional and later rules

These systems are useful but should not block the core Phase 2 loop.

### Enduring wounds

- [ ] Prototype as an opt-in bargain when a character survives reaching 0 HP:
  accept a wound or scar in exchange for an immediate survival benefit.
- [ ] Prefer temporary or destination-length wounds for common results.
- [ ] Reserve permanent stat loss or limb loss for explicit high-stakes choices.
- [ ] Include occasional scars, stories, or future advantages so the system is
  not only punishment.

### Poisons

- [ ] Implement poison application accidents and trained-user rules.
- [ ] Add common injury, contact, inhaled, and ingested poisons.
- [ ] Add antidotes, poison recovery, monster immunity, and clear duration
  handling.
- [ ] Keep poisons valuable and scarce rather than another routine ammunition
  counter.

---

## Recommended implementation sequence

1. **Foundation:** typed item actions, conditions, targeting, save migrations,
   and contextual choice UI.
2. **Magic treasure vertical slice:** five potions, scroll rules, wand rules,
   and three utility/personality items.
3. **Encounter vertical slice:** activity, reaction, Hide, Parley, Bribe,
   Ambush, Retreat, and surprise.
4. **Exploration gear:** spikes, rope, grappling hook, throwable/placeable
   torches, and food distractions.
5. **Magic identity:** Focus plus the first Witch and Seer utility spells.
6. **Mishaps 2.0:** pre-consequence luck prompt, expanded Wizard tables, and
   Diabolical Witch tables.
7. **Class completion:** Witch, Seer, Ras-Godai, Sea Wolf, and Pit Fighter.
8. **Destination rules:** Midnight Sun Oaths and Diablerie Patron Bargains.
9. **Campaign economy:** treasure-table rewards, progression policy,
   carousing, learning, and safe-zone services.
10. **Dungeon pressure:** monster special rules and risky resting.
11. **Optional modules:** enduring wounds and poisons.

## First shippable Phase 2 package

If Phase 2 must be divided into smaller releases, ship this package first:

- [x] Five functional potions.
- [x] Scroll and wand casting rules.
- [ ] Immovable Rod, Bag of Holding, Ring of Feather Falling, one cursed weapon,
  and one conscious item.
- [ ] Random encounter distance, activity, and reaction.
- [ ] Hide, Parley, Bribe, Ambush, and Retreat.
- [ ] Iron Spikes, Rope, Grappling Hook, and placeable torches.
- [ ] Acid Arrow, Lightning Bolt, Cloudkill, and Prismatic Orb as the core
  Wizard tier 2-5 damage ladder.
- [ ] Focus and at least six utility spells split between Witch and Seer.
- [x] Expanded Wizard mishaps and a Diabolical Witch mishap table.
- [ ] Functional Witch and Seer class identities.
- [ ] One Oath system for Midnight Sun and one Patron Bargain system for
  Diablerie.

This package should produce more replayability and player agency than adding a
large number of ordinary monsters, passive bonuses, or damage-only spells.

## Verification checklist for every milestone

- [ ] Unit tests cover the pure rule and every failure branch.
- [ ] Seeded tests prove deterministic outcomes.
- [ ] Save/load tests cover every new persistent state.
- [ ] Existing saves migrate without losing valid user inventory or party data.
- [ ] Desktop keyboard flow is verified.
- [ ] Narrow mobile viewport and touch-target flow are verified.
- [ ] Pausing, tab switching, backgrounding, and resuming do not advance modal
  choices or duplicate effects.
- [ ] No new item, spell, or class feature silently does nothing.
- [ ] No generated objective can be impossible for its dungeon seed.
- [ ] The event log explains important rolls, costs, and consequences.
- [ ] `npm test` and `npm run build` pass before the milestone is marked done.
