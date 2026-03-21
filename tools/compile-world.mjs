#!/usr/bin/env node
/**
 * Compile The Lake world events into a JSON file suitable for import via the builder.
 *
 * Usage: node tools/compile-world.mjs [output-file]
 *   Default output: docs/the-lake/the-lake-events.json
 *
 * Uses a placeholder pubkey (<PUBKEY>) so the builder can resolve it at import time.
 */
import 'dotenv/config';

import { hashAnswer, derivePuzzleKey, encryptContent } from '../lib/crypto.mjs';
import { places } from '../lib/events/places.mjs';
import { portals } from '../lib/events/portals.mjs';
import { items } from '../lib/events/items.mjs';
import { features } from '../lib/events/features.mjs';
import { clues } from '../lib/events/clues.mjs';
import { puzzle } from '../lib/events/puzzle.mjs';
import { npcs } from '../lib/events/npcs.mjs';
import { dialogue } from '../lib/events/dialogue.mjs';
import { world } from '../lib/events/world.mjs';
import { paymentEvents } from '../lib/events/payment.mjs';
import { sounds } from '../lib/events/sounds.mjs';
import { consequences } from '../lib/events/consequences.mjs';
import { quests } from '../lib/events/quests.mjs';

import { writeFileSync } from 'fs';

// ── Config ──────────────────────────────────────────────────────────────────

const PUZZLE_ANSWER = 'bottle';
const PUZZLE_SALT = 'the-lake:puzzle:chapel-riddle:v1';
const PLACEHOLDER_PUBKEY = '<PUBKEY>';

// ── Puzzle crypto ───────────────────────────────────────────────────────────

const answerHash = hashAnswer(PUZZLE_ANSWER, PUZZLE_SALT);

// For NIP-44 encryption we need a real keypair — generate an ephemeral one
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ephemeralSk = generateSecretKey();
const ephemeralSkHex = bytesToHex(ephemeralSk);
const ephemeralPk = getPublicKey(ephemeralSk);

const { pubKeyHex: derivedPubKey } = derivePuzzleKey(PUZZLE_ANSWER, PUZZLE_SALT);

// Encrypt sanctum content with ephemeral key (will be re-encrypted at publish time with real key)
const SANCTUM_PROSE =
  'You step into a chamber of still, dark water. The air hums with something ancient. ' +
  'Words appear on the far wall, glowing faintly:\n\n' +
  '"You have proven worthy. The lake remembers your name."\n\n' +
  'Congratulations — you have completed The Lake.';

// ── Build events ────────────────────────────────────────────────────────────

// Use placeholder pubkey — builder replaces <PUBKEY> with actual pubkey on import
const collabPk = '<COLLAB_PUBKEY>';

const allEvents = [
  ...world(PLACEHOLDER_PUBKEY, collabPk),
  ...places(PLACEHOLDER_PUBKEY, null), // sanctum content handled via answers
  ...portals(PLACEHOLDER_PUBKEY),
  ...items(PLACEHOLDER_PUBKEY),
  ...features(PLACEHOLDER_PUBKEY),
  ...clues(PLACEHOLDER_PUBKEY),
  ...puzzle(PLACEHOLDER_PUBKEY, answerHash, derivedPubKey),
  ...npcs(PLACEHOLDER_PUBKEY),
  ...dialogue(PLACEHOLDER_PUBKEY),
  ...paymentEvents(PLACEHOLDER_PUBKEY),
  ...sounds(PLACEHOLDER_PUBKEY),
  ...consequences(PLACEHOLDER_PUBKEY),
  ...quests(PLACEHOLDER_PUBKEY),
];

// Strip created_at (import sets its own)
for (const evt of allEvents) {
  delete evt.created_at;
}

// ── Answers (puzzle solutions for NIP-44 encryption at publish time) ────────

const answers = {
  'the-lake:puzzle:chapel-riddle': PUZZLE_ANSWER,
};

// ── Output ──────────────────────────────────────────────────────────────────

const output = {
  answers,
  events: allEvents,
};

const outputPath = process.argv[2] || 'docs/the-lake/the-lake-events.json';
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

console.log(`Compiled ${allEvents.length} events to ${outputPath}`);
console.log(`  Answers: ${Object.keys(answers).length}`);
console.log(`  Pubkey placeholder: ${PLACEHOLDER_PUBKEY}`);
