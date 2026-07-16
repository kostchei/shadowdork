# Five Room Dungeons in Shadowdork

The level-design bible for Shadowdork dungeons. Every dungeon is a Five Room
Dungeon, then a rest spot. This doc defines the intent of each room type, a
variant library per type (variants attack *different* resources — they are not
re-skins of each other), the legal ways to shuffle the order, and how to use
the 2D side-scrolling screen itself (loops, verticality, foreshadowing) to
make five rooms feel bigger than five rooms.

## The frame

| Room | Intent | Primary resource it attacks |
|---|---|---|
| 1. Entrance / Guardian | Set the tone; make the party prove they belong | An opening cost: HP, a torch, or nerve |
| 2. Puzzle / Roleplay | Test the *player*, not the sheet; a change of pace from combat | **Time** — the torch burns while you think |
| 3. Trick / Setback | Raise the stakes right before the boss; undermine confidence | Inventory, light, or party cohesion |
| 4. Climax / Big Battle | The primary conflict — with an unfair advantage to dismantle | Everything at once |
| 5. Reward / Revelation | The payoff — which in Shadowdark IS the progression (treasure = XP) | Greed vs gear slots; plants the next hook |

**The Shadowdark lens on every room:** don't ask "what monster is here?", ask
"what does this room do to their light, their slots, or their time?" A room
that costs zero resources is a corridor, not a room.

**Design invariants:**
- Never two pure combat rooms adjacent.
- Across the five rooms, at least one must threaten light, one inventory, one HP.
- Every room should have a clever/cheap solution and an expensive/brute one —
  the brute solution always works, it just costs more.
- Class verbs are keys, never locks: a Thief or Fighter solution should be the
  *cheap* path, with a costlier path open to any party composition (a solo
  fighter run must always be completable).

---

## Room 1 — Entrance / Guardian

*Intent: establish tone, drain an initial resource, teach one rule of this
dungeon. The guardian doesn't have to be beatable — it has to be passable.*

- **Blind Sentinels.** Undead that cannot see (darkness means nothing to them)
  but sense vibration: they aggro on movement and noise, not sight. Sprint past
  and they converge; creep slowly (walk, no jumping) and they don't. A thrown
  object — a coin, or a lit torch arcing down the hall — pulls them off post.
  *Costs: HP if fought; a torch or coins if used as decoys; time if crept past.*
  ▸ needs: noise-based aggro, throwables.
- **The Toll Shrine.** A sealed door and an altar that opens it for an offering:
  coins or a gear item placed in the bowl. Refuse, and the altar's guardians
  wake. Teaches on the doorstep that treasure is a *spendable* resource, not
  just XP. *Costs: treasure/XP or HP.* ▸ needs: offering interactable.
- **The Stone Door.** No monster at all — a door too heavy for one pair of
  hands. Fighter STR check opens it; anyone else must take the vertical detour
  (a climb-and-drop loop above the door) through a rat nest to reach the winch
  behind it. *Costs: nothing for a fighter; HP and torch-time otherwise.*
  Teaches: look up. ▸ needs: stat-check door, winch interactable.
- **The Rearguard.** The entrance is open — but a slow, heavy thing wakes as
  you pass and *follows*, too tough for a level-1 kill. It pursues through
  rooms 1–2 until lured under the room-3 portcullis or a weak ceiling. Sets a
  dread tone and pre-loads a room-3 payoff. *Costs: nerve, positioning, and
  pace — hurried players burn HP.* ▸ needs: pursuit AI, crushable trigger.
- **Moth Swarm Gallery.** A long hall where swarms attack the brightest light
  source — the torch carrier specifically. Cross dark (safe from moths, but
  disadvantage against the one lurker inside) or lit (moths chew the carrier).
  Forces the party's first real light decision. *Costs: HP or light state.*
  ▸ needs: target-the-light AI.

## Room 2 — Puzzle / Roleplay

*Intent: steel solves nothing here. The real opponent is the torch timer —
puzzles cost time, and time is light. Every wrong guess should burn something.*

- **The Freezing Crossing.** Floating platforms over ice-cold water; swimming
  deals damage over time and *douses a carried torch instantly*. The platforms
  sink in a pattern — read it from the ledge before committing, in torchlight
  you're spending to watch. ▸ needs: water volumes, DoT, sink patterns.
- **The Counterweight.** Two pressure plates far apart, both needed to hold the
  gate open — finally a hard use for follower HOLD mode: park half the party,
  cross with the rest, then find the latch that locks the gate for the others.
  Solo variant: the plate can be weighted with gear items instead of bodies —
  your inventory literally becomes puzzle pieces you may have to abandon.
  ▸ needs: pressure plates, gate latch.
- **The Memorized Dark.** A stretch of corridor where all flame is magically
  smothered (the priest's Light too). From a lit vantage window above, the
  jump layout is visible; below, you cross it blind, from memory. Pure player
  skill; the light system inverted into a memory test. ▸ needs: no-light zone,
  vantage sightline.
- **The Echo Bridge.** An invisible bridge over a chasm. Thrown coins land on
  it and stay, marking safe tiles — you *spend XP* (coins) to reveal the path,
  and every toss rings out (see: wandering monsters). Greed literally mapped
  onto safety. ▸ needs: invisible platforms, throwables.
- **The Statue Choir.** Rotating statues that must face each other in the right
  pairs (clues carved where light falls). Each wrong alignment emits a shadow
  pulse: torches gutter, losing minutes off their timers. Guess-and-check is
  allowed — it just eats your light. ▸ needs: multi-state interactables,
  torch-timer penalties.

## Room 3 — Trick / Setback

*Intent: right before the boss, take something they were counting on. Target
inventory, light, or cohesion — survival horror, not damage math.*

- **The Portcullis Gust.** A plate drops a gate that splits the party mid-room,
  and the same mechanism exhales a gust that snuffs every torch. One half of
  the party stands in total darkness as things converge; the other half must
  race the upper loop to the winch. (Engine's `snuffAll` already does the
  light half.) ▸ needs: gates, split-triggering plate.
- **The False Vault.** A treasure room a little too rich, a little too easy.
  The centerpiece chest is a Mimic and the doors seal at first touch until
  it dies. The trick isn't the fight — it's that they *spent slots* greedily
  before it sprang, and now sprint the boss room over-encumbered or drop loot.
  ▸ needs: mimic monster, sealing doors.
- **The Long Fall.** The floor is weak; crossing it collapses the party into a
  parallel corridor *below* the dungeon — same screen, lower layer — landing
  scattered, with one torch between them. The way back up is a climb shaft
  that re-enters room 2 from beneath (a layout loop; see below). Setback as
  geography, no damage required. ▸ needs: collapsing floor tiles.
- **The Hostage Ledge.** Goblins hold the yet-unrescued party member at
  spear-point on a high ledge. Charge in and they shove the hostage off — a
  death timer starts the fight. Creep the dark route above for a backstab, pay
  a ransom in coins, or rout them with Turn Undead's morale shock, and the
  hostage walks free. Every party verb gets a bid. *(Builds on the existing
  rescue + death-timer systems.)* ▸ needs: hostage AI trigger.
- **The Slime Ceiling.** A drip corridor where hits don't deal damage — they
  *destroy carried items*, rations first, then torches. Sprinting through
  costs gear; the slow safe path weaves under the platforms and costs time.
  The only room in the dungeon that attacks inventory directly.
  ▸ needs: item-destruction effect.

## Room 4 — Climax / Big Battle

*Intent: the boss is not fair. It owns the room. The fight is really about
dismantling its environmental advantage — brute force is the expensive fallback.*

- **The Gas Ritual.** A shaman mid-ritual in a chamber flooded with explosive
  gas: any open flame detonates the room (huge AoE, including you). Fight by
  the dim of bioluminescent moss — everyone at disadvantage — or send the
  Thief up the vents to clear the gas, or lean on the Priest's flameless
  Light. The one boss room where your torch is the *wrong* answer.
  ▸ needs: gas zones, moss ambient light, vent interactables.
- **The Warchief.** Minions immune to morale while their leader stands — and
  he stands at the back, behind three ranks. Kill him (backstab route along
  the dark ceiling walkway, or punch through) and the *entire* room checks
  morale at once: mass rout as payoff. Uses the RAW leader-morale rule the
  engine doc lists as a deviation. ▸ needs: leader-morale flag, ranked AI.
- **The Ceiling Lurker.** The boss lives in the dark above your light radius
  and dive-bombs the party, untargetable until it commits. Plant torches as
  standing lights (each one is inventory sacrificed to the floor) to shrink
  its dark territory until it has nowhere left to hide. Area-denial with your
  own gear slots. ▸ needs: placeable torches, ceiling AI.
- **The Snuffing Choir.** A boss whose ritual pulse periodically extinguishes
  all party light while braziers around the arena re-summon adds. Smash the
  braziers to stop the summons; save a light source for the final pulse
  phase. Tests torch *inventory depth*, not just the timer. ▸ needs: brazier
  objects, pulse phases (`snuffAll` exists).
- **The Sinking Arena.** Fight on one-way platforms that sink under weight
  over freezing water (room-2 tech reused at lethal pace) while something
  large surfaces beneath. Pure positioning: the boss is easy to hit and
  hits like a landslide; the floor is the real enemy. ▸ needs: water + sink
  tech from room 2.

## Room 5 — Reward / Revelation

*Intent: treasure = XP = the actual level-up moment. The twist is either a
cost (slots, weight, greed) or a hook (the next dungeon). Never a fight for
its own sake.*

- **The Heavy Chest.** A locked strongbox holding level-up gold — as a single
  6-slot object. Someone hauls it (the Fighter's +CON Hauler slots finally
  star) and the party chooses which survival gear stays behind in the dark.
  Carrying it back out through the loop is the epilogue. ▸ needs: heavy
  carryable object.
- **The Map Beneath.** Under the gold: a map. It marks a secret door back in
  room *2* of this very dungeon — a wall you already walked past — opening
  the descent to the next, deadlier dungeon. The reward re-values explored
  space and turns the exit walk into a choice: rest spot right, or down.
  ▸ needs: secret doors, dungeon chaining.
- **The Rival Party.** As you fill your slots, torchlight appears at the far
  door: another adventuring party, alive and unfriendly, wanting what you're
  holding. Pay a share, fight people (who check morale, flee, and remember),
  or grab-and-run the loop route while they're spread out. The revelation:
  you are not the only party in the dark. ▸ needs: rival NPC party AI.
- **The Glittering Floor.** Coins scattered thick across the floor — which is
  weak, and collapses under whoever greeds up more than a few slots' worth,
  dropping them into the *true* vault below: better treasure, plus its owner.
  Reward and trick fused; restraint is a valid clear. ▸ needs: weight-triggered
  collapsing floor.
- **The Chained Companion.** The vault's prize includes the final rescuable
  party member, shackled to the hoard as its "guardian" by the dungeon's
  master — their gear stacked beside them as loot. The reward is a whole
  character. Fuses recruitment into the structure for dungeons where a rescue
  didn't fit earlier. *(Rescue system exists.)*

---

## Bending the order

The sequence 1→2→3→4→5 is a pacing default, not a law. Legal shuffles:

- **2 ↔ 3 swap** — the setback hits first and the puzzle must be solved *in*
  its aftermath (solve the Echo Bridge with half the party portcullised away).
- **Early visible reward** — room 5's treasure is shown in room 1 behind a
  grate or across a chasm (see layout below); access only unlocks after room
  4. Greed becomes the motive for the whole run.
- **The returning guardian** — room 1's guardian is bypassed, not killed, and
  reappears as the boss's second phase in room 4. Cheap foreshadowing, big
  payoff.
- **Boss guards the exit, not the loot** — swap 4 and 5: the vault is open
  mid-dungeon (load up, spend slots), then the climax stands between you and
  the rest spot, and you fight it *encumbered by your own reward*.
- **Revelation at the midpoint** — the "twist" (the map, the rival) lands in
  room 3 as the setback, and room 5 is pure payoff. Trick and revelation are
  interchangeable moods.

Keep the invariants: no adjacent pure-combat rooms; light, inventory, and HP
each threatened somewhere.

## Using the 2D screen

A side-scroller's screen is a design tool the tabletop version never had —
the player can *see* rooms they can't reach yet.

- **Linear gallery** (the current level): rooms left→right with doorway
  dividers. The baseline; every variant library entry assumes it works here.
- **The loop:** the dungeon bends back over itself — room 5 sits above room 1,
  and clearing it opens a one-way drop or shortcut door down into the
  entrance. You walk out past the corpses you made, carrying the heavy chest,
  and the Rearguard/Rival variants get their chase stage for free.
- **The vertical stack:** rooms descend as a shaft instead of a corridor.
  One-way drops between rooms mean *no retreat* — committing downward is the
  dread. Climb walls and winch elevators become the puzzle keys, and the rest
  spot at the bottom glows below your feet for three rooms before you reach it.
- **Two layers, one screen:** a parallel corridor under the main floor (the
  Long Fall's lower passage, the Glittering Floor's true vault). The screen
  height is two rooms deep; falls, collapses, and secret stairs move you
  between layers. Five rooms fit in three screens' width.
- **The hub:** room 2 as a central chamber with locked spokes up, down, and
  right — the middle three rooms take any order the players choose, and the
  hub's state (statues aligned, plates held) is the running puzzle.
- **Foreshadowing through the wall:** show the boss pacing behind a portcullis
  while the party solves room 2 beside it; show the rest spot's warm light at
  the far right edge from the moment the run starts; let the torch timer and
  a visible-but-unreachable goal do the tension work.
- **Backtracking against the clock:** put a lever for room 4's gate back in
  room 1. The distance is trivial on fresh torches — but this is the third
  trip, and the timer HUD is orange. Geography makes the real-time light rule
  bite twice.

## Implementation status

Works today: light/darkness + `snuffAll`, torch timers, weak walls, climb
walls, one-way platforms, spikes, morale + rout, rescues + death timers, gear
slots + auto-loot + coin banking, room dividers, and a reusable dungeon library
(`src/game/level/dungeons.ts`). The library currently ships three Five Room
layouts with distinct geometry, encounter cadence, rescue placement, light
placement, decoration, palette, and reward approach. Runs rotate through them
after a win or wipe, and tests validate every grid's dimensions, tile alphabet,
and mandatory encounter markers.

Highest-leverage new primitives (each unlocks several variants above):
1. **Interactables** — levers, pressure plates, offering bowls, winches,
   multi-state statues; one generic "use with E, has states" object.
2. **Gates/portcullises** — walls that open, close, and drop on triggers.
3. **Water volumes** — swim physics, damage-over-time, torch-dousing.
4. **Throwables** — coins/rocks/torches as projectiles with noise + light.
5. **Zone effects** — no-light zones, explosive gas, ambient moss light.
6. **AI flags** — noise-based aggro, pursue-through-rooms, target-the-light,
   leader-morale groups.
7. **Heavy/placeable objects** — the 6-slot chest, planted standing torches.

Next target: extract each authored room into a builder function
(`roomGuardian.blindSentinels(grid, x0) → width`) so a dungeon can be a seeded
draw of one variant per room type plus a layout pattern.
