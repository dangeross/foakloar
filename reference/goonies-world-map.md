# The Goonies — World Map & Design Notes

## Premise

You play as Mikey Walsh. Your house is being foreclosed. The Fratellis are on your trail.
One-Eyed Willy's treasure is the only thing that can save the Goon Docks.

The other Goonies travel with you as companion NPCs — each has a moment where their
specific skill matters. You can't progress without them at key points.

---

## Companions

| NPC | Skill | Key moment |
|-----|-------|------------|
| Mouth | Spanish translation | Map clues, Fratelli cellar |
| Data | Gadgets | Traps, escapes |
| Chunk | Food, honesty | Confesses to Fratellis — buys time |
| Brand | Strength | Opens stuck passages |
| Andy | Music | Pipe organ password |
| Steph | Observation | Spots hidden things |

All companions start at the Walsh house. Some separate and rejoin at key points.
Chunk is captured mid-game — his absence is a `requires-not` condition for some paths.
Sloth starts as a Fratelli ally, transitions to Goonie.

---

## Antagonists

| NPC | Behaviour | Route |
|-----|-----------|-------|
| Mama Fratelli | Roaming boss | Restaurant → tunnels |
| Francis Fratelli | Combat | Tunnels → ship |
| Jake Fratelli | Combat | Restaurant → tunnels |
| Sloth | Initially hostile → ally | Fratelli hideout → ship |

---

## World Structure

```
[Walsh House / Attic]
        |
       down
        |
[Walsh Garage]
        |
       south
        |
[Goon Docks / Street]
        |
      east
        |
[Fratelli Restaurant Exterior]
        |
      enter
        |
[Fratelli Restaurant]
        |
      down (hidden — requires Chunk distraction)
        |
[Fratelli Basement / Cellar]
        |
      north
        |
[Wishing Well Chamber]
        |
      down (requires coin)
        |
[Upper Tunnels]
    /       \
   west     east
   |          |
[Trap Room] [Map Chamber]
   |          |
  south     south
   \         /
    [Waterfall Cave]
        |
      down
        |
[Bone Organ Chamber]
        |
    (pipe organ puzzle)
        |
[Lower Tunnels]
        |
      north
        |
[Fratelli Chase Sequence]
        |
      down
        |
[Underground Cove]
        |
   [One-Eyed Willy's Ship] ← NIP-44 sealed
```

---

## Key Puzzle Moments

### 1. Attic — The Map
- Mikey finds the doubloon and the map in the attic
- Map starts `sealed` — doubloon is the NIP-44 key
- Decrypting reveals the first clue: the wishing well

### 2. Fratelli Restaurant — Chunk's Distraction
- Fratellis are blocking the cellar entrance
- `requires npc:chunk present` — Chunk creates a distraction
- Chunk is then captured by the Fratellis
- `chunk-captured` flag affects later puzzles

### 3. Fratelli Cellar — Mouth Translates
- Spanish warning sign on the tunnel entrance
- `requires npc:mouth present` — Mouth translates
- Without him the warning is ignored and a trap fires

### 4. Wishing Well — Moral Choice
- Andy finds coins at the wishing well
- Taking them fires a consequence (bad karma — trap later)
- Leaving them fires a different consequence (safe passage)
- This is the branching puzzle pattern — client presents choice

### 5. Trap Room — Data's Gadgets
- Multiple traps: blade pendulum, water jet, spike floor
- Data's `Pinchers of Peril`, `Slick Shoes`, `Bully Blinders` each neutralise one trap
- Each gadget is a single-use item that sets a trap feature to `disabled`

### 6. Map Chamber — Steph's Observation
- Hidden passage behind a fake wall
- `requires npc:steph present` — she spots the tell
- Reveals portal to Waterfall Cave

### 7. Bone Organ — Andy's Music
- Pipe organ made of bones blocks the passage
- Password is a sequence of notes from the map clue
- `puzzle-type: sequence` — `requires npc:andy present`
- Wrong note fires a consequence (trap)
- Andy has `state: playing` mid-puzzle — tense

### 8. Sloth's Switch
- Sloth is chained in the Fratelli hideout
- Initially `state: hostile`
- Chunk befriends him (requires Chunk — but Chunk is captured...)
- Sloth breaks free, transitions to `state: ally`
- Now a companion NPC who can open the ship's sealed door

### 9. Fratelli Chase
- Fratellis catch up in the lower tunnels
- Timed sequence — `on-move` counter
- Must reach the cove before counter reaches zero
- Consequence fires if caught: `game-over`

### 10. One-Eyed Willy's Ship — The Treasure
- Ship is NIP-44 sealed — key derived from completing the bone organ puzzle
- Willy's skeleton at the helm — examine triggers win prose
- Fratellis arrive — final confrontation
- Sloth (if rescued) blocks the Fratellis
- Mikey's choice: take the treasure or leave it for Willy

---

## State Flags (expressed as event states, not flags)

| Event | State journey | Meaning |
|-------|--------------|---------|
| `item:map` | `sealed → partial → full` | Map revealed section by section |
| `item:doubloon` | `found → used` | Key for map, then wishing well |
| `npc:chunk` | `present → captured → reunited` | Captured mid-game, rejoins at ship |
| `npc:sloth` | `hostile → neutral → ally` | Befriended by Chunk |
| `feature:wishing-well` | `active → drained` | Taking coins drains it |
| `feature:pipe-organ` | `locked → playing → solved` | Andy's puzzle |
| `feature:ship-door` | `sealed → open` | Requires Sloth ally state |
| `place:ship` | `sealed` | NIP-44, key from organ puzzle |
| `puzzle:organ-password` | `unsolved → solved` | Gates ship key |

---

## Path Notes

Unlike Fate of Atlantis there are no diverging paths — it's a single throughline.
But there are **moral choices** with diverging consequences:
- Wishing well coins: take vs leave
- Leaving Sloth behind vs rescuing him
- Taking the treasure vs leaving it for Willy

These use the branching puzzle pattern — client presents choice, fires appropriate `on-complete`.

The Chunk capture is a **forced state change** — narrative, not player choice.
Expressed as a consequence fired when Chunk's distraction succeeds.

---

## Interesting Schema Tests

1. **NPC capture and return** — Chunk goes from `present` to `captured` to `reunited`.
   Three-state NPC lifecycle expressed as transitions.

2. **Sloth allegiance** — starts `hostile`, no route tags (confined). When freed,
   gains route and transitions to `ally`. Dynamic route assignment via consequence.

3. **Map as progressive clue** — single item with multiple `sealed → visible` stages.
   Each stage unlocked by reaching a new part of the world.

4. **Timed chase** — `on-move` counter on the chase corridor. `on-counter-zero` fires
   capture consequence. First real-time pressure mechanic in the schema.

5. **Gadgets as single-use items** — each Data gadget has `counter: uses, 1`.
   On use, sets a trap feature to `disabled`, decrements counter, transitions to `spent`.

6. **Companion gate puzzles** — six different NPCs each gate at least one puzzle.
   Tests `requires npc present` at scale.

7. **Moral choice consequences** — wishing well and treasure ending each fork on
   a client-presented choice rather than a `requires` condition.
