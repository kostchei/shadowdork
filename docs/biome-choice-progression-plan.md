# Cursed-Scroll Biome Choice on Dungeon Completion — Design Plan

Status: implemented 2026-07-19
Author target: campaign progression
Drafted: 2026-07-19
Decisions locked: 2026-07-19 (see "Resolved decisions")

## Concept (from the request)

Each dungeon run is a self-contained "1d6 adventure" (the five-room dungeon).
When the party clears a dungeon and reaches the exit, the game offers a **choice
of biome for the next level**:

- Roll **1d6** at completion. That roll is the *number of biome options* offered.
  Sometimes you get a single forced destination (roll of 1), sometimes the whole
  spread (roll of 6).
- The options are drawn from the **six cursed scrolls** — the six zone packs
  declared in `src/game/visual/model.ts` (`ZonePackId`). The **current scroll is
  eligible**: a roll of 1 can legitimately re-offer the biome you just cleared,
  and the pool is all six with no exclusion.
- The player confirms one option under the prompt **"Choose your destination."**
  On descent, **every surviving party member advances one level** — their XP is
  topped up to the next-level threshold and a normal level-up fires (capped at
  level 10) — and the party **carries into the chosen biome**.

This layers a *player-directed* dimension onto what is currently a fully
deterministic, linear `dungeonIndex + 1` march.

## How the six scrolls map to what exists

The six cursed scrolls already exist as zone packs, each with three visual skins:

| Scroll | `ZonePackId` | Skins (`VisualSkinId`) |
|---|---|---|
| Diablerie | `diablerie` | `rot-bramble`, `mugdulblub-keep`, `willowman-hollow` |
| Red Sands | `red-sands` | `djurum-approach`, `iron-fortress`, `burning-mines` |
| Midnight Sun | `midnight-sun` | `rime-sea-caves`, `frost-jarl-tomb`, `dverg-forges` |
| River of Night | `river-of-night` | `overgrown-basalt-ziggurat`, `drowned-star-cenote`, `canopy-village` |
| Dwellers in the Deep | `dwellers-in-the-deep` | `librarians-chasm`, `nuln-fungal-grottos`, `subterranean-sea-fort` |
| City of Masks | `city-of-masks` | `rooftop-scamper`, `sunken-thieves-guild`, `hidden-face-temple` |

Only `iron-fortress` is a complete art kit today (per
`docs/cursed-scroll-environment-reskin-plan.md`); the rest are declarations with
palette + room nouns. **This progression feature is decoupled from art
completeness** — an incomplete skin still renders with its palette and shared
procedural masonry, so the choice system can ship and light up biomes as their
kits land.

## Current state of the code (what we build on)

- **Skin selection is dev-only.** `Dungeon.ts:283` reads the skin from the
  `?skin=` query param and does nothing otherwise. Normal runs have
  `this.visualSkin === undefined` and fall back to the legacy four-theme backdrop.
- **Campaign advance is linear and deterministic.** `dungeonIndex` and `runSeed`
  live in the Phaser registry. `layoutSeed = (runSeed + dungeonIndex) >>> 0`
  (`Dungeon.ts:281`). On win, `restartRun()` (`Dungeon.ts:2784`) calls
  `nextDungeonSave()` (`progression.ts:191`), which does `dungeonIndex + 1`,
  keeps `runSeed`, and filters dead party members out.
- **`SaveSlot`** (`src/game/state.ts:45`) persists `dungeonIndex`, `runSeed`,
  `party`, `coinsBanked`, etc. **It has no zone/scroll field today.**
- **Level-up already happens per dungeon** through the reward + advancement
  systems; "advance to the next level" here means the existing progression, not a
  new XP rule. Confirm against `src/engine/advancement.ts` during implementation.
- **Victory UI** is the overlay in `Hud.ts` (~line 813) that currently just says
  "Press R to enter the next dungeon." This is where the choice screen inserts.

Global project rule (`~/.claude/CLAUDE.md`): **No fallbacks. Throw an error.** So
zone resolution must be explicit — an unknown/missing zone id is an error, not a
silent default to the legacy theme.

## Design

### 1. Persist the chosen biome

Add to `SaveSlot` (`state.ts`):

```ts
/** The cursed-scroll zone pack the party is descending into. Absent = pre-choice legacy run. */
zone?: ZonePackId;
/** The specific skin resolved within that zone for this dungeonIndex. */
skinId?: VisualSkinId;
```

`skinId` is stored (not just re-derived) so a loaded save always renders the same
biome it advanced into, and every save slot (autosave and named) records the biome
the party is currently in alongside their progression.

**First dungeon (index 0) is a random scroll.** With no preceding completion,
campaign start picks a scroll from all six via the quiet seeded stream and resolves
its skin — the player does not choose the opening biome. From dungeon 1 onward, the
completion offer drives the zone. A save with no `zone`/`skinId` (pre-feature) still
loads via the legacy path.

### 2. Resolve the skin from zone at scene start

Replace the dev-only skin read in `Dungeon.ts:283–284` with a resolution order:

1. `?skin=` override still wins (keep for QA/regression matrix).
2. Else, if `loadState.skinId` is set, use it.
3. Else legacy behavior (undefined skin) for pre-feature saves.

Add a helper in `visual/skins.ts`:

```ts
export function skinsForZone(zone: ZonePackId): readonly VisualSkin[];
export function resolveSkinForZone(zone: ZonePackId, seed: number): VisualSkin; // throws on empty
```

Skin-within-zone is chosen **deterministically from `layoutSeed`** (which of the 3
skins in the scroll). The player chooses the *scroll*, not the tile set; the seed
picks the skin, which is what makes a return trip to the same scroll refresh into a
potentially different skin.

### 3. Roll the offer at completion

New pure module `src/game/biomeChoice.ts`:

```ts
export interface BiomeOffer {
  optionCount: number;        // the 1d6 roll, 1..6
  zones: readonly ZonePackId[]; // optionCount distinct scrolls to choose from
}

export function rollBiomeOffer(
  currentZone: ZonePackId | undefined,
  dungeonIndex: number,
  runSeed: number,
): BiomeOffer;
```

Rules:
- `optionCount = 1d6` (1..6).
- Candidate pool = **all six scrolls, current included** — no exclusion. A roll of
  1 may re-offer the current scroll; a roll of 6 offers every scroll.
- Sample `optionCount` distinct scrolls without replacement from the pool of six,
  then present. Because the pool is six and the max roll is six, no capping is ever
  needed.
- Deterministic given `(runSeed, dungeonIndex)` so saves/replays are stable.

**Re-selecting the current scroll must produce a fresh dungeon, not a repeat.**
Layout already varies because `layoutSeed = runSeed + dungeonIndex` advances every
descent, so the geometry differs even in the same scroll. The **skin within the
scroll is re-resolved from the new `layoutSeed`**, so returning to a biome can
surface a different one of its three skins — this is the "refresh" the request
calls for, and it removes any need for a hard "each scene art at most twice" cap.

**RNG source (quiet):** a dedicated seeded stream derived from
`runSeed`/`dungeonIndex`. The offer and the skin-within-scroll pick **never touch
combat/rules RNG** (`src/engine/dice.ts` is untouched), mirroring how skin
selection is already kept out of rules RNG per the reskin plan.

### 4. Choice UI at the victory overlay

Extend the win overlay in `Hud.ts`:

- After the party summary, show the `BiomeOffer` under the heading **"Choose your
  destination"**: N scroll cards (name + one-line flavor from `displayName` /
  `roomNouns`), keyboard-selectable (1..N / arrows).
- The current "Press R to enter the next dungeon" becomes the confirm prompt;
  R/Enter confirms the highlighted scroll.
- If `optionCount === 1`, show the single destination and R confirms it (the scroll
  chooses for you — and it may be the biome you just left).

The Dungeon scene owns the selection state; the Hud renders it (same split as the
existing stats/gear overlays). On confirm, Dungeon passes the chosen `ZonePackId`
into the advance path.

### 5. Wire the choice into advancement

`nextDungeonSave()` (`progression.ts`) gains a `zone` parameter (and resolves
`skinId` via `resolveSkinForZone`) so the next `SaveSlot` carries the biome:

```ts
export function nextDungeonSave(
  current: Pick<SaveSlot, "coinsBanked" | "messages" | "runSeed">,
  dungeonIndex: number,
  party: SavedCharacter[],
  chosenZone: ZonePackId,
  timestamp = Date.now(),
): SaveSlot
```

`restartRun()` (`Dungeon.ts:2784`) reads the player's confirmed choice instead of
immediately restarting, and party survivors carry over exactly as today.

"Advance to the next level and take your party" is already satisfied by the
existing survivor-carry + per-dungeon advancement; this plan does not change the
leveling rule, only the destination.

## Files to touch

| File | Change |
|---|---|
| `src/game/state.ts` | Add `zone?`, `skinId?` to `SaveSlot`; migration-safe (optional). |
| `src/game/visual/skins.ts` | `skinsForZone`, `resolveSkinForZone` (throws on empty). |
| `src/game/biomeChoice.ts` (new) | `rollBiomeOffer` + `BiomeOffer` (pure, unit-tested). |
| `src/game/progression.ts` | `nextDungeonSave` takes `chosenZone`, resolves `skinId`. |
| `src/game/scenes/Dungeon.ts` | Skin resolution from `skinId`; hold offer/selection; feed choice into `restartRun`. |
| `src/game/scenes/Hud.ts` | Biome-choice cards in the win overlay + input. |
| `tests/` | Cover `rollBiomeOffer` (distinctness, current-zone exclusion, count bounds, determinism) and `nextDungeonSave` zone carry. |

## Test plan

- **`rollBiomeOffer`**: `optionCount` in 1..6; options distinct; current scroll
  excluded (or included only as deliberate "stay" per decision); deterministic for
  a fixed seed; capping behavior when count > pool.
- **`nextDungeonSave`**: chosen zone and resolved `skinId` land in the new
  `SaveSlot`; survivors carried; `dungeonIndex` incremented; existing fields
  unchanged.
- **`resolveSkinForZone`**: returns a skin in the requested zone; throws on an
  unknown/empty zone (no silent fallback).
- **Regression**: existing 286-test suite still passes; a pre-feature save with no
  `zone` loads and plays (legacy path).
- **Browser QA**: complete a dungeon, confirm the offer shows N cards for a rolled
  N, pick a scroll, verify the next dungeon renders that biome's skin and the
  party carried over.

## Resolved decisions

1. **First dungeon (index 0)** — **random** scroll from all six via the quiet
   seeded stream. The player does not pick the opening biome.
2. **Offer pool** — **all six scrolls, current included, no exclusion.** Roll 1d6
   for the option count; sample that many distinct scrolls. A roll of 1 can re-offer
   the current biome. Returning to the same scroll refreshes the skin from the new
   `layoutSeed` (a possibly-different one of its three skins) — so there is **no
   "each scene art at most twice" cap** to maintain.
3. **Skin within a scroll** — **deterministic from seed.** Not a second player
   choice.
4. **RNG** — **quiet.** A dedicated seeded stream; combat/rules RNG
   (`src/engine/dice.ts`) is never touched. No on-screen dice animation.
5. **Difficulty** — **no coupling.** The pool is flat; difficulty scaling is out of
   scope and untouched.
6. **Saves** — **every slot records the current biome** (`zone` + `skinId`)
   alongside party progression, so a load resumes in the right scroll.
7. **Descent leveling** — leaving a dungeon **tops each surviving member's XP up
   to their next-level threshold and runs a normal level-up**, so the descent
   reward flows through the ordinary XP pipeline rather than bypassing it. XP
   already earned this run counts toward the threshold; capped at level 10.
   Implemented with `xpToReachNextLevel` in `src/engine/advancement.ts`, applied in
   `Dungeon.grantDescentLevels()` (award the deficit, then `levelUp`) before
   survivors are serialized, and guarded so a held R key cannot double-apply it.

No open questions remain; the design is ready to implement.
