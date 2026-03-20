/**
 * useNip65 — Read-only NIP-65 relay list for a user.
 *
 * Fetches kind:10002 events from connected relays to discover
 * the user's preferred read/write relays. Never writes.
 * Caches in localStorage with 1-hour TTL.
 */

import { useState, useEffect } from 'react';
import { fetchNip65Relays } from '../services/relayUrls.js';

/**
 * @param {string|null} pubkey - user's hex pubkey
 * @param {{ current: import('../services/relayPool.js').RelayPool | null }} pool
 * @returns {{ readRelays: string[], writeRelays: string[], status: 'idle'|'loading'|'done' }}
 */
export function useNip65(pubkey, pool) {
  const [readRelays, setReadRelays] = useState([]);
  const [writeRelays, setWriteRelays] = useState([]);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!pubkey || !pool?.current) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetchNip65Relays(pubkey, pool.current).then((result) => {
      if (cancelled) return;
      setReadRelays(result.read);
      setWriteRelays(result.write);
      setStatus('done');
      if (result.read.length || result.write.length) {
        console.log(`[nip65] Found relays for ${pubkey.slice(0, 8)}:`, {
          read: result.read,
          write: result.write,
        });
      }
    });

    return () => { cancelled = true; };
  }, [pubkey, pool?.current]);

  return { readRelays, writeRelays, status };
}
