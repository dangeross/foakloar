/**
 * Tests for on-option: actions fired when the player selects a dialogue option.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine.js';
import {
  ref, PUBKEY, WORLD,
  makePlace, makeNPC, makeDialogueNode, makeItem,
  buildEvents, makeMutator,
} from './helpers.js';

const CONFIG = { GENESIS_PLACE: ref(`${WORLD}:place:start`), AUTHOR_PUBKEY: PUBKEY };

function createEngine(events, playerOverrides = {}) {
  const player = makeMutator(playerOverrides);
  const eventsMap = Array.isArray(events) ? buildEvents(...events) : events;
  return new GameEngine({ events: eventsMap, player, config: CONFIG });
}

describe('on-option: fire actions when dialogue choice is made', () => {
  it('fires set-state on an external event when matching option is chosen', async () => {
    const item = makeItem('journal', {
      nouns: [['journal']],
      content: 'A journal.',
    });

    const choiceNode = makeDialogueNode('fork', {
      text: 'Choose a side.',
      options: [
        ['side-with-hermit', ''],
        ['side-with-guild', ''],
      ],
      extraTags: [
        ['on-option', 'side-with-hermit', 'set-state', 'ally', ref(`${WORLD}:item:journal`)],
        ['on-option', 'side-with-guild', 'set-state', 'enemy', ref(`${WORLD}:item:journal`)],
      ],
    });

    const npc = makeNPC('elder', {
      extraTags: [['dialogue', ref(`${WORLD}:dialogue:fork`)]],
    });

    const place = makePlace('start', { npcs: [`${WORLD}:npc:elder`] });

    const events = buildEvents(place, npc, choiceNode, item);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:start`),
      inventory: [ref(`${WORLD}:item:journal`)],
    });
    engine.enterRoom(ref(`${WORLD}:place:start`));
    engine.flush();

    await engine.handleCommand('talk elder');
    engine.flush();

    expect(engine.dialogueActive).not.toBeNull();

    // Choose option 1 — side-with-hermit
    await engine.handleCommand('1');
    engine.flush();

    // Journal state should now be 'ally'
    expect(engine.player.getState(ref(`${WORLD}:item:journal`))).toBe('ally');
    expect(engine.dialogueActive).toBeNull();
  });

  it('fires the action for the selected option only, not others', async () => {
    const item = makeItem('flag', { nouns: [['flag']] });

    const choiceNode = makeDialogueNode('choice', {
      text: 'Pick one.',
      options: [
        ['option-a', ''],
        ['option-b', ''],
      ],
      extraTags: [
        ['on-option', 'option-a', 'set-state', 'a-picked', ref(`${WORLD}:item:flag`)],
        ['on-option', 'option-b', 'set-state', 'b-picked', ref(`${WORLD}:item:flag`)],
      ],
    });

    const npc = makeNPC('guide', {
      extraTags: [['dialogue', ref(`${WORLD}:dialogue:choice`)]],
    });

    const place = makePlace('start', { npcs: [`${WORLD}:npc:guide`] });
    const events = buildEvents(place, npc, choiceNode, item);
    const engine = createEngine(events, {
      place: ref(`${WORLD}:place:start`),
      inventory: [ref(`${WORLD}:item:flag`)],
    });
    engine.enterRoom(ref(`${WORLD}:place:start`));
    engine.flush();

    await engine.handleCommand('talk guide');
    engine.flush();

    // Choose option 2 — option-b
    await engine.handleCommand('2');
    engine.flush();

    expect(engine.player.getState(ref(`${WORLD}:item:flag`))).toBe('b-picked');
  });

  it('gives an item via on-option', async () => {
    const token = makeItem('token', {
      nouns: [['token']],
      content: 'A silver token.',
    });

    const choiceNode = makeDialogueNode('reward', {
      text: 'Take it or leave it?',
      options: [
        ['take it', ''],
        ['leave it', ''],
      ],
      extraTags: [
        ['on-option', 'take it', 'give-item', ref(`${WORLD}:item:token`)],
      ],
    });

    const npc = makeNPC('merchant', {
      extraTags: [['dialogue', ref(`${WORLD}:dialogue:reward`)]],
    });

    const place = makePlace('start', { npcs: [`${WORLD}:npc:merchant`] });
    const events = buildEvents(place, npc, choiceNode, token);
    const engine = createEngine(events, { place: ref(`${WORLD}:place:start`) });
    engine.enterRoom(ref(`${WORLD}:place:start`));
    engine.flush();

    await engine.handleCommand('talk merchant');
    engine.flush();

    await engine.handleCommand('1'); // take it
    engine.flush();

    expect(engine.player.hasItem(ref(`${WORLD}:item:token`))).toBe(true);
  });
});
