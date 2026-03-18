/**
 * tagSchema.js — Declarative schema for all NOSTR dungeon event tag shapes.
 *
 * Drives the TagEditor component. Adding a new tag type to the spec means
 * adding one entry to TAG_SCHEMAS and optionally updating TAGS_BY_EVENT_TYPE.
 *
 * Field types:
 *   'text'      — single-line string input
 *   'textarea'  — multi-line text input
 *   'select'    — dropdown from fixed options
 *   'event-ref' — searchable dropdown of known events, filterable by eventTypeFilter
 *   'number'    — numeric input
 *   'aliases'   — comma-separated aliases that expand into additional tag elements
 */

// All spec-defined action types (used as fallback for on-* trigger selects)
const ACTION_TYPES = [
  'set-state', 'traverse', 'give-item', 'consume-item',
  'deal-damage', 'deal-damage-npc', 'heal', 'consequence',
  'steals-item', 'deposits', 'flees', 'decrement', 'increment', 'set-counter',
];

// Trigger × Action compatibility matrix from spec
// Each trigger only shows its valid action types in the dropdown
export const TRIGGER_ACTIONS = {
  'on-interact':           ['set-state', 'give-item', 'consume-item', 'traverse', 'deal-damage', 'deal-damage-npc', 'heal', 'consequence', 'decrement', 'increment', 'set-counter'],
  'on-complete':           ['set-state', 'give-item', 'consume-item', 'traverse', 'heal', 'consequence', 'decrement', 'increment', 'set-counter'],
  'on-enter':              ['set-state', 'give-item', 'deal-damage', 'consequence', 'decrement', 'increment', 'set-counter'],
  'on-encounter':          ['set-state', 'deal-damage', 'consequence', 'steals-item', 'deposits', 'flees', 'decrement'],
  'on-attacked':           ['set-state', 'deal-damage', 'deal-damage-npc', 'consequence', 'steals-item', 'flees'],
  'on-health-zero':        ['set-state', 'give-item', 'consequence', 'deposits'],
  'on-player-health-zero': ['set-state', 'traverse', 'consequence'],
  'on-move':               ['set-state', 'deal-damage', 'consequence', 'decrement', 'increment', 'set-counter'],
  'on-counter':            ['set-state', 'give-item', 'deal-damage', 'heal', 'consequence'],
};

/**
 * Dynamic target field overrides based on selected action type.
 * When a trigger tag has an 'action' select, the 'target' field adapts.
 * Each entry defines the field type, placeholder, and optional filters.
 */
export const ACTION_TARGET_FIELD = {
  'set-state':      { type: 'text', placeholder: 'state name (e.g. open, lit, dead)', hidesEventRef: false },
  'traverse':       { type: 'event-ref', placeholder: 'portal to traverse', eventTypeFilter: 'portal', hidesEventRef: true },
  'give-item':      { type: 'event-ref', placeholder: 'item to give', eventTypeFilter: 'item', hidesEventRef: true },
  'consume-item':   { type: 'event-ref', placeholder: 'item to consume', eventTypeFilter: 'item', hidesEventRef: true },
  'steals-item':    { type: 'event-ref', placeholder: 'item to steal', eventTypeFilter: 'item', hidesEventRef: true },
  'deal-damage':    { type: 'number', placeholder: 'damage amount', hidesEventRef: true },
  'deal-damage-npc':{ type: 'event-ref', placeholder: 'target NPC (blank = current)', eventTypeFilter: 'npc', hidesEventRef: true },
  'heal':           { type: 'number', placeholder: 'heal amount', hidesEventRef: true },
  'consequence':    { type: 'event-ref', placeholder: 'consequence event', eventTypeFilter: 'consequence', hidesEventRef: true },
  'decrement':      { type: 'text', placeholder: 'counter name', hidesEventRef: true },
  'increment':      { type: 'text', placeholder: 'counter name', hidesEventRef: true },
  'set-counter':    { type: 'text', placeholder: 'counter:value (e.g. battery:100)', hidesEventRef: true },
  'deposits':       { type: 'text', placeholder: '(blank)', hidesEventRef: true },
  'flees':          { type: 'text', placeholder: '(blank)', hidesEventRef: true },
};

/** Short descriptions for each event type — shown at the top of the editor */
export const EVENT_TYPE_DESCRIPTIONS = {
  place:       'A location in the world. Players move between places via portals. Add exits, features, items, and NPCs.',
  portal:      'A connection between two places. Declares direction slots and optional requirements for passage.',
  item:        'Something the player can pick up and carry. Declare verbs for how it can be used.',
  feature:     'An interactive object in a place. Can change state when the player uses verbs on it.',
  clue:        'Information revealed to the player. Often starts hidden and becomes visible through interaction.',
  puzzle:      'A challenge the player must solve. Riddles require typed answers; sequences auto-complete from state changes.',
  recipe:      'Defines how items combine to produce a new item. Player types the crafting verb to initiate.',
  payment:     'A Lightning payment gate. Player pays an invoice to unlock passage or receive an item.',
  npc:         'A character in the world. Can have dialogue, combat stats, inventory, and roaming routes.',
  dialogue:    'A single dialogue node — NPC spoken text with player choice options.',
  consequence: 'A reusable outcome (death, victory, curse). Fires respawn, clears state, gives/removes items.',
  world:       'The world manifest. Sets title, theme, starting place, player health, and collaboration mode.',
  vouch:       'A trust declaration — vouches for another author\'s content in this world.',
  quest:       'A named goal with completion conditions. Shows progress in the quest log.',
};

export const TAG_SCHEMAS = {
  // ── Identity tags ────────────────────────────────────────────────────────
  d:              { label: 'D-Tag', desc: 'Unique identifier for this event (auto-generated)', auto: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'world:type:name' }] },
  t:              { label: 'World Tag', desc: 'World this event belongs to (auto-set)', auto: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'the-lake' }] },
  type:           { label: 'Type', desc: 'Event type (auto-set from editor)', auto: true, fields: [{ name: 'value', type: 'select', required: true, options: ['place', 'portal', 'item', 'feature', 'clue', 'puzzle', 'recipe', 'payment', 'npc', 'dialogue', 'consequence', 'world', 'vouch', 'quest'] }] },
  w:              { label: 'Protocol', desc: 'Protocol identifier for relay discovery (auto-set on world events)', auto: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'foakloar' }] },

  // ── Display ──────────────────────────────────────────────────────────────
  title:          { label: 'Title', desc: 'Display name shown to the player', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'Display title' }] },
  'content-type': {
    label: 'Content Type',
    desc: 'How the content body is formatted (plain text, markdown, or NIP-44 encrypted)',
    fields: [
      { name: 'value', type: 'select', required: false, options: ['text/plain', 'text/markdown', 'application/nip44'] },
      { name: 'plaintext-format', type: 'select', required: false, options: ['', 'text/plain', 'text/markdown'], placeholder: 'Plaintext format (for NIP-44)' },
    ],
  },

  // ── Noun & Verb ──────────────────────────────────────────────────────────
  noun: {
    label: 'Noun',
    desc: 'Word the player types to refer to this thing, plus aliases',
    repeatable: true,
    fields: [
      { name: 'canonical', type: 'text', required: true, placeholder: 'key' },
      { name: 'aliases', type: 'aliases', required: false, placeholder: 'iron key, rusty key' },
    ],
  },
  verb: {
    label: 'Verb',
    desc: 'Custom verb the player can use on this thing, plus aliases',
    repeatable: true,
    fields: [
      { name: 'canonical', type: 'text', required: true, placeholder: 'examine' },
      { name: 'aliases', type: 'aliases', required: false, placeholder: 'x, look at, inspect' },
    ],
  },

  // ── State machine ────────────────────────────────────────────────────────
  state:      { label: 'Initial State', desc: 'Starting state for this entity\'s state machine', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'off' }] },
  transition: {
    label: 'Transition',
    desc: 'State change rule: from → to, with optional text shown to player',
    repeatable: true,
    fields: [
      { name: 'from', type: 'text', required: true, placeholder: 'from state' },
      { name: 'to', type: 'text', required: true, placeholder: 'to state' },
      { name: 'text', type: 'text', required: false, placeholder: 'Transition text shown to player' },
    ],
  },

  // ── Counter ──────────────────────────────────────────────────────────────
  counter: {
    label: 'Counter',
    desc: 'Named numeric value that can be incremented/decremented by triggers',
    repeatable: true,
    fields: [
      { name: 'name', type: 'text', required: true, placeholder: 'battery' },
      { name: 'initial', type: 'number', required: true, placeholder: '300' },
    ],
  },

  // ── Requires ─────────────────────────────────────────────────────────────
  requires: {
    label: 'Requires',
    desc: 'Gate: player must hold/have this item or feature in the given state',
    repeatable: true,
    fields: [
      { name: 'ref', type: 'event-ref', required: true },
      { name: 'state', type: 'text', required: false, placeholder: 'state or blank' },
      { name: 'desc', type: 'text', required: false, placeholder: 'Failure message' },
    ],
  },
  'requires-not': {
    label: 'Requires Not',
    desc: 'Gate: player must NOT hold/have this item or feature in the given state',
    repeatable: true,
    fields: [
      { name: 'ref', type: 'event-ref', required: true },
      { name: 'state', type: 'text', required: false, placeholder: 'state or blank' },
      { name: 'desc', type: 'text', required: false, placeholder: 'Failure message' },
    ],
  },

  // ── Exit (place variant: slot-only; portal variant: place-ref + slot + label) ─
  exit: {
    label: 'Exit',
    desc: 'Direction slot (on places) or connection to a destination place (on portals)',
    repeatable: true,
    variants: {
      place: {
        fields: [{ name: 'slot', type: 'text', required: true, placeholder: 'north' }],
      },
      portal: {
        fields: [
          { name: 'place-ref', type: 'event-ref', required: true, eventTypeFilter: 'place' },
          { name: 'slot', type: 'text', required: true, placeholder: 'north' },
          { name: 'label', type: 'text', required: false, placeholder: 'A dark passage leads north...' },
        ],
      },
    },
  },

  // ── Entity references (on places) ────────────────────────────────────────
  item:    { label: 'Item Ref', desc: 'Place an item in this location', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },
  feature: { label: 'Feature Ref', desc: 'Place an interactive feature in this location', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'feature' }] },
  npc:     { label: 'NPC Ref', desc: 'Place an NPC in this location', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'npc' }] },
  clue:    { label: 'Clue Ref', desc: 'Place a clue in this location', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'clue' }] },

  // ── Triggers ─────────────────────────────────────────────────────────────
  'on-interact': {
    label: 'On Interact',
    desc: 'Fires an action when the player uses a verb on this entity',
    repeatable: true,
    fields: [
      { name: 'verb', type: 'text', required: true, placeholder: 'verb (e.g. examine, pull, insert)' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-interact'] },
      { name: 'target', type: 'text', required: false, placeholder: 'action target (state, amount, etc.)' },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-enter': {
    label: 'On Enter',
    desc: 'Fires an action when the player enters this place or encounters this NPC',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: true, placeholder: 'player' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-enter'] },
      { name: 'target', type: 'text', required: false, placeholder: 'action target' },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-encounter': {
    label: 'On Encounter',
    desc: 'Fires an action when the player first meets this NPC in a room',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: true, placeholder: 'player' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-encounter'] },
      { name: 'target', type: 'text', required: false, placeholder: 'action target' },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-attacked': {
    label: 'On Attacked',
    desc: 'Fires an action when this NPC is attacked by the player',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: false },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-attacked'] },
      { name: 'target', type: 'text', required: false },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-health-zero': {
    label: 'On Health Zero',
    desc: 'Fires an action when this NPC\'s health reaches zero (defeated)',
    repeatable: true,
    fields: [
      { name: 'blank', type: 'text', required: false, placeholder: '(blank)' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-health-zero'] },
      { name: 'target', type: 'text', required: false, placeholder: 'state or target' },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-player-health-zero': {
    label: 'On Player Health Zero',
    desc: 'Fires an action when the player\'s health reaches zero (death consequence)',
    repeatable: true,
    fields: [
      { name: 'blank', type: 'text', required: false, placeholder: '(blank)' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-player-health-zero'] },
      { name: 'target', type: 'text', required: false, placeholder: 'consequence ref or state' },
    ],
  },
  'on-move': {
    label: 'On Move',
    desc: 'Fires an action each time the player moves while holding this item',
    repeatable: true,
    fields: [
      { name: 'state-guard', type: 'text', required: false, placeholder: 'state or blank' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-move'] },
      { name: 'target', type: 'text', required: false },
      { name: 'event-ref', type: 'event-ref', required: false, placeholder: 'target event (blank = self)' },
    ],
  },
  'on-counter': {
    label: 'On Counter',
    desc: 'Fires an action when a counter crosses a threshold in the declared direction',
    repeatable: true,
    fields: [
      { name: 'direction', type: 'select', required: true, options: ['down', 'up'] },
      { name: 'counter', type: 'text', required: true, placeholder: 'battery' },
      { name: 'threshold', type: 'number', required: true, placeholder: '0' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-counter'] },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-complete': {
    label: 'On Complete',
    desc: 'Fires an action when a puzzle or recipe is completed',
    repeatable: true,
    fields: [
      { name: 'blank', type: 'text', required: false, placeholder: '(blank)' },
      { name: 'action', type: 'select', required: true, options: TRIGGER_ACTIONS['on-complete'] },
      { name: 'target', type: 'text', required: false },
    ],
  },

  // ── Media ────────────────────────────────────────────────────────────────
  media: {
    label: 'Media',
    desc: 'Embedded content block: ANSI art, markdown, or image URL',
    repeatable: true,
    fields: [
      { name: 'mime', type: 'select', required: true, options: ['text/plain', 'text/x-ansi', 'text/markdown', 'image/url'] },
      { name: 'value', type: 'textarea', required: true, placeholder: 'Content or URL' },
    ],
  },

  // ── Dialogue ─────────────────────────────────────────────────────────────
  dialogue: {
    label: 'Dialogue Ref',
    desc: 'Link to a dialogue node, optionally gated by a requires condition',
    repeatable: true,
    fields: [
      { name: 'node-ref', type: 'event-ref', required: true, eventTypeFilter: 'dialogue' },
      { name: 'requires-ref', type: 'event-ref', required: false },
      { name: 'state', type: 'text', required: false },
    ],
  },
  option: {
    label: 'Dialogue Option',
    desc: 'A choice the player can select during dialogue',
    repeatable: true,
    fields: [
      { name: 'label', type: 'text', required: true, placeholder: 'Option text' },
      { name: 'next-ref', type: 'event-ref', required: false, eventTypeFilter: 'dialogue' },
    ],
  },
  text: { label: 'Dialogue Text', desc: 'The NPC\'s spoken text in this dialogue node', fields: [{ name: 'value', type: 'textarea', required: true, placeholder: 'NPC dialogue text' }] },

  // ── Puzzle ───────────────────────────────────────────────────────────────
  'puzzle-type': { label: 'Puzzle Type', desc: 'Category of puzzle mechanic', fields: [{ name: 'value', type: 'select', required: true, options: ['riddle', 'sequence', 'cipher'] }] },
  'answer-hash': { label: 'Answer Hash', desc: 'SHA-256 hash of (salt + answer) — keeps the answer secret on relays', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'SHA-256 hash' }] },
  salt:          { label: 'Salt', desc: 'Random salt prepended to the answer before hashing', fields: [{ name: 'value', type: 'text', required: true }] },
  ordered:       { label: 'Ordered', desc: 'Whether sequence puzzle steps must be completed in order', fields: [{ name: 'value', type: 'select', required: true, options: ['true', 'false'] }] },

  // ── NPC movement ─────────────────────────────────────────────────────────
  speed:       { label: 'Speed', desc: 'Moves every N player turns', fields: [{ name: 'value', type: 'number', required: true, placeholder: '3' }] },
  order:       { label: 'Order', desc: 'Route traversal order: sequential or random', fields: [{ name: 'value', type: 'select', required: true, options: ['sequential', 'random'] }] },
  route:       { label: 'Route', desc: 'A place this NPC visits when roaming', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  stash:       { label: 'Stash', desc: 'Place where the NPC deposits stolen items', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  'roams-when':{ label: 'Roams When', desc: 'NPC only roams when in this state', fields: [{ name: 'state', type: 'text', required: true }] },
  inventory:   { label: 'Inventory', desc: 'Item the NPC starts with or can carry', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },

  // ── Combat ───────────────────────────────────────────────────────────────
  health:       { label: 'Health', desc: 'Hit points (NPC or player starting health on world event)', fields: [{ name: 'value', type: 'number', required: true }] },
  'max-health': { label: 'Max Health', desc: 'Maximum hit points (world event — player health ceiling)', fields: [{ name: 'value', type: 'number', required: true }] },
  damage:       { label: 'Damage', desc: 'Damage dealt per hit (NPC or weapon item)', fields: [{ name: 'value', type: 'number', required: true }] },
  'hit-chance': { label: 'Hit Chance', desc: 'Probability of landing a hit (0.0–1.0)', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.0-1.0' }] },

  // ── Consequence ──────────────────────────────────────────────────────────
  respawn:     { label: 'Respawn', desc: 'Place the player respawns at after this consequence', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  clears:      { label: 'Clears', desc: 'Player state category to wipe on consequence (e.g. inventory, states)', repeatable: true, fields: [{ name: 'key', type: 'select', required: true, options: ['inventory', 'states', 'counters', 'cryptoKeys', 'dialogueVisited', 'paymentAttempts', 'visited'] }] },
  consequence: { label: 'Consequence Ref', desc: 'Link to a consequence event triggered on portal traversal', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'consequence' }] },

  // ── Payment ──────────────────────────────────────────────────────────────
  amount: { label: 'Amount', desc: 'Lightning payment amount', fields: [{ name: 'value', type: 'number', required: true }] },
  unit:   { label: 'Unit', desc: 'Payment denomination: sats or msats', fields: [{ name: 'value', type: 'select', required: true, options: ['sats', 'msats'] }] },
  lnurl:  { label: 'LNURL / Lightning Address', desc: 'Lightning address or LNURL for receiving payment', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'user@domain.com or lnurl1...' }] },

  // ── Contains (items within items) ────────────────────────────────────────
  contains: { label: 'Contains', desc: 'Item found inside this item when examined', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },

  // ── Consequence-level tags (direct on consequence events) ──────────────
  'give-item':    { label: 'Give Item', desc: 'Add this item to the player\'s inventory', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },
  'consume-item': { label: 'Consume Item', desc: 'Remove this item from the player\'s inventory', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },
  'deal-damage':  { label: 'Deal Damage', desc: 'Damage dealt to the player by this consequence', fields: [{ name: 'value', type: 'number', required: true, placeholder: '10' }] },

  // ── Vouch ──────────────────────────────────────────────────────────────
  pubkey:     { label: 'Pubkey', desc: 'Hex public key of the person being vouched for', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'hex pubkey' }] },
  scope:      { label: 'Scope', desc: 'What this vouch permits: portals only, places, or everything', fields: [{ name: 'value', type: 'select', required: true, options: ['portal', 'place', 'all'] }] },
  'can-vouch':{ label: 'Can Vouch', desc: 'Whether the vouched person can vouch for others', fields: [{ name: 'value', type: 'select', required: true, options: ['true', 'false'] }] },

  // ── Quest ──────────────────────────────────────────────────────────────
  involves:   { label: 'Involves', desc: 'Event that is part of this quest', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true }] },

  // ── World ────────────────────────────────────────────────────────────────
  author:        { label: 'Author', desc: 'Display name of the world author', fields: [{ name: 'value', type: 'text', required: false }] },
  version:       { label: 'Version', desc: 'Semantic version of the world', fields: [{ name: 'value', type: 'text', required: false, placeholder: '1.0.0' }] },
  lang:          { label: 'Language', desc: 'Primary language of the world content', fields: [{ name: 'value', type: 'select', required: false, options: ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru'] }] },
  tag:           { label: 'Genre Tag', desc: 'Genre or theme tag for discovery (e.g. fantasy, horror)', repeatable: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'fantasy' }] },
  cw:            { label: 'Content Warning', desc: 'Warning shown before entering (e.g. violence, horror)', repeatable: true, fields: [{ name: 'value', type: 'text', required: true }] },
  start:         { label: 'Start Place', desc: 'The place where new players begin', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  relay:         { label: 'Relay', desc: 'Nostr relay URL where world events are published', repeatable: true, fields: [{ name: 'url', type: 'text', required: true, placeholder: 'wss://...' }] },
  collaboration: { label: 'Collaboration', desc: 'Who can contribute: closed, vouched (invite-only), or open', fields: [{ name: 'value', type: 'select', required: true, options: ['closed', 'vouched', 'open'] }] },
  collaborator:  { label: 'Collaborator', desc: 'Hex pubkey of a trusted co-author', repeatable: true, fields: [{ name: 'pubkey', type: 'text', required: true, placeholder: 'hex pubkey' }] },
  theme:         { label: 'Theme', desc: 'Visual theme preset for the client', fields: [{ name: 'value', type: 'select', required: false, options: ['terminal-green', 'parchment', 'void-blue', 'blood-red', 'monochrome', 'custom'] }] },
  colour:        { label: 'Colour Override', desc: 'Override a specific theme colour slot with a hex value', repeatable: true, fields: [{ name: 'slot', type: 'select', required: true, options: ['bg', 'text', 'title', 'dim', 'highlight', 'error', 'item', 'npc', 'clue', 'puzzle', 'exits'] }, { name: 'hex', type: 'text', required: true, placeholder: '#00ff41' }] },
  font:          { label: 'Font', desc: 'Preferred font for the client', fields: [{ name: 'value', type: 'select', required: false, options: ['ibm-plex-mono', 'courier', 'pixel', 'arcade', 'serif'] }] },
  cursor:        { label: 'Cursor', desc: 'Input cursor style: block, underline, or beam', fields: [{ name: 'value', type: 'select', required: false, options: ['block', 'underline', 'beam'] }] },
  effects:       { label: 'Effect Bundle', desc: 'Visual effect preset (defaults from theme if absent)', fields: [{ name: 'value', type: 'select', required: false, options: ['crt', 'static', 'typewriter', 'clean', 'none'] }] },
  scanlines:     { label: 'Scanlines', desc: 'Scanline intensity override (0.0–1.0)', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.35' }] },
  glow:          { label: 'Glow', desc: 'Phosphor glow intensity override (0.0–1.0)', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.4' }] },
  flicker:       { label: 'Flicker', desc: 'Screen flicker override', fields: [{ name: 'value', type: 'select', required: false, options: ['on', 'off'] }] },
  vignette:      { label: 'Vignette', desc: 'Edge vignette intensity override (0.0–1.0)', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.6' }] },
  noise:         { label: 'Noise', desc: 'Grain/static overlay intensity (0.0–1.0)', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.3' }] },
  puzzle:        { label: 'Puzzle NIP-44', desc: 'D-tag of the puzzle whose key decrypts NIP-44 content', fields: [{ name: 'ref', type: 'text', required: true, placeholder: 'puzzle d-tag for NIP-44' }] },
};

/** Which tags are valid for each event type */
export const TAGS_BY_EVENT_TYPE = {
  place:       ['title', 'content-type', 'exit', 'item', 'feature', 'npc', 'clue', 'noun', 'state', 'transition', 'requires', 'requires-not', 'on-enter', 'on-player-health-zero', 'media', 'cw', 'puzzle'],
  portal:      ['title', 'exit', 'state', 'transition', 'requires', 'requires-not', 'consequence', 'cw'],
  item:        ['title', 'noun', 'verb', 'state', 'transition', 'on-interact', 'on-move', 'on-counter', 'counter', 'contains', 'requires', 'requires-not', 'damage', 'hit-chance', 'media'],
  feature:     ['title', 'noun', 'verb', 'state', 'transition', 'on-interact', 'on-counter', 'counter', 'contains', 'requires', 'requires-not', 'media'],
  clue:        ['title', 'noun', 'state', 'transition', 'content-type', 'requires', 'requires-not', 'media', 'puzzle'],
  puzzle:      ['puzzle-type', 'answer-hash', 'salt', 'ordered', 'requires', 'on-complete', 'content-type'],
  recipe:      ['title', 'noun', 'verb', 'state', 'transition', 'requires', 'on-complete', 'ordered'],
  payment:     ['title', 'amount', 'unit', 'lnurl', 'on-complete'],
  npc:         ['title', 'noun', 'verb', 'state', 'transition', 'dialogue', 'on-interact', 'on-encounter', 'on-attacked', 'on-health-zero', 'on-player-health-zero', 'on-enter', 'on-move', 'on-counter', 'counter', 'speed', 'order', 'route', 'stash', 'roams-when', 'inventory', 'health', 'damage', 'hit-chance', 'requires', 'requires-not'],
  dialogue:    ['text', 'option', 'requires', 'requires-not', 'on-enter'],
  consequence: ['respawn', 'clears', 'give-item', 'consume-item', 'deal-damage'],
  world:       ['title', 'author', 'version', 'lang', 'tag', 'cw', 'start', 'inventory', 'relay', 'collaboration', 'collaborator', 'health', 'max-health', 'on-player-health-zero', 'theme', 'colour', 'font', 'cursor', 'effects', 'scanlines', 'glow', 'flicker', 'vignette', 'noise', 'content-type', 'media', 'w'],
  vouch:       ['pubkey', 'scope', 'can-vouch'],
  quest:       ['title', 'involves', 'requires', 'requires-not', 'on-complete'],
};

/**
 * Get the resolved fields for a tag, handling variants.
 * @param {string} tagName
 * @param {string} eventType - parent event type (for variant resolution)
 * @returns {{ fields: Array, repeatable: boolean, label: string } | null}
 */
export function getTagSchema(tagName, eventType) {
  const schema = TAG_SCHEMAS[tagName];
  if (!schema) return null;

  if (schema.variants) {
    const variant = schema.variants[eventType] || schema.variants.place;
    return { ...schema, fields: variant.fields, repeatable: variant.repeatable ?? schema.repeatable };
  }

  return schema;
}

/**
 * Convert a tag schema field set + values to a tag array.
 * @param {string} tagName
 * @param {Object} values - field name -> value
 * @param {Array} fields - field definitions
 * @returns {string[]} - the tag array e.g. ["exit", "north"]
 */
export function valuesToTag(tagName, values, fields) {
  const tag = [tagName];
  for (const field of fields) {
    if (field.type === 'aliases') {
      // Aliases expand: comma-separated values become additional tag elements
      const raw = values[field.name] || '';
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      tag.push(...parts);
    } else {
      tag.push(values[field.name] ?? '');
    }
  }
  return tag;
}

/**
 * Parse a tag array back into field values.
 * @param {string[]} tag - e.g. ["exit", "north"]
 * @param {Array} fields
 * @returns {Object} - field name -> value
 */
export function tagToValues(tag, fields) {
  const values = {};
  let idx = 1; // skip tag name at [0]
  for (const field of fields) {
    if (field.type === 'aliases') {
      // All remaining elements are aliases
      values[field.name] = tag.slice(idx).join(', ');
      break;
    } else {
      values[field.name] = tag[idx] ?? '';
      idx++;
    }
  }
  return values;
}
