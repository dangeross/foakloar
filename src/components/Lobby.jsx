/**
 * Lobby — World browser at /w.
 *
 * Header dropdown switches between:
 *   curated  — application's featured world list
 *   search   — all foakloar worlds on relays (#w tag discovery)
 *   + world  — opens the world creator
 *
 * Also shows local draft worlds and manual slug entry.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import DOSPanel from './ui/DOSPanel.jsx';
import WorldCard from './WorldCard.jsx';
import TipPanel from './TipPanel.jsx';
import { useWorldDiscovery } from '../hooks/useWorldDiscovery.js';
import { listDraftWorlds } from '../builder/draftStore.js';
import { APP_PUBKEY } from '../config.js';

const LOBBY_MODES = [
  { value: 'curated', label: 'featured' },
  { value: 'search', label: 'search' },
];

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
  const [lobbyMode, setLobbyMode] = useState('curated');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [pendingWorld, setPendingWorld] = useState(null);
  const [zapTarget, setZapTarget] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const { worlds: publishedWorlds, status: discoveryStatus } = useWorldDiscovery(
    lobbyMode,
    lobbyMode === 'curated' ? APP_PUBKEY : undefined
  );
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

  // Filter worlds by text (title, author, description, genre tags)
  const filteredWorlds = useMemo(() => {
    if (!filter.trim()) return publishedWorlds;
    const q = filter.toLowerCase();
    return publishedWorlds.filter((w) =>
      w.title.toLowerCase().includes(q) ||
      w.author.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.slug.toLowerCase().includes(q) ||
      w.tags?.some((t) => t.toLowerCase().includes(q)) ||
      w.cw?.some((c) => c.toLowerCase().includes(q))
    );
  }, [publishedWorlds, filter]);

  const visibleWorlds = useMemo(
    () => filteredWorlds.slice(0, visibleCount),
    [filteredWorlds, visibleCount]
  );
  const hasMore = filteredWorlds.length > visibleCount;

  // Reset visible count when mode or filter changes
  useEffect(() => { setVisibleCount(10); }, [lobbyMode, filter]);

  // Intercept world selection — show CW confirmation if needed
  const handleSelectWorld = (world) => {
    if (world.cw?.length > 0) {
      setPendingWorld(world);
    } else {
      onSelectWorld(world.slug);
    }
  };

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
          {/* Mode dropdown */}
          <span ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="cursor-pointer"
              style={{
                color: 'var(--colour-dim)',
                background: 'none',
                border: 'none',
                font: 'inherit',
                padding: 0,
              }}
            >
              [{LOBBY_MODES.find((m) => m.value === lobbyMode)?.label}]
            </button>

            {dropdownOpen && (
              <div
                className="font-mono text-xs"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.25rem',
                  border: '1px solid var(--colour-dim)',
                  backgroundColor: 'var(--colour-bg)',
                  boxShadow: '2px 2px 0 var(--colour-dim)',
                  zIndex: 100,
                  minWidth: '10em',
                }}
              >
                {LOBBY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setLobbyMode(mode.value);
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                    style={{
                      color: mode.value === lobbyMode
                        ? 'var(--colour-highlight)'
                        : 'var(--colour-text)',
                      background: 'none',
                      border: 'none',
                      font: 'inherit',
                    }}
                  >
                    {mode.value === lobbyMode ? '> ' : '  '}{mode.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--colour-dim)' }}>
                  <button
                    onClick={() => {
                      onCreateWorld();
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                    style={{
                      color: 'var(--colour-item)',
                      background: 'none',
                      border: 'none',
                      font: 'inherit',
                    }}
                  >
                    {'  '}+ world
                  </button>
                </div>
              </div>
            )}
          </span>

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

        {/* Filter input */}
        {lobbyMode === 'search' && (
          <div className="mb-4">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter by title, author, tag..."
              className="w-full bg-transparent border-none outline-none font-mono"
              style={{ color: 'var(--colour-text)', borderBottom: '1px solid var(--colour-dim)' }}
            />
          </div>
        )}

        {/* Draft worlds */}
        {uniqueDraftWorlds.length > 0 && (
          <div className="mb-6">
            <div className="mb-2" style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)', paddingBottom: '2px' }}>
              Your Drafts
            </div>
            {uniqueDraftWorlds.map((w) => (
              <WorldCard key={w.slug} world={w} onClick={() => handleSelectWorld(w)} />
            ))}
          </div>
        )}

        {/* Published worlds */}
        <div className="mb-6">
          {discoveryStatus === 'loading' && (
            <div style={{ color: 'var(--colour-dim)' }}>Searching relays...</div>
          )}
          {discoveryStatus === 'failed' && (
            <div style={{ color: 'var(--colour-error)' }}>Failed to connect to relays.</div>
          )}
          {discoveryStatus === 'empty' && (
            <div style={{ color: 'var(--colour-dim)' }}>No worlds found.</div>
          )}
          {filter && filteredWorlds.length === 0 && publishedWorlds.length > 0 && (
            <div style={{ color: 'var(--colour-dim)' }}>No matches for "{filter}".</div>
          )}
          {visibleWorlds.map((w) => (
            <WorldCard
              key={w.aTag}
              world={w}
              onClick={() => handleSelectWorld(w)}
              onZap={(world) => setZapTarget({ eventId: world.eventId, pubkey: world.pubkey, title: world.title })}
            />
          ))}
          {hasMore && (
            <div className="mt-2 flex justify-between items-center" style={{ color: 'var(--colour-dim)' }}>
              <span>Showing {visibleCount} of {filteredWorlds.length}</span>
              <button
                onClick={() => setVisibleCount((c) => c + 10)}
                className="cursor-pointer"
                style={{
                  color: 'var(--colour-highlight)',
                  background: 'none',
                  border: '1px solid var(--colour-dim)',
                  font: 'inherit',
                  padding: '2px 8px',
                }}
              >
                show more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content warning confirmation */}
      {pendingWorld && (
        <DOSPanel
          title="CONTENT WARNING"
          onClose={() => setPendingWorld(null)}
        >
          <div className="mb-2" style={{ color: 'var(--colour-text)' }}>
            <span style={{ color: 'var(--colour-title)' }}>{pendingWorld.title}</span> contains the following content warnings:
          </div>
          <div className="mb-3 flex gap-1 flex-wrap">
            {pendingWorld.cw.map((cw) => (
              <span key={cw} style={{ color: 'var(--colour-error)' }}>[{cw}]</span>
            ))}
          </div>
          <div className="mb-3" style={{ color: 'var(--colour-dim)' }}>
            Do you want to continue?
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingWorld(null)}
              className="cursor-pointer"
              style={{ color: 'var(--colour-dim)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onSelectWorld(pendingWorld.slug); setPendingWorld(null); }}
              className="cursor-pointer"
              style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
            >
              Continue
            </button>
          </div>
        </DOSPanel>
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

      {/* World creator panel (rendered as overlay) */}
      {worldCreatorNode}
    </div>
  );
}
