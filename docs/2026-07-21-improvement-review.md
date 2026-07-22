# Shadowdork — Cross-Cutting Improvement Review (2026-07-21)

## How this doc fits with everything else

This project already has an unusually complete paper trail: `phase2_todo.md`,
`docs/scope-of-works.md`, `docs/mobile-playability-plan.md` (→ `fixes.md`),
`docs/audio-plan.md`, `docs/game-improvement-plan.md`, and six more `docs/*.md`
design/status files. Most of that work has since shipped — this review does
not repeat it. It cross-checks the current source against those documents,
throws out what's stale, and answers four specific questions the user asked:

1. What improves **playability**?
2. What makes the code **more effective without reducing functionality**?
3. What makes the code **more effective and improves visuals**?
4. What makes the code **more effective and improves audio**?

**Snapshot (verified today):** 26,048 lines of `src/`, 836 tests across 56
files all green, `tsc --noEmit` clean, production build clean, no ESLint
config, no TODO/FIXME left in source. The engine/data/game split described in
`README.md` is real and holding — the game layer still never rolls dice or
mutates rules state directly.

---

## 1. Playability

The rules-engine depth is real (per-tier magic, encounter reactions, mishap
tables with a luck save, nonlinear dungeons, Focus spells, five alternate
classes). The gaps are the same shape as the ones `phase2_todo.md` already
tracks as unchecked — this section ranks them by *player-felt* impact rather
than implementation order:

1. **Treasure is still cosmetic.** `progression.ts` hands out the same fixed
   cycle (`Starfall Blade`, `Aegis Mail`, gold, spell) on every vault descent
   instead of rolling the registered core/Cursed-Scroll treasure tables
   (`phase2_todo.md` P2-1, unchecked). This is the single biggest replay-value
   gap: two runs currently converge on identical gear regardless of what the
   player actually found. Highest ratio of player-felt impact to engineering
   cost, because the tables and roll machinery already exist — this is a
   wiring task, not a design task.
2. **Monsters have no identity.** P2-9 is entirely unchecked: every monster
   family still resolves to move-and-attack (`MonsterSprite.ts` has patrol/
   aggro/morale/flee state, but no per-family verb — no web, poison, engulf,
   or light-avoidance). This is what makes encounters "damage sources" instead
   of "inhabitants," and it's the biggest lever on combat feel specifically.
3. **Resting is free relative to danger.** P2-10 shipped the per-character
   ration cost but not the campfire/torch-cost/interruption/watch loop, so the
   "push on or make camp?" tension the design doc wants isn't live yet.
4. **Stealth/surprise doesn't exist** (P2-3's own scoping note says every
   encounter currently "arrives already hunting"). Given `temp.md`'s explicit
   design target (Lost Vikings/Keen: puzzle-first, low-twitch, forgiving), a
   hide/detect layer is worth more here than more combat content — it's a new
   *kind* of decision, not another stat check.
5. **A real, low-cost win already exists in the codebase and isn't visible to
   players:** `COYOTE_MS`/`JUMP_BUFFER_MS` in `CharacterSprite.ts` show the
   forgiving-platforming design intent (`temp.md`) is already implemented —
   but nothing else on that list (ledge-grab/mantle, a short rewind) is. If
   the goal is "not twitch, forgiving," a 5-10s state rewind is the highest-
   leverage single addition per `temp.md`'s own analysis, and pairs naturally
   with the existing autosave/mode-controller architecture.
6. **A latent correctness bug can silently produce an unbeatable layout.**
   `generate.ts`'s Tier-3 redundant-edge trimming (flagged in
   `commit_review.md`, still present) closes edges to cap room degree at 3
   using a running degree count, not a live reachability check — sequential
   trims from the same set can disconnect a room. `generate.test.ts` fuzzes
   1000+ seeds per topology and currently passes, so no released topology has
   hit it yet, but it's not proven, only unobserved. This is the one item in
   this list that's a bug rather than a missing feature — see §2 and the
   implemented slice below.

**Not recommended right now:** Oaths/Patron Bargains (P2-7) and enduring
wounds (P2-11) are well-designed but are net-new campaign systems, not fixes —
they compete with #1/#2 above for the same "make existing content matter more"
goal at higher implementation cost.

## 2. Code effectiveness (no functionality change)

- **No lint configuration exists.** `package.json` has `dev`/`build`/
  `preview`/`test` only. `tsc` catches type errors but not dead code, unused
  exports, or accidental `any`-widening. Cheap and additive.
- **A stray, fully-merged git worktree doubles every test run.**
  `.claude/worktrees/modest-goldstine-22da26` (branch
  `claude/modest-goldstine-22da26`, tip `68c7f06`) is an ancestor of `main` —
  fully merged, leftover from a prior session. `npm test` currently discovers
  56 test files instead of 28 because Vitest's default glob walks into it.
  Free removal, no functionality touched.
- **`Dungeon.ts` is 4,381 lines and `Hud.ts` is 1,447** — `fixes.md` already
  flagged this and recommended a *surgical* split (input coordinator, overlay
  controller, touch HUD, lifecycle coordinator) rather than a rewrite. Still
  correct advice, still not done. Out of scope for this pass — too large to
  do safely without a dedicated session, flagging so it isn't lost again.
- **The `generate.ts` edge-trimming bug (see §1.6) is also a code-quality
  defect**, not just a design one: it mutates shared degree state across a
  loop with no invariant check. Fixing it is this pass's demonstration slice.
- Everything `commit_review.md` flagged as *already fixed* was verified fixed
  today: the HUD map-visibility bug, and the dead legacy rescue-tile parsing
  branches are gone from `Dungeon.ts`. One item from that review is still
  open: NPC-triggered connector opens (`openNpcTargetConnector`) mutate scene
  state with no sound — see §4.

## 3. Visuals

`docs/biome-art-kit-status.md` (audited 2026-07-19, re-verified today) is the
single most concrete, already-scoped visual gap in the repo: **15 of 18
Cursed Scroll biome skins have a dedicated procedural art kit; 3 fall back to
generic legacy masonry** — `dverg-forges` (Midnight Sun), `subterranean-sea-fort`
(Dwellers in the Deep), and `hidden-face-temple` (City of Masks). A player who
picks Midnight Sun and rolls `dverg-forges` currently gets the same brick as
every other unskinned biome, despite the scroll's own progression system
(`biome-choice-progression-plan.md`) now routing players into that choice
deliberately. The fix is additive (a new generator function following the
~15 existing examples' exact texture contract) and can't regress the other 15
kits. This is this pass's visual slice — `dverg-forges` first, since its
motifs (anvils, ducts, slag, forge glow) reuse primitives already built for
`iron-fortress`/`burning-mines`.

Secondary, lower-priority visual notes (not implemented this pass):
- Decoration slot keys (`gong`/`rack`/`banner`/`crenel`) are iron-fortress-era
  names reused across unrelated biomes — cosmetic naming debt, zero player-
  facing effect, fine to defer.
- The shadow-cast system (`shadow-cast-system` project memory) is explicitly
  "deliberately iterative" per the user — left alone; not this pass's call to
  retune.

## 4. Audio

Audio is the most mature system in the codebase: `docs/audio-plan.md`
checkpoints 1–6 are all done (procedural SFX, ambience beds, spatialization,
wordless narrative voice, a real mix bus with saturation/shelving/compression/
reverb send), and `audio_improvements.md`'s armor-aware footsteps + drone LFO
are live. There isn't a large gap left — the one concrete, still-open item is
narrow and precise:

- **NPC-triggered path reveals are silent.** `commit_review.md` flagged this
  and it's still true: `openNpcTargetConnector` in `Dungeon.ts` mutates
  connector state and destroys physical blockers exactly like a manually
  heaved portcullis, but only the manual path calls `sfx.doorThump()`. A
  player who gets a `reveal-route`/`revelation` NPC outcome sees a wall
  vanish with no auditory confirmation. Small, bounded, matches an existing
  call pattern — this pass's audio slice.

No other audio gap rose to "worth doing now" — the mix, spatialization, and
foley variety are already ahead of where the design docs originally scoped
them for this phase.

---

## First slice (implemented on `test/improvement-pass-1`)

One bounded, verifiable item per question, chosen for being real, currently
open, and safe to land without a design-approval gate:

| # | Area | Change | File(s) |
|---|---|---|---|
| 1 | Playability + code | Dynamic reachability check before each Tier-3 edge trim, replacing the running-degree-only heuristic | `src/game/level/generate.ts` |
| 2 | Code effectiveness | Remove the stale merged worktree doubling test runs | `.claude/worktrees/modest-goldstine-22da26` |
| 3 | Visuals | New `dverg-forges` biome art kit (full texture contract) | `src/game/visual/textures/materials.ts` |
| 4 | Audio | `sfx.doorThump()` on NPC-triggered connector opens | `src/game/scenes/Dungeon.ts` |

Explicitly deferred (named above, not silently dropped): treasure-table
wiring, monster identity, camp/rest risk, stealth/surprise, rewind, the
`Dungeon.ts`/`Hud.ts` split, ESLint adoption, and the remaining two biome
kits. Each is a legitimate next slice on its own branch once this one lands.

### Verification plan
- `npm test` (expect 28 files / same pass count once the stray worktree is
  gone — confirms the cleanup didn't lose coverage).
- `npm run build` (`tsc --noEmit && vite build`).
- Targeted fuzz: `generate.test.ts`'s existing 1000+-seed sweep per topology
  must still pass after the reachability-check change (it's the regression
  net for that fix — no new test needed, the existing one is exactly the
  right shape).
- Browser check: confirm `dverg-forges` renders its own kit instead of
  generic masonry at a fixed seed, and that an NPC `reveal-route` outcome now
  plays a door-thump.
