/**
 * GameEngine — central orchestrator for the NOSTR dungeon game.
 * No React imports. Plain JS class.
 */

import {
  getTag, getTags, resolveExits, checkRequires,
  findByNoun, dtagFromRef, getDefaultState, findTransition,
} from '../world.js';
import { derivePrivateKey } from '../nip44-client.js';
import { renderRoomContent } from './content.js';
import { stripArticles, buildVerbMap, parseInput, findInventoryItem } from './parser.js';
import {
  applyExternalSetState, giveItem, evalCounterLow, evalSequencePuzzles,
} from './actions.js';

export class GameEngine {
  /**
   * @param {Object} opts
   * @param {Map} opts.events — Map<dtag, event>
   * @param {import('./player-state.js').PlayerStateMutator} opts.player
   * @param {{ GENESIS_PLACE: string, AUTHOR_PUBKEY: string }} opts.config
   */
  constructor({ events, player, config }) {
    this.events = events;
    this.player = player;
    this.config = config;

    this.currentPlace = config.GENESIS_PLACE;
    this.puzzleActive = null;
    this.dialogueActive = null;

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

  get exits() {
    return resolveExits(this.events, this.currentPlace, this.player.state);
  }

  // ── Room entry ────────────────────────────────────────────────────────

  enterRoom(dtag) {
    const room = this.events.get(dtag);
    if (!room) { this._emit("You can't go that way.", 'error'); return; }
    this.currentPlace = dtag;
    this.puzzleActive = null;
    this.dialogueActive = null;

    const title = getTag(room, 'title') || dtag;
    this._emit(`\n— ${title} —`, 'title');

    // Check place requires
    const placeReq = checkRequires(room, this.player.state, this.events);
    if (!placeReq.allowed) {
      this._emit(placeReq.reason, 'narrative');
      const roomExits = resolveExits(this.events, dtag, this.player.state);
      if (roomExits.length > 0) {
        this._emit(`Exits: ${roomExits.map((e) => e.slot).join(', ')}`, 'exits');
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

    // Items (skip picked-up)
    for (const ref of getTags(room, 'item')) {
      const itemDTag = dtagFromRef(ref[1]);
      if (this.player.hasItem(itemDTag)) continue;
      const item = this.events.get(itemDTag);
      if (item) this._emit(`You see: ${getTag(item, 'title')}`, 'item');
    }

    // Features (skip hidden)
    for (const ref of getTags(room, 'feature')) {
      const fDTag = dtagFromRef(ref[1]);
      const feature = this.events.get(fDTag);
      if (!feature) continue;
      const fDefaultState = getDefaultState(feature);
      const fCurrentState = this.player.getFeatureState(fDTag) ?? fDefaultState;
      if (fCurrentState === 'hidden') continue;
      this._emit(`There is a ${getTag(feature, 'title')} here.`, 'feature');
    }

    // NPCs
    for (const ref of getTags(room, 'npc')) {
      const npcDTag = dtagFromRef(ref[1]);
      const npc = this.events.get(npcDTag);
      if (!npc) continue;
      const npcReq = checkRequires(npc, this.player.state, this.events);
      if (!npcReq.allowed) continue;
      this._emit(`${getTag(npc, 'title')} is here.`, 'npc');
    }

    // Exits
    const roomExits = resolveExits(this.events, dtag, this.player.state);
    if (roomExits.length > 0) {
      this._emit(`Exits: ${roomExits.map((e) => e.slot).join(', ')}`, 'exits');
    }
  }

  // ── Examine inventory item ────────────────────────────────────────────

  examineInventoryItem(invMatch) {
    const desc = getTag(invMatch.event, 'description');
    if (desc) this._emit(desc, 'narrative');
    const itemState = this.player.getItemState(invMatch.dtag);
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
            this.player.setFeatureState(dtag, transition.to);
            if (transition.text) this._emit(transition.text, 'narrative');
            currentState = transition.to;
          }
          acted = true;
        }
      } else if (action === 'give-item') {
        const itemDTag = dtagFromRef(targetState);
        if (!this.player.hasItem(itemDTag)) {
          giveItem(targetState, this.events, this.player, (t, ty) => this._emit(t, ty));
        }
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
    const fCurrent = this.player.getFeatureState(dtag) ?? fDefault;
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
      const fCurrent = this.player.getFeatureState(dtag) ?? fDefault;
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
    const currentState = this.player.getFeatureState(dtag) || defaultState;

    const desc = getTag(event, 'description');
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
    const match = findByNoun(this.events, this.place, noun);
    if (!match) { this._emit("You don't see that here.", 'error'); return; }
    if (match.type !== 'item') { this._emit("You can't pick that up.", 'error'); return; }
    if (this.player.hasItem(match.dtag)) { this._emit('You already have that.', 'error'); return; }

    this.player.pickUp(match.dtag);

    const defaultState = getDefaultState(match.event);
    if (defaultState) this.player.setItemState(match.dtag, defaultState);

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
    const currentState = this.player.getItemState(dtag) || getDefaultState(event);

    let acted = false;
    for (const tag of getTags(event, 'on-interact')) {
      if (tag[1] !== verb) continue;
      const action = tag[2];
      const targetState = tag[3];
      const targetRef = tag[4];

      if (action === 'set-state' && targetRef) {
        const extDTag = dtagFromRef(targetRef);
        const extEvent = this.events.get(extDTag);
        if (!extEvent) continue;

        const extType = getTag(extEvent, 'type');
        if (extType === 'feature') {
          const extCurrentState = this.player.getFeatureState(extDTag) ?? getDefaultState(extEvent);
          const transition = findTransition(extEvent, extCurrentState, targetState);
          if (transition) {
            if (transition.from !== transition.to) {
              this.player.setFeatureState(extDTag, transition.to);
            }
            if (transition.text) this._emit(transition.text, 'narrative');
            acted = true;
            evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty));
          }
        } else if (extType === 'portal') {
          const extCurrentState = this.player.getPortalState(extDTag) ?? getDefaultState(extEvent);
          if (extCurrentState !== targetState) {
            this.player.setPortalState(extDTag, targetState);
            const transition = findTransition(extEvent, extCurrentState, targetState);
            if (transition?.text) this._emit(transition.text, 'narrative');
          }
          acted = true;
        }
      } else if (action === 'set-state' && !targetRef) {
        const transition = findTransition(event, currentState, targetState);
        if (transition) {
          if (transition.from !== transition.to) {
            this.player.setItemState(dtag, transition.to);
          }
          if (transition.text) this._emit(transition.text, 'narrative');
          if (transition.from !== transition.to) {
            evalCounterLow(event, dtag, transition.to, this.player, (t, ty) => this._emit(t, ty));
          }
          acted = true;
        }
      } else if (action === 'consume-item') {
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
      const currentState = this.player.getItemState(dtag);

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

          for (const lt of getTags(item, 'on-counter-low')) {
            if (lt[1] !== counterName) continue;
            const threshold = parseInt(lt[2], 10);
            if (current > threshold && newVal <= threshold && newVal > 0) {
              const action = lt[3];
              const actionTarget = lt[4];
              if (action === 'set-state' && actionTarget) {
                const currentItemState = this.player.getItemState(dtag);
                const transition = findTransition(item, currentItemState, actionTarget);
                if (transition) {
                  this.player.setItemState(dtag, transition.to);
                  if (transition.text) this._emit(transition.text, 'narrative');
                }
              }
            }
          }

          if (newVal === 0) {
            for (const zt of getTags(item, 'on-counter-zero')) {
              if (zt[1] !== counterName) continue;
              if (zt[2] === 'set-state') {
                const targetState = zt[3];
                const stateNow = this.player.getItemState(dtag);
                const transition = findTransition(item, stateNow, targetState);
                this.player.setItemState(dtag, targetState);
                if (transition?.text) this._emit(transition.text, 'narrative');
              }
            }
          }
        }
      }
    }
  }

  // ── Movement ──────────────────────────────────────────────────────────

  handleMove(direction) {
    const exit = this.exits.find((e) => e.slot === direction);
    if (!exit) { this._emit("You can't go that way.", 'error'); return; }

    const req = checkRequires(exit.portalEvent, this.player.state, this.events);
    if (!req.allowed) { this._emit(req.reason, 'error'); return; }

    this.processOnMove();
    this.enterRoom(exit.destinationDTag);
  }

  // ── Puzzle answer ─────────────────────────────────────────────────────

  async handlePuzzleAnswer(answer) {
    if (!this.puzzleActive) return;
    const puzzleEvent = this.events.get(this.puzzleActive);
    if (!puzzleEvent) return;

    const expectedHash = getTag(puzzleEvent, 'answer-hash');
    const salt = getTag(puzzleEvent, 'salt');

    const data = new TextEncoder().encode(answer.toLowerCase().trim() + salt);
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
      answer.toLowerCase().trim(),
      salt
    );

    for (const tag of getTags(puzzleEvent, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      if (action === 'give-crypto-key') {
        this.player.addCryptoKey(derivedPrivKey);
        this._emit('You feel a key take shape in your mind.', 'narrative');
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
        const reqDtag = dtagFromRef(requiresRef);
        const reqEvent = this.events.get(reqDtag);
        const reqType = reqEvent ? getTag(reqEvent, 'type') : '';

        let passes = false;
        if (reqType === 'dialogue') {
          passes = requiresState === 'visited' && this.player.isDialogueVisited(reqDtag);
        } else if (reqType === 'clue') {
          passes = this.player.isClueSeen(reqDtag);
        } else if (reqType === 'item') {
          const hasIt = this.player.hasItem(reqDtag);
          if (!requiresState) {
            passes = hasIt;
          } else {
            passes = hasIt && this.player.getItemState(reqDtag) === requiresState;
          }
        } else if (reqType === 'puzzle') {
          passes = requiresState === 'solved' && this.player.isPuzzleSolved(reqDtag);
        } else if (reqType === 'feature') {
          passes = requiresState && this.player.getFeatureState(reqDtag) === requiresState;
        }

        if (passes) entryRef = nodeRef;
      }
    }

    return entryRef ? dtagFromRef(entryRef) : null;
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
        const extRef = tag[4];
        if (extRef) {
          const targetDTag = dtagFromRef(extRef);
          const targetEvent = this.events.get(targetDTag);
          if (targetEvent) {
            const targetType = getTag(targetEvent, 'type');
            if (targetType === 'clue') {
              this.player.markClueSeen(targetDTag);
              this._emit(`\n${getTag(targetEvent, 'title')}:`, 'clue-title');
              this._emit(targetEvent.content, 'clue');
            } else if (targetType === 'portal') {
              const portalCurrentState = this.player.getPortalState(targetDTag) ?? getDefaultState(targetEvent);
              if (portalCurrentState !== actionTarget) {
                this.player.setPortalState(targetDTag, actionTarget);
                const transition = findTransition(targetEvent, portalCurrentState, actionTarget);
                if (transition?.text) this._emit(transition.text, 'narrative');
              }
            } else if (targetType === 'feature') {
              const featCurrentState = this.player.getFeatureState(targetDTag) ?? getDefaultState(targetEvent);
              if (featCurrentState !== actionTarget) {
                this.player.setFeatureState(targetDTag, actionTarget);
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
        const nextDtag = dtagFromRef(nextRef);
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
      this.enterDialogueNode(this.dialogueActive.npcDtag, selected.nextDtag);
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

  // ── Resolve noun ──────────────────────────────────────────────────────

  resolveNoun(rawNoun) {
    if (!rawNoun) return null;
    const noun = stripArticles(rawNoun);
    if (this.place) {
      const match = findByNoun(this.events, this.place, noun);
      if (match) return match;
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
      const fCurrent = this.player.getFeatureState(dtag) ?? fDefault;
      if (fCurrent === 'hidden') {
        this._emit("You don't see that here.", 'error');
        return;
      }

      const req = checkRequires(event, this.player.state, this.events);
      if (!req.allowed) { this._emit(req.reason, 'error'); return; }

      if (verb === 'examine') {
        const desc = getTag(event, 'description');
        if (desc) this._emit(desc, 'narrative');
      }

      const currentState = this.player.getFeatureState(dtag) ?? fDefault;
      if (!this.processFeatureInteract(event, dtag, verb, currentState)) {
        if (verb !== 'examine') this._emit('Nothing happens.', 'narrative');
      }
    } else if (type === 'npc') {
      if (verb === 'examine') {
        const desc = getTag(event, 'description');
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
          const desc = getTag(event, 'description');
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
      const currentState = this.player.getItemState(dtag);
      if (currentState) evalCounterLow(item, dtag, currentState, this.player, (t, ty) => this._emit(t, ty));
    }
  }

  // ── Main command handler (async for puzzle crypto) ────────────────────

  async handleCommand(input) {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    this._emit(`> ${input}`, 'command');

    // Dialogue mode
    if (this.dialogueActive) { this.handleDialogueChoice(trimmed); return; }

    // Puzzle mode
    if (this.puzzleActive) { await this.handlePuzzleAnswer(trimmed); return; }

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

    // Built-in: pick up / take
    const pickupMatch = trimmed.match(/^(?:pick up|take|get|grab)\s+(.+)$/);
    if (pickupMatch) { this.handlePickup(pickupMatch[1]); return; }

    // Data-driven verb/noun parser
    const verbMap = buildVerbMap(this.events, this.place, this.player.state.inventory);
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

    // Movement — try as direction
    const direction = trimmed.replace(/^go\s+/, '');
    if (this.exits.find((e) => e.slot === direction)) {
      this.handleMove(direction);
      return;
    }

    this._emit("I don't understand that.", 'error');
  }
}
