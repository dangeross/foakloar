/**
 * useSigner — React hook for player identity (Nostr keypair).
 *
 * Three-tier cascade:
 *   1. NIP-07 browser extension (window.nostr) — keys never leave extension
 *   2. User-provided nsec — decoded and held in memory
 *   3. Auto-generated ephemeral key — persisted in localStorage
 *
 * All three produce a Signer-compatible object { getPublicKey(), signEvent() }.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { decode as nip19Decode } from 'nostr-tools/nip19';

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const EPHEMERAL_KEY = 'nostr-ephemeral-key';

/**
 * Detect NIP-07 extension (window.nostr).
 * Extensions inject at document_end, so we poll briefly on mount.
 */
function useNip07Detection() {
  const [available, setAvailable] = useState(!!window.nostr);

  useEffect(() => {
    if (window.nostr) { setAvailable(true); return; }
    // Poll for a short period — some extensions inject slightly late
    let tries = 0;
    const interval = setInterval(() => {
      if (window.nostr) { setAvailable(true); clearInterval(interval); }
      if (++tries >= 10) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return available;
}

/**
 * Create a signer from a raw secret key (Uint8Array).
 */
function makeKeySigner(secretKey) {
  const pubkey = getPublicKey(secretKey);
  return {
    getPublicKey: async () => pubkey,
    signEvent: async (event) => finalizeEvent(event, secretKey),
    pubkey,
  };
}

/**
 * Load or generate the ephemeral key from localStorage.
 */
function getOrCreateEphemeralKey() {
  const stored = localStorage.getItem(EPHEMERAL_KEY);
  if (stored) {
    try {
      return hexToBytes(stored);
    } catch {
      // Corrupt — regenerate
    }
  }
  const sk = generateSecretKey();
  localStorage.setItem(EPHEMERAL_KEY, bytesToHex(sk));
  return sk;
}

/**
 * @returns {{
 *   signer: { getPublicKey(): Promise<string>, signEvent(event): Promise<VerifiedEvent> } | null,
 *   pubkey: string | null,
 *   method: 'extension' | 'nsec' | 'ephemeral',
 *   login: (nsec: string) => { ok: boolean, error?: string },
 *   loginExtension: () => Promise<{ ok: boolean, error?: string }>,
 *   logout: () => void,
 *   nip07Available: boolean,
 * }}
 */
export function useSigner() {
  const nip07Available = useNip07Detection();

  // method: 'extension' | 'nsec' | 'ephemeral'
  const [method, setMethod] = useState('ephemeral');
  const [pubkey, setPubkey] = useState(null);
  const signerRef = useRef(null);

  // Initialise ephemeral signer on mount
  useEffect(() => {
    // Check if we had a previous session method
    const savedMethod = localStorage.getItem('nostr-auth-method');

    if (savedMethod === 'extension' && window.nostr) {
      // Re-connect to extension
      window.nostr.getPublicKey().then((pk) => {
        signerRef.current = {
          getPublicKey: () => window.nostr.getPublicKey(),
          signEvent: (ev) => window.nostr.signEvent(ev),
          nip44: window.nostr.nip44 || null,
          pubkey: pk,
        };
        setPubkey(pk);
        setMethod('extension');
      }).catch(() => {
        // Extension refused — fall back to ephemeral
        initEphemeral();
      });
      return;
    }

    if (savedMethod === 'nsec') {
      const storedNsec = sessionStorage.getItem('nostr-nsec');
      if (storedNsec) {
        try {
          const { type, data } = nip19Decode(storedNsec);
          if (type === 'nsec') {
            const signer = makeKeySigner(data);
            signerRef.current = signer;
            setPubkey(signer.pubkey);
            setMethod('nsec');
            return;
          }
        } catch {
          // Invalid — fall through
        }
      }
    }

    initEphemeral();
  }, []);

  function initEphemeral() {
    const sk = getOrCreateEphemeralKey();
    const signer = makeKeySigner(sk);
    signerRef.current = signer;
    setPubkey(signer.pubkey);
    setMethod('ephemeral');
    localStorage.setItem('nostr-auth-method', 'ephemeral');
  }

  /**
   * Login with an nsec string.
   */
  const login = useCallback((nsec) => {
    try {
      const { type, data } = nip19Decode(nsec);
      if (type !== 'nsec') {
        return { ok: false, error: 'Not a valid nsec key.' };
      }
      const signer = makeKeySigner(data);
      signerRef.current = signer;
      setPubkey(signer.pubkey);
      setMethod('nsec');
      localStorage.setItem('nostr-auth-method', 'nsec');
      // Store in sessionStorage (cleared when tab closes)
      sessionStorage.setItem('nostr-nsec', nsec);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Invalid nsec format.' };
    }
  }, []);

  /**
   * Login with NIP-07 extension.
   */
  const loginExtension = useCallback(async () => {
    if (!window.nostr) {
      return { ok: false, error: 'No Nostr extension found.' };
    }
    try {
      const pk = await window.nostr.getPublicKey();
      signerRef.current = {
        getPublicKey: () => window.nostr.getPublicKey(),
        signEvent: (ev) => window.nostr.signEvent(ev),
        nip44: window.nostr.nip44 || null,
        pubkey: pk,
      };
      setPubkey(pk);
      setMethod('extension');
      localStorage.setItem('nostr-auth-method', 'extension');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Extension refused.' };
    }
  }, []);

  /**
   * Logout — revert to ephemeral key.
   */
  const logout = useCallback(() => {
    sessionStorage.removeItem('nostr-nsec');
    localStorage.setItem('nostr-auth-method', 'ephemeral');
    initEphemeral();
  }, []);

  return {
    signer: signerRef.current,
    pubkey,
    method,
    login,
    loginExtension,
    logout,
    nip07Available,
  };
}
