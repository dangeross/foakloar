import { describe, it, expect } from 'vitest';
import { buildTrustSet, isPubkeyTrusted, getTrustLevel, resolveClientMode } from '../trust.js';
import { resolveExitsWithTrust } from '../world.js';
import { GameEngine } from '../engine.js';
import { PlayerStateMutator } from '../player-state.js';
import {
  PUBKEY, PUBKEY2, PUBKEY3, WORLD,
  ref, refFor,
  makePlace, makePortal, makePortalAs,
  makeWorldEvent, makeVouch,
  buildEvents, freshState,
} from './helpers.js';

// ── buildTrustSet ───────────────────────────────────────────────────────

describe('buildTrustSet', () => {
  it('closed mode: only genesis pubkey', () => {
    const world = makeWorldEvent({ collaboration: 'closed' });
    const events = buildEvents(world);
    const ts = buildTrustSet(world, events);

    expect(ts.genesisPubkey).toBe(PUBKEY);
    expect(ts.collaboration).toBe('closed');
    expect(ts.collaborators.size).toBe(0);
    expect(ts.vouched.size).toBe(0);
  });

  it('vouched mode: genesis + collaborators', () => {
    const world = makeWorldEvent({ collaboration: 'vouched', collaborators: [PUBKEY2] });
    const events = buildEvents(world);
    const ts = buildTrustSet(world, events);

    expect(ts.collaborators.has(PUBKEY2)).toBe(true);
    expect(ts.collaborators.size).toBe(1);
  });

  it('vouched mode: walks vouch chain', () => {
    const world = makeWorldEvent({ collaboration: 'vouched', collaborators: [PUBKEY2] });
    const vouch = makeVouch(PUBKEY2, PUBKEY3, { scope: 'portal', canVouch: false });
    const events = buildEvents(world, vouch);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.has(PUBKEY3)).toBe(true);
    expect(ts.vouched.get(PUBKEY3).scope).toBe('portal');
    expect(ts.vouched.get(PUBKEY3).canVouch).toBe(false);
  });

  it('vouch chain stops when can-vouch is false', () => {
    const pk4 = 'testpubkey4444444444444444444444444444444444444444444444444444';
    const world = makeWorldEvent({ collaboration: 'vouched', collaborators: [PUBKEY2] });
    const vouch1 = makeVouch(PUBKEY2, PUBKEY3, { scope: 'all', canVouch: false, name: 'v1' });
    const vouch2 = makeVouch(PUBKEY3, pk4, { scope: 'all', canVouch: false, name: 'v2' });
    const events = buildEvents(world, vouch1, vouch2);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.has(PUBKEY3)).toBe(true);
    expect(ts.vouched.has(pk4)).toBe(false); // chain stops
  });

  it('vouch chain continues when can-vouch is true', () => {
    const pk4 = 'testpubkey4444444444444444444444444444444444444444444444444444';
    const world = makeWorldEvent({ collaboration: 'vouched', collaborators: [PUBKEY2] });
    const vouch1 = makeVouch(PUBKEY2, PUBKEY3, { scope: 'all', canVouch: true, name: 'v1' });
    const vouch2 = makeVouch(PUBKEY3, pk4, { scope: 'portal', canVouch: false, name: 'v2' });
    const events = buildEvents(world, vouch1, vouch2);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.has(PUBKEY3)).toBe(true);
    expect(ts.vouched.has(pk4)).toBe(true);
    expect(ts.vouched.get(pk4).scope).toBe('portal');
  });

  it('ignores vouch from untrusted author', () => {
    const world = makeWorldEvent({ collaboration: 'vouched' }); // no collaborators
    const vouch = makeVouch(PUBKEY2, PUBKEY3); // PUBKEY2 is not trusted
    const events = buildEvents(world, vouch);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.size).toBe(0);
  });

  it('genesis can vouch directly', () => {
    const world = makeWorldEvent({ collaboration: 'vouched' });
    const vouch = makeVouch(PUBKEY, PUBKEY2, { scope: 'place' });
    const events = buildEvents(world, vouch);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.has(PUBKEY2)).toBe(true);
    expect(ts.vouched.get(PUBKEY2).scope).toBe('place');
  });

  it('closed mode: ignores vouch events', () => {
    const world = makeWorldEvent({ collaboration: 'closed' });
    const vouch = makeVouch(PUBKEY, PUBKEY2);
    const events = buildEvents(world, vouch);
    const ts = buildTrustSet(world, events);

    expect(ts.vouched.size).toBe(0);
  });

  it('defaults to closed when no collaboration tag', () => {
    const world = makeWorldEvent();
    const events = buildEvents(world);
    const ts = buildTrustSet(world, events);
    expect(ts.collaboration).toBe('closed');
  });
});

// ── getTrustLevel ─────────────────────────────────────────────────────

describe('getTrustLevel', () => {
  const world = makeWorldEvent({ collaboration: 'vouched', collaborators: [PUBKEY2] });
  const vouch = makeVouch(PUBKEY2, PUBKEY3, { scope: 'portal' });
  const events = buildEvents(world, vouch);
  const ts = buildTrustSet(world, events);

  it('genesis always trusted', () => {
    expect(getTrustLevel(ts, PUBKEY, 'all', 'canonical')).toBe('trusted');
    expect(getTrustLevel(ts, PUBKEY, 'portal', 'canonical')).toBe('trusted');
  });

  it('collaborator trusted for all scopes', () => {
    expect(getTrustLevel(ts, PUBKEY2, 'portal', 'canonical')).toBe('trusted');
    expect(getTrustLevel(ts, PUBKEY2, 'place', 'canonical')).toBe('trusted');
    expect(getTrustLevel(ts, PUBKEY2, 'all', 'canonical')).toBe('trusted');
  });

  it('vouched pubkey trusted in community mode for matching scope', () => {
    expect(getTrustLevel(ts, PUBKEY3, 'portal', 'community')).toBe('trusted');
  });

  it('vouched pubkey hidden for broader scope', () => {
    expect(getTrustLevel(ts, PUBKEY3, 'place', 'community')).toBe('hidden');
    expect(getTrustLevel(ts, PUBKEY3, 'all', 'community')).toBe('hidden');
  });

  it('vouched pubkey hidden in canonical mode', () => {
    expect(getTrustLevel(ts, PUBKEY3, 'portal', 'canonical')).toBe('hidden');
  });

  it('unknown pubkey hidden in canonical and community (vouched world)', () => {
    const unknown = 'unknownpk000000000000000000000000000000000000000000000000000';
    expect(getTrustLevel(ts, unknown, 'portal', 'canonical')).toBe('hidden');
    expect(getTrustLevel(ts, unknown, 'portal', 'community')).toBe('hidden');
  });

  it('open + community: untrusted visible as unverified', () => {
    const openWorld = makeWorldEvent({ collaboration: 'open' });
    const openEvents = buildEvents(openWorld);
    const openTs = buildTrustSet(openWorld, openEvents);
    const unknown = 'unknownpk000000000000000000000000000000000000000000000000000';
    expect(getTrustLevel(openTs, unknown, 'portal', 'community')).toBe('unverified');
    expect(isPubkeyTrusted(openTs, unknown, 'portal', 'community')).toBe(true);
  });

  it('open + canonical: untrusted hidden', () => {
    const openWorld = makeWorldEvent({ collaboration: 'open' });
    const openEvents = buildEvents(openWorld);
    const openTs = buildTrustSet(openWorld, openEvents);
    const unknown = 'unknownpk000000000000000000000000000000000000000000000000000';
    expect(getTrustLevel(openTs, unknown, 'portal', 'canonical')).toBe('hidden');
  });

  it('vouched + explorer: untrusted visible as unverified', () => {
    const unknown = 'unknownpk000000000000000000000000000000000000000000000000000';
    expect(getTrustLevel(ts, unknown, 'portal', 'explorer')).toBe('unverified');
    expect(isPubkeyTrusted(ts, unknown, 'portal', 'explorer')).toBe(true);
  });

  it('vouched + community: untrusted hidden', () => {
    const unknown = 'unknownpk000000000000000000000000000000000000000000000000000';
    expect(getTrustLevel(ts, unknown, 'portal', 'community')).toBe('hidden');
    expect(isPubkeyTrusted(ts, unknown, 'portal', 'community')).toBe(false);
  });

  it('scope=place covers portal too', () => {
    const w = makeWorldEvent({ collaboration: 'vouched' });
    const v = makeVouch(PUBKEY, PUBKEY2, { scope: 'place' });
    const evs = buildEvents(w, v);
    const t = buildTrustSet(w, evs);
    expect(getTrustLevel(t, PUBKEY2, 'portal', 'community')).toBe('trusted');
    expect(getTrustLevel(t, PUBKEY2, 'place', 'community')).toBe('trusted');
  });

  it('scope=all covers everything', () => {
    const w = makeWorldEvent({ collaboration: 'vouched' });
    const v = makeVouch(PUBKEY, PUBKEY2, { scope: 'all' });
    const evs = buildEvents(w, v);
    const t = buildTrustSet(w, evs);
    expect(getTrustLevel(t, PUBKEY2, 'portal', 'community')).toBe('trusted');
    expect(getTrustLevel(t, PUBKEY2, 'place', 'community')).toBe('trusted');
    expect(getTrustLevel(t, PUBKEY2, 'all', 'community')).toBe('trusted');
  });
});

// ── resolveClientMode ───────────────────────────────────────────────────

describe('resolveClientMode', () => {
  it('closed: only canonical available', () => {
    const { availableModes, effectiveMode } = resolveClientMode('closed', 'community');
    expect(availableModes).toEqual(['canonical']);
    expect(effectiveMode).toBe('canonical');
  });

  it('vouched: all three modes available', () => {
    const { availableModes, effectiveMode } = resolveClientMode('vouched', 'community');
    expect(availableModes).toEqual(['canonical', 'community', 'explorer']);
    expect(effectiveMode).toBe('community');
  });

  it('open: canonical and community available', () => {
    const { availableModes, effectiveMode } = resolveClientMode('open', 'community');
    expect(availableModes).toEqual(['canonical', 'community']);
    expect(effectiveMode).toBe('community');
  });

  it('open: explorer falls back to community', () => {
    const { effectiveMode } = resolveClientMode('open', 'explorer');
    expect(effectiveMode).toBe('community'); // explorer not valid for open
  });
});

// ── resolveExitsWithTrust ───────────────────────────────────────────────

describe('resolveExitsWithTrust', () => {
  const placeRef = ref(`${WORLD}:place:start`);
  const destRef = ref(`${WORLD}:place:cave`);

  function setup({ collaboration = 'vouched', collaborators = [], vouches = [], portals = [] } = {}) {
    const place = makePlace('start');
    const dest = makePlace('cave');
    const world = makeWorldEvent({ collaboration, collaborators });

    const allEvents = [place, dest, world, ...vouches, ...portals];
    const events = buildEvents(...allEvents);
    const ts = buildTrustSet(world, events);
    return { events, ts };
  }

  it('genesis portal passes in all modes', () => {
    const portal = makePortal('p1', [[`${WORLD}:place:start`, 'north'], [`${WORLD}:place:cave`, 'south']]);
    const { events, ts } = setup({ portals: [portal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'canonical', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trusted).toBe(true);
    expect(exits[0].contested).toBe(false);
  });

  it('untrusted portal filtered in canonical mode (goes to hiddenByTrust)', () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p-untrusted',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const { events, ts } = setup({ portals: [untrustedPortal] });

    const { exits, hiddenByTrust } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'canonical', getTrustLevel);
    expect(exits).toHaveLength(0);
    expect(hiddenByTrust).toHaveLength(1);
    expect(hiddenByTrust[0].slot).toBe('south');
  });

  it('untrusted portal shown as unverified in open + community', () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p-untrusted',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const { events, ts } = setup({ collaboration: 'open', portals: [untrustedPortal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'community', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trustLevel).toBe('unverified');
    expect(exits[0].trusted).toBe(true); // visible but marked
  });

  it('untrusted portal shown as unverified in vouched + explorer', () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p-untrusted',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const { events, ts } = setup({ portals: [untrustedPortal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'explorer', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trustLevel).toBe('unverified');
    expect(exits[0].trusted).toBe(true);
  });

  it('collaborator portal passes in canonical mode', () => {
    const collabPortal = makePortalAs(PUBKEY2, 'p-collab',
      [[placeRef, 'east', 'Forest'], [destRef, 'west', '']],
    );
    const { events, ts } = setup({ collaborators: [PUBKEY2], portals: [collabPortal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'canonical', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trusted).toBe(true);
  });

  it('vouched portal passes in community mode', () => {
    const vouch = makeVouch(PUBKEY, PUBKEY2, { scope: 'portal' });
    const vouchedPortal = makePortalAs(PUBKEY2, 'p-vouched',
      [[placeRef, 'west', 'Mountain'], [destRef, 'east', '']],
    );
    const { events, ts } = setup({ vouches: [vouch], portals: [vouchedPortal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'community', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trusted).toBe(true);
  });

  it('detects contested portals on same slot', () => {
    const portal1 = makePortal('p1', [[`${WORLD}:place:start`, 'north'], [`${WORLD}:place:cave`, 'south']]);
    const collabPortal = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'north', 'Alternate North'], [destRef, 'south', '']],
    );
    const { events, ts } = setup({ collaborators: [PUBKEY2], portals: [portal1, collabPortal] });

    const { exits } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'canonical', getTrustLevel);
    const northExits = exits.filter((e) => e.slot === 'north');
    expect(northExits).toHaveLength(2);
    expect(northExits[0].contested).toBe(true);
    expect(northExits[1].contested).toBe(true);
  });

  it('no contest when untrusted portal filtered out', () => {
    const portal1 = makePortal('p1', [[`${WORLD}:place:start`, 'north'], [`${WORLD}:place:cave`, 'south']]);
    const untrustedPortal = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'north', 'Shady Path'], [destRef, 'south', '']],
    );
    const { events, ts } = setup({ portals: [portal1, untrustedPortal] });

    const { exits, hiddenByTrust } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'canonical', getTrustLevel);
    const northExits = exits.filter((e) => e.slot === 'north');
    expect(northExits).toHaveLength(1);
    expect(northExits[0].contested).toBe(false);
    expect(hiddenByTrust).toHaveLength(1); // untrusted is in hidden list
  });

  it('falls back to unfiltered when no trust set', () => {
    const portal = makePortalAs(PUBKEY2, 'p1',
      [[placeRef, 'north', ''], [destRef, 'south', '']],
    );
    const place = makePlace('start');
    const dest = makePlace('cave');
    const events = buildEvents(place, dest, portal);

    const { exits, hiddenByTrust } = resolveExitsWithTrust(events, placeRef, freshState(), null, 'community', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trusted).toBe(true); // fallback treats all as trusted
    expect(hiddenByTrust).toHaveLength(0);
  });

  it('hiddenByTrust visible via look <direction> (community mode, vouched world)', () => {
    const trustedPortal = makePortal('p1', [[`${WORLD}:place:start`, 'south'], [`${WORLD}:place:cave`, 'north']]);
    const untrustedPortal = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'south', 'Shady Path'], [destRef, 'north', '']],
    );
    const { events, ts } = setup({ portals: [trustedPortal, untrustedPortal] });

    // In community mode: untrusted is hidden from exits but in hiddenByTrust for look
    const { exits, hiddenByTrust } = resolveExitsWithTrust(events, placeRef, freshState(), ts, 'community', getTrustLevel);
    expect(exits).toHaveLength(1);
    expect(exits[0].trustLevel).toBe('trusted');
    expect(hiddenByTrust).toHaveLength(1);
    expect(hiddenByTrust[0].slot).toBe('south');
    expect(hiddenByTrust[0].label).toBe('Shady Path');
  });
});

// ── Engine: contested exit UI (spec 6.7) ────────────────────────────────

describe('Engine contested exit UI', () => {
  const placeRef = ref(`${WORLD}:place:start`);
  const destRef = ref(`${WORLD}:place:cave`);
  const destRef2 = refFor(PUBKEY2, `${WORLD}:place:bridge`);

  function setupEngine({ collaboration = 'vouched', collaborators = [], vouches = [], portals = [], clientMode = 'community', places: extraPlaces = [] } = {}) {
    const place = makePlace('start');
    const dest = makePlace('cave');
    const world = makeWorldEvent({ collaboration, collaborators });
    const allEvents = [place, dest, world, ...vouches, ...portals, ...extraPlaces];
    const events = buildEvents(...allEvents);
    const ts = buildTrustSet(world, events);
    const player = new PlayerStateMutator(freshState(), {});
    return new GameEngine({
      events,
      player,
      config: { GENESIS_PLACE: placeRef, AUTHOR_PUBKEY: PUBKEY, trustSet: ts, clientMode },
    });
  }

  it('look <direction> shows all portals including hidden', () => {
    const trustedPortal = makePortal('p1', [[`${WORLD}:place:start`, 'south'], [`${WORLD}:place:cave`, 'north']]);
    const untrustedPortal = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'south', 'Shady Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({ portals: [trustedPortal, untrustedPortal] });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleLookDirection('south');
    const out = engine.flush();
    const texts = out.map((o) => o.text);

    expect(texts[0]).toContain('Paths south:');
    expect(texts.some((t) => t.includes('(trusted)'))).toBe(true);
    expect(texts.some((t) => t.includes('(unverified)'))).toBe(true);
  });

  it('look <direction> shows nothing leads message for invalid direction', () => {
    const engine = setupEngine({});
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleLookDirection('west');
    const out = engine.flush();
    expect(out[0].text).toBe('Nothing leads west.');
  });

  it('trusted portal navigates immediately, unverified hint shown', async () => {
    const trustedPortal = makePortal('p1', [[`${WORLD}:place:start`, 'south'], [`${WORLD}:place:cave`, 'north']]);
    const untrustedPortal = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'south', 'Shady Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({ portals: [trustedPortal, untrustedPortal] });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('south');
    const out = engine.flush();
    const texts = out.map((o) => o.text);

    // Should have navigated to cave
    expect(engine.currentPlace).toBe(destRef);
    // Should show unverified hint
    expect(texts.some((t) => t?.includes('+1 unverified'))).toBe(true);
  });

  it('unverified-only slot requires choice index', () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p1',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({
      collaboration: 'open',
      portals: [untrustedPortal],
      clientMode: 'community',
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('south');
    const out = engine.flush();
    const texts = out.map((o) => o.text);

    // Should show listing, not navigate
    expect(engine.currentPlace).toBe(placeRef);
    expect(texts.some((t) => t?.includes('Multiple paths south'))).toBe(true);
    expect(texts.some((t) => t?.includes('(unverified)'))).toBe(true);
  });

  it('unverified portal selection triggers confirmation', () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p1',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({
      collaboration: 'open',
      portals: [untrustedPortal],
      clientMode: 'community',
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('south', 1);
    const out = engine.flush();
    const texts = out.map((o) => o.text);

    // Should show confirmation, not navigate yet
    expect(engine.currentPlace).toBe(placeRef);
    expect(engine.pendingConfirm).not.toBeNull();
    expect(texts.some((t) => t?.includes('proceed?'))).toBe(true);
  });

  it('confirming yes on unverified portal navigates', async () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p1',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({
      collaboration: 'open',
      portals: [untrustedPortal],
      clientMode: 'community',
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('south', 1); // triggers confirmation
    engine.flush();

    await engine.handleCommand('yes');
    const out = engine.flush();

    expect(engine.currentPlace).toBe(destRef);
    expect(engine.pendingConfirm).toBeNull();
  });

  it('confirming no on unverified portal stays', async () => {
    const untrustedPortal = makePortalAs(PUBKEY2, 'p1',
      [[placeRef, 'south', 'Dark Path'], [destRef, 'north', '']],
    );
    const engine = setupEngine({
      collaboration: 'open',
      portals: [untrustedPortal],
      clientMode: 'community',
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('south', 1);
    engine.flush();

    await engine.handleCommand('no');
    const out = engine.flush();

    expect(engine.currentPlace).toBe(placeRef);
    expect(engine.pendingConfirm).toBeNull();
    expect(out.some((o) => o.text?.includes('stay where you are'))).toBe(true);
  });

  it('multiple trusted portals on same slot show disambiguation', () => {
    const portal1 = makePortal('p1', [[`${WORLD}:place:start`, 'north'], [`${WORLD}:place:cave`, 'south']]);
    const portal2 = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'north', 'Mountain Pass'], [destRef, 'south', '']],
    );
    const engine = setupEngine({
      collaborators: [PUBKEY2],
      portals: [portal1, portal2],
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('north');
    const out = engine.flush();
    const texts = out.map((o) => o.text);

    // Should show disambiguation, not navigate
    expect(engine.currentPlace).toBe(placeRef);
    expect(texts.some((t) => t?.includes('Multiple paths north'))).toBe(true);
  });

  it('multiple trusted portals + choice index navigates', () => {
    const portal1 = makePortal('p1', [[`${WORLD}:place:start`, 'north'], [`${WORLD}:place:cave`, 'south']]);
    const portal2 = makePortalAs(PUBKEY2, 'p2',
      [[placeRef, 'north', 'Mountain Pass'], [destRef, 'south', '']],
    );
    const engine = setupEngine({
      collaborators: [PUBKEY2],
      portals: [portal1, portal2],
    });
    engine.enterRoom(placeRef);
    engine.flush();

    engine.handleMove('north', 1);
    expect(engine.currentPlace).toBe(destRef);
  });
});
