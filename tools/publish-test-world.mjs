#!/usr/bin/env node
/**
 * Publish a test world JSON file to relays.
 * Usage: node tools/publish-test-world.mjs <path-to-events.json>
 *
 * Uses the AUTHOR_PRIVATE_KEY from .env, replaces <PUBKEY> placeholders.
 */
import 'dotenv/config';
import fs from 'fs';
import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';

const RELAY_URLS = (process.env.RELAY_URLS || 'wss://relay.primal.net,wss://nos.lol').split(',').map((s) => s.trim());

const skHex = process.env.AUTHOR_PRIVATE_KEY;
if (!skHex) { console.error('Set AUTHOR_PRIVATE_KEY in .env'); process.exit(1); }
const skBytes = Uint8Array.from(Buffer.from(skHex, 'hex'));
const pubkey = getPublicKey(skBytes);

const jsonPath = process.argv[2];
if (!jsonPath) { console.error('Usage: node tools/publish-test-world.mjs <path>'); process.exit(1); }

const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);
const events = data.events || data;

console.log(`Publishing ${events.length} events from ${jsonPath}`);
console.log(`  Author pubkey: ${pubkey}`);
console.log(`  Relays: ${RELAY_URLS.join(', ')}\n`);

// Replace <PUBKEY> with actual pubkey, set created_at, sign
const now = Math.floor(Date.now() / 1000);
const signed = events.map((evt, i) => {
  const tags = evt.tags.map((tag) =>
    tag.map((v) => (typeof v === 'string' ? v.replace(/<PUBKEY>/g, pubkey) : v))
  );
  return finalizeEvent({ kind: 30078, created_at: now + i, tags, content: evt.content || '' }, skBytes);
});

// Publish to each relay
for (const url of RELAY_URLS) {
  try {
    const relay = await Relay.connect(url);
    let ok = 0;
    for (const evt of signed) {
      try { await relay.publish(evt); ok++; } catch { /* skip */ }
    }
    relay.close();
    console.log(`  ${url}: ✓ (${ok}/${signed.length})`);
  } catch (e) {
    console.log(`  ${url}: ✗ ${e.message}`);
  }
}
console.log('\nDone.');
