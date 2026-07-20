# Directional Camera and Visible-Terrain Framing Plan

## Status

Planning only. No gameplay code has been changed for this work.

## Problem

The dungeon camera currently follows the active party leader with:

```ts
this.cameras.main.startFollow(this.party.leader, true, 0.12, 0.12);
```

This keeps the leader at the centre of the 960 x 540 logical view. It causes two
separate presentation problems:

1. Half of the horizontal view is spent behind the character even though the
   useful information is normally in the direction they are facing.
2. Half of the vertical view is below the character even when they are standing
   on an ordinary cave or desert floor. That exposes rows of solid floor tiles
   which contain no useful play space.
3. The renderer draws every solid collision cell as a decorated tile. In the
   supplied cave reference this turns the inaccessible rock below the walking
   surface into a large tiled cross-section. The character should see the
   exposed floor and, when it is close enough, the exposed ceiling—not the
   internal tile grid of the rock around the chamber.

These require two related but independent systems. Camera composition decides
where the view points. Visible-terrain classification decides which parts of the
collision mass actually have an exposed surface worth drawing.

## Existing code findings

- The logical game view is `GAME_W = 960` by `GAME_H = 540` in
  `src/game/display.ts`; render scaling does not change the intended world-space
  framing.
- `DungeonScene.create()` starts a smooth centred follow at
  `src/game/scenes/Dungeon.ts:495`.
- Leader changes restart the same centred follow in
  `src/game/scenes/Dungeon.ts:1934`.
- `CharacterSprite.facing` is already maintained as `1 | -1`, so no new input
  state is required.
- Open-sky levels already distinguish one selected underground room and expose
  the active visual skin. Terrain rendering also classifies supported surfaces,
  overhangs, and hidden ceiling mass in `src/game/visual/openTerrain.ts`.
- `DungeonScene.buildLevel()` currently creates a visible image and a static
  collision body together for every `#` cell. The local `visible` variable is
  never changed from `true`, including for `hidden-ceiling`, so deep solid mass
  is always tiled.
- Phaser subtracts `followOffset` from the followed position. Consequently a
  right-facing camera centre ahead of the player requires a negative horizontal
  follow offset, and a camera centre above the player requires a positive
  vertical follow offset.

## Required behavior

### 1. Directional horizontal composition

Keep approximately 80% of the visible width in front of the leader and 20%
behind them.

For a 960-pixel logical view, the leader should settle at:

- `x = 192` when facing right;
- `x = 768` when facing left.

That places the camera centre 288 pixels (`0.30 * GAME_W`) ahead of the leader.
The offset must transition smoothly after a direction change rather than snap
from one side to the other.

World-bound clamping remains authoritative. Near the left or right edge of the
level, an exact 80/20 split is impossible and the camera should stop at the
existing world bounds without showing space outside the map.

### 2. Terrain-aware vertical composition

Use two vertical framing modes:

- **Floor framing:** When standing on ordinary cave, underground-room, or desert
  floor, raise the camera focus so the leader's feet sit close to the bottom of
  the view. The bottommost visible band should contain only the floor surface,
  not several rows of decorative solid tiles. A starting target is feet at
  roughly `GAME_H - TILE / 2` (about 524 logical pixels).
- **Elevated framing:** When on a rooftop, tree platform, one-way platform, or a
  route with meaningful traversable/drop space below, keep the leader near the
  vertical centre so the player can see what is beneath them.

The mode should not flap while jumping. Preserve the last grounded framing mode
during a short jump, switch to elevated framing for sustained falling or
climbing, and ease between modes. Exact thresholds should live as named
constants so they can be tuned after visual QA.

### Proposed vertical classification

Classify from strongest signal to weakest:

1. A one-way platform (`=`) beneath the leader is elevated.
2. Rooftop and canopy exterior rooms are elevated, except their selected
   underground room.
3. Meaningful open space below the supporting surface is elevated. This covers
   bridges and ledges in other skins.
4. The selected underground room is floor-framed unless rule 1 or 3 proves the
   current route is elevated.
5. Desert supported ground and normal solid cave floor are floor-framed.

### 3. Draw only visible terrain surfaces

Camera framing alone is insufficient. The supplied screenshot shows the actual
failure clearly: every collision tile below the character is drawn, producing a
deep repeated grid. Those tiles represent inaccessible rock, not surfaces the
character can see.

Separate physical solidity from visual exposure:

- Keep every required `#` cell as collision geometry.
- Draw a floor cap where solid terrain has traversable/open space immediately
  above it.
- Draw a ceiling underside where solid terrain has traversable/open space
  immediately below it.
- Draw a wall face where solid terrain has traversable/open space immediately to
  its left or right.
- Do not draw an individually decorated tile for solid cells completely enclosed
  by other solid cells.
- Cover enclosed floor/ceiling mass with a continuous, unpatterned dark
  silhouette where necessary so parallax scenery does not appear through solid
  rock. The silhouette must not expose tile seams.
- Do not invent a ceiling. If the authored ceiling is high above the viewport,
  or the room opens to the sky, leave the vertical gap open.

Exterior elevated structures are a deliberate exception. A rooftop façade,
tree-platform support, bridge edge, or visible drop is exposed to air and may
show designed support art beneath the walking surface. Desert ground is not an
elevated façade: it should show its surface edge and then resolve into a quiet
solid mass rather than rows of decorated sand/stone tiles.

This makes the desired cave composition a readable band of open chamber bounded
by a floor and, only when present in view, a ceiling. Collision and traversal
remain unchanged.

## Design and implementation shape

Add a small camera-framing module, preferably
`src/game/systems/cameraFraming.ts`, containing pure calculations and a minimal
stateful controller.

The pure portion should accept the leader position/facing, logical viewport
size, grounded state, current room/skin, and a terrain query. It should return:

```ts
interface CameraFramingTarget {
  offsetX: number;
  offsetY: number;
  verticalMode: "floor" | "elevated";
}
```

`DungeonScene` remains responsible for querying its grid and applying the
result to `cameras.main`. Keeping the calculation outside the scene avoids
adding more policy to the already large `Dungeon.ts` and makes the 80/20 math
and terrain cases unit-testable without booting Phaser.

Recommended update flow:

1. Start following the current leader through one helper method used both at
   scene creation and after leader selection.
2. On each active gameplay tick, derive the desired horizontal and vertical
   offsets.
3. Ease the stored offsets toward those targets using delta-time-based damping,
   then call `camera.setFollowOffset(...)`.
4. On a leader swap, initialize from the new leader's current facing and
   terrain context. Do not retain the previous leader's look direction.
5. On a teleport/load/restart, snap the vertical mode once to avoid a long pan
   through unrelated rooms; normal direction changes should remain smooth.

Use one smoothing layer. Either set camera follow lerp to `1` and damp the
offsets in the controller, or retain Phaser follow lerp and change target
offsets immediately. Delta-time damping in the controller is preferred because
it produces consistent behavior across frame rates and allows different timing
for ordinary movement, facing changes, and floor/elevated transitions.

Add a second pure classifier, preferably in
`src/game/visual/terrainVisibility.ts`, which inspects neighboring grid cells and
returns the exposed faces for a solid cell:

```ts
interface ExposedTerrainFaces {
  floor: boolean;
  ceiling: boolean;
  leftWall: boolean;
  rightWall: boolean;
  enclosed: boolean;
}
```

`buildLevel()` should continue creating collision for every solid cell, but
should create detailed visual art only for an exposed face or for an explicitly
visible exterior support. Deep mass should use merged silhouette regions or an
equivalent seam-free mask, not one image per hidden tile.

Keep the camera and terrain changes independently testable and independently
tunable. The camera must not decide collision visibility, and the terrain
classifier must not depend on current camera position; a surface is exposed by
level geometry, not by whether it happens to be on screen this frame.

## Suggested constants for the first tuning pass

These are initial values, not final art direction:

```ts
const CAMERA_FORWARD_SHARE = 0.80;
const CAMERA_FORWARD_CENTRE_SHIFT = 0.30; // 80% ahead / 20% behind
const FLOOR_FEET_MARGIN_PX = TILE / 2;
const LOOK_EASE_MS = 350;
const VERTICAL_EASE_MS = 450;
const AIRBORNE_MODE_DELAY_MS = 180;
```

The horizontal ratio is a requirement. The timing and vertical margin should be
tuned in play, especially on narrow rooms and during repeated left/right taps.

## Tests

Add focused unit tests for the pure framing logic:

- right-facing target places the leader at 20% of the view;
- left-facing target places the leader at 80% of the view;
- changing facing changes the target but the smoothed value does not snap;
- desert supported ground selects floor framing;
- ordinary cave and the open-sky underground room select floor framing;
- rooftop and canopy exterior surfaces select elevated framing;
- `=` selects elevated framing in every biome;
- a solid ledge with meaningful open space below selects elevated framing;
- a brief jump retains the last grounded mode;
- leader swap and teleport reset the controller deterministically;
- bounds are left to Phaser and no calculation requests a larger viewport or a
  zoom change.

Add terrain-visibility tests covering:

- the top row of a solid cave floor is an exposed floor;
- solid cells beneath that row are enclosed and receive no detailed tile image;
- the bottom row of a low ceiling is an exposed ceiling underside;
- solid cells above that underside do not repeat the ceiling texture;
- vertical cave walls retain their exposed face;
- a high authored ceiling is not pulled into view or synthetically extended;
- an open-sky room has no generated ceiling;
- desert ground shows a surface without a deep decorated cross-section;
- rooftop façades and tree-platform supports remain visible where exposed;
- collision coverage is identical before and after visual suppression.

Run `npm test` and `npm run build` after implementation.

## Visual QA matrix

Check at minimum:

| Situation | Expected framing |
| --- | --- |
| Cave floor, facing right/left | Feet near bottom; 80% view in facing direction |
| Cave with a low ceiling | One readable floor surface and one ceiling underside; no tiled solid mass |
| Cave with a high ceiling | Floor remains visible; open chamber continues upward until actual ceiling enters view |
| Desert floor by day and night | Surface edge only; no deep tiled ground visible beneath feet |
| Rooftop exterior | Exposed façade/drop remains visible below |
| Canopy/tree platform | Lower branches and landing space remain visible |
| One-way platform in a cave | View opens downward |
| Jump from ordinary floor | No immediate vertical camera bob |
| Long fall or climb | Camera transitions to elevated/airborne framing |
| Rapid direction reversals | Focus glides across without snapping or oscillating |
| Leader swap | Camera adopts the new leader and facing promptly |
| Left/right/top/bottom world edge | No out-of-bounds background revealed |
| Room transition/teleport/load | No prolonged camera travel through old space |

## Acceptance criteria

- In unobstructed space, the settled horizontal composition is 80% ahead and
  20% behind the active leader.
- Facing changes visibly move the focus to the new forward direction with a
  smooth, short transition.
- Normal cave and desert floors do not spend the lower half of the screen on
  solid tiled ground.
- Cave rooms render exposed floor, ceiling, and wall faces without revealing the
  internal collision-tile grid of surrounding rock.
- High ceilings and open sky retain genuine open space; the renderer does not
  manufacture a ceiling to fill it.
- Rooftops, tree platforms, one-way platforms, and meaningful drops retain
  useful visibility below the leader.
- Suppressing hidden tile art does not remove or resize any collision body.
- Camera framing does not change physics, level geometry, lighting coordinates,
  encounter spawning, or HUD layout.
- Existing world bounds continue to clamp the camera safely.
