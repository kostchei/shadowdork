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
  thresholds can drop below 20 via talent hooks (`critRange`) — but only a
  natural 20 auto-succeeds: a talent-crit on 19 still has to beat the AC.
- Results carry the natural die, both dice under adv/dis, total, modifier, and
  the adv/dis reasons — the game renders the natural die as floating text so
  players learn the system.

## 2. Character Model — `character.ts`, `effects.ts`

- Six stats, scores 1–20, modifier = `floor((score − 10) / 2)` (−4…+4, matching
  the RAW threshold table).
- **Character generation** (`rollStats`): 3d6 per stat on the seeded dice,
  silently regenerated until the array holds ≥2 stats of 15+ and ≤1 stat
  under 6 (house heroic gate; RAW's is "reroll if no stat 14+"). Level-1 HP =
  class hit die + CON mod (min 1).
- **Armor is worn, not baked in**: `AC = armor base + DEX (capped by the
  armor) + readied shield (+2) + effect hooks`; unarmored = 10 + DEX. Armor
  items carry class permissions (fighter/priest: all; thief: leather; wizard:
  none) and `equipArmor` throws on a forbidden fit. A readied shield occupies
  a hand — the game slings it (`shieldStowed`, −2 AC) while that hand carries
  a torch.
- **Luck token**: every character starts with one; the game layer spends it
  to reroll a just-failed player-initiated check.
- Class (fighter/thief/priest/wizard), alignment, level, XP, HP.
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

- `Engine.attack()` wraps `resolveCheck` (kind `attack`) and rolls damage;
  **the attack stat is STR, or the better of STR/DEX for finesse weapons**
  (the weapon's `ItemDef` decides). `extraDamageDice` adds weapon dice on a
  hit — the thief's backstab passes `1 + floor(level/2)`. **Crits double all
  damage dice** (backstab dice included); damage-bonus hooks apply, including
  `damageBonusHalfLevel` (fighter Weapon Mastery scaling).
- Monsters (`monster.ts`) are flat stat blocks: AC, hit dice, attack bonus,
  damage, WIS mod, darkvision, undead flag, XP tier. `monsterAttackRoll`
  shares the nat-1/nat-20 rules.
- **Morale**: `moraleCheck` = DC 15 WIS. The game fires it when half a monster
  group has fallen; failures flee. Monsters flagged `leader` (the ogre) hold
  their group exempt while alive — the leader's death makes the whole group
  check at once.
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
- Threshold: `(current level × 10)` XP; excess carries over. Max level 10.
- Level-up rolls HP (class hit die + CON, min 1), **heals to full** (pulling a
  dying character back up), and rolls **2d6 on the class talent table**, whose
  structured effects mutate the character's hooks.

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
| Talent rolls at levels 3/5/7/9 | Talent roll **every** level | Ratified house rule: the slot-machine moment is the platformer's level-up payoff |
| Reroll stats if no 14+ | Reroll until ≥2 stats 15+ and ≤1 under 6 | Ratified heroic house rule |
| XP resets to 0 on level | Excess XP carries over | Friendlier; treasure never wasted |
| Morale check per monster's own WIS | Same, plus `leader` flag: group exempt while leader lives, mass check on its death | Leader modelling now exists |
| Priest penance = GP sacrifice by tier | Atonement is free at any shrine (E to kneel) | Cost arrives with the rest-spot economy |
| Encounter distance/activity/reaction tables | 1-in-6 on the crawling clock, every round in total darkness, themed hunting wave | Reaction tables need social play; v2 |
| Trained-task auto-success, ancestries, stealth/surprise, swimming | Not implemented | v2 candidates (swimming lands with water volumes) |
| Luck reroll on any roll | Reroll offered on the leader's just-failed swing/cast/stabilize (L, 2.5 s window) | Mishaps already detonated — no clean undo |
| Initiative order | Replaced by real-time ~1 s cooldowns (a compressed round) | Real-time platformer combat |
| Torch = 1 real hour; crawling round = 10 min | Config: 3 min torch, 45 s crawling round for playtests | House-rule config flags per the original design brief |
