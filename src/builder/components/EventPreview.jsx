/**
 * EventPreview — Shows raw event JSON before publishing.
 */

import React, { useMemo, useState } from 'react';
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';
import { validateEvent } from '../eventBuilder.js';

export default function EventPreview({ template, onPublish, onBack, onClose }) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const validation = useMemo(() => validateEvent(template), [template]);
  const json = useMemo(() => JSON.stringify(template, null, 2), [template]);

  async function handlePublish() {
    setPublishing(true);
    setError('');
    const res = await onPublish();
    if (!res.ok) {
      setError(res.error || 'Publish failed.');
      setPublishing(false);
    }
    // On success, the parent closes the panel
  }

  return (
    <DOSPanel title="EVENT PREVIEW" onClose={onClose} minWidth="32em" maxWidth="95vw">
      {(!validation.valid || validation.warnings?.length > 0) && (
        <div className="mb-2">
          {validation.errors.map((err, i) => (
            <div key={`e${i}`} style={{ color: 'var(--colour-error)' }}>✗ {err.message}</div>
          ))}
          {validation.warnings?.map((warn, i) => (
            <div key={`w${i}`} style={{ color: 'var(--colour-dim)' }}>⚠ {warn.message}</div>
          ))}
        </div>
      )}

      <pre
        className="text-xs overflow-x-auto mb-3 p-2"
        style={{
          color: 'var(--colour-text)',
          border: '1px solid var(--colour-dim)',
          maxHeight: '40vh',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {json}
      </pre>

      {error && (
        <div className="mb-2" style={{ color: 'var(--colour-error)' }}>{error}</div>
      )}

      <div className="flex gap-2">
        <DOSButton onClick={onBack} colour="dim">
          Back to Edit
        </DOSButton>
        <DOSButton
          onClick={handlePublish}
          disabled={!validation.valid || publishing}
          colour="highlight"
        >
          {publishing ? 'Publishing...' : 'Publish'}
        </DOSButton>
      </div>
    </DOSPanel>
  );
}
