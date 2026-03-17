# FOAKLOAR — MVP Scope
*Federated Open Adventure and Knowledge Living On A Relay*
*Personal reference · Work in progress*

---

## Goal

Prove the core loop works end-to-end on real NOSTR relays. Not a full game — a vertical slice that exercises every meaningful primitive once. If the loop works, everything else is elaboration.

---

## The Core Loop To Prove

```
Enter place → read description → examine feature → get clue
  → solve hash puzzle → receive crypto key
    → use key to decrypt sealed place
      → enter sealed place → win
```

One quest chain, hand-crafted, published to real relays. Everything else (NPCs, recipes, builder mode, trust model) comes after.

---

## World Design

Five places. One sealed. One quest chain connecting them.

```
[Sunlit Clearing]  ── north ──  [Dark Cave]
       |                             |
      west                         down
       |                             |
[Ruined Chapel]              [Underground Lake]
                                     |
                                   north (sealed)
                                     |
                             [The Sanctum] ← NIP-44 sealed
```

### Room 1 — Sunlit Clearing (genesis place)
- Starting point. Tutorial prose explaining the world.
- Contains: a **weathered journal** (feature) — examine reveals ambient clue
- Exits: `north`, `west`, `south` (south dangling — unconnected, invitation for a builder)

### Room 2 — Dark Cave
- Contains: a **bronze altar** (feature), an **iron key** (item)
- Examine altar → surfaces clue: *"The lake remembers what the cave forgets"*
- Exits: `south`, `down`

### Room 3 — Ruined Chapel
- Contains: a **crumbling inscription** (feature)
- Examine inscription → surfaces puzzle: a riddle
- Puzzle solved → `set-flag: chapel-solved`, stores derived crypto key in local state
- Exit: `east`

### Room 4 — Underground Lake
- Contains: a **sealed iron gate** (feature)
- The gate and the portal north to the Sanctum both require `flag: chapel-solved`
- Exit: `up`, `north` (gated)

### Place 5 — The Sanctum (NIP-44 sealed)
- `content-type: application/nip44` — content NIP-44 encrypted to the public key corresponding to the derived crypto key
- Client attempts decrypt on entry — renders win prose if key is held
- No exits (end of MVP)

---

## Events To Publish

All `kind: 30078`, `t: the-lake`. Published to relay before any client work begins.

| # | Type | d-tag | Notes |
|---|------|-------|-------|
| 1 | `place` | `the-lake:place:clearing` | Sunlit Clearing — genesis place |
| 2 | `place` | `the-lake:place:dark-cave` | Dark Cave |
| 3 | `place` | `the-lake:place:ruined-chapel` | Ruined Chapel |
| 4 | `place` | `the-lake:place:underground-lake` | Underground Lake |
| 5 | `place` | `the-lake:place:sanctum` | Sanctum — `content-type: application/nip44`, state: `sealed` |
| 6 | `portal` | `the-lake:portal:clearing-to-cave` | `north` ↔ `south` |
| 7 | `portal` | `the-lake:portal:clearing-to-chapel` | `west` ↔ `east` |
| 8 | `portal` | `the-lake:portal:cave-to-lake` | `down` ↔ `up` |
| 9 | `portal` | `the-lake:portal:lake-to-sanctum` | `north` ↔ `south` — gated by `chapel-solved` flag |
| 10 | `item` | `the-lake:item:iron-key` | Iron Key — in Dark Cave |
| 11 | `feature` | `the-lake:feature:bronze-altar` | Bronze Altar — surfaces clue on examine |
| 12 | `feature` | `the-lake:feature:crumbling-inscription` | Inscription — surfaces puzzle on examine |
| 13 | `feature` | `the-lake:feature:weathered-journal` | Journal — surfaces ambient clue on examine |
| 14 | `feature` | `the-lake:feature:iron-gate` | Iron Gate — visible locked description |
| 15 | `clue` | `the-lake:clue:lake-remembers` | Surfaced by altar examine |
| 16 | `clue` | `the-lake:clue:journal-entry` | Surfaced by journal examine — tutorial text |
| 17 | `puzzle` | `the-lake:puzzle:chapel-riddle` | Hash puzzle — on-complete sets flag + crypto key |

Total: 17 events. Publishable with a small Node script before client work begins.

---

## Key Event Sketches

The portal to the Sanctum — inline `requires` replaces any separate lock event:

```json
{
  "kind": 30078, "tags": [
    ["d",        "the-lake:portal:lake-to-sanctum"],
    ["t",        "the-lake"],
    ["type",     "portal"],
    ["exit", "30078:<pubkey>:the-lake:place:underground-lake", "north", "A heavy iron gate blocks the passage north."],
    ["exit", "30078:<pubkey>:the-lake:place:sanctum", "south", "The way back south."],
    ["requires", "chapel-solved", "The gate holds fast. Something is missing."],
    ["state",    "visible"]
  ],
  "content": ""
}}
```

The iron gate feature — visual representation of the blocked exit:

```json
{
  "kind": 30078, "tags": [
    ["d",           "the-lake:feature:iron-gate"],
    ["t",           "the-lake"],
    ["type",        "feature"],
    ["title",       "Iron Gate"],
    ["noun",  "gate",         "door",      "iron gate"],
    ["noun",  "gate",         "door",    "iron gate"],
    ["verb", "open", "examine", "push"],
    ["state",       "locked"],
    ["transition",  "locked", "locked", "The gate holds fast."],
    ["requires", "chapel-solved", "The gate holds fast. Something is missing."],
    ["on-interact", "open", "set-state", "open"]
  ],
  "content": "A heavy iron gate, rusted shut."
}}
```

The chapel puzzle — on-complete sets the flag and stores the crypto key:

```json
{
  "kind": 30078, "tags": [
    ["d",           "the-lake:puzzle:chapel-riddle"],
    ["t",           "the-lake"],
    ["type",        "puzzle"],
    ["puzzle-type", "riddle"],
    ["answer-hash", "<sha256(answer + salt)>"],
    ["salt",        "the-lake:puzzle:chapel-riddle:v1"],
    ["on-complete",    "flag", "set-flag", "chapel-solved"],
    ["on-complete",    "key",  "give-crypto-key", "<derived-public-key>"]
  ],
  "content": "I have a neck but no head, a body but no soul. I guard what you seek but ask nothing in return. What am I?"
}
```

---

## Client — Minimal Viable Features

### Must have (play loop works)
- [ ] Connect to relay, subscribe to `t: the-lake` events
- [ ] Fetch and render a place — title, description, exits, items, features
- [ ] Resolve portals for current place — render available exits with labels
- [ ] Evaluate `requires` on portals — show failed description if not met
- [ ] Navigate between rooms on `go <exit>` command
- [ ] Pick up items → local inventory
- [ ] Examine features → surface clues via `on-interact reveal`
- [ ] Render clue log / examine panel
- [ ] Input parser: `go north`, `examine altar`, `pick up key`, `use key`
- [ ] Hash puzzle UI: input field, SHA256 verify client-side, `on-complete` fires flag + crypto key
- [ ] Evaluate portal `requires` flag — allow/deny traversal with description
- [ ] NIP-44 decrypt place content on entry if player holds the crypto key
- [ ] Win state — render decrypted Sanctum prose
- [ ] Local player state: inventory, feature states, flags, solved puzzles, crypto keys, visited places

### Nice to have (stretch, post-MVP)
- [ ] Builder mode — toggle to see place structure, unconnected exit slots
- [ ] Publish a new place from builder mode
- [ ] Publish a portal from builder mode
- [ ] Basic map view — force-directed graph of visited places
- [ ] NOSTR-signed encrypted state backup

### Explicitly out of scope for MVP
- Trust / curation model (single author, no contested portals)
- NPCs and dialogue
- Recipes and item combining
- State transitions and counters
- Combat
- Consequences
- Quest log UI
- Mobile layout

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Vite + React | Familiar, fast dev loop, great ecosystem |
| Styling | Tailwind CSS | Utility-first — monospace font, dark bg, minimal colour |
| NOSTR library | `nostr-tools` | Well maintained, covers NIP-44, event signing, relay pool |
| Relay | `wss://relay.damus.io` + `wss://nos.lol` | Free, reliable public relays for dev |
| Crypto | Web Crypto API + `nostr-tools` NIP-44 | Native browser crypto, no extra deps |
| State | `localStorage` | Simple, sufficient for MVP player state |

---

## Build Order

Each step is independently testable before moving on.

**Step 1 — Event publisher script**
Node script that constructs and publishes all 17 MVP events to a test relay. Verify events appear on relay using a NOSTR relay browser. No client yet.

**Step 2 — Relay connection**
Client connects to relay, subscribes to `t: the-lake`, fetches the genesis place event by `a`-tag, logs it to console. Proves relay connection and event fetching works.

**Step 3 — Room renderer**
Parse place event tags — render title, description, exit slots. Static, no navigation yet.

**Step 4 — Portal resolution + navigation**
Query for `type:portal` events referencing current place. Resolve exit slots to destination rooms. Navigate on `go <exit>` command. Walk all 5 rooms.

**Step 5 — requires evaluation on portals**
Evaluate `requires` tags on portals against local player state (flags). Render failed description when not met. Sanctum portal blocked until flag set.

**Step 6 — Item and feature rendering**
Resolve `item` and `feature` tags from place event. Render items (pick up available) and features (examine available). Items go to local inventory.

**Step 7 — Clue surfacing**
`examine altar` fires `on-interact examine reveal` → fetch and display clue. Clue log panel rendered.

**Step 8 — Hash puzzle**
Render puzzle in chapel on examine inscription. Input field. SHA256 verify client-side. On solve: `set-flag chapel-solved`, store derived crypto key in localStorage.

**Step 9 — Portal traversal with requires**
Re-test lake→sanctum portal. Flag now set → traversal allowed. Confirm blocked state also works.

**Step 10 — NIP-44 decrypt**
On entering Sanctum, detect `content-type: application/nip44`. Attempt NIP-44 decrypt with held crypto key. Render decrypted win prose on success.

**Step 11 — Win state**
Render win prose cleanly. Full loop playable end to end.

---

## Definition of Done

1. All 17 events live on a public relay
2. A player starting at the Clearing can reach the Sanctum by solving the chapel riddle
3. The Sanctum content is unreadable without the derived key — relay scraping returns ciphertext
4. The full loop runs in a browser with no backend server
5. A player who skips the puzzle cannot open the gate or decrypt the Sanctum

---

## What The MVP Proves

| Claim | Proven by |
|-------|----------|
| World graph lives on NOSTR | Events on real relays, fetched by client |
| Portal `exit` tag syntax works | Navigation across 5 rooms |
| Inline `requires` gates portals | Gate blocked/open based on flag |
| Puzzle verification is client-side | SHA256 hash check, no server |
| Crypto enforcement is relay-scrape-proof | Sanctum is ciphertext without key |
| Player state needs no server | `localStorage` only, no relay writes |
| The loop is fun | Playtest it |

---

*Last updated: March 2026*
*Status: Ready to build*
