/**
 * InlineList — Reusable inline add/remove list with optional validation.
 *
 * Props:
 *   label        — row label (e.g. "Tags")
 *   items        — string[]
 *   onChange      — (newItems: string[]) => void
 *   placeholder   — input placeholder text
 *   validate      — (input: string) => { value: string } | { error: string }
 *                   Defaults to trimmed passthrough. Can transform (e.g. npub → hex).
 *   display       — (storedValue: string) => string — for display (e.g. hex → npub)
 *   compact       — if true, renders without the label column (for embedding in tag rows)
 */

import React, { useState } from 'react';
import { Tooltip } from './TagEditor.jsx';

export default function InlineList({ label, items, onChange, placeholder, validate, display, compact = false, tooltip }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    const raw = input.trim();
    if (!raw) return;
    // Support comma-separated batch add
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const newItems = [...items];
    for (const part of parts) {
      const result = validate ? validate(part) : { value: part };
      if (result.error) { setError(result.error); return; }
      if (!newItems.includes(result.value)) {
        newItems.push(result.value);
      }
    }
    onChange(newItems);
    setInput('');
  };

  if (compact) {
    return (
      <div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {items.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1"
                style={{
                  border: '1px solid var(--colour-dim)',
                  padding: '0 4px',
                  fontSize: '0.6rem',
                  color: 'var(--colour-text)',
                }}
              >
                {display ? display(item) : item}
                <button
                  onClick={() => onChange(items.filter((v) => v !== item))}
                  className="cursor-pointer"
                  style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: 0, fontSize: '0.6rem' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <form className="flex gap-1" onSubmit={handleAdd}>
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
            style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
          />
          <button
            type="submit"
            className="cursor-pointer shrink-0"
            style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '0 4px', fontSize: '0.65rem' }}
          >
            +
          </button>
        </form>
        {error && (
          <div style={{ color: 'var(--colour-error)', fontSize: '0.6rem' }}>{error}</div>
        )}
      </div>
    );
  }

  // Full layout with label column
  return (
    <>
      {items.map((item, i) => (
        <div key={item} className="mb-1 flex items-center gap-2">
          <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
            {i === 0 ? <>{label}:{tooltip && <Tooltip text={tooltip} />}</> : ''}
          </span>
          <span className="flex-1 truncate" style={{ color: 'var(--colour-text)', fontSize: '0.6rem' }}>
            {display ? display(item) : item}
          </span>
          <button
            onClick={() => onChange(items.filter((v) => v !== item))}
            className="cursor-pointer shrink-0"
            style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: 0, fontSize: '0.65rem' }}
          >
            ×
          </button>
        </div>
      ))}
      <div className="mb-1 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
          {items.length === 0 ? <>{label}:{tooltip && <Tooltip text={tooltip} />}</> : ''}
        </span>
        <form className="flex-1 flex gap-1" onSubmit={handleAdd}>
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
            style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
          />
          <button
            type="submit"
            className="cursor-pointer shrink-0"
            style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '0 4px', fontSize: '0.65rem' }}
          >
            +
          </button>
        </form>
      </div>
      {error && (
        <div className="mb-1 flex items-center gap-2">
          <span className="shrink-0" style={{ width: '7em' }} />
          <span style={{ color: 'var(--colour-error)', fontSize: '0.6rem' }}>{error}</span>
        </div>
      )}
    </>
  );
}
