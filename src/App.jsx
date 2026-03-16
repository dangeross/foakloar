import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRelay } from './useRelay.js';
import { usePlayerState } from './usePlayerState.js';
import { AUTHOR_PUBKEY, WORLD_TAG } from './config.js';
import { GameEngine } from './engine/engine.js';
import { PlayerStateMutator } from './engine/player-state.js';
import { getTag, getTags } from './world.js';
import { resolveTheme, applyTheme } from './theme.js';
import { buildTrustSet, resolveClientMode } from './trust.js';

/** Map entry types to colour slots */
const TYPE_COLOUR = {
  command:          'text',
  narrative:        'text',
  title:            'title',
  error:            'error',
  exits:            'exits',
  'exits-untrusted':'error',
  item:             'item',
  feature:          'dim',
  'clue-title':     'clue',
  clue:             'clue',
  'puzzle-title':   'puzzle',
  puzzle:           'puzzle',
  hint:             'puzzle',
  success:          'highlight',
  win:              'item',
  sealed:           'dim',
  npc:              'npc',
  'npc-title':      'npc',
  dialogue:         'npc',
  'dialogue-option':'npc',
  markdown:         'text',
  'media-markdown': 'text',
  'media-ascii':    'text',
};

/** Map entry types to extra CSS classes (layout, weight, etc.) */
const TYPE_CLASS = {
  command:          'mt-2',
  title:            'font-bold mt-3',
  exits:            'text-sm mt-1',
  'exits-untrusted':'text-sm',
  item:             'text-sm',
  feature:          'text-sm',
  'clue-title':     'font-bold mt-2',
  clue:             'italic',
  'puzzle-title':   'font-bold mt-2',
  puzzle:           'italic',
  hint:             'text-sm',
  success:          'font-bold',
  win:              'whitespace-pre-wrap mt-2',
  sealed:           'italic',
  npc:              'text-sm',
  'npc-title':      'font-bold mt-3',
  dialogue:         'italic',
  'dialogue-option':'text-sm',
  markdown:         'prose-dungeon mt-1',
  'media-markdown': 'prose-dungeon mt-1',
  'media-ascii':    'whitespace-pre font-mono text-sm mt-2 leading-none',
  'media-image':    'mt-2',
};

export default function App() {
  const { events, status } = useRelay();
  const player = usePlayerState();
  const [log, setLog] = useState([]);
  const [clientMode, setClientMode] = useState('community');
  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const logEndRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  // Resolve world event config from events
  const worldConfig = useMemo(() => {
    if (events.size === 0) return null;
    const worldEvent = events.get(`30078:${AUTHOR_PUBKEY}:${WORLD_TAG}:world`);
    if (!worldEvent) return null;

    const startRef = getTag(worldEvent, 'start');
    const genesisPlace = startRef || `30078:${AUTHOR_PUBKEY}:${WORLD_TAG}:place:clearing`;
    const inventoryRefs = getTags(worldEvent, 'inventory').map((t) => t[1]);
    const title = getTag(worldEvent, 'title') || WORLD_TAG;
    const cwTags = getTags(worldEvent, 'cw').map((t) => t[1]);

    return { genesisPlace, inventoryRefs, title, cwTags, worldEvent };
  }, [events]);

  // Build trust set from world event + vouch events
  const trustInfo = useMemo(() => {
    if (!worldConfig?.worldEvent) return null;
    const trustSet = buildTrustSet(worldConfig.worldEvent, events);
    const { availableModes, effectiveMode } = resolveClientMode(trustSet.collaboration, clientMode);
    return { trustSet, availableModes, effectiveMode };
  }, [worldConfig, events, clientMode]);

  // Apply theme from world event
  useEffect(() => {
    const colours = resolveTheme(worldConfig?.worldEvent || null);
    applyTheme(colours);
  }, [worldConfig]);

  // Lazily create or update engine with latest events
  const getEngine = useCallback(() => {
    const mutator = new PlayerStateMutator(player.state, player.npcStates);
    const genesisPlace = worldConfig?.genesisPlace || `30078:${AUTHOR_PUBKEY}:${WORLD_TAG}:place:clearing`;
    const trustSet = trustInfo?.trustSet || null;
    const effectiveMode = trustInfo?.effectiveMode || 'community';
    if (!engineRef.current) {
      engineRef.current = new GameEngine({
        events,
        player: mutator,
        config: { GENESIS_PLACE: genesisPlace, AUTHOR_PUBKEY, trustSet, clientMode: effectiveMode },
      });
    } else {
      engineRef.current.events = events;
      engineRef.current.player = mutator;
      engineRef.current.config = { ...engineRef.current.config, trustSet, clientMode: effectiveMode };
    }
    return engineRef.current;
  }, [events, player.state, worldConfig, trustInfo]);

  // Flush engine output into React log state and commit player state
  const commitEngine = useCallback((engine) => {
    const entries = engine.flush();
    if (entries.length > 0) {
      setLog((prev) => [...prev, ...entries]);
    }
    player.replaceState(engine.getPlayerState(), engine.player.npcStates);
  }, [player]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Keep input focused
  useEffect(() => {
    inputRef.current?.focus();
  }, [status, log]);

  useEffect(() => {
    function refocus(e) {
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

      // Give starting inventory on new game
      const isNewGame = !player.state.place && player.state.inventory.length === 0;
      if (isNewGame && worldConfig?.inventoryRefs) {
        for (const ref of worldConfig.inventoryRefs) {
          if (!engine.player.hasItem(ref)) {
            engine.player.pickUp(ref);
            const itemEvent = events.get(ref);
            if (itemEvent) {
              const defaultState = getTag(itemEvent, 'state');
              if (defaultState) engine.player.setState(ref, defaultState);
              for (const ct of getTags(itemEvent, 'counter')) {
                engine.player.setCounter(`${ref}:${ct[1]}`, parseInt(ct[2], 10));
              }
            }
          }
        }
      }

      engine.enterRoom(engine.currentPlace);
      commitEngine(engine);
    }
  }, [status]);

  async function onSubmit(e) {
    e.preventDefault();
    const val = inputRef.current.value;
    if (!val.trim()) return;
    inputRef.current.value = '';
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
        historyIndexRef.current = -1;
        inputRef.current.value = draftRef.current;
      }
    }
  }

  // Derive UI state
  const engine = engineRef.current;
  const puzzleActive = engine?.puzzleActive ?? null;
  const dialogueActive = engine?.dialogueActive ?? null;
  const worldTitle = worldConfig?.title || WORLD_TAG;
  const availableModes = trustInfo?.availableModes || [];
  const effectiveMode = trustInfo?.effectiveMode || 'community';

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col h-screen"
         style={{ backgroundColor: 'var(--colour-bg)', color: 'var(--colour-text)' }}>
      <div className="text-sm mb-2 flex justify-between" style={{ color: 'var(--colour-dim)' }}>
        <span>{worldTitle} | Relay: {status} | Events: {events.size}</span>
        {availableModes.length > 1 && (
          <span>
            {availableModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setClientMode(mode)}
                className="ml-2 cursor-pointer"
                style={{
                  color: mode === effectiveMode ? 'var(--colour-highlight)' : 'var(--colour-dim)',
                  textDecoration: mode === effectiveMode ? 'underline' : 'none',
                  background: 'none',
                  border: 'none',
                  font: 'inherit',
                  padding: 0,
                }}
              >
                {mode}
              </button>
            ))}
          </span>
        )}
      </div>
      {effectiveMode === 'explorer' && (
        <div className="text-xs mb-1" style={{ color: 'var(--colour-error)' }}>
          Explorer mode — you are viewing unverified community content.
        </div>
      )}

      {status === 'connecting' && <p>Connecting to relay...</p>}
      {status === 'failed' && <p style={{ color: 'var(--colour-error)' }}>Failed to connect to any relay.</p>}

      <div className="flex-1 overflow-y-auto mb-4">
        {log.map((entry, i) => {
          const colourSlot = TYPE_COLOUR[entry.type] || 'text';
          const extraClass = TYPE_CLASS[entry.type] || '';
          const style = { color: `var(--colour-${colourSlot})` };

          if (entry.html) {
            return <div key={i} className={extraClass} style={style} dangerouslySetInnerHTML={{ __html: entry.html }} />;
          }
          return <p key={i} className={extraClass} style={style}>{entry.text}</p>;
        })}
        <div ref={logEndRef} />
      </div>

      {status === 'ready' && (
        <form onSubmit={onSubmit} className="flex gap-2">
          <span style={{ color: 'var(--colour-text)' }}>
            {dialogueActive ? '#' : puzzleActive ? '?' : '>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none font-mono"
            style={{ color: 'var(--colour-text)' }}
            placeholder={dialogueActive ? 'Choose an option...' : puzzleActive ? 'Enter your answer...' : ''}
            onKeyDown={onKeyDown}
            autoFocus
          />
        </form>
      )}
    </div>
  );
}
