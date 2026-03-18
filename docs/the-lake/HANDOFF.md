# FOAKLOAR — Claude Code Handoff
*Rewritten each session. Read this before starting work.*

---

## Current Status

Reference client: The Lake phases 1-10 complete. Full world playable end to end.
World: The Lake — all 12 places, full item chain, Hermit NPC, mechanism puzzle, Sanctum sealed.
Next: Phase 11 — world event bootstrap.

---

## What Was Built (Phases 1-10)

- Feature state machines (`state`, `transition`, transition text)
- `requires` on features and places — item state, feature state, puzzle state
- Item states and counters — `on-move`, `on-counter`, lantern battery
- Hidden portals and features — `state: hidden` / `set-state visible`
- External `set-state` target — cross-event interactions
- Verb/noun parser — article stripping, aliases, two-noun commands, disambiguation
- NPC rendering and dialogue — multi-entry points, `requires` gating
- Sequence puzzles — auto-evaluation on state change
- `media` rendering — ASCII art, markdown blocks
- `content-type: text/markdown` — richer prose

---

## Current Status

Phases 11-18 complete. The Lake is fully playable. See `the-lake-client-plan-3.md` for Phase 19+ work.

**Next: Phase 19 — Consequence dispatch** (start here)

---

## Contested Exit UI Model — Design Decision

**Design before building.** Portal conflict resolution is now specced in `foakloar-design.md` section 6.7. Key decisions:

**`south` behaviour:**
- One trusted portal → navigate immediately
- Multiple trusted → disambiguation list (existing pattern)
- One trusted + unverified → navigate, append `[+N unverified]` hint on arrival
- Unverified only → short list (up to 5), numbered, with trust indicators
- No portals → "You can't go that way."

**`look south` behaviour:**
- Always shows full list of all portals on that slot — trusted and unverified
- Examination only, never navigates

**Confirmation on unverified:**
Selecting an unverified portal shows author pubkey and label, requires yes/no before entering.

**Trust indicators:** `(trusted)`, `(community)`, `(unverified)`

**`cw` tags** on portals shown in listing before player selects.

**Mode summary:**

| Mode | Unverified shown |
|------|-----------------|
| `closed` / `vouched` | Never |
| `community` | On `look <slot>` only |
| `open` | In short list + `look <slot>` |

Do not implement before reviewing spec section 6.7.

---

## Schema Changes Since Last Client Session

### 1. `on-complete` shape — blank trigger-target required (BREAKING)

`on-complete` follows the generic `on-*` shape — trigger-target is always blank:

```json
["on-complete", "", "set-state", "solved"]
["on-complete", "", "give-item", "30078:<pubkey>:the-lake:item:entry-token"]
["on-complete", "", "set-state", "visible", "30078:<pubkey>:the-lake:portal:secret-door"]
```

All published events using `on-complete` without the blank need republishing.

### 2. Sequence puzzle auto-evaluation

Client evaluates sequence puzzle `requires` after any feature or item state change in the current place — not on explicit player action. When all conditions pass, `on-complete` fires automatically.

### 3. `on-interact` external target documented

```json
["on-interact", "insert", "set-state", "amulet-placed", "30078:<pubkey>:the-lake:feature:mechanism"]
```

Item's `on-interact` can set state on an external feature or portal. Fourth argument is the target event ref.

### 4. `on-counter` unified

`on-counter-zero` and `on-counter-low` replaced by `on-counter` with threshold:

```json
["on-counter", "down", "battery", "50", "set-state",   "flickering"]
["on-counter", "down", "battery", "0",  "set-state",   "dead"]
```

Three fire conditions: threshold crossing, state entry re-evaluation, load reconciliation.

### 5. `inventory` tag — world + NPC events

World event starting inventory (new game only):
```json
["inventory", "30078:<pubkey>:the-lake:item:scribbled-note"]
```

NPC carried items:
```json
["inventory", "30078:<pubkey>:the-lake:item:stiletto"]
```

### 6. `type: payment` — new primitive

Lightning payment gate. See spec section 2.8 and `the-lake-client-plan-2.md` Phase 15.

### 7. World event fully specced

Full manifest — `start`, `inventory`, `relay`, `collaboration`, `collaborator`, `theme`, `accent-colour`, `cw`. See spec section 6.1 and Phase 11.

---

## Next Steps

**Phase 11 — State Refactor + Player Position** (start here)
See `the-lake-client-plan-2.md` for full Phase 11-18 plan.

Key immediate tasks:
1. Migrate localStorage to unified world-keyed structure: `{ "the-lake": { "player": {...}, "<npc-a-tag>": {...} } }`
2. Add `player.place` — update on every navigation, restore on reload
3. One-time migration of existing flat state to new structure

**State shape** (stored under `localStorage["the-lake"]`):
```json
{
  "player": {
    "place":           "the-lake:place:cave-network",
    "inventory":       ["the-lake:item:brass-lantern"],
    "states":          { "the-lake:item:brass-lantern": "on" },
    "counters":        { "the-lake:item:brass-lantern:battery": 147 },
    "cryptoKeys":      [],
    "dialogueVisited": {},
    "paymentAttempts": {},
    "visited":         [],
    "moveCount":       8
  },
  "the-lake:npc:collector": {
    "state":     null,
    "inventory": [],
    "health":    null
  },
  "the-lake:place:flooded-passage": {
    "inventory": []
  }
}
```

Key rules: flat siblings (player, NPCs, places at same level). Every item in exactly one inventory. Place inventories seeded on first visit from place `item` tags. camelCase throughout.

Phase 12 (world event bootstrap) follows immediately after.

---

## Files to Reference

All docs at `https://github.com/dangeross/foakloar/tree/main/docs`

| File | Repo path | Purpose |
|------|-----------|---------|
| `foakloar-design.md` | `spec/` | Full schema spec |
| `foakloar-mvp.md` | `spec/` | MVP scope |
| `CHANGELOG.md` | `spec/` | Full history of schema changes |
| `HANDOFF.md` | `the-lake/` | This file |
| `the-lake-world.md` | `the-lake/` | World design — 12 places, full narrative |
| `the-lake-client-plan.md` | `the-lake/` | Phases 1-10 — complete ✓ |
| `the-lake-client-plan-2.md` | `the-lake/` | Phases 11-18 — complete ✓ |
| `the-lake-client-plan-3.md` | `the-lake/` | Phases 19-26 — current work |
| `ideas.md` | `the-lake/` | Use cases, payment mechanics, story ideas |
| `zork1-event-reference.md` | `reference/` | Worked example — all schema patterns |
| `fate-of-atlantis-reference.md` | `reference/` | Fate of Atlantis reference |
| `goonies-reference.md` | `reference/` | Goonies reference |
| `foakloar-authoring-guide.md` | `reference/` | World authoring guide |
| `foakloar-micro-world.md` | `reference/` | Micro-world example — The Lighthouse Keeper |

---

*Update this file at the end of each session with what changed.*
