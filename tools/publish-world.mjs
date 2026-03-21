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
import {
  collaboratorEvents, vouchEvents, vouchedEvents, untrustedEvents,
} from '../lib/events/trust-test.mjs';
import { paymentEvents } from '../lib/events/payment.mjs';
import { sounds } from '../lib/events/sounds.mjs';
import { consequences } from '../lib/events/consequences.mjs';
import { quests } from '../lib/events/quests.mjs';

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

/**
 * Resolve or generate a keypair from an env var.
 * Returns { secretKeyBytes, secretKeyHex, pubkey }.
 */
function resolveKeypair(envVar, label) {
  let hex = process.env[envVar];
  let bytes;
  if (hex) {
    bytes = hexToBytes(hex);
  } else {
    bytes = generateSecretKey();
    hex = bytesToHex(bytes);
    console.log(`Generated new ${label} keypair.`);
    console.log(`  Add ${envVar}=${hex} to .env to reuse.\n`);
  }
  return { secretKeyBytes: bytes, secretKeyHex: hex, pubkey: getPublicKey(bytes) };
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

// ── Keypairs ─────────────────────────────────────────────────────────────────

const author    = resolveKeypair('AUTHOR_PRIVATE_KEY', 'author');
const collab    = resolveKeypair('COLLAB_PRIVATE_KEY', 'collaborator');
const vouched   = resolveKeypair('VOUCHED_PRIVATE_KEY', 'vouched');
const untrusted = resolveKeypair('UNTRUSTED_PRIVATE_KEY', 'untrusted');

console.log('Keypairs:');
console.log(`  Author (genesis): ${author.pubkey}`);
console.log(`  Collaborator:     ${collab.pubkey}`);
console.log(`  Vouched:          ${vouched.pubkey}`);
console.log(`  Untrusted:        ${untrusted.pubkey}`);
console.log(`  Author npub:      ${nip19.npubEncode(author.pubkey)}\n`);

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

const sanctumEncrypted = encryptContent(SANCTUM_PROSE, author.secretKeyHex, derivedPubKey);
console.log(`Sanctum encrypted (${sanctumEncrypted.length} chars)\n`);

// ── Build genesis events ─────────────────────────────────────────────────────

const genesisUnsigned = [
  ...world(author.pubkey, collab.pubkey),
  ...places(author.pubkey, sanctumEncrypted),
  ...portals(author.pubkey),
  ...items(author.pubkey),
  ...features(author.pubkey),
  ...clues(author.pubkey),
  ...puzzle(author.pubkey, answerHash, derivedPubKey),
  ...npcs(author.pubkey),
  ...dialogue(author.pubkey),
  ...paymentEvents(author.pubkey),
  ...sounds(author.pubkey),
  ...consequences(author.pubkey),
  ...quests(author.pubkey),
];

console.log(`Genesis events (${genesisUnsigned.length}):\n`);
for (const evt of genesisUnsigned) {
  const d = evt.tags.find((t) => t[0] === 'd')?.[1];
  const type = evt.tags.find((t) => t[0] === 'type')?.[1];
  console.log(`  [${type}] ${d}`);
}

// ── Build trust test events (secondary authors) ─────────────────────────────

const trustUnsigned = [
  ...collaboratorEvents(author.pubkey, collab.pubkey),
  ...vouchEvents(collab.pubkey, vouched.pubkey),
  ...vouchedEvents(collab.pubkey, vouched.pubkey),
  ...untrustedEvents(author.pubkey, untrusted.pubkey),
];

console.log(`\nTrust test events (${trustUnsigned.length}):\n`);
for (const evt of trustUnsigned) {
  const d = evt.tags.find((t) => t[0] === 'd')?.[1];
  const type = evt.tags.find((t) => t[0] === 'type')?.[1];
  const pk = evt.pubkey?.slice(0, 8) || 'genesis';
  console.log(`  [${type}] ${d}  (${pk}...)`);
}

// ── NIP-51 curated world list ────────────────────────────────────────────────

const curatedList = {
  kind: 30001,
  pubkey: author.pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['d', 'foakloar:worlds'],
    ['title', 'foakloar — Featured Worlds'],
    ['a', `30078:${author.pubkey}:the-lake:world`],
  ],
  content: '',
};

console.log(`\nCurated list (foakloar:worlds): 1 world reference\n`);

// ── Sign ────────────────────────────────────────────────────────────────────

// Sign genesis events + curated list with author key
const signedGenesis = [...genesisUnsigned, curatedList].map((evt) => finalizeEvent(evt, author.secretKeyBytes));

// Sign trust test events with their respective keys
const keyMap = {
  [collab.pubkey]:    collab.secretKeyBytes,
  [vouched.pubkey]:   vouched.secretKeyBytes,
  [untrusted.pubkey]: untrusted.secretKeyBytes,
};
const signedTrust = trustUnsigned.map((evt) => {
  const sk = keyMap[evt.pubkey];
  if (!sk) throw new Error(`No secret key for pubkey ${evt.pubkey}`);
  return finalizeEvent(evt, sk);
});

const allSigned = [...signedGenesis, ...signedTrust];
console.log(`\nSigned ${allSigned.length} events (${signedGenesis.length} genesis + ${signedTrust.length} trust test).\n`);

// ── Publish or verify ───────────────────────────────────────────────────────

const verifyOnly = process.argv.includes('--verify');

if (verifyOnly) {
  const events = await verifyEvents(author.pubkey, RELAY_URLS);
  for (const evt of events.values()) {
    const d = evt.tags.find((t) => t[0] === 'd')?.[1];
    console.log(`  \u2713 ${d}`);
  }
  process.exit(0);
}

const results = await publishEvents(allSigned, RELAY_URLS);

console.log('\n\u2500\u2500 Summary \u2500\u2500');
for (const r of results) {
  console.log(`  ${r.url}: ${r.ok ? '\u2713' : '\u2717'} (${r.published ?? 0}/${allSigned.length})`);
}

process.exit(results.every((r) => r.ok) ? 0 : 1);
