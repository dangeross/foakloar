/**
 * Test helpers — factory functions for building NOSTR events and engine instances.
 */
import { PlayerStateMutator } from '../player-state.js';
import { GameEngine } from '../engine.js';

const PUBKEY = 'testpubkey0000000000000000000000000000000000000000000000000000';
const WORLD = 'test-world';

export { PUBKEY, WORLD };

/** Build an a-tag event ref from a d-tag. */
export function ref(dtag) {
  return `30078:${PUBKEY}:${dtag}`;
}

/** Create a minimal NOSTR event with tags. */
export function makeEvent(dtag, tags = [], content = '') {
  return {
    kind: 30078,
    pubkey: PUBKEY,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', dtag], ...tags],
    content,
  };
}

/** Create a place event. */
export function makePlace(name, { features = [], items = [], npcs = [], portals = [], puzzles = [], extraTags = [] } = {}) {
  const dtag = `${WORLD}:place:${name}`;
  const tags = [
    ['type', 'place'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ...features.map((f) => ['feature', ref(f)]),
    ...items.map((i) => ['item', ref(i)]),
    ...npcs.map((n) => ['npc', ref(n)]),
    ...portals.map((p) => ['portal', ref(p)]),
    ...puzzles.map((p) => ['puzzle', ref(p)]),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, `You are in the ${name}.`);
}

/** Create a feature event. */
export function makeFeature(name, { state, transitions = [], verbs = [], nouns = [], onInteract = [], requires = [], description, extraTags = [] } = {}) {
  const dtag = `${WORLD}:feature:${name}`;
  const tags = [
    ['type', 'feature'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ...(state ? [['state', state]] : []),
    ...transitions.map((t) => ['transition', t[0], t[1], t[2] || '']),
    ...verbs.map((v) => ['verb', ...v]),
    ...nouns.map((n) => ['noun', ...n]),
    ...onInteract.map((oi) => ['on-interact', ...oi]),
    ...requires.map((r) => ['requires', ...r]),
    ...(description ? [['description', description]] : []),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Create an item event. */
export function makeItem(name, { state, counters = [], verbs = [], nouns = [], onInteract = [], onMove = [], onCounter = [], transitions = [], description, extraTags = [] } = {}) {
  const dtag = `${WORLD}:item:${name}`;
  const tags = [
    ['type', 'item'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ...(state ? [['state', state]] : []),
    ...counters.map((c) => ['counter', c[0], String(c[1])]),
    ...transitions.map((t) => ['transition', t[0], t[1], t[2] || '']),
    ...verbs.map((v) => ['verb', ...v]),
    ...nouns.map((n) => ['noun', ...n]),
    ...onInteract.map((oi) => ['on-interact', ...oi]),
    ...onMove.map((om) => ['on-move', ...om]),
    ...onCounter.map((oc) => ['on-counter', ...oc]),
    ...(description ? [['description', description]] : []),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Create a portal event. */
export function makePortal(name, exits, { state, transitions = [], requires = [], extraTags = [] } = {}) {
  const dtag = `${WORLD}:portal:${name}`;
  const tags = [
    ['type', 'portal'],
    ...exits.map((e) => ['exit', ref(e[0]), e[1], e[2] || '']),
    ...(state ? [['state', state]] : []),
    ...transitions.map((t) => ['transition', t[0], t[1], t[2] || '']),
    ...requires.map((r) => ['requires', ...r]),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Create a puzzle event. */
export function makePuzzle(name, { puzzleType, answerHash, salt, onComplete = [], requires = [], extraTags = [] } = {}) {
  const dtag = `${WORLD}:puzzle:${name}`;
  const tags = [
    ['type', 'puzzle'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ...(puzzleType ? [['puzzle-type', puzzleType]] : []),
    ...(answerHash ? [['answer-hash', answerHash]] : []),
    ...(salt ? [['salt', salt]] : []),
    ...onComplete.map((oc) => ['on-complete', ...oc]),
    ...requires.map((r) => ['requires', ...r]),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, 'What is the answer?');
}

/** Create a clue event. */
export function makeClue(name, content = 'A mysterious clue.') {
  const dtag = `${WORLD}:clue:${name}`;
  return makeEvent(dtag, [['type', 'clue'], ['title', name.charAt(0).toUpperCase() + name.slice(1)]], content);
}

/** Create an NPC event. */
export function makeNPC(name, { dialogue = [], requires = [], description, extraTags = [] } = {}) {
  const dtag = `${WORLD}:npc:${name}`;
  const tags = [
    ['type', 'npc'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ['noun', name],
    ...dialogue.map((d) => ['dialogue', ...d]),
    ...requires.map((r) => ['requires', ...r]),
    ...(description ? [['description', description]] : []),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Create a dialogue node event. */
export function makeDialogueNode(name, { text, options = [], onEnter = [], requires = [], extraTags = [] } = {}) {
  const dtag = `${WORLD}:dialogue:${name}`;
  const tags = [
    ['type', 'dialogue'],
    ...(text ? [['text', text]] : []),
    ...options.map((o) => ['option', o[0], o[1] ? ref(o[1]) : '']),
    ...onEnter.map((oe) => ['on-enter', ...oe]),
    ...requires.map((r) => ['requires', ...r]),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Build a Map<a-tag, event> from an array of events. */
export function buildEvents(...eventList) {
  const map = new Map();
  for (const ev of eventList) {
    const dtag = ev.tags.find((t) => t[0] === 'd')?.[1];
    if (dtag) map.set(`30078:${ev.pubkey}:${dtag}`, ev);
  }
  return map;
}

/** Create a roaming NPC event. */
export function makeRoamingNPC(name, { speed = 3, order = 'sequential', routes = [], stash, roamsWhen, inventory = [], onEncounter = [], onEnter = [], state, health, dialogue = [], requires = [], description, extraTags = [] } = {}) {
  const dtag = `${WORLD}:npc:${name}`;
  const tags = [
    ['type', 'npc'],
    ['title', name.charAt(0).toUpperCase() + name.slice(1)],
    ['noun', name],
    ['speed', String(speed)],
    ['order', order],
    ...routes.map((r) => ['route', ref(r)]),
    ...(stash ? [['stash', ref(stash)]] : []),
    ...(roamsWhen ? [['roams-when', roamsWhen]] : []),
    ...inventory.map((i) => ['inventory', ref(i)]),
    ...onEncounter.map((oe) => ['on-encounter', ...oe]),
    ...onEnter.map((oe) => ['on-enter', ...oe]),
    ...(state ? [['state', state]] : []),
    ...(health ? [['health', String(health)]] : []),
    ...dialogue.map((d) => ['dialogue', ...d]),
    ...requires.map((r) => ['requires', ...r]),
    ...(description ? [['description', description]] : []),
    ...extraTags,
  ];
  return makeEvent(dtag, tags, '');
}

/** Create a fresh player state. */
export function freshState(overrides = {}) {
  return {
    place: null,
    inventory: [],
    states: {},
    counters: {},
    cryptoKeys: [],
    dialogueVisited: {},
    paymentAttempts: {},
    visited: [],
    moveCount: 0,
    ...overrides,
  };
}

/** Create a PlayerStateMutator from optional overrides. */
export function makeMutator(overrides = {}, npcStates = {}) {
  return new PlayerStateMutator(freshState(overrides), npcStates);
}

/** Create a GameEngine with events, player, and config. */
export function makeEngine(events, playerOverrides = {}, configOverrides = {}, npcStates = {}) {
  const player = makeMutator(playerOverrides, npcStates);
  const config = {
    GENESIS_PLACE: ref(`${WORLD}:place:start`),
    AUTHOR_PUBKEY: PUBKEY,
    ...configOverrides,
  };
  return new GameEngine({ events, player, config });
}
