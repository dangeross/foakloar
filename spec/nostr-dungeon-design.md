# NOSTR Dungeon — Design Document
*Personal reference · Work in progress*

---

## Table of Contents

1. [Vision & Concept](#1-vision--concept)
2. [Core Primitives & Schema](#2-core-primitives--schema)
3. [Cryptographic Puzzle Mechanics](#3-cryptographic-puzzle-mechanics)
4. [Player State & Inventory](#4-player-state--inventory)
5. [World State Problem](#5-world-state-problem)
6. [Trust & Curation Model](#6-trust--curation-model)
7. [NPC & Dialogue System](#7-npc--dialogue-system)
8. [Progression & Quest Design](#8-progression--quest-design)
9. [Client Architecture](#9-client-architecture)
10. [Open Questions](#10-open-questions)

---

## 1. Vision & Concept

A decentralised, permissionless text adventure built entirely on NOSTR. The world is a graph of NOSTR events. Anyone can extend it. Anyone can play it. Cryptography enforces puzzle gates natively — not simulated, actual cryptography.

**Core principles:**

- The world lives on relays, not servers. No central authority can delete it.
- Player identity = a NOSTR keypair. No accounts, no login.
- Puzzle locks are mathematically enforced. You cannot cheat by scraping relays.
- The map is a living document. Portals can be published, contested, revoked.
- The world has factions, history, unreliable cartography. That's a feature.
- Every player is also a potential builder. The distinction is a UI mode, not a role.
- Scarcity is about *knowledge and access*, not item possession. Anyone can pick up an item. Only those who've earned the key can open the chest.

**Reference:** Zork-style text adventure, but the dungeon is a decentralised graph owned by no one and everyone. The kind numbers form an open protocol — anyone can build a world, a client, or a tool against the same convention. The `t` tag separates worlds.

---

## 2. Core Primitives & Schema

The schema uses a **single kind** for all dungeon primitives:

- **`kind: 30078`** — the dungeon game kind. Signals to any client "this is a dungeon event" and that the the-lake schema applies. One kind, one protocol.
- **`type` tag** — differentiates primitives within that kind: `place`, `portal`, `item`, `feature`, `clue`, `puzzle`, `recipe`, `npc`, `dialogue`, `quest`, `vouch`, `player-state`.
- **`t` tag** — identifies the specific game world instance. `the-lake`, `shadowrealm`, `my-dungeon` — all use the same kind and client, separated by `t` tag. Used for relay-level subscription filtering.
- **`d` tag prefix** — prefixed with the world name (e.g. `the-lake:place:clearing`) to ensure global uniqueness per author. Without the prefix, the same author publishing two worlds would have colliding `d` tags. The prefix is correctness; the `t` tag is ergonomics. Both are needed.

References between events use the `a` tag format (`30078:pubkey:d-tag`) so links always resolve to the *latest* version of an event, never a stale snapshot.

#### content field

The `content` field carries the primary prose description rendered to the player. Its format is declared by an optional `content-type` tag — if absent, `text/plain` is assumed.

```json
["content-type", "text/plain"]        // default — plain text prose
["content-type", "text/markdown"]     // markdown rendered by client
["content-type", "application/nip44"] // NIP-44 encrypted — state: sealed
```

For supplementary content alongside the prose — ASCII art, maps, images — use a `media` tag with a type and value. The client renders what it supports and silently ignores what it doesn't. This enables progressive enhancement without breaking older clients.

```json
["media", "text/x-ansi",  "<short ansi art>"]
["media", "text/markdown", "## Rough Map\n..."]
["media", "image/url",    "https://example.com/map.png"]
```

Multiple `media` tags are allowed — one per content block. A place with ASCII art and markdown prose:

```json
{
  "kind": 30078, "tags": [
    ["d",            "the-lake:place:west-of-house"],
    ["t",            "the-lake"],
    ["type",         "place"],
    ["title",        "West of House"],
    ["content-type", "text/markdown"],
    ["media",        "text/plain", "    +--------+\n    |        |\n    | HOUSE  |\n    |        |\n    +--------+"]
  ],
  "content": "You are standing in an open field west of a **white house**, with a boarded front door. There is a small mailbox here."
}
```

Sealed places use `content-type: application/nip44` — the client detects this, attempts NIP-44 decryption with any held crypto keys, and renders the decrypted content if successful.

**Relay size constraints**

NOSTR relays impose size limits via NIP-11. The relevant limits:

| Limit | Relay field | Applies to |
|-------|-------------|-----------|
| `max_message_length` | WebSocket frame size — typically 64KB–128KB | Entire event |
| `max_content_length` | Characters in `content` field | `content` only |
| `max_event_tags` | Number of tags on a single event | Tag count |

Individual tag values have no protocol-level size limit, but contribute to `max_message_length`. Guidelines for the schema:

- **`content`** — the right home for longer prose and markdown. `max_content_length` is typically more generous than per-tag constraints.
- **`media` inline** — keep short. Small ASCII art (a few hundred characters) is fine as an inline tag value.
- **`media` large assets** — use `image/url` or a URL-based form and serve content externally. Don't embed large binary or text blobs in tag values.
- **Tag count** — events with many `requires`, `verb`, `noun`, `exit`, `route` and `on-*` tags can accumulate quickly on complex NPCs or places. Keep an eye on this for relay compatibility.

**Type reference:**

| Type tag | Primitive | Description |
|----------|-----------|-------------|
| `place` | Place | A location in the world |
| `portal` | Portal | Connects two place exit slots |
| `item` | Item | A portable, carryable thing |
| `feature` | Feature | A fixed, interactive part of a place |
| `clue` | Clue | A piece of information, optionally sealed |
| `puzzle` | Puzzle | A client-side verified challenge |
| `recipe` | Recipe | Defines item combination rules |
| `npc` | NPC | An actor placed by a place author |
| `dialogue` | Dialogue | A single dialogue node; nodes grouped by d-tag prefix |
| `quest` | Quest | Optional named quest grouping |
| `consequence` | Consequence | A reusable outcome fired by portals, NPCs, or interactions |
| `vouch` | Vouch | Trust endorsement for a fringe author's events |
| `player-state` | PlayerState | Encrypted player progress backup |

---

### 2.1 Place (`type: place`)

The atomic unit of the world. A place the player can occupy.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",       "the-lake:place:sunlit-clearing"],
    ["t",       "the-lake"],
    ["type",    "place"],
    ["title",   "A Sunlit Clearing"],
    ["exit", "north"],
    ["exit", "east"],
    ["exit", "west"],
    ["item",    "30078:<pubkey>:the-lake:item:iron-key"],
    ["feature", "30078:<pubkey>:the-lake:feature:bronze-altar"],
    ["npc",     "30078:<pubkey>:the-lake:npc:old-hermit"]
  ],
  "content": "You stand in a clearing. Shafts of light pierce the canopy above. To the north, a dark cave entrance looms."
}
```

**Key design decisions:**

- Exit tags are **named slots only** — they do not declare a destination. Destinations are the portal's responsibility.
- `noun` tags make places referenceable in commands like `examine place` or `look around`.
- The place is replaceable by its author (same `d` tag + pubkey = update). The author can add/remove exit slots freely.
- `content` is the prose description rendered to the player.
- Exit slot names are arbitrary strings. Any value is valid — the portal references it by name. Accepted conventions:

| Category | Values |
|----------|--------|
| Cardinal | `north`, `south`, `east`, `west` |
| Vertical | `up`, `down` |
| Diagonal | `northeast`, `northwest`, `southeast`, `southwest` |
| Contextual | `in`, `out`, `enter`, `path`, `passage`, `climb`, `jump` |
| Custom | Any string — `follow-river`, `squeeze-through`, `jump-gap` etc. |

The client renders exit slot names as available movement options. Custom exit names read naturally as player commands.

- Rooms can carry `on-enter` handlers — fired when the player enters the place. NPCs use the same tag with a place reference as the first argument — fired when the NPC arrives at that place. Same tag, different first argument, dispatched by event `type`.

```json
["on-enter", "player", "consequence", "30078:<pubkey>:the-lake:consequence:trap-fires"]
["on-enter", "player", "set-state", "visited", "30078:<pubkey>:the-lake:place:sanctum"],
["on-enter", "player", "set-state", "visible", "30078:<pubkey>:the-lake:clue:ambient-note"]
```

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",        "the-lake:place:cellar"],
    ["t",        "the-lake"],
    ["type",     "place"],
    ["title",    "Cellar"],
    ["exit", "north"],
    ["exit", "up"],
    ["requires", "30078:<pubkey>:the-lake:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."]
  ],
  "content": "A dark and damp cellar. A narrow passageway leads north."
}
```

---

### 2.2 Portal (`type: portal`)

Stitches two exit slots together. Owned and published by whoever creates the connection.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",    "the-lake:portal:clearing-north-to-cave-south"],
    ["t",    "the-lake"],
    ["type", "portal"],
    ["exit", "30078:<pubkey>:the-lake:place:dark-cave", "north", "A dark cave entrance looms to the north"],
    ["exit", "30078:<pubkey>:the-lake:place:sunlit-clearing", "south", "Pale daylight filters through the cave mouth to the south"]
  ],
  "content": ""
}
```

**Key design decisions:**

- Portal `exit` tags bind a place's exit slot to a destination place. Shape: `["exit", "<place-ref>", "<slot-name>", "<optional-label>"]`
- This mirrors the place's exit slot declaration — same tag name, same slot name in the same position. Room declares the slot exists; portal binds it to a destination.
- Portal ownership is separate from place ownership. Anyone can publish a portal.
- Two portals claiming the same exit slot = contested territory. The client resolves by trust (see §6).
- Contested portals are not a bug — they are world-changing events. Factions can fight over portal infrastructure.
- The client renders conflicting portals as *"the passage north feels unstable — you sense two possible destinations."*
- One-way portals have a single `exit` tag. Two-way portals have two. A hub place could have many.
- `requires` tags on a portal gate traversal inline — no separate lock event needed. The optional failed description tells the player why they cannot pass.

```json
// One-way teleport trap
["exit", "30078:<pubkey>:the-lake:place:void", "north", "A strange shimmer pulls you forward."]

// Two-way passage
["exit", "30078:<pubkey>:the-lake:place:cave", "north", "A dark cave entrance looms."],
["exit", "30078:<pubkey>:the-lake:place:clearing", "south", "Daylight filters through the cave mouth."]
```

---

### 2.3 Item (`type: item`)

A portable thing. Items can always be picked up, carried, used, and combined. They are placed in places by the place author via reference tags — they do not declare their own location. Once picked up, the client records this in local player state and suppresses the item from place rendering. Items are never dropped — once carried, they are used, combined, or consumed.

Items support the same `state`, `verb`, and `on-interact` tags as features — some items are interactive even when carried. State is tracked per-item in local player state.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:item:iron-key"],
    ["t",           "the-lake"],
    ["type",        "item"],
    ["title",       "An Iron Key"],
    ["noun",        "key",    "iron key"],
    ["description", "Heavy and cold. The bow is shaped like a serpent."]
  ],
  "content": ""
}
```

An item with state and verbs:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:item:brass-lantern"],
    ["t",           "the-lake"],
    ["type",        "item"],
    ["title",       "Brass Lantern"],
    ["verb", "turn on", "switch on", "on"],
    ["verb", "turn off", "switch off", "off"],
    ["state",       "off"],
    ["on-interact", "turn on",  "set-state", "on"],
    ["on-interact", "turn off", "set-state", "off"],
    ["description", "A battery-powered brass lantern."]
  ],
  "content": ""
}
```

Items can contain other items via `contains` tags. If an item has `contains` tags it is implicitly a container — no additional flag needed. Contents are accessible once the item is in inventory, and listed when examined or opened.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:item:brown-sack"],
    ["t",           "the-lake"],
    ["type",        "item"],
    ["title",       "A Brown Sack"],
    ["noun",        "sack",   "bag",   "brown sack"],
    ["contains",    "30078:<pubkey>:the-lake:item:lunch"],
    ["contains",    "30078:<pubkey>:the-lake:item:garlic"],
    ["description", "A brown sack, smelling of garlic."]
  ],
  "content": ""
}
```

#### requires / requires-not

Any event — place, feature, portal, clue — can carry `requires` or `requires-not` tags. Evaluated client-side against local player state. The second argument is always the condition **type**. An optional final argument provides a description shown to the player when the condition is *not* met — no separate locked-description tag needed.

```json
["requires",     "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
["requires-not", "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
```

**Condition types:**

`requires` always has exactly 3 arguments after the tag name — a reference, a state, and a description. The client resolves the referenced event from its local cache and checks its current state. No type dispatch needed — the event's own `type` tag identifies it.

```
["requires",     "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
["requires-not", "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
```

The same shape works for any event type:

| Event type | State check example |
|------------|---------------------|
| `item` | Blank state = player holds it in any state; non-blank = must be in that state |
| `npc` | `gone`, `present`, `blocking`, or blank for any |
| `feature` | Any authored state — `open`, `prayed`, `lit` etc. |
| `place` | Any authored state — `visited`, `bridged` etc. |
| `puzzle` | Typically `solved` |
| `portal` | `hidden`, `visible`, or any authored state |

The `item` type always has 5 elements (state and description both present, either may be blank). All other types have 4 elements. This makes parsing unambiguous — the client dispatches on type before reading remaining arguments.

`requires-not` inverts the condition. Multiple `requires` tags = all must pass (AND logic). The client renders the first failed description it encounters.

Examples:

```json
// Item with state check and description
["requires", "30078:<pubkey>:the-lake:item:brass-lantern", "on",  "It is pitch black. You are likely to be eaten by a grue."],

// Item held in any state (blank state), with description
["requires", "30078:<pubkey>:the-lake:item:iron-key", "",   "A heavy gate blocks the passage. There is a keyhole."],

// Item held, no state check, no description
["requires", "30078:<pubkey>:the-lake:item:invitation", "",   ""],

// Flag with description
["requires", "30078:<pubkey>:the-lake:feature:altar", "prayed", "The altar has not been blessed."],

// NPC must be gone
["requires", "30078:<pubkey>:the-lake:npc:cyclops", "gone", "The cyclops blocks your way."],

// requires-not with description
["requires-not", "30078:<pubkey>:the-lake:feature:control-panel", "on", "The reservoir has already drained."],

// requires-not item state
["requires-not", "30078:<pubkey>:the-lake:item:brass-lantern", "on", ""]
```

Hidden portals or features start in `state: hidden` — not rendered until a `set-state visible` action targets them.

Event states are set via `set-state` in `on-interact`. The optional third argument targets another event — omit to apply to self:

```json
// Transition self to new state
["on-interact", "open",  "set-state", "open"]

// Transition another event to a new state
["on-interact", "press", "set-state", "on",      "30078:<pubkey>:the-lake:feature:control-panel"]
["on-interact", "pour",  "set-state", "watered",  "30078:<pubkey>:the-lake:feature:altar"]
["on-interact", "throw", "set-state", "bridged",  "30078:<pubkey>:the-lake:place:east-of-chasm"]
```

Item states (client-side only):

| State | Meaning |
|-------|---------|
| `in-place` | Referenced by place, not yet in picked-up set |
| `in-inventory` | In local picked-up set, available to use/combine |
| `consumed` | Used in combination or as one-time unlock, removed from inventory |

The place event references items it contains:

```json
["item", "30078:<pubkey>:the-lake:item:iron-key"]
```

---

### 2.4 Feature (`type: feature`)

A fixed part of a place's fabric. Features can be interacted with in place but never picked up. They respond to verbs, can have locks attached, and can contain items revealed on interaction. Like items, features are placed by the place author via reference tags.

The `verb` tag declares available interactions. The first value is the **canonical verb** — used in `on-interact` tags and the client's command parser. Additional values are **aliases** — alternative inputs the parser accepts, mapped to the canonical before dispatch.

```json
["verb", "examine", "look at", "x", "inspect", "l"]
["verb", "open", "pull", "push"]
["verb", "turn on", "switch on", "on"]
["verb", "turn off", "switch off", "off"]
```

`on-interact` always references the canonical verb — never an alias.

The `noun` tag works the same way — the first value is the **canonical noun** used internally, additional values are aliases the input parser also accepts. `title` is always display-only; `noun` is always parser-facing.

```json
["noun", "chest",   "box",       "trunk"]
["noun", "key",     "iron key",  "rusty key"]
["noun", "lantern", "lamp",      "light"]
["noun", "altar",   "stone",     "table"]
```

When multiple events share the same noun value (two items both have `"key"` as a noun), the client prompts for disambiguation using their `title` tags:

```
Which key?
1. Rusty Key
2. Golden Key
```

Rooms, items, features, and NPCs can all carry `noun` tags. Exit slots serve as nouns for movement commands — `go north` resolves `north` to an exit slot directly.

**Two-noun commands** — the parser handles `<verb> <noun> [preposition] <noun>` naturally. Both nouns resolve via `noun` tags independently of order or preposition:

- `use sword on ogre` → verb `attack`, target `ogre` NPC, instrument `sword` item
- `hit ogre with sword` → same resolution
- `give potion to fairy` → verb `give`, target `fairy` NPC, instrument `potion` item
- `give bottle to Jessabell` → same, if `jessabell` is a noun alias on the NPC

`on-interact` lives on the **target** event — the thing being acted upon. The instrument is available as context. If the instrument matters (a locked door that only opens with the right key), express it as a `requires` on the target — the client checks it before firing `on-interact`. This keeps the instrument check in the schema rather than hardcoded in the parser.

Features can have an initial **state** — a string value declared by the author. The client tracks current state per-feature in local player state. State values are arbitrary strings defined by the feature author. The client renders descriptions and available verbs based on current state.

#### on-* event dispatcher

All reactive behaviour across features, items, NPCs, rooms, and portals uses a unified `on-*` tag pattern. The trigger type is encoded in the tag name, making the source of each behaviour immediately clear. The shape is always:

```json
["on-<trigger>", "<trigger-target>", "<action-type>", "<action-target?>"]
```

**Trigger tags:**

| Tag | Trigger target | Fires when |
|-----|---------------|------------|
| `on-interact` | Verb string | Player uses a verb on this feature, item, or NPC |
| `on-complete` | — | Player satisfies all `requires` and confirms action (puzzle answered, recipe combined) |
| `on-enter` | `player` or place `a`-tag | Player enters this place (arg: `player`), or NPC arrives at a place (arg: place ref). Client dispatches based on event `type`. |
| `on-encounter` | `player` or NPC `a`-tag | NPC is in the same place as target |
| `on-attacked` | — | NPC is attacked by player |
| `on-health-zero` | — | This NPC's health reaches zero |
| `on-player-health-zero` | — | Player health reaches zero (on place or NPC) |
| `on-move` | State string or `—` | Every player move; optional state guard |
| `on-counter-zero` | Counter name | Named counter reaches zero |

**Action types** (shared across all `on-*` tags):

| Action | Target | Effect |
|--------|--------|--------|
| `unlock` | Lock `a`-tag | Satisfies a lock condition |
| `set-state` | State string, optional event `a`-tag | Transitions this event (or a referenced event) to a new state |
| `traverse` | Portal `a`-tag | Sends the player through a portal |
| `give-item` | Item `a`-tag | Adds an item to player inventory |
| `consume-item` | Item `a`-tag | Removes an item from player inventory |
| `deal-damage` | Integer string | Reduces player health by this amount |
| `deal-damage-npc` | NPC `a`-tag or `—` for current | Reduces target NPC health by weapon damage |
| `heal` | Integer string | Restores player health by this amount |
| `consequence` | Consequence `a`-tag | Fires a consequence event |
| `steals-item` | `any` or item `a`-tag | Takes item from player inventory |
| `deposits` | — | NPC drops held items in current place |
| `flees` | — | NPC moves immediately to a random route place |
| `decrement` | Counter name | Reduces named counter by 1 |
| `increment` | Counter name | Increases named counter by 1 |
| `set-counter` | Counter name, value | Sets named counter to a specific value |

New action types can be added without changing the tag structure — the dispatcher is intentionally open-ended.

#### counter

A named numeric value tracked in player state. Declared on any event type — item, feature, NPC, place. Decrements or increments via `on-*` handlers. When it reaches zero, `on-counter-zero` fires.

```json
["counter", "<name>", "<initial-value>"]
```

Multiple counters can exist on a single event:

```json
["counter", "battery", "300"]
["counter", "charges", "5"]
```

#### state & transition

`state` declares the initial state of an event. `transition` defines the legal edges of the state graph — the client only executes a `set-state` action if a matching transition exists. If no `transition` tags are present, any state change is permitted (opt-in enforcement).

```json
["state",      "<initial-state>"]
["transition", "<from-state>", "<to-state>", "<optional-text>"]
```

The optional fourth element is **transition text** — rendered to the player when this transition fires. This applies to any event type: items, features, NPCs. It is the world giving feedback at the moment of change.

```json
["transition", "off",  "on",   "The lantern flickers to life."],
["transition", "on",   "off",  "Darkness closes in."],
["transition", "on",   "dead", "The lantern slowly fades out and darkness looms."],
["transition", "dead", "dead", "The lantern is dead. Nothing happens."]
```

`["transition", "dead", "dead", "..."]` declares a terminal state — the client shows the text and blocks any further state change. Other examples:

```json
// Door with feedback
["transition", "closed", "open",   "The door swings open with a groan."]
["transition", "open",   "closed", "The door thuds shut."]
["transition", "locked", "closed", "The lock clicks open."]

// NPC weakening in combat
["transition", "healthy",  "wounded", "The troll staggers, clutching its side."]
["transition", "wounded",  "dead",    "The troll collapses with a final roar."]
["transition", "dead",     "dead",    "The troll is already dead."]

// Feature worn out
["transition", "charged",    "depleted", "The altar's glow fades as the last of its power is spent."]
["transition", "depleted",   "depleted", "The altar is cold and silent."]
```

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:feature:kitchen-window"],
    ["t",           "the-lake"],
    ["type",        "feature"],
    ["title",       "Kitchen Window"],
    ["verb", "open", "examine", "enter"],
    ["state",       "ajar"],
    ["on-interact", "open",  "set-state", "open"],
    ["on-interact", "open",  "set-state", "open"],
    ["on-interact", "enter", "traverse",  "30078:<pubkey>:the-lake:portal:window-to-kitchen"],
    ["description", "The window is slightly ajar."]
  ],
  "content": ""
}
```

A stateless feature:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:feature:bronze-altar"],
    ["t",           "the-lake"],
    ["type",        "feature"],
    ["title",       "A Bronze Altar"],
    ["verb", "examine", "place"],
    ["on-interact", "examine", "set-state", "visible", "30078:<pubkey>:the-lake:clue:altar-inscription"],
    ["description", "A heavy bronze altar, worn smooth by many hands."]
  ],
  "content": ""
}
```

A chest with state, contents, and a lock:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:feature:ancient-chest"],
    ["t",           "the-lake"],
    ["type",        "feature"],
    ["title",       "An Ancient Chest"],
    ["verb", "open", "examine"],
    ["state",       "closed"],
    ["requires", "30078:<pubkey>:the-lake:item:iron-key", "", "The chest is sealed with a serpent-shaped lock."],
    ["on-interact", "open", "set-state", "open"],
    ["contains",    "30078:<pubkey>:the-lake:item:iron-key"],
    ["contains",    "30078:<pubkey>:the-lake:item:map-fragment"],
    ["description", "A heavy oak chest bound with iron. The lock is shaped like a serpent."]
  ],
  "content": ""
}
```

The place event references both items and features it contains:

```json
["item",    "30078:<pubkey>:the-lake:item:iron-key"],
["feature", "30078:<pubkey>:the-lake:feature:ancient-chest"],
["feature", "30078:<pubkey>:the-lake:feature:bronze-altar"]
```

---

### 2.5 Clue (`type: clue`)

A self-contained piece of information with its own state lifecycle. Clues start `hidden` and are set to `visible` by whatever discovers them — a feature interaction, an NPC, a place entry. They can be referenced independently by multiple events. The `sealed` state means the content is NIP-44 encrypted — visible but unreadable without the right key.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",          "the-lake:clue:altar-inscription"],
    ["t",          "the-lake"],
    ["type",       "clue"],
    ["title",      "Altar Inscription"],
    ["noun",       "inscription", "writing", "carving"],
    ["state",      "hidden"],
    ["transition", "hidden",  "visible", "You notice writing carved into the stone."],
    ["transition", "sealed",  "visible", "The inscription becomes readable."],
    ["transition", "visible", "visible", "You've already read this."]
  ],
  "content": "Carved into the altar stone: 'The serpent opens what the serpent guards.'"
}
```

**Clue states:**

| State | Meaning |
|-------|---------|
| `hidden` | Not yet discovered — not rendered to the player |
| `visible` | Discovered and readable |
| `sealed` | Visible but NIP-44 encrypted — requires a crypto key to read |

**Surfacing a clue** — any event can set a clue's state to `visible` via `set-state`:

```json
// Feature interaction
["on-interact", "examine", "set-state", "visible", "30078:<pubkey>:the-lake:clue:altar-inscription"]

// Place entry (ambient clue — shown on arrival)
["on-enter", "player", "set-state", "visible", "30078:<pubkey>:the-lake:clue:notice-on-wall"]

// NPC dialogue node
["on-enter", "player", "set-state", "visible", "30078:<pubkey>:the-lake:clue:hermit-hint"]
```

**Sealed clue** — content encrypted, key found elsewhere in the world:

```json
{
  "kind": 30078, "tags": [
    ["d",            "the-lake:clue:sealed-prophecy"],
    ["t",            "the-lake"],
    ["type",         "clue"],
    ["state",        "sealed"],
    ["content-type", "application/nip44"],
    ["transition",   "sealed",  "visible", "The inscription shimmers and becomes readable."]
  ],
  "content": "<NIP-44 encrypted content>"
}
```

The `clue` tag on a place references an ambient clue that becomes visible on entry without requiring explicit player interaction:

```json
["clue", "30078:<pubkey>:the-lake:clue:notice-on-wall"]
```

---

### 2.6 Puzzle (`type: puzzle`)

A challenge that produces an outcome when completed. Verification is always client-side. `puzzle-type` is a hint to the client about how to present the challenge — it does not change the underlying mechanic. All puzzles use `requires` to define conditions and `on-complete` to define outcomes.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:puzzle:chapel-riddle"],
    ["t",           "the-lake"],
    ["type",        "puzzle"],
    ["puzzle-type", "riddle"],
    ["answer-hash", "<sha256(answer + salt)>"],
    ["salt",        "the-lake:puzzle:chapel-riddle:v1"],
    ["on-complete", "set-state", "solved"]
  ],
  "content": "I have a neck but no head, a body but no soul. I guard what you seek but ask nothing in return. What am I?"
}
```

The answer is never stored. `SHA256(answer + salt)` means the client hashes the player's input and compares locally. No server, no relay read, no cheating.

**Puzzle types** (`puzzle-type` tag — UI hint only, not logic):

| Type | Mechanic | Notes |
|------|---------|-------|
| `riddle` | Answer hashes to known value | Uses `answer-hash` + `salt` tags |
| `sequence` | Events must reach given states in order | Same as recipe with `ordered: true` — uses `requires` on event states |
| `cipher` | Decode an encrypted message | Uses NIP-44 sealed content |
| `observe` | Notice something in place/clue descriptions | Client surfaces on player action |
| `map` | Navigate a sub-maze | Client-side spatial challenge |

**Sequence puzzles** are structurally identical to recipes with `ordered: true` — the only difference is what the `requires` tags reference. A recipe requires inventory items; a sequence puzzle requires world event states. Both use `ordered: true` to enforce evaluation order:

```json
{
  "kind": 30078, "tags": [
    ["d",           "the-lake:puzzle:lever-sequence"],
    ["t",           "the-lake"],
    ["type",        "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "true"],
    ["requires",    "30078:<pubkey>:the-lake:feature:lever-a", "pulled", "You need to pull lever A first."],
    ["requires",    "30078:<pubkey>:the-lake:feature:lever-b", "pulled", "You need to pull lever B next."],
    ["requires",    "30078:<pubkey>:the-lake:feature:lever-c", "pulled", "You need to pull lever C last."],
    ["on-complete", "set-state", "visible", "30078:<pubkey>:the-lake:portal:secret-door"]
  ],
  "content": "Three levers protrude from the wall."
}
```

The `combine` puzzle type is now redundant — item combination is handled entirely by `type: recipe`. Remove it from the type hint list.

**Branching puzzles** — when a puzzle has multiple possible outcomes depending on player choice (e.g. choosing between three paths), the schema fires multiple `on-complete` tags but the client must present the choice and fire only the appropriate one. This is the one case where client-layer selection is required — the schema defines what each outcome does, but cannot itself encode which choice the player made. The client presents the options, the player chooses, and the client fires the matching `on-complete` action:

```json
// Path choice — client presents three options, fires the chosen one
["on-complete", "give-item", "30078:<pubkey>:the-lake:item:path-wits"],
["on-complete", "give-item", "30078:<pubkey>:the-lake:item:path-fists"],
["on-complete", "give-item", "30078:<pubkey>:the-lake:item:path-team"]
```

Everything else — conditions, outcomes, state transitions, NPC behaviour — is fully expressed in the schema with no special client logic required.

---

### 2.7 Recipe (`type: recipe`)

Defines what items combine to produce a new item. Structurally identical to a sequence puzzle — `requires` tags define what's needed, `on-complete` fires the outcome, `ordered: true` enforces sequence. The only difference is that `requires` references inventory items rather than world event states, and the client presents it as a crafting UI rather than a puzzle.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:recipe:serpent-staff"],
    ["t",           "the-lake"],
    ["type",        "recipe"],
    ["state",       "unknown"],
    ["transition",  "unknown", "known", "You piece together how the staff was made."],
    ["requires",    "30078:<pubkey>:the-lake:item:wooden-rod",   "", ""],
    ["requires",    "30078:<pubkey>:the-lake:item:iron-key",     "", ""],
    ["requires",    "30078:<pubkey>:the-lake:item:serpent-gem",  "", ""],
    ["on-complete", "give-item",  "30078:<pubkey>:the-lake:item:serpent-staff"],
    ["on-complete", "set-state",  "known", "30078:<pubkey>:the-lake:clue:staff-origin"],
    ["ordered",     "false"]
  ],
  "content": ""
}
```

- `ordered: true` — ingredients must be combined in sequence; client evaluates `requires` in tag order
- Ingredients are consumed from inventory on completion; produced item is added
- A feature can be required for crafting: `["requires", "30078:<pubkey>:the-lake:feature:forge", "lit", "You need a lit forge."]`

---

### 2.8 NPC (`type: npc`)

An actor in the world. NPCs are placed by the place author via reference tags — they do not declare their own location. NPCs use the same `on-*` dispatcher as features, items, and places for all reactive behaviour — `on-interact`, `on-encounter`, `on-enter`, `on-attacked`. No separate `behaviour` tag needed.

A static NPC:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:npc:old-hermit"],
    ["t",           "the-lake"],
    ["type",        "npc"],
    ["title",       "Old Hermit"],
    ["noun",        "hermit", "old man", "man"],
    ["on-interact", "talk", "give-item", "30078:<pubkey>:the-lake:item:map-fragment"],
    ["on-interact", "talk", "set-state", "visible", "30078:<pubkey>:the-lake:clue:hermit-warning"],
    ["dialogue",    "30078:<pubkey>:the-lake:dialogue:hermit:greeting"],
    ["description", "A weathered old man sits by a dying fire."]
  ],
  "content": ""
}
```

A roaming NPC with autonomous behaviour:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",            "the-lake:npc:thief"],
    ["t",            "the-lake"],
    ["type",         "npc"],
    ["title",        "Thief"],
    ["speed",        "3"],
    ["order",        "random"],
    ["route",        "30078:<pubkey>:the-lake:place:treasure-room"],
    ["route",        "30078:<pubkey>:the-lake:place:maze-1"],
    ["route",        "30078:<pubkey>:the-lake:place:gallery"],
    ["route",        "30078:<pubkey>:the-lake:place:cyclops-room"],
    ["on-encounter", "player",    "steals-treasure"],
    ["on-enter",    "30078:<pubkey>:the-lake:place:treasure-room", "deposits"],
    ["on-attacked",  "consequence","30078:<pubkey>:the-lake:consequence:thief-flees"],
    ["stash",        "30078:<pubkey>:the-lake:place:treasure-room"],
    ["dialogue",     "30078:<pubkey>:the-lake:dialogue:thief-tree"],
    ["description",  "A seedy-looking individual in a trench coat."]
  ],
  "content": ""
}
```

A lethal NPC (grue):

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",            "the-lake:npc:grue"],
    ["t",            "the-lake"],
    ["type",         "npc"],
    ["title",        "Grue"],
    ["requires-not", "30078:<pubkey>:the-lake:item:brass-lantern", "on", ""],
    ["on-encounter", "player", "consequence", "30078:<pubkey>:the-lake:consequence:death"],
    ["description",  "A sinister, lurking presence in the dark."]
  ],
  "content": ""
}
```

The grue only exists (is rendered) when the lantern is off — `requires-not` on the NPC itself. When encountered, it fires the death consequence. No special-case client logic needed.

**Movement tags:**

| Tag | Value | Meaning |
|-----|-------|---------|
| `speed` | Integer string | Moves once every N player moves |
| `order` | `sequential` \| `random` | How the NPC traverses its route |
| `route` | Place `a`-tag | A place in the NPC's movement pool (multiple allowed) |
| `stash` | Place `a`-tag | Where the NPC deposits stolen or held items |
| `roams-when` | State string | NPC only roams when in this state; if absent, always roams |

`roams-when` allows movement to be state-conditional. An NPC with `route` tags but a `roams-when` state will only move when its current state matches. In any other state it stays at its spawn point. This means roaming can be activated or deactivated by a state transition — a consequence fires, the NPC transitions to the `roams-when` state, and the client begins routing it.

```json
// Always roams — no roams-when tag (Zork thief, bat)

// Only roams when ally — confined until freed (Sloth)
["roams-when", "ally"]

// Only patrols when blocking — stops when defeated
["roams-when", "blocking"]

// Only follows on team path
["roams-when", "following"],
["requires",   "30078:<pubkey>:the-lake:item:path-team", "", ""]
```

**Placement and spawn:** A roaming NPC is brought into the world by a place author referencing it with an `npc` tag — this is the NPC's spawn point, where it first appears. From there it roams its `route`. The place author controls where the NPC enters the world; the NPC's `route` controls where it goes after. If no place references the NPC, it doesn't exist in the world.

**NPC-blocked portals:** NPCs do not declare what they guard. If an NPC blocks a portal, express it as a `requires` on the portal itself — the portal requires the NPC to be in state `gone`. This keeps the blocking condition with the thing being blocked, consistent with the rest of the schema:

```json
// Portal blocked by troll
["requires", "30078:<pubkey>:the-lake:npc:troll", "gone", "The troll blocks your passage."]
```

NPC position is deterministic — seeded by player move count and the NPC's own `d` tag. Multiple NPCs with the same speed move independently. All players see the same NPC position at the same move count.

---

### 2.9 Dialogue (`type: dialogue`)

Each dialogue node is its own event. Nodes are grouped by `d` tag namespacing — all nodes for an NPC share a common prefix (e.g. `the-lake:dialogue:hermit:`), allowing the client to fetch the entire conversation in one relay query.

The NPC can carry multiple `dialogue` tags — each an alternative entry point with an optional `requires` condition. The client evaluates them in order and uses the **last one whose `requires` passes** — so the most advanced applicable entry point wins. If none have `requires`, the first is used as the unconditional root.

```json
["dialogue", "30078:<pubkey>:the-lake:dialogue:hermit:greeting"]
["dialogue", "30078:<pubkey>:the-lake:dialogue:hermit:after-cave",     "30078:<pubkey>:the-lake:dialogue:hermit:cave",     "visited"]
["dialogue", "30078:<pubkey>:the-lake:dialogue:hermit:after-blessing",  "30078:<pubkey>:the-lake:dialogue:hermit:blessing",  "visited"]
```

`dialogue` tag shape: `["dialogue", "<node-ref>", "<optional-requires-ref>", "<optional-state>"]`

This allows conversations to resume at the appropriate depth — a player who has already received the blessing won't be greeted as a stranger. The client gates options by evaluating each destination node's `requires` tags. Options whose destination fails `requires` are not rendered. No per-option conditions needed in the `option` tag itself.

**`option` shape:** `["option", "<label>", "<next-node-ref-or-blank>"]`  
Blank next = end of conversation.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",      "the-lake:dialogue:hermit:greeting"],
    ["t",      "the-lake"],
    ["type",   "dialogue"],
    ["text",   "What do you want, wanderer?"],
    ["option", "Ask about the cave", "30078:<pubkey>:the-lake:dialogue:hermit:cave"],
    ["option", "Ask about the key",  "30078:<pubkey>:the-lake:dialogue:hermit:key"],
    ["option", "Leave",              ""]
  ],
  "content": ""
}
```

A gated node — only offered when the player holds the map fragment:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",       "the-lake:dialogue:hermit:key"],
    ["t",       "the-lake"],
    ["type",    "dialogue"],
    ["requires", "30078:<pubkey>:the-lake:item:map-fragment", "", ""],
    ["text",    "Ah, you found the map. The key you seek is hidden behind the serpent gate."],
    ["option",  "Ask what the gate looks like", "30078:<pubkey>:the-lake:dialogue:hermit:gate"],
    ["option",  "Thank him and leave",          ""]
  ],
  "content": ""
}
```

A node that gives an item on visit:

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:dialogue:hermit:cave"],
    ["t",           "the-lake"],
    ["type",        "dialogue"],
    ["text",        "The cave is old. Older than me. Don't go north without the serpent's blessing."],
    ["on-enter",    "player", "give-item", "30078:<pubkey>:the-lake:item:map-fragment"],
    ["option",      "Ask what the blessing is", "30078:<pubkey>:the-lake:dialogue:hermit:blessing"],
    ["option",      "Thank him and leave",       ""]
  ],
  "content": ""
}
```

**Client flow:**
1. Player enters place → client fetches all `type:dialogue` events prefixed `the-lake:dialogue:hermit:`
2. NPC's `dialogue` tags evaluated in order — last passing `requires` wins as entry point
3. Client renders entry node text and options
4. For each `option`, evaluates destination node's `requires` — hides failing options
5. Player selects option → client moves to destination node, repeats
6. Blank next → conversation ends

---

### 2.10 Consequence (`type: consequence`)

A reusable outcome definition. Consequences are fired by portals, NPCs, or `on-interact` actions — they define what happens to player state, not why. Multiple callers can reference the same consequence event.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",         "the-lake:consequence:death"],
    ["t",         "the-lake"],
    ["type",      "consequence"],
    ["respawn",   "30078:<pubkey>:the-lake:place:west-of-house"],


    ["clears",    "crypto-keys"]
  ],
  "content": "It is pitch black. You are likely to be eaten by a grue."
}
```

**Consequence tags:**

| Tag | Value | Effect |
|-----|-------|--------|
| `respawn` | Place `a`-tag | Moves player to this place |
| `clears` | State key | Wipes this part of player state |
| `give-item` | Item `a`-tag | Adds item to inventory |
| `consume-item` | Item `a`-tag | Removes item from inventory |
| `deal-damage` | Integer string | Reduces player health |

State keys for `preserves` / `clears`: `inventory`, `item-states`, `feature-states`, `flags`, `solved`, `defeated-npcs`, `unlocked-gates`, `crypto-keys`, `known-recipes`, `visited`.

**Referencing a consequence:**

```json
// From a lethal portal (fired when requires fails)
["consequence", "30078:<pubkey>:the-lake:consequence:death"]

// From an NPC encountering the player in the same place
["on-encounter", "player", "consequence", "30078:<pubkey>:the-lake:consequence:death"]

// From on-interact dispatcher
["on-interact", "touch", "consequence", "30078:<pubkey>:the-lake:consequence:cursed"]

// Room entry triggers a consequence
["on-enter", "", "consequence", "30078:<pubkey>:the-lake:consequence:victory"]
```

A lethal portal fires its consequence on traversal attempt when `requires` conditions are not met:

```json
{
  "kind": 30078,
  "tags": [
    ["d",           "the-lake:portal:chasm-crossing"],
    ["t",           "the-lake"],
    ["type",        "portal"],
    ["exit", "30078:<pubkey>:the-lake:place:east-of-chasm", "west", "A narrow ledge crosses the chasm."],
    ["exit", "30078:<pubkey>:the-lake:place:west-of-chasm", "east", "A narrow ledge crosses the chasm."],
    ["requires", "30078:<pubkey>:the-lake:place:east-of-chasm", "bridged", "The ledge crumbles beneath you."],
    ["consequence", "30078:<pubkey>:the-lake:consequence:fell-into-chasm"]
  ]
}
```

If `requires` passes — player crosses. If it fails — consequence fires instead of blocking. This replaces the old `lethal` flag idea with something more expressive: the portal author decides exactly what happens on a failed crossing.

---

### 2.11 Combat

Combat is not a separate system — it is the `on-*` dispatcher applied to health values. The schema provides the data; the client resolves the round sequence. Different games define different combat feels purely through tag values.

**Combat tags on NPCs:**

| Tag | Value | Meaning |
|-----|-------|---------|
| `health` | Integer string | NPC hit points |
| `damage` | Integer string | Damage dealt per hit |
| `hit-chance` | Float string `0.0–1.0` | Probability of hitting (optional, default `1.0`) |

**Combat tags on items (weapons):**

| Tag | Value | Meaning |
|-----|-------|---------|
| `damage` | Integer string | Damage dealt when used to attack |
| `hit-chance` | Float string `0.0–1.0` | Probability of hitting (optional, default `1.0`) |

**Player health** is tracked in local player state:
- `health` — current hit points
- `max-health` — ceiling (set by the world, default client-defined)

**Combat round sequence (client responsibility):**
1. Player issues `attack` verb → fires `deal-damage-npc` on target NPC
2. If NPC health > 0, NPC `on-attacked` fires → `deal-damage` on player
3. Check NPC health — if zero, fire `on-health-zero` consequence
4. Check player health — if zero, fire `on-player-health-zero` consequence (typically death)

**A complete Zork-style troll:**

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",                "the-lake:npc:troll"],
    ["t",                "the-lake"],
    ["type",             "npc"],
    ["title",            "Troll"],
    ["health",           "6"],
    ["damage",           "3"],
    ["on-encounter",     "player",      "deal-damage",   "3"],
    ["on-attacked",      "player",      "deal-damage",   "3"],
    ["on-health-zero",   "consequence", "30078:<pubkey>:the-lake:consequence:troll-dies"],
    ["description",      "A nasty troll brandishing a bloody axe."]
  ],
  "content": ""
}
```

**A weapon:**

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",           "the-lake:item:elvish-sword"],
    ["t",           "the-lake"],
    ["type",        "item"],
    ["title",       "Elvish Sword"],
    ["damage",      "4"],
    ["hit-chance",  "0.8"],
    ["verb", "attack"],
    ["on-interact", "attack", "deal-damage-npc", ""],
    ["description", "A blade of elvish steel, glowing faintly blue."]
  ],
  "content": ""
}
```

`deal-damage-npc` with an empty target hits the NPC in the current place. In multi-NPC rooms the client resolves targeting by last referenced NPC or prompts the player.

**Varying combat systems through data:**

| System | Tags |
|--------|------|
| Zork-simple | Fixed `damage`, `hit-chance: 1.0`, low NPC `health` |
| D&D-lite | `hit-chance: 0.65`, higher `health`, multiple weapon tiers |
| One-hit | NPC `health: 1`, weapon `damage: 1` — have the right sword or don't |
| Pacifist | No `health` or `damage` tags — combat simply doesn't exist |
| Souls-like | High NPC `health`/`damage`, low player `max-health`, specific weapon `requires` |

**A healing item:**

```json
{
  "kind": 30078,
  "tags": [
    ["d",           "the-lake:item:healing-potion"],
    ["t",           "the-lake"],
    ["type",        "item"],
    ["title",       "Healing Potion"],
    ["verb", "drink"],
    ["on-interact", "drink", "heal",         "6"],
    ["on-interact", "drink", "consume-item", ""],
    ["description", "A vial of glowing green liquid."]
  ]
}
```

**Counters and consumable resources:**

Any item, feature, or NPC can carry a named counter — a numeric value tracked in player state that ticks under defined conditions. This handles lantern battery life, torch fuel, NPC patience, charged altars, and any other resource that depletes over time.

```json
{
  "kind": 30078,
  "tags": [
    ["d",               "the-lake:item:brass-lantern"],
    ["t",               "the-lake"],
    ["type",            "item"],
    ["title",           "Brass Lantern"],
    ["state",           "off"],
    ["counter",         "battery", "300"],
    ["transition",      "off",  "on",   "The lantern flickers to life."],
    ["transition",      "on",   "off",  "Darkness closes in."],
    ["transition",      "on",   "dead", "The lantern slowly fades out and darkness looms."],
    ["transition",      "dead", "dead", "The lantern is dead. Nothing happens."],
    ["on-interact",     "turn on",  "set-state",   "on"],
    ["on-interact",     "turn off", "set-state",   "off"],
    ["on-move",         "on",       "decrement",   "battery"],
    ["on-counter-zero", "battery",  "set-state",   "dead"],
    ["on-counter-zero", "battery",  "consequence", "30078:<pubkey>:the-lake:consequence:lamp-dies"],
    ["description",     "A battery-powered brass lantern."]
  ]
}
```

The `transition` table enforces legal state changes — the client blocks any `set-state` not listed. `["transition", "dead", "dead", "..."]` is a terminal state declaration. The optional fourth element is **transition text**, rendered to the player when the transition fires. It applies universally to items, features, and NPCs — a door groaning open, a troll staggering, an altar going dark.

---

## 3. Cryptographic Puzzle Mechanics

The central innovation: puzzle gates are not simulated — they use actual cryptography. A locked event cannot be read without the key, regardless of relay access.

---

### 3.1 NIP-44 Encrypted Places / Clues

A sealed place or clue has its `content` encrypted via NIP-44 and declares `content-type: application/nip44`. The `state` is set to `sealed`. The corresponding private key is the "key item" in the game world — found by solving puzzles, earned through play.

```json
{
  "kind": 30078, "tags": [
    ["d",            "the-lake:place:sanctum"],
    ["t",            "the-lake"],
    ["type",         "place"],
    ["title",        "The Sanctum"],
    ["state",        "sealed"],
    ["content-type", "application/nip44"]
  ],
  "content": "<NIP44_Encrypt(plaintext, lock_pubkey)>"
}
```

The client detects `content-type: application/nip44`, attempts decryption with any held crypto keys, and renders the decrypted content on success. On failure the place description is withheld — the player knows they're missing something.

**What this means in practice:**
- The place event exists on relays and is publicly visible
- Its `content` is ciphertext — unreadable without the private key
- No amount of relay scraping helps. The key must be found in-game.

---

### 3.2 Hash Preimage Puzzles

Used for riddles, codes, and observed secrets. The answer is never stored.

```
answer-hash = SHA256(player_answer + salt)
```

The client hashes the player's input with the known salt and compares to `answer-hash`. Match = solved. The event never contains the answer in any form.

**Salt design:** Use a deterministic, human-readable salt tied to the puzzle identity (e.g. `the-lake:puzzle:serpent-riddle:v1`). This prevents rainbow table attacks across puzzles while remaining reproducible.

---

### 3.3 Derived Key Puzzles

More advanced: the key to decrypt a location is not found directly but *derived* from combining information scattered across the world.

```
key = SHA256(fragment_1 + fragment_2 + fragment_3)
```

Each fragment is a clue found in a different location. No single fragment is useful. Players must explore, collect, and combine information to reconstruct the key. The derived key unlocks a NIP-44 encrypted event.

This enables multi-stage quests with no server coordination required.

---

### 3.4 Schnorr Signature Gating

For "possession proof" mechanics. A key item in the game world is a real NOSTR keypair (pubkey embedded in the item event, private key revealed on acquisition).

To pass a gate, the player signs a challenge string with that keypair. The gate event contains the expected pubkey. The client verifies locally.

```
gate requires: sign("open:the-lake:portal:sanctum-gate") with <key_pubkey>
```

Nobody can fake possession without the private key.

---

## 4. Player State & Inventory

Player state is personal and instanced. No two players share progression state. The world map is shared; what you've done in it is yours alone.

---

### 4.1 What Player State Covers

- **Inventory** — list of item `a`-tag references with current state per item (non-scarce; items can be held by many players)
- **Item states** — per-item state values for carried items (e.g. lantern: `on`, mirror: `angled`)
- **Feature states** — per-feature state values for interacted features (e.g. window: `open`, chest: `opened`)
- **Event states** — per-event current state for all interactive events (features, items, NPCs, rooms, puzzles) tracked in local player state
- **NPC states** — per-NPC current state (`gone`, `present`, `blocking` etc.) tracked in local player state
- **Unlocked gates** — set of lock `d`-tags whose crypto conditions the player has satisfied
- **Held crypto keys** — private keys discovered or derived through play (these unlock NIP-44 sealed events)
- **Known recipes** — set of recipe `d`-tags revealed through clues or experimentation
- **Visited places** — set of place `d`-tags (for map rendering and dialogue conditions)
- **Health** — current hit points; `max-health` ceiling defined by the world or client default
- **NPC health** — per-NPC current health, tracked locally per player

---

### 4.2 Local State (Primary)

Player state lives on the client device. No relay writes required for normal play.

**Pros:** Private, fast, zero relay dependency, no contention with other players.  
**Cons:** Not portable across devices without export; lost if cleared.

---

### 4.3 NOSTR-Signed Backup (Optional)

Player publishes encrypted state events to relays for portability. Content is NIP-44 encrypted to the player's own pubkey — only they can read it.

```json
{
  "kind": 30078,
  "pubkey": "<player_pubkey>",
  "tags": [
    ["d", "the-lake:player-state:<player_pubkey>"],
    ["t", "the-lake"],
    ["type", "player-state"]
  ],
  "content": "<NIP-44 encrypted state blob>"
}
```

The client publishes this periodically as a checkpoint. On a new device, the player loads their keypair and the client fetches + decrypts their state.

**Recommendation:** Local state as primary, signed backup as opt-in sync mechanism.

---

### 4.4 Inventory & Non-Scarcity

Items are non-scarce by design. Multiple players can hold the same item simultaneously. This is intentional — the item is not the gate, the cryptographic condition is.

The iron key in your inventory does nothing on its own. The chest requires the *private key* that decrypts its NIP-44 sealed content. That private key must be earned through play. Holding the item is flavour; satisfying the crypto condition is progression.

---

## 5. World State Model

**Resolved.** The world uses a hybrid model across three distinct layers. Each layer uses the right tool for the job — none of them fight NOSTR's nature.

---

### 5.1 The Three Layers

| Layer | What it covers | Storage | Mutability |
|-------|---------------|---------|------------|
| **Map** | Rooms, portals, placed items | NOSTR events | Additive + replaceable by author |
| **Personal** | Puzzles solved, gates unlocked, inventory | Local client + optional signed backup | Player-owned, private |
| **World events** | Crypto key publications, major unlocks | NOSTR events (immutable) | Write-once, global, irreversible |

---

### 5.2 Map Layer — Shared and Living

The map is the one truly shared layer. Rooms and portals are NOSTR events — additive by nature. Nobody mutates existing events; they publish new ones. Portal contests, new places, new connections — all expressed as new events. The map evolves without any consensus mechanism.

A player-builder who notices an unconnected exit slot (`exit:north` with no portal) can publish a new place and a portal to connect it. That change is immediately visible to all players. The world grows.

A disconnected exit slot is rendered as a hint to builders: *"there is a crack in the northern wall, just wide enough to suggest a passage — but it leads nowhere yet."*

---

### 5.3 Personal Layer — Instanced Per Player

Puzzle solves, gate states, and inventory are **per-player, not global**. The iron gate is open *for you* because *you* solved the puzzle. Someone else must earn it themselves.

This means:
- No consensus needed for progression state
- No player can block another by "taking" a solve
- Items are non-scarce — anyone can pick up the iron key
- The lock doesn't care who holds the item, only whether the crypto condition is satisfied

**Item non-scarcity is intentional.** Possession is bookkeeping. Access is cryptographic.

---

### 5.4 World Events Layer — Irreversible Global State

For high-stakes moments — a major puzzle solved for the first time, a sealed region opened, a world-changing discovery — the state change is expressed by **publishing a decryption key** as a NOSTR event.

```json
{
  "kind": 1,
  "pubkey": "<puzzle_author_pubkey>",
  "tags": [
    ["t",       "the-lake"],
    ["reveals", "30078:<pubkey>:the-lake:portal:ancient-seal"]
  ],
  "content": "<decryption_key_or_derived_secret>"
}
```

Once published, the key is public. The sealed region is open for everyone. This is irreversible — the event is immutable. These are designed to be rare, dramatic world events. The first player to crack a deep puzzle doesn't just solve it for themselves — they change the world.

---

### 5.5 The Scarcity Principle

> Scarcity is about *knowledge and access*, not possession.

Anyone can pick up the iron key. But picking it up means nothing on its own. The chest is locked because its content is NIP-44 encrypted to a specific public key. The corresponding private key must be *earned* — found by solving puzzles, decrypting clues, navigating the world. The cryptographic depth *is* the barrier.

This dissolves the hard distributed-state problem for items entirely. No consensus, no first-claim races, no cheating via relay reads. The relay can be read in full — it doesn't help without the key.

---

## 6. Trust & Curation Model

A fully permissionless world is philosophically pure but practically unnavigable. The client needs a trust model to decide what to render.

---

### 6.1 Trust Gradient

Every event has an author pubkey. The client maintains a trust score per pubkey based on social graph distance from the **genesis keypair** (the root of the canonical world).

| Trust level | Who | Client behaviour |
|-------------|-----|-----------------|
| Genesis | Game's root keypair | Always rendered, canonical |
| Tier 1 | Followed by genesis | Rendered by default |
| Tier 2 | Followed by Tier 1 | Rendered with indicator |
| Fringe | Outside trust graph | Hidden by default, opt-in |

---

### 6.2 Portal Conflict Resolution

When two portals claim the same exit slot:

1. Highest trust author wins (rendered as primary)
2. Lower trust portal rendered as *"you sense an unstable shimmer to the north — there may be another way"*
3. Player can explicitly choose to follow a fringe portal (explorer mode)

---

### 6.3 Client Modes

| Mode | Description |
|------|-------------|
| **Canonical** | Only trust-graph events. Stable, curated world. |
| **Community** | Trust graph + vouched extensions. Default recommended. |
| **Explorer** | All events from all pubkeys. Chaotic, full world. |
| **Archive** | Specific relay snapshot. Historical world state. |

---

### 6.4 Vouching

A trusted author can vouch for a fringe author's rooms/portals by publishing a vouch event:

```json
{
  "kind": 30078,
  "pubkey": "<trusted_author>",
  "tags": [
    ["d",     "the-lake:vouch:bobs-dungeon-wing"],
    ["t",     "the-lake"],
    ["type",  "vouch"],
    ["vouch", "30078:<bob_pubkey>:the-lake:place:bobs-entrance"],
    ["vouch", "30078:<bob_pubkey>:the-lake:portal:clearing-to-bobs-wing"]
  ]
}
```

Bob's rooms are now promoted to the vouching author's trust tier in clients that follow the voucher.

---

## 7. NPC & Dialogue System

NPCs are world actors defined by their author. They can be static (always say the same thing) or dynamic (state-aware).

---

### 7.1 NPC Behaviour Types

| Type | Description |
|------|-------------|
| `static` | Fixed dialogue, always available |
| `conditional` | Dialogue/items change based on player state |
| `guardian` | Blocks a lock until a condition is met |
| `merchant` | Trades items (possibly for sats) |
| `quest-giver` | Triggers a quest chain on interaction |

---

### 7.2 Conditional Dialogue

`requires` conditions live on the **destination node**, not on the `option` tag. The client evaluates each destination node's `requires` against player state before rendering the option. Options whose destination fails `requires` are hidden. This is the same evaluation logic used for rooms, portals, and features — no special dialogue condition handling needed.

```json
// Option is always shown — destination has no requires
["option", "Ask about the cave", "30078:<pubkey>:the-lake:dialogue:hermit:cave"]

// Option only shown if player holds map fragment — requires lives on the destination node
["option", "Ask about the key",  "30078:<pubkey>:the-lake:dialogue:hermit:key"]

// hermit:key node — requires evaluated before offering this option
{
  "tags": [
    ["d",        "the-lake:dialogue:hermit:key"],
    ["requires", "30078:<pubkey>:the-lake:item:map-fragment", "", ""],
    ["text",     "Ah, you found the map..."],
    ...
  ]
}
```

Condition types are the same as everywhere:

| Type | Evaluates true when |
|------|---------------------|
| `item` | Player holds item; optional state check |
| `flag` | Named flag is set in player state |
| `solved` | Player has solved the referenced puzzle |
| `npc` | NPC exists in a given state (`gone`, `present`, `blocking`, or blank for any) |

---

### 7.3 NPC Placement — Room-Owned

NPCs do not self-place. The place author controls which NPCs appear in their place by adding `npc` reference tags to their place event. Since place events are replaceable, the author can add or remove NPCs at any time by republishing.

This means:
- A place author can invite another author's NPC into their place by referencing it
- Cross-author NPC placement requires the place author's active cooperation
- Nobody can inject an NPC into a place they don't control
- An NPC event with no place referencing it exists but is invisible — orphaned until a place adopts it

This mirrors the portal model: the connection is always owned by the party granting access. For portals, the place author owns the exit slot. For NPCs, the place author owns the guest list.

---

## 8. Progression & Quest Design

---

### 8.1 Quest as Event Graph

A quest is not a separate event type — it emerges from the graph of connected primitives. A quest chain is:

```
Clue → found in Room
  → hints at Recipe
    → combine Items → produces Item
      → satisfies Lock (key-type) → on Portal
        → Portal leads to Room
          → Room contains Puzzle
            → Puzzle (solved) → unlocks Lock (crypto-type) → on Item
              → Item is encrypted Clue
                → Clue reveals hidden Room
```

No quest tracking event is required. The player's progress through the graph *is* the quest.

---

### 8.2 Quest Hooks (optional `type: quest`)

For named, trackable quests, an optional quest event groups the chain and defines completion. Completion uses the same `requires` tags as everywhere else — the client evaluates them against player state. When all `requires` conditions pass, the quest is complete.

```json
{
  "kind": 30078,
  "pubkey": "<author_pubkey>",
  "tags": [
    ["d",        "the-lake:quest:the-serpents-staff"],
    ["t",        "the-lake"],
    ["type",     "quest"],
    ["title",    "The Serpent's Staff"],
    ["involves", "30078:<pubkey>:the-lake:puzzle:chapel-riddle"],
    ["involves", "30078:<pubkey>:the-lake:recipe:serpent-staff"],
    ["requires", "30078:<pubkey>:the-lake:item:serpent-staff", "", ""],
    ["requires", "30078:<pubkey>:the-lake:place:sanctum", "visited", ""],
    ["requires", "30078:<pubkey>:the-lake:puzzle:chapel-riddle", "solved", ""]
  ],
  "content": "Somewhere in the cave system lies the legendary Serpent's Staff. The hermit knows something."
}
```

`requires` is consistent across the entire schema — the same evaluation model the client uses for rooms, features, portals, locks, and dialogue nodes applies here unchanged. Multiple `requires` tags = all must be satisfied (AND logic).

`involves` tags are optional hints for the client's quest log UI — they indicate which events are part of this quest chain without affecting completion logic.

**Score** — numeric scoring (e.g. points per treasure deposited) is client-side presentation, not schema. The client can derive a score from whatever rule fits the game. No schema tag needed.

---

### 8.3 World Tiers

The world should have a natural progression structure:

| Tier | Description | Lock types used |
|------|-------------|----------------|
| Surface | Starting areas, tutorial mechanics | `key`, simple `combo` |
| Shallow | First real puzzles, NPC quests | `puzzle`, `combined-item` |
| Deep | Multi-stage quest chains | `crypto`, `derived-key` |
| Hidden | Secret areas, endgame content | `schnorr`, `condition` |

Deeper tiers use harder cryptographic lock types. The difficulty gradient maps to cryptographic complexity.

---

### 8.4 The Meta-Game

The living world creates emergent player roles beyond the standard adventurer:

| Role | Activity |
|------|---------|
| **Explorer** | Maps the world, publishes reliable portal guides |
| **Builder** | Creates new places and wings, seeks connections |
| **Saboteur** | Publishes misleading portals, seals passages |
| **Gatekeeper** | Controls high-traffic portal hubs |
| **Archivist** | Runs relays preserving historical world states |
| **Solver** | Focuses on cryptographic puzzle chains |

---

## 9. Client Architecture

A web client with two modes: **Play** and **Build**. Same keypair, same identity, different UI. A player can switch into builder mode at any time to inspect the world structure, publish new places, or forge portal connections to unexplored exit slots.

---

### 9.1 Dual Mode Design

**Play mode** — the classic text adventure experience. Room descriptions, exits, items, NPCs. Command input. No structural metadata visible.

**Build mode** — the world's scaffolding exposed. Unconnected exit slots highlighted. Place event IDs visible. Portal authorship shown. Tools to publish new places, portals, items, clues, puzzles. A map view showing the local graph of connected rooms.

The two modes share all state. Switching is a UI toggle, not a different session.

---

### 9.2 Component Overview

```
┌──────────────────────────────────────────────────┐
│                    Web Client                    │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────────┐ │
│  │  Relay Pool  │   │    World Graph Cache     │ │
│  │  (multi)     │──▶│  rooms, portals, items,  │ │
│  └──────────────┘   │  locks, clues, puzzles   │ │
│                     └────────────┬─────────────┘ │
│  ┌──────────────┐                │               │
│  │ Trust Engine │◀───────────────┤               │
│  │ (social      │                │               │
│  │  graph)      │   ┌────────────▼─────────────┐ │
│  └──────────────┘   │      Render Engine       │ │
│                     │  Play mode / Build mode  │ │
│  ┌──────────────┐   │  place, exits, items,     │ │
│  │ Crypto Layer │◀──│  NPCs, graph overlay     │ │
│  │ NIP-44,      │   └────────────┬─────────────┘ │
│  │ SHA256,      │                │               │
│  │ Schnorr      │   ┌────────────▼─────────────┐ │
│  └──────────────┘   │      Player State        │ │
│                     │  local + encrypted NOSTR │ │
│  ┌──────────────┐   │  signed backup           │ │
│  │ Input Parser │   └──────────────────────────┘ │
│  │ (verb/noun + │                                │
│  │  build cmds) │                                │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
```

---

### 9.3 Room Rendering Flow

When the player enters a place:

1. Fetch place event by `a`-tag reference (latest version)
2. Query relays for all `kind:30078` / `type:portal` events with `#exit` tag matching this place's `a`-tag (place-ref is the indexed second element)
3. Filter portals by trust model — discard fringe unless in explorer mode
4. For each portal, check for `kind:30078` / `type:lock` events targeting it — determine if traversable
5. Resolve `item` tags → fetch item events → filter out locally picked-up items
6. Resolve `feature` tags → fetch feature events → check for locks on each
7. Resolve `npc` tags → fetch NPC events → fetch dialogue trees
8. Resolve `puzzle` tags directly on place (if any) → fetch puzzle events
9. Render: place description, visible exits with labels, items, features, NPCs
10. Prefetch adjacent places in background

---

### 9.3 Relay Strategy

- Publish world events to **multiple relays** for redundancy
- Subscribe using `#t` tag filter to scope to a specific world — `t: the-lake` returns only events for this game instance. A different `t` tag = a different world, same client, same kind numbers.
- Cache aggressively — world events change rarely, player state changes often
- For replaceable events, always request latest (relay serves most recent by `d` + pubkey)
- Consider a **dedicated game relay** that only accepts events with `t: the-lake` to reduce noise and improve query performance as the world grows

---

### 9.4 Conflict Resolution Flow

When two portals claim the same exit slot:

```
Fetch all portals for exit slot
  │
  ├─ Only one? → Render normally
  │
  └─ Multiple?
       │
       ├─ Filter by trust → One survives? → Render normally
       │
       └─ Still multiple?
            │
            ├─ Render primary (highest trust) as normal exit
            └─ Render others as "unstable shimmer" — player can investigate
```

---

## 10. Open Questions

Remaining design decisions before or during build:

| # | Question | Options | Notes |
|---|----------|---------|-------|
| 1 | Private key storage in client | Client keystore / derived from player key / browser extension | Security vs UX — browser keystore for MVP |
| 2 | NPC liveness | Static events only / author-operated bots / AI-driven | Static for MVP |
| 3 | Relay incentives | Free relays / paid relays / dedicated game relay | Dedicated relay recommended long-term |
| 4 | Player identity | Fresh keypair per game / existing NOSTR identity | Existing identity preferred — social graph benefits |
| 5 | Build mode publish flow | Immediate publish / draft + preview / co-sign required | Draft + preview recommended |
| 6 | Map view in build mode | 2D graph / ASCII map / force-directed graph | Force-directed graph most natural for NOSTR event graph |

---

*Resolved questions (no longer open):*
- ~~Item scarcity model~~ → Non-scarce items, cryptographic access control
- ~~Shared world state~~ → Hybrid: map shared, progression personal, world events via key publication
- ~~World forking~~ → Forks are a feature; client modes (canonical / community / explorer)
- ~~Mobile vs web~~ → Web client first, play + build modes

---

## 11. MVP Scope

*See separate MVP scoping document.*

---

*Last updated: March 2026*  
*Status: Design complete — ready to scope MVP*
