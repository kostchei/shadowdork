# Biome Art-Kit Status — What's Missing

Status: audit / 2026-07-19
Scope: which cursed-scroll skins have a dedicated art kit and which fall back to
the legacy four-theme masonry. Companion to
`docs/cursed-scroll-environment-reskin-plan.md` (the design) and
`docs/biome-choice-progression-plan.md` (the progression that now routes players
into these biomes).

## Why this matters now

The biome-choice feature lets a player pick any of the six scrolls on descent,
and a random skin within the chosen scroll renders the run. Only **7 of the 18
skins** have a dedicated art kit; the other **11 fall back to generic legacy
masonry** via the `else` branch of `ensureVisualSkinTextures`
(`src/game/visual/textures/materials.ts:1145`, `return genericKeys(...)`). So a
player can choose, say, Midnight Sun and — two times in three — get the same
generic brick as any other scroll, just tinted.

Every scroll does have **at least one** finished skin, so each destination is
visually distinct at least a third of the time. The gap is the remaining two
thirds.

## What a complete kit is

A dedicated generator produces this texture contract (all consumed by
`ensureVisualSkinTextures`):

- `wall-0..N` (3 variants; 2 for rooftops)
- `platform`, `weak` (weak wall), `climb` (ladder), `portcullis`, `door`
- `backdrop` — or, for open-sky skins, `backdrop-day` **and** `backdrop-night`
- Open-sky skins also add `support-0..2`, `overhang`
- Four decoration slots: `gong`, `rack`, `banner`, `crenel`

Note the decoration slot **keys are fortress-derived** (`gong`/`rack`/`banner`/
`crenel`) and reused across every skin; each generator draws theme-appropriate
art under them, but the naming is a leftover from the first (iron-fortress)
slice and should eventually be generalized.

## Coverage by scroll

Legend: ✅ dedicated kit · ⛔ falls back to generic legacy masonry ·
☀ open-sky/outdoor · 🕳 survival-pressure wired (`src/game/visual/openTerrain.ts`)

| Scroll | Skin | Status | Generator |
|---|---|---|---|
| **Diablerie** | `mugdulblub-keep` | ✅ | `generateMugdulblubKeep` |
| | `rot-bramble` | ⛔ | — |
| | `willowman-hollow` | ⛔ | — |
| **Red Sands** | `iron-fortress` | ✅ | `generateIronFortress` |
| | `djurum-approach` | ✅ ☀ 🕳 | `generateDjurumApproach` |
| | `burning-mines` | ✅ | `generateBurningMines` |
| **Midnight Sun** | `rime-sea-caves` | ✅ ☀ 🕳 | `generateRimeSeaCaves` |
| | `frost-jarl-tomb` | ⛔ | — |
| | `dverg-forges` | ⛔ | — |
| **River of Night** | `overgrown-basalt-ziggurat` | ✅ | `generateOvergrownZiggurat` |
| | `drowned-star-cenote` | ✅ | `generateDrownedStarCenote` |
| | `canopy-village` | ⛔ (needs ☀🕳) | — |
| **Dwellers in the Deep** | `nuln-fungal-grottos` | ✅ | `generateNulnFungalGrottos` |
| | `librarians-chasm` | ⛔ | — |
| | `subterranean-sea-fort` | ⛔ | — |
| **City of Masks** | `rooftop-scamper` | ✅ ☀ 🕳 | `generateRooftopScamper` |
| | `sunken-thieves-guild` | ⛔ | — |
| | `hidden-face-temple` | ⛔ | — |

Totals: **9 kits done, 9 missing.** Open-terrain survival is wired for exactly
three skins (all three finished open-sky kits).

## What each missing skin needs

Each entry needs the full texture contract above, drawn to these motifs (from the
reskin plan's audit and the skin's `roomNouns`). None exist yet.

### Diablerie
- **`rot-bramble`** (THORN WAY / BLACK HEDGE / MARROW KNOT) — roots, thorns,
  hedgerow walls, wet bark, marrow-tree roots, dense forest enclosure.
- **`willowman-hollow`** (ROOT HOLLOW / PALE ARCH / NIGHTMARE KNOT) — pale roots,
  ghostly bark, hanging moss, nightmare silhouettes over cave massing.

### Red Sands
- **`burning-mines`** (FORGE HALL / ORE CUT / MAGMA WORKS) — cramped black-granite
  tunnels, ore veins, forge ash, furnaces, ingots, iron trees, magma glow,
  hammering industrial depth. Must not reuse the iron-fortress dressing.

### Midnight Sun
- **`frost-jarl-tomb`** (RUNE HALL / SHIP BURIAL / JARL'S REST) — longship ribs,
  burial mound, runestones, shields, carved beams, glacial enclosure.
- **`dverg-forges`** (VENT SHAFT / ANVIL HALL / DEEP FORGE) — forge architecture,
  anvils, ducts, chains, slag, metalwork, volcanic vents.

### River of Night
- **`drowned-star-cenote`** (STAR POOL / AIR POCKET / DROWNED VAULT) — circular
  skylight, hanging roots, a water plane, submerged blocks, air-pocket dressing,
  teal impossible-depth.
- **`canopy-village`** (ROPE WALK / HIGH HUT / CANOPY BRIDGE) — trunks, woven
  platforms, treehouses, rope lashings, layered foliage, lethal forest-floor
  drop. **Also needs open-sky + survival wiring** in `openTerrain.ts`
  (`safeZonePresentation`, `dangerRuleForSkin`, `SURVIVAL_PRESSURES`) and the
  `openSky` branch in `ensureVisualSkinTextures`.

### Dwellers in the Deep
- **`librarians-chasm`** (CHAINED STACK / ARCHIVE BRIDGE / BOTTOMLESS INDEX) —
  shelves, bridges, hanging archives, paper motes, lamps, abyssal book
  silhouettes, monumental vertical space.
- **`subterranean-sea-fort`** (BLACK QUAY / SEA WALL / DROWNED BASTION) — fortress
  silhouette, quay, waterline, wet fortification, chains, boats, distant black
  sea.

### City of Masks
- **`sunken-thieves-guild`** (SMUGGLER'S COVE / FLOODED RING / AQUEDUCT) — sewer
  and aqueduct construction, flooded rings, brick channels, waterline dressing.
- **`hidden-face-temple`** (MASKED HALL / SECRET SALON / RITUAL UNDERCROFT) —
  masks, silk, mirrors, chandeliers, estate walls, hidden seams, sacrificial
  undercroft, opulent finish.

## Secondary gaps in the finished kits

Not blocking, but worth tracking:

1. **Decoration slot names are fortress-specific** (`gong`/`rack`/`banner`/
   `crenel`). Every skin draws appropriate art, but the keys should be renamed to
   neutral roles (e.g. `deco-a..d`) before the vocabulary hardens further.
2. **Open-terrain survival is limited to 3 skins.** `canopy-village` is the
   obvious next outdoor candidate; `drowned-star-cenote` and
   `subterranean-sea-fort` are water skins that may want their own hazard rules.
3. **Per the reskin plan, only `iron-fortress` was ever called a full slice.** The
   other six finished generators produce the complete texture set, but a visual QA
   pass at a fixed seed (torch on/off) has not confirmed each reads as clearly as
   the fortress does.

## Suggested order

Finish the second skin of each scroll before any third, so every scroll reaches
2/3 coverage first. A reasonable priority, biased toward motifs that reuse
existing procedural primitives (water plane, magma glow, forest enclosure):

1. `burning-mines` (magma/forge primitives already exist from iron-fortress era)
2. `drowned-star-cenote` (water plane shared with sea/flood skins)
3. `frost-jarl-tomb` (glacial-rock material already declared)
4. `librarians-chasm` (vertical-space layouts already supported)
5. `sunken-thieves-guild` (sewer brick is close to legacy masonry)
6. `hidden-face-temple`, then the remaining Diablerie, canopy, dverg, sea-fort.
