/**
 * Nip44Preview — Decrypt preview for NIP-44 sealed content in the builder.
 *
 * Shows when an event has content-type: application/nip44. Lets the author
 * pick a puzzle from a dropdown (or use an existing puzzle tag), enter the
 * answer, and decrypt the content to verify encryption is correct.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { derivePuzzleKeypair, decryptNip44 } from '../../engine/nip44-client.js';
import { loadAnswers, PUBKEY_PLACEHOLDER } from '../draftStore.js';

function extractDTag(aTagRef) {
  const parts = aTagRef?.split(':');
  return parts?.length >= 3 ? parts.slice(2).join(':') : aTagRef;
}

function looksEncrypted(content) {
  if (!content || content.length < 32) return false;
  return /^[A-Za-z0-9+/=\n]+$/.test(content.trim());
}

export default function Nip44Preview({ content, tags, events, worldSlug, pubkey }) {
  // Puzzle ref from the event's puzzle tag (if present)
  const puzzleTagRef = tags.find((t) => t[0] === 'puzzle')?.[1];

  // Build list of available puzzle events from the world
  const puzzleOptions = useMemo(() => {
    if (!events) return [];
    const opts = [];
    for (const [ref, ev] of events) {
      const type = ev.tags?.find((t) => t[0] === 'type')?.[1];
      if (type !== 'puzzle') continue;
      const title = ev.tags?.find((t) => t[0] === 'title')?.[1] || extractDTag(ref);
      const salt = ev.tags?.find((t) => t[0] === 'salt')?.[1];
      if (!salt) continue; // need salt for decryption
      opts.push({ ref, title, salt, pubkey: ev.pubkey });
    }
    return opts;
  }, [events]);

  // Selected puzzle — default to the puzzle tag ref, or first available
  const initialRef = puzzleTagRef
    ? puzzleTagRef.replaceAll(PUBKEY_PLACEHOLDER, pubkey)
    : puzzleOptions[0]?.ref || '';
  const [selectedPuzzleRef, setSelectedPuzzleRef] = useState(initialRef);

  const selectedPuzzle = puzzleOptions.find((p) => p.ref === selectedPuzzleRef);
  const puzzleDTag = selectedPuzzleRef ? extractDTag(selectedPuzzleRef) : null;

  // Auto-fill answer from store
  const storedAnswers = worldSlug ? loadAnswers(worldSlug) : {};
  const storedAnswer = puzzleDTag
    ? storedAnswers[puzzleDTag] || storedAnswers[extractDTag(puzzleTagRef)] || ''
    : '';

  const [answer, setAnswer] = useState(storedAnswer);
  const [result, setResult] = useState(null);

  // Update answer when puzzle selection changes
  useEffect(() => {
    if (!puzzleDTag) return;
    const stored = storedAnswers[puzzleDTag] || '';
    setAnswer(stored);
    setResult(null);
  }, [selectedPuzzleRef]);

  // Reset result when content changes
  useEffect(() => setResult(null), [content]);

  if (puzzleOptions.length === 0) {
    return (
      <div style={{ color: 'var(--colour-dim)', fontSize: '0.55rem', marginTop: 4 }}>
        No puzzle events with salt found — cannot decrypt preview.
      </div>
    );
  }

  const isEncrypted = looksEncrypted(content);

  async function handleDecrypt() {
    if (!content) {
      setResult({ error: 'No content to decrypt.' });
      return;
    }
    if (!isEncrypted) {
      setResult({ error: 'Content appears to be plaintext — it will be encrypted at publish time.' });
      return;
    }
    if (!answer.trim()) {
      setResult({ error: 'Enter the puzzle answer.' });
      return;
    }
    if (!selectedPuzzle) {
      setResult({ error: 'Select a puzzle.' });
      return;
    }

    try {
      const { privKeyHex } = await derivePuzzleKeypair(answer.trim(), selectedPuzzle.salt);
      const authorPk = selectedPuzzle.pubkey || pubkey;
      const plaintext = decryptNip44(content, privKeyHex, authorPk);
      setResult({ text: plaintext });
    } catch (e) {
      setResult({ error: 'Wrong answer.' });
    }
  }

  const dimStyle = { color: 'var(--colour-dim)', fontSize: '0.55rem' };
  const selectStyle = {
    color: 'var(--colour-text)',
    background: 'var(--colour-bg)',
    border: '1px solid var(--colour-dim)',
    font: 'inherit',
    fontSize: '0.55rem',
    padding: '2px 4px',
    width: '100%',
  };
  const inputStyle = {
    ...selectStyle,
    color: 'var(--colour-text)',
    fontSize: '0.6rem',
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ ...dimStyle, marginBottom: 2 }}>
        NIP-44 decrypt preview {isEncrypted ? '(encrypted)' : '(plaintext — will encrypt on publish)'}
      </div>
      {/* Puzzle selector */}
      <select
        value={selectedPuzzleRef}
        onChange={(e) => setSelectedPuzzleRef(e.target.value)}
        style={{ ...selectStyle, marginBottom: 4 }}
      >
        {puzzleOptions.map((p) => (
          <option key={p.ref} value={p.ref}>{p.title}</option>
        ))}
      </select>
      {/* Answer + decrypt */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); setResult(null); }}
          placeholder="Puzzle answer..."
          style={inputStyle}
        />
        <button
          onClick={handleDecrypt}
          disabled={!isEncrypted}
          style={{
            color: isEncrypted ? 'var(--colour-highlight)' : 'var(--colour-dim)',
            background: 'none',
            border: 'none',
            font: 'inherit',
            fontSize: '0.55rem',
            cursor: isEncrypted ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }}
        >
          [decrypt]
        </button>
      </div>
      {/* Result */}
      {result && (
        <div style={{
          marginTop: 4,
          padding: '4px 6px',
          border: '1px solid var(--colour-dim)',
          fontSize: '0.55rem',
          maxHeight: '8em',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          color: result.error ? 'var(--colour-error)' : 'var(--colour-text)',
        }}>
          {result.error || result.text}
        </div>
      )}
    </div>
  );
}
