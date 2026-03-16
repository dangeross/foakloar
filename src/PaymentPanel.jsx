/**
 * PaymentPanel — DOS-style modal for Lightning invoice display + polling.
 *
 * Shows QR code, copyable invoice string, and polls verify endpoint
 * until paid or closed.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import { fetchPayMetadata, fetchInvoice, checkPaymentStatus, satsToMsats } from './payment.js';

const POLL_INTERVAL = 10000; // 10 seconds
const INVOICE_TIMEOUT = 120000; // 2 minutes

export default function PaymentPanel({ payment, onPaid, onClose }) {
  const [stage, setStage] = useState('loading'); // loading | invoice | paid | error
  const [invoice, setInvoice] = useState(null);
  const [verifyUrl, setVerifyUrl] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const qrPlaceholderRef = useRef(null);
  const [qrRect, setQrRect] = useState(null);

  const amount = parseInt(payment.amount, 10);
  const unit = payment.unit || 'sats';

  // Measure QR placeholder position to render clean overlay above scanlines
  useEffect(() => {
    if (!qrPlaceholderRef.current) return;
    const rect = qrPlaceholderRef.current.getBoundingClientRect();
    setQrRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [qrDataUrl]);

  // Generate invoice on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const meta = await fetchPayMetadata(payment.lnurl);
        const msats = satsToMsats(amount);

        if (msats < meta.minSendable || msats > meta.maxSendable) {
          setError(`Amount ${amount} ${unit} is outside allowed range.`);
          setStage('error');
          return;
        }

        const inv = await fetchInvoice(meta.callback, msats);
        if (cancelled) return;

        setInvoice(inv.pr);
        setVerifyUrl(inv.verify || null);

        // Generate QR code
        const dataUrl = await QRCode.toDataURL(inv.pr.toUpperCase(), {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (cancelled) return;

        setQrDataUrl(dataUrl);
        setStage('invoice');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Failed to generate invoice.');
        setStage('error');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [payment.lnurl, amount, unit]);

  // Poll verify endpoint when invoice is showing
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
        // Ignore poll errors — keep trying
      }
    }

    pollRef.current = setInterval(poll, POLL_INTERVAL);

    // Timeout — offer to refresh
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

  // Fire onPaid when payment confirmed
  useEffect(() => {
    if (stage === 'paid') {
      onPaid();
    }
  }, [stage, onPaid]);

  const copyInvoice = useCallback(() => {
    if (invoice) {
      navigator.clipboard.writeText(invoice).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [invoice]);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 font-mono text-xs"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--colour-bg)',
          color: 'var(--colour-text)',
          border: '2px solid var(--colour-dim)',
          boxShadow: '4px 4px 0 var(--colour-dim)',
          padding: 0,
          minWidth: '20em',
          maxWidth: '90vw',
        }}
      >
        {/* Title bar */}
        <div
          className="flex justify-between px-2 py-1"
          style={{ backgroundColor: 'var(--colour-dim)', color: 'var(--colour-bg)' }}
        >
          <span>PAYMENT — {amount} {unit}</span>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{ background: 'none', border: 'none', font: 'inherit', color: 'var(--colour-bg)', padding: 0 }}
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col items-center">
          {stage === 'loading' && (
            <div style={{ color: 'var(--colour-dim)' }}>Generating invoice...</div>
          )}

          {stage === 'invoice' && (
            <>
              {payment.description && (
                <div className="mb-2 text-center" style={{ color: 'var(--colour-text)' }}>
                  {payment.description}
                </div>
              )}

              {/* Placeholder reserves space; real QR renders above scanlines via portal */}
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
                  maxWidth: '100%',
                  wordBreak: 'break-all',
                }}
              >
                {copied ? 'Copied!' : 'Copy Invoice'}
              </button>

              <div className="mt-1" style={{ color: 'var(--colour-dim)' }}>
                Waiting for payment...
              </div>

              {!verifyUrl && (
                <div className="mt-1" style={{ color: 'var(--colour-error)' }}>
                  No verify endpoint — close after paying.
                </div>
              )}
            </>
          )}

          {stage === 'paid' && (
            <div className="py-4 text-center">
              <div className="font-bold mb-2" style={{ color: 'var(--colour-highlight)' }}>
                Payment received!
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
                Continue
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div className="py-2 text-center">
              <div style={{ color: 'var(--colour-error)' }}>{error}</div>
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
        </div>
      </div>

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
