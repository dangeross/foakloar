/**
 * TrustPanel — Tree view of the world's trust chain with revoke actions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';
import { buildEventTemplate, publishEvent } from '../eventBuilder.js';

function shortPk(pubkey) {
  try {
    const npub = nip19.npubEncode(pubkey);
    return npub.slice(0, 12) + '...' + npub.slice(-4);
  } catch { return pubkey.slice(0, 8) + '...'; }
}

function scopeLabel(scope) {
  if (scope === 'portal') return 'portals';
  if (scope === 'place') return 'places';
  return 'all';
}

/**
 * Build a tree structure from the trust set.
 * Returns: [{ pubkey, label, scope, canVouch, children: [...], depth }]
 */
function buildTree(trustSet) {
  if (!trustSet) return [];

  const { genesisPubkey, collaborators, vouched } = trustSet;

  // Genesis is root
  const root = {
    pubkey: genesisPubkey,
    label: 'genesis',
    scope: 'all',
    canVouch: true,
    canRevoke: false, // genesis can't be revoked
    children: [],
  };

  // Collaborators are direct children of genesis
  for (const pk of collaborators) {
    root.children.push({
      pubkey: pk,
      label: 'collaborator',
      scope: 'all',
      canVouch: true,
      canRevoke: false, // collaborators are on the world event, not revocable via revoke events
      children: [],
    });
  }

  // Vouched — build parent→children map
  const byVoucher = new Map(); // voucherPk → [{ pubkey, scope, canVouch }]
  for (const [pk, entry] of vouched) {
    const parent = entry.vouchedBy || genesisPubkey;
    if (!byVoucher.has(parent)) byVoucher.set(parent, []);
    byVoucher.get(parent).push({ pubkey: pk, ...entry });
  }

  // Recursively attach children
  function attachChildren(node) {
    const kids = byVoucher.get(node.pubkey) || [];
    for (const kid of kids) {
      const child = {
        pubkey: kid.pubkey,
        label: 'vouched',
        scope: kid.scope,
        canVouch: kid.canVouch,
        canRevoke: true,
        children: [],
      };
      node.children.push(child);
      attachChildren(child);
    }
  }

  attachChildren(root);
  // Also attach vouched children of collaborators
  for (const collabNode of root.children) {
    attachChildren(collabNode);
  }

  return root;
}

/**
 * Check if the current identity can revoke a given pubkey.
 */
function canIdentityRevoke(identityPubkey, trustSet, targetPubkey) {
  if (!identityPubkey || !trustSet) return false;
  // Genesis can revoke anyone
  if (identityPubkey === trustSet.genesisPubkey) return true;
  // Collaborator can revoke anyone
  if (trustSet.collaborators.has(identityPubkey)) return true;
  // Vouched with can-vouch can revoke their own vouchees
  const entry = trustSet.vouched.get(targetPubkey);
  if (entry?.vouchedBy === identityPubkey) return true;
  return false;
}

/**
 * Count downstream nodes (all descendants).
 */
function countDescendants(node) {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

function TreeNode({ node, depth, identityPubkey, trustSet, onRevoke, revoking }) {
  const isIdentity = node.pubkey === identityPubkey;
  const canRevoke = node.canRevoke && canIdentityRevoke(identityPubkey, trustSet, node.pubkey);
  const descendants = countDescendants(node);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const indent = depth * 1.2;
  const connector = depth === 0 ? '' : '├─ ';

  const labelColour = node.label === 'genesis' ? 'var(--colour-highlight)'
    : node.label === 'collaborator' ? 'var(--colour-title)'
    : 'var(--colour-text)';

  return (
    <>
      <div
        className="flex items-center gap-1 py-0.5"
        style={{ paddingLeft: `${indent}em`, fontSize: '0.65rem' }}
      >
        <span style={{ color: 'var(--colour-dim)', fontFamily: 'monospace' }}>{connector}</span>
        <span style={{ color: labelColour }}>
          {shortPk(node.pubkey)}
        </span>
        {isIdentity && (
          <span style={{ color: 'var(--colour-exits)', fontSize: '0.55rem' }}>(you)</span>
        )}
        <span style={{ color: 'var(--colour-dim)', fontSize: '0.55rem' }}>
          {node.label}
          {node.label === 'vouched' && ` · ${scopeLabel(node.scope)}`}
          {node.canVouch && node.label === 'vouched' && ' · chains'}
        </span>

        {canRevoke && !confirmRevoke && (
          <button
            onClick={() => setConfirmRevoke(true)}
            style={{
              color: 'var(--colour-error)',
              fontSize: '0.55rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginLeft: 'auto',
            }}
            disabled={revoking}
          >
            revoke
          </button>
        )}
        {confirmRevoke && (
          <span style={{ marginLeft: 'auto', fontSize: '0.55rem' }}>
            <span style={{ color: 'var(--colour-error)' }}>
              Revoke{descendants > 0 ? ` (+${descendants} downstream)` : ''}?{' '}
            </span>
            <button
              onClick={() => { onRevoke(node.pubkey); setConfirmRevoke(false); }}
              style={{ color: 'var(--colour-error)', background: 'none', border: '1px solid var(--colour-error)', cursor: 'pointer', fontFamily: 'inherit', padding: '0 0.3em', fontSize: '0.55rem' }}
              disabled={revoking}
            >
              Yes
            </button>{' '}
            <button
              onClick={() => setConfirmRevoke(false)}
              style={{ color: 'var(--colour-dim)', background: 'none', border: '1px solid var(--colour-dim)', cursor: 'pointer', fontFamily: 'inherit', padding: '0 0.3em', fontSize: '0.55rem' }}
            >
              No
            </button>
          </span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNode
          key={child.pubkey}
          node={child}
          depth={depth + 1}
          identityPubkey={identityPubkey}
          trustSet={trustSet}
          onRevoke={onRevoke}
          revoking={revoking}
        />
      ))}
    </>
  );
}

export default function TrustPanel({
  trustSet,
  worldSlug,
  identityPubkey,
  signer,
  pool,
  onClose,
}) {
  const [revoking, setRevoking] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  const tree = useMemo(() => buildTree(trustSet), [trustSet]);

  const handleRevoke = useCallback(async (targetPubkey) => {
    if (!signer || !pool) return;
    setRevoking(true);
    setStatus(null);

    const signerPubkey = signer.pubkey || '';
    const dTag = `${worldSlug}:revoke:${signerPubkey.slice(0, 8)}-revokes-${targetPubkey.slice(0, 8)}`;

    const template = buildEventTemplate({
      eventType: 'revoke',
      worldSlug,
      dTag,
      tags: [
        ['pubkey', targetPubkey],
      ],
      content: '',
    });

    const result = await publishEvent(signer, pool, template);
    setRevoking(false);
    if (result.ok) {
      setStatus('success');
      setStatusMsg(`Revoked ${shortPk(targetPubkey)}. Trust set will update.`);
    } else {
      setStatus('error');
      setStatusMsg(result.error || 'Failed to publish revoke event.');
    }
  }, [signer, pool, worldSlug]);

  const collaboration = trustSet?.collaboration || 'closed';
  const totalVouched = trustSet?.vouched?.size || 0;
  const totalCollaborators = trustSet?.collaborators?.size || 0;

  return (
    <DOSPanel title="TRUST" onClose={onClose} minWidth="20em" maxWidth="90vw" zIndex={200}>
      {/* Summary */}
      <div className="mb-2 flex gap-3 flex-wrap" style={{ fontSize: '0.6rem', color: 'var(--colour-dim)' }}>
        <span><span style={{ color: 'var(--colour-text)' }}>{collaboration}</span> world</span>
        <span>{totalCollaborators} collab{totalCollaborators !== 1 ? 's' : ''}</span>
        <span>{totalVouched} vouched</span>
      </div>

      {/* Tree */}
      <div
        className="mb-2"
        style={{
          maxHeight: '50vh',
          overflowY: 'auto',
          borderTop: '1px solid var(--colour-dim)',
          borderBottom: '1px solid var(--colour-dim)',
          padding: '0.3em 0',
        }}
      >
        {tree && (
          <TreeNode
            node={tree}
            depth={0}
            identityPubkey={identityPubkey}
            trustSet={trustSet}
            onRevoke={handleRevoke}
            revoking={revoking}
          />
        )}
      </div>

      {/* Status */}
      {status === 'success' && (
        <div style={{ color: 'var(--colour-exits)', fontSize: '0.6rem', marginBottom: '0.5em' }}>
          {statusMsg}
        </div>
      )}
      {status === 'error' && (
        <div style={{ color: 'var(--colour-error)', fontSize: '0.6rem', marginBottom: '0.5em' }}>
          {statusMsg}
        </div>
      )}

      {/* Close */}
      <div className="flex gap-2">
        <DOSButton onClick={onClose} colour="dim">Close</DOSButton>
      </div>
    </DOSPanel>
  );
}
