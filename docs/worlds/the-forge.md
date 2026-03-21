# The Forge — Micro-World
*Recipe, crafting, and counter mechanic test*

---

## Design Notes

**Purpose:** Test `type: recipe`, `ordered: true`, `consume-item` on completion, item combination verb, `set-counter`, `on-counter` threshold, forge heat management.

**Tone:** Functional. An abandoned smithy. Not a story — a proof of concept with enough atmosphere to feel like a world.

**Item chain:**
```
iron-bar (found) + leather-strip (found) + forge (lit, hot) → iron-key → locked chest → win
```

**Map:**
```
[Smithy] ── east ── [Storeroom]
   |
 south
   |
[Yard]
```

**Dangling exit:** Smithy has a `north` exit — beyond the scope of this world.

---

## Mechanics Tested

| Mechanic | Event | How tested |
|---------|-------|-----------|
| `type: recipe` | `forge:recipe:iron-key` | Combine iron-bar + leather-strip + lit forge → iron-key |
| `ordered: true` | Recipe | Iron bar first, leather second, forge third |
| `requires` on feature state | Recipe | Forge must be `lit` — state condition on non-item |
| `consume-item` on `on-complete` | Recipe | Both ingredients consumed on craft |
| `give-item` on `on-complete` | Recipe | Iron key given on craft |
| `requires` on feature | Chest | `iron-key` in inventory gates chest interaction |
| `consume-item` on `on-interact` | Chest | Key consumed on use |
| Feature state machine | Forge | `cold → lit → cooling → cold` cycle |
| External `set-state` | Forge light | Reveals clue |
| `set-counter` action | Forge `on-interact light` | Sets heat counter to 3 when lit |
| `on-counter` threshold | Forge heat | At 1 → cooling state, at 0 → cold state |
| Bellows `set-state` external | Bellows pump | Resets forge back to `lit` from `cooling` |

## Forge Heat Flow (counter test)

```
player lights forge:
  → set-state lit
  → set-counter heat 3

(heat decrements over use or time)
  → on-counter heat 1 → set-state cooling
  → on-counter heat 0 → set-state cold

player pumps bellows:
  → set-state lit on forge (external target)
  → forge transitions cooling → lit
```

The bellows provide a way to recover the forge from `cooling` back to `lit` without relighting. This tests external `set-state` targeting.

## Narrative Notes

The chest is the win state — it contains a letter from the smith. Intentionally low stakes: this world is a mechanic test, not a story. The letter hints at a larger world without building one.

The `ordered: true` on the recipe is the critical test — iron bar must be the first `requires` evaluated. If the client evaluates out of order, the recipe either fails to fire or fires with wrong ingredients.

The forge `requires` on state (not item) is also important — it tests that recipe `requires` evaluates feature states correctly, not just item presence.

The forge heat counter tests `set-counter` (on light) and `on-counter` thresholds (cooling at 1, cold at 0). The bellows test external `set-state` — pumping the bellows sets the forge's state back to `lit` from another feature's `on-interact`.

## Publishing

```json
{ "answers": {}, "events": [ ...all events above... ] }
```

Replace `<PUBKEY>` throughout. No NIP-44 encryption.
