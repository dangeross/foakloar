/**
 * useProfile — Fetch a Nostr kind:0 profile event for a pubkey.
 *
 * Returns { name, displayName, about, nip05, lud16 } from the profile content JSON.
 * Caches profiles in localStorage with a 24-hour TTL to avoid redundant relay queries.
 */

import { useEffect, useState } from 'react';
import { Relay } from 'nostr-tools/relay';
import { RELAY_URLS } from '../config.js';

const CACHE_PREFIX = 'foakloar:profile:';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Read a cached profile if it exists and hasn't expired.
 */
function getCached(hexPubkey) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + hexPubkey);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + hexPubkey);
      return null;
    }
    return entry.profile;
  } catch {
    return null;
  }
}

/**
 * Write a profile to cache with current timestamp.
 */
function setCache(hexPubkey, profile) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + hexPubkey,
      JSON.stringify({ ts: Date.now(), profile })
    );
  } catch {
    // Storage full or unavailable — ignore
  }
}

/**
 * Parse a kind:0 event content into a profile object.
 */
function parseProfile(content) {
  const data = JSON.parse(content);
  return {
    name: data.name || '',
    displayName: data.display_name || '',
    about: data.about || '',
    nip05: data.nip05 || '',
    lud16: data.lud16 || '',
  };
}

export function useProfile(hexPubkey) {
  const [profile, setProfile] = useState(() => hexPubkey ? getCached(hexPubkey) : null);
  const [status, setStatus] = useState(() => {
    if (!hexPubkey) return 'idle';
    return getCached(hexPubkey) ? 'ready' : 'loading';
  });

  useEffect(() => {
    if (!hexPubkey) { setStatus('idle'); return; }

    // Check cache first
    const cached = getCached(hexPubkey);
    if (cached) {
      setProfile(cached);
      setStatus('ready');
      return;
    }

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
          const p = parseProfile(best.content);
          setCache(hexPubkey, p);
          setProfile(p);
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
