/**
 * DraftListPanel — DOS-style panel listing all drafts.
 *
 * Drafts are event templates: { kind, tags, content, _draft: { id, ... } }
 */

import React, { useState, useRef } from 'react';
import DOSPanel from './DOSPanel.jsx';
import DOSButton from './DOSButton.jsx';

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
  const fileRef = useRef(null);

  return (
    <DOSPanel title="DRAFTS" onClose={onClose} minWidth="30em">
      {drafts.length === 0 && (
        <div style={{ color: 'var(--colour-dim)' }}>No drafts yet.</div>
      )}

      {drafts.map((draft) => {
        const id = draft._draft?.id;
        const eventType = getTagValue(draft, 'type') || '?';
        const title = getTagValue(draft, 'title') || getTagValue(draft, 'd') || 'untitled';

        return (
          <div
            key={id}
            className="flex items-center gap-2 py-1"
            style={{ borderBottom: '1px solid var(--colour-dim)' }}
          >
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
                <DOSButton onClick={() => onPublish(draft)} colour="highlight">
                  Pub
                </DOSButton>
                <DOSButton onClick={() => setConfirmDelete(id)} colour="error">
                  Del
                </DOSButton>
              </span>
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
