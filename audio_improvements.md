# Upgrade Procedural Footsteps & Modulate Background Ambience

> **Status (2026-07-19): IMPLEMENTED.** Armor-aware footsteps + drone LFO swell
> are live. Decision: **leader-only heavy** — only the party leader gets the full
> plate/mail foley (`footstep({ full: true, armor })`); followers use the light
> recipe so a marching party stays clean. `armor` is a dedicated `FootstepOpts`
> field (not on the shared `SfxOpts`). Persistent ambience sources now stop after
> fade-out, Feather Fall has a soft landing cue, and each character has a saved
> low/medium/high voice register shown in stats. Manual listening signoff remains.

This plan upgrades the footstep synthesis to reflect armor types (specifically a heavy platemail boot crunching rubble) and implements dynamic modulation of the low-frequency background ambience so that the deep "thundering" drone comes and goes over time. Sound effects will feature longer, lingering decay tails that naturally overlap to create a dense, cinematic acoustic landscape.

## User Review Required

> [!IMPORTANT]
> The background low-frequency drone (formerly a constant sub-bass hum) will now be modulated by a very slow Low-Frequency Oscillator (LFO), causing the deep thundering atmosphere to rise and fade over a ~80-second period.
> 
> Foley sounds (especially platemail footsteps and rubble crunches) will have extended decay envelopes ($\tau \approx 0.08\text{s} - 0.25\text{s}$) and a dedicated reverb send, allowing the metallic ring and settling stones to taper off gradually and overlap.

## Proposed Changes

---

### Procedural Audio SFX

#### [MODIFY] [sfx.ts](file:///D:/Code/shadowdork/src/game/audio/sfx.ts)
- Update `footstep` to accept the character's `WornArmorVisual` (or pass it through options).
- Implement distinct procedural synthesis pathways for each armor type:
  - **`plate` (Heavy Platemail Boot on Stone/Rubble)**:
    - *Sub & Bass Impact*: A low 50Hz heel thud (sine partial with $\tau_d = 0.08$s) layered with a hard-driven sub-bass layer at 38Hz ($\tau_d = 0.12$s) to convey heavy weight.
    - *Stone/Rubble Crunch & Settle*: A brown noise burst (0.28s duration, lowpassed at 450Hz, with a slow exponential decay) simulating sliding gravel settling underfoot, layered with 4–5 tiny, high-passed white noise bursts (5–12ms, highpassed at 4kHz) staggered at random millisecond offsets up to 150ms to simulate rock pieces fracturing.
    - *Armor Jangle & Ring*: Two high-passed, metallic FM clinks ($f_c \approx 1800$Hz and $f_c \approx 850$Hz, inharmonic modulator ratio, $\tau_d = 0.06$s) with a wet reverb send (0.15) to let the steel rings and plate segments ring, taper off, and overlap with subsequent steps.
  - **`chain` / `mithral` (Chainmail Jangle)**:
    - Moderate bass thud (60Hz sine, 45Hz sub, $\tau_d = 0.06$s).
    - Pink noise contact burst (0.12s).
    - An array of 3–5 rapid, high-passed sine partials (1200Hz–2500Hz, $\tau \approx 0.02$s) with a light reverb send (0.08).
  - **`leather` / `unarmored` (Soft Boot/Barefoot)**:
    - The existing light footstep: pink noise burst (lowpass 1100Hz, 0.08s) and a subtle 60Hz thud (no heavy sub or metal clicks).

---

### Modulated Background Ambience

#### [MODIFY] [ambience.ts](file:///D:/Code/shadowdork/src/game/audio/ambience.ts)
- In `droneBed`, introduce a slow LFO (e.g., $0.012$ Hz, representing a ~83-second cycle) to modulate the gain of the low oscillators.
- This will cause the deep background "thundering" wrongness drone to slowly swell up, fill the room with bass, and then fade down to near-silence, ensuring it comes and goes instead of fatigue-inducing constant noise.

---

### Character Representation & Audio Triggering

#### [MODIFY] [CharacterSprite.ts](file:///D:/Code/shadowdork/src/game/entities/CharacterSprite.ts)
- Query the character's worn armor visual (`this.character.wornArmor?.armorVisual ?? "unarmored"`) in the walk/step trigger block.
- Pass the armor type to the `footstep` call: `footstep({ gain: this.isLeader ? 1 : 0.3, armor: armorVisual })`.

---

## Verification Plan

### Automated Tests
- Run `npm test` or `npx vitest tests/audio.test.ts` to ensure that:
  - Footstep synthesis with different armor configurations executes without exceptions.
  - Ambience beds initialize and destroy without leaving uncleaned Web Audio nodes or running timers.

### Manual Verification
- Run the game and listen to the background ambience in the *Eldritch Depths* backdrop. Verify that the sub-bass thundering drone slowly swells and recedes over time.
- Walk with different characters to confirm the footstep sounds are distinct, heavy, and overlap naturally when walking continuously.
