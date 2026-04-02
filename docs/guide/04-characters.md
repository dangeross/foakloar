# Characters: NPCs and Dialogue

NPCs bring your world to life. They are actors that players can talk to, fight, or encounter as they explore. This guide covers how to create NPCs, make them roam between locations, and build branching dialogue trees.

> ▶ **Try it:** Import [tides-end-04-characters.json](tutorials/tides-end-04-characters.json) to explore these concepts in a working world.

---

## What is an NPC?

An NPC is an event with `type: npc`. It has a title, noun aliases (so players can refer to it), and an encounter description in its `content` field. When a player enters a room containing an NPC, the client displays the NPC's content text as part of the room description.

NPCs do not place themselves. The **place author** controls which NPCs appear in a place by adding an `npc` reference tag to the place event. This mirrors the portal model — the party granting access owns the guest list.

```json
{
  "tags": [
    ["d",     "my-world:place:tavern"],
    ["type",  "place"],
    ["title", "The Tavern"],
    ["exit",  "west"],
    ["npc",   "30078:<PUBKEY>:my-world:npc:barkeep"]
  ],
  "content": "A warm, dimly lit tavern."
}
```

The NPC event itself defines who the character is and how they behave:

```json
{
  "tags": [
    ["d",        "my-world:npc:barkeep"],
    ["type",     "npc"],
    ["title",    "Barkeep"],
    ["noun",     "barkeep", "bartender", "keeper"],
    ["verb",     "talk", "speak", "ask"],
    ["dialogue", "30078:<PUBKEY>:my-world:dialogue:barkeep:greeting"]
  ],
  "content": "A heavyset man with a bushy moustache leans on the bar."
}
```

Key tags:
- **`noun`** — aliases the player can use to refer to the NPC. First value is the primary name. Add common alternatives (e.g. `keeper`, `innkeeper`, `barkeep`).
- **`verb`** — verbs the player can use with this NPC. `talk`, `speak`, and `ask` are the standard conversation verbs. Do NOT add `examine` here — it is a built-in command.
- **`dialogue`** — reference to the root dialogue node. This is where the conversation starts.
- **`content`** — the encounter text shown when the player enters the room. Write it in third person, describing what the player sees.

---

## Roaming NPCs

A roaming NPC moves between places on a schedule. Instead of being fixed to one location, it travels a route as the player moves through the world.

Roaming is controlled by three tags on the NPC event:

| Tag | Purpose |
|-----|---------|
| `speed` | Moves once every N player moves. `"3"` means the NPC advances one step along its route for every 3 moves the player makes. |
| `order` | `sequential` follows the route list in order, then reverses. `random` picks a random route place each move. |
| `route` | A place event reference. Add one `route` tag per place in the NPC's movement pool. Multiple `route` tags define the full path. |

```json
{
  "tags": [
    ["d",      "my-world:npc:wanderer"],
    ["type",   "npc"],
    ["title",  "Old Wanderer"],
    ["noun",   "wanderer", "old man"],
    ["speed",  "3"],
    ["order",  "sequential"],
    ["route",  "30078:<PUBKEY>:my-world:place:dock"],
    ["route",  "30078:<PUBKEY>:my-world:place:beach"],
    ["verb",   "talk", "speak"],
    ["dialogue", "30078:<PUBKEY>:my-world:dialogue:wanderer:greeting"]
  ],
  "content": "An old man sits mending a net."
}
```

The **spawn point** is the place that references the NPC with an `npc` tag. The NPC starts there and then follows its route. If a roaming NPC is not at the player's current location, it simply is not visible — no special message is shown.

NPC position is deterministic. It is calculated from the player's move count and the NPC's `d` tag, so all players see the NPC in the same place at the same move count.

### Conditional roaming

The `roams-when` tag makes roaming state-dependent. The NPC only moves when its current state matches the specified value. In any other state, it stays at its spawn point.

```json
["roams-when", "freed"]
```

This lets you have NPCs that start stationary and begin roaming after a quest or event changes their state.

---

## Dialogue Trees

Dialogue is built from a tree of `dialogue` events. Each node is its own event with a `content` field containing the NPC's speech and `option` tags defining what the player can say next.

### Dialogue node structure

```json
{
  "tags": [
    ["d",      "my-world:dialogue:barkeep:greeting"],
    ["t",      "my-world"],
    ["type",   "dialogue"],
    ["option", "Ask about the village", "30078:<PUBKEY>:my-world:dialogue:barkeep:village"],
    ["option", "Ask about work",        "30078:<PUBKEY>:my-world:dialogue:barkeep:work"],
    ["option", "Leave",                 ""]
  ],
  "content": "\"Welcome, stranger. What can I do for you?\""
}
```

Important rules:

1. **Dialogue text goes in the `content` field**, not in a `text` tag. The `content` field is the NPC's speech for that node.
2. **Options are `option` tags** with the shape `["option", "<label>", "<next-node-ref-or-blank>"]`. A blank reference ends the conversation.
3. **Players select options by typing a number** (1, 2, 3...), not by typing the option text. The client renders numbered choices.
4. **Dialogue nodes are namespaced by d-tag** — all nodes for one NPC share a prefix (e.g. `my-world:dialogue:barkeep:`). This lets the client fetch the entire tree in one relay query.

### Branching and depth

A dialogue tree can branch as deep as you need. Each option leads to another dialogue node, which can have its own options leading to further nodes. Leaf nodes (end of a branch) have options with blank references.

```
greeting
├── "Ask about the village" → village (leaf)
├── "Ask about work" → work
│   ├── "What ingredients?" → ingredients (leaf)
│   └── "Maybe later" (end)
└── "Leave" (end)
```

### Conditional dialogue options

Options can be gated by putting `requires` tags on the **destination node**, not on the option itself. The client evaluates each destination node's `requires` before showing the option. If the requirements are not met, the option is hidden.

```json
{
  "tags": [
    ["d",        "my-world:dialogue:barkeep:secret"],
    ["type",     "dialogue"],
    ["requires", "30078:<PUBKEY>:my-world:item:old-map", "", ""],
    ["option",   "Tell me more", "30078:<PUBKEY>:my-world:dialogue:barkeep:secret-details"],
    ["option",   "Thanks",       ""]
  ],
  "content": "\"Ah, you found the old map. There's a story behind that...\""
}
```

The option "Ask about the secret" (on the parent node pointing here) only appears if the player holds the old map.

### Multiple entry points

An NPC can have multiple `dialogue` tags with conditions, allowing the conversation to start at different points depending on player progress:

```json
["dialogue", "30078:<PUBKEY>:my-world:dialogue:barkeep:greeting"],
["dialogue", "30078:<PUBKEY>:my-world:dialogue:barkeep:after-quest",
             "30078:<PUBKEY>:my-world:quest:fetch-ingredients", "complete"]
```

The client evaluates these in order and uses the **last one whose condition passes**. A player who completed the quest gets a different greeting than a first-time visitor.

### Dialogue actions

Dialogue nodes can trigger actions when visited, using the same `on-enter` dispatcher as places:

```json
["on-enter", "player", "", "give-item", "30078:<PUBKEY>:my-world:item:map-fragment"]
```

This lets NPCs hand over items, change world state, or trigger other effects as part of the conversation.

---

## Builder Walkthrough: Adding an NPC with Dialogue

### Step 1: Create the dialogue nodes

Start from the leaves and work toward the root. Create each dialogue node as a separate event of type `dialogue`.

For each node, write the NPC's speech in the `content` field and add `option` tags for the player's choices. Use blank references for conversation-ending options.

### Step 2: Create the NPC event

Create an event of type `npc` with:
- A `title` for the NPC's display name
- `noun` tags with all the names players might use (e.g. `keeper`, `innkeeper`, `barkeep`)
- `verb` tags for interaction verbs (`talk`, `speak`, `ask`)
- A `dialogue` tag pointing to the root dialogue node

Write the NPC's encounter description in the `content` field. This is what players see when they enter the room.

### Step 3: Place the NPC

Edit the place event where the NPC should appear and add an `npc` reference tag:

```json
["npc", "30078:<PUBKEY>:my-world:npc:barkeep"]
```

If the NPC roams, the place with the `npc` tag is the spawn point. Add `speed`, `order`, and `route` tags to the NPC event to define the movement pattern.

### Step 4: Test the conversation

Enter the room and use `talk to <noun>` to start the conversation. Walk through every branch to verify the dialogue flows correctly and all options lead where they should.

---

## NPC Inventory and Theft

### Native inventory

An NPC can start with its own items declared via `inventory` tags:

```json
["inventory", "30078:<PUBKEY>:my-world:item:stiletto"],
["inventory", "30078:<PUBKEY>:my-world:item:lantern"]
```

These items appear when the player examines the NPC ("Carrying: Stiletto, Lantern"). They are **never dropped automatically** — use a `give-item` action in an `on-health` trigger to transfer them to the player:

```json
["on-health", "down", "0", "give-item", "30078:<PUBKEY>:my-world:item:stiletto"]
```

### Stealing from the player

`steals-item` takes an item from the player when a trigger fires. The stolen item is tracked separately from the NPC's native inventory:

```json
// Steal a specific item
["on-encounter", "player", "steals-item", "30078:<PUBKEY>:my-world:item:lantern"]

// Steal whatever the player is holding most recently
["on-encounter", "player", "steals-item", "any"]
```

### Depositing stolen items

A roaming NPC with a `stash` tag will deposit stolen items at that place when it arrives there via the `deposits` action. Only stolen items are deposited — native inventory is unaffected:

```json
// On the NPC event:
["stash",    "30078:<PUBKEY>:my-world:place:hideout"],
["on-enter", "30078:<PUBKEY>:my-world:place:hideout", "", "deposits"]
```

The stolen items then appear on the ground at the hideout, where the player can retrieve them.

---

## Tips

- **Dialogue text in content, not text tags** — The `content` field of a dialogue event is the NPC's speech. Do not use `["text", "..."]` tags — they do not exist in the dialogue schema.
- **Noun aliases matter** — Players will try different names for the same NPC. Add common alternatives: `keeper`, `innkeeper`, `barkeep` for a tavern keeper; `fisherman`, `old man` for an old fisherman. The first value in the `noun` tag is the primary name.
- **Do not add `examine` to verb tags** — Examine is a built-in command. It works automatically on any event with a `noun` tag.
- **Keep early dialogue simple** — Start with 2-3 options per node and 2-3 levels of depth. Deep trees with many branches become hard to maintain.
- **Use dialogue to foreshadow** — NPCs are a natural way to hint at quests, recipes, and puzzles the player will encounter later. The tavern keeper mentions needing ingredients (future quest tutorial). The fisherman describes how to make a fishing rod (future recipe tutorial).
- **Roaming speed affects encounters** — A speed of 3 means the NPC moves every 3 player moves. Lower values make the NPC harder to pin down. Higher values keep it roughly in place. For tutorial purposes, keep the speed moderate.

---

## Tutorial World

> ▶ **Try it:** Import [tides-end-04-characters.json](tutorials/tides-end-04-characters.json) to play through everything covered in this guide.

The world includes:

- A static NPC (Tavern Keeper) with a branching dialogue tree
- A roaming NPC (Old Fisherman) that moves between the dock and the beach
- Dialogue that foreshadows future tutorials (quests and recipes)
