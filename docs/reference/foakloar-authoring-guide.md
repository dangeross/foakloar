# FOAKLOAR — World Authoring Guide
*How to design, write, and publish a world*

---

## Repository

All FOAKLOAR documentation lives at:
**https://github.com/dangeross/foakloar/tree/main/docs**

| Folder | Contents |
|--------|---------|
| `spec/` | `foakloar-design.md` — full schema spec and tag reference |
| `the-lake/` | The Lake world — a complete worked example of a medium-sized world |
| `reference/` | Zork, Fate of Atlantis, Goonies reference implementations. This authoring guide. Micro-world example. |

For a new authoring session: this guide is the starting point. For full tag reference: `foakloar-design.md`. For worked examples: see the `reference/` folder.

---

## What This Guide Is Not

This guide produces **event JSON and place prose** — not conventional prose fiction. A "short story" in FOAKLOAR terms is a micro-world: 3–7 places, a clue chain, and a win state, with place descriptions as the narrative layer. The output is a set of NOSTR events that a client renders into an interactive experience.

If you are expecting to write a short story and hand it to FOAKLOAR, that is not the flow. The story emerges from the player's movement through the world — from what they find, earn, and unlock. You design the world; the player writes the story by playing it.

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

## What You Are Building

A FOAKLOAR world is a **directed graph of events**. Places are nodes. Portals are edges. Everything else — features, items, NPCs, puzzles, clues — hangs off the nodes as content and behaviour.

The player navigates the graph by following portals. They interact with content to change state. State changes open new paths, reveal new content, and eventually reach the win state.

Your job as an author is to design a graph that tells a story through player movement and interaction — not through cutscenes, not through narration, but through what the player finds, earns, and unlocks.

---

## Before You Write a Single Event

Answer these questions first. They will save you from restructuring later.

**1. What is the win state?**
Not "what happens at the end" — what does the client *do* to declare the game won? In FOAKLOAR this is typically a NIP-44 sealed place that the player unlocks with a derived key. Define the win condition before anything else. Everything in the world is in service of earning that key.

**2. What is the item chain?**
The chain of objects the player must acquire to reach the win state. Work backwards from the win condition:

```
Win state requires: crypto-key
Crypto-key earned by: solving final puzzle
Final puzzle requires: item-B + item-C
Item-C requires: opening locked container
Locked container requires: item-A
Item-A found at: starting area
```

Write this chain before designing any place. It is the spine of the world. For a worked example of a full item chain, see The Lake in `the-lake/the-lake-world.md` — its chain runs: `iron-key → chest → amulet + staff → mechanism → crypto-key → sanctum`.

**3. What is the player's arc?**
How does the player's understanding change from start to finish? In The Lake: they start knowing nothing, discover something ancient sleeps beneath the ground, learn what it is, and decide whether to disturb it. The arc is about *knowledge*, not just item acquisition.

**4. How many places?**
Rule of thumb: one place per major beat in the story. The Lake has 12 places across three acts. An MVP world needs 5. A short story needs 3-7. More than 15 places for a first world is ambitious — keep scope tight.

**5. What is the tone?**
Define it in one sentence before writing any `content` fields. The Lake: *dark, quiet, ancient, contemplative — the world has been here longer than everything.* Every place description, transition text, and clue should sound like it came from the same voice.

---

## World Design Process

### Step 1 — Draw the map

On paper or a whiteboard. Boxes for places, lines for portals. Label exit slots (`north`, `down`, `east`). Mark which portals are gated (`requires`). Mark the win state.

**Good map properties:**
- The player can reach every place without needing items they haven't found yet (unless that's intentional gating)
- There is at least one exploration branch that isn't on the critical path — somewhere to go that rewards curiosity without being required
- The map has a clear sense of direction — deeper = more dangerous/closer to the win state
- At least one dangling exit with no portal — an invitation for collaborators

**Bad map properties:**
- Linear — every place has exactly one exit forward and one back. No exploration, no getting lost.
- Too many branches too early — player is overwhelmed before they know anything
- Critical path items hidden behind optional branches — player can miss them entirely

### Step 2 — Define the critical path

Mark every place, portal, item, feature, and puzzle that is *required* to reach the win state. This is your critical path. Everything else is enrichment.

The critical path should be:
- Completable without any optional content
- Challenging but not punishing — if a player misses a clue, they should be able to find another route to the same understanding
- Proportional in length to the world's scope — a 5-place world shouldn't need 15 steps

### Step 3 — Write place content first

Before writing any event JSON, write the prose for every place in plain text. **Check each piece against your tone sentence as you write it** — this is the earliest point where bad prose accumulates. It is much easier to fix tone here than after the events are published.


```
SUNLIT CLEARING
You stand at the edge of a clearing. The sun reaches the ground here — 
one of the last places it does. A standing stone rises from the grass, 
worn smooth by weather and time. To the north, the hillside opens into 
darkness. Something carved into the stone catches your eye.
```

Write these for every place. Read them in sequence along the critical path. Does the story make sense? Does tone stay consistent? Does tension build? Fix the prose before touching any JSON.

### Step 4 — Map mechanics to places

For each place on the critical path, ask: what does the player *do* here? Every place should have at least one meaningful interaction. Types:

| Interaction | Tags used | Purpose |
|-------------|-----------|---------|
| Examine feature → reveal clue | `on-interact examine`, `set-state visible` | Information |
| Pick up item | `item` tag on place | Acquisition |
| Use item on feature → state change | `on-interact`, external `set-state` | Progression |
| Talk to NPC | `dialogue` | Information + character |
| Solve puzzle | `puzzle`, `on-complete` | Gate + satisfaction |
| Navigate gated portal | `requires` on portal | Tension + reward |

A place with no interactions is a corridor. A place where every interaction matters is a room. Aim for rooms.

### Step 5 — Write events

> **Before writing any JSON:** open `foakloar-design.md` (in `spec/` in the repo). All concrete tag shapes, action types, and trigger names live there. This guide covers how to think about authoring — the spec covers exact syntax. You will need both.

Now write the JSON. Order matters:

1. **World event** — title, theme, start, inventory, relay hints
2. **Place events** — all 12 (or however many), with exits declared
3. **Portal events** — connects exit slots. Write one portal per connection. Check every exit slot on every place has a portal.
4. **Item events** — write items before features that reference them
5. **Feature events** — write stateful features with full transition tables
6. **Clue events** — write clue content after features that reveal them
7. **Puzzle events** — write after all `requires`-referenced events exist
8. **NPC events** — write after all dialogue nodes exist
9. **Dialogue events** — write nodes bottom-up (leaf nodes before root)
10. **Consequence events** — write last, referenced by everything else

### Step 6 — The consistency check

Before publishing, verify:

- Every `exit` slot declared on a place has a portal referencing it — or is intentionally dangling (document why)
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
- **Match the tone.** Read your place content against your tone sentence. Does it sound right?
- **Short is fine.** Two sentences can be enough. A paragraph is usually enough. More than three paragraphs is too much.

```
// Too long
"You enter the cave. The cave is dark and damp. Water drips from the 
ceiling. The floor is wet. Stalagmites rise from the floor. Stalactites 
hang from the ceiling. There is a faint smell of minerals. It feels 
ancient. It feels old. In the corner you can see a bronze altar."

// Right
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

Named structures that work well with the schema. Use them deliberately.

### The Item Chain

The fundamental FOAKLOAR pattern. A gates B gates C gates win.

```
iron-key → chest → amulet + staff → mechanism → crypto-key → sanctum
```

**Rules:**
- Each link in the chain should feel like an achievement, not a fetch quest
- The item should feel meaningful in itself, not just as a key
- The chain shouldn't be longer than 4-5 links — player loses track

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

### The Palimpsest

The world has layers. The current world sits on top of older worlds. Ruins, inscriptions, cave paintings — evidence of what came before. Players who read carefully learn history that enriches the present.

Use `clue` events with rich content for this. The history doesn't need to be on the critical path — it rewards curiosity.

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

`on-fail` fires on every wrong answer. The second element is always `""` — there is nothing to filter on, unlike `on-attacked` or `on-encounter`. Pair with a counter and `on-counter` for attempt limits — no new tag needed, the counter system handles it.

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

This is the correct way to chain state consequences: one player action, multiple downstream effects, all declared on the action's source event.

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

### `on-attacked` — trigger-target and external targets

`on-attacked` is not a simple "NPC fires back" tag. The trigger-target filters by weapon used, and an optional fifth element targets an external event:

```json
// "" fires on any attack
["on-attacked", "", "deal-damage", "3"],

// Item ref fires only when attacked with that specific weapon
["on-attacked", "30078:<PUBKEY>:the-lake:item:silver-sword", "deal-damage", "6"],

// External target — alert another NPC on any attack
["on-attacked", "", "set-state", "alerted", "30078:<PUBKEY>:the-lake:npc:captain"],

// External target — decrement a shield's durability counter
["on-attacked", "", "decrement", "durability", "30078:<PUBKEY>:the-lake:item:shield"]
```

The shape mirrors `on-interact` exactly — trigger-target replaces the verb, external event `a`-tag is optional position 4.

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

// silver-weakness fires: extra damage + state change + clue reveal
// Can be reused from a silver trap, a silver room, or any other trigger
```

The rule of thumb: **if one action fires, inline it. If multiple actions fire together, or the same reaction fires from multiple triggers, use a consequence.**

Resist creating a consequence for every single action — it creates unnecessary events and makes the world harder to author and debug. Inline is almost always right for one-action reactions.

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

### Item chain too long
More than 5 links and players lose track of what they're looking for. If your chain is longer, compress it — can two items become one? Can a link be removed?

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
Every world should have at least one exit with no portal — a visible invitation for collaborators to extend the world. The Lake's clearing south exit exists for this reason.

---

## The Tone Checklist

Before publishing, read every `content` field and transition text aloud against your tone sentence.

For The Lake: *dark, quiet, ancient, contemplative.*

Ask each piece of text:
- Does it sound like it belongs here?
- Does it use the right register (formal/informal, lyrical/plain)?
- Does it avoid explaining what the player already knows?
- Is it shorter than it needs to be? (It usually can be.)

---

## Critical Schema Rules

Non-obvious behaviours that aren't immediately inferrable from tag shapes. A new session should read these before authoring any events.

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

The Lake's clearing south exit is deliberately dangling — it signals that the world is open for extension. The Lighthouse Keeper's Shore Path has a south exit with no portal — the coast road back to the village, beyond the edge of this map. Self-contained story, open invitation.

**Hidden portals still require exit slot declarations.** A portal with `state: hidden` is not visible to the player, but its slot must still be declared on the place event. The place declares the slot exists; the portal controls accessibility. Forgetting this means the slot can never be filled — even when the portal becomes visible.

```json
// Place — slot declared even though portal is hidden
["exit", "30078:<PUBKEY>:my-world:place:secret-room", "east", "A panel in the wall."]

// Portal — hidden until condition met
["state",   "hidden"],
["exit",    "30078:<PUBKEY>:my-world:place:secret-room", "east", "..."],
["requires","30078:<PUBKEY>:my-world:feature:lamp", "running", "Nothing visible."]
```

**Rule:** every exit should have a portal *or* a deliberate reason not to. Unintentional dangling exits (forgotten portals) are bugs. Intentional ones are storytelling.

**Label text for intentional dangling exits** — the optional label on the exit tag is what the player sees when they try to move in that direction. Use it to signal intent:

```json
// Hints at a larger world beyond
["exit", "south", "The road south continues — beyond the edge of this map."]

// Signals collaboration opportunity
["exit", "west",  "An overgrown path leads west into unmapped territory."]

// Narrative device — a door that never opens
["exit", "east",  "A sealed door. Whatever is behind it, it isn't for you."]
```

A dangling exit with no label renders as just the slot name. A label makes it feel intentional rather than broken.

One portal per connection. The portal declares both directions:

```json
["exit", "30078:<PUBKEY>:place:cave",     "south", "Back to the cave."],
["exit", "30078:<PUBKEY>:place:clearing", "north", "Into the darkness."]
```

---

### NIP-44 win state — how puzzle answer connects to decryption key

> **Critical for LLM authorship — two separate responsibilities:**
>
> 1. **`answer-hash`** — you MUST compute and output the real SHA256 hex digest. A placeholder publishes a permanently unsolvable puzzle. If you cannot compute SHA256, state the answer and salt clearly so the author can compute it.
>
> 2. **NIP-44 win place content** — you CANNOT perform NIP-44 encryption (it requires a keypair and cryptographic operations). Instead, output the plaintext win prose clearly labelled, with a note that the author must encrypt it using a NOSTR library (e.g. nostr-tools) before publishing. The `content` field in the place event should be left as a clearly labelled placeholder — never left blank or silently omitted.

The puzzle `answer-hash` verifies the player's input. The answer itself is also the key material for decrypting the NIP-44 sealed win place. The flow:

1. Author generates a keypair — call it the lock keypair
2. Author NIP-44 encrypts the win place content to the lock public key
3. Author derives `answer-hash = SHA256(answer + salt)` and publishes it on the puzzle event
4. Player solves the puzzle — client verifies `SHA256(player_input + salt)` matches `answer-hash`
5. On match, client uses `player_input` as key material to derive the NIP-44 conversation key
6. Client decrypts the win place content

The answer and the decryption key are the same thing — the puzzle answer IS the key. An author who publishes `answer-hash` without also encrypting the win place content to the corresponding key will have a solvable puzzle that leads nowhere. Both steps are required.

For the Lighthouse Keeper: the signal coordinates (`47.3N-9.8W`) are the answer. The client verifies the hash, then uses the coordinates to derive the key and decrypt the signal alcove content.

---

### Client state uses full `a`-tags as keys

localStorage state keys are full `a`-tags, not d-tags. This is collision-proof across collaborators and matches `requires` evaluation directly:

```json
// WRONG
{ "states": { "the-lake:feature:altar": "watered" } }

// CORRECT
{ "states": { "30078:<PUBKEY>:the-lake:feature:altar": "watered" } }
```

---

## Publishing Your World

Once your events are written, collect them into a single JSON file — an array of unsigned event objects. Name the file after your world slug:

```
lighthouse-events.json
the-lake-events.json
my-world-events.json
```

**Placeholder convention:** Throughout this guide and the reference examples, `<PUBKEY>` stands for your hex pubkey — the 64-character string that identifies your keypair. Replace every `<PUBKEY>` with your actual pubkey before importing. The client cannot resolve `a`-tag references with placeholder values.

**File format:**

The output JSON has two top-level keys — `answers` and `events`. The `answers` map drives NIP-44 encryption and `answer-hash` verification. The publishing tool uses it before signing and strips it entirely — the plaintext never reaches the relay.

**Keys in the `answers` map are puzzle `d`-tag values** — the same string used in the `["puzzle", "<d-tag>"]` tag on the sealed event and the `["d", "<d-tag>"]` tag on the puzzle event itself.


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
    ["w",             "foakloar"],
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
        ["puzzle",         "my-world:puzzle:final-riddle"]
      ],
      "content": "# Win State\n\nThe plaintext win prose in markdown — the publishing tool encrypts this using the answer above."
    }
  ]
}
```

For worlds with no NIP-44 sealed events, `answers` can be an empty object `{}` or omitted.

The `pubkey`, `id`, `sig`, and `created_at` fields are added by the FOAKLOAR client when signing — you do not need to compute them. Each event in the array is an unsigned template.

**Publishing order matters.** The client resolves the world manifest before fetching content. Publish in the same order as authoring:

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
Import your JSON file into the FOAKLOAR client's builder mode. The tool:
1. Reads the `answers` map
2. For each event with `content-type: application/nip44` and a `puzzle` tag — encrypts `content` using the answer, replaces it with ciphertext
3. Verifies `answer-hash` values on puzzle events match `SHA256(answer + salt)`
4. Strips `answers` entirely
5. Signs each event with your keypair
6. Publishes to your configured relays

**After publishing:**
Your world is live as soon as the events reach the relay. Players can load it immediately via your npub URL:
```
yoursite.com/world/npub1...
```

To update an event, republish with the same `d` tag and pubkey — NOSTR replaceable events mean the relay keeps only the latest version.

---

## Event Count Expectations

| World size | Narrative equivalent | Places | Total events | Story length |
|-----------|---------------------|--------|-------------|-------------|
| Micro | Vignette / short story | 3-5 | 15-25 | 15-30 min |
| Small | Short story / novella | 6-8 | 30-50 | 30-60 min |
| Medium | Novella / short game | 10-15 | 60-100 | 1-3 hours |
| Large | Novel / full game | 20+ | 150+ | 3+ hours |

The Lake is medium. The Lighthouse Keeper (in `reference/foakloar-micro-world.md`) is micro. Start with micro or small.

**A micro-world in summary** — The Lighthouse Keeper:
- 5 places: shore path, lighthouse base, lamp room, keeper's cottage, signal alcove
- 1 item: crank handle (found in tide wrack, used on mechanism)
- Item chain: crank → mechanism runs → lamp lights → signal reveals → coordinates decode → key derived → final log unsealed
- Tone: melancholy, coastal, quiet
- Dangling exit: shore path south — `["exit", "south", "The coast road south — beyond the edge of this map."]` No portal. Intentional.
- Win state: NIP-44 sealed final log, decrypted by decoded signal coordinates
- Total events: 26

This is the right scope for a first world. The full event listing is in `reference/foakloar-micro-world.md`.

---

## Sound Scoring

Sound is a progressive enhancement — players who can't hear it miss nothing. Sound is atmosphere, never information. Never gate a puzzle solution, navigation choice, or narrative reveal behind sound. A deaf player should have the full experience.

---

### Pattern library — moods and their notation

Use these as building blocks. Pick the mood that fits the moment:

| Mood | Pattern | Notes |
|------|---------|-------|
| Dread | `"c2*1 slow(pad)"` | Low drone, barely moving. Underground, ancient. |
| Tension | `"b2 ~ b2 ~ slow(strings)"` | Minor root, slow pulse. Unsolved puzzle, danger nearby. |
| Danger | `"c3 b2 c3 b2 fast(strings)"` | Minor second oscillation. Rapid threat. |
| Urgency | `"c3*8 fast(perc)"` | Rapid repeat. Chase, countdown. |
| Mystery | `"c3 ~ eb3 ~ slow(pad)"` | Minor third, spaced out. Unknown territory. |
| Wonder | `"c4 e4 g4 c5 slow(bells)"` | Ascending major. Discovery, arrival. |
| Resolution | `"c3 e3 g3 slow(pad)"` | Major chord, settling. Puzzle solved, door open. |
| Stillness | `"~ ~ ~ ~"` | Silence. Aftermath, emptiness, weight. |
| Mechanical | `"perc(bd)*4"` | Steady kick. Machinery running, clock ticking. |
| Ethereal | `"c5 g5 c6 slow(bells)"` | High, sparse. Magical, otherworldly. |

Patterns can be combined — a place ambient plus a state-conditional layer:

```json
["sound", "ambient", "0.6", "c2*1 slow(pad)"],                          // always present
["sound", "layer",   "0.4", "b2 ~ b2 ~ slow(strings)", "unsolved"]      // only while puzzle unsolved
```

---

### State-conditional layers — the most powerful tool

A layer can be gated to a specific event state. When the state changes, the layer enters or leaves the mix automatically. This is the FOAKLOAR equivalent of iMUSE — dynamic music without a music engine.

```json
// Always-on drone
["sound", "ambient", "0.7", "c2*1 slow(pad)"],

// Lamp hum — only when lamp is on
["sound", "layer", "0.3", "c5*16 fast(sine)", "on"],

// Tension — only while puzzle unsolved  
["sound", "layer", "0.4", "b2 ~ b2 ~", "unsolved"],

// Victory swell — only after puzzle solved
["sound", "effect", "0.8", "c3 e3 g3 c4 slow(pad)", "solved"]
```

The state string is the event's own state — the fourth element on the `sound` tag is evaluated against the event it's declared on.

---

### Layering budget — how many layers is too many

The client mixes all active `sound` tags simultaneously. Too many layers becomes noise.

| Event type | Sound budget |
|-----------|-------------|
| World event | `bpm` only |
| Place | 1 `ambient`, 1 optional `layer` |
| Feature/item | 1 `layer` or `effect` — only if the sound is meaningful to that specific object |
| NPC | 1 `effect` on encounter |
| **Active simultaneously** | **3–4 layers maximum** |

Resist the urge to add sound to everything. Silence is part of the palette — a place with no sound tags inherits a quieter mix.

---

### BPM and place overrides

Declare the world BPM on the world event. Place events can override it for tempo shifts:

```json
// World event — comfortable walking pace
["sound", "bpm", "72"],

// Mechanism chamber — faster, more tense
["sound", "bpm", "96"],

// The sanctum — slower, ancient
["sound", "bpm", "52"]
```

Tempo shifts are felt even when players don't consciously notice them. Use them for threshold moments — descent underground, entering a significant place, approaching the win state.

---

### Worked example — The Lighthouse Keeper with sound

```json
// World event — slow coastal tempo
["sound", "bpm", "60"],

// Shore Path — open air, distant waves
["sound", "ambient", "0.5", "c3 ~ ~ ~ slow(pad)"],

// Lighthouse Base — heavier, mechanism waiting
["sound", "ambient", "0.6", "c2*1 slow(pad)"],
["sound", "layer",   "0.3", "perc(bd) ~ ~ ~"],            // slow mechanical pulse

// Lamp Room — tension while lamp is dark, resolution when running
["sound", "ambient", "0.5", "b2 ~ b2 ~ slow(strings)", "dark"],
["sound", "ambient", "0.4", "c3 e3 g3 slow(pad)",      "running"],

// Brass Lantern item — hum when on
["sound", "layer", "0.2", "c5*16 fast(sine)", "on"],

// Lamp Mechanism feature — one-shot on activation
["sound", "effect", "0.9", "c2 c3 c4 fast(perc)"],

// Signal Alcove — ethereal signal from out at sea
["sound", "ambient", "0.5", "c4 ~ g4 ~ slow(bells)"],
["sound", "layer",   "0.4", "b2 ~ b2 ~", "dark"],         // still tense until decoded
["sound", "layer",   "0.5", "c3 e3 g3 slow(pad)", "decoded"], // resolution on decode

// Keeper's Cottage — quiet, lived-in
["sound", "ambient", "0.3", "~ ~ ~ ~"]                    // near-silence
```

The lamp room shows the pattern clearly: two `ambient` tags on the same place, each gated to a different lamp state. Only one plays at a time. The mix changes the moment the lamp runs — without the author doing anything else.

---

### `sound` as an action type — triggered one-shots

For sounds that should fire at a specific moment rather than play passively, use `sound` as an action in any `on-*` dispatcher:

```json
// Puzzle solved — victory chord
["on-complete", "", "sound", "c3 e3 g3 c4 fast(bells)", "0.9"],

// Wrong answer — discordant sting
["on-fail", "", "sound", "b2 f3 slow(pad)", "0.6"],

// Key turns in lock
["on-interact", "use", "sound", "c2 c3 fast(perc)", "1.0"],

// NPC dies
["on-health", "down", "0", "sound", "b1 ~ ~ ~ slow(pad)", "0.7"]
```

Volume is optional — defaults to `1.0`.

**The rule:** if the sound marks a moment (solve, death, unlock, reveal), use the action type. If the sound characterises a state (in this room, lamp is on, puzzle unsolved), use a `sound` tag on the event.

---

### What NOT to do

```json
// DON'T — sound carries puzzle information
["sound", "effect", "1.0", "c3 e3 g3", "solved"]
// If this is the only signal that the puzzle was solved, deaf players are stuck.
// Always pair sound effects with visible state changes or transition text.

// DON'T — too many layers
["sound", "layer", "0.5", "c2*1 slow(pad)"],
["sound", "layer", "0.4", "b2 ~ b2 ~"],
["sound", "layer", "0.3", "e3 ~ g3 ~"],
["sound", "layer", "0.3", "perc(bd)*4"],
["sound", "layer", "0.2", "c5*8 fast(sine)"]
// Five layers simultaneously — the mix is unlistenable.

// DON'T — generic sound on everything
// Not every feature, item, and NPC needs a sound tag.
// Sound should mean something. Silence is also a choice.
```
