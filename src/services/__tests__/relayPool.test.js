/**
 * Tests for RelayPool — event dedup and connection management.
 *
 * Uses mock Relay objects since we can't connect to real relays in tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nostr-tools/relay before importing RelayPool
vi.mock('nostr-tools/relay', () => ({
  Relay: {
    connect: vi.fn(),
  },
}));

import { Relay } from 'nostr-tools/relay';
import { RelayPool } from '../relayPool.js';

function makeMockRelay(url) {
  const subs = [];
  return {
    url,
    subscribe: vi.fn((filters, callbacks) => {
      subs.push({ filters, callbacks });
      return { close: vi.fn() };
    }),
    publish: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    _subs: subs,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RelayPool', () => {
  describe('connect', () => {
    it('connects to multiple relay URLs', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect.mockImplementation((url) => {
        if (url === 'wss://relay1') return Promise.resolve(r1);
        if (url === 'wss://relay2') return Promise.resolve(r2);
      });

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      expect(pool.size).toBe(2);
      expect(pool.connectedUrls).toContain('wss://relay1');
      expect(pool.connectedUrls).toContain('wss://relay2');
    });

    it('tolerates individual connection failures', async () => {
      const r1 = makeMockRelay('wss://good');
      Relay.connect.mockImplementation((url) => {
        if (url === 'wss://good') return Promise.resolve(r1);
        return Promise.reject(new Error('connection refused'));
      });

      const pool = new RelayPool();
      await pool.connect(['wss://good', 'wss://bad']);

      expect(pool.size).toBe(1);
      expect(pool.connectedUrls).toEqual(['wss://good']);

      const status = pool.connectionStatus;
      expect(status.get('wss://good')).toBe('connected');
      expect(status.get('wss://bad')).toBe('failed');
    });

    it('deduplicates relay URLs', async () => {
      const r1 = makeMockRelay('wss://relay1');
      Relay.connect.mockResolvedValue(r1);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay1', 'wss://relay1']);

      expect(Relay.connect).toHaveBeenCalledTimes(1);
      expect(pool.size).toBe(1);
    });

    it('caps at MAX_RELAYS (8)', async () => {
      const urls = Array.from({ length: 12 }, (_, i) => `wss://relay${i}`);
      Relay.connect.mockImplementation((url) => Promise.resolve(makeMockRelay(url)));

      const pool = new RelayPool();
      await pool.connect(urls);

      expect(pool.size).toBe(8);
    });

    it('does not reconnect to already-connected relays', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1']);
      await pool.connect(['wss://relay1', 'wss://relay2']);

      // relay1 should only be connected once
      expect(Relay.connect).toHaveBeenCalledTimes(2);
      expect(pool.size).toBe(2);
    });
  });

  describe('subscribe', () => {
    it('deduplicates events by ID across relays', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      const received = [];
      pool.subscribe(
        [{ kinds: [30078] }],
        {
          onevent: (ev) => received.push(ev),
          oneose: () => {},
        },
      );

      // Same event arrives from both relays
      const event = { id: 'abc123', kind: 30078, created_at: 100, tags: [] };
      r1._subs[0].callbacks.onevent(event);
      r2._subs[0].callbacks.onevent(event);

      expect(received).toHaveLength(1);
    });

    it('passes through different events from different relays', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      const received = [];
      pool.subscribe(
        [{ kinds: [30078] }],
        {
          onevent: (ev) => received.push(ev),
          oneose: () => {},
        },
      );

      r1._subs[0].callbacks.onevent({ id: 'event1', kind: 30078, created_at: 100, tags: [] });
      r2._subs[0].callbacks.onevent({ id: 'event2', kind: 30078, created_at: 101, tags: [] });

      expect(received).toHaveLength(2);
    });

    it('fires EOSE on first relay EOSE', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      const eose = vi.fn();
      pool.subscribe(
        [{ kinds: [30078] }],
        { onevent: () => {}, oneose: eose },
      );

      // First relay sends EOSE
      r1._subs[0].callbacks.oneose();
      expect(eose).toHaveBeenCalledTimes(1);

      // Second relay sends EOSE — should not fire again
      r2._subs[0].callbacks.oneose();
      expect(eose).toHaveBeenCalledTimes(1);
    });

    it('fires EOSE immediately when no relays connected', async () => {
      Relay.connect.mockRejectedValue(new Error('fail'));

      const pool = new RelayPool();
      await pool.connect(['wss://bad']);

      const eose = vi.fn();
      pool.subscribe(
        [{ kinds: [30078] }],
        { onevent: () => {}, oneose: eose },
      );

      expect(eose).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish', () => {
    it('publishes to all connected relays', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      const event = { id: 'test', kind: 30078 };
      const results = await pool.publish(event);

      expect(r1.publish).toHaveBeenCalledWith(event);
      expect(r2.publish).toHaveBeenCalledWith(event);
      expect(results.get('wss://relay1').ok).toBe(true);
      expect(results.get('wss://relay2').ok).toBe(true);
    });

    it('reports individual relay publish failures', async () => {
      const r1 = makeMockRelay('wss://good');
      const r2 = makeMockRelay('wss://bad');
      r2.publish.mockRejectedValue(new Error('rate limited'));
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://good', 'wss://bad']);

      const results = await pool.publish({ id: 'test' });

      expect(results.get('wss://good').ok).toBe(true);
      expect(results.get('wss://bad').ok).toBe(false);
      expect(results.get('wss://bad').error).toBe('rate limited');
    });
  });

  describe('publishTo', () => {
    it('publishes to specific relay URLs only', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);

      const event = { id: 'test' };
      const results = await pool.publishTo(event, ['wss://relay1']);

      expect(r1.publish).toHaveBeenCalledWith(event);
      expect(r2.publish).not.toHaveBeenCalled();
      expect(results.get('wss://relay1').ok).toBe(true);
    });

    it('reports not-connected for unknown URLs', async () => {
      const pool = new RelayPool();
      const results = await pool.publishTo({ id: 'test' }, ['wss://unknown']);

      expect(results.get('wss://unknown').ok).toBe(false);
      expect(results.get('wss://unknown').error).toBe('Not connected');
    });
  });

  describe('close', () => {
    it('closes all relay connections', async () => {
      const r1 = makeMockRelay('wss://relay1');
      const r2 = makeMockRelay('wss://relay2');
      Relay.connect
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2);

      const pool = new RelayPool();
      await pool.connect(['wss://relay1', 'wss://relay2']);
      pool.close();

      expect(r1.close).toHaveBeenCalled();
      expect(r2.close).toHaveBeenCalled();
      expect(pool.size).toBe(0);
    });
  });
});
