# Mobile-readiness cleanup

The repository is healthy at the rules and build level, but it is not yet
mobile-ready. The existing [mobile plan](docs/mobile-playability-plan.md) is a
strong foundation; the following cleanup should happen before or alongside the
visible touch controller.

## Must fix first

| Priority | Cleanup | Why |
| --- | --- | --- |
| P0 | Semantic input service | `DungeonScene` directly owns keyboard keys throughout movement, combat, menus, and overlays. Touch should feed named actions with multi-source ownership and cancellation. |
| P0 | Unified modal and pause state | Briefing, pause, stats, gear, victory, backgrounding, and orientation currently use several interacting booleans. A central mode/input-scope controller should pause physics and time, release held input, and control which UI accepts input. |
| P0 | Correct mobile framebuffer policy | `display.ts` derives resolution from the physical screen and permits scale 4. In an 844 x 390 test, a roughly 694 x 390 CSS canvas allocated a 3840 x 2160 framebuffer. |
| P0 | Make every flow touch-complete | Touch can start a new game, but the next briefing requires a keyboard. Stats, inventory, pause resume, victory, and biome selection are also keyboard-only. |

## 1. Introduce `ActionInput`

Implement `held`, `pressed`, `released`, `releaseSource`, and `releaseAll`, with
source IDs so two fingers or keyboard plus touch can own the same action
independently.

Migrate these first:

- Start and briefing dismissal.
- Movement, climbing, ledges, jump, and brace.
- Attack, cast, cycle spell, interact, torch, and luck.
- Party selection and follower mode.
- Pause, stats, gear, and rest.
- Menu navigation and victory/descent.

Add keyboard-parity tests before adding touch presentation. Do not synthesize
keyboard events from touch.

## 2. Centralize gameplay modes

Replace the scattered state handling in `DungeonScene` with something like:

```ts
type GameMode =
  | "briefing"
  | "playing"
  | "paused"
  | "stats"
  | "gear"
  | "victory"
  | "gameover"
  | "orientation-blocked"
  | "backgrounded";
```

Every mode transition should consistently:

- Release held actions.
- Pause or resume physics, animation, and engine time.
- Show one input-owning overlay.
- Suspend or resume appropriate audio.
- Prevent world touches from leaking through the UI.

This will make touch cancellation and app-switch handling substantially safer.

## 3. Fix resolution and production debug settings

Immediate performance cleanup:

- Base render scale on the fitted canvas or viewport rather than
  `window.screen`, and cap automatic mobile scale at 2.
- Make `preserveDrawingBuffer` in `src/game/main.ts` development or
  screenshot-only.
- Gate `window.__game` and `window.__audio` debug handles behind
  `import.meta.env.DEV`.

The two full-screen lighting textures in `src/game/systems/light.ts` are
cleared and redrawn every frame. At render scale 4, the two RGBA textures plus
the backbuffer alone can approach roughly 95 MB before other GPU allocations.
Profile:

- Scale 1 and scale 2 quality levels.
- Half-resolution lighting.
- Lighting updates every second frame.
- Optional tint-layer and shadow reduction.
- Particle-density controls.

## 4. Finish the browser shell and lifecycle

Update `index.html` with:

- `viewport-fit=cover`.
- `100dvh` plus a fallback.
- Safe-area inset handling.
- `touch-action: none` on the game surface.
- `overscroll-behavior: none`.
- Selection and context-menu suppression only inside the game.
- A landscape orientation gate.
- An optional fullscreen control.

The current audio listener attempts to resume on visibility restoration, but
there is no complete gameplay lifecycle policy. On blur, hidden, pagehide, or
portrait gating:

- Release all inputs.
- Auto-pause.
- Stop engine time from advancing.
- Quiet or suspend audio.
- Synchronously autosave if safe.
- Require a deliberate resume tap.

## UI cleanup needed before shipping

The fixed 960 x 540 UI becomes very small on phones. At 844 x 390, the
logical-to-CSS scale was about 0.72, so a nominal 48-logical-pixel button is
only about 35 CSS pixels. To reach 48 CSS pixels, touch controls need to be
roughly 67 logical pixels at that viewport, or use a DOM overlay measured
directly in CSS pixels.

Also address:

- Explicit Start, Resume, Close, Back, Equip, Drop, Rest, Descend, and
  destination-card buttons.
- Larger invisible hit rectangles instead of text-bound hit areas.
- Pressed and disabled states that do not rely only on color or hover.
- Replace blocking `alert()` and `confirm()` flows with in-game modals.
- Replace hard-coded key copy with input-family-aware labels.

## Structural cleanup worth doing alongside mobile

- Split the 3,000-plus-line `DungeonScene` and 1,000-plus-line `HudScene`
  surgically into an input coordinator, overlay controller, touch HUD, and
  lifecycle coordinator. Avoid a wholesale scene rewrite.
- Add real save migrations. `SaveRepository` remains schema version 1 despite
  evolving state and uses shallow `any`-based validation.
- Store mobile preferences separately from run saves.
- Add browser-level tests. CI currently runs unit tests and the production
  build, but no browser or touch flows.
- Clean the duplicated README gameplay section.
- Stay on Phaser 3 during this work; combining a Phaser 4 migration with mobile
  input would multiply regression risk.
- Add PWA manifest, service worker, and offline policy only after mobile web
  gameplay is stable.

## Recommended PR sequence

1. Production render/debug cleanup and viewport shell.
2. `ActionInput` with keyboard parity and unit tests.
3. Unified gameplay-mode and lifecycle coordinator.
4. Touch controller and touch-complete overlays.
5. Real-device performance profiling and quality settings.
6. Browser smoke tests and device matrix.
7. Optional PWA installation and offline support.

## Release gate

- A complete run can be started, played, saved, resumed, and finished using
  touch alone.
- Simultaneous move plus jump, attack, or cast works without stuck actions.
- Rotation, app switching, screen locking, and browser backgrounding cannot
  advance gameplay time or leave an action held.
- Safe areas and browser chrome do not obscure essential UI.
- Controls remain readable and meet touch-target requirements on the minimum
  supported landscape viewport.
- Audio reliably starts and resumes after an allowed gesture.
- Saving reports failures honestly and survives a normal browser restart.
- Mid-range target devices meet the agreed frame-rate and thermal targets.
- A 20-minute session shows no progressive memory or performance degradation.
- Unit tests, browser smoke tests, and the production build pass in CI.

## Current health

- TypeScript typechecking passes.
- All 320 current tests pass.
- `npm audit --omit=dev` reports zero vulnerabilities.
- The production build passes.
