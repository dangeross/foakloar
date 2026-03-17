/**
 * WorldCreator — DOS-style panel for creating a new world.
 *
 * Collects world metadata (slug, title, author, theme, collaboration mode,
 * relay URLs) and saves both a world event and a genesis place event as
 * drafts. The user can then review, edit, and publish from the drafts panel.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { nip19 } from 'nostr-tools';
import DOSPanel from '../components/ui/DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';
import { slugify, buildEventTemplate } from './eventBuilder.js';
import { DEFAULT_RELAY_URLS } from '../config.js';
import { resolveTheme, applyTheme, resolveEffects, applyEffects, resolveFont, resolveFontSize, resolveFontSizePanel, resolveCursor, applyFontAndCursor, loadFont } from '../services/theme.js';

/** Themed dropdown replacing native <select> — portaled, opens upward */
function DOSSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [pos, setPos] = useState(null);

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

  return (
    <>
      <div
        ref={triggerRef}
        className="flex items-center cursor-pointer px-1 w-full"
        style={{ border: '1px solid var(--colour-dim)', minHeight: '1.5em' }}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-xs truncate" style={{ color: 'var(--colour-text)' }}>
          {selected?.label || value}
        </span>
        <span style={{ color: 'var(--colour-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="font-mono text-xs"
          style={{
            position: 'fixed',
            left: pos.left,
            bottom: pos.bottom,
            width: pos.width,
            backgroundColor: 'var(--colour-bg)',
            border: '1px solid var(--colour-dim)',
            maxHeight: '12em',
            overflowY: 'auto',
            zIndex: 200,
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
 */
function InlineList({ label, items, onChange, placeholder, validate, display }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    const raw = input.trim();
    if (!raw) return;
    const result = validate ? validate(raw) : { value: raw };
    if (result.error) { setError(result.error); return; }
    if (items.includes(result.value)) { setError('Already added'); return; }
    onChange([...items, result.value]);
    setInput('');
  };

  return (
    <>
      {items.map((item, i) => (
        <div key={item} className="mb-1 flex items-center gap-2">
          <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
            {i === 0 ? `${label}:` : ''}
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
          {items.length === 0 ? `${label}:` : ''}
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

/** Validators for InlineList */
const validateNpub = (input) => {
  try {
    if (input.startsWith('npub1')) {
      const { type, data } = nip19.decode(input);
      if (type !== 'npub') return { error: 'Not an npub' };
      return { value: data };
    }
    if (/^[0-9a-f]{64}$/i.test(input)) return { value: input.toLowerCase() };
    return { error: 'Invalid npub or hex pubkey' };
  } catch {
    return { error: 'Invalid npub or hex pubkey' };
  }
};

const displayNpub = (hex) => nip19.npubEncode(hex).slice(0, 24) + '...';

const validateRelayURL = (input) => {
  if (input.startsWith('wss://') || input.startsWith('ws://')) return { value: input };
  return { error: 'Must start with wss:// or ws://' };
};

const THEME_OPTIONS = [
  { value: 'terminal-green', label: 'Terminal Green' },
  { value: 'parchment', label: 'Parchment' },
  { value: 'void-blue', label: 'Void Blue' },
  { value: 'blood-red', label: 'Blood Red' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'custom', label: 'Custom (set colour overrides)' },
];

const FONT_OPTIONS = [
  { value: 'ibm-plex-mono', label: 'IBM Plex Mono' },
  { value: 'courier', label: 'Courier' },
  { value: 'pixel', label: 'Pixel' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'serif', label: 'Serif' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'text/plain', label: 'Plain text' },
  { value: 'text/markdown', label: 'Markdown' },
];

const CURSOR_OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'underline', label: 'Underline' },
  { value: 'beam', label: 'Beam' },
];

const EFFECTS_OPTIONS = [
  { value: '', label: 'Default (from theme)' },
  { value: 'crt', label: 'CRT — scanlines, glow, flicker, vignette' },
  { value: 'static', label: 'Static — CRT + noise grain' },
  { value: 'typewriter', label: 'Typewriter — vignette only' },
  { value: 'clean', label: 'Clean — no effects' },
];

const COLLAB_OPTIONS = [
  { value: 'closed', label: 'Closed — only you can publish' },
  { value: 'vouched', label: 'Vouched — invite collaborators' },
  { value: 'open', label: 'Open — anyone can contribute' },
];

const COLOUR_SLOTS = ['bg', 'text', 'title', 'dim', 'highlight', 'error', 'item', 'npc', 'clue', 'puzzle', 'exits'];

export default function WorldCreator({
  onClose,
  onSaveDrafts,  // (worldSlug, drafts: eventTemplate[]) => void
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugOverride, setSlugOverride] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [genreTags, setGenreTags] = useState([]);
  const [contentWarnings, setContentWarnings] = useState([]);
  const [theme, setTheme] = useState('terminal-green');
  const [font, setFont] = useState('ibm-plex-mono');
  const [cursor, setCursor] = useState('block');
  const [effectsBundle, setEffectsBundle] = useState('');
  const [effectOverrides, setEffectOverrides] = useState({}); // { scanlines: '0.5', glow: '0.3', ... }
  const [contentType, setContentType] = useState('text/plain');
  const [collaboration, setCollaboration] = useState('closed');
  const [colourOverrides, setColourOverrides] = useState({}); // { slot: '#hex' }
  const [collaborators, setCollaborators] = useState([]); // hex pubkeys
  const [relayURLs, setRelayURLs] = useState([...DEFAULT_RELAY_URLS]);
  const [startPlaceTitle, setStartPlaceTitle] = useState('');
  const [startPlaceContent, setStartPlaceContent] = useState('');

  // Live-preview theme/effects/font/cursor — revert on unmount
  const savedThemeRef = useRef(null);
  useEffect(() => {
    // Snapshot current CSS custom properties on first mount
    if (!savedThemeRef.current) {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      savedThemeRef.current = {
        colours: {},
        effects: {
          scanlines: cs.getPropertyValue('--effect-scanlines').trim(),
          glow: cs.getPropertyValue('--effect-glow').trim(),
          flicker: cs.getPropertyValue('--effect-flicker').trim(),
          vignette: cs.getPropertyValue('--effect-vignette').trim(),
          noise: cs.getPropertyValue('--effect-noise').trim(),
        },
        fontFamily: cs.getPropertyValue('--font-family').trim(),
        fontSize: cs.getPropertyValue('--font-size').trim() || '15px',
        cursorStyle: cs.getPropertyValue('--cursor-style').trim(),
        flickerActive: document.getElementById('root')?.classList.contains('flicker-active'),
        bodyClasses: [...document.body.classList].filter(c => c.startsWith('cursor-')),
      };
      // Save colour slots
      for (const slot of ['bg', 'text', 'title', 'dim', 'highlight', 'error', 'item', 'npc', 'clue', 'puzzle', 'exits']) {
        savedThemeRef.current.colours[slot] = cs.getPropertyValue(`--colour-${slot}`).trim();
      }
    }

    // Build a fake world event from current form state to resolve through the theme system
    const fakeTags = [['theme', theme], ['font', font], ['cursor', cursor]];
    if (effectsBundle) fakeTags.push(['effects', effectsBundle]);
    for (const [name, val] of Object.entries(effectOverrides)) {
      if (val !== '') fakeTags.push([name, val]);
    }
    for (const [slot, hex] of Object.entries(colourOverrides)) {
      if (hex.trim()) fakeTags.push(['colour', slot, hex.trim()]);
    }
    const fakeEvent = { tags: fakeTags };

    applyTheme(resolveTheme(fakeEvent));
    const effects = resolveEffects(fakeEvent);
    applyEffects(effects);
    const fontFamily = resolveFont(fakeEvent);
    const fontSize = resolveFontSize(fakeEvent);
    const fontSizePanel = resolveFontSizePanel(fakeEvent);
    const cursorStyle = resolveCursor(fakeEvent);
    applyFontAndCursor(fontFamily, cursorStyle, fontSize, fontSizePanel);
    loadFont(fakeEvent);

    // Toggle flicker
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.classList.toggle('flicker-active', effects.flicker > 0);

    // Set cursor class on body
    document.body.classList.remove('cursor-beam', 'cursor-block', 'cursor-underline');
    document.body.classList.add(`cursor-${cursorStyle}`);
  }, [theme, font, cursor, effectsBundle, effectOverrides, colourOverrides]);

  // Revert on unmount
  useEffect(() => {
    return () => {
      const saved = savedThemeRef.current;
      if (!saved) return;
      const root = document.documentElement;
      for (const [slot, val] of Object.entries(saved.colours)) {
        root.style.setProperty(`--colour-${slot}`, val);
      }
      root.style.setProperty('--effect-scanlines', saved.effects.scanlines);
      root.style.setProperty('--effect-glow', saved.effects.glow);
      root.style.setProperty('--effect-flicker', saved.effects.flicker);
      root.style.setProperty('--effect-vignette', saved.effects.vignette);
      root.style.setProperty('--effect-noise', saved.effects.noise);
      root.style.setProperty('--font-family', saved.fontFamily);
      root.style.setProperty('--cursor-style', saved.cursorStyle);
      root.style.setProperty('--font-size', saved.fontSize);
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.classList.toggle('flicker-active', saved.flickerActive);
      document.body.classList.remove('cursor-beam', 'cursor-block', 'cursor-underline');
      for (const cls of saved.bodyClasses) document.body.classList.add(cls);
    };
  }, []);

  // Auto-derive slug from title unless manually overridden
  const effectiveSlug = useMemo(() => {
    if (slugOverride && slug) return slug;
    return title ? slugify(title) : '';
  }, [title, slug, slugOverride]);

  // Build the d-tag for the genesis place
  const startPlaceDTag = useMemo(() => {
    if (!effectiveSlug || !startPlaceTitle) return '';
    return `${effectiveSlug}:place:${slugify(startPlaceTitle)}`;
  }, [effectiveSlug, startPlaceTitle]);

  // Validation
  const validation = useMemo(() => {
    const errors = [];
    if (!title.trim()) errors.push('Title is required');
    if (!effectiveSlug) errors.push('World slug is required');
    if (effectiveSlug && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(effectiveSlug) && effectiveSlug.length > 1) {
      errors.push('Slug must be lowercase letters, numbers, and hyphens');
    }
    if (relayURLs.length === 0) errors.push('At least one relay URL is required');
    if (!startPlaceTitle.trim()) errors.push('Start place title is required');
    if (!startPlaceContent.trim()) errors.push('Start place description is required');
    return errors;
  }, [title, effectiveSlug, relayURLs, startPlaceTitle, startPlaceContent]);

  const isValid = validation.length === 0;

  const handleCreate = useCallback(() => {
    if (!isValid) return;

    // Build genesis place a-tag (uses <PUBKEY> placeholder — resolved at publish time)
    const genesisPlaceATag = `30078:<PUBKEY>:${startPlaceDTag}`;

    // Build world event tags
    const worldTags = [
      ['title', title.trim()],
    ];
    if (authorName.trim()) worldTags.push(['author', authorName.trim()]);
    worldTags.push(['version', '1.0.0']);
    worldTags.push(['lang', 'en']);
    for (const t of genreTags) worldTags.push(['tag', t]);
    for (const cw of contentWarnings) worldTags.push(['cw', cw]);
    worldTags.push(['start', genesisPlaceATag]);
    for (const url of relayURLs) worldTags.push(['relay', url]);
    worldTags.push(['collaboration', collaboration]);
    for (const pubkey of collaborators) {
      worldTags.push(['collaborator', pubkey]);
    }
    worldTags.push(['theme', theme]);
    worldTags.push(['font', font]);
    worldTags.push(['cursor', cursor]);
    if (effectsBundle) worldTags.push(['effects', effectsBundle]);
    // Effect overrides
    for (const [name, val] of Object.entries(effectOverrides)) {
      if (val !== '') worldTags.push([name, val]);
    }
    worldTags.push(['content-type', contentType]);
    // Colour overrides
    for (const [slot, hex] of Object.entries(colourOverrides)) {
      if (hex.trim()) worldTags.push(['colour', slot, hex.trim()]);
    }

    // Build world event template
    const worldTemplate = buildEventTemplate({
      eventType: 'world',
      worldSlug: effectiveSlug,
      dTag: `${effectiveSlug}:world`,
      tags: worldTags,
      content: description.trim(),
    });

    // Build genesis place event template
    const placeTags = [
      ['title', startPlaceTitle.trim()],
    ];

    const placeTemplate = buildEventTemplate({
      eventType: 'place',
      worldSlug: effectiveSlug,
      dTag: startPlaceDTag,
      tags: placeTags,
      content: startPlaceContent.trim(),
    });

    // Save both as drafts
    onSaveDrafts(effectiveSlug, [worldTemplate, placeTemplate]);
    onClose();
  }, [isValid, title, authorName, description, genreTags, contentWarnings, theme, font, cursor, effectsBundle, effectOverrides, contentType,
      collaboration, collaborators, colourOverrides, relayURLs, effectiveSlug, startPlaceDTag, startPlaceTitle, startPlaceContent, onSaveDrafts, onClose]);

  return (
    <DOSPanel title="CREATE WORLD" onClose={onClose} minWidth="32em" maxWidth="95vw">
      {/* World slug */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>
          World Slug (unique identifier):
        </div>
        <input
          value={slugOverride ? slug : effectiveSlug}
          onChange={(e) => {
            setSlugOverride(true);
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
          }}
          placeholder="my-world"
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
        <div style={{ color: 'var(--colour-dim)', fontSize: '0.55rem' }}>
          Used in ids and URLs. Auto-derived from title.
        </div>
      </div>

      {/* Title */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Title:</div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugOverride) setSlug('');
          }}
          placeholder="My Amazing World"
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
      </div>

      {/* Author name */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Author Name (optional):</div>
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
      </div>

      {/* Description */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Description:</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of your world..."
          rows={3}
          className="w-full bg-transparent outline-none font-mono text-xs px-1 resize-y"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
      </div>

      {/* ── Appearance ─────────────────────────────────────── */}
      <div className="mb-0.5 mt-1" style={{ color: 'var(--colour-title)', fontSize: '0.7rem' }}>Appearance</div>

      {/* Theme / Font / Cursor */}
      {[
        ['Theme', theme, setTheme, THEME_OPTIONS],
        ['Font', font, setFont, FONT_OPTIONS],
        ['Cursor', cursor, setCursor, CURSOR_OPTIONS],
      ].map(([label, value, onChange, options]) => (
        <div key={label} className="mb-1 flex items-center gap-2">
          <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
            {label}:
          </span>
          <div className="flex-1">
            <DOSSelect value={value} onChange={onChange} options={options} />
          </div>
        </div>
      ))}

      {/* Effects bundle */}
      <div className="mb-1 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
          Effects:
        </span>
        <div className="flex-1">
          <DOSSelect value={effectsBundle} onChange={setEffectsBundle} options={EFFECTS_OPTIONS} />
        </div>
      </div>

      {/* Fine-tune effects — directly below Effects */}
      {(() => {
        const EFFECT_CONTROLS = [
          { name: 'scanlines', label: 'Scanlines', type: 'range' },
          { name: 'glow', label: 'Glow', type: 'range' },
          { name: 'vignette', label: 'Vignette', type: 'range' },
          { name: 'noise', label: 'Noise', type: 'range' },
          { name: 'flicker', label: 'Flicker', type: 'toggle' },
        ];
        const hasOverrides = Object.values(effectOverrides).some(v => v !== '');
        return (
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }} />
              <button
                onClick={() => {
                  if (hasOverrides) {
                    setEffectOverrides({});
                  } else {
                    setEffectOverrides({ scanlines: '', glow: '', flicker: '', vignette: '', noise: '' });
                  }
                }}
                style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '0 4px', fontSize: '0.6rem' }}
              >
                {hasOverrides ? 'clear' : '+ fine-tune'}
              </button>
            </div>
            {Object.keys(effectOverrides).length > 0 && (
              <div>
                {EFFECT_CONTROLS.map(({ name, label, type }) => (
                  <div key={name} className="flex items-center gap-2 mb-0.5">
                    <span className="shrink-0" style={{ color: 'var(--colour-dim)', width: '7em', textAlign: 'right', fontSize: '0.65rem' }}>
                      {label}:
                    </span>
                    {type === 'toggle' ? (
                      <div className="flex-1">
                        <DOSSelect
                          value={effectOverrides[name] || ''}
                          onChange={(val) => setEffectOverrides(prev => ({ ...prev, [name]: val }))}
                          options={[{ value: '', label: 'default' }, { value: 'on', label: 'on' }, { value: 'off', label: 'off' }]}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={effectOverrides[name] || '0'}
                          onChange={(e) => setEffectOverrides(prev => ({ ...prev, [name]: e.target.value === '0' ? '' : e.target.value }))}
                          className="flex-1 effect-slider"
                        />
                        <span style={{ color: effectOverrides[name] ? 'var(--colour-text)' : 'var(--colour-dim)', width: '2.5em', fontSize: '0.65rem' }}>
                          {effectOverrides[name] || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Content type */}
      <div className="mb-1 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
          Content:
        </span>
        <div className="flex-1">
          <DOSSelect value={contentType} onChange={setContentType} options={CONTENT_TYPE_OPTIONS} />
        </div>
      </div>

      {/* Colour overrides */}
      {(() => {
        const available = COLOUR_SLOTS.filter((s) => !(s in colourOverrides));
        if (available.length === 0) return null;
        return (
          <div className="mb-1 flex items-center gap-2">
            <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
              Colour:
            </span>
            <div className="flex-1">
              <DOSSelect
                value=""
                onChange={(slot) => { if (slot) setColourOverrides((prev) => ({ ...prev, [slot]: '' })); }}
                options={[{ value: '', label: '+ add override...' }, ...available.map((s) => ({ value: s, label: s }))]}
              />
            </div>
          </div>
        );
      })()}
      {Object.entries(colourOverrides).map(([slot, hex]) => (
        <div key={slot} className="mb-1 flex items-center gap-2">
          <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
            {slot}:
          </span>
          <input
            value={hex}
            onChange={(e) => setColourOverrides((prev) => ({ ...prev, [slot]: e.target.value }))}
            placeholder="#000000"
            className="bg-transparent outline-none font-mono text-xs px-1"
            style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)', width: '7em' }}
          />
          {hex && (
            <span
              className="shrink-0"
              style={{
                display: 'inline-block',
                width: '1.2em',
                height: '1.2em',
                backgroundColor: hex,
                border: '1px solid var(--colour-dim)',
              }}
            />
          )}
          <button
            onClick={() => setColourOverrides((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            })}
            className="cursor-pointer shrink-0"
            style={{ color: 'var(--colour-error)', background: 'none', border: 'none', font: 'inherit', padding: 0, fontSize: '0.65rem' }}
          >
            ×
          </button>
        </div>
      ))}

      {/* ── Discovery & Access ─────────────────────────────── */}
      <div className="mb-0.5 mt-3" style={{ color: 'var(--colour-title)', fontSize: '0.7rem' }}>Discovery & Access</div>

      {/* Genre tags */}
      <InlineList label="Tags" items={genreTags} onChange={setGenreTags} placeholder="mystery, horror..." />

      {/* Content warnings */}
      <InlineList label="CW" items={contentWarnings} onChange={setContentWarnings} placeholder="mild-peril, violence..." />

      {/* Collaboration */}
      <div className="mb-1 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem', width: '7em', textAlign: 'right' }}>
          Collab:
        </span>
        <div className="flex-1">
          <DOSSelect value={collaboration} onChange={setCollaboration} options={COLLAB_OPTIONS} />
        </div>
      </div>

      {/* Collaborators — shown when vouched mode */}
      {collaboration === 'vouched' && (
        <InlineList
          label="Collabs"
          items={collaborators}
          onChange={setCollaborators}
          placeholder="npub1... or hex pubkey"
          validate={validateNpub}
          display={displayNpub}
        />
      )}

      {/* Relay URLs */}
      <InlineList
        label="Relays"
        items={relayURLs}
        onChange={setRelayURLs}
        placeholder="wss://relay.example.com"
        validate={validateRelayURL}
      />

      {/* Divider */}
      <div className="my-3" style={{ borderTop: '1px solid var(--colour-dim)' }} />

      {/* Genesis place */}
      <div className="mb-0.5" style={{ color: 'var(--colour-title)', fontSize: '0.7rem' }}>
        Genesis Place (where players start):
      </div>

      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Place Title:</div>
        <input
          value={startPlaceTitle}
          onChange={(e) => setStartPlaceTitle(e.target.value)}
          placeholder="Town Square"
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
        {startPlaceDTag && (
          <div style={{ color: 'var(--colour-dim)', fontSize: '0.55rem' }}>
            id: {startPlaceDTag}
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Place Description:</div>
        <textarea
          value={startPlaceContent}
          onChange={(e) => setStartPlaceContent(e.target.value)}
          placeholder="Describe the first place players will see..."
          rows={3}
          className="w-full bg-transparent outline-none font-mono text-xs px-1 resize-y"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
      </div>

      {/* Validation errors */}
      {validation.length > 0 && (
        <div className="mb-2" style={{ fontSize: '0.6rem' }}>
          {validation.map((err, i) => (
            <div key={i} style={{ color: 'var(--colour-error)' }}>✗ {err}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
        <DOSButton onClick={onClose} colour="dim">
          Cancel
        </DOSButton>
        <DOSButton
          onClick={handleCreate}
          colour="highlight"
          disabled={!isValid}
        >
          Save Drafts
        </DOSButton>
      </div>
    </DOSPanel>
  );
}
