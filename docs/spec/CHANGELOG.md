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
