import React, { useState, useRef, useEffect } from 'react';
import { useRelay } from './useRelay.js';
import { usePlayerState } from './usePlayerState.js';
import { GENESIS_PLACE } from './config.js';
import {
  getTag, getTags, resolveExits, checkRequires,
  findByNoun, dtagFromRef,
} from './world.js';
import { AUTHOR_PUBKEY } from './config.js';
import { decryptNip44, derivePrivateKey } from './nip44-client.js';

export default function App() {
  const { events, status } = useRelay();
  const player = usePlayerState();
  const [currentPlace, setCurrentPlace] = useState(GENESIS_PLACE);
  const [log, setLog] = useState([]);
  const [puzzleActive, setPuzzleActive] = useState(null);
  const inputRef = useRef(null);
  const logEndRef = useRef(null);

  const place = events.get(currentPlace);
  const exits = status === 'ready' ? resolveExits(events, currentPlace) : [];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentPlace, status, puzzleActive]);

  function append(text, type = 'narrative') {
    setLog((prev) => [...prev, { text, type }]);
  }

  async function enterRoom(dtag) {
    const room = events.get(dtag);
    if (!room) { append("You can't go that way.", 'error'); return; }
    setCurrentPlace(dtag);
    setPuzzleActive(null);

    const title = getTag(room, 'title') || dtag;
    append(`\n— ${title} —`, 'title');

    // NIP-44 encrypted content
    const contentType = getTag(room, 'content-type');
    if (contentType === 'application/nip44') {
      let decrypted = null;
      for (const privKey of player.state.cryptoKeys) {
        try {
          decrypted = decryptNip44(room.content, privKey, room.pubkey);
          break;
        } catch {}
      }
      if (decrypted) {
        append(decrypted, 'win');
      } else {
        append('The air hums with sealed energy. You lack the key to read what is written here.', 'sealed');
      }
    } else {
      append(room.content, 'narrative');
    }

    // Items (skip picked-up)
    for (const ref of getTags(room, 'item')) {
      const itemDTag = dtagFromRef(ref[1]);
      if (player.hasItem(itemDTag)) continue;
      const item = events.get(itemDTag);
      if (item) append(`You see: ${getTag(item, 'title')}`, 'item');
    }

    // Features
    for (const ref of getTags(room, 'feature')) {
      const fDTag = dtagFromRef(ref[1]);
      const feature = events.get(fDTag);
      if (feature) append(`There is a ${getTag(feature, 'title')} here.`, 'feature');
    }

    // Exits
    const roomExits = resolveExits(events, dtag);
    if (roomExits.length > 0) {
      append(`Exits: ${roomExits.map((e) => e.slot).join(', ')}`, 'exits');
    }
  }

  function handleExamine(noun) {
    if (!place) return;
    const match = findByNoun(events, place, noun);
    if (!match) { append("You don't see that here.", 'error'); return; }

    const { event, dtag } = match;
    const desc = getTag(event, 'description');
    if (desc) append(desc, 'narrative');

    // Process on-interact examine tags
    for (const tag of getTags(event, 'on-interact')) {
      if (tag[1] !== 'examine') continue;
      const action = tag[2];
      const targetState = tag[3];
      const targetRef = tag[4];

      if (action === 'set-state' && targetState === 'visible' && targetRef) {
        const targetDTag = dtagFromRef(targetRef);
        const targetEvent = events.get(targetDTag);
        if (!targetEvent) continue;

        const targetType = getTag(targetEvent, 'type');
        if (targetType === 'clue') {
          player.markClueSeen(targetDTag);
          append(`\n${getTag(targetEvent, 'title')}:`, 'clue-title');
          append(targetEvent.content, 'clue');
        } else if (targetType === 'puzzle') {
          if (player.isPuzzleSolved(targetDTag)) {
            append('You have already solved this.', 'narrative');
          } else {
            append(`\nA riddle appears:`, 'puzzle-title');
            append(targetEvent.content, 'puzzle');
            append('Type your answer...', 'hint');
            setPuzzleActive(targetDTag);
          }
        }
      }
    }
  }

  function handlePickup(noun) {
    if (!place) return;
    const match = findByNoun(events, place, noun);
    if (!match) { append("You don't see that here.", 'error'); return; }
    if (match.type !== 'item') { append("You can't pick that up.", 'error'); return; }
    if (player.hasItem(match.dtag)) { append('You already have that.', 'error'); return; }

    player.pickUp(match.dtag);
    append(`Taken: ${getTag(match.event, 'title')}`, 'item');
  }

  async function handlePuzzleAnswer(answer) {
    if (!puzzleActive) return;
    const puzzleEvent = events.get(puzzleActive);
    if (!puzzleEvent) return;

    const expectedHash = getTag(puzzleEvent, 'answer-hash');
    const salt = getTag(puzzleEvent, 'salt');

    const data = new TextEncoder().encode(answer.toLowerCase().trim() + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hashHex !== expectedHash) {
      append('That is not the answer.', 'error');
      return;
    }

    append('Correct!', 'success');
    player.markPuzzleSolved(puzzleActive);

    // Derive private key from the answer for NIP-44 decryption
    const derivedPrivKey = await derivePrivateKey(
      answer.toLowerCase().trim(),
      salt
    );

    for (const tag of getTags(puzzleEvent, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      if (action === 'set-flag') {
        player.setFlag(value);
        append('Something shifts in the distance...', 'narrative');
      } else if (action === 'give-crypto-key') {
        // Store the derived private key (not the public key from the tag)
        player.addCryptoKey(derivedPrivKey);
        append('You feel a key take shape in your mind.', 'narrative');
      }
    }

    setPuzzleActive(null);
  }

  function handleMove(direction) {
    const exit = exits.find((e) => e.slot === direction);
    if (!exit) { append("You can't go that way.", 'error'); return; }

    const req = checkRequires(exit.portalEvent, player.state.flags);
    if (!req.allowed) { append(req.reason, 'error'); return; }

    enterRoom(exit.destinationDTag);
  }

  function handleCommand(input) {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    append(`> ${input}`, 'command');

    // Puzzle mode — treat input as answer
    if (puzzleActive) { handlePuzzleAnswer(trimmed); return; }

    // Look
    if (trimmed === 'look' || trimmed === 'l') {
      if (place) enterRoom(currentPlace);
      return;
    }

    // Examine
    const examineMatch = trimmed.match(/^(?:examine|x|look at|inspect)\s+(.+)$/);
    if (examineMatch) { handleExamine(examineMatch[1]); return; }

    // Pick up / take
    const pickupMatch = trimmed.match(/^(?:pick up|take|get|grab)\s+(.+)$/);
    if (pickupMatch) { handlePickup(pickupMatch[1]); return; }

    // Inventory
    if (trimmed === 'inventory' || trimmed === 'i') {
      if (player.state.inventory.length === 0) {
        append('You are empty-handed.', 'narrative');
      } else {
        append('You are carrying:', 'narrative');
        for (const dtag of player.state.inventory) {
          const item = events.get(dtag);
          append(`  ${item ? getTag(item, 'title') : dtag}`, 'item');
        }
      }
      return;
    }

    // Movement — try as direction
    const goMatch = trimmed.match(/^(?:go\s+)?(.+)$/);
    if (goMatch) {
      const direction = goMatch[1];
      if (exits.find((e) => e.slot === direction)) {
        handleMove(direction);
        return;
      }
    }

    append("I don't understand that.", 'error');
  }

  function onSubmit(e) {
    e.preventDefault();
    const val = inputRef.current.value;
    inputRef.current.value = '';
    handleCommand(val);
  }

  // Initial room on ready
  useEffect(() => {
    if (status === 'ready' && place && log.length === 0) {
      enterRoom(currentPlace);
    }
  }, [status]);

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col h-screen">
      <div className="text-sm text-green-600 mb-2">
        Relay: {status} | Events: {events.size}
      </div>

      {status === 'connecting' && <p>Connecting to relay...</p>}
      {status === 'failed' && <p className="text-red-400">Failed to connect to any relay.</p>}

      <div className="flex-1 overflow-y-auto mb-4">
        {log.map((entry, i) => (
          <p
            key={i}
            className={
              entry.type === 'command' ? 'text-green-300 mt-2' :
              entry.type === 'title' ? 'text-green-200 font-bold mt-3' :
              entry.type === 'error' ? 'text-red-400' :
              entry.type === 'exits' ? 'text-green-600 text-sm mt-1' :
              entry.type === 'item' ? 'text-yellow-400 text-sm' :
              entry.type === 'feature' ? 'text-green-500 text-sm' :
              entry.type === 'clue-title' ? 'text-cyan-400 font-bold mt-2' :
              entry.type === 'clue' ? 'text-cyan-300 italic' :
              entry.type === 'puzzle-title' ? 'text-purple-400 font-bold mt-2' :
              entry.type === 'puzzle' ? 'text-purple-300 italic' :
              entry.type === 'hint' ? 'text-purple-500 text-sm' :
              entry.type === 'success' ? 'text-green-300 font-bold' :
              entry.type === 'win' ? 'text-yellow-300 whitespace-pre-wrap mt-2' :
              entry.type === 'sealed' ? 'text-gray-500 italic' :
              'text-green-400'
            }
          >
            {entry.text}
          </p>
        ))}
        <div ref={logEndRef} />
      </div>

      {status === 'ready' && (
        <form onSubmit={onSubmit} className="flex gap-2">
          <span className="text-green-400">{puzzleActive ? '?' : '>'}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono"
            placeholder={puzzleActive ? 'Enter your answer...' : ''}
            autoFocus
          />
        </form>
      )}
    </div>
  );
}
