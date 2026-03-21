# FOAKLOAR — World Authoring Guide
*How to design, write, and publish a world*

---

## Repository

All FOAKLOAR documentation lives at:
**https://github.com/dangeross/foakloar/tree/main/docs**

| Folder | Contents |
|--------|---------|
| `authoring/` | Authoring guides for LLMs and Micro-world example |
| `spec/` | `foakloar-design.md` — full schema spec and tag reference |
| `reference/` | Zork, Fate of Atlantis, Goonies reference implementations |
| `worlds/` | Complete test worlds |

For a new authoring session: this guide is the starting point. For full tag reference: `foakloar-design.md`. For worked examples: see the `worlds/` folder.

---

## What You Are Building

A FOAKLOAR world is a **directed graph of events**. Places are nodes. Portals are edges. Everything else — features, items, NPCs, puzzles, clues — hangs off the nodes as content and behaviour.

The player navigates the graph by following portals. They interact with content to change state. State changes open new paths, reveal new content, and eventually reach the win state.

The story emerges from the player's movement through the world — from what they find, earn, and unlock. You design the world; the player writes the story by playing it.

The spec is the only constraint. Everything within it is available to you. The schema supports non-linear structures, unreliable worlds, ambiguous goals, NPCs who work against the player, win states that cost something, and worlds where the player's role is never named. Use whatever the world needs.

---

## Collaboration Mode

Every world event declares a `collaboration` tag controlling who can extend the world:

```json
["collaboration", "closed"]   // only you — canonical story worlds
["collaboration", "vouched"]  // you + explicitly listed collaborators
["collaboration", "open"]     // anyone — community worlds
```

For `vouched`, list trusted builders directly on the world event:
```json
["collaborator", "<PUBKEY>"]  // multiple allowed
```

Choose your mode before publishing — it is the first trust decision of the world. A closed world is a finished story. An open world is an invitation.

---

## Before You Write a Single Event

Three questions. Answer them in any order, but answer all three before writing events.

**1. What does winning feel like?**
Not the mechanism — the feeling. What does the player carry with them after the win state decrypts? This is the thesis of the world. Every place, item, and clue exists to earn that feeling.

**2. What is the progression chain?**
The sequence of things the player must acquire or discover to reach the win state. Work backwards from it. The chain does not have to be linear — it can branch, have false paths, or be driven by relationship state rather than items. But every link must be reachable, and no link should require itself. Write the chain before designing any place.

**3. What is the voice?**
One sentence, present tense, describing how the world sounds. Not genre, not setting — voice. Every content field, transition text, and clue will be checked against it. A world that drifts in voice loses the player before the puzzles do.

---

## World Design

### The map

A FOAKLOAR map is a graph. Draw it before writing events — boxes for places, lines for portals, annotations for gates. The map reveals structural problems that are invisible in prose.

A good map has:
- At least one place that rewards curiosity without being required
- At least one intentional dangling exit — a signal to collaborators, or a narrative door that never opens
- A sense of depth — places that feel closer to the truth as the player goes deeper

Linearity, density, sprawl — these are choices, not mistakes. A world with one long corridor can be more compelling than one with twenty branching rooms, if the corridor is right for the story. Make the map the world needs, not the map a checklist would produce.

### The critical path

Every element required to reach the win state is on the critical path. Everything else is enrichment.

The critical path should be completable without optional content. Beyond that, its length, difficulty, and shape are design decisions — not things to optimise toward a default.

### Place content

Write the prose for every place before writing any event JSON. Read it in sequence along the critical path. Does the voice stay consistent? Does tension build or release at the right moments? Fix prose before touching events — it's the cheapest point to catch problems.

### Mechanics

For each place on the critical path, know what the player *does* here. A place with nothing to do is a corridor. Make it a room.

| Interaction | Tags used | Purpose |
|-------------|-----------|---------|
| Examine feature → reveal clue | `on-interact examine`, `set-state visible` | Information |
| Pick up item | `item` tag on place | Acquisition |
| Use item on feature → state change | `on-interact`, external `set-state` | Progression |
| Talk to NPC | `dialogue` | Information + character |
| Solve puzzle | `puzzle`, `on-complete` | Gate + satisfaction |
| Navigate gated portal | `requires` on portal | Tension + reward |

### Write events

> **Before writing any JSON:** open `foakloar-design.md`. All concrete tag shapes, action types, and trigger names live there. This guide covers how to think about authoring — the spec covers exact syntax. You will need both.

Write in this order:

1. **World event** — title, theme, start, relay hints
2. **Place events** — with exits declared
3. **Portal events** — one per connection. Check every exit slot has a portal or is intentionally dangling.
4. **Item events** — before features that reference them
5. **Feature events** — with full transition tables
6. **Clue events** — after features that reveal them
7. **Puzzle events** — after all `requires`-referenced events exist
8. **NPC events** — after all dialogue nodes exist
9. **Dialogue events** — nodes bottom-up (leaf nodes before root)
10. **Consequence events** — last, referenced by everything else
11. **Sound events** — score the world against the voice and the win-state feeling

### The consistency check

Before publishing, verify:

- Every `exit` slot declared on a place has a portal referencing it — or is intentionally dangling
- Every `requires` references an event that actually exists
- Every `on-complete` has a blank trigger-target `""`
- Every item the player needs is reachable without needing itself
- Every NPC has at least one dialogue entry point with no `requires`
- The win state is reachable by following the critical path exactly

---

## Writing Guidelines

### Place content (`content` field)

- **Present tense.** "The cave opens into darkness" not "the cave opened."
- **Sensory detail first.** What does the player see, hear, smell? Let the setting speak before the puzzle.
- **Don't explain the puzzle.** The place describes the environment. Features describe the interactable things. Clues carry the information. Keep them separate.
- **Match the voice.** Read your place content against your voice sentence. Does it sound right?
- **Length serves the world.** Two sentences can be enough. Five paragraphs can be right. The measure is whether the text earns its length — not an arbitrary limit.

```
// Thin — no texture, no world
"You are in a cave. There is an altar here."

// Right — earns its length
"A cave of bare rock, salt-damp and cold. A bronze altar stands against
the far wall — too deliberate to be natural, too old to have a name."
```

### Transition text

Fires when a state change happens. Inline, immediate, brief. It's feedback, not description.

```
// Too long
"You pour the water from the bottle onto the altar. The stone surface
absorbs the water slowly. The ancient inscription begins to glow faintly."

// Right
"The stone drinks the water. Something stirs in the inscription."
```

### Clue content

Points somewhere without arriving. The player should understand what it means *after* they've followed it, not before.

```
// Too explicit
"The inscription says: pour water on the altar to unlock the crypt."

// Right
"The lake remembers what the cave forgets."
```

### Dialogue

Character voice first, information second. An NPC who speaks in exposition is a signpost, not a character.

```
// Signpost
"To reach the mechanism, you will need the serpent amulet and the
serpent staff, both found in the chapel crypt."

// Character
"You found the cave. Good. Most don't make it that far."
[pause]
"The lake doesn't want to be found. Neither do the things that guard it."
```

Information should be inferrable from character voice, not delivered directly. The player should feel clever for understanding, not informed for being told.

---

## Narrative Patterns

Named structures that work well with the schema. Use them deliberately — or invert them deliberately.

### The Item Chain

A gates B gates C gates win.

```
iron-key → chest → amulet + staff → mechanism → crypto-key → sanctum
```

Each link should feel like a discovery, not a chore. The chain can be linear, branching, or convergent. A chain the player loses track of is a design choice, not a mistake — if disorientation serves the world, let it.

### The Gated Secret

A place, feature, or clue that's present but inaccessible. The player sees it, can't reach it, and remembers it.

```
Portal: state: hidden — the player doesn't know it exists yet
Feature: state: locked — the player knows it exists but can't interact
Place: requires item — the player can see the entrance but not enter
```

Use gated secrets to create anticipation. The player builds a mental model of "things I need to come back for."

### The Environmental Puzzle

The world itself is the puzzle. No puzzle event needed — just `requires` on portals and state changes on features.

```
Altar requires water → water from flooded passage → altar transitions →
crypt portal revealed
```

The player figures this out by reading the environment, not by being told. This is the most satisfying puzzle type.

### The Converging Paths

Two routes to the same destination with different costs. One requires player skill/knowledge, the other requires payment or a trade.

```
Mechanism Chamber:
  - Long route: full item chain (free, takes time)
  - Short route: pay the Ferryman (10 sats, skips puzzle chain)
```

Converging paths respect player agency. They don't block players who are stuck; they reward players who engaged with the world.

### The NPC Broker

An NPC who knows something the player needs. Information is gated behind relationship, payment, or puzzle state.

```
Hermit:
  - greeting: generic (always available)
  - after-cave: richer hints (requires cave visited)
  - after-chapel: deeper context (requires altar state)
```

The broker's knowledge should feel earned. The player who has explored more gets more.

The broker can also be an obstacle, a liar, or someone whose help costs more than it's worth. NPCs do not have to be helpers.

### The Palimpsest

The world has layers. The current world sits on top of older worlds. Ruins, inscriptions, cave paintings — evidence of what came before. Players who read carefully learn history that enriches the present.

Use `clue` events with rich content for this. The history doesn't need to be on the critical path — it rewards curiosity.

### What the schema does not prevent

Before pulling back from something that feels unconventional, check whether the spec actually prevents it. It probably doesn't. The schema supports:

- Worlds where the player's stated goal is not the real goal
- Multiple valid paths to the win state with meaningfully different outcomes
- Win states that are sealed behind moral choices, not just puzzle solutions
- Places that can only be reached by failing something first
- NPCs who actively work against the player, provide false information, or steal items
- Clues that are comprehensible in hindsight but deliberately misleading in foresight
- Worlds with no obvious protagonist arc — the player as witness rather than hero
- Dialogue trees where the wrong answer is more interesting than the right one
- Payment gates that create genuine decisions about cost versus progress

The spec is the floor, not the ceiling.

---

## Branching and Consequences

### State is the branching primitive

There is no special branching mechanic in FOAKLOAR. Forks in the narrative are expressed through `set-state` on any trigger — dialogue choice, item used, puzzle solved, place visited. The state carries through the world and gates future content wherever `requires` is declared.

```
player sides with hermit in dialogue
  → set-state "ally" on journal item
      → hidden portal requires journal:ally
      → collector NPC reacts differently
      → hermit gives different item on next encounter
```

Any trigger can set state. Any event can require state. The branch is wherever you put the state, not a special construct.

### `on-fail` — wrong answer consequences

Riddle and cipher puzzles can declare `on-fail` tags that fire on each wrong answer:

```json
// Simple damage on wrong answer
["on-fail", "", "deal-damage", "2"],

// Alert a guard on wrong answer
["on-fail", "", "set-state", "alarmed", "30078:<PUBKEY>:the-lake:npc:guard"],

// Attempt-limited puzzle — alarm after 3 wrong answers
["counter",    "attempts", "3"],
["on-fail",    "", "decrement", "attempts"],
["on-counter", "down", "attempts", "0", "consequence", "30078:<PUBKEY>:the-lake:consequence:alarm"]
```

`on-fail` fires on every wrong answer. The second element is always `""`. Pair with a counter and `on-counter` for attempt limits.

`on-fail` is only valid on `riddle` and `cipher` — sequence and observe puzzles have no wrong-answer state.

---

## Common Mistakes

### `requires` with blank state — checking presence only

To require an item is in inventory (any state), use a blank state string:

```json
// Requires iron-key in inventory, any state
["requires", "30078:<PUBKEY>:the-lake:item:iron-key", "", "You need the key."]

// Requires lantern specifically in "on" state
["requires", "30078:<PUBKEY>:the-lake:item:brass-lantern", "on", "It is pitch black."]

// Requires altar has been prayed at
["requires", "30078:<PUBKEY>:the-lake:feature:altar", "prayed", "The crypt won't open yet."]
```

The shape is always: `["requires", "<event-a-tag>", "<state-or-blank>", "<description>"]`. Blank state means "this event exists in the player's state map" — for items, this means it is in inventory.

---

### Conditional clue visibility — use `requires` on the clue, not inline on `on-interact`

`on-interact` takes four elements maximum. There is no inline `requires` argument:

```json
// WRONG — 6th element is not valid schema, will be ignored
["on-interact", "examine", "set-state", "visible", "30078:<PUBKEY>:clue:lamp-running",
  "requires: 30078:<PUBKEY>:feature:lamp running"]

// CORRECT — put requires on the clue itself
// The on-interact fires unconditionally; the clue's own requires gates visibility
["on-interact", "examine", "set-state", "visible", "30078:<PUBKEY>:clue:lamp-running"]

// On the clue event:
["requires", "30078:<PUBKEY>:feature:lamp", "running", ""]
```

The client evaluates `requires` on the clue before rendering it — even after `set-state visible` has fired. The clue stays hidden until the condition passes.

---

### Using a state value as an `on-interact` verb

`on-interact` fires when the **player types a verb**. The first argument is always a verb string — something the player can input. State values (like `running`, `lit`, `open`) are never player commands and should never appear as the verb argument:

```json
// WRONG — "running" is a state, not a verb the player types
["on-interact", "running", "set-state", "visible", "30078:<PUBKEY>:portal:secret"]

// CORRECT — fire the reveal from the action that causes the state change
["on-interact", "use", "set-state", "running",  "30078:<PUBKEY>:feature:lamp"],
["on-interact", "use", "set-state", "visible",  "30078:<PUBKEY>:portal:secret"]
```

**Pattern: state-triggered actions belong on the event that causes the state change**, not on the event that changes state. If cranking the mechanism runs the lamp and reveals a portal, all three `set-state` actions go on the mechanism's `on-interact use` handler — not on the lamp itself.

---

### `on-encounter` and `on-attacked` — trigger-target filter and external targets

Both triggers use the trigger-target slot as a **filter** and support an optional external action target:

**`on-encounter` filter values:**
- `""` — fires when any entity (player or NPC) is in the same place
- `"player"` — fires only when the player enters
- NPC `a`-tag — fires only when that specific NPC is present

**`on-attacked` filter values:**
- `""` — fires on any attack regardless of weapon
- item `a`-tag — fires only when attacked with that specific weapon

`"player"` is not valid on `on-attacked` — attacks always come from the player in the current model.

```json
// on-encounter — fires on player entry, deals damage
["on-encounter", "player", "deal-damage", "3"],

// on-encounter — proximity trap, any entity, delegates to consequence
["on-encounter", "", "consequence", "30078:<PUBKEY>:the-lake:consequence:proximity-trap"],

// on-encounter — alert another NPC when player arrives
["on-encounter", "player", "set-state", "alerted", "30078:<PUBKEY>:the-lake:npc:captain"],

// on-attacked — counter-attack, any weapon
["on-attacked", "", "deal-damage", "3"],

// on-attacked — silver sword triggers consequence
["on-attacked", "30078:<PUBKEY>:the-lake:item:silver-sword", "consequence", "30078:<PUBKEY>:the-lake:consequence:silver-weakness"]
```

---

### Inline actions vs consequences — when to use each

Use **inline actions** for simple, single-effect reactions:

```json
// Good inline — one action, unique to this trigger
["on-attacked", "", "deal-damage", "3"]
["on-health", "down", "50%", "set-state", "wounded"]
```

Use a **consequence event** when:
- Multiple actions fire together
- The same reaction fires from multiple different triggers
- Actions target several external events at once

```json
// Complex reaction — consequence bundles it cleanly
["on-attacked", "30078:<PUBKEY>:the-lake:item:silver-sword",
  "consequence", "30078:<PUBKEY>:the-lake:consequence:silver-weakness"]
```

The rule of thumb: **if one action fires, inline it. If multiple actions fire together, or the same reaction fires from multiple triggers, use a consequence.**

---

### Contained items declared on the place

Items inside a container must not also be declared on the place event:

```json
// WRONG — iron-key is inside the chest, not on the ground
["item",    "30078:<PUBKEY>:the-lake:item:iron-key"],     // ← bug
["feature", "30078:<PUBKEY>:the-lake:feature:ancient-chest"]

// CORRECT — only the chest is on the ground
["feature", "30078:<PUBKEY>:the-lake:feature:ancient-chest"]
// iron-key is declared via ["contains", ...] on the chest event
```

If an item appears in both a place `item` tag and a `contains` tag, it exists in two places simultaneously — the player can pick it up from the ground AND take it from the chest. The item would duplicate.

---

### Orphaned requires
```json
// WRONG — this state is never set anywhere
["requires", "30078:<PUBKEY>:the-lake:feature:altar", "blessed", "..."]

// The altar only transitions to: dry → watered → prayed
// "blessed" will never be true — this portal is permanently locked
```
**Fix:** Before publishing, trace every `requires` condition back to an action that sets it.

### Missing portals
Declaring `["exit", "north"]` on a place without publishing a portal that fills that slot. The exit renders in the UI but goes nowhere.

**Fix:** Every unintentional dangling exit should have a portal. Intentional dangling exits are fine — but be deliberate about them.

### Puzzle solutions in clues
```
// WRONG
"The inscription reads: insert the staff into the left channel first,
then the right, then the centre."

// RIGHT
"Three channels, worn smooth by something that fit them perfectly.
The order matters. The lake knows which."
```
**Fix:** Clues point. They don't instruct.

### Dialogue that breaks character for exposition
See Writing Guidelines above.

### Items with conflicting nouns and verbs
```json
// WRONG — "take" is both a noun alias and a common verb
["noun", "take", "tablet", "stone take"]
["verb", "examine", "look", "take"]

// take examine → parser ambiguity
```
**Fix:** Noun aliases should never match canonical verbs: `go`, `take`, `drop`, `examine`, `look`, `use`, `give`, `talk`, `open`, `close`, `attack`.

### Transition text too long
Transition text renders inline between input and next description. More than one sentence feels like the game is talking over itself.

### No dangling exits
Every world should have at least one exit with no portal — a visible invitation for collaborators to extend the world, a hint at a larger world, or a door that simply never opens.

---

## The Voice Checklist

Before publishing, read every `content` field and transition text against your voice sentence.

Ask each piece of text:
- Does it sound like it belongs here?
- Does it use the right register (formal/informal, lyrical/plain)?
- Does it avoid explaining what the player already knows?
- Does its length serve the world, or is it filling space?

---

## Critical Schema Rules

Non-obvious behaviours that aren't immediately inferrable from tag shapes. Read these before authoring any events.

---

### `on-complete` always has a blank trigger-target

`on-complete` follows the generic `on-*` shape — the trigger-target is always `""`:

```json
// WRONG
["on-complete", "set-state", "solved"]

// CORRECT
["on-complete", "", "set-state", "solved"]
["on-complete", "", "give-item", "30078:<PUBKEY>:the-lake:item:key"]
["on-complete", "", "set-state", "visible", "30078:<PUBKEY>:the-lake:portal:secret-door"]
```

---

### `exit` tag — two valid forms on place events

Place events support two exit tag forms:

```json
// Short form — slot only. Portal is the sole source of destination and label.
["exit", "north"]

// Extended form — hints destination on the place itself.
// The portal still owns the canonical binding.
["exit", "30078:<PUBKEY>:the-lake:place:dark-cave", "north", "A dark cave entrance looms."]
```

Both are valid. Use the short form when you want the place to be purely structural. Use the extended form when authoring place and portal together — it makes the world map readable at a glance. The portal wins if there is any conflict.

Portal `exit` tags always use the extended form — place-ref second, slot third, optional label fourth:

```json
// WRONG on a portal
["exit", "north", "30078:<PUBKEY>:the-lake:place:dark-cave"]

// CORRECT on a portal
["exit", "30078:<PUBKEY>:the-lake:place:dark-cave", "north", "A dark cave entrance looms."]
```

---

### `requires` — no type argument, type inferred from referenced event

```json
// WRONG
["requires", "item", "30078:<PUBKEY>:the-lake:item:iron-key", "", "You need the key."]

// CORRECT
["requires", "30078:<PUBKEY>:the-lake:item:iron-key", "", "You need the key."]
["requires", "30078:<PUBKEY>:the-lake:feature:altar", "prayed", "The crypt won't open yet."]
["requires", "30078:<PUBKEY>:the-lake:npc:thief", "gone", "The thief blocks the way."]
```

Type (item, feature, NPC, puzzle, portal) is inferred from the referenced event's `type` tag. The `requires` shape is always: event ref, state (blank for any state / just presence), description.

---

### `on-counter` — unified, threshold always present

`on-counter-zero` and `on-counter-low` no longer exist. Both are replaced by `on-counter` with a threshold argument. `0` is a valid threshold:

```json
// WRONG
["on-counter-zero", "battery", "set-state", "dead"]
["on-counter-low",  "battery", "20", "set-state", "flickering"]

// CORRECT
["on-counter", "down", "battery", "0",  "set-state", "dead"]
["on-counter", "down", "battery", "20", "set-state", "flickering"]
```

Three fire conditions: threshold crossing, state entry re-evaluation, load reconciliation on reload.

---

### Noun tags never contain articles

The client strips `the`, `a`, `an` from input before matching. Noun tags must be bare:

```json
// WRONG
["noun", "lantern", "the lantern", "a brass lantern"]

// CORRECT
["noun", "lantern", "brass lantern"]
// matches: lantern, the lantern, a lantern, the brass lantern, a brass lantern
```

---

### Sequence puzzles auto-evaluate on state change

A `puzzle-type: sequence` puzzle does not require an explicit player action to complete. The client evaluates all `requires` tags on the puzzle automatically after any feature or item state change in the current place. When all conditions pass, `on-complete` fires immediately.

The player completes the last step → `on-complete` fires → portal appears. No "submit" needed.

---

### `on-interact` external target — fourth argument

An `on-interact` tag can target an external event rather than self. The event `a`-tag is the fourth argument:

```json
// Self (default) — no fourth argument
["on-interact", "pull", "set-state", "pulled"]

// External target — sets state on a different event
["on-interact", "insert", "set-state", "placed", "30078:<PUBKEY>:the-lake:feature:mechanism"]
["on-interact", "pour",   "set-state", "watered","30078:<PUBKEY>:the-lake:feature:altar"]
```

Use this for item-to-feature interactions: the item's `on-interact` changes the feature's state.

---

### Every exit slot should have a portal — unless it's intentional

Declaring `["exit", "<place-ref>", "north"]` on a place declares a slot. A portal event fills that slot. If no portal exists, the exit renders in the UI but goes nowhere.

This is **not always a mistake**. Dangling exits are a legitimate creative tool:

- An invitation for collaborators to extend the world
- A hint at a larger world beyond the current story
- A narrative device — a door the player can see but never open
- A placeholder for a future episode

**Hidden portals still require exit slot declarations.** A portal with `state: hidden` is not visible to the player, but its slot must still be declared on the place event. The place declares the slot exists; the portal controls accessibility.

```json
// Place — slot declared even though portal is hidden
["exit", "30078:<PUBKEY>:my-world:place:secret-room", "east", "A panel in the wall."]

// Portal — hidden until condition met
["state",   "hidden"],
["exit",    "30078:<PUBKEY>:my-world:place:secret-room", "east", "..."],
["requires","30078:<PUBKEY>:my-world:feature:lamp", "running", "Nothing visible."]
```

**Rule:** every exit should have a portal *or* a deliberate reason not to. Unintentional dangling exits (forgotten portals) are bugs. Intentional ones are storytelling.

**Label text for intentional dangling exits:**

```json
// Hints at a larger world beyond
["exit", "south", "The road south continues — beyond the edge of this map."]

// Signals collaboration opportunity
["exit", "west",  "An overgrown path leads west into unmapped territory."]

// Narrative device — a door that never opens
["exit", "east",  "A sealed door. Whatever is behind it, it isn't for you."]
```

One portal per connection. The portal declares both directions:

```json
["exit", "30078:<PUBKEY>:place:cave",     "south", "Back to the cave."],
["exit", "30078:<PUBKEY>:place:clearing", "north", "Into the darkness."]
```

---

### NIP-44 win state — how puzzle answer connects to decryption key

> **Critical for LLM authorship — two separate responsibilities:**
>
> 1. **`answer-hash`** — you MUST compute and output the real SHA256 hex digest. A placeholder publishes a permanently unsolvable puzzle.
>
> 2. **NIP-44 win place content** — output the plaintext win prose clearly labelled. The publishing tool encrypts it. Never leave the `content` field blank or silently omitted.

The puzzle `answer-hash` verifies the player's input. The answer itself is also the key material for decrypting the NIP-44 sealed win place. The flow:

1. Author generates a keypair — call it the lock keypair
2. Author NIP-44 encrypts the win place content to the lock public key
3. Author derives `answer-hash = SHA256(answer + salt)` and publishes it on the puzzle event
4. Player solves the puzzle — client verifies `SHA256(player_input + salt)` matches `answer-hash`
5. On match, client uses `player_input` as key material to derive the NIP-44 conversation key
6. Client decrypts the win place content

The answer and the decryption key are the same thing — the puzzle answer IS the key. Both the `answer-hash` and the NIP-44 encryption must use the same underlying answer. Both steps are required.

---

### Client state uses full `a`-tags as keys

localStorage state keys are full `a`-tags, not d-tags:

```json
// WRONG
{ "states": { "the-lake:feature:altar": "watered" } }

// CORRECT
{ "states": { "30078:<PUBKEY>:the-lake:feature:altar": "watered" } }
```

---

## Validation

Before publishing, validate your world file against the validation API. This catches structural errors that are invisible at authoring time — dangling references, placeholder hashes, missing tags, verb collisions — and returns actionable fix instructions.

**Endpoint:** `POST https://foakloar.vercel.app/api/validate`

**New world:**
```bash
curl -X POST https://foakloar.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d @my-world-events.json
```

**Expansion (adding to an existing published world):**
```json
{
  "events": [ ...new events only... ],
  "answers": { "my-world:puzzle:new-riddle": "the answer" },
  "externalRefs": [
    "my-world:place:clearing",
    "my-world:npc:hermit",
    "my-world:item:iron-key"
  ]
}
```

`externalRefs` lists d-tags that exist in the already-published base world but aren't in this file. References to them are silently skipped.

**Response:**
```json
{
  "valid": false,
  "eventCount": 12,
  "summary": { "errors": 1, "warnings": 2 },
  "issues": [
    {
      "level": "error",
      "dTag": "my-world:place:gate",
      "eventType": "place",
      "category": "dangling-ref",
      "message": "npc references \"my-world:npc:ghost\" which is not in this world",
      "tag": "npc, 30078:<PUBKEY>:my-world:npc:ghost",
      "fix": "Either create a new event with type \"npc\" with d-tag \"my-world:npc:ghost\", or remove the [\"npc\", \"...\"] tag from \"my-world:place:gate\"."
    }
  ]
}
```

**Workflow:**
1. Generate world JSON
2. POST to the validation endpoint
3. Apply each `fix` instruction
4. Re-validate until `"valid": true`
5. Publish

`valid: true` means zero errors. Warnings should be resolved but do not block publishing.

**What the validator checks:**
- Missing or empty required tags
- Dangling cross-event references
- Answer hash verification (SHA-256) — catches placeholder hashes
- NIP-44 encryption requirements
- Puzzle type mismatches
- Verb alias collisions between co-located entities
- `on-complete` blank trigger-target
- `on-counter` direction argument
- Inline `requires` on exit tags (must be on the portal, not the place exit)

---

## Publishing Your World

The output JSON has two top-level keys — `answers` and `events`. The `answers` map drives NIP-44 encryption and `answer-hash` verification. The publishing tool uses it before signing and strips it entirely — the plaintext never reaches the relay.

**Keys in the `answers` map are puzzle `d`-tag values.**

```json
{
  "answers": {
    "my-world:puzzle:final-riddle": "the plaintext answer"
  },
  "events": [
    {
      "kind": 30078,
      "tags": [
        ["d",    "my-world:world"],
        ["t",    "my-world"],
        ["w",    "foakloar"],
        ["type", "world"],
        ["title","My World"]
      ],
      "content": "World synopsis."
    },
    {
      "kind": 30078,
      "tags": [
        ["d",            "my-world:place:sanctum"],
        ["t",            "my-world"],
        ["type",         "place"],
        ["content-type", "application/nip44", "text/markdown"],
        ["puzzle",       "my-world:puzzle:final-riddle"]
      ],
      "content": "# Win State\n\nThe plaintext win prose — the publishing tool encrypts this."
    }
  ]
}
```

For worlds with no NIP-44 sealed events, `answers` can be an empty object `{}` or omitted.

The `pubkey`, `id`, `sig`, and `created_at` fields are added by the FOAKLOAR client when signing.

**Publishing order matters.** Publish in authoring order:

1. World event
2. Place events
3. Portal events
4. Item events
5. Feature events
6. Clue events
7. Puzzle and payment events
8. NPC events
9. Dialogue events
10. Consequence events

**How to publish:**
Import your JSON file into the FOAKLOAR client's builder mode. The tool encrypts NIP-44 content, verifies hashes, strips the `answers` map, signs each event, and publishes to your configured relays.

**After publishing:**
Your world is live as soon as the events reach the relay:
```
yoursite.com/world/npub1...
```

To update an event, republish with the same `d` tag and pubkey — NOSTR replaceable events mean the relay keeps only the latest version.

**Final deliverable is valid JSON with no JS comments** — strip all `// comments` before publishing.

---

## Sound Scoring

Sound is a progressive enhancement — players who can't hear it miss nothing. Sound is atmosphere, never information. Never gate a puzzle solution, navigation choice, or narrative reveal behind sound alone.

Score the sound against the treatment and the win-state feeling, not against the map. The question is not "what does this place sound like" but "what should the player feel here, and how does sound reinforce that."

---

### How it works — `type: sound` events

Sound definitions are FOAKLOAR events with their own `d`-tag. You define them once and reference them anywhere. The client builds a Strudel chain from the tags in declaration order.

```json
{
  "kind": 30078,
  "tags": [
    ["d",          "the-lake:sound:cave-drone"],
    ["t",          "the-lake"],
    ["type",       "sound"],
    ["note",       "c2 ~ ~ ~"],
    ["oscillator", "sine"],
    ["slow",       "4"],
    ["room",       "0.8"]
  ],
  "content": ""
}
```

Then play it on any event:

```json
// Place — atmospheric drone, always present
["sound", "30078:<PUBKEY>:the-lake:sound:cave-drone", "ambient", "0.7"],

// Item — lamp hum, only when on
["sound", "30078:<PUBKEY>:the-lake:sound:lamp-hum",   "layer",   "0.3", "on"],

// Consequence — death jingle
["sound", "30078:<PUBKEY>:the-lake:sound:death-jingle", "effect", "1.0"]
```

Play tag shape: `["sound", "<sound-a-tag>", "<role>", "<volume>", "<state?>"]`

---

### Sound parameters

`note` always comes first — it establishes the pattern everything else modifies:

| Parameter | Values | Effect |
|-----------|--------|--------|
| `note` | mini-notation | Pitch sequence — always first |
| `noise` | *(no value)* | White noise oscillator (DSP, not a sample) — for wind, rain, fire, static |
| `oscillator` | `sine` `triangle` `sawtooth` `square` | Waveform shape |
| `gain` | 0.0–1.0 | Base volume (multiplies with play tag volume) |
| `slow` | float > 1 | Stretch relative to global tempo |
| `fast` | float > 1 | Compress relative to global tempo |
| `pan` | -1.0–1.0 | Stereo — -1 left, 0 centre, 1 right |
| `attack` | seconds | Fade-in. `0` = instant, `0.5` = gradual swell. |
| `sustain` | seconds | Note duration. Short = responsive to state changes. Long = droning. |
| `release` | seconds | Fade-out. `0` = hard cut, `0.3` = natural decay. |
| `lpf` | Hz | Low-pass filter — warmer, muffled. Drones, underwater. |
| `hpf` | Hz | High-pass filter — thinner, airy. Shimmer, radio. |
| `room` | 0.0–1.0 | Reverb wet/dry |
| `roomsize` | 1–10 | Reverb room size (use with `room`) |
| `delay` | time, feedback | Echo. Two values: `["delay", "0.5", "0.3"]` |
| `crush` | 1–16 | Bit crush — lo-fi/retro distortion |
| `shape` | 0.0–1.0 | Soft saturation — warmth |
| `degrade-by` | 0.0–1.0 | Random note dropout — organic texture |
| `rand` | min, max | Random gain — crackle, shimmer. Two values. |
| `jux` | `rev` | Stereo width — normal left, reversed right |
| `arp` | `up` `down` `updown` | Arpeggiate chords |
| `rev` | *(no value)* | Reverse pattern order |

Mini-notation: `c3 e3 g3` sequence, `c3*4` repeat, `c3 ~ ~ ~` note with rests, `[c3 e3] g3` sub-pattern.

---

### Pattern library — moods and their recipes

Use these as starting points, not prescriptions:

| Mood | Tags | Use when |
|------|------|----------|
| Dread | `note c2~~~`, `oscillator sine`, `slow 4`, `lpf 300`, `room 0.7` | Underground, ancient |
| Tension | `note b2~b2~`, `oscillator triangle`, `slow 2` | Unsolved puzzle, danger |
| Danger | `note c3 b2 c3 b2`, `oscillator sawtooth`, `fast 2` | Active threat |
| Mystery | `note c3~eb3~`, `oscillator sine`, `slow 3`, `delay 0.4 0.2` | Unknown territory |
| Wonder | `note c4 e4 g4 c5`, `oscillator triangle`, `slow 2`, `room 0.4` | Discovery, arrival |
| Resolution | `note c3 e3 g3`, `oscillator sine`, `slow 3` | Puzzle solved, door open |
| Stillness | `noise`, `lpf 100`, `gain 0.1` | Aftermath, near-silence |
| Mechanical | `note c2~~~`, `oscillator square`, `fast 4` | Machinery, clock |
| Ethereal | `note c5 g5 c6`, `oscillator sine`, `jux rev`, `slow 4`, `room 0.9` | Magical, otherworldly |
| Horror | `noise`, `crush 4`, `rand 0.1 0.4`, `lpf 600` | Degraded, corrupted signal |
| Wind | `noise`, `lpf 400`, `rand 0.05 0.2`, `slow 4` | Open air, caves |
| Fire | `noise`, `lpf 800`, `crush 6`, `rand 0.1 0.4`, `degrade-by 0.3` | Campfire, hearth |

---

### State-conditional layers — the most powerful tool

The state element on the `sound` play tag gates the layer to a specific event state. When the state changes, the layer enters or leaves the mix automatically:

```json
// Lamp room — drone always, tension only while lamp is dark
["sound", "30078:<PUBKEY>:the-lake:sound:cave-drone", "ambient", "0.6"],
["sound", "30078:<PUBKEY>:the-lake:sound:tension",    "layer",   "0.4", "dark"],

// The moment the lamp runs, tension layer drops. No extra code needed.
```

**Tip — use `sustain` and `release` for responsive state layers:**
A layer with default sustain may linger after its state gate deactivates. Short values make it cut off cleanly:

```json
["sustain", "0.5"], ["release", "0.1"]
```

---

### Layering budget

| Event type | Sound budget |
|-----------|-------------|
| World event | `bpm` only |
| Place | 1 `ambient`, 1 optional `layer` |
| Feature / item / NPC | 1 `layer` or `effect` |
| **Active simultaneously** | **3–4 maximum** |

Silence is part of the palette. A place with no `sound` tags inherits a quieter mix.

---

### Sample libraries — extending the sound palette

Without a `samples` tag on the world event, only built-in oscillators and `noise` are available. Add `samples` to unlock named audio files:

```json
["samples", "dirt"]     // 217 sample banks — drums, synths, nature, voice, instruments
["samples", "classic"]  // 53 acoustic/orchestral — recorder, sax, organ, timpani, bongo
```

**Recommended samples by world type:**

| World type | Useful samples |
|-----------|---------------|
| Coastal / lighthouse | `wind`, `birds`, `birds3`, `breath` |
| Underground / cave | `industrial`, `if`, `space`, `cosmicg` |
| Forest / nature | `birds`, `birds3`, `insect`, `wind`, `fire` |
| Ancient / medieval | `recorder_alto_sus`, `ocarina`, `tabla`, `world`, `east` |
| Horror / dread | `crow`, `voodoo`, `glitch`, `industrial`, `wind` |
| Sci-fi / machine | `future`, `tech`, `bleep`, `blip`, `invaders` |
| Combat / tension | `bd`, `hh`, `sd`, `stab`, `hit` |
| Magical / wonder | `arpy`, `fm`, `cosmicg`, `space`, `juno` |

Custom GitHub repos: `["samples", "github:my-username/my-world-sounds"]`

Full sample list: [spec/sample-presets.md](https://github.com/dangeross/foakloar/blob/main/docs/spec/sample-presets.md)

---

### BPM

```json
["bpm", "72"]   // world event — global default
["bpm", "96"]   // place event — override on entry
```

`bpm` is a standalone tag on world/place events. Individual sound events use `slow`/`fast` for relative adjustment.

---

### `sound` as an action type — triggered one-shots

For sounds that mark a specific moment rather than playing passively:

```json
["on-complete", "", "sound", "30078:<PUBKEY>:the-lake:sound:victory", "0.9"],
["on-fail",     "", "sound", "30078:<PUBKEY>:the-lake:sound:wrong",   "0.6"],
["on-interact", "use", "sound", "30078:<PUBKEY>:the-lake:sound:mechanism-clunk"],
["on-health",   "down", "0", "sound", "30078:<PUBKEY>:the-lake:sound:death-jingle"]
```

**The rule:** moment → action type. State → `sound` play tag on the event.

**`gain` × `volume`:** the sound event's `gain` tag sets a base level. The play tag's volume controls the mix at point of use. They multiply: `finalVolume = gain × volume`.

---

### What NOT to do

```json
// DON'T — sound carries puzzle information
// Always pair sound with visible state changes or transition text.

// DON'T — too many layers
// More than 3-4 active layers simultaneously becomes noise.

// DON'T — inline patterns in play tags
// WRONG:
["sound", "c2 ~ ~ ~ slow(pad)", "ambient", "0.7"]
// RIGHT — define a type:sound event, reference by a-tag
["sound", "30078:<PUBKEY>:the-lake:sound:cave-drone", "ambient", "0.7"]
```
