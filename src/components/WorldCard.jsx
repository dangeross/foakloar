/**
 * WorldCard — DOS-style card for displaying a world in the lobby browser.
 */

import React from 'react';
import { nip19 } from 'nostr-tools';
import { navigateToProfile } from '../services/router.js';

export default function WorldCard({ world, onClick, onZap }) {
  const snippet = world.description?.length > 140
    ? world.description.slice(0, 140) + '...'
    : world.description;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(e); }}
      className="block w-full text-left p-3 mb-2 cursor-pointer"
      style={{
        border: '1px solid var(--colour-dim)',
        color: 'var(--colour-text)',
      }}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span style={{ color: 'var(--colour-title)' }}>
          {world.title}
        </span>
        {world.isDraft && (
          <span style={{ color: 'var(--colour-error)' }}>[DRAFT]</span>
        )}
        {world.version && (
          <span style={{ color: 'var(--colour-dim)' }}>v{world.version}</span>
        )}
        {world.collaboration && world.collaboration !== 'closed' && (
          <span style={{ color: 'var(--colour-dim)' }}>
            ({world.collaboration === 'vouched' ? 'collaborative' : world.collaboration})
          </span>
        )}
      </div>

      {(world.author || world.pubkey) && (
        <div className="mb-1 flex items-center gap-2" style={{ color: 'var(--colour-dim)' }}>
          <span>
            by{' '}
            {world.pubkey ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(nip19.npubEncode(world.pubkey));
                }}
                className="cursor-pointer hover:opacity-80"
                style={{ color: 'var(--colour-dim)', background: 'none', border: 'none', font: 'inherit', padding: 0, textDecoration: 'underline' }}
              >
                {world.author || world.pubkey.slice(0, 12) + '...'}
              </button>
            ) : (
              world.author
            )}
          </span>
          {onZap && world.pubkey && world.eventId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onZap(world);
              }}
              className="cursor-pointer"
              style={{
                color: 'var(--colour-item)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
                padding: '1px 6px',
                fontSize: '0.6rem',
              }}
            >
              zap
            </button>
          )}
        </div>
      )}

      {snippet && (
        <div className="mb-1" style={{ color: 'var(--colour-text)', opacity: 0.8 }}>
          {snippet}
        </div>
      )}

      {world.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-1">
          {world.tags.map((tag) => (
            <span key={tag} style={{ color: 'var(--colour-item)' }}>[{tag}]</span>
          ))}
        </div>
      )}

      {world.cw?.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {world.cw.map((cw) => (
            <span key={cw} style={{ color: 'var(--colour-error)' }}>[{cw}]</span>
          ))}
        </div>
      )}

      {world.isDraft && world.draftCount > 0 && (
        <div style={{ color: 'var(--colour-dim)' }}>
          {world.draftCount} draft event{world.draftCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
