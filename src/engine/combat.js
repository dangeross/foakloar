/**
 * Combat mixin — adds combat methods to GameEngine prototype.
 */

import { getTag, getTags, getDefaultState } from './world.js';
import { initNpcState } from './npc.js';

export function mixCombat(Engine) {
  /**
   * Deal damage to player. Rolls NPC hit-chance. Fires on-player-health-zero.
   * @param {number} amount — damage to deal
   * @param {Object} [sourceNpc] — NPC event (for hit-chance and on-player-health-zero)
   * @param {string} [sourceNpcDtag] — NPC dtag
   */
  Engine.prototype._dealDamageToPlayer = function(amount, sourceNpc, sourceNpcDtag) {
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
  };

  /**
   * Deal damage to an NPC. Rolls weapon hit-chance. Fires on-health-zero.
   * @param {string} npcDtag — target NPC (or "" to use combatTarget)
   * @param {Object} weaponEvent — the weapon item event (for damage + hit-chance)
   */
  Engine.prototype._dealDamageToNpc = function(npcDtag, weaponEvent) {
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
  };

  /**
   * Fire a single health trigger action.
   */
  Engine.prototype._fireHealthAction = function(action, target, extRef, sourceEvent, npcDtag) {
    if (action === 'set-state' && npcDtag) {
      // NPC health trigger: set NPC self state, then optionally external
      this._dispatchAction({
        action, target, selfDtag: npcDtag, selfEvent: sourceEvent,
        opts: { isNpcSelf: true },
      });
      if (extRef) {
        this._dispatchAction({
          action, target, extRef, selfDtag: npcDtag, selfEvent: sourceEvent,
        });
      }
    } else {
      this._dispatchAction({
        action, target, extRef,
        selfDtag: npcDtag || null, selfEvent: sourceEvent,
      });
    }
  };

  /**
   * Handle `attack <npc> [with <weapon>]` combat flow.
   */
  Engine.prototype._handleAttack = function(npcEvent, npcDtag, weaponEvent, weaponDtag) {
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
      const stateGuard = tag[2];
      if (stateGuard && currentState && stateGuard !== currentState) continue;
      const action = tag[3];
      const targetState = tag[4];

      this._dispatchAction({
        action, target: targetState || npcDtag,
        selfDtag: weaponDtag, selfEvent: weaponEvent,
        opts: { weaponEvent },
      });
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
          // NPC counterattack: fall back to NPC's own damage tag
          const dmg = parseInt(actionTarget, 10) || parseInt(getTag(npcEvent, 'damage') || '1', 10);
          this._dealDamageToPlayer(dmg, npcEvent, npcDtag);
        } else if (action === 'set-state' && !extTarget) {
          // Self — set NPC state
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
    }

    this.combatTarget = null;
  };
}
