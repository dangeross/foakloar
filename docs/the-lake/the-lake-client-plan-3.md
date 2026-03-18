# The Lake — Client Implementation Plan 3
*Phase 19 onwards — completing unimplemented spec features*

---

## Current State (post Phase 11-18)

Phases 11-18 complete. The Lake is fully playable including:
- World event bootstrap, theme, effects
- NPC inventory + roaming (The Collector)
- Trust model — canonical/community/explorer modes
- NIP-44 encrypted state backup
- Payment gates (The Ferryman)
- Builder mode
- World browser (NIP-51)

**Confirmed unimplemented features** (audit by Claude Code):

| Feature | Spec section | Blocks The Lake | Priority |
|---------|-------------|-----------------|----------|
| Consequence dispatch | 2.10 | Yes — 2 consequences | High |
| `traverse` action | 2.1 dispatcher | Yes — mechanism → sanctum | High |
| Counter threshold crossing | counter section | Yes — lantern warning | High |
| `increment` / `set-counter` dispatch | action types | Partial — not dispatched | Medium |
| Payment LNURL flow | 2.7b | Yes — The Ferryman | Medium |
| `flees` action | NPC actions | No | Low |
| Recipe / crafting | 2.7 | No | Low |
| Quest tracking | §8 | No | Low |
| Combat system | multiple | No | Deferred |

---

## Phase 19 — Consequence Dispatch

*Unlocks: death traps, lamp-dies consequence, respawn, state clearing*

**What to build:**
- Detect `on-complete`, `on-enter`, `on-interact`, `on-encounter` firing `consequence` action
- Fetch consequence event by `a`-tag
- Execute consequence tags in order:
  - `respawn` — move player to declared place
  - `clears` — wipe declared state key from player state

**Consequence state keys for `clears`:**
`inventory`, `states`, `counters`, `cryptoKeys`, `dialogueVisited`, `paymentAttempts`, `visited`

```json
// Death consequence — respawn at clearing, clear crypto keys
{
  "kind": 30078, "tags": [
    ["d",       "the-lake:consequence:death"],
    ["type",    "consequence"],
    ["respawn", "30078:<PUBKEY>:the-lake:place:clearing"],
    ["clears",  "cryptoKeys"]
  ],
  "content": "Darkness. Then the clearing, as if you never left."
}
```

**Trigger sites in The Lake:**
- Lantern dying → `on-counter "battery" "0" consequence lamp-dies`
- Dark places without lantern → `on-enter player consequence death` (if `requires-not` lantern fails)

**Test with:** Publish a consequence event on the lamp death. Let battery reach zero. Verify respawn and state clear.

**Estimated complexity:** Low — consequence is a simple sequential executor

---

## Phase 20 — `traverse` Action

*Unlocks: feature-triggered portal transitions — mechanism chamber → sanctum*

**What to build:**
- Detect `traverse` action in `on-interact` and `on-complete` dispatcher
- Fetch portal by `a`-tag
- Navigate player through that portal (same flow as normal exit navigation)
- Evaluate portal `requires` before traversing — block with failure message if not met

**Use cases:**
- `on-complete traverse` — puzzle solved → player sent through portal automatically
- `on-interact traverse` — examining/using a feature transports player (magic mirror, teleporter)

```json
// Mechanism puzzle on-complete — traverse to sanctum
["on-complete", "", "set-state",  "visible", "30078:<PUBKEY>:the-lake:portal:mechanism-to-sanctum"],
["on-complete", "", "traverse",   "30078:<PUBKEY>:the-lake:portal:mechanism-to-sanctum"]
```

**Note:** `traverse` fires after `set-state visible` in the same `on-complete` chain — the portal must be made visible before traversal or the `requires` check will fail.

**Test with:** Mechanism puzzle solve → auto-traverse to sanctum.

**Estimated complexity:** Low — reuses existing portal navigation logic

---

## Phase 21 — Counter Threshold Crossing Fix

*Unlocks: lantern warning mid-walk, correct `on-counter` fire conditions*

**Current behaviour:** `on-counter` fires on state entry re-evaluation and load reconciliation, but NOT on actual counter decrements during play (threshold crossing condition).

**What to build:**
- On every counter decrement (`on-move` fires `decrement`):
  - Check all `on-counter` tags on that event
  - For each threshold: if counter was above threshold and is now at-or-below → fire action
  - Track last-fired threshold per counter to prevent repeated firing
- Distinguish from state entry re-evaluation (which runs regardless of crossing history)

**The Lake's dependency:**
```json
// Lantern — warn at 50, die at 0
["on-counter", "battery", "50", "set-state", "flickering"],
["on-counter", "battery", "0",  "set-state", "dead"],
["on-counter", "battery", "0",  "consequence", "30078:<PUBKEY>:the-lake:consequence:lamp-dies"]
```

Without crossing detection, `flickering` state never triggers mid-walk — only on reload or state entry.

**Test with:** Walk 150+ steps with lantern on. Verify flickering state triggers at step ~150 (battery 50), dead at step ~200 (battery 0).

**Estimated complexity:** Low-medium — crossing detection needs careful state tracking

---

## Phase 22 — `increment` / `set-counter` Dispatch

*Unlocks: general counter manipulation beyond `decrement`*

**What to build:**
- Detect `increment` action in dispatcher — increase named counter by 1
- Detect `set-counter` action — set named counter to specific value
- Both work on any event's counter, same as `decrement`

**Use cases:**
- `increment` — track how many times something has been done
- `set-counter` — reset a counter (e.g. after refilling a resource)

**Test with:** A feature that resets the lantern battery: `["on-interact", "recharge", "set-counter", "battery", "300", "30078:<PUBKEY>:the-lake:item:brass-lantern"]`

**Estimated complexity:** Very low — `decrement` already works, extend dispatcher

---

## Phase 23 — Payment LNURL Flow

*Unlocks: The Ferryman, Lightning payment gates*

*(Already specced as Phase 16 — moved here since Phase 16 was marked complete without the actual LNURL flow)*

**What to build:**
- Fetch LNURL-pay metadata from `lnurl` tag on `type: payment` event
- Generate invoice via LUD-06
- Store `payment-hash` against payment event d-tag in `player.paymentAttempts`
- Display invoice UI — QR code + copyable string
- Poll LUD-11 verify endpoint until `paid` or timeout (60s invoice expiry)
- On `paid` → fire `on-complete`, add receipt item, mark `complete`
- On reload — re-poll any `pending`/`paid` without `complete`
- Invoice expiry — refresh and replace stored hash

**Test with:** The Ferryman — 10 sats LNURL. Pay, verify `ferry-token` received, verify shortcut portal opens.

**Estimated complexity:** Medium-high — external LNURL integration + polling

---

## Phase 24 — `flees` Action

*Unlocks: NPC retreat on attack or defeat condition*

**What to build:**
- Detect `flees` action in NPC dispatcher
- Move NPC immediately to a random place in its `route` pool
- If no `route` tags, NPC despawns (removed from world state)

**Use cases:**
- Cowardly NPCs that run when attacked
- NPCs that flee after a condition is met (`on-health-zero flees`)

**Test with:** Add `["on-attacked", "", "flees"]` to a test NPC. Attack it. Verify it moves to a random route place.

**Estimated complexity:** Very low — extends NPC position update

---

## Phase 25 — Recipe / Crafting

*Unlocks: item combination, crafting system*

**What to build:**
- Detect `type: recipe` events in current world
- Client presents combine mechanic when player has all `requires` items
- `ordered: true` — items must be combined in sequence
- `on-complete` fires — consumes ingredients, gives produced item
- Client UI: `combine X with Y` or `craft` command

**Test with:** Publish a simple recipe — two items combine into one. Verify ingredients consumed, new item appears.

**Estimated complexity:** Medium — recipe evaluation + combine verb + UI

---

## Phase 26 — Quest Tracking

*Unlocks: named quest groupings, quest log UI*

**What to build:**
- Parse `type: quest` events referenced in world
- Track quest state (`active`, `complete`, `failed`) in player state
- Quest log UI — `quests` command shows active/completed quests
- Quest events reference places, items, puzzles they track — client marks quest complete when all referenced events reach target states

**Estimated complexity:** Medium — quest state evaluation + UI

---

## Deferred — Combat System

Combat is a significant design and implementation commitment. No world currently needs it. Deferred until a world explicitly requires it.

Affected spec features:
- `attack` verb + `on-attacked` trigger
- `deal-damage` / `deal-damage-npc` / `heal` actions
- `health` / `damage` / `hit-chance` tags on NPCs
- `on-health-zero` / `on-player-health-zero` triggers
- Player health tracking in state

When a world author needs combat, this becomes a dedicated plan.

---

## Implementation Order Summary

| Phase | Feature | Complexity | Blocks |
|-------|---------|------------|--------|
| 19 | Consequence dispatch | Low | Death traps, lamp-dies |
| 20 | `traverse` action | Low | Mechanism → sanctum |
| 21 | Counter threshold crossing | Low-med | Lantern warning |
| 22 | `increment`/`set-counter` | Very low | General counters |
| 23 | Payment LNURL flow | Med-high | The Ferryman |
| 24 | `flees` action | Very low | NPC retreat |
| 25 | Recipe/crafting | Medium | Item combination |
| 26 | Quest tracking | Medium | Quest log |
| — | Combat | High | Deferred |

---

## Definition of Done (Phase 3)

1. The lantern warns (`flickering`) at battery 50 mid-walk, dies at 0, fires the lamp-dies consequence
2. Completing the mechanism puzzle auto-traverses the player to the sanctum
3. The Ferryman accepts 10 sats and gives the ferry token
4. Consequence events fire correctly — respawn works, `clears` wipes declared state
5. All `increment` and `set-counter` actions dispatch correctly
