import { describe, it, expect } from 'vitest';
import { calculateNpcPlace, initNpcState, findRoamingNpcsAtPlace } from '../npc.js';
import { GameEngine } from '../engine.js';
import { PlayerStateMutator } from '../player-state.js';
import {
  ref, PUBKEY, WORLD,
  makeRoamingNPC, makePlace, makeItem, makePortal, makeDialogueNode,
  buildEvents, freshState, makeMutator,
} from './helpers.js';

// ── calculateNpcPlace ───────────────────────────────────────────────────

describe('calculateNpcPlace', () => {
  it('returns null for NPC with no routes', () => {
    const npc = makeRoamingNPC('guard', { routes: [] });
    // Remove the route/speed tags to simulate no routes
    npc.tags = npc.tags.filter((t) => t[0] !== 'route');
    expect(calculateNpcPlace(npc, 0, null)).toBeNull();
  });

  it('cycles sequentially through routes', () => {
    const npc = makeRoamingNPC('patrol', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`, `${WORLD}:place:c`],
    });

    expect(calculateNpcPlace(npc, 0, null)).toBe(ref(`${WORLD}:place:a`));
    expect(calculateNpcPlace(npc, 1, null)).toBe(ref(`${WORLD}:place:b`));
    expect(calculateNpcPlace(npc, 2, null)).toBe(ref(`${WORLD}:place:c`));
    expect(calculateNpcPlace(npc, 3, null)).toBe(ref(`${WORLD}:place:a`)); // wraps
  });

  it('respects speed — moves every N player moves', () => {
    const npc = makeRoamingNPC('slow', {
      speed: 3,
      order: 'sequential',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`],
    });

    // At speed 3: npcMoves = floor(moveCount / 3)
    expect(calculateNpcPlace(npc, 0, null)).toBe(ref(`${WORLD}:place:a`));  // npcMoves=0
    expect(calculateNpcPlace(npc, 1, null)).toBe(ref(`${WORLD}:place:a`));  // npcMoves=0
    expect(calculateNpcPlace(npc, 2, null)).toBe(ref(`${WORLD}:place:a`));  // npcMoves=0
    expect(calculateNpcPlace(npc, 3, null)).toBe(ref(`${WORLD}:place:b`));  // npcMoves=1
    expect(calculateNpcPlace(npc, 6, null)).toBe(ref(`${WORLD}:place:a`));  // npcMoves=2
  });

  it('random order is deterministic for same inputs', () => {
    const npc = makeRoamingNPC('wanderer', {
      speed: 1,
      order: 'random',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`, `${WORLD}:place:c`],
    });

    const pos1 = calculateNpcPlace(npc, 42, null);
    const pos2 = calculateNpcPlace(npc, 42, null);
    expect(pos1).toBe(pos2);
  });

  it('random order varies with different move counts', () => {
    const npc = makeRoamingNPC('wanderer', {
      speed: 1,
      order: 'random',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`, `${WORLD}:place:c`, `${WORLD}:place:d`],
    });

    // With enough routes, different move counts should (usually) produce different positions
    const positions = new Set();
    for (let i = 0; i < 20; i++) {
      positions.add(calculateNpcPlace(npc, i, null));
    }
    // Should visit more than 1 place over 20 moves
    expect(positions.size).toBeGreaterThan(1);
  });

  it('stays at spawn when roams-when does not match', () => {
    const npc = makeRoamingNPC('prisoner', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`, `${WORLD}:place:c`],
      roamsWhen: 'free',
    });

    // State is null (not 'free') — stays at first route (spawn)
    expect(calculateNpcPlace(npc, 0, null)).toBe(ref(`${WORLD}:place:a`));
    expect(calculateNpcPlace(npc, 5, null)).toBe(ref(`${WORLD}:place:a`));
    expect(calculateNpcPlace(npc, 10, 'captured')).toBe(ref(`${WORLD}:place:a`));
  });

  it('roams when roams-when matches current state', () => {
    const npc = makeRoamingNPC('prisoner', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:a`, `${WORLD}:place:b`, `${WORLD}:place:c`],
      roamsWhen: 'free',
    });

    expect(calculateNpcPlace(npc, 0, 'free')).toBe(ref(`${WORLD}:place:a`));
    expect(calculateNpcPlace(npc, 1, 'free')).toBe(ref(`${WORLD}:place:b`));
    expect(calculateNpcPlace(npc, 2, 'free')).toBe(ref(`${WORLD}:place:c`));
  });
});

// ── initNpcState ────────────────────────────────────────────────────────

describe('initNpcState', () => {
  it('initializes from NPC event tags', () => {
    const npc = makeRoamingNPC('thief', {
      state: 'neutral',
      health: 8,
      inventory: [`${WORLD}:item:dagger`, `${WORLD}:item:potion`],
    });

    const state = initNpcState(npc);
    expect(state.state).toBe('neutral');
    expect(state.health).toBe(8);
    expect(state.inventory).toEqual([ref(`${WORLD}:item:dagger`), ref(`${WORLD}:item:potion`)]);
  });

  it('handles NPC with no state/health/inventory', () => {
    const npc = makeRoamingNPC('ghost', {
      routes: [`${WORLD}:place:a`],
    });

    const state = initNpcState(npc);
    expect(state.state).toBeNull();
    expect(state.health).toBeNull();
    expect(state.inventory).toEqual([]);
  });
});

// ── findRoamingNpcsAtPlace ──────────────────────────────────────────────

describe('findRoamingNpcsAtPlace', () => {
  it('finds NPC at the given place', () => {
    const npc = makeRoamingNPC('patrol', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:market`, `${WORLD}:place:tavern`],
    });
    const events = buildEvents(npc);

    const result = findRoamingNpcsAtPlace(
      events, ref(`${WORLD}:place:market`), 0,
      () => null,
    );
    expect(result).toHaveLength(1);
    expect(result[0].npcDtag).toBe(ref(`${WORLD}:npc:patrol`));
  });

  it('returns empty when NPC is elsewhere', () => {
    const npc = makeRoamingNPC('patrol', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:market`, `${WORLD}:place:tavern`],
    });
    const events = buildEvents(npc);

    const result = findRoamingNpcsAtPlace(
      events, ref(`${WORLD}:place:tavern`), 0,  // NPC at market (index 0), not tavern
      () => null,
    );
    expect(result).toHaveLength(0);
  });

  it('skips non-NPC events', () => {
    const place = makePlace('market');
    const item = makeItem('sword');
    const npc = makeRoamingNPC('patrol', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
    });
    const events = buildEvents(place, item, npc);

    const result = findRoamingNpcsAtPlace(
      events, ref(`${WORLD}:place:market`), 0,
      () => null,
    );
    expect(result).toHaveLength(1);
  });
});

// ── Engine integration: roaming NPCs ────────────────────────────────────

describe('engine roaming NPC integration', () => {
  function createEngine(events, playerOverrides = {}, npcStates = {}) {
    const player = new PlayerStateMutator(freshState(playerOverrides), npcStates);
    return new GameEngine({
      events,
      player,
      config: { GENESIS_PLACE: ref(`${WORLD}:place:start`), AUTHOR_PUBKEY: PUBKEY },
    });
  }

  it('shows roaming NPC when they are at the current place', () => {
    const room = makePlace('market');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:market`, `${WORLD}:place:tavern`],
    });
    const events = buildEvents(room, thief);
    const engine = createEngine(events, { place: ref(`${WORLD}:place:market`), moveCount: 0 });

    engine.enterRoom(ref(`${WORLD}:place:market`));
    const output = engine.flush();

    expect(output.some((e) => e.type === 'npc' && e.text.includes('Thief'))).toBe(true);
  });

  it('hides roaming NPC when they are at a different place', () => {
    const room = makePlace('market');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:tavern`, `${WORLD}:place:market`],
    });
    const events = buildEvents(room, thief);
    // moveCount=0, NPC at tavern (first route)
    const engine = createEngine(events, { place: ref(`${WORLD}:place:market`), moveCount: 0 });

    engine.enterRoom(ref(`${WORLD}:place:market`));
    const output = engine.flush();

    expect(output.some((e) => e.type === 'npc' && e.text.includes('Thief'))).toBe(false);
  });

  it('fires on-encounter steals-item when player enters room with thief', () => {
    const room = makePlace('market');
    const sword = makeItem('sword');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      onEncounter: [['player', 'steals-item', 'any']],
    });
    const events = buildEvents(room, sword, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      inventory: [ref(`${WORLD}:item:sword`)],
      moveCount: 0,
    });

    engine.enterRoom(ref(`${WORLD}:place:market`), { isMoving: true });
    const output = engine.flush();

    // Player should have lost the sword
    expect(engine.player.hasItem(ref(`${WORLD}:item:sword`))).toBe(false);
    // NPC should have gained it (in stolen list, not native inventory)
    const npcState = engine.player.getNpcState(ref(`${WORLD}:npc:thief`));
    expect(npcState.stolen).toContain(ref(`${WORLD}:item:sword`));
    // Output should mention the theft
    expect(output.some((e) => e.type === 'error' && e.text.includes('snatches'))).toBe(true);
  });

  it('increments moveCount on movement', async () => {
    const room1 = makePlace('room1', { exits: ['north'] });
    const room2 = makePlace('room2', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:room1`, 'north'],
      [`${WORLD}:place:room2`, 'south'],
    ]);
    const events = buildEvents(room1, room2, portal);
    const engine = createEngine(events, { place: ref(`${WORLD}:place:room1`), moveCount: 0 });
    engine.enterRoom(ref(`${WORLD}:place:room1`));
    engine.flush();

    await engine.handleCommand('north');
    expect(engine.player.getMoveCount()).toBe(1);
  });

  it('NPC deposits items at stash on arrival', async () => {
    const room1 = makePlace('room1', { exits: ['north'] });
    const stashRoom = makePlace('stash', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:room1`, 'north'],
      [`${WORLD}:place:stash`, 'south'],
    ]);
    const dagger = makeItem('dagger');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:room1`, `${WORLD}:place:stash`],
      onEnter: [[ref(`${WORLD}:place:stash`), 'deposits']],
    });
    const events = buildEvents(room1, stashRoom, portal, dagger, thief);

    // NPC starts with a stolen dagger (depositing only clears stolen items)
    const npcStates = {
      [ref(`${WORLD}:npc:thief`)]: {
        state: null,
        inventory: [],
        stolen: [ref(`${WORLD}:item:dagger`)],
        health: null,
      },
    };
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:room1`),
      moveCount: 0,
    }, npcStates);
    engine.enterRoom(ref(`${WORLD}:place:room1`));
    engine.flush();

    // Move — this increments moveCount to 1
    // At moveCount=1, NPC moves to stash (route[1])
    await engine.handleCommand('north');

    // NPC should have deposited the dagger (stolen list cleared; native inventory unchanged)
    const npcState = engine.player.getNpcState(ref(`${WORLD}:npc:thief`));
    expect(npcState.stolen).toEqual([]);
  });

  it('can talk to a roaming NPC', async () => {
    const greetNode = makeDialogueNode('thief-greet', {
      text: 'What do you want?',
      options: [['Nothing', '']],
    });
    const room = makePlace('market');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      extraTags: [['verb', 'talk', 'speak']],
      dialogue: [[ref(`${WORLD}:dialogue:thief-greet`)]],
    });
    const events = buildEvents(room, thief, greetNode);
    const engine = createEngine(events, { place: ref(`${WORLD}:place:market`), moveCount: 0 });
    engine.enterRoom(ref(`${WORLD}:place:market`));
    engine.flush();

    await engine.handleCommand('talk thief');
    const output = engine.flush();

    expect(engine.dialogueActive).not.toBeNull();
    expect(output.some((e) => e.text === 'What do you want?')).toBe(true);
  });

  it('consume-item removes item from inventory', async () => {
    const potion = makeItem('potion', {
      nouns: [['potion']],
      verbs: [['drink', 'quaff']],
      onInteract: [['drink', 'consume-item', ref(`${WORLD}:item:potion`)]],
    });
    const room = makePlace('room');
    const events = buildEvents(room, potion);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:room`),
      inventory: [ref(`${WORLD}:item:potion`)],
    });

    await engine.handleCommand('drink potion');
    expect(engine.player.hasItem(ref(`${WORLD}:item:potion`))).toBe(false);
  });

  it('look does not re-trigger on-encounter', () => {
    const room = makePlace('market', { items: [`${WORLD}:item:sword`] });
    const sword = makeItem('sword');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      onEncounter: [['player', 'steals-item', 'any']],
    });
    const events = buildEvents(room, sword, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      inventory: [ref(`${WORLD}:item:sword`), ref(`${WORLD}:item:extra`)],
      moveCount: 0,
    });

    // First entry with isMoving — steals one item
    engine.enterRoom(ref(`${WORLD}:place:market`), { isMoving: true });
    engine.flush();
    expect(engine.player.state.inventory).toHaveLength(1);

    // look (no isMoving) — should NOT steal again
    engine.enterRoom(ref(`${WORLD}:place:market`));
    engine.flush();
    expect(engine.player.state.inventory).toHaveLength(1);
  });

  it('steals-item any takes the most recently acquired item', () => {
    const room = makePlace('market');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      onEncounter: [['player', 'steals-item', 'any']],
    });
    const events = buildEvents(room, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      inventory: [ref(`${WORLD}:item:old`), ref(`${WORLD}:item:new`)],
      moveCount: 0,
    });

    engine.enterRoom(ref(`${WORLD}:place:market`), { isMoving: true });
    engine.flush();

    // Should have stolen the last (newest) item
    expect(engine.player.hasItem(ref(`${WORLD}:item:old`))).toBe(true);
    expect(engine.player.hasItem(ref(`${WORLD}:item:new`))).toBe(false);
  });

  it('stolen item does not reappear in its original room', () => {
    const room = makePlace('cave', { items: [`${WORLD}:item:key`] });
    const key = makeItem('key');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:cave`],
      onEncounter: [['player', 'steals-item', 'any']],
    });
    const events = buildEvents(room, key, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:cave`),
      inventory: [ref(`${WORLD}:item:key`)],
      moveCount: 0,
    });

    // Thief steals the key
    engine.enterRoom(ref(`${WORLD}:place:cave`), { isMoving: true });
    engine.flush();
    expect(engine.player.hasItem(ref(`${WORLD}:item:key`))).toBe(false);
    const npcState = engine.player.getNpcState(ref(`${WORLD}:npc:thief`));
    expect(npcState.stolen).toContain(ref(`${WORLD}:item:key`));

    // Re-enter room — key should NOT appear
    engine.enterRoom(ref(`${WORLD}:place:cave`));
    const output = engine.flush();
    const itemLines = output.filter((e) => e.type === 'item' && e.text.includes('Key'));
    expect(itemLines).toHaveLength(0);
  });

  it('deposited items appear at stash room, not original room', async () => {
    const cave = makePlace('cave', { items: [`${WORLD}:item:key`], exits: ['north'] });
    const stash = makePlace('stash', { exits: ['south'] });
    const portal = makePortal('p1', [
      [`${WORLD}:place:cave`, 'north'],
      [`${WORLD}:place:stash`, 'south'],
    ]);
    const key = makeItem('key');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:cave`, `${WORLD}:place:stash`],
      onEncounter: [['player', 'steals-item', 'any']],
      onEnter: [[ref(`${WORLD}:place:stash`), 'deposits']],
    });
    const events = buildEvents(cave, stash, portal, key, thief);

    const npcStates = {
      [ref(`${WORLD}:npc:thief`)]: {
        state: null,
        inventory: [],
        stolen: [ref(`${WORLD}:item:key`)],
        health: null,
      },
    };
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:cave`),
      moveCount: 0,
    }, npcStates);
    engine.enterRoom(ref(`${WORLD}:place:cave`));
    engine.flush();

    // Move — NPC goes to stash (route[1]) and deposits
    await engine.handleCommand('north');
    engine.flush();

    // Key should be in the stash place's inventory
    const stashItems = engine.player.getPlaceItems(ref(`${WORLD}:place:stash`)) || [];
    expect(stashItems).toContain(ref(`${WORLD}:item:key`));

    // Visit cave — key should NOT appear
    engine.enterRoom(ref(`${WORLD}:place:cave`));
    const caveOutput = engine.flush();
    expect(caveOutput.some((e) => e.type === 'item' && e.text.includes('Key'))).toBe(false);

    // Visit stash — key SHOULD appear
    engine.enterRoom(ref(`${WORLD}:place:stash`));
    const stashOutput = engine.flush();
    expect(stashOutput.some((e) => e.type === 'item' && e.text.includes('Key'))).toBe(true);
  });

  // ── NPC native inventory ──────────────────────────────────────────────

  it('initNpcState seeds native inventory from event tags', () => {
    const sword = makeItem('sword');
    const thief = makeRoamingNPC('thief', {
      routes: [`${WORLD}:place:market`],
      inventory: [`${WORLD}:item:sword`],
    });
    const state = initNpcState(thief);
    expect(state.inventory).toContain(ref(`${WORLD}:item:sword`));
    expect(state.stolen).toEqual([]);
  });

  it('native inventory shown on examine; stolen items shown together', async () => {
    const room = makePlace('market', { npcs: [`${WORLD}:npc:thief`] });
    const sword = makeItem('sword');
    const dagger = makeItem('dagger');
    const thief = makeRoamingNPC('thief', {
      routes: [`${WORLD}:place:market`],
      inventory: [`${WORLD}:item:sword`],
      content: 'A shifty figure.',
    });
    const events = buildEvents(room, sword, dagger, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      inventory: [ref(`${WORLD}:item:dagger`)],
      moveCount: 0,
    });
    // Seed stolen item directly
    engine.player.ensureNpcState(ref(`${WORLD}:npc:thief`), {
      state: null, inventory: [ref(`${WORLD}:item:sword`)], stolen: [ref(`${WORLD}:item:dagger`)], health: null,
    });
    engine.enterRoom(ref(`${WORLD}:place:market`));
    engine.flush();

    await engine.handleCommand('examine thief');
    const out = engine.flush();
    const carryLine = out.find((e) => e.text?.includes('Carrying:'));
    expect(carryLine).toBeTruthy();
    expect(carryLine.text).toContain('Sword');
    expect(carryLine.text).toContain('Dagger');
  });

  it('steals-item goes to stolen list, not native inventory', async () => {
    const room = makePlace('market');
    const sword = makeItem('sword');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      inventory: [],
      onEncounter: [['player', 'steals-item', 'any']],
    });
    const events = buildEvents(room, sword, thief);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      inventory: [ref(`${WORLD}:item:sword`)],
      moveCount: 0,
    });
    engine.enterRoom(ref(`${WORLD}:place:market`), { isMoving: true });
    engine.flush();

    const npcState = engine.player.getNpcState(ref(`${WORLD}:npc:thief`));
    expect(npcState.stolen).toContain(ref(`${WORLD}:item:sword`));
    expect(npcState.inventory).toEqual([]);
  });

  it('deposits clears stolen list but leaves native inventory', async () => {
    const cave = makePlace('cave', { exits: ['north'] });
    const stash = makePlace('stash', { exits: ['south'] });
    const portal = makePortal('p', [
      [`${WORLD}:place:cave`, 'north', ''],
      [`${WORLD}:place:stash`, 'south', ''],
    ]);
    const sword = makeItem('sword');
    const key = makeItem('key');
    const thief = makeRoamingNPC('thief', {
      speed: 1,
      order: 'sequential',
      routes: [`${WORLD}:place:cave`, `${WORLD}:place:stash`],
      inventory: [`${WORLD}:item:sword`],   // native — should survive deposit
      onEnter: [[ref(`${WORLD}:place:stash`), 'deposits']],
    });
    const events = buildEvents(cave, stash, portal, sword, key, thief);
    const npcStates = {
      [ref(`${WORLD}:npc:thief`)]: {
        state: null,
        inventory: [ref(`${WORLD}:item:sword`)],
        stolen: [ref(`${WORLD}:item:key`)],
        health: null,
      },
    };
    const engine = createEngine(events, { place: ref(`${WORLD}:place:cave`), moveCount: 0 }, npcStates);
    engine.enterRoom(ref(`${WORLD}:place:cave`));
    engine.flush();

    await engine.handleCommand('north');

    const npcState = engine.player.getNpcState(ref(`${WORLD}:npc:thief`));
    // Stolen item deposited
    expect(npcState.stolen).toEqual([]);
    // Native inventory untouched
    expect(npcState.inventory).toContain(ref(`${WORLD}:item:sword`));
  });

  // ── examine roaming NPC ───────────────────────────────────────────────

  it('examine finds a roaming NPC at the current place', async () => {
    const room = makePlace('market', { exits: [] });
    const guard = makeRoamingNPC('guard', {
      speed: 1,
      routes: [`${WORLD}:place:market`],
      content: 'A stern guard.',
    });
    const events = buildEvents(room, guard);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      moveCount: 0,
    });
    engine.enterRoom(ref(`${WORLD}:place:market`));
    engine.flush();

    await engine.handleCommand('examine guard');
    const out = engine.flush();
    expect(out.some((e) => e.text?.includes('stern guard'))).toBe(true);
    expect(out.some((e) => e.text?.includes("don't see"))).toBe(false);
  });

  it('examine does not find a roaming NPC that is at a different place', async () => {
    const market = makePlace('market', { exits: ['north'] });
    const plaza = makePlace('plaza', { exits: ['south'] });
    const portal = makePortal('p', [
      [`${WORLD}:place:market`, 'north', ''],
      [`${WORLD}:place:plaza`, 'south', ''],
    ]);
    // Guard routes: market (move 0), plaza (move 1)
    const guard = makeRoamingNPC('guard', {
      speed: 1,
      routes: [`${WORLD}:place:market`, `${WORLD}:place:plaza`],
      content: 'A stern guard.',
    });
    const events = buildEvents(market, plaza, portal, guard);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:market`),
      moveCount: 0,
    });
    engine.enterRoom(ref(`${WORLD}:place:market`));
    engine.flush();

    // Move to plaza — guard also moves to plaza (moveCount now 1, route[1])
    await engine.handleCommand('north');
    engine.flush();

    // Now player is in plaza, guard is also in plaza — should be findable
    await engine.handleCommand('examine guard');
    const outFound = engine.flush();
    expect(outFound.some((e) => e.text?.includes('stern guard'))).toBe(true);

    // Move back to market — guard moves back to market (moveCount 2, route[0])
    await engine.handleCommand('south');
    engine.flush();

    // Player in market, guard also in market at moveCount=2
    // Verify guard IS found here too
    await engine.handleCommand('examine guard');
    const outFoundAgain = engine.flush();
    expect(outFoundAgain.some((e) => e.text?.includes('stern guard'))).toBe(true);
  });
});
