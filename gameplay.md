# The Lost Vikings (1992, Silicon Synapse/Blizzard) — your closest template

This is almost exactly the game you're describing, and it maps directly onto a party-of-up-to-4 Shadowdark platformer.

**Core structure**: you alternate control of three Viking characters, guiding one at a time (swappable at any point) from a start point to the exit. Every level is designed so each Viking must contribute his unique skills to get the other two through, and all three must reach the exit to finish. Instead of one character who can jump, run, shoot, collect items and flip switches, there are three characters each with a subset of those verbs.

**The ability split (the important bit):**
- Erik the Swift — runs fastest, jumps (the other two literally can't), dash-headbutts through walls and enemies but is left vulnerable while doing it.
- Baleog the Fierce — sword for melee, bow for ranged and for hitting switches at distance.
- Olaf the Stout — shield blocks attacks, works as a hang glider, and functions as a step/platform to stand on. Olaf's shield lets Baleog walk over him and lets Erik reach higher areas.

**Why it isn't twitch:** two of your three characters can't jump at all. That single decision guts the twitch layer — most of the level is a logistics problem, not an execution problem. Each Viking has three health points, lost to enemies or long falls. Losing a Viking means losing progress on that level, but unlimited continues let you experiment and learn from mistakes without excessive frustration.

**What to steal:**
1. **Swap-at-any-time party control, one active at a time.** This is the single most concentration-friendly mechanic ever put in a platformer — the game effectively pauses its demands on you while you think about who to move next.
2. **Ability specialisation to the point of crippling.** The puzzle only exists because each character is *bad* at things. Don't give everyone a jump.
3. **Body-as-terrain.** Olaf's shield-as-platform is the best mechanic in the game because it turns a party member into level geometry.
4. **Ranged switch activation.** Baleog shooting a switch across a gap creates spatial puzzles with zero reflex demand.
5. **Level-scoped failure with cheap retry.** Death costs you the room, not the session.

**What to avoid (the game's actual flaws):**
- Combat is the weakest part — Vikings get little to no invulnerability frames, so a cornered character dies easily; Baleog can't dodge, and Erik's headbutt leaves him exposed too long. If you want forgiving, **give generous i-frames and knockback recovery.**
- The Vikings you *aren't* controlling are still subject to collision, so leaving one in the path of a hazard while you switch away can be fatal. This is a genuine concentration tax — a low-attention player will lose someone offscreen. Consider: **idle party members are invulnerable, or auto-flee to safety, or you get an audio/visual alert before an unattended member takes a hit.**
- Trial-and-error gameplay: it can take a few playthroughs to work out which path which Viking is supposed to take, made worse by one-hit hazards. Fix with **rewind/undo rather than restart.**
- In later levels it's a challenge just to stay alive — the series drifts toward execution difficulty as it goes on. Resist that curve.

**Origin note worth knowing:** it started as a Lemmings-influenced game with hundreds of tiny Vikings with different skills; consoles pushed them to larger characters and direct control, so five, then three. The early roster included a torch-carrying Viking and a ladder Viking, used to scale castles, cross moats and defeat enemies — that's a Shadowdark dungeon-delve party in all but name. **Your torch is Shadowdark's whole identity.** A light-bearer character whose torch is a real, timed, party-critical resource is the Lemmings-lineage idea Blizzard dropped, and it's sitting right there for you.

# Commander Keen (Goodbye, Galaxy — Keens 4/5, 1991, id Software)

Different lesson: Keen is about **exploration and secrets** rather than party logistics.

**Movement kit:** Keen moves left/right and jumps, and uses a pogo stick to bounce continuously and jump higher than a normal jump — with the correct timing. Levels are platforms viewed from slightly above for a pseudo-3D effect; some platforms can be jumped up through from below, others have fireman's poles to climb up or down. Keen can also grab a platform edge and pull himself up.

That **ledge-grab** is the forgiveness mechanic. It's Keen's version of coyote time — a near-miss jump becomes a success. And the **poles** are pure non-twitch vertical traversal: zero timing, arbitrary speed, you can stop and think mid-climb.

The pogo is the interesting counter-case: it's the *only* twitch element in the game, it's optional for most progression, and it gates optional secrets. **That's the right place to put your one execution-heavy mechanic — as an optional skill expression, not a progression gate.**

**Puzzle vocabulary:** force fields block passages and must be disabled via nearby switches or collected items, often as multi-step puzzles requiring backtracking. Teleporter pads instantly relocate Keen to distant map sections, enabling shortcuts and concealed areas but risking disorientation if chained badly, and tie into puzzles by requiring gem collection or enemy clearance first. The classic Keen loop is *find coloured gem key → open matching keyhole → reach exit*, with the whole level as one big lock-and-key graph.

**Combat philosophy:** Goodbye, Galaxy gives Keen a stun gun that permanently knocks out most enemies using ammo found throughout the levels, and stun behaviour varies — Arachnuts halt briefly after one shot, Poison Slugs die outright, while invincible types like the Dopefish force non-combat solutions. Enemies are **obstacles with rules**, not fights. That's the model you want: an enemy is a hazard you route around or neutralise with the right tool, not a DPS check.

**Difficulty handling:** three difficulty settings that change the number and types of enemies present — note it changes *density*, not enemy speed or your reaction window. Good precedent.

**Keen's warnings for you:** it's a one-hit-death game (touching a hazard or most enemies costs a life, and running out ends the game) with lives and a game-over. Both are hostile to low-concentration play. Keep the level design, drop the lives system entirely.

# Translating your constraints into design rules

You said: not twitch, timing OK if forgiving, not cosy, playable by people with limited concentration. Concretely:

**"Not twitch" means:**
- No jump that must be executed within a window you can't see coming.
- The player can stop moving anywhere and nothing bad happens. If standing still is ever punished, you've built a twitch game.
- Every hazard telegraphs on a cycle slow enough to *watch a full period* before committing (2–4 seconds, not 0.4).
- Puzzle solutions are visible before they're executable — you should solve it in your head, then perform it, not discover it by dying.

**"Forgiving timing" is a specific toolkit:**
- Coyote time (~120–150ms after leaving a ledge you can still jump).
- Jump buffering (~120ms before landing, the press still registers).
- Ledge grab / auto-mantle — Keen's exact solution.
- Generous hitboxes on the player (smaller than the sprite), generous on collectibles (larger than the sprite).
- Sticky platform edges — you don't slide off.
- Corner correction: clip the player around a block corner rather than stopping them dead.
- **Rewind.** 5–10 seconds of state rollback on a button. This is the single highest-leverage thing on this list for your audience — it kills trial-and-error frustration without lowering puzzle difficulty at all.

**"Low concentration" means:**
- **Small, self-contained rooms.** Lost Vikings' levels get long and that's where it loses people. A puzzle you can hold entirely in your head — one screen, maybe two — is the unit.
- **State persists.** Switch flipped stays flipped after death. Never re-solve a solved thing.
- **No timers, no chase sequences, no forced-scroll segments.**
- **Resumable at any moment.** Save-anywhere, or at minimum save-per-room.
- **The level tells you the goal on sight.** Keen's coloured keys/keyholes work because you understand the whole objective in one glance.

**"Not cosy" means:** the tone stays sharp and lethal-*feeling* even while being mechanically forgiving. Shadowdark's aesthetic does this for free — the torch burning down, real death, a grimy dungeon. **The trick is: high tension, low punishment.** The torch timer is *diegetic* dread, not a reflex test. You can be terrified without being rushed. Lost Vikings did this with irreverence and body horror-adjacent sci-fi; Keen did it with genuinely nasty enemies wrapped in cartoon art. Neither is cosy, neither is twitchy.

# Your party-of-4 problem specifically

Lost Vikings used 3 and that was deliberate — swap cycling gets tiring. The sequel added two more characters (Fang the werewolf, Scorch the dragon) who broke the strict specialisation of the original trio by each having both an attack and a vertical movement option. That's a warning: **as you add party members, the temptation is to make them generalists, and generalists kill the puzzle.** With four Shadowdark classes the discipline is:

- **Fighter** — the only one who can safely take a hit; can shove/carry; can't do anything clever. (Olaf-adjacent.)
- **Thief** — the only one who can climb/jump properly; picks locks; fragile. (Erik.)
- **Priest** — the light-bearer; can heal the party between rooms; turns undead as a *hazard-control verb* rather than combat. (No direct Viking analogue — this is your torch character.)
- **Wizard** — one ranged utility spell that's the puzzle key (a light, a knock, a floating disc = platform), on a Shadowdark-style spell check that can fail. **Careful:** random failure plus a puzzle gate is frustrating for your audience. Let a failed spell cost the *spell for the day*, never the run, and let the party retreat.

Solo start is good design: it's your tutorial. One character, one verb, small rooms, then each recruit adds exactly one new verb and retroactively opens earlier areas — that's Keen's lock-and-key graph applied at the campaign level rather than the room level, and it's Metroid-shaped without needing Metroid execution.

**One mechanic I'd strongly suggest stealing wholesale:** Olaf's shield-as-platform. Give your Fighter a "brace" — he crouches and becomes a solid, jumpable surface. It's zero-timing, spatially expressive, immediately legible, and generates dozens of puzzles from one verb. Shadowdark-flavour it as holding a shield overhead.

**Worth also looking at:** the Gamedeveloper piece on puzzle-platformers makes the point that Fez forgives mistakes with a quick respawn and strips out enemies altogether, locating its difficulty in secrets and tricks — a statement that challenge, fun and engagement don't require danger; mystery and playful puzzles can do the job. Trine is the other obvious one — three characters (knight, thief, wizard) you switch between, each with unique abilities — literally your class lineup, though its physics puzzles are more fiddly than you want.