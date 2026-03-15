/**
 * actions.js — Unified action resolution.
 * No React imports. All functions take engine context as parameters.
 */

import {
  getTag, getTags, dtagFromRef, getDefaultState, findTransition,
  checkRequires,
} from '../world.js';

/**
 * Apply a set-state action on an external target event.
 * Handles clue, puzzle, portal, feature types.
 * Returns { acted, puzzleActivated } where puzzleActivated is a dtag or null.
 */
export function applyExternalSetState(targetRef, targetState, events, player, emit, emitHtml) {
  const targetDTag = dtagFromRef(targetRef);
  const targetEvent = events.get(targetDTag);
  if (!targetEvent) return { acted: false, puzzleActivated: null };

  const targetType = getTag(targetEvent, 'type');

  if (targetType === 'clue') {
    player.markClueSeen(targetDTag);
    emit(`\n${getTag(targetEvent, 'title')}:`, 'clue-title');
    emit(targetEvent.content, 'clue');
    return { acted: true, puzzleActivated: null };
  }

  if (targetType === 'puzzle') {
    if (player.isPuzzleSolved(targetDTag)) {
      emit('You have already solved this.', 'narrative');
    } else {
      emit(`\nA riddle appears:`, 'puzzle-title');
      emit(targetEvent.content, 'puzzle');
      emit('Type your answer...', 'hint');
      return { acted: true, puzzleActivated: targetDTag };
    }
    return { acted: true, puzzleActivated: null };
  }

  if (targetType === 'portal') {
    const portalCurrentState = player.getPortalState(targetDTag) ?? getDefaultState(targetEvent);
    if (portalCurrentState !== targetState) {
      player.setPortalState(targetDTag, targetState);
      const transition = findTransition(targetEvent, portalCurrentState, targetState);
      if (transition?.text) emit(transition.text, 'narrative');
    }
    return { acted: true, puzzleActivated: null };
  }

  if (targetType === 'feature') {
    const featCurrentState = player.getFeatureState(targetDTag) ?? getDefaultState(targetEvent);
    if (featCurrentState !== targetState) {
      player.setFeatureState(targetDTag, targetState);
      const transition = findTransition(targetEvent, featCurrentState, targetState);
      if (transition?.text) emit(transition.text, 'narrative');
    }
    return { acted: true, puzzleActivated: null };
  }

  return { acted: false, puzzleActivated: null };
}

/**
 * Give an item to the player — initialize state and counters.
 */
export function giveItem(itemRef, events, player, emit) {
  const itemDTag = dtagFromRef(itemRef);
  if (player.hasItem(itemDTag)) return;

  player.pickUp(itemDTag);
  const itemEvent = events.get(itemDTag);
  const itemDefaultState = itemEvent ? getDefaultState(itemEvent) : null;
  if (itemDefaultState) player.setItemState(itemDTag, itemDefaultState);

  if (itemEvent) {
    for (const ct of getTags(itemEvent, 'counter')) {
      player.setCounter(`${itemDTag}:${ct[1]}`, parseInt(ct[2], 10));
    }
  }
  const itemTitle = itemEvent ? getTag(itemEvent, 'title') : itemDTag;
  emit(`Received: ${itemTitle}`, 'item');
}

/**
 * Evaluate on-counter-low tags on state entry.
 * If counter is already below threshold and item is not already in the target state, fire the action.
 */
export function evalCounterLow(item, dtag, currentState, player, emit) {
  for (const lt of getTags(item, 'on-counter-low')) {
    const counterName = lt[1];
    const threshold = parseInt(lt[2], 10);
    const action = lt[3];
    const actionTarget = lt[4];

    const key = `${dtag}:${counterName}`;
    const val = player.getCounter(key);
    if (val === undefined || val > threshold || val <= 0) continue;

    if (currentState === actionTarget) continue;

    if (action === 'set-state' && actionTarget) {
      const transition = findTransition(item, currentState, actionTarget);
      if (transition) {
        player.setItemState(dtag, transition.to);
        if (transition.text) emit(transition.text, 'narrative');
        currentState = transition.to;
      }
    }
  }
}

/**
 * Evaluate sequence puzzles in the current room after feature state changes.
 */
export function evalSequencePuzzles(place, events, player, emit) {
  if (!place) return;

  for (const ref of getTags(place, 'puzzle')) {
    const pDTag = dtagFromRef(ref[1]);
    if (player.isPuzzleSolved(pDTag)) continue;
    const puzzleEvent = events.get(pDTag);
    if (!puzzleEvent) continue;

    const puzzleType = getTag(puzzleEvent, 'puzzle-type');
    if (puzzleType !== 'sequence') continue;

    const reqResult = checkRequires(puzzleEvent, player.state, events);
    if (!reqResult.allowed) continue;

    // All requires pass — puzzle solved!
    player.markPuzzleSolved(pDTag);
    emit('Something clicks into place.', 'success');

    // Fire on-complete actions
    for (const tag of getTags(puzzleEvent, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'set-state' && extRef) {
        const targetDTag = dtagFromRef(extRef);
        const targetEvent = events.get(targetDTag);
        if (!targetEvent) continue;
        const targetType = getTag(targetEvent, 'type');
        if (targetType === 'portal') {
          const portalCurrentState = player.getPortalState(targetDTag) ?? getDefaultState(targetEvent);
          if (portalCurrentState !== value) {
            player.setPortalState(targetDTag, value);
            const transition = findTransition(targetEvent, portalCurrentState, value);
            if (transition?.text) emit(transition.text, 'narrative');
          }
        } else if (targetType === 'feature') {
          const featCurrentState = player.getFeatureState(targetDTag) ?? getDefaultState(targetEvent);
          if (featCurrentState !== value) {
            player.setFeatureState(targetDTag, value);
            const transition = findTransition(targetEvent, featCurrentState, value);
            if (transition?.text) emit(transition.text, 'narrative');
          }
        }
      } else if (action === 'give-crypto-key') {
        player.addCryptoKey(value);
        emit('You feel a key take shape in your mind.', 'narrative');
      }
    }
  }
}
