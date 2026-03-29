/**
 * Tooltip — DOS-styled [?] info icon that shows a description on hover.
 *
 * Uses fixed positioning anchored to the icon's bounding rect so it
 * escapes overflow:hidden/auto containers (e.g. DOSPanel scroll area).
 * Portal-rendered into document.body so z-index is always topmost.
 *
 * Shared component used in ProfileEditor, TagEditor, etc.
 */

import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ text }) {
  const iconRef = useRef(null);
  const hideTimer = useRef(null);
  const [pos, setPos] = useState(null); // { top|bottom, left } in viewport coords

  const show = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const above = rect.top > 120;
      setPos(
        above
          ? { bottom: window.innerHeight - rect.top + 6, left: rect.left }
          : { top: rect.bottom + 6, left: rect.left }
      );
    }
  }, []);

  // Small delay before hiding so the mouse can travel to the tooltip
  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setPos(null), 100);
  }, []);

  if (!text) return null;

  return (
    <span
      ref={iconRef}
      className="inline-block cursor-help ml-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span style={{ color: 'var(--colour-dim)', fontSize: '0.55rem', verticalAlign: 'middle' }}>
        [?]
      </span>
      {pos &&
        createPortal(
          <span
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed',
              top:    pos.top    !== undefined ? pos.top    : undefined,
              bottom: pos.bottom !== undefined ? pos.bottom : undefined,
              left: Math.min(pos.left, window.innerWidth - 330),
              backgroundColor: 'var(--colour-bg)',
              border: '1px solid var(--colour-dim)',
              color: 'var(--colour-text)',
              padding: '4px 8px',
              fontSize: '0.6rem',
              fontFamily: 'inherit',
              minWidth: '200px',
              maxWidth: '320px',
              whiteSpace: 'normal',
              zIndex: 9999,
              lineHeight: '1.4',
              cursor: 'default',
            }}
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
