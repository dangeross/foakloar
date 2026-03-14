import { AUTHOR_PUBKEY, WORLD_TAG } from './config.js';

const A_PREFIX = `30078:${AUTHOR_PUBKEY}:${WORLD_TAG}`;

export function getTag(event, name) {
  return event.tags.find((t) => t[0] === name)?.[1];
}

export function getTags(event, name) {
  return event.tags.filter((t) => t[0] === name);
}

export function getEventByDTag(events, dtag) {
  return events.get(dtag);
}

export function dtagFromRef(ref) {
  return ref.replace(/^30078:[^:]+:/, '');
}

/**
 * Check requires tags on an event against player flags.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function checkRequires(event, playerFlags) {
  const requiresTags = getTags(event, 'requires');
  for (const tag of requiresTags) {
    const flag = tag[1];
    const failDesc = tag[2] || "You can't do that.";
    if (!playerFlags[flag]) {
      return { allowed: false, reason: failDesc };
    }
  }
  return { allowed: true };
}

/**
 * Find a feature or item in the current place by noun match.
 */
export function findByNoun(events, placeEvent, noun) {
  const types = ['feature', 'item'];
  for (const type of types) {
    const refs = getTags(placeEvent, type);
    for (const ref of refs) {
      const dtag = dtagFromRef(ref[1]);
      const event = events.get(dtag);
      if (!event) continue;

      const title = getTag(event, 'title')?.toLowerCase() || '';
      if (title.toLowerCase().includes(noun)) return { event, dtag, type };

      const nounTags = getTags(event, 'noun');
      for (const nt of nounTags) {
        for (let i = 1; i < nt.length; i++) {
          if (nt[i].toLowerCase() === noun) return { event, dtag, type };
        }
      }
    }
  }
  return null;
}

/**
 * For a given place d-tag, find all portals that reference it and return
 * resolved exits: { slot, label, destinationDTag, portalEvent }
 */
export function resolveExits(events, placeDTag) {
  const exits = [];

  for (const [, event] of events) {
    if (getTag(event, 'type') !== 'portal') continue;

    const exitTags = getTags(event, 'exit');
    for (let i = 0; i < exitTags.length; i++) {
      const tag = exitTags[i];
      // Portal exit shape: ["exit", "<place-ref>", "<slot>", "<label?>"]
      const ref = tag[1];
      if (!ref.includes(':place:')) continue;

      const refDTag = ref.replace(`30078:${AUTHOR_PUBKEY}:`, '');
      if (refDTag !== placeDTag) continue;

      const slot = tag[2];
      const label = tag[3] || '';

      for (let j = 0; j < exitTags.length; j++) {
        if (j === i) continue;
        const destRef = exitTags[j][1];
        const destDTag = destRef.replace(`30078:${AUTHOR_PUBKEY}:`, '');

        exits.push({ slot, label, destinationDTag: destDTag, portalEvent: event });
      }
    }
  }

  return exits;
}
