/**
 * DOSPanel — Reusable DOS-style modal panel.
 *
 * Renders a centered fixed panel with title bar, [X] close button,
 * box shadow, and click-outside-to-close backdrop.
 */

import React from 'react';

export default function DOSPanel({
  title,
  onClose,
  children,
  minWidth = '28em',
  maxWidth = '90vw',
  maxHeight = '80vh',
  zIndex,
  noPadding,
}) {
  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: zIndex || 50 }}
      onClick={onClose}
      onMouseDown={(e) => {
        // Only close if clicking the backdrop itself, not children
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
    >
      <div
        className="fixed font-mono text-xs flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          zIndex: zIndex || 50,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--colour-bg)',
          color: 'var(--colour-text)',
          border: '2px solid var(--colour-dim)',
          boxShadow: '4px 4px 0 var(--colour-dim)',
          padding: 0,
          minWidth: `min(${minWidth}, calc(100vw - 1rem))`,
          maxWidth: `min(${maxWidth}, calc(100vw - 1rem))`,
          maxHeight,
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center px-2 py-1 shrink-0 gap-2"
          style={{ backgroundColor: 'var(--colour-dim)', color: 'var(--colour-bg)' }}
        >
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{ background: 'none', border: 'none', font: 'inherit', color: 'var(--colour-bg)', padding: 0 }}
          >
            [X]
          </button>
          <span>{title}</span>
        </div>

        {/* Content */}
        <div className={`${noPadding ? '' : 'p-3'} overflow-y-auto overflow-x-hidden flex-1`}>
          {children}
        </div>
      </div>
    </div>
  );
}
