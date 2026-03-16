# FOAKLOAR Schema Changelog

All notable schema changes. Most recent first.

---

## [Unreleased] — March 2026

### Added

**`puzzle` tag on NIP-44 sealed events**
Declares which puzzle's answer is the decryption key. Used by the publishing tool to encrypt `content` before signing.
```json
["content-type", "application/nip44", "text/markdown"],
["puzzle",       "the-lake:puzzle:serpent-mechanism"]
```

**Three-element `content-type` for sealed markdown**
Optional third element declares inner format after NIP-44 decryption. If absent, `text/plain` assumed.
```json
["content-type", "application/nip44"]                   // sealed plain text
["content-type", "application/nip44", "text/markdown"]  // sealed markdown
```
Replaces the proposed `plaintext-type` tag — same semantics, one tag.

**World event file format for LLM authorship (spec section 3.1.1)**
Structured JSON output with two top-level keys. `answers` is stripped before signing — plaintext never reaches relay.
```json
{
  "answers": {
    "my-world:puzzle:final-riddle": "the plaintext answer"
  },
  "events": [ ...unsigned events... ]
}
```
Keys in `answers` are puzzle `d`-tag values. The publishing tool:
1. Encrypts NIP-44 sealed event `content` using the answer
2. Verifies `answer-hash` values match `SHA256(answer + salt)`
3. Strips `answers` entirely
4. Signs and publishes

**Authoring docs added**
- `reference/foakloar-authoring-guide.md` — world design process, writing guidelines, narrative patterns, common mistakes, publishing
- `reference/foakloar-micro-world.md` — complete 5-place worked example (The Lighthouse Keeper)

**`colour` tag on world event — semantic colour slots**
Replaces `accent-colour`. Named slots: `bg`, `text`, `title`, `dim`, `highlight`, `error`, `item`, `npc`, `clue`, `puzzle`, `exits`. Multiple allowed — each overrides one slot in the active theme preset.
```json
["colour", "text", "#00ff41"],
["colour", "npc",  "#fbbf24"]
```

**Built-in theme presets**
`terminal-green`, `parchment`, `void-blue`, `blood-red`, `monochrome`, `custom`.
`theme` names a preset providing all colour defaults. `colour` tags override individual slots. `theme: custom` requires all slots declared explicitly.

**Font named options**
`ibm-plex-mono`, `courier`, `pixel`, `serif`, or any CSS font-family string.

**`inventory` tag on world event**
Starting player inventory. Given once on new game, not on reload.
`["inventory", "30078:<pubkey>:the-lake:item:scribbled-note"]`

**`inventory` tag on NPC event**
Items the NPC carries from spawn. Tracked per NPC. Drops on death, deposits via `deposits` action, stealable.

**`type: payment` primitive**
Lightning payment gate. LUD-06 (invoice generation) + LUD-11 (payment verification). Payment hash stored for recovery on reload. See spec section 2.7b.

**`on-complete` blank trigger-target**
`on-complete` always uses `""` as trigger-target — consistent with generic `on-*` shape:
`["on-complete", "", "set-state", "solved"]`

**Sequence puzzle auto-evaluation**
Client evaluates sequence puzzle `requires` after any feature or item state change in current place — not on explicit player action.

**`on-counter` unified**
`on-counter-zero` + `on-counter-low` → single `on-counter` with threshold argument:
`["on-counter", "<counter>", "<threshold>", "<action-type>", "<action-target?>"]`
`0` is a valid threshold — not a special case. Three fire conditions: threshold crossing, state entry re-evaluation, load reconciliation.

**`on-interact` external target**
`["on-interact", "insert", "set-state", "placed", "30078:<PUBKEY>:the-lake:feature:mechanism"]`

**`roams-when` tag on NPC**
NPC only roams when in declared state. If absent, always roams. Allows movement activation via state transition (e.g. Sloth confined until `ally` state).

**World event fully specced**
Full manifest: `start`, `inventory`, `relay`, `collaboration`, `collaborator`, `theme`, `colour`, `font`, `cursor`, `cw`, `tag`, `content-type`, `media`. See spec section 6.1.

**`start` tag on world event**
Points to genesis place `a`-tag. Client fetches world event, reads `start`, begins there.

**`cw` tag on world event**
Content warnings displayed before world loads. No enforced vocabulary.

**NIP-51 world discovery (section 6.2.1)**
World lists use `kind: 30001`. Platform curated list. URL routing model documented.

**Extend-don't-fork guidance (section 6.2.2)**
Forking discouraged. Extension (new places connecting to existing world) and new worlds preferred.

**Trust and collaboration model (section 6)**
`collaborator` tags, `vouch` events with `scope` + `can-vouch`, trust rules, portal conflict resolution, client modes.

**Noun article stripping**
Client strips `the`/`a`/`an` from input before matching. Noun tags must never contain articles.

**Exit tag two forms on place events**
- Short: `["exit", "north"]` — slot only
- Extended: `["exit", "<place-ref>", "north", "label"]` — hints destination
Portal always uses extended form. Portal wins if conflict.

**Payment use cases (ideas doc)**
Shops, informers, shortcuts, hints, bribes, ferryman, timed access, auction, episodic preview.

### Changed

**`accent-colour` removed** — replaced by `colour` tags with named semantic slots.

**`puzzle-type: payment` removed** — replaced by `type: payment`. Payment is not a puzzle variant.

**`plaintext-type` tag removed before shipping** — replaced by three-element `content-type`.

**`exit` tag shape — place-ref second**
`["exit", "<place-ref>", "<slot>", "<label?>"]` — enables relay `#exit` queries by place.

**`requires` shape — no type argument**
`["requires", "<event-ref>", "<state>", "<description>"]` — type inferred from referenced event.

**`room` → `place`** throughout all docs.

**`on-arrive` → `on-enter`** — unified trigger. NPC uses place `a`-tag as first argument; room uses `player`.

**`on-solve` → `on-complete`** — unified trigger for puzzle completion, recipe combination, payment confirmation.

**`hidden: true` → `state: hidden`** — consistent with state model. Revealed via `set-state visible`.

**`flag`/`set-flag` removed** — all flags are event states. `requires` checks event state directly.

**`guards` tag removed from NPCs** — use `requires` on portal instead: `["requires", "<npc-ref>", "gone", "..."]`

**`preserves` removed from consequences** — everything preserved by default, only declare `clears`.

**`ingredient` → `requires`**, **`produces` → `on-complete give-item`** on recipes.

**`on-counter-zero` → `on-counter` with threshold `"0"`**
All existing `on-counter-zero` tags updated. `on-counter-low` also folded in.

**`verb` tag — canonical first, aliases follow**
First value is the canonical verb used in `on-interact`. Additional values are aliases.

**`noun` tag — canonical first, aliases follow**
Same pattern as `verb`. Article stripping means tags should never contain `the`, `a`, `an`.

---

## Client State Shape (Phase 11b)

Unified world-keyed structure — all entity state under world slug. All keys use full `a`-tags (`30078:<pubkey>:<d-tag>`) — collision-proof across collaborators.

```json
{
  "the-lake": {
    "player": {
      "place":           "30078:<PUBKEY>:the-lake:place:dark-cave",
      "inventory":       ["30078:<PUBKEY>:the-lake:item:iron-key"],
      "states":          { "30078:<PUBKEY>:the-lake:feature:altar": "watered" },
      "counters":        { "30078:<PUBKEY>:the-lake:item:brass-lantern:battery": 147 },
      "dialogueVisited": {},
      "paymentAttempts": {},
      "visited":         [],
      "moveCount":       8
    },
    "30078:<PUBKEY>:the-lake:npc:collector": {
      "place":     "30078:<PUBKEY>:the-lake:place:cave-network",
      "state":     "hunting",
      "inventory": [],
      "health":    null
    },
    "30078:<PUBKEY>:the-lake:place:flooded-passage": {
      "inventory": ["30078:<PUBKEY>:the-lake:item:brass-lantern"]
    }
  }
}
```

- `player.states` replaces `item-states`, `feature-states`, `portal-states`, `puzzle-states` — flat map, type-agnostic.
- `player.counters` replaces `item-counters` — flat map, `a-tag:counter-name` → integer.
- NPC `state` is first-class, not nested.
- Place inventory: absent key = not yet seeded; `{ inventory: [] }` = seeded but empty (prevents re-seeding consumed items).

---

## Client Implementation Notes

Changes requiring client code updates:

| Change | Client action |
|--------|--------------|
| `on-counter` unified | Update counter trigger handler — now always reads threshold argument |
| `inventory` on world event | Read on new game init, add items to starting inventory |
| `inventory` on NPC event | Track NPC carried items; drop on death, deposit on `deposits` action |
| `type: payment` | New payment flow — LNURL-pay → LUD-11 verify → on-complete |
| `roams-when` | Check NPC state before calculating movement position |
| Article stripping | Strip `the`/`a`/`an` from noun input before matching |
| `exit` tag reorder | Parse `["exit", place-ref, slot, label?]` — place-ref is now index 1 |
| `on-complete` | Replaces `on-solve` everywhere |
| Phase 11b a-tags | All stored keys use full `a`-tag format, not bare d-tags |
