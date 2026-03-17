/**
 * IdentityButton — Reusable header button showing login state.
 *
 * Displays [shortPubkey] when logged in (highlighted), or [--] when anonymous.
 * The onClick handler is provided by the parent (e.g. toggle login panel, navigate).
 */

import React from 'react';

export default function IdentityButton({ identity, onClick }) {
  const isLoggedIn = identity?.method !== 'ephemeral';
  const shortPubkey = identity?.pubkey ? identity.pubkey.slice(0, 8) + '...' : '';

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
      style={{
        color: isLoggedIn ? 'var(--colour-highlight)' : 'var(--colour-dim)',
        background: 'none',
        border: 'none',
        font: 'inherit',
        padding: 0,
      }}
      title={`${identity?.method}: ${identity?.pubkey || 'none'}`}
    >
      {isLoggedIn ? `[${shortPubkey}]` : '[--]'}
    </Tag>
  );
}
