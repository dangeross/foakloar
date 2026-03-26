# FOAKLOAR Schema Changelog
*All notable schema changes. Most recent first.*

---

## [Unreleased] — March 2026

### Changed — `on-interact` state guard

**`on-interact` shape updated with state guard field (position 2)**
New shape: `["on-interact", "<verb>", "<state-guard-or-blank>", "<action>", ...action-args]`. The state guard gates whether the action fires based on the entity's current state. Blank (`""`) fires in any state (backwards compatible). A specific state value fires only when the entity is currently in that state. This enables different behaviour per state on the same verb without separate events. All existing `on-interact` tags gain a blank `""` at position 2.

### Added — Open World Moderation

**Report command (`type: report`)**
Players can report content in open collaboration worlds: `report` (place) or `report <noun>` (entity). Publishes a report event with target ref and free-text reason. Reports are signals for moderators — no gameplay effect. Moderators see reports in build mode and can revoke offending authors. See spec section 6.9.

### Added — Security Audit

**Vouch revocation (`type: revoke`)**
New event type for revoking a previously issued vouch. Chain-aware cascading — revoking pubkey A also invalidates all vouches A issued, unless alternate vouch paths exist. Genesis and collaborators can revoke any vouched pubkey; vouched authors with `can-vouch: true` can only revoke pubkeys they personally vouched.

**Author chain validation (section 6.6.1)**
Trust checks now apply to the entire event reference chain, not just top-level visibility. Items, features, NPCs, clues, sounds, action targets, dialogue nodes, and payment events authored by untrusted pubkeys are silently skipped even if referenced by a trusted event.

**Image URL protocol validation (trust rule 6)**
`media` tag URLs and image references must use `https:` or `http:` protocol. `javascript:`, `data:`, and other URI schemes are blocked to prevent XSS via image injection.

**World event genesis pinning (trust rule 7)**
The world event is pinned to the genesis pubkey — oldest `created_at` wins. Prevents an attacker from publishing a competing world event with the same `d`-tag to hijack the trust root.

**Portal exit slot enforcement (trust rule 8)**
Portals can only claim exit slots declared on the originating place event via `exit` tags. Undeclared slots are silently ignored, preventing exit injection.

### Added

**Recipe content as craft prose**
Recipe `content` field is shown on successful craft (completion text), in addition to on examine. Gives authors a way to describe the crafting moment.

**Portal sound effects on traversal**
Portal `sound` tags with role `effect` fire as one-shots when the player traverses. Supports door creaks, footsteps, transition sounds.

**`activate` action type**
New action type that triggers a target event's native mechanic based on its type: recipe → crafting prompt, puzzle → puzzle prompt, payment → payment flow. Used to scope recipes/puzzles to a feature interaction: `["on-interact", "use", "", "activate", "<event-ref>"]`. Valid on `on-interact` and `on-complete` triggers.

**Auto crypto-key derivation on puzzle solve**
When a puzzle with `answer-hash` + `salt` tags is solved, the engine automatically derives and stores the NIP-44 decryption key from the answer. No explicit action tag needed.

**`puzzle` tag on NIP-44 sealed events**
Declares which puzzle's answer is the decryption key. Used by the publishing tool to encrypt `content` before signing.
```json
["content-type", "application/nip44", "text/markdown"],
["puzzle",       "the-lake:puzzle:serpent-mechanism"]
```

**Three-element `content-type` for sealed content**
Optional third element declares inner format after NIP-44 decryption. If absent, `text/plain` assumed.
```json
["content-type", "application/nip44"]                   // sealed plain text
["content-type", "application/nip44", "text/markdown"]  // sealed markdown
```

**World event file format for LLM authorship (spec section 3.1.1)**
Structured JSON output with two top-level keys. `answers` is stripped before signing — plaintext never reaches relay. Keys in `answers` are puzzle `d`-tag values.
```json
{
  "answers": { "my-world:puzzle:final-riddle": "the plaintext answer" },
  "events":  [ ...unsigned events... ]
}
```

**`colour` tag on world event — semantic colour slots**
Replaces `accent-colour`. Slots: `bg`, `text`, `title`, `dim`, `highlight`, `error`, `item`, `npc`, `clue`, `puzzle`, `exits`. Multiple allowed — each overrides one slot in the active theme preset.
```json
["colour", "text", "#00ff41"],
["colour", "npc",  "#fbbf24"]
```

**Built-in theme presets**
`terminal-green`, `parchment`, `void-blue`, `blood-red`, `monochrome`, `custom`. `theme` names a preset; `colour` tags override individual slots.

**Font named options**
`ibm-plex-mono`, `courier`, `pixel`, `serif`, or any CSS font-family string.

**`inventory` tag on world event**
Starting player inventory — given once on new game, not on reload.

**`inventory` tag on NPC event**
Items the NPC carries from spawn. Tracked per NPC. Drops on death, deposits via `deposits` action, stealable.

**`type: payment` primitive**
Lightning payment gate. LUD-06 + LUD-11. Payment hash stored for recovery on reload. See spec section 2.8.

**`on-complete` blank trigger-target**
`on-complete` always uses `""` as trigger-target — consistent with generic `on-*` shape:
`["on-complete", "", "set-state", "solved"]`

**Sequence puzzle auto-evaluation**
Client evaluates after any feature/item state change in current place — not on explicit player action. When all conditions pass, `on-complete` fires immediately.

**`on-counter` unified**
`on-counter-zero` + `on-counter-low` → single tag with threshold argument:
`["on-counter", "<direction>", "<counter>", "<threshold>", "<action-type>", "<action-target?>"]`
Three fire conditions: threshold crossing, state entry re-evaluation, load reconciliation.

**`on-interact` external target**
Fourth argument targets an external event rather than self:
`["on-interact", "insert", "", "set-state", "placed", "30078:<PUBKEY>:the-lake:feature:mechanism"]`

**`roams-when` tag on NPC**
NPC only roams when in declared state. Allows movement activation via state transition.

**World event fully specced**
Full manifest: `start`, `inventory`, `relay`, `collaboration`, `collaborator`, `theme`, `colour`, `font`, `cursor`, `cw`, `tag`, `content-type`, `media`. See spec section 6.1.

**NIP-51 world discovery (section 6.2.1)**
World lists use `kind: 30001`. Platform curated list. URL routing model documented.

**Extend-don't-fork guidance (section 6.2.2)**
Forking discouraged. Extension (new places connecting to existing world) and new worlds preferred.

**Trust and collaboration model (section 6)**
`collaborator` tags, `vouch` events with `scope` + `can-vouch`, trust rules, portal conflict resolution, client modes.

**Noun article stripping**
Client strips `the`/`a`/`an` from input before matching. Noun tags must never contain articles.

**Contested exit UI model (spec section 6.7)**
`south` navigates immediately if one trusted portal; shows short list (up to 5) if contested or unverified-only. `look south` always shows the full list. Unverified portals require confirmation before entry. `[+N unverified]` hint appended on arrival when alternatives exist. Trust indicators: `(trusted)`, `(community)`, `(unverified)`.

**Exit tag two forms on place events**
- Short: `["exit", "north"]` — slot only
- Extended: `["exit", "<place-ref>", "north", "label"]` — hints destination
Portal always uses extended form. Portal wins if conflict. Hidden portals still require slot declaration on the place.

**Authoring docs added**
- `reference/foakloar-authoring-guide.md` — world design process, writing guidelines, narrative patterns, common mistakes, publishing
- `reference/foakloar-micro-world.md` — complete 5-place worked example (The Lighthouse Keeper)

### Changed

**`accent-colour` removed** — replaced by `colour` tags with named semantic slots.

**`puzzle-type: payment` removed** — replaced by `type: payment`.

**`plaintext-type` tag proposed and removed before shipping** — replaced by three-element `content-type`.

**Sample presets documented — `dirt` and `classic`**
`reference/sample-presets.md` added. `dirt` preset: 217 Dirt-Samples banks (drums, synths, nature, voice, world instruments). `classic` preset: 53 VCSL acoustic/orchestral samples (recorder, ocarina, sax, harmonica, pipe organ, timpani, world percussion). Custom GitHub repos with `strudel.json` index supported. Spec and authoring guide updated with preset descriptions, world-type recommendations, and GitHub repo pattern.

**Sound system — envelope, samples library, noise correction**
`attack`, `sustain`, `release` tags added for envelope control. `sustain` is critical for state-gated layers — short sustain makes layers cut off cleanly when their state gate deactivates. `noise` corrected: it is a DSP oscillator generating `noise()`, not `s("noise")` (which would look for a sample). `samples` tag added to world event for loading sample libraries: `["samples", "dirt"]` loads Strudel Dirt-Samples; GitHub repos and direct URLs also supported. `type: sound` events do not carry the `w` discovery tag — they are referenced by `a`-tag, not relay-discovered.

**Sound system fully specced against working implementation**
`type: sound` event primitive with complete Strudel-mapped parameter set: source (`note`, `oscillator`, `noise`), volume/timing (`gain`, `slow`, `fast`, `pan`), filters (`lpf`, `hpf`, `vowel`), distortion (`crush`, `shape`), effects (`room`, `roomsize`, `delay` with two values, `rev`, `palindrome`), texture (`degrade-by`, `rand`), stereo/layering (`jux`, `stack`), pitch (`arp`), and `sample` for external audio. `gain` × `volume` multiplication documented. `loop` removed (implicit in Strudel). `delay` updated to two values (time, feedback). `roomsize` added alongside `room`. Default BPM is 120.

**Dialogue generalised — valid on any event, not just NPCs**
`dialogue` tags and `type: dialogue` events are valid on features, items, places, and NPCs. The `talk`/`ask` verb on any event triggers the dialogue tree. Feature dialogue example added (oracle mirror). Client flow updated to reflect any event type as host.

**`sound` extended — event tags on clue/puzzle/consequence/payment, and `sound` as action type**
Event `sound` tags: documented conventions per event type — clue (`effect` on reveal), puzzle (`layer` while unsolved), consequence (`effect` on fire), payment (`layer` while UI open). `sound` as action type: one-shot triggered from any `on-*` dispatcher. Shape: `["on-complete", "", "sound", "<pattern>", "<volume?>"]`. Added to action types table and trigger × action matrix. Two models: passive tags (scope-driven) vs action type (trigger-driven).

**`contains` tag fully specced — unified container mechanic**
Shape: `["contains", "<item-ref>", "<state-or-blank>", "<fail-message-or-blank>"]`. Valid on items and features. State gate makes contents accessible only when container is in specified state. Contained items are NOT declared on the place event — they exist exclusively inside the container. Scope: accessible when container is in inventory or on ground in current place. Commands: `take <item> from <container>`, `take all from <container>`, `examine <container>`. Starting inventory containers work naturally via world event `inventory` tag.

**`on-fail` trigger added to puzzle events**
Fires when a riddle or cipher puzzle receives a wrong answer. Shape mirrors `on-complete`. Valid on `riddle` and `cipher` only — sequence/observe have no wrong-answer state. Pair with a counter + `on-counter` for attempt-limited puzzles.

**Branching puzzles removed — state is the branching primitive**
The branching puzzle pattern (multiple `on-complete` tags with client-layer selection) is removed. Branching is expressed through `set-state` on any trigger, with state carrying through the world and gating future content via `requires`. No special branching mechanic exists or is needed.

**`set-state` added to consequence tag table and execution order**
Was used in examples (silver-weakness) but missing from the formal tag table and execution order. Added as step 4 — fires after `deal-damage`, before inventory drop. Shape identical to `on-interact`: state string with optional external event `a`-tag.

**`on-encounter` shape formalised — filter + external target**
Trigger-target is now `""` (any entity), `"player"`, or NPC `a`-tag. Optional 5th element is an external action target — same convention as `on-attacked` and `on-interact`. `""` enables proximity traps firing on any entity.

**`on-attacked` / `on-encounter` filter semantics table added**
Documents which trigger-target values are valid for each trigger — `on-attacked` filters by weapon (item ref or `""`), `on-encounter` filters by entity (`""`, `"player"`, NPC ref). `"player"` is not applicable to `on-attacked`.

**`on-attacked` shape formalised — filter + external target**
Trigger-target is now a weapon item `a`-tag (or `""` for any attack). Optional 5th element is an external action target — same convention as `on-interact`. Enables weapon-specific NPC reactions (silver sword extra damage, magic resistance) and cross-NPC effects (alert guard, decrement shield durability).

**Consequence as action carrier — inline vs consequence guidance documented**
Simple single-action reactions stay inline. Multi-action, reusable, or cross-event reactions delegate to a `consequence` event. Same `on-attacked` filter can delegate to consequence for weapon-specific complex outcomes. Guidance: if one action fires, inline it. If multiple actions fire together, or the same reaction fires from multiple triggers, use consequence.

**`on-health` and `on-player-health` triggers added**
Unified health threshold triggers replacing `on-health-zero` and `on-player-health-zero`. Shape mirrors `on-counter`: `["on-health", "<direction>", "<threshold>", "<action-type>", "<action-target?>"]`. Threshold is absolute integer or `N%` percentage of max-health. `on-player-health` valid on world event (global) or NPC (local). Old tags kept as client aliases for backwards compat but removed from spec.

**Recipe `consume-item` is explicit, not automatic**
`requires` gates a recipe but does not consume ingredients. Authors must declare each `on-complete consume-item` explicitly. Enables non-item requirements (lit forge, place state) without consuming them.

**Quest `on-complete` support added**
Quests fire `on-complete` tags when all `requires` pass — same dispatcher as puzzles and recipes. Minimum behaviour (mark solved, update quest log) applies without `on-complete` tags. Reward items, portal unlocks, and state changes via `on-complete`.

**`flees` documented as message-only action**
`flees` emits a departure message. NPC movement requires `set-state` to activate `roams-when`. Both together give correct flee behaviour. `flees` alone = message only. `set-state` alone = silent movement.

**Built-in commands section added (spec section 9.3)**
Canonical command set: `look`, `look <direction>`, `inventory`/`i`, `help`/`?`, `quests`/`q`, `examine`, `take`, `drop`, `go <direction>`, cardinal directions, `attack`. Built-ins cannot be overridden by world verb tags.

**Player health on world event**
`["health", "10"]` and `["max-health", "10"]` on the world event set starting player health. `["on-player-health-zero", "", "consequence", "<ref>"]` on the world event fires when player dies.

**`with` preposition reverses noun order**
Two-noun commands with `with` keep noun order: `attack guard with sword` → target=guard, instrument=sword. Other prepositions (`on`, `to`, `at`, `in`, `into`) swap: `use key on door` → target=door, instrument=key.

**`requires` supports NPC and portal state checks**
`["requires", "<npc-ref>", "fled", "..."]` checks NPC state. NPC state changes sync to `player.states` so `checkRequires` can evaluate them. Portal state also supported.

**Quest endgame and chaining specced**
`quest-type: endgame` added — hard end (win screen, no more commands) or soft end (`["quest-type", "endgame", "open"]` — world stays open). Endgame quests are always hidden from quest log, evaluated continuously on every state change. Multiple endgame quests = multiple possible endings. Quest chaining via `requires` on quest events — client auto-sets state to `complete` on completion (not `solved` — that is for puzzles). Cascade evaluation: completing one quest immediately re-evaluates all others. Restart behaviour documented.

**`quest-type` tag added to quest events**
Controls how the quest log reveals progress. `open` (default) — shows all steps. `hidden` — shows `✗ ???` for incomplete steps, scope visible. `mystery` — incomplete steps not shown at all. `sequential` — only the next undone step is named, rest hidden. Backwards compatible — `open` is assumed when tag is absent.

**Matrix: `on-attacked` now allows `increment`/`decrement`/`set-counter`**
Counting hits taken, tracking shield durability, attack-count puzzles. Consistent with `on-encounter` and `on-move` which already allow counter actions.

**Matrix: `on-health` now allows `traverse`**
Teleport player on NPC death — reward chamber, cutscene location. Consistent with `on-player-health` which already allows `traverse` for respawn.

**`on-counter` direction argument added**
Shape changed from `["on-counter", "<counter>", "<threshold>", ...]` to `["on-counter", "<direction>", "<counter>", "<threshold>", ...]`. Direction is `down` (fires crossing at-or-below) or `up` (fires crossing at-or-above). All existing `on-counter` tags updated to `"down"`. Enables upward-crossing counters (hit counts, charge accumulation) without new tag names.

**Counter action tag positions documented**
`["on-interact", "<verb>", "", "increment"|"decrement", "<counter-name>"]` and `["on-interact", "<verb>", "", "set-counter", "<counter-name>", "<value>"]`. External target as optional final element — same pattern as external `set-state`.

**External counter targeting added**
Counter actions (`increment`, `decrement`, `set-counter`) support an optional external event `a`-tag as final element, targeting another event's counter. `["on-interact", "pump", "", "increment", "heat", "30078:<PUBKEY>:forge:feature:forge"]`

**`clears inventory` drop behaviour specified**
Items dropped to current place before inventory is emptied — never destroyed. Prevents soft-locks. Drop location is `currentPlace` at consequence dispatch time, not the respawn destination.

**Consequence execution order defined**
Fixed order: `give-item` → `consume-item` → `deal-damage` → drop inventory → `clears inventory` → `clears states` → `clears counters` → other `clears` → `respawn`. Drop before clear, respawn always last.

**`clears states` and item state reset semantics**
Dropped items initialise from event default state on re-pickup — not pre-death state. Correct: a lantern left on the ground resets to `off` on next pickup.

**`clears counters` and resource reset semantics**
Counters re-initialise from event `counter` tags on re-pickup. Depleted lantern resets to full after a death that clears counters. Authors who want counters to persist across death should omit `clears counters`.

**Sound scoring system added (`sound` tag)**
Any event can declare sound layers. Client mixes all active layers in real time. State-aware — layers add/remove as world state changes. Pattern-based synthesis via mini-notation (Strudel/TidalCycles style), no audio files.

Shape: `["sound", "<role>", "<value>", "<pattern?>", "<state?>"]`
Roles: `bpm` (tempo, value=BPM), `ambient` (continuous loop), `layer` (adds to mix in scope), `effect` (one-shot on state change).
Progressive enhancement — clients that don't implement sound ignore tags silently.

**Visual effects system added to world event**
`effects` tag selects a bundle; individual tags override specific effects.

Bundles: `crt` (scanlines + glow + flicker + vignette), `typewriter` (vignette only), `clean`/`none` (no effects).

Individual overrides: `scanlines` (on/off), `glow` (0.0–1.0), `flicker` (on/off), `vignette` (0.0–1.0), `noise` (0.0–1.0).

Theme presets now have default bundles: `terminal-green`/`void-blue`/`blood-red` → `crt`, `parchment` → `typewriter`, `monochrome`/`custom` → `clean`. If `effects` absent, client uses preset default.

**`observe` puzzle type fleshed out**
Named variant of `sequence` — `requires` checks `visited` or `read` states. Auto-evaluated on state change. No answer input. `map` puzzle type removed as unspecced.

**`cipher` puzzle type fleshed out**
NIP-44 sealed clue. Answer derives decryption key. Same hash verification as `riddle`.

**Conditional clue visibility via `requires` on clue events**
`requires` on a clue gates visibility even after `set-state visible` fires. Correct pattern for conditional clues — inline `requires` strings on `on-interact` are not valid schema (max 4 elements).

**`puzzle` tag on sealed places is publishing-tool only**
Not read by client engine at runtime. Documents which answer to use for NIP-44 encryption. Riddle puzzles activated via feature `on-interact` → `set-state` on the puzzle event.

**`["w", "foakloar"]` tag on world events — relay discovery**
Single-letter indexed tag enabling relay-level discovery of all FOAKLOAR world events:
`{ kinds: [30078], '#w': ['foakloar'] }`
Only world events carry this tag — content events do not. Value is always lowercase `"foakloar"`. Complements NIP-51 curated lists: `#w` is open discovery, curated lists are curation. See spec section 6.2.0.

**`description` tag removed — use `content` field universally**
`["description", "..."]` was an undocumented tag used on items, features, and NPCs. Replaced throughout with the standard `content` field, consistent with places, clues, and all other event types. `content-type` declares the format as before.

**`unlock` action removed** — holdover from a pre-`requires` model. No `type: lock` event exists in the schema. All locking behaviour is expressed through `requires` on portals/features/places, `set-state` to change conditions, and `give-item` to satisfy item requirements. Removed from action types table and trigger × action matrix.

**Trigger × Action compatibility matrix added** — documents which action types are valid on each trigger tag. Lives in spec alongside the action types table.

**Contested exit UI model added (spec section 6.7)** — `south` navigates immediately if one trusted portal; short list if contested. `look south` shows full list. Unverified portals require confirmation. `[+N unverified]` hint on arrival when alternatives exist.

**`on-counter-zero` / `on-counter-low` removed** — replaced by unified `on-counter` with threshold argument.

**`requires` shape — no type argument**
`["requires", "<event-ref>", "<state>", "<description>"]` — type inferred from referenced event.

**`exit` tag reordered — place-ref second**
`["exit", "<place-ref>", "<slot>", "<label?>"]` — enables relay `#exit` queries by place.

**`verb` / `noun` tags — canonical first, aliases follow**

**`hidden: true` → `state: hidden`**

**`flag` / `set-flag` removed** — all flags are event states.

**`on-arrive` → `on-enter`**, **`on-solve` → `on-complete`**

**`ingredient` → `requires`**, **`produces` → `on-complete give-item`** on recipes.

**`guards` tag removed from NPCs** — use `requires` on portal instead.

**`preserves` removed from consequences** — everything preserved by default, only declare `clears`.

**`room` → `place`** throughout all docs.

**Files renamed** — `nostr-dungeon-design.md` → `foakloar-design.md`, `nostr-dungeon-mvp.md` → `foakloar-mvp.md`.

---

## Client State Shape (Phase 11 refactor)

Unified world-keyed localStorage structure. All keys use full `a`-tags — collision-proof across collaborators:

```json
{
  "the-lake": {
    "player": {
      "place":           "30078:<PUBKEY>:the-lake:place:dark-cave",
      "inventory":       ["30078:<PUBKEY>:the-lake:item:iron-key"],
      "states":          { "30078:<PUBKEY>:the-lake:feature:altar": "watered" },
      "counters":        { "30078:<PUBKEY>:the-lake:item:brass-lantern:battery": 147 },
      "dialogueVisited": { "30078:<PUBKEY>:the-lake:dialogue:hermit:cave": "visited" },
      "paymentAttempts": {},
      "visited":         ["30078:<PUBKEY>:the-lake:place:clearing"],
      "moveCount":       8
    },
    "30078:<PUBKEY>:the-lake:npc:collector": {
      "place":     "30078:<PUBKEY>:the-lake:place:cave-network",
      "state":     "hunting",
      "inventory": [],
      "health":    null
    }
  }
}
```

`player.states` replaces all separate state maps (`item-states`, `feature-states`, `portal-states`, `puzzle-states`) — flat map, type-agnostic, keyed by full `a`-tag.
`player.counters` replaces `item-counters` — flat map, `a-tag:counter-name` → integer.
NPC `state` is first-class property, not nested in a map.

---

## Client Implementation Notes

| Change | Client action |
|--------|--------------|
| `on-counter` unified | Update counter trigger handler — always reads threshold argument |
| `inventory` on world event | Read on new game init, add items to starting inventory |
| `inventory` on NPC event | Track NPC carried items; drop on death, deposit on `deposits` action |
| `type: payment` | LNURL-pay → LUD-11 verify → on-complete. Store payment-hash for recovery. |
| `roams-when` | Check NPC state before calculating movement position |
| Article stripping | Strip `the`/`a`/`an` from noun input before matching |
| `exit` tag reorder | Parse `["exit", place-ref, slot, label?]` — place-ref is index 1 |
| `on-complete` blank | Always `["on-complete", "", action-type, ...]` |
| Client state keys | Full `a`-tags throughout — migrate bare d-tag keys on load (Phase 11b) |
