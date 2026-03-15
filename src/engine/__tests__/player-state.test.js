import { describe, it, expect } from 'vitest';
import { PlayerStateMutator } from '../player-state.js';
import { freshState } from './helpers.js';

describe('PlayerStateMutator', () => {
  // ── Construction ──────────────────────────────────────────────────────

  it('deep-clones the snapshot so mutations are isolated', () => {
    const original = freshState({ inventory: ['a'] });
    const m = new PlayerStateMutator(original);
    m.pickUp('b');
    expect(original.inventory).toEqual(['a']);
    expect(m.state.inventory).toContain('b');
  });

  // ── Inventory ─────────────────────────────────────────────────────────

  describe('inventory', () => {
    it('hasItem returns false for empty inventory', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.hasItem('sword')).toBe(false);
    });

    it('pickUp adds an item', () => {
      const m = new PlayerStateMutator(freshState());
      m.pickUp('sword');
      expect(m.hasItem('sword')).toBe(true);
    });

    it('pickUp is idempotent', () => {
      const m = new PlayerStateMutator(freshState());
      m.pickUp('sword');
      m.pickUp('sword');
      expect(m.state.inventory).toEqual(['sword']);
    });
  });

  // ── Unified state ─────────────────────────────────────────────────────

  describe('unified state', () => {
    it('getState returns undefined for unset key', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.getState('foo')).toBeUndefined();
    });

    it('setState / getState round-trips', () => {
      const m = new PlayerStateMutator(freshState());
      m.setState('door', 'open');
      expect(m.getState('door')).toBe('open');
    });

    it('setState overwrites previous value', () => {
      const m = new PlayerStateMutator(freshState());
      m.setState('door', 'locked');
      m.setState('door', 'open');
      expect(m.getState('door')).toBe('open');
    });
  });

  // ── Convenience wrappers ──────────────────────────────────────────────

  describe('convenience wrappers', () => {
    it('isPuzzleSolved / markPuzzleSolved', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.isPuzzleSolved('riddle')).toBe(false);
      m.markPuzzleSolved('riddle');
      expect(m.isPuzzleSolved('riddle')).toBe(true);
      expect(m.getState('riddle')).toBe('solved');
    });

    it('isClueSeen / markClueSeen', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.isClueSeen('note')).toBe(false);
      m.markClueSeen('note');
      expect(m.isClueSeen('note')).toBe(true);
      expect(m.getState('note')).toBe('seen');
    });

    it('markDialogueVisited / isDialogueVisited', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.isDialogueVisited('greet')).toBe(false);
      m.markDialogueVisited('greet');
      expect(m.isDialogueVisited('greet')).toBe(true);
    });
  });

  // ── Counters ──────────────────────────────────────────────────────────

  describe('counters', () => {
    it('getCounter returns undefined for unset', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.getCounter('lamp:battery')).toBeUndefined();
    });

    it('setCounter / getCounter round-trips', () => {
      const m = new PlayerStateMutator(freshState());
      m.setCounter('lamp:battery', 100);
      expect(m.getCounter('lamp:battery')).toBe(100);
    });
  });

  // ── Crypto Keys ───────────────────────────────────────────────────────

  describe('crypto keys', () => {
    it('addCryptoKey / hasCryptoKey', () => {
      const m = new PlayerStateMutator(freshState());
      expect(m.hasCryptoKey('abc')).toBe(false);
      m.addCryptoKey('abc');
      expect(m.hasCryptoKey('abc')).toBe(true);
    });

    it('addCryptoKey is idempotent', () => {
      const m = new PlayerStateMutator(freshState());
      m.addCryptoKey('abc');
      m.addCryptoKey('abc');
      expect(m.state.cryptoKeys).toEqual(['abc']);
    });
  });

  // ── Place ─────────────────────────────────────────────────────────────

  describe('place', () => {
    it('setPlace updates place and visited', () => {
      const m = new PlayerStateMutator(freshState());
      m.setPlace('room-a');
      expect(m.state.place).toBe('room-a');
      expect(m.state.visited).toContain('room-a');
    });

    it('setPlace does not duplicate visited entries', () => {
      const m = new PlayerStateMutator(freshState());
      m.setPlace('room-a');
      m.setPlace('room-b');
      m.setPlace('room-a');
      expect(m.state.visited.filter((v) => v === 'room-a')).toHaveLength(1);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────

  it('reset clears all state', () => {
    const m = new PlayerStateMutator(freshState());
    m.pickUp('sword');
    m.setState('door', 'open');
    m.setCounter('lamp:battery', 50);
    m.setPlace('room-a');
    m.reset();
    expect(m.state.inventory).toEqual([]);
    expect(m.state.states).toEqual({});
    expect(m.state.counters).toEqual({});
    expect(m.state.place).toBeNull();
    expect(m.state.visited).toEqual([]);
  });
});
