# The Lake — Client Implementation Plan 2
*Phase 11 onwards — advancing the reference implementation*

---

## Current State (post Phase 1-10)

The client can:
- Fetch and render a place — title, description, exits, items, features
- Navigate via portals with full `requires` evaluation
- Feature state machines — `state`, `transition`, render transition text
- `requires` on features and places — item state, feature state, puzzle state
- Item states and counters — `on-move`, `on-counter`, battery/resource mechanics
- Hidden portals and features — `state: hidden`, `set-state visible`
- External `set-state` target — cross-event interactions
- Verb/noun parser — article stripping, aliases, two-noun commands, disambiguation
- NPC rendering and dialogue — multi-entry points, `requires` gating, `on-enter` actions
- Sequence puzzles — auto-evaluation on state change, `on-complete` firing
- `media` tag rendering — ASCII art, markdown blocks
- `content-type: text/markdown` — richer prose

The Lake world is fully playable end to end.

---

## Phase 11 — State Structure Refactor + Player Position Recovery

*Unlocks: position persistence on reload, unified entity state shape, foundation for NPC state in Phase 12*

**What to build:**

Migrate localStorage to a unified world-keyed structure. All entity state lives under the world slug. Player and NPCs share the same shape — `place`, `state`, `inventory`, `health` etc. as appropriate per entity.

```json
{
  "player": {
    "place":           "30078:<pubkey>:the-lake:place:cave-network",
    "inventory":       ["30078:<pubkey>:the-lake:item:brass-lantern"],
    "states":          {
      "30078:<pubkey>:the-lake:feature:altar":          "watered",
      "30078:<pubkey>:the-lake:portal:chapel-to-crypt": "visible",
      "30078:<pubkey>:the-lake:item:brass-lantern":     "on"
    },
    "counters":        { "30078:<pubkey>:the-lake:item:brass-lantern:battery": 147 },
    "cryptoKeys":      [],
    "dialogueVisited": { "30078:<pubkey>:the-lake:dialogue:hermit:cave": "visited" },
    "paymentAttempts": {},
    "visited":         ["30078:<pubkey>:the-lake:place:clearing"],
    "moveCount":       8
  },
  "30078:<pubkey>:the-lake:npc:collector": {
    "place":     "30078:<pubkey>:the-lake:place:cave-network",
    "state":     null,
    "inventory": ["30078:<pubkey>:the-lake:item:iron-key"],
    "health":    null
  },
  "30078:<pubkey>:the-lake:place:clearing": {
    "inventory": []
  },
  "30078:<pubkey>:the-lake:place:flooded-passage": {
    "inventory": ["30078:<pubkey>:the-lake:item:iron-key"]
  }
}
```

**Shape rules:**
- Stored under the world slug as the localStorage key — `localStorage["the-lake"]`
- `player`, NPCs, and places are flat siblings — no nesting
- `player.states` — flat map, d-tag → state string. All event states the player has affected: items, features, portals, puzzles. Type-agnostic — consistent with how `requires` evaluates.
- `player.counters` — flat map, `d-tag:counterName` → integer. All counters across all event types.
- `player.moveCount` — incremented on every navigation. Drives deterministic NPC position calculation.
- NPC `state` — `null` until first encounter or state change. Client reads NPC event's `state` tag as default when `null`.
- Place inventories — seeded from place event `item` tags on first visit (tracked via `player.visited`). After seeding, the place inventory array is the source of truth.
- **Every item lives in exactly one inventory** — player, NPC, or place. No duplication, no negative checks. Items move between inventories on pickup, drop, steal, deposit.
- camelCase throughout: `cryptoKeys`, `dialogueVisited`, `paymentAttempts`, `moveCount`

- `player.place` — updated on every navigation. On reload, client reads this and navigates directly — no more starting from genesis place every session.
- All keys (NPC, place, state map entries, inventory items) use full `a`-tags — collision-proof across multiple collaborators. Matches `requires` evaluation directly with no translation step.
- `player` is a reserved key — not an event reference, no collision possible.
- Multi-world support: `localStorage["the-lake"]`, `localStorage["shadowrealm"]` etc.
- Multi-world support falls out naturally — `"the-lake": {...}, "shadowrealm": {...}` in the same localStorage object.

**Migration:** read existing flat localStorage keys, reshape into new structure, write back. One-time on first load after update.

**On reload flow:**
1. Read `the-lake.player.place`
2. If present → navigate to that place directly
3. If absent → new game, use world event `start` tag

**Test with:** Navigate to the Dark Cave, close the browser, reopen — player resumes in the Dark Cave.

**Estimated complexity:** Low — restructuring existing state, no new schema handling

---

## Phase 11b — State Migration (a-tag upgrade)

*Ensures saved state is collision-proof across collaborators*

**What to build:**
On load, check if existing state uses short d-tag keys (e.g. `the-lake:item:brass-lantern`) rather than full `a`-tags (`30078:<pubkey>:the-lake:item:brass-lantern`). If so, migrate:

1. Read world event to get genesis pubkey
2. Walk all state keys — prefix any bare d-tag key with `30078:<genesis-pubkey>:`
3. Walk all inventory arrays — same prefix
4. Write migrated state back to localStorage
5. Migration is one-time — once keys are full `a`-tags, skip on subsequent loads

Detection: check if any key in `player.states` or `player.inventory` starts with `30078:`. If none do, migration is needed.

This phase exists because Phase 11 initially used d-tag keys. Any players who played during that window need a transparent upgrade. New installs start with full `a`-tags from the beginning.

**Estimated complexity:** Very low — string prefixing with pubkey lookup

---

## Phase 12 — World Event Bootstrap

*Unlocks: world manifest, starting inventory, theme, relay hints, collaboration*

**What to build:**
- Fetch and parse `type: world` event on load — `kind:30078, author:<genesis-pubkey>, d:<slug>:world`
- Read `start` tag → use as genesis place instead of hardcoded d-tag
- Read `inventory` tags → give items to player on new game (not on reload)
- Read `relay` tags → add to relay pool
- Read `theme` + `accent-colour` → apply to UI
- Read `cw` tags → display content warnings before world loads, player confirms
- Read `collaboration` + `collaborator` → build trust set for Phase 13
- URL routing: `/the-lake` → resolve genesis pubkey from config, `/world/npub1...` → load by pubkey

**Test with:** Publish The Lake world event with all tags. Verify player starts with correct items, theme applies, relay hints used.

**Estimated complexity:** Low-medium — mostly parsing and applying config

---

## Phase 13 — NPC Inventory + Roaming

*Unlocks: roaming NPCs, NPC-carried items, steals/deposits — tested with The Collector*

**What to build:**
- Parse `inventory` tags on NPC events — track per-NPC carried items in player state
- `roams-when` — only calculate NPC position when in declared state
- NPC position calculation — deterministic, seeded by move count + NPC d-tag
- Render NPC in place when position matches current place
- `steals-item` action — move item from player inventory to NPC carried set
- `deposits` action — move NPC carried items to current place
- On NPC death — drop carried items into current place

**Client state shape:**
```json
{
  "player": {
    "place":     "the-lake:place:cave-network",
    "inventory": [],
    "moveCount": 12
  },
  "the-lake:npc:collector": {
    "state":     null,
    "inventory": ["the-lake:item:iron-key"],
    "health":    null
  },
  "the-lake:place:flooded-passage": {
    "inventory": ["the-lake:item:brass-lantern"]
  }
}
```

**Test with: The Collector**
The Lake's roaming NPC. Silent, indifferent, takes things. Exercises every mechanic in this phase:
- Roams Cave Network, Flooded Passage, Echo Chamber, Underground Lake (`speed: 3`, `order: random`)
- `steals-item: any` — takes most recently acquired item on encounter
- `stash`: Flooded Passage — stolen items deposit here, retrievable by player
- `inventory` starts empty — accumulates stolen items during play
- No dialogue — it doesn't speak
- Avoids light — `requires-not item:brass-lantern state:on` on encounter, or simply roams away

Publish The Collector event and verify: encounter triggers steal, stash accumulates items, player retrieves from Flooded Passage.

**Estimated complexity:** Medium — position calculation + NPC state interaction

---

## Phase 14 — Trust Model

*Unlocks: collaborative worlds, portal filtering, community mode*

**What to build:**
- Build trust set from world event — genesis pubkey + `collaborator` tags + `vouch` events
- Portal authorship validation — only render portals authored by trusted pubkeys for that place's exit slots
- `collaboration: closed` — genesis only
- `collaboration: vouched` — genesis + collaborators + vouch chain
- `collaboration: open` — all pubkeys, with content warning
- Contested portal handling — two portals claiming same exit slot → show both with indicator
- Client mode toggle — canonical / community / explorer

**Test with:** Publish a portal from a second keypair connecting to the clearing south exit. Verify it appears in community mode but not canonical mode.

**Estimated complexity:** Medium — trust set building + portal filtering

---

## Phase 15 — NIP-44 Encrypted State Backup

*Unlocks: cross-device play, state persistence beyond localStorage*

**What to build:**
- Serialise full player state to JSON
- NIP-44 encrypt to player's own pubkey
- Publish as `type: player-state` event to relay
- On load: check relay for existing player-state event, decrypt, restore
- Merge strategy: relay state vs local state (prefer more recent by `created_at`)
- UI: "save to relay" / "restore from relay" controls
- New game vs continue detection

**Client state published:**
```json
{
  "world": "the-lake",
  "inventory": [...],
  "feature-states": {...},
  "item-states": {...},
  "item-counters": {...},
  "portal-states": {...},
  "dialogue-visited": {...},
  "npc-inventory": {...},
  "visited": [...],
  "payment-attempts": {...}
}
```

**Test with:** Complete part of the world, save to relay, clear localStorage, reload — state restores.

**Estimated complexity:** Medium — NIP-44 + relay publish/fetch + merge logic

---

## Phase 16 — Payment Gates

*Unlocks: `type: payment` — toll gates, hints, shops — tested with The Ferryman*

**What to build:**
- Detect `type: payment` events referenced from features, portals, or NPC dialogue
- Fetch LNURL-pay metadata, generate invoice
- Store `payment-hash` against event d-tag before player pays
- Display invoice UI — QR code + copyable string
- Poll LUD-11 verify endpoint until `paid` or timeout
- On `paid` → fire `on-complete`, add receipt item, mark `complete`
- Recovery on load — re-poll any `pending`/`paid` without `complete`
- Invoice expiry handling — refresh invoice, replace stored hash

**Test with: The Ferryman**
Static NPC on the underground lake shore. Ancient, hooded, silent. Offers a shortcut to the mechanism chamber for 10 sats — bypassing part of the puzzle chain.

- NPC dialogue has single option: "Pay the toll"
- Option triggers `type: payment` event — 10 sats LNURL
- Payment gives `ferry-token` receipt item via `on-complete give-item`
- Shortcut portal to mechanism chamber `requires item:ferry-token`
- Long route (puzzle chain) remains open — Ferryman is optional

Publish The Ferryman NPC, payment event, `ferry-token` item, and shortcut portal. Pay the toll, verify token received, verify portal opens.

**Estimated complexity:** Medium-high — Lightning integration + polling loop

---

## Phase 17 — Builder Mode

*Unlocks: in-client world authorship*

**What to build:**
- Toggle between play mode and builder mode
- Builder mode renders place structure — d-tags, slot names, unconnected exits highlighted
- Publish a new place — form for title, description, exits, content
- Publish a portal — connect two places with exit slots
- Publish a feature — title, noun, verbs, initial state
- Publish a clue — title, content, initial state
- Sign and publish events using player keypair
- Preview published event before signing
- Published event appears in world immediately

**Test with:** Connect a new place to the clearing south exit from within the client.

**Estimated complexity:** High — forms, event construction, signing, relay publish

---

## Phase 18 — World Browser

*Unlocks: world discovery, NIP-51 curated lists*

**What to build:**
- Fetch platform's NIP-51 curated worlds list (`kind: 30001`)
- Render world browser — title, author, description, cover art, tags, content warnings
- Load world by slug (`/the-lake`) → resolve from curated list
- Load world by npub (`/world/npub1...`) → direct pubkey load
- `/world/npub1...` → all worlds by author
- Search/filter by `tag` values
- Content warning acknowledgement before loading flagged worlds

**Test with:** Publish The Lake world event with full manifest. Verify it appears correctly in world browser with cover art and tags.

**Estimated complexity:** Medium — relay queries + UI rendering

---

## Implementation Order Summary

| Phase | Feature | Complexity | Unlocks |
|-------|---------|------------|---------|
| 11 | State refactor + player position | Low | Position recovery on reload, unified state shape |
| 11b | State migration — a-tag upgrade | Very low | Collision-proof keys for multi-collaborator worlds |
| 12 | World event bootstrap | Low-med | Manifest, starting inventory, theme |
| 13 | NPC inventory + roaming | Medium | Roaming NPCs, steals/deposits |
| 14 | Trust model | Medium | Collaborative worlds, portal filtering |
| 15 | Encrypted state backup | Medium | Cross-device play |
| 16 | Payment gates | Med-high | Lightning integration |
| 17 | Builder mode | High | In-client authorship |
| 18 | World browser | Medium | Discovery, NIP-51 |

---

## Definition of Done (Phase 2)

The reference implementation is complete when:

1. A world loads from a `type: world` manifest — no hardcoded config
2. A second author can publish a connected place from within the client
3. The trust model correctly filters untrusted portals in canonical mode
4. Player state persists across devices via encrypted relay backup
5. The world browser shows The Lake with cover art, tags, and content warnings
6. A payment gate can be placed and traversed with a real Lightning payment
7. A roaming NPC steals an item and deposits it at its stash

