# Procedural Audio Plan — sound from primitives

Implements the ideas in [sound on the fly from primiati.md](../sound%20on%20the%20fly%20from%20primiati.md)
for this stack: Phaser 3 + TypeScript + Vite, running in the browser. The Web Audio API replaces the
doc's Unity/Godot/Faust buffer-filling: noise, filters, LFOs, FM, envelopes, and panning are all
native `AudioNode` primitives, so no per-sample synthesis loop and **no AudioWorklet** is needed for
anything in scope.

**Principles**

- Zero new dependencies, zero audio assets. Every sound is math.
- Every one-shot jitters its parameters per call (pitch, decay, ratio) so no two fires are identical.
- Audio randomness uses `Math.random()`, never the engine's seeded dice — sound is cosmetic and must
  not perturb rules-determinism (same reason vfx uses `Phaser.Math.Between`).
- No fallbacks: if the browser lacks `AudioContext`, throw. If a node graph can't be built, throw.
- Same ownership contract as [vfx.ts](../src/game/fx/vfx.ts): one-shots clean themselves up
  (`onended` → disconnect); persistent sounds return a handle the caller must `.destroy()`.

---

## Architecture — `src/game/audio/`

### `context.ts` — the plumbing singleton

```ts
export function audioCtx(): AudioContext;        // lazy singleton; throws if unavailable
export function masterGain(): GainNode;          // audioCtx → masterGain → destination
export function setMuted(muted: boolean): void;  // ramps masterGain to 0 / back over ~30ms
export function isMuted(): boolean;
export function installUnlock(game: Phaser.Game): void; // see below
```

- Browsers create `AudioContext` in `suspended` state until a user gesture. `installUnlock`
  registers one-time `pointerdown`/`keydown` listeners on `window` that call `ctx.resume()` and
  deregister themselves.
- Also listens to `visibilitychange` and re-resumes on return — pairs with the known hidden-tab
  Phaser freeze (see memory note: pump `game.step` when the tab is hidden during automated tests).
- Master gain default ~0.5; individual sounds mix at their own levels beneath it.

### `noise.ts` — pure generators + cached buffers

Pure functions (unit-testable, no Web Audio types):

```ts
export function whiteNoise(length: number): Float32Array;   // uniform [-1, 1)
export function pinkNoise(length: number): Float32Array;    // Voss–McCartney, ~-3dB/oct
export function brownNoise(length: number): Float32Array;   // integrated white, normalized, ~-6dB/oct
```

Buffer cache (Web Audio side):

```ts
export function noiseBuffer(kind: "white" | "pink" | "brown"): AudioBuffer; // 2s, cached
export function noiseSource(kind, { loop }): AudioBufferSourceNode;
// loop: true → starts at a random offset so concurrent layers never phase-lock
```

### `sfx.ts` — one-shot foley

Every function: builds a small node graph on `audioCtx()`, schedules envelopes with
`setValueAtTime`/`exponentialRampToValueAtTime`, starts, and self-destructs via `onended`.
All take an optional `{ gain?, pan? }` so spatialization (checkpoint 4) can wrap them.

| Export | Recipe (doc §) | Parameters (± jitter) |
|---|---|---|
| `swordClang()` | FM synthesis (§3) | carrier 520 Hz ±15%, mod ratio 1.414 ±0.05, index 8→0 over τ≈80ms, amp decay τ≈250ms ±20% |
| `swordCrit()` | `swordClang` + second inharmonic partial (ratio ~2.76), longer decay τ≈450ms, +pitch | brighter, ringing |
| `thud()` (monster hit / blunt) | damped sine + noise (§3 footstep, scaled up) | 90 Hz ±20% sine τ≈120ms + 60ms pink burst |
| `whoosh()` (miss) | bandpassed white noise, center freq sweeps 400→1200 Hz | 120ms, gain envelope up-down |
| `footstep()` | pink burst + heel thud (§3) | burst 40–80ms random, 60 Hz sine τ≈50ms, quiet |
| `waterPlink()` | sine, pitch chirp + exp decay (§2) | f 800→1100 Hz ±30%, τ=0.05s |
| `splash()` (torch in water) | white noise → lowpass 900 Hz, fast attack slow decay | 400ms + 2–3 trailing `waterPlink`s |
| `pickupChime(jewel)` | 2-partial additive sine (1 : 2.01), exp decay | jewel: higher base + third partial |
| `spikeTrap()` | metallic FM stab: high index, ratio 3.7, very short | τ≈60ms, then 200 Hz thud |
| `doorThump()` | brown burst + 70 Hz damped sine | heavy, τ≈300ms |
| `torchIgnite()` | 150ms white noise → lowpass sweep 3000→600 Hz ("fwoosh") | |
| `spellCast()` | sine arpeggio: 3 quick partials rising, slight detune shimmer | base 300 Hz ±20% |
| `spellMishap()` | descending FM sweep, ratio drifts during playback | "wrong" feeling, τ≈600ms |
| `levelUp()` | rising 4-note additive fanfare (perfect fourth steps) | fixed, celebratory |
| `deathKnell(undead)` | low FM bell, ratio 1.414, long τ≈900ms | undead: dissonant ratio 1.93, dry rattle layer |
| `crunch()` (weak wall) | brown burst + a few Poisson crackle pops over 200ms | |

### `ambience.ts` — persistent beds

```ts
export interface AmbienceHandle { setLevel(v: number): void; destroy(): void; }

export function windBed(opts?): AmbienceHandle;
// looped white noise → lowpass; LFO (osc 0.13 Hz → gain 800 → filter.frequency, base 1200 Hz)
// == the doc's f_c(t) = 1200 + 800·sin(2π·f_LFO·t), as a node graph (§2 whispering sand)

export function lavaBed(opts?): AmbienceHandle;
// looped brown noise rumble (lowpass 200 Hz) + Poisson pop scheduler:
// every draw (exp-distributed interval, mean ~700ms) inject a 10ms highpassed white burst (§2)

export function dripBed(opts?): AmbienceHandle;
// Poisson-scheduled waterPlink()s, mean interval ~4s, randomized pitch/pan

export function crackleBed(opts?): AmbienceHandle;
// quiet lavaBed variant for the carried torch: smaller rumble, mean pop interval ~1.2s
```

Poisson scheduling runs on `setTimeout` with exponentially distributed delays
(`-mean * Math.log(1 - Math.random())`), clamped to a sane minimum; `destroy()` cancels timers and
ramps gain to 0 before disconnecting (no click).

**Theme → bed mix** (keyed by `DungeonTheme.backdrop`, [dungeons.ts:153](../src/game/level/dungeons.ts:153)):

| backdrop | beds |
|---|---|
| `greek-temple` | wind (medium) |
| `aztec` | wind (low) + drip (sparse) |
| `natural-caverns` | drip (dense) + wind (very low) |
| `eldritch-depths` | wind lowpassed extra dark + slow detuned drone (two sines 55/55.7 Hz beating) |

### `spatial.ts` — panning + distance muffling

```ts
export interface SpatialOpts { x: number; y: number; }
export function spatialize(node: AudioNode, source: SpatialOpts, listener: SpatialOpts): AudioNode;
// wraps: node → lowpass(fc by distance) → gain(by distance) → StereoPanner(by dx) → out
```

- Pan: `clamp(dx / (GAME_W/2), -1, 1) * 0.8`.
- Gain: inverse-ish falloff, full within 3 tiles, floor at 0.15 by ~20 tiles.
- Muffling per the doc (§4): lowpass cutoff 18 kHz at 0 distance → ~800 Hz at max, instead of
  volume-only attenuation.
- One-shots take listener position at fire time (they're < 1s; no tracking needed). Only persistent
  positional emitters (braziers/campfires) need per-frame `update()` — a small
  `SpatialEmitter` class with `setListener(x, y)` ticked from `DungeonScene.update`.
- Listener = party leader sprite.

---

## Integration map (exact hook points)

| Sound | Where |
|---|---|
| `installUnlock` | [main.ts](../src/game/main.ts) after `new Phaser.Game` |
| M = mute toggle | `setupInput` + `update` in [Dungeon.ts:532](../src/game/scenes/Dungeon.ts:532) (M is unused); update controls doc |
| sword clang / crit / miss whoosh | player attack resolution, [combat.ts:194–213](../src/game/systems/combat.ts:194) beside `hitBurst`/`floatText` |
| thud (monster hits player) | [combat.ts:242–254](../src/game/systems/combat.ts:242) |
| footsteps | `CharacterSprite.tick` walk branch, [CharacterSprite.ts:164](../src/game/entities/CharacterSprite.ts:164) — distance accumulator, fire every ~0.7 tiles; leader only |
| landing thud / fall crunch | `trackFalling`, [CharacterSprite.ts:184](../src/game/entities/CharacterSprite.ts:184) |
| pickup chime | collect branch, [Dungeon.ts:1170](../src/game/scenes/Dungeon.ts:1170) beside `sparkleBurst` |
| spike trap | trap damage in [traps.ts](../src/game/systems/traps.ts) (`floatText -damage` sites) |
| torch ignite / splash | `lightTorch` / water-snuff, [Dungeon.ts:829–881](../src/game/scenes/Dungeon.ts:829) |
| weak wall crunch | "CRUNCH" floatText, [Dungeon.ts:819](../src/game/scenes/Dungeon.ts:819) |
| spell cast / mishap | [spells.ts:44–64](../src/game/systems/spells.ts:44) |
| death knell, level up | slain/LEVEL sites, [Dungeon.ts:1081](../src/game/scenes/Dungeon.ts:1081), [Dungeon.ts:1265](../src/game/scenes/Dungeon.ts:1265) |
| ambience start/stop | `DungeonScene.create` (after theme known) + scene `shutdown` event |
| torch crackle | tie to `torchLit` lifecycle in `CharacterSprite.tick` (same pattern as `flameFollowing`) |
| brazier/campfire crackle | `flameAt` call sites, [Dungeon.ts:434](../src/game/scenes/Dungeon.ts:434), [Dungeon.ts:463](../src/game/scenes/Dungeon.ts:463), as `SpatialEmitter`s |

Engine-event alternative: `EventLog.onEvent` ([events.ts:23](../src/engine/events.ts:23)) could drive
combat sounds, but events lack x/y coordinates and the scene call sites are already where the vfx
fire — so we wire sounds beside vfx calls and keep the event log out of it.

---

## Checkpoints

Each checkpoint ends with: `npm run build` clean (tsc + vite), `npm test` green, and a browser
verification. Browser note (from project memory): a hidden preview tab freezes Phaser's loop —
pump `window.__game.step(...)` or keep the tab fronted; screenshot via `/__shot`. Audio can't be
"heard" by tooling, so programmatic proof = temporarily attach an `AnalyserNode` to `masterGain()`
via console eval, fire a sound, assert RMS > 0 and `audioCtx().state === "running"`; final signoff
on each checkpoint is the user listening.

### Checkpoint 1 — Core plumbing + proof-of-life clang
1. `context.ts` (singleton, unlock, mute, master gain).
2. `noise.ts` pure generators + buffer cache.
3. `tests/audio.test.ts`: white noise in range/zero-mean-ish; pink & brown spectral slope sanity
   (compare band energy via simple DFT on 2048 samples: brown low-band ≫ high-band, pink between
   white and brown); determinism NOT expected (assert two calls differ).
4. `sfx.ts` with `swordClang()` only; wire into player hit at combat.ts:213 + `installUnlock` in main.ts.
5. M mute toggle + `ctx.say` feedback; update the controls doc/pause screen.

**Verify:** build+tests; in browser: attack a monster → clang, analyser RMS > 0, ten swings sound
audibly non-identical, M silences.

### Checkpoint 2 — Full foley set
1. Remaining `sfx.ts` exports (table above).
2. Wire all integration-map one-shot rows.
3. Per-sound level pass so nothing dominates (footsteps quiet, level-up loud).

**Verify:** build+tests; scripted browser run: walk (footsteps), attack (clang/whoosh/crit), get hit
(thud), collect coin (chime), light torch (fwoosh), trigger trap (stab), kill monster (knell).
Confirm no console errors and no node leak (`audioCtx` destination channel count stable; play 50
rapid sounds, check no accumulating lag).

### Checkpoint 3 — Ambience beds
1. `ambience.ts`: windBed, lavaBed, dripBed, crackleBed + Poisson scheduler helper.
2. Theme mix table; start in `DungeonScene.create`, destroy on scene `shutdown`/restart.
3. Torch crackle follows `torchLit`; brazier/campfire crackle at `flameAt` sites (non-spatial for now).
4. Mix levels: beds sit well under foley.

**Verify:** build+tests (Poisson interval distribution test: mean within 20% over 1000 draws);
browser: each of the 4 dungeons has a distinct bed; scene restart doesn't stack beds
(RMS stable across 3 restarts); torch out → crackle stops.

### Checkpoint 4 — Spatialization
1. `spatial.ts` + `SpatialEmitter`; tick listener from `DungeonScene.update`.
2. Positional one-shots (monster-side sounds, traps, pickups by others) take pan/gain/muffle from
   listener at fire time; brazier/campfire emitters update per frame.
3. Non-positional sounds (UI-ish: level up, own footsteps) stay center.

**Verify:** build+tests (pure math: pan/gain/cutoff curves at 0, mid, max distance); browser: stand
left of a brazier → sound biased right; walk away → quieter *and* duller. Console-eval assertion:
`panner.pan.value` sign matches dx.

### Checkpoint 5 — Narrative voice (decision gate, not scheduled)
The doc's §1 (Kokoro / Qwen3-TTS) needs a real decision before any work:
- **(a) kokoro-js in-browser** — ~80 MB model download, WebGPU/WASM inference; real narration, heavy.
- **(b) Offline pre-generation** — run a local TTS once, ship selected lines as static assets;
  contradicts "no assets" but cheap at runtime.
- **(c) Skip** — the `ctx.say` text log already narrates.

Recommendation: (c) for now; revisit after 1–4 land. No implementation until the user picks.

---

## Risks / notes

- **Autoplay policy**: nothing sounds until first input — acceptable (game needs a keypress anyway);
  unlock listens for both pointer and key.
- **Node lifetime**: every one-shot must disconnect in `onended` or long sessions leak; checkpoint 2
  explicitly verifies.
- **`exponentialRampToValueAtTime` can't reach 0** — ramp to 0.0001 then `setValueAtTime(0)`.
- **Scene restart** (`this.scene.restart()` on death/new dungeon): ambience handles must be destroyed
  on `Phaser.Scenes.Events.SHUTDOWN`, not just scene destroy.
- **Performance**: worst case ≈ 4 bed layers + torch crackle + a few one-shots ≈ tens of nodes —
  trivial for Web Audio. No worklet, no main-thread DSP at runtime (noise buffers built once).
