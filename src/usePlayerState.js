import { useState } from 'react';
import { WORLD_TAG } from './config.js';

const STORAGE_KEY = WORLD_TAG;
const OLD_STORAGE_KEY = 'the-lake:player';

function freshPlayerState() {
  return {
    place: null,
    inventory: [],
    states: {},
    counters: {},
    cryptoKeys: [],
    dialogueVisited: {},
    paymentAttempts: {},
    visited: [],
    moveCount: 0,
  };
}

/**
 * Migrate from old flat storage (pre Phase 11) to new world-keyed structure.
 * Returns the migrated store or null if no old data.
 */
function migrateOldState() {
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw);

    // Merge all type-specific state maps into unified `states`
    const states = {};
    if (old.featureStates) Object.assign(states, old.featureStates);
    if (old.itemStates) Object.assign(states, old.itemStates);
    if (old.portalStates) Object.assign(states, old.portalStates);
    if (old.puzzlesSolved) {
      for (const dtag of old.puzzlesSolved) states[dtag] = 'solved';
    }
    if (old.cluesSeen) {
      for (const dtag of old.cluesSeen) states[dtag] = 'seen';
    }

    // Convert dialogueVisited array → object
    const dialogueVisited = {};
    if (Array.isArray(old.dialogueVisited)) {
      for (const dtag of old.dialogueVisited) dialogueVisited[dtag] = 'visited';
    }

    const migrated = {
      place: null,
      inventory: old.inventory || [],
      states,
      counters: old.itemCounters || {},
      cryptoKeys: old.cryptoKeys || [],
      dialogueVisited,
      paymentAttempts: {},
      visited: [],
      moveCount: 0,
    };

    const store = { player: migrated };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    localStorage.removeItem(OLD_STORAGE_KEY);

    return store;
  } catch {
    return null;
  }
}

/**
 * Load the full store: { player: {...}, "npc-dtag": {...}, ... }
 */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store?.player) {
        // Ensure moveCount exists (migration from pre-Phase 13)
        if (store.player.moveCount === undefined) store.player.moveCount = 0;
        return store;
      }
    }

    const migrated = migrateOldState();
    if (migrated) return migrated;
  } catch {}
  return { player: freshPlayerState() };
}

/**
 * Extract NPC states from a store (everything except `player`).
 */
function extractNpcStates(store) {
  const npcStates = {};
  for (const key of Object.keys(store)) {
    if (key !== 'player') npcStates[key] = store[key];
  }
  return npcStates;
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function usePlayerState() {
  const [store, setStore] = useState(loadStore);

  function update(fn) {
    setStore((prev) => {
      const next = { ...prev, player: fn(prev.player) };
      saveStore(next);
      return next;
    });
  }

  const state = store.player;
  const npcStates = extractNpcStates(store);

  return {
    state,
    npcStates,

    // ── Inventory ─────────────────────────────────────────────────────
    hasItem: (dtag) => state.inventory.includes(dtag),
    pickUp: (dtag) => update((s) => ({
      ...s,
      inventory: s.inventory.includes(dtag) ? s.inventory : [...s.inventory, dtag],
    })),

    // ── Unified state ─────────────────────────────────────────────────
    getState: (dtag) => state.states?.[dtag],
    setState: (dtag, val) => update((s) => ({
      ...s,
      states: { ...s.states, [dtag]: val },
    })),

    // ── Crypto keys ───────────────────────────────────────────────────
    addCryptoKey: (key) => update((s) => ({
      ...s,
      cryptoKeys: s.cryptoKeys.includes(key) ? s.cryptoKeys : [...s.cryptoKeys, key],
    })),
    hasCryptoKey: (key) => state.cryptoKeys.includes(key),

    // ── Dialogue ──────────────────────────────────────────────────────
    markDialogueVisited: (dtag) => update((s) => ({
      ...s,
      dialogueVisited: { ...s.dialogueVisited, [dtag]: 'visited' },
    })),
    isDialogueVisited: (dtag) => state.dialogueVisited?.[dtag] === 'visited',

    // ── Counters ──────────────────────────────────────────────────────
    getCounter: (key) => state.counters?.[key],
    setCounter: (key, value) => update((s) => ({
      ...s,
      counters: { ...s.counters, [key]: value },
    })),

    // ── Place ─────────────────────────────────────────────────────────
    setPlace: (dtag) => update((s) => ({
      ...s,
      place: dtag,
      visited: s.visited.includes(dtag) ? s.visited : [...s.visited, dtag],
    })),

    // ── Bulk operations ───────────────────────────────────────────────
    replaceState: (newPlayerState, newNpcStates) => {
      const next = { player: newPlayerState };
      if (newNpcStates) {
        for (const [key, val] of Object.entries(newNpcStates)) {
          next[key] = val;
        }
      }
      saveStore(next);
      setStore(next);
    },
    reset: () => {
      const fresh = { player: freshPlayerState() };
      saveStore(fresh);
      setStore(fresh);
    },
  };
}
