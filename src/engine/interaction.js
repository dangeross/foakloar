/**
 * Interaction mixin — adds verb dispatch, examine, pickup, drop,
 * feature/item interaction, and noun resolution to GameEngine prototype.
 */

import {
  getTag, getTags, checkRequires, findByNoun, getDefaultState, findTransition,
} from './world.js';
import { stripArticles, findInventoryItem } from './parser.js';
import { evalCounterLow, evalSequencePuzzles } from './actions.js';
import { findRoamingNpcsAtPlace } from './npc.js';

export function mixInteraction(Engine) {
  // ── Place items ─────────────────────────────────────────────────────

  /** Seed a place's item inventory from its room event tags (first visit only). */
  Engine.prototype._seedPlaceItems = function(placeDtag, roomEvent) {
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
  };

  /** Find an item on the ground at the current place by noun (respects requires). */
  Engine.prototype._findPlaceItem = function(noun) {
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
  };

  // ── Drop item ────────────────────────────────────────────────────────

  Engine.prototype._handleDrop = function(rawNoun) {
    const noun = stripArticles(rawNoun);
    const match = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (!match) {
      this._emit("You don't have that.", 'error');
      return;
    }
    this.player.removeItem(match.dtag);
    this.player.addPlaceItem(this.currentPlace, match.dtag);
    this._emit(`Dropped: ${getTag(match.event, 'title')}`, 'item');
  };

  // ── Feature interaction ───────────────────────────────────────────────

  Engine.prototype.processFeatureInteract = function(event, dtag, verb, currentState) {
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
      // State guard at position 2 — blank = any state, otherwise must match current state
      const stateGuard = tag[2];
      if (stateGuard && currentState && stateGuard !== currentState) continue;
      const action = tag[3];
      const targetState = tag[4];
      const targetRef = tag[5];

      if (action === 'set-state' && !targetRef && currentState) {
        // Self set-state — special: must update local currentState for subsequent tags
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
      } else {
        const dispatched = this._dispatchAction({
          action,
          target: targetState,
          extRef: targetRef,
          selfDtag: dtag,
          selfEvent: event,
          opts: { extraRef: tag[6] },
        });
        if (dispatched) acted = true;
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
      evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty), (p, v) => this._emitSound(p, v), this.config.trustSet, this.config.clientMode);
      this._evalQuests();
    }
    return acted;
  };

  // ── Resolve feature from noun ─────────────────────────────────────────

  Engine.prototype.resolveFeature = function(noun) {
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
  };

  // ── Examine ───────────────────────────────────────────────────────────

  Engine.prototype.handleExamine = function(noun) {
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
      // Check items on the ground at this place
      const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
      for (const itemDtag of placeItems) {
        const item = this.events.get(itemDtag);
        if (!item) continue;
        const title = getTag(item, 'title')?.toLowerCase() || '';
        if (title.includes(noun)) { match = { event: item, dtag: itemDtag, type: 'item' }; break; }
        for (const nt of getTags(item, 'noun')) {
          for (let i = 1; i < nt.length; i++) {
            if (nt[i].toLowerCase() === noun) { match = { event: item, dtag: itemDtag, type: 'item' }; break; }
          }
          if (match) break;
        }
        if (match) break;
      }
    }

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
  };

  // ── Feature verb ──────────────────────────────────────────────────────

  Engine.prototype.handleFeatureVerb = function(verb, noun) {
    const resolved = this.resolveFeature(noun);
    if (!resolved) {
      this._emit("You don't see that here.", 'error');
      return;
    }
    const { event, dtag, currentState } = resolved;
    if (!this.processFeatureInteract(event, dtag, verb, currentState)) {
      this._emit('Nothing happens.', 'narrative');
    }
  };

  // ── Pickup ────────────────────────────────────────────────────────────

  Engine.prototype.handlePickup = function(rawNoun) {
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
    if (this._checkInventoryFull()) return;

    this.player.pickUp(match.dtag);
    this.player.removePlaceItem(this.currentPlace, match.dtag);

    const defaultState = getDefaultState(match.event);
    if (defaultState) this.player.setState(match.dtag, defaultState);

    for (const ct of getTags(match.event, 'counter')) {
      this.player.setCounter(`${match.dtag}:${ct[1]}`, parseInt(ct[2], 10));
    }

    this._emit(`Taken: ${getTag(match.event, 'title')}`, 'item');
    // Dispatch on-interact take (e.g. for pickup sounds)
    const currentState = this.player.getState(match.dtag);
    this.processFeatureInteract(match.event, match.dtag, 'take', currentState);
    this._evalQuests();
  };

  // ── Item interaction ──────────────────────────────────────────────────

  Engine.prototype.handleItemInteract = function(verb, noun) {
    const match = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (!match) { this._emit("You don't have that.", 'error'); return; }

    const { event, dtag } = match;
    const currentState = this.player.getState(dtag) || getDefaultState(event);

    let acted = false;
    for (const tag of getTags(event, 'on-interact')) {
      if (tag[1] !== verb) continue;
      // State guard at position 2 — blank = any state, otherwise must match current state
      const stateGuard = tag[2];
      if (stateGuard && currentState && stateGuard !== currentState) continue;
      const action = tag[3];
      const targetState = tag[4];
      const targetRef = tag[5];

      if (action === 'set-state' && targetRef) {
        // External set-state — use dispatcher, then check for sequence puzzles
        const dispatched = this._dispatchAction({
          action, target: targetState, extRef: targetRef,
          selfDtag: dtag, selfEvent: event,
        });
        if (dispatched) {
          acted = true;
          // Feature external set-state may trigger sequence puzzles
          const extEvent = this.events.get(targetRef);
          if (extEvent && getTag(extEvent, 'type') === 'feature') {
            evalSequencePuzzles(this.place, this.events, this.player, (t, ty) => this._emit(t, ty), (p, v) => this._emitSound(p, v), this.config.trustSet, this.config.clientMode);
          }
        }
      } else if (action === 'set-state' && !targetRef) {
        // Self set-state — use dispatcher, then eval counter thresholds
        const dispatched = this._dispatchAction({
          action, target: targetState,
          selfDtag: dtag, selfEvent: event,
        });
        if (dispatched) {
          acted = true;
          const newState = this.player.getState(dtag);
          if (newState && newState !== currentState) {
            evalCounterLow(event, dtag, newState, this.player, (t, ty) => this._emit(t, ty));
          }
        }
      } else if (action === 'consume-item') {
        // consume-item on inventory items defaults target to self
        const consumeDtag = targetState || dtag;
        if (this.player.hasItem(consumeDtag)) {
          this.player.removeItem(consumeDtag);
          const consumeEvent = this.events.get(consumeDtag);
          const consumeTitle = consumeEvent ? getTag(consumeEvent, 'title') : consumeDtag;
          this._emit(`${consumeTitle} is consumed.`, 'item');
        }
        acted = true;
      } else {
        const dispatched = this._dispatchAction({
          action, target: targetState, extRef: targetRef,
          selfDtag: dtag, selfEvent: event,
          opts: { extraRef: tag[6] },
        });
        if (dispatched) acted = true;
      }
    }

    if (!acted) this._emit('Nothing happens.', 'narrative');
  };

  // ── Resolve noun ──────────────────────────────────────────────────────

  /** Find an NPC by noun — checks static NPCs on the place and roaming NPCs. */
  Engine.prototype._findNpcByNoun = function(noun) {
    if (!this.currentPlace) return null;
    const room = this.events.get(this.currentPlace);
    if (!room) return null;
    // Static NPCs
    for (const ref of getTags(room, 'npc')) {
      const npc = this.events.get(ref[1]);
      if (!npc) continue;
      const title = getTag(npc, 'title')?.toLowerCase() || '';
      if (title.includes(noun)) return { event: npc, dtag: ref[1], type: 'npc' };
      for (const nt of getTags(npc, 'noun')) {
        for (let i = 1; i < nt.length; i++) {
          if (nt[i].toLowerCase() === noun) return { event: npc, dtag: ref[1], type: 'npc' };
        }
      }
    }
    // Roaming NPCs
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
    return null;
  };

  Engine.prototype.resolveNoun = function(rawNoun) {
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
    // Check recipes before inventory (recipe nouns like "pickaxe" would otherwise
    // match inventory items like "Iron Pickaxe Head" via title.includes())
    const recipeMatch = this._findRecipeByNoun(noun);
    if (recipeMatch) return recipeMatch;

    const invMatch = findInventoryItem(this.events, this.player.state.inventory, noun);
    if (invMatch) return { ...invMatch, type: 'item' };

    return null;
  };

  // ── Unified interaction dispatch ──────────────────────────────────────

  Engine.prototype.handleInteraction = function(verb_, targetNoun, instrumentNoun, verbAlias) {
    let verb = verb_;
    if (!this.place) return;

    const target = targetNoun ? this.resolveNoun(targetNoun) : null;
    if (!target) {
      this._emit("You don't see that here.", 'error');
      return;
    }

    const { event, dtag, type } = target;

    // Re-resolve verb using the target entity's own verb tags.
    // The global verb map may have mapped an alias to the wrong canonical
    // when multiple entities share the same alias (e.g. "fix" on fence AND recipe).
    // Check if the original alias matches this entity's verb tags — if so, use
    // this entity's canonical instead of the global one.
    const inputAlias = (verbAlias || verb).toLowerCase();
    for (const vt of getTags(event, 'verb')) {
      if (vt.slice(1).some((a) => a.toLowerCase() === inputAlias)) {
        verb = vt[1]; // use this entity's canonical
        break;
      }
    }

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
        // Feature didn't handle the verb — check if a recipe uses this verb
        const recipeByVerb = this._findRecipeByVerb(verb);
        if (recipeByVerb) {
          this._attemptCraft(recipeByVerb.event, recipeByVerb.dtag);
        } else if (verb !== 'examine') {
          this._emit('Nothing happens.', 'narrative');
        }
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
  };
}
