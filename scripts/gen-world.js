#!/usr/bin/env node
/**
 * gen-world.js — Synthetic world generator for scaling tests.
 *
 * Generates a valid foakloar world JSON importable via the builder.
 * Places are arranged in a W×H grid connected by cardinal exits.
 * Items, NPCs, and recipes are distributed across the grid.
 *
 * Usage:
 *   node scripts/gen-world.js [options]
 *
 * Options:
 *   --width  N      Grid width  (default: 10)
 *   --height N      Grid height (default: 10)
 *   --items  N      Number of items to scatter (default: 20)
 *   --npcs   N      Number of NPCs to place    (default: 10)
 *   --recipes N     Number of craft recipes     (default: 5)
 *   --slug   NAME   World slug (default: stress-test)
 *   --out    FILE   Output path (default: docs/worlds/<slug>.json)
 *
 * Example — 400-event world (~Colossal Cave scale):
 *   node scripts/gen-world.js --width 14 --height 14 --items 60 --npcs 30 --recipes 10
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
}

const WIDTH    = parseInt(getArg('width',   '10'), 10);
const HEIGHT   = parseInt(getArg('height',  '10'), 10);
const N_ITEMS  = parseInt(getArg('items',   '20'), 10);
const N_NPCS   = parseInt(getArg('npcs',    '10'), 10);
const N_RECIPES= parseInt(getArg('recipes',  '5'), 10);
const SLUG     = getArg('slug', 'stress-test');
const OUT      = getArg('out', resolve(__dirname, `../docs/worlds/${SLUG}.json`));
const PUBKEY   = '<PUBKEY>';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ref = (dtag) => `30078:${PUBKEY}:${dtag}`;
const dref = (dtag) => `30078:${PUBKEY}:${SLUG}:${dtag}`;

let _seed = 42;
function rand(n) { _seed = (_seed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(_seed) % n; }
function pick(arr) { return arr[rand(arr.length)]; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const ROOM_NAMES = [
  'Cavern', 'Passage', 'Chamber', 'Hall', 'Tunnel', 'Vault', 'Alcove',
  'Grotto', 'Shaft', 'Gallery', 'Nave', 'Atrium', 'Crypt', 'Foyer',
  'Rotunda', 'Annex', 'Alcove', 'Recess', 'Corridor', 'Antechamber',
];
const ADJECTIVES = [
  'Dark', 'Narrow', 'Wet', 'Dusty', 'Echoing', 'Forgotten', 'Ancient',
  'Crumbling', 'Vast', 'Low', 'Winding', 'Hidden', 'Stone', 'Mossy',
];
const ITEM_NAMES = [
  'lantern', 'key', 'rope', 'coin', 'gem', 'axe', 'torch', 'map',
  'scroll', 'flask', 'dagger', 'crown', 'ring', 'shard', 'orb',
  'compass', 'lens', 'seal', 'token', 'amulet', 'rune', 'vial',
  'cog', 'lever', 'spool', 'crystal', 'disk', 'hook', 'lock', 'pin',
];
const NPC_NAMES = [
  'guard', 'merchant', 'ghost', 'troll', 'sprite', 'hermit', 'oracle',
  'golem', 'thief', 'wizard', 'wanderer', 'sentinel', 'shade', 'imp',
];

// ── Build events ─────────────────────────────────────────────────────────────

const events = [];

// Place IDs: row*WIDTH + col → "place-RxC"
function placeId(r, c) { return `${SLUG}:place:r${r}c${c}`; }

// 1. World event
const startDtag = placeId(0, 0);
events.push({
  kind: 30078,
  tags: [
    ['d', `${SLUG}:world`],
    ['t', SLUG],
    ['type', 'world'],
    ['title', `Stress Test ${WIDTH}×${HEIGHT}`],
    ['author', 'gen-world.js'],
    ['version', '1.0.0'],
    ['lang', 'en'],
    ['collaboration', 'closed'],
    ['w', 'foakloar'],
    ['start', ref(startDtag)],
    ['counter', 'moves', '0'],
    ['on-move', '', 'increment', 'moves'],
    ['hud', 'Moves: {{moves}}'],
  ],
  content: `A synthetic world generated for scaling tests. ${WIDTH * HEIGHT} rooms, ${N_ITEMS} items, ${N_NPCS} NPCs, ${N_RECIPES} recipes.`,
});

// 2. Places — W×H grid
const usedNames = new Set();
function uniqueName() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = `${pick(ADJECTIVES)} ${pick(ROOM_NAMES)}`;
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return `Room ${usedNames.size}`;
}

for (let r = 0; r < HEIGHT; r++) {
  for (let c = 0; c < WIDTH; c++) {
    const dtag = placeId(r, c);
    const name = uniqueName();
    const tags = [
      ['d', dtag],
      ['t', SLUG],
      ['type', 'place'],
      ['title', name],
    ];

    // Cardinal exits to adjacent grid cells
    if (r > 0)          tags.push(['exit', ref(placeId(r - 1, c)), 'north', '']);
    if (r < HEIGHT - 1) tags.push(['exit', ref(placeId(r + 1, c)), 'south', '']);
    if (c > 0)          tags.push(['exit', ref(placeId(r, c - 1)), 'west',  '']);
    if (c < WIDTH - 1)  tags.push(['exit', ref(placeId(r, c + 1)), 'east',  '']);

    events.push({
      kind: 30078,
      tags,
      content: `You are in the ${name.toLowerCase()}. Passages lead in several directions.`,
    });
  }
}

// 3. Items — scatter across random places
const usedItems = new Set();
function uniqueItem() {
  const available = ITEM_NAMES.filter((n) => !usedItems.has(n));
  if (available.length === 0) return `item-${usedItems.size}`;
  const n = pick(available); usedItems.add(n); return n;
}

const itemDtags = [];
for (let i = 0; i < N_ITEMS; i++) {
  const name = uniqueItem();
  const dtag = `${SLUG}:item:${name}-${i}`;
  itemDtags.push(dtag);

  const hasCounter = i % 4 === 0; // every 4th item gets a counter + on-move decrement
  const tags = [
    ['d', dtag],
    ['t', SLUG],
    ['type', 'item'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ['noun', name],
    ['state', 'unused'],
    ['transition', 'unused', 'used', `You use the ${name}.`],
    ['on-interact', 'use', '', 'set-state', 'used'],
  ];
  if (hasCounter) {
    tags.push(['counter', 'charge', '10']);
    tags.push(['on-move', 'unused', 'decrement', 'charge']);
  }

  // Place the item in a random room
  const r = rand(HEIGHT), c = rand(WIDTH);
  const placeEvent = events.find((e) => e.tags.find((t) => t[0] === 'd')?.[1] === placeId(r, c));
  if (placeEvent) placeEvent.tags.push(['item', ref(dtag)]);

  events.push({ kind: 30078, tags, content: `A ${name} of unclear purpose.` });
}

// 4. NPCs — place in random rooms
for (let i = 0; i < N_NPCS; i++) {
  const name = `${pick(NPC_NAMES)}-${i}`;
  const dtag = `${SLUG}:npc:${name}`;
  const r = rand(HEIGHT), c = rand(WIDTH);
  const tags = [
    ['d', dtag],
    ['t', SLUG],
    ['type', 'npc'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ['noun', name],
    ['health', '4'],
    ['damage', '1'],
    ['hit-chance', '0.6'],
    ['on-attacked', '', 'deal-damage', '2'],
  ];
  const placeEvent = events.find((e) => e.tags.find((t) => t[0] === 'd')?.[1] === placeId(r, c));
  if (placeEvent) placeEvent.tags.push(['npc', ref(dtag)]);
  events.push({ kind: 30078, tags, content: `A ${name} watches you warily.` });
}

// 5. Recipes — combine pairs of items
const shuffledItems = shuffle(itemDtags);
for (let i = 0; i < N_RECIPES && i * 2 + 1 < shuffledItems.length; i++) {
  const ing1 = shuffledItems[i * 2];
  const ing2 = shuffledItems[i * 2 + 1];
  const resultName = `crafted-${i}`;
  const resultDtag = `${SLUG}:item:${resultName}`;
  const recipeDtag = `${SLUG}:recipe:craft-${i}`;

  // Result item
  events.push({
    kind: 30078,
    tags: [
      ['d', resultDtag],
      ['t', SLUG],
      ['type', 'item'],
      ['title', `Crafted Item ${i}`],
      ['noun', resultName],
    ],
    content: `Something you crafted.`,
  });

  // Recipe
  events.push({
    kind: 30078,
    tags: [
      ['d', recipeDtag],
      ['t', SLUG],
      ['type', 'recipe'],
      ['title', `Craft ${resultName}`],
      ['verb', `craft-${i}`],
      ['noun', resultName],
      ['ingredient', ref(ing1)],
      ['ingredient', ref(ing2)],
      ['result', ref(resultDtag)],
    ],
    content: `Combine to create ${resultName}.`,
  });
}

// ── Walkthrough ───────────────────────────────────────────────────────────────
// Simple: walk south (or east if at bottom edge) through the grid
const walkthrough = [];
for (let step = 0; step < Math.min(WIDTH + HEIGHT - 2, 20); step++) {
  const dir = step < HEIGHT - 1 ? 'south' : 'east';
  walkthrough.push({ input: dir, expect: [] });
}
walkthrough.push({ input: 'look', expect: [] });
walkthrough.push({ input: 'inventory', expect: [] });

// ── Output ────────────────────────────────────────────────────────────────────

const world = { answers: {}, walkthrough, events };
writeFileSync(OUT, JSON.stringify(world, null, 2));

const total = events.length;
const places = events.filter((e) => e.tags.find((t) => t[0] === 'type')?.[1] === 'place').length;
const items  = events.filter((e) => e.tags.find((t) => t[0] === 'type')?.[1] === 'item').length;
const npcs   = events.filter((e) => e.tags.find((t) => t[0] === 'type')?.[1] === 'npc').length;
const recipes= events.filter((e) => e.tags.find((t) => t[0] === 'type')?.[1] === 'recipe').length;

console.log(`Generated ${SLUG}:`);
console.log(`  ${total} total events`);
console.log(`  ${places} places (${WIDTH}×${HEIGHT} grid)`);
console.log(`  ${items} items  (${N_ITEMS} base + ${N_RECIPES} crafted)`);
console.log(`  ${npcs} NPCs`);
console.log(`  ${recipes} recipes`);
console.log(`  Written to ${OUT}`);
