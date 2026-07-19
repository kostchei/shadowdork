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
3. **Trick / Setback** — usually terrain, weak walls, or an ambush; roughly
   40% of runs instead draw one featured stateful trap from the dungeon's
   themed pool. A run never receives more than one featured trap.
4. **Climax** — the Gloom Ogre and its minions.
5. **Reward / Revelation** — the vault: the Crown of the Deep, with one last
   guardian in the treasure.

**Rest spot** — after room five: a safe camp. Resting is free — full HP,
lost spells recovered, until-rest conditions cleared, and a fresh torch per
party member — then the exit door. (Planned rest-spot economy: free food vs
food for sale, selling loot, shrines for priest atonement.)

Level geometry is built programmatically (`src/game/level/dungeons.ts`):
every run seeds a fresh grid from the run index, drawing each room from the
dungeon's **themed variant pool** so The Ember Crypt always reads as a crypt.
Three dungeons ship today: **The Gloom Below**, **The Ember Crypt**, and
**The Mold Warrens**, rotating after a win or wipe. Rescues follow a designed
distribution — usually front-loaded into rooms 1–3, with a tuned ~22% of runs
placing one rescue in the climax room as its *reward* (the party member IS
the treasure); those runs get a trimmed boss-room monster budget so the
short-handed party can still win. Every generated grid passes a hard
validation gate (`validateGrid`) at runtime and in a seeded property-test
sweep. The full level-design bible is in
[docs/five-room-dungeons.md](docs/five-room-dungeons.md).

Featured traps cover ten families: pressure gates, counterweighted lifts,
rolling stones that advance with player movement, collapsing floors,
alternating spikes, dart galleries, undead barriers, stone crushers,
light-readable rune paths, and lever-controlled flooded chambers. Their cheap
solutions expose class identity; every room retains a costly general route.

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

**Characters are rolled, not fixed**: 3d6 per stat, silently regenerated
until the array is heroic (at least two stats 15+, at most one under 6).
Stats drive everything — level-1 HP is the class hit die + CON, AC is
computed from worn armor + DEX (capped per armor), attacks add STR (or DEX
for finesse weapons). Everyone starts with one **luck token** (★): when a
swing, cast, or stabilize fails, a short window opens — press L to spend the
token and reroll.

**Classes are platformer verbs (with RAW armor kits):**
- *Fighter* — chainmail + shield, breaks weak walls, hauls extra gear (+CON
  slots), Weapon Mastery (+1 attack/damage, +½ level damage).
- *Thief* — leather armor, climbs vine walls others can't, disarms spike
  traps (DEX check), backstab = advantage AND extra damage dice (1 + ½ level).
- *Wizard* — no armor; ranged spell attacks; every cast is a real spell
  check, fail and the spell is lost until rest, nat 1 rolls the mishap table.
- *Priest* — chainmail + shield, heals, turns undead (forced rout), Light
  spell as a hands-free torch substitute; a nat-1 cast cuts them off until
  they atone at a shrine.

**Shields vs torches**: a readied shield is +2 AC and a full hand. Lighting a
torch slings the shield onto your back — light literally costs armor until
the torch gutters out.

## Combat

Real-time swings on a ~1 s cooldown (a compressed round), each resolving
d20+stat vs AC through the engine (finesse weapons use DEX). The natural die
floats over every swing so the system stays legible. Crits double damage dice
with screen-shake. **Advantage is positional**: above = advantage, backstab =
advantage, airborne or in darkness = disadvantage — platforming skill
literally improves your rolls. **Falling hurts**: drops beyond ~4 tiles deal
1d6 per ~3 tiles (RAW 1d6 per 10 ft), so the high route is a bet. Spike traps
allow a DEX save for half damage. Monster **morale** breaks when half a group
falls (DC 15 WIS) — but a group led by a leader (the ogre) never checks while
the leader stands, and the whole warband checks at once when it falls.

**Random encounters** ride the engine's crawling clock: each dungeon has a
danger cadence (the Mold Warrens check every crawling round), a 1-in-6 roll
spawns a themed hunting wave at the screen edge — and in **total darkness the
check runs every round**. The dark is not just disadvantage; it hunts.

**Death timers as rescue windows**: at 0 HP a character collapses with a
visible 1d4+CON round countdown (nat 20 on any round self-revives at 1 HP).
Reach them and stabilize (DC 15 INT) or heal before it hits zero, or they're
gone for the run. Solo, that's death.

## Loot and advancement

**Auto-loot**: walking over treasure collects it (if gear slots allow — slots
are a hard cap, not a penalty). Slain monsters spill coins and gems where they
fall. **Treasure is the only XP**: gems 2, idols 3, the crown 10; coins bank
toward 1 XP per full 100 collected (each living party member carries 100 free coins
in the shared party purse, e.g. 4 members = 400 free coins; beyond that, every 100 coins
costs 1 slot in the party leader's gear). Level-up rolls HP and a live 2d6 class talent — a
slot-machine moment the whole party shares, since treasure XP is awarded
party-wide.

**Cursed Scroll Expeditions**: Entering a Cursed Scroll Destination rolls **1d6 vaults (1 to 6)**
to play consecutively within that destination, with each of its 3 biomes appearing a maximum of 2 times.
Completing all 1d6 vaults of a destination triggers a choice of **1d6 Destination options**, each displaying
its 3 biomes. Surviving companions stay with you between dungeons, and every member advances one level
upon descending into the next vault or scroll.

## Controls

| Key | Action |
|---|---|
| A/D or ←/→ | Move |
| W / ↑ / Space | Jump; hold W at vines to climb (thief) |
| J or X | Attack (fighter: also smashes weak walls) |
| K or C | Cast prepared spell |
| Q | Cycle prepared spell |
| T | Light a torch (slings a readied shield) |
| E | Interact (rescue / stabilize / disarm / atone / rest / exit) — a prompt shows what E will do |
| L | Spend your luck token to reroll a just-failed swing/cast/stabilize |
| H | Followers: follow ↔ hold |
| Tab / 1–4 | Swap leader |
| R | Enter the next dungeon after win or wipe |

## Project shape

```
src/engine/    pure TS rules engine (see the Rules Engine doc)
src/data/      rules-as-data: classes, spells, items, monsters, tables
src/game/      Phaser: scenes (Boot/Dungeon/Hud), entities, systems
               (light, party, combat, position/zones, spells), level builder
tests/         engine unit tests (vitest, seeded dice)
```

## Roadmap

The full prioritized scope lives in [docs/scope-of-works.md](docs/scope-of-works.md).

- Rest-spot economy: buy food, sell loot, shrine atonement costs.
- Room builders with metadata + bible invariants enforced at assembly (WS-3):
  interactables, gates, throwables, zone effects, water, AI flags.
- Multi-dungeon campaigns with retained parties, difficulty tiers, run history.
- Ancestries, stealth/surprise (see the RAW pseudocode doc).
- Sound, real art, mobile touch controls.
