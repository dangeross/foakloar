import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRelay } from '../hooks/useRelay.js';
import { usePlayerState } from '../hooks/usePlayerState.js';
import { useSigner } from '../hooks/useSigner.js';
import { parseRoute, navigateToWorld, navigateToLobby, navigateToProfile } from '../services/router.js';
import { GameEngine } from '../engine/engine.js';
import { PlayerStateMutator } from '../engine/player-state.js';
import { getTag, getTags } from '../engine/world.js';
import { resolveTheme, applyTheme, resolveEffects, applyEffects, resolveFont, resolveFontSize, resolveFontSizePanel, resolveCursor, applyFontAndCursor, loadFont } from '../services/theme.js';
import { buildTrustSet, resolveClientMode } from '../engine/trust.js';
import { useStateBackup } from '../hooks/useStateBackup.js';
import { useNip65 } from '../hooks/useNip65.js';
import PaymentPanel from './PaymentPanel.jsx';
import BuildModeOverlay from '../builder/components/BuildModeOverlay.jsx';
import EventEditor from '../builder/components/EventEditor.jsx';
import DraftListPanel from '../builder/components/DraftListPanel.jsx';
import ModeDropdown from '../builder/components/ModeDropdown.jsx';
import WorldCreator from '../builder/components/WorldCreator.jsx';
import VouchPanel from '../builder/components/VouchPanel.jsx';
import EventGraph from '../builder/components/EventGraph.jsx';
import Lobby from './Lobby.jsx';
import AuthorProfile from './AuthorProfile.jsx';
import TipPanel from './TipPanel.jsx';
import IdentityButton from './ui/IdentityButton.jsx';
import LoginPanel from './ui/LoginPanel.jsx';
import { loadDrafts, saveDraft, updateDraft, deleteDraft, clearDrafts, importEvents, exportDrafts, bulkPublish, loadAnswers } from '../builder/draftStore.js';
import { validateWorld, verifyPuzzleHashes } from '../builder/validateWorld.js';
import RelaySettingsPanel from './RelaySettingsPanel.jsx';
import PublishProgressPanel from '../builder/components/PublishProgressPanel.jsx';
import SoundToggle from './SoundToggle.jsx';
import { evaluateSoundTags, isAudioReady, playOneShotRef, loadSamples } from '../services/sound.js';

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
  death:            'error',
  'death-separator':'dim',
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
  death:            'font-bold text-center mt-4 mb-2 whitespace-pre-wrap',
  'death-separator':'text-center mt-1 mb-3 text-sm',
};

export default function App() {
  // ── Route state ──────────────────────────────────────────────────────────
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    function onNav() { setRoute(parseRoute()); }
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  const worldTag = route.worldSlug;

  // ── Core hooks (worldTag-scoped) ─────────────────────────────────────────
  const { events, status, pool, relayStatus, publishUrls } = useRelay(worldTag);
  const player = usePlayerState(worldTag);
  const identity = useSigner();
  const nip65 = useNip65(identity?.pubkey, pool);
  const backup = useStateBackup({
    worldTag,
    signer: identity.signer,
    pool,
    playerState: player.state,
    npcStates: player.npcStates,
    replaceState: player.replaceState,
  });
  const [log, setLog] = useState([]);
  const [clientMode, setClientMode] = useState(() => {
    if (!worldTag) return 'community';
    try { return localStorage.getItem(`foakloar:mode:${worldTag}`) || 'community'; } catch { return 'community'; }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [generation, setGeneration] = useState(0);
  // Build mode state
  const [buildMode, setBuildMode] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [editorState, setEditorState] = useState(null); // { eventType, draft?, initialTags?, ... }
  const [showWorldCreator, setShowWorldCreator] = useState(false);
  const [showZap, setShowZap] = useState(false);
  const [vouchTarget, setVouchTarget] = useState(null); // pubkey to vouch for
  const [drafts, setDrafts] = useState(() => loadDrafts(worldTag || ''));
  const draftAnswers = useMemo(() => loadAnswers(worldTag || ''), [worldTag, drafts]); // eslint-disable-line react-hooks/exhaustive-deps
  const [publishResult, setPublishResult] = useState(null); // { published, failed, errors, details }
  const [showRelaySettings, setShowRelaySettings] = useState(false);
  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const logEndRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  // Reset game state when world changes
  const prevWorldRef = useRef(worldTag);
  useEffect(() => {
    if (prevWorldRef.current !== worldTag) {
      prevWorldRef.current = worldTag;
      engineRef.current = null;
      setLog([]);
      setGeneration((g) => g + 1);
      setDrafts(loadDrafts(worldTag || ''));
      try { setClientMode(localStorage.getItem(`foakloar:mode:${worldTag}`) || 'community'); } catch { setClientMode('community'); }
    }
  }, [worldTag]);

  // Reset build mode on world change; auto-enable only for draft-only worlds
  useEffect(() => {
    setBuildMode(false);
  }, [worldTag]);
  useEffect(() => {
    if (status === 'ready' && drafts.length > 0 && events.size === 0 && !buildMode) setBuildMode(true);
  }, [status, drafts.length, events.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge drafts into events so the engine can preview unpublished content.
  // Draft events become synthetic events keyed by their a-tag, with the
  // current user's pubkey (or a placeholder). Relay events always win.
  const mergedEvents = useMemo(() => {
    if (drafts.length === 0) return events;
    const pubkey = identity.pubkey || '0'.repeat(64);
    const merged = new Map(events);
    // Build d-tag → existing a-tag lookup so drafts replace published events
    const dTagToATag = new Map();
    for (const [aTag, event] of events) {
      const dTag = event.tags?.find((t) => t[0] === 'd')?.[1];
      if (dTag) dTagToATag.set(dTag, aTag);
    }
    for (const draft of drafts) {
      const dTag = draft.tags?.find((t) => t[0] === 'd')?.[1];
      if (!dTag) continue;
      // Resolve <PUBKEY> placeholders in tags
      const resolvedTags = draft.tags.map((tag) =>
        tag.map((v) => (typeof v === 'string' ? v.replaceAll('<PUBKEY>', pubkey) : v))
      );
      // Use existing published key if same author, so portal refs stay connected
      const existingKey = dTagToATag.get(dTag);
      const existingEvent = existingKey ? merged.get(existingKey) : null;
      const sameAuthor = existingEvent && existingEvent.pubkey === pubkey;
      const aTag = sameAuthor ? existingKey : `30078:${pubkey}:${dTag}`;
      const effectivePubkey = sameAuthor ? existingEvent.pubkey : pubkey;
      merged.set(aTag, {
        kind: 30078,
        pubkey: effectivePubkey,
        id: `draft-${draft._draft?.id || dTag}`,
        sig: '',
        created_at: Math.floor((draft._draft?.updatedAt || Date.now()) / 1000),
        tags: resolvedTags,
        content: draft.content || '',
        _isDraft: true,
      });
    }
    return merged;
  }, [events, drafts, identity.pubkey]);

  // Resolve world event config by scanning events for type=world
  const worldConfig = useMemo(() => {
    if (mergedEvents.size === 0 || !worldTag) return null;

    // Find the world event: d-tag = "<slug>:world", type = "world"
    const expectedDTag = `${worldTag}:world`;
    let worldEvent = null;
    for (const [, ev] of mergedEvents) {
      const dTag = ev.tags.find((t) => t[0] === 'd')?.[1];
      const typeTag = ev.tags.find((t) => t[0] === 'type')?.[1];
      if (dTag === expectedDTag && typeTag === 'world') {
        worldEvent = ev;
        break;
      }
    }
    if (!worldEvent) return null;

    const authorPubkey = worldEvent.pubkey;
    const startRef = getTag(worldEvent, 'start');
    const genesisPlace = startRef || `30078:${authorPubkey}:${worldTag}:place:clearing`;
    const inventoryRefs = getTags(worldEvent, 'inventory').map((t) => t[1]);
    const title = getTag(worldEvent, 'title') || worldTag;
    const cwTags = getTags(worldEvent, 'cw').map((t) => t[1]);

    return { genesisPlace, inventoryRefs, title, cwTags, worldEvent, authorPubkey };
  }, [mergedEvents, worldTag]);

  // Build trust set from world event + vouch events
  const trustInfo = useMemo(() => {
    if (!worldConfig?.worldEvent) return null;
    const trustSet = buildTrustSet(worldConfig.worldEvent, mergedEvents);
    const { availableModes, effectiveMode } = resolveClientMode(trustSet.collaboration, clientMode);
    return { trustSet, availableModes, effectiveMode };
  }, [worldConfig, mergedEvents, clientMode]);

  // Apply theme, effects, font, and cursor from world event
  useEffect(() => {
    const we = worldConfig?.worldEvent || null;
    applyTheme(resolveTheme(we));
    applyEffects(resolveEffects(we));
    const fontFamily = resolveFont(we);
    const fontSize = resolveFontSize(we);
    const fontSizePanel = resolveFontSizePanel(we);
    const cursorStyle = resolveCursor(we);
    applyFontAndCursor(fontFamily, cursorStyle, fontSize, fontSizePanel);
    loadFont(we);

    // Toggle flicker class on #root
    const root = document.getElementById('root');
    if (root) {
      const effects = resolveEffects(we);
      root.classList.toggle('flicker-active', effects.flicker > 0);
    }

    // Set cursor class on body
    document.body.classList.remove('cursor-beam', 'cursor-block', 'cursor-underline');
    document.body.classList.add(`cursor-${cursorStyle}`);
  }, [worldConfig]);

  // Lazily create or update engine with latest events
  const getEngine = useCallback(() => {
    const mutator = new PlayerStateMutator(player.state, player.npcStates);
    const authorPubkey = worldConfig?.authorPubkey || '';
    const genesisPlace = worldConfig?.genesisPlace || '';
    const trustSet = trustInfo?.trustSet || null;
    const effectiveMode = trustInfo?.effectiveMode || 'community';
    if (!engineRef.current) {
      engineRef.current = new GameEngine({
        events: mergedEvents,
        player: mutator,
        config: { GENESIS_PLACE: genesisPlace, AUTHOR_PUBKEY: authorPubkey, trustSet, clientMode: effectiveMode },
      });
    } else {
      engineRef.current.events = mergedEvents;
      engineRef.current.player = mutator;
      engineRef.current.config = { ...engineRef.current.config, AUTHOR_PUBKEY: authorPubkey, trustSet, clientMode: effectiveMode };
    }
    return engineRef.current;
  }, [mergedEvents, player.state, worldConfig, trustInfo]);

  // Flush engine output into React log state and commit player state
  const commitEngine = useCallback((engine) => {
    const entries = engine.flush();
    // Process sound entries — play one-shots, don't add to log
    const logEntries = [];
    for (const entry of entries) {
      if (entry.type === 'sound' && entry.sound) {
        playOneShotRef(entry.sound, entry.volume);
      } else {
        logEntries.push(entry);
      }
    }
    if (logEntries.length > 0) {
      setLog((prev) => [...prev, ...logEntries]);
    }
    player.replaceState(engine.getPlayerState(), engine.player.npcStates);
  }, [player]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Keep input focused (skip when builder panels are open, or on touch devices to avoid keyboard popup)
  const panelOpen = showDrafts || editorState || showLogin;
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    if (!panelOpen && !isTouchDevice) inputRef.current?.focus();
  }, [status, log, panelOpen]);

  useEffect(() => {
    if (isTouchDevice) return;
    function refocus(e) {
      if (panelOpen) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      inputRef.current?.focus();
    }
    document.addEventListener('mouseup', refocus);
    return () => document.removeEventListener('mouseup', refocus);
  }, [panelOpen]);

  // Initial room on ready (mergedEvents includes drafts in build mode)
  useEffect(() => {
    if (status === 'ready' && mergedEvents.size > 0 && log.length === 0) {
      const engine = getEngine();

      engine.reconcileCounterLow();

      // Give starting inventory on new game
      const isNewGame = !player.state.place && player.state.inventory.length === 0;
      if (isNewGame && worldConfig?.inventoryRefs) {
        for (const ref of worldConfig.inventoryRefs) {
          if (!engine.player.hasItem(ref)) {
            engine.player.pickUp(ref);
            const itemEvent = mergedEvents.get(ref);
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
      // Start sound on initial room entry
      if (isAudioReady()) {
        evaluateSoundTags(mergedEvents, engine.currentPlace, engine.player.state, engine.player.npcStates);
      }
    }
  }, [status, generation, mergedEvents]);

  async function onSubmit(e) {
    e.preventDefault();
    const val = inputRef.current.value;
    if (!val.trim()) return;
    inputRef.current.value = '';
    if (isTouchDevice) inputRef.current.blur();
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
    // Update sound layers after state changes
    if (isAudioReady()) {
      evaluateSoundTags(mergedEvents, engine.currentPlace, engine.player.state, engine.player.npcStates);
    }
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
  const craftingActive = engine?.craftingActive ?? null;
  // Title: relay world event → draft world event → slug → fallback
  const worldTitle = useMemo(() => {
    if (worldConfig?.title) return worldConfig.title;
    // Check drafts for a world event title (pre-publish)
    const worldDraft = drafts.find((d) => d.tags?.find((t) => t[0] === 'type')?.[1] === 'world');
    const draftTitle = worldDraft?.tags?.find((t) => t[0] === 'title')?.[1];
    return draftTitle || worldTag || 'foakloar';
  }, [worldConfig, drafts, worldTag]);
  const availableModes = trustInfo?.availableModes || [];
  const effectiveMode = trustInfo?.effectiveMode || 'community';

  // Noise overlay — always present, controlled by --effect-noise CSS property
  const noiseOverlay = <div className="noise-overlay" aria-hidden="true" />;

  // ── Profile route ──────────────────────────────────────────────────────
  if (route.page === 'profile') {
    return <>{noiseOverlay}<AuthorProfile npub={route.npub} pubkeyHex={route.pubkeyHex} identity={identity} /></>;
  }

  // ── Lobby route ────────────────────────────────────────────────────────
  if (route.page === 'lobby') {
    return (
      <>{noiseOverlay}<Lobby
        identity={identity}
        onSelectWorld={(slug) => navigateToWorld(slug)}
        onCreateWorld={() => setShowWorldCreator(true)}
        showWorldCreator={showWorldCreator}
        worldCreatorNode={showWorldCreator && (
          <WorldCreator
            onClose={() => setShowWorldCreator(false)}
            onSaveDrafts={(worldSlug, templates) => {
              for (const tmpl of templates) {
                saveDraft(worldSlug, tmpl);
              }
              setShowWorldCreator(false);
              // Auto-enter build mode on the new world
              setBuildMode(true);
              navigateToWorld(worldSlug);
            }}
          />
        )}
      /></>
    );
  }

  return (
    <>
    {noiseOverlay}
    <div className="max-w-2xl mx-auto p-6 flex flex-col h-dvh game-text game-container"
         style={{ backgroundColor: 'var(--colour-bg)', color: 'var(--colour-text)' }}>
      <div className="text-sm mb-2 flex justify-between items-center shrink-0" style={{ color: 'var(--colour-dim)' }}>
        <span className="flex items-center min-w-0">
          <button
            onClick={navigateToLobby}
            className="cursor-pointer shrink-0"
            style={{ color: 'var(--colour-dim)', background: 'none', border: 'none', font: 'inherit', padding: 0 }}
          >w</button>
          <span className="shrink-0">{' / '}</span>
          <span className="truncate" style={{ color: 'var(--colour-title)' }}>{worldTitle}</span>
          {worldConfig?.authorPubkey && worldConfig?.worldEvent?.id && (
            <button
              onClick={() => setShowZap(true)}
              className="cursor-pointer"
              style={{
                color: 'var(--colour-item)',
                background: 'none',
                border: '1px solid var(--colour-dim)',
                font: 'inherit',
                padding: '0 4px',
                fontSize: '0.6rem',
                marginLeft: '0.5em',
              }}
            >
              <span className="hidden sm:inline">zap</span>
              <span className="sm:hidden">⚡</span>
            </button>
          )}
          {status !== 'ready' ? <span style={{ color: 'var(--colour-dim)' }}>{' | '}{status}</span> : ''}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <ModeDropdown
            availableModes={availableModes.length > 0 ? availableModes : [effectiveMode]}
            effectiveMode={effectiveMode}
            onSelectMode={(mode) => { setClientMode(mode); try { localStorage.setItem(`foakloar:mode:${worldTag}`, mode); } catch {} }}
            buildMode={buildMode}
            onToggleBuild={() => setBuildMode(!buildMode)}
            showBuildOption={identity.isProperIdentity}
            draftsCount={drafts.length}
            onOpenDrafts={() => setShowDrafts(true)}
            relayStatus={relayStatus}
            onOpenRelaySettings={() => setShowRelaySettings(true)}
          />
          <SoundToggle onAudioReady={async () => {
            if (engineRef.current) {
              await loadSamples(mergedEvents);
              evaluateSoundTags(
                mergedEvents, engineRef.current.currentPlace,
                engineRef.current.player.state, engineRef.current.player.npcStates,
              );
            }
          }} />
          <IdentityButton identity={identity} onClick={() => setShowLogin(!showLogin)} />
        </span>
      </div>
      {effectiveMode === 'explorer' && (
        <div className="text-xs mb-1" style={{ color: 'var(--colour-error)' }}>
          Explorer mode — you are viewing unverified community content.
        </div>
      )}

      {showLogin && (
        <LoginPanel identity={identity} onClose={() => setShowLogin(false)}>
          {backup.canBackup && (
            <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--colour-dim)' }}>
              <div className="mb-1" style={{ color: 'var(--colour-dim)' }}>State Backup:</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await backup.saveToRelay(); }}
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
                      setShowLogin(false);
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
          {backup.error && (
            <div className="mt-2" style={{ color: 'var(--colour-error)' }}>
              {backup.error}
            </div>
          )}
        </LoginPanel>
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

      {/* Zap world author */}
      {showZap && worldConfig?.authorPubkey && (
        <TipPanel
          recipientPubkey={worldConfig.authorPubkey}
          recipientName={worldTitle}
          eventId={worldConfig.worldEvent?.id}
          signer={identity?.signer}
          senderPubkey={identity?.pubkey}
          onClose={() => setShowZap(false)}
        />
      )}

      {/* Vouch panel */}
      {vouchTarget && identity?.signer && (
        <VouchPanel
          targetPubkey={vouchTarget}
          worldSlug={worldTag}
          signer={identity.signer}
          pool={pool}
          onClose={() => setVouchTarget(null)}
        />
      )}

      {/* Relay settings */}
      {showRelaySettings && (
        <RelaySettingsPanel
          worldSlug={worldTag}
          relayStatus={relayStatus}
          worldRelays={worldConfig?.worldEvent?.tags?.filter((t) => t[0] === 'relay').map((t) => t[1]) || []}
          nip65Read={nip65.readRelays}
          nip65Write={nip65.writeRelays}
          onClose={() => setShowRelaySettings(false)}
        />
      )}

      {/* Publish results */}
      {publishResult && (
        <PublishProgressPanel
          result={publishResult}
          zIndex={buildMode ? 120 : undefined}
          onClose={() => setPublishResult(null)}
        />
      )}

      {/* Build mode — event graph */}
      {buildMode && status === 'ready' && (
        <EventGraph
          events={mergedEvents}
          currentPlace={engineRef.current?.currentPlace || player.state.place}
          pubkey={identity.pubkey}
          trustSet={trustInfo?.trustSet}
          clientMode={trustInfo?.effectiveMode}
          answers={draftAnswers}
          onEditEvent={(aTag) => {
            const event = mergedEvents.get(aTag);
            if (!event) return;
            const eventType = getTag(event, 'type') || 'place';
            setEditorState({
              eventType,
              eventTemplate: { kind: 30078, tags: [...event.tags], content: event.content || '' },
            });
          }}
          onNewEvent={(eventType) => setEditorState({ eventType })}
          onNewPortal={(placeRef, slot, destRef) => {
            const initialTags = [['exit', placeRef, slot, '']];
            if (destRef) initialTags.push(['exit', destRef, '', '']);
            setEditorState({ eventType: 'portal', initialTags });
          }}
          onVouch={(targetPubkey) => setVouchTarget(targetPubkey)}
          onOpenDrafts={() => setShowDrafts(true)}
          draftsCount={drafts.length}
          onClose={() => setBuildMode(false)}
        />
      )}

      {/* Draft list panel */}
      {showDrafts && (
        <DraftListPanel
          drafts={drafts}
          events={mergedEvents}
          worldSlug={worldTag}
          zIndex={buildMode ? 110 : undefined}
          onClose={() => setShowDrafts(false)}
          onEdit={(draft) => {
            const eventType = draft.tags?.find((t) => t[0] === 'type')?.[1] || 'place';
            setEditorState({ eventType, eventTemplate: draft });
            setShowDrafts(false);
          }}
          onDelete={(id) => {
            deleteDraft(worldTag, id);
            setDrafts(loadDrafts(worldTag));
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
            const result = importEvents(worldTag, data);
            setDrafts(loadDrafts(worldTag));
            // TODO: show result.imported / result.skipped feedback
          }}
          onExport={() => {
            const data = exportDrafts(worldTag);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${worldTag}-drafts.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onBulkPublish={async () => {
            if (!identity.signer || !identity.pubkey) return;
            // Pre-flight world validation
            const currentDrafts = loadDrafts(worldTag);
            const answers = loadAnswers(worldTag);
            const worldCheck = validateWorld(currentDrafts, answers);
            // Also verify puzzle answer hashes
            const hashErrors = await verifyPuzzleHashes(worldCheck.puzzlesToVerify || []);
            const allErrors = [...worldCheck.errors, ...hashErrors];
            if (allErrors.length > 0) {
              const msgs = allErrors.map((e) => `${e.dTag}: ${e.message}${e.fix ? `\n  → ${e.fix}` : ''}`);
              alert(`Cannot publish — ${allErrors.length} error(s):\n\n${msgs.join('\n')}`);
              return;
            }
            const result = await bulkPublish(worldTag, identity.pubkey, identity.signer, pool);
            setDrafts(loadDrafts(worldTag));
            setPublishResult(result);
          }}
          onDeleteAll={() => {
            clearDrafts(worldTag);
            setDrafts([]);
            if (events.size === 0) {
              navigateToLobby();
            }
          }}
        />
      )}

      {/* Event editor */}
      {editorState && (
        <EventEditor
          eventType={editorState.eventType}
          worldSlug={worldTag}
          pubkey={identity.pubkey}
          signer={identity.signer}
          pool={pool}
          events={mergedEvents}
          eventTemplate={editorState.eventTemplate || null}
          initialTags={editorState.initialTags || []}
          zIndex={buildMode ? 110 : undefined}
          startInPreview={editorState.showPreview || false}
          onSaveDraft={(eventTemplate) => {
            const draftId = editorState.eventTemplate?._draft?.id;
            if (draftId) {
              updateDraft(worldTag, draftId, eventTemplate);
            } else {
              saveDraft(worldTag, eventTemplate);
            }
            setDrafts(loadDrafts(worldTag));
          }}
          onPublished={() => {
            // If was a draft, remove it
            const draftId = editorState.eventTemplate?._draft?.id;
            if (draftId) {
              deleteDraft(worldTag, draftId);
              setDrafts(loadDrafts(worldTag));
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

          if (entry.type === 'death-separator') {
            return <p key={i} className={extraClass} style={style}>{'─'.repeat(40)}</p>;
          }
          if (entry.html) {
            return <div key={i} className={extraClass} style={style} dangerouslySetInnerHTML={{ __html: entry.html }} />;
          }
          return <p key={i} className={extraClass} style={style}>{entry.text}</p>;
        })}
        <div ref={logEndRef} />
      </div>

      {status === 'ready' && (
        <form onSubmit={onSubmit} className="flex gap-2 shrink-0 pb-1">
          <span style={{ color: craftingActive ? 'var(--colour-puzzle)' : 'var(--colour-text)' }}>
            {dialogueActive ? '#' : puzzleActive ? '?' : craftingActive ? '+' : '>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none font-mono"
            style={{ color: craftingActive ? 'var(--colour-puzzle)' : 'var(--colour-text)' }}
            placeholder={dialogueActive ? 'Choose an option...' : puzzleActive ? 'Enter your answer...' : craftingActive ? 'Select an item...' : ''}
            onKeyDown={onKeyDown}
            autoFocus={!isTouchDevice}
          />
        </form>
      )}
    </div>
    </>
  );
}
