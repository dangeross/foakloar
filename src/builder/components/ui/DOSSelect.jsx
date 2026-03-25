/**
 * DOSSelect — Themed dropdown replacing native <select>.
 * Portaled, opens upward, click-outside-to-close.
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import ReactDOM from 'react-dom';

export default function DOSSelect({ value, onChange, options: rawOptions }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [pos, setPos] = useState(null);
  const instanceId = useId();

  // Normalize options: accept strings or {value, label} objects
  const options = rawOptions.map((o) => typeof o === 'string' ? { value: o, label: o } : o);
  const selected = options.find((o) => o.value === value);

  // Reposition on open, scroll, and resize
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    function updatePos() {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ left: rect.left, bottom: window.innerHeight - rect.top, width: rect.width });
    }
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  // Close when another dropdown opens or when a close-all is broadcast
  useEffect(() => {
    if (!open) return;
    function onOtherOpen(e) {
      if (e.detail !== instanceId) setOpen(false);
    }
    document.addEventListener('dropdown-open', onOtherOpen);
    return () => document.removeEventListener('dropdown-open', onOtherOpen);
  }, [open, instanceId]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggle() {
    const next = !open;
    if (next) document.dispatchEvent(new CustomEvent('dropdown-open', { detail: instanceId }));
    setOpen(next);
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="flex items-center cursor-pointer px-1 w-full"
        style={{ border: '1px solid var(--colour-dim)', minHeight: '1.5em' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >
        <span className="flex-1 text-xs truncate" style={{ color: 'var(--colour-text)' }}>
          {selected?.label || value}
        </span>
        <span style={{ color: 'var(--colour-dim)' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="font-mono text-xs"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: pos.left,
            bottom: pos.bottom,
            width: pos.width,
            backgroundColor: 'var(--colour-bg)',
            border: '1px solid var(--colour-dim)',
            maxHeight: '12em',
            overflowY: 'auto',
            zIndex: 600, // Z.DROPDOWN
            boxShadow: '2px -2px 0 var(--colour-dim)',
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className="px-1 py-0.5 cursor-pointer hover:opacity-80"
              style={{
                color: opt.value === value ? 'var(--colour-highlight)' : 'var(--colour-text)',
                backgroundColor: opt.value === value ? 'var(--colour-dim)' : 'transparent',
              }}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
