/**
 * PlayerStateMutator — synchronous mutable wrapper around a player state snapshot.
 * No React imports. Provides the same API as usePlayerState but operates on a
 * plain object, so reads within a single command always see the latest writes.
 */
export class PlayerStateMutator {
  constructor(snapshot) {
    // Deep-clone so mutations here never touch the original object
    this.state = JSON.parse(JSON.stringify(snapshot));
  }

  // ── Inventory ───────────────────────────────────────────────────────────

  hasItem(dtag) {
    return this.state.inventory.includes(dtag);
  }

  pickUp(dtag) {
    if (!this.state.inventory.includes(dtag)) {
      this.state.inventory = [...this.state.inventory, dtag];
    }
  }

  // ── Flags ───────────────────────────────────────────────────────────────

  hasFlag(flag) {
    return !!this.state.flags[flag];
  }

  setFlag(flag) {
    this.state.flags = { ...this.state.flags, [flag]: true };
  }

  // ── Crypto Keys ─────────────────────────────────────────────────────────

  addCryptoKey(key) {
    if (!this.state.cryptoKeys.includes(key)) {
      this.state.cryptoKeys = [...this.state.cryptoKeys, key];
    }
  }

  hasCryptoKey(key) {
    return this.state.cryptoKeys.includes(key);
  }

  // ── Clues ───────────────────────────────────────────────────────────────

  markClueSeen(dtag) {
    if (!this.state.cluesSeen.includes(dtag)) {
      this.state.cluesSeen = [...this.state.cluesSeen, dtag];
    }
  }

  isClueSeen(dtag) {
    return this.state.cluesSeen.includes(dtag);
  }

  // ── Puzzles ─────────────────────────────────────────────────────────────

  markPuzzleSolved(dtag) {
    if (!this.state.puzzlesSolved.includes(dtag)) {
      this.state.puzzlesSolved = [...this.state.puzzlesSolved, dtag];
    }
  }

  isPuzzleSolved(dtag) {
    return this.state.puzzlesSolved.includes(dtag);
  }

  // ── Feature States ──────────────────────────────────────────────────────

  getFeatureState(dtag) {
    return this.state.featureStates[dtag];
  }

  setFeatureState(dtag, newState) {
    this.state.featureStates = { ...this.state.featureStates, [dtag]: newState };
  }

  // ── Item States ─────────────────────────────────────────────────────────

  getItemState(dtag) {
    return this.state.itemStates?.[dtag];
  }

  setItemState(dtag, newState) {
    this.state.itemStates = { ...this.state.itemStates, [dtag]: newState };
  }

  // ── Dialogue ────────────────────────────────────────────────────────────

  markDialogueVisited(dtag) {
    const visited = this.state.dialogueVisited || [];
    if (!visited.includes(dtag)) {
      this.state.dialogueVisited = [...visited, dtag];
    }
  }

  isDialogueVisited(dtag) {
    return (this.state.dialogueVisited || []).includes(dtag);
  }

  // ── Portal States ───────────────────────────────────────────────────────

  getPortalState(dtag) {
    return this.state.portalStates?.[dtag];
  }

  setPortalState(dtag, newState) {
    this.state.portalStates = { ...this.state.portalStates, [dtag]: newState };
  }

  // ── Counters ────────────────────────────────────────────────────────────

  getCounter(key) {
    return this.state.itemCounters?.[key];
  }

  setCounter(key, value) {
    this.state.itemCounters = { ...this.state.itemCounters, [key]: value };
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  reset() {
    this.state = {
      inventory: [], flags: {}, cryptoKeys: [], cluesSeen: [],
      puzzlesSolved: [], featureStates: {}, itemStates: {},
      itemCounters: {}, portalStates: {}, dialogueVisited: [],
    };
  }
}
