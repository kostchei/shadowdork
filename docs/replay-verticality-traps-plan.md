# Replay, verticality, and trap visibility plan

## Purpose

Make consecutive Shadowdork runs visibly and mechanically different by separating
run randomness from dungeon theme selection, using more of the screen vertically,
and ensuring that the implemented puzzle-trap families are encountered often enough
to define the game.

This document is a plan only. It does not change runtime behavior.

## Current-state diagnosis

### Starting runs only sample four seeds

`BootScene` currently chooses `Math.floor(Math.random() * DUNGEONS.length)` and
stores that number as `dungeonIndex`. With four dungeon themes, a fresh page load
therefore starts with only `0`, `1`, `2`, or `3`.

`dungeonAt(index)` uses that same number for two separate jobs:

1. `index % DUNGEONS.length` selects the dungeon theme.
2. `index` seeds room variants, rescue placement, and featured-trap selection.

As a result, fresh launches only ever see four canonical layouts. The generator is
tested across hundreds of seeds, but normal startup does not sample those seeds.
Repeats are also expected: independent selection from four choices has a 25% chance
of immediately selecting the same theme again.

Restarting after a win or wipe increments the index, so variety improves only after
finishing runs in one browser session. The HUD labels the index as a run seed even
though it is also the theme selector.

### The world is only one viewport tall

The logical viewport is `960 x 540`. The dungeon grid is `120 x 17` tiles at 32px
per tile, making the world 544px tall: almost exactly one viewport. Platforms use
the available height, but the camera cannot meaningfully travel up or down and all
six room bands remain a single left-to-right strip.

The engine already supports one-way platforms, thief-only climbable walls, falling
damage, moving counterweight lifts, and a camera with world bounds. What is missing
is a layout model with multiple vertical layers, universal traversal between those
layers, and validation of safe mandatory routes.

### Major traps are deliberately rare and geographically repetitive

Ten featured trap families are implemented, but generation currently applies these
constraints:

- a featured trap appears in about 40% of runs;
- there is at most one featured trap per run;
- it always replaces room 3;
- the allowed trap family is restricted by dungeon theme;
- fresh launches only sample seeds `0–3` because of the seed/index coupling above.

This makes it entirely plausible for several starts to show no featured trap. Even
when one appears, placing every major mechanism in room 3 makes the run structure
feel more uniform than the trap catalogue suggests.

## Product goals

1. A normal page load gets a genuinely fresh run seed.
2. Dungeon themes rotate without immediate repeats and all four appear before a new
   cycle begins.
3. A seed can be copied and replayed exactly for debugging and sharing.
4. At least two dungeon themes use a world taller than the viewport at launch; the
   long-term target is a distinct spatial pattern for every theme.
5. All characters can use ordinary ladders. The thief retains exclusive fast routes
   such as vines, narrow shafts, and wall-climb shortcuts.
6. Mandatory traversal never requires a potentially lethal blind fall.
7. Every run contains one memorable featured mechanism, while smaller hazards vary
   the journey without turning every room into a puzzle box.
8. The ten implemented trap families become observable across a modest run sample,
   without breaking theme identity or class-solvability guarantees.

## Non-goals

- Do not change Shadowdark damage dice merely to make vertical layouts safe.
- Do not remove deterministic generation or make rules-engine dice depend on visual,
  audio, or layout randomness.
- Do not require the thief for the critical path.
- Do not make all four dungeons fully open-world or abandon the Five Room pacing
  structure.
- Do not add campaign persistence in this pass. Reproducible run identity should be
  compatible with later campaign work, but is not a save system.

## Design decisions

### 1. Separate run identity from dungeon selection

Replace the overloaded `dungeonIndex` number with an explicit run identity:

```ts
interface RunIdentity {
  campaignSeed: number;
  runNumber: number;
  runSeed: number;
  dungeonId: string;
}
```

- Generate `campaignSeed` with `crypto.getRandomValues`, with a documented fallback
  only for environments where Web Crypto is unavailable.
- Derive `runSeed` deterministically from `campaignSeed + runNumber` with a small
  stable integer hash. Layout generation must never depend on call order.
- Select themes from a seeded shuffle bag. Each four-run cycle contains all four
  dungeon types; a reshuffle cannot put the previous cycle's last theme first.
- Generate a new identity on a normal reload. Preserve reproducibility through URL
  overrides rather than silently persisting the run:
  `?seed=123456&run=0&dungeon=ember-crypt`.
- Show the actual `runSeed` and dungeon ID in the end screen and optional developer
  information. The ordinary HUD can show a compact seed without dominating play.

Refactor `dungeonAt(index)` into an API that makes the separation impossible to
accidentally undo, for example:

```ts
dungeonForRun(dungeonId: DungeonId, runSeed: number): DungeonDefinition
nextRunIdentity(current: RunIdentity): RunIdentity
```

The rules engine should receive `runSeed` (or a separately derived rules seed), so a
shared seed replays both layout and rules rolls. Cosmetic audio/VFX randomness stays
outside this deterministic stream.

### 2. Support layout patterns with variable dimensions and room positions

Replace global assumptions that every dungeon is `120 x 17` with layout-owned
geometry:

```ts
interface DungeonLayout {
  width: number;
  height: number;
  grid: readonly string[];
  rooms: readonly RoomRegion[];
  connections: readonly RoomConnection[];
  traps: readonly FeaturedTrapSpec[];
}
```

`RoomRegion` replaces x-only `ROOM_BANDS`; monster morale groups, validation, room
labels, encounter placement, camera bounds, and atmosphere placement must query a
room region by `(x, y)`.

Add spatial patterns incrementally:

| Dungeon | Primary pattern | Intended identity |
|---|---|---|
| The Gloom Below | Two layers, one screen-width corridor | Cracked floors and shortcuts expose a lower, older complex. |
| The Ember Crypt | Vertical stack / ascent | Ladders, lifts, braziers, and crushers make height the core puzzle. |
| The Mold Warrens | Loop with upper burrows | Safe ramps and short ladders contrast with thief-only fungal shafts. |
| The Drowned Angle | Descending flooded terraces | Water level, high refuges, and controlled drops change available routes. |

The first implementation milestone should ship two patterns: retain one polished
linear baseline and add one true multi-screen vertical pattern. Convert the other
themes after camera, follower, and validation behavior is proven.

### 3. Add ordinary ladders as a universal traversal verb

Split the current `|` climbable concept into two explicit tile types:

- **Ladder:** usable by every living party member and follower.
- **Vine/rough wall:** thief-only shortcut, preserving class identity.

Traversal requirements:

- Up/down starts ladder movement; left/right or jump exits at a landing.
- Followers recognize the leader's ladder transition and queue rather than falling
  into the shaft.
- A character entering a ladder resets accumulated fall distance, matching the
  existing behavior while climbing.
- Every ladder has a clear top and bottom landing and a visible continuation through
  darkness at close range.
- Moving lifts remain a separate mechanical verb and can be a trap or shortcut.

### 4. Design safe critical paths, not harmless heights

Keep the existing fall rule: the first four tiles are safe, then falling damage is
rolled. Make geography respect it.

- Mandatory uncontrolled drops are at most four tiles.
- Long shafts require ladders, lifts, staggered one-way platforms, or catch ledges.
- Place catch ledges every three to four tiles on ordinary traversal shafts.
- Potentially lethal drops are optional, clearly telegraphed, and lead to a reward,
  shortcut, or escape—not required progression.
- A failed jump on the critical path should usually lose time/position or deal trap
  damage rather than instantly remove a low-HP character.
- Do not put spikes directly beneath an unavoidable traversal failure.
- Allow deliberate drop-through only where the landing is visible or signposted.

Add a path-safety validator over an abstract traversal graph. It need not reproduce
Arcade Physics perfectly; it should prove that spawn, rescues, crown, sanctuary, and
exit are connected by universal edges, and that required drop edges do not exceed
the safe threshold.

### 5. Schedule traps as a visible run feature

Change the run budget from “0–1 featured trap at 40%” to:

- exactly **one featured trap** per standard run;
- two to four minor hazards assembled from existing spikes, weak floors, darkness,
  water, and projectile placements;
- an optional second featured trap only at higher difficulty in a later pass.

Use a deterministic trap bag:

- avoid repeating the previous featured family;
- prefer families not seen in the current ten-trap cycle;
- filter by layout compatibility and dungeon theme before drawing;
- if a theme filter empties the bag, relax theme preference rather than silently
  omitting the featured trap.

Featured traps should no longer be hard-coded to room 3. Give each trap family a
compatibility declaration:

```ts
interface TrapPlacementRule {
  kinds: readonly FeaturedTrapKind[];
  roomRoles: readonly ("guardian" | "puzzle" | "setback" | "climax" | "reward")[];
  patterns: readonly LayoutPattern[];
  minWidth: number;
  minHeight: number;
}
```

Suggested placements:

- plate gate: guardian, puzzle, or setback;
- alternating spikes / darts / crushers: setback or climax approach;
- counterweighted lift: puzzle in a vertical room;
- light runes / undead barrier: puzzle or reward approach;
- flooded chamber: puzzle or setback in Drowned/Mold themes;
- rolling stone: guardian or setback on a sloped/terraced route;
- collapsing floor: guardian, setback, or reward escape.

Every featured trap needs a readable introduction before it can hurt the party: a
mechanism silhouette, a safe first cycle, a visible target/switch, or a message cue.
The room title/objective should identify the situation without revealing the answer.

### 6. Strengthen dungeon-type identity beyond palette changes

Theme selection already changes palette, backdrop, objective, encounter monster,
variant pools, and compatible traps. Make the difference apparent during the first
screen of play:

- distinct entrance geometry for every theme;
- a signature traversal element visible within the first room;
- theme-specific minor-hazard mix;
- a unique skyline/silhouette in the background that mirrors the layout pattern;
- theme name plus spatial descriptor in the opening message, such as
  “The Ember Crypt — climb the furnace stack.”

Avoid sharing the same room variant number across themes when the geometry is
visually identical. Variant pools should select named builders rather than opaque
integers, making theme overlap an explicit choice.

## Implementation sequence

### Milestone A — Run identity and reproducibility

1. Add `RunIdentity`, stable seed derivation, URL parsing, and the theme shuffle bag.
2. Refactor generation to accept `dungeonId` and `runSeed` separately.
3. Update Boot, restart flow, HUD/end summary, and `GameContext` seeding.
4. Add tests proving fresh seed breadth, deterministic URL replay, all-theme cycles,
   and no immediate theme repeat.

Deliverable: reloads and restarts visibly vary, while a copied URL reproduces a run.

### Milestone B — Flexible geometry and one vertical prototype

1. Move width, height, room regions, and connections into `DungeonLayout`.
2. Remove `ROOM_BANDS` and fixed dimension assumptions from rendering, atmosphere,
   monster grouping, encounters, traps, and validation.
3. Implement universal ladder tiles and follower ladder behavior.
4. Build the Ember Crypt vertical-stack prototype at roughly 30–34 tiles tall.
5. Add traversal-graph and safe-drop validation.

Deliverable: one complete dungeon moves the camera through at least two vertical
screens, and every class can finish it without taking mandatory fall damage.

### Milestone C — Trap guarantee and placement matrix

1. Replace the probability gate with a deterministic featured-trap bag.
2. Move trap placement from room-number assumptions to room role/pattern rules.
3. Integrate counterweighted lift, crusher, darts, and collapsing floor into the
   vertical prototype first.
4. Add minor-hazard budgets and readable telegraphs.
5. Create a developer seed/trap matrix route for rapid visual inspection.

Deliverable: every standard run has one recognizable featured mechanism and a
20-run deterministic sample covers every implemented family.

### Milestone D — Convert remaining themes

1. Gloom Below: two-layer corridor.
2. Mold Warrens: loop with upper burrows.
3. Drowned Angle: flooded descending terraces.
4. Tune rescue placement, encounters, light islands, and sanctuary access per pattern.
5. Remove obsolete integer room variants after all themes use named builders.

Deliverable: the four dungeon types are identifiable from un-tinted geometry alone.

### Milestone E — Balance, documentation, and release verification

1. Run property tests over at least 1,000 run identities and every layout pattern.
2. Measure theme distribution, featured-trap coverage, rescue accessibility, monster
   budgets, mandatory drop lengths, and critical-path length.
3. Manually play every class as leader through every ladder/lift transition.
4. Verify camera behavior at common aspect ratios and render scales.
5. Update README controls, the game-design document, pause help, and the Five Room
   bible's implementation-status section.

## Test plan

### Deterministic unit/property tests

- Identical `RunIdentity` produces identical theme, grid, traps, rescues, and engine
  rolls.
- Different run seeds produce broad layout variation within each theme.
- Each four-run theme cycle contains every dungeon exactly once.
- No immediate theme repeat occurs at a cycle boundary.
- A 20-run trap sample contains all ten families, with no adjacent duplicate.
- Every generated dungeon contains exactly one featured trap.
- All important entities occupy a declared room region.
- The universal traversal graph reaches every rescue, crown, sanctuary, and exit.
- Every mandatory uncontrolled drop is at most four tiles.
- Every vertical shaft has valid landings and no out-of-bounds camera region.
- Climax monster budgets remain reduced when a rescue is delayed to the climax.

### Browser verification

- Load ten ordinary fresh runs and confirm the displayed seeds vary.
- Replay three copied seed URLs and compare dungeon, rescue, and trap placement.
- Complete the vertical prototype with Fighter, Thief, Priest, and Wizard as leader.
- Verify followers use ladders/lifts without falling, teleporting through hazards, or
  becoming permanently stranded.
- Confirm a long optional fall still applies existing falling damage.
- Inspect all ten trap families in the developer matrix and play at least one full
  run of each.
- Confirm dungeon identity remains readable in darkness and that HUD framing does
  not conceal upper platforms or trap telegraphs.

## Acceptance criteria

The work is complete when:

1. A fresh launch is not limited to seeds `0–3`.
2. The seed shown to the player can reproduce the run.
3. Four consecutive standard runs cover all four dungeon themes without repetition.
4. At least one released dungeon uses two or more vertically connected viewport
   heights, with the remaining theme conversions tracked or completed by milestone.
5. Every party class and follower can traverse ordinary ladders.
6. No required route contains a fall beyond the four-tile safe allowance.
7. Every standard run contains one featured trap.
8. All ten trap families occur in deterministic coverage tests and can be inspected
   through a developer route.
9. Production build, unit/property tests, and browser console checks are clean.

## Primary files expected to change during implementation

- `src/game/scenes/Boot.ts`
- `src/game/context.ts`
- `src/game/level/dungeons.ts` (eventually split into run identity, layout patterns,
  room builders, and trap placement modules)
- `src/game/scenes/Dungeon.ts`
- `src/game/entities/CharacterSprite.ts`
- `src/game/systems/party.ts`
- `src/game/systems/traps.ts`
- `src/game/systems/encounters.ts`
- `src/game/scenes/Hud.ts`
- `tests/levels.test.ts`
- new run-identity and traversal-validation tests
- `README.md`, `Shadowdork.md`, and `docs/five-room-dungeons.md`

## Recommended first slice

Begin with Milestone A only. It fixes the misleading sameness immediately, exposes
far more of the generation code that already exists, and gives every later vertical
or trap change a reproducible seed for debugging. Then build one vertical Ember
Crypt prototype before generalizing all four themes.
