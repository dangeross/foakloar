/**
 * EventGraph — Interactive graph view of world events using React Flow.
 *
 * Places as nodes, portals as directed edges with direction labels.
 * Clean view: entities hidden (count shown on place node).
 * Orphans: only truly unreferenced events shown.
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
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

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

const handleStyle = { background: 'transparent', width: 1, height: 1, border: 'none', opacity: 0 };

function PlaceNode({ data }) {
  const borderColour = data.current ? 'var(--colour-highlight)' : 'var(--colour-text)';
  return (
    <div style={{
      padding: '10px 16px',
      border: `1px solid ${borderColour}`,
      background: 'color-mix(in srgb, var(--colour-bg) 90%, var(--colour-dim))',
      color: borderColour,
      fontSize: '0.75rem',
      fontFamily: 'inherit',
      width: 160,
      textAlign: 'center',
      cursor: 'pointer',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{data.label}</div>
      {data.details.length > 0 && (
        <div style={{ color: 'var(--colour-dim)', fontSize: '0.5rem', lineHeight: 1.3 }}>
          {data.details.join(' · ')}
        </div>
      )}
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
      <div style={{ color: '#666', fontSize: '0.5rem' }}>world</div>
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
    </div>
  );
}

const nodeTypes = {
  place: PlaceNode,
  world: WorldNode,
  orphan: OrphanNode,
};

// ── Data conversion ─────────────────────────────────────────────────────

function getTag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

function getTags(event, name) {
  return (event.tags || []).filter((t) => t[0] === name);
}

function eventsToGraph(events, currentPlace) {
  const nodes = [];
  const edges = [];
  const referencedRefs = new Set(); // all refs that are referenced by something

  // First pass: categorise events
  const places = new Map();
  const portals = [];
  let worldRef = null;
  let worldEvent = null;

  const SKIP_TYPES = new Set(['vouch', 'player-state']);
  for (const [ref, event] of events) {
    const type = getTag(event, 'type');
    if (!type || SKIP_TYPES.has(type)) continue;
    if (type === 'world') { worldRef = ref; worldEvent = event; }
    else if (type === 'place') places.set(ref, event);
    else if (type === 'portal') portals.push({ ref, event });
  }

  // Mark world as referenced
  if (worldRef) referencedRefs.add(worldRef);

  // Collect all refs referenced from places (entities, sounds, etc.)
  for (const [ref, event] of places) {
    referencedRefs.add(ref);
    const refTags = ['feature', 'item', 'npc', 'clue', 'puzzle', 'sound'];
    for (const t of refTags) {
      for (const tag of getTags(event, t)) {
        if (tag[1]) referencedRefs.add(tag[1]);
      }
    }
  }

  // Collect refs from entities (sounds on items, contains refs, etc.)
  for (const [ref, event] of events) {
    const type = getTag(event, 'type');
    if (!type) continue;
    // Mark portals as referenced
    if (type === 'portal') { referencedRefs.add(ref); continue; }
    // Mark events referenced by on-* triggers, requires, sound, etc.
    for (const tag of event.tags || []) {
      const val = tag[1];
      if (val && typeof val === 'string' && val.startsWith('30078:')) {
        referencedRefs.add(val);
      }
      // Also check positions 3, 4 for action targets
      for (let i = 2; i < tag.length; i++) {
        const v = tag[i];
        if (v && typeof v === 'string' && v.startsWith('30078:')) {
          referencedRefs.add(v);
        }
      }
    }
  }

  // Build nodes (no positions yet — Dagre will compute them)
  // World node
  if (worldRef) {
    nodes.push({
      id: worldRef,
      type: 'world',
      position: { x: 0, y: 0 },
      data: { label: getTag(worldEvent, 'title') || 'World', ref: worldRef },
    });
  }

  // Place nodes with entity summary
  for (const [ref, event] of places) {
    const title = getTag(event, 'title') || ref.split(':').pop();
    const details = [];
    const counts = { item: 0, feature: 0, npc: 0, clue: 0, puzzle: 0 };
    for (const t of Object.keys(counts)) {
      counts[t] = getTags(event, t).length;
      if (counts[t] > 0) details.push(`${counts[t]} ${t}${counts[t] > 1 ? 's' : ''}`);
    }
    const soundCount = getTags(event, 'sound').length;
    if (soundCount > 0) details.push(`${soundCount} sound${soundCount > 1 ? 's' : ''}`);

    nodes.push({
      id: ref,
      type: 'place',
      position: { x: 0, y: 0 },
      data: { label: title, ref, current: ref === currentPlace, details },
    });
  }

  // Portal edges — bright, thick, with direction labels
  // Deduplicate: only one edge per pair of places (pick the first direction found)
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
          data: { portalRef },
          labelStyle: { fontSize: '0.55rem', fill: 'var(--colour-exits)', fontFamily: 'inherit' },
          labelBgStyle: { fill: 'var(--colour-bg)' },
          labelBgPadding: [4, 2],
          style: { stroke: 'var(--colour-exits)', strokeWidth: 1.5, cursor: 'pointer' },
        });
      }
    }
  }

  // Dagre hierarchical layout — minimises edge crossings
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120, align: 'DL', edgesep: 40 });
  const NODE_W = 180;
  const NODE_H = 60;
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  Dagre.layout(g);

  // Apply computed positions
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.position = { x: pos.x - (pos.width / 2), y: pos.y - (pos.height / 2) };
    }
  }

  // Orphan nodes — placed below the layout
  let maxY = 0;
  for (const node of nodes) maxY = Math.max(maxY, node.position.y);
  let orphanIdx = 0;
  const orphanCols = 4;
  for (const [ref, event] of events) {
    if (referencedRefs.has(ref)) continue;
    const type = getTag(event, 'type');
    if (!type || SKIP_TYPES.has(type)) continue;
    const title = getTag(event, 'title') || ref.split(':').pop();
    nodes.push({
      id: ref,
      type: 'orphan',
      position: {
        x: (orphanIdx % orphanCols) * 200,
        y: maxY + 120 + Math.floor(orphanIdx / orphanCols) * 45,
      },
      data: { label: title, entityType: type, ref },
    });
    orphanIdx++;
  }

  return { nodes, edges };
}

// ── Persisted viewport ──────────────────────────────────────────────────

let savedViewport = null; // { x, y, zoom } — survives unmount

// ── Main component ──────────────────────────────────────────────────────

export default function EventGraph({ events, currentPlace, onEditEvent, onNewEvent, onClose }) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => eventsToGraph(events, currentPlace),
    [events, currentPlace]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Refresh graph when events change (new event added/published)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    if (onEditEvent && node.data?.ref) {
      onEditEvent(node.data.ref);
    }
  }, [onEditEvent]);

  const onEdgeClick = useCallback((_, edge) => {
    if (onEditEvent && edge.data?.portalRef) {
      onEditEvent(edge.data.portalRef);
    }
  }, [onEditEvent]);

  const onMoveEnd = useCallback((_, viewport) => {
    savedViewport = viewport;
  }, []);

  // On first load, fit to current place node then offset upward
  const onInit = useCallback((reactFlowInstance) => {
    if (savedViewport) {
      reactFlowInstance.setViewport(savedViewport);
      return;
    }
    const currentNode = initialNodes.find(n => n.data?.current);
    if (currentNode) {
      // Fit to current node, then shift so it's in upper third
      reactFlowInstance.fitView({ nodes: [currentNode], padding: 0.5, maxZoom: 0.8 });
      setTimeout(() => {
        const vp = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...vp, y: vp.y - 80 });
      }, 100);
    } else {
      reactFlowInstance.fitView({ padding: 0.3, maxZoom: 0.8 });
    }
  }, [initialNodes]);

  // Count orphans
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
        zIndex: 101,
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--colour-dim)',
        background: 'var(--colour-bg)',
      }}>
        <span style={{ color: 'var(--colour-dim)', fontSize: '0.7rem', fontFamily: 'inherit' }}>
          EVENT GRAPH — {nodes.filter((n) => n.type === 'place').length} places, {edges.length} connections
          {orphanCount > 0 && <span style={{ color: 'var(--colour-error)' }}> · {orphanCount} orphan{orphanCount !== 1 ? 's' : ''}</span>}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
          {/* + new dropdown */}
          {onNewEvent && (
            <div style={{ position: 'relative', display: 'flex' }}>
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                style={{
                  color: 'var(--colour-text)',
                  background: 'none',
                  border: '1px solid var(--colour-dim)',
                  font: 'inherit',
                  fontSize: '0.6rem',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                + new
              </button>
              {showNewMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 110,
                  border: '1px solid var(--colour-dim)', backgroundColor: 'var(--colour-bg)',
                  padding: '2px 0', minWidth: 120, maxHeight: 260, overflowY: 'auto',
                  fontSize: '0.6rem',
                }}>
                  {GRAPH_EVENT_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setShowNewMenu(false); onNewEvent(value); }}
                      className="block w-full text-left"
                      style={{
                        color: 'var(--colour-text)', background: 'none', border: 'none',
                        font: 'inherit', fontSize: 'inherit', padding: '2px 8px', cursor: 'pointer',
                      }}
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              color: 'var(--colour-dim)',
              background: 'none',
              border: 'none',
              font: 'inherit',
              fontSize: '0.6rem',
              padding: '2px 4px',
              cursor: 'pointer',
            }}
          >
            [X]
          </button>
        </div>
      </div>

      {/* Graph */}
      <div style={{ width: '100%', height: '100%', paddingTop: 30 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
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
          <Controls
            showInteractive={false}
            style={{ bottom: 10, left: 10 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
