# Shadowdork — Game Design (As Built)

A 1-player, 1–4 character side-scrolling dungeon crawler with Shadowdark
mechanics, in the browser. **Lost Vikings-style problem solving, not twitch
platforming**: you directly control one character; the others follow with
simple AI, and you swap leader instantly.

## Stack (as implemented)

- **Phaser 3 (Arcade physics) + Vite + TypeScript.** Deploys as static files.
- **The rules engine is pure TypeScript** (`src/engine/`), not the originally
  pitched Go→WASM route — there was no existing Go engine to reuse, so a single
  language/toolchain won. The engine stays cleanly separated (no Phaser
  imports) and could later be server-hosted for multiplayer.
- Phaser owns physics, movement, rendering. Every *rules event* — a sword
  connects, a spell is cast, treasure is banked — calls the engine, which
  returns the dice result; Phaser renders the outcome. Real-time action,
  dice-authoritative resolution.

## Dungeon structure: Five Room Dungeons

Levels follow the classic [5 Room Dungeon](https://www.roleplayingtips.com/5-room-dungeons/)
structure, laid out as side-scrolling rooms separated by doorways, then a rest
spot:

1. **Entrance & Guardian** — goblin guardians hold the way in; the caged Thief
   is the first rescue.
2. **Puzzle / Roleplay** — a challenge steel can't solve alone: a sheer barrier
   crossed by the Thief climbing its vine face *or* the Fighter smashing its
   cracked base. The Priest's shrine sits on a high ledge.
3. **Trick / Setback** — a spike-trap gauntlet with bait treasure sitting
   between the pits, a skeleton ambush, and the Wizard found mid-losing-battle.
4. **Climax** — the Gloom Ogre and its minions.
5. **Reward / Revelation** — the vault: the Crown of the Deep, with one last
   guardian in the treasure.

**Rest spot** — after room five: a safe camp. Resting is free — full HP,
lost spells recovered, until-rest conditions cleared, and a fresh torch per
party member — then the exit door. (Planned rest-spot economy: free food vs
food for sale, selling loot, shrines for priest atonement.)

Level geometry is built programmatically (`src/game/level/level1.ts`) from
room-segment placements into an ASCII grid, so new five-room dungeons are cheap
to author.

## The core tension: light

Torches burn in **real time** on the engine clock (3 real minutes in the
current playtest config; the RAW hour is one config value away). Your light
radius is literally rendered — outside it the level is black. A torch costs a
gear slot and a hand (no two-handed weapons while carrying one). Monsters see
fine in the dark and attack unlit characters with advantage; you act in
darkness at disadvantage. The rest spot hands out fresh torches because the
next dungeon will eat them.

## Party of 4, rescued not rostered

You start solo as the Fighter. The Thief, Priest, and Wizard are rescuable NPCs
placed in rooms 1–3. Followers use follow/hold AI (H to toggle), auto-fight
adjacent monsters, and teleport-catch-up if hopelessly separated. Tab or 1–4
swaps leader instantly; if the leader drops, control passes to the next living
member.

**Classes are platformer verbs:**
- *Fighter* — highest HP/AC, breaks weak walls, hauls extra gear (+CON slots).
- *Thief* — climbs vine walls others can't, disarms spike traps by touch (DEX
  check), backstab advantage on unaware enemies.
- *Wizard* — ranged spell attacks; every cast is a real spell check, fail and
  the spell is lost until rest, nat 1 rolls the mishap table live.
- *Priest* — heals, turns undead (forced rout), Light spell as a hands-free
  torch substitute.

## Combat

Real-time swings on a ~1 s cooldown (a compressed round), each resolving
d20+STR vs AC through the engine. The natural die floats over every swing so
the system stays legible. Crits double damage dice with screen-shake.
**Advantage is positional**: above = advantage, backstab = advantage, airborne
or in darkness = disadvantage — platforming skill literally improves your
rolls. Monster **morale** breaks when half a group falls (DC 15 WIS): enemies
rout and flee off-screen.

**Death timers as rescue windows**: at 0 HP a character collapses with a
visible 1d4+CON round countdown (nat 20 on any round self-revives at 1 HP).
Reach them and stabilize (DC 15 INT) or heal before it hits zero, or they're
gone for the run. Solo, that's death.

## Loot and advancement

**Auto-loot**: walking over treasure collects it (if gear slots allow — slots
are a hard cap, not a penalty). Slain monsters spill coins and gems where they
fall. **Treasure is the only XP**: gems 2, idols 3, the crown 10; coins bank
toward 1 XP per full 100 collected (first 100 coins are carried free, then 1
slot per 100 — RAW). Level-up rolls HP and a live 2d6 class talent — a
slot-machine moment the whole party shares, since treasure XP is awarded
party-wide.

## Controls

| Key | Action |
|---|---|
| A/D or ←/→ | Move |
| W / ↑ / Space | Jump; hold W at vines to climb (thief) |
| J or X | Attack (fighter: also smashes weak walls) |
| K or C | Cast prepared spell |
| Q | Cycle prepared spell |
| T | Light a torch |
| E | Interact (rescue / stabilize / disarm / rest / exit) |
| H | Followers: follow ↔ hold |
| Tab / 1–4 | Swap leader |
| R | Restart after win or wipe |

## Project shape

```
src/engine/    pure TS rules engine (see the Rules Engine doc)
src/data/      rules-as-data: classes, spells, items, monsters, tables
src/game/      Phaser: scenes (Boot/Dungeon/Hud), entities, systems
               (light, party, combat, position/zones, spells), level builder
tests/         engine unit tests (vitest, seeded dice)
```

## Roadmap

- Rest-spot economy: buy food, sell loot, priest atonement at shrines.
- Multiple five-room dungeons chained by rest spots; procedural room variants.
- Random encounters on the crawling-round clock (engine hook already exists).
- Ancestries, luck tokens, stealth/surprise (see the RAW pseudocode doc).
- Sound, real art, mobile touch controls.
