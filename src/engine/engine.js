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
import { renderRoomContent, renderMarkdown } from './content.js';
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

    // Restore position from saved state, or start at genesis.
    // If saved place no longer exists in events (e.g. identity change), reset to start.
    const savedPlace = player.state.place;
    this.currentPlace = (savedPlace && events.has(savedPlace)) ? savedPlace : config.GENESIS_PLACE;
    this.puzzleActive = null;
    this.dialogueActive = null;
    this.paymentActive = null;   // { dtag, lnurl, amount, unit, description }
    this.pendingConfirm = null;
    this.pendingChoice = null;  // { direction, exits } — disambiguation list awaiting numeric input
    this.craftingActive = null; // { recipeDtag, step, itemRequires } — ordered crafting mode
    this.combatTarget = null;  // NPC dtag during a combat round
    this.gameOver = null;      // null | 'hard' | 'soft' — endgame quest state

    // Initialize player health from world event if not already set
    if (player.getHealth() == null) {
      const worldEvent = this._findWorldEvent(events);
      const hp = worldEvent ? parseInt(getTag(worldEvent, 'health') || '0', 10) : 0;
      const maxHp = worldEvent ? parseInt(getTag(worldEvent, 'max-health') || '0', 10) : 0;
      if (hp > 0 || maxHp > 0) {
        player.setHealth(hp || maxHp || 10);
        player.setMaxHealth(maxHp || hp || 10);
      }
    }

    /** @type {Array<{text?: string, html?: string, type: string}>} */
    this.output = [];
  }

  /** Find the world event in the events map. */
  _findWorldEvent(evts) {
    for (const [, event] of (evts || this.events)) {
      if (getTag(event, 'type') === 'world') return event;
    }
    return null;
  }

  // ── Output helpers ────────────────────────────────────────────────────

  _emit(text, type = 'narrative') {
    this.output.push({ text, type });
  }

  _emitHtml(html, type = 'narrative') {
    this.output.push({ html, type });
  }

  _emitSound(pattern, volume = 1.0) {
    this.output.push({ sound: pattern, volume: parseFloat(volume) || 1.0, type: 'sound' });
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

    // Items — show what's on the ground at this place (skip if requires not met)
    const placeItems = this.player.getPlaceItems(dtag) || [];
    for (const itemDtag of placeItems) {
      const item = this.events.get(itemDtag);
      if (!item) continue;
      const itemReq = checkRequires(item, this.player.state, this.events);
      if (!itemReq.allowed) continue;
      this._emit(`You see: ${getTag(item, 'title')}`, 'item');
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

    // Place on-enter triggers (only on actual movement)
    if (isMoving) {
      for (const tag of getTags(room, 'on-enter')) {
        if (tag[1] !== 'player') continue;
        const action = tag[2];
        const actionTarget = tag[3];
        const extTarget = tag[4];

        if (action === 'set-state' && actionTarget) {
          if (extTarget) {
            applyExternalSetState(
              extTarget, actionTarget, this.events, this.player,
              (t, ty) => this._emit(t, ty),
              (h, ty) => this._emitHtml(h, ty),
            );
          }
        } else if (action === 'give-item' && actionTarget) {
          giveItem(actionTarget, this.events, this.player, (t, ty) => this._emit(t, ty));
        } else if (action === 'deal-damage') {
          const dmg = parseInt(actionTarget, 10) || 1;
          this._dealDamageToPlayer(dmg, null, null);
        } else if (action === 'consequence' && actionTarget) {
          this._executeConsequence(actionTarget);
        } else if (action === 'sound') {
          this._emitSound(actionTarget, extTarget);
        } else if (action === 'increment' || action === 'decrement' || action === 'set-counter') {
          // Counter actions on the place event
          this._applyCounterAction(action, dtag, actionTarget, extTarget, room);
        }
      }
    }

    // Re-evaluate quests after on-enter state changes
    if (isMoving) this._evalQuests();

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

  /** Find an item on the ground at the current place by noun (respects requires). */
  _findPlaceItem(noun) {
    const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
    for (const itemDtag of placeItems) {
      const item = this.events.get(itemDtag);
      if (!item) continue;
      const itemReq = checkRequires(item, this.player.state, this.events);
      if (!itemReq.allowed) continue;
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

  // ── Drop item ────────────────────────────────────────────────────────

  _handleDrop(rawNoun) {
    const noun = stripArticles(rawNoun);
    const match = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (!match) {
      this._emit("You don't have that.", 'error');
      return;
    }
    this.player.removeItem(match.dtag);
    this.player.addPlaceItem(this.currentPlace, match.dtag);
    this._emit(`Dropped: ${getTag(match.event, 'title')}`, 'item');
  }

  // ── Container: take X from Y ─────────────────────────────────────────

  /**
   * Find a container by noun — checks inventory, ground items, and features.
   * Returns { event, dtag } or null.
   */
  _findContainer(cNoun) {
    // Inventory item
    const invMatch = findInventoryItem(this.events, this.player.state.inventory, cNoun);
    if (invMatch && getTags(invMatch.event, 'contains').length > 0) {
      return { event: invMatch.event, dtag: invMatch.dtag };
    }
    // Ground item at current place
    const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
    for (const itemDtag of placeItems) {
      const itemEvent = this.events.get(itemDtag);
      if (!itemEvent || getTags(itemEvent, 'contains').length === 0) continue;
      const title = getTag(itemEvent, 'title')?.toLowerCase() || '';
      if (title.includes(cNoun)) return { event: itemEvent, dtag: itemDtag };
      for (const nt of getTags(itemEvent, 'noun')) {
        for (let i = 1; i < nt.length; i++) {
          if (nt[i].toLowerCase() === cNoun) return { event: itemEvent, dtag: itemDtag };
        }
      }
    }
    // Feature in place
    if (this.place) {
      const featMatch = findByNoun(this.events, this.place, cNoun);
      if (featMatch && featMatch.type === 'feature' && getTags(featMatch.event, 'contains').length > 0) {
        return { event: featMatch.event, dtag: featMatch.dtag };
      }
    }
    return null;
  }

  /**
   * Take item(s) from a container.
   * Supports: "take X from Y" and "take all from Y"
   */
  _takeFromContainer(itemNoun, containerNoun) {
    const cNoun = stripArticles(containerNoun);
    const container = this._findContainer(cNoun);
    if (!container) {
      this._emit("You don't see that here.", 'error');
      return;
    }

    const { event, dtag } = container;
    const currentState = this.player.getState(dtag) ?? getDefaultState(event);
    const containsTags = getTags(event, 'contains');

    // "take all from Y"
    if (stripArticles(itemNoun) === 'all') {
      let taken = 0;
      for (const tag of containsTags) {
        const ref = tag[1];
        if (this.player.hasItem(ref)) continue;
        const reqState = tag[2] || '';
        if (reqState && currentState !== reqState) continue;
        const itemEvent = this.events.get(ref);
        if (!itemEvent) continue;
        this._extractItem(ref, itemEvent);
        taken++;
      }
      if (taken === 0) this._emit("There's nothing to take.", 'error');
      return;
    }

    // "take X from Y"
    const noun = stripArticles(itemNoun);
    for (const tag of containsTags) {
      const ref = tag[1];
      const refEvent = this.events.get(ref);
      if (!refEvent) continue;

      // Match noun
      const title = getTag(refEvent, 'title')?.toLowerCase() || '';
      let matches = title.includes(noun);
      if (!matches) {
        for (const nt of getTags(refEvent, 'noun')) {
          for (let i = 1; i < nt.length; i++) {
            if (nt[i].toLowerCase() === noun) { matches = true; break; }
          }
          if (matches) break;
        }
      }
      if (!matches) continue;

      // Already taken
      if (this.player.hasItem(ref)) {
        this._emit('You already have that.', 'error');
        return;
      }

      // Check state gate
      const reqState = tag[2] || '';
      const failMsg = tag[3] || '';
      if (reqState && currentState !== reqState) {
        this._emit(failMsg || "You can't reach that.", 'error');
        return;
      }

      this._extractItem(ref, refEvent);
      return;
    }
    this._emit("That's not in there.", 'error');
  }

  /** Extract a single item from a container into player inventory. */
  _extractItem(ref, itemEvent) {
    this.player.pickUp(ref);
    const defaultState = getDefaultState(itemEvent);
    if (defaultState) this.player.setState(ref, defaultState);
    for (const ct of getTags(itemEvent, 'counter')) {
      this.player.setCounter(`${ref}:${ct[1]}`, parseInt(ct[2], 10));
    }
    this._emit(`Taken: ${getTag(itemEvent, 'title')}`, 'item');
    this._evalQuests();
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
    // List container contents (only state-matching ones)
    this._listContainerContents(invMatch.event, invMatch.dtag);
  }

  /** List contents of a container (item or feature). Shows accessible items
   *  and deduplicated fail-messages for gated items. Hides gated items with blank fail-message. */
  _listContainerContents(event, dtag) {
    const containsTags = getTags(event, 'contains');
    if (containsTags.length === 0) return;

    const currentState = this.player.getState(dtag) ?? getDefaultState(event);
    const accessible = [];
    const failMessages = new Set();
    for (const tag of containsTags) {
      const ref = tag[1];
      if (this.player.hasItem(ref)) continue; // already taken
      const refEvent = this.events.get(ref);
      if (!refEvent) continue;
      const reqState = tag[2] || '';
      const failMsg = tag[3] || '';
      const name = getTag(refEvent, 'title') || ref.split(':').pop();

      if (!reqState || currentState === reqState) {
        accessible.push(name);
      } else if (failMsg) {
        failMessages.add(failMsg);
      }
      // blank fail-message + unmet state = hidden
    }
    if (accessible.length > 0) {
      this._emit('Contains:', 'narrative');
      for (const name of accessible) {
        this._emit(`  ${name}`, 'item');
      }
    }
  }

  // ── Feature interaction ───────────────────────────────────────────────

  processFeatureInteract(event, dtag, verb, currentState) {
    let acted = false;
    // Snapshot visible items before interaction (for revealing newly-visible items after)
    const visibleBefore = new Set();
    if (this.currentPlace) {
      const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
      for (const itemDtag of placeItems) {
        const item = this.events.get(itemDtag);
        if (item && checkRequires(item, this.player.state, this.events).allowed) {
          visibleBefore.add(itemDtag);
        }
      }
    }
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
      } else if (action === 'decrement' || action === 'increment') {
        this._applyCounterAction(action, dtag, targetState, targetRef, event);
        acted = true;
      } else if (action === 'set-counter') {
        this._applyCounterAction('set-counter', dtag, targetState, targetRef, event, tag[5]);
        acted = true;
      } else if (action === 'heal') {
        const amount = parseInt(targetState, 10) || 1;
        this._healPlayer(amount);
        acted = true;
      } else if (action === 'deal-damage') {
        const amount = parseInt(targetState, 10) || 1;
        this._dealDamageToPlayer(amount, null, null);
        acted = true;
      } else if (action === 'sound') {
        this._emitSound(targetState, targetRef);
        acted = true;
      }
    }
    if (acted) {
      // Show newly revealed items after state changes
      if (this.currentPlace) {
        const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
        for (const itemDtag of placeItems) {
          if (visibleBefore.has(itemDtag)) continue;
          const item = this.events.get(itemDtag);
          if (item && checkRequires(item, this.player.state, this.events).allowed) {
            this._emit(`You see: ${getTag(item, 'title')}`, 'item');
          }
        }
      }
      evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty), (p, v) => this._emitSound(p, v));
      this._evalQuests();
    }
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
    // Check requires on the item
    const pickupReq = checkRequires(match.event, this.player.state, this.events);
    if (!pickupReq.allowed) { this._emit(pickupReq.reason || "You don't see that here.", 'error'); return; }
    if (this.player.hasItem(match.dtag)) { this._emit('You already have that.', 'error'); return; }

    this.player.pickUp(match.dtag);
    this.player.removePlaceItem(this.currentPlace, match.dtag);

    const defaultState = getDefaultState(match.event);
    if (defaultState) this.player.setState(match.dtag, defaultState);

    for (const ct of getTags(match.event, 'counter')) {
      this.player.setCounter(`${match.dtag}:${ct[1]}`, parseInt(ct[2], 10));
    }

    this._emit(`Taken: ${getTag(match.event, 'title')}`, 'item');
    this._evalQuests();
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
            evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty), (p, v) => this._emitSound(p, v));
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
      } else if (action === 'give-item' && targetState) {
        if (!this.player.hasItem(targetState)) {
          giveItem(targetState, this.events, this.player, (t, ty) => this._emit(t, ty));
        }
        acted = true;
      } else if (action === 'sound') {
        this._emitSound(targetState, targetRef);
        acted = true;
      } else if (action === 'deal-damage') {
        const amount = parseInt(targetState, 10) || 1;
        this._dealDamageToPlayer(amount, null, null);
        acted = true;
      } else if (action === 'heal') {
        const amount = parseInt(targetState, 10) || 1;
        this._healPlayer(amount);
        acted = true;
      } else if (action === 'consequence') {
        const cRef = targetState || targetRef;
        if (cRef) this._executeConsequence(cRef);
        acted = true;
      } else if (action === 'decrement' || action === 'increment') {
        this._applyCounterAction(action, dtag, targetState, targetRef, event);
        acted = true;
      } else if (action === 'set-counter') {
        this._applyCounterAction('set-counter', dtag, targetState, targetRef, event, tag[5]);
        acted = true;
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
          this._applyCounterAction('decrement', dtag, tag[3], tag[4], item);
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

    // Fire portal sound effects on traversal
    for (const tag of getTags(exit.portalEvent, 'sound')) {
      const soundRef = tag[1];
      const role = tag[2];
      if (role === 'effect' && soundRef?.startsWith('30078:')) {
        this._emitSound(soundRef, tag[3]);
      }
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

  // ── Combat actions ───────────────────────────────────────────────────

  /**
   * Deal damage to player. Rolls NPC hit-chance. Fires on-player-health-zero.
   * @param {number} amount — damage to deal
   * @param {Object} [sourceNpc] — NPC event (for hit-chance and on-player-health-zero)
   * @param {string} [sourceNpcDtag] — NPC dtag
   */
  _dealDamageToPlayer(amount, sourceNpc, sourceNpcDtag) {
    if (this.player.getHealth() == null) return;

    // Roll NPC hit-chance
    if (sourceNpc) {
      const hitChance = parseFloat(getTag(sourceNpc, 'hit-chance') || '1.0');
      if (Math.random() > hitChance) {
        const npcTitle = getTag(sourceNpc, 'title') || 'Enemy';
        this._emit(`${npcTitle} misses!`, 'narrative');
        return;
      }
    }

    const prevHealth = this.player.getHealth();
    this.player.dealDamage(amount);
    const npcTitle = sourceNpc ? getTag(sourceNpc, 'title') : 'Something';
    this._emit(`${npcTitle} hits you for ${amount} damage. (HP: ${this.player.getHealth()})`, 'error');

    // Evaluate on-player-health triggers (threshold crossing)
    this._evalPlayerHealthTriggers(prevHealth, this.player.getHealth());
  }

  /**
   * Deal damage to an NPC. Rolls weapon hit-chance. Fires on-health-zero.
   * @param {string} npcDtag — target NPC (or "" to use combatTarget)
   * @param {Object} weaponEvent — the weapon item event (for damage + hit-chance)
   */
  _dealDamageToNpc(npcDtag, weaponEvent) {
    const targetDtag = npcDtag || this.combatTarget;
    if (!targetDtag) return;

    const npcEvent = this.events.get(targetDtag);
    if (!npcEvent) return;

    const npcState = this.player.getNpcState(targetDtag);
    if (!npcState || npcState.health == null || npcState.health <= 0) return;

    // Resolve weapon damage
    const weaponDamage = parseInt(getTag(weaponEvent, 'damage') || '1', 10);
    const hitChance = parseFloat(getTag(weaponEvent, 'hit-chance') || '1.0');

    // Roll hit
    if (Math.random() > hitChance) {
      this._emit('You miss!', 'narrative');
      return;
    }

    // Apply damage
    const prevHealth = npcState.health;
    npcState.health = Math.max(0, npcState.health - weaponDamage);
    this.player.setNpcState(targetDtag, npcState);

    const npcTitle = getTag(npcEvent, 'title') || 'Enemy';
    this._emit(`You hit ${npcTitle} for ${weaponDamage} damage. (HP: ${npcState.health})`, 'item');

    // Evaluate on-health triggers (threshold crossing)
    this._evalNpcHealthTriggers(npcEvent, targetDtag, prevHealth, npcState.health);
  }

  /**
   * Resolve a health threshold — supports absolute integers and "N%" percentages.
   * @param {string} threshold — e.g. "0", "3", "50%"
   * @param {number} maxHealth — max health for percentage resolution
   * @returns {number}
   */
  _resolveHealthThreshold(threshold, maxHealth) {
    if (typeof threshold === 'string' && threshold.endsWith('%')) {
      const pct = parseInt(threshold, 10);
      return Math.floor((pct / 100) * maxHealth);
    }
    return parseInt(threshold, 10) || 0;
  }

  /**
   * Evaluate on-health triggers on an NPC after health change.
   * Also handles legacy on-health-zero as alias for on-health down 0.
   */
  _evalNpcHealthTriggers(npcEvent, npcDtag, prevHealth, newHealth) {
    const maxHealth = parseInt(getTag(npcEvent, 'health') || '1', 10);

    // Collect all health trigger tags: on-health + legacy on-health-zero
    const triggers = [];
    for (const tag of getTags(npcEvent, 'on-health')) {
      triggers.push({ direction: tag[1], threshold: tag[2], action: tag[3], target: tag[4], extRef: tag[5] });
    }
    // Legacy backwards compat
    for (const tag of getTags(npcEvent, 'on-health-zero')) {
      const hasBlank = tag[1] === '';
      triggers.push({
        direction: 'down',
        threshold: '0',
        action: hasBlank ? tag[2] : tag[1],
        target: hasBlank ? tag[3] : tag[2],
        extRef: hasBlank ? tag[4] : tag[3],
      });
    }

    for (const { direction, threshold, action, target, extRef } of triggers) {
      const threshVal = this._resolveHealthThreshold(threshold, maxHealth);
      let crossed = false;
      if (direction === 'down') {
        crossed = prevHealth > threshVal && newHealth <= threshVal;
      } else if (direction === 'up') {
        crossed = prevHealth < threshVal && newHealth >= threshVal;
      }
      if (!crossed) continue;

      this._fireHealthAction(action, target, extRef, npcEvent, npcDtag);
    }
  }

  /**
   * Evaluate on-player-health triggers after player health change.
   * Checks world event (global) + NPCs in current place (local).
   */
  _evalPlayerHealthTriggers(prevHealth, newHealth) {
    const maxHealth = this.player.getMaxHealth() || 10;
    const sources = [];

    // World event (global)
    const worldEvent = this._findWorldEvent();
    if (worldEvent) sources.push(worldEvent);

    // NPCs in current place (local)
    // Static NPCs
    if (this.place) {
      for (const ref of getTags(this.place, 'npc')) {
        const npcEvent = this.events.get(ref[1]);
        if (npcEvent) sources.push(npcEvent);
      }
    }
    // Roaming NPCs
    const roaming = findRoamingNpcsAtPlace(
      this.events, this.currentPlace, this.player.getMoveCount(),
      (npcDtag) => this.player.getNpcState(npcDtag),
    );
    for (const { npcEvent } of roaming) sources.push(npcEvent);

    for (const src of sources) {
      // on-player-health tags
      for (const tag of getTags(src, 'on-player-health')) {
        const direction = tag[1];
        const threshold = tag[2];
        const action = tag[3];
        const target = tag[4];
        const threshVal = this._resolveHealthThreshold(threshold, maxHealth);
        let crossed = false;
        if (direction === 'down') {
          crossed = prevHealth > threshVal && newHealth <= threshVal;
        } else if (direction === 'up') {
          crossed = prevHealth < threshVal && newHealth >= threshVal;
        }
        if (!crossed) continue;
        this._fireHealthAction(action, target, null, src, null);
      }
      // Legacy on-player-health-zero
      for (const tag of getTags(src, 'on-player-health-zero')) {
        const hasBlank = tag[1] === '';
        const action = hasBlank ? tag[2] : tag[1];
        const target = hasBlank ? tag[3] : tag[2];
        if (prevHealth > 0 && newHealth <= 0) {
          this._fireHealthAction(action, target, null, src, null);
        }
      }
    }
  }

  /**
   * Fire a single health trigger action.
   */
  _fireHealthAction(action, target, extRef, sourceEvent, npcDtag) {
    if (action === 'set-state' && npcDtag) {
      const ns = this.player.getNpcState(npcDtag);
      if (ns && ns.state !== target) {
        const transition = findTransition(sourceEvent, ns.state, target);
        this.player.setNpcState(npcDtag, { ...ns, state: target });
        this.player.setState(npcDtag, target);
        if (transition?.text) this._emit(transition.text, 'narrative');
      }
      if (extRef) {
        const result = applyExternalSetState(
          extRef, target, this.events, this.player,
          (t, ty) => this._emit(t, ty),
          (h, ty) => this._emitHtml(h, ty),
        );
        if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
      }
    } else if (action === 'consequence' && target) {
      this._executeConsequence(target);
    } else if (action === 'traverse' && target) {
      this._traverse(target);
    } else if (action === 'flees' && npcDtag) {
      this._npcFlees(sourceEvent, npcDtag);
    } else if (action === 'give-item' && target) {
      giveItem(target, this.events, this.player, (t, ty) => this._emit(t, ty));
    } else if (action === 'sound' && target) {
      this._emitSound(target, extRef);
    }
  }

  /**
   * Handle `attack <npc> [with <weapon>]` combat flow.
   */
  _handleAttack(npcEvent, npcDtag, weaponEvent, weaponDtag) {
    const npcTitle = getTag(npcEvent, 'title') || 'Enemy';

    // Check NPC has health
    const npcState = this.player.getNpcState(npcDtag);
    if (!npcState) {
      this.player.ensureNpcState(npcDtag, initNpcState(npcEvent));
    }
    const ns = this.player.getNpcState(npcDtag);
    if (ns.health == null || ns.health <= 0) {
      this._emit(`${npcTitle} is already defeated.`, 'narrative');
      return;
    }

    // Set combat target for deal-damage-npc resolution
    this.combatTarget = npcDtag;

    // 1. Player attacks — fire weapon on-interact "attack" tags
    const currentState = this.player.getState(weaponDtag) || getDefaultState(weaponEvent);
    for (const tag of getTags(weaponEvent, 'on-interact')) {
      if (tag[1] !== 'attack') continue;
      const action = tag[2];
      const targetState = tag[3];

      if (action === 'deal-damage-npc') {
        this._dealDamageToNpc(targetState || npcDtag, weaponEvent);
      }
    }

    // If weapon has no on-interact attack, use damage tag directly
    const hasAttackInteract = getTags(weaponEvent, 'on-interact').some((t) => t[1] === 'attack');
    if (!hasAttackInteract) {
      this._dealDamageToNpc(npcDtag, weaponEvent);
    }

    // 2. NPC counterattack — fire on-attacked tags (if NPC still alive)
    // Shape: ["on-attacked", "<item-ref-or-blank>", "<action>", "<arg?>", "<ext-target?>"]
    const nsAfter = this.player.getNpcState(npcDtag);
    if (nsAfter && nsAfter.health > 0) {
      for (const tag of getTags(npcEvent, 'on-attacked')) {
        const weaponFilter = tag[1];
        // Skip if weapon-specific and doesn't match
        if (weaponFilter && weaponFilter !== weaponDtag) continue;

        const action = tag[2];
        const actionTarget = tag[3];
        const extTarget = tag[4];

        if (action === 'deal-damage') {
          const dmg = parseInt(actionTarget, 10) || parseInt(getTag(npcEvent, 'damage') || '1', 10);
          this._dealDamageToPlayer(dmg, npcEvent, npcDtag);
        } else if (action === 'increment' || action === 'decrement' || action === 'set-counter') {
          this._applyCounterAction(action, npcDtag, actionTarget, extTarget, npcEvent);
        } else if (action === 'set-state') {
          if (extTarget) {
            // External target — set state on another event
            const result = applyExternalSetState(
              extTarget, actionTarget, this.events, this.player,
              (t, ty) => this._emit(t, ty),
              (h, ty) => this._emitHtml(h, ty),
            );
            if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
          } else {
            // Self — set NPC state
            const ns2 = this.player.getNpcState(npcDtag);
            if (ns2 && actionTarget && ns2.state !== actionTarget) {
              const transition = findTransition(npcEvent, ns2.state, actionTarget);
              this.player.setNpcState(npcDtag, { ...ns2, state: actionTarget });
              this.player.setState(npcDtag, actionTarget);
              if (transition?.text) this._emit(transition.text, 'narrative');
            }
          }
        } else if (action === 'consequence' && actionTarget) {
          this._executeConsequence(actionTarget);
        } else if (action === 'flees') {
          this._npcFlees(npcEvent, npcDtag);
        } else if (action === 'steals-item') {
          this._npcStealsItem(npcDtag, actionTarget);
        } else if (action === 'sound') {
          this._emitSound(actionTarget, extTarget);
        }
      }
    }

    this.combatTarget = null;
  }

  /**
   * Heal the player.
   */
  _healPlayer(amount) {
    if (this.player.getHealth() == null) {
      // Initialize health if not set (world without health tag)
      this.player.setHealth(10);
      this.player.setMaxHealth(10);
    }
    const before = this.player.getHealth();
    this.player.heal(amount);
    const healed = this.player.getHealth() - before;
    if (healed > 0) {
      this._emit(`Healed ${healed} HP. (HP: ${this.player.getHealth()})`, 'item');
    }
  }

  // ── Counter actions ──────────────────────────────────────────────────

  /**
   * Apply a counter action (decrement, increment, set-counter) on an event.
   *
   * On-interact positions:
   *   increment/decrement: ["on-interact", verb, action, counterName, externalRef?]
   *   set-counter:         ["on-interact", verb, "set-counter", counterName, value, externalRef?]
   *
   * @param {string} action — 'decrement', 'increment', or 'set-counter'
   * @param {string} eventDtag — the event this tag is declared on (self)
   * @param {string} counterName — counter name (position 3)
   * @param {string} valueOrRef — position 4: value for set-counter, or external ref for inc/dec
   * @param {Object} event — the event object (for on-counter evaluation)
   * @param {string} [externalRef] — position 5: external ref for set-counter
   */
  _applyCounterAction(action, eventDtag, counterName, valueOrRef, event, externalRef) {
    if (!counterName) return;

    // Resolve target: external ref overrides self
    let targetDtag = eventDtag;
    let targetEvent = event;
    if (action === 'set-counter' && externalRef) {
      // set-counter: position 4 = value, position 5 = external ref
      targetDtag = externalRef;
      targetEvent = this.events.get(externalRef);
    } else if ((action === 'increment' || action === 'decrement') && valueOrRef && this.events.has(valueOrRef)) {
      // increment/decrement: position 4 = external ref (if it resolves to an event)
      targetDtag = valueOrRef;
      targetEvent = this.events.get(valueOrRef);
      valueOrRef = null; // not a numeric value
    }

    const key = `${targetDtag}:${counterName}`;
    const current = this.player.getCounter(key);
    if (current === undefined && action !== 'set-counter') return;

    let newVal;
    if (action === 'decrement') {
      if (current <= 0) return;
      newVal = Math.max(0, current - 1);
    } else if (action === 'increment') {
      newVal = (current || 0) + 1;
    } else if (action === 'set-counter') {
      newVal = parseInt(valueOrRef, 10) || 0;
    }

    this.player.setCounter(key, newVal);

    // Evaluate on-counter threshold crossing
    if (!targetEvent || current === undefined) return;

    for (const ct of getTags(targetEvent, 'on-counter')) {
      // Support both new shape (with direction) and legacy (without)
      // New:    ["on-counter", "down", "battery", "20", "set-state", "flickering"]
      // Legacy: ["on-counter", "battery", "20", "set-state", "flickering"]
      const hasDirection = ct[1] === 'down' || ct[1] === 'up';
      const direction = hasDirection ? ct[1] : 'down';
      const ctCounter = hasDirection ? ct[2] : ct[1];
      if (ctCounter !== counterName) continue;
      const threshold = parseInt(hasDirection ? ct[3] : ct[2], 10);
      const ctAction = hasDirection ? ct[4] : ct[3];
      const ctTarget = hasDirection ? ct[5] : ct[4];

      let crossed = false;
      if (direction === 'down' && newVal < current) {
        // Downward: was above threshold, now at-or-below
        crossed = current > threshold && newVal <= threshold;
      } else if (direction === 'up' && newVal > current) {
        // Upward: was below threshold, now at-or-above
        crossed = current < threshold && newVal >= threshold;
      }

      if (crossed) {
        if (ctAction === 'set-state' && ctTarget) {
          const currentState = this.player.getState(targetDtag);
          const transition = findTransition(targetEvent, currentState, ctTarget);
          if (transition) {
            this.player.setState(targetDtag, transition.to);
            if (transition.text) this._emit(transition.text, 'narrative');
          }
        } else if (ctAction === 'consequence' && ctTarget) {
          this._executeConsequence(ctTarget);
        } else if (ctAction === 'traverse' && ctTarget) {
          this._traverse(ctTarget);
        } else if (ctAction === 'sound' && ctTarget) {
          this._emitSound(ctTarget);
        }
      }
    }
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

    // 3. deal-damage
    for (const tag of tags.filter((t) => t[0] === 'deal-damage')) {
      const amount = parseInt(tag[1], 10) || 0;
      if (amount > 0) {
        const prevHealth = this.player.getHealth();
        this.player.dealDamage(amount);
        this._emit(`You take ${amount} damage. (HP: ${this.player.getHealth()})`, 'error');
        if (prevHealth != null) this._evalPlayerHealthTriggers(prevHealth, this.player.getHealth());
      }
    }

    // 3b. set-state — external state changes (e.g. NPC burning, clue revealed)
    for (const tag of tags.filter((t) => t[0] === 'set-state')) {
      const targetState = tag[1];
      const targetRef = tag[2];
      if (targetRef) {
        const result = applyExternalSetState(
          targetRef, targetState, this.events, this.player,
          (t, ty) => this._emit(t, ty),
          (h, ty) => this._emitHtml(h, ty),
        );
        if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
      }
    }

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

    // 9. Content + 10. Respawn
    const respawnRef = getTag(event, 'respawn');
    if (event.content) {
      this._emit(event.content, respawnRef ? 'death' : 'narrative');
    }
    if (respawnRef) {
      this._emit('', 'death-separator');
      this.enterRoom(respawnRef);
    }
  }

  // ── NPC encounter ──────────────────────────────────────────────────────

  _fireNpcEncounter(npcEvent, npcDtag) {
    // Shape: ["on-encounter", "<filter>", "<action>", "<arg?>", "<ext-target?>"]
    // Filter: "" = any entity, "player" = player only, NPC a-tag = that NPC only
    for (const tag of getTags(npcEvent, 'on-encounter')) {
      const filter = tag[1];
      // Currently only player encounters are implemented
      if (filter && filter !== 'player') continue;

      const action = tag[2];
      const actionTarget = tag[3];
      const extTarget = tag[4];

      if (action === 'set-state') {
        if (extTarget) {
          // External target
          const result = applyExternalSetState(
            extTarget, actionTarget, this.events, this.player,
            (t, ty) => this._emit(t, ty),
            (h, ty) => this._emitHtml(h, ty),
          );
          if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
        } else {
          // Self — update NPC's own state
          const npcState = this.player.getNpcState(npcDtag);
          if (npcState && npcState.state !== actionTarget) {
            this.player.setNpcState(npcDtag, { ...npcState, state: actionTarget });
            this.player.setState(npcDtag, actionTarget);
            const transition = findTransition(npcEvent, npcState.state, actionTarget);
            if (transition?.text) this._emit(transition.text, 'narrative');
          }
        }
      } else if (action === 'steals-item') {
        this._npcStealsItem(npcDtag, actionTarget);
      } else if (action === 'deal-damage') {
        const dmg = parseInt(actionTarget, 10) || parseInt(getTag(npcEvent, 'damage') || '1', 10);
        this._dealDamageToPlayer(dmg, npcEvent, npcDtag);
      } else if (action === 'consequence') {
        if (actionTarget) this._executeConsequence(actionTarget);
      } else if (action === 'traverse') {
        if (actionTarget) this._traverse(actionTarget);
      } else if (action === 'increment' || action === 'decrement' || action === 'set-counter') {
        this._applyCounterAction(action, npcDtag, actionTarget, extTarget, npcEvent);
      } else if (action === 'flees') {
        this._npcFlees(npcEvent, npcDtag);
      } else if (action === 'sound') {
        this._emitSound(actionTarget, extTarget);
      }
    }
  }

  /**
   * NPC flees — emits flee message.
   * The actual movement is handled by the caller via set-state + roams-when:
   *   ["on-encounter", "player", "set-state", "fled"]
   *   ["on-encounter", "player", "flees"]
   *   ["roams-when", "fled"]
   * The set-state activates roaming, and the NPC naturally moves to a
   * different route place on the next move. flees just emits the message.
   */
  _npcFlees(npcEvent, npcDtag) {
    const npcTitle = getTag(npcEvent, 'title') || 'Someone';
    this._emit(`${npcTitle} flees!`, 'npc');
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

    // Build a map of place → NPCs at that place (for NPC-on-NPC encounters)
    const npcsByPlace = new Map();
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') !== 'npc') continue;
      if (getTags(event, 'route').length === 0) continue;

      const npcState = this.player.getNpcState(dtag);
      if (!npcState) continue;

      const npcPlace = calculateNpcPlace(event, moveCount, npcState.state);
      if (!npcPlace) continue;

      if (!npcsByPlace.has(npcPlace)) npcsByPlace.set(npcPlace, []);
      npcsByPlace.get(npcPlace).push({ dtag, event, state: npcState });

      // Fire on-enter triggers for the NPC's current place
      for (const tag of getTags(event, 'on-enter')) {
        const placeRef = tag[1];
        if (placeRef === 'player') continue;
        if (placeRef !== npcPlace) continue;

        const action = tag[2];
        const actionTarget = tag[3];
        const extTarget = tag[4];
        if (action === 'deposits') {
          this._npcDeposits(dtag, npcPlace);
        } else if (action === 'sound') {
          this._emitSound(actionTarget, extTarget);
        }
      }
    }

    // NPC-on-NPC encounters — check on-encounter tags with NPC ref filters
    for (const [, npcsHere] of npcsByPlace) {
      if (npcsHere.length < 2) continue;
      for (const npc of npcsHere) {
        for (const tag of getTags(npc.event, 'on-encounter')) {
          const filter = tag[1];
          if (filter === 'player') continue; // player-only — skip for NPC encounters
          // "" = any entity (fires for NPC encounters too)
          // NPC a-tag = specific NPC only
          if (filter) {
            const targetHere = npcsHere.find((other) => other.dtag === filter && other.dtag !== npc.dtag);
            if (!targetHere) continue;
          }

          const action = tag[2];
          const actionTarget = tag[3];
          const extTarget = tag[4];

          if (action === 'steals-item') {
            this._npcStealsItem(npc.dtag, actionTarget);
          } else if (action === 'set-state') {
            if (extTarget) {
              applyExternalSetState(
                extTarget, actionTarget, this.events, this.player,
                (t, ty) => this._emit(t, ty),
                (h, ty) => this._emitHtml(h, ty),
              );
            } else {
              const ns = this.player.getNpcState(npc.dtag);
              if (ns && ns.state !== actionTarget) {
                this.player.setNpcState(npc.dtag, { ...ns, state: actionTarget });
                this.player.setState(npc.dtag, actionTarget);
                const transition = findTransition(npc.event, ns.state, actionTarget);
                if (transition?.text) this._emit(transition.text, 'narrative');
              }
            }
          } else if (action === 'consequence' && actionTarget) {
            this._executeConsequence(actionTarget);
          } else if (action === 'flees') {
            this._npcFlees(npc.event, npc.dtag);
          }
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

    // Allow the player to leave the puzzle
    const trimmed = answer.trim().toLowerCase();
    if (['back', 'leave', 'cancel', 'quit', 'exit'].includes(trimmed)) {
      this.puzzleActive = null;
      this._emit('You step away from the puzzle.', 'narrative');
      return;
    }

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
      // Fire on-fail tags (riddle/cipher only)
      this._firePuzzleOnFail(puzzleEvent, this.puzzleActive);
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
      } else if (action === 'consequence' && (value || extRef)) {
        this._executeConsequence(extRef || value);
      } else if (action === 'traverse' && (value || extRef)) {
        this._traverse(extRef || value);
      } else if (action === 'increment' || action === 'decrement' || action === 'set-counter') {
        // Counter actions on puzzle — counterName in value, amount/val in extRef
        const puzzleDtag = this.puzzleActive;
        if (puzzleDtag) {
          const puzzleEvt = this.events.get(puzzleDtag);
          this._applyCounterAction(action, puzzleDtag, value, extRef, puzzleEvt);
        }
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
      } else if (action === 'sound') {
        this._emitSound(value, extRef);
      }
    }

    this.puzzleActive = null;
  }

  /**
   * Fire on-fail tags on a puzzle after a wrong answer.
   * Shape: ["on-fail", "", "<action>", "<target?>", "<ext-ref?>"]
   * Only valid on riddle and cipher puzzle types.
   */
  _firePuzzleOnFail(puzzleEvent, puzzleDtag) {
    for (const tag of getTags(puzzleEvent, 'on-fail')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'deal-damage') {
        const amount = parseInt(value, 10) || 1;
        const prevHealth = this.player.getHealth();
        if (prevHealth != null) {
          this.player.dealDamage(amount);
          this._emit(`You take ${amount} damage. (HP: ${this.player.getHealth()})`, 'error');
          this._evalPlayerHealthTriggers(prevHealth, this.player.getHealth());
        }
      } else if (action === 'set-state' && extRef) {
        const result = applyExternalSetState(
          extRef, value, this.events, this.player,
          (t, ty) => this._emit(t, ty),
          (h, ty) => this._emitHtml(h, ty),
        );
        if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
      } else if (action === 'consequence' && value) {
        this._executeConsequence(value);
      } else if (action === 'traverse' && value) {
        this._traverse(value);
      } else if (action === 'decrement') {
        this._applyCounterAction('decrement', puzzleDtag, value, extRef, puzzleEvent);
      } else if (action === 'increment') {
        this._applyCounterAction('increment', puzzleDtag, value, extRef, puzzleEvent);
      } else if (action === 'set-counter') {
        this._applyCounterAction('set-counter', puzzleDtag, value, extRef, puzzleEvent);
      } else if (action === 'sound') {
        this._emitSound(value, extRef);
      }
    }
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

    const text = node.content || getTag(node, 'text'); // prefer content, fall back to text tag
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

    // Check recipes (not place-scoped)
    const recipeMatch = this._findRecipeByNoun(noun);
    if (recipeMatch) return recipeMatch;

    return null;
  }

  // ── Recipe helpers ──────────────────────────────────────────────────

  /** Find all recipe events in the world. */
  _findRecipes() {
    const recipes = [];
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') === 'recipe') {
        recipes.push({ event, dtag });
      }
    }
    return recipes;
  }

  /** Find a recipe by noun/title match. */
  _findRecipeByNoun(noun) {
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') !== 'recipe') continue;
      const title = getTag(event, 'title')?.toLowerCase() || '';
      if (title.includes(noun)) return { event, dtag, type: 'recipe' };
      for (const nt of getTags(event, 'noun')) {
        for (let i = 1; i < nt.length; i++) {
          if (nt[i].toLowerCase() === noun) return { event, dtag, type: 'recipe' };
        }
      }
    }
    return null;
  }

  /** Examine a recipe — show content + shuffled ingredient list. */
  _examineRecipe(event, dtag) {
    if (event.content) this._emit(event.content, 'narrative');
    const requires = getTags(event, 'requires');
    if (requires.length > 0) {
      this._emit('Requires:', 'narrative');
      // Shuffle the requires list so ordered recipes don't reveal the sequence
      const shuffled = [...requires].sort(() => Math.random() - 0.5);
      for (const req of shuffled) {
        const refEvent = this.events.get(req[1]);
        const name = refEvent ? getTag(refEvent, 'title') : req[1];
        const stateReq = req[2] ? ` (${req[2]})` : '';
        const has = this._checkSingleRequire(req) ? '\u2713' : '\u2717';
        this._emit(`  ${has} ${name}${stateReq}`, 'item');
      }
    }
    if (this.player.isPuzzleSolved(dtag)) {
      this._emit('Already crafted.', 'narrative');
    }
  }

  /** Check a single requires tag against player state. */
  _checkSingleRequire(reqTag) {
    const ref = reqTag[1];
    const reqState = reqTag[2];
    const refEvent = this.events.get(ref);
    if (!refEvent) return false;
    const type = getTag(refEvent, 'type');
    if (type === 'item') {
      if (!this.player.hasItem(ref)) return false;
      if (reqState) {
        const itemState = this.player.getState(ref);
        if (itemState !== reqState) return false;
      }
      return true;
    }
    // Feature/other state check
    const currentState = this.player.getState(ref) ?? getDefaultState(refEvent);
    if (reqState && currentState !== reqState) return false;
    return !reqState || currentState === reqState;
  }

  /** Attempt to craft a recipe. */
  _attemptCraft(event, dtag) {
    if (this.player.isPuzzleSolved(dtag)) {
      this._emit('Already crafted.', 'narrative');
      return;
    }

    const ordered = getTag(event, 'ordered') === 'true';

    if (ordered) {
      // Check non-item requires first (feature states) — fail early
      const requires = getTags(event, 'requires');
      for (const req of requires) {
        const refEvent = this.events.get(req[1]);
        if (!refEvent) continue;
        const type = getTag(refEvent, 'type');
        if (type !== 'item' && !this._checkSingleRequire(req)) {
          const desc = req[3] || "You're missing something.";
          this._emit(desc, 'error');
          return;
        }
      }

      // Collect item requires in order
      const itemRequires = requires.filter((req) => {
        const refEvent = this.events.get(req[1]);
        return refEvent && getTag(refEvent, 'type') === 'item';
      });

      if (itemRequires.length === 0) {
        // No item requires — just fire on-complete
        this._fireCraftComplete(event, dtag);
        return;
      }

      this.craftingActive = { recipeDtag: dtag, step: 0, itemRequires };
      this._emit('Combine items in order.', 'puzzle');
    } else {
      // Unordered — check all requires at once
      const reqResult = checkRequires(event, this.player.state, this.events);
      if (!reqResult.allowed) {
        this._emit(reqResult.reason, 'error');
        return;
      }
      this._fireCraftComplete(event, dtag);
    }
  }

  /** Handle ordered crafting step — player typed an item name. */
  _handleCraftStep(input) {
    if (!this.craftingActive) return false;

    const noun = stripArticles(input.trim().toLowerCase());
    const { recipeDtag, step, itemRequires } = this.craftingActive;
    const recipeEvent = this.events.get(recipeDtag);

    // Find item in inventory by noun
    const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (!invMatch) {
      this._emit("You don't have that.", 'error');
      return true; // consumed input but stay in crafting mode
    }

    // Check if this item matches the current step's requires ref
    const expectedRef = itemRequires[step][1];
    const expectedState = itemRequires[step][2];

    if (invMatch.dtag !== expectedRef) {
      this._emit("That's not right.", 'error');
      this._firePuzzleOnFail(recipeEvent, recipeDtag);
      this.craftingActive = null;
      return true;
    }

    // Check item state if required
    if (expectedState) {
      const itemState = this.player.getState(invMatch.dtag);
      if (itemState !== expectedState) {
        const desc = itemRequires[step][3] || "That item isn't in the right state.";
        this._emit(desc, 'error');
        this._firePuzzleOnFail(recipeEvent, recipeDtag);
        this.craftingActive = null;
        return true;
      }
    }

    // Advance
    const nextStep = step + 1;
    if (nextStep >= itemRequires.length) {
      // All items selected — fire on-complete
      this.craftingActive = null;
      this._fireCraftComplete(recipeEvent, recipeDtag);
    } else {
      this.craftingActive = { ...this.craftingActive, step: nextStep };
    }
    return true;
  }

  /** Fire on-complete actions for a successfully crafted recipe. */
  _fireCraftComplete(event, dtag) {
    this.player.markPuzzleSolved(dtag);

    // Emit recipe content as crafting prose
    if (event.content) this._emit(event.content, 'narrative');

    // Fire on-complete actions
    for (const tag of getTags(event, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'give-item') {
        giveItem(value, this.events, this.player, (t, ty) => this._emit(t, ty));
      } else if (action === 'consume-item') {
        if (this.player.hasItem(value)) {
          this.player.removeItem(value);
        }
      } else if (action === 'set-state' && extRef) {
        const result = applyExternalSetState(
          extRef, value, this.events, this.player,
          (t, ty) => this._emit(t, ty),
          (h, ty) => this._emitHtml(h, ty),
        );
        if (result.puzzleActivated) this.puzzleActive = result.puzzleActivated;
      } else if (action === 'consequence' && (value || extRef)) {
        this._executeConsequence(extRef || value);
      } else if (action === 'traverse' && (value || extRef)) {
        this._traverse(extRef || value);
      }
    }

    // Fire transition if recipe has state
    const recipeState = this.player.getState(dtag) ?? getDefaultState(event);
    const transition = findTransition(event, recipeState, 'known');
    if (transition) {
      this.player.setState(dtag, transition.to);
      if (transition.text) this._emit(transition.text, 'narrative');
    }

    this._evalQuests();
  }

  // ── Quest tracking ──────────────────────────────────────────────────

  /** Find all quest events in the world. */
  _findQuests() {
    const quests = [];
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') === 'quest') {
        // Skip hidden quest events (untrusted authors in closed/vouched modes)
        if (this.config.trustSet) {
          const level = getTrustLevel(this.config.trustSet, event.pubkey, 'all', this.config.clientMode || 'community');
          if (level === 'hidden') continue;
        }
        quests.push({ event, dtag });
      }
    }
    return quests;
  }

  /** Evaluate all quests and mark newly completed ones. */
  _evalQuests(depth = 0) {
    let anyCompleted = false;
    for (const { event, dtag } of this._findQuests()) {
      if (this.player.getState(dtag) === 'complete') continue;
      const req = checkRequires(event, this.player.state, this.events);
      if (!req.allowed) continue;

      this.player.setState(dtag, 'complete');
      anyCompleted = true;

      const questType = getTag(event, 'quest-type') || 'open';
      const isEndgame = questType === 'endgame';

      if (isEndgame) {
        // Endgame quest — render closing prose with distinct styling
        this._emit('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'endgame-separator');
        if (event.content) {
          this._emitHtml(renderMarkdown(event.content), 'endgame');
        }
        this._emit('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'endgame-separator');
        // Check mode: ["quest-type", "endgame", "open"] = soft end
        const modeTag = event.tags.find((t) => t[0] === 'quest-type');
        const mode = modeTag?.[2] === 'open' ? 'soft' : 'hard';
        this.gameOver = mode;
        if (mode === 'hard') {
          this._emit('Type "restart" to play again.', 'endgame-prompt');
        } else {
          this._emit('The story continues. You may keep exploring, or type "restart" to play again.', 'endgame-prompt');
        }
      } else {
        const title = getTag(event, 'title') || 'Quest';
        this._emit(`Quest complete: ${title}`, 'success');
      }

      // Fire on-complete actions (set-state, give-item, consequence, sound)
      for (const tag of getTags(event, 'on-complete')) {
        const action = tag[2];
        const value = tag[3];
        const extRef = tag[4];

        if (action === 'set-state' && extRef) {
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
        } else if (action === 'give-item' && (value || extRef)) {
          giveItem(extRef || value, this.events, this.player, (t, ty) => this._emit(t, ty));
        } else if (action === 'consequence' && (value || extRef)) {
          this._executeConsequence(extRef || value);
        } else if (action === 'sound') {
          this._emitSound(value, extRef);
        }
      }
    }

    // Cascade: quest completion may satisfy other quests' requires
    if (anyCompleted && depth < 10) {
      this._evalQuests(depth + 1);
    }
  }

  /** Show quest log — active and completed quests. */
  _showQuestLog() {
    // Filter out endgame quests — they're internal win-state detectors
    const quests = this._findQuests().filter(({ event }) => getTag(event, 'quest-type') !== 'endgame');
    if (quests.length === 0) {
      this._emit('No quests.', 'narrative');
      return;
    }

    const active = [];
    const completed = [];
    for (const { event, dtag } of quests) {
      const title = getTag(event, 'title') || dtag;
      if (this.player.getState(dtag) === 'complete') {
        completed.push({ title, event, dtag });
      } else {
        active.push({ title, event, dtag });
      }
    }

    if (active.length > 0) {
      this._emit('Active quests:', 'narrative');
      for (const q of active) {
        this._emit(`  \u25cb ${q.title}`, 'puzzle');
        // Build step completion list
        const questType = getTag(q.event, 'quest-type') || 'open';
        const steps = getTags(q.event, 'involves').map((inv) => {
          const invRef = inv[1];
          const invEvent = this.events.get(invRef);
          if (!invEvent) return null;
          const invTitle = getTag(invEvent, 'title') || invRef.split(':').pop();
          const state = this.player.getState(invRef);
          const solved = this.player.isPuzzleSolved(invRef);
          const held = this.player.hasItem(invRef);
          const done = solved || held || (state && state !== getDefaultState(invEvent));
          return { invTitle, done };
        }).filter(Boolean);
        // Display steps according to quest-type
        let foundNextUndone = false;
        for (const step of steps) {
          if (step.done) {
            this._emit(`    \u2713 ${step.invTitle}`, 'item');
          } else {
            switch (questType) {
              case 'hidden':
                this._emit('    \u2717 ???', 'dim');
                break;
              case 'mystery':
                break; // don't show undone steps
              case 'sequential':
                if (!foundNextUndone) {
                  this._emit(`    \u2717 ${step.invTitle}`, 'dim');
                  foundNextUndone = true;
                }
                break; // remaining undone steps hidden
              default: // 'open'
                this._emit(`    \u2717 ${step.invTitle}`, 'dim');
            }
          }
        }
      }
    }

    if (completed.length > 0) {
      this._emit('Completed:', 'narrative');
      for (const q of completed) {
        this._emit(`  \u2713 ${q.title}`, 'dim');
      }
    }
  }

  // ── Help ─────────────────────────────────────────────────────────────

  _showHelp() {
    this._emit('Commands:', 'title');
    const cmds = [
      ['look (l)', 'Look around'],
      ['look &lt;direction&gt;', 'Examine exits in a direction'],
      ['go &lt;direction&gt;', 'Move (or just type the direction)'],
      ['examine &lt;thing&gt;', 'Examine something closely'],
      ['take &lt;item&gt;', 'Pick up an item'],
      ['take &lt;item&gt; from &lt;container&gt;', 'Take from a container'],
      ['drop &lt;item&gt;', 'Drop an item on the ground'],
      ['inventory (i)', 'Show what you are carrying'],
      ['talk &lt;someone&gt;', 'Talk to someone'],
      ['quests (q)', 'Show quest log'],
      ['restart', 'Start over (resets all progress)'],
      ['help (h)', 'Show this help'],
    ];
    for (const [cmd, desc] of cmds) {
      this._emitHtml(`<span style="color:var(--colour-highlight)">${cmd}</span> <span style="color:var(--colour-dim)">— ${desc}</span>`, 'narrative');
    }

    // Show context-specific verbs from the current place + inventory
    const roamingHere = findRoamingNpcsAtPlace(
      this.events, this.currentPlace, this.player.getMoveCount(),
      (npcDtag) => this.player.getNpcState(npcDtag),
    );
    const roamingEvents = roamingHere.map((r) => r.npcEvent);
    const recipeEvents = this._findRecipes().map((r) => r.event);
    const verbMap = buildVerbMap(this.events, this.place, this.player.state.inventory, [...roamingEvents, ...recipeEvents]);

    // Collect unique canonical verbs (exclude built-ins)
    const builtIns = new Set(['examine', 'look', 'talk']);
    const contextVerbs = new Set();
    for (const [, canonical] of verbMap) {
      if (!builtIns.has(canonical)) contextVerbs.add(canonical);
    }

    if (contextVerbs.size > 0) {
      this._emit('', 'narrative');
      this._emit('Available actions:', 'title');
      this._emit(`  ${[...contextVerbs].join(', ')}`, 'highlight');
      this._emit('  Use with a noun: <action> <thing>', 'dim');
    }
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
        this._listContainerContents(event, dtag);
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
      } else if (verb === 'attack') {
        // Find weapon — from instrumentNoun or auto-detect
        let weaponMatch = null;
        if (instrumentNoun) {
          weaponMatch = findInventoryItem(this.events, this.player.state.inventory, stripArticles(instrumentNoun));
        } else {
          // Auto-find first weapon in inventory with damage tag
          for (const invDtag of this.player.state.inventory) {
            const invEvent = this.events.get(invDtag);
            if (invEvent && getTag(invEvent, 'damage')) {
              weaponMatch = { event: invEvent, dtag: invDtag };
              break;
            }
          }
        }
        if (!weaponMatch) {
          this._emit('You have no weapon.', 'error');
          return;
        }
        this._handleAttack(event, dtag, weaponMatch.event, weaponMatch.dtag);
      } else {
        this._emit("You can't do that.", 'error');
      }
    } else if (type === 'recipe') {
      if (verb === 'examine') {
        this._examineRecipe(event, dtag);
      } else {
        this._attemptCraft(event, dtag);
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

    // Hard endgame — only "restart" accepted
    if (this.gameOver === 'hard') {
      if (trimmed === 'restart') {
        this._emit('Restarting...', 'narrative');
        this._emit('', 'restart'); // signal to App to clear state
        return;
      }
      this._emit('The story is over. Type "restart" to play again.', 'endgame-prompt');
      return;
    }

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

    // Crafting mode — ordered recipe step
    if (this.craftingActive) {
      if (this._handleCraftStep(trimmed)) return;
    }

    // Dialogue mode
    if (this.dialogueActive) { this.handleDialogueChoice(trimmed); return; }

    // Puzzle mode
    if (this.puzzleActive) { await this.handlePuzzleAnswer(input.trim()); return; }

    // Restart confirmation
    if (this.pendingRestart) {
      this.pendingRestart = false;
      if (trimmed === 'yes' || trimmed === 'y') {
        this._emit('Restarting...', 'narrative');
        this._emit('', 'restart');
      } else {
        this._emit('Restart cancelled.', 'narrative');
      }
      return;
    }

    // Built-in: restart (mid-game needs confirmation, soft endgame does not)
    if (trimmed === 'restart') {
      if (this.gameOver === 'soft') {
        this._emit('Restarting...', 'narrative');
        this._emit('', 'restart');
      } else {
        this.pendingRestart = true;
        this._emit('Are you sure? This will reset all progress. (yes/no)', 'narrative');
      }
      return;
    }

    // Built-in: look in <container>
    const lookInMatch = trimmed.match(/^(?:look|l)\s+in\s+(.+)$/);
    if (lookInMatch) {
      const cNoun = stripArticles(lookInMatch[1]);
      const container = this._findContainer(cNoun);
      if (container) {
        const desc = container.event.content;
        if (desc) this._emit(desc, 'narrative');
        this._listContainerContents(container.event, container.dtag);
        return;
      }
      // Fall through to look direction / examine
    }

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

    // Built-in: quests
    if (trimmed === 'quests' || trimmed === 'quest' || trimmed === 'q') {
      this._showQuestLog();
      return;
    }

    // Built-in: help
    if (trimmed === 'help' || trimmed === 'h' || trimmed === '?') {
      this._showHelp();
      return;
    }

    // Built-in: reset — return to start place
    if (trimmed === 'reset') {
      this.enterRoom(this.config.GENESIS_PLACE);
      return;
    }

    // Built-in: drop
    const dropMatch = trimmed.match(/^drop\s+(.+)$/);
    if (dropMatch) { this._handleDrop(dropMatch[1]); return; }

    // Built-in: take X from Y
    const takeFromMatch = trimmed.match(/^(?:take|get|grab)\s+(.+?)\s+from\s+(.+)$/);
    if (takeFromMatch) { this._takeFromContainer(takeFromMatch[1], takeFromMatch[2]); return; }

    // Built-in: pick up / take
    const pickupMatch = trimmed.match(/^(?:pick up|take|get|grab)\s+(.+)$/);
    if (pickupMatch) { this.handlePickup(pickupMatch[1]); return; }

    // Built-in: talk / speak
    const talkMatch = trimmed.match(/^(?:talk to|talk|speak with|speak to|speak)\s+(.+)$/);
    if (talkMatch) { this.handleInteraction('talk', talkMatch[1], null); return; }

    // Built-in: examine / x / inspect / look at (works without a verb tag)
    const examineMatch = trimmed.match(/^(?:examine|x|look at|inspect)\s+(.+)$/);
    if (examineMatch) { this.handleExamine(examineMatch[1]); return; }

    // Built-in: attack <npc> [with <weapon>]
    const attackWithMatch = trimmed.match(/^attack\s+(.+?)\s+with\s+(.+)$/);
    if (attackWithMatch) { this.handleInteraction('attack', attackWithMatch[1], attackWithMatch[2]); return; }
    const attackMatch = trimmed.match(/^attack\s+(.+)$/);
    if (attackMatch) { this.handleInteraction('attack', attackMatch[1], null); return; }

    // Data-driven verb/noun parser — include roaming NPCs as verb sources
    const roamingHere = findRoamingNpcsAtPlace(
      this.events, this.currentPlace, this.player.getMoveCount(),
      (npcDtag) => this.player.getNpcState(npcDtag),
    );
    const roamingEvents = roamingHere.map((r) => r.npcEvent);
    const recipeEvents = this._findRecipes().map((r) => r.event);
    const verbMap = buildVerbMap(this.events, this.place, this.player.state.inventory, [...roamingEvents, ...recipeEvents]);
    const parsed = parseInput(trimmed, verbMap);

    if (parsed && parsed.noun1) {
      if (parsed.noun2) {
        // "with" = noun1 is target, noun2 is instrument (attack guard with sword)
        // other prepositions = noun1 is instrument, noun2 is target (use key on door)
        if (parsed.preposition === 'with' || parsed.preposition === 'from') {
          this.handleInteraction(parsed.verb, parsed.noun1, parsed.noun2);
        } else {
          this.handleInteraction(parsed.verb, parsed.noun2, parsed.noun1);
        }
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
