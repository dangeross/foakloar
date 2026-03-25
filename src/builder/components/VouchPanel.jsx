/**
 * VouchPanel — Confirm and publish a vouch event for an unverified author.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';
import DOSSelect from './ui/DOSSelect.jsx';
import { buildEventTemplate, publishEvent } from '../eventBuilder.js';
import { isEventTrusted } from '../../engine/trust.js';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All event types' },
  { value: 'portal', label: 'Portals only' },
  { value: 'place', label: 'Places + portals' },
];

// Which event types each scope trusts
const SCOPE_TYPES = {
  portal: new Set(['portal']),
  place: new Set(['portal', 'place']),
  all: null, // all types
};

function getTag(ev, name) { return ev.tags?.find((t) => t[0] === name)?.[1]; }

export default function VouchPanel({
  targetPubkey,
  worldSlug,
  signer,
  pool,
  events,        // Map<aTag, event> — all world events
  trustSet,      // current trust set
  clientMode,    // current client mode
  onClose,
}) {
  const [scope, setScope] = useState('all');
  const [canVouch, setCanVouch] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | publishing | success | error
  const [error, setError] = useState(null);

  const npub = nip19.npubEncode(targetPubkey);
  const shortNpub = npub.slice(0, 20) + '...' + npub.slice(-4);

  // Analyze impact: what events does this author have, and what refs do they depend on?
  const impact = useMemo(() => {
    if (!events) return null;
    const byType = {};
    const authorEvents = [];
    let total = 0;

    for (const [, ev] of events) {
      if (ev.pubkey !== targetPubkey) continue;
      const type = getTag(ev, 'type');
      if (!type) continue;
      byType[type] = (byType[type] || 0) + 1;
      total++;
      authorEvents.push(ev);
    }

    // Check which refs this author's events depend on from OTHER unvouched authors
    const crossRefs = new Map(); // pubkey → { items: [{ type, title, referencedBy }] }
    const refTags = ['item', 'feature', 'npc', 'clue', 'sound', 'dialogue'];
    for (const ev of authorEvents) {
      for (const tag of ev.tags) {
        if (!refTags.includes(tag[0]) || !tag[1]) continue;
        const refEvent = events.get(tag[1]);
        if (!refEvent || refEvent.pubkey === targetPubkey) continue;
        // Is this ref author trusted?
        if (trustSet && isEventTrusted(refEvent, trustSet, clientMode) !== 'hidden') continue;
        // Unvouched cross-ref
        const pk = refEvent.pubkey;
        if (!crossRefs.has(pk)) crossRefs.set(pk, { items: [] });
        crossRefs.get(pk).items.push({
          type: getTag(refEvent, 'type') || '?',
          title: getTag(refEvent, 'title') || getTag(refEvent, 'noun') || tag[1].split(':').pop(),
          referencedBy: getTag(ev, 'title') || getTag(ev, 'type') || '?',
        });
      }
    }

    // Count how many events each scope would trust
    const scopeCounts = {};
    for (const [s, types] of Object.entries(SCOPE_TYPES)) {
      scopeCounts[s] = types ? authorEvents.filter((ev) => types.has(getTag(ev, 'type'))).length : total;
    }

    return { byType, total, crossRefs, scopeCounts };
  }, [events, targetPubkey, trustSet, clientMode]);

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

    const result = await publishEvent(signer, pool, template);
    if (result.ok) {
      setStatus('success');
      setTimeout(onClose, 800);
    } else {
      setStatus('error');
      setError(result.error || 'Failed to publish vouch.');
    }
  }, [signer, pool, targetPubkey, worldSlug, scope, canVouch, onClose]);

  return (
    <DOSPanel title="VOUCH" onClose={onClose} minWidth="24em" maxWidth="90vw" zIndex={200}>
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

      {/* Impact preview */}
      {impact && (
        <div className="mb-3" style={{ fontSize: '0.6rem', borderTop: '1px solid var(--colour-dim)', paddingTop: '0.5em' }}>
          <div style={{ color: 'var(--colour-dim)', marginBottom: '0.3em' }}>Events by this author:</div>
          <div style={{ color: 'var(--colour-text)', paddingLeft: '0.5em' }}>
            {Object.entries(impact.byType).map(([type, count]) => (
              <div key={type}>
                {count} {type}{count > 1 ? 's' : ''}
                {SCOPE_TYPES[scope] && !SCOPE_TYPES[scope].has(type)
                  ? <span style={{ color: 'var(--colour-error)' }}> — hidden by scope</span>
                  : <span style={{ color: 'var(--colour-exits)' }}> — trusted</span>
                }
              </div>
            ))}
            <div style={{ color: 'var(--colour-highlight)', marginTop: '0.3em' }}>
              {impact.scopeCounts[scope]}/{impact.total} events trusted with this scope
            </div>
          </div>

          {impact.crossRefs.size > 0 && (
            <div style={{ marginTop: '0.5em' }}>
              <div style={{ color: 'var(--colour-error)' }}>⚠ References to unvouched authors:</div>
              <div style={{ paddingLeft: '0.5em' }}>
                {[...impact.crossRefs].map(([pk, info]) => {
                  let short;
                  try { const np = nip19.npubEncode(pk); short = np.slice(0, 16) + '...'; }
                  catch { short = pk.slice(0, 8) + '...'; }
                  return (
                    <div key={pk} style={{ color: 'var(--colour-error)', marginBottom: '0.3em' }}>
                      <div>by <span style={{ color: 'var(--colour-highlight)', textDecoration: 'underline' }}>{short}</span>:</div>
                      {info.items.map((item, i) => (
                        <div key={i} style={{ paddingLeft: '0.5em', fontSize: '0.65rem' }}>
                          {item.type}: "{item.title}"
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
