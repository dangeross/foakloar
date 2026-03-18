import { describe, it, expect } from 'vitest';
import { applyExternalSetState, giveItem, evalCounterLow } from '../actions.js';
import {
  ref, WORLD,
  makeFeature, makeItem, makeClue, makePuzzle, makePortal,
  buildEvents, makeMutator,
} from './helpers.js';

// Collect emitted messages for assertions
function collector() {
  const messages = [];
  const emit = (text, type) => messages.push({ text, type });
  const emitHtml = (html, type) => messages.push({ html, type });
  return { messages, emit, emitHtml };
}

// ── applyExternalSetState ───────────────────────────────────────────────

describe('applyExternalSetState', () => {
  it('reveals a clue', () => {
    const clue = makeClue('ancient-note', 'The answer is 42.');
    const events = buildEvents(clue);
    const player = makeMutator();
    const { messages, emit, emitHtml } = collector();

    const result = applyExternalSetState(
      ref(`${WORLD}:clue:ancient-note`), 'seen',
      events, player, emit, emitHtml,
    );

    expect(result.acted).toBe(true);
    expect(player.isClueSeen(ref(`${WORLD}:clue:ancient-note`))).toBe(true);
    expect(messages.some((m) => m.type === 'clue')).toBe(true);
  });

  it('activates a puzzle', () => {
    const puzzle = makePuzzle('riddle');
    const events = buildEvents(puzzle);
    const player = makeMutator();
    const { messages, emit, emitHtml } = collector();

    const result = applyExternalSetState(
      ref(`${WORLD}:puzzle:riddle`), 'active',
      events, player, emit, emitHtml,
    );

    expect(result.acted).toBe(true);
    expect(result.puzzleActivated).toBe(ref(`${WORLD}:puzzle:riddle`));
  });

  it('skips already-solved puzzle', () => {
    const puzzle = makePuzzle('riddle');
    const events = buildEvents(puzzle);
    const player = makeMutator({ states: { [ref(`${WORLD}:puzzle:riddle`)]: 'solved' } });
    const { messages, emit, emitHtml } = collector();

    const result = applyExternalSetState(
      ref(`${WORLD}:puzzle:riddle`), 'active',
      events, player, emit, emitHtml,
    );

    expect(result.puzzleActivated).toBeNull();
    expect(messages.some((m) => m.text?.includes('already solved'))).toBe(true);
  });

  it('unlocks a portal with transition text', () => {
    const portal = makePortal('gate', [
      [`${WORLD}:place:a`, 'north'],
      [`${WORLD}:place:b`, 'south'],
    ], {
      state: 'locked',
      transitions: [['locked', 'open', 'The gate creaks open.']],
    });
    const events = buildEvents(portal);
    const player = makeMutator();
    const { messages, emit, emitHtml } = collector();

    applyExternalSetState(
      ref(`${WORLD}:portal:gate`), 'open',
      events, player, emit, emitHtml,
    );

    expect(player.getState(ref(`${WORLD}:portal:gate`))).toBe('open');
    expect(messages.some((m) => m.text === 'The gate creaks open.')).toBe(true);
  });

  it('transitions a feature', () => {
    const feature = makeFeature('torch', {
      state: 'unlit',
      transitions: [['unlit', 'lit', 'The torch blazes to life.']],
    });
    const events = buildEvents(feature);
    const player = makeMutator();
    const { messages, emit, emitHtml } = collector();

    applyExternalSetState(
      ref(`${WORLD}:feature:torch`), 'lit',
      events, player, emit, emitHtml,
    );

    expect(player.getState(ref(`${WORLD}:feature:torch`))).toBe('lit');
    expect(messages.some((m) => m.text === 'The torch blazes to life.')).toBe(true);
  });

  it('returns acted:false for unknown event', () => {
    const events = buildEvents();
    const player = makeMutator();
    const { emit, emitHtml } = collector();

    const result = applyExternalSetState(
      ref(`${WORLD}:feature:nonexistent`), 'open',
      events, player, emit, emitHtml,
    );
    expect(result.acted).toBe(false);
  });
});

// ── giveItem ────────────────────────────────────────────────────────────

describe('giveItem', () => {
  it('adds item with default state and counters', () => {
    const sword = makeItem('sword', {
      state: 'sheathed',
      counters: [['durability', 50]],
    });
    const events = buildEvents(sword);
    const player = makeMutator();
    const { messages, emit } = collector();

    giveItem(ref(`${WORLD}:item:sword`), events, player, emit);

    const swordRef = ref(`${WORLD}:item:sword`);
    expect(player.hasItem(swordRef)).toBe(true);
    expect(player.getState(swordRef)).toBe('sheathed');
    expect(player.getCounter(`${swordRef}:durability`)).toBe(50);
    expect(messages.some((m) => m.text?.includes('Sword'))).toBe(true);
  });

  it('does not duplicate if already held', () => {
    const sword = makeItem('sword');
    const events = buildEvents(sword);
    const player = makeMutator({ inventory: [ref(`${WORLD}:item:sword`)] });
    const { messages, emit } = collector();

    giveItem(ref(`${WORLD}:item:sword`), events, player, emit);

    expect(messages).toHaveLength(0);
  });
});

// ── evalCounterLow ──────────────────────────────────────────────────────

describe('evalCounterLow', () => {
  it('fires set-state when counter is at or below threshold', () => {
    const lantern = makeItem('lantern', {
      state: 'on',
      onCounter: [['down', 'battery', '20', 'set-state', 'flickering']],
      transitions: [['on', 'flickering', 'The lantern flickers.']],
    });
    const events = buildEvents(lantern);
    const lanternRef = ref(`${WORLD}:item:lantern`);
    const player = makeMutator({
      inventory: [lanternRef],
      states: { [lanternRef]: 'on' },
      counters: { [`${lanternRef}:battery`]: 15 },
    });
    const { messages, emit } = collector();

    evalCounterLow(lantern, lanternRef, 'on', player, emit);

    expect(player.getState(lanternRef)).toBe('flickering');
    expect(messages.some((m) => m.text === 'The lantern flickers.')).toBe(true);
  });

  it('does not fire when counter is above threshold', () => {
    const lantern = makeItem('lantern', {
      state: 'on',
      onCounter: [['down', 'battery', '20', 'set-state', 'flickering']],
      transitions: [['on', 'flickering', 'Flickers.']],
    });
    const lanternRef = ref(`${WORLD}:item:lantern`);
    const player = makeMutator({
      inventory: [lanternRef],
      states: { [lanternRef]: 'on' },
      counters: { [`${lanternRef}:battery`]: 50 },
    });
    const { messages, emit } = collector();

    evalCounterLow(lantern, lanternRef, 'on', player, emit);

    expect(player.getState(lanternRef)).toBe('on');
    expect(messages).toHaveLength(0);
  });

  it('does not fire when already in target state', () => {
    const lantern = makeItem('lantern', {
      state: 'on',
      onCounter: [['down', 'battery', '20', 'set-state', 'flickering']],
      transitions: [['on', 'flickering', 'Flickers.']],
    });
    const lanternRef = ref(`${WORLD}:item:lantern`);
    const player = makeMutator({
      inventory: [lanternRef],
      states: { [lanternRef]: 'flickering' },
      counters: { [`${lanternRef}:battery`]: 15 },
    });
    const { messages, emit } = collector();

    evalCounterLow(lantern, lanternRef, 'flickering', player, emit);

    expect(messages).toHaveLength(0);
  });
});
