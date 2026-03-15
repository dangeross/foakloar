/**
 * parser.js — Pure functions for command parsing.
 * No React imports. No side effects.
 */

import { getTag, getTags, dtagFromRef } from '../world.js';

const PREPOSITIONS = ['on', 'with', 'to', 'at', 'in', 'into'];

/**
 * Strip leading articles (the, a, an) from a noun string.
 */
export function stripArticles(noun) {
  return noun.replace(/^(?:the|a|an)\s+/, '');
}

/**
 * Build a verb alias map from events in the current place + inventory + extra sources.
 * Returns Map<alias, canonicalVerb>.
 * @param {Object[]} [extraEvents] — additional verb sources (e.g. roaming NPCs)
 */
export function buildVerbMap(events, placeEvent, inventoryDtags, extraEvents = []) {
  const map = new Map();
  const sources = [];

  if (placeEvent) {
    for (const type of ['feature', 'item', 'npc']) {
      for (const ref of getTags(placeEvent, type)) {
        const ev = events.get(dtagFromRef(ref[1]));
        if (ev) sources.push(ev);
      }
    }
  }

  for (const dtag of inventoryDtags) {
    const ev = events.get(dtag);
    if (ev) sources.push(ev);
  }

  for (const ev of extraEvents) {
    sources.push(ev);
  }

  for (const ev of sources) {
    for (const vt of getTags(ev, 'verb')) {
      const canonical = vt[1];
      for (let i = 1; i < vt.length; i++) {
        map.set(vt[i].toLowerCase(), canonical);
      }
    }
  }
  return map;
}

/**
 * Parse raw input into { verb, noun1, preposition, noun2 } or null.
 */
export function parseInput(input, verbMap) {
  const aliases = [...verbMap.keys()].sort((a, b) => b.length - a.length);

  let canonical = null;
  let rest = input;

  for (const alias of aliases) {
    if (input === alias || input.startsWith(alias + ' ')) {
      canonical = verbMap.get(alias);
      rest = input.slice(alias.length).trim();
      break;
    }
  }

  if (!canonical) return null;

  let noun1 = rest;
  let preposition = null;
  let noun2 = null;

  for (const prep of PREPOSITIONS) {
    const pattern = ` ${prep} `;
    const idx = rest.indexOf(pattern);
    if (idx !== -1) {
      noun1 = rest.slice(0, idx).trim();
      preposition = prep;
      noun2 = rest.slice(idx + pattern.length).trim();
      break;
    }
    if (rest.startsWith(prep + ' ')) {
      noun1 = rest.slice(prep.length + 1).trim();
      preposition = prep;
      break;
    }
  }

  return { verb: canonical, noun1: noun1 || null, preposition, noun2: noun2 || null };
}

/**
 * Find an inventory item by noun match.
 * Returns { event, dtag } or null.
 */
export function findInventoryItem(events, inventoryDtags, noun) {
  for (const dtag of inventoryDtags) {
    const event = events.get(dtag);
    if (!event) continue;
    const title = getTag(event, 'title')?.toLowerCase() || '';
    if (title.includes(noun)) return { event, dtag };
    for (const nt of getTags(event, 'noun')) {
      for (let i = 1; i < nt.length; i++) {
        if (nt[i].toLowerCase() === noun) return { event, dtag };
      }
    }
  }
  return null;
}
