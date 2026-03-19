/**
 * Tests for contains (containers) and drop command.
 */
import { describe, it, expect } from 'vitest';
import { makePlace, makeItem, makeFeature, buildEvents, makeEngine, ref, WORLD } from './helpers.js';

describe('contains — item containers', () => {
  function setup() {
    const sack = makeItem('sack', {
      nouns: [['sack']],
      extraTags: [
        ['contains', ref(`${WORLD}:item:bread`), '', ''],
        ['contains', ref(`${WORLD}:item:garlic`), '', ''],
      ],
    });
    const bread = makeItem('bread', { nouns: [['bread']] });
    const garlic = makeItem('garlic', { nouns: [['garlic']] });
    const place = makePlace('start', { items: [`${WORLD}:item:sack`] });
    const events = buildEvents(place, sack, bread, garlic);
    return makeEngine(events, { place: ref(`${WORLD}:place:start`) });
  }

  it('take X from Y extracts item from ground container', async () => {
    const engine = setup();
    engine.enterRoom();
    await engine.handleCommand('take sack');
    await engine.handleCommand('take bread from sack');
    expect(engine.player.hasItem(ref(`${WORLD}:item:bread`))).toBe(true);
  });

  it('take all from Y extracts all items', async () => {
    const engine = setup();
    engine.enterRoom();
    await engine.handleCommand('take sack');
    await engine.handleCommand('take all from sack');
    expect(engine.player.hasItem(ref(`${WORLD}:item:bread`))).toBe(true);
    expect(engine.player.hasItem(ref(`${WORLD}:item:garlic`))).toBe(true);
  });
});

describe('contains — feature containers with state gate', () => {
  function setup() {
    const chest = makeFeature('chest', {
      state: 'closed',
      nouns: [['chest']],
      verbs: [['open']],
      transitions: [['closed', 'open', 'You open the chest.']],
      onInteract: [['open', 'set-state', 'open']],
      extraTags: [
        ['contains', ref(`${WORLD}:item:key`), 'open', 'The chest is closed.'],
      ],
    });
    const key = makeItem('key', { nouns: [['key']] });
    const place = makePlace('start', { features: [`${WORLD}:feature:chest`] });
    const events = buildEvents(place, chest, key);
    return makeEngine(events, { place: ref(`${WORLD}:place:start`) });
  }

  it('blocks take when feature is in wrong state', async () => {
    const engine = setup();
    engine.enterRoom();
    const output = engine.flush();
    await engine.handleCommand('take key from chest');
    const msgs = engine.flush();
    expect(msgs.some((m) => m.text.includes('closed'))).toBe(true);
    expect(engine.player.hasItem(ref(`${WORLD}:item:key`))).toBe(false);
  });

  it('allows take when feature is in correct state', async () => {
    const engine = setup();
    engine.enterRoom();
    engine.flush();
    await engine.handleCommand('open chest');
    engine.flush();
    await engine.handleCommand('take key from chest');
    expect(engine.player.hasItem(ref(`${WORLD}:item:key`))).toBe(true);
  });
});

describe('drop command', () => {
  it('moves item from inventory to ground', async () => {
    const sword = makeItem('sword', { nouns: [['sword']] });
    const place = makePlace('start', {});
    const events = buildEvents(place, sword);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:start`),
      inventory: [ref(`${WORLD}:item:sword`)],
    });
    engine.enterRoom();
    engine.flush();
    await engine.handleCommand('drop sword');
    expect(engine.player.hasItem(ref(`${WORLD}:item:sword`))).toBe(false);
    const msgs = engine.flush();
    expect(msgs.some((m) => m.text.includes('drop') || m.text.includes('Sword'))).toBe(true);
  });

  it('errors when item not in inventory', async () => {
    const place = makePlace('start', {});
    const events = buildEvents(place);
    const engine = makeEngine(events, { place: ref(`${WORLD}:place:start`) });
    engine.enterRoom();
    engine.flush();
    await engine.handleCommand('drop sword');
    const msgs = engine.flush();
    expect(msgs.some((m) => m.type === 'error')).toBe(true);
  });
});
