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
import { decode as nip19Decode, nsecEncode } from 'nostr-tools/nip19';
import * as nip44 from 'nostr-tools/nip44';

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
  const conversationKey = nip44.v2.utils.getConversationKey(secretKey, pubkey);
  return {
    getPublicKey: async () => pubkey,
    signEvent: async (event) => finalizeEvent(event, secretKey),
    encrypt: async (plaintext) => nip44.v2.encrypt(plaintext, conversationKey),
    decrypt: async (ciphertext) => nip44.v2.decrypt(ciphertext, conversationKey),
    /** Encrypt to an arbitrary pubkey (e.g. derived puzzle key) */
    encryptTo: async (targetPubkey, plaintext) => {
      const ck = nip44.v2.utils.getConversationKey(secretKey, targetPubkey);
      return nip44.v2.encrypt(plaintext, ck);
    },
    pubkey,
  };
}

/**
 * Create a signer backed by a NIP-07 browser extension.
 */
function makeExtensionSigner(pk) {
  const nip44Ext = window.nostr?.nip44 || null;
  return {
    getPublicKey: () => window.nostr.getPublicKey(),
    signEvent: (ev) => window.nostr.signEvent(ev),
    encrypt: nip44Ext
      ? async (plaintext) => nip44Ext.encrypt(pk, plaintext)
      : null,
    decrypt: nip44Ext
      ? async (ciphertext) => nip44Ext.decrypt(pk, ciphertext)
      : null,
    /** Encrypt to an arbitrary pubkey (e.g. derived puzzle key) */
    encryptTo: nip44Ext
      ? async (targetPubkey, plaintext) => nip44Ext.encrypt(targetPubkey, plaintext)
      : null,
    pubkey: pk,
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
  const [backedUp, setBackedUp] = useState(
    () => localStorage.getItem('nostr-ephemeral-backed-up') === 'true'
  );
  const signerRef = useRef(null);

  const savedMethodRef = useRef(localStorage.getItem('nostr-auth-method'));

  // Initialise signer — re-runs when nip07Available changes
  useEffect(() => {
    const savedMethod = savedMethodRef.current;

    // For extension: wait until NIP-07 detection resolves
    if (savedMethod === 'extension') {
      if (window.nostr) {
        window.nostr.getPublicKey().then((pk) => {
          signerRef.current = makeExtensionSigner(pk);
          setPubkey(pk);
          setMethod('extension');
        }).catch(() => {
          // Extension refused — permanently fall back
          savedMethodRef.current = 'ephemeral';
          initEphemeral();
        });
        return;
      }
      // Extension not yet injected — use ephemeral signer temporarily
      // but preserve savedMethodRef so re-run will try extension again
      if (!signerRef.current) {
        const sk = getOrCreateEphemeralKey();
        signerRef.current = makeKeySigner(sk);
        setPubkey(signerRef.current.pubkey);
      }
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

    if (!signerRef.current) initEphemeral();
  }, [nip07Available]);

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
      signerRef.current = makeExtensionSigner(pk);
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

  /**
   * Get the ephemeral key as an nsec string (for export/upgrade).
   * Only works when method is 'ephemeral'.
   */
  const getNsec = useCallback(() => {
    if (method !== 'ephemeral') return null;
    const hex = localStorage.getItem(EPHEMERAL_KEY);
    if (!hex) return null;
    try {
      return nsecEncode(hexToBytes(hex));
    } catch {
      return null;
    }
  }, [method]);

  /**
   * Mark the ephemeral key as backed up (user has saved the nsec).
   * Promotes it to a "proper" identity for build mode.
   */
  const confirmBackup = useCallback(() => {
    localStorage.setItem('nostr-ephemeral-backed-up', 'true');
    setBackedUp(true);
  }, []);

  // A "proper" identity can publish events (build mode).
  // Extension and nsec are always proper. Ephemeral is proper only if backed up.
  const isProperIdentity = method === 'extension' || method === 'nsec' || backedUp;

  return {
    signer: signerRef.current,
    pubkey,
    method,
    login,
    loginExtension,
    logout,
    getNsec,
    confirmBackup,
    backedUp,
    isProperIdentity,
    nip07Available,
  };
}
