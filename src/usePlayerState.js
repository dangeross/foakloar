import { useState } from 'react';

const STORAGE_KEY = 'the-lake:player';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { inventory: [], flags: {}, cryptoKeys: [], cluesSeen: [], puzzlesSolved: [], featureStates: {}, itemStates: {}, itemCounters: {}, portalStates: {}, dialogueVisited: [] };
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function usePlayerState() {
  const [state, setState] = useState(load);

  function update(fn) {
    setState((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }

  return {
    state,
    hasItem: (dtag) => state.inventory.includes(dtag),
    pickUp: (dtag) => update((s) => ({
      ...s,
      inventory: s.inventory.includes(dtag) ? s.inventory : [...s.inventory, dtag],
    })),
    hasFlag: (flag) => !!state.flags[flag],
    setFlag: (flag) => update((s) => ({
      ...s,
      flags: { ...s.flags, [flag]: true },
    })),
    addCryptoKey: (key) => update((s) => ({
      ...s,
      cryptoKeys: s.cryptoKeys.includes(key) ? s.cryptoKeys : [...s.cryptoKeys, key],
    })),
    hasCryptoKey: (key) => state.cryptoKeys.includes(key),
    markClueSeen: (dtag) => update((s) => ({
      ...s,
      cluesSeen: s.cluesSeen.includes(dtag) ? s.cluesSeen : [...s.cluesSeen, dtag],
    })),
    isClueSeen: (dtag) => state.cluesSeen.includes(dtag),
    markPuzzleSolved: (dtag) => update((s) => ({
      ...s,
      puzzlesSolved: s.puzzlesSolved.includes(dtag) ? s.puzzlesSolved : [...s.puzzlesSolved, dtag],
    })),
    isPuzzleSolved: (dtag) => state.puzzlesSolved.includes(dtag),
    getFeatureState: (dtag) => state.featureStates[dtag],
    setFeatureState: (dtag, newState) => update((s) => ({
      ...s,
      featureStates: { ...s.featureStates, [dtag]: newState },
    })),
    getItemState: (dtag) => state.itemStates?.[dtag],
    setItemState: (dtag, newState) => update((s) => ({
      ...s,
      itemStates: { ...s.itemStates, [dtag]: newState },
    })),
    markDialogueVisited: (dtag) => update((s) => ({
      ...s,
      dialogueVisited: (s.dialogueVisited || []).includes(dtag) ? (s.dialogueVisited || []) : [...(s.dialogueVisited || []), dtag],
    })),
    isDialogueVisited: (dtag) => (state.dialogueVisited || []).includes(dtag),
    getPortalState: (dtag) => state.portalStates?.[dtag],
    setPortalState: (dtag, newState) => update((s) => ({
      ...s,
      portalStates: { ...s.portalStates, [dtag]: newState },
    })),
    getCounter: (key) => state.itemCounters?.[key],
    setCounter: (key, value) => update((s) => ({
      ...s,
      itemCounters: { ...s.itemCounters, [key]: value },
    })),
    replaceState: (newState) => {
      save(newState);
      setState(newState);
    },
    reset: () => {
      const fresh = { inventory: [], flags: {}, cryptoKeys: [], cluesSeen: [], puzzlesSolved: [], featureStates: {}, itemStates: {}, itemCounters: {}, portalStates: {}, dialogueVisited: [] };
      save(fresh);
      setState(fresh);
    },
  };
}
