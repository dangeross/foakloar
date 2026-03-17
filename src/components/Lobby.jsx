/**
 * Lobby — World browser at /w.
 *
 * Discovers published worlds from relays and lists local draft worlds.
 * Manual slug entry for direct navigation.
 */

import React, { useState, useMemo } from 'react';
import DOSPanel from './ui/DOSPanel.jsx';
import WorldCard from './WorldCard.jsx';
import { useWorldDiscovery } from '../hooks/useWorldDiscovery.js';
import { listDraftWorlds } from '../builder/draftStore.js';

export default function Lobby({
  identity,
  onSelectWorld,
  onCreateWorld,
  showWorldCreator,
  worldCreatorNode,
}) {
  const [slug, setSlug] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showNsec, setShowNsec] = useState(false);

  const { worlds: publishedWorlds, status: discoveryStatus } = useWorldDiscovery();
  const draftWorlds = useMemo(() => listDraftWorlds(), []);

  // Merge: published worlds win over drafts with the same slug
  const publishedSlugs = useMemo(
    () => new Set(publishedWorlds.map((w) => w.slug)),
    [publishedWorlds]
  );
  const uniqueDraftWorlds = useMemo(
    () => draftWorlds.filter((d) => !publishedSlugs.has(d.slug)),
    [draftWorlds, publishedSlugs]
  );

  const isLoggedIn = identity?.method !== 'ephemeral';
  const shortPubkey = identity?.pubkey ? identity.pubkey.slice(0, 8) + '...' : '';

  return (
    <div
      className="max-w-2xl mx-auto p-6 flex flex-col h-screen font-mono text-xs"
      style={{ backgroundColor: 'var(--colour-bg)', color: 'var(--colour-text)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="text-sm mb-4 flex justify-between" style={{ color: 'var(--colour-dim)' }}>
        <span>foakloar</span>
        <span className="flex items-center gap-2">
          <button
            onClick={onCreateWorld}
            className="cursor-pointer"
            style={{
              color: 'var(--colour-item)',
              background: 'none',
              border: 'none',
              font: 'inherit',
              padding: 0,
            }}
          >
            [+ world]
          </button>
          <button
            onClick={() => setShowLogin(!showLogin)}
            className="cursor-pointer"
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
          </button>
        </span>
      </div>

      {/* ── Login panel ─────────────────────────────────────────────────── */}
      {showLogin && (
        <DOSPanel
          title="IDENTITY"
          onClose={() => { setShowLogin(false); setLoginError(''); setShowNsec(false); }}
        >
          <div className="mb-2" style={{ color: 'var(--colour-dim)' }}>
            Status: {isLoggedIn ? identity.method : identity?.backedUp ? 'ephemeral (backed up)' : 'anonymous (ephemeral key)'}
          </div>
          <div className="mb-3" style={{ color: 'var(--colour-dim)', wordBreak: 'break-all' }}>
            Pubkey: {identity?.pubkey || 'none'}
          </div>

          {identity?.method === 'ephemeral' && (
            <div className="mb-3 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
              {!showNsec ? (
                <button
                  onClick={() => setShowNsec(true)}
                  className="cursor-pointer"
                  style={{ color: 'var(--colour-item)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                >
                  Show Secret Key
                </button>
              ) : (
                <>
                  <div className="mb-1" style={{ color: 'var(--colour-error)' }}>
                    Save this key to keep your identity:
                  </div>
                  <div
                    className="mb-2 p-1"
                    style={{
                      color: 'var(--colour-highlight)',
                      wordBreak: 'break-all',
                      border: '1px solid var(--colour-dim)',
                      fontSize: '0.65rem',
                      userSelect: 'all',
                    }}
                  >
                    {identity.getNsec()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const nsec = identity.getNsec();
                        if (nsec) navigator.clipboard.writeText(nsec);
                      }}
                      className="cursor-pointer"
                      style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                    >
                      Copy
                    </button>
                    {!identity.backedUp && (
                      <button
                        onClick={() => identity.confirmBackup()}
                        className="cursor-pointer"
                        style={{ color: 'var(--colour-text)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                      >
                        I've saved it
                      </button>
                    )}
                    {identity.backedUp && (
                      <span style={{ color: 'var(--colour-text)', padding: '2px 0' }}>Backed up</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {identity?.method !== 'extension' && identity?.nip07Available && (
            <div className="mb-2">
              <button
                onClick={async () => {
                  const res = await identity.loginExtension();
                  if (!res.ok) setLoginError(res.error);
                  else { setLoginError(''); setShowLogin(false); }
                }}
                className="cursor-pointer"
                style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
              >
                Use Nostr Extension
              </button>
            </div>
          )}

          {identity?.method !== 'nsec' && (
            <form
              className="mb-2"
              onSubmit={(e) => {
                e.preventDefault();
                const nsec = e.target.elements.nsec.value.trim();
                const res = identity.login(nsec);
                if (!res.ok) setLoginError(res.error);
                else { setLoginError(''); setShowLogin(false); e.target.reset(); }
              }}
            >
              <div className="mb-1" style={{ color: 'var(--colour-dim)' }}>Login with nsec:</div>
              <div className="flex gap-1">
                <input
                  name="nsec"
                  type="password"
                  placeholder="nsec1..."
                  className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
                  style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
                />
                <button
                  type="submit"
                  className="cursor-pointer"
                  style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                >
                  OK
                </button>
              </div>
            </form>
          )}

          {isLoggedIn && (
            <div className="mt-2">
              <button
                onClick={() => { identity.logout(); setShowLogin(false); }}
                className="cursor-pointer"
                style={{ color: 'var(--colour-error)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
              >
                Logout
              </button>
            </div>
          )}

          {loginError && (
            <div className="mt-2" style={{ color: 'var(--colour-error)' }}>
              {loginError}
            </div>
          )}
        </DOSPanel>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Manual slug input */}
        <div className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const s = slug.trim().toLowerCase();
              if (s) onSelectWorld(s);
            }}
            className="flex gap-2 items-center"
          >
            <span style={{ color: 'var(--colour-dim)' }}>/w/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="world-slug"
              className="flex-1 bg-transparent border-none outline-none font-mono"
              style={{ color: 'var(--colour-text)', borderBottom: '1px solid var(--colour-dim)' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!slug.trim()}
              className="cursor-pointer"
              style={{
                color: slug.trim() ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
                padding: '2px 8px',
              }}
            >
              Go
            </button>
          </form>
        </div>

        {/* Draft worlds */}
        {uniqueDraftWorlds.length > 0 && (
          <div className="mb-6">
            <div className="mb-2" style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)', paddingBottom: '2px' }}>
              Your Drafts
            </div>
            {uniqueDraftWorlds.map((w) => (
              <WorldCard key={w.slug} world={w} onClick={() => onSelectWorld(w.slug)} />
            ))}
          </div>
        )}

        {/* Published worlds */}
        <div className="mb-6">
          <div className="mb-2" style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)', paddingBottom: '2px' }}>
            Published Worlds
          </div>
          {discoveryStatus === 'loading' && (
            <div style={{ color: 'var(--colour-dim)' }}>Searching relays...</div>
          )}
          {discoveryStatus === 'failed' && (
            <div style={{ color: 'var(--colour-error)' }}>Failed to connect to relays.</div>
          )}
          {discoveryStatus === 'ready' && publishedWorlds.length === 0 && (
            <div style={{ color: 'var(--colour-dim)' }}>No worlds found.</div>
          )}
          {publishedWorlds.map((w) => (
            <WorldCard key={w.aTag} world={w} onClick={() => onSelectWorld(w.slug)} />
          ))}
        </div>
      </div>

      {/* World creator panel (rendered as overlay) */}
      {worldCreatorNode}
    </div>
  );
}
