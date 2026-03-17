/**
 * validateWorld.test.js — Tests for cross-event world validation.
 */

import { describe, it, expect } from 'vitest';
import { validateWorld, extractDTagFromRef, verifyPuzzleHashes } from '../validateWorld.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PK = '<PUBKEY>';

function makeEvent(dTag, type, extraTags = [], content = '') {
  return {
    kind: 30078,
    tags: [
      ['d', dTag],
      ['t', 'test'],
      ['type', type],
      ...extraTags,
    ],
    content,
  };
}

function ref(dTag) {
  return `30078:${PK}:${dTag}`;
}

// ── extractDTagFromRef ───────────────────────────────────────────────────────

describe('extractDTagFromRef', () => {
  it('extracts d-tag from <PUBKEY> ref', () => {
    expect(extractDTagFromRef('30078:<PUBKEY>:the-lake:feature:lamp')).toBe('the-lake:feature:lamp');
  });

  it('extracts d-tag from real pubkey ref', () => {
    const pk = 'a'.repeat(64);
    expect(extractDTagFromRef(`30078:${pk}:the-lake:feature:lamp`)).toBe('the-lake:feature:lamp');
  });

  it('returns null for non-ref string', () => {
    expect(extractDTagFromRef('hello')).toBeNull();
  });

  it('returns null for non-string', () => {
    expect(extractDTagFromRef(42)).toBeNull();
  });
});

// ── Dangling refs ────────────────────────────────────────────────────────────

describe('validateWorld — dangling refs', () => {
  it('warns on unresolvable event ref', () => {
    const events = [
      makeEvent('test:place:room', 'place', [
        ['exit', ref('test:place:other'), 'north', 'North.'],
      ]),
      // test:place:other does not exist
    ];
    const { warnings } = validateWorld(events);
    expect(warnings.some((w) => w.message.includes('test:place:other') && w.message.includes('not in this world'))).toBe(true);
  });

  it('no warning when ref resolves', () => {
    const events = [
      makeEvent('test:place:room', 'place', [
        ['exit', ref('test:place:other'), 'north', 'North.'],
      ]),
      makeEvent('test:place:other', 'place'),
    ];
    const { warnings } = validateWorld(events);
    expect(warnings.some((w) => w.message.includes('not in this world'))).toBe(false);
  });
});

// ── Place puzzle tag ─────────────────────────────────────────────────────────

describe('validateWorld — place puzzle tag', () => {
  it('warns when place puzzle tag references a riddle (not sequence)', () => {
    const events = [
      makeEvent('test:place:room', 'place', [
        ['puzzle', ref('test:puzzle:riddle')],
      ]),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc'],
        ['salt', 'test:puzzle:riddle:v1'],
      ]),
    ];
    const { warnings } = validateWorld(events);
    expect(warnings.some((w) => w.message.includes('only sequence puzzles'))).toBe(true);
  });

  it('no warning when place puzzle tag references a sequence puzzle', () => {
    const events = [
      makeEvent('test:place:room', 'place', [
        ['puzzle', ref('test:puzzle:seq')],
      ]),
      makeEvent('test:puzzle:seq', 'puzzle', [
        ['puzzle-type', 'sequence'],
      ]),
    ];
    const { warnings } = validateWorld(events);
    expect(warnings.some((w) => w.message.includes('only sequence puzzles'))).toBe(false);
  });
});

// ── NIP-44 content ───────────────────────────────────────────────────────────

describe('validateWorld — NIP-44 content', () => {
  it('errors when puzzle event not found', () => {
    const events = [
      makeEvent('test:place:secret', 'place', [
        ['content-type', 'application/nip44', 'text/markdown'],
        ['puzzle', ref('test:puzzle:missing')],
      ], 'Sealed.'),
    ];
    const { errors } = validateWorld(events);
    expect(errors.some((e) => e.message.includes('test:puzzle:missing') && e.message.includes('not in this world'))).toBe(true);
  });

  it('errors when puzzle has no salt', () => {
    const events = [
      makeEvent('test:place:secret', 'place', [
        ['content-type', 'application/nip44', 'text/markdown'],
        ['puzzle', ref('test:puzzle:riddle')],
      ], 'Sealed.'),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc'],
        // no salt
      ]),
    ];
    const { errors } = validateWorld(events);
    expect(errors.some((e) => e.message.includes('no salt tag'))).toBe(true);
  });

  it('errors when no answer stored for puzzle', () => {
    const events = [
      makeEvent('test:place:secret', 'place', [
        ['content-type', 'application/nip44', 'text/markdown'],
        ['puzzle', ref('test:puzzle:riddle')],
      ], 'Sealed.'),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc'],
        ['salt', 'test:puzzle:riddle:v1'],
      ]),
    ];
    const { errors } = validateWorld(events, {}); // no answers
    expect(errors.some((e) => e.message.includes('no answer is stored'))).toBe(true);
  });

  it('no errors when puzzle, salt, and answer all present', () => {
    const events = [
      makeEvent('test:place:secret', 'place', [
        ['content-type', 'application/nip44', 'text/markdown'],
        ['puzzle', ref('test:puzzle:riddle')],
      ], 'Sealed.'),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc'],
        ['salt', 'test:puzzle:riddle:v1'],
      ]),
    ];
    const answers = { 'test:puzzle:riddle': 'the-answer' };
    const { errors } = validateWorld(events, answers);
    expect(errors).toHaveLength(0);
  });
});

// ── on-interact targeting puzzle without answer ──────────────────────────────

describe('validateWorld — on-interact puzzle answer', () => {
  it('warns when on-interact targets puzzle with answer-hash but no stored answer', () => {
    const events = [
      makeEvent('test:feature:panel', 'feature', [
        ['on-interact', 'use', 'set-state', 'active', ref('test:puzzle:riddle')],
      ]),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc123'],
        ['salt', 'test:puzzle:riddle:v1'],
      ]),
    ];
    const { warnings } = validateWorld(events, {});
    expect(warnings.some((w) => w.message.includes('test:puzzle:riddle') && w.message.includes('no answer stored'))).toBe(true);
  });

  it('no warning when answer is stored', () => {
    const events = [
      makeEvent('test:feature:panel', 'feature', [
        ['on-interact', 'use', 'set-state', 'active', ref('test:puzzle:riddle')],
      ]),
      makeEvent('test:puzzle:riddle', 'puzzle', [
        ['puzzle-type', 'riddle'],
        ['answer-hash', 'abc123'],
        ['salt', 'test:puzzle:riddle:v1'],
      ]),
    ];
    const answers = { 'test:puzzle:riddle': 'the-answer' };
    const { warnings } = validateWorld(events, answers);
    expect(warnings.some((w) => w.message.includes('no answer stored'))).toBe(false);
  });
});

// ── verifyPuzzleHashes ──────────────────────────────────────────────────────

describe('verifyPuzzleHashes', () => {
  it('returns no errors when answer hashes match (case-sensitive)', async () => {
    // Pre-compute: SHA-256("Hello" + "salt1") — engine preserves case, only trims
    const data = new TextEncoder().encode('Hello' + 'salt1');
    const buf = await crypto.subtle.digest('SHA-256', data);
    const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const errors = await verifyPuzzleHashes([
      { dTag: 'test:puzzle:one', answerHash: hash, salt: 'salt1', answer: 'Hello' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('returns error when case differs (case-sensitive hashing)', async () => {
    // Hash computed from lowercase "hello", but answer stored as "Hello"
    const data = new TextEncoder().encode('hello' + 'salt1');
    const buf = await crypto.subtle.digest('SHA-256', data);
    const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const errors = await verifyPuzzleHashes([
      { dTag: 'test:puzzle:one', answerHash: hash, salt: 'salt1', answer: 'Hello' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Answer hash mismatch');
  });

  it('returns error when answer hash does not match', async () => {
    const errors = await verifyPuzzleHashes([
      { dTag: 'test:puzzle:one', answerHash: 'deadbeef', salt: 'salt1', answer: 'Hello' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].dTag).toBe('test:puzzle:one');
    expect(errors[0].message).toContain('Answer hash mismatch');
  });
});
