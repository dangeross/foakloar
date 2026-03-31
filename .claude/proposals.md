# Proposals

Tracked feature proposals and their status.

## Active

### 1. Validation warnings on graph nodes — DONE
Show validation errors directly on nodes in the event graph. Compact labels below node subtitle, sidebar shows full issue list. Verb collision check scoped to co-located entities only (inventory items excluded to reduce noise).
- Status: **done**

### 2. Preview from sidebar
Quick play-test button in the sidebar that jumps the game view to the selected place without leaving build mode.
- Status: proposed

### 3. Minimap toggle
For large worlds, optional React Flow minimap overlay.
- Status: proposed

### 4. Bulk node actions
Select multiple nodes for batch operations (delete drafts, move, export subset).
- Status: proposed

### 5. NIP-44 sealed content in builder — DONE
Encrypt/decrypt preview for sealed content fields in the event editor. Hash puzzle decrypt flow in game client.
- Status: **done**

### 6. Multi-relay support — MERGED
RelayPool service, NIP-65 read-only discovery, relay settings panel, publish progress UI, rate-limit safe publishing. Live relay add/disconnect from settings. 5-second connection timeout per relay. Merged to main.
- Status: **done** (merged from feature/multi-relay)
- Remaining: test bulk publish with real relay publishing

### 7. Player death/respawn polish — DONE
Consequence flow for player health zero — respawn with item drops, state/counter clears, death/death-separator UI types, on-player-health triggers with threshold crossing.
- Status: **done**

### 8. More Lake content
Expand The Lake world — additional places, puzzles, NPC encounters.
- Status: proposed

### 9. Tutorial/onboarding world — DONE
11 Tide's End tutorial worlds + guide website (/guide route). Covers all event types: places, portals, items, features, state, NPCs, dialogue, puzzles, quests, combat, sound, recipes, payments, endgame. Plus Cartographer's Instrument showcase. Each tutorial importable from the guide page.
- Status: **done**

### 10. CLI/API world validation — DONE
CLI tool (`tools/validate-world.mjs`) and API endpoint (`api/validate.js`) for LLMs and authors to validate world JSON files. Structured issue objects with categories, fix suggestions, and externalRefs support. OpenAPI spec at `/.well-known/openapi.yaml`. Validates: missing tags, invalid refs, constrained enums (theme, collaboration, puzzle-type, etc.), numeric fields, direction fields, action types, trigger targets.
- Status: **done**

### 11. Endgame handling — DONE
`quest-type: endgame` with hard/soft modes. Hard end blocks commands (restart only), soft end keeps world open. Styled rendering with separator lines, closing prose, restart/continue prompt. Quests auto-set state to `complete` (not `solved`) for chaining. Cascading quest evaluation resolves chains in one pass. `on-complete` dispatch for quests (set-state, give-item, consequence, sound). Restart clears all player state and reloads.
- Status: **done**

### 12. NIP-58 Badges
Award NOSTR badges (NIP-58) when a player completes a quest, puzzle, or recipe. Badges are public proof of achievement on the player's NOSTR profile.
- Status: proposed
- Open questions: trigger on quest only, or also puzzle/recipe? Badge creation flow in builder?

### 15. Lobby import for existing worlds — DONE
When importing a world JSON from the Lobby that already exists on relays, navigate to the world first then use in-world import (DraftListPanel). Avoids duplicate events in graph (draft + published with different a-tags).
- Status: **done**

### 16. Delete published events from relay — DONE
Delete from relay button next to Pub for published events. Kind 5 deletion + empty overwrite.
- Status: **done**

### 17. World event pinning — DONE
8-char hex pubkey prefix appended to slug: `/w/the-lake-c08d7b5a`. Client filters world event candidates by prefix; bare slugs auto-pin via `replaceState` once world loads. Spec section 6.2 updated.
- Status: **done**

### 18. Cartographer's Record sound polish — DONE
Full soundscape design for Cartographer's Record. All ambient, layer, and triggered sounds verified through playtesting. Key discoveries documented in sample-presets.md: brown noise for wind/altitude, white noise (cycling values) for rushing water, fire*4 with crush+degrade-by for organic campfire, insect/birds/tabla/ocarina_vib/didgeridoo all verified. TidalCycles default library docs added as authoritative reference. Builder improvements: play buttons on sound tags and sound-action trigger tags, tag search/filter in sound event editor, alphabetical sort on add-tag dropdown.
- Status: **done**

### 19. NPC native inventory — DONE
NPCs carry items declared via `["inventory", "<item-ref>"]` tags. Shown on `examine`. Separate from `steals-item` stolen list in state (`npcState.inventory` vs `npcState.stolen`). `deposits` action only drops stolen items; native inventory is never auto-deposited.
- Status: **done**

### 20. Mobile usability — DONE
Ghost-text typeahead: single best-match completion (verb, direction, noun) shown as faded suffix. Tab on desktop or → button on touch to accept. Covers verbs, exit directions, in-scope entity nouns (static + roaming NPCs), ground items, and inventory. Ambiguous prefixes suppress the ghost until disambiguated. Ghost opacity 0.45 for readability across themes.
- Status: **done**
- Remaining: body scroll lock (input scrolls off-screen on mobile when reading up) — deferred, no clean fix without breaking other routes

### 21. State-gated actions (broader spec discussion)
Should actions only fire when a transition is valid? What about stateless events? Currently on-interact has state guard; other triggers don't. Parked until a clear use case emerges.
- Status: parked

### 22. Playwright / UI testing
Critical path tests: play through a room, publish a draft, import a world, toggle sound. Nice to have, not blocking.
- Status: proposed

### 13. Publish confirmation dialog — DONE
Add a confirmation dialog before publishing events to relays. Individual Pub shows "Publish? [Yes] [No]" inline. Publish All shows "Publish N events to relays? [Yes] [No]" below buttons. Also removed Preview & Publish from event editor.
- Status: **done**

### 14. Strudel integration review — DONE
Full Strudel API coverage: 80+ tags in tag schema, sound builder, decompiler. `s` as primary sound source with `oscillator` alias. Full ADSR, filter/pitch/FM envelopes, vibrato, tremolo, sample manipulation, extended effects, pattern modifiers. All values support mini-notation. Loop-only vs one-shot compatibility documented. Removed orphaned sound-reference.md.
- Status: **done**

## Completed

- Validation warnings on graph nodes (labels, sidebar, verb collision scoping)
- Event graph as default build view
- Sidebar: entity grouping, trust labels, exits with [+ add]
- Drag-to-connect portal creation
- Smart slot dropdown (free slots from place exits)
- DOSSelect/DOSPanel crash fixes
- Draft merge and identity switch fixes
- Sidebar exit detection for both exit tag forms
- NIP-44 sealed content decrypt flow (hash puzzle UI)
- Player death/respawn (consequence dispatch, respawn, clears, death UI types)
- CLI/API world validation (tools/validate-world.mjs, api/validate.js, OpenAPI spec)
- Endgame quests (quest-type endgame, hard/soft modes, restart, cascading eval, on-complete dispatch)
- Smoke tester + walkthrough runner (BFS reachability, discoverability checks, hint level)
- Examine as built-in command (works without verb tag)
- Dialogue text moved to content field (spec + engine)
- Puzzle exit (back/leave/cancel to exit puzzles)
- Lighthouse world three-way ending (the bearing, extinguish, coast road)
- Publish confirmation dialog (individual + bulk, inline Yes/No)
- Full Strudel API integration (80+ tags, s rename, mini-notation, one-shot compat)
- Tutorial guide website (/guide route, 11 tutorials, sidebar, import integration)
- Tutorial worlds: 11 Tide's End worlds covering all event types + payments
- Cartographer's Instrument showcase (musical puzzle, layered soundscape, FM synthesis)
- Restart command (mid-game with confirmation, endgame without)
- Relay connection timeout (5s per relay, dead relays fail fast)
- Sound editor: Play/Once buttons, s tag support, build mode isolation
- content-type allowed on all event types (markdown in features, dialogue, quests)
- Removed rand tag (complex patterns use Strudel code editor)
- Landing page (hero, pillars, curated worlds, starfield, footer)
- Tide's End as default CSS theme (replaces green terminal)
- resetTheme() on non-game routes
- Lobby: search default, sticky header, page-edge scrollbar
- Restart command mid-game with confirmation
- Security audit: trust chain validation, vouch revocation, HTML sanitizer, 24 tests
- Trust panel (tree view, revoke with cascading), vouch impact preview
- Report command for open worlds, moderator view
- Preview unvouched toggle (replaces mode switcher)
- Portal transition effects (8 CSS effects, transition-clear, transition-duration)
- Place colour overrides (per-room theme)
- Frontier world (open collaboration, Wild West, 145 events, flashback scene)
- The Courier showcase (logistics puzzle, max-inventory, HUD, Game Boy palette)
- Colossal Cave amendments: on-enter state guard, roam-type, world on-interact, max-inventory, world counters, HUD
- Engine refactor: unified _dispatchAction, 12 mixin modules (3417→775 lines)
- Sound refactor: state machine, sound-builder.js split, crossfade transitions
- Smart import: skip unchanged, update changed, add new
- Fixed forge/errand/arena worlds (exit slots, verb shadowing)
- Lobby import for existing worlds (detect slug → navigate → in-world import)
- Delete published events from relay (kind 5 + empty overwrite, UI button)
- Mobile typeahead (ghost-text, Tab/→ accept, verbs + directions + nouns)
- App icons updated to cyan tree logo, Android PWA black background baked in
- Lazy event indexes: O(1) portal/recipe/NPC/quest lookups, single-pass rebuild
- Synthetic world generator (scripts/gen-world.js) for scaling benchmarks
- Cartographer's Record: full sound design + engine fixes (global sequence puzzle eval, dialogue default state fallback, endgame quests via dialogue choices)
- Builder: sound play buttons (ambient/layer/effect roles), tag search in sound editor, alphabetical add-tag dropdown, sound-action trigger play button
- sample-presets.md: practical sound design guide, verified listener notes, known-good recipes, brown/white/pink noise generators documented
