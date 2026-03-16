/**
 * DraftListPanel — DOS-style panel listing all drafts.
 *
 * Drafts are event templates: { kind, tags, content, _draft: { id, ... } }
 */

import React, { useState, useRef, useMemo } from 'react';
import DOSPanel from './DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';
import { validateEvent } from './eventBuilder.js';

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || null;
}

export default function DraftListPanel({
  drafts,
  onClose,
  onEdit,
  onDelete,
  onPublish,
  onNew,
  onImport,
  onExport,
  onBulkPublish,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedValidation, setExpandedValidation] = useState(null);
  const fileRef = useRef(null);

  // Validate all drafts upfront
  const validations = useMemo(() => {
    const map = {};
    for (const draft of drafts) {
      const id = draft._draft?.id;
      if (id) map[id] = validateEvent(draft);
    }
    return map;
  }, [drafts]);

  return (
    <DOSPanel title="DRAFTS" onClose={onClose} minWidth="30em">
      {drafts.length === 0 && (
        <div style={{ color: 'var(--colour-dim)' }}>No drafts yet.</div>
      )}

      {drafts.map((draft) => {
        const id = draft._draft?.id;
        const eventType = getTagValue(draft, 'type') || '?';
        const title = getTagValue(draft, 'title') || getTagValue(draft, 'd') || 'untitled';
        const validation = validations[id];
        const isValid = validation?.valid;
        const hasWarnings = validation?.warnings?.length > 0;
        const isExpanded = expandedValidation === id;

        return (
          <div key={id} style={{ borderBottom: '1px solid var(--colour-dim)' }}>
            <div className="flex items-center gap-2 py-1">
              {/* Validation indicator — click to expand details */}
              <span
                className="shrink-0 cursor-pointer"
                style={{
                  color: !isValid ? 'var(--colour-error)' : hasWarnings ? 'var(--colour-dim)' : 'var(--colour-highlight)',
                  fontSize: '0.7rem',
                  width: '1em',
                  textAlign: 'center',
                }}
                onClick={() => setExpandedValidation(isExpanded ? null : id)}
                title={!isValid ? 'Has errors — click for details' : hasWarnings ? 'Has warnings — click for details' : 'Valid'}
              >
                {!isValid ? '✗' : hasWarnings ? '⚠' : '✓'}
              </span>

              <span
                className="shrink-0 px-1"
                style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}
              >
                [{eventType}]
              </span>
              <span className="flex-1 truncate" style={{ color: 'var(--colour-text)' }}>
                {title}
              </span>

              {confirmDelete === id ? (
                <span className="flex gap-1">
                  <DOSButton onClick={() => { onDelete(id); setConfirmDelete(null); }} colour="error">
                    Yes
                  </DOSButton>
                  <DOSButton onClick={() => setConfirmDelete(null)} colour="dim">
                    No
                  </DOSButton>
                </span>
              ) : (
                <span className="flex gap-1">
                  <DOSButton onClick={() => onEdit(draft)} colour="text">
                    Edit
                  </DOSButton>
                  <DOSButton onClick={() => onPublish(draft)} colour="highlight" disabled={!isValid}>
                    Pub
                  </DOSButton>
                  <DOSButton onClick={() => setConfirmDelete(id)} colour="error">
                    Del
                  </DOSButton>
                </span>
              )}
            </div>

            {/* Expanded validation details */}
            {isExpanded && validation && (
              <div className="pb-1 pl-4" style={{ fontSize: '0.6rem' }}>
                {validation.errors.map((err, i) => (
                  <div key={`e${i}`} style={{ color: 'var(--colour-error)' }}>✗ {err}</div>
                ))}
                {validation.warnings?.map((warn, i) => (
                  <div key={`w${i}`} style={{ color: 'var(--colour-dim)' }}>⚠ {warn}</div>
                ))}
                {isValid && !hasWarnings && (
                  <div style={{ color: 'var(--colour-highlight)' }}>✓ Ready to publish</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-3 flex gap-2 flex-wrap">
        <DOSButton onClick={onNew} colour="text">
          + New Draft
        </DOSButton>

        {/* Import */}
        <DOSButton onClick={() => fileRef.current?.click()} colour="dim">
          Import
        </DOSButton>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onImport) {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result);
                  onImport(data);
                } catch {
                  // Invalid JSON — ignore
                }
              };
              reader.readAsText(file);
            }
            e.target.value = '';
          }}
        />

        {/* Export */}
        {drafts.length > 0 && (
          <DOSButton onClick={onExport} colour="dim">
            Export
          </DOSButton>
        )}

        {/* Bulk publish */}
        {drafts.length > 0 && (
          <DOSButton onClick={onBulkPublish} colour="highlight">
            Publish All ({drafts.length})
          </DOSButton>
        )}
      </div>
    </DOSPanel>
  );
}
