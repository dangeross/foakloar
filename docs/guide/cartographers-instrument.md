# Showcase: The Cartographer's Instrument

An advanced showcase world that demonstrates how sound, state-gated audio layers, NPC dialogue, features, requires-gating, and endgame quests work together to create a unified experience.

> **Try it:** Import [cartographers-instrument.json](tutorials/cartographers-instrument.json) to play the world.

---

## Concept

An ancient observatory, abandoned for centuries. The player finds a strange instrument — part astrolabe, part music box — and must carry it to three resonators in different wings of the building. Each resonator, when activated, adds a new sound layer to the ambient mix. The three notes form a chord (C-E-G). When all three are singing, the Star Chamber opens below the central hall, and the full composition plays as the endgame fires.

The world is small (six rooms) but mechanically dense. Every system it uses — items, features, state transitions, requires-gating, sound layers, NPC dialogue, portals, and endgame quests — works in concert.

---

## Mechanics Used

### Sound layers and state-gated audio

Seven sound events define the world's audio:

- **Space drone** — a sub-bass C1 sine wave on the world event. Plays everywhere as a constant hum.
- **Entrance wind** — filtered white noise layered on the Observatory Entrance.
- **Lunar drone** — a low C2 triangle wave. A `sound` layer tag on the Lunar Resonator feature (West Wing), gated by state `active`. Mirrored by an echo feature in the Central Hall and Star Chamber.
- **Solar arpeggio** — a G4 sine arpeggio with delay. A `sound` layer on the Solar Resonator feature (East Wing), gated by `active`. Mirrored by an echo feature.
- **Stellar melody** — an E3 triangle melody line. A `sound` layer on the Stellar Resonator feature (Tower), gated by `active`. Mirrored by an echo feature.
- **Activation chime** — an FM-style bell, fired as a one-shot sound action when any resonator is activated.
- **Full composition** — a C-E-G chord progression with stereo reversal (`jux rev`). Plays as the ambient in the Star Chamber.

The key technique: each resonator feature carries a state-gated sound layer in its home wing. For rooms where the resonance should be heard remotely (the Central Hall and Star Chamber), three "echo" features act as sound relays. Each echo feature carries a `sound` layer tag gated by `active`, and the resonator's `on-interact` sets the echo's state alongside its own. This keeps the resonators out of rooms where they don't physically exist while still propagating their audio. As the player activates resonators, the Central Hall's soundscape builds from silence to a full three-part chord.

### Features with requires and on-interact

Each resonator is a `type: feature` with:

- A `requires` tag checking for the Instrument item — the player must hold it to interact.
- A `verb` tag (`play`, `tune`, `activate`, `use`).
- An `on-interact` tag that fires `set-state active` on the resonator itself.
- An `on-interact` tag that fires the activation chime as a `sound` action.
- `transition` tags providing the prose for dormant-to-active and active-to-active states.

Each wing also contains a chart feature (Lunar Chart, Solar Chart, Stellar Chart) that provides the clue for which note to play. These are plain features with descriptive content — no verb tags, examined via the built-in `examine` command.

### Portal gating with requires

Two portals use `requires` to enforce progression:

- **Hall to Tower** — requires both the Lunar Resonator and Solar Resonator in state `active`. The player must activate the west and east wings before climbing to the tower.
- **Hall to Star Chamber** — requires the Stellar Resonator in state `active`. Since the tower requires the other two, this creates a natural three-step progression.

### NPC dialogue

The Ghost of the Cartographer sits in the Central Hall with a four-option dialogue tree. Each option leads to a different explanation node, and all paths converge on a final node describing the three resonators in detail. The dialogue uses `option` tags with blank next-refs for conversation endpoints.

### Endgame quest

A single `quest-type: endgame` quest requires all three resonators active plus a landmark feature set to `visited` via `on-enter` on the Star Chamber place. The landmark pattern ensures the endgame only fires when the player physically enters the chamber — not just when the resonators are active.

---

## Walkthrough

1. Pick up The Instrument at the Observatory Entrance.
2. Go north to the Central Hall. Talk to the Ghost for hints.
3. Go west. Examine the Lunar Chart for the clue. Play the resonator.
4. Return east, then go east again. Examine the Solar Chart. Play the resonator.
5. Return west. The spiral staircase is now unblocked — go up.
6. Examine the Stellar Chart. Play the resonator. Something opens below.
7. Go down twice. Enter the Star Chamber. The endgame fires.

The order of the west and east wings does not matter. Both must be activated before the tower becomes accessible.

---

## Sound Design Notes

### Layer architecture

The world uses a layered approach to audio that builds as the player progresses:

- **Base layer** (always on): the space drone on the world event provides a constant sub-bass foundation. The entrance wind adds texture to the starting room.
- **Per-wing layers** (state-gated): each resonator feature carries a `sound` layer tag gated by `active` in its home wing. Three "echo" features in the Central Hall and Star Chamber mirror the resonator states, propagating the audio to rooms where the resonance should be heard. Activation in one room is heard in both the hub and the finale.
- **Full composition** (endgame): the Star Chamber plays all three echo layers plus a dedicated ambient that adds a resolving chord progression with stereo width.

### Frequency separation

Each layer occupies a different register to avoid frequency masking:

- Lunar drone: C2 (low register, triangle wave, LP filtered at 300 Hz)
- Stellar melody: E3 (mid register, triangle wave, moderate sustain)
- Solar arpeggio: G4-G5 (high register, sine wave, delay for shimmer)

The separation ensures clarity even when all three play simultaneously in the Central Hall.

### Tempo and timing

The world BPM is set to 72 — slow enough for a contemplative mood. Individual sound events use `slow` to stretch cycles further. The lunar drone uses `slow: 4` for a very gradual pulse. The solar arpeggio plays at cycle speed for rhythmic interest. The stellar melody uses `slow: 2` as a middle ground.

### Effects budget

At maximum, the Star Chamber plays four simultaneous sounds: the full composition ambient plus three layers. This stays within the recommended 3-4 layer budget. The Central Hall builds to three layers as resonators activate. Most rooms play one or two.

---

## Event Summary

| Type | Count | Events |
|------|-------|--------|
| World | 1 | World manifest with theme, BPM, global ambient |
| Place | 6 | Observatory Entrance, Central Hall, West Wing, East Wing, Tower, Star Chamber |
| Portal | 5 | Entrance-Hall, Hall-West, Hall-East, Hall-Tower (gated), Hall-Chamber (gated) |
| Item | 1 | The Instrument |
| Feature | 10 | 3 resonators, 3 charts, 3 echo features, 1 landmark |
| NPC | 1 | Ghost of the Cartographer |
| Dialogue | 5 | Greeting + 4 conversation nodes |
| Sound | 7 | Space drone, entrance wind, lunar drone, solar arpeggio, stellar melody, activation chime, full composition |
| Quest | 1 | Endgame quest |
| **Total** | **37** | |
