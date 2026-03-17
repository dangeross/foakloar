/**
 * trust.js — Trust set builder and query functions.
 * Pure functions, no React. Builds trust sets from world event + vouch events.
 */

import { getTag, getTags } from './world.js';

/**
 * Build the trust set from the world event and all events in the map.
 *
 * @param {Object} worldEvent — the world manifest event
 * @param {Map} events — full event map (keyed by a-tag)
 * @returns {{ genesisPubkey: string, collaboration: string, collaborators: Set<string>, vouched: Map<string, { scope: string, canVouch: boolean }> }}
 */
export function buildTrustSet(worldEvent, events) {
  const genesisPubkey = worldEvent.pubkey;
  const collaboration = getTag(worldEvent, 'collaboration') || 'closed';
  const collaborators = new Set(
    getTags(worldEvent, 'collaborator').map((t) => t[1])
  );

  // Vouch chain — only relevant for vouched/open collaboration
  const vouched = new Map();
  if (collaboration === 'vouched' || collaboration === 'open') {
    // Collect all vouch events from the map
    const vouchEvents = [];
    for (const [, ev] of events) {
      if (getTag(ev, 'type') === 'vouch') vouchEvents.push(ev);
    }

    // Fixed-point walk: keep adding vouched pubkeys until stable
    let changed = true;
    while (changed) {
      changed = false;
      for (const ev of vouchEvents) {
        const vouchedPubkey = getTag(ev, 'pubkey');
        if (!vouchedPubkey) continue;
        if (vouched.has(vouchedPubkey)) continue; // already in set

        const authorPubkey = ev.pubkey;
        // Author must be in the trust set to vouch
        if (!canAuthorVouch(genesisPubkey, collaborators, vouched, authorPubkey)) continue;

        const scope = getTag(ev, 'scope') || 'all';
        const canVouch = getTag(ev, 'can-vouch') === 'true';
        vouched.set(vouchedPubkey, { scope, canVouch });
        changed = true;
      }
    }
  }

  return { genesisPubkey, collaboration, collaborators, vouched };
}

/**
 * Check if an author can issue valid vouches.
 * Genesis and collaborators can always vouch. Vouched authors can only vouch
 * if they were vouched with can-vouch: true.
 */
function canAuthorVouch(genesisPubkey, collaborators, vouched, authorPubkey) {
  if (authorPubkey === genesisPubkey) return true;
  if (collaborators.has(authorPubkey)) return true;
  const entry = vouched.get(authorPubkey);
  return entry?.canVouch === true;
}

/**
 * Check if a pubkey is trusted for a given scope in the trust set.
 *
 * @param {Object} trustSet — from buildTrustSet
 * @param {string} pubkey — the pubkey to check
 * @param {string} scope — 'portal' | 'place' | 'all'
 * @param {string} clientMode — 'canonical' | 'community' | 'explorer'
 * @returns {boolean}
 */
/**
 * Check trust level for a pubkey.
 * Returns 'trusted', 'unverified', or 'hidden'.
 *
 * - 'trusted'    — fully trusted, render normally
 * - 'unverified' — visible but marked (red), not in trust chain
 * - 'hidden'     — filtered out entirely
 */
export function getTrustLevel(trustSet, pubkey, scope, clientMode) {
  if (!trustSet) return 'hidden';

  // Genesis always trusted
  if (pubkey === trustSet.genesisPubkey) return 'trusted';

  // Collaborators always trusted
  if (trustSet.collaborators.has(pubkey)) return 'trusted';

  // Check vouch chain (valid in community/explorer for vouched/open)
  if (clientMode !== 'canonical') {
    const entry = trustSet.vouched.get(pubkey);
    if (entry) {
      if (entry.scope === 'all') return 'trusted';
      if (entry.scope === 'place' && (scope === 'place' || scope === 'portal')) return 'trusted';
      if (entry.scope === 'portal' && scope === 'portal') return 'trusted';
    }
  }

  // Untrusted pubkey — visibility depends on collaboration mode + client mode:
  //   vouched + explorer → unverified (scouting mode for vouchers)
  //   open + community   → unverified (wild west, everything visible)
  if (trustSet.collaboration === 'vouched' && clientMode === 'explorer') return 'unverified';
  if (trustSet.collaboration === 'open' && clientMode === 'community') return 'unverified';

  return 'hidden';
}

/**
 * Check if a pubkey is trusted for a given scope in the trust set.
 * Backward-compatible boolean wrapper around getTrustLevel.
 *
 * @param {Object} trustSet — from buildTrustSet
 * @param {string} pubkey — the pubkey to check
 * @param {string} scope — 'portal' | 'place' | 'all'
 * @param {string} clientMode — 'canonical' | 'community' | 'explorer'
 * @returns {boolean}
 */
export function isPubkeyTrusted(trustSet, pubkey, scope, clientMode) {
  return getTrustLevel(trustSet, pubkey, scope, clientMode) !== 'hidden';
}

/**
 * Resolve valid client modes for a collaboration setting.
 * Returns available modes and the effective mode.
 *
 * @param {string} collaboration — 'closed' | 'vouched' | 'open'
 * @param {string} requestedMode — 'canonical' | 'community' | 'explorer'
 * @returns {{ availableModes: string[], effectiveMode: string }}
 */
export function resolveClientMode(collaboration, requestedMode) {
  let availableModes;
  if (collaboration === 'closed') {
    availableModes = ['canonical'];
  } else if (collaboration === 'vouched') {
    // Explorer available for vouchers (requires login — enforced by UI)
    availableModes = ['canonical', 'community', 'explorer'];
  } else {
    // Open: community is the "see everything" tier — no explorer needed
    availableModes = ['canonical', 'community'];
  }

  const effectiveMode = availableModes.includes(requestedMode)
    ? requestedMode
    : availableModes[availableModes.length - 1]; // default to most permissive valid mode

  return { availableModes, effectiveMode };
}
