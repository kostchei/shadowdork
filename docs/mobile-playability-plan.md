# Mobile web playability plan

## Status

- **Document status:** implementation-ready plan
- **Target:** touch-capable mobile browsers, played in landscape
- **First release:** mobile web/PWA-capable browser build
- **Not in the first release:** App Store or Google Play packaging, Steam Input,
  native platform services, or a redesigned portrait game layout

## Goal

Make the existing Phaser game comfortable and complete on a phone or tablet
without weakening desktop keyboard play. Keyboard, touch, and future gamepad
controls must invoke the same named gameplay actions so that rules and scene
logic do not become device-specific.

The first mobile release is complete when a player can start or resume a run,
use every gameplay and menu action, save and load, recover cleanly from an
interruption, and finish a dungeon using touch alone on a supported landscape
device.

## Current state

The project already has a useful mobile foundation:

- Phaser uses `Phaser.Scale.FIT` and centers the canvas.
- The game has a fixed logical layout of 960 x 540.
- The page has a responsive viewport and the canvas fills its container.
- Boot and pause-menu choices already use Phaser pointer events, which also
  receive touch input.
- Audio already attempts to unlock from the first pointer or keyboard gesture.

The main gaps are:

- `DungeonScene` reads Phaser keyboard keys directly and assumes keyboard input
  is available.
- Gameplay instructions and contextual prompts name keyboard keys.
- There is no on-screen gameplay controller or touch-control preference.
- Several text-only menu targets are smaller than a comfortable touch target.
- The 960 x 540 HUD leaves little room for controls without a deliberate
  mobile layout.
- High-DPI phones can request an expensive framebuffer while the lighting
  system maintains two full-screen render textures.
- Browser interruption, orientation, safe-area, and gesture behavior are not
  defined.

## Product decisions

### Supported presentation

- Landscape is the supported gameplay orientation.
- Portrait displays an orientation gate explaining that the device should be
  rotated. Gameplay does not continue behind the gate.
- The first version retains the 960 x 540 logical playfield.
- Touch controls are an overlay and do not alter physics or game rules.
- Keyboard and touch may be used at the same time on hybrid devices.
- A connected touchscreen does not permanently force touch UI on a desktop
  user; the player can override detection.

### Touch-control preference

Add a stored setting with these values:

- `auto` (default): show controls when the primary pointer is coarse or the
  device reports touch points.
- `on`: always show controls, useful for testing and hybrid devices.
- `off`: never show controls.

Capability detection:

```ts
export function hasTouchCapability(): boolean {
  return navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
}
```

This is capability detection, not browser or operating-system detection. Do
not branch gameplay behavior on a user-agent string. Listen for changes to the
coarse-pointer media query where supported, but never overwrite a manual
preference.

For development and automated QA, support a query override such as
`?touch=on` or `?touch=off`. The query override should affect the current
session without rewriting the stored player setting.

## Shared action input architecture

### Principle

Scenes consume semantic actions, not physical keys or buttons:

```ts
input.held("moveLeft");
input.held("attack");
input.pressed("interact");
input.pressed("cast");
```

An `ActionInput` service combines keyboard, touch, and later gamepad sources.
Adding a new source must not require changes to combat, movement, interaction,
or inventory rules.

### Action behavior

Each action exposes:

- `held(action)`: true while any source holds the action.
- `pressed(action)`: true for one update after an up-to-down transition.
- `released(action)`: true for one update after the final source releases it,
  when needed.
- `releaseSource(sourceId)`: clears every action owned by one pointer or input
  source.
- `releaseAll()`: prevents stuck movement or attacks after blur, visibility
  loss, scene shutdown, or orientation gating.

Multiple sources may hold the same action. Releasing one source must not clear
an action that another source still holds. Internally, track action ownership
by source ID rather than storing only one Boolean per action.

Consume one-shot transitions once per game update. A held touch button must not
re-trigger `pressed` every frame.

### Action catalogue and default bindings

| Action | Behavior | Keyboard | Touch |
|---|---|---|---|
| `moveLeft` | held | A / Left | left pad |
| `moveRight` | held | D / Right | right pad |
| `moveUp` | held | W / Up | up pad |
| `moveDown` | held | S / Down | down pad |
| `jump` | held plus initial press | Space / W / Up | Jump |
| `attack` | held | J / X / Left Ctrl | Attack |
| `cast` | pressed | K | Cast |
| `cycleSpell` | pressed | Q | Spell cycle |
| `interact` | pressed | E | Interact |
| `lightTorch` | pressed | T | Torch |
| `toggleFollowers` | pressed | H | Follow/Hold |
| `spendLuck` | pressed | L | contextual Luck |
| `cycleLeader` | pressed | Tab | Party |
| `selectLeader1..4` | pressed | 1-4 | party panel/member |
| `toggleStats` | pressed | C | Stats |
| `toggleInventory` | pressed | I | Inventory |
| `rest` | pressed | R | contextual Rest/menu |
| `pause` | pressed | Esc | Pause |
| `toggleMute` | pressed | M | Audio icon/settings |
| `menuUp` | pressed | Up | menu previous |
| `menuDown` | pressed | Down | menu next |
| `menuLeft` | pressed | Left | choice previous |
| `menuRight` | pressed | Right | choice next |
| `menuConfirm` | pressed | E / Enter | selected control |
| `menuCancel` | pressed | Esc | Back/Close |

`moveUp` and `jump` remain separate semantic actions even if keyboard defaults
overlap. This keeps ladder climbing, ledge mantling, and ordinary jumping
explicit and lets touch use a four-way pad plus a dedicated Jump button.

The current control flow should be migrated in small steps:

1. Implement and unit-test `ActionInput` with a keyboard source.
2. Replace direct key checks in `DungeonScene` with action queries without
   changing keyboard behavior.
3. Add the touch source and on-screen controller.
4. Move overlay/menu navigation to the same actions.
5. Add a Phaser gamepad source later using the same interface.

### Scene ownership

- Create one action-input service for the active game session.
- `DungeonScene` consumes gameplay actions.
- `HudScene` owns the fixed-screen touch presentation and feeds touch actions
  into the service.
- Boot and modal overlays use explicit pointer hit areas and menu actions.
- The touch controller is hidden or disabled while an overlay owns input,
  except for controls that belong to that overlay.
- Scene shutdown removes input listeners and releases all held sources.

Do not simulate keyboard events from touch. Feeding semantic actions directly
avoids browser keyboard inconsistencies and preserves source ownership.

## Touch controller design

### Primary layout

The controller is anchored to viewport edges and respects safe-area insets.

**Left thumb:**

- Four-way D-pad or short-travel virtual stick.
- Left/right move the leader.
- Up climbs and mantles.
- Down descends, drops from a ledge, or braces when the class permits it.

**Right thumb:**

- Attack: largest primary action; supports hold.
- Jump: large primary action; supports hold so existing variable/coyote input
  behavior remains available.
- Interact: large contextual action.
- Cast: large secondary combat action.

**Compact utility row:**

- Cycle spell.
- Light torch.
- Cycle leader.
- Follow/Hold.
- Inventory.
- Stats.
- Pause.

Luck and Rest should appear as prominent contextual actions only when valid.
Leader selection may also be offered by tapping a party member in the HUD.

### Layout constraints

- Primary targets should be at least 48 CSS pixels in both dimensions; use
  larger targets where space allows.
- Leave separation between Attack, Cast, and Interact to reduce costly errors.
- Controls must not cover contextual prompts, the active leader, or critical
  inventory/torch information.
- Keep the central lower portion of the playfield as clear as practical.
- Use opacity that preserves the dungeon view while maintaining contrast.
- Give pressed controls an immediate visual state and optional light vibration
  through `navigator.vibrate`, behind a setting and only where supported.
- Do not rely on hover.

At narrow landscape widths, collapse secondary controls into an expandable
utility tray. Opening the tray must not pause movement automatically, but it
must not leave a hidden held button active.

### Pointer semantics

- Register enough Phaser pointers for simultaneous movement and action input.
- Track every pointer by ID.
- `pointerdown` claims an action for that pointer.
- Sliding outside a digital button releases it unless the control deliberately
  implements slide-between directions.
- D-pad sliding may transfer ownership between directions without requiring a
  finger lift.
- `pointerup`, `pointerupoutside`, `pointercancel`, blur, visibility loss,
  overlay opening, controller hiding, and scene shutdown release the pointer.
- Prevent a touch that starts on UI from also interacting with the world.
- Reject duplicate synthetic mouse activation following touch where relevant.

### Context-aware labels

Replace physical-key-only copy with action-aware copy:

- Keyboard: `E - Disarm trap`
- Touch visible: `Interact - Disarm trap`, with the same icon as the button
- Future gamepad: controller glyph plus `Disarm trap`

Pause, stats, inventory, start, victory, game-over, and biome-choice overlays
must all be completable without a keyboard. Instructions should reflect the
most recently used input family or use neutral language where practical.

## Browser and page behavior

Update the page shell for mobile-safe behavior:

- Apply `touch-action: none` and disable text selection on the game surface.
- Prevent browser scrolling, pull-to-refresh, double-tap zoom, and long-press
  context menus only within the game surface.
- Preserve accessibility and normal browser behavior outside the game surface.
- Use `100dvh` with an appropriate fallback instead of relying only on `100%`
  height.
- Include viewport coverage and safe-area support for notched devices.
- Apply `env(safe-area-inset-*)` to touch-control anchors and orientation UI.
- Handle resize and orientation changes without recreating game state.
- Offer a fullscreen button where the Fullscreen API is supported; failure or
  denial must be harmless.

Do not attempt to programmatically lock orientation from an ordinary browser
page. Orientation locking is not consistently available without fullscreen or
an installed/native shell. Show the landscape gate instead.

## Interruption and lifecycle handling

When the page becomes hidden, loses focus, or is interrupted:

1. Release all held input sources immediately.
2. Pause physics, animation, and gameplay time through the existing pause
   pathway.
3. Suspend or quiet audio.
4. Preserve whether the pause was automatic or player-requested.
5. Require a clear tap to resume and unlock audio again if necessary.

Do not advance torch timers, death timers, combat, or other game-rule time
while gameplay is automatically paused. Verify this explicitly because the
rules engine receives frame delta from the dungeon scene.

Autosave on meaningful transitions should remain in place. Add a lifecycle
autosave only if the state can be captured synchronously and safely; mobile
browsers may terminate a background page without allowing asynchronous work.

## Rendering and performance

### Initial policy

- Retain the existing logical resolution.
- Cap automatic mobile render scale at a tested value, initially 2, while
  keeping the existing developer `?dpr=N` override.
- Prefer a capability/performance setting over a permanent iOS/Android branch.
- Add Low, Standard, and High visual-quality choices if profiling shows a
  meaningful difference.

Candidate quality controls, in priority order:

1. Render scale.
2. Particle emission counts.
3. Decorative haze/motes.
4. Lighting render-texture update frequency or resolution.
5. Nonessential shadow effects.

Do not lower simulation frequency or change rules resolution as a performance
setting.

### Performance targets

- Target stable 60 FPS on representative mid-range devices.
- Accept a stable 30 FPS low-quality mode on minimum supported devices.
- No increasing memory trend across repeated room transitions or a 20-minute
  play session.
- Touch-to-visual-response should feel immediate, with no preventable one-frame
  queueing beyond the normal game update.
- Avoid sustained thermal throttling during a representative 15-minute run.

Measure frame timing, framebuffer dimensions, render-texture dimensions,
particle counts, and memory behavior on real devices. Desktop device emulation
does not validate GPU cost, audio policy, or touch latency.

## Menus, HUD, and accessibility

- Expand pointer hit areas independently of text bounds on Boot and pause
  screens.
- Make all save, load, delete, import, export, biome-choice, inventory, stats,
  and pause actions touch-operable.
- Add explicit Close/Back controls to overlays instead of requiring the same
  keyboard shortcut that opened them.
- Make inventory selection, equip/use, drop, and rest available through visible
  buttons.
- Confirm destructive save deletion with a touch-friendly modal.
- Do not use color alone to communicate held, disabled, selected, or dangerous
  controls.
- Provide touch-control opacity and left/right-handed layout settings after the
  base layout is validated.
- Retain mute and add independent haptics control if vibration is introduced.
- Respect `prefers-reduced-motion` for optional UI animation where practical;
  never reduce mechanically relevant animation without an equivalent cue.

## Persistence and settings

Store mobile preferences separately from versioned run saves so changing a UI
setting cannot invalidate a save slot. Initial settings:

- Touch controls: Auto / On / Off.
- Touch layout: Standard; Left-handed may follow after playtesting.
- Control opacity.
- Haptics: On / Off, default Off unless user research supports otherwise.
- Fullscreen preference where meaningful.
- Visual quality or mobile render scale.

If local storage is unavailable, explain that saving and preferences will not
persist. Do not silently report a successful save.

## Testing strategy

### Automated tests

Add unit tests for:

- Capability detection and query/manual override precedence.
- Pressed fires once while Held remains true.
- Multiple sources can hold one action independently.
- Releasing or cancelling one pointer does not release another source.
- `releaseSource` and `releaseAll` clear stuck actions.
- Sliding between D-pad regions transfers actions correctly.
- Keyboard mappings retain all current behavior.
- Touch controls hide and disable correctly for Off, portrait gate, scene
  shutdown, and modal overlays.

Add browser-level smoke tests where the existing test tooling permits:

- Start a new game using pointer input.
- Dismiss the start overlay with touch.
- Move, jump, attack, cast, interact, switch leader, and pause using synthetic
  touch/pointer input.
- Open and close stats/inventory.
- Save and load a slot.
- Rotate/resize without losing state or leaving an action held.
- Hide/show the page and confirm gameplay remains paused until resumed.

### Manual device matrix

Minimum release coverage:

| Class | Required coverage |
|---|---|
| iPhone | one current iOS/Safari device |
| Android low/mid | one lower or mid-range Chrome device |
| Android high | one current high-end Chrome device |
| Tablet | one iPadOS Safari or Android tablet |
| Hybrid desktop | touchscreen laptop or desktop emulation with manual On |
| Desktop regression | Chrome plus keyboard with touch controls Off |

On each device verify:

- Cold start, audio unlock, new game, resume, save/load, and export/import.
- Every action, including ladders, ledges, fighter bracing, luck, torch,
  follower mode, inventory operations, pause, win, wipe, and biome choice.
- Two-thumb input: move+jump, move+attack, move+cast, and D-pad direction
  changes without lifting.
- Orientation gate, browser chrome resize, fullscreen where available,
  app-switch interruption, notification/call interruption where practical,
  and screen locking.
- Safe areas, readable UI, accidental browser gestures, battery/temperature,
  frame pacing, and a 20-minute stability session.

## Implementation phases

### Phase M0 - Baseline and decisions

- Capture desktop FPS/framebuffer baseline and current mobile-device behavior.
- Confirm landscape-only product decision and minimum browser/device targets.
- Produce a touch-layout wireframe over current HUD screenshots.
- Decide initial render-scale cap and touch-control default opacity.

**Exit criteria:** approved control layout, device matrix, and recorded desktop
baseline.

### Phase M1 - Input foundation

- Add the action catalogue and `ActionInput` service.
- Add keyboard mappings matching current behavior.
- Migrate all direct dungeon key reads to actions.
- Add source ownership, pressed transitions, cancellation, and unit tests.
- Keep desktop UI and controls behaviorally unchanged.

**Exit criteria:** all existing tests pass; a complete keyboard-only run remains
possible; `DungeonScene` no longer depends on physical key names for gameplay
decisions.

### Phase M2 - Touch gameplay MVP

- Add detection, Auto/On/Off preference, and QA query override.
- Register multi-touch pointers.
- Build fixed-screen D-pad, primary action buttons, and utility row.
- Implement contextual Luck and Rest buttons.
- Add pressed/held feedback and pointer cancellation.
- Make the start overlay and core gameplay completable by touch.

**Exit criteria:** a player can complete the core movement/combat/interaction
loop using touch alone in landscape.

### Phase M3 - Menus and mobile shell

- Make pause, stats, inventory, save/load, win/wipe, and biome-choice flows
  touch-complete.
- Add neutral/input-aware prompts and larger hit areas.
- Add safe-area CSS, dynamic viewport height, gesture suppression, orientation
  gate, resize handling, and optional fullscreen.
- Add interruption auto-pause and guaranteed input release.
- Verify audio resume behavior.

**Exit criteria:** no normal player flow requires a physical keyboard, and an
interruption cannot leave the party moving or attacking.

### Phase M4 - Performance and release QA

- Apply and profile the mobile render-scale cap.
- Add quality options only if profiling justifies them.
- Run automated touch smoke tests and the real-device matrix.
- Fix overlap, latency, thermal, audio, and lifecycle defects.
- Update README controls and player-facing help.

**Exit criteria:** the release checklist below passes on the agreed device
matrix with no critical defects.

### Phase M5 - Optional installable/native work

After the browser release is stable:

- Add a web app manifest, service worker/offline asset policy, install icons,
  update behavior, and offline/error presentation for a PWA.
- If store distribution is desired, wrap the same build with Capacitor and add
  Android/iOS signing, native lifecycle testing, store metadata, privacy
  declarations, and release automation.

PWA/native packaging is not required to call the mobile web milestone done.

## Release acceptance checklist

- [ ] Touch controls obey Auto / On / Off and the session query override.
- [ ] Keyboard behavior has no known regression.
- [ ] Every documented gameplay action is reachable through touch.
- [ ] Every modal/menu flow can be completed and exited through touch.
- [ ] Simultaneous move plus jump/attack/cast works reliably.
- [ ] Pointer cancellation and interruption never leave an action held.
- [ ] Portrait mode gates and pauses gameplay; returning to landscape is safe.
- [ ] Safe areas and browser chrome do not obscure essential controls.
- [ ] Browser scrolling, zooming, selection, and context menus do not interrupt
      play on the game surface.
- [ ] Keyboard-only copy is replaced by input-aware or neutral instructions.
- [ ] Audio starts/resumes after an allowed gesture on tested iOS and Android.
- [ ] Saving reports failures honestly and survives a normal browser restart.
- [ ] Mid-range target meets the agreed frame-rate and thermal expectations.
- [ ] A 20-minute session shows no progressive memory or performance failure.
- [ ] Automated tests and production build pass.
- [ ] The manual device matrix is recorded with browser/OS versions and result.

## Estimate

Assuming no redesign of the 960 x 540 game and no native-store packaging:

- Input foundation and keyboard migration: 1-2 days.
- Touch gameplay MVP: 2-3 days.
- Menus, lifecycle, orientation, safe areas, and copy: 2-3 days.
- Performance profiling, device fixes, and release QA: 3-5 days.

A basic touch-playable build is approximately 3-5 development days. A
comfortable tested mobile-web release is approximately 1-2 weeks, depending
mostly on real-device findings. Native Android/iOS packaging is a separate
milestone.

## Known risks

- Full-screen lighting render textures may be the dominant mobile GPU cost.
- The existing HUD plus two-thumb controls may require iteration to avoid
  obscuring play on small landscape screens.
- iOS browser audio and page-lifecycle rules require real-device testing.
- Browser synthetic touch tests cannot prove multi-touch ergonomics.
- Direct keyboard assumptions may exist outside the obvious dungeon input
  methods and must be found during M1.
- A forced high render scale can invalidate performance results; QA reports
  must record query parameters and framebuffer size.

## Definition of the first deliverable

The first implementation PR should contain **Phase M1 only**: shared semantic
actions, keyboard parity, tests, and no visible mobile controller. Separating
the input refactor from the touch UI makes regressions attributable and gives
the mobile overlay a stable interface to target.
