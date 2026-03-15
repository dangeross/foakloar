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
 * Resolve the current state of an event ref against player state.
 * Returns the state string for the ref's type, or null if not applicable.
 */
function resolveRefState(dtag, refType, playerState) {
  if (refType === 'item') return playerState.itemStates?.[dtag] ?? null;
  if (refType === 'feature') return playerState.featureStates?.[dtag] ?? null;
  if (refType === 'puzzle') return playerState.puzzlesSolved?.includes(dtag) ? 'solved' : 'unsolved';
  return null;
}

/**
 * Check requires and requires-not tags on an event against player state.
 * Spec shapes:
 *   ["requires",     "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
 *   ["requires-not", "<event-ref>", "<state-or-blank>", "<description-or-blank>"]
 *
 * Resolves the referenced event, checks its type tag, then dispatches:
 *   item    — blank state = player holds it; non-blank = must be in that state
 *   feature — checks featureStates
 *   puzzle  — checks puzzlesSolved (state "solved" / "unsolved")
 *   portal  — checks portalStates (future)
 *
 * requires-not inverts the check: fails if the condition IS met.
 *
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function checkRequires(event, playerState, events) {
  // --- requires ---
  for (const tag of getTags(event, 'requires')) {
    const ref = tag[1];
    const expectedState = tag[2] || '';
    const failDesc = tag[3] || "You can't do that.";
    const dtag = dtagFromRef(ref);

    const refEvent = events?.get(dtag);
    const refType = refEvent ? getTag(refEvent, 'type') : '';

    if (refType === 'item') {
      if (!playerState.inventory.includes(dtag)) {
        return { allowed: false, reason: failDesc };
      }
      if (expectedState) {
        const currentState = playerState.itemStates?.[dtag];
        if (currentState !== expectedState) {
          return { allowed: false, reason: failDesc };
        }
      }
    } else if (refType === 'puzzle') {
      if (expectedState === 'solved') {
        if (!playerState.puzzlesSolved?.includes(dtag)) {
          return { allowed: false, reason: failDesc };
        }
      }
    } else if (refType === 'feature') {
      const currentState = playerState.featureStates?.[dtag];
      if (expectedState && currentState !== expectedState) {
        return { allowed: false, reason: failDesc };
      }
    } else {
      return { allowed: false, reason: failDesc };
    }
  }

  // --- requires-not ---
  for (const tag of getTags(event, 'requires-not')) {
    const ref = tag[1];
    const forbiddenState = tag[2] || '';
    const failDesc = tag[3] || "You can't do that.";
    const dtag = dtagFromRef(ref);

    const refEvent = events?.get(dtag);
    const refType = refEvent ? getTag(refEvent, 'type') : '';

    if (refType === 'item') {
      const hasItem = playerState.inventory.includes(dtag);
      if (!forbiddenState) {
        // requires-not with blank state = must NOT hold the item
        if (hasItem) return { allowed: false, reason: failDesc };
      } else {
        // requires-not with state = must NOT be in that state (if held)
        if (hasItem && playerState.itemStates?.[dtag] === forbiddenState) {
          return { allowed: false, reason: failDesc };
        }
      }
    } else if (refType === 'puzzle') {
      const currentState = resolveRefState(dtag, refType, playerState);
      if (forbiddenState && currentState === forbiddenState) {
        return { allowed: false, reason: failDesc };
      }
    } else if (refType === 'feature') {
      const currentState = playerState.featureStates?.[dtag];
      if (forbiddenState && currentState === forbiddenState) {
        return { allowed: false, reason: failDesc };
      }
    } else {
      // Unknown ref on requires-not — pass (fail open, since it's a negative gate)
    }
  }

  return { allowed: true };
}

/**
 * Find a feature or item in the current place by noun match.
 */
export function findByNoun(events, placeEvent, noun) {
  const types = ['feature', 'item', 'npc'];
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
 * Get the default state of a feature from its state tag.
 */
export function getDefaultState(event) {
  return getTag(event, 'state');
}

/**
 * Find a transition from currentState to targetState.
 * Returns { from, to, text } or null.
 */
export function findTransition(event, currentState, targetState) {
  for (const tag of getTags(event, 'transition')) {
    if (tag[1] === currentState && tag[2] === targetState) {
      return { from: tag[1], to: tag[2], text: tag[3] || '' };
    }
  }
  return null;
}

/**
 * For a given place d-tag, find all portals that reference it and return
 * resolved exits: { slot, label, destinationDTag, portalEvent }
 * Portals in state "hidden" are filtered out unless overridden by playerState.
 */
export function resolveExits(events, placeDTag, playerState) {
  const exits = [];

  for (const [, event] of events) {
    if (getTag(event, 'type') !== 'portal') continue;

    // Check portal visibility — default state from event, overridden by player state
    const portalDTag = getTag(event, 'd');
    const defaultState = getTag(event, 'state');
    const currentState = playerState?.portalStates?.[portalDTag] ?? defaultState;
    if (currentState === 'hidden') continue;

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
