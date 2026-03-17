/**
 * useWorldDiscovery — Two-step world discovery via NIP-51 curated list.
 *
 * Step 1: Fetch kind:30001 events with d-tag "foakloar:worlds" — the
 *         application curated list. Extract world a-tag references.
 * Step 2: Derive slugs from the a-tags, combine with local draft slugs,
 *         then fetch the actual world events via indexed #t filter.
 *
 * This avoids querying unindexed custom tags and keeps discovery
 * decentralized — anyone can publish a foakloar:worlds list.
 */

import { useEffect, useState } from 'react';
import { Relay } from 'nostr-tools/relay';
import { RELAY_URLS } from '../config.js';

const CURATED_LIST_DTAG = 'foakloar:worlds';

/**
 * Extract world metadata from a raw NOSTR event.
 */
function extractWorldInfo(event) {
  const get = (name) => event.tags.find((t) => t[0] === name)?.[1] || '';
  const getAll = (name) => event.tags.filter((t) => t[0] === name).map((t) => t[1]);

  const dTag = get('d');
  const slug = get('t') || dTag.replace(/:world$/, '');

  return {
    aTag: `30078:${event.pubkey}:${dTag}`,
    slug,
    title: get('title') || slug,
    author: get('author') || '',
    pubkey: event.pubkey,
    description: event.content || '',
    tags: getAll('tag'),
    cw: getAll('cw'),
    collaboration: get('collaboration') || 'closed',
    theme: get('theme') || '',
    version: get('version') || '',
    createdAt: event.created_at,
  };
}

/**
 * Scan localStorage for draft world slugs.
 */
function getDraftSlugs() {
  const slugs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('drafts:')) {
      slugs.push(key.slice(7));
    }
  }
  return slugs;
}

/**
 * Extract world slugs from a NIP-51 curated list event.
 * List contains a-tags like "30078:<pubkey>:<slug>:world".
 */
function slugsFromCuratedList(listEvent) {
  const slugs = [];
  for (const tag of listEvent.tags) {
    if (tag[0] !== 'a') continue;
    const ref = tag[1];
    if (!ref) continue;
    // Format: 30078:<pubkey>:<slug>:world
    const parts = ref.split(':');
    if (parts.length >= 4 && parts[0] === '30078') {
      // Slug is everything between pubkey and :world suffix
      const dTag = parts.slice(2).join(':'); // <slug>:world
      const slug = dTag.replace(/:world$/, '');
      if (slug) slugs.push(slug);
    }
  }
  return slugs;
}

export function useWorldDiscovery() {
  const [worlds, setWorlds] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const collected = new Map();

    async function discover() {
      let curatedSlugs = [];

      // Step 1: Fetch curated list(s)
      for (const url of RELAY_URLS) {
        if (cancelled) return;
        try {
          const relay = await Relay.connect(url);
          if (cancelled) { relay.close(); return; }

          const lists = [];
          await new Promise((resolve) => {
            relay.subscribe(
              [{ kinds: [30001], '#d': [CURATED_LIST_DTAG] }],
              {
                onevent(event) { lists.push(event); },
                oneose() { resolve(); },
              }
            );
          });

          relay.close();

          // Collect slugs from all lists (multiple curators)
          for (const list of lists) {
            curatedSlugs.push(...slugsFromCuratedList(list));
          }

          if (lists.length > 0) break; // Got lists from this relay
        } catch (err) {
          console.warn(`Curated list fetch failed on ${url}:`, err.message);
        }
      }

      // Step 2: Combine curated slugs + draft slugs
      const allSlugs = [...new Set([...curatedSlugs, ...getDraftSlugs()])];

      if (allSlugs.length === 0) {
        if (!cancelled) {
          setWorlds([]);
          setStatus('ready');
        }
        return;
      }

      // Step 3: Fetch world events by slug
      for (const url of RELAY_URLS) {
        if (cancelled) return;
        try {
          const relay = await Relay.connect(url);
          if (cancelled) { relay.close(); return; }

          await new Promise((resolve) => {
            relay.subscribe(
              [{ kinds: [30078], '#t': allSlugs }],
              {
                onevent(event) {
                  const typeTag = event.tags.find((t) => t[0] === 'type')?.[1];
                  if (typeTag !== 'world') return;

                  const info = extractWorldInfo(event);
                  const existing = collected.get(info.aTag);
                  if (!existing || event.created_at > existing.createdAt) {
                    collected.set(info.aTag, info);
                  }
                },
                oneose() { resolve(); },
              }
            );
          });

          relay.close();

          if (!cancelled) {
            const sorted = [...collected.values()].sort((a, b) =>
              a.title.localeCompare(b.title)
            );
            setWorlds(sorted);
            setStatus('ready');
          }
          return;
        } catch (err) {
          console.warn(`World discovery failed on ${url}:`, err.message);
        }
      }

      if (!cancelled) {
        setWorlds([...collected.values()]);
        setStatus(collected.size > 0 ? 'ready' : 'failed');
      }
    }

    discover();
    return () => { cancelled = true; };
  }, []);

  return { worlds, status };
}
