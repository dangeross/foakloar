# FOAKLOAR — Micro-World Example
*The Lighthouse Keeper — a complete 5-place world*

---

## Design Notes

This document is a complete worked example of an original FOAKLOAR world — conceived for the schema, not adapted from an existing game or film. It demonstrates every core mechanic in a small, coherent narrative.

**Tone:** Melancholy, coastal, quiet. The lighthouse has been dark for years. The keeper left something behind.

**Placeholders:** All `a`-tag references use `<PUBKEY>` as the author pubkey placeholder. Before publishing, replace every `<PUBKEY>` with your actual hex pubkey. The `answer-hash` is already computed (`be253f50...`) — SHA256 of `"47.3N-9.8W"` + salt. The signal alcove `content` field must be replaced with real NIP-44 ciphertext before publishing. See the Win State section for the two-step setup.

**Dangling exit:** The Shore Path has a south exit with no portal — a deliberate omission. It hints at a larger world (the village the keeper came from, the road he walked away on) without requiring the author to build it. It also demonstrates the pattern for collaborators: the south exit is an open invitation. See the authoring guide for label text conventions on dangling exits.

**Arc:** The player arrives at a dark lighthouse. They restore power to the light. In doing so they learn why the keeper left — and find the last thing he wrote.

**Item chain:**
```
Find crank handle → restore lamp mechanism → lamp runs → 
light reveals hidden signal → signal decoded → 
derive key → decrypt keeper's final log
```

**Win state:** NIP-44 sealed final log, decrypted by key derived from decoded signal.

**Map:**
```
[Shore Path] ── north ── [Lighthouse Base]
                               |
                              up
                               |
                        [Lamp Room] ← win state here
                               |
                             east (hidden until lamp runs)
                               |
                        [Signal Alcove] ← sealed until lamp runs
                               
[Keeper's Cottage] ── east ── [Lighthouse Base]
```

---

## World Event

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",            "lighthouse:world"],
    ["t",            "lighthouse"],
    ["w",             "foakloar"],
    ["type",         "world"],
    ["title",        "The Lighthouse Keeper"],
    ["author",       "FOAKLOAR Example"],
    ["version",      "1.0.0"],
    ["lang",         "en"],
    ["tag",          "mystery"],
    ["tag",          "coastal"],
    ["tag",          "melancholy"],
    ["start",        "30078:<PUBKEY>:lighthouse:place:shore-path"],
    ["relay",        "wss://relay.damus.io"],
    ["collaboration","closed"],
    ["theme",        "monochrome"],
    ["colour",       "text",    "#d4d0c8"],
    ["colour",       "dim",     "#6b6b6b"],
    ["colour",       "title",   "#ffffff"],
    ["colour",       "clue",    "#a8c4d4"],
    ["font",         "courier"],
    ["cursor",       "beam"],
    ["effects",      "typewriter"],
    ["bpm",          "60"],
    ["content-type", "text/markdown"]
  ],
  "content": "The light has been dark for three years.\n\nThe keeper's cottage is empty. His logbook is sealed.\n\nSomething brought you here."
}
```

---


## Sound Events

```json
// Coastal drone — shore path atmosphere
{ "kind": 30078, "tags": [["d","lighthouse:sound:coastal-drone"],["t","lighthouse"],["type","sound"],["note","c3 ~ ~ ~"],["oscillator","sine"],["slow","4"]], "content": "" }

// Base drone — heavy, mechanism waiting
{ "kind": 30078, "tags": [["d","lighthouse:sound:base-drone"],["t","lighthouse"],["type","sound"],["note","c2 ~ ~ ~"],["oscillator","sine"],["slow","6"],["room","0.6"]], "content": "" }

// Base pulse — slow mechanical heartbeat
{ "kind": 30078, "tags": [["d","lighthouse:sound:base-pulse"],["t","lighthouse"],["type","sound"],["note","c2 ~ ~ ~"],["oscillator","square"],["fast","2"]], "content": "" }

// Lamp tension — dark, unsolved feel
{ "kind": 30078, "tags": [["d","lighthouse:sound:lamp-tension"],["t","lighthouse"],["type","sound"],["note","b2 ~ b2 ~"],["oscillator","triangle"],["slow","2"]], "content": "" }

// Lamp hum — electrical hum when running
{ "kind": 30078, "tags": [["d","lighthouse:sound:lamp-hum"],["t","lighthouse"],["type","sound"],["note","c5 ~ ~ ~"],["oscillator","sine"],["fast","8"]], "content": "" }

// Mechanism clunk — industrial one-shot
{ "kind": 30078, "tags": [["d","lighthouse:sound:mechanism-clunk"],["t","lighthouse"],["type","sound"],["note","c2 c3 c4"],["oscillator","square"],["fast","4"],["crush","8"]], "content": "" }

// Signal bells — ethereal, from out at sea
{ "kind": 30078, "tags": [["d","lighthouse:sound:signal-bells"],["t","lighthouse"],["type","sound"],["note","c4 ~ g4 ~"],["oscillator","sine"],["slow","3"],["room","0.8"],["delay","0.4"]], "content": "" }

// Resolution — major chord, decoded
{ "kind": 30078, "tags": [["d","lighthouse:sound:resolution"],["t","lighthouse"],["type","sound"],["note","c3 e3 g3"],["oscillator","sine"],["slow","3"]], "content": "" }

// Silence — cottage near-silence
{ "kind": 30078, "tags": [["d","lighthouse:sound:silence"],["t","lighthouse"],["type","sound"],["note","~ ~ ~ ~"],["oscillator","sine"]], "content": "" }
```

---

## Places

### Place 1 — Shore Path (genesis)

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",        "lighthouse:place:shore-path"],
    ["t",        "lighthouse"],
    ["type",     "place"],
    ["title",    "Shore Path"],
    ["noun",     "shore", "path", "beach"],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:lighthouse-base", "north", "The lighthouse stands to the north."],
    ["exit",     "south", "The coast road south — beyond the edge of this map."],  // intentional dangling exit
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:tide-wrack"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:coastal-drone",  "ambient", "0.5"],
    ["content-type", "text/markdown"]
  ],
  "content": "A shingle path runs north along the coast. The lighthouse rises against a grey sky — dark, as it has been for years. The tide has left something in the wrack line."
}
```

### Place 2 — Lighthouse Base

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",        "lighthouse:place:lighthouse-base"],
    ["t",        "lighthouse"],
    ["type",     "place"],
    ["title",    "Lighthouse Base"],
    ["noun",     "lighthouse", "base", "ground floor"],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:shore-path",     "south",  "Back to the shore."],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:lamp-room",      "up",     "The spiral stair winds upward."],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:keepers-cottage","west",   "The keeper's cottage."],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:mechanism"],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:logbook-shelf"],
    ["item",     "30078:<PUBKEY>:lighthouse:item:crank-handle"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:base-drone",     "ambient", "0.6"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:base-pulse",     "layer",   "0.3"],
    ["content-type", "text/markdown"]
  ],
  "content": "The base of the lighthouse. Salt and rust. A mechanism occupies the centre of the room — the lamp drive, seized for lack of use. A crank socket gapes at its side. On a shelf by the stairs, a row of logbooks ends abruptly — the last spine blank."
}
```

### Place 3 — Lamp Room

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",        "lighthouse:place:lamp-room"],
    ["t",        "lighthouse"],
    ["type",     "place"],
    ["title",    "Lamp Room"],
    ["noun",     "lamp room", "top", "lantern room"],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:lighthouse-base", "down",  "Back down the stairs."],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:lamp"],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:lens"],,
    ["sound", "30078:<PUBKEY>:lighthouse:sound:lamp-tension",   "ambient", "0.5"],
    ["content-type", "text/markdown"]
  ],
  "content": "The lamp room at the top of the tower. The great lens is intact, dusty but undamaged. The lamp is cold. Through the glass, the sea stretches to the horizon. Something is out there — has always been out there."
}
```

### Place 4 — Keeper's Cottage

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",        "lighthouse:place:keepers-cottage"],
    ["t",        "lighthouse"],
    ["type",     "place"],
    ["title",    "Keeper's Cottage"],
    ["noun",     "cottage", "house", "cabin"],
    ["exit",     "30078:<PUBKEY>:lighthouse:place:lighthouse-base", "east", "Back to the lighthouse."],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:writing-desk"],
    ["feature",  "30078:<PUBKEY>:lighthouse:feature:cold-hearth"],,
    ["sound", "30078:<PUBKEY>:lighthouse:sound:silence",        "ambient", "0.2"],
    ["content-type", "text/markdown"]
  ],
  "content": "The keeper's cottage. Everything is as he left it — almost. A writing desk faces the window that looks toward the sea. The hearth is cold. The walls hold his whole life in small objects."
}
```

### Place 5 — Signal Alcove (hidden, NIP-44 sealed)

```json
{
  "kind": 30078,
  "pubkey": "<PUBKEY>",
  "tags": [
    ["d",            "lighthouse:place:signal-alcove"],
    ["t",            "lighthouse"],
    ["type",         "place"],
    ["title",        "Signal Alcove"],
    ["noun",         "alcove", "signal room", "east"],
    ["state",        "hidden"],
    ["exit",         "30078:<PUBKEY>:lighthouse:place:lamp-room", "west", "Back to the lamp room."],
    ["feature",      "30078:<PUBKEY>:lighthouse:feature:signal-panel"],
    ["feature",      "30078:<PUBKEY>:lighthouse:feature:final-log"],
    ["content-type", "application/nip44", "text/markdown"],
    ["puzzle",       "lighthouse:puzzle:signal-decode"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:signal-bells",   "ambient", "0.5"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:resolution",     "layer",   "0.4", "decoded"]
  ],
  "content": "# The Keeper's Final Log

The coordinates are not a place. They never were.

They are a bearing — to something that has been answering the light for longer than this lighthouse has existed. Something that was here before the coast had a name.

I went to see. I won't write what I found.

The light should stay dark. But if you've read this — you lit it. You found the signal. You know the coordinates.

You'll go too.

I understand now why I stayed so long.

*— H.M., Keeper, Day 10,847*" — see win prose below, encrypt with your lock keypair before publishing>"
}
```

---

## Portals

```json
// Shore ↔ Lighthouse Base
{
  "kind": 30078, "tags": [
    ["d",    "lighthouse:portal:shore-to-base"],
    ["t",    "lighthouse"],
    ["type", "portal"],
    ["exit", "30078:<PUBKEY>:lighthouse:place:shore-path",        "north", "The lighthouse."],
    ["exit", "30078:<PUBKEY>:lighthouse:place:lighthouse-base",   "south", "The shore path."]
  ],
  "content": ""
}}

// Lighthouse Base ↔ Lamp Room
{
  "kind": 30078, "tags": [
    ["d",    "lighthouse:portal:base-to-lamp"],
    ["t",    "lighthouse"],
    ["type", "portal"],
    ["exit", "30078:<PUBKEY>:lighthouse:place:lighthouse-base", "up",   "Up the spiral stair."],
    ["exit", "30078:<PUBKEY>:lighthouse:place:lamp-room",       "down", "Down to the base."]
  ],
  "content": ""
}}

// Lighthouse Base ↔ Cottage
{
  "kind": 30078, "tags": [
    ["d",    "lighthouse:portal:base-to-cottage"],
    ["t",    "lighthouse"],
    ["type", "portal"],
    ["exit", "30078:<PUBKEY>:lighthouse:place:lighthouse-base",  "west", "The keeper's cottage."],
    ["exit", "30078:<PUBKEY>:lighthouse:place:keepers-cottage",  "east", "The lighthouse."]
  ],
  "content": ""
}}

// Lamp Room → Signal Alcove (hidden until lamp runs)
{
  "kind": 30078, "tags": [
    ["d",       "lighthouse:portal:lamp-to-alcove"],
    ["t",       "lighthouse"],
    ["type",    "portal"],
    ["state",   "hidden"],
    ["exit",    "30078:<PUBKEY>:lighthouse:place:lamp-room",      "east", "A panel in the wall, previously invisible. It slides open."],
    ["exit",    "30078:<PUBKEY>:lighthouse:place:signal-alcove",  "west", "Back to the lamp room."],
    ["requires","30078:<PUBKEY>:lighthouse:feature:lamp", "running", "The lamp is dark. Nothing is visible."]
  ],
  "content": ""
}}
```

---

## Items

```json
// Crank Handle — found in shore wrack, needed for mechanism
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:item:crank-handle"],
    ["t",     "lighthouse"],
    ["type",  "item"],
    ["title", "Crank Handle"],
    ["noun",  "crank", "handle", "crank handle"],
    ["verb",  "examine", "look"],
    ["verb",  "use",     "insert", "turn", "fit"]
  ],
  "content": "A heavy iron handle, hexagonal socket at one end. Made to fit something specific."
}
```

---

## Features

```json
// Tide Wrack — shore, contains crank handle
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:tide-wrack"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Tide Wrack"],
    ["noun",       "wrack", "seaweed", "tide line", "debris"],
    ["state",      "unsearched"],
    ["transition", "unsearched", "searched", "Among the wrack: rope, shells, and something metal."],
    ["transition", "searched",   "searched", "You've already been through it."],
    ["verb",       "examine",    "look", "search", "rummage"],
    ["on-interact","examine",    "set-state",   "searched"],
    ["on-interact","examine",    "give-item",   "30078:<PUBKEY>:lighthouse:item:crank-handle"]
  ],
  "content": "A line of seaweed and debris left by the last high tide."
}

// Mechanism — lighthouse base, requires crank handle
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:mechanism"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Lamp Mechanism"],
    ["noun",       "mechanism", "drive", "machine", "socket"],
    ["state",      "seized"],
    ["transition", "seized",   "cranking", "The handle fits. You turn it. The mechanism groans — then catches."],
    ["transition", "cranking", "running",  "The mechanism runs. Above, the lamp wakes."],
    ["verb",       "examine",  "look"],
    ["verb",       "use",      "crank", "turn", "insert"],
    ["requires",   "30078:<PUBKEY>:lighthouse:item:crank-handle", "", "The socket needs something to turn it."],
    ["on-interact","use",      "set-state",  "cranking"],
    ["on-interact","use",      "set-state",  "cranking",   "30078:<PUBKEY>:lighthouse:feature:lamp"],
    ["on-interact","use",      "set-state",  "running",    "30078:<PUBKEY>:lighthouse:feature:lamp"],
    ["on-interact","use",      "set-state",  "visible",    "30078:<PUBKEY>:lighthouse:portal:lamp-to-alcove"],
    ["on-interact","use",      "consume-item","30078:<PUBKEY>:lighthouse:item:crank-handle"],
    ["on-interact","use",      "sound", "30078:<PUBKEY>:lighthouse:sound:mechanism-clunk", "0.9"],
    // Note: the portal reveal fires here — on the action that causes the lamp to run.
    // Never use on-interact with a state value as the verb — states are not player commands.
  ],
  "content": "The lamp drive. A crank socket gapes at its side."
}

// Lamp — lamp room, state driven by mechanism
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:lamp"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "The Lamp"],
    ["noun",       "lamp", "light", "lantern"],
    ["state",      "dark"],
    ["transition", "dark",     "cranking", "The lamp stirs. Warmth in the glass."],
    ["transition", "cranking", "running",  "The lamp is running. Light floods the room and cuts out to sea. Something out there catches it."],
    ["verb",       "examine",  "look"],
    ["sound", "30078:<PUBKEY>:lighthouse:sound:lamp-hum",       "layer",   "0.2", "running"],
    ["on-interact","examine",  "set-state",  "visible", "30078:<PUBKEY>:lighthouse:clue:lamp-dark"],
    ["on-interact","examine",  "set-state",  "visible", "30078:<PUBKEY>:lighthouse:clue:lamp-running"],
    // lamp-running clue visibility is gated by requires on the clue itself (state: hidden until lamp running)
  ],
  "content": "The great lamp. Cold and dark."
}

// Logbook Shelf — lighthouse base
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:logbook-shelf"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Logbook Shelf"],
    ["noun",       "shelf", "logbook", "logbooks", "books"],
    ["state",      "unread"],
    ["transition", "unread", "read", "Thirty years of entries. The last one ends mid-sentence."],
    ["verb",       "examine", "look", "read"],
    ["on-interact","examine", "set-state", "read"],
    ["on-interact","examine", "set-state", "visible", "30078:<PUBKEY>:lighthouse:clue:logbook-entry"]
  ],
  "content": "A shelf of logbooks. Thirty years of them. The last spine is blank."
}

// Writing Desk — cottage, clue about the keeper
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:writing-desk"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Writing Desk"],
    ["noun",       "desk", "writing desk", "table"],
    ["state",      "unread"],
    ["transition", "unread", "read", "A letter, begun and abandoned. 'If you find this, the light is dark. You know what to do.'"],
    ["verb",       "examine", "look", "read", "search"],
    ["on-interact","examine", "set-state", "read"],
    ["on-interact","examine", "set-state", "visible", "30078:<PUBKEY>:lighthouse:clue:desk-letter"]
  ],
  "content": "A writing desk. Something was written here and left."
}

// Cold Hearth — cottage, atmospheric
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:cold-hearth"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Cold Hearth"],
    ["noun",       "hearth", "fireplace", "fire"],
    ["verb",       "examine", "look"],
    ["on-interact","examine", "set-state", "visible", "30078:<PUBKEY>:lighthouse:clue:hearth-ash"]
  ],
  "content": "A fireplace, cold for years. Ash in the grate."
}

// Lens — lamp room, atmospheric / reinforces lamp mechanic
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:lens"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "The Fresnel Lens"],
    ["noun",       "lens", "fresnel", "glass"],
    ["verb",       "examine", "look"],
    ["on-interact","examine", "set-state", "visible", "30078:<PUBKEY>:lighthouse:clue:lamp-dark"]
  ],
  "content": "A great Fresnel lens, intact and dust-filmed. If the lamp ran, this would be visible for twenty miles."
}

// Signal Panel — alcove, the puzzle
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:signal-panel"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Signal Panel"],
    ["noun",       "panel", "signal", "dials", "switches"],
    ["state",      "dark"],
    ["transition", "dark",   "lit",     "The panel lights up. Dials, switches, a receiving display."],
    ["transition", "lit",    "decoded", "The signal resolves. A sequence of numbers. You know what they mean."],
    ["verb",       "examine","look"],
    ["verb",       "use",    "decode", "read", "tune"],
    ["on-interact","examine","set-state", "lit"],
    ["on-interact","examine","set-state", "visible", "30078:<PUBKEY>:lighthouse:clue:signal-instructions"]
  ],
  "content": "A signal panel, hidden behind the sliding wall. Active."
}

// Final Log — alcove, NIP-44 sealed
{
  "kind": 30078, "tags": [
    ["d",          "lighthouse:feature:final-log"],
    ["t",          "lighthouse"],
    ["type",       "feature"],
    ["title",      "Final Log"],
    ["noun",       "log", "logbook", "journal", "book"],
    ["state",      "sealed"],
    ["verb",       "examine", "look", "read", "open"]
  ],
  "content": "The blank-spined logbook from the shelf — it was here all along. Sealed."
}
```

---

## Puzzle

```json
// Signal puzzle — decode the panel sequence
{
  "kind": 30078, "tags": [
    ["d",           "lighthouse:puzzle:signal-decode"],
    ["t",           "lighthouse"],
    ["type",        "puzzle"],
    ["puzzle-type", "riddle"],
    ["answer-hash", "be253f50b555a1a2a91e899d4441691d5193c56c795c2ba108c05cc2f8832ac3"],
    ["salt",        "lighthouse:puzzle:signal-decode:v1"],
    ["requires",    "30078:<PUBKEY>:lighthouse:feature:signal-panel", "lit",   "The panel needs to be active first."],
    ["on-complete", "", "set-state",  "decoded",  "30078:<PUBKEY>:lighthouse:feature:signal-panel"],
    ["on-complete", "", "set-state",  "visible",  "30078:<PUBKEY>:lighthouse:feature:final-log"]
  ],
  "content": "The panel shows a receiving display. A signal from out at sea — coordinates, repeated. What are they?"
}
```

---

## Clues

```json
// Lamp dark — seen on first examine
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:lamp-dark"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "The Dark Lamp"],
    ["state", "hidden"]
  ],
  "content": "Dark for three years. The mechanism below could run it — if it had something to turn it with."
}

// Lamp running — seen when lamp is active
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:lamp-running"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "The Light"],
    ["state", "hidden"]
  ],
  "content": "The light cuts out to sea. Something in the water — far out, at bearing north-northeast — catches it and answers back."
}

// Logbook entry — last entry
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:logbook-entry"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "Last Entry"],
    ["state", "hidden"]
  ],
  "content": "Day 10,847. The signal came again at 03:00. Same coordinates. Same sequence. I know what's there. I know what I have to do. I've sealed the log. If the light runs again, you'll find it."
}

// Desk letter — cottage
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:desk-letter"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "Unfinished Letter"],
    ["state", "hidden"]
  ],
  "content": "If you find this, the light is dark. You know what to do. Light it. The signal will answer. The coordinates are the key — not the place, the sequence."
}

// Hearth ash — atmosphere
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:hearth-ash"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "Cold Ash"],
    ["state", "hidden"]
  ],
  "content": "Years of ash. Near the top: paper. He burned something before he left."
}

// Signal instructions — panel
{
  "kind": 30078, "tags": [
    ["d",     "lighthouse:clue:signal-instructions"],
    ["t",     "lighthouse"],
    ["type",  "clue"],
    ["title", "Signal Panel"],
    ["state", "hidden"]
  ],
  "content": "The receiving display shows coordinates in decimal degrees — latitude and longitude, separated by a dash. Enter them exactly as shown."
}
```

---

## Win Prose (signal alcove plaintext)

The following is the plaintext content of the signal alcove. An LLM can author this — but cannot perform the NIP-44 encryption. Before publishing, encrypt this text to your lock keypair and replace the signal alcove `content` field with the resulting ciphertext.

```
# The Keeper's Final Log

The coordinates are not a place. They never were.

They are a bearing — to something that has been answering the light
for longer than this lighthouse has existed. Something that was here
before the coast had a name.

I went to see. I won't write what I found.

The light should stay dark. But if you've read this — you lit it.
You found the signal. You know the coordinates.

You'll go too.

I understand now why I stayed so long.

— H.M., Keeper, Day 10,847
```

**To publish:** encrypt this text with NIP-44 to the public key of your lock keypair. The lock private key is derived from the puzzle answer (`47.3N-9.8W`). Use a NOSTR library (e.g. nostr-tools) to perform the encryption — this cannot be done by an LLM.

---

## Win State (Sanctum equivalent)

The final log is the win state. When the signal puzzle is solved, `final-log` becomes visible. The player examines it — the client derives a key from the puzzle answer and decrypts the NIP-44 content of the signal alcove place.

**How the decryption connects to the puzzle answer:**

1. The author generates a lock keypair before publishing
2. The signal alcove place content is NIP-44 encrypted to the lock public key
3. The puzzle `answer-hash` is `SHA256("47.3N-9.8W" + "lighthouse:puzzle:signal-decode:v1")`
4. The player enters `47.3N-9.8W` — client verifies hash match
5. Client uses `47.3N-9.8W` as key material to derive the NIP-44 conversation key
6. Client decrypts the signal alcove place content — win prose renders

The coordinates are simultaneously the puzzle answer and the decryption key. Both the `answer-hash` on the puzzle event and the NIP-44 encryption of the place content must use the same underlying answer — the author sets both up before publishing.

The decrypted content:

```markdown
# The Keeper's Final Log

The coordinates are not a place. They never were.

They are a bearing — to something that has been answering the light 
for longer than this lighthouse has existed. Something that was here 
before the coast had a name.

I went to see. I won't write what I found.

The light should stay dark. But if you've read this — you lit it. 
You found the signal. You know the coordinates.

You'll go too.

I understand now why I stayed so long.

*— H.M., Keeper, Day 10,847*
```

---

## Narrative Notes for LLM Authorship

**What makes this work:**

1. **The mystery is earned, not given.** The player pieces together who the keeper was from three independent sources (logbook, letter, hearth ash) before they know what happened to him. The win state answers the question those clues raised.

2. **Every place has a reason to exist.** Shore Path: arrival, crank handle. Lighthouse Base: mechanism, logbook, junction. Lamp Room: lamp state, lens, signal reveal. Cottage: character, desk letter. Alcove: signal panel, final log.

3. **The item chain is felt, not just mechanical.** The crank handle is found in tide wrack (the sea brought it back). The mechanism runs the lamp. The lamp reveals the signal. The signal is the key. Each step feels like discovery.

4. **The tone is consistent.** Every content field sounds like the same world: coastal, melancholy, matter-of-fact about strange things.

5. **The win state recontextualises everything.** After reading the final log, the player understands the dark lamp, the sealed logbook, the burned papers, the abandoned letter. Everything was already there.

**What an LLM should hold in mind when authoring:**

- The win state is the thesis. Everything else is evidence.
- Clues should be comprehensible in hindsight, not in foresight.
- The world should feel like it existed before the player arrived.
- Transition text is the world responding. Keep it brief and in the world's voice.
- If a place has nothing to do, cut it or add something.

---

## Event Count

| Type | Count |
|------|-------|
| `world` | 1 |
| `place` | 5 |
| `portal` | 4 (shore path south exit is intentionally dangling — no portal) |
| `item` | 1 |
| `feature` | 8 |
| `clue` | 6 |
| `puzzle` | 1 |
| **Total** | **26** |

---

*Total play time: approximately 20-30 minutes for a player reading carefully.*

---

## Publishing

Collect all events from this document into a single JSON array file — `lighthouse-events.json`. The events are listed in publishing order (world → places → portals → items → features → clues → puzzle). Import into the FOAKLOAR client's builder mode to sign and publish.

The `pubkey`, `id`, `sig`, and `created_at` fields are omitted from the listings above — the client adds them on signing. The `<PUBKEY>` placeholder throughout should be replaced with your actual pubkey before publishing.
