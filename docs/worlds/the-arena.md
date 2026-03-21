# The Arena — Micro-World
*Combat, consequence, traverse, and counter mechanic test*

---

## Design Notes

**Purpose:** Test `attack` verb, `deal-damage`, `deal-damage-npc`, `on-attacked`, `on-health-zero`, NPC `health`/`damage`/`hit-chance`, `flees`, `traverse`, `increment`, `heal`, `on-counter`, `consequence` (respawn + clears), lethal portal (consequence on requires failure), player health tracking.

**Tone:** Gladiatorial. Spare. This is a test harness with enough story to justify the mechanics.

**Combat chain:**
```
Find sword → fight guard (flees when wounded) → fight champion → auto-traverse to freedom
```

**Map:**
```
[Entrance] ── north ── [Arena Floor] ── north ── [Champion's Gate] ── north ── [Freedom Road]
                             |
                           east
                             |
                        [Armoury]
```

**Lethal portal:** Entrance `south` exit is a portal that requires champion `defeated`. If the player tries to leave before winning, it fires the `sealed-gate` consequence — respawns them on the arena floor. After winning, the same portal lets them through to freedom.

**Dangling exit:** Freedom Road has a `south` exit — no going back.

**Player health:** Starts at 10. Guard deals 2 damage. Champion deals 4. Water trough in armoury heals 2 per drink (3 drinks max via counter).

---

## Mechanics Tested

| Mechanic | Event | How tested |
|---------|-------|-----------|
| `health` / `damage` / `hit-chance` on NPC | Guard, Champion | Stat declaration |
| `attack` verb | Sword item | Player types `attack guard` |
| `deal-damage` | Guard/Champion `on-attacked` | Player takes damage each exchange |
| `deal-damage-npc` | Guard/Champion `on-attacked` | NPC takes damage each exchange |
| `on-attacked` trigger | Guard, Champion | Fires on each player attack |
| NPC state machine | Guard `hostile → wounded → fled` | Health threshold triggers transition |
| `on-health-zero` trigger | Guard, Champion | Fires when NPC health reaches 0 |
| `flees` action | Guard `on-health-zero` | Guard retreats (no route → despawns) |
| `on-player-health-zero` | (via `deal-damage`) | Player death triggers consequence |
| `consequence` dispatch | Player death | Respawn at entrance, clears states + inventory + counters |
| `requires` on NPC state | Champions-gate portal | Blocked until guard `fled` |
| `traverse` action | Champion `on-health-zero` | Auto-navigates player through freedom portal |
| `increment` action | Guard/Champion `on-attacked` | `hits-taken` counter incremented each attack |
| `heal` action | Water trough `on-interact drink` | Heals player 2 HP per drink |
| `counter` + `on-counter` | Water trough `drinks` | 3 drinks max, trough goes empty at 0 |
| `decrement` action | Water trough `on-interact drink` | Decrements `drinks` counter |
| Hidden portal reveal | Freedom portal | Starts hidden, revealed by champion defeat |
| Lethal portal | Entrance south | Requires champion defeated; fires `sealed-gate` consequence on failure |

## Combat Flow

```
player types: attack guard
  → client resolves "guard" noun → arena:npc:guard
  → client fires on-attacked on guard
    → guard fires deal-damage 2 → player.health -= 2
    → guard fires deal-damage-npc → guard.health -= sword.damage
    → guard fires increment hits-taken
    → if guard.health <= 0 → on-health-zero fires
      → set-state fled
      → flees → guard despawns (no route tags)
  → if player.health <= 0 → consequence player-death
    → respawn at entrance
    → clears states, inventory, counters
```

## Victory Flow (traverse test)

```
player defeats champion → on-health-zero fires:
  → set-state defeated
  → set-state visible on freedom portal (was hidden)
  → traverse freedom portal → player auto-navigated to Freedom Road
```

The `traverse` fires after `set-state visible` in the same `on-health-zero` chain — the portal must be visible before traversal.

## Healing Flow (counter test)

```
player types: drink water
  → water trough on-interact drink fires:
    → decrement drinks (3 → 2 → 1 → 0)
    → heal 2 → player.health += 2
  → on-counter drinks 0 → set-state empty
  → trough transition full → empty: "The trough is empty."
```

## Notes for Implementation

- `hit-chance` (0.0–1.0) is the probability the NPC's counter-attack lands. Client rolls on each exchange.
- `damage` on the NPC is how much they deal to the player per hit. The player's weapon damage comes from `deal-damage-npc`.
- Player health should start at a configurable value — 10 here.
- The guard `transition wounded` fires when health drops below 50%. `fled` fires at zero.
- The `increment` on `hits-taken` is a tracking counter — no gameplay effect, purely for testing that increment dispatches correctly.

## Publishing

```json
{ "answers": {}, "events": [ ...all events above... ] }
```

Replace `<PUBKEY>` throughout. No NIP-44 encryption.
