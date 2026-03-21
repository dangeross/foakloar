/**
 * EventGraph — Interactive graph view of world events using React Flow.
 *
 * Places as nodes, portals as directed edges with direction labels.
 * Sidebar panel shows details when a node is selected.
 * Replaces BuildModeOverlay as the primary build mode view.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { nip19 } from 'nostr-tools';
import { validateWorld, extractDTagFromRef } from '../../builder/validateWorld.js';

const GRAPH_EVENT_TYPES = [
  { value: 'place', label: 'Place' },
  { value: 'portal', label: 'Portal' },
  { value: 'item', label: 'Item' },
  { value: 'feature', label: 'Feature' },
  { value: 'npc', label: 'NPC' },
  { value: 'clue', label: 'Clue' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'recipe', label: 'Recipe' },
  { value: 'quest', label: 'Quest' },
  { value: 'consequence', label: 'Consequence' },
  { value: 'sound', label: 'Sound' },
  { value: 'payment', label: 'Payment' },
  { value: 'dialogue', label: 'Dialogue' },
];

// ── Custom node components ──────────────────────────────────────────────

const handleStyle = { background: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))', width: 10, height: 10, border: '1px solid var(--colour-npc)', opacity: 0.6 };

/** Compact validation label shown below node content */
function IssueLabel({ issues }) {
  if (!issues || issues.length === 0) return null;
  const hasError = issues.some((i) => i.level === 'error');
  const hasWarning = issues.some((i) => i.level === 'warning');
  const colour = hasError ? 'var(--colour-error)' : hasWarning ? 'var(--colour-npc)' : 'var(--colour-muted, #888)';
  const prefix = hasError || hasWarning ? '!' : '💡';
  // Show first issue message, truncated
  const first = issues[0].message;
  const label = first.length > 30 ? first.substring(0, 28) + '...' : first;
  const suffix = issues.length > 1 ? ` +${issues.length - 1}` : '';
  return (
    <div style={{ color: colour, fontSize: '0.4rem', marginTop: 2, lineHeight: 1.2 }}>
      {prefix} {label}{suffix}
    </div>
  );
}

function PlaceNode({ data }) {
  const borderColour = data.current ? 'var(--colour-highlight)' : 'var(--colour-text)';
  const borderStyle = data.isDraft ? 'dashed' : 'solid';
  const opacity = data.untrusted ? 0.5 : 1;
  return (
    <div style={{
      padding: '10px 16px',
      border: `1px ${borderStyle} ${borderColour}`,
      background: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))',
      color: borderColour,
      fontSize: '0.75rem',
      fontFamily: 'inherit',
      width: 160,
      textAlign: 'center',
      cursor: 'pointer',
      position: 'relative',
      opacity,
    }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{data.label}</div>
      {data.details.length > 0 && (
        <div style={{ color: 'var(--colour-dim)', fontSize: '0.5rem', lineHeight: 1.3 }}>
          {data.details.join(' · ')}
        </div>
      )}
      {data.isDraft && (
        <div style={{ color: 'var(--colour-item)', fontSize: '0.4rem', marginTop: 1 }}>DRAFT</div>
      )}
      <IssueLabel issues={data.issues} />
    </div>
  );
}

function WorldNode({ data }) {
  return (
    <div style={{
      padding: '10px 18px',
      border: '1px solid var(--colour-npc)',
      background: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))',
      color: 'var(--colour-npc)',
      fontSize: '0.8rem',
      fontFamily: 'inherit',
      textAlign: 'center',
      cursor: 'pointer',
      position: 'relative',
    }}>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ fontWeight: 'bold' }}>{data.label}</div>
      <div style={{ color: 'var(--colour-dim)', fontSize: '0.5rem' }}>world</div>
      <IssueLabel issues={data.issues} />
    </div>
  );
}

function OrphanNode({ data }) {
  return (
    <div style={{
      padding: '5px 10px',
      border: '1px dashed var(--colour-error)',
      background: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))',
      color: 'var(--colour-error)',
      fontSize: '0.6rem',
      fontFamily: 'inherit',
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: '0.45rem', marginRight: 4, opacity: 0.7 }}>[{data.entityType}]</span>
      {data.label}
      <IssueLabel issues={data.issues} />
    </div>
  );
}

const nodeTypes = {
  place: PlaceNode,
  world: WorldNode,
  orphan: OrphanNode,
};

// ── Helpers ─────────────────────────────────────────────────────────────

function getTag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

function getTags(event, name) {
  return (event.tags || []).filter((t) => t[0] === name);
}

function shortPubkey(pk) {
  if (!pk) return '?';
  try { return nip19.npubEncode(pk).slice(0, 12) + '...'; } catch { return pk.slice(0, 8) + '...'; }
}

// ── Data conversion ─────────────────────────────────────────────────────

function eventsToGraph(events, currentPlace, trustSet, clientMode) {
  const nodes = [];
  const edges = [];
  const referencedRefs = new Set();

  // Run cross-event validation and build d-tag → issues map
  const eventsArray = Array.from(events.values());
  const { errors, warnings, hints } = validateWorld(eventsArray, answers);
  const issuesByDTag = new Map();
  for (const e of errors) {
    if (!issuesByDTag.has(e.dTag)) issuesByDTag.set(e.dTag, []);
    issuesByDTag.get(e.dTag).push({ level: 'error', ...e });
  }
  for (const w of warnings) {
    if (!issuesByDTag.has(w.dTag)) issuesByDTag.set(w.dTag, []);
    issuesByDTag.get(w.dTag).push({ level: 'warning', ...w });
  }
  for (const h of (hints || [])) {
    if (!issuesByDTag.has(h.dTag)) issuesByDTag.set(h.dTag, []);
    issuesByDTag.get(h.dTag).push({ level: 'hint', ...h });
  }

  // Helper: get issues for an event by its a-tag ref
  function getIssues(ref) {
    const dTag = extractDTagFromRef(ref);
    return dTag ? (issuesByDTag.get(dTag) || []) : [];
  }

  const SKIP_TYPES = new Set(['vouch', 'player-state']);
  const places = new Map();
  const portals = [];
  let worldRef = null;
  let worldEvent = null;

  for (const [ref, event] of events) {
    const type = getTag(event, 'type');
    if (!type || SKIP_TYPES.has(type)) continue;
    if (type === 'world') { worldRef = ref; worldEvent = event; }
    else if (type === 'place') places.set(ref, event);
    else if (type === 'portal') portals.push({ ref, event });
  }

  if (worldRef) referencedRefs.add(worldRef);

  // Collect all referenced events
  for (const [ref, event] of places) {
    referencedRefs.add(ref);
    for (const t of ['feature', 'item', 'npc', 'clue', 'puzzle', 'sound']) {
      for (const tag of getTags(event, t)) {
        if (tag[1]) referencedRefs.add(tag[1]);
      }
    }
  }
  for (const [, event] of events) {
    const type = getTag(event, 'type');
    if (!type) continue;
    if (type === 'portal') { referencedRefs.add(`30078:${event.pubkey}:${getTag(event, 'd')}`); continue; }
    for (const tag of event.tags || []) {
      for (let i = 1; i < tag.length; i++) {
        const v = tag[i];
        if (v && typeof v === 'string' && v.startsWith('30078:')) referencedRefs.add(v);
      }
    }
  }

  // Helper: check if event is a draft
  const isDraft = (event) => !!event._isDraft;

  // Helper: check trust level
  const isUntrusted = (event) => {
    if (!trustSet) return false;
    // Import getTrustLevel inline to avoid circular deps
    const pk = event.pubkey;
    if (pk === trustSet.genesisPubkey) return false;
    if (trustSet.collaborators?.has(pk)) return false;
    if (trustSet.vouched?.has(pk)) return false;
    return true;
  };

  // Build nodes
  if (worldRef) {
    nodes.push({
      id: worldRef,
      type: 'world',
      position: { x: 0, y: 0 },
      data: { label: getTag(worldEvent, 'title') || 'World', ref: worldRef, author: worldEvent.pubkey, issues: getIssues(worldRef) },
    });
  }

  for (const [ref, event] of places) {
    const title = getTag(event, 'title') || ref.split(':').pop();
    const details = [];
    const entityRefs = [];
    for (const t of ['feature', 'item', 'npc', 'clue', 'puzzle']) {
      const tags = getTags(event, t);
      if (tags.length > 0) details.push(`${tags.length} ${t}${tags.length > 1 ? 's' : ''}`);
      for (const tag of tags) {
        if (tag[1]) entityRefs.push({ ref: tag[1], type: t });
      }
    }
    const soundCount = getTags(event, 'sound').length;
    if (soundCount > 0) details.push(`${soundCount} sound${soundCount > 1 ? 's' : ''}`);

    nodes.push({
      id: ref,
      type: 'place',
      position: { x: 0, y: 0 },
      data: {
        label: title, ref, current: ref === currentPlace, details,
        author: event.pubkey, isDraft: isDraft(event), untrusted: isUntrusted(event),
        entityRefs, issues: getIssues(ref),
      },
    });
  }

  // Portal edges
  const edgePairs = new Set();
  for (const { ref: portalRef, event } of portals) {
    const exitTags = getTags(event, 'exit');
    if (exitTags.length < 2) continue;
    for (let i = 0; i < exitTags.length; i++) {
      const srcPlace = exitTags[i][1];
      const slot = exitTags[i][2] || '';
      if (!places.has(srcPlace)) continue;
      for (let j = 0; j < exitTags.length; j++) {
        if (j === i) continue;
        const destPlace = exitTags[j][1];
        if (!places.has(destPlace)) continue;
        const pairKey = [srcPlace, destPlace].sort().join('|');
        if (edgePairs.has(pairKey)) continue;
        edgePairs.add(pairKey);
        edges.push({
          id: `${portalRef}:${i}->${j}`,
          source: srcPlace,
          target: destPlace,
          label: slot,
          data: { portalRef, author: event.pubkey, isDraft: isDraft(event) },
          labelStyle: { fontSize: '0.55rem', fill: 'var(--colour-exits)', fontFamily: 'inherit' },
          labelBgStyle: { fill: 'var(--colour-bg)' },
          labelBgPadding: [4, 2],
          style: {
            stroke: isDraft(event) ? 'var(--colour-item)' : 'var(--colour-exits)',
            strokeWidth: 1.5,
            strokeDasharray: isDraft(event) ? '4 2' : undefined,
            cursor: 'pointer',
          },
        });
      }
    }
  }

  // Dagre layout
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120, align: 'DL', edgesep: 40 });
  for (const node of nodes) g.setNode(node.id, { width: 180, height: 60 });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) node.position = { x: pos.x - (pos.width / 2), y: pos.y - (pos.height / 2) };
  }

  // Orphans
  let maxY = 0;
  for (const node of nodes) maxY = Math.max(maxY, node.position.y);
  let orphanIdx = 0;
  for (const [ref, event] of events) {
    if (referencedRefs.has(ref)) continue;
    const type = getTag(event, 'type');
    if (!type || SKIP_TYPES.has(type)) continue;
    const title = getTag(event, 'title') || ref.split(':').pop();
    nodes.push({
      id: ref, type: 'orphan',
      position: { x: (orphanIdx % 4) * 200, y: maxY + 120 + Math.floor(orphanIdx / 4) * 45 },
      data: { label: title, entityType: type, ref, author: event.pubkey, issues: getIssues(ref) },
    });
    orphanIdx++;
  }

  return { nodes, edges, issuesByDTag };
}

// ── Sidebar ─────────────────────────────────────────────────────────────

function GraphSidebar({ selectedRef, events, onEditEvent, onNewPortal, onVouch, onClose, pubkey, trustSet, issuesByDTag }) {
  if (!selectedRef) return null;
  const event = events.get(selectedRef);
  if (!event) return null;

  const type = getTag(event, 'type') || '?';
  const title = getTag(event, 'title') || selectedRef.split(':').pop();
  const author = event.pubkey;
  const isDraft = !!event._isDraft;

  // Collect entities for places
  const entities = [];
  if (type === 'place') {
    for (const t of ['feature', 'item', 'npc', 'clue', 'puzzle', 'sound']) {
      for (const tag of getTags(event, t)) {
        const eRef = tag[1];
        const eEvent = events.get(eRef);
        if (!eEvent) continue;
        const eTitle = getTag(eEvent, 'title') || eRef.split(':').pop();
        const eType = getTag(eEvent, 'type') || t;
        entities.push({ ref: eRef, title: eTitle, type: eType, author: eEvent.pubkey, isDraft: !!eEvent._isDraft });
      }
    }
  }

  // Collect portals for places (from portal events)
  const portals = [];
  if (type === 'place') {
    for (const [, ev] of events) {
      if (getTag(ev, 'type') !== 'portal') continue;
      const exits = getTags(ev, 'exit');
      const matchesPlace = exits.some((e) => e[1] === selectedRef);
      if (!matchesPlace) continue;
      const portalRef = `30078:${ev.pubkey}:${getTag(ev, 'd')}`;
      const slots = exits.filter((e) => e[1] === selectedRef).map((e) => e[2]).join(', ');
      const dests = exits.filter((e) => e[1] !== selectedRef).map((e) => {
        const dEvent = events.get(e[1]);
        return dEvent ? getTag(dEvent, 'title') || 'unknown' : 'unknown';
      });
      portals.push({ ref: portalRef, slots, dests: dests.join(', '), author: ev.pubkey, isDraft: !!ev._isDraft });
    }
    // Also collect exit tags directly on the place event.
    // Two forms: ["exit", "north"] — slot only (portal is sole source of destination)
    //            ["exit", "30078:...", "north", "label"] — extended, hints destination
    const placeExits = getTags(event, 'exit');
    for (const exitTag of placeExits) {
      const destRef = exitTag[1];
      const slotOnly = !destRef?.startsWith('30078:');
      const effectiveSlot = slotOnly ? destRef : (exitTag[2] || '');
      // Skip if this slot is already covered by a portal
      const alreadyCovered = portals.some((p) => p.slots.split(', ').includes(effectiveSlot));
      if (alreadyCovered) continue;
      if (slotOnly) {
        portals.push({ ref: selectedRef, slots: destRef, dests: null, author, isDraft, isPlaceExit: true });
      } else {
        const dEvent = events.get(destRef);
        const destTitle = dEvent ? getTag(dEvent, 'title') || 'unknown' : 'unknown';
        portals.push({ ref: selectedRef, slots: effectiveSlot, dests: destTitle, author, isDraft, isPlaceExit: true });
      }
    }
  }

  const canVouch = (targetPk) => {
    if (!trustSet || !onVouch || !pubkey || !targetPk) return false;
    if (targetPk === pubkey) return false;
    if (targetPk === trustSet.genesisPubkey) return false;
    if (trustSet.collaborators?.has(targetPk)) return false;
    if (trustSet.vouched?.has(targetPk)) return false;
    return true;
  };

  const npubOf = (pk) => { try { return nip19.npubEncode(pk); } catch { return pk; } };

  const trustLabel = (pk) => {
    if (!trustSet || !pk) return null;
    if (pk === trustSet.genesisPubkey) return { text: 'genesis', colour: 'var(--colour-highlight)' };
    if (trustSet.collaborators?.has(pk)) return { text: 'collab', colour: 'var(--colour-highlight)' };
    if (trustSet.vouched?.has(pk)) return { text: 'vouched', colour: 'var(--colour-dim)' };
    return { text: 'untrusted', colour: 'var(--colour-error)' };
  };

  const AuthorLine = ({ pk, label }) => {
    const trust = trustLabel(pk);
    return (
      <div style={{ fontSize: '0.5rem', color: 'var(--colour-dim)' }}>
        {label && <span>{label}: </span>}
        <a
          href={`/u/${npubOf(pk)}`}
          onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/u/${npubOf(pk)}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
          style={{ color: 'var(--colour-dim)', cursor: 'pointer', textDecoration: 'underline' }}
        >{shortPubkey(pk)}</a>
        {trust && (
          <span style={{ color: trust.colour, marginLeft: 4, opacity: 0.7 }}>{trust.text}</span>
        )}
        {canVouch(pk) && (
          <button
            onClick={() => onVouch(pk)}
            style={{ color: 'var(--colour-item)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: 4 }}
          >[vouch]</button>
        )}
      </div>
    );
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const sidebarStyle = {
    position: 'fixed', top: 34, right: 0, bottom: 0,
    width: isMobile ? '100%' : 260, zIndex: 102,
    background: 'var(--colour-bg)',
    borderLeft: isMobile ? 'none' : '1px solid var(--colour-dim)',
    overflowY: 'auto',
    padding: '12px 10px',
    fontSize: '0.6rem',
    fontFamily: 'inherit',
  };

  return (
    <div style={sidebarStyle}>
      {/* Header with close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <span style={{ color: 'var(--colour-text)', fontSize: '0.7rem', fontWeight: 'bold' }}>
            {title}
          </span>
          <button
            onClick={() => onEditEvent(selectedRef)}
            style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', fontSize: '0.55rem', cursor: 'pointer', marginLeft: 6 }}
          >[edit]</button>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--colour-dim)', background: 'none', border: 'none', font: 'inherit', fontSize: '0.6rem', cursor: 'pointer', padding: '0 2px' }}
        >[X]</button>
      </div>
      <div style={{ color: 'var(--colour-dim)', fontSize: '0.5rem', marginBottom: 2 }}>
        [{type}] {isDraft && <span style={{ color: 'var(--colour-item)' }}>DRAFT</span>}
        {!isDraft && <span style={{ color: 'var(--colour-text)' }}>published</span>}
      </div>
      <AuthorLine pk={author} />

      {/* Validation issues */}
      {(() => {
        const dTag = event.tags?.find((t) => t[0] === 'd')?.[1];
        const issues = dTag && issuesByDTag ? (issuesByDTag.get(dTag) || []) : [];
        if (issues.length === 0) return null;
        return (
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            {issues.map((issue, i) => (
              <div key={i} style={{
                color: issue.level === 'error' ? 'var(--colour-error)' : issue.level === 'warning' ? 'var(--colour-npc)' : 'var(--colour-muted, #888)',
                fontSize: '0.5rem',
                lineHeight: 1.3,
                marginBottom: 1,
              }}>
                {issue.level === 'hint' ? '💡' : '!'} {issue.message}
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ marginTop: 4, marginBottom: 8 }} />

      {/* Exits */}
      {type === 'place' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: 'var(--colour-dim)', marginBottom: 2 }}>
            Exits:
            <button
              onClick={() => onNewPortal(selectedRef, '')}
              style={{ color: 'var(--colour-item)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: 6 }}
            >[+]</button>
          </div>
          {portals.map((p, i) => (
            <div key={i} style={{ marginLeft: 8, marginBottom: 3 }}>
              {p.isPlaceExit ? (
                <div>
                  <span style={{ color: 'var(--colour-error)' }}>{p.slots}</span>
                  {p.dests && <><span style={{ color: 'var(--colour-dim)' }}> → </span><span style={{ color: 'var(--colour-dim)', fontSize: '0.45rem' }}>{p.dests}</span></>}
                  <span style={{ color: 'var(--colour-dim)', fontSize: '0.45rem' }}> (no portal)</span>
                  <button
                    onClick={() => onNewPortal(selectedRef, p.slots)}
                    style={{ color: 'var(--colour-item)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: 4 }}
                  >[+ add]</button>
                </div>
              ) : (
                <div>
                  <span style={{ color: 'var(--colour-exits)' }}>{p.slots}</span>
                  <span style={{ color: 'var(--colour-dim)' }}> → </span><span style={{ color: 'var(--colour-text)' }}>{p.dests}</span>
                  {p.isDraft && <span style={{ color: 'var(--colour-item)', fontSize: '0.45rem' }}> DRAFT</span>}
                  <button
                    onClick={() => onEditEvent(p.ref)}
                    style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: 4 }}
                  >[edit]</button>
                </div>
              )}
              {!p.isPlaceExit && <AuthorLine pk={p.author} />}
            </div>
          ))}
        </div>
      )}

      {/* Entities grouped by type */}
      {entities.length > 0 && (() => {
        const grouped = {};
        for (const e of entities) {
          if (!grouped[e.type]) grouped[e.type] = [];
          grouped[e.type].push(e);
        }
        const typeOrder = ['feature', 'item', 'npc', 'clue', 'puzzle', 'sound'];
        const sortedTypes = Object.keys(grouped).sort((a, b) => {
          const ai = typeOrder.indexOf(a), bi = typeOrder.indexOf(b);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        return sortedTypes.map((t) => (
          <div key={t} style={{ marginBottom: 6 }}>
            <div style={{ color: 'var(--colour-dim)', marginBottom: 2, textTransform: 'capitalize' }}>
              {t}{grouped[t].length > 1 ? 's' : ''}:
            </div>
            {grouped[t].map((e, i) => (
              <div key={i} style={{ marginLeft: 8, marginBottom: 3 }}>
                <div>
                  <span style={{ color: 'var(--colour-text)' }}>{e.title}</span>
                  {e.isDraft && <span style={{ color: 'var(--colour-item)', fontSize: '0.45rem' }}> DRAFT</span>}
                  <button
                    onClick={() => onEditEvent(e.ref)}
                    style={{ color: 'var(--colour-highlight)', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: 4 }}
                  >[edit]</button>
                </div>
                <AuthorLine pk={e.author} />
              </div>
            ))}
          </div>
        ));
      })()}
    </div>
  );
}

// ── Persisted viewport ──────────────────────────────────────────────────

let savedViewport = null;

// ── Main component ──────────────────────────────────────────────────────

export default function EventGraph({
  events, currentPlace, onEditEvent, onNewEvent, onNewPortal, onClose,
  pubkey, trustSet, clientMode, onVouch, onOpenDrafts, draftsCount,
}) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [selectedRef, setSelectedRef] = useState(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const { nodes: initialNodes, edges: initialEdges, issuesByDTag } = useMemo(
    () => eventsToGraph(events, currentPlace, trustSet, clientMode),
    [events, currentPlace, trustSet, clientMode]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedRef(node.data?.ref || null);
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    if (edge.data?.portalRef) {
      // Select the source place to show portal in sidebar
      setSelectedRef(edge.source);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedRef(null);
  }, []);

  // Drag edge between two place nodes → create portal
  const onConnect = useCallback((connection) => {
    if (!onNewPortal || !connection.source || !connection.target) return;
    // Only allow connecting place nodes
    const srcNode = initialNodes.find((n) => n.id === connection.source);
    const tgtNode = initialNodes.find((n) => n.id === connection.target);
    if (!srcNode || !tgtNode) return;
    if (srcNode.type !== 'place' || tgtNode.type !== 'place') return;
    onNewPortal(connection.source, '', connection.target);
  }, [onNewPortal, initialNodes]);

  const onMoveEnd = useCallback((_, viewport) => {
    savedViewport = viewport;
  }, []);

  const onInit = useCallback((reactFlowInstance) => {
    if (savedViewport) {
      reactFlowInstance.setViewport(savedViewport);
      return;
    }
    const currentNode = initialNodes.find(n => n.data?.current);
    if (currentNode) {
      reactFlowInstance.fitView({ nodes: [currentNode], padding: 0.5, maxZoom: 0.8 });
    } else {
      reactFlowInstance.fitView({ padding: 0.3, maxZoom: 0.8 });
    }
  }, [initialNodes]);

  const orphanCount = nodes.filter((n) => n.type === 'orphan').length;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100,
      background: 'var(--colour-bg)',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        zIndex: 103,
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--colour-dim)',
        background: 'var(--colour-bg)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onClose}
            style={{
              color: 'var(--colour-dim)', background: 'none', border: 'none',
              font: 'inherit', fontSize: '0.6rem', padding: '2px 4px', cursor: 'pointer',
            }}
          >
            [X]
          </button>
          <span style={{ color: 'var(--colour-dim)', fontFamily: 'inherit' }} className="text-xs sm:text-sm">
            {orphanCount > 0 && <span style={{ color: 'var(--colour-error)' }}>{orphanCount} orphan{orphanCount !== 1 ? 's' : ''}</span>}
            {orphanCount > 0 && issuesByDTag.size > 0 && ' · '}
            {issuesByDTag.size > 0 && <span style={{ color: 'var(--colour-npc)' }}>{issuesByDTag.size} issue{issuesByDTag.size !== 1 ? 's' : ''}</span>}
          </span>
        </div>
        {onNewEvent && (
          <div style={{ position: 'relative', display: 'flex' }}>
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              style={{
                color: 'var(--colour-item)', background: 'none',
                border: 'none', font: 'inherit',
                padding: '2px 4px', cursor: 'pointer',
              }}
            >
              [build]
            </button>
            {showNewMenu && (
              <div
                className="font-mono text-xs"
                style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 200,
                  border: '1px solid var(--colour-dim)', backgroundColor: 'var(--colour-bg)',
                  boxShadow: '2px 2px 0 var(--colour-dim)',
                  padding: '2px 0', minWidth: 140, maxHeight: 300, overflowY: 'auto',
                }}
              >
                {GRAPH_EVENT_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { setShowNewMenu(false); onNewEvent(value); }}
                    className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                    style={{
                      color: 'var(--colour-text)', background: 'none', border: 'none',
                      font: 'inherit',
                    }}
                  >
                    + {label}
                  </button>
                ))}
                {onOpenDrafts && (
                  <>
                    <div style={{ borderTop: '1px solid var(--colour-dim)', margin: '2px 0' }} />
                    <button
                      onClick={() => { setShowNewMenu(false); onOpenDrafts(); }}
                      className="block w-full text-left px-2 py-1 cursor-pointer hover:opacity-80"
                      style={{
                        color: 'var(--colour-item)', background: 'none', border: 'none',
                        font: 'inherit',
                      }}
                    >
                      drafts{draftsCount > 0 ? ` (${draftsCount})` : ''}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graph */}
      <div style={{ width: selectedRef && !isMobile ? 'calc(100% - 260px)' : '100%', height: '100%', paddingTop: 30, transition: 'width 0.15s' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onConnect={onConnect}
          onMoveEnd={onMoveEnd}
          onInit={onInit}
          nodeTypes={nodeTypes}
          defaultViewport={savedViewport || { x: 0, y: 0, zoom: 0.5 }}
          minZoom={0.2}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'bezier' }}
        >
          <Background color="var(--colour-dim)" gap={40} size={1} style={{ opacity: 0.15 }} />
          <Controls showInteractive={false} style={{ bottom: 10, left: 10 }} />
        </ReactFlow>
      </div>

      {/* Sidebar */}
      <GraphSidebar
        selectedRef={selectedRef}
        events={events}
        onEditEvent={onEditEvent}
        onNewPortal={onNewPortal}
        onVouch={onVouch}
        onClose={() => setSelectedRef(null)}
        pubkey={pubkey}
        trustSet={trustSet}
        issuesByDTag={issuesByDTag}
      />
    </div>
  );
}
