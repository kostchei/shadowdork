# Shadowdork

A 1-player, 1–4 character side-scrolling dungeon crawler with Shadowdark mechanics,
running entirely in the browser. Lost Vikings-style problem solving, not twitch
platforming: you directly control one character while the rest follow with simple AI.

Levels are [Five Room Dungeons](https://www.roleplayingtips.com/5-room-dungeons/) —
Entrance & Guardian, Puzzle, Trick/Setback, Climax, Reward — followed by a rest
spot: free full recovery, a fresh torch each, and the exit door.

Design docs: [Shadowdork.md](Shadowdork.md) (game design),
[docs/five-room-dungeons.md](docs/five-room-dungeons.md) (level-design bible:
room-variant library, order shuffles, 2D layout patterns),
[the rules-engine doc](<Shadowdark Backend Rules Engine — Design Requirements.md>)
(engine as built), [shadowdark_pseudocode.md](shadowdark_pseudocode.md) (RAW reference).

## Run it

```
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # static production build in dist/ — serve from any webserver
npm test         # rules-engine unit tests (vitest)
```

## Controls

| Key | Action |
|---|---|
| A/D or ←/→ | Move |
| W / ↑ / Space | Jump (thief: hold W on vine walls to climb) |
| J or X | Melee attack (fighter also breaks cracked walls) |
| K or C | Cast prepared spell |
| Q | Cycle prepared spell |
| T | Light a torch (consumes one; burns in real time) |
| E | Interact: rescue NPCs, stabilize dying allies, disarm traps (thief), rest at campfires, exit door |
| H | Toggle followers between FOLLOW and HOLD |
| Tab / 1–4 | Swap leader |
| R | Restart after a win or party wipe |

## How Shadowdark maps to the game

- **Every rules event is a d20 roll** through a single `resolveCheck` service —
  the floating number over a swing is the natural die.
- **Light is the level design.** Outside your light radius the dungeon is genuinely
  black. Torches burn in real time (3 real minutes in the playtest config —
  a config value, not a rule change), cost a gear slot, and can't be held with a
  two-handed weapon. Monsters see fine in the dark and attack unlit characters
  with advantage; you act in darkness at disadvantage.
- **Advantage/disadvantage is positional**: attack from above = advantage,
  thief backstab vs unaware = advantage, airborne or in darkness = disadvantage.
- **Spells have no slots.** Casting is a spell check vs DC 10 + tier. Failure loses
  the spell until rest. Natural 1: wizards roll the live mishap table; priests are
  cut off pending atonement. Natural 20 doubles the effect.
- **Death timers**: at 0 HP a character collapses with a visible 1d4+CON round
  countdown. Stabilize (DC 15) or heal them in time, or they're gone for the run.
- **Treasure is XP** — the only progression, and loot is collected automatically by
  walking over it. Slain monsters spill coins and gems where they fall. Coins bank
  toward 1 XP per full 100 (first 100 carried free, then 1 slot per 100). Level-up
  rolls HP and a live 2d6 talent on the class table.
- **Rest spot after room five**: free full recovery plus a fresh torch per member.
  Mid-dungeon campfires still demand a ration.
- **Morale**: when half a monster group falls, survivors check DC 15 WIS or rout.
- Party of 4: start solo as the Fighter; rescue the Thief (caged), Priest (shrine),
  and Wizard (mid-losing-battle) in the dungeon.

## Architecture

```
src/engine/   Pure TypeScript Shadowdark rules engine — no Phaser imports.
              Dice (seedable), checks, characters, effects-as-data talents,
              spell state machine, gear-slot inventory, advancement,
              weighted tables, nested time (rounds / crawling rounds / real ms),
              append-only event log.
src/data/     Rules-as-data: classes, spells, items, monsters, talent tables,
              wizard mishap table. The licensing boundary — table text is
              original paraphrase, kept out of the engine.
src/game/     Phaser 3 (Arcade physics): scenes, entities, and systems
              (light mask, party AI, combat, zones, spell effects).
tests/        Engine unit tests.
```

The game layer never rolls dice or mutates rules state itself — it calls the
engine and renders consequences. Invalid states (unknown table, over-capacity
inventory, resting without a ration) throw rather than falling back.
