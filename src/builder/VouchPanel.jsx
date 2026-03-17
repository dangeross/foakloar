/**
 * VouchPanel — Confirm and publish a vouch event for an unverified author.
 */

import React, { useState, useCallback } from 'react';
import { nip19 } from 'nostr-tools';
import DOSPanel from '../components/ui/DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';
import DOSSelect from './DOSSelect.jsx';
import { buildEventTemplate, publishEvent } from './eventBuilder.js';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All event types' },
  { value: 'portal', label: 'Portals only' },
  { value: 'place', label: 'Places + portals' },
];

export default function VouchPanel({
  targetPubkey,
  worldSlug,
  signer,
  relay,
  onClose,
}) {
  const [scope, setScope] = useState('all');
  const [canVouch, setCanVouch] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | publishing | success | error
  const [error, setError] = useState(null);

  const npub = nip19.npubEncode(targetPubkey);
  const shortNpub = npub.slice(0, 20) + '...' + npub.slice(-4);

  const handleVouch = useCallback(async () => {
    setStatus('publishing');
    setError(null);

    const signerPubkey = signer.pubkey || '';
    const dTag = `${worldSlug}:vouch:${signerPubkey.slice(0, 8)}-for-${targetPubkey.slice(0, 8)}`;

    const template = buildEventTemplate({
      eventType: 'vouch',
      worldSlug,
      dTag,
      tags: [
        ['pubkey', targetPubkey],
        ['scope', scope],
        ['can-vouch', canVouch ? 'true' : 'false'],
      ],
      content: '',
    });

    const result = await publishEvent(signer, relay, template);
    if (result.ok) {
      setStatus('success');
      setTimeout(onClose, 800);
    } else {
      setStatus('error');
      setError(result.error || 'Failed to publish vouch.');
    }
  }, [signer, relay, targetPubkey, worldSlug, scope, canVouch, onClose]);

  return (
    <DOSPanel title="VOUCH" onClose={onClose} minWidth="24em" maxWidth="90vw">
      <div className="mb-2" style={{ fontSize: '0.65rem' }}>
        <span style={{ color: 'var(--colour-dim)' }}>Vouch for author:</span>
      </div>
      <div className="mb-3" style={{ color: 'var(--colour-highlight)', fontSize: '0.6rem', wordBreak: 'break-all' }}>
        {shortNpub}
      </div>

      {/* Scope */}
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '5em', textAlign: 'right' }}>
          Scope:
        </span>
        <div className="flex-1">
          <DOSSelect value={scope} onChange={setScope} options={SCOPE_OPTIONS} />
        </div>
      </div>

      {/* Can vouch */}
      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '5em', textAlign: 'right' }}>
          Chain:
        </span>
        <label className="flex items-center gap-1" style={{ fontSize: '0.65rem', color: 'var(--colour-text)' }}>
          <input
            type="checkbox"
            checked={canVouch}
            onChange={(e) => setCanVouch(e.target.checked)}
            style={{ accentColor: 'var(--colour-text)' }}
          />
          Allow them to vouch for others
        </label>
      </div>

      {/* Status */}
      {status === 'error' && (
        <div className="mb-2" style={{ color: 'var(--colour-error)', fontSize: '0.6rem' }}>
          {error}
        </div>
      )}
      {status === 'success' && (
        <div className="mb-2" style={{ color: 'var(--colour-exits)', fontSize: '0.6rem' }}>
          Vouched. Trust set will update.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
        <DOSButton onClick={onClose} colour="dim">
          Cancel
        </DOSButton>
        <DOSButton
          onClick={handleVouch}
          colour="highlight"
          disabled={status === 'publishing' || status === 'success'}
        >
          {status === 'publishing' ? 'Publishing...' : 'Vouch'}
        </DOSButton>
      </div>
    </DOSPanel>
  );
}
