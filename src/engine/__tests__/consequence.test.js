/**
 * Tests for consequence dispatch (Phase 19).
 * Spec §2.11 — reusable outcomes with fixed execution order.
 */
import { describe, it, expect } from 'vitest';
import {
  ref, WORLD,
  makePlace, makeItem, makeConsequence, makePortal, makeRoamingNPC,
  buildEvents, makeEngine,
} from './helpers.js';

describe('_executeConsequence', () => {
  it('respawns player to target place', () => {
    const start = makePlace('arena');
    const respawnPlace = makePlace('entrance');
    const consequence = makeConsequence('death', {
      respawn: `${WORLD}:place:entrance`,
      content: 'You died.',
    });

    const events = buildEvents(start, respawnPlace, consequence);
    const engine = makeEngine(events, { place: ref(`${WORLD}:place:arena`) });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));
    expect(engine.player.state.place).toBe(ref(`${WORLD}:place:entrance`));
  });

  it('emits consequence content as narrative', () => {
    const start = makePlace('arena');
    const consequence = makeConsequence('death', {
      content: 'Darkness. Then the entrance tunnel.',
    });

    const events = buildEvents(start, consequence);
    const engine = makeEngine(events, { place: ref(`${WORLD}:place:arena`) });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    const narrative = engine.output.find((o) => o.text === 'Darkness. Then the entrance tunnel.');
    expect(narrative).toBeTruthy();
    expect(narrative.type).toBe('narrative');
  });

  it('drops inventory items at current place before clearing', () => {
    const sword = makeItem('sword');
    const shield = makeItem('shield');
    const arena = makePlace('arena');
    const entrance = makePlace('entrance');
    const consequence = makeConsequence('death', {
      respawn: `${WORLD}:place:entrance`,
      clears: ['inventory'],
    });

    const events = buildEvents(sword, shield, arena, entrance, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`), ref(`${WORLD}:item:shield`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    // Inventory should be empty
    expect(engine.player.state.inventory).toEqual([]);

    // Items should be on the ground at the arena (death location)
    const arenaItems = engine.player.getPlaceItems(ref(`${WORLD}:place:arena`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:sword`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:shield`));
  });

  it('clears states map', () => {
    const arena = makePlace('arena');
    const consequence = makeConsequence('death', { clears: ['states'] });

    const events = buildEvents(arena, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      states: { [ref(`${WORLD}:feature:lever`)]: 'pulled' },
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    expect(engine.player.state.states).toEqual({});
  });

  it('clears counters map', () => {
    const arena = makePlace('arena');
    const consequence = makeConsequence('death', { clears: ['counters'] });

    const events = buildEvents(arena, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      counters: { [`${ref(`${WORLD}:item:lantern`)}:battery`]: 47 },
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    expect(engine.player.state.counters).toEqual({});
  });

  it('clears multiple keys at once in fixed order', () => {
    const sword = makeItem('sword');
    const arena = makePlace('arena');
    const entrance = makePlace('entrance');
    const consequence = makeConsequence('death', {
      respawn: `${WORLD}:place:entrance`,
      clears: ['inventory', 'states', 'counters', 'cryptoKeys'],
      content: 'Total reset.',
    });

    const events = buildEvents(sword, arena, entrance, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      states: { someRef: 'active' },
      counters: { someCounter: 10 },
      cryptoKeys: ['key123'],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    expect(engine.player.state.inventory).toEqual([]);
    expect(engine.player.state.states).toEqual({});
    expect(engine.player.state.counters).toEqual({});
    expect(engine.player.state.cryptoKeys).toEqual([]);
    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));

    // Sword dropped at arena
    const arenaItems = engine.player.getPlaceItems(ref(`${WORLD}:place:arena`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:sword`));
  });

  it('gives items before clears (fixed execution order)', () => {
    const sword = makeItem('sword');
    const arena = makePlace('arena');
    const consequence = makeConsequence('death', {
      giveItems: [`${WORLD}:item:sword`],
      clears: ['inventory'],
    });

    const events = buildEvents(sword, arena, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    // Sword was given, then inventory was cleared (dropped at arena)
    expect(engine.player.state.inventory).toEqual([]);
    const arenaItems = engine.player.getPlaceItems(ref(`${WORLD}:place:arena`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:sword`));
  });

  it('consumes items before clears', () => {
    const sword = makeItem('sword');
    const shield = makeItem('shield');
    const arena = makePlace('arena');
    const consequence = makeConsequence('death', {
      consumeItems: [`${WORLD}:item:sword`],
      clears: ['inventory'],
    });

    const events = buildEvents(sword, shield, arena, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`), ref(`${WORLD}:item:shield`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    engine._executeConsequence(ref(`${WORLD}:consequence:death`));

    // Sword consumed (not dropped), shield dropped at arena
    expect(engine.player.state.inventory).toEqual([]);
    const arenaItems = engine.player.getPlaceItems(ref(`${WORLD}:place:arena`));
    expect(arenaItems).not.toContain(ref(`${WORLD}:item:sword`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:shield`));
  });

  it('is no-op for missing consequence ref', () => {
    const arena = makePlace('arena');
    const events = buildEvents(arena);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    // Should not throw
    engine._executeConsequence(ref(`${WORLD}:consequence:nonexistent`));

    // Nothing changed
    expect(engine.player.state.inventory).toEqual([ref(`${WORLD}:item:sword`)]);
    expect(engine.output).toEqual([]);
  });
});

describe('consequence dispatch sites', () => {
  it('NPC on-encounter fires consequence', () => {
    const entrance = makePlace('entrance');
    const arena = makePlace('arena', { npcs: [`${WORLD}:npc:grue`] });
    const grue = makeRoamingNPC('grue', {
      routes: [`${WORLD}:place:arena`],
      onEncounter: [['player', 'consequence', ref(`${WORLD}:consequence:death`)]],
    });
    const consequence = makeConsequence('death', {
      respawn: `${WORLD}:place:entrance`,
      clears: ['inventory'],
      content: 'The grue eats you.',
    });
    const sword = makeItem('sword');

    const events = buildEvents(entrance, arena, grue, consequence, sword);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    // Fire encounter manually
    engine._fireNpcEncounter(grue, ref(`${WORLD}:npc:grue`));

    // Player should be respawned at entrance
    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));
    expect(engine.player.state.inventory).toEqual([]);

    // Sword dropped at arena
    const arenaItems = engine.player.getPlaceItems(ref(`${WORLD}:place:arena`));
    expect(arenaItems).toContain(ref(`${WORLD}:item:sword`));
  });

  it('on-counter crossing fires consequence', () => {
    const arena = makePlace('arena');
    const entrance = makePlace('entrance');
    const lantern = makeItem('lantern', {
      state: 'on',
      counters: [['battery', 200]],
      onMove: [['on', 'decrement', 'battery', '1']],
      onCounter: [['battery', '0', 'consequence', ref(`${WORLD}:consequence:lamp-dies`)]],
    });
    const consequence = makeConsequence('lamp-dies', {
      respawn: `${WORLD}:place:entrance`,
      content: 'The lantern dies. Darkness takes you.',
    });

    const events = buildEvents(arena, entrance, lantern, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:lantern`)],
      states: { [ref(`${WORLD}:item:lantern`)]: 'on' },
      counters: { [`${ref(`${WORLD}:item:lantern`)}:battery`]: 1 },
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    // Process on-move — battery goes from 1 → 0, crosses threshold
    engine.processOnMove();

    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));
    const msg = engine.output.find((o) => o.text === 'The lantern dies. Darkness takes you.');
    expect(msg).toBeTruthy();
  });

  it('lethal portal fires consequence on requires failure', () => {
    const arena = makePlace('arena', {
      extraTags: [['exit', ref(`${WORLD}:place:chasm`), 'north', 'A narrow ledge.']],
    });
    const chasm = makePlace('chasm');
    const entrance = makePlace('entrance');
    const portal = makePortal('lethal-bridge', [
      [`${WORLD}:place:arena`, 'north', 'Across the chasm.'],
      [`${WORLD}:place:chasm`, 'south', 'Back.'],
    ], {
      requires: [[ref(`${WORLD}:feature:bridge`), 'built', 'The ledge crumbles beneath you.']],
      extraTags: [['consequence', ref(`${WORLD}:consequence:fell`)]],
    });
    const consequence = makeConsequence('fell', {
      respawn: `${WORLD}:place:entrance`,
      content: 'You fall into the darkness below.',
    });

    const events = buildEvents(arena, chasm, entrance, portal, consequence);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);

    // Try to move north — requires fails, consequence should fire
    engine.handleMove('north');

    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));
    const msg = engine.output.find((o) => o.text === 'You fall into the darkness below.');
    expect(msg).toBeTruthy();
    // The requires failure reason should also be emitted
    const reason = engine.output.find((o) => o.text === 'The ledge crumbles beneath you.');
    expect(reason).toBeTruthy();
  });
});
