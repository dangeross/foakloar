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
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';
import TagEditor from './TagEditor.jsx';
import EventPreview from './EventPreview.jsx';
import { buildEventTemplate, buildDTag, publishEvent } from '../eventBuilder.js';
import { EVENT_TYPE_DESCRIPTIONS } from '../tagSchema.js';
import { Tooltip } from './TagEditor.jsx';
import { resolvePubkeyPlaceholder, loadAnswers, saveAnswer } from '../draftStore.js';
import { renderMarkdown } from '../../engine/content.js';

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
  const [mdPreview, setMdPreview] = useState(false);

  // Puzzle answer — stored separately in the answers map, not in tags
  const [puzzleAnswer, setPuzzleAnswer] = useState(() => {
    if (eventType !== 'puzzle') return '';
    const answers = loadAnswers(worldSlug);
    const existingDTag = parsed.dTag || '';
    return answers[existingDTag] || '';
  });

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
    const answers = loadAnswers(worldSlug);
    const res = await publishEvent(signer, relay, resolved, {
      answers,
      allEvents: events,
    });
    if (res.ok) {
      onPublished?.(res.event);
      onClose();
    }
    return res;
  }, [signer, relay, template, pubkey, worldSlug, events, onPublished, onClose]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;

    // For puzzle events: generate answer-hash, save answer
    if (eventType === 'puzzle' && puzzleAnswer.trim()) {
      const existingSalt = draftTemplate.tags.find((t) => t[0] === 'salt')?.[1];
      const salt = existingSalt || crypto.randomUUID();
      const answerTrimmed = puzzleAnswer.trim();
      const data = new TextEncoder().encode(answerTrimmed + salt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Update tags with generated hash and salt
      const updatedTags = draftTemplate.tags.filter(
        (t) => t[0] !== 'answer-hash' && t[0] !== 'salt'
      );
      updatedTags.push(['answer-hash', hashHex]);
      updatedTags.push(['salt', salt]);

      onSaveDraft({ ...draftTemplate, tags: updatedTags });
      saveAnswer(worldSlug, dTag, answerTrimmed);
    } else {
      onSaveDraft(draftTemplate);
    }
    onClose();
  }, [onSaveDraft, draftTemplate, onClose, eventType, puzzleAnswer, dTag, worldSlug]);

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
  const hasTitle = ['place', 'item', 'feature', 'clue', 'npc', 'payment', 'world', 'quest', 'portal', 'puzzle', 'recipe', 'consequence'].includes(eventType);
  // Determine if this event type has content
  const hasContent = ['place', 'item', 'feature', 'npc', 'clue', 'puzzle', 'world', 'recipe', 'consequence', 'quest'].includes(eventType);
  // Current content-type from tags (default: text/plain)
  const contentTypeTag = tags.find((t) => t[0] === 'content-type');
  const contentType = contentTypeTag?.[1] || 'text/plain';
  const isMarkdown = contentType === 'text/markdown';
  const toggleContentType = () => {
    const newType = isMarkdown ? 'text/plain' : 'text/markdown';
    if (contentTypeTag) {
      setTags(tags.map((t) => t[0] === 'content-type' ? ['content-type', newType] : t));
    } else {
      setTags([...tags, ['content-type', newType]]);
    }
  };

  return (
    <DOSPanel
      title={`${eventTemplate ? 'EDIT' : 'NEW'} ${eventType.toUpperCase()}`}
      onClose={onClose}
      minWidth="32em"
      maxWidth="95vw"
    >
      {/* Event type description */}
      {EVENT_TYPE_DESCRIPTIONS[eventType] && (
        <div className="mb-3" style={{ color: 'var(--colour-text)', fontSize: '0.65rem', lineHeight: '1.4' }}>
          {EVENT_TYPE_DESCRIPTIONS[eventType]}
        </div>
      )}

      {/* D-tag */}
      <div className="mb-2">
        <div className="mb-0.5" style={{ color: 'var(--colour-text)', fontSize: '0.65rem' }}>
          id:<Tooltip text="Unique identifier for this event. Auto-generated from title, or set manually." />
        </div>
        <input
          value={dTag}
          onChange={(e) => setDTagOverride(e.target.value)}
          className="w-full bg-transparent outline-none font-mono text-xs px-1"
          style={{ color: 'var(--colour-dim)', border: '1px solid var(--colour-dim)' }}
        />
        {dTagCollision && (
          <div className="mt-0.5" style={{ color: 'var(--colour-error)', fontSize: '0.6rem' }}>
            This id already exists — publishing will replace the existing event.
          </div>
        )}
      </div>

      {/* Title */}
      {hasTitle && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-text)', fontSize: '0.65rem' }}>
            Title:<Tooltip text="The display name shown to the player. Also generates the event id." />
          </div>
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
          <div className="mb-0.5 flex items-center justify-between" style={{ color: 'var(--colour-text)', fontSize: '0.65rem' }}>
            <span>Content:<Tooltip text="The description text shown when the player examines or enters this. Supports plain text or markdown." /></span>
            <span className="flex gap-2">
              <button
                onClick={toggleContentType}
                className="cursor-pointer"
                style={{
                  color: isMarkdown ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                  background: 'none',
                  border: 'none',
                  font: 'inherit',
                  padding: 0,
                  fontSize: '0.6rem',
                }}
                title={`Content type: ${contentType}`}
              >
                [{isMarkdown ? 'markdown' : 'plain'}]
              </button>
              <button
                onClick={() => setMdPreview(!mdPreview)}
                className="cursor-pointer"
                style={{
                  color: mdPreview ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                  background: 'none',
                  border: 'none',
                  font: 'inherit',
                  padding: 0,
                  fontSize: '0.6rem',
                }}
              >
                [{mdPreview ? 'edit' : 'preview'}]
              </button>
            </span>
          </div>
          {mdPreview ? (
            isMarkdown ? (
              <div
                className="w-full font-mono text-xs px-1 py-1 prose-dungeon"
                style={{
                  color: 'var(--colour-text)',
                  border: '1px solid var(--colour-dim)',
                  minHeight: '5em',
                  overflowY: 'auto',
                  maxHeight: '12em',
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content || '*empty*') }}
              />
            ) : (
              <div
                className="w-full font-mono text-xs px-1 py-1 whitespace-pre-wrap"
                style={{
                  color: 'var(--colour-text)',
                  border: '1px solid var(--colour-dim)',
                  minHeight: '5em',
                  overflowY: 'auto',
                  maxHeight: '12em',
                }}
              >
                {content || '(empty)'}
              </div>
            )
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Prose description..."
              rows={4}
              className="w-full bg-transparent outline-none font-mono text-xs px-1 resize-y"
              style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
            />
          )}
        </div>
      )}

      {/* Puzzle answer — shown for riddle and cipher puzzles (not sequence) */}
      {eventType === 'puzzle' && (() => {
        const puzzleType = tags.find((t) => t[0] === 'puzzle-type')?.[1];
        return puzzleType !== 'sequence';
      })() && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-text)', fontSize: '0.65rem' }}>
            Answer (plain text — hashed on save):
          </div>
          <input
            value={puzzleAnswer}
            onChange={(e) => setPuzzleAnswer(e.target.value)}
            placeholder="The answer players must type..."
            className="w-full bg-transparent outline-none font-mono text-xs px-1"
            style={{ color: 'var(--colour-puzzle, var(--colour-text))', border: '1px solid var(--colour-dim)' }}
          />
          {!puzzleAnswer && tags.some((t) => t[0] === 'answer-hash') && (
            <div style={{ color: 'var(--colour-dim)', fontSize: '0.55rem' }}>
              Hash exists from import — enter answer to regenerate, or leave blank to keep existing.
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      <div className="mb-3">
        <div className="mb-1" style={{ color: 'var(--colour-text)', fontSize: '0.65rem' }}>
          Tags:<Tooltip text="Tags define the behaviour and relationships of this event — state machines, triggers, requirements, and connections to other events." />
        </div>
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
          <DOSButton onClick={handleSaveDraft} colour="text">
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
