/**
 * PlayerStateMutator — synchronous mutable wrapper around a player state snapshot.
 * No React imports. Provides the same API as usePlayerState but operates on a
 * plain object, so reads within a single command always see the latest writes.
 *
 * Phase 11: unified `states` map replaces featureStates/itemStates/portalStates/puzzlesSolved/cluesSeen.
 * Phase 13: adds moveCount, NPC state management, place inventories.
 *
 * Entity states (npcStates) are stored as siblings to `player` in the store:
 *   { player: {...}, "world:npc:thief": {...}, "world:place:cave": { inventory: [...] } }
 */
export class PlayerStateMutator {
  /**
   * @param {Object} playerSnapshot — player state
   * @param {Object} [npcStates] — map of entityDtag → state object (NPCs + places)
   */
  constructor(playerSnapshot, npcStates = {}) {
    // Deep-clone so mutations here never touch the original objects
    this.state = JSON.parse(JSON.stringify(playerSnapshot));
    this.npcStates = JSON.parse(JSON.stringify(npcStates));
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

  removeItem(dtag) {
    this.state.inventory = this.state.inventory.filter((d) => d !== dtag);
  }

  // ── Place Items ───────────────────────────────────────────────────────────

  /** Get the item list for a place. Returns array of item dtags, or null if not yet seeded. */
  getPlaceItems(placeDtag) {
    return this.npcStates[placeDtag]?.inventory || null;
  }

  /** Seed a place's item list (from room item tags on first visit). Idempotent.
   *  Skips writing if inventory would be empty — no key = not yet seeded. */
  seedPlaceItems(placeDtag, itemDtags) {
    if (this.npcStates[placeDtag]?.inventory) return; // already seeded
    if (itemDtags.length === 0) return; // nothing to seed — keep key absent
    this.npcStates = {
      ...this.npcStates,
      [placeDtag]: { ...this.npcStates[placeDtag], inventory: [...itemDtags] },
    };
  }

  /** Remove an item from a place (player picked it up).
   *  Keeps { inventory: [] } as "seeded but empty" to prevent re-seeding. */
  removePlaceItem(placeDtag, itemDtag) {
    const items = this.npcStates[placeDtag]?.inventory;
    if (!items) return;
    this.npcStates = {
      ...this.npcStates,
      [placeDtag]: {
        ...this.npcStates[placeDtag],
        inventory: items.filter((d) => d !== itemDtag),
      },
    };
  }

  /** Add an item to a place (deposited by NPC, dropped by player). */
  addPlaceItem(placeDtag, itemDtag) {
    const items = this.npcStates[placeDtag]?.inventory || [];
    if (items.includes(itemDtag)) return;
    this.npcStates = {
      ...this.npcStates,
      [placeDtag]: {
        ...this.npcStates[placeDtag],
        inventory: [...items, itemDtag],
      },
    };
  }

  // ── Unified state ──────────────────────────────────────────────────────

  getState(dtag) {
    return this.state.states?.[dtag];
  }

  setState(dtag, val) {
    this.state.states = { ...this.state.states, [dtag]: val };
  }

  // Convenience wrappers — read/write the unified map
  isPuzzleSolved(dtag) { return this.getState(dtag) === 'solved'; }
  markPuzzleSolved(dtag) { this.setState(dtag, 'solved'); }
  isClueSeen(dtag) { return this.getState(dtag) === 'seen'; }
  markClueSeen(dtag) { this.setState(dtag, 'seen'); }

  // ── Crypto Keys ─────────────────────────────────────────────────────────

  addCryptoKey(key) {
    if (!this.state.cryptoKeys.includes(key)) {
      this.state.cryptoKeys = [...this.state.cryptoKeys, key];
    }
  }

  hasCryptoKey(key) {
    return this.state.cryptoKeys.includes(key);
  }

  // ── Dialogue ────────────────────────────────────────────────────────────

  markDialogueVisited(dtag) {
    this.state.dialogueVisited = { ...this.state.dialogueVisited, [dtag]: 'visited' };
  }

  isDialogueVisited(dtag) {
    return this.state.dialogueVisited?.[dtag] === 'visited';
  }

  // ── Counters ────────────────────────────────────────────────────────────

  getCounter(key) {
    return this.state.counters?.[key];
  }

  setCounter(key, value) {
    this.state.counters = { ...this.state.counters, [key]: value };
  }

  // ── Move Count ──────────────────────────────────────────────────────────

  getMoveCount() {
    return this.state.moveCount || 0;
  }

  incrementMoveCount() {
    this.state.moveCount = (this.state.moveCount || 0) + 1;
  }

  // ── Place ───────────────────────────────────────────────────────────────

  setPlace(dtag) {
    this.state.place = dtag;
    if (!this.state.visited.includes(dtag)) {
      this.state.visited = [...this.state.visited, dtag];
    }
  }

  // ── NPC State ───────────────────────────────────────────────────────────

  getNpcState(npcDtag) {
    return this.npcStates[npcDtag] || null;
  }

  setNpcState(npcDtag, npcState) {
    this.npcStates = { ...this.npcStates, [npcDtag]: npcState };
  }

  /** Ensure NPC state is initialized; returns existing or newly created state. */
  ensureNpcState(npcDtag, initialState) {
    if (!this.npcStates[npcDtag]) {
      this.npcStates = { ...this.npcStates, [npcDtag]: initialState };
    }
    return this.npcStates[npcDtag];
  }

  /** Record an item stolen from the player (steals-item action). */
  npcPickUp(npcDtag, itemDtag) {
    const npc = this.getNpcState(npcDtag);
    if (!npc) return;
    const stolen = npc.stolen || [];
    if (!stolen.includes(itemDtag)) {
      this.setNpcState(npcDtag, { ...npc, stolen: [...stolen, itemDtag] });
    }
  }

  /** Drop all stolen items from NPC (used by stash deposit mechanic). Returns dropped items.
   *  Native inventory (declared via inventory tags) is never deposited automatically. */
  npcDropAll(npcDtag) {
    const npc = this.getNpcState(npcDtag);
    const stolen = npc?.stolen || [];
    if (stolen.length === 0) return [];
    this.setNpcState(npcDtag, { ...npc, stolen: [] });
    return stolen;
  }

  // ── Payments ────────────────────────────────────────────────────────────

  getPaymentStatus(dtag) {
    return this.state.paymentAttempts?.[dtag]?.status || null;
  }

  setPaymentStatus(dtag, status, verifyUrl) {
    if (!this.state.paymentAttempts) this.state.paymentAttempts = {};
    const existing = this.state.paymentAttempts[dtag] || {};
    this.state.paymentAttempts[dtag] = {
      ...existing,
      status,
      ...(verifyUrl ? { verifyUrl } : {}),
    };
  }

  // ── Health ──────────────────────────────────────────────────────────────

  getHealth() { return this.state.health ?? null; }
  getMaxHealth() { return this.state.maxHealth ?? null; }

  setHealth(val) { this.state.health = val; }
  setMaxHealth(val) { this.state.maxHealth = val; }

  dealDamage(amount) {
    if (this.state.health == null) return;
    this.state.health = Math.max(0, this.state.health - amount);
  }

  heal(amount) {
    if (this.state.health == null) return;
    const max = this.state.maxHealth ?? this.state.health;
    this.state.health = Math.min(max, this.state.health + amount);
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  reset() {
    this.state = {
      place: null,
      inventory: [],
      states: {},
      counters: {},
      cryptoKeys: [],
      dialogueVisited: {},
      paymentAttempts: {},
      visited: [],
      moveCount: 0,
      health: null,
      maxHealth: null,
    };
    this.npcStates = {};
  }
}
