/**
 * Tests for relayUrls.js — relay URL resolution and NIP-65 parsing.
 */

import { describe, it, expect } from 'vitest';
import { getWorldRelays, mergeRelayUrls, parseNip65 } from '../relayUrls.js';

// ── getWorldRelays ──────────────────────────────────────────────────────────

describe('getWorldRelays', () => {
  it('extracts relay URLs from world event tags', () => {
    const event = {
      tags: [
        ['d', 'my-world:world'],
        ['type', 'world'],
        ['relay', 'wss://relay.primal.net'],
        ['relay', 'wss://nos.lol'],
        ['title', 'My World'],
      ],
    };
    expect(getWorldRelays(event)).toEqual([
      'wss://relay.primal.net',
      'wss://nos.lol',
    ]);
  });

  it('returns empty array for event with no relay tags', () => {
    const event = { tags: [['d', 'test'], ['type', 'world']] };
    expect(getWorldRelays(event)).toEqual([]);
  });

  it('returns empty array for null/undefined event', () => {
    expect(getWorldRelays(null)).toEqual([]);
    expect(getWorldRelays(undefined)).toEqual([]);
    expect(getWorldRelays({})).toEqual([]);
  });

  it('skips relay tags with empty URL', () => {
    const event = {
      tags: [
        ['relay', 'wss://valid.relay'],
        ['relay', ''],
        ['relay', null],
      ],
    };
    expect(getWorldRelays(event)).toEqual(['wss://valid.relay']);
  });
});

// ── parseNip65 ──────────────────────────────────────────────────────────────

describe('parseNip65', () => {
  it('parses read-only relays', () => {
    const event = {
      tags: [
        ['r', 'wss://read-only.relay', 'read'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual(['wss://read-only.relay']);
    expect(result.write).toEqual([]);
  });

  it('parses write-only relays', () => {
    const event = {
      tags: [
        ['r', 'wss://write-only.relay', 'write'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual([]);
    expect(result.write).toEqual(['wss://write-only.relay']);
  });

  it('parses relays with no marker as both read+write', () => {
    const event = {
      tags: [
        ['r', 'wss://both.relay'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual(['wss://both.relay']);
    expect(result.write).toEqual(['wss://both.relay']);
  });

  it('parses mixed relay list', () => {
    const event = {
      tags: [
        ['r', 'wss://relay.primal.net', 'write'],
        ['r', 'wss://nos.lol', 'read'],
        ['r', 'wss://relay.damus.io'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual(['wss://nos.lol', 'wss://relay.damus.io']);
    expect(result.write).toEqual(['wss://relay.primal.net', 'wss://relay.damus.io']);
  });

  it('returns empty lists for null event', () => {
    expect(parseNip65(null)).toEqual({ read: [], write: [] });
    expect(parseNip65(undefined)).toEqual({ read: [], write: [] });
  });

  it('returns empty lists for event with no tags', () => {
    expect(parseNip65({})).toEqual({ read: [], write: [] });
    expect(parseNip65({ tags: [] })).toEqual({ read: [], write: [] });
  });

  it('skips non-r tags', () => {
    const event = {
      tags: [
        ['r', 'wss://valid.relay'],
        ['p', 'somepubkey'],
        ['e', 'someeventid'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual(['wss://valid.relay']);
    expect(result.write).toEqual(['wss://valid.relay']);
  });

  it('skips r tags with empty URL', () => {
    const event = {
      tags: [
        ['r', ''],
        ['r', 'wss://valid.relay', 'read'],
      ],
    };
    const result = parseNip65(event);
    expect(result.read).toEqual(['wss://valid.relay']);
    expect(result.write).toEqual([]);
  });
});

// ── mergeRelayUrls ──────────────────────────────────────────────────────────

describe('mergeRelayUrls', () => {
  it('includes defaults when no sources provided', () => {
    const result = mergeRelayUrls();
    expect(result.subscribe).toContain('wss://relay.primal.net');
    expect(result.subscribe).toContain('wss://nos.lol');
    expect(result.publish).toContain('wss://relay.primal.net');
    expect(result.publish).toContain('wss://nos.lol');
  });

  it('merges world relays into both subscribe and publish', () => {
    const result = mergeRelayUrls({
      worldRelays: ['wss://world.relay'],
    });
    expect(result.subscribe).toContain('wss://world.relay');
    expect(result.publish).toContain('wss://world.relay');
  });

  it('puts nip65 read relays in subscribe only', () => {
    const result = mergeRelayUrls({
      nip65Read: ['wss://read.relay'],
    });
    expect(result.subscribe).toContain('wss://read.relay');
    // publish should NOT contain read-only relay (unless also default/world)
    expect(result.publish).not.toContain('wss://read.relay');
  });

  it('puts nip65 write relays in publish only', () => {
    const result = mergeRelayUrls({
      nip65Write: ['wss://write.relay'],
    });
    expect(result.publish).toContain('wss://write.relay');
    // subscribe should NOT contain write-only relay (unless also default/world)
    expect(result.subscribe).not.toContain('wss://write.relay');
  });

  it('adds custom relays to both subscribe and publish', () => {
    const result = mergeRelayUrls({
      custom: ['wss://custom.relay'],
    });
    expect(result.subscribe).toContain('wss://custom.relay');
    expect(result.publish).toContain('wss://custom.relay');
  });

  it('deduplicates URLs', () => {
    const result = mergeRelayUrls({
      worldRelays: ['wss://relay.primal.net'],
      custom: ['wss://relay.primal.net'],
    });
    const count = result.subscribe.filter((u) => u === 'wss://relay.primal.net').length;
    expect(count).toBe(1);
  });

  it('normalizes trailing slashes', () => {
    const result = mergeRelayUrls({
      worldRelays: ['wss://relay.primal.net/'],
    });
    // Should deduplicate with the default (no trailing slash)
    const count = result.subscribe.filter((u) => u.includes('relay.primal.net')).length;
    expect(count).toBe(1);
  });

  it('handles all sources together', () => {
    const result = mergeRelayUrls({
      worldRelays: ['wss://world.relay'],
      nip65Read: ['wss://read.relay'],
      nip65Write: ['wss://write.relay'],
      custom: ['wss://custom.relay'],
    });

    // subscribe: defaults + world + nip65Read + custom
    expect(result.subscribe).toContain('wss://relay.primal.net');
    expect(result.subscribe).toContain('wss://nos.lol');
    expect(result.subscribe).toContain('wss://world.relay');
    expect(result.subscribe).toContain('wss://read.relay');
    expect(result.subscribe).toContain('wss://custom.relay');
    expect(result.subscribe).not.toContain('wss://write.relay');

    // publish: defaults + world + nip65Write + custom
    expect(result.publish).toContain('wss://relay.primal.net');
    expect(result.publish).toContain('wss://nos.lol');
    expect(result.publish).toContain('wss://world.relay');
    expect(result.publish).toContain('wss://write.relay');
    expect(result.publish).toContain('wss://custom.relay');
    expect(result.publish).not.toContain('wss://read.relay');
  });
});
