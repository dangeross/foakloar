# FOAKLOAR Schema Changelog

All notable schema changes. Most recent first.

---

## [Unreleased] — March 2026

### Added

**`on-counter` — unified counter trigger**
Replaces `on-counter-zero` and `on-counter-low` with a single tag. Shape:
`["on-counter", "<counter>", "<threshold>", "<action-type>", "<action-target?>"]`
`0` is a valid threshold — not a special case. Three behavioural rules: threshold crossing, state entry re-evaluation, load reconciliation. See spec section 2.x counter.

**`inventory` tag on world event**
Declares starting player inventory. Given once on new game, not on reload.
`["inventory", "30078:<pubkey>:the-lake:item:scribbled-note"]`

**`inventory` tag on NPC event**
Declares items an NPC carries from spawn. Can be stolen, dropped on death, or deposited at stash. Fills the gap between `steals-item`/`deposits` (which implied NPCs hold items) and the missing declaration of what they start with.

**`type: payment` — Lightning payment gate**
New primitive. Player pays LNURL invoice; on LUD-11 verify confirmation, `on-complete` fires giving a receipt item. Uses payment-hash for local state tracking and recovery on reload. See spec section 2.7b.

**`roams-when` tag on NPC event**
NPC only roams when in the declared state. If absent, always roams. Allows movement to be activated by state transition (e.g. Sloth confined until `ally` state).

**`noun` tag with article stripping**
Client strips leading articles (`the`, `a`, `an`) from input before matching. Noun tags should never contain articles — always bare nouns.

**World event (`type: world`) fully specced**
Full manifest including: `title`, `author`, `version`, `lang`, `tag`, `cw`, `start`, `inventory`, `relay`, `collaboration`, `collaborator`, `theme`, `accent-colour`, `font`, `cursor`, `content-type`, `media`. See spec section 6.1.

**`type: payment` uses LUD-06 + LUD-11**
LUD-06 for invoice generation, LUD-11 for payment verification. No LUD-10 required.

**`cw` tag on world event**
Content warnings displayed before world loads. No enforced vocabulary.

**NIP-51 world discovery**
World lists use `kind: 30001`. Platform maintains curated list. See spec section 6.2.1.

**Extend-don't-fork guidance**
Forking discouraged. Extension (new places connecting to existing world) and new worlds preferred. See spec section 6.2.2.

**`start` tag on world event**
Points to genesis place `a`-tag. Client fetches world event, reads `start`, begins there.

**`roams-when` activates NPC movement via state transition**
Consequence can fire `set-state ally` on an NPC, causing it to start roaming its declared `route` tags.

### Changed

**`on-counter-zero` → `on-counter` with threshold `"0"`**
All existing `on-counter-zero` tags should be updated to `["on-counter", "<counter>", "0", ...]`

**`on-counter-low` → `on-counter`**
Same shape, just renamed. No other changes needed.

**`puzzle-type: payment` removed**
Replaced by `type: payment`. The payment primitive is cleaner as its own event type — not a puzzle variant.

**`requires` shape simplified — no type argument**
`["requires", "<event-ref>", "<state>", "<description>"]`
Type is inferred from the referenced event. Applies to item, npc, feature, room/place, puzzle, portal.

**`exit` tag reordered — place-ref now second**
`["exit", "<place-ref>", "<slot>", "<label?>"]`
Place-ref is second so relay `#exit` queries can index portals by place.

**`verb` tag — canonical first, aliases follow**
First value is the canonical verb used in `on-interact`. Additional values are aliases.

**`noun` tag — canonical first, aliases follow**
Same pattern as `verb`. Article stripping means tags should never contain `the`, `a`, `an`.

**`hidden: true` replaced by `state: hidden`**
Portals and features start in `state: hidden`. Revealed via `set-state visible`.

**`flag` / `set-flag` removed**
All flags are now event states. `requires` checks event state directly.

**`on-arrive` → `on-enter`**
Unified. NPC uses place `a`-tag as first argument; room uses `player`.

**`on-solve` → `on-complete`**
Unified trigger for puzzle completion, recipe combination, payment confirmation.

**`ingredient` → `requires`**
Recipe ingredients use standard `requires` shape.

**`produces` → `on-complete give-item`**
Recipe output uses standard dispatcher.

**`guards` tag removed from NPCs**
NPC-blocked portals use `requires` on the portal: `["requires", "<npc-ref>", "gone", "..."]`

**`preserves` tag removed from consequences**
Everything is preserved by default. Only declare what is `clears`ed.

**`room` → `place`**
All d-tags, type tags, and prose updated.

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
