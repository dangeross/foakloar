/**
 * WorldCreator — DOS-style panel for creating a new world.
 *
 * Collects world metadata (slug, title, author, theme, collaboration mode,
 * relay URLs) and saves both a world event and a genesis place event as
 * drafts. The user can then review, edit, and publish from the drafts panel.
 */

import React, { useState, useCallback, useMemo } from 'react';
import DOSPanel from '../components/ui/DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';
import { slugify, buildEventTemplate } from './eventBuilder.js';
import { DEFAULT_RELAY_URLS } from '../config.js';

const THEME_OPTIONS = [
  { value: 'terminal-green', label: 'Terminal Green' },
  { value: 'amber-crt', label: 'Amber CRT' },
  { value: 'frost', label: 'Frost' },
  { value: 'parchment', label: 'Parchment' },
  { value: 'obsidian', label: 'Obsidian' },
  { value: 'blood-moon', label: 'Blood Moon' },
];

const COLLAB_OPTIONS = [
  { value: 'closed', label: 'Closed — only you can publish' },
  { value: 'vouched', label: 'Vouched — invite collaborators' },
  { value: 'open', label: 'Open — anyone can contribute' },
];

export default function WorldCreator({
  onClose,
  onSaveDrafts,  // (worldSlug, drafts: eventTemplate[]) => void
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugOverride, setSlugOverride] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('terminal-green');
  const [collaboration, setCollaboration] = useState('closed');
  const [relayURLs, setRelayURLs] = useState(DEFAULT_RELAY_URLS.join('\n'));
  const [startPlaceTitle, setStartPlaceTitle] = useState('');
  const [startPlaceContent, setStartPlaceContent] = useState('');

  // Auto-derive slug from title unless manually overridden
  const effectiveSlug = useMemo(() => {
    if (slugOverride && slug) return slug;
    return title ? slugify(title) : '';
  }, [title, slug, slugOverride]);

  // Parse relay URLs from textarea
  const relays = useMemo(() => {
    return relayURLs
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('wss://') || s.startsWith('ws://'));
  }, [relayURLs]);

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
    if (relays.length === 0) errors.push('At least one relay URL is required');
    if (!startPlaceTitle.trim()) errors.push('Start place title is required');
    if (!startPlaceContent.trim()) errors.push('Start place description is required');
    return errors;
  }, [title, effectiveSlug, relays, startPlaceTitle, startPlaceContent]);

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
    worldTags.push(['start', genesisPlaceATag]);
    for (const url of relays) {
      worldTags.push(['relay', url]);
    }
    worldTags.push(['collaboration', collaboration]);
    worldTags.push(['theme', theme]);
    worldTags.push(['cursor', 'block']);
    worldTags.push(['content-type', 'text/plain']);

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
  }, [isValid, title, authorName, description, theme, collaboration, relays,
      effectiveSlug, startPlaceDTag, startPlaceTitle, startPlaceContent, onSaveDrafts, onClose]);

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
          Used in d-tags and URLs. Auto-derived from title.
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

      {/* Theme */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Theme:</div>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full bg-transparent font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)', backgroundColor: 'var(--colour-bg)' }}
        >
          {THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Collaboration mode */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Collaboration:</div>
        <select
          value={collaboration}
          onChange={(e) => setCollaboration(e.target.value)}
          className="w-full bg-transparent font-mono text-xs px-1"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)', backgroundColor: 'var(--colour-bg)' }}
        >
          {COLLAB_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Relay URLs */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Relay URLs (one per line):</div>
        <textarea
          value={relayURLs}
          onChange={(e) => setRelayURLs(e.target.value)}
          rows={2}
          className="w-full bg-transparent outline-none font-mono text-xs px-1 resize-y"
          style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
        />
      </div>

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
            d-tag: {startPlaceDTag}
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
