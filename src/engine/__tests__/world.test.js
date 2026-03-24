import { describe, it, expect } from 'vitest';
import {
  getTag, getTags, dtagFromRef, aTagOf, getDefaultState, findTransition,
  checkRequires, findByNoun, resolveExits,
} from '../world.js';
import {
  ref, PUBKEY, WORLD,
  makeEvent, makePlace, makeFeature, makeItem, makePortal, makePuzzle,
  buildEvents, freshState,
} from './helpers.js';

describe('getTag', () => {
  it('returns first matching tag value', () => {
    const ev = makeEvent('test', [['type', 'place'], ['title', 'Room']]);
    expect(getTag(ev, 'type')).toBe('place');
    expect(getTag(ev, 'title')).toBe('Room');
  });

  it('returns undefined for missing tag', () => {
    const ev = makeEvent('test', []);
    expect(getTag(ev, 'type')).toBeUndefined();
  });
});

describe('getTags', () => {
  it('returns all matching tags', () => {
    const ev = makeEvent('test', [['exit', 'a', 'north'], ['exit', 'b', 'south']]);
    expect(getTags(ev, 'exit')).toHaveLength(2);
  });

  it('returns empty array for no matches', () => {
    const ev = makeEvent('test', []);
    expect(getTags(ev, 'exit')).toEqual([]);
  });
});

describe('dtagFromRef', () => {
  it('extracts d-tag from event ref', () => {
    expect(dtagFromRef(`30078:${PUBKEY}:test-world:place:room`)).toBe('test-world:place:room');
  });
});

describe('aTagOf', () => {
  it('constructs full a-tag from event', () => {
    const ev = makeEvent('test-world:place:room', [['type', 'place']]);
    expect(aTagOf(ev)).toBe(`30078:${PUBKEY}:test-world:place:room`);
  });
});

describe('getDefaultState', () => {
  it('returns state tag value', () => {
    const ev = makeFeature('door', { state: 'locked' });
    expect(getDefaultState(ev)).toBe('locked');
  });

  it('returns undefined when no state tag', () => {
    const ev = makeFeature('rock');
    expect(getDefaultState(ev)).toBeUndefined();
  });
});

describe('findTransition', () => {
  it('finds matching transition', () => {
    const ev = makeFeature('door', {
      state: 'locked',
      transitions: [['locked', 'open', 'The door swings open.']],
    });
    const t = findTransition(ev, 'locked', 'open');
    expect(t).toEqual({ from: 'locked', to: 'open', text: 'The door swings open.' });
  });

  it('returns null for no match', () => {
    const ev = makeFeature('door', {
      state: 'locked',
      transitions: [['locked', 'open', 'Opens.']],
    });
    expect(findTransition(ev, 'open', 'locked')).toBeNull();
  });
});

// ── checkRequires ───────────────────────────────────────────────────────

describe('checkRequires', () => {
  describe('requires item', () => {
    it('passes when player has item', () => {
      const key = makeItem('key');
      const door = makeFeature('door', {
        requires: [[ref(`${WORLD}:item:key`), '', 'You need the key.']],
      });
      const events = buildEvents(key, door);
      const state = freshState({ inventory: [ref(`${WORLD}:item:key`)] });
      expect(checkRequires(door, state, events).allowed).toBe(true);
    });

    it('fails when player lacks item', () => {
      const key = makeItem('key');
      const door = makeFeature('door', {
        requires: [[ref(`${WORLD}:item:key`), '', 'You need the key.']],
      });
      const events = buildEvents(key, door);
      const state = freshState();
      const result = checkRequires(door, state, events);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('You need the key.');
    });

    it('checks item state when specified', () => {
      const lantern = makeItem('lantern');
      const door = makeFeature('dark-room', {
        requires: [[ref(`${WORLD}:item:lantern`), 'on', 'You need a light.']],
      });
      const events = buildEvents(lantern, door);

      // Has item but wrong state
      const state1 = freshState({
        inventory: [ref(`${WORLD}:item:lantern`)],
        states: { [ref(`${WORLD}:item:lantern`)]: 'off' },
      });
      expect(checkRequires(door, state1, events).allowed).toBe(false);

      // Has item in correct state
      const state2 = freshState({
        inventory: [ref(`${WORLD}:item:lantern`)],
        states: { [ref(`${WORLD}:item:lantern`)]: 'on' },
      });
      expect(checkRequires(door, state2, events).allowed).toBe(true);
    });
  });

  describe('requires feature state', () => {
    it('passes when feature is in expected state', () => {
      const lever = makeFeature('lever', { state: 'up' });
      const gate = makeFeature('gate', {
        requires: [[ref(`${WORLD}:feature:lever`), 'down', 'Pull the lever first.']],
      });
      const events = buildEvents(lever, gate);
      const state = freshState({ states: { [ref(`${WORLD}:feature:lever`)]: 'down' } });
      expect(checkRequires(gate, state, events).allowed).toBe(true);
    });

    it('fails when feature is in wrong state', () => {
      const lever = makeFeature('lever', { state: 'up' });
      const gate = makeFeature('gate', {
        requires: [[ref(`${WORLD}:feature:lever`), 'down', 'Pull the lever first.']],
      });
      const events = buildEvents(lever, gate);
      const state = freshState({ states: { [ref(`${WORLD}:feature:lever`)]: 'up' } });
      expect(checkRequires(gate, state, events).allowed).toBe(false);
    });
  });

  describe('requires puzzle solved', () => {
    it('passes when puzzle is solved', () => {
      const puzzle = makePuzzle('riddle');
      const door = makeFeature('door', {
        requires: [[ref(`${WORLD}:puzzle:riddle`), 'solved', 'Solve the riddle.']],
      });
      const events = buildEvents(puzzle, door);
      const state = freshState({ states: { [ref(`${WORLD}:puzzle:riddle`)]: 'solved' } });
      expect(checkRequires(door, state, events).allowed).toBe(true);
    });

    it('fails when puzzle is unsolved', () => {
      const puzzle = makePuzzle('riddle');
      const door = makeFeature('door', {
        requires: [[ref(`${WORLD}:puzzle:riddle`), 'solved', 'Solve the riddle.']],
      });
      const events = buildEvents(puzzle, door);
      const state = freshState();
      expect(checkRequires(door, state, events).allowed).toBe(false);
    });
  });

  describe('requires-not', () => {
    it('passes when player does not have item', () => {
      const key = makeItem('key');
      const ev = makeEvent('test', [
        ['type', 'feature'],
        ['requires-not', ref(`${WORLD}:item:key`), '', 'You already have the key.'],
      ]);
      const events = buildEvents(key, ev);
      const state = freshState();
      expect(checkRequires(ev, state, events).allowed).toBe(true);
    });

    it('fails when player has forbidden item', () => {
      const key = makeItem('key');
      const ev = makeEvent('test', [
        ['type', 'feature'],
        ['requires-not', ref(`${WORLD}:item:key`), '', 'You already have the key.'],
      ]);
      const events = buildEvents(key, ev);
      const state = freshState({ inventory: [ref(`${WORLD}:item:key`)] });
      const result = checkRequires(ev, state, events);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('You already have the key.');
    });

    it('checks item state for requires-not', () => {
      const lantern = makeItem('lantern');
      const ev = makeEvent('test', [
        ['type', 'feature'],
        ['requires-not', ref(`${WORLD}:item:lantern`), 'broken', 'Your lantern is broken.'],
      ]);
      const events = buildEvents(lantern, ev);

      // Has item in non-forbidden state — passes
      const state1 = freshState({
        inventory: [ref(`${WORLD}:item:lantern`)],
        states: { [ref(`${WORLD}:item:lantern`)]: 'on' },
      });
      expect(checkRequires(ev, state1, events).allowed).toBe(true);

      // Has item in forbidden state — fails
      const state2 = freshState({
        inventory: [ref(`${WORLD}:item:lantern`)],
        states: { [ref(`${WORLD}:item:lantern`)]: 'broken' },
      });
      expect(checkRequires(ev, state2, events).allowed).toBe(false);
    });
  });

  it('multiple requires must all pass', () => {
    const key = makeItem('key');
    const lever = makeFeature('lever', { state: 'up' });
    const ev = makeEvent('gate', [
      ['type', 'feature'],
      ['requires', ref(`${WORLD}:item:key`), '', 'Need key.'],
      ['requires', ref(`${WORLD}:feature:lever`), 'down', 'Pull lever.'],
    ]);
    const events = buildEvents(key, lever, ev);

    // Only key — fails on lever
    const state1 = freshState({ inventory: [ref(`${WORLD}:item:key`)] });
    expect(checkRequires(ev, state1, events).allowed).toBe(false);

    // Both satisfied
    const state2 = freshState({
      inventory: [ref(`${WORLD}:item:key`)],
      states: { [ref(`${WORLD}:feature:lever`)]: 'down' },
    });
    expect(checkRequires(ev, state2, events).allowed).toBe(true);
  });
});

// ── findByNoun ──────────────────────────────────────────────────────────

describe('findByNoun', () => {
  it('finds feature by noun tag', () => {
    const lever = makeFeature('lever', { nouns: [['lever', 'switch']] });
    const place = makePlace('room', { features: [`${WORLD}:feature:lever`] });
    const events = buildEvents(place, lever);
    const result = findByNoun(events, place, 'switch');
    expect(result).not.toBeNull();
    expect(result.type).toBe('feature');
    expect(result.dtag).toBe(ref(`${WORLD}:feature:lever`));
  });

  it('finds item by title substring', () => {
    const sword = makeItem('rusty sword', { nouns: [['sword']] });
    const place = makePlace('room', { items: [`${WORLD}:item:rusty sword`] });
    const events = buildEvents(place, sword);
    const result = findByNoun(events, place, 'rusty');
    expect(result).not.toBeNull();
    expect(result.type).toBe('item');
  });

  it('returns null for unknown noun', () => {
    const place = makePlace('room');
    const events = buildEvents(place);
    expect(findByNoun(events, place, 'dragon')).toBeNull();
  });
});

// ── resolveExits ────────────────────────────────────────────────────────

describe('resolveExits', () => {
  it('resolves portal exits for a place', () => {
    const place1 = makePlace('room1', { exits: ['north'] });
    const place2 = makePlace('room2', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:room1`, 'north'],
      [`${WORLD}:place:room2`, 'south'],
    ]);
    const events = buildEvents(place1, place2, portal);
    const exits = resolveExits(events, ref(`${WORLD}:place:room1`), freshState());

    expect(exits).toHaveLength(1);
    expect(exits[0].slot).toBe('north');
    expect(exits[0].destinationDTag).toBe(ref(`${WORLD}:place:room2`));
  });

  it('hides portals with hidden state', () => {
    const place1 = makePlace('room1', { exits: ['north'] });
    const place2 = makePlace('room2', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:room1`, 'north'],
      [`${WORLD}:place:room2`, 'south'],
    ], { state: 'hidden' });
    const events = buildEvents(place1, place2, portal);
    const exits = resolveExits(events, ref(`${WORLD}:place:room1`), freshState());

    expect(exits).toHaveLength(0);
  });

  it('shows portal when player state overrides hidden', () => {
    const place1 = makePlace('room1', { exits: ['north'] });
    const place2 = makePlace('room2', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:room1`, 'north'],
      [`${WORLD}:place:room2`, 'south'],
    ], { state: 'hidden' });
    const events = buildEvents(place1, place2, portal);
    const state = freshState({ states: { [ref(`${WORLD}:portal:p1`)]: 'visible' } });
    const exits = resolveExits(events, ref(`${WORLD}:place:room1`), state);

    expect(exits).toHaveLength(1);
  });
});
