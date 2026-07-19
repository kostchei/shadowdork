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

### Checkpoint H — Pure NPC-outcome resolution module  `[ ]`
- [ ] Extract outcome resolution (trade/betrayal/reveal/revelation/companion) into a pure
      state-transition module returning effects, independent of Phaser.
- [ ] Unit tests for each outcome's state transition.

### Checkpoint B — Persist betrayal  `[ ]`
- [ ] Persist spawned-ambusher state (or a `betrayalSpawned` flag) and restore on reload.
- [ ] Save/reload test.

### Checkpoint C — Companion invariants  `[ ]`
- [ ] Enforce party capacity + duplicate-class check before applying the NPC override.
- [ ] Test duplicate-class and full-party cases.

### Checkpoint D — Transactional trade  `[ ]`
- [ ] Evaluate gem capacity against post-removal inventory; test the full-inventory case.

### Checkpoint E — Silent opens  `[ ]`
- [ ] Throw on unresolved `targetConnectorId`; add an SFX cue on success.

### Checkpoint G — Cleanups  `[ ]`
- [ ] compactMap collision priority; HUD gate; dead rescue-tile parsing; docs; scratch diffs.

---

## 4. Notes
- Every checkpoint ends green on `npx tsc --noEmit` and `npx vitest run`.
- Determinism: changes touch only the `kite` (Tier-3) path, so non-junction forms keep their
  exact RNG streams and existing tests are unaffected except the one degree invariant in A5.
</content>
</invoke>
