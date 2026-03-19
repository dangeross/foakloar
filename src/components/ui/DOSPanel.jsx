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
}) {
  const backdropZ = zIndex ? zIndex - 1 : undefined;
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={backdropZ ? { zIndex: backdropZ } : undefined}
        onClick={onClose}
      />
      <div
        className="fixed font-mono text-xs flex flex-col"
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
          minWidth,
          maxWidth,
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
        <div className="p-3 overflow-y-auto overflow-x-hidden flex-1">
          {children}
        </div>
      </div>
    </>
  );
}
