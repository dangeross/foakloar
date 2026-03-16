import { useEffect, useRef, useState } from 'react';
import { Relay } from 'nostr-tools/relay';
import { RELAY_URLS } from './config.js';

/**
 * Subscribe to all kind:30078 events for a given world tag.
 * @param {string} worldTag - the world slug to subscribe to
 */
export function useRelay(worldTag) {
  const [events, setEvents] = useState(new Map());
  const [status, setStatus] = useState(worldTag ? 'connecting' : 'idle');
  const relayRef = useRef(null);

  useEffect(() => {
    if (!worldTag) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');
    setEvents(new Map());
    let cancelled = false;

    async function connect() {
      for (const url of RELAY_URLS) {
        if (cancelled) return;
        try {
          console.log(`Connecting to ${url}...`);
          const relay = await Relay.connect(url);
          if (cancelled) { relay.close(); return; }
          relayRef.current = relay;
          setStatus('connected');
          console.log(`Connected to ${url}`);

          relay.subscribe(
            [{ kinds: [30078], '#t': [worldTag] }],
            {
              onevent(event) {
                const d = event.tags.find((t) => t[0] === 'd')?.[1];
                if (d) {
                  setEvents((prev) => {
                    const next = new Map(prev);
                    next.set(`30078:${event.pubkey}:${d}`, event);
                    return next;
                  });
                }
              },
              oneose() {
                console.log('EOSE — all stored events received.');
                setStatus('ready');
              },
            }
          );
          return;
        } catch (err) {
          console.warn(`Failed to connect to ${url}:`, err.message);
        }
      }
      setStatus('failed');
    }

    connect();
    return () => {
      cancelled = true;
      relayRef.current?.close();
    };
  }, [worldTag]);

  return { events, status, relay: relayRef };
}
