/**
 * ModeDropdown — Compact dropdown for build mode, preview toggle, and settings.
 *
 * Shows the world's collaboration mode as a label (not selectable).
 * Trusted authors (genesis/collaborator/voucher) get a "preview unvouched"
 * toggle to evaluate content before vouching.
 */

import React, { useState, useRef, useEffect } from 'react';

const COLLAB_LABELS = {
  closed: 'closed',
  vouched: 'vouched',
  open: 'open',
};

export default function ModeDropdown({
  collaboration,       // world's collaboration mode string
  canPreviewUnvouched, // true if user is genesis/collaborator/voucher
  previewUnvouched,    // current preview state
  onTogglePreview,     // callback to toggle preview
  buildMode,
  onToggleBuild,
  showBuildOption,
  draftsCount,
  onOpenDrafts,
  onNewWorld,
  // Relay status
  relayStatus,
  onOpenRelaySettings,
  // Share
  onShare,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const collabLabel = COLLAB_LABELS[collaboration] || collaboration || 'open';
  const buttonLabel = buildMode ? 'build' : collabLabel;

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
        style={{
          color: buildMode ? 'var(--colour-highlight)' : 'var(--colour-dim)',
          background: 'none',
          border: 'none',
          font: 'inherit',
          padding: 0,
        }}
      >
        [{buttonLabel}]
      </button>

      {open && (
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
            minWidth: '14em',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Collaboration mode (read-only label) */}
          <div
            className="px-2 py-1"
            style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)' }}
          >
            world: {collabLabel}
          </div>

          {/* Preview unvouched toggle */}
          {canPreviewUnvouched && (
            <button
              onClick={() => {
                onTogglePreview();
                setOpen(false);
              }}
              className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
              style={{
                color: previewUnvouched ? 'var(--colour-highlight)' : 'var(--colour-text)',
                background: 'none',
                border: 'none',
                font: 'inherit',
              }}
            >
              {previewUnvouched ? '> ' : '  '}preview unvouched
            </button>
          )}

          {/* Build mode */}
          {showBuildOption && (
            <>
              <div style={{ borderTop: '1px solid var(--colour-dim)' }}>
                {buildMode && (
                  <button
                    onClick={() => {
                      onOpenDrafts();
                      setOpen(false);
                    }}
                    className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                    style={{
                      color: 'var(--colour-text)',
                      background: 'none',
                      border: 'none',
                      font: 'inherit',
                    }}
                  >
                    {'  '}drafts{draftsCount > 0 ? ` (${draftsCount})` : ''}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!buildMode) onToggleBuild();
                    setOpen(false);
                  }}
                  className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                  style={{
                    color: 'var(--colour-item)',
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                  }}
                >
                  {buildMode ? '> ' : '  '}+ build
                </button>
              </div>
              {buildMode && onNewWorld && (
                <button
                  onClick={() => {
                    onNewWorld();
                    setOpen(false);
                  }}
                  className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                  style={{
                    color: 'var(--colour-text)',
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                  }}
                >
                  {'  '}+ new world
                </button>
              )}
            </>
          )}

          {/* Relay status */}
          {relayStatus && relayStatus.size > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--colour-dim)' }}>
                <button
                  onClick={() => {
                    onOpenRelaySettings?.();
                    setOpen(false);
                  }}
                  className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                  style={{
                    color: 'var(--colour-dim)',
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                  }}
                >
                  {(() => {
                    const connected = [...relayStatus.values()].filter((s) => s === 'connected').length;
                    const total = relayStatus.size;
                    const color = connected === total ? 'var(--colour-highlight)'
                      : connected > 0 ? 'var(--colour-title)'
                      : 'var(--colour-error)';
                    return (
                      <>
                        {'  '}relays{' '}
                        <span style={{ color }}>{connected}/{total}</span>
                      </>
                    );
                  })()}
                </button>
              </div>
            </>
          )}

          {/* Share */}
          {onShare && (
            <div style={{ borderTop: '1px solid var(--colour-dim)' }}>
              <button
                onClick={() => { onShare(); setOpen(false); }}
                className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                style={{ color: 'var(--colour-text)', background: 'none', border: 'none', font: 'inherit' }}
              >
                {'  '}share on nostr
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
