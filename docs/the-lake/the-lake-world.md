# The Lake — Full World Design
*Extension of the MVP skeleton into a complete world*

---

## Premise

An ancient lake, hidden underground. Something sleeps beneath it.
The world above has forgotten it exists. You haven't.

The world is structured as three acts:

```
ACT 1 — Surface & Approach    (clearing, forest, hermit's cottage, ruined chapel)
ACT 2 — Underground           (cave network, the lake, flooded passages, crypt)
ACT 3 — The Deep              (sanctum, the mechanism, the sealed chamber)
```

---

## World Map

```
                    [Forest Path]
                         |
                        north
                         |
[Hermit's Cottage] ── east ── [Sunlit Clearing] ── north ── [Dark Cave]
                                     |                           |
                                    west                        down
                                     |                           |
                              [Ruined Chapel]          [Cave Network]
                              [Chapel Crypt]  ← down       |      |
                                                          west    east
                                                           |        |
                                                    [Flooded    [Echo
                                                     Passage]   Chamber]
                                                           |        |
                                                          south   south
                                                            \      /
                                                        [Underground Lake]
                                                               |
                                                             north
                                                               |
                                                    [The Mechanism Chamber]
                                                               |
                                                             down
                                                               |
                                                      [The Sanctum] ← NIP-44 sealed
```

---

## Places (12 total)

### ACT 1 — Surface

---

**Place 1 — Sunlit Clearing** (genesis, from MVP)
- Starting point. Weathered journal explains the world.
- Exits: `north` (Dark Cave), `west` (Ruined Chapel), `east` (Hermit's Cottage), `south` (dangling — open for builders)
- Features: weathered journal, ancient standing stone
- The standing stone is examinable — reveals a clue about the lake
- NEW: standing stone has `state: weathered` — examine reveals inscription, transitions to `read`

---

**Place 2 — Forest Path** (new)
- North of clearing, leads nowhere yet — another dangling exit inviting builders
- Features: old signpost (broken, illegible), moss-covered marker stone
- Marker stone: examine → reveals fragment of a map (clue)
- Purpose: introduces the world's openness, shows a dangling exit naturally

---

**Place 3 — Hermit's Cottage** (new)
- East of clearing. The hermit is here.
- Features: cluttered workbench, bookshelves, locked chest
- NPC: the Hermit — knows about the lake, gives hints, multi-entry dialogue
- Locked chest: `requires item:iron-key` → contains serpent amulet
- Serpent amulet: `requires` for the mechanism chamber
- NEW MECHANIC: NPC dialogue, item-gated feature

---

**Place 4 — Ruined Chapel** (from MVP, expanded)
- West of clearing. More atmospheric, more content.
- Features: crumbling inscription (puzzle), stained glass window, altar
- Altar: `state: dry → watered → prayed` — water from flooded passage, prayer after
- Altar in `prayed` state: reveals hidden portal to chapel crypt
- Stained glass: examine → reveals clue about the serpent and the mechanism
- NEW MECHANIC: multi-step feature state machine, hidden portal revealed by state

---

**Place 5 — Chapel Crypt** (new, hidden)
- Below the chapel. Hidden until altar reaches `prayed` state.
- Features: stone sarcophagus, wall carvings
- Sarcophagus: `state: sealed → open` — requires Brand strength (no NPCs here, so requires item: iron crowbar)
- Contains: the serpent staff (needed for the mechanism)
- Wall carvings: examine → reveals the final clue about the mechanism sequence
- NEW MECHANIC: hidden place, item-gated container

---

### ACT 2 — Underground

---

**Place 6 — Dark Cave** (from MVP, expanded)
- Bronze altar (expanded state machine), iron key (item)
- NEW: lantern item here — `state: off`, `counter: battery 200`
- Places deeper in the cave require lantern `on`
- Adds darkness mechanic to the world
- NEW MECHANIC: item state, counter, requires item in specific state

---

**Place 7 — Cave Network** (new)
- Below the dark cave. Junction point.
- `requires item:brass-lantern state:on` — dark without it
- Exits: west (Flooded Passage), east (Echo Chamber), up (Dark Cave)
- Features: cave paintings — examine reveals clue about the lake's history
- NEW MECHANIC: place darkness via requires on place event

---

**Place 8 — Flooded Passage** (new)
- West of cave network. Partially flooded.
- Features: submerged object (item: water bottle — the flooded passage IS the water source for the altar)
- `requires item:brass-lantern state:on`
- Water bottle: `state: empty → full` when filled here
- Purpose: connects the altar puzzle (chapel) to the underground (cave)
- Exits: east (Cave Network), south (Underground Lake)

---

**Place 9 — Echo Chamber** (new)
- East of cave network. Strange acoustics.
- Features: resonating crystal formation
- Crystal: examine → plays a sound sequence clue (text description of notes)
- This is the hint for the mechanism sequence puzzle
- `requires item:brass-lantern state:on`
- Exits: west (Cave Network), south (Underground Lake)

---

**Place 10 — Underground Lake** (from MVP, expanded)
- The heart of the world. Atmospheric centrepiece.
- Features: iron gate (expanded), jetty, something moving in the water
- Something in the water: examine → reveals it's harmless — a large serpent, ancient, watchful
- The serpent recognises the amulet: `requires item:serpent-amulet` to approach safely
- `requires-not item:brass-lantern state:off` — the dark here is different, not lethal
- Exits: `up` (Cave Network via either passage), `north` (Mechanism Chamber — gated)
- NEW MECHANIC: requires-not, NPC-like feature behaviour

---

**Place 11 — The Mechanism Chamber** (new, replaces simple gated portal)
- North of lake. The mechanism itself — a puzzle room.
- `requires item:serpent-amulet` — the lake serpent won't let you pass without it
- Features: the mechanism (sequence puzzle), orichalcum channels, wall instructions
- Mechanism puzzle: sequence of interactions in correct order using serpent staff
- `requires item:serpent-staff` — staff needed to interact with mechanism
- On solve: hidden portal to Sanctum revealed, crypto key derived
- Exits: `south` (Underground Lake), `down` (Sanctum — hidden until puzzle solved)
- NEW MECHANIC: sequence puzzle, on-complete revealing hidden portal

---

**Place 12 — The Sanctum** (from MVP, expanded)
- NIP-44 sealed. Key derived from mechanism puzzle.
- Win prose: what sleeps beneath the lake, what the player has done
- A final clue pointing outward — hints at a larger world
- Dangling exits with evocative labels — invitation for other builders
- NEW: `media: text/plain` ASCII art of the sanctum chamber

---

## New Mechanics Introduced (client implementation order)

| # | Mechanic | Place | Tags involved |
|---|---------|-------|---------------|
| 1 | Feature state machine | Chapel altar | `state`, `transition`, `on-interact set-state` |
| 2 | Hidden portal via state | Chapel → Crypt | `state: hidden`, `requires feature state` |
| 3 | Item state (lantern) | Dark Cave | `state`, `transition`, `counter`, `on-move decrement` |
| 4 | Place darkness | Cave Network | `requires item state` on place |
| 5 | Item as instrument | Flooded Passage | water bottle `state: empty → full` |
| 6 | Multi-place puzzle | Altar + Flooded Passage | `requires` cross-place state |
| 7 | NPC + dialogue | Hermit's Cottage | `npc`, `dialogue`, multi-entry points |
| 8 | Item-gated feature | Hermit's chest | `requires item` on feature |
| 9 | Sequence puzzle | Mechanism Chamber | `puzzle-type: sequence`, `ordered: true` |
| 10 | `on-complete` reveal | Mechanism Chamber | `on-complete set-state visible portal` |
| 11 | `roams-when` | (future NPC) | deferred |
| 12 | `media` tag | Sanctum | `media: text/plain` ASCII art |
| 13 | `content-type: markdown` | Select places | richer prose |

---

## Items (full set)

| Item | Location | Key mechanic |
|------|----------|-------------|
| `iron-key` | Dark Cave | Gates hermit's chest |
| `brass-lantern` | Dark Cave | State + counter, gates dark places |
| `water-bottle` | Flooded Passage | State: empty → full, needed for altar |
| `iron-crowbar` | Forest Path marker stone | Gates sarcophagus |
| `serpent-amulet` | Chapel Crypt sarcophagus | Gates lake passage and mechanism |
| `serpent-staff` | Chapel Crypt sarcophagus | Needed for mechanism puzzle |

---

## NPCs

**The Hermit** — static, cottage
- Multi-entry dialogue based on what player has discovered
- Knows about the lake, the serpent, the mechanism
- Gives hints at appropriate depths
- Entry points: `greeting`, `after-cave`, `after-chapel`, `after-lake`
- Does not give items directly — hints only

---

## Clue Chain (full)

| # | Clue | Source | Points to |
|---|------|--------|-----------|
| 1 | Journal entry | Weathered journal (clearing) | There is a lake underground |
| 2 | Standing stone inscription | Standing stone (clearing) | The serpent guards something old |
| 3 | Map fragment | Marker stone (forest path) | The cave network layout |
| 4 | Altar inscription | Bronze altar (dark cave) | "The lake remembers what the cave forgets" |
| 5 | Stained glass | Chapel window | The serpent and the staff |
| 6 | Wall carvings | Chapel crypt | The mechanism sequence |
| 7 | Cave paintings | Cave network | The lake's ancient history |
| 8 | Echo chamber tones | Crystal formation | The mechanism note sequence |
| 9 | Hermit dialogue | The Hermit | Meta-hints, world context |
| 10 | Willy's message | Sanctum (win) | The wider world |

---

## Event Count

| Type | Count |
|------|-------|
| `place` | 12 |
| `portal` | 16 |
| `item` | 6 |
| `feature` | ~20 |
| `clue` | 10 |
| `puzzle` | 2 |
| `npc` | 1 |
| `dialogue` | ~8 nodes |
| `consequence` | 2 |
| **Total** | **~77** |

---

## Narrative Tone

Dark, quiet, ancient. Not threatening — contemplative. The lake has been here longer than everything. The player is a visitor, not a hero. The serpent is not an enemy. The mechanism is not a weapon. What's in the sanctum is not treasure — it's knowledge.

The world should feel like somewhere that exists whether or not the player is there.

