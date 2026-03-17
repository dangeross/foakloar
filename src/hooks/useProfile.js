/**
 * useProfile — Fetch a Nostr kind:0 profile event for a pubkey.
 *
 * Returns { name, displayName, about, nip05, lud16 } from the profile content JSON.
 */

import { useEffect, useState } from 'react';
import { Relay } from 'nostr-tools/relay';
import { RELAY_URLS } from '../config.js';

export function useProfile(hexPubkey) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!hexPubkey) { setStatus('idle'); return; }

    const cancelled = { current: false };
    setProfile(null);
    setStatus('loading');

    async function run() {
      let best = null;

      for (const url of RELAY_URLS) {
        if (cancelled.current) return;
        try {
          const relay = await Relay.connect(url);
          if (cancelled.current) { relay.close(); return; }

          await new Promise((resolve) => {
            relay.subscribe(
              [{ kinds: [0], authors: [hexPubkey] }],
              {
                onevent(event) {
                  if (!best || event.created_at > best.created_at) {
                    best = event;
                  }
                },
                oneose() { resolve(); },
              }
            );
          });
          relay.close();
          if (best) break;
        } catch (err) {
          console.warn(`Profile fetch failed on ${url}:`, err.message);
        }
      }

      if (cancelled.current) return;

      if (best) {
        try {
          const data = JSON.parse(best.content);
          setProfile({
            name: data.name || '',
            displayName: data.display_name || '',
            about: data.about || '',
            nip05: data.nip05 || '',
            lud16: data.lud16 || '',
          });
          setStatus('ready');
        } catch {
          setStatus('empty');
        }
      } else {
        setStatus('empty');
      }
    }

    run().catch((err) => {
      console.warn('Profile fetch error:', err);
      if (!cancelled.current) setStatus('failed');
    });

    return () => { cancelled.current = true; };
  }, [hexPubkey]);

  return { profile, status };
}
