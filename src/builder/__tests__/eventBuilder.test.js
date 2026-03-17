/**
 * eventBuilder.test.js — Tests for event template building and validation.
 */

import { describe, it, expect } from 'vitest';
import { slugify, buildDTag, buildATag, buildEventTemplate, validateEvent } from '../eventBuilder.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTemplate(overrides = {}) {
  return {
    kind: 30078,
    tags: [
      ['d', 'the-lake:place:clearing'],
      ['t', 'the-lake'],
      ['type', 'place'],
      ['title', 'Forest Clearing'],
      ['exit', 'north'],
    ],
    content: 'A sunlit clearing in the forest.',
    ...overrides,
  };
}

// ── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and replaces spaces', () => {
    expect(slugify('Forest Clearing')).toBe('forest-clearing');
  });

  it('strips special characters', () => {
    expect(slugify("The King's Chamber!")).toBe('the-king-s-chamber');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });
});

// ── buildDTag / buildATag ────────────────────────────────────────────────────

describe('buildDTag', () => {
  it('joins components with colons', () => {
    expect(buildDTag('the-lake', 'place', 'Forest Clearing')).toBe('the-lake:place:forest-clearing');
  });
});

describe('buildATag', () => {
  it('builds 30078:pubkey:dtag format', () => {
    expect(buildATag('abc123', 'the-lake:place:clearing')).toBe('30078:abc123:the-lake:place:clearing');
  });
});

// ── buildEventTemplate ───────────────────────────────────────────────────────

describe('buildEventTemplate', () => {
  it('puts identity tags first', () => {
    const tmpl = buildEventTemplate({
      eventType: 'place',
      worldSlug: 'the-lake',
      dTag: 'the-lake:place:clearing',
      tags: [['title', 'Forest Clearing'], ['exit', 'north']],
      content: 'A sunlit clearing.',
    });
    expect(tmpl.tags[0]).toEqual(['d', 'the-lake:place:clearing']);
    expect(tmpl.tags[1]).toEqual(['t', 'the-lake']);
    expect(tmpl.tags[2]).toEqual(['type', 'place']);
    expect(tmpl.tags[3]).toEqual(['title', 'Forest Clearing']);
  });

  it('skips duplicate identity tags from user tags', () => {
    const tmpl = buildEventTemplate({
      eventType: 'item',
      worldSlug: 'the-lake',
      dTag: 'the-lake:item:key',
      tags: [['d', 'should-be-skipped'], ['title', 'Key']],
      content: '',
    });
    const dTags = tmpl.tags.filter((t) => t[0] === 'd');
    expect(dTags).toHaveLength(1);
    expect(dTags[0][1]).toBe('the-lake:item:key');
  });
});

// ── validateEvent: identity tags ─────────────────────────────────────────────

describe('validateEvent — identity tags', () => {
  it('passes a valid place template', () => {
    const result = validateEvent(makeTemplate());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when d-tag is missing', () => {
    const tmpl = makeTemplate({ tags: [['t', 'the-lake'], ['type', 'place'], ['title', 'X'], ['exit', 'n']] });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing d-tag');
  });

  it('fails when d-tag value is empty', () => {
    const tmpl = makeTemplate();
    tmpl.tags[0] = ['d', ''];
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('D-tag value is empty');
  });

  it('fails when t-tag is missing', () => {
    const tmpl = makeTemplate({ tags: [['d', 'x:place:y'], ['type', 'place'], ['title', 'X'], ['exit', 'n']] });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing t-tag (world)');
  });

  it('fails when type tag is missing', () => {
    const tmpl = makeTemplate({ tags: [['d', 'x:place:y'], ['t', 'the-lake'], ['title', 'X']] });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
  });
});

// ── validateEvent: event refs ────────────────────────────────────────────────

describe('validateEvent — event refs', () => {
  it('passes well-formed event refs', () => {
    const pubkey = 'a'.repeat(64);
    const tmpl = makeTemplate();
    tmpl.tags.push(['requires', `30078:${pubkey}:the-lake:item:key`, '', '']);
    expect(validateEvent(tmpl).valid).toBe(true);
  });

  it('fails malformed event refs (short pubkey)', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['requires', '30078:short:the-lake:item:key', '', '']);
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid event ref'))).toBe(true);
  });
});

// ── validateEvent: schema-based checks ───────────────────────────────────────

describe('validateEvent — schema checks', () => {
  it('fails when title is missing on a place', () => {
    const tmpl = makeTemplate({ tags: [['d', 'x:place:y'], ['t', 'the-lake'], ['type', 'place'], ['exit', 'n']], content: 'A room.' });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing title tag');
  });

  it('fails when title is missing on an item', () => {
    const tmpl = makeTemplate({
      tags: [['d', 'x:item:key'], ['t', 'the-lake'], ['type', 'item']],
      content: 'A key.',
    });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing title tag');
  });

  it('does not require title on portal', () => {
    const pubkey = 'a'.repeat(64);
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:portal:gate'], ['t', 'the-lake'], ['type', 'portal'],
        ['exit', `30078:${pubkey}:x:place:a`, 'north', ''],
      ],
    });
    const result = validateEvent(tmpl);
    expect(result.errors).not.toContain('Missing title tag');
  });

  it('fails when portal has no exit', () => {
    const tmpl = makeTemplate({
      tags: [['d', 'x:portal:gate'], ['t', 'the-lake'], ['type', 'portal']],
    });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Portal must have at least one exit');
  });

  it('fails when trigger has no action selected', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['on-interact', 'examine', '', '', '']);
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('no action type selected'))).toBe(true);
  });

  it('passes when trigger has action selected', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['on-interact', 'examine', 'set-state', 'examined', '']);
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(true);
  });

  it('fails when content is empty on a place', () => {
    const tmpl = makeTemplate({ content: '' });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing content'))).toBe(true);
  });

  it('does not require content on portal', () => {
    const pubkey = 'a'.repeat(64);
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:portal:gate'], ['t', 'the-lake'], ['type', 'portal'],
        ['exit', `30078:${pubkey}:x:place:a`, 'north', ''],
      ],
      content: '',
    });
    const result = validateEvent(tmpl);
    expect(result.errors.some((e) => e.includes('Missing content'))).toBe(false);
  });

  it('fails on required field empty (requires ref)', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['requires', '', '', '']);
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"ref" is required'))).toBe(true);
  });
});

// ── validateEvent: warnings ──────────────────────────────────────────────────

describe('validateEvent — warnings', () => {
  it('warns when place has no exits', () => {
    const tmpl = makeTemplate({
      tags: [['d', 'x:place:y'], ['t', 'the-lake'], ['type', 'place'], ['title', 'X']],
      content: 'A room.',
    });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(true); // warning, not error
    expect(result.warnings.some((w) => w.includes('no exits'))).toBe(true);
  });

  it('warns when item has no noun', () => {
    const tmpl = makeTemplate({
      tags: [['d', 'x:item:key'], ['t', 'the-lake'], ['type', 'item'], ['title', 'Key']],
      content: 'A rusty key.',
    });
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('no noun'))).toBe(true);
  });

  it('warns when transitions exist without initial state', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['transition', 'off', 'on', 'It lights up.']);
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('no initial state'))).toBe(true);
  });

  it('warns about unexpected tags for event type', () => {
    const tmpl = makeTemplate();
    tmpl.tags.push(['health', '100']); // health not valid on place
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('"health" is not expected'))).toBe(true);
  });

  it('no warnings on well-formed item', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:item:key'], ['t', 'the-lake'], ['type', 'item'],
        ['title', 'Key'], ['noun', 'key'],
      ],
      content: 'A rusty key.',
    });
    const result = validateEvent(tmpl);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when verb has no matching on-interact', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:feature:panel'], ['t', 'the-lake'], ['type', 'feature'],
        ['title', 'Panel'], ['noun', 'panel'],
        ['verb', 'examine'],
        ['verb', 'use', 'decode'],
        ['on-interact', 'examine', 'set-state', 'lit'],
        // no on-interact for 'use'
      ],
      content: 'A panel.',
    });
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('Verb "use"') && w.includes('no matching on-interact'))).toBe(true);
  });

  it('does not warn when verb is examine (built-in fallback)', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:feature:lamp'], ['t', 'the-lake'], ['type', 'feature'],
        ['title', 'Lamp'], ['noun', 'lamp'],
        ['verb', 'examine'],
        // no on-interact for examine — that's fine, examine shows content
      ],
      content: 'A lamp.',
    });
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('Verb "examine"'))).toBe(false);
  });

  it('warns when on-interact has too many elements', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:feature:lamp'], ['t', 'the-lake'], ['type', 'feature'],
        ['title', 'Lamp'], ['noun', 'lamp'],
        ['verb', 'examine'],
        ['on-interact', 'examine', 'set-state', 'visible', '30078:<PUBKEY>:x:clue:y', 'requires: something'],
      ],
      content: 'A lamp.',
    });
    const result = validateEvent(tmpl);
    expect(result.warnings.some((w) => w.includes('on-interact') && w.includes('extra elements'))).toBe(true);
  });

  it('errors when NIP-44 content-type has no puzzle tag', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:place:secret'], ['t', 'the-lake'], ['type', 'place'],
        ['title', 'Secret Room'], ['exit', 'north'],
        ['content-type', 'application/nip44', 'text/markdown'],
      ],
      content: 'Sealed content.',
    });
    const result = validateEvent(tmpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('NIP-44') && e.includes('puzzle tag'))).toBe(true);
  });

  it('no error when NIP-44 content-type has puzzle tag', () => {
    const tmpl = makeTemplate({
      tags: [
        ['d', 'x:place:secret'], ['t', 'the-lake'], ['type', 'place'],
        ['title', 'Secret Room'], ['exit', 'north'],
        ['content-type', 'application/nip44', 'text/markdown'],
        ['puzzle', 'x:puzzle:riddle'],
      ],
      content: 'Sealed content.',
    });
    const result = validateEvent(tmpl);
    expect(result.errors.some((e) => e.includes('NIP-44'))).toBe(false);
  });
});
