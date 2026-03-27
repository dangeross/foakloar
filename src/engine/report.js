/**
 * Report mixin — adds the report command to GameEngine prototype.
 */

import { getTag, getTags } from './world.js';

export function mixReport(Engine) {
  Engine.prototype._handleReport = function(nounInput) {
    // Only available in open collaboration worlds
    const collaboration = this.config.trustSet?.collaboration;
    if (collaboration !== 'open') {
      this._emit("Reporting is only available in open worlds.", 'error');
      return;
    }

    const room = this.events.get(this.currentPlace);
    if (!room) return;

    let targetRef, title, author;

    if (!nounInput) {
      // Report the current place
      targetRef = this.currentPlace;
      title = getTag(room, 'title') || this.currentPlace;
      author = room.pubkey;
    } else {
      // Resolve noun to an entity in the current room
      const noun = nounInput.replace(/^(the|a|an)\s+/i, '').toLowerCase();
      let found = null;

      // Check items on the ground
      const placeItems = this.player.getPlaceItems(this.currentPlace) || [];
      for (const itemDtag of placeItems) {
        const item = this.events.get(itemDtag);
        if (!item) continue;
        const nouns = getTags(item, 'noun').flatMap((t) => t.slice(1)).map((n) => n.toLowerCase());
        if (nouns.includes(noun) || (getTag(item, 'title') || '').toLowerCase() === noun) {
          found = { ref: itemDtag, event: item };
          break;
        }
      }

      // Check inventory items
      if (!found) {
        for (const itemDtag of this.player.getInventory()) {
          const item = this.events.get(itemDtag);
          if (!item) continue;
          const nouns = getTags(item, 'noun').flatMap((t) => t.slice(1)).map((n) => n.toLowerCase());
          if (nouns.includes(noun) || (getTag(item, 'title') || '').toLowerCase() === noun) {
            found = { ref: itemDtag, event: item };
            break;
          }
        }
      }

      // Check features
      if (!found) {
        for (const tag of getTags(room, 'feature')) {
          const feature = this.events.get(tag[1]);
          if (!feature) continue;
          const nouns = getTags(feature, 'noun').flatMap((t) => t.slice(1)).map((n) => n.toLowerCase());
          if (nouns.includes(noun) || (getTag(feature, 'title') || '').toLowerCase() === noun) {
            found = { ref: tag[1], event: feature };
            break;
          }
        }
      }

      // Check NPCs
      if (!found) {
        for (const tag of getTags(room, 'npc')) {
          const npc = this.events.get(tag[1]);
          if (!npc) continue;
          const nouns = getTags(npc, 'noun').flatMap((t) => t.slice(1)).map((n) => n.toLowerCase());
          if (nouns.includes(noun) || (getTag(npc, 'title') || '').toLowerCase() === noun) {
            found = { ref: tag[1], event: npc };
            break;
          }
        }
      }

      if (!found) {
        this._emit(`You don't see "${nounInput}" here.`, 'error');
        return;
      }

      targetRef = found.ref;
      title = getTag(found.event, 'title') || targetRef;
      author = found.event.pubkey;
    }

    // Don't report your own content
    if (author === this.config.AUTHOR_PUBKEY) {
      this._emit("You can't report your own content.", 'error');
      return;
    }

    const shortAuthor = author.slice(0, 12) + '...';

    this._emit(`Report "${title}" by ${shortAuthor}?`, 'narrative');
    this._emit('Reason (or "cancel" to abort):', 'narrative');
    this.pendingReport = { targetRef, title, author };
  };
}
