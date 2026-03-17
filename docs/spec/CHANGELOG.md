# FOAKLOAR Schema Changelog
*All notable schema changes. Most recent first.*

---

## [Unreleased] — March 2026

### Added

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
Lightning payment gate. LUD-06 + LUD-11. Payment hash stored for recovery on reload. See spec section 2.7b.

**`on-complete` blank trigger-target**
`on-complete` always uses `""` as trigger-target — consistent with generic `on-*` shape:
`["on-complete", "", "set-state", "solved"]`

**Sequence puzzle auto-evaluation**
Client evaluates after any feature/item state change in current place — not on explicit player action. When all conditions pass, `on-complete` fires immediately.

**`on-counter` unified**
`on-counter-zero` + `on-counter-low` → single tag with threshold argument:
`["on-counter", "<counter>", "<threshold>", "<action-type>", "<action-target?>"]`
Three fire conditions: threshold crossing, state entry re-evaluation, load reconciliation.

**`on-interact` external target**
Fourth argument targets an external event rather than self:
`["on-interact", "insert", "set-state", "placed", "30078:<PUBKEY>:the-lake:feature:mechanism"]`

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
