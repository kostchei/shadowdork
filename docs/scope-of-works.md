# Shadowdork — Scope of Works (post-commit review, 2026-07-16)

> **Status (2026-07-17):** WS-0, WS-1, and WS-2 are implemented and verified
> in-browser; WS-4 items 1–5 are in (per-character XP/AC/gear HUD, colored
> log, low-torch alarm, contextual E prompt, JustDown casting, luck hints,
> level-up ceremony, float-text jitter, run-summary overlays). Still open:
> WS-4 items 6–7 (audio, pause/settings), all of WS-3 (room-system variance
> primitives), and WS-5 (campaign continuity). One WS-1 delta: luck rerolls
> are offered on the leader's just-failed swing/cast/stabilize inside a 2.5 s
> window rather than "any roll" — mishaps have already detonated and cannot
> cleanly be undone.

Findings from reviewing commits `efd1e4e` (dungeon variety + presentation) and
`9406768` (graphics/animations/particles + seeded variety), auditing the engine
against the RAW reference docs, and a gameplay/UI pass. Ordered work packages
at the end.

---

## Part 1 — Review of the two most recent commits

### Verdict

`efd1e4e` is a solid commit: the `DungeonDefinition` library, three authored
dungeons, themed presentation, and grid validation tests all land cleanly and
match the improvement plan's Phase 1. `9406768` delivers real visual value
(animations, particles, hit feedback) **but its seeded-level half is a
regression** against three of the project's own success checks.

### Regressions in `9406768`

**R1. Played grids are no longer validated.** `dungeonAt()` now does
`(baseDungeon as any).grid = generateSeededGrid(baseDungeon.id, index)` —
mutating the `readonly` `DUNGEONS` entries with a grid seeded by the *raw run
index*. The tests validate the five static grids (seeds 0–4), but the player
plays seed = whatever the run counter is. Verified by fuzz: the structural
invariants happen to hold across 1000 seeds today, but nothing enforces it —
this silently breaks the success check *"invalid level grids fail tests before
reaching the browser"*, and the `as any` mutation violates both the `readonly`
contract and the project's no-fallbacks ethos. The wrap-around test
(`dungeonAt(DUNGEONS.length)`) also mutates `DUNGEONS[0].grid` as a side
effect, so test results depend on execution order.

**R2. Rescue placement is accidental, not designed.** The NPC room assignment
uses chained `rng.between(prev + 1, max)` draws, which is heavily biased
late: measured over 1000 seeds, **the Wizard lands in room 4 (the boss room)
in 88.8% of runs** and never in rooms 1–2. A late rescue is a legitimate
design — a party member *as* the reward is exactly the bible's "Chained
Companion" variant — but two things make the current behavior a defect
rather than a choice: the distribution is an artifact of biased draws, not a
tuned reward frequency; and **nothing guarantees the climax is beatable by
the party you actually have on arrival**. When the Wizard sits behind the
ogre, the run must be winnable without the Wizard — today the climax rolls
its variant independently of how many rescues precede it.

**R3. Dungeon identity decoupled from layout.** `generateSeededGrid` ignores
its `dungeonId` parameter (`void dungeonId;`). Any dungeon can roll any room
variant, so "The Ember Crypt" can open with the Warren rat entrance and "The
Mold Warrens" can end in the Crypt reliquary. Names, taglines, and objectives
no longer describe what you play. The two new dungeons (Crystal Chasm, Sunken
Bastion) are palette recolors — the Sunken Bastion's tagline promises water
that no mechanic delivers.

**R4. Design invariants not enforced at assembly.** The bible's invariants —
no adjacent pure-combat rooms; light, inventory, and HP each threatened
somewhere — were implicitly true of hand-authored layouts. Random per-room
variant draws can violate them (e.g. room1 variant 2 "rat opening" into room2
variant 3 "pillar hall" is combat into combat) and nothing checks.

### Where the commits could do better (non-regression)

- **Particle code is copy-pasted six times** (blood ×2, sparkles, torch,
  campfire, brazier, fire spray, heal) across `combat.ts`, `spells.ts`,
  `Dungeon.ts`, `CharacterSprite.ts` with near-identical configs. Extract a
  small `vfx.ts` (`bloodBurst`, `sparkleBurst`, `flameEmitter(follow?)`).
- **Torch emitter offset ignores facing** (`startFollow(this, 6, -4)`), so the
  flame sits behind the sprite when walking left.
- `pickups` array grows forever (destroyed sprites stay in the list and are
  re-scanned every frame); same for `spikes` after disarm.
- `Boot.createAnimations()` only runs when textures are generated; it works
  because both are once-per-game, but the coupling is accidental — animations
  should be created unconditionally-if-absent.
- Room variants have no metadata (difficulty, resources threatened, monster
  count), which blocks doing seeding properly (see WS-3).

---

## Part 2 — Shadowdark rules-fidelity audit

Compared `src/engine/` + `src/game/systems/` against
`shadowdark_pseudocode.md`. The engine's documented deviations table is
accurate; these are the *undocumented* gaps.

### Character creation & equipment — the largest fidelity gap

Nothing is rolled and nothing is worn:

- **Stats are fixed arrays** (`classes.ts startingStats`), not 3d6. Spec:
  roll 3d6 per stat and silently regenerate the whole set until it has **at
  least two stats of 15+ and at most one stat under 6**. (RAW's reroll
  condition is "no stat 14+"; the above is our heroic variant — adopt it.)
  Rolled through the engine's seeded dice so runs stay reproducible.
- **Stats must drive the derived numbers.** Today they only feed check
  modifiers and gear slots. Required flow-through:
  - *HP at level 1* = class hit die + CON mod (min 1), not a fixed
    `startingMaxHp`.
  - *AC* = armor base + DEX mod (per armor's DEX cap), not a hardcoded class
    number — the current constants aren't even self-consistent (wizard AC 10
    ignores their DEX +1).
  - *To-hit* = stat mod (with finesse/ranged stat selection, WS-1).
  - *Damage*: note — RAW Shadowdark does **not** add stat mods to weapon
    damage (damage is the bare weapon die; class talents add damage). If
    STR-to-damage is wanted it's a house-rule config flag, same pattern as
    `torchMs`.
- **No armor system exists** — `items.ts` has no armor at all. Add armor as
  items with slot costs and class permissions: leather (AC 11 + DEX),
  chainmail (AC 13 + DEX; disadvantage swim/stealth), plate (AC 15 flat;
  cannot swim, disadvantage stealth), shield (+2, occupies a hand). Class
  permissions per RAW: fighter and priest wear anything; thief leather (and
  mithral chain when magic items arrive); wizard none. The shield-hand rule
  composes with the existing torch-in-hand rule for free — a shielded fighter
  can't also carry the light, which is exactly the Shadowdark tension.
- Armor penalties (swim/stealth) activate as those systems land in WS-3.

### Leveling / advancement — mostly faithful

Confirmed correct against spec: **a talent is rolled on every level-up**
(the deviations table calls this a deviation from the 3/5/7/9 reference —
it's now the ratified rule, update the table), **XP-to-next grows with level**
(`level × 10`), and **the level cap is 10**. HP roll on level-up = hit die
+ CON, min 1 ✓. 2d6 class talent tables ✓. Carryover of excess XP (RAW resets
to 0 — carryover is friendlier, fine, worth a line in the deviations table).
Gaps:

- **No full heal on level-up.** The pseudocode reference heals to max
  (`current_hp = max_hp`); `Character.increaseMaxHp` only adds the gained HP.
  Either implement or add to the deviations table.
- Talent every level instead of 3/5/7/9 — already documented, keep.
- **XP is invisible to the player** (see UI section) and the "slot-machine
  level-up moment" the design doc celebrates is one log line + a float text.

### Combat gaps

- **Attacks are always STR** (`engine.attack` hardcodes `stat: "STR"`). RAW:
  finesse weapons use the better of STR/DEX, ranged use DEX. The Thief
  attacking with a dagger at STR 10 instead of DEX 16 is a −3 swing on every
  attack — the single biggest fidelity bug, and it makes the Thief feel weak.
- **Backstab is advantage-only.** RAW backstab adds `1 + floor(level/2)`
  extra weapon damage dice. The engine has no damage-dice hook for it.
- **Fighter Weapon Mastery** is a flat +1 attack; RAW adds +1 and +½ level to
  damage with the mastered weapon type (the `damageBonus` hook exists —
  it's just not levelled).
- `resolveCheck` auto-succeeds any natural roll ≥ crit threshold; when a
  talent lowers `critRange` to 19, a natural 19 auto-*hits* regardless of AC.
  RAW: only natural 20 auto-succeeds.
- **Spikes have no save.** Flat 1d6 on contact; RAW traps allow a DEX/CON
  check to avoid or mitigate. (Thief disarm ✓ exists.)
- **No falling damage** (RAW: 1d6 per 10 ft). In a platformer about
  verticality this is a *free* source of meaningful decisions and makes
  "above = advantage" cost something.

### Whole systems not yet wired (all flagged v2 in the docs, ranked by value)

1. **Random encounters on the crawling clock** — the engine hook exists
   (`crawlingRoundMs`), it's a Shadowdark pillar (danger level, check every N
   rounds, every round in darkness/noise), and it's what makes *time itself*
   the enemy. Highest-value missing mechanic.
2. **Luck tokens** — one stored reroll; perfect arcade fit, trivial engine
   work, gives death timers and bad casts a pressure valve.
3. **Priest atonement** — `requiresAtonement` is set but nothing clears it;
   needs the shrine interactable (rest-spot economy).
4. Leader-based morale groups (RAW rule; also required by the bible's
   "Warchief" climax variant).
5. Stealth/surprise, ancestries, trained-task auto-success, swimming — defer;
   swimming only alongside water volumes (WS-3).

---

## Part 3 — Gameplay, UI polish, readability

### HUD gaps (Hud.ts)

- **No XP or level progress anywhere.** Treasure-as-XP is the core loop and
  the player can't see it. Add `XP 7/10` per character (or a thin bar under
  the HP bar).
- **Log colors are stored but never rendered** — `GameContext.say(text,
  color)` colors are dropped; the log prints everything in grey. Use
  per-line text objects or Phaser rich text tags.
- **"GEAR n slots" sums the whole party** — slots are per-character caps, so
  the aggregate is meaningless. Show `used/cap` per row; highlight when full
  (the "loot left behind" moment currently just flashes past in the log).
- **Torch countdown is numbers-only and easy to miss.** Add a low-torch state
  (< 30s: orange pulse on the party row + a vignette flicker). The torch is
  the core tension; the UI should dramatize it.
- No AC shown, spell shown only for the selected slot.

### Interaction & input

- **No contextual prompt for E.** Rescue/stabilize/disarm/rest/exit all live
  on E with an invisible priority list; show a floating `E — rescue Vex`
  prompt when in range (and it doubles as a tutorial).
- **Cast on `isDown`** re-fires every swing cooldown while K is held — a
  failed check loses the spell, so a held key can burn through the wizard's
  book. Make casting `JustDown`.
- `ctx.say("Prepared: " + slot.spellId)` leaks the raw id
  (`magic-missile`) instead of the display name.
- No pause, no settings, no key rebinding, no gamepad.

### Readability

- Floating dice text stacks illegibly when a group fights in one spot —
  add slight x-jitter and stagger, or a single combat-feed anchor.
- Room engraving labels (I THE GATE …) at alpha 0.22 are invisible in dark
  themes; tie them to entering the room (fade in once, brighter).
- Death overlay lists the party but not the run: add treasure collected, XP,
  kills, rooms reached, and the dungeon seed (pairs with WS-1 seed display,
  enables "retry same seed").
- Objective text swaps to "CROWN SECURED — REACH THE EXIT" ✓ good; add room
  progress pips (I–V) so players know how deep they are.
- No audio at all — even placeholder synth SFX (hit/crit/pickup/torch-out)
  would multiply feedback quality cheaply.

---

## Part 4 — Scope of works, in order

Rationale for the order: restore the safety net first (regressions), then fix
the rules while the engine is small and pure (everything downstream renders
engine output), then build variance on top of a validated grid pipeline, then
the player-facing polish pass, then meta/campaign. UI quick wins are pulled
forward because they're cheap and testing everything else is easier with a
readable HUD.

### WS-0 — Regression repair & level-pipeline integrity  (small, do first)

1. Make `dungeonAt` pure: return `{ ...base, grid: generateSeededGrid(...) }`
   or introduce `buildRun(index): RunDefinition`; delete the `as any`
   mutation. Fix the wrap-around test to compare ids, not references.
2. Extract `validateGrid(grid)` (dimensions, alphabet, required singletons,
   spawn-before-divider, door-after-vault) — **throw at runtime** on failure
   (per house rule) and property-test a 200-seed sweep in `levels.test.ts`.
3. Make rescue placement deliberate and pair it with a beatability
   guarantee. Rescues may land in rooms 1–5 (a room-4/5 rescue is a
   *reward*, per the bible's Chained Companion), but from a designed
   distribution — e.g. most rescues front-loaded into rooms 1–3, with a
   tuned chance (~20–25%, not 89%) of one late reward rescue. Then enforce
   the on-arrival rule: **every room must be clearable by the party
   composition guaranteed to exist when the player reaches it.** Concretely,
   the climax variant's monster budget is chosen *after* rescue placement —
   fewer/weaker minions (or more environmental leverage: braziers, weak
   pillars, high ground) when two or fewer rescues precede room 4 — and the
   bible's floor stays absolute: a solo Fighter brute path always exists.
   Validation asserts the budget rule per seed alongside the grid checks.
4. Re-couple identity and layout: per-dungeon variant pools (each
   `DungeonDefinition` lists which room variants it may roll), so Ember Crypt
   always reads as a crypt. Sunken Bastion and Crystal Chasm leave the
   library until they have at least one unique variant each (or their
   taglines stop promising mechanics that don't exist).
5. `vfx.ts` extraction of the six duplicated particle configs; fix torch
   emitter facing; prune destroyed entries from `pickups`/`spikes`.

### WS-1 — Rules fidelity, engine pass  (medium)

1. **Character generation**: 3d6 per stat via seeded dice, silent
   regeneration until ≥2 stats are 15+ and ≤1 stat is under 6. Delete
   `startingStats`/`startingMaxHp`/`baseAc` constants; level-1 HP = hit die
   + CON mod (min 1).
2. **Armor system**: leather / chainmail / plate / shield as items with slot
   costs, `acBase` + DEX cap, and per-class permissions (fighter/priest:
   all; thief: leather; wizard: none). AC becomes computed (armor + capped
   DEX + effect hooks). Shield occupies a hand — composes with the
   torch-in-hand rule. Starting kits per class; swim/stealth penalties wired
   when WS-3 delivers those systems.
3. Weapon data gains `finesse`/`ranged`; `engine.attack` picks the stat
   (finesse: better of STR/DEX; ranged: DEX). Fixes the Thief. Damage stays
   RAW (bare weapon die); optional `strToDamage` config flag if wanted.
4. Backstab: extra damage dice `1 + floor(level/2)` via a new
   `extraDamageDice` path (game keeps the advantage too — it's the aim aid).
5. Fighter Weapon Mastery: `damageBonus` scaling +½ level.
6. Crit threshold below 20 no longer auto-succeeds (crit only if the attack
   also hits); natural 20 unchanged.
7. Spike/trap saves: DEX check for half/none; keep thief disarm.
8. Falling damage: 1d6 per ~3 tiles fallen, with the float-text treatment.
9. Level-up full heal — implement (matches reference doc, feels great with
   the slot-machine moment); update the deviations table (carryover XP,
   talent-every-level now ratified).
10. Luck tokens: engine + one-key UI (`L` to reroll the last visible roll).

### WS-2 — The missing pillar: random encounters + atonement  (medium)

1. Wire the crawling-round hook: danger level per dungeon, 1-in-6 check per
   crawling round, **check every round while the party is in total
   darkness** — darkness becomes lethal pressure, not just disadvantage.
   Encounters spawn a themed wave at screen edge with a warning beat.
2. Priest atonement: shrine prop (`3`'s prop already exists) → interact to
   clear `requiresAtonement` (v1 free at shrines; cost arrives with economy).
3. Leader-morale groups (engine flag + one leader monster def), unlocking the
   Warchief climax later.

### WS-3 — Room-system variance done right  (large; the old Phase 2, amended)

1. Room builders move to `rooms/roomN/*.ts` with **metadata**: resources
   threatened (light/inventory/HP/time), combat weight, class verbs used,
   monster manifest.
2. Seeded assembly enforces the bible invariants using that metadata: no
   adjacent pure-combat, each of light/inventory/HP threatened at least once
   per run, universal (fighter-solo) path guaranteed. Violations throw.
3. Reachability check: annotate each variant with entry/exit waypoints and
   verify jump-feasible connectivity in tests (simple tile-distance rules —
   no full solver needed).
4. New primitives in bible priority order: interactables (lever/plate/
   offering bowl) → gates/portcullises → throwables (coin/torch, with noise) →
   zone effects (no-light, gas) → AI flags (noise aggro, pursue, target-light)
   → heavy/placeable objects → water volumes (+ swimming rules from RAW).
   Each primitive ships with at least one bible variant that uses it, tagged
   to the dungeon whose theme it fits (water → Sunken Bastion, crystal
   no-light shimmer → Crystal Chasm — the two recolors become real here).
5. One non-linear layout pattern (the loop *or* two-layer screen) once the
   linear gallery variants are healthy.

### WS-4 — UI/UX polish pass  (medium; items 1–4 can land any time)

1. HUD: per-character `XP x/y` + gear `used/cap`, log message colors, spell
   display name fix, AC on the party row.
2. Contextual E prompt; cast on JustDown; low-torch warning state.
3. Level-up ceremony: brief slow-mo + party-wide banner with the talent rolled
   (the design doc's slot-machine moment, actually staged).
4. Float-text jitter/stagger; room-entry title reveals; room progress pips.
5. Run-summary overlays (win/death): treasure, XP, kills, time, seed, retry.
6. Placeholder synth audio: hit, crit, pickup, level-up, torch-out, rout.
7. Pause + settings (volume, torch-duration house rule toggle, key rebinds).

### WS-5 — Campaign continuity  (large; the old Phase 3, unchanged in spirit)

1. Party persistence between runs (survivors, gear, levels, injuries).
2. Rest-spot economy: rations/torches for sale, sell loot, shrine atonement
   cost — coins finally competing with XP banking (the Shadowdark tension).
3. Run seeds surfaced + difficulty tiers (danger level, monster budgets).
4. Run history; ancestries + stealth/surprise as the roster deepens.

### Success checks (carried forward + new)

- Every grid the player can ever load is validated by a thrown-error gate and
  a seeded property test — not just the five static seeds.
- Rescue cadence: late (room 4–5) rescues occur at a tuned reward rate, not
  as the default; for every seed, each room's encounter budget fits the
  party composition guaranteed on arrival, and a solo Fighter path to the
  exit always exists.
- A dungeon's name/tagline always describes mechanics that actually occur.
- The Thief's dagger attacks with DEX; a backstab visibly rolls extra dice.
- Every generated character satisfies the stat gate (≥2 stats 15+, ≤1 under
  6) — property-tested over seeded rolls — and HP/AC/to-hit all visibly move
  when the stats do.
- No character can equip armor their class forbids (attempting throws).
- A player can answer "how close is my next level-up?" from the HUD alone.
- Total darkness is something players actively fear (encounter checks), not
  just a to-hit penalty.
