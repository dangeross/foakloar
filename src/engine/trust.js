/**
 * trust.js — Trust set builder and query functions.
 * Pure functions, no React. Builds trust sets from world event + vouch events.
 */

import { getTag, getTags } from './world.js';

// ── Scope inference from event type ────────────────────────────────────────
const TYPE_SCOPE = {
  place: 'place', portal: 'portal', item: 'all', feature: 'all',
  npc: 'all', clue: 'all', puzzle: 'all', quest: 'all', recipe: 'all',
  consequence: 'all', sound: 'all', dialogue: 'all', payment: 'all',
  world: 'all', vouch: 'all', revoke: 'all',
};

/**
 * Build the trust set from the world event and all events in the map.
 *
 * @param {Object} worldEvent — the world manifest event
 * @param {Map} events — full event map (keyed by a-tag)
 * @returns {{ genesisPubkey: string, collaboration: string, collaborators: Set<string>, vouched: Map<string, { scope: string, canVouch: boolean, vouchedBy: string }> }}
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
    // Collect vouch and revoke events
    const vouchEvents = [];
    const revokeEvents = [];
    for (const [, ev] of events) {
      const type = getTag(ev, 'type');
      if (type === 'vouch') vouchEvents.push(ev);
      if (type === 'revoke') revokeEvents.push(ev);
    }

    // Fixed-point walk: keep adding vouched pubkeys until stable
    // Track who vouched whom for revocation chain validation
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
        vouched.set(vouchedPubkey, { scope, canVouch, vouchedBy: authorPubkey });
        changed = true;
      }
    }

    // Apply revocations — chain-aware
    const revoked = new Set();
    for (const ev of revokeEvents) {
      const revokedPubkey = getTag(ev, 'pubkey');
      if (!revokedPubkey || !vouched.has(revokedPubkey)) continue;

      const revokerPubkey = ev.pubkey;
      // Genesis/collaborator can revoke anyone
      if (revokerPubkey === genesisPubkey || collaborators.has(revokerPubkey)) {
        revoked.add(revokedPubkey);
        continue;
      }
      // Vouched author can only revoke pubkeys they personally vouched
      const entry = vouched.get(revokedPubkey);
      if (entry?.vouchedBy === revokerPubkey) {
        revoked.add(revokedPubkey);
      }
    }

    // Cascade: remove revoked + anyone whose only vouch path goes through revoked
    if (revoked.size > 0) {
      let cascadeChanged = true;
      while (cascadeChanged) {
        cascadeChanged = false;
        for (const [pk, entry] of vouched) {
          if (revoked.has(pk)) continue; // already marked
          // If voucher was revoked, this pubkey loses trust (unless vouched by genesis/collaborator)
          if (revoked.has(entry.vouchedBy) &&
              entry.vouchedBy !== genesisPubkey &&
              !collaborators.has(entry.vouchedBy)) {
            revoked.add(pk);
            cascadeChanged = true;
          }
        }
      }
      for (const pk of revoked) vouched.delete(pk);
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
 * Check if an event is trusted based on its author and type.
 * Infers scope from the event's type tag.
 *
 * @param {Object} event — the event to check
 * @param {Object} trustSet — from buildTrustSet
 * @param {string} clientMode — 'canonical' | 'community' | 'explorer'
 * @returns {'trusted'|'unverified'|'hidden'}
 */
export function isEventTrusted(event, trustSet, clientMode) {
  if (!event || !trustSet) return 'hidden';
  const type = getTag(event, 'type') || 'all';
  const scope = TYPE_SCOPE[type] || 'all';
  return getTrustLevel(trustSet, event.pubkey, scope, clientMode);
}

/**
 * Check if an event ref (a-tag) resolves to a trusted event.
 * Returns 'hidden' if the ref doesn't resolve or the author is untrusted.
 *
 * @param {string} ref — event ref (a-tag format: 30078:pubkey:d-tag)
 * @param {Map} events — full event map
 * @param {Object} trustSet — from buildTrustSet
 * @param {string} clientMode — 'canonical' | 'community' | 'explorer'
 * @returns {'trusted'|'unverified'|'hidden'}
 */
export function isRefTrusted(ref, events, trustSet, clientMode) {
  if (!ref || !events) return 'hidden';
  const event = events.get(ref);
  if (!event) return 'hidden';
  return isEventTrusted(event, trustSet, clientMode);
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
