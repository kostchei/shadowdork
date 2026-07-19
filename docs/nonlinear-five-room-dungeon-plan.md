# Non-linear Five Room Dungeon Plan

Status: largely shipped. This began as a design/implementation plan; the topology
catalog, grid embedding, abstract→physical pipeline, connector states, room-content
pressures, talkable NPCs, and physical validation are now live (commits `311b294`,
`11b8d43`, and follow-ups). See [nonlinear-dungeon-review-and-plan.md](nonlinear-dungeon-review-and-plan.md)
for the post-ship review and remaining follow-ups. The sections below record the
original design intent and remain the reference for terminology and invariants.

## Purpose

Replace Shadowdork's current left-to-right railroad with deterministic,
replayable five-room dungeons embedded in a four-row by five-column macro-grid.
Only five of the twenty macro-cells are full rooms. The other cells are available
for connectors, shafts, short passages, scenery, blocked space, secrets, and empty
air.

The generator must provide genuine route choice and vertical movement while proving
that every mandatory route is navigable by the starting party. Class abilities may
make routes cheaper or reveal shortcuts, but may never be required to finish a
standard dungeon.

This plan supplements [Five Room Dungeons in Shadowdork](five-room-dungeons.md) and
supersedes the fixed horizontal-room-band assumptions in older planning documents.

## Visual references supplied during design

The source images are external working references and are not currently copied into
the repository.

| Reference | Local source | Design contribution |
|---|---|---|
| The 21 Forms | `G:\Pictures\The-21-Forms.png` | The complete set of 21 topologically distinct connected simple graphs on five nodes, ranging from a four-edge tree to the ten-edge complete graph. |
| The 9 Forms | `G:\Pictures\The-9-Forms.png` | A smaller, more legible family of five-room arrangements: Arrow, Cross, Evil Mule, Fauchard Fork, Foglio's Snail, Moose, Paw, Railroad, and V for Vendetta. It identifies the current layout as the Railroad and provides strong first-release shapes. |
| Five Room Dungeon Generator | `G:\Pictures\n98fewcfxk971.jpg` | Twelve spatial footprints made by arranging five dice, plus a second roll that gives each room a content keyword. It separates spatial shape from room purpose, which is essential for replayability. |

### Reference 1: The 21 Forms

The image names these connected five-node graph families:

1. 5-star
2. 5-arrow
3. Cricket
4. 5-path
5. Bull
6. Banner
7. Stingray
8. Lollipop
9. Spinning top
10. Kite
11. UFO
12. Chevron
13. Hourglass
14. 5-circle
15. House
16. Crown
17. Envelope
18. Lamp
19. Arrowhead
20. Cat's cradle
21. 5-complete

The useful lesson is not that every line must immediately become a corridor. The
graph describes potential room-to-room adjacency. The physical connector can be
open, guarded, gated, secret, breakable, one-way, or initially unavailable.

Sparse forms are naturally readable in a side view. The densest forms are not all
planar: Cat's cradle and 5-complete cannot be embedded literally in a single 2D tile
plane without crossings. They therefore require one of these explicit treatments:

- a connector junction that is not counted as one of the five rooms;
- a visually separated foreground/background passage;
- a lift or shaft that crosses a horizontal passage without joining it;
- a magical portal or theme-specific impossible-space connector;
- omission of a graph edge from the physical embedding, treating it as a future
  unlock rather than a simultaneous passage.

No generator may silently cross two corridors and accidentally create an extra
connection.

### Reference 2: The 9 Forms

This image is the best initial shipping set because its shapes remain readable with
five rooms:

| Form | Shadowdork use |
|---|---|
| Railroad | Baseline and accessibility-friendly layout. Retain it as a minority, not the default. |
| Arrow | Main route with an early side room or elevated temptation. |
| Cross | Central hub with three spokes; excellent for a switch room and two choices. |
| Evil Mule | A path that branches late, allowing reward-versus-risk decisions near the climax. |
| Fauchard Fork | Early split that can reconnect through a gate or one-way descent. |
| Foglio's Snail | A compact loop with an attached room; good for a shortcut opened from the far side. |
| Moose | A central branch point with a long main route and a short optional branch. |
| Paw | A hub reached after an approach, with three guarded or gated spokes. |
| V for Vendetta | Two routes that converge at the climax or reward. |

The first release should implement Railroad, Arrow, Cross, Fauchard Fork, Moose,
and V. Foglio's Snail and Paw follow once loop and hub readability are proven.

### Reference 3: Five Room Dungeon Generator

The reference separates footprint selection from room-content selection. Its room
keywords can be adapted into six Shadowdork content families:

| Roll | Content family | Candidate tags |
|---|---|---|
| 1 | Discovery | NPC, sentinel, atmosphere, exploration, secret, separated character |
| 2 | Challenge | puzzle, obstacle, trick, setback, device, betrayal |
| 3 | Hazard | trap, switch, environment, timer, targets, gate |
| 4 | Opportunity | treasure, weapon, narrative beat, healing, lore, spells |
| 5 | Pressure | combat, boss, stealth, reinforcements, outmatched fight, injury |
| 6 | Twist | roleplay, dispute, revelation, reversal, escape, death-risk |

These are tags, not isolated room scripts. Theme, room role, connector state, party
composition, and resource budget constrain the final template selection.

The reference's own rules add three lessons the generator should adopt:

- **Variable starting points.** The entrance is the lowest-numbered cell of the
  rolled footprint, or optionally the cell marked by the layout roll itself — the
  starting point is a property of the footprint roll, not a fixed corner. When the
  roll produces duplicate lowest values, the reference permits multiple entrances
  and exits. Shadowdork may adapt this as a seeded secondary entrance or alternate
  exit on footprints that support it.
- **Adjacency implies potential connection.** Wherever two cells touch, a doorway
  or connecting hall *can* exist — adjacency is an invitation, not an obligation,
  which matches the graph-edge-versus-physical-connector split above.
- **A two-zone walk between encounters is acceptable pacing.** Encounter rooms do
  not need to be directly adjacent; routing an edge through one or two quiet
  connector cells is fine and often better than teleport-dense adjacency. Travel
  itself is part of the dungeon's rhythm.

The image also demonstrates that the entrance need not be lower-left. Shadowdork
may begin at a suitable boundary cell at the top, side, or bottom of the macro-grid.

## Spatial model

### The 4 x 5 macro-grid

The pre-sanctuary dungeon occupies a maximum four-row by five-column logical grid:

```text
column       0     1     2     3     4
row 0      [   ] [   ] [   ] [   ] [   ]
row 1      [   ] [   ] [   ] [   ] [   ]
row 2      [   ] [   ] [   ] [   ] [   ]
row 3      [   ] [   ] [   ] [   ] [   ]
```

Exactly five cells are primary rooms. The remaining fifteen may be:

- empty solid rock or open air;
- a horizontal passage;
- a vertical shaft;
- a stair, ramp, ladder, rope, vine, or lift;
- a one-way slide or controlled drop;
- a portcullis, weak wall, secret door, bridge, or jump;
- a small connector encounter or scenery pocket;
- a junction used to route a dense graph without adding a sixth room.

Connector and filler cells never receive a full five-room narrative role. They may
contain minor opposition or resources, but cannot quietly become additional rooms.

### Rooms versus beats

The five narrative beats remain:

1. Entrance or discovery
2. Challenge or roleplay
3. Setback or change of state
4. Climax
5. Reward or revelation

They are labels on graph nodes, not a required spatial order. The reward may be
visible early but inaccessible, the setback may occur before the challenge, and the
climax may guard the exit after the reward.

### Entrance and exit placement

The entrance may occupy any boundary-facing room cell with a safe spawn landing:

- top-left, top-centre, or top-right;
- middle-left or middle-right;
- bottom-left, bottom-centre, or bottom-right.

Orientations and reflections are part of seeded variation. A layout must not assume
that progress always moves right or upward.

Where a footprint supports it, a seed may also select a secondary entrance or
alternate exit (the reference's duplicate-lowest-roll rule). A secondary opening is
never mandatory for completion; it exists as route choice, an escape option, or a
shortcut discovered from inside.

The sanctuary and exit are attached after the five-room graph. They may be reached
from any boundary-facing reward or post-climax room. Where practical, choose an exit
that produces meaningful travel across the footprint instead of sitting immediately
beside the entrance.

## Topology catalogue and rollout

### Tier 1: guaranteed-readable forms

- Railroad / 5-path
- Arrow / 5-arrow
- Cross / 5-star
- Fauchard Fork
- Moose
- V for Vendetta

These require no corridor crossings and can be embedded with ordinary horizontal
and vertical connectors. Railroad should represent no more than 20 percent of
standard runs once all Tier 1 forms ship.

### Tier 2: loops and richer hubs

- 5-circle
- Lollipop
- Foglio's Snail
- Paw
- Banner
- Bull
- Stingray
- House
- Hourglass

These introduce cycles, multiple approaches, far-side shortcuts, and rooms with
three connections. They require clear door silhouettes and a compact map or strong
environmental signposting so players understand which routes remain unexplored.

### Tier 3: dense and impossible-space forms

- Cricket
- Spinning top
- Kite
- UFO
- Chevron
- Crown
- Envelope
- Lamp
- Arrowhead
- Cat's cradle
- 5-complete

These should ship only with connector-junction support and, for non-planar graphs,
an explicit crossing technology. Dense forms are valuable because monsters, gates,
and hazards can make many nominal connections into meaningful route choices. They
must not become five freely open rooms with ten visually confusing doors.

Recommended dense-form rule: at dungeon start, no room has more than three open
connections. Additional edges are closed, secret, guarded, or unlocked from the far
side. The topology can be dense while the player's immediate decision remains
legible.

## Connections

Every graph edge is assigned a connector specification.

```ts
type ConnectorKind =
  | "passage"
  | "stairs"
  | "ladder"
  | "rope"
  | "vine"
  | "lift"
  | "slide"
  | "controlled-drop"
  | "bridge"
  | "jump"
  | "portcullis"
  | "weak-wall"
  | "secret-door"
  | "junction"
  | "portal";

type ConnectorState =
  | "open"
  | "guarded"
  | "locked"
  | "switched"
  | "breakable"
  | "secret"
  | "one-way";
```

### Directional connector rules

| Relative room position | Suitable connectors |
|---|---|
| Above | stairs, ladder, vine, rope, lift, staggered platforms, climb-and-break route |
| Below | stairs, ladder, rope, lift, sand slide, controlled drop, collapsing floor |
| Beside | passage, bridge, jump, portcullis, weak wall, secret door |
| Non-adjacent | routed passage through filler cells, shaft, junction, or explicit portal |

### Connector requirements

- A routed edge may pass through up to two filler cells between rooms. A two-zone
  walk between encounters is acceptable pacing; longer routes need a landmark,
  resource, or scenery beat so the journey stays legible and worthwhile.
- Ordinary ladders and ropes are universal traversal.
- Vines, narrow shafts, and difficult climbs may be class-favoured shortcuts only.
- A mandatory weak wall must have a universal interaction or an alternate route;
  Fighter smashing may be the cheap solution, not the sole solution.
- Mandatory uncontrolled drops stay within the safe fall distance.
- Longer descents require a visible landing, rope, ladder, lift, or catch ledges.
- A one-way connection cannot strand the party before the reward unless every state
  downstream still reaches the reward and exit.
- A locked connection's key or switch cannot be exclusively behind that connection.
- A lift has reachable stops, cannot leave followers permanently behind, and has a
  deterministic recovery position.
- A secret edge is never the only mandatory route unless the secret is explicitly
  taught and revealed as part of the room interaction.

## Monsters as route control

Dense topology is made readable by changing edge availability and cost rather than
removing edges.

Examples:

- Goblins occupy the direct bridge while a slower rope route passes beneath them.
- Skeletons guard a portcullis winch; the gate can also be opened from the far side.
- A large monster patrols the hub, making each crossing risky until it is lured into
  a trap or defeated.
- Reinforcements spawn from one branch until its shrine or brazier is disabled.
- A monster group can guard a shortcut without blocking the universal critical path.

Monsters are soft locks. The validator treats a budgeted combat encounter as
passable but verifies that the mandatory route remains within the solo-safe monster
budget. A creature that cannot reasonably be defeated at the current tier must have
a bypass, lure, stealth, payment, or environmental solution.

### Local alert propagation

Enemy awareness should follow the spatial graph, not the entire tilemap.

- Noise alerts the current room and may propagate across one open connector.
- Closed portcullises, sealed doors, and thick walls block propagation.
- Open shafts and echoing halls may propagate farther as a room modifier.
- A hub can deliberately chain-alert its spokes, but this is an authored property.
- Connector-cell monsters belong to one adjacent room's morale and alert group; they
  do not create an undeclared sixth room.

This keeps a dense layout from waking every monster simultaneously while allowing
room adjacency to matter.

## Room content generation

### Separate spatial and content rolls

For a run seed, the generator independently derives:

1. dungeon theme;
2. topology family;
3. 4 x 5 embedding, orientation, and entrance;
4. narrative beat assignment;
5. room content family and tags;
6. connector kinds and states;
7. room templates, monsters, NPCs, hazards, and treasure;
8. cosmetic variation.

Changing a room template must not change the topology roll. Cosmetic random calls
must not perturb gameplay generation.

Replayability therefore comes from four independent variance axes, and the same
value on one axis must still permit the full range of the others:

1. **Space** — footprint, embedding, orientation.
2. **Starting point** — entrance cell (and any secondary opening) within that
   footprint.
3. **Order** — which narrative beat lands on which node; the walk order of beats is
   not the authored order 1-5.
4. **Contents** — content family and keyword tags per room (the reference's second
   d6 roll), then the concrete template.

Two runs sharing a footprint should still feel different when their entrance, beat
order, or contents differ; seeded tests should assert this independence rather than
only asserting that grids differ.

### Content constraints

- Exactly one climax and one campaign reward.
- At least one room pressures light, one pressures HP, and one pressures inventory,
  time, or position.
- Never place two unavoidable pure-combat rooms consecutively on every available
  route.
- Every room offers a cheap/clever solution and an expensive/universal solution.
- Exactly one memorable featured mechanism per standard run is the target.
- Minor hazards can appear in connectors but do not replace room identity.
- Room templates declare compatible topology degree, dimensions, entrance sides,
  exit sides, themes, and connector types.

### Talkable NPCs

Talkable NPCs are distinct from immediate companion rewards and the retired rescue
tiles.

- Target: a talkable NPC or social encounter in roughly half of standard runs, with
  no more than two in one five-room dungeon.
- NPC placement is drawn from Discovery and Twist tags such as NPC, separated,
  roleplay, dispute, revelation, or betrayal.
- `E` first opens a short interaction rather than instantly recruiting the NPC.
- Outcomes may reveal a route, identify a safe connector, give or request an item,
  operate a switch, trade, lie, trigger danger, or become eligible as the campaign
  companion reward.
- A mandatory key NPC is always reachable and cannot be killed by an unseen room
  hazard before the player can interact.
- NPC dialogue and state must be deterministic from the run seed and persist in
  saves.

## Generation pipeline

```text
RunIdentity
  -> select theme and topology
  -> embed five room nodes in 4 x 5 macro-grid
  -> choose entrance orientation
  -> route graph edges through connector/filler cells
  -> assign narrative beats and content tags
  -> assign connector kinds and initial states
  -> select compatible room and connector templates
  -> place monsters, NPCs, hazards, reward, sanctuary, and exit
  -> validate abstract progression state graph
  -> expand macro-cells into tile geometry
  -> validate physical traversal and budgets
  -> accept, or deterministically retry with the next candidate
```

Retries are bounded and deterministic: candidate `c` derives all its randomness
from `hash(seed, stage#c)`, so the accepted dungeon is stable per seed.

On candidate-budget exhaustion the generator **throws**, retaining the seed and the
per-candidate diagnostics for debugging. It does not substitute a known-good
fallback. This is a deliberate revision of the earlier "known-good fallback"
direction, for two reasons:

1. Project policy is no silent fallbacks — surface the failure instead of shipping
   a substitute the caller did not ask for.
2. A fallback would mask exactly the weak constraint that caused exhaustion. The
   guarantee that exhaustion never happens for a released topology is instead
   enforced up front by the property tests (>=1,000 seeds per topology, every
   supported orientation), so a throw in production would signal a real regression,
   not an expected event.

It must never publish a partially validated dungeon.

## Navigability validation

Connectivity alone is insufficient. Validation must prove that the dungeon can be
completed in the order allowed by its keys, switches, one-way edges, and changing
states.

### Abstract progression search

Search over states rather than room positions alone:

```ts
interface TraversalState {
  roomId: string;
  openedLocks: ReadonlySet<string>;
  activatedSwitches: ReadonlySet<string>;
  acquiredKeys: ReadonlySet<string>;
  revealedSecrets: ReadonlySet<string>;
  rewardClaimed: boolean;
}
```

The validator explores every legal interaction and edge transition. It must prove:

- the spawn reaches at least one safe neighbouring space;
- all five required room nodes are reachable;
- the climax, reward, sanctuary, and exit are reachable in a valid state;
- no key is locked behind its own gate;
- no required switch is accessible only after the switch is needed;
- required one-way edges cannot enter a dead end;
- an opened shortcut actually reconnects to an already reachable region;
- optional class edges are not used by the universal completion proof;
- at least one completion route remains within encounter and hazard budgets.

The same search should report useful generation diagnostics: unreachable room,
self-locking key, unsafe mandatory drop, isolated follower, excess mandatory combat,
or connector crossing.

### Physical traversal validation

After tile expansion, validate geometry:

- room and connector bounds remain inside the world;
- every connector has valid entry and landing regions;
- ladders, ropes, and vines reach both intended platforms;
- lifts have two usable stops and a reset state;
- jump gaps are within the universal jump envelope on mandatory paths;
- required drops do not exceed the safe fall allowance;
- no spikes or lethal hazard sit beneath an unavoidable failed jump;
- gates and weak walls have matching runtime interactions;
- camera bounds expose all mandatory platforms and connector cues;
- followers can traverse or safely regroup through every mandatory connector;
- room lookup uses `(x, y)` regions rather than horizontal bands.

Property tests should cover at least 1,000 run seeds per released topology and all
supported rotations/reflections.

## Data model direction

```ts
interface MacroPoint {
  column: 0 | 1 | 2 | 3 | 4;
  row: 0 | 1 | 2 | 3;
}

interface DungeonRoomNode {
  id: string;
  position: MacroPoint;
  beat: "entrance" | "challenge" | "setback" | "climax" | "reward";
  contentFamily: "discovery" | "challenge" | "hazard" | "opportunity" | "pressure" | "twist";
  tags: readonly string[];
}

interface DungeonConnection {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  routedCells: readonly MacroPoint[];
  kind: ConnectorKind;
  state: ConnectorState;
  direction: "two-way" | "from-to" | "to-from";
  requirementId?: string;
}

interface NonLinearDungeonLayout {
  macroWidth: 5;
  macroHeight: 4;
  tileWidth: number;
  tileHeight: number;
  rooms: readonly DungeonRoomNode[];
  connections: readonly DungeonConnection[];
  grid: readonly string[];
  sanctuary: RoomRegion;
  entranceRoomId: string;
  rewardRoomId: string;
  exitRoomId: string;
}
```

The final implementation should split topology selection, macro-grid embedding,
content selection, tile-template expansion, and validation into separate modules.
`dungeons.ts` should not remain one monolithic generator.

## Example layouts

Legend: `E` entrance, `R` room, `C` climax, `V` vault/reward, `-` or `|`
connector, `g` gated connector, `>` one-way connector, and `.` filler/empty cell.

### Top-right Arrow

```text
.  .  R--E  .
.  .  |  .  .
.  V--R--C  .
.  .  .  .  .
```

The party starts high and descends. The vault is visible to the left but its gate is
opened from the central room after the climax route is understood.

### Bottom-centre V

```text
.  R  .  R  .
.  |\ . /|  .
.  R--C  .  .
.  .  E  .  .
```

Two vertical approaches converge at the climax. One is guarded; the other contains
a lift controlled by a talkable NPC or switch.

### Cross hub

```text
.  .  R  .  .
.  .  |  .  .
E--R--C  .  .
.  .  V  .  .
```

The hub exposes several routes, but only two are initially open. A portcullis and a
far-side weak-wall shortcut keep the choices readable.

### Dense form with routed filler

```text
R--g--R  .  .
|  .  |  .  .
R--R--R  .  .
|  .  |  .  .
```

Five rooms occupy five cells; the gate and shaft use filler cells. Additional dense
edges begin locked or secret. A non-planar edge is not drawn unless the selected
theme supports a distinct overpass, shaft crossing, or portal.

## Implementation sequence

### Milestone 1: graph and validator foundation

1. Introduce topology definitions independent of tile geometry.
2. Implement the 4 x 5 embedding and rotation/reflection system.
3. Implement abstract state-search validation for open, gated, switched, secret,
   breakable, and one-way edges.
4. Add deterministic retry and diagnostic output.
5. Property-test Tier 1 graphs without rendering them in the game.

Deliverable: every generated abstract dungeon is connected, completable by the
universal traversal model, and reproducible from its run seed.

### Milestone 2: flexible world geometry

1. Replace fixed `DUNGEON_W`, `DUNGEON_H`, and `ROOM_BANDS` assumptions with layout
   dimensions and `(x, y)` room regions.
2. Update camera bounds, atmosphere, room labels, morale groups, encounter spawning,
   saves, and room-entry tracking.
3. Add universal ladders/ropes and robust follower transitions.
4. Add connector-cell rendering and local alert propagation.

Deliverable: Railroad and one vertical Tier 1 form render from the same data model.

### Milestone 3: Tier 1 layout release

1. Ship Railroad, Arrow, Cross, Fauchard Fork, Moose, and V.
2. Add horizontal passages, stairs, ladders, ropes, lifts, controlled drops,
   portcullises, weak walls, bridges, and one-way slides.
3. Make entrance orientation vary across top, sides, and bottom.
4. Tune mandatory combat budgets and connector telegraphs.
5. Keep Railroad at or below 20 percent of generated runs.

Deliverable: consecutive runs create materially different navigation decisions, not
merely different platform decoration.

### Milestone 4: room-role and NPC variance

1. Add six content families and compatible template metadata.
2. Add deterministic talkable NPC encounters with persistent interaction state.
3. Separate NPC conversation, rescue, and companion reward outcomes.
4. Add secrets, route information, trade, disputes, betrayals, and revelations.
5. Ensure every room pressures a resource or changes dungeon state.

Deliverable: identical spatial forms support different stories, hazards, and route
states on different seeds.

### Milestone 5: loops and dense forms

1. Ship Tier 2 loops and richer hubs.
2. Add connector junctions and explicit crossing support.
3. Introduce compatible Tier 3 dense forms gradually.
4. Limit initially open degree and use guards/gates to preserve readability.
5. Add an optional compact discovered-room map if playtesting shows navigation is
   unclear without one.

Deliverable: dense forms create route pressure and revisitation without accidental
connections or visual confusion.

## Test and acceptance plan

The feature is complete when:

1. Exactly five full rooms occupy a 4 x 5 macro-grid before the sanctuary.
2. Entrances occur on multiple sides and elevations across a deterministic sample.
3. All Tier 1 topologies and supported orientations appear across seeded tests.
4. Railroad accounts for no more than 20 percent of standard layouts.
5. Every accepted seed passes abstract state-search and physical traversal checks.
6. Reward, sanctuary, and exit are reachable without class-specific shortcuts.
7. Keys and switches never lock themselves behind their own connections.
8. Mandatory drops, jumps, lifts, ladders, ropes, and gates are physically usable by
   a solo starting Fighter and by followers.
9. Monsters used as route control stay within the mandatory combat budget or have a
   universal bypass.
10. Noise and alert propagation remain local unless a room explicitly modifies it.
11. Talkable NPCs appear at the intended rate and are visibly distinct from pickups
    and immediate companion rewards.
12. A copied run seed reproduces topology, embedding, room content, connectors,
    NPCs, traps, and rewards.
13. At least 1,000 seeds per released topology validate without an unhandled failure.
14. Production build, automated tests, and representative browser playthroughs are
    clean.

## Design review

### Strengths

- Separates five-room narrative pacing from physical order.
- Uses only five full rooms while extracting significant variance from twenty
  placement cells.
- Makes vertical movement, route choice, locked shortcuts, monsters, and NPCs part
  of generation rather than decoration.
- Treats navigability as a state-search problem, catching self-locking keys and
  one-way dead ends that ordinary connectivity checks miss.
- Preserves deterministic seeds and class identity without making a class mandatory.
- Provides an incremental path from the current Railroad to dense forms.

### Risks and resolutions

| Risk | Resolution in this plan |
|---|---|
| Dense graphs are visually confusing. | Limit initially open degree, clearly render connector states, and stage dense forms after readable Tier 1 layouts. |
| K5 and other dense graphs are non-planar. | Require junction, separated crossing, shaft, portal, or defer that topology; never allow accidental corridor intersections. |
| Random locks create impossible dungeons. | Validate progression states including keys, switches, secrets, and one-way edges before accepting a seed. |
| Class mechanics become hard locks. | Universal completion proof ignores class-only shortcuts; class verbs reduce cost instead. |
| Vertical layouts strand followers. | Mandatory connector metadata includes follower traversal and recovery behavior; test every class and followers. |
| Five rooms quietly become twenty rooms. | Only five macro-cells receive full room roles; filler and connectors have strict content budgets. |
| Monsters turn every branch into compulsory combat. | Budget mandatory encounters and require bypasses for outmatched guards. |
| Procedural rooms lose theme identity. | Templates declare theme and connector compatibility; theme is selected before content. |
| NPCs remain invisible or behave like treasure. | Give talkable NPCs a separate interaction state, visual treatment, placement rate, and persistence tests. |
| Generation retries hide weak constraints. | Bound retries, record diagnostics, throw on exhaustion (no fallback), and property-test each topology independently so exhaustion cannot occur for a released topology. |

### Review conclusion

The design is coherent and implementable if delivered in milestones. The main
architectural dependency is removing the fixed one-screen-high world and horizontal
`ROOM_BANDS`; attempting to add graph shapes before that refactor would only produce
another decorated railroad. Abstract topology and state validation should be built
first, followed by one vertical prototype, before expanding the room-content or
dense-form catalogue.

The first implementation slice should therefore be Milestone 1 only. It creates no
player-facing half-feature, gives every later layout a deterministic proof of
navigability, and exposes which graph forms can be embedded in the 4 x 5 grid before
tile and camera work begins.
