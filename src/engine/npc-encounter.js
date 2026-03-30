/**
 * NPC encounter mixin — adds NPC encounter/movement methods to GameEngine prototype.
 */

import { getTag, getTags, getDefaultState } from './world.js';
import { isEventTrusted } from './trust.js';
import { calculateNpcPlace, initNpcState } from './npc.js';

export function mixNpcEncounter(Engine) {
  Engine.prototype._fireNpcEncounter = function(npcEvent, npcDtag) {
    // Shape: ["on-encounter", "<filter>", "<action>", "<arg?>", "<ext-target?>"]
    // Filter: "" = any entity, "player" = player only, NPC a-tag = that NPC only
    for (const tag of getTags(npcEvent, 'on-encounter')) {
      const filter = tag[1];
      // Currently only player encounters are implemented
      if (filter && filter !== 'player') continue;

      const action = tag[2];
      const actionTarget = tag[3];
      const extTarget = tag[4];

      if (action === 'deal-damage') {
        // NPC encounter damage: fall back to NPC's own damage tag
        const dmg = parseInt(actionTarget, 10) || parseInt(getTag(npcEvent, 'damage') || '1', 10);
        this._dealDamageToPlayer(dmg, npcEvent, npcDtag);
      } else if (action === 'set-state' && !extTarget) {
        // Self — update NPC's own state
        this._dispatchAction({
          action, target: actionTarget,
          selfDtag: npcDtag, selfEvent: npcEvent,
          opts: { isNpcSelf: true },
        });
      } else {
        this._dispatchAction({
          action, target: actionTarget, extRef: extTarget,
          selfDtag: npcDtag, selfEvent: npcEvent,
        });
      }
    }
  };

  /**
   * NPC steals an item from the player.
   * target is 'any' (steal first stealable item) or an item a-tag.
   */
  Engine.prototype._npcStealsItem = function(npcDtag, target) {
    const npcEvent = this.events.get(npcDtag);
    const npcTitle = npcEvent ? getTag(npcEvent, 'title') : 'Someone';
    // Ensure NPC state is seeded (native inventory + stolen list)
    this.player.ensureNpcState(npcDtag, initNpcState(npcEvent));

    if (!target || target === 'any') {
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
  };

  /**
   * Process NPC on-enter triggers after movement.
   * Check if any roaming NPC has arrived at its stash place.
   */
  Engine.prototype._processNpcOnMove = function() {
    const moveCount = this.player.getMoveCount();

    // Build a map of place → NPCs at that place (for NPC-on-NPC encounters)
    const npcsByPlace = new Map();
    for (const { dtag, event } of this._getRoamingNpcList()) {
      const npcState = this.player.getNpcState(dtag);
      if (!npcState) continue;

      const npcPlace = calculateNpcPlace(event, moveCount, npcState.state);
      if (!npcPlace) continue;

      if (!npcsByPlace.has(npcPlace)) npcsByPlace.set(npcPlace, []);
      npcsByPlace.get(npcPlace).push({ dtag, event, state: npcState });

      // Auto-deposit: if NPC has a stash tag and is at the stash place, deposit items
      const stashRef = getTag(event, 'stash');
      if (stashRef && npcPlace === stashRef) {
        // Security: verify stash place author is trusted
        const stashEvent = this.events.get(stashRef);
        if (this.config.trustSet && stashEvent && isEventTrusted(stashEvent, this.config.trustSet, this.config.clientMode) === 'hidden') continue;
        this._npcDeposits(dtag, npcPlace);
      }

      // Fire on-enter triggers for the NPC's current place
      for (const tag of getTags(event, 'on-enter')) {
        const placeRef = tag[1];
        if (placeRef === 'player') continue;
        if (placeRef !== npcPlace) continue;

        const action = tag[2];
        const actionTarget = tag[3];
        const extTarget = tag[4];
        this._dispatchAction({
          action, target: actionTarget, extRef: extTarget,
          selfDtag: dtag, selfEvent: event,
          opts: { placeDtag: npcPlace },
        });
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

          if (action === 'set-state' && !extTarget) {
            // Self — update NPC's own state
            this._dispatchAction({
              action, target: actionTarget,
              selfDtag: npc.dtag, selfEvent: npc.event,
              opts: { isNpcSelf: true },
            });
          } else {
            this._dispatchAction({
              action, target: actionTarget, extRef: extTarget,
              selfDtag: npc.dtag, selfEvent: npc.event,
            });
          }
        }
      }
    }
  };

  /**
   * NPC deposits all carried items at its current place.
   */
  Engine.prototype._npcDeposits = function(npcDtag, placeDtag) {
    const dropped = this.player.npcDropAll(npcDtag);
    if (dropped.length === 0) return;
    // Add each item to the place's inventory
    for (const itemDtag of dropped) {
      this.player.addPlaceItem(placeDtag, itemDtag);
    }
  };
}
