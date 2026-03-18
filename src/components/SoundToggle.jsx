/**
 * SoundToggle — Mute/unmute button for the sound system.
 * First click initialises WebAudio (browser autoplay policy).
 */

import React, { useState, useCallback } from 'react';
import { initAudio, isAudioReady, isMuted, toggleMute } from '../services/sound.js';

export default function SoundToggle({ onAudioReady }) {
  const [muted, setMuted] = useState(isMuted());
  const [ready, setReady] = useState(isAudioReady());

  const handleClick = useCallback(async () => {
    if (!ready) {
      const ok = await initAudio();
      if (ok) {
        setReady(true);
        setMuted(isMuted());
        onAudioReady?.();
      }
      return;
    }
    const newMuted = toggleMute();
    setMuted(newMuted);
    if (!newMuted) onAudioReady?.();
  }, [ready, onAudioReady]);

  return (
    <button
      onClick={handleClick}
      className="cursor-pointer hover:opacity-80"
      style={{
        color: muted || !ready ? 'var(--colour-dim)' : 'var(--colour-text)',
        background: 'none',
        border: 'none',
        font: 'inherit',
        padding: '0 4px',
        fontSize: '0.8rem',
      }}
      title={!ready ? 'Click to enable sound' : muted ? 'Unmute' : 'Mute'}
    >
      {muted || !ready ? '♪' : '♫'}
    </button>
  );
}
