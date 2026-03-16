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

// All spec-defined action types (used by on-* trigger selects)
const ACTION_TYPES = [
  'unlock', 'set-state', 'traverse', 'give-item', 'consume-item',
  'deal-damage', 'deal-damage-npc', 'heal', 'consequence',
  'steals-item', 'deposits', 'flees', 'decrement', 'increment', 'set-counter',
];

export const TAG_SCHEMAS = {
  // ── Identity tags ────────────────────────────────────────────────────────
  d:              { label: 'D-Tag', auto: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'world:type:name' }] },
  t:              { label: 'World Tag', auto: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'the-lake' }] },
  type:           { label: 'Type', auto: true, fields: [{ name: 'value', type: 'select', required: true, options: ['place', 'portal', 'item', 'feature', 'clue', 'puzzle', 'recipe', 'payment', 'npc', 'dialogue', 'consequence', 'world', 'vouch'] }] },

  // ── Display ──────────────────────────────────────────────────────────────
  title:          { label: 'Title', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'Display title' }] },
  description:    { label: 'Description', fields: [{ name: 'value', type: 'textarea', required: false, placeholder: 'Short description text' }] },
  'content-type': { label: 'Content Type', fields: [{ name: 'value', type: 'select', required: false, options: ['text/plain', 'text/markdown', 'application/nip44'] }] },

  // ── Noun & Verb ──────────────────────────────────────────────────────────
  noun: {
    label: 'Noun',
    repeatable: true,
    fields: [
      { name: 'canonical', type: 'text', required: true, placeholder: 'key' },
      { name: 'aliases', type: 'aliases', required: false, placeholder: 'iron key, rusty key' },
    ],
  },
  verb: {
    label: 'Verb',
    repeatable: true,
    fields: [
      { name: 'canonical', type: 'text', required: true, placeholder: 'examine' },
      { name: 'aliases', type: 'aliases', required: false, placeholder: 'x, look at, inspect' },
    ],
  },

  // ── State machine ────────────────────────────────────────────────────────
  state:      { label: 'Initial State', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'off' }] },
  transition: {
    label: 'Transition',
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
    repeatable: true,
    fields: [
      { name: 'name', type: 'text', required: true, placeholder: 'battery' },
      { name: 'initial', type: 'number', required: true, placeholder: '300' },
    ],
  },

  // ── Requires ─────────────────────────────────────────────────────────────
  requires: {
    label: 'Requires',
    repeatable: true,
    fields: [
      { name: 'ref', type: 'event-ref', required: true },
      { name: 'state', type: 'text', required: false, placeholder: 'state or blank' },
      { name: 'desc', type: 'text', required: false, placeholder: 'Failure message' },
    ],
  },
  'requires-not': {
    label: 'Requires Not',
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
  item:    { label: 'Item Ref', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },
  feature: { label: 'Feature Ref', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'feature' }] },
  npc:     { label: 'NPC Ref', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'npc' }] },
  clue:    { label: 'Clue Ref', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'clue' }] },

  // ── Triggers ─────────────────────────────────────────────────────────────
  'on-interact': {
    label: 'On Interact',
    repeatable: true,
    fields: [
      { name: 'verb', type: 'text', required: true, placeholder: 'examine' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false, placeholder: 'action target' },
    ],
  },
  'on-enter': {
    label: 'On Enter',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: true, placeholder: 'player' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false, placeholder: 'action target' },
    ],
  },
  'on-encounter': {
    label: 'On Encounter',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: true, placeholder: 'player' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false, placeholder: 'action target' },
    ],
  },
  'on-attacked': {
    label: 'On Attacked',
    repeatable: true,
    fields: [
      { name: 'trigger', type: 'text', required: false },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-health-zero': {
    label: 'On Health Zero',
    repeatable: true,
    fields: [
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-player-health-zero': {
    label: 'On Player Health Zero',
    repeatable: true,
    fields: [
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-move': {
    label: 'On Move',
    repeatable: true,
    fields: [
      { name: 'state-guard', type: 'text', required: false, placeholder: 'state or blank' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-counter': {
    label: 'On Counter',
    repeatable: true,
    fields: [
      { name: 'counter', type: 'text', required: true, placeholder: 'battery' },
      { name: 'threshold', type: 'number', required: true, placeholder: '0' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },
  'on-complete': {
    label: 'On Complete',
    repeatable: true,
    fields: [
      { name: 'blank', type: 'text', required: false, placeholder: '(blank)' },
      { name: 'action', type: 'select', required: true, options: ACTION_TYPES },
      { name: 'target', type: 'text', required: false },
    ],
  },

  // ── Media ────────────────────────────────────────────────────────────────
  media: {
    label: 'Media',
    repeatable: true,
    fields: [
      { name: 'mime', type: 'select', required: true, options: ['text/plain', 'text/x-ansi', 'text/markdown', 'image/url'] },
      { name: 'value', type: 'textarea', required: true, placeholder: 'Content or URL' },
    ],
  },

  // ── Dialogue ─────────────────────────────────────────────────────────────
  dialogue: {
    label: 'Dialogue Ref',
    repeatable: true,
    fields: [
      { name: 'node-ref', type: 'event-ref', required: true, eventTypeFilter: 'dialogue' },
      { name: 'requires-ref', type: 'event-ref', required: false },
      { name: 'state', type: 'text', required: false },
    ],
  },
  option: {
    label: 'Dialogue Option',
    repeatable: true,
    fields: [
      { name: 'label', type: 'text', required: true, placeholder: 'Option text' },
      { name: 'next-ref', type: 'event-ref', required: false, eventTypeFilter: 'dialogue' },
    ],
  },
  text: { label: 'Dialogue Text', fields: [{ name: 'value', type: 'textarea', required: true, placeholder: 'NPC dialogue text' }] },

  // ── Puzzle ───────────────────────────────────────────────────────────────
  'puzzle-type': { label: 'Puzzle Type', fields: [{ name: 'value', type: 'select', required: true, options: ['riddle', 'sequence', 'cipher', 'observe', 'map'] }] },
  'answer-hash': { label: 'Answer Hash', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'SHA-256 hash' }] },
  salt:          { label: 'Salt', fields: [{ name: 'value', type: 'text', required: true }] },
  ordered:       { label: 'Ordered', fields: [{ name: 'value', type: 'select', required: true, options: ['true', 'false'] }] },

  // ── NPC movement ─────────────────────────────────────────────────────────
  speed:       { label: 'Speed', fields: [{ name: 'value', type: 'number', required: true, placeholder: '3' }] },
  order:       { label: 'Order', fields: [{ name: 'value', type: 'select', required: true, options: ['sequential', 'random'] }] },
  route:       { label: 'Route', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  stash:       { label: 'Stash', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  'roams-when':{ label: 'Roams When', fields: [{ name: 'state', type: 'text', required: true }] },
  inventory:   { label: 'Inventory', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },

  // ── Combat ───────────────────────────────────────────────────────────────
  health:      { label: 'Health', fields: [{ name: 'value', type: 'number', required: true }] },
  damage:      { label: 'Damage', fields: [{ name: 'value', type: 'number', required: true }] },
  'hit-chance':{ label: 'Hit Chance', fields: [{ name: 'value', type: 'text', required: false, placeholder: '0.0-1.0' }] },

  // ── Consequence ──────────────────────────────────────────────────────────
  respawn:     { label: 'Respawn', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  clears:      { label: 'Clears', repeatable: true, fields: [{ name: 'key', type: 'select', required: true, options: ['inventory', 'states', 'counters', 'cryptoKeys', 'dialogueVisited', 'paymentAttempts', 'visited'] }] },
  consequence: { label: 'Consequence Ref', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'consequence' }] },

  // ── Payment ──────────────────────────────────────────────────────────────
  amount: { label: 'Amount', fields: [{ name: 'value', type: 'number', required: true }] },
  unit:   { label: 'Unit', fields: [{ name: 'value', type: 'select', required: true, options: ['sats', 'msats'] }] },
  lnurl:  { label: 'LNURL / Lightning Address', fields: [{ name: 'value', type: 'text', required: true, placeholder: 'user@domain.com or lnurl1...' }] },

  // ── Contains (items within items) ────────────────────────────────────────
  contains: { label: 'Contains', repeatable: true, fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'item' }] },

  // ── World ────────────────────────────────────────────────────────────────
  author:        { label: 'Author', fields: [{ name: 'value', type: 'text', required: false }] },
  version:       { label: 'Version', fields: [{ name: 'value', type: 'text', required: false, placeholder: '1.0.0' }] },
  lang:          { label: 'Language', fields: [{ name: 'value', type: 'select', required: false, options: ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru'] }] },
  tag:           { label: 'Genre Tag', repeatable: true, fields: [{ name: 'value', type: 'text', required: true, placeholder: 'fantasy' }] },
  cw:            { label: 'Content Warning', repeatable: true, fields: [{ name: 'value', type: 'text', required: true }] },
  start:         { label: 'Start Place', fields: [{ name: 'ref', type: 'event-ref', required: true, eventTypeFilter: 'place' }] },
  relay:         { label: 'Relay', repeatable: true, fields: [{ name: 'url', type: 'text', required: true, placeholder: 'wss://...' }] },
  collaboration: { label: 'Collaboration', fields: [{ name: 'value', type: 'select', required: true, options: ['closed', 'vouched', 'open'] }] },
  collaborator:  { label: 'Collaborator', repeatable: true, fields: [{ name: 'pubkey', type: 'text', required: true, placeholder: 'hex pubkey' }] },
  theme:         { label: 'Theme', fields: [{ name: 'value', type: 'select', required: false, options: ['terminal-green', 'amber-crt', 'frost', 'parchment', 'obsidian', 'blood-moon'] }] },
  colour:        { label: 'Colour Override', repeatable: true, fields: [{ name: 'slot', type: 'select', required: true, options: ['bg', 'text', 'title', 'dim', 'highlight', 'error', 'item', 'npc', 'clue', 'puzzle', 'exits'] }, { name: 'hex', type: 'text', required: true, placeholder: '#00ff41' }] },
  font:          { label: 'Font', fields: [{ name: 'value', type: 'text', required: false }] },
  cursor:        { label: 'Cursor', fields: [{ name: 'value', type: 'select', required: false, options: ['block', 'underline', 'beam'] }] },
  puzzle:        { label: 'Puzzle NIP-44', fields: [{ name: 'ref', type: 'text', required: true, placeholder: 'puzzle d-tag for NIP-44' }] },
};

/** Which tags are valid for each event type */
export const TAGS_BY_EVENT_TYPE = {
  place:       ['title', 'content-type', 'exit', 'item', 'feature', 'npc', 'clue', 'noun', 'requires', 'requires-not', 'on-enter', 'media', 'cw'],
  portal:      ['exit', 'state', 'transition', 'requires', 'requires-not', 'consequence', 'cw'],
  item:        ['title', 'noun', 'verb', 'description', 'state', 'transition', 'on-interact', 'on-move', 'on-counter', 'counter', 'contains', 'requires', 'requires-not', 'damage', 'hit-chance', 'media'],
  feature:     ['title', 'noun', 'verb', 'description', 'state', 'transition', 'on-interact', 'on-counter', 'counter', 'contains', 'requires', 'requires-not', 'media'],
  clue:        ['title', 'noun', 'state', 'transition', 'content-type', 'requires', 'requires-not', 'media', 'puzzle'],
  puzzle:      ['puzzle-type', 'answer-hash', 'salt', 'ordered', 'requires', 'on-complete', 'content-type'],
  recipe:      ['state', 'transition', 'requires', 'on-complete', 'ordered'],
  payment:     ['title', 'description', 'amount', 'unit', 'lnurl', 'on-complete'],
  npc:         ['title', 'noun', 'verb', 'description', 'state', 'transition', 'dialogue', 'on-interact', 'on-encounter', 'on-attacked', 'on-health-zero', 'on-enter', 'speed', 'order', 'route', 'stash', 'roams-when', 'inventory', 'health', 'damage', 'hit-chance', 'requires', 'requires-not'],
  dialogue:    ['text', 'option', 'requires', 'requires-not', 'on-enter'],
  consequence: ['respawn', 'clears'],
  world:       ['title', 'author', 'version', 'lang', 'tag', 'cw', 'start', 'inventory', 'relay', 'collaboration', 'collaborator', 'theme', 'colour', 'font', 'cursor', 'content-type', 'media'],
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
