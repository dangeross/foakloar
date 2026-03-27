/**
 * Crafting mixin — adds crafting/recipe methods to GameEngine prototype.
 */

import { getTag, getTags, getDefaultState, checkRequires, findTransition } from './world.js';

export function mixCrafting(Engine) {
  /** Find all recipe events in the world. */
  Engine.prototype._findRecipes = function() {
    const recipes = [];
    for (const [dtag, event] of this.events) {
      if (getTag(event, 'type') === 'recipe') {
        recipes.push({ event, dtag });
      }
    }
    return recipes;
  };

  /** Find a recipe by noun/title match. */
  Engine.prototype._findRecipeByNoun = function(noun) {
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
  };

  /** Examine a recipe — show content + shuffled ingredient list. */
  Engine.prototype._examineRecipe = function(event, dtag) {
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
      this._emit('You aleady did that.', 'narrative');
    }
  };

  /** Attempt to craft a recipe. */
  Engine.prototype._attemptCraft = function(event, dtag) {
    if (this.player.isPuzzleSolved(dtag)) {
      this._emit('You already did that.', 'narrative');
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
  };

  /** Fire on-complete actions for a successfully crafted recipe. */
  Engine.prototype._fireCraftComplete = function(event, dtag) {
    this.player.markPuzzleSolved(dtag);

    // Emit recipe content as crafting prose
    if (event.content) this._emit(event.content, 'narrative');

    // Fire on-complete actions
    for (const tag of getTags(event, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'consume-item') {
        // Craft consume-item: silently remove (no "consumed" message)
        if (this.player.hasItem(value)) {
          this.player.removeItem(value);
        }
      } else {
        this._dispatchAction({
          action, target: value, extRef,
          selfDtag: dtag, selfEvent: event,
        });
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
  };
}
