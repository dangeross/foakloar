/**
 * DraftListPanel — DOS-style panel listing all drafts.
 *
 * Drafts are event templates: { kind, tags, content, _draft: { id, ... } }
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';
import ImportPreviewPanel from './ImportPreviewPanel.jsx';
import { validateEvent } from '../eventBuilder.js';
import { validateImport, loadAnswers, parseJsonLenient } from '../draftStore.js';
import { validateWorld, verifyPuzzleHashes } from '../validateWorld.js';

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || null;
}

export default function DraftListPanel({
  drafts,
  worldSlug,
  onClose,
  onEdit,
  onDelete,
  onPublish,
  onNew,
  onImport,
  onExport,
  onBulkPublish,
  onDeleteAll,
  zIndex,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [expandedValidation, setExpandedValidation] = useState(null);
  const [importPreview, setImportPreview] = useState(null); // { validation, data }
  const fileRef = useRef(null);

  // Validate all drafts upfront (per-event + cross-event)
  const validations = useMemo(() => {
    const map = {};
    // Per-event validation
    for (const draft of drafts) {
      const id = draft._draft?.id;
      if (id) map[id] = validateEvent(draft);
    }
    // Cross-event world validation
    const answers = loadAnswers(worldSlug);
    const worldResult = validateWorld(drafts, answers);
    // Merge world-level issues into per-event results by d-tag
    const dTagToId = {};
    for (const draft of drafts) {
      const dTag = getTagValue(draft, 'd');
      const id = draft._draft?.id;
      if (dTag && id) dTagToId[dTag] = id;
    }
    for (const issue of worldResult.errors) {
      const id = dTagToId[issue.dTag];
      if (id && map[id]) {
        map[id].errors.push(issue);
        map[id].valid = false;
      }
    }
    for (const issue of worldResult.warnings) {
      const id = dTagToId[issue.dTag];
      if (id && map[id]) {
        map[id].warnings.push(issue);
      }
    }
    return { map, puzzlesToVerify: worldResult.puzzlesToVerify || [], dTagToId };
  }, [drafts, worldSlug]);

  // Async puzzle hash verification
  useEffect(() => {
    if (validations.puzzlesToVerify.length === 0) return;
    verifyPuzzleHashes(validations.puzzlesToVerify).then((hashErrors) => {
      if (hashErrors.length === 0) return;
      // Merge hash errors into validation map
      for (const issue of hashErrors) {
        const id = validations.dTagToId[issue.dTag];
        if (id && validations.map[id]) {
          validations.map[id].errors.push(issue);
          validations.map[id].valid = false;
        }
      }
      // Force re-render
      setConfirmDelete((prev) => prev);
    });
  }, [validations.puzzlesToVerify]); // eslint-disable-line react-hooks/exhaustive-deps

  // Import preview is showing — render that instead
  if (importPreview) {
    return (
      <ImportPreviewPanel
        validation={importPreview.validation}
        onConfirm={() => {
          // Import only the valid events
          const validData = {
            events: importPreview.validation.valid,
            answers: importPreview.data.answers || {},
          };
          onImport(validData);
          setImportPreview(null);
        }}
        onClose={() => setImportPreview(null)}
      />
    );
  }

  return (
    <DOSPanel title="DRAFTS" onClose={onClose} minWidth="30em" zIndex={zIndex} noPadding>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(80vh - 6em)', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, padding: '0.5rem 0.75rem 0' }}>
      {drafts.length === 0 && (
        <div style={{ color: 'var(--colour-dim)' }}>No drafts yet.</div>
      )}

      {drafts.map((draft) => {
        const id = draft._draft?.id;
        const eventType = getTagValue(draft, 'type') || '?';
        const title = getTagValue(draft, 'title') || getTagValue(draft, 'd') || 'untitled';
        const validation = validations.map[id];
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
                  <div key={`e${i}`} style={{ color: 'var(--colour-error)' }}>✗ {err.message}</div>
                ))}
                {validation.warnings?.map((warn, i) => (
                  <div key={`w${i}`} style={{ color: 'var(--colour-dim)' }}>⚠ {warn.message}</div>
                ))}
                {isValid && !hasWarnings && (
                  <div style={{ color: 'var(--colour-highlight)' }}>✓ Ready to publish</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      </div>{/* end scrollable list */}
      <div className="flex gap-2 flex-wrap shrink-0" style={{ borderTop: '1px solid var(--colour-dim)', padding: '0.5rem 0.75rem' }}>
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
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = parseJsonLenient(reader.result);
                  const validation = validateImport(worldSlug, data);
                  // Run cross-event validation on combined set
                  const combinedEvents = [...drafts, ...validation.valid];
                  const answers = { ...loadAnswers(worldSlug), ...(data.answers || {}) };
                  const worldResult = validateWorld(combinedEvents, answers);
                  // Merge world warnings into import warnings
                  for (const issue of worldResult.warnings) {
                    validation.warnings.push(`${issue.dTag}: ${issue.message}`);
                  }
                  for (const issue of worldResult.errors) {
                    validation.warnings.push(`⚠ ${issue.dTag}: ${issue.message}`);
                  }
                  setImportPreview({ validation, data });
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

        {/* Delete all */}
        {drafts.length > 0 && !confirmDeleteAll && (
          <DOSButton onClick={() => setConfirmDeleteAll(true)} colour="error">
            Delete All
          </DOSButton>
        )}
        {confirmDeleteAll && (
          <span className="flex gap-1 items-center">
            <span style={{ color: 'var(--colour-error)', fontSize: '0.65rem' }}>Delete all drafts?</span>
            <DOSButton onClick={() => { onDeleteAll(); setConfirmDeleteAll(false); }} colour="error">
              Yes
            </DOSButton>
            <DOSButton onClick={() => setConfirmDeleteAll(false)} colour="dim">
              No
            </DOSButton>
          </span>
        )}
      </div>{/* end footer */}
      </div>{/* end flex wrapper */}
    </DOSPanel>
  );
}
