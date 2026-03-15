import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRelay } from './useRelay.js';
import { usePlayerState } from './usePlayerState.js';
import { GENESIS_PLACE, AUTHOR_PUBKEY } from './config.js';
import { GameEngine } from './engine/engine.js';
import { PlayerStateMutator } from './engine/player-state.js';

export default function App() {
  const { events, status } = useRelay();
  const player = usePlayerState();
  const [log, setLog] = useState([]);
  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const logEndRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  // Lazily create or update engine with latest events
  const getEngine = useCallback(() => {
    const mutator = new PlayerStateMutator(player.state);
    if (!engineRef.current) {
      engineRef.current = new GameEngine({
        events,
        player: mutator,
        config: { GENESIS_PLACE, AUTHOR_PUBKEY },
      });
    } else {
      engineRef.current.events = events;
      engineRef.current.player = mutator;
    }
    return engineRef.current;
  }, [events, player.state]);

  // Flush engine output into React log state and commit player state
  const commitEngine = useCallback((engine) => {
    const entries = engine.flush();
    if (entries.length > 0) {
      setLog((prev) => [...prev, ...entries]);
    }
    player.replaceState(engine.getPlayerState());
  }, [player]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Keep input focused — refocus on click anywhere or after renders
  useEffect(() => {
    inputRef.current?.focus();
  }, [status, log]);

  useEffect(() => {
    function refocus(e) {
      // Don't steal focus from other inputs/textareas if any exist
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      inputRef.current?.focus();
    }
    document.addEventListener('mouseup', refocus);
    return () => document.removeEventListener('mouseup', refocus);
  }, []);

  // Initial room on ready
  useEffect(() => {
    if (status === 'ready' && events.size > 0 && log.length === 0) {
      const engine = getEngine();
      engine.reconcileCounterLow();
      engine.enterRoom(engine.currentPlace);
      commitEngine(engine);
    }
  }, [status]);

  async function onSubmit(e) {
    e.preventDefault();
    const val = inputRef.current.value;
    if (!val.trim()) return;
    inputRef.current.value = '';
    // Push to history — skip dialogue choices (numeric) and puzzle answers
    const engine = getEngine();
    if (!engine.dialogueActive && !engine.puzzleActive) {
      const hist = historyRef.current;
      if (hist.length === 0 || hist[hist.length - 1] !== val) {
        hist.push(val);
      }
    }
    historyIndexRef.current = -1;
    draftRef.current = '';
    await engine.handleCommand(val);
    commitEngine(engine);
  }

  function onKeyDown(e) {
    const hist = historyRef.current;
    if (hist.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndexRef.current === -1) {
        // Save current input as draft before browsing history
        draftRef.current = inputRef.current.value;
        historyIndexRef.current = hist.length - 1;
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
      }
      inputRef.current.value = hist[historyIndexRef.current];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndexRef.current === -1) return;
      if (historyIndexRef.current < hist.length - 1) {
        historyIndexRef.current++;
        inputRef.current.value = hist[historyIndexRef.current];
      } else {
        // Past the end — restore draft
        historyIndexRef.current = -1;
        inputRef.current.value = draftRef.current;
      }
    }
  }

  // Derive UI state from engine
  const engine = engineRef.current;
  const puzzleActive = engine?.puzzleActive ?? null;
  const dialogueActive = engine?.dialogueActive ?? null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col h-screen">
      <div className="text-sm text-green-600 mb-2">
        Relay: {status} | Events: {events.size}
      </div>

      {status === 'connecting' && <p>Connecting to relay...</p>}
      {status === 'failed' && <p className="text-red-400">Failed to connect to any relay.</p>}

      <div className="flex-1 overflow-y-auto mb-4">
        {log.map((entry, i) => {
          const typeClass =
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
            entry.type === 'npc' ? 'text-amber-400 text-sm' :
            entry.type === 'npc-title' ? 'text-amber-300 font-bold mt-3' :
            entry.type === 'dialogue' ? 'text-amber-200 italic' :
            entry.type === 'dialogue-option' ? 'text-amber-400 text-sm' :
            entry.type === 'markdown' ? 'text-green-400 prose-dungeon mt-1' :
            entry.type === 'media-markdown' ? 'text-green-400 prose-dungeon mt-1' :
            entry.type === 'media-ascii' ? 'text-green-500 whitespace-pre font-mono text-sm mt-2 leading-none' :
            entry.type === 'media-image' ? 'mt-2' :
            'text-green-400';

          if (entry.html) {
            return <div key={i} className={typeClass} dangerouslySetInnerHTML={{ __html: entry.html }} />;
          }
          return <p key={i} className={typeClass}>{entry.text}</p>;
        })}
        <div ref={logEndRef} />
      </div>

      {status === 'ready' && (
        <form onSubmit={onSubmit} className="flex gap-2">
          <span className="text-green-400">{dialogueActive ? '#' : puzzleActive ? '?' : '>'}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono"
            placeholder={dialogueActive ? 'Choose an option...' : puzzleActive ? 'Enter your answer...' : ''}
            onKeyDown={onKeyDown}
            autoFocus
          />
        </form>
      )}
    </div>
  );
}
