# Endgame: Concluding a World

Every story needs an ending. Endgame quests define a world's win condition — the moment where the game acknowledges the player has reached the conclusion. The closing prose is rendered as a special screen, distinct from normal gameplay.

This guide covers endgame quests, hard vs soft endings, closing prose, the restart command, and chaining quests to build toward a finale.

---

## What is an Endgame Quest?

An endgame quest is a quest event with `quest-type` set to `endgame`:

```json
["quest-type", "endgame"]
```

It works like any other quest — it has `requires` tags that define completion conditions. The difference is how the client treats it:

- Endgame quests are **hidden from the quest log**. They are the game's internal win-state detector, not player-facing objectives.
- The event's **`content` field is the closing prose**, rendered as a special endgame screen when the quest fires.
- The client **evaluates endgame quests continuously** on every state change. The first one whose `requires` all pass fires.

---

## Hard vs Soft Endings

The `quest-type` tag takes an optional third element that controls what happens after the ending fires:

### Hard endgame

```json
["quest-type", "endgame"]
```

The win screen renders, and the game stops accepting commands. The player sees the closing prose and is offered two options: restart or share. This is a definitive ending — the story is over.

**When to use:** Linear stories with a single conclusion. The player has reached the end and there is nothing more to do.

### Soft endgame

```json
["quest-type", "endgame", "open"]
```

The closing prose is displayed and the achievement is acknowledged, but the world stays open. The player can continue exploring, complete side quests, or discover other endings. The game does not stop.

**When to use:** Sandbox worlds, games with multiple endings, or worlds where the "main quest" is one path among many. The player has reached a significant milestone but the world has more to offer.

---

## Closing Prose

The endgame quest's `content` field is the closing prose — the final text the player reads. This is rendered differently from normal game text. It appears as a dedicated endgame screen with distinct styling.

Write closing prose that feels like a conclusion. It should reflect the journey and give the player a sense of completion:

```json
{
  "tags": [
    ["d",          "my-world:quest:departure"],
    ["type",       "quest"],
    ["title",      "Departure"],
    ["quest-type", "endgame", "open"],
    ["requires",   "30078:<PUBKEY>:my-world:quest:main-quest", "complete", ""],
    ["requires",   "30078:<PUBKEY>:my-world:feature:landmark-pier", "visited", ""]
  ],
  "content": "You stand at the end of the pier. The village is behind you now. The boat rocks gently, patient as the tide. You step aboard, and the shore grows small."
}
```

The content supports markdown. Use it for emphasis, line breaks, and italics to shape the final moment.

---

## The Restart Command

Both hard and soft endgame modes make the `restart` command available. Restart clears all player state:

- Inventory emptied
- Visited places forgotten
- Quest progress reset
- Counter values cleared
- Crypto keys removed
- Items return to their original locations

The player is returned to the world's start room. This allows replaying the world from scratch, which is especially useful for worlds with multiple endings.

In hard endgame, restart is offered on the win screen. In soft endgame, the player can type `restart` at any time after the ending fires.

---

## Chaining Quests to Unlock Endgame

Endgame quests rarely stand alone. They typically sit at the end of a quest chain — the final link that fires when all preceding objectives are met.

The pattern is straightforward: earlier quests complete and their state becomes `complete`. The endgame quest requires those completed states.

### Step 1: Create the prerequisite quest

```json
{
  "tags": [
    ["d",          "my-world:quest:keepers-errand"],
    ["type",       "quest"],
    ["title",      "The Keeper's Errand"],
    ["quest-type", "open"],
    ["requires",   "30078:<PUBKEY>:my-world:item:fish", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:herbs", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:flour", "", ""]
  ],
  "content": "Gather ingredients for the tavern keeper."
}
```

### Step 2: Gate a path behind the quest

Use the quest's completion to unlock a portal or area:

```json
{
  "tags": [
    ["d",        "my-world:portal:square-to-pier"],
    ["type",     "portal"],
    ["requires", "30078:<PUBKEY>:my-world:quest:keepers-errand", "complete", "The path is overgrown and impassable."]
  ]
}
```

### Step 3: Create the endgame quest

The endgame quest requires both the prerequisite quest and a location-specific condition:

```json
{
  "tags": [
    ["d",          "my-world:quest:departure"],
    ["type",       "quest"],
    ["title",      "Departure"],
    ["quest-type", "endgame", "open"],
    ["requires",   "30078:<PUBKEY>:my-world:quest:keepers-errand", "complete", ""],
    ["requires",   "30078:<PUBKEY>:my-world:feature:landmark-pier", "visited", ""]
  ],
  "content": "Your closing prose here."
}
```

The cascade works automatically: completing the errand quest opens the portal; reaching the pier through the portal fires the endgame. No scripting needed.

---

## Multiple Endings

A world can have multiple endgame quests. The client evaluates all of them on every state change. The first one whose `requires` all pass fires. This enables branching conclusions:

```json
// Ending A — player helped the keeper
["requires", "30078:<PUBKEY>:my-world:quest:keepers-errand", "complete", ""]

// Ending B — player stole from the keeper
["requires", "30078:<PUBKEY>:my-world:feature:keeper-robbed", "yes", ""]
```

Each ending has its own closing prose. The player's choices determine which conclusion they reach.

---

## Builder Walkthrough: Creating an Endgame

### Step 1: Create the prerequisite quest

Define a quest with clear objectives. Use `quest-type: open` so the player can track progress:

```json
{
  "tags": [
    ["d",          "my-world:quest:keepers-errand"],
    ["type",       "quest"],
    ["title",      "The Keeper's Errand"],
    ["quest-type", "open"],
    ["involves",   "30078:<PUBKEY>:my-world:item:fish"],
    ["involves",   "30078:<PUBKEY>:my-world:item:herbs"],
    ["involves",   "30078:<PUBKEY>:my-world:item:flour"],
    ["requires",   "30078:<PUBKEY>:my-world:item:fish", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:herbs", "", ""],
    ["requires",   "30078:<PUBKEY>:my-world:item:flour", "", ""]
  ],
  "content": "Gather ingredients for the keeper."
}
```

### Step 2: Create the endgame area

Add a place that serves as the story's conclusion point. Gate access behind the prerequisite quest using a portal with `requires`:

```json
{
  "tags": [
    ["d",    "my-world:place:departure-pier"],
    ["type", "place"],
    ["title", "Departure Pier"],
    ["on-enter", "player", "set-state", "visited", "30078:<PUBKEY>:my-world:feature:landmark-pier"]
  ],
  "content": "A stone pier stretching into open water. A boat waits at the end."
}
```

Use an `on-enter` trigger to set a landmark feature to `visited` when the player arrives.

### Step 3: Create the landmark feature

```json
{
  "tags": [
    ["d",     "my-world:feature:landmark-pier"],
    ["type",  "feature"],
    ["title", "Departure Pier"],
    ["state", "unvisited"],
    ["noun",  "landmark"]
  ],
  "content": "A familiar landmark."
}
```

### Step 4: Create the endgame quest

```json
{
  "tags": [
    ["d",          "my-world:quest:departure"],
    ["type",       "quest"],
    ["title",      "Departure"],
    ["quest-type", "endgame", "open"],
    ["requires",   "30078:<PUBKEY>:my-world:quest:keepers-errand", "complete", ""],
    ["requires",   "30078:<PUBKEY>:my-world:feature:landmark-pier", "visited", ""]
  ],
  "content": "Write your closing prose here. This is rendered as the endgame screen."
}
```

### Step 5: Publish

Publish all events. The endgame quest is invisible to the player — it fires automatically when conditions are met.

---

## Tips

**Endgame quests are invisible.** They never appear in the quest log. The player discovers the ending by reaching it, not by tracking it.

**Soft endgame for tutorials.** Use `["quest-type", "endgame", "open"]` for tutorial worlds so the player can continue exploring after seeing the ending.

**Gate the ending location.** Use a portal with `requires` to prevent the player from stumbling into the ending area before they are ready. The prerequisite quest's completion state is a natural gate.

**Closing prose is markdown.** Use italics, line breaks, and emphasis to shape the final text. This is the last thing the player reads — make it count.

**Cascade evaluation.** The client evaluates all quests (including endgame) on every state change. Completing a prerequisite quest immediately re-evaluates the endgame quest. If all conditions pass, the ending fires in the same tick — the player sees the result instantly.

**Restart is always available.** Both hard and soft endings offer restart. Design worlds with replay in mind if you have multiple endings.

**Location as condition.** Use a landmark feature with `on-enter` to track whether the player has reached a specific place. The endgame quest can then require that landmark in state `visited`. This ensures the ending only fires when the player is physically present at the conclusion point.

---

## Tutorial World

Import **tides-end-10-endgame** to see endgame quests in action. The world contains:
- A prerequisite fetch quest (The Keeper's Errand) that gates access to the pier
- A departure pier unlocked by quest completion
- A soft endgame quest that fires when the player reaches the pier
- Full restart support

Tutorial file: `docs/guide/tutorials/tides-end-10-endgame.json`
