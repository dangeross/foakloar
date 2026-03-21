/**
 * ImportPreviewPanel — Shows validation results before importing events.
 *
 * Displays counts of valid/rejected/warnings and lets the user confirm or cancel.
 * Reusable from both Lobby (new world import) and DraftListPanel (in-world import).
 */

import React from 'react';
import DOSPanel from '../../components/ui/DOSPanel.jsx';
import DOSButton from './ui/DOSButton.jsx';

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || null;
}

export default function ImportPreviewPanel({ validation, onConfirm, onClose }) {
  const { valid, rejected, warnings, hints, worldSlug, walkthroughSteps } = validation;

  return (
    <DOSPanel title="IMPORT PREVIEW" onClose={onClose} minWidth="28em">
      {worldSlug && (
        <div className="mb-2" style={{ color: 'var(--colour-title)' }}>
          World: {worldSlug}
        </div>
      )}

      {/* Summary */}
      <div className="mb-2" style={{ fontSize: '0.7rem' }}>
        <div style={{ color: 'var(--colour-highlight)' }}>
          {valid.length} event{valid.length !== 1 ? 's' : ''} ready to import
        </div>
        {rejected.length > 0 && (
          <div style={{ color: 'var(--colour-error)' }}>
            {rejected.length} rejected
          </div>
        )}
        {warnings.length > 0 && (
          <div style={{ color: 'var(--colour-dim)' }}>
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </div>
        )}
        <div style={{ color: walkthroughSteps ? 'var(--colour-highlight)' : 'var(--colour-dim)' }}>
          {walkthroughSteps ? `Walkthrough: ${walkthroughSteps} steps` : 'No walkthrough'}
        </div>
      </div>

      {/* Valid events */}
      {valid.length > 0 && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>Import:</div>
          {valid.map((event, i) => {
            const dTag = getTagValue(event, 'd') || '?';
            const typeTag = getTagValue(event, 'type') || '?';
            const title = getTagValue(event, 'title') || '';
            return (
              <div key={i} style={{ fontSize: '0.6rem' }}>
                <span style={{ color: 'var(--colour-highlight)' }}>✓ </span>
                <span style={{ color: 'var(--colour-dim)' }}>[{typeTag}] </span>
                <span style={{ color: 'var(--colour-text)' }}>{title || dTag}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejected events */}
      {rejected.length > 0 && (
        <div className="mb-2">
          <div className="mb-0.5" style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>Rejected:</div>
          {rejected.map(({ event, reason }, i) => {
            const dTag = getTagValue(event, 'd') || '?';
            return (
              <div key={i} style={{ fontSize: '0.6rem' }}>
                <span style={{ color: 'var(--colour-error)' }}>✗ </span>
                <span style={{ color: 'var(--colour-text)' }}>{dTag}: </span>
                <span style={{ color: 'var(--colour-dim)' }}>{reason}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-2">
          {warnings.map((warn, i) => (
            <div key={i} style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>
              ⚠ {warn}
            </div>
          ))}
        </div>
      )}

      {/* Hints */}
      {hints?.length > 0 && (
        <div className="mb-2">
          {hints.map((hint, i) => (
            <div key={i} style={{ color: 'var(--colour-muted, #666)', fontSize: '0.6rem' }}>
              {hint}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
        <DOSButton onClick={onClose} colour="dim">
          Cancel
        </DOSButton>
        {valid.length > 0 && (
          <DOSButton onClick={onConfirm} colour="highlight">
            Import {valid.length} Event{valid.length !== 1 ? 's' : ''}
          </DOSButton>
        )}
      </div>
    </DOSPanel>
  );
}
