/**
 * PublishProgressPanel — Shows per-event × per-relay publish results.
 *
 * Displayed after bulkPublish completes. Shows which events succeeded
 * or failed on which relays, with error details.
 */

import React from 'react';
import DOSPanel from '../../components/ui/DOSPanel.jsx';

export default function PublishProgressPanel({ result, onClose, onRetryFailed, zIndex }) {
  if (!result) return null;

  const { published, failed, errors, details } = result;
  const total = published + failed;

  // Collect unique relay URLs from details
  const relayUrls = details?.length > 0
    ? [...new Set(details.flatMap((d) => Object.keys(d.relays || {})))]
    : [];

  const shortUrl = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <DOSPanel title="PUBLISH RESULTS" onClose={onClose} minWidth="24em" maxWidth="95vw" zIndex={zIndex}>
      {/* Summary */}
      <div className="mb-2">
        <span style={{ color: failed === 0 ? 'var(--colour-highlight)' : 'var(--colour-error)' }}>
          {published} published, {failed} failed
        </span>
        <span style={{ color: 'var(--colour-dim)' }}> — {total} total</span>
      </div>

      {/* Per-event details */}
      {details?.length > 0 && relayUrls.length > 0 && (
        <div className="mb-2 overflow-x-auto" style={{ fontSize: '0.6rem' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th className="text-left px-1 py-0.5" style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)' }}>
                  Event
                </th>
                {relayUrls.map((url) => (
                  <th key={url} className="text-center px-1 py-0.5" style={{ color: 'var(--colour-dim)', borderBottom: '1px solid var(--colour-dim)' }}>
                    {shortUrl(url)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i}>
                  <td className="px-1 py-0.5 truncate" style={{ maxWidth: '12em', color: 'var(--colour-text)' }}>
                    {d.dTag?.split(':').pop() || d.dTag || '?'}
                  </td>
                  {relayUrls.map((url) => {
                    const s = d.relays?.[url] || 'skipped';
                    const color = s === 'ok' ? 'var(--colour-highlight)'
                      : s === 'failed' ? 'var(--colour-error)'
                      : 'var(--colour-dim)';
                    const label = s === 'ok' ? '✓' : s === 'failed' ? '✗' : '–';
                    return (
                      <td key={url} className="text-center px-1 py-0.5" style={{ color }}>
                        {label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error messages */}
      {errors?.length > 0 && (
        <div className="mt-2" style={{ fontSize: '0.6rem' }}>
          <div className="mb-1" style={{ color: 'var(--colour-error)' }}>Errors:</div>
          {errors.map((e, i) => (
            <div key={i} className="mb-0.5" style={{ color: 'var(--colour-dim)', wordBreak: 'break-all' }}>
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Retry failed button */}
      {failed > 0 && onRetryFailed && (
        <div className="mt-2">
          <button
            className="text-xs font-mono px-2 py-1"
            style={{ border: '1px solid var(--colour-error)', color: 'var(--colour-error)', background: 'transparent', cursor: 'pointer' }}
            onClick={onRetryFailed}
          >
            Retry {failed} failed
          </button>
        </div>
      )}

      {/* No details (legacy single relay) */}
      {(!details || details.length === 0) && errors?.length === 0 && (
        <div style={{ color: 'var(--colour-highlight)' }}>
          All events published successfully.
        </div>
      )}
    </DOSPanel>
  );
}
