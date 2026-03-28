import { describe, it, expect, beforeEach } from 'vitest';
import { validateImport, importEvents } from '../draftStore.js';

// Mock localStorage
const storage = {};
const mockLocalStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

// Provide crypto.randomUUID if not available in test env
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
}

function makeEvent(dTag, type, content = '', extraTags = []) {
  return {
    kind: 30078,
    tags: [['d', dTag], ['t', 'test-world'], ['type', type], ...extraTags],
    content,
  };
}

describe('validateImport — smart diffing', () => {
  beforeEach(() => {
    for (const k of Object.keys(storage)) delete storage[k];
  });

  it('all events valid when no existing drafts or published', () => {
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'A hub.')] };
    const result = validateImport('test-world', data);
    expect(result.valid.length).toBe(1);
    expect(result.unchangedCount).toBe(0);
    expect(result.updatedCount).toBe(0);
  });

  it('skips events unchanged from existing drafts', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'A hub.');
    // Pre-populate drafts
    storage['drafts:test-world'] = JSON.stringify({
      events: [{ ...ev, _draft: { id: '1', createdAt: 1, updatedAt: 1 } }],
      answers: {},
    });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'A hub.')] };
    const result = validateImport('test-world', data);
    expect(result.valid.length).toBe(0);
    expect(result.unchangedCount).toBe(1);
  });

  it('marks events as updated when content differs from draft', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'Old content.');
    storage['drafts:test-world'] = JSON.stringify({
      events: [{ ...ev, _draft: { id: '1', createdAt: 1, updatedAt: 1 } }],
      answers: {},
    });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'New content.')] };
    const result = validateImport('test-world', data);
    expect(result.valid.length).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.unchangedCount).toBe(0);
  });

  it('marks events as updated when tags differ from draft', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'A hub.', [['exit', 'north']]);
    storage['drafts:test-world'] = JSON.stringify({
      events: [{ ...ev, _draft: { id: '1', createdAt: 1, updatedAt: 1 } }],
      answers: {},
    });
    // Same content but different tags (added exit south)
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'A hub.', [['exit', 'north'], ['exit', 'south']])] };
    const result = validateImport('test-world', data);
    expect(result.valid.length).toBe(1);
    expect(result.updatedCount).toBe(1);
  });

  it('skips events unchanged from published events', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'A hub.');
    const published = new Map();
    published.set('30078:abc:test-world:place:hub', { ...ev, pubkey: 'abc', id: 'x', sig: 'y', created_at: 100 });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'A hub.')] };
    const result = validateImport('test-world', data, published);
    expect(result.valid.length).toBe(0);
    expect(result.unchangedCount).toBe(1);
  });

  it('allows events that differ from published', () => {
    const published = new Map();
    published.set('30078:abc:test-world:place:hub', {
      ...makeEvent('test-world:place:hub', 'place', 'Old published content.'),
      pubkey: 'abc', id: 'x', sig: 'y', created_at: 100,
    });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'Updated content.')] };
    const result = validateImport('test-world', data, published);
    expect(result.valid.length).toBe(1);
    expect(result.unchangedCount).toBe(0);
  });

  it('handles mix of new, updated, unchanged', () => {
    const existing = makeEvent('test-world:place:hub', 'place', 'Same.');
    const changed = makeEvent('test-world:place:cave', 'place', 'Old cave.');
    storage['drafts:test-world'] = JSON.stringify({
      events: [
        { ...existing, _draft: { id: '1', createdAt: 1, updatedAt: 1 } },
        { ...changed, _draft: { id: '2', createdAt: 1, updatedAt: 1 } },
      ],
      answers: {},
    });
    const data = {
      events: [
        makeEvent('test-world:place:hub', 'place', 'Same.'),          // unchanged
        makeEvent('test-world:place:cave', 'place', 'New cave text.'), // updated
        makeEvent('test-world:place:forest', 'place', 'A forest.'),   // new
      ],
    };
    const result = validateImport('test-world', data);
    expect(result.unchangedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.valid.length).toBe(2); // updated + new
  });
});

describe('importEvents — smart update', () => {
  beforeEach(() => {
    for (const k of Object.keys(storage)) delete storage[k];
  });

  it('adds new events as drafts', () => {
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'A hub.')] };
    const result = importEvents('test-world', data);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('updates existing draft when content changes', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'Old.');
    storage['drafts:test-world'] = JSON.stringify({
      events: [{ ...ev, _draft: { id: 'original-id', createdAt: 1, updatedAt: 1 } }],
      answers: {},
    });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'New.')] };
    const result = importEvents('test-world', data);
    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    // Verify the draft was updated in-place (preserves original ID)
    const store = JSON.parse(storage['drafts:test-world']);
    expect(store.events[0].content).toBe('New.');
    expect(store.events[0]._draft.id).toBe('original-id');
  });

  it('skips identical events', () => {
    const ev = makeEvent('test-world:place:hub', 'place', 'Same.');
    storage['drafts:test-world'] = JSON.stringify({
      events: [{ ...ev, _draft: { id: '1', createdAt: 1, updatedAt: 1 } }],
      answers: {},
    });
    const data = { events: [makeEvent('test-world:place:hub', 'place', 'Same.')] };
    const result = importEvents('test-world', data);
    expect(result.imported).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
