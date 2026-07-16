# Shadowdark Rules Engine — As Built

This document describes the rules engine as implemented in `src/engine/` (pure
TypeScript, no game-framework imports). The full RAW reference lives in
[shadowdark_pseudocode.md](shadowdark_pseudocode.md); deviations from it are
listed at the end.

## 1. Core Resolution Service — `check.ts`

One mechanic: **d20 + stat modifier vs DC or AC, roll high.**

- `resolveCheck(dice, { actor, stat, dc, kind, advantage, disadvantage })` is the
  single resolution function. Attacks, spell checks, stabilization, trap
  disarms — everything calls it.
- DCs are named constants: `DC.EASY 9`, `DC.NORMAL 12`, `DC.HARD 15`, `DC.EXTREME 18`.
- **Advantage/disadvantage** is a first-class input: callers pass arrays of
  human-readable *reasons* (`["high ground"]`, `["darkness"]`) which surface in
  the UI. Talent hooks can add more. Any advantage + any disadvantage cancel to
  a normal roll.
- **Natural 1** auto-fails; **natural 20** auto-succeeds and crits. Attack crit
  thresholds can drop below 20 via talent hooks (`critRange`).
- Results carry the natural die, both dice under adv/dis, total, modifier, and
  the adv/dis reasons — the game renders the natural die as floating text so
  players learn the system.

## 2. Character Model — `character.ts`, `effects.ts`

- Six stats, scores 1–20, modifier = `floor((score − 10) / 2)` (−4…+4, matching
  the RAW threshold table).
- Class (fighter/thief/priest/wizard), alignment, level, XP, HP, AC.
- **Talents and conditions are one system**: data-driven `Effect` records
  carrying `EffectHook[]` — `checkBonus`, `advantageOn`, `disadvantageOn`,
  `critRange`, `statBonus`, `acBonus`, `damageBonus`, `maxHpBonus`. Talents are
  permanent; conditions carry a `Duration` (`rounds`, `crawlingRounds`,
  `realMs`, `untilRest`, `focus`). New talents are new data, not engine code.
- Known spells carry per-spell state (see §5). Dying state is a per-character
  round countdown (see §6).

## 3. Time — `time.ts`

Three nested clocks in `GameClock`, fed real milliseconds by the game loop:

- **Real time**: light sources burn here. Torch duration is `EngineConfig.torchMs`
  (RAW: 1 hour; the game currently ships a 3-minute playtest house rule — a
  config value, not a code change). Timers support pause (session break).
- **Rounds** (`roundMs`, default 3 s): death timers, round-based conditions.
- **Crawling rounds** (`crawlingRoundMs`, default 10 min): reserved for random
  encounter checks and exploration bookkeeping (not yet wired to encounters).

## 4. Light

The engine owns torch *timers*; light *geometry* (who is lit/dim/dark) lives in
the game layer (`src/game/systems/light.ts`) and feeds back into checks as
disadvantage context. Monsters have `darkvision` and attack unlit characters at
advantage.

## 5. Spellcasting State Machine — `spells.ts`

No slots. Casting = spell check: d20 + INT (wizard) / WIS (priest) vs **DC 10 + tier**.

- **Failure**: the spell's `KnownSpell.status` flips to `lost` until rest.
- **Natural 1**: wizards roll the mishap table live (`wizard-mishaps`, kept as
  data with structured consequences); priests are cut off — `requiresAtonement`
  keeps the spell lost through normal rests.
- **Natural 20**: effect/duration doubled (`CastResult.doubled`).
- Focus spells end when the caster takes damage (handled in
  `Engine.damageCharacter`).

## 6. Combat Support

- `Engine.attack()` wraps `resolveCheck` (kind `attack`, STR vs AC) and rolls
  damage; **crits double the damage dice**, damage-bonus hooks apply.
- Monsters (`monster.ts`) are flat stat blocks: AC, hit dice, attack bonus,
  damage, WIS mod, darkvision, undead flag, XP tier. `monsterAttackRoll`
  shares the nat-1/nat-20 rules.
- **Morale**: `moraleCheck` = DC 15 WIS. The game fires it when half a monster
  group has fallen; failures flee.
- **Death timers**: at 0 HP, `1d4 + CON mod` rounds (min 1). Each round a dying
  character rolls a d20 — **natural 20 self-revives at 1 HP**. Stabilize is a
  **DC 15 INT check** by a rescuer (`Engine.stabilize`), leaving the target at
  1 HP. Timer expiry = dead, permanently.

## 7. Inventory — `inventory.ts`

- Gear slots: capacity = `max(STR, 10)`; **fighters add their CON modifier
  (Hauler)**.
- Items carry `slotCost` and `bundleSize`; **coins ride free for the first 100,
  then 1 slot per 100** (`freeQty`).
- Exceeding capacity **throws** — validation is hard, not a soft penalty. The
  game checks `canAdd` first and leaves loot on the ground with a message.

## 8. Advancement — `advancement.ts`

- **XP comes from treasure only.** Gems/idols/crowns carry `xpValue`; coins bank
  toward 100-coin thresholds (1 XP per full 100, tracked by the game context).
- Threshold: `(current level × 10)` XP, resetting each level. Max level 10.
- Level-up rolls HP (class hit die + CON, min 1) and **2d6 on the class talent
  table**, whose structured effects mutate the character's hooks.

## 9. Random Tables — `tables.ts`

`TableRegistry.roll(dice, tableId, modifier)` over contiguous-range entries that
carry structured `effects` and free-form `data`. Registered tables: four class
talent tables and the wizard mishap table (`src/data/tables/`). All table text
is original paraphrase — the licensing boundary. Unknown table ids throw.

## 10. Rest — `Engine.rest` / `Engine.freeRest`

- `rest(character, ration)`: requires and consumes a ration; restores all HP,
  recovers lost spells (except atonement-locked), clears until-rest effects.
- `freeRest(character)`: the **rest spot** between dungeons — same recovery, no
  ration. The game adds a fresh torch per party member. (Planned: food for
  sale, selling loot.)

## Architecture Notes

- **Event log** (`events.ts`): every check, attack, cast, XP award, timer expiry
  and death appends to an append-only log with engine timestamps.
- **Rules-as-data**: talents, spells, items, monsters, tables all live in
  `src/data/`, separate from engine logic.
- **Seedable dice** (`dice.ts`, mulberry32): deterministic runs for tests.
- **No fallbacks**: invalid states throw (unknown ids, over-capacity, resting
  while dead, casting a lost spell).

## Deviations from RAW (deliberate, v1)

| RAW (pseudocode doc) | As built | Why |
|---|---|---|
| Talent rolls at levels 3/5/7/9 | Talent roll **every** level | The slot-machine moment is the platformer's level-up payoff |
| Morale uses group leader's WIS | Each monster's own WIS mod | No leader modelling yet |
| Priest penance = GP sacrifice by tier | Spell lost until atonement (stubbed) | No economy yet |
| Trained-task auto-success, luck tokens, ancestries, stealth/surprise, swimming, encounter/reaction tables | Not implemented | v2 candidates; crawling-round hook exists for encounter checks |
| Initiative order | Replaced by real-time ~1 s cooldowns (a compressed round) | Real-time platformer combat |
| Torch = 1 real hour | Config default 1 h; game ships 3 min for playtests | House-rule config flag per the original design brief |
