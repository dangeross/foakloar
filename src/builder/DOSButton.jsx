/**
 * DOSButton — Consistent button styling for builder panels.
 */

import React from 'react';

export default function DOSButton({
  children,
  onClick,
  colour = 'highlight',
  disabled = false,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer ${className}`}
      style={{
        color: `var(--colour-${colour})`,
        background: 'none',
        border: '1px solid var(--colour-dim)',
        font: 'inherit',
        padding: '2px 8px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
