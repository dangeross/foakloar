/**
 * TipPanel — DOS-style modal for tipping via Lightning (lud16).
 *
 * Resolves a Lightning address → LNURL-pay, lets user pick an amount,
 * generates an invoice, and shows a QR code for scanning.
 *
 * Supports NIP-57 zaps: if the LNURL provider allows Nostr and a signer
 * is available, builds and signs a kind:9734 zap request event.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import DOSPanel from './ui/DOSPanel.jsx';
import { fetchPayMetadata, fetchInvoice, checkPaymentStatus, satsToMsats } from '../services/payment.js';
import { useProfile } from '../hooks/useProfile.js';
import { RELAY_URLS } from '../config.js';

const POLL_INTERVAL = 10000;
const INVOICE_TIMEOUT = 120000;
const PRESET_AMOUNTS = [1, 10, 100, 1000];

/**
 * Build a NIP-57 zap request event (kind:9734).
 */
async function buildZapRequest({ signer, recipientPubkey, amountMsats, relays, eventId, comment }) {
  const tags = [
    ['p', recipientPubkey],
    ['amount', String(amountMsats)],
    ['relays', ...relays],
  ];
  if (eventId) tags.push(['e', eventId]);

  const event = {
    kind: 9734,
    created_at: Math.floor(Date.now() / 1000),
    content: comment || '',
    tags,
  };
  return await signer.signEvent(event);
}

export default function TipPanel({ lud16: lud16Prop, recipientName, recipientPubkey, signer, senderPubkey, eventId, onClose }) {
  // If no lud16 provided, resolve it from the recipient's kind:0 profile
  const { profile: resolvedProfile, status: profileStatus } = useProfile(lud16Prop ? null : recipientPubkey);
  const lud16 = lud16Prop || resolvedProfile?.lud16;
  const displayName = recipientName || resolvedProfile?.displayName || resolvedProfile?.name || '';

  const [stage, setStage] = useState('amount'); // amount | loading | invoice | paid | error | no-address
  const [meta, setMeta] = useState(null);
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [verifyUrl, setVerifyUrl] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isZap, setIsZap] = useState(false);
  const [comment, setComment] = useState('');
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const qrPlaceholderRef = useRef(null);
  const [qrRect, setQrRect] = useState(null);

  // Fetch LNURL-pay metadata when lud16 is available
  useEffect(() => {
    if (!lud16) return;
    let cancelled = false;
    async function init() {
      try {
        const m = await fetchPayMetadata(lud16);
        if (!cancelled) setMeta(m);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to resolve Lightning address.');
          setStage('error');
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [lud16]);

  // If profile resolved but has no lud16 (or no profile found), show message
  useEffect(() => {
    if (!lud16Prop && (profileStatus === 'empty' || profileStatus === 'failed' ||
        (profileStatus === 'ready' && !resolvedProfile?.lud16))) {
      setStage('no-address');
    }
  }, [lud16Prop, profileStatus, resolvedProfile]);

  // Measure QR placeholder
  useEffect(() => {
    if (!qrPlaceholderRef.current) return;
    const rect = qrPlaceholderRef.current.getBoundingClientRect();
    setQrRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [qrDataUrl]);

  // Can we zap? Need: allowsNostr on provider, signer available, recipient pubkey
  const canZap = meta?.allowsNostr && meta?.nostrPubkey && signer && recipientPubkey;

  // Generate invoice (with optional zap request)
  const requestInvoice = useCallback(async (sats) => {
    if (!meta) return;
    setStage('loading');
    try {
      const msats = satsToMsats(sats);
      if (msats < meta.minSendable || msats > meta.maxSendable) {
        setError(`Amount must be between ${Math.ceil(meta.minSendable / 1000)} and ${Math.floor(meta.maxSendable / 1000)} sats.`);
        setStage('error');
        return;
      }

      const invoiceOptions = {};

      // Build NIP-57 zap request if supported
      if (canZap) {
        try {
          const zapRequest = await buildZapRequest({
            signer,
            recipientPubkey,
            amountMsats: msats,
            relays: RELAY_URLS,
            eventId,
            comment,
          });
          invoiceOptions.nostr = JSON.stringify(zapRequest);
          setIsZap(true);
        } catch (err) {
          console.warn('Zap request signing failed, falling back to regular tip:', err.message);
          setIsZap(false);
        }
      }

      const inv = await fetchInvoice(meta.callback, msats, invoiceOptions);
      setInvoice(inv.pr);
      setVerifyUrl(inv.verify || null);

      const dataUrl = await QRCode.toDataURL(inv.pr.toUpperCase(), {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setStage('invoice');
    } catch (err) {
      setError(err.message || 'Failed to generate invoice.');
      setStage('error');
    }
  }, [meta, canZap, signer, recipientPubkey, eventId, comment]);

  // Poll verify endpoint
  useEffect(() => {
    if (stage !== 'invoice' || !verifyUrl) return;

    async function poll() {
      try {
        const result = await checkPaymentStatus(verifyUrl);
        if (result.settled) {
          setQrDataUrl(null);
          setStage('paid');
          clearInterval(pollRef.current);
          clearTimeout(timeoutRef.current);
        }
      } catch {
        // Ignore poll errors
      }
    }

    pollRef.current = setInterval(poll, POLL_INTERVAL);
    timeoutRef.current = setTimeout(() => {
      clearInterval(pollRef.current);
      setQrDataUrl(null);
      setStage('error');
      setError('Invoice expired. Close and try again.');
    }, INVOICE_TIMEOUT);

    return () => {
      clearInterval(pollRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [stage, verifyUrl]);

  const copyInvoice = useCallback(() => {
    if (invoice) {
      navigator.clipboard.writeText(invoice).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [invoice]);

  const minSats = meta ? Math.ceil(meta.minSendable / 1000) : 1;
  const maxSats = meta ? Math.floor(meta.maxSendable / 1000) : 1000000;

  return (
    <>
      <DOSPanel title={`${isZap ? 'ZAP' : 'TIP'} — ${displayName || lud16 || 'loading...'}`} onClose={onClose} helpUrl="/guide/lightning">
        {/* No Lightning address */}
        {stage === 'no-address' && (
          <div className="py-2 text-center">
            <div style={{ color: 'var(--colour-dim)' }}>
              This author has no Lightning address.
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer mt-2 px-2 py-1"
              style={{
                color: 'var(--colour-dim)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Amount selection */}
        {stage === 'amount' && (
          <>
            {lud16 && (
              <div className="mb-2" style={{ color: 'var(--colour-dim)' }}>
                {lud16}
                {canZap && (
                  <span style={{ color: 'var(--colour-highlight)' }}> [zap]</span>
                )}
              </div>
            )}
            {!meta ? (
              <div style={{ color: 'var(--colour-dim)' }}>Resolving...</div>
            ) : (
              <>
                {canZap && (
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="comment (optional)"
                    className="w-full bg-transparent outline-none font-mono text-xs px-1 mb-2"
                    style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
                    maxLength={280}
                  />
                )}
                <div className="flex gap-1 mb-2">
                  {PRESET_AMOUNTS.filter((a) => a >= minSats && a <= maxSats).map((a) => (
                    <button
                      key={a}
                      onClick={() => requestInvoice(a)}
                      className="cursor-pointer text-center flex-1"
                      style={{
                        color: 'var(--colour-highlight)',
                        background: 'none',
                        border: '1px solid var(--colour-dim)',
                        font: 'inherit',
                        padding: '2px 4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a} sats
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const sats = parseInt(amount, 10);
                    if (sats >= minSats && sats <= maxSats) requestInvoice(sats);
                  }}
                  className="flex gap-1 items-center"
                >
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder={`${minSats}–${maxSats}`}
                    className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
                    style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)', minWidth: 0 }}
                  />
                  <span style={{ color: 'var(--colour-dim)' }}>sats</span>
                  <button
                    type="submit"
                    disabled={!amount || parseInt(amount, 10) < minSats || parseInt(amount, 10) > maxSats}
                    className="cursor-pointer"
                    style={{
                      color: amount ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                      background: 'none',
                      border: '1px solid var(--colour-dim)',
                      font: 'inherit',
                      padding: '2px 8px',
                    }}
                  >
                    Go
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* Loading */}
        {stage === 'loading' && (
          <div style={{ color: 'var(--colour-dim)' }}>
            {canZap ? 'Signing zap request...' : 'Generating invoice...'}
          </div>
        )}

        {/* Invoice QR */}
        {stage === 'invoice' && (
          <div className="flex flex-col items-center">
            <div
              ref={qrPlaceholderRef}
              className="mb-2"
              style={{ width: 200, height: 200 }}
            />

            <button
              onClick={copyInvoice}
              className="cursor-pointer mb-2 px-2 py-1"
              style={{
                color: 'var(--colour-highlight)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
              }}
            >
              {copied ? 'Copied!' : 'Copy Invoice'}
            </button>

            <div style={{ color: 'var(--colour-dim)' }}>
              Waiting for payment...
            </div>

            {!verifyUrl && (
              <div className="mt-1" style={{ color: 'var(--colour-error)' }}>
                No verify endpoint — close after paying.
              </div>
            )}
          </div>
        )}

        {/* Paid */}
        {stage === 'paid' && (
          <div className="py-4 text-center">
            <div className="font-bold mb-2" style={{ color: 'var(--colour-highlight)' }}>
              {isZap ? 'Zap sent!' : 'Tip sent!'}
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer px-2 py-1"
              style={{
                color: 'var(--colour-highlight)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="py-2 text-center">
            <div style={{ color: 'var(--colour-error)' }}>{error}</div>
            <button
              onClick={() => { setError(''); setStage('amount'); setIsZap(false); }}
              className="cursor-pointer mt-2 px-2 py-1"
              style={{
                color: 'var(--colour-dim)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
              }}
            >
              Back
            </button>
          </div>
        )}
      </DOSPanel>

      {/* QR rendered above CRT scanlines via portal */}
      {qrDataUrl && qrRect && ReactDOM.createPortal(
        <img
          src={qrDataUrl}
          alt="Lightning Invoice QR"
          style={{
            position: 'fixed',
            top: qrRect.top,
            left: qrRect.left,
            width: qrRect.width,
            height: qrRect.height,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        />,
        document.body
      )}
    </>
  );
}
