# Shadowdork improvement plan

## Product diagnosis

The rules engine already creates meaningful decisions around light, inventory,
positioning, morale, and party composition. The original game layer did not
surface that depth: one fixed linear layout limited replay, placeholder block
sprites weakened readability, and the nearly unframed HUD did not establish a
strong dungeon identity or make the current objective obvious.

## Phase 1 — presentation and replay foundation (implemented)

1. Replace the single fixed grid with a reusable `DungeonDefinition` library.
2. Ship three complete Five Room Dungeons with different geometry, encounters,
   hazards, rescue placement, light islands, and vault approaches.
3. Rotate runs through the library and validate every grid in automated tests.
4. Replace block placeholders with cohesive generated pixel art for characters,
   monsters, tiles, treasure, props, decorations, and combat effects.
5. Give every dungeon a palette, atmospheric background, haze, motes, themed
   title, room engravings, and light color.
6. Add entity shadows and a framed HUD with HP bars, run identity, objective
   state, controls, event log, and crown-to-exit feedback.

## Phase 2 — room-system variance (in progress)

Extract authored rooms into composable builders and add the highest-leverage
primitives from the Five Room design bible:

Implemented foundation: declarative per-run trap metadata, pressure plates and
gates, linked lifts, cyclic hazards, moving projectiles, light-sensitive
floors, water states, class interactions, and persistent collapsing terrain.

- levers, plates, gates, and multi-state interactables;
- water and no-light zones;
- throwable coins and torches;
- collapsing floors and heavy/placeable objects;
- monster AI flags for noise, light targeting, pursuit, and leaders.

Then assemble a seeded dungeon from one compatible variant per room type while
preserving the invariants: no adjacent pure-combat rooms, every run threatens
light/inventory/HP, and every class-specific shortcut has a costly universal
solution.

## Phase 3 — campaign continuity

- Carry surviving party members, treasure, injuries, and talents between runs.
- Turn rest spots into economy scenes for rations, torches, selling, and
  atonement.
- Add run seeds, difficulty tiers, unlockable room variants, and a compact run
  history.
- Add audio, controller support, settings, and accessibility options after the
  core replay loop is stable.

## Success checks

- A player can identify the dungeon and current objective at a glance.
- Consecutive runs demand visibly different movement and combat decisions.
- Darkness remains mechanically dangerous while nearby silhouettes are readable.
- Adding a dungeon does not require editing the renderer.
- Invalid level grids fail tests before reaching the browser.
