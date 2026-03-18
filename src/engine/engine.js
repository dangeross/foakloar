/**
 * GameEngine — central orchestrator for the NOSTR dungeon game.
 * No React imports. Plain JS class.
 */

import {
  getTag, getTags, resolveExits, resolveExitsWithTrust, checkRequires,
  findByNoun, aTagOf, getDefaultState, findTransition,
} from './world.js';
import { getTrustLevel } from './trust.js';
import { derivePrivateKey } from './nip44-client.js';
import { renderRoomContent } from './content.js';
import { stripArticles, buildVerbMap, parseInput, findInventoryItem } from './parser.js';
import {
  applyExternalSetState, giveItem, evalCounterLow, evalSequencePuzzles,
} from './actions.js';
import { calculateNpcPlace, initNpcState, findRoamingNpcsAtPlace } from './npc.js';

export class GameEngine {
  /**
   * @param {Object} opts
   * @param {Map} opts.events — Map<a-tag, event>
   * @param {import('./player-state.js').PlayerStateMutator} opts.player
   * @param {{ GENESIS_PLACE: string, AUTHOR_PUBKEY: string, trustSet?: Object, clientMode?: string }} opts.config
   */
  constructor({ events, player, config }) {
    this.events = events;
    this.player = player;
    this.config = config;

    // Restore position from saved state, or start at genesis
    this.currentPlace = player.state.place || config.GENESIS_PLACE;
    this.puzzleActive = null;
    this.dialogueActive = null;
    this.paymentActive = null;   // { dtag, lnurl, amount, unit, description }
    this.pendingConfirm = null;
    this.pendingChoice = null;  // { direction, exits } — disambiguation list awaiting numeric input

    /** @type {Array<{text?: string, html?: string, type: string}>} */
    this.output = [];
  }

  // ── Output helpers ────────────────────────────────────────────────────

  _emit(text, type = 'narrative') {
    this.output.push({ text, type });
  }

  _emitHtml(html, type = 'narrative') {
    this.output.push({ html, type });
  }

  /**
   * Return and clear the output buffer.
   */
  flush() {
    const out = this.output;
    this.output = [];
    return out;
  }

  /**
   * Return the player state snapshot for committing to React.
   */
  getPlayerState() {
    return this.player.state;
  }

  // ── Convenience getters ───────────────────────────────────────────────

  get place() {
    return this.events.get(this.currentPlace);
  }

  /**
   * Resolve exits for the current place with trust filtering.
   * Returns { exits, hiddenByTrust } when trust is active.
   */
  get exitData() {
    return this._resolveRoomExits(this.currentPlace);
  }

  /** Shortcut: visible exits only (for movement). */
  get exits() {
    return this.exitData.exits;
  }

  // ── Room entry ────────────────────────────────────────────────────────

  enterRoom(dtag, { isMoving = false } = {}) {
    const room = this.events.get(dtag);
    if (!room) { this._emit("You can't go that way.", 'error'); return; }
    this.currentPlace = dtag;
    this.player.setPlace(dtag);
    this.puzzleActive = null;
    this.dialogueActive = null;
    this.pendingChoice = null;

    const title = getTag(room, 'title') || dtag;
    this._emit(`\n— ${title} —`, 'title');

    // Check place requires
    const placeReq = checkRequires(room, this.player.state, this.events);
    if (!placeReq.allowed) {
      this._emit(placeReq.reason, 'narrative');
      const { exits: roomExits } = this._resolveRoomExits(dtag);
      if (roomExits.length > 0) {
        const slots = [...new Set(roomExits.map((e) => e.slot))];
        this._emit(`Exits: ${slots.join(', ')}`, 'exits');
      }
      return;
    }

    // Render content
    const contentEntries = renderRoomContent(room, this.player.state.cryptoKeys);
    for (const entry of contentEntries) {
      if (entry.html) {
        this._emitHtml(entry.html, entry.type);
      } else {
        this._emit(entry.text, entry.type);
      }
    }

    // Seed place items on first visit (from room's item tags)
    this._seedPlaceItems(dtag, room);

    // Items — show what's on the ground at this place
    const placeItems = this.player.getPlaceItems(dtag) || [];
    for (const itemDtag of placeItems) {
      const item = this.events.get(itemDtag);
      if (item) this._emit(`You see: ${getTag(item, 'title')}`, 'item');
    }

    // Features (skip hidden)
    for (const ref of getTags(room, 'feature')) {
      const fDTag = ref[1];  // full a-tag
      const feature = this.events.get(fDTag);
      if (!feature) continue;
      const fDefaultState = getDefaultState(feature);
      const fCurrentState = this.player.getState(fDTag) ?? fDefaultState;
      if (fCurrentState === 'hidden') continue;
      this._emit(`There is a ${getTag(feature, 'title')} here.`, 'feature');
    }

    // Static NPCs (placed by the room)
    for (const ref of getTags(room, 'npc')) {
      const npcDTag = ref[1];  // full a-tag
      const npc = this.events.get(npcDTag);
      if (!npc) continue;
      // Skip roaming NPCs here — they're handled below
      if (getTags(npc, 'route').length > 0) continue;
      const npcReq = checkRequires(npc, this.player.state, this.events);
      if (!npcReq.allowed) continue;
      this._emit(`${getTag(npc, 'title')} is here.`, 'npc');
    }

    // Roaming NPCs — check if any are currently at this place
    const roamingHere = findRoamingNpcsAtPlace(
      this.events, dtag, this.player.getMoveCount(),
      (npcDtag) => this.player.getNpcState(npcDtag),
    );
    for (const { npcEvent, npcDtag } of roamingHere) {
      const npcReq = checkRequires(npcEvent, this.player.state, this.events);
      if (!npcReq.allowed) continue;
      // Ensure NPC state is initialized
      this.player.ensureNpcState(npcDtag, initNpcState(npcEvent));
      this._emit(`${getTag(npcEvent, 'title')} is here.`, 'npc');
      // Fire on-encounter triggers only on actual movement, not on look
      if (isMoving) {
        this._fireNpcEncounter(npcEvent, npcDtag);
      }
    }

    // Exits — spec 6.7 contested exit model
    this._emitExits(dtag);
  }

  // ── Trust-aware exit resolution ──────────────────────────────────────

  /**
   * Returns { exits, hiddenByTrust } for a place.
   * Without trust set, hiddenByTrust is always empty.
   */
  _resolveRoomExits(dtag) {
    const { trustSet, clientMode } = this.config;
    if (trustSet) {
      return resolveExitsWithTrust(
        this.events, dtag, this.player.state,
        trustSet, clientMode || 'community', getTrustLevel,
      );
    }
    const raw = resolveExits(this.events, dtag, this.player.state);
    return {
      exits: raw.map((e) => ({ ...e, trusted: true, trustLevel: 'trusted', contested: false })),
      hiddenByTrust: [],
    };
  }

  // ── Exit display (spec 6.7) ─────────────────────────────────────────

  /**
   * Emit exit lines for a room. Handles:
   * - Trusted exits listed normally
   * - Multiple trusted on same slot → `slot (N paths)`
   * - Unverified-only slot → listed with `[unverified]` marker
   * - `[+N unverified]` hint when trusted portal exists but hidden alternatives do too
   */
  _emitExits(dtag) {
    const { exits, hiddenByTrust } = this._resolveRoomExits(dtag);
    if (exits.length === 0 && hiddenByTrust.length === 0) return;

    // Group visible exits by slot
    const slotGroups = {};
    for (const exit of exits) {
      if (!slotGroups[exit.slot]) slotGroups[exit.slot] = [];
      slotGroups[exit.slot].push(exit);
    }

    // Count hidden exits per slot (for [+N unverified] hint)
    const hiddenPerSlot = {};
    for (const exit of hiddenByTrust) {
      hiddenPerSlot[exit.slot] = (hiddenPerSlot[exit.slot] || 0) + 1;
    }

    const labels = [];
    const unverifiedOnlySlots = [];

    for (const [slot, slotExits] of Object.entries(slotGroups)) {
      const trustedCount = slotExits.filter((e) => e.trustLevel === 'trusted').length;
      const unverifiedCount = slotExits.filter((e) => e.trustLevel === 'unverified').length;

      if (trustedCount > 1) {
        // Multiple trusted portals on same slot → disambiguation needed
        labels.push(`${slot} (${trustedCount} paths)`);
      } else if (trustedCount === 1 && unverifiedCount === 0) {
        // Single trusted, no unverified visible — simple
        labels.push(slot);
      } else if (trustedCount === 1 && unverifiedCount > 0) {
        // Trusted wins the slot, but unverified exist — just show the slot
        labels.push(slot);
      } else if (trustedCount === 0 && unverifiedCount > 0) {
        // Only unverified on this slot
        unverifiedOnlySlots.push({ slot, count: unverifiedCount });
      }
    }

    // Emit the main exits line
    if (labels.length > 0) {
      this._emit(`Exits: ${labels.join(', ')}`, 'exits');
    }

    // Unverified-only slots (open + community or vouched + explorer)
    if (unverifiedOnlySlots.length > 0) {
      for (const { slot, count } of unverifiedOnlySlots) {
        const prefix = labels.length > 0 ? '       ' : 'Exits: ';
        if (count === 1) {
          this._emit(`${prefix}${slot} (unverified)`, 'exits-untrusted');
        } else {
          this._emit(`${prefix}${slot} (${count} unverified paths)`, 'exits-untrusted');
        }
      }
    }

    // [+N unverified] hints for slots that have a trusted portal but also unverified/hidden alternatives
    // Only shown in community/explorer mode — in canonical mode, hidden portals are fully invisible
    const mode = this.config.clientMode || 'community';
    if (mode !== 'canonical') {
      // Count hidden-by-trust exits per slot
      for (const [slot, count] of Object.entries(hiddenPerSlot)) {
        if (slotGroups[slot]?.some((e) => e.trustLevel === 'trusted')) {
          this._emit(`[+${count} unverified path${count > 1 ? 's' : ''} ${slot} — type "look ${slot}" to see]`, 'exits-untrusted');
        }
      }
      // Count visible unverified exits on slots that also have a trusted exit
      for (const [slot, slotExits] of Object.entries(slotGroups)) {
        if (hiddenPerSlot[slot]) continue; // already emitted above
        const unverifiedOnSlot = slotExits.filter((e) => e.trustLevel === 'unverified').length;
        const hasTrusted = slotExits.some((e) => e.trustLevel === 'trusted');
        if (hasTrusted && unverifiedOnSlot > 0) {
          this._emit(`[+${unverifiedOnSlot} unverified path${unverifiedOnSlot > 1 ? 's' : ''} ${slot} — type "look ${slot}" to see]`, 'exits-untrusted');
        }
      }
    }

    // Contested trusted portals — show details
    for (const [slot, slotExits] of Object.entries(slotGroups)) {
      const trusted = slotExits.filter((e) => e.trustLevel === 'trusted');
      if (trusted.length > 1) {
        for (let i = 0; i < trusted.length; i++) {
          const label = trusted[i].label || `path ${i + 1}`;
          this._emit(`  ${slot} ${i + 1}: ${label}`, 'exits');
        }
      }
    }
  }

  /**
   * Handle `look <direction>` — shows full list of all portals on a slot.
   * Examination only, never navigates. Shows trusted and hidden portals.
   */
  handleLookDirection(direction) {
    const { exits, hiddenByTrust } = this._resolveRoomExits(this.currentPlace);
    const mode = this.config.clientMode || 'community';

    // Collect portals on this slot — in canonical mode, hidden portals stay invisible
    const allOnSlot = [
      ...exits.filter((e) => e.slot === direction),
      ...(mode !== 'canonical' ? hiddenByTrust.filter((e) => e.slot === direction) : []),
    ];

    if (allOnSlot.length === 0) {
      this._emit(`Nothing leads ${direction}.`, 'narrative');
      return;
    }

    this._emit(`Paths ${direction}:`, 'narrative');
    for (let i = 0; i < allOnSlot.length; i++) {
      const exit = allOnSlot[i];
      const label = exit.label || `path ${i + 1}`;
      const pubkey = exit.portalEvent.pubkey;
      const shortPk = pubkey.slice(0, 12) + '...';

      let indicator;
      if (exit.trustLevel === 'trusted') {
        indicator = '(trusted)';
      } else if (exit.trustLevel === 'unverified') {
        indicator = '(unverified)';
      } else {
        indicator = '(unverified)';
      }

      // Show cw tags if present
      const cwTags = getTags(exit.portalEvent, 'cw');
      const cwWarning = cwTags.length > 0 ? ` [cw: ${cwTags.map((t) => t[1]).join(', ')}]` : '';

      const type = exit.trustLevel === 'trusted' ? 'exits' : 'exits-untrusted';
      this._emit(`  ${i + 1}. ${label} ${indicator} [${shortPk}]${cwWarning}`, type);
    }

    // Allow numeric selection after viewing the list
    if (allOnSlot.length > 1) {
      const hasUnverified = allOnSlot.some((e) => e.trustLevel !== 'trusted');
      this.pendingChoice = { direction, exits: allOnSlot, unverified: hasUnverified };
    }
  }

  // ── Place items ─────────────────────────────────────────────────────

  /** Seed a place's item inventory from its room event tags (first visit only). */
  _seedPlaceItems(placeDtag, roomEvent) {
    if (this.player.getPlaceItems(placeDtag)) return; // already seeded
    const itemDtags = getTags(roomEvent, 'item').map((ref) => ref[1]);  // full a-tags
    // Exclude items held by player or any NPC
    const onGround = itemDtags.filter((d) => {
      if (this.player.hasItem(d)) return false;
      // Check all NPC inventories
      for (const npc of Object.values(this.player.npcStates)) {
        if (npc.inventory && npc.inventory.includes(d)) return false;
      }
      return true;
    });
    this.player.seedPlaceItems(placeDtag, onGround);
  }

  /** Find an item on the ground at the current place by noun. */
  _findPlaceItem(noun) {
    const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
    for (const itemDtag of placeItems) {
      const item = this.events.get(itemDtag);
      if (!item) continue;
      const title = getTag(item, 'title')?.toLowerCase() || '';
      if (title.includes(noun)) return { event: item, dtag: itemDtag, type: 'item' };
      for (const nt of getTags(item, 'noun')) {
        for (let i = 1; i < nt.length; i++) {
          if (nt[i].toLowerCase() === noun) return { event: item, dtag: itemDtag, type: 'item' };
        }
      }
    }
    return null;
  }

  // ── Examine inventory item ────────────────────────────────────────────

  examineInventoryItem(invMatch) {
    const desc = invMatch.event.content;
    if (desc) this._emit(desc, 'narrative');
    const itemState = this.player.getState(invMatch.dtag);
    if (itemState) this._emit(`It is currently ${itemState}.`, 'narrative');
    for (const ct of getTags(invMatch.event, 'counter')) {
      const key = `${invMatch.dtag}:${ct[1]}`;
      const val = this.player.getCounter(key);
      if (val !== undefined) {
        const max = parseInt(ct[2], 10);
        this._emit(`${ct[1]}: ${val}/${max}`, 'narrative');
      }
    }
  }

  // ── Feature interaction ───────────────────────────────────────────────

  processFeatureInteract(event, dtag, verb, currentState) {
    let acted = false;
    for (const tag of getTags(event, 'on-interact')) {
      if (tag[1] !== verb) continue;
      const action = tag[2];
      const targetState = tag[3];
      const targetRef = tag[4];

      if (action === 'set-state' && targetRef) {
        const result = applyExternalSetState(
          targetRef, targetState, this.events, this.player,
          (t, ty) => this._emit(t, ty),
          (h, ty) => this._emitHtml(h, ty),
        );
        if (result.puzzleActivated) {
          this.puzzleActive = result.puzzleActivated;
        }
        if (result.acted) acted = true;
      } else if (action === 'set-state' && !targetRef && currentState) {
        const transition = findTransition(event, currentState, targetState);
        if (transition) {
          if (transition.from === transition.to) {
            if (transition.text) this._emit(transition.text, 'narrative');
          } else {
            this.player.setState(dtag, transition.to);
            if (transition.text) this._emit(transition.text, 'narrative');
            currentState = transition.to;
          }
          acted = true;
        }
      } else if (action === 'give-item') {
        const itemDTag = targetState;  // targetState is the item a-tag ref
        if (!this.player.hasItem(itemDTag)) {
          giveItem(targetState, this.events, this.player, (t, ty) => this._emit(t, ty));
        }
        acted = true;
      } else if (action === 'consume-item') {
        const consumeDtag = targetState || targetRef;  // item a-tag ref
        if (consumeDtag && this.player.hasItem(consumeDtag)) {
          this.player.removeItem(consumeDtag);
          const consumeEvent = this.events.get(consumeDtag);
          const consumeTitle = consumeEvent ? getTag(consumeEvent, 'title') : consumeDtag;
          this._emit(`${consumeTitle} is consumed.`, 'item');
        }
        acted = true;
      } else if (action === 'consequence') {
        const cRef = targetState || targetRef;
        if (cRef) this._executeConsequence(cRef);
        acted = true;
      } else if (action === 'traverse') {
        const pRef = targetState || targetRef;
        if (pRef) this._traverse(pRef);
        acted = true;
      }
    }
    if (acted) evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty));
    return acted;
  }

  // ── Resolve feature from noun ─────────────────────────────────────────

  resolveFeature(noun) {
    if (!this.place) return null;

    const placeReq = checkRequires(this.place, this.player.state, this.events);
    if (!placeReq.allowed) {
      this._emit(placeReq.reason, 'error');
      return null;
    }

    const match = findByNoun(this.events, this.place, noun);
    if (!match || match.type !== 'feature') return null;

    const { event, dtag } = match;
    const fDefault = getDefaultState(event);
    const fCurrent = this.player.getState(dtag) ?? fDefault;
    if (fCurrent === 'hidden') return null;

    const featureReq = checkRequires(event, this.player.state, this.events);
    if (!featureReq.allowed) {
      this._emit(featureReq.reason, 'error');
      return null;
    }

    return { event, dtag, currentState: fCurrent };
  }

  // ── Examine ───────────────────────────────────────────────────────────

  handleExamine(noun) {
    if (!this.place) return;

    const placeReq = checkRequires(this.place, this.player.state, this.events);
    if (!placeReq.allowed) {
      const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
      if (invMatch) { this.examineInventoryItem(invMatch); return; }
      this._emit(placeReq.reason, 'error');
      return;
    }

    let match = findByNoun(this.events, this.place, noun);

    if (!match) {
      const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
      if (invMatch) { this.examineInventoryItem(invMatch); return; }
      this._emit("You don't see that here.", 'error');
      return;
    }

    const { event, dtag } = match;

    if (match.type === 'feature') {
      const fDefault = getDefaultState(event);
      const fCurrent = this.player.getState(dtag) ?? fDefault;
      if (fCurrent === 'hidden') {
        const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
        if (invMatch) { this.examineInventoryItem(invMatch); return; }
        this._emit("You don't see that here.", 'error');
        return;
      }
    }

    const featureReq = checkRequires(event, this.player.state, this.events);
    if (!featureReq.allowed) {
      this._emit(featureReq.reason, 'error');
      return;
    }

    const defaultState = getDefaultState(event);
    const currentState = this.player.getState(dtag) || defaultState;

    const desc = event.content;
    if (desc) this._emit(desc, 'narrative');

    this.processFeatureInteract(event, dtag, 'examine', currentState);
  }

  // ── Feature verb ──────────────────────────────────────────────────────

  handleFeatureVerb(verb, noun) {
    const resolved = this.resolveFeature(noun);
    if (!resolved) {
      this._emit("You don't see that here.", 'error');
      return;
    }
    const { event, dtag, currentState } = resolved;
    if (!this.processFeatureInteract(event, dtag, verb, currentState)) {
      this._emit('Nothing happens.', 'narrative');
    }
  }

  // ── Pickup ────────────────────────────────────────────────────────────

  handlePickup(rawNoun) {
    if (!this.place) return;
    const noun = stripArticles(rawNoun);

    // Check room items and place items by noun
    let match = this._findPlaceItem(noun);

    if (!match) {
      // Fall back to findByNoun for non-item matches (error messages)
      match = findByNoun(this.events, this.place, noun);
    }

    if (!match) { this._emit("You don't see that here.", 'error'); return; }
    if (match.type !== 'item') { this._emit("You can't pick that up.", 'error'); return; }
    if (this.player.hasItem(match.dtag)) { this._emit('You already have that.', 'error'); return; }

    this.player.pickUp(match.dtag);
    this.player.removePlaceItem(this.currentPlace, match.dtag);

    const defaultState = getDefaultState(match.event);
    if (defaultState) this.player.setState(match.dtag, defaultState);

    for (const ct of getTags(match.event, 'counter')) {
      this.player.setCounter(`${match.dtag}:${ct[1]}`, parseInt(ct[2], 10));
    }

    this._emit(`Taken: ${getTag(match.event, 'title')}`, 'item');
  }

  // ── Item interaction ──────────────────────────────────────────────────

  handleItemInteract(verb, noun) {
    const match = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (!match) { this._emit("You don't have that.", 'error'); return; }

    const { event, dtag } = match;
    const currentState = this.player.getState(dtag) || getDefaultState(event);

    let acted = false;
    for (const tag of getTags(event, 'on-interact')) {
      if (tag[1] !== verb) continue;
      const action = tag[2];
      const targetState = tag[3];
      const targetRef = tag[4];

      if (action === 'set-state' && targetRef) {
        const extDTag = targetRef;  // full a-tag
        const extEvent = this.events.get(extDTag);
        if (!extEvent) continue;

        const extType = getTag(extEvent, 'type');
        if (extType === 'feature') {
          const extCurrentState = this.player.getState(extDTag) ?? getDefaultState(extEvent);
          const transition = findTransition(extEvent, extCurrentState, targetState);
          if (transition) {
            if (transition.from !== transition.to) {
              this.player.setState(extDTag, transition.to);
            }
            if (transition.text) this._emit(transition.text, 'narrative');
            acted = true;
            evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty));
          }
        } else if (extType === 'portal') {
          const extCurrentState = this.player.getState(extDTag) ?? getDefaultState(extEvent);
          if (extCurrentState !== targetState) {
            this.player.setState(extDTag, targetState);
            const transition = findTransition(extEvent, extCurrentState, targetState);
            if (transition?.text) this._emit(transition.text, 'narrative');
          }
          acted = true;
        }
      } else if (action === 'set-state' && !targetRef) {
        const transition = findTransition(event, currentState, targetState);
        if (transition) {
          if (transition.from !== transition.to) {
            this.player.setState(dtag, transition.to);
          }
          if (transition.text) this._emit(transition.text, 'narrative');
          if (transition.from !== transition.to) {
            evalCounterLow(event, dtag, transition.to, this.player, (t, ty) => this._emit(t, ty));
          }
          acted = true;
        }
      } else if (action === 'consume-item') {
        // consume-item target is an item a-tag (usually self)
        const consumeDtag = targetState || dtag;
        if (this.player.hasItem(consumeDtag)) {
          this.player.removeItem(consumeDtag);
          const consumeEvent = this.events.get(consumeDtag);
          const consumeTitle = consumeEvent ? getTag(consumeEvent, 'title') : consumeDtag;
          this._emit(`${consumeTitle} is consumed.`, 'item');
        }
        acted = true;
      }
    }

    if (!acted) this._emit('Nothing happens.', 'narrative');
  }

  // ── On-move processing ────────────────────────────────────────────────

  processOnMove() {
    for (const dtag of this.player.state.inventory) {
      const item = this.events.get(dtag);
      if (!item) continue;
      const currentState = this.player.getState(dtag);

      for (const tag of getTags(item, 'on-move')) {
        if (tag[1] !== currentState) continue;

        if (tag[2] === 'decrement') {
          const counterName = tag[3];
          const amount = parseInt(tag[4], 10) || 1;
          const key = `${dtag}:${counterName}`;
          const current = this.player.getCounter(key);
          if (current === undefined || current <= 0) continue;

          const newVal = Math.max(0, current - amount);
          this.player.setCounter(key, newVal);

          // Unified on-counter: fires when counter crosses threshold downward
          for (const ct of getTags(item, 'on-counter')) {
            if (ct[1] !== counterName) continue;
            const threshold = parseInt(ct[2], 10);
            if (current > threshold && newVal <= threshold) {
              const action = ct[3];
              const actionTarget = ct[4];
              if (action === 'set-state' && actionTarget) {
                const currentItemState = this.player.getState(dtag);
                const transition = findTransition(item, currentItemState, actionTarget);
                if (transition) {
                  this.player.setState(dtag, transition.to);
                  if (transition.text) this._emit(transition.text, 'narrative');
                }
              } else if (action === 'consequence' && actionTarget) {
                this._executeConsequence(actionTarget);
              } else if (action === 'traverse' && actionTarget) {
                this._traverse(actionTarget);
              }
            }
          }
        }
      }
    }
  }

  // ── Movement ──────────────────────────────────────────────────────────

  /**
   * Handle movement — spec 6.7 contested exit model.
   *
   * - One trusted portal → navigate immediately
   * - Multiple trusted → disambiguation list
   * - One trusted + unverified → navigate trusted, show [+N unverified] hint
   * - Unverified only → short list (max 5) with trust indicators, require choice
   * - Unverified portal → confirmation required (pendingConfirm state)
   */
  handleMove(direction, choiceIndex = null) {
    const { exits: allExits, hiddenByTrust } = this._resolveRoomExits(this.currentPlace);
    const matchingExits = allExits.filter((e) => e.slot === direction);
    if (matchingExits.length === 0) { this._emit("You can't go that way.", 'error'); return; }

    const trustedExits = matchingExits.filter((e) => e.trustLevel === 'trusted');
    const unverifiedExits = matchingExits.filter((e) => e.trustLevel === 'unverified');

    let exit;

    if (trustedExits.length === 1 && unverifiedExits.length === 0) {
      // Simple case: one trusted portal, navigate immediately
      exit = trustedExits[0];
    } else if (trustedExits.length === 1 && unverifiedExits.length > 0) {
      // Trusted wins the slot — navigate, hint about unverified after arrival
      exit = trustedExits[0];
      // We'll emit the hint after enterRoom below
    } else if (trustedExits.length > 1) {
      // Multiple trusted — disambiguation
      if (choiceIndex === null) {
        this._emit(`Multiple paths ${direction}:`, 'narrative');
        for (let i = 0; i < trustedExits.length; i++) {
          const label = trustedExits[i].label || `path ${i + 1}`;
          this._emit(`  ${i + 1}. ${label} (trusted)`, 'exits');
        }
        this.pendingChoice = { direction, exits: trustedExits };
        return;
      }
      if (choiceIndex < 1 || choiceIndex > trustedExits.length) {
        this._emit(`Choose 1-${trustedExits.length}.`, 'error');
        return;
      }
      exit = trustedExits[choiceIndex - 1];
    } else if (unverifiedExits.length > 0) {
      // Unverified only — short list (max 5)
      if (choiceIndex === null) {
        this._emit(`Multiple paths ${direction}:`, 'narrative');
        const shown = unverifiedExits.slice(0, 5);
        for (let i = 0; i < shown.length; i++) {
          const label = shown[i].label || `path ${i + 1}`;
          const pk = shown[i].portalEvent.pubkey.slice(0, 12) + '...';
          this._emit(`  ${i + 1}. ${label} (unverified) [${pk}]`, 'exits-untrusted');
        }
        if (unverifiedExits.length > 5) {
          this._emit(`  + ${unverifiedExits.length - 5} more — type "look ${direction}" to see all`, 'exits-untrusted');
        }
        this.pendingChoice = { direction, exits: unverifiedExits, unverified: true };
        return;
      }
      if (choiceIndex < 1 || choiceIndex > unverifiedExits.length) {
        this._emit(`Choose 1-${unverifiedExits.length}.`, 'error');
        return;
      }
      // Unverified portal — confirmation required
      const chosen = unverifiedExits[choiceIndex - 1];
      const pk = chosen.portalEvent.pubkey.slice(0, 12) + '...';
      const label = chosen.label || 'an unknown path';
      this.pendingConfirm = { exit: chosen };
      this._emit(`You are about to enter an unverified path by ${pk}`, 'exits-untrusted');
      this._emit(`"${label}" — proceed? (yes/no)`, 'exits-untrusted');
      return;
    }

    const req = checkRequires(exit.portalEvent, this.player.state, this.events);
    if (!req.allowed) {
      // Lethal portal — fires consequence instead of blocking (spec §2.11)
      const consequenceTag = exit.portalEvent.tags.find((t) => t[0] === 'consequence');
      if (consequenceTag && consequenceTag[1]) {
        this._emit(req.reason, 'narrative');
        this._executeConsequence(consequenceTag[1]);
      } else {
        this._emit(req.reason, 'error');
      }
      return;
    }

    this.player.incrementMoveCount();
    this.processOnMove();
    this._processNpcOnMove();
    this.enterRoom(exit.destinationDTag, { isMoving: true });
  }

  // ── Traverse action ──────────────────────────────────────────────────

  /**
   * Traverse a portal programmatically (spec action: traverse).
   * Resolves the destination from the portal's exit tags relative to the
   * player's current place, checks requires, then navigates.
   */
  _traverse(portalRef) {
    const portal = this.events.get(portalRef);
    if (!portal) return;

    // Check requires on the portal
    const req = checkRequires(portal, this.player.state, this.events);
    if (!req.allowed) {
      this._emit(req.reason, 'error');
      return;
    }

    // Find the exit that leads AWAY from the current place
    const exitTags = getTags(portal, 'exit');
    let destinationDTag = null;
    for (const tag of exitTags) {
      const placeRef = tag[1];
      if (placeRef !== this.currentPlace) {
        destinationDTag = placeRef;
        break;
      }
    }

    if (!destinationDTag) return;

    this.player.incrementMoveCount();
    this.processOnMove();
    this._processNpcOnMove();
    this.enterRoom(destinationDTag, { isMoving: true });
  }

  // ── Consequence execution ────────────────────────────────────────────

  /**
   * Execute a consequence event (spec §2.11).
   * Fixed execution order regardless of tag declaration:
   *   give-item → consume-item → deal-damage → drop inventory → clears → content → respawn
   */
  _executeConsequence(consequenceRef) {
    const event = this.events.get(consequenceRef);
    if (!event) return;

    const tags = event.tags;

    // 1. give-item
    for (const tag of tags.filter((t) => t[0] === 'give-item')) {
      giveItem(tag[1], this.events, this.player, (t, ty) => this._emit(t, ty));
    }

    // 2. consume-item
    for (const tag of tags.filter((t) => t[0] === 'consume-item')) {
      const itemRef = tag[1];
      if (this.player.hasItem(itemRef)) {
        this.player.removeItem(itemRef);
      }
    }

    // 3. deal-damage — stub for combat phase
    // for (const tag of tags.filter((t) => t[0] === 'deal-damage')) { ... }

    // 4-8. Process clears in fixed order
    const clearsSet = new Set(tags.filter((t) => t[0] === 'clears').map((t) => t[1]));

    // 4-5. Drop inventory to current place, then clear
    if (clearsSet.has('inventory')) {
      for (const itemDtag of this.player.state.inventory) {
        this.player.addPlaceItem(this.currentPlace, itemDtag);
      }
      this.player.state.inventory = [];
      clearsSet.delete('inventory');
    }

    // 6. clears states
    if (clearsSet.has('states')) {
      this.player.state.states = {};
      clearsSet.delete('states');
    }

    // 7. clears counters
    if (clearsSet.has('counters')) {
      this.player.state.counters = {};
      clearsSet.delete('counters');
    }

    // 8. Other clears in declaration order
    for (const key of clearsSet) {
      if (key === 'cryptoKeys') this.player.state.cryptoKeys = [];
      else if (key === 'dialogueVisited') this.player.state.dialogueVisited = {};
      else if (key === 'paymentAttempts') this.player.state.paymentAttempts = {};
      else if (key === 'visited') this.player.state.visited = [];
    }

    // 9. Content
    if (event.content) this._emit(event.content, 'narrative');

    // 10. Respawn — always last
    const respawnRef = getTag(event, 'respawn');
    if (respawnRef) {
      this.enterRoom(respawnRef);
    }
  }

  // ── NPC encounter ──────────────────────────────────────────────────────

  _fireNpcEncounter(npcEvent, npcDtag) {
    for (const tag of getTags(npcEvent, 'on-encounter')) {
      if (tag[1] !== 'player') continue;
      const action = tag[2];
      const actionTarget = tag[3];

      if (action === 'steals-item') {
        this._npcStealsItem(npcDtag, actionTarget);
      } else if (action === 'deal-damage') {
        // Combat — future phase
      } else if (action === 'consequence') {
        if (actionTarget) this._executeConsequence(actionTarget);
      } else if (action === 'traverse') {
        if (actionTarget) this._traverse(actionTarget);
      }
    }
  }

  /**
   * NPC steals an item from the player.
   * target is 'any' (steal first stealable item) or an item a-tag.
   */
  _npcStealsItem(npcDtag, target) {
    const npcEvent = this.events.get(npcDtag);
    const npcTitle = npcEvent ? getTag(npcEvent, 'title') : 'Someone';

    if (target === 'any') {
      // Steal the most recently acquired item
      if (this.player.state.inventory.length === 0) return;
      const stolenDtag = this.player.state.inventory[this.player.state.inventory.length - 1];
      const stolenEvent = this.events.get(stolenDtag);
      const stolenTitle = stolenEvent ? getTag(stolenEvent, 'title') : stolenDtag;
      this.player.removeItem(stolenDtag);
      this.player.npcPickUp(npcDtag, stolenDtag);
      this._emit(`${npcTitle} snatches your ${stolenTitle}!`, 'error');
    } else if (target) {
      if (!this.player.hasItem(target)) return;
      const stolenEvent = this.events.get(target);
      const stolenTitle = stolenEvent ? getTag(stolenEvent, 'title') : target;
      this.player.removeItem(target);
      this.player.npcPickUp(npcDtag, target);
      this._emit(`${npcTitle} snatches your ${stolenTitle}!`, 'error');
    }
  }

  /**
   * Process NPC on-enter triggers after movement.
   * Check if any roaming NPC has arrived at its stash place.
   */
  _processNpcOnMove() {
    const moveCount = this.player.getMoveCount();
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') !== 'npc') continue;
      if (getTags(event, 'route').length === 0) continue;

      const npcState = this.player.getNpcState(dtag);
      if (!npcState) continue;

      const npcPlace = calculateNpcPlace(event, moveCount, npcState.state);
      if (!npcPlace) continue;

      // Fire on-enter triggers for the NPC's current place
      for (const tag of getTags(event, 'on-enter')) {
        const placeRef = tag[1];  // full a-tag
        if (placeRef === 'player') continue; // dialogue on-enter, not NPC movement
        if (placeRef !== npcPlace) continue;

        const action = tag[2];
        if (action === 'deposits') {
          this._npcDeposits(dtag, npcPlace);
        }
      }
    }
  }

  /**
   * NPC deposits all carried items at its current place.
   */
  _npcDeposits(npcDtag, placeDtag) {
    const dropped = this.player.npcDropAll(npcDtag);
    if (dropped.length === 0) return;
    // Add each item to the place's inventory
    for (const itemDtag of dropped) {
      this.player.addPlaceItem(placeDtag, itemDtag);
    }
  }

  // ── Puzzle answer ─────────────────────────────────────────────────────

  async handlePuzzleAnswer(answer) {
    if (!this.puzzleActive) return;
    const puzzleEvent = this.events.get(this.puzzleActive);
    if (!puzzleEvent) return;

    const expectedHash = getTag(puzzleEvent, 'answer-hash');
    const salt = getTag(puzzleEvent, 'salt');

    const data = new TextEncoder().encode(answer.trim() + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hashHex !== expectedHash) {
      this._emit('That is not the answer.', 'error');
      return;
    }

    this._emit('Correct!', 'success');
    this.player.markPuzzleSolved(this.puzzleActive);

    const derivedPrivKey = await derivePrivateKey(
      answer.trim(),
      salt
    );

    for (const tag of getTags(puzzleEvent, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'give-crypto-key') {
        this.player.addCryptoKey(derivedPrivKey);
        this._emit('You feel a key take shape in your mind.', 'narrative');
      } else if (action === 'consequence' && (value || extRef)) {
        this._executeConsequence(extRef || value);
      } else if (action === 'traverse' && (value || extRef)) {
        this._traverse(extRef || value);
      } else if (action === 'set-state' && extRef) {
        const targetEvent = this.events.get(extRef);
        if (!targetEvent) continue;
        const targetType = getTag(targetEvent, 'type');
        if (targetType === 'portal' || targetType === 'feature') {
          const currentState = this.player.getState(extRef) ?? getDefaultState(targetEvent);
          if (currentState !== value) {
            this.player.setState(extRef, value);
            const transition = findTransition(targetEvent, currentState, value);
            if (transition?.text) this._emit(transition.text, 'narrative');
          }
        }
      }
    }

    this.puzzleActive = null;
  }

  // ── Dialogue system ───────────────────────────────────────────────────

  resolveDialogueEntry(npcEvent) {
    const dialogueTags = getTags(npcEvent, 'dialogue');
    let entryRef = null;

    for (const tag of dialogueTags) {
      const nodeRef = tag[1];
      const requiresRef = tag[2];
      const requiresState = tag[3];

      if (!requiresRef) {
        entryRef = nodeRef;
      } else {
        const reqEvent = this.events.get(requiresRef);
        const reqType = reqEvent ? getTag(reqEvent, 'type') : '';

        let passes = false;
        if (reqType === 'dialogue') {
          passes = requiresState === 'visited' && this.player.isDialogueVisited(requiresRef);
        } else if (reqType === 'clue') {
          passes = this.player.isClueSeen(requiresRef);
        } else if (reqType === 'item') {
          const hasIt = this.player.hasItem(requiresRef);
          if (!requiresState) {
            passes = hasIt;
          } else {
            passes = hasIt && this.player.getState(requiresRef) === requiresState;
          }
        } else if (reqType === 'puzzle') {
          passes = requiresState === 'solved' && this.player.isPuzzleSolved(requiresRef);
        } else if (reqType === 'feature') {
          passes = requiresState && this.player.getState(requiresRef) === requiresState;
        }

        if (passes) entryRef = nodeRef;
      }
    }

    return entryRef || null;  // entryRef is already a full a-tag
  }

  enterDialogueNode(npcDtag, nodeDtag) {
    const node = this.events.get(nodeDtag);
    if (!node) {
      this._emit('The conversation ends.', 'narrative');
      this.dialogueActive = null;
      return;
    }

    this.player.markDialogueVisited(nodeDtag);
    this.dialogueActive = { npcDtag, nodeDtag };

    const text = getTag(node, 'text');
    if (text) this._emit(text, 'dialogue');

    // Fire on-enter actions
    for (const tag of getTags(node, 'on-enter')) {
      if (tag[1] !== 'player') continue;
      const action = tag[2];
      const actionTarget = tag[3];

      if (action === 'give-item' && actionTarget) {
        giveItem(actionTarget, this.events, this.player, (t, ty) => this._emit(t, ty));
      } else if (action === 'set-state' && actionTarget) {
        const extRef = tag[4];  // full a-tag
        if (extRef) {
          const targetEvent = this.events.get(extRef);
          if (targetEvent) {
            const targetType = getTag(targetEvent, 'type');
            if (targetType === 'clue') {
              this.player.markClueSeen(extRef);
              this._emit(`\n${getTag(targetEvent, 'title')}:`, 'clue-title');
              this._emit(targetEvent.content, 'clue');
            } else if (targetType === 'portal') {
              const portalCurrentState = this.player.getState(extRef) ?? getDefaultState(targetEvent);
              if (portalCurrentState !== actionTarget) {
                this.player.setState(extRef, actionTarget);
                const transition = findTransition(targetEvent, portalCurrentState, actionTarget);
                if (transition?.text) this._emit(transition.text, 'narrative');
              }
            } else if (targetType === 'feature') {
              const featCurrentState = this.player.getState(extRef) ?? getDefaultState(targetEvent);
              if (featCurrentState !== actionTarget) {
                this.player.setState(extRef, actionTarget);
                const transition = findTransition(targetEvent, featCurrentState, actionTarget);
                if (transition?.text) this._emit(transition.text, 'narrative');
              }
            }
          }
        }
      }
    }

    // Show options (filter by destination requires)
    const options = getTags(node, 'option');
    const visibleOptions = this._getVisibleOptions(options);

    for (let i = 0; i < visibleOptions.length; i++) {
      this._emit(`  ${i + 1}. ${visibleOptions[i].label}`, 'dialogue-option');
    }
  }

  _getVisibleOptions(options) {
    const visibleOptions = [];
    for (const opt of options) {
      const label = opt[1];
      const nextRef = opt[2];

      if (!nextRef) {
        visibleOptions.push({ label, nextDtag: null });
      } else {
        const nextDtag = nextRef;  // full a-tag
        const destNode = this.events.get(nextDtag);
        if (destNode) {
          const destReq = checkRequires(destNode, this.player.state, this.events);
          if (destReq.allowed) {
            visibleOptions.push({ label, nextDtag });
          }
        } else {
          visibleOptions.push({ label, nextDtag });
        }
      }
    }
    return visibleOptions;
  }

  handleDialogueChoice(input) {
    if (!this.dialogueActive) return;
    const node = this.events.get(this.dialogueActive.nodeDtag);
    if (!node) { this.dialogueActive = null; return; }

    const options = getTags(node, 'option');
    const visibleOptions = this._getVisibleOptions(options);

    const choice = parseInt(input, 10);
    if (isNaN(choice) || choice < 1 || choice > visibleOptions.length) {
      this._emit(`Choose 1-${visibleOptions.length}.`, 'error');
      return;
    }

    const selected = visibleOptions[choice - 1];
    this._emit(`> ${selected.label}`, 'command');

    if (!selected.nextDtag) {
      this._emit('The conversation ends.', 'narrative');
      this.dialogueActive = null;
    } else {
      // Check if the target is a payment event
      const targetEvent = this.events.get(selected.nextDtag);
      const targetType = targetEvent ? getTag(targetEvent, 'type') : null;

      if (targetType === 'payment') {
        this._activatePayment(selected.nextDtag, targetEvent);
        this.dialogueActive = null;
      } else {
        this.enterDialogueNode(this.dialogueActive.npcDtag, selected.nextDtag);
      }
    }
  }

  startDialogue(npcDtag) {
    const npc = this.events.get(npcDtag);
    if (!npc) { this._emit("They don't seem interested in talking.", 'error'); return; }

    const entryDtag = this.resolveDialogueEntry(npc);
    if (!entryDtag) {
      this._emit("They don't seem interested in talking.", 'error');
      return;
    }

    const npcTitle = getTag(npc, 'title');
    this._emit(`\n— ${npcTitle} —`, 'npc-title');
    this.enterDialogueNode(npcDtag, entryDtag);
  }

  // ── Payment ─────────────────────────────────────────────────────────

  _activatePayment(dtag, paymentEvent) {
    const lnurl = getTag(paymentEvent, 'lnurl');
    const amount = getTag(paymentEvent, 'amount');
    const unit = getTag(paymentEvent, 'unit') || 'sats';

    if (!lnurl || !amount) {
      this._emit('Payment misconfigured.', 'error');
      return;
    }

    // Check if already completed
    const attempt = this.player.state.paymentAttempts?.[dtag];
    if (attempt?.status === 'complete') {
      this._emit('Already paid.', 'narrative');
      return;
    }

    this.paymentActive = {
      dtag,
      lnurl,
      amount,
      unit,
      description: paymentEvent.content || `Pay ${amount} ${unit}`,
    };
  }

  /**
   * Called by the UI when payment is confirmed.
   * Fires on-complete actions and marks payment as complete.
   */
  completePayment(dtag) {
    const paymentEvent = this.events.get(dtag);
    if (!paymentEvent) return;

    // Mark as complete
    this.player.setPaymentStatus(dtag, 'complete');

    // Fire on-complete actions
    for (const tag of getTags(paymentEvent, 'on-complete')) {
      const action = tag[2];
      const actionTarget = tag[3];

      if (action === 'give-item' && actionTarget) {
        giveItem(actionTarget, this.events, this.player, (t, ty) => this._emit(t, ty));
      } else if (action === 'set-state') {
        if (actionTarget) {
          this.player.setState(dtag, actionTarget);
        }
      }
    }

    this.paymentActive = null;
  }

  // ── Resolve noun ──────────────────────────────────────────────────────

  resolveNoun(rawNoun) {
    if (!rawNoun) return null;
    const noun = stripArticles(rawNoun);
    if (this.place) {
      const match = findByNoun(this.events, this.place, noun);
      if (match) return match;

      // Check roaming NPCs at this place
      const roaming = findRoamingNpcsAtPlace(
        this.events, this.currentPlace, this.player.getMoveCount(),
        (npcDtag) => this.player.getNpcState(npcDtag),
      );
      for (const { npcEvent, npcDtag } of roaming) {
        const title = getTag(npcEvent, 'title')?.toLowerCase() || '';
        if (title.includes(noun)) return { event: npcEvent, dtag: npcDtag, type: 'npc' };
        for (const nt of getTags(npcEvent, 'noun')) {
          for (let i = 1; i < nt.length; i++) {
            if (nt[i].toLowerCase() === noun) return { event: npcEvent, dtag: npcDtag, type: 'npc' };
          }
        }
      }
    }
    const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (invMatch) return { ...invMatch, type: 'item' };
    return null;
  }

  // ── Unified interaction dispatch ──────────────────────────────────────

  handleInteraction(verb, targetNoun, instrumentNoun) {
    if (!this.place) return;

    const target = targetNoun ? this.resolveNoun(targetNoun) : null;
    if (!target) {
      this._emit("You don't see that here.", 'error');
      return;
    }

    const { event, dtag, type } = target;

    if (type === 'feature') {
      const fDefault = getDefaultState(event);
      const fCurrent = this.player.getState(dtag) ?? fDefault;
      if (fCurrent === 'hidden') {
        this._emit("You don't see that here.", 'error');
        return;
      }

      const req = checkRequires(event, this.player.state, this.events);
      if (!req.allowed) { this._emit(req.reason, 'error'); return; }

      if (verb === 'examine') {
        const desc = event.content;
        if (desc) this._emit(desc, 'narrative');
      }

      const currentState = this.player.getState(dtag) ?? fDefault;
      if (!this.processFeatureInteract(event, dtag, verb, currentState)) {
        if (verb !== 'examine') this._emit('Nothing happens.', 'narrative');
      }
    } else if (type === 'npc') {
      if (verb === 'examine') {
        const desc = event.content;
        if (desc) this._emit(desc, 'narrative');
      } else if (verb === 'talk') {
        this.startDialogue(dtag);
      } else {
        this._emit("You can't do that.", 'error');
      }
    } else if (type === 'item') {
      if (this.player.hasItem(dtag)) {
        if (verb === 'examine') {
          this.examineInventoryItem({ event, dtag });
        } else {
          this.handleItemInteract(verb, stripArticles(targetNoun));
        }
      } else {
        if (verb === 'examine') {
          const desc = event.content;
          if (desc) this._emit(desc, 'narrative');
        } else {
          this._emit("You need to pick that up first.", 'error');
        }
      }
    }
  }

  // ── Reconcile counter-low states (on initial load) ────────────────────

  reconcileCounterLow() {
    for (const dtag of this.player.state.inventory) {
      const item = this.events.get(dtag);
      if (!item) continue;
      const currentState = this.player.getState(dtag);
      if (currentState) evalCounterLow(item, dtag, currentState, this.player, (t, ty) => this._emit(t, ty));
    }
  }

  // ── Main command handler (async for puzzle crypto) ────────────────────

  async handleCommand(input) {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    this._emit(`> ${input}`, 'command');

    // Confirmation mode — unverified portal entry
    if (this.pendingConfirm) {
      if (trimmed === 'yes' || trimmed === 'y') {
        const exit = this.pendingConfirm.exit;
        this.pendingConfirm = null;
        const req = checkRequires(exit.portalEvent, this.player.state, this.events);
        if (!req.allowed) { this._emit(req.reason, 'error'); return; }
        this.player.incrementMoveCount();
        this.processOnMove();
        this._processNpcOnMove();
        this.enterRoom(exit.destinationDTag, { isMoving: true });
      } else {
        this.pendingConfirm = null;
        this._emit('You stay where you are.', 'narrative');
      }
      return;
    }

    // Choice mode — disambiguation list awaiting numeric input
    if (this.pendingChoice) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        const { direction, exits } = this.pendingChoice;
        this.pendingChoice = null;
        if (num < 1 || num > exits.length) {
          this._emit(`Choose 1-${exits.length}.`, 'error');
          return;
        }
        const chosen = exits[num - 1];
        if (chosen.trustLevel !== 'trusted') {
          // Unverified portal — confirmation required
          const pk = chosen.portalEvent.pubkey.slice(0, 12) + '...';
          const label = chosen.label || 'an unknown path';
          this.pendingConfirm = { exit: chosen };
          this._emit(`You are about to enter an unverified path by ${pk}`, 'exits-untrusted');
          this._emit(`"${label}" — proceed? (yes/no)`, 'exits-untrusted');
        } else {
          // Trusted portal — navigate directly
          const req = checkRequires(chosen.portalEvent, this.player.state, this.events);
          if (!req.allowed) { this._emit(req.reason, 'error'); return; }
          this.player.incrementMoveCount();
          this.processOnMove();
          this._processNpcOnMove();
          this.enterRoom(chosen.destinationDTag, { isMoving: true });
        }
        return;
      }
      // Non-numeric input clears the pending choice
      this.pendingChoice = null;
    }

    // Dialogue mode
    if (this.dialogueActive) { this.handleDialogueChoice(trimmed); return; }

    // Puzzle mode
    if (this.puzzleActive) { await this.handlePuzzleAnswer(input.trim()); return; }

    // Built-in: look <direction> — spec 6.7 portal listing
    const lookDirMatch = trimmed.match(/^(?:look|l)\s+(.+)$/);
    if (lookDirMatch) {
      const dir = lookDirMatch[1];
      // Check if it's a valid direction (not a noun for examine)
      const allExits = [
        ...this._resolveRoomExits(this.currentPlace).exits,
        ...this._resolveRoomExits(this.currentPlace).hiddenByTrust,
      ];
      if (allExits.some((e) => e.slot === dir)) {
        this.handleLookDirection(dir);
        return;
      }
      // Fall through to examine
    }

    // Built-in: look
    if (trimmed === 'look' || trimmed === 'l') {
      if (this.place) this.enterRoom(this.currentPlace);
      return;
    }

    // Built-in: inventory
    if (trimmed === 'inventory' || trimmed === 'i') {
      if (this.player.state.inventory.length === 0) {
        this._emit('You are empty-handed.', 'narrative');
      } else {
        this._emit('You are carrying:', 'narrative');
        for (const dtag of this.player.state.inventory) {
          const item = this.events.get(dtag);
          this._emit(`  ${item ? getTag(item, 'title') : dtag}`, 'item');
        }
      }
      return;
    }

    // Built-in: reset — return to start place
    if (trimmed === 'reset') {
      this.enterRoom(this.config.GENESIS_PLACE);
      return;
    }

    // Built-in: pick up / take
    const pickupMatch = trimmed.match(/^(?:pick up|take|get|grab)\s+(.+)$/);
    if (pickupMatch) { this.handlePickup(pickupMatch[1]); return; }

    // Data-driven verb/noun parser — include roaming NPCs as verb sources
    const roamingHere = findRoamingNpcsAtPlace(
      this.events, this.currentPlace, this.player.getMoveCount(),
      (npcDtag) => this.player.getNpcState(npcDtag),
    );
    const roamingEvents = roamingHere.map((r) => r.npcEvent);
    const verbMap = buildVerbMap(this.events, this.place, this.player.state.inventory, roamingEvents);
    const parsed = parseInput(trimmed, verbMap);

    if (parsed && parsed.noun1) {
      if (parsed.noun2) {
        this.handleInteraction(parsed.verb, parsed.noun2, parsed.noun1);
      } else {
        this.handleInteraction(parsed.verb, parsed.noun1, null);
      }
      return;
    }

    // Verb with no noun
    if (parsed && !parsed.noun1) {
      if (parsed.verb === 'examine') {
        if (this.place) this.enterRoom(this.currentPlace);
        return;
      }
      this._emit(`${parsed.verb} what?`, 'error');
      return;
    }

    // Movement — try as direction, with optional choice index for contested portals
    const dirInput = trimmed.replace(/^go\s+/, '');
    const dirMatch = dirInput.match(/^(\S+?)(?:\s+(\d+))?$/);
    if (dirMatch) {
      const dir = dirMatch[1];
      const choiceIndex = dirMatch[2] ? parseInt(dirMatch[2], 10) : null;
      const visibleExits = this.exits;
      if (visibleExits.find((e) => e.slot === dir)) {
        this.handleMove(dir, choiceIndex);
        return;
      }
    }

    this._emit("I don't understand that.", 'error');
  }
}
