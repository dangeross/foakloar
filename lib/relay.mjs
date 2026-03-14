import 'websocket-polyfill';
import { Relay } from 'nostr-tools/relay';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function publishEvents(signedEvents, relayUrls) {
  const results = [];

  for (const url of relayUrls) {
    console.log(`\nConnecting to ${url}...`);
    let relay;
    try {
      relay = await Relay.connect(url);
      console.log(`  Connected.`);
    } catch (err) {
      console.error(`  Failed to connect: ${err.message}`);
      results.push({ url, ok: false, error: err.message });
      continue;
    }

    let published = 0;
    let failed = 0;
    for (let i = 0; i < signedEvents.length; i++) {
      const event = signedEvents[i];
      const dtag = event.tags.find((t) => t[0] === 'd')?.[1] ?? '?';
      try {
        await relay.publish(event);
        published++;
        console.log(`  ✓ ${dtag}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${dtag}: ${err.message}`);
      }
      // if (i < signedEvents.length - 1) await sleep(1500);
    }

    relay.close();
    results.push({ url, ok: failed === 0, published, failed });
    console.log(`  Done: ${published} published, ${failed} failed.`);
  }

  return results;
}

export async function verifyEvents(pubkey, relayUrls) {
  const url = relayUrls[0];
  console.log(`\nVerifying on ${url}...`);

  const relay = await Relay.connect(url);
  const events = await new Promise((resolve) => {
    const collected = [];
    const sub = relay.subscribe(
      [{ kinds: [30078], '#t': ['the-lake'], authors: [pubkey] }],
      {
        onevent(event) {
          collected.push(event);
        },
        oneose() {
          sub.close();
          resolve(collected);
        },
      }
    );
  });

  relay.close();
  console.log(`  Found ${events.length} events.`);
  return events;
}
