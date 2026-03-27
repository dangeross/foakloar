/**
 * Puzzle mixin — adds puzzle, counter, and on-move methods to GameEngine prototype.
 */

import { getTag, getTags, findTransition } from './world.js';
import { isEventTrusted } from './trust.js';
import { derivePrivateKey } from './nip44-client.js';

export function mixPuzzle(Engine) {
  Engine.prototype.handlePuzzleAnswer = async function(answer) {
    if (!this.puzzleActive) return;

    // Allow the player to leave the puzzle
    const trimmed = answer.trim().toLowerCase();
    if (['back', 'leave', 'cancel', 'quit', 'exit'].includes(trimmed)) {
      this.puzzleActive = null;
      this._emit('You pause and step back.', 'narrative');
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

    // Auto-derive and store NIP-44 crypto key from puzzle answer + salt
    const derivedPrivKey = await derivePrivateKey(
      answer.trim(),
      salt
    );
    this.player.addCryptoKey(derivedPrivKey);

    for (const tag of getTags(puzzleEvent, 'on-complete')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      this._dispatchAction({
        action, target: value, extRef,
        selfDtag: this.puzzleActive, selfEvent: puzzleEvent,
      });
    }

    this.puzzleActive = null;
  };

  /**
   * Fire on-fail tags on a puzzle after a wrong answer.
   * Shape: ["on-fail", "", "<action>", "<target?>", "<ext-ref?>"]
   * Only valid on riddle and cipher puzzle types.
   */
  Engine.prototype._firePuzzleOnFail = function(puzzleEvent, puzzleDtag) {
    for (const tag of getTags(puzzleEvent, 'on-fail')) {
      const action = tag[2];
      const value = tag[3];
      const extRef = tag[4];

      if (action === 'deal-damage') {
        // Puzzle damage uses distinct message format ("You take X damage")
        const amount = parseInt(value, 10) || 1;
        const prevHealth = this.player.getHealth();
        if (prevHealth != null) {
          this.player.dealDamage(amount);
          this._emit(`You take ${amount} damage. (HP: ${this.player.getHealth()})`, 'error');
          this._evalPlayerHealthTriggers(prevHealth, this.player.getHealth());
        }
      } else {
        this._dispatchAction({
          action, target: value, extRef,
          selfDtag: puzzleDtag, selfEvent: puzzleEvent,
        });
      }
    }
  };

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
  Engine.prototype._applyCounterAction = function(action, eventDtag, counterName, valueOrRef, event, externalRef) {
    if (!counterName) return;

    // Resolve target: external ref overrides self
    let targetDtag = eventDtag;
    let targetEvent = event;

    // Check local counter first, then fall back to world-scoped counter
    if (!externalRef) {
      const localKey = `${eventDtag}:${counterName}`;
      if (this.player.getCounter(localKey) === undefined) {
        // No local counter — check world event for player-owned counter
        const worldEvent = this._findWorldEvent();
        if (worldEvent) {
          const worldDtag = getTag(worldEvent, 'd');
          const worldKey = `${worldDtag}:${counterName}`;
          if (this.player.getCounter(worldKey) !== undefined) {
            targetDtag = worldDtag;
            targetEvent = worldEvent;
          }
        }
      }
    }
    if (action === 'set-counter' && externalRef) {
      // set-counter: position 4 = value, position 5 = external ref
      targetDtag = externalRef;
      targetEvent = this.events.get(externalRef);
      // Security: verify external target author is trusted
      if (this.config.trustSet && targetEvent && isEventTrusted(targetEvent, this.config.trustSet, this.config.clientMode) === 'hidden') return;
    } else if ((action === 'increment' || action === 'decrement') && valueOrRef && this.events.has(valueOrRef)) {
      // increment/decrement: position 4 = external ref (if it resolves to an event)
      targetDtag = valueOrRef;
      targetEvent = this.events.get(valueOrRef);
      // Security: verify external target author is trusted
      if (this.config.trustSet && targetEvent && isEventTrusted(targetEvent, this.config.trustSet, this.config.clientMode) === 'hidden') return;
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
          // Counter threshold set-state: set directly if no transition
          const currentState = this.player.getState(targetDtag);
          const transition = findTransition(targetEvent, currentState, ctTarget);
          if (transition) {
            this.player.setState(targetDtag, transition.to);
            if (transition.text) this._emit(transition.text, 'narrative');
          } else {
            this.player.setState(targetDtag, ctTarget);
          }
        } else {
          this._dispatchAction({
            action: ctAction, target: ctTarget,
            selfDtag: targetDtag, selfEvent: targetEvent,
          });
        }
      }
    }
  };

  Engine.prototype.processOnMove = function() {
    for (const dtag of this.player.state.inventory) {
      const item = this.events.get(dtag);
      if (!item) continue;
      const currentState = this.player.getState(dtag);

      for (const tag of getTags(item, 'on-move')) {
        if (tag[1] !== currentState) continue;

        this._dispatchAction({
          action: tag[2], target: tag[3], extRef: tag[4],
          selfDtag: dtag, selfEvent: item,
        });
      }
    }
  };
}
