/**
 * useStateBackup — NIP-44 encrypted player state backup to relay.
 *
 * Publishes player state as a kind 30078 replaceable event encrypted
 * to the player's own pubkey. Only the player can decrypt it.
 *
 * Event shape:
 *   kind: 30078
 *   tags: [["d", "<world>:player-state:<pubkey>"], ["t", "<world>"], ["type", "player-state"]]
 *   content: NIP-44 encrypted JSON blob
 */

import { useState, useCallback } from 'react';

/**
 * @param {{
 *   worldTag: string,
 *   signer: { signEvent, encrypt?, decrypt?, pubkey } | null,
 *   relay: { current: Relay | null },
 *   playerState: object,
 *   npcStates: object,
 *   replaceState: (playerState, npcStates) => void,
 * }} opts
 */
export function useStateBackup({ worldTag, signer, relay, playerState, npcStates, replaceState }) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState('');

  const canBackup = !!(signer?.encrypt && signer?.decrypt && signer?.pubkey);

  /**
   * Serialise current state, encrypt with NIP-44, and publish to relay.
   */
  const saveToRelay = useCallback(async () => {
    if (!canBackup) {
      setError('Encryption not available.');
      return { ok: false };
    }
    const r = relay.current;
    if (!r) {
      setError('Not connected to relay.');
      return { ok: false };
    }

    setSaving(true);
    setError('');

    try {
      // Build state blob
      const blob = {
        world: worldTag,
        player: playerState,
        npcStates: npcStates,
        savedAt: Math.floor(Date.now() / 1000),
      };

      const plaintext = JSON.stringify(blob);
      const ciphertext = await signer.encrypt(plaintext);

      const eventTemplate = {
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `${worldTag}:player-state:${signer.pubkey}`],
          ['t', worldTag],
          ['type', 'player-state'],
        ],
        content: ciphertext,
      };

      const signed = await signer.signEvent(eventTemplate);
      await r.publish(signed);

      setLastSaved(new Date());
      setSaving(false);
      return { ok: true };
    } catch (err) {
      setError(err.message || 'Failed to save.');
      setSaving(false);
      return { ok: false, error: err.message };
    }
  }, [canBackup, relay, signer, playerState, npcStates]);

  /**
   * Fetch player-state event from relay, decrypt, and restore.
   */
  const loadFromRelay = useCallback(async () => {
    if (!canBackup) {
      setError('Encryption not available.');
      return { ok: false };
    }
    const r = relay.current;
    if (!r) {
      setError('Not connected to relay.');
      return { ok: false };
    }

    setLoading(true);
    setError('');

    try {
      const dTag = `${worldTag}:player-state:${signer.pubkey}`;

      // Fetch the player-state event
      const event = await new Promise((resolve, reject) => {
        let found = null;
        const sub = r.subscribe(
          [{ kinds: [30078], authors: [signer.pubkey], '#d': [dTag] }],
          {
            onevent(ev) {
              // Keep the most recent
              if (!found || ev.created_at > found.created_at) {
                found = ev;
              }
            },
            oneose() {
              sub.close();
              resolve(found);
            },
          }
        );
        // Timeout after 10 seconds
        setTimeout(() => { sub.close(); reject(new Error('Timeout fetching state.')); }, 10000);
      });

      if (!event) {
        setError('No saved state found on relay.');
        setLoading(false);
        return { ok: false };
      }

      // Decrypt
      const plaintext = await signer.decrypt(event.content);
      const blob = JSON.parse(plaintext);

      if (blob.world !== worldTag) {
        setError('State is for a different world.');
        setLoading(false);
        return { ok: false };
      }

      // Restore
      replaceState(blob.player, blob.npcStates || {});

      setLoading(false);
      return { ok: true, savedAt: blob.savedAt };
    } catch (err) {
      setError(err.message || 'Failed to load.');
      setLoading(false);
      return { ok: false, error: err.message };
    }
  }, [canBackup, relay, signer, replaceState]);

  return {
    canBackup,
    saving,
    loading,
    lastSaved,
    error,
    saveToRelay,
    loadFromRelay,
  };
}
