/**
 * LoginPanel — Reusable identity management modal.
 *
 * Shows login status, pubkey, secret key export, extension login,
 * nsec login, and logout. Wraps DOSPanel for consistent styling.
 *
 * Accepts optional `children` for extra content (e.g. state backup).
 */

import React, { useState } from 'react';
import { nip19 } from 'nostr-tools';
import DOSPanel from './DOSPanel.jsx';

export default function LoginPanel({ identity, onClose, children }) {
  const [loginError, setLoginError] = useState('');
  const [showNsec, setShowNsec] = useState(false);

  const isLoggedIn = identity?.method !== 'ephemeral';

  const handleClose = () => {
    setLoginError('');
    setShowNsec(false);
    onClose();
  };

  return (
    <DOSPanel title="IDENTITY" onClose={handleClose}>
      <div className="mb-2" style={{ color: 'var(--colour-dim)' }}>
        Status: {isLoggedIn ? identity.method : identity?.backedUp ? 'ephemeral (backed up)' : 'anonymous (ephemeral key)'}
      </div>
      <div className="mb-3" style={{ color: 'var(--colour-dim)', wordBreak: 'break-all' }}>
        {identity?.pubkey ? nip19.npubEncode(identity.pubkey) : 'none'}
      </div>

      {identity?.method === 'ephemeral' && (
        <div className="mb-3 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
          {!showNsec ? (
            <button
              onClick={() => setShowNsec(true)}
              className="cursor-pointer"
              style={{ color: 'var(--colour-item)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
            >
              Show Secret Key
            </button>
          ) : (
            <>
              <div className="mb-1" style={{ color: 'var(--colour-error)' }}>
                Save this key to keep your identity:
              </div>
              <div
                className="mb-2 p-1"
                style={{
                  color: 'var(--colour-highlight)',
                  wordBreak: 'break-all',
                  border: '1px solid var(--colour-dim)',
                  fontSize: '0.65rem',
                  userSelect: 'all',
                }}
              >
                {identity.getNsec()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const nsec = identity.getNsec();
                    if (nsec) navigator.clipboard.writeText(nsec);
                  }}
                  className="cursor-pointer"
                  style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                >
                  Copy
                </button>
                {!identity.backedUp && (
                  <button
                    onClick={() => identity.confirmBackup()}
                    className="cursor-pointer"
                    style={{ color: 'var(--colour-text)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                  >
                    I've saved it
                  </button>
                )}
                {identity.backedUp && (
                  <span style={{ color: 'var(--colour-text)', padding: '2px 0' }}>Backed up</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {identity?.method !== 'extension' && identity?.nip07Available && (
        <div className="mb-2">
          <button
            onClick={async () => {
              const res = await identity.loginExtension();
              if (!res.ok) setLoginError(res.error);
              else handleClose();
            }}
            className="cursor-pointer"
            style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
          >
            Use Nostr Extension
          </button>
        </div>
      )}

      {identity?.method !== 'nsec' && (
        <form
          className="mb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const nsec = e.target.elements.nsec.value.trim();
            const res = identity.login(nsec);
            if (!res.ok) setLoginError(res.error);
            else { handleClose(); e.target.reset(); }
          }}
        >
          <div className="mb-1" style={{ color: 'var(--colour-dim)' }}>Login with nsec:</div>
          <div className="flex gap-1">
            <input
              name="nsec"
              type="password"
              placeholder="nsec1..."
              className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
              style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
            />
            <button
              type="submit"
              className="cursor-pointer"
              style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
            >
              OK
            </button>
          </div>
        </form>
      )}

      {isLoggedIn && (
        <div className="mt-2">
          <button
            onClick={() => { identity.logout(); handleClose(); }}
            className="cursor-pointer"
            style={{ color: 'var(--colour-error)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
          >
            Logout
          </button>
        </div>
      )}

      {/* Extra content (e.g. state backup) */}
      {children}

      {loginError && (
        <div className="mt-2" style={{ color: 'var(--colour-error)' }}>
          {loginError}
        </div>
      )}
    </DOSPanel>
  );
}
