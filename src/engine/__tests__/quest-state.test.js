/**
 * Tests for quest state as set-state target and dialogue guard.
 *
 * Covers three bugs fixed together:
 *  1. applyExternalSetState silently ignored quest targets
 *  2. resolveDialogueEntry never passed quest-gated dialogue entries
 *  3. _showQuestLog showed all quests as active (not just state=active ones)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeEngine, makePlace, makePortal, makeFeature, makeNPC,
  makeDialogueNode, makeQuest, makeClue, buildEvents, ref, WORLD,
} from './helpers.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeWorld() {
  // Clue required to complete quests — never seen in tests, so quests won't
  // auto-complete via _evalQuests and their state stays under test control.
  const blocker = makeClue('blocker');
  const questA = makeQuest('quest-a', {
    involves: [],
    requires: [[ref(`${WORLD}:clue:blocker`), 'visible', '']],
  });
  const questB = makeQuest('quest-b', {
    involves: [],
    requires: [[ref(`${WORLD}:clue:blocker`), 'visible', '']],
  });

  // Feature that sets quest-a to active on interact
  const lever = makeFeature('lever', {
    verbs: [['pull']],
    onInteract: [['pull', 'set-state', 'active', ref(`${WORLD}:quest:quest-a`)]],
  });

  // NPC with two dialogue entries:
  //   entry-default — no guard (always shown)
  //   entry-gated   — only when quest-a is active
  const dialogDefault = makeDialogueNode('entry-default', { text: 'Hello.' });
  const dialogGated   = makeDialogueNode('entry-gated',   { text: 'Glad you did it.' });

  const npc = makeNPC('guide', {
    dialogue: [
      [ref(`${WORLD}:dialogue:entry-default`)],
      [ref(`${WORLD}:dialogue:entry-gated`), ref(`${WORLD}:quest:quest-a`), 'active'],
    ],
  });

  const place = makePlace('start', {
    features: [`${WORLD}:feature:lever`],
    npcs: [`${WORLD}:npc:guide`],
    exits: ['north'],
  });

  const portal = makePortal('start-loop', [
    [`${WORLD}:place:start`, 'north', ''],
    [`${WORLD}:place:start`, 'south', ''],
  ]);

  const events = buildEvents(place, portal, lever, npc, dialogDefault, dialogGated, questA, questB, blocker);
  const engine = makeEngine(events);
  engine.enterRoom(ref(`${WORLD}:place:start`));
  engine.flush();
  return { engine, events, questA, questB, lever, npc };
}

// ── 1. set-state on quest target ──────────────────────────────────────────

describe('set-state quest target', () => {
  it('sets quest state to active via on-interact action', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);

    expect(engine.player.getState(questRef)).toBeUndefined();
    engine.handleCommand('pull lever');
    expect(engine.player.getState(questRef)).toBe('active');
  });

  it('can set quest state to complete', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);

    engine.player.setState(questRef, 'active');
    engine._dispatchAction({
      action: 'set-state',
      target: 'complete',
      extRef: questRef,
      selfDtag: 'test',
      selfEvent: null,
    });
    expect(engine.player.getState(questRef)).toBe('complete');
  });

  it('does not emit text when setting quest state', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    const output = [];
    engine._emit = (t) => output.push(t);

    engine._dispatchAction({
      action: 'set-state',
      target: 'active',
      extRef: questRef,
      selfDtag: 'test',
      selfEvent: null,
    });
    // No narrative text should be emitted for quest state changes
    expect(output.filter(t => typeof t === 'string' && t.length > 0)).toHaveLength(0);
  });
});

// ── 2. dialogue gated on quest state ─────────────────────────────────────

describe('dialogue guard on quest state', () => {
  it('uses default dialogue before quest is active', () => {
    const { engine } = makeWorld();
    const npcRef = ref(`${WORLD}:npc:guide`);
    const npcEvent = engine.events.get(npcRef);

    const entry = engine.resolveDialogueEntry(npcEvent);
    expect(entry).toBe(ref(`${WORLD}:dialogue:entry-default`));
  });

  it('switches to gated dialogue once quest is active', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    const npcRef = ref(`${WORLD}:npc:guide`);
    const npcEvent = engine.events.get(npcRef);

    engine.player.setState(questRef, 'active');
    const entry = engine.resolveDialogueEntry(npcEvent);
    expect(entry).toBe(ref(`${WORLD}:dialogue:entry-gated`));
  });

  it('falls back to default dialogue if quest is not yet active', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    const npcRef = ref(`${WORLD}:npc:guide`);
    const npcEvent = engine.events.get(npcRef);

    // Explicitly a different state — should not match 'active' guard
    engine.player.setState(questRef, 'complete');
    // entry-gated requires active, not complete — falls back to default
    // (last unguarded entry wins)
    const entry = engine.resolveDialogueEntry(npcEvent);
    // Both entries evaluated: default always passes, gated requires active (not complete)
    // Since gated is listed after default and doesn't pass, result is default
    expect(entry).toBe(ref(`${WORLD}:dialogue:entry-default`));
  });

  it('full chain: pull lever → quest active → dialogue switches', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    const npcRef   = ref(`${WORLD}:npc:guide`);
    const npcEvent = engine.events.get(npcRef);

    // Before action
    expect(engine.resolveDialogueEntry(npcEvent)).toBe(ref(`${WORLD}:dialogue:entry-default`));

    // Trigger action
    engine.handleCommand('pull lever');
    expect(engine.player.getState(questRef)).toBe('active');

    // After action
    expect(engine.resolveDialogueEntry(npcEvent)).toBe(ref(`${WORLD}:dialogue:entry-gated`));
  });
});

// ── 3. quest log only shows active/complete quests ────────────────────────

describe('quest log filtering', () => {
  it('shows nothing when quests exist but none are active or complete', () => {
    const { engine } = makeWorld();
    engine._showQuestLog();
    const lines = engine.flush().map((e) => e.text).filter(Boolean);
    // Quests with no state (not yet activated) produce no output
    expect(lines.filter((l) => l.includes('Quest-a') || l.includes('Quest-b'))).toHaveLength(0);
  });

  it('shows quest in active list when state is active', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    engine.player.setState(questRef, 'active');

    const output = [];
    engine._emit = (t) => output.push(t);
    engine._emitHtml = (t) => output.push(t);

    engine._showQuestLog();
    const text = output.join(' ');
    expect(text).toContain('Active quests');
    expect(text).toContain('Quest-a');
    expect(text).not.toContain('Quest-b'); // quest-b has no state
  });

  it('shows quest in completed list when state is complete', () => {
    const { engine } = makeWorld();
    const questRef = ref(`${WORLD}:quest:quest-a`);
    engine.player.setState(questRef, 'complete');

    const output = [];
    engine._emit = (t) => output.push(t);
    engine._emitHtml = (t) => output.push(t);

    engine._showQuestLog();
    const text = output.join(' ');
    expect(text).toContain('Completed');
    expect(text).toContain('Quest-a');
  });

  it('does not show quests with undefined state', () => {
    const { engine } = makeWorld();
    // No states set — both quests have undefined state

    const output = [];
    engine._emit = (t) => output.push(t);
    engine._emitHtml = (t) => output.push(t);

    engine._showQuestLog();
    const text = output.join(' ');
    expect(text).not.toContain('Quest-a');
    expect(text).not.toContain('Quest-b');
  });
});
