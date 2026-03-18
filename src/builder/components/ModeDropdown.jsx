/**
 * ModeDropdown — Compact dropdown for selecting play/build mode and trust level.
 *
 * Replaces the row of header buttons with a single dropdown toggle.
 * Shows: current mode label, and expands to show all available modes.
 */

import React, { useState, useRef, useEffect } from 'react';

const MODE_LABELS = {
  canonical: 'original',
  community: 'collaborative',
  explorer: 'open',
  build: 'build',
};

export default function ModeDropdown({
  availableModes,
  effectiveMode,
  onSelectMode,
  buildMode,
  onToggleBuild,
  showBuildOption,
  draftsCount,
  onOpenDrafts,
  onNewWorld,
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

  const currentLabel = buildMode ? MODE_LABELS.build : (MODE_LABELS[effectiveMode] || effectiveMode);

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
        [{currentLabel}]
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
            minWidth: '12em',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Play modes */}
          <div
            className="px-2 py-1"
            style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)' }}
          >
            play mode
          </div>
          {availableModes.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onSelectMode(mode);
                if (buildMode) onToggleBuild();
                setOpen(false);
              }}
              className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
              style={{
                color: !buildMode && mode === effectiveMode
                  ? 'var(--colour-highlight)'
                  : 'var(--colour-text)',
                background: 'none',
                border: 'none',
                font: 'inherit',
              }}
            >
              {!buildMode && mode === effectiveMode ? '> ' : '  '}{MODE_LABELS[mode] || mode}
            </button>
          ))}

          {/* Build mode */}
          {showBuildOption && (
            <>
              <div style={{ borderTop: '1px solid var(--colour-dim)' }}>
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
        </div>
      )}
    </span>
  );
}
