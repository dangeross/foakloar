/**
 * EventEditor — Generic event creation/edit form.
 *
 * Works for any event type. Renders title, content, d-tag,
 * and delegates tag editing to TagEditor.
 *
 * Saves drafts as event templates: { kind: 30078, tags: [...], content: "" }
 * with <PUBKEY> placeholders in a-tag refs.
 */

import React, { useState, useCallback, useMemo } from 'react';
import DOSPanel from './DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';
import TagEditor from './TagEditor.jsx';
import EventPreview from './EventPreview.jsx';
import { buildEventTemplate, buildDTag, publishEvent } from './eventBuilder.js';
import { resolvePubkeyPlaceholder } from './draftStore.js';

/**
 * Extract fields from an event template for editing.
 */
function parseEventTemplate(event) {
  if (!event) return { eventType: 'place', title: '', content: '', dTag: '', tags: [] };
  const eventType = event.tags?.find((t) => t[0] === 'type')?.[1] || 'place';
  const title = event.tags?.find((t) => t[0] === 'title')?.[1] || '';
  const dTag = event.tags?.find((t) => t[0] === 'd')?.[1] || '';
  const content = event.content || '';
  // Filter out auto-managed tags for the tag editor
  const editableTags = (event.tags || []).filter(
    (t) => !['d', 't', 'type', 'title'].includes(t[0])
  );
  return { eventType, title, content, dTag, tags: editableTags };
}

export default function EventEditor({
  eventType: eventTypeProp,
  worldSlug,
  pubkey,
  signer,
  relay,
  events,
  onClose,
  onPublished,
  // Event template (for editing existing drafts)
  eventTemplate = null,
  // Pre-populated tags (for new events, e.g. portal from exit click)
  initialTags = [],
  onSaveDraft,       // (eventTemplate) => void
  // Start in preview mode (e.g. from draft list "Pub" button)
  startInPreview = false,
}) {
  // Parse from event template if editing, otherwise use props
  const parsed = useMemo(() => parseEventTemplate(eventTemplate), [eventTemplate]);

  const [eventType] = useState(eventTypeProp || parsed.eventType);
  const [title, setTitle] = useState(parsed.title);
  const [content, setContent] = useState(parsed.content);
  const [tags, setTags] = useState(
    eventTemplate ? parsed.tags : initialTags
  );
  const [dTagOverride, setDTagOverride] = useState(parsed.dTag || '');
  const [showPreview, setShowPreview] = useState(startInPreview);

  // Auto-generate d-tag from title
  const dTag = useMemo(() => {
    if (dTagOverride) return dTagOverride;
    if (!title) return `${worldSlug}:${eventType}:`;
    return buildDTag(worldSlug, eventType, title);
  }, [worldSlug, eventType, title, dTagOverride]);

  // Check for d-tag collision (using resolved pubkey, not placeholder)
  const dTagCollision = useMemo(() => {
    if (!pubkey || !dTag) return false;
    const aTag = `30078:${pubkey}:${dTag}`;
    return events.has(aTag);
  }, [pubkey, dTag, events]);

  // Build the full tag set including title
  const allTags = useMemo(() => {
    const result = [...tags];
    if (title && !tags.some((t) => t[0] === 'title')) {
      result.unshift(['title', title]);
    }
    return result;
  }, [tags, title]);

  // Build the event template for preview/publish
  const template = useMemo(() => {
    return buildEventTemplate({
      eventType,
      worldSlug,
      dTag,
      tags: allTags,
      content,
    });
  }, [eventType, worldSlug, dTag, allTags, content]);

  // Build the event template for saving as draft (may contain <PUBKEY>)
  const draftTemplate = useMemo(() => ({
    kind: 30078,
    tags: [
      ['d', dTag],
      ['t', worldSlug],
      ['type', eventType],
      ...allTags,
    ],
    content,
  }), [dTag, worldSlug, eventType, allTags, content]);

  const handlePublish = useCallback(async () => {
    // Resolve <PUBKEY> placeholders before publishing
    const resolved = resolvePubkeyPlaceholder(template, pubkey);
    const res = await publishEvent(signer, relay, resolved);
    if (res.ok) {
      onPublished?.(res.event);
      onClose();
    }
    return res;
  }, [signer, relay, template, pubkey, onPublished, onClose]);

  const handleSaveDraft = useCallback(() => {
    if (onSaveDraft) {
      onSaveDraft(draftTemplate);
      onClose();
    }
  }, [onSaveDraft, draftTemplate, onClose]);

  if (showPreview) {
    // Show with resolved pubkey for accurate preview
    const previewTemplate = pubkey
      ? resolvePubkeyPlaceholder(template, pubkey)
      : template;

    return (
      <EventPreview
        template={previewTemplate}
        onPublish={handlePublish}
        onBack={() => setShowPreview(false)}
        onClose={onClose}
      />
    );
  }

  // Determine if this event type has a title field
  const hasTitle = ['place', 'item', 'feature', 'clue', 'npc', 'payment', 'world', 'quest'].includes(eventType);
  // Determine if this event type has content
  const hasContent = ['place', 'item', 'feature', 'clue', 'puzzle', 'world'].includes(eventType);

  return (
    <DOSPanel
      title={`${eventTemplate ? 'EDIT' : 'NEW'} ${eventType.toUpperCase()}`}
      onClose={onClose}
      minWidth="32em"
      maxWidth="95vw"
    >
      {/* D-tag */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>d-tag:</div>
        <input
          value={dTag}
          onChange={(e) => setDTagOverride(e.target.value)}
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-dim)', border: '1px solid var(--colour-dim)' }}
        />
        {dTagCollision && (
          <div className="mt-0.5" style={{ color: 'var(--colour-error)', fontSize: '0.6rem' }}>
            This d-tag already exists — publishing will replace the existing event.
          </div>
        )}
      </div>

      {/* Title */}
      {hasTitle && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Title:</div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (!dTagOverride || dTagOverride === buildDTag(worldSlug, eventType, title)) setDTagOverride(''); }}
            placeholder="Event title..."
            className="w-full bg-transparent outline-none font-mono text-xs px-1"
            style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
          />
        </div>
      )}

      {/* Content */}
      {hasContent && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Content:</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Prose description..."
            rows={4}
            className="w-full bg-transparent outline-none font-mono text-xs px-1 resize-y"
            style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
          />
        </div>
      )}

      {/* Tags */}
      <div className="mb-3">
        <div className="mb-1" style={{ color: 'var(--colour-dim)', fontSize: '0.65rem' }}>Tags:</div>
        <TagEditor
          eventType={eventType}
          tags={tags}
          onChange={setTags}
          events={events}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
        {onSaveDraft && (
          <DOSButton onClick={handleSaveDraft} colour="dim">
            Save Draft
          </DOSButton>
        )}
        <DOSButton onClick={() => setShowPreview(true)} colour="highlight">
          Preview & Publish
        </DOSButton>
      </div>
    </DOSPanel>
  );
}
