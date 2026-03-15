import { describe, it, expect } from 'vitest';
import { stripArticles, buildVerbMap, parseInput, findInventoryItem } from '../parser.js';
import { makeFeature, makeItem, makePlace, buildEvents, ref, WORLD } from './helpers.js';

describe('stripArticles', () => {
  it('removes "the"', () => {
    expect(stripArticles('the lantern')).toBe('lantern');
  });

  it('removes "a"', () => {
    expect(stripArticles('a sword')).toBe('sword');
  });

  it('removes "an"', () => {
    expect(stripArticles('an apple')).toBe('apple');
  });

  it('leaves non-article words alone', () => {
    expect(stripArticles('brass lantern')).toBe('brass lantern');
  });

  it('only strips leading article', () => {
    expect(stripArticles('the the thing')).toBe('the thing');
  });
});

describe('buildVerbMap', () => {
  it('builds map from feature verb tags', () => {
    const lever = makeFeature('lever', {
      verbs: [['pull', 'yank', 'tug']],
      nouns: [['lever']],
    });
    const place = makePlace('room', {
      features: [`${WORLD}:feature:lever`],
    });
    const events = buildEvents(place, lever);
    const map = buildVerbMap(events, place, []);

    expect(map.get('pull')).toBe('pull');
    expect(map.get('yank')).toBe('pull');
    expect(map.get('tug')).toBe('pull');
  });

  it('includes inventory item verbs', () => {
    const sword = makeItem('sword', {
      verbs: [['swing', 'slash']],
      nouns: [['sword']],
    });
    const place = makePlace('room');
    const events = buildEvents(place, sword);
    const map = buildVerbMap(events, place, [`${WORLD}:item:sword`]);

    expect(map.get('swing')).toBe('swing');
    expect(map.get('slash')).toBe('swing');
  });

  it('handles multiple verb tags from different sources', () => {
    const lever = makeFeature('lever', {
      verbs: [['pull']],
      nouns: [['lever']],
    });
    const button = makeFeature('button', {
      verbs: [['press', 'push']],
      nouns: [['button']],
    });
    const place = makePlace('room', {
      features: [`${WORLD}:feature:lever`, `${WORLD}:feature:button`],
    });
    const events = buildEvents(place, lever, button);
    const map = buildVerbMap(events, place, []);

    expect(map.get('pull')).toBe('pull');
    expect(map.get('press')).toBe('press');
    expect(map.get('push')).toBe('press');
  });
});

describe('parseInput', () => {
  const verbMap = new Map([
    ['examine', 'examine'],
    ['x', 'examine'],
    ['look at', 'examine'],
    ['pull', 'pull'],
    ['use', 'use'],
  ]);

  it('parses simple verb + noun', () => {
    const result = parseInput('examine lever', verbMap);
    expect(result).toEqual({ verb: 'examine', noun1: 'lever', preposition: null, noun2: null });
  });

  it('matches multi-word aliases', () => {
    const result = parseInput('look at lever', verbMap);
    expect(result).toEqual({ verb: 'examine', noun1: 'lever', preposition: null, noun2: null });
  });

  it('matches short aliases', () => {
    const result = parseInput('x lever', verbMap);
    expect(result).toEqual({ verb: 'examine', noun1: 'lever', preposition: null, noun2: null });
  });

  it('parses two-noun with preposition', () => {
    const result = parseInput('use key on door', verbMap);
    expect(result).toEqual({ verb: 'use', noun1: 'key', preposition: 'on', noun2: 'door' });
  });

  it('returns null for unknown verb', () => {
    expect(parseInput('dance wildly', verbMap)).toBeNull();
  });

  it('returns verb with null noun1 for bare verb', () => {
    const result = parseInput('examine', verbMap);
    expect(result).toEqual({ verb: 'examine', noun1: null, preposition: null, noun2: null });
  });
});

describe('findInventoryItem', () => {
  it('finds item by title match', () => {
    const sword = makeItem('sword', { nouns: [['sword']] });
    const events = buildEvents(sword);
    const result = findInventoryItem(events, [`${WORLD}:item:sword`], 'sword');
    expect(result).not.toBeNull();
    expect(result.dtag).toBe(`${WORLD}:item:sword`);
  });

  it('finds item by noun alias', () => {
    const lantern = makeItem('lantern', { nouns: [['lantern', 'lamp', 'brass lantern']] });
    const events = buildEvents(lantern);
    const result = findInventoryItem(events, [`${WORLD}:item:lantern`], 'lamp');
    expect(result).not.toBeNull();
  });

  it('returns null for non-matching noun', () => {
    const sword = makeItem('sword', { nouns: [['sword']] });
    const events = buildEvents(sword);
    expect(findInventoryItem(events, [`${WORLD}:item:sword`], 'shield')).toBeNull();
  });

  it('returns null for empty inventory', () => {
    const sword = makeItem('sword');
    const events = buildEvents(sword);
    expect(findInventoryItem(events, [], 'sword')).toBeNull();
  });
});
