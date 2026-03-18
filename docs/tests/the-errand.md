# The Errand — Micro-World
*Quest tracking mechanic test*

---

## Design Notes

**Purpose:** Test `type: quest`, `involves` tags, quest completion via `requires` evaluation, quest log UI.

**Tone:** Mundane. Village errands. The story is in the doing, not the drama.

**Quest chain:**
```
Read notice board → collect flour → deliver to bakery → draw water → light oven → quest complete
```

**Map:**
```
              [Market]
                |
              north
                |
[Bakery] ── west ── [Village Square] ── east ── [Well]
```

---

## Mechanics Tested

| Mechanic | Event | How tested |
|---------|-------|-----------|
| `type: quest` | `errand:quest:morning-errands` | Named quest with completion conditions |
| `involves` tags | Quest event | Links to flour, bucket, oven — client quest log hints |
| Quest `requires` completion | Quest event | All conditions must pass: oven `hot`, bucket `full` |
| Quest log UI | `quests` command | Shows active/completed quests |
| NPC dialogue with `requires` | Baker thanks | Only shows after oven is `hot` |
| Item state machine | Bucket `empty → full` | Fill at well |
| Feature state machine | Oven `cold → hot` | Light with water on hand |
| Feature `requires` item state | Oven | Requires bucket `full` before lighting |

## Quest Completion Flow

```
player reads notice board → clue revealed (three errands)
player goes to market → picks up flour sack
player goes to well → picks up bucket → fills bucket (state: full)
player goes to bakery → oven requires bucket:full → light oven (state: hot)
  → quest requires check: oven:hot ✅, bucket:full ✅
  → quest complete
player talks to baker → thanks dialogue (requires oven:hot)
```

## Notes for Implementation

- Quest completion is evaluated the same way as puzzle completion — `requires` tags checked against player state after any state change
- `involves` tags are display hints only — they tell the quest log UI which events to show progress for
- The quest has no `on-complete` actions — completion itself is the reward (baker's thanks dialogue serves as narrative closure)
- The flour sack delivery is implicit — having it in inventory when entering the bakery is enough. No explicit "give" mechanic needed for this test (recipe/give would be a separate test)

## Publishing

```json
{ "answers": {}, "events": [ ...all events above... ] }
```

Replace `<PUBKEY>` throughout. No NIP-44 encryption.
