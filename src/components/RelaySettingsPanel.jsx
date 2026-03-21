/**
 * RelaySettingsPanel — Shows active relays grouped by source.
 *
 * Displays connection status, relay sources (world, NIP-65, default, custom),
 * and allows adding/removing custom relays.
 */

import React, { useState } from 'react';
import DOSPanel from './ui/DOSPanel.jsx';
import { getCustomRelays, saveCustomRelays } from '../services/relayUrls.js';
import { DEFAULT_RELAY_URLS } from '../config.js';

export default function RelaySettingsPanel({
  worldSlug,
  relayStatus,        // Map<url, 'connecting'|'connected'|'failed'>
  worldRelays = [],   // from world event relay tags
  nip65Read = [],     // from NIP-65
  nip65Write = [],    // from NIP-65
  onClose,
  onRelayChange,      // (action: 'add'|'remove', url: string) => void — live connect/disconnect
}) {
  const [customRelays, setCustomRelays] = useState(() => getCustomRelays(worldSlug));
  const [newRelay, setNewRelay] = useState('');
  const [error, setError] = useState('');

  const statusDot = (url) => {
    const s = relayStatus?.get(url) || relayStatus?.get(url.replace(/\/+$/, ''));
    if (s === 'connected') return { color: 'var(--colour-highlight)', label: '●' };
    if (s === 'connecting') return { color: 'var(--colour-title)', label: '○' };
    if (s === 'failed') return { color: 'var(--colour-error)', label: '●' };
    return { color: 'var(--colour-dim)', label: '○' };
  };

  const RelayRow = ({ url, source, canRemove }) => {
    const dot = statusDot(url);
    return (
      <div className="flex items-center gap-1 py-0.5">
        <span style={{ color: dot.color, fontSize: '0.5rem' }}>{dot.label}</span>
        <span className="flex-1 truncate" style={{ color: 'var(--colour-text)' }}>{url}</span>
        <span style={{ color: 'var(--colour-dim)', fontSize: '0.55rem' }}>{source}</span>
        {canRemove && (
          <button
            className="cursor-pointer"
            style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: '0 2px' }}
            onClick={() => removeCustom(url)}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  // Deduplicate: group by URL, show source labels
  const allRelays = new Map();
  for (const url of DEFAULT_RELAY_URLS) {
    allRelays.set(url, { url, sources: ['default'] });
  }
  for (const url of worldRelays) {
    const entry = allRelays.get(url) || { url, sources: [] };
    entry.sources.push('world');
    allRelays.set(url, entry);
  }
  const nip65All = [...new Set([...nip65Read, ...nip65Write])];
  for (const url of nip65All) {
    const entry = allRelays.get(url) || { url, sources: [] };
    const markers = [];
    if (nip65Read.includes(url)) markers.push('r');
    if (nip65Write.includes(url)) markers.push('w');
    entry.sources.push(`nip65(${markers.join('+')})`);
    allRelays.set(url, entry);
  }
  for (const url of customRelays) {
    const entry = allRelays.get(url) || { url, sources: [] };
    entry.sources.push('custom');
    allRelays.set(url, entry);
  }

  function addCustom() {
    setError('');
    const url = newRelay.trim();
    if (!url) return;
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      setError('Must start with wss:// or ws://');
      return;
    }
    const normalized = url.replace(/\/+$/, '');
    if (customRelays.includes(url) || allRelays.has(normalized) || allRelays.has(url)) {
      setError('Already added');
      return;
    }
    const updated = [...customRelays, url];
    setCustomRelays(updated);
    saveCustomRelays(worldSlug, updated);
    setNewRelay('');
    onRelayChange?.('add', url);
  }

  function removeCustom(url) {
    const updated = customRelays.filter((r) => r !== url);
    setCustomRelays(updated);
    saveCustomRelays(worldSlug, updated);
    onRelayChange?.('remove', url);
  }

  return (
    <DOSPanel title="RELAYS" onClose={onClose} minWidth="22em" maxWidth="90vw">
      <div style={{ fontSize: '0.6rem' }}>
        {/* Relay list */}
        {[...allRelays.values()].map(({ url, sources }) => (
          <RelayRow
            key={url}
            url={url}
            source={sources.join(', ')}
            canRemove={sources.includes('custom')}
          />
        ))}

        {allRelays.size === 0 && (
          <div style={{ color: 'var(--colour-dim)' }}>No relays configured.</div>
        )}

        {/* Add custom relay */}
        <div className="mt-3 flex gap-1">
          <input
            type="text"
            value={newRelay}
            onChange={(e) => setNewRelay(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
            placeholder="wss://relay.example.com"
            className="flex-1 px-1"
            style={{
              background: 'var(--colour-bg)',
              color: 'var(--colour-text)',
              border: '1px solid var(--colour-dim)',
              font: 'inherit',
              fontSize: 'inherit',
            }}
          />
          <button
            onClick={addCustom}
            className="cursor-pointer px-1"
            style={{
              background: 'none',
              color: 'var(--colour-highlight)',
              border: '1px solid var(--colour-dim)',
              font: 'inherit',
              fontSize: 'inherit',
            }}
          >
            Add
          </button>
        </div>
        {error && <div className="mt-1" style={{ color: 'var(--colour-error)' }}>{error}</div>}

        {/* Connection summary */}
        <div className="mt-2" style={{ color: 'var(--colour-dim)' }}>
          {relayStatus ? (() => {
            const connected = [...relayStatus.values()].filter((s) => s === 'connected').length;
            const total = relayStatus.size;
            return `${connected}/${total} connected`;
          })() : 'No status available'}
        </div>
      </div>
    </DOSPanel>
  );
}
