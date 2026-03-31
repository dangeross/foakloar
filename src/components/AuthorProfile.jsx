/**
 * AuthorProfile — Profile page at /u/:npub.
 *
 * Shows author's profile (kind:0), npub, and all their published worlds.
 * If the author has a lud16 Lightning address, shows a tip button.
 */

import React, { useState } from 'react';
import WorldCard from './WorldCard.jsx';
import TipPanel from './TipPanel.jsx';
import { useWorldDiscovery } from '../hooks/useWorldDiscovery.js';
import { useWorldList } from '../hooks/useWorldList.js';
import { useProfile } from '../hooks/useProfile.js';
import PageHeader from './ui/PageHeader.jsx';
import { navigateToLobby, navigateToWorld } from '../services/router.js';

export default function AuthorProfile({ npub, pubkeyHex, identity, pool }) {
  const { worlds, status } = useWorldDiscovery('author', pubkeyHex);
  const { worlds: curatedWorlds, status: curatedStatus } = useWorldDiscovery('curated', pubkeyHex);
  const { profile } = useProfile(pubkeyHex, pool);
  const [copied, setCopied] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [zapTarget, setZapTarget] = useState(null); // { eventId, pubkey }
  const [profileTab, setProfileTab] = useState('worlds'); // 'worlds' | 'list'

  // Viewer's own bookmark state (so they can add from profile page too)
  const isOwnProfile = identity?.pubkey === pubkeyHex;
  const { isCurated, toggle: toggleBookmark } =
    useWorldList(identity?.pubkey || null, identity?.signer || null);

  const shortNpub = npub.length > 20
    ? npub.slice(0, 12) + '...' + npub.slice(-8)
    : npub;

  const displayName = profile?.displayName || profile?.name || '';

  return (
    <div
      className="max-w-2xl mx-auto flex flex-col min-h-dvh font-mono text-xs"
      style={{ backgroundColor: 'var(--colour-bg)', color: 'var(--colour-text)' }}
    >
      {/* Header */}
      <PageHeader identity={identity}>
        <button
          onClick={() => navigateToLobby()}
          className="cursor-pointer"
          style={{ color: 'var(--colour-dim)', background: 'none', border: 'none', font: 'inherit', padding: 0 }}
        >
          [worlds]
        </button>
      </PageHeader>

      {/* Author info */}
      <div className="mb-4 pb-3 px-6" style={{ borderBottom: '1px solid var(--colour-dim)' }}>
        <div className="mb-1" style={{ color: 'var(--colour-title)' }}>
          {displayName || shortNpub}
        </div>
        {profile?.nip05 && (
          <div className="mb-1" style={{ color: 'var(--colour-highlight)' }}>
            {profile.nip05}
          </div>
        )}
        {profile?.lud16 && (
          <div className="mb-1 flex items-center gap-2">
            <span style={{ color: 'var(--colour-item)' }}>
              {profile.lud16}
            </span>
            <button
              onClick={() => setShowTip(true)}
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
              tip
            </button>
          </div>
        )}
        {profile?.about && (
          <div className="mb-1" style={{ color: 'var(--colour-text)', opacity: 0.8, whiteSpace: 'pre-wrap' }}>
            {profile.about}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--colour-dim)', fontSize: '0.6rem', wordBreak: 'break-all' }}>
            {npub}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(npub);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="cursor-pointer"
            style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '1px 6px', fontSize: '0.6rem', whiteSpace: 'nowrap' }}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>

      {/* Worlds / List tabs */}
      <div className="flex-1 px-6 pb-6">
        <div className="mb-3 flex gap-3">
          {[
            { key: 'worlds', label: 'Worlds' },
            { key: 'list', label: 'Curated list' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setProfileTab(key)}
              className="cursor-pointer"
              style={{
                color: profileTab === key ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                background: 'none',
                border: 'none',
                font: 'inherit',
                padding: 0,
                borderBottom: profileTab === key ? '1px solid var(--colour-highlight)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {profileTab === 'worlds' && (
          <>
            {status === 'loading' && (
              <div style={{ color: 'var(--colour-dim)' }}>Searching relays...</div>
            )}
            {status === 'failed' && (
              <div style={{ color: 'var(--colour-error)' }}>Failed to connect to relays.</div>
            )}
            {status === 'empty' && (
              <div style={{ color: 'var(--colour-dim)' }}>No worlds found for this author.</div>
            )}
            {worlds.map((w) => (
              <WorldCard
                key={w.aTag}
                world={w}
                onClick={() => navigateToWorld(w.slug)}
                onZap={(world) => setZapTarget({ eventId: world.eventId, pubkey: world.pubkey, title: world.title })}
                bookmarked={isCurated(w.aTag)}
                onBookmark={identity?.signer ? (world) => toggleBookmark(world.aTag) : undefined}
              />
            ))}
          </>
        )}

        {profileTab === 'list' && (
          <>
            {curatedStatus === 'loading' && (
              <div style={{ color: 'var(--colour-dim)' }}>Searching relays...</div>
            )}
            {curatedStatus === 'failed' && (
              <div style={{ color: 'var(--colour-error)' }}>Failed to connect to relays.</div>
            )}
            {curatedStatus === 'empty' && (
              <div style={{ color: 'var(--colour-dim)' }}>
                {isOwnProfile
                  ? 'Your list is empty.'
                  : 'No curated worlds.'}
              </div>
            )}
            {curatedWorlds.map((w) => (
              <WorldCard
                key={w.aTag}
                world={w}
                onClick={() => navigateToWorld(w.slug)}
                onZap={(world) => setZapTarget({ eventId: world.eventId, pubkey: world.pubkey, title: world.title })}
                bookmarked={isCurated(w.aTag)}
                onBookmark={identity?.signer ? (world) => toggleBookmark(world.aTag) : undefined}
              />
            ))}
          </>
        )}
      </div>

      {/* Tip panel (author) */}
      {showTip && profile?.lud16 && (
        <TipPanel
          lud16={profile.lud16}
          recipientName={displayName}
          recipientPubkey={pubkeyHex}
          signer={identity?.signer}
          senderPubkey={identity?.pubkey}
          onClose={() => setShowTip(false)}
        />
      )}

      {/* Zap panel (world event) */}
      {zapTarget && (
        <TipPanel
          recipientPubkey={zapTarget.pubkey}
          recipientName={zapTarget.title}
          eventId={zapTarget.eventId}
          signer={identity?.signer}
          senderPubkey={identity?.pubkey}
          onClose={() => setZapTarget(null)}
        />
      )}
    </div>
  );
}
