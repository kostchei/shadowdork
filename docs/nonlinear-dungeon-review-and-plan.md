# Nonlinear Dungeon — Review & Remediation Plan

Review of commits `311b294`/`839d681` (*directional connectors and room variance*) and
`11b8d43` (*nonlinear dungeon milestones*), with a prioritized, checkpointed plan to
address the findings. This consolidates three inputs: the original code review, the
`commit_review.md` opinion, and a second reviewer's list — each finding verified against
the code and given a verdict.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done.

---

## 1. Work completed in the two commits

**`839d681` (merge of `311b294`)** shipped the bulk of the nonlinear system:

- Topology catalog + grid embedding (`topology.ts`, `embedding.ts`).
- Abstract→physical pipeline (`generate.ts`, `expand.ts`, `geometry.ts`, `model.ts`).
- Connector states: locked / switched / secret / one-way / guarded, with runtime gates,
  weak walls, and traversal enforcement (`Dungeon.ts`).
- Acoustic alert propagation + monster aggro retention (`alertedUntil`).
- Deterministic room templates with resource "pressures" (`templates.ts`).
- State-aware BFS completion validator (`physical.ts`).
- ~880 lines of new tests.

**`11b8d43`** completed the milestone set:

| Area | Change |
|------|--------|
| Topology | 9 Tier-2 forms + Tier-3 `kite` (K4 + tail via an explicit junction) |
| Embedding | Canonical placements; `junctionCells` + `viaJunction` shared-filler routing |
| NPCs | 4 new outcomes: `trade`, `betrayal`, `revelation`, `companion-eligible` + handlers |
| Generation | Tier-3 degree capping (demote redundant edges to secret, cap open degree ≤ 3) |
| HUD | `discoveredRoomIds` tracking + 5×4 `compactMap`, persisted in the save slot |
| Validation | Diagnostics for room content, pressures, NPC tile/metadata, junction integrity |

Determinism is preserved (separate RNG streams), the save schema is version-guarded, and
every form has a crossing-free embedding test. `tsc --noEmit` is clean and all 240 tests
pass — but the suite covers metadata generation, not scene resolution → persisted state,
which is where the defects below hide.

---

## 2. Findings (verified, prioritized)

### A. Kite shared-arm blocker collision — **real, current, highest priority**

Every K4 edge sharing a source room exits through the *same* boundary tile: `blockerTile`
([expand.ts:178](../src/game/level/expand.ts)) derives the tile from `path[0]→path[1]`, and
for `viaJunction` edges `path[1]` is always the single shared junction cell
([expand.ts:259](../src/game/level/expand.ts)). So a `secret`/`locked` edge stamps a `+`
([expand.ts:216](../src/game/level/expand.ts)) that physically walls off the room's other,
nominally-open K4 edges. Runtime traversal ([Dungeon.ts:1841](../src/game/scenes/Dungeon.ts))
only checks logical edges pairwise, so physical and logical state diverge. Three sites can
close a junction edge: the gate ([generate.ts:272](../src/game/level/generate.ts)), the
decorate-secret/one-way ([generate.ts:285](../src/game/level/generate.ts)), and the degree
cap ([generate.ts:321](../src/game/level/generate.ts)) — the last *always* fires for kite
(hub node 3 has logical degree 4).

**Fix:** a junction hub consolidates a room's many logical connections into one physical
exit, so junction edges must never carry a physical blocker or gate. Exclude `viaJunction`
edges from the gate pick, the decorate pool, and the degree cap; keep them `open`. Accept
that the hub node has logical degree 4 (its *physical* exit count is still low). Add a hard
guard (throw) if a junction connector is ever closed, per the repo's no-fallbacks rule.

### B. Betrayal consequence not persisted — **real**

`spawnNpcBetrayal` creates an ambusher then `saveToSlot(0)`
([Dungeon.ts:1573](../src/game/scenes/Dungeon.ts)), but monsters aren't in the save schema.
On reload the resolved betrayer NPC is skipped ([Dungeon.ts:789](../src/game/scenes/Dungeon.ts))
*and* the foe is gone — reloading erases the consequence.

### C. Companion override ignores reward/party invariants — **real**

The NPC `companionClass` is rolled independently ([expand.ts:367](../src/game/level/expand.ts))
and overrides the campaign-selected class in `claimDungeonReward`
([Dungeon.ts:1622](../src/game/scenes/Dungeon.ts)) with no duplicate-class or capacity guard.
Can recruit a second Thief while the intended class never appears.

### D. Trade is not transactional — **real, low impact**

`canAdd(gem)` is checked *before* `remove("ration")`
([Dungeon.ts:1565](../src/game/scenes/Dungeon.ts)); a full inventory holding exactly the one
ration being spent is wrongly rejected. Should evaluate capacity against post-trade state.

### E. Silent NPC opens / no-fallback violation — **real, minor**

`openNpcTargetConnector` ([Dungeon.ts:1584](../src/game/scenes/Dungeon.ts)) returns `false`
on an unresolved `targetConnectorId` and the caller silently skips — conflicts with the
global "no fallbacks, throw" rule. Also gives no audio cue when it succeeds.

### F. Downgraded / rejected

- **`commit_review.md` "Critical: greedy edge-trimming disconnection"** — *not currently
  triggerable.* `redundantEdges` ([generate.ts:76](../src/game/level/generate.ts)) selects
  only cycle edges (never spanning-tree), so the universal route always survives. The K5
  worst-case doesn't exist; `kite` demotes exactly one edge. Latent unsoundness worth a
  comment/guard once a denser form ships, but not a live bug. (Superseded anyway by fix A,
  which stops demoting junction edges.)

### G. Lower-priority cleanups (agreed by multiple reviews)

- `compactMap` cells collide: two rooms in one 5×4 bucket overwrite; never let `o` clobber
  `@`/`R`/`X` ([Dungeon.ts:2230](../src/game/scenes/Dungeon.ts)).
- HUD map gate uses magic `>= 5`; use `connectors !== undefined`
  ([Hud.ts:909](../src/game/scenes/Hud.ts)).
- Dead legacy rescue-tile parsing (`case "2"/"3"/"4"`) in `Dungeon.ts`.
- Stale doc: `nonlinear-five-room-dungeon-plan.md` still says "plan only".
- Untracked scratch diffs (`diff_11b8d43.diff`, `diff_311b294.diff`) in repo root.

### H. Structural (enables tested fixes for B–E)

Extract NPC-outcome resolution and junction traversal into pure, Phaser-independent
functions so they can be unit-tested for correct persisted state, and to shrink the growing
`DungeonScene`.

---

## 3. Checkpointed plan

### Checkpoint A — Kite junction geometry & state semantics  `[x]`
- [x] A1. In `generate.ts`, compute the set of `viaJunction` edge ids up front.
- [x] A2. Exclude junction edges from the gate pick, the decorate candidate pool, and the
      degree-cap `optionalIds`. Update the degree-cap comment to explain the hub exemption.
- [x] A3. Hard guard: throw in `expandedConnector` if a `junction`-kind connector is closed.
- [x] A4. Add a `physical.ts` diagnostic: any connector touching a junction tile must be open.
- [x] A5. Update `generate.test.ts` degree invariant to the corrected rule (junction edges
      never closed; non-junction open degree ≤ 3) and add a collision test asserting no
      junction arm is ever blocked, for every seed/orientation.
- [x] A6. `tsc --noEmit` + full test suite green (241 passing).

### Checkpoint H — Pure NPC-outcome resolution module  `[x]`
- [x] Extract outcome resolution (trade/betrayal/reveal/revelation/companion/warning) into
      a pure state-transition module (`level/npcInteraction.ts`) returning an ordered
      `NpcAction[]` for the scene to apply, independent of Phaser. `DungeonScene`'s
      `advanceNpcInteraction` now builds an inventory snapshot, calls the pure resolver, and
      dispatches each action via a small `applyNpcAction` switch.
- [x] Unit tests for every outcome's state transition and effect ordering
      (`tests/npcInteraction.test.ts`, 17 cases). Full suite green (258 passing).

### Checkpoint B — Persist betrayal  `[x]`
- [x] Betrayers receive a deterministic alignment. The leader makes a Charisma check:
      DC 9 for matching alignments, DC 11 for different alignments involving Neutral, and
      DC 13 for opposed Law/Chaos. Success defuses the ambush. On failure, the NPC fights
      personally when the leader is level 3+, while lower-level leaders face the NPC's allies;
      that choice is persisted and `buildLevel` re-creates the correct foe on reload.
- [x] Tests cover all alignment DCs, successful defusal, failed ambush spawning, hostile
      save round-trips, and reload reconstitution through `betrayalFoePersists`.
- [ ] Not driven in the live preview: reaching the reload-after-betrayal path manually is
      fragile (and the preview is known to freeze in a hidden tab). Verified by logic + tests.

### Checkpoint C — Companion invariants  `[x]`
- [x] Pure `chooseCompanionRecruit` (`systems/companion.ts`): prefers the eligible NPC, else
      the reward default, then validates against `PARTY_CAP` and class uniqueness. An invalid
      recruit is skipped outright (no silent class substitution) per the chosen behavior.
- [x] Capacity and duplicate checks use survivors only; permanent casualties are pruned before
      a replacement joins. Recruited or rejected eligible NPCs persist as `departed`.
- [x] `claimDungeonReward` consumes the decision: recruits on success, or grants a 500-gold
      substitute with a capacity/duplicate message on skip. (Note: `missingCompanion` already
      guarantees the *default* recruit is a missing class, so the override was the live risk.)
- [x] Tests: `tests/companion.test.ts` (6 cases — recruit, fallback, duplicate-skip,
      capacity-skip, precedence, fallback-validation). Full suite green (268).

### Checkpoint D — Transactional trade  `[x]`
- [x] Added non-mutating `Inventory.canSwap(removeId, addDef)` evaluating the add against
      post-removal capacity. Scene snapshot now feeds `gemFitsAfterTrade` from it, and the
      pure trade branch consumes the ration before granting the gem.
- [x] Tests: `tests/inventory.test.ts` (full-pack swap accepted, no-slot-freed rejected,
      absent item rejected, non-mutating) + updated NPC trade case. Full suite green (262).

### Checkpoint E — Silent opens  `[ ]`
- [ ] Throw on unresolved `targetConnectorId`; add an SFX cue on success.

### Checkpoint G — Cleanups  `[x]`
- [x] compactMap collision priority: `mapMarkerPriority` ensures `@`/landmark beats are never
      clobbered by a plain `o` when two rooms bucket into one grid cell.
- [x] HUD map gate: `connectors?.length >= 5` → `connectors !== undefined`, so the map shows
      for every procedural nonlinear layout (incl. 4-edge Tier-1 forms), not authored dungeons.
- [x] Removed dead legacy rescue-tile handling: switch cases `2`/`3`/`4` (globally banned by
      `validateGrid`) plus the now-orphaned `addNpc`, `RescuableNpc`, the `npcs` array, the
      rescue interaction block, and the `classDef` import.
- [x] Refreshed `nonlinear-five-room-dungeon-plan.md` status from "plan only" to "largely
      shipped" with a pointer to this review.
- [x] Scratch diffs: none present in the working tree (nothing to remove).

---

## 4. Notes
- Every checkpoint ends green on `npx tsc --noEmit` and `npx vitest run`.
- Determinism: changes touch only the `kite` (Tier-3) path, so non-junction forms keep their
  exact RNG streams and existing tests are unaffected except the one degree invariant in A5.
</content>
</invoke>
