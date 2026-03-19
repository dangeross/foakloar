/**
 * Tests for on-fail trigger — fires on wrong puzzle answer.
 */
import { describe, it, expect } from 'vitest';
import { makePlace, makeFeature, makePuzzle, buildEvents, makeEngine, ref, WORLD } from './helpers.js';

describe('on-fail trigger', () => {
  async function setupRiddle({ onFail = [] } = {}) {
    // SHA-256 of "answer" + "salt1" = known hash
    const answer = 'answer';
    const salt = 'salt1';
    const data = new TextEncoder().encode(answer + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const answerHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const panel = makeFeature('panel', {
      nouns: [['panel']],
      verbs: [['use']],
      onInteract: [['use', 'set-state', 'active', ref(`${WORLD}:puzzle:riddle`)]],
    });
    const puzzle = makePuzzle('riddle', {
      puzzleType: 'riddle',
      answerHash,
      salt,
      extraTags: onFail.map((f) => ['on-fail', ...f]),
    });
    const place = makePlace('start', {
      features: [`${WORLD}:feature:panel`],
      puzzles: [`${WORLD}:puzzle:riddle`],
    });
    const events = buildEvents(place, panel, puzzle);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:start`),
      health: 10,
      maxHealth: 10,
    });
    engine.enterRoom();
    engine.flush();
    // Activate puzzle
    await engine.handleCommand('use panel');
    engine.flush();
    return { engine, answerHash };
  }

  it('fires deal-damage on wrong answer', async () => {
    const { engine } = await setupRiddle({
      onFail: [['', 'deal-damage', '3']],
    });
    await engine.handleCommand('wrong answer');
    const msgs = engine.flush();
    expect(msgs.some((m) => m.text.includes('not the answer'))).toBe(true);
    expect(engine.player.state.health).toBe(7);
  });

  it('does not fire on-fail on correct answer', async () => {
    const { engine } = await setupRiddle({
      onFail: [['', 'deal-damage', '3']],
    });
    await engine.handleCommand('answer');
    const msgs = engine.flush();
    expect(msgs.some((m) => m.text.includes('not the answer'))).toBe(false);
    expect(engine.player.state.health).toBe(10);
  });
});
