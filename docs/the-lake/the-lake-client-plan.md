# The Lake — Client Implementation Plan
*Ordered by mechanic complexity, each step testable in isolation*

---

## Current State (post-MVP)

The client can:
- Fetch and render a place (title, description, exits)
- Resolve portals and navigate
- Evaluate `requires` on portals (flag/puzzle state)
- Pick up items → local inventory
- Examine features → surface clues via `on-interact reveal`
- Hash puzzle: SHA256 verify, `on-complete set-state solved`
- NIP-44 decrypt place content on entry
- Win state

---

## Implementation Phases

---

### Phase 1 — Feature State Machines
*Unlocks: chapel altar, standing stone, all stateful features*

**What to build:**
- Parse `state` and `transition` tags from feature events
- Track current feature state in localStorage (`feature-states` map)
- On `on-interact`, check if transition exists from current state to target
- Render transition text when state changes
- Block interaction if no valid transition exists

**Test with:** Chapel altar `dry → watered → prayed`

**Client state shape:**
```json
{
  "feature-states": {
    "the-lake:feature:altar": "dry",
    "the-lake:feature:standing-stone": "weathered"
  }
}
```

**Estimated complexity:** Low — extends existing `on-interact` handler

---

### Phase 2 — `requires` on Features and Places
*Unlocks: darkness mechanic, item-gated features, cross-place conditions*

**What to build:**
- Extend `requires` evaluator to check feature state (already checks puzzle/item)
- Extend `requires` evaluator to check item state (not just presence)
- Evaluate `requires` on place entry — block render if not met, show description
- `requires` on feature — hide/disable feature if not met

**Test with:**
- Cave Network requires lantern `on` — place goes dark
- Hermit's chest requires `iron-key` in inventory
- Altar puzzle requires water-bottle `full`

**New requires types to handle:**
```json
["requires", "30078:...:item:brass-lantern", "on",   "It is pitch black."]
["requires", "30078:...:item:water-bottle",  "full",  "The altar needs water."]
["requires", "30078:...:feature:altar",      "prayed","The crypt won't open yet."]
```

**Estimated complexity:** Low-medium — evaluator already exists, extend it

---

### Phase 3 — Item States and Counters
*Unlocks: lantern (battery), water bottle (empty/full), single-use items*

**What to build:**
- Parse `state`, `transition`, `counter` tags from item events
- Track item states and counters in localStorage (`item-states`, `item-counters`)
- `on-move` handler: fire on every player navigation, decrement counters
- `on-counter-zero`: fire consequence or state transition when counter hits 0
- Item state transitions: same logic as feature transitions

**Test with:**
- Lantern: pick up, turn on, walk 200 steps, battery dies, transition to `dead`
- Water bottle: pick up empty, fill at flooded passage → `full`

**Client state shape:**
```json
{
  "item-states": {
    "the-lake:item:brass-lantern": "on",
    "the-lake:item:water-bottle": "full"
  },
  "item-counters": {
    "the-lake:item:brass-lantern:battery": 147
  }
}
```

**Estimated complexity:** Medium — `on-move` needs to fire on every navigation

---

### Phase 4 — Hidden Portals and Features
*Unlocks: chapel crypt, mechanism chamber portal, all hidden content*

**What to build:**
- Parse `state` on portal events — `hidden` portals not rendered in exit list
- `set-state visible` on a portal — adds it to rendered exits
- `set-state visible` on a feature — renders it in the place
- Hidden features: same as hidden portals, tracked in local state

**Test with:**
- Altar reaches `prayed` → `on-interact pray set-state visible portal:chapel-to-crypt`
- Mechanism solved → `on-complete set-state visible portal:mechanism-to-sanctum`

**Client state shape:**
```json
{
  "portal-states": {
    "the-lake:portal:chapel-to-crypt": "visible",
    "the-lake:portal:mechanism-to-sanctum": "hidden"
  }
}
```

**Estimated complexity:** Low — extends existing portal rendering

---

### Phase 5 — `set-state` with External Target
*Unlocks: water bottle filling altar, iron key opening chest, cross-event interactions*

**What to build:**
- `on-interact` dispatcher: parse optional 4th argument (target event ref)
- When target ref present: apply action to that event rather than self
- `set-state` on external target: update that event's state in local state

**Test with:**
- Water bottle `on-interact pour set-state watered 30078:...:feature:altar`
- Iron key `on-interact use set-state open 30078:...:feature:hermit-chest`

**Estimated complexity:** Low — small extension to dispatcher

---

### Phase 6 — Verb and Noun Parsing
*Unlocks: full natural language input, two-noun commands*

**What to build:**
- Parse `verb` tags from all events in current place (items, features, NPCs)
- Build verb→canonical map including aliases
- Parse `noun` tags — build noun→event map
- Input parser: tokenise player input, match verb and nouns
- Two-noun form: `use X on Y` / `give X to Y` — resolve both nouns
- Disambiguation: if multiple events share a noun, prompt player to choose
- `on-interact` fired on the target event with canonical verb

**Test with:**
- `examine altar` — resolves to altar feature, fires `on-interact examine`
- `pour water on altar` — resolves water bottle + altar, fires `on-interact pour` with altar as target
- `turn on lantern` — resolves lantern item, fires `on-interact turn on`

**Parser shape:**
```
input → [verb, noun?, preposition?, noun?]
      → resolve verb to canonical
      → resolve noun(s) to event refs
      → fire on-interact(canonical-verb, target-ref, instrument-ref?)
```

**Estimated complexity:** Medium-high — most complex client feature

---

### Phase 7 — NPC Rendering and Dialogue
*Unlocks: the Hermit, future NPCs*

**What to build:**
- Render NPCs referenced in place event — title, description
- Fetch dialogue nodes by d-tag prefix when entering place with NPC
- Evaluate `dialogue` tags on NPC — pick deepest passing entry point
- Render dialogue UI: node text + options
- Evaluate destination node `requires` before showing option
- `on-enter` on dialogue nodes: fire actions when node reached
- Navigate tree on option selection
- Blank next → close dialogue

**Test with:** The Hermit — greeting, after-cave, after-chapel, after-lake entry points

**Client state shape:**
```json
{
  "dialogue-visited": {
    "the-lake:dialogue:hermit:cave": "visited",
    "the-lake:dialogue:hermit:blessing": "visited"
  }
}
```

**Estimated complexity:** Medium — dialogue tree traversal is well-defined

---

### Phase 8 — Sequence Puzzles
*Unlocks: the mechanism chamber*

**What to build:**
- `puzzle-type: sequence` with `ordered: true`
- Evaluate `requires` tags in order — stop at first failure
- Client tracks which steps are satisfied
- `on-complete` fires when all requires pass
- Multiple `on-complete` actions: fire all in sequence

**Test with:** Mechanism puzzle — requires amulet + staff + correct interaction sequence

**Estimated complexity:** Low — extends existing puzzle evaluator

---

### Phase 9 — `media` Tag Rendering
*Unlocks: ASCII art, richer place descriptions*

**What to build:**
- Parse `media` tags from any event
- `text/plain` — render in monospace block
- `text/markdown` — render as markdown
- `image/url` — render as image (optional, stretch)
- Render media alongside place description

**Test with:** Sanctum ASCII art

**Estimated complexity:** Low — mostly UI work

---

### Phase 10 — `content-type: text/markdown`
*Unlocks: richer prose across all places*

**What to build:**
- Check `content-type` tag on event
- If `text/markdown`, render content through markdown parser
- Default `text/plain` — render as before

**Test with:** Select places with richer prose

**Estimated complexity:** Very low — add markdown renderer

---

## Implementation Order Summary

| Phase | Mechanic | Complexity | Unlocks |
|-------|---------|------------|---------|
| 1 | Feature state machines | Low | Altar, standing stone |
| 2 | `requires` on features/places | Low-med | Darkness, item gates |
| 3 | Item states + counters | Medium | Lantern, water bottle |
| 4 | Hidden portals/features | Low | Crypt, mechanism portal |
| 5 | External `set-state` target | Low | Cross-event interactions |
| 6 | Verb/noun parser | Med-high | Natural language input |
| 7 | NPC + dialogue | Medium | The Hermit |
| 8 | Sequence puzzles | Low | Mechanism chamber |
| 9 | `media` rendering | Low | ASCII art |
| 10 | Markdown content | Very low | Richer prose |

---

## Event Publishing Order

Publish in this order — each batch is independently testable:

**Batch 1 — Surface world (Phases 1-2)**
Clearing (expanded), Forest Path, Hermit's Cottage, Ruined Chapel (expanded),
Chapel Crypt, all surface portals, standing stone, journal, altar, stained glass,
window clues, hermit chest, iron crowbar, serpent amulet, serpent staff

**Batch 2 — Underground (Phases 3-5)**
Dark Cave (expanded), Cave Network, Flooded Passage, Echo Chamber,
Underground Lake (expanded), all underground portals, lantern, water bottle,
cave paintings, crystal formation, flooded passage feature

**Batch 3 — The Deep (Phases 6-8)**
Mechanism Chamber, Sanctum (expanded), mechanism puzzle, all remaining portals,
hermit NPC + dialogue nodes, all consequence events

**Batch 4 — Polish (Phases 9-10)**
ASCII art media tags, markdown content-type on select places,
clue content polished, win prose written

---

## Definition of Done

The world is complete when:

1. A player starting at the Clearing can reach the Sanctum through either the altar path or the cave path
2. The lantern runs out if the player is careless — consequences exist
3. The Hermit gives contextually appropriate hints based on what the player has found
4. The mechanism puzzle requires the full item chain: key → chest → amulet + staff → mechanism
5. Natural language input works for all core verbs: `examine`, `take`, `use`, `go`, `pour`, `turn on/off`
6. The Sanctum is unreadable without completing the mechanism puzzle
7. A second author can publish a portal connecting to the dangling south exit of the Clearing
