import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRelay } from './useRelay.js';
import { usePlayerState } from './usePlayerState.js';
import { useSigner } from './useSigner.js';
import { AUTHOR_PUBKEY, WORLD_TAG } from './config.js';
import { GameEngine } from './engine/engine.js';
import { PlayerStateMutator } from './engine/player-state.js';
import { getTag, getTags } from './world.js';
import { resolveTheme, applyTheme } from './theme.js';
import { buildTrustSet, resolveClientMode } from './trust.js';
import { useStateBackup } from './useStateBackup.js';
import PaymentPanel from './PaymentPanel.jsx';
import BuildModeOverlay from './builder/BuildModeOverlay.jsx';
import EventEditor from './builder/EventEditor.jsx';
import DraftListPanel from './builder/DraftListPanel.jsx';
import ModeDropdown from './builder/ModeDropdown.jsx';
import { loadDrafts, saveDraft, updateDraft, deleteDraft, importEvents, exportDrafts, bulkPublish } from './builder/draftStore.js';

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
  const { events, status, relay } = useRelay();
  const player = usePlayerState();
  const identity = useSigner();
  const backup = useStateBackup({
    signer: identity.signer,
    relay,
    playerState: player.state,
    npcStates: player.npcStates,
    replaceState: player.replaceState,
  });
  const [log, setLog] = useState([]);
  const [clientMode, setClientMode] = useState('community');
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showNsec, setShowNsec] = useState(false);
  const [generation, setGeneration] = useState(0);
  // Build mode state
  const [buildMode, setBuildMode] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [editorState, setEditorState] = useState(null); // { eventType, draft?, initialTags?, ... }
  const [drafts, setDrafts] = useState(() => loadDrafts(WORLD_TAG));
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
  }, [status, generation]);

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
  const paymentActive = engine?.paymentActive ?? null;
  const worldTitle = worldConfig?.title || WORLD_TAG;
  const availableModes = trustInfo?.availableModes || [];
  const effectiveMode = trustInfo?.effectiveMode || 'community';

  const shortPubkey = identity.pubkey ? identity.pubkey.slice(0, 8) + '...' : '';
  const isLoggedIn = identity.method !== 'ephemeral';

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col h-screen"
         style={{ backgroundColor: 'var(--colour-bg)', color: 'var(--colour-text)' }}>
      <div className="text-sm mb-2 flex justify-between" style={{ color: 'var(--colour-dim)' }}>
        <span>{worldTitle}{status !== 'ready' ? ` | ${status}` : ''}</span>
        <span className="flex items-center gap-2">
          <ModeDropdown
            availableModes={availableModes.length > 0 ? availableModes : [effectiveMode]}
            effectiveMode={effectiveMode}
            onSelectMode={setClientMode}
            buildMode={buildMode}
            onToggleBuild={() => setBuildMode(!buildMode)}
            showBuildOption={identity.isProperIdentity}
            draftsCount={drafts.length}
            onOpenDrafts={() => setShowDrafts(true)}
          />
          <button
            onClick={() => setShowLogin(!showLogin)}
            className="cursor-pointer"
            style={{
              color: isLoggedIn ? 'var(--colour-highlight)' : 'var(--colour-dim)',
              background: 'none',
              border: 'none',
              font: 'inherit',
              padding: 0,
            }}
            title={`${identity.method}: ${identity.pubkey || 'none'}`}
          >
            {isLoggedIn ? `[${shortPubkey}]` : '[--]'}
          </button>
        </span>
      </div>
      {effectiveMode === 'explorer' && (
        <div className="text-xs mb-1" style={{ color: 'var(--colour-error)' }}>
          Explorer mode — you are viewing unverified community content.
        </div>
      )}

      {showLogin && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setShowLogin(false); setLoginError(''); setShowNsec(false); }}
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
              minWidth: '28em',
              maxWidth: '90vw',
            }}
          >
            {/* Title bar */}
            <div
              className="flex justify-between px-2 py-1"
              style={{ backgroundColor: 'var(--colour-dim)', color: 'var(--colour-bg)' }}
            >
              <span>IDENTITY</span>
              <button
                onClick={() => { setShowLogin(false); setLoginError(''); setShowNsec(false); }}
                className="cursor-pointer"
                style={{ background: 'none', border: 'none', font: 'inherit', color: 'var(--colour-bg)', padding: 0 }}
              >
                [X]
              </button>
            </div>

            {/* Content */}
            <div className="p-3">
              <div className="mb-2" style={{ color: 'var(--colour-dim)' }}>
                Status: {isLoggedIn ? identity.method : identity.backedUp ? 'ephemeral (backed up)' : 'anonymous (ephemeral key)'}
              </div>
              <div className="mb-3" style={{ color: 'var(--colour-dim)', wordBreak: 'break-all' }}>
                Pubkey: {identity.pubkey || 'none'}
              </div>

              {identity.method === 'ephemeral' && (
                <div className="mb-3 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
                  {!showNsec ? (
                    <button
                      onClick={() => setShowNsec(true)}
                      className="cursor-pointer"
                      style={{ color: 'var(--colour-item)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                    >
                      Show Secret Key
                    </button>
                  ) : (
                    <>
                      <div className="mb-1" style={{ color: 'var(--colour-error)' }}>
                        Save this key to keep your identity:
                      </div>
                      <div
                        className="mb-2 p-1"
                        style={{
                          color: 'var(--colour-highlight)',
                          wordBreak: 'break-all',
                          border: '1px solid var(--colour-dim)',
                          fontSize: '0.65rem',
                          userSelect: 'all',
                        }}
                      >
                        {identity.getNsec()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const nsec = identity.getNsec();
                            if (nsec) navigator.clipboard.writeText(nsec);
                          }}
                          className="cursor-pointer"
                          style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                        >
                          Copy
                        </button>
                        {!identity.backedUp && (
                          <button
                            onClick={() => { identity.confirmBackup(); }}
                            className="cursor-pointer"
                            style={{ color: 'var(--colour-text)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                          >
                            I've saved it
                          </button>
                        )}
                        {identity.backedUp && (
                          <span style={{ color: 'var(--colour-text)', padding: '2px 0' }}>Backed up</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {identity.method !== 'extension' && identity.nip07Available && (
                <div className="mb-2">
                  <button
                    onClick={async () => {
                      const res = await identity.loginExtension();
                      if (!res.ok) setLoginError(res.error);
                      else { setLoginError(''); setShowLogin(false); }
                    }}
                    className="cursor-pointer"
                    style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                  >
                    Use Nostr Extension
                  </button>
                </div>
              )}

              {identity.method !== 'nsec' && (
                <form
                  className="mb-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nsec = e.target.elements.nsec.value.trim();
                    const res = identity.login(nsec);
                    if (!res.ok) setLoginError(res.error);
                    else { setLoginError(''); setShowLogin(false); e.target.reset(); }
                  }}
                >
                  <div className="mb-1" style={{ color: 'var(--colour-dim)' }}>Login with nsec:</div>
                  <div className="flex gap-1">
                    <input
                      name="nsec"
                      type="password"
                      placeholder="nsec1..."
                      className="flex-1 bg-transparent outline-none font-mono text-xs px-1"
                      style={{ color: 'var(--colour-text)', border: '1px solid var(--colour-dim)' }}
                    />
                    <button
                      type="submit"
                      className="cursor-pointer"
                      style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                    >
                      OK
                    </button>
                  </div>
                </form>
              )}

              {isLoggedIn && (
                <div className="mt-2">
                  <button
                    onClick={() => { identity.logout(); setShowLogin(false); }}
                    className="cursor-pointer"
                    style={{ color: 'var(--colour-error)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                  >
                    Logout
                  </button>
                </div>
              )}

              {backup.canBackup && (
                <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
                  <div className="mb-1" style={{ color: 'var(--colour-dim)' }}>State Backup:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const res = await backup.saveToRelay();
                        if (res.ok) setLoginError('');
                      }}
                      disabled={backup.saving}
                      className="cursor-pointer"
                      style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                    >
                      {backup.saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={async () => {
                        const res = await backup.loadFromRelay();
                        if (res.ok) {
                          setLoginError('');
                          setShowLogin(false);
                          // Reset game log and bump generation to force re-enter room
                          engineRef.current = null;
                          setLog([]);
                          setGeneration((g) => g + 1);
                        }
                      }}
                      disabled={backup.loading}
                      className="cursor-pointer"
                      style={{ color: 'var(--colour-highlight)', background: 'none', border: '1px solid var(--colour-dim)', font: 'inherit', padding: '2px 8px' }}
                    >
                      {backup.loading ? 'Loading...' : 'Restore'}
                    </button>
                  </div>
                  {backup.lastSaved && (
                    <div className="mt-1" style={{ color: 'var(--colour-dim)' }}>
                      Last saved: {backup.lastSaved.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {(loginError || backup.error) && (
                <div className="mt-2" style={{ color: 'var(--colour-error)' }}>
                  {loginError || backup.error}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {paymentActive && (
        <PaymentPanel
          payment={paymentActive}
          onPaid={() => {
            const engine = getEngine();
            engine.completePayment(paymentActive.dtag);
            commitEngine(engine);
          }}
          onClose={() => {
            if (engineRef.current) {
              engineRef.current.paymentActive = null;
            }
            // Force re-render
            setLog((prev) => [...prev]);
          }}
        />
      )}

      {/* Build mode overlay */}
      {buildMode && status === 'ready' && (
        <BuildModeOverlay
          events={events}
          currentPlace={engineRef.current?.currentPlace || player.state.place}
          onNewEvent={(eventType) => setEditorState({ eventType })}
          onEditPortal={(slot) => {
            // Pre-fill portal editor with current place and slot
            const currentPlaceRef = engineRef.current?.currentPlace || player.state.place;
            setEditorState({
              eventType: 'portal',
              initialTags: [['exit', currentPlaceRef, slot, '']],
            });
          }}
        />
      )}

      {/* Draft list panel */}
      {showDrafts && (
        <DraftListPanel
          drafts={drafts}
          onClose={() => setShowDrafts(false)}
          onEdit={(draft) => {
            const eventType = draft.tags?.find((t) => t[0] === 'type')?.[1] || 'place';
            setEditorState({ eventType, eventTemplate: draft });
            setShowDrafts(false);
          }}
          onDelete={(id) => {
            deleteDraft(WORLD_TAG, id);
            setDrafts(loadDrafts(WORLD_TAG));
          }}
          onPublish={(draft) => {
            const eventType = draft.tags?.find((t) => t[0] === 'type')?.[1] || 'place';
            setEditorState({ eventType, eventTemplate: draft, showPreview: true });
            setShowDrafts(false);
          }}
          onNew={() => {
            setEditorState({ eventType: 'place' });
            setShowDrafts(false);
          }}
          onImport={(data) => {
            const result = importEvents(WORLD_TAG, data);
            setDrafts(loadDrafts(WORLD_TAG));
            // TODO: show result.imported / result.skipped feedback
          }}
          onExport={() => {
            const data = exportDrafts(WORLD_TAG);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${WORLD_TAG}-drafts.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onBulkPublish={async () => {
            if (!identity.signer || !identity.pubkey) return;
            const result = await bulkPublish(WORLD_TAG, identity.pubkey, identity.signer, relay);
            setDrafts(loadDrafts(WORLD_TAG));
            // TODO: show result.published / result.failed feedback
          }}
        />
      )}

      {/* Event editor */}
      {editorState && (
        <EventEditor
          eventType={editorState.eventType}
          worldSlug={WORLD_TAG}
          pubkey={identity.pubkey}
          signer={identity.signer}
          relay={relay}
          events={events}
          eventTemplate={editorState.eventTemplate || null}
          initialTags={editorState.initialTags || []}
          startInPreview={editorState.showPreview || false}
          onSaveDraft={(eventTemplate) => {
            const draftId = editorState.eventTemplate?._draft?.id;
            if (draftId) {
              updateDraft(WORLD_TAG, draftId, eventTemplate);
            } else {
              saveDraft(WORLD_TAG, eventTemplate);
            }
            setDrafts(loadDrafts(WORLD_TAG));
          }}
          onPublished={() => {
            // If was a draft, remove it
            const draftId = editorState.eventTemplate?._draft?.id;
            if (draftId) {
              deleteDraft(WORLD_TAG, draftId);
              setDrafts(loadDrafts(WORLD_TAG));
            }
          }}
          onClose={() => setEditorState(null)}
        />
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
