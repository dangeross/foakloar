# Quests: Tracking Player Progress

Quests give players direction. They are named objectives with trackable steps that the client evaluates automatically. When a quest's conditions are all met, it completes — no scripting required.

This guide covers quest events, the four quest display types, the `involves` and `requires` tags on quests, quest rewards, and chaining.

> ▶ **Try it:** Import [tides-end-06-quests.json](tutorials/tides-end-06-quests.json) to explore these concepts in a working world.

---

## What is a Quest?

A quest is an event with `type: quest`. It defines a named objective with completion conditions using the same `requires` tags used everywhere else in the schema. The client continuously evaluates all quest `requires` tags against player state. When every condition passes, the quest is marked complete.

```json
{
  "tags": [
    ["d",          "my-world:quest:keepers-stew"],
    ["type",       "quest"],
    ["title",      "The Keeper's Stew"],
    ["quest-type", "open"],
    ["involves",   "30078:<PUBKEY>:my-world:item:fish"],
    ["involves",   "30078:<PUBKEY>:my-world:item:herbs"],
    ["involves",   "30078:<PUBKEY>:my-world:item:flour"],
    ["requires",   "30078:<PUBKEY>:my-world:item:fish", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:herbs", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:flour", "", ""]
  ],
  "content": "Gather fish, herbs, and flour for the tavern keeper."
}
```

Key tags:
- **`title`** — the quest name shown in the quest log.
- **`quest-type`** — controls how the quest log reveals progress. See below.
- **`involves`** — references to events that represent quest steps. Used for the quest log display only — they do not affect completion logic.
- **`requires`** — the actual completion conditions. All must pass for the quest to complete. Same evaluation model as portals, features, and locks.
- **`content`** — the quest description. Shown when the player views the quest.

---

## The Quest Log

Players type `quests` (or `q`) to view their quest log. The log shows active quests with their step progress, and completed quests below.

A quest step is "done" when the referenced event has changed from its default state. Specifically, a step is complete when any of these are true:
- The event is an item and the player holds it
- The event is a puzzle and the player has solved it
- The event has a state different from its initial `state` tag value

This means `involves` tags should reference events that change state as the player progresses — items to collect, puzzles to solve, features that react to interaction.

---

## Quest Types

The `quest-type` tag controls how much the quest log reveals to the player. There are four display types:

### open (default)

All steps are visible. Completed steps show a check mark, incomplete steps show an X with the step title. The player can see exactly what remains.

```
  ○ The Keeper's Stew
    ✓ Fresh Fish
    ✗ Wild Herbs
    ✗ Flour Sack
```

**When to use:** Fetch quests, shopping lists, any objective where the player should know exactly what to do. Good for tutorials and straightforward tasks.

### hidden

The number of steps is visible, but incomplete step titles are replaced with `???`. The player knows how many steps remain without knowing what they are.

```
  ○ Village Explorer
    ✓ The Dock
    ✗ ???
    ✗ ???
    ✗ ???
```

**When to use:** Exploration objectives, collection quests where discovery is part of the fun. The player can gauge progress without spoiling the specifics.

### mystery

Only completed steps are shown. Incomplete steps are completely hidden — the player has no idea how many remain or what they involve.

```
  ○ The Strange Note
    ✓ Strange Note
```

**When to use:** Investigative quests, secrets, narrative arcs where the scope should be unknown. The player discovers the quest's shape only by completing it.

### sequential

Only the next incomplete step is shown. Previous completed steps are visible, but future steps remain hidden. This creates a breadcrumb trail.

```
  ○ The Ritual
    ✓ Find the altar
    ✗ Light the candles
```

**When to use:** Multi-stage quest chains where each step logically follows the last. Good for guided narratives where steps must be done in order.

---

## The involves Tag

`involves` is a display hint for the quest log. It tells the client which events represent meaningful milestones. The tag takes a single event reference:

```json
["involves", "30078:<PUBKEY>:my-world:item:fish"]
```

The referenced event must exist in the world. The client looks up the event, reads its title, and checks whether the player has interacted with it in a meaningful way (picked it up, changed its state, solved it).

**Important:** `involves` does not affect quest completion. A quest can have involves tags for events that are not in its `requires` list, and vice versa. The involves tags control what the player sees; the requires tags control when the quest completes.

In practice, most quests will have matching involves and requires. But they serve different purposes:
- `involves` = "show this step in the quest log"
- `requires` = "this condition must be true for the quest to complete"

---

## Quest Completion

Quest completion is fully automatic. The client evaluates all quest `requires` tags on every state change — picking up items, changing states, solving puzzles, entering rooms. When all conditions pass simultaneously, the quest completes.

On completion:
1. The quest's state is set to `complete` in player state (automatically — authors do not set this manually).
2. A "Quest complete" message is displayed.
3. Any `on-complete` actions fire (see below).
4. All other quests are immediately re-evaluated, enabling cascade completion.

### Rewards with on-complete

Quests can fire actions when they complete, using the same dispatcher as puzzles and recipes:

```json
["on-complete", "", "give-item",  "30078:<PUBKEY>:my-world:item:stew"],
["on-complete", "", "set-state",  "rewarded"],
["on-complete", "", "set-state",  "open", "30078:<PUBKEY>:my-world:portal:secret-door"]
```

Supported actions: `give-item`, `set-state`, `consequence`, `sound`.

Without `on-complete` tags, quest completion still updates the quest log and records progress. The reward is optional.

---

## Quest Chaining

Quests can depend on other quests. When Quest A completes, its state becomes `complete`. Quest B can require that state:

```json
{
  "tags": [
    ["d",        "my-world:quest:phase-two"],
    ["type",     "quest"],
    ["title",    "Phase Two"],
    ["requires", "30078:<PUBKEY>:my-world:quest:phase-one", "complete", ""]
  ]
}
```

The client cascades evaluation: completing one quest immediately re-evaluates all others. Chains of arbitrary depth resolve in a single pass (up to 10 levels deep).

This enables quest chains: a prologue quest leads to an investigation quest, which leads to a confrontation quest. Each quest in the chain has its own objectives, display type, and rewards. An endgame quest can sit at the end of the chain — when its requires pass, the game is won.

---

## Builder Walkthrough: Creating a Fetch Quest

Here is a step-by-step guide to creating a simple fetch quest where the player collects three ingredients.

### Step 1: Create the items

Each ingredient is a standard item event placed in different locations:

```json
{
  "tags": [
    ["d",     "my-world:item:fish"],
    ["type",  "item"],
    ["title", "Fresh Fish"],
    ["noun",  "fish", "fresh fish"]
  ],
  "content": "A silvery fish, still wet and glistening."
}
```

Place each item in its respective place event using the `item` tag:

```json
["item", "30078:<PUBKEY>:my-world:item:fish"]
```

### Step 2: Create the reward item

The reward is another item that does not start in any place — it is given to the player by the quest's `on-complete` action:

```json
{
  "tags": [
    ["d",     "my-world:item:stew"],
    ["type",  "item"],
    ["title", "Bowl of Stew"],
    ["noun",  "stew", "bowl", "bowl of stew"]
  ],
  "content": "A steaming bowl of thick fish stew."
}
```

### Step 3: Create the quest event

The quest references the items as involves steps and requires conditions:

```json
{
  "tags": [
    ["d",          "my-world:quest:keepers-stew"],
    ["type",       "quest"],
    ["title",      "The Keeper's Stew"],
    ["quest-type", "open"],
    ["involves",   "30078:<PUBKEY>:my-world:item:fish"],
    ["involves",   "30078:<PUBKEY>:my-world:item:herbs"],
    ["involves",   "30078:<PUBKEY>:my-world:item:flour"],
    ["requires",   "30078:<PUBKEY>:my-world:item:fish", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:herbs", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:flour", "", ""],
    ["on-complete", "", "give-item", "30078:<PUBKEY>:my-world:item:stew"]
  ],
  "content": "Gather fish, herbs, and flour for the tavern keeper."
}
```

The `requires` tags with empty state on items check that the player holds the item (any state). When all three items are in the player's inventory, the quest completes and the stew is given.

### Step 4: Publish

Publish all events — the items, the reward, and the quest — to the same world tag. The quest appears in the quest log immediately. No registration step is needed.

---

## Tips

- **Quest type affects display only** — The underlying completion logic is identical regardless of quest type. Changing `quest-type` from `open` to `mystery` does not change when the quest completes — it only changes what the player sees in the quest log.
- **involves vs requires** — Use `involves` for the steps you want displayed in the quest log. Use `requires` for the actual completion gates. They usually overlap, but you might want to show progress on a step that is not strictly required (e.g. an optional side objective), or require a condition you do not want to display (e.g. a hidden feature state).
- **Quest chaining is powerful** — Chain quests by having later quests require earlier ones in state `complete`. This creates narrative arcs with distinct phases. Each phase can have its own quest type — an open prologue, a hidden investigation, a mystery finale.
- **Tracking place visits** — The `requires` system does not directly check whether a place has been visited. To create exploration quests, use hidden feature events (one per place) with a default state of `unvisited`, and add `on-enter` triggers to the place events that set these features to `visited`. The quest then requires each landmark feature in state `visited`.
- **Auto-evaluation** — Quests evaluate on every state change. You do not need to trigger evaluation manually. Picking up an item, solving a puzzle, entering a room — all of these trigger quest re-evaluation. If a quest's conditions are met, it completes immediately.
- **Endgame quests** — Use `quest-type: endgame` for the game's win condition. Endgame quests are hidden from the quest log and their content is rendered as closing prose when they fire. See the endgame documentation for details.

---

## Tutorial World

> ▶ **Try it:** Import [tides-end-06-quests.json](tutorials/tides-end-06-quests.json) to play through everything covered in this guide.

The world contains:
- An **open** quest (The Keeper's Stew) — collect three ingredients with full visibility
- A **hidden** quest (Village Explorer) — visit all four places with step titles obscured
- A **mystery** quest (The Strange Note) — find and read a hidden note with no progress hints
