import 'dotenv/config';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';

import { hashAnswer, derivePuzzleKey, encryptContent } from '../lib/crypto.mjs';
import { publishEvents, verifyEvents } from '../lib/relay.mjs';
import { places } from '../lib/events/places.mjs';
import { portals } from '../lib/events/portals.mjs';
import { items } from '../lib/events/items.mjs';
import { features } from '../lib/events/features.mjs';
import { clues } from '../lib/events/clues.mjs';
import { puzzle } from '../lib/events/puzzle.mjs';
import { npcs } from '../lib/events/npcs.mjs';
import { dialogue } from '../lib/events/dialogue.mjs';
import { world } from '../lib/events/world.mjs';

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

// ── Config ──────────────────────────────────────────────────────────────────

const RELAY_URLS = (process.env.RELAY_URLS || 'wss://nos.lol,wss://relay.nostr.band')
  .split(',')
  .map((u) => u.trim());

const PUZZLE_ANSWER = 'bottle';
const PUZZLE_SALT = 'the-lake:puzzle:chapel-riddle:v1';

const SANCTUM_PROSE =
  'You step into a chamber of still, dark water. The air hums with something ancient. ' +
  'Words appear on the far wall, glowing faintly:\n\n' +
  '"You have proven worthy. The lake remembers your name."\n\n' +
  'Congratulations — you have completed The Lake.';

// ── Keypair ─────────────────────────────────────────────────────────────────

let secretKeyHex = process.env.AUTHOR_PRIVATE_KEY;
let secretKeyBytes;

if (secretKeyHex) {
  secretKeyBytes = hexToBytes(secretKeyHex);
} else {
  secretKeyBytes = generateSecretKey();
  secretKeyHex = bytesToHex(secretKeyBytes);
  console.log('Generated new author keypair.');
  console.log(`  Private key (hex): ${secretKeyHex}`);
  console.log(`  Add AUTHOR_PRIVATE_KEY=${secretKeyHex} to .env to reuse.\n`);
}

const pubkey = getPublicKey(secretKeyBytes);
console.log(`Author pubkey: ${pubkey}`);
console.log(`Author npub:   ${nip19.npubEncode(pubkey)}\n`);

// ── Puzzle crypto ───────────────────────────────────────────────────────────

const answerHash = hashAnswer(PUZZLE_ANSWER, PUZZLE_SALT);
const { privKeyHex: derivedPrivKey, pubKeyHex: derivedPubKey } = derivePuzzleKey(
  PUZZLE_ANSWER,
  PUZZLE_SALT
);

console.log('Puzzle crypto:');
console.log(`  Answer:       "${PUZZLE_ANSWER}"`);
console.log(`  Salt:         ${PUZZLE_SALT}`);
console.log(`  Answer hash:  ${answerHash}`);
console.log(`  Derived pub:  ${derivedPubKey}`);
console.log(`  Derived priv: ${derivedPrivKey} (for verification only)\n`);

// ── NIP-44 encrypt Sanctum content ──────────────────────────────────────────

const sanctumEncrypted = encryptContent(SANCTUM_PROSE, secretKeyHex, derivedPubKey);
console.log(`Sanctum encrypted (${sanctumEncrypted.length} chars)\n`);

// ── Build all 17 events ─────────────────────────────────────────────────────

const unsignedEvents = [
  ...world(pubkey),
  ...places(pubkey, sanctumEncrypted),
  ...portals(pubkey),
  ...items(pubkey),
  ...features(pubkey),
  ...clues(pubkey),
  ...puzzle(pubkey, answerHash, derivedPubKey),
  ...npcs(pubkey),
  ...dialogue(pubkey),
];

console.log(`Built ${unsignedEvents.length} unsigned events:\n`);
for (const evt of unsignedEvents) {
  const d = evt.tags.find((t) => t[0] === 'd')?.[1];
  const type = evt.tags.find((t) => t[0] === 'type')?.[1];
  console.log(`  [${type}] ${d}`);
}

// ── Sign ────────────────────────────────────────────────────────────────────

const signedEvents = unsignedEvents.map((evt) => finalizeEvent(evt, secretKeyBytes));
console.log(`\nSigned ${signedEvents.length} events.\n`);

// ── Publish or verify ───────────────────────────────────────────────────────

const verifyOnly = process.argv.includes('--verify');

if (verifyOnly) {
  const events = await verifyEvents(pubkey, RELAY_URLS);
  for (const evt of events.values()) {
    const d = evt.tags.find((t) => t[0] === 'd')?.[1];
    console.log(`  ✓ ${d}`);
  }
  process.exit(0);
}

const results = await publishEvents(signedEvents, RELAY_URLS);

console.log('\n── Summary ──');
for (const r of results) {
  console.log(`  ${r.url}: ${r.ok ? '✓' : '✗'} (${r.published ?? 0}/${signedEvents.length})`);
}

process.exit(results.every((r) => r.ok) ? 0 : 1);
