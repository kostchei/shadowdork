# Cursed Scroll Environment Re-skin Audit and Implementation Plan

Status: implementation in progress
Scope: presentation only; no combat, traversal, progression, encounter, or save-rule changes  
Reviewed: 2026-07-19

## Implementation checkpoint - 2026-07-19

The first vertical slice is now implemented behind an explicit development override, so ordinary runs retain their current presentation until the wider matrix is ready.

- Milestone 0 is partially complete: `?skin=<visual-skin-id>` selects a skin and `?autostart=1` removes the opening character overlay for unobscured captures. The fixed three-seed, torch-on/off matrix and capture automation remain to do.
- Milestone 1's visual-only model and eighteen declarations are implemented in `src/game/visual/model.ts` and `src/game/visual/skins.ts`. Selection is deterministic and does not consume rules RNG; the override is opt-in rather than part of normal generation.
- Milestone 2 has one playable vertical slice: `iron-fortress`. It replaces the visible foreground with irregular dark-basalt masonry, iron platforms and gates, fortress doors, magma-lit depth, crenels, banners, racks, gongs, and fortress-specific HUD color/title treatment. Domain warping, lip/contact shadow, and crevice-grime utilities are shared procedural primitives.
- Collision tiles, bodies, topology, objectives, encounters, traps, rewards, movement, saves, and rules timing are untouched. The full automated suite passes (286 tests), and the production build succeeds.
- Browser QA at `?nl=0&skin=iron-fortress&autostart=1` confirms that the fortress reads through the torch-lit foreground and reports no browser warnings or errors.

The Red Sands faction split remains explicit: this slice depicts Gaspar's salamander-held basalt-and-iron castle. Malik's duergar-held black-granite `burning-mines` and the outdoor `djurum-approach` are separately declared skins and are the next two Red Sands implementations; they must not reuse the fortress dressing.

## Decision

The Cursed Scroll environment research has influenced Shadowdork, but only at a broad mood-board level. The game currently has four recognizable palette/backdrop families, not the eighteen environment skins described in `various_dungeon_research.md`. All four still share the same brick walls, platforms, doors, ladders, portcullises, braziers, fog, and small decoration set. In live play, darkness and the large amount of foreground brick reduce the already-limited distinction further.

The next art pass should therefore introduce six visual zone packs with three skins per pack. The eighteen skins should be selected independently from mechanical dungeon generation and should alter materials, silhouettes, props, atmosphere, connector dressing, and presentation text only. Existing collision grids, trap specifications, enemies, rewards, and completion rules should remain unchanged.

## Source and provenance note

Most of the three concepts listed under each scroll in `various_dungeon_research.md` are project-created extrapolations inspired by each zine's region. They are not three canon dungeons printed in each Cursed Scroll. Treat those concepts as Shadowdork art-direction targets and do not describe them in-game or in documentation as official Shadowdark locations. The Red Sands pack is an exception in this plan: its three skins now follow the actual spatial layers and faction territories of *Fortress of the Burning Brothers*.

The first three local PDFs establish these canon visual anchors:

- **Cursed Scroll 1: Diablerie**: black forest, misty bog, mossy standing stones, marrow-tree roots, wet and slimy caves, and the wax-like dissolving masonry of Bittermold Keep. Its included dungeon is *The Hideous Halls of Mugdulblub*.
- **Cursed Scroll 2: Red Sands**: red mountains, windblown valleys, dunes, salt flats, desert fortresses, mines, forgeworks, brass-domed cities, and sand-buried ruins. Its included dungeon is *Fortress of the Burning Brothers*. The adventure has three distinct visual layers: the Djurum/Howling Caves approach; Gaspar's dark-basalt and black-iron fortress occupied by salamanders; and Malik's pitch-dark black-granite mines and forgeworks occupied by enslaved duergar. Magma, orange glow, ash, and oppressive heat visually unite the latter two without making them the same place.
- **Cursed Scroll 3: Midnight Sun**: ice-rimed islands, fjords, snowbound peaks, smoky longhouses, runes, sea caves, tombs, and deep dverg works. Its included dungeon is *Hoard of the Sea Wolf King*.

For Scrolls 4-6, only the repo research and public setting descriptions were available during this audit. Their reliable zone-level anchors are:

- **River of Night**: choking rainforest, the Black River, fallen-imperial ruins, and obsidian temples.
- **Dwellers in the Deep**: Morzomotha, an entirely subterranean Shadowdark realm.
- **City of Masks**: Meridia, a dense urban setting of canals, bridges, districts, guilds, pageantry, and intrigue.

Before final art lock, compare Scrolls 4-6 against the user's PDFs when those files are added to the workspace. Do not block the visual-system work on that review.

## What exists now

### Implemented strengths to retain

- Four theme records provide background, stone tint, accent, haze, darkness, and one backdrop key.
- Four procedural backdrops exist: classical temple, stepped temple, natural cavern, and eldritch depths.
- Backdrops, haze, fog, bump grain, room labels, and deterministic motes already form a useful parallax stack.
- Wall tiles have three procedural variants and respond well to torchlight.
- Generated layouts now include tall rooms, drops, platforms, shafts, and nonlinear connections that can support canyon, canopy, chasm, rooftop, and cenote silhouettes.
- Theme accent colors carry through the HUD and make the four current themes easy to name from screenshots.

### Current limitations

1. `DungeonTheme` is only a palette plus one backdrop. It has no material, prop, connector, foreground, particle, waterline, or lighting-style vocabulary.
2. Every dungeon uses the same foreground masonry and most of the same props. Tinting changes hue but not material identity.
3. The backdrop motifs are often unrelated to their dungeon names. The Gloom Below uses a Greek temple; the Ember Crypt uses a stepped Mesoamerican silhouette.
4. Existing room variant pools couple some geometry to a theme, but the numeric variants are not visual kits and include shared neutral variants.
5. Darkness hides much of the backdrop while repeated brick occupies most lit pixels. The strongest authored motifs are therefore least visible during ordinary play.
6. Nonlinear and taller layouts make repetition more noticeable because a larger uninterrupted area uses the same brick and platform textures.
7. Decorations are limited to mushrooms, bones, banners, and stalactites. Doors, ladders, weak walls, gates, shrines, camps, and pickups do not adopt local construction styles.
8. There is no developer skin override or visual regression matrix, so comparing every skin at the same seed is slow and subjective.

## Eighteen-environment coverage audit

Score legend: **0 absent**, **1 incidental resemblance**, **2 partial motif**, **3 coherent environment kit**. The percentage is motif coverage, not completion percentage.

| Scroll / project skin | Current closest presentation | Score | Finding |
|---|---|---:|---|
| Diablerie / Rot-Bramble Maze | Mold Warrens palette | 0 | No roots, thorns, hedges, wet bark, or forest enclosure. |
| Diablerie / Sunken Keep of Mugdulblub | Drowned Angle water mood; generic stone | 1 | Darkness and flood mechanics suggest dampness, but no slime, sagging masonry, algae, or melting-wax stone. |
| Diablerie / Willowman's Hollow | Natural Caverns backdrop | 1 | Cave massing exists; roots, ghostly bark, hanging moss, and nightmare silhouettes do not. |
| Red Sands / Djurum and Howling Caves Approach | Ember palette; generic cavern entrance | 0 | No red desert, wind-cut cave mouth, salt dust, sandstorm shelter, howling stone, or distant black fortress silhouette. |
| Red Sands / Gaspar's Iron Fortress | Ember orange glow and generic masonry | 1 | Fire color is present, but there are no dark-basalt buildings, black-iron crenellations, towers, peaked roofs, gongs, iron dwarf faces, or magma-split courtyard. |
| Red Sands / Malik's Burning Mines | Ember warmth and common braziers | 1 | Heat is suggested, but there are no cramped black-granite tunnels, ore veins, forge ash, duergar workings, massive furnaces, ingots, iron trees, or hammering industrial depth. |
| Midnight Sun / Rime-Caked Sea Caves | Natural Caverns and flooded rooms | 1 | Cave geometry is reusable, but there is no ice material, frozen surf, blue translucency, icicles, or frost bloom. |
| Midnight Sun / Tomb of the Frost Jarl | Gloom masonry and bones | 0 | No longship ribs, burial mound, runestones, shields, carved beams, or glacial enclosure. |
| Midnight Sun / Dverg Forges | Ember warmth | 1 | Fire color exists, but no forge architecture, anvils, ducts, chains, slag, metalwork, or volcanic vents. |
| River of Night / Overgrown Basalt Ziggurat | Ember stepped backdrop | 2 | Pyramid silhouette exists; current warm palette and clean brick omit basalt, jungle occlusion, vines, roots, and wet surfaces. |
| River of Night / Cenote of the Drowned Star | Drowned Angle and flooded chamber | 2 | Teal darkness, impossible-depth motif, and water hazard are a good base; no circular skylight, hanging roots, water plane, submerged blocks, or air-pocket dressing. |
| River of Night / Canopy Village | Tall procedural layouts | 1 | Vertical route support exists; no trunks, woven platforms, treehouses, rope lashings, foliage layers, or lethal forest-floor depth. |
| Dwellers / Librarians' Chasm | Gloom columns and tall rooms | 1 | Monumental vertical space is possible; no shelves, bridges, hanging archives, paper motes, lamps, or abyssal book silhouettes. |
| Dwellers / Fungal Grottos of the Nuln | Mold Warrens, cave backdrop, mushrooms | 2 | The strongest named match, but generic brick remains dominant and the fungus has little scale, variety, glow, or surface takeover. |
| Dwellers / Subterranean Sea-Fort | Drowned Angle | 1 | Teal palette suggests deep water; no fortress silhouette, quay, waterline, wet fortification, chains, boats, or distant black sea. |
| City of Masks / Rooftop Scamper | None | 0 | No roof tiles, skyline, chimneys, clocktower, gargoyles, laundry, windows, or moonlit drop. |
| City of Masks / Sunken Thieves' Guild | Flooded chamber | 1 | Water exists as a rule, not as a sewer/aqueduct visual language. |
| City of Masks / Temple of the Hidden Face | Gloom columns and shrine | 1 | Classical architecture is a weak base; masks, silk, mirrors, chandeliers, estate walls, hidden seams, and sacrificial undercroft are absent. |
| **Total** | **Four palette/backdrop families** | **16 / 54 (30%)** | **0 coherent kits; 3 partial motifs; 15 absent or incidental.** |

The current work should not be discarded. It supplies reusable composition, lighting, and procedural-drawing infrastructure. The required change is to move visual identity from a single distant backdrop into every lit layer of the scene.

## Target visual system

### Separate mechanics from appearance

Keep the current mechanical theme and generated dungeon unchanged. Add a purely presentational `VisualSkin` selected after generation:

```ts
type ZonePackId =
  | "diablerie"
  | "red-sands"
  | "midnight-sun"
  | "river-of-night"
  | "dwellers-in-the-deep"
  | "city-of-masks";

interface VisualSkin {
  id: VisualSkinId;
  zone: ZonePackId;
  displayName: string;
  palette: VisualPalette;
  materials: MaterialSetId;
  backdrop: BackdropSpec;
  props: PropSetId;
  connectors: ConnectorSkin;
  atmosphere: AtmosphereSpec;
  lighting: LightingStyle;
  roomNouns: readonly string[];
}
```

`VisualSkin` must not contain damage, DCs, collision flags, movement modifiers, encounter weights, treasure, or progression values. Existing saves should continue to identify the generated dungeon; derive the skin deterministically from the saved run seed and store it only if exact replay requires protection from later selection-table changes.

### Give every skin five non-color identifiers

Each skin needs all of the following:

1. **Foreground material**: what walls and platforms are made from.
2. **Large silhouette**: the immediate read behind traversable space.
3. **Connector language**: local doors, gates, ladders, bridges, weak walls, and one-way platforms.
4. **Prop ecology**: at least three families of small, medium, and landmark dressing.
5. **Ambient motion**: harmless particles or overlays characteristic of the place.

Color is a sixth identifier, not a substitute for the five above. In a grayscale screenshot, a player should still be able to identify the zone pack and distinguish its three skins.

### Material families

Build parameterized procedural material generators rather than eighteen unrelated copies:

| Material family | Reused by |
|---|---|
| Wet dissolving stone | Mugdulblub keep, cenote, sewer guild |
| Bark, root, and thorn | Rot-Bramble, Willowman's Hollow, canopy village |
| Wind-cut red stone and desert scree | Djurum/Howling Caves approach |
| Dark basalt and blackened iron | Gaspar's Iron Fortress |
| Flinty black granite, ore, and forge metal | Malik's burning mines and forgeworks |
| Ice, runestone, and carved timber | Sea caves, frost-jarl tomb, dverg forge |
| Basalt and jungle masonry | Basalt ziggurat, cenote |
| Raw cavern, fungus, and abyssal masonry | Library chasm, fungal grotto, sea-fort |
| Roof tile, stucco, dressed canal stone, and opulent interior | All City of Masks skins |

The generator should output wall variants, edges/caps, platforms, weak walls, climb surfaces, gates, doors, and optional floor overlays from the same material parameters. This prevents the current failure where a thematic backdrop sits behind generic brick.

### Procedural Asset Generation & Mathematical Engine

To achieve the physical, hand-painted aesthetic seen in reference artwork and top-tier 2D games, assets must not use clean straight lines or flat color fills. All procedural material generators in `src/game/visual/textures/` must implement three core mathematical passes: **Domain Warped Non-Perfect Edges**, **Lip Shadow & Overhang Occlusion**, and **Random Crevice Grime Noise**.

#### 1. Non-Perfect Edges via Domain Warping
Straight rectangle/grid geometry is passed through a multi-octave 2D Simplex noise vector warp field prior to evaluating shape boundaries:

$$\mathbf{P}' = \mathbf{P} + \eta \cdot \begin{pmatrix} \text{Simplex}(f \mathbf{P} + \mathbf{o}_x) \\ \text{Simplex}(f \mathbf{P} + \mathbf{o}_y) \end{pmatrix}$$

- **Parameters**: $\eta \approx 2.0 - 5.0\text{px}$ warp amplitude; $f \approx 0.05$ frequency.
- **Tile Lattice Jitter**: Individual tile seeds receive random positional offset $\mathbf{\delta}_{ij} \sim \mathcal{N}(0, \sigma^2)$ and rotation angle $\theta_{ij} \in [-\theta_{\text{max}}, \theta_{\text{max}}]$ so no two tiles are strictly parallel.

#### 2. Lip Shadow & Contact Occlusion (Shadow from the Lip)
Overlapping layers (e.g. roof tiles, stepped stone ledges, iron plates, shingles) feature cast shadows and undercut contact shadows along their bottom lip:

- **Directional Cast Shadow Vector**:
  $$\mathbf{S}_{\text{offset}} = \frac{z_{\text{lip}}}{\tan\theta_{\text{light}}} (\cos\phi_{\text{light}}, \sin\phi_{\text{light}})$$
- **Soft Ambient Lip Undercut (Contact AO)**:
  $$AO_{\text{lip}}(y) = 1.0 - \alpha_{\text{lip}} \cdot \exp\left( -\frac{(y - y_{\text{lip}})^2}{2 \sigma_{\text{lip}}^2} \right)$$
  This produces a dark crisp contact shadow right along the joint line under the overhanging lip.

#### 3. Random Rough Shadows & Crevice Grime
Dark dirt, aging, and micro-shadows accumulate in concave corners and chipped surface divots:

- **Curvature Occlusion Mask**: Derived from heightmap normal field divergence $\kappa = \nabla \cdot \mathbf{N}$:
  $$\text{Occlusion}_{\text{crevice}}(\mathbf{P}) = \text{clamp}(-\kappa \cdot k_{\text{dirt}}, 0, 1)$$
- **Fractal Rough Shadow Overlay**:
  $$\text{RoughShadow}(\mathbf{P}) = \text{Occlusion}_{\text{crevice}}(\mathbf{P}) \times \sum_{m=0}^{M} \frac{1}{2^m} \left| \text{Simplex}(2^m f \mathbf{P}) \right|$$

#### 4. Geometry Math for Key Missing Assets

- **Rectangular Shingles & U-Shaped Barrel Tiles (`rooftop-scamper`)**:
  - *Rectangular Chamfered Profile*: Height $z_{\text{rect}} = h_{\text{max}} \cdot \text{clamp}(-\text{SDF}_{\text{box}}(\mathbf{P}')/w_{\text{bevel}}, 0, 1)^\gamma$ with $\gamma \approx 0.6$ for convex lip curvature.
  - *U-Shaped (Spanish/Mission) Tiles*: Semi-cylindrical arc cross section $z_{\text{barrel}}(x) = R \sqrt{1 - (2(x-x_0)/w - 1)^2}$ staggered in alternating convex cap and concave trough columns with bottom-lip overhang shadows onto lower rows.
- **Wet & Dissolving Masonry (`mugdulblub-keep`, `sunken-thieves-guild`)**:
  - *Melting Block Joints*: Smooth minimum function $s_{\text{min}}(a, b, k) = -\ln(e^{-ka} + e^{-kb})/k$ to round block corners into sagging wax-like mortar.
  - *Slime Streaks*: Vertical decay exponential noise $\text{Slime}(x, y) = \text{clamp}(\text{Simplex}(f_x x, f_y y) - 0.2, 0, 1) \cdot e^{-\text{fract}(y)}$.
- **Wind-Cut Sandstone & Scree (`djurum-approach`)**:
  - *Horizontal Strata*: 1D FBM height step evaluation with horizontally stretched anisotropic noise ($f_x \ll f_y$) to produce flaking sedimentary ledges.
- **Dark Basalt & Blackened Iron (`iron-fortress`, `overgrown-basalt-ziggurat`)**:
  - *Polygonal Columns*: 2D Hexagonal Voronoi cell distance fields with sharp linear bevel edges.
  - *Metallic Edge Rims*: Specular rim shading $I_{\text{rim}} = (1.0 - \mathbf{N} \cdot \mathbf{V})^\beta$.
- **Bark, Roots & Thorns (`rot-bramble`, `willowman-hollow`, `canopy-village`)**:
  - *Parametric Root Tubes*: 3D cylindrical curves with radial FBM displacement.
  - *Thorns*: Cone SDF spikes spawned where Voronoi cell noise peaks exceed threshold $\tau$.
- **Glacial Ice & Translucent Rock (`rime-sea-caves`)**:
  - *Ice Depth*: Subsurface color shift based on Voronoi edge distance $d_{\text{voronoi}}(\mathbf{P})$ and sharp icicle SDFs.

## Art direction for each skin

| Skin id | Foreground material and silhouette | Props and harmless ambient treatment |
|---|---|---|
| `rot-bramble` | Interlocked black roots and thorn walls; hedge tunnels close around the route | Wet leaves, bone charms, sliced vines, low mist, drifting gnats |
| `mugdulblub-keep` | Sagging blocks with rounded, melting edges; flooded undercroft silhouette | Algae curtains, slime drips, globby mortar, warped banners, slow bubbles |
| `willowman-hollow` | Vast pale roots forming arches and ribs; tree hollow recedes behind rooms | Hanging moss, knotted faces, root hairs, ghost motes, distant elongated shadow |
| `djurum-approach` | Wind-cut red rock, salt-crusted cave mouths, and sandy ledges; the black fortress appears far inside the cathedral cavern | Abandoned camp gear, caravan scraps, warning marks, cave dust, grit gusts, wavering heat, distant orange magma glow |
| `iron-fortress` | Dark-basalt buildings, blackened-iron walls and barbed crenels, towers, peaked roofs, and a courtyard divided by magma | Brass alarm gongs, iron ladders, dwarf-face doors, portcullises, weapon racks, nightmare tack, blue-black incense, sparks and heat shimmer |
| `burning-mines` | Cramped flinty black-granite tunnels opening onto magma, furnace halls, and ore-cut caverns | Gold and iron veins, mine carts and buckets, anvils, ingots, grates, chains, iron trees, forge ash, steam, ember drift, rhythmic hammer silhouettes |
| `rime-sea-caves` | Blue-black rock glazed in translucent ice; frozen surf and sea-mouth silhouette | Icicles, fish bones, ropes, frost crystals, breath haze, harmless ice sparkle |
| `frost-jarl-tomb` | Runestone and longship ribs entombed in glacier walls | Shields, carved prow, grave goods, frozen banners, snow sift, cold bloom |
| `dverg-forges` | Hewn mountain stone reinforced by dark metal; vents and forge stacks | Anvils, rails, chains, molds, slag piles, ember drift, steam puffs |
| `overgrown-basalt-ziggurat` | Nearly black cyclopean steps broken by roots; jungle mass presses inward | Vines, serpent faces, orchids, fallen idols, rain streaks, leaf movement |
| `drowned-star-cenote` | Circular wet limestone and submerged masonry; bright oculus over black water | Hanging roots, star carvings, air bubbles, caustic light ripples, falling droplets |
| `canopy-village` | Woven timber platforms wrapped around giant trunks; layered depth to forest floor | Huts, baskets, rope bridges, webbing, leaves, pollen, distant canopy sway |
| `librarians-chasm` | Shelves and archive towers bridging a bottomless void | Ladders, chained books, reading lamps, torn banners, paper motes, subtly skewed parallax |
| `nuln-fungal-grottos` | Stone almost consumed by fungus; cap forests supply the silhouette | Shelf fungus, puffballs, corpse blooms, spore clouds, bioluminescent pulses |
| `subterranean-sea-fort` | Wet black battlements and quays against an underground sea horizon | Mooring chains, broken boats, barnacles, winches, water glints, distant wave silhouettes |
| `rooftop-scamper` | Pitched tile roofs, chimneys, dormers, and a layered city skyline | Gargoyles, laundry, weather vanes, clock faces, pigeons, chimney smoke |
| `sunken-thieves-guild` | Brick aqueducts, sewer arches, and flooded timber catwalks | Grates, smugglers' marks, barrels, fight posters, rats, drips, water reflections |
| `hidden-face-temple` | Opulent estate above and severe ritual stone below; concealed seams connect both | Masks, mirrors, silk, chandeliers, portraits, candles, dust, slow curtain movement |

## Implementation plan

### Milestone 0 - Establish a reproducible visual matrix

1. Add a development-only `?skin=<visual-skin-id>` override alongside the existing `?nl=<seed>` route.
2. Choose one compact, one tall, and one nonlinear seed as fixed visual fixtures.
3. Capture torch-on and torch-off screenshots for every skin at a fixed viewport.
4. Record the current four themes as the baseline; do not modify gameplay assertions.

Deliverable: a repeatable 18 x 3 screenshot matrix and a short capture script or documented command.

### Milestone 1 - Introduce the data model without changing output

1. Create `src/game/visual/skins.ts` for the eighteen declarative skin records.
2. Create `src/game/visual/model.ts` for palette, materials, props, atmosphere, and connector types.
3. Add `visualSkin` to the expanded render definition or derive it in `DungeonScene` from the run identity.
4. Express the existing four themes as legacy `VisualSkin` records and prove pixel-equivalent output before continuing.
5. Keep `DungeonTheme` temporarily for danger, encounters, trap pools, and compatibility; remove only its presentation fields after all callers migrate.

Deliverable: architectural separation with no intentional visual or mechanical change.

### Milestone 2 - Move identity into lit foreground materials

1. Extract environment drawing out of the monolithic `src/game/textures.ts` into `src/game/visual/textures/`.
2. Create `src/game/visual/textures/math.ts` containing the reusable procedural math utilities: domain warping, Simplex vector fields, SDF bevel profiles, directional cast shadows, lip contact AO, curvature divergence calculation, and crevice dirt overlays.
3. Implement material generators in `src/game/visual/textures/materials.ts` using `math.ts` for wall centers, edge/cap variants, roof tiles (U-shaped barrel and rectangular shingles), platforms, weak walls, climb surfaces, gates, and doors.
4. Update `DungeonScene.buildLevel()` to request semantic keys such as `wall`, `platform`, `climb`, `gate`, `door`, and `roof` from the active skin.
5. Generate only the selected skin at scene load, plus shared characters/items/effects, to avoid paying startup and texture-memory costs for all eighteen.
6. Keep physics bodies and tile coordinates identical.

Deliverable: one fully dressed vertical slice per zone pack (six skins), each readable in the torch-lit foreground with non-perfect edges, lip shadows, and crevice grime.

Recommended vertical slices: `mugdulblub-keep`, `iron-fortress`, `rime-sea-caves`, `overgrown-basalt-ziggurat`, `nuln-fungal-grottos`, and `rooftop-scamper`.

### Milestone 3 - Add connector and prop vocabularies

1. Replace hard-coded decoration switch cases with semantic decoration slots populated by the active skin.
2. Skin doors, gates, ladders/climb surfaces, one-way platforms, weak walls, shrines, braziers, camps, and cages.
3. Add small/medium/landmark prop density bands so decoration remains legible without obscuring actors or traversal edges.
4. Seed all cosmetic placement from the run seed and tile coordinate; do not consume rules-engine randomness.
5. Complete the remaining twelve skins using the shared material and prop generators.

Deliverable: all eighteen skins have foreground material, connector language, and at least three prop families.

### Milestone 4 - Atmosphere, water, and foreground depth

1. Replace the single generic fog layer with skin-specific overlays: mist, grit, snow, rain, spores, paper, smoke, or dust.
2. Add cosmetic water planes and reflection/ripple overlays where called for. They must not introduce buoyancy, damage, slowed movement, breath, or collision.
3. Add sparse foreground occluders (roots, leaves, chains, arches) with strict alpha and screen-coverage limits.
4. Give each skin a lighting style: torch warmth, ambient fill tint, shadow tint, emissive prop tint, and haze response.
5. Ensure enemies, pickups, weak walls, spikes, and usable connectors retain silhouette and contrast in every palette.

Deliverable: motion and depth support the skin while gameplay remains identical.

### Milestone 5 - Presentation polish and cleanup

1. Use skin-aware room nouns and title-card subtitles without changing objectives or rules.
2. Add a restrained HUD border motif per zone pack; keep typography, layout, and information hierarchy stable.
3. Retire the mismatched legacy mappings only after their replacement skins pass comparison.
4. Consolidate duplicate procedural drawing helpers and document how to add a nineteenth skin.
5. Run the full test suite and visual matrix before merging.

Deliverable: production-ready selection across all eighteen skins.

## File-level change map

| File or new module | Planned responsibility |
|---|---|
| `src/game/level/dungeons.ts` | Retain mechanical dungeon definitions; remove visual literals only after migration. |
| `src/game/level/expand.ts` | Carry or deterministically derive a `visualSkinId`; do not alter topology/content selection. |
| `src/game/scenes/Dungeon.ts` | Consume semantic skin textures, atmosphere, prop slots, and light styling. |
| `src/game/scenes/Boot.ts` | Generate shared textures plus the selected skin; support developer override. |
| `src/game/textures.ts` | Shrink to shared character, monster, pickup, and effect texture registration. |
| `src/game/visual/model.ts` | Visual-only type contracts. |
| `src/game/visual/skins.ts` | Eighteen declarative skin records and deterministic selection. |
| `src/game/visual/textures/math.ts` | Procedural math engine: 2D domain warping, SDF heightfields, lip contact AO, directional shadow displacement, normal divergence curvature, and FBM crevice grime. |
| `src/game/visual/textures/materials.ts` | Parameterized foreground material generators using `math.ts` (rectangular/U-tiles, wet stone, sandstone, basalt, roots, ice). |
| `src/game/visual/textures/backdrops.ts` | Large silhouettes and parallax layers. |
| `src/game/visual/textures/props.ts` | Prop and connector generators. |
| `src/game/visual/atmosphere.ts` | Cosmetic overlays, particles, and harmless water treatment. |
| `tests/visual-skins.test.ts` | Completeness, valid texture references, deterministic selection, and no gameplay fields. |

## Permitted minor additions

These additions are acceptable because they communicate or reinforce appearance without changing outcomes:

- Cosmetic splash, ripple, dust-puff, snow-puff, leaf, spore, paper, and ember reactions to movement.
- Surface-specific footstep sound selection with identical noise propagation and encounter behavior.
- Cosmetic sway on ropes, vines, banners, laundry, and hanging chains.
- Skin-specific destruction particles for a weak wall while retaining the same hit count, timing, sound radius, and opening behavior.
- Skin-specific interaction animation for gates, switches, shrines, and doors while retaining the same state transition.

Do not add slippery ice, poisonous spores, drowning, heat damage, wind push, collapsing bridges, obscured targeting, new checks, altered light duration, or revised encounter probabilities as part of this work. If any become desirable later, propose them separately as gameplay changes.

## Acceptance criteria

### Visual identity

- All eighteen `VisualSkinId` values render successfully on compact, tall, and nonlinear fixture seeds.
- Every skin has at least two non-color identifiers visible in an ordinary torch-on gameplay frame; the target is all five defined above across a room.
- A grayscale contact sheet still distinguishes the six zone packs and the three skins within each pack.
- No skin is merely a hue change of another.
- The first three zone packs reflect the local PDF anchors without copying published maps or artwork.

### Gameplay preservation

- With the same seed, changing only `?skin=` produces identical grid, regions, connectors, traps, NPCs, monsters, rewards, and reachability results.
- All colliders and interaction coordinates remain unchanged.
- Cosmetic randomness never consumes `ctx.engine.dice` or changes deterministic rules rolls.
- Existing saves load with a stable default skin and do not require schema-breaking migration.

### Readability and accessibility

- Player, enemy, pickup, hazard, weak-wall, door, and climb-surface silhouettes meet the existing light/dark visibility standard in all skins.
- Color is never the only way to distinguish a weak wall, connector state, hazard, or interactable.
- Foreground occluders never cover the player or a critical connector for more than a brief, translucent pass.
- HUD text contrast and layout remain at least as legible as the current build.

### Performance and maintainability

- Only active-skin environment textures are generated and retained.
- Texture generation occurs outside active play and does not create frame-time spikes during room entry.
- Every skin record passes completeness validation; no switch statement needs eighteen branches in `DungeonScene`.
- Adding a skin is primarily data plus procedural drawing callbacks, not edits across the level generator and rules systems.

## Review gates

1. **Six-skin vertical slice review**: approve material scale, torch response, and density before producing the other twelve.
2. **Eighteen-skin grayscale review**: reject skins that depend on palette alone.
3. **Gameplay-overlay review**: verify hazards and interactables under torch, dark sight, and torch-out states.
4. **Source review**: reconcile Scrolls 4-6 with their PDFs before final names and landmark motifs are locked.
5. **Final regression review**: compare fixed seeds, run automated tests, and confirm the only diffs are presentation-layer output.

## Recommended order of work

Start with Milestones 0 and 1, then build the six recommended vertical slices in Milestone 2. That sequence tests all shared material families and exposes whether the declarative skin model is sufficient before twelve more kits depend on it. Complete connectors and prop ecology next; atmosphere should come after the foreground reads clearly, because the current audit shows that distant backdrops alone do not survive normal darkness and play.
