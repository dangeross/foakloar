/**
 * npc.js — Pure functions for NPC roaming and inventory.
 * No React imports. No side effects.
 */

import { getTag, getTags } from './world.js';

/**
 * Simple deterministic hash for NPC position seeding.
 * Returns a positive integer from a string seed.
 */
function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Calculate which route place a roaming NPC is currently at.
 *
 * @param {Object} npcEvent — the NPC event
 * @param {number} moveCount — player's total move count
 * @param {string|undefined} npcState — NPC's current state
 * @returns {string|null} — d-tag of the place the NPC is at, or null if not roaming
 */
export function calculateNpcPlace(npcEvent, moveCount, npcState) {
  const routeTags = getTags(npcEvent, 'route');
  if (routeTags.length === 0) return null;

  const speed = parseInt(getTag(npcEvent, 'speed') || '1', 10);
  const order = getTag(npcEvent, 'roam-type') || getTag(npcEvent, 'order') || 'route';
  const roamsWhen = getTag(npcEvent, 'roams-when');

  // If roams-when is set and NPC is not in that state, stay at first route place (spawn)
  if (roamsWhen && npcState !== roamsWhen) {
    return routeTags[0][1];  // full a-tag
  }

  const routes = routeTags.map((t) => t[1]);  // full a-tags
  const npcDtag = getTag(npcEvent, 'd');
  const npcMoves = Math.floor(moveCount / speed);

  if (order === 'random') {  // roam-type: random
    // Deterministic pseudo-random: seed from NPC d-tag + move step
    const seed = hashSeed(npcDtag + ':' + npcMoves);
    return routes[seed % routes.length];
  }

  // Sequential — cycle through routes
  return routes[npcMoves % routes.length];
}

/**
 * Initialize NPC state from its event tags.
 * Returns a fresh NPC state object.
 */
export function initNpcState(npcEvent) {
  const state = getTag(npcEvent, 'state') || null;
  const health = getTag(npcEvent, 'health');
  const inventoryRefs = getTags(npcEvent, 'inventory').map((t) => t[1]);  // full a-tags

  return {
    state,
    inventory: inventoryRefs,
    stolen: [],
    health: health ? parseInt(health, 10) : null,
  };
}

/**
 * Find all roaming NPCs currently at a given place.
 * Returns array of { npcEvent, npcDtag }.
 *
 * @param {Map} events — full event map
 * @param {string} placeDtag — place a-tag to check
 * @param {number} moveCount — player's total move count
 * @param {function} getNpcState — (dtag) => npc state object
 * @param {Array|null} roamingNpcs — pre-filtered list of { dtag, event } for roaming NPCs.
 *   When provided, skips the O(n) scan. Pass result of engine._getRoamingNpcList().
 */
export function findRoamingNpcsAtPlace(events, placeDtag, moveCount, getNpcState, roamingNpcs = null) {
  const results = [];

  function* candidates() {
    if (roamingNpcs) { yield* roamingNpcs; return; }
    for (const [dtag, event] of events) {
      if (getTag(event, 'type') !== 'npc') continue;
      if (getTags(event, 'route').length === 0) continue;
      yield { dtag, event };
    }
  }

  for (const { dtag, event } of candidates()) {
    const npcState = getNpcState(dtag);
    const currentPlace = calculateNpcPlace(event, moveCount, npcState?.state);
    if (currentPlace === placeDtag) {
      results.push({ npcEvent: event, npcDtag: dtag });
    }
  }
  return results;
}
