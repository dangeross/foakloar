/**
 * Tests for combat system.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ref, WORLD,
  makePlace, makeItem, makeNPC, makeConsequence, makeWorldEvent,
  buildEvents, makeEngine,
} from './helpers.js';

function makeWeapon(name, { damage = 3, hitChance, nouns = [], extraTags = [] } = {}) {
  return makeItem(name, {
    nouns,
    verbs: [['examine'], ['attack', 'hit', 'strike']],
    onInteract: [['attack', 'deal-damage-npc', '']],
    extraTags: [
      ['damage', String(damage)],
      ...(hitChance ? [['hit-chance', String(hitChance)]] : []),
      ...extraTags,
    ],
  });
}

function makeCombatNPC(name, { health = 6, damage = 2, hitChance, onAttacked = [], onHealthZero = [], state = 'hostile', extraTags = [] } = {}) {
  return makeNPC(name, {
    extraTags: [
      ['health', String(health)],
      ['damage', String(damage)],
      ...(hitChance ? [['hit-chance', String(hitChance)]] : []),
      ...(state ? [['state', state]] : []),
      ...onAttacked.map((t) => ['on-attacked', ...t]),
      ...onHealthZero.map((t) => ['on-health-zero', ...t]),
      ...extraTags,
    ],
  });
}

describe('combat', () => {
  it('player attacks NPC and NPC counterattacks', () => {
    const sword = makeWeapon('sword', { damage: 3, nouns: [['sword']] });
    const guard = makeCombatNPC('guard', {
      health: 6,
      damage: 2,
      hitChance: 1.0,
      onAttacked: [['', 'deal-damage', '2']],
    });
    const room = makePlace('arena', { npcs: [`${WORLD}:npc:guard`] });

    const events = buildEvents(sword, guard, room);
    // Seed Math.random to always hit
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      health: 10,
      maxHealth: 10,
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);
    engine.player.ensureNpcState(ref(`${WORLD}:npc:guard`), { state: 'hostile', inventory: [], health: 6 });

    engine._handleAttack(guard, ref(`${WORLD}:npc:guard`), sword, ref(`${WORLD}:item:sword`));

    // NPC should take 3 damage (6 → 3)
    const ns = engine.player.getNpcState(ref(`${WORLD}:npc:guard`));
    expect(ns.health).toBe(3);

    // Player should take 2 damage (10 → 8)
    expect(engine.player.getHealth()).toBe(8);

    vi.restoreAllMocks();
  });

  it('weapon miss does no damage', () => {
    const sword = makeWeapon('sword', { damage: 3, hitChance: 0.5, nouns: [['sword']] });
    const guard = makeCombatNPC('guard', { health: 6 });
    const room = makePlace('arena', { npcs: [`${WORLD}:npc:guard`] });

    const events = buildEvents(sword, guard, room);
    // Always miss
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      health: 10,
      maxHealth: 10,
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);
    engine.player.ensureNpcState(ref(`${WORLD}:npc:guard`), { state: 'hostile', inventory: [], health: 6 });

    engine._handleAttack(guard, ref(`${WORLD}:npc:guard`), sword, ref(`${WORLD}:item:sword`));

    const ns = engine.player.getNpcState(ref(`${WORLD}:npc:guard`));
    expect(ns.health).toBe(6); // No damage

    const missMsg = engine.output.find((o) => o.text === 'You miss!');
    expect(missMsg).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('NPC death fires on-health-zero', () => {
    const sword = makeWeapon('sword', { damage: 10, nouns: [['sword']] });
    const guard = makeCombatNPC('guard', {
      health: 3,
      onHealthZero: [['', 'set-state', 'defeated']],
      extraTags: [['transition', 'hostile', 'defeated', 'The guard falls.']],
    });
    const room = makePlace('arena', { npcs: [`${WORLD}:npc:guard`] });

    const events = buildEvents(sword, guard, room);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      health: 10,
      maxHealth: 10,
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);
    engine.player.ensureNpcState(ref(`${WORLD}:npc:guard`), { state: 'hostile', inventory: [], health: 3 });

    engine._handleAttack(guard, ref(`${WORLD}:npc:guard`), sword, ref(`${WORLD}:item:sword`));

    const ns = engine.player.getNpcState(ref(`${WORLD}:npc:guard`));
    expect(ns.health).toBe(0);
    expect(ns.state).toBe('defeated');

    const msg = engine.output.find((o) => o.text === 'The guard falls.');
    expect(msg).toBeTruthy();

    // No counterattack since NPC died
    expect(engine.player.getHealth()).toBe(10);

    vi.restoreAllMocks();
  });

  it('player death fires consequence', () => {
    const sword = makeWeapon('sword', { damage: 1, nouns: [['sword']] });
    const guard = makeCombatNPC('guard', {
      health: 10,
      damage: 20,
      hitChance: 1.0,
      onAttacked: [['', 'deal-damage', '20']],
    });
    const room = makePlace('arena', { npcs: [`${WORLD}:npc:guard`] });
    const entrance = makePlace('entrance');
    const consequence = makeConsequence('death', {
      respawn: `${WORLD}:place:entrance`,
      content: 'You died.',
    });
    const world = makeWorldEvent({
      extraTags: [['on-player-health-zero', '', 'consequence', ref(`${WORLD}:consequence:death`)]],
    });

    const events = buildEvents(sword, guard, room, entrance, consequence, world);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      health: 5,
      maxHealth: 10,
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);
    engine.player.ensureNpcState(ref(`${WORLD}:npc:guard`), { state: 'hostile', inventory: [], health: 10 });

    engine._handleAttack(guard, ref(`${WORLD}:npc:guard`), sword, ref(`${WORLD}:item:sword`));

    // Player should be dead and respawned
    expect(engine.currentPlace).toBe(ref(`${WORLD}:place:entrance`));

    vi.restoreAllMocks();
  });

  it('heal increases player health capped at max', () => {
    const room = makePlace('arena');
    const events = buildEvents(room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      health: 5,
      maxHealth: 10,
    });

    engine._healPlayer(3);
    expect(engine.player.getHealth()).toBe(8);

    engine._healPlayer(100);
    expect(engine.player.getHealth()).toBe(10); // capped
  });

  it('auto-finds weapon when no instrument specified', () => {
    const sword = makeWeapon('sword', { damage: 3, nouns: [['sword']] });
    const guard = makeCombatNPC('guard', { health: 6 });
    const room = makePlace('arena', { npcs: [`${WORLD}:npc:guard`] });

    const events = buildEvents(sword, guard, room);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:arena`),
      inventory: [ref(`${WORLD}:item:sword`)],
      health: 10,
      maxHealth: 10,
    });
    engine.currentPlace = ref(`${WORLD}:place:arena`);
    engine.player.ensureNpcState(ref(`${WORLD}:npc:guard`), { state: 'hostile', inventory: [], health: 6 });

    // Simulate handleInteraction with attack verb, no instrument
    engine.handleInteraction('attack', 'guard', null);

    const ns = engine.player.getNpcState(ref(`${WORLD}:npc:guard`));
    expect(ns.health).toBe(3);

    vi.restoreAllMocks();
  });
});
