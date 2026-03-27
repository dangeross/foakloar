/**
 * Container mixin — adds container interaction methods to GameEngine prototype.
 */

import { getTag, getTags, getDefaultState, findByNoun } from './world.js';
import { isEventTrusted } from './trust.js';
import { stripArticles, findInventoryItem } from './parser.js';

export function mixContainer(Engine) {
  /**
   * Find a container by noun — checks inventory, ground items, and features.
   * Returns { event, dtag } or null.
   */
  Engine.prototype._findContainer = function(cNoun) {
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
  };

  /**
   * Take item(s) from a container.
   * Supports: "take X from Y" and "take all from Y"
   */
  Engine.prototype._takeFromContainer = function(itemNoun, containerNoun) {
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
  };

  /** Extract a single item from a container into player inventory. */
  Engine.prototype._extractItem = function(ref, itemEvent) {
    this.player.pickUp(ref);
    const defaultState = getDefaultState(itemEvent);
    if (defaultState) this.player.setState(ref, defaultState);
    for (const ct of getTags(itemEvent, 'counter')) {
      this.player.setCounter(`${ref}:${ct[1]}`, parseInt(ct[2], 10));
    }
    this._emit(`Taken: ${getTag(itemEvent, 'title')}`, 'item');
    this._evalQuests();
  };

  // ── Examine inventory item ────────────────────────────────────────────

  Engine.prototype.examineInventoryItem = function(invMatch) {
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
  };

  /** List contents of a container (item or feature). Shows accessible items
   *  and deduplicated fail-messages for gated items. Hides gated items with blank fail-message. */
  Engine.prototype._listContainerContents = function(event, dtag) {
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
      // Security: skip contained items whose author is untrusted
      if (this.config.trustSet && isEventTrusted(refEvent, this.config.trustSet, this.config.clientMode) === 'hidden') continue;
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
  };
}
