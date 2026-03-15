# CLAUDE.md — Project Rules

## Golden Rule

**The design spec is the source of truth.** Every tag shape, trigger type, and action type must conform to `docs/spec/nostr-dungeon-design.md`. If a feature or tag doesn't exist in the spec, **discuss it with the user before implementing**. Never invent new tags, triggers, or action types.

---

## Project Overview

A decentralised text adventure built on NOSTR (kind 30078). The world is a graph of events on relays. The client is a Vite + React 19 + Tailwind v4 app.

**World:** "The Lake" (`t` tag: `the-lake`)

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/spec/nostr-dungeon-design.md` | **Canonical design spec** — all tag shapes defined here |
| `docs/the-lake/the-lake-client-plan-1.md` | Phase 1–10 client implementation plan |
| `docs/the-lake/the-lake-client-plan-2.md` | Phase 11–18 client implementation plan |
| `docs/the-lake/the-lake-world.md` | Full world design (places, items, puzzles) |
| `src/App.jsx` | Main game component — rendering, theme, world bootstrap |
| `src/usePlayerState.js` | Player state hook with world-keyed localStorage persistence |
| `src/world.js` | World query helpers (requires check, noun lookup, exits) |
| `src/theme.js` | Theme resolver — presets + world event colour overrides |
| `src/config.js` | Relay URLs, world tag, author pubkey |
| `src/engine/engine.js` | GameEngine class — command dispatch, room entry, movement |
| `src/engine/player-state.js` | PlayerStateMutator — synchronous state wrapper |
| `src/engine/parser.js` | Verb/noun parser — verb map, article stripping |
| `src/engine/actions.js` | Action resolution — set-state, give-item, counters |
| `src/engine/content.js` | Content rendering — markdown, media, NIP-44 |
| `src/engine/__tests__/` | Vitest unit tests for engine, parser, actions, world |
| `lib/events/*.mjs` | World event definitions (places, portals, items, features, clues) |
| `tools/publish-world.mjs` | Publishes events to relays |

---

## Tag Shape Reference (from spec)

### requires / requires-not

Always uses event refs (a-tag format `30078:<pubkey>:<d-tag>`), never bare flag strings.

```
["requires",     "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
["requires-not", "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
```

- Always exactly 4 elements (tag name + 3 arguments)
- Blank state on items = player holds it in any state
- The client resolves the event ref, checks its `type` tag, then checks state

### on-* triggers (spec-defined)

```
["on-<trigger>", "<trigger-target>", "<action-type>", "<action-target?>"]
```

Spec-defined triggers: `on-interact`, `on-complete`, `on-enter`, `on-encounter`, `on-attacked`, `on-health-zero`, `on-player-health-zero`, `on-move`, `on-counter`

### on-counter

Unified counter trigger — fires an action when a counter crosses a threshold (going down). Shape has an extra threshold argument:

```
["on-counter", "<counter>", "<threshold>", "<action-type>", "<action-target?>"]
```

The message comes from transition text, not from the tag. Example:

```
["on-counter",  "battery", "20", "set-state", "flickering"]
["transition",  "on", "flickering", "The lantern flickers ominously."]
```

Spec-defined actions: `unlock`, `set-state`, `traverse`, `give-item`, `consume-item`, `deal-damage`, `deal-damage-npc`, `heal`, `consequence`, `steals-item`, `deposits`, `flees`, `decrement`, `increment`, `set-counter`

### state & transition

```
["state",      "<initial-state>"]
["transition", "<from>", "<to>", "<optional-text>"]
```

### counter

```
["counter", "<name>", "<initial-value>"]
```

---

## Resolved Spec Deviations

All previously tracked deviations have been fixed:

1. **`on-counter`** — unified trigger (replaces `on-counter-low` and `on-counter-zero`). Fires actions when counter crosses threshold downward. Message comes from transition text.
2. **`requires` tags** — all use event refs with 4-element shape. No more bare flag strings.
3. **`checkRequires`** — resolves events and dispatches on `type` tag (item, feature, puzzle, portal).
4. **`flags` removed** — all state tracking uses the unified `states` map keyed by d-tag.

---

## Implementation Progress

| Phase | Status |
|-------|--------|
| 1. Feature State Machines | Done |
| 2. `requires` on Features/Places | Done |
| 3. Item States and Counters | Done |
| 4. Hidden Portals and Features | Done |
| 5. `set-state` with External Target | Done (merged into Phase 4) |
| 6. Verb/Noun Parser | Done |
| 7. NPC Rendering and Dialogue | Done |
| 8. Sequence Puzzles | Done |
| 9. `media` Tag Rendering | Done |
| 10. `content-type: text/markdown` | Done |
| 11. State Structure Refactor | Done |
| 12. World Event Bootstrap + Theme | Done |
| 13. NPC Inventory + Roaming | Done |

---

## Parser Conventions

- **Verb aliases are data, not code.** The parser builds its verb map from `verb` tags on events in the current place + inventory. Aliases like `x` for `examine` must be on the verb tag: `["verb", "examine", "x", "look at", "inspect"]`. First value is canonical; `on-interact` always references the canonical verb.
- **One verb tag per canonical verb.** Don't combine multiple canonical verbs into one tag (e.g. `["verb", "examine", "pray"]` is wrong — use two separate verb tags).
- **Article stripping.** The client strips leading articles (`the`, `a`, `an`) from noun input. Noun tags should never include articles: `["noun", "lantern", "brass lantern"]` matches `the brass lantern`.
- **Two-noun commands.** `<verb> <noun> [preposition] <noun>` — target is noun2, instrument is noun1. Prepositions: `on`, `with`, `to`, `at`, `in`, `into`.
- **Built-in commands** (not data-driven): `look`/`l`, `inventory`/`i`, `pick up`/`take`/`get`/`grab`, direction words.

---

## Tech Stack

- Vite 8, React 19, Tailwind CSS v4 (`@tailwindcss/postcss`)
- nostr-tools v2.12 (`Relay.connect`, `relay.subscribe`, `relay.publish`)
- Vitest for unit testing
- NIP-44 encryption/decryption for sealed content
- SHA-256 hash puzzles with salt

---

## Testing

- Run `npm test` (or `npx vitest run`) before committing — all tests must pass
- Run `npm run test:watch` during development for live feedback
- Tests live in `src/engine/__tests__/` and cover: player state, parser, world helpers, actions, engine integration
- Test helpers in `__tests__/helpers.js` provide factory functions for building events and engine instances
- When adding new engine features, add corresponding tests

---

## Process

- Read the spec before implementing any new mechanic
- All world events must use tag shapes exactly as defined in the spec
- Discuss any proposed spec extensions before writing code
- The client should be event/data-driven — behaviour comes from tags, not hardcoded logic
- Test each phase with world content that exercises the new mechanic
- Run `npm test` to verify all engine tests pass before committing
