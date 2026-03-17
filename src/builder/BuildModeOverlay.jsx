/**
 * BuildModeOverlay — Annotated room view for build mode.
 *
 * Shows structural metadata: d-tags, exit slots (connected/unconnected),
 * author pubkeys, entity refs. Clicking an unconnected exit opens the
 * portal editor.
 */

import React, { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getTag, getTags } from '../engine/world.js';
import { navigateToProfile } from '../services/router.js';
import DOSButton from './DOSButton.jsx';

/**
 * Derive room annotation data from events and current place.
 */
function useRoomAnnotation(events, currentPlace) {
  return useMemo(() => {
    if (!currentPlace || events.size === 0) return null;

    const placeEvent = events.get(currentPlace);
    if (!placeEvent) return null;

    const placeDtag = getTag(placeEvent, 'd');
    const placeAuthor = placeEvent.pubkey;
    const title = getTag(placeEvent, 'title') || placeDtag;

    // Declared exit slots on this place
    const exitTags = getTags(placeEvent, 'exit');
    const declaredSlots = exitTags.map((t) => t[1]);

    // Find all portals that reference this place
    const portals = [];
    for (const [aTag, event] of events) {
      const type = getTag(event, 'type');
      if (type !== 'portal') continue;
      const portalExits = getTags(event, 'exit');
      for (const pe of portalExits) {
        if (pe[1] === currentPlace) {
          portals.push({ aTag, event, placeRef: pe[1], slot: pe[2], label: pe[3] });
        }
      }
    }

    // Build exit annotations
    const exits = declaredSlots.map((slot) => {
      const matching = portals.filter((p) => p.slot === slot);
      if (matching.length === 0) {
        return { slot, connected: false, portals: [] };
      }
      return {
        slot,
        connected: true,
        portals: matching.map((p) => {
          // Find the other exit on this portal (the destination)
          const otherExit = getTags(p.event, 'exit').find((e) => e[1] !== currentPlace);
          const destRef = otherExit?.[1] || '?';
          const destEvent = events.get(destRef);
          const destTitle = destEvent ? getTag(destEvent, 'title') : destRef.split(':').pop();
          return {
            portalATag: p.aTag,
            portalAuthor: p.event.pubkey,
            destRef,
            destTitle,
            label: p.label,
          };
        }),
      };
    });

    // Entity refs on the place
    const entityTypes = ['item', 'feature', 'npc', 'clue'];
    const entities = [];
    for (const type of entityTypes) {
      for (const t of getTags(placeEvent, type)) {
        const ref = t[1];
        const refEvent = events.get(ref);
        const refTitle = refEvent ? getTag(refEvent, 'title') : ref.split(':').pop();
        entities.push({ type, ref, title: refTitle, author: refEvent?.pubkey });
      }
    }

    return { placeEvent, placeDtag, placeAuthor, title, exits, entities };
  }, [events, currentPlace]);
}

function PubkeyLink({ pubkey }) {
  if (!pubkey) return '?';
  const short = pubkey.slice(0, 8) + '...';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigateToProfile(nip19.npubEncode(pubkey));
      }}
      className="cursor-pointer hover:opacity-80"
      style={{ color: 'inherit', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', padding: 0, textDecoration: 'underline' }}
    >
      {short}
    </button>
  );
}

export default function BuildModeOverlay({
  events,
  currentPlace,
  pubkey,
  onNewEvent,
  onEditPortal,
  onEditEvent,
}) {
  const annotation = useRoomAnnotation(events, currentPlace);

  if (!annotation) return null;

  const { placeDtag, placeAuthor, title, exits, entities } = annotation;

  return (
    <div
      className="text-xs font-mono mb-2 p-2"
      style={{
        border: '1px solid var(--colour-dim)',
        backgroundColor: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <span style={{ color: 'var(--colour-title)' }}>BUILD</span>
          <span style={{ color: 'var(--colour-dim)' }}> | {title}</span>
          {onEditEvent && pubkey && placeAuthor === pubkey && (
            <button
              onClick={() => onEditEvent(currentPlace)}
              className="cursor-pointer hover:opacity-80 ml-1"
              style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            >
              [edit]
            </button>
          )}
        </div>
        <DOSButton onClick={() => onNewEvent?.('place')} colour="text">
          + Place
        </DOSButton>
      </div>

      {/* Place metadata */}
      <div style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>
        id: {placeDtag}
      </div>
      <div style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>
        author: <PubkeyLink pubkey={placeAuthor} />
      </div>

      {/* Exits */}
      <div className="mt-1 mb-1">
        <div style={{ color: 'var(--colour-dim)' }}>Exits:</div>
        {exits.map((exit) => (
          <div key={exit.slot} className="flex items-center gap-1 ml-2">
            <span style={{ color: exit.connected ? 'var(--colour-text)' : 'var(--colour-error)' }}>
              {exit.slot}
            </span>
            {exit.connected ? (
              <span style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>
                → {exit.portals.map((p) => p.destTitle).join(', ')}
                {' '}[{exit.portals.map((p, i) => (
                  <React.Fragment key={p.portalATag}>
                    {i > 0 && ', '}<PubkeyLink pubkey={p.portalAuthor} />
                  </React.Fragment>
                ))}]
                {onEditEvent && pubkey && exit.portals.filter((p) => p.portalAuthor === pubkey).map((p) => (
                  <button
                    key={p.portalATag}
                    onClick={() => onEditEvent(p.portalATag)}
                    className="cursor-pointer hover:opacity-80 ml-1"
                    style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', padding: 0 }}
                  >
                    [edit]
                  </button>
                ))}
              </span>
            ) : (
              <DOSButton
                onClick={() => onEditPortal?.(exit.slot)}
                colour="error"
              >
                + Portal
              </DOSButton>
            )}
          </div>
        ))}
      </div>

      {/* Entities */}
      {entities.length > 0 && (
        <div className="mt-1">
          <div style={{ color: 'var(--colour-dim)' }}>Entities:</div>
          {entities.map((ent, i) => (
            <div key={i} className="ml-2 flex items-center gap-1" style={{ color: 'var(--colour-dim)', fontSize: '0.6rem' }}>
              <span>[{ent.type}] {ent.title} — <PubkeyLink pubkey={ent.author} /></span>
              {onEditEvent && pubkey && ent.author === pubkey && (
                <button
                  onClick={() => onEditEvent(ent.ref)}
                  className="cursor-pointer hover:opacity-80"
                  style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', padding: 0 }}
                >
                  [edit]
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick create buttons */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {['portal', 'item', 'feature', 'npc', 'clue', 'puzzle', 'payment'].map((type) => (
          <DOSButton key={type} onClick={() => onNewEvent?.(type)} colour="dim">
            + {type}
          </DOSButton>
        ))}
      </div>
    </div>
  );
}
