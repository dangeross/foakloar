/**
 * ReferenceGraph — Reference connectivity view for world events.
 *
 * Shows all events as nodes and their cross-references as edges.
 * Selecting a node highlights its direct connections and dims everything else.
 * Multiple edges between the same node pair render as parallel offset lines.
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useInternalNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Skip types — internal/meta events with no gameplay references ────────────
const SKIP_TYPES = new Set(['vouch', 'revoke', 'player-state', 'report']);

// ── Edge type constants ──────────────────────────────────────────────────────
const EDGE_TYPES = ['placement', 'requires', 'action', 'portal', 'dialogue'];

const EDGE_COLOURS = {
  placement: '#4a9eff',  // blue   — entity placed in container
  requires:  '#ff6b6b',  // red    — dependency / gate
  action:    '#ffd700',  // gold   — on-* trigger target
  portal:    '#00e676',  // green  — navigation connection
  dialogue:  '#bf5af2',  // purple — NPC dialogue chain
};

const EDGE_DASH = {
  placement: '3 3',
  dialogue:  '2 4',
};

// ── Node colour by event type ────────────────────────────────────────────────
const TYPE_COLOURS = {
  world:       'var(--colour-npc)',
  place:       'var(--colour-title)',
  npc:         'var(--colour-npc)',
  dialogue:    'var(--colour-dim)',
  item:        'var(--colour-item)',
  feature:     'var(--colour-highlight)',
  clue:        'var(--colour-clue)',
  puzzle:      'var(--colour-puzzle)',
  recipe:      'var(--colour-exits)',
  quest:       'var(--colour-highlight)',
  consequence: 'var(--colour-error)',
  sound:       'var(--colour-dim)',
  payment:     'var(--colour-item)',
  portal:      'var(--colour-exits)',
};

// ── Floating edge helpers ────────────────────────────────────────────────────

/**
 * Compute where the line from `center` toward `other` intersects the node
 * rectangle (width × height, centred on `center`).
 */
function rectIntersection(center, other, w, h) {
  const dx = other.x - center.x;
  const dy = other.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const hw = w / 2, hh = h / 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(scaleX, scaleY);
  return { x: center.x + dx * s, y: center.y + dy * s };
}

// ── Custom node — module-level to prevent XYFlow re-registration ─────────────
function RefNode({ data }) {
  const colour = TYPE_COLOURS[data.eventType] ?? 'var(--colour-text)';
  return (
    <div style={{
      width: NODE_W, height: NODE_H,
      border: `1px ${data.isDraft ? 'dashed' : 'solid'} ${colour}`,
      background: 'color-mix(in srgb, var(--colour-bg) 92%, var(--colour-dim))',
      color: colour,
      fontSize: '0.5rem',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 4px',
      cursor: 'pointer',
      opacity: data.dimmed ? 0.15 : 1,
      transition: 'opacity 0.1s',
      textAlign: 'center',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Invisible handles at all four sides — floating edge logic overrides the
          actual attachment point, but XYFlow still needs handles to exist. */}
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, width: 0, height: 0 }} />
      <div style={{ fontSize: '0.38rem', opacity: 0.6, lineHeight: 1 }}>
        [{data.eventType}]
      </div>
      <div style={{
        fontWeight: 'bold', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 4px',
      }}>
        {data.label}
      </div>
    </div>
  );
}

// ── Custom edge — floating attachment + parallel offset ───────────────────────
function ParallelEdge({ source, target, data, style, markerEnd }) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sw = sourceNode.measured?.width  ?? NODE_W;
  const sh = sourceNode.measured?.height ?? NODE_H;
  const tw = targetNode.measured?.width  ?? NODE_W;
  const th = targetNode.measured?.height ?? NODE_H;

  const srcCenter = {
    x: sourceNode.internals.positionAbsolute.x + sw / 2,
    y: sourceNode.internals.positionAbsolute.y + sh / 2,
  };
  const tgtCenter = {
    x: targetNode.internals.positionAbsolute.x + tw / 2,
    y: targetNode.internals.positionAbsolute.y + th / 2,
  };

  // Attach to node border rather than a fixed handle point
  const src = rectIntersection(srcCenter, tgtCenter, sw, sh);
  const tgt = rectIntersection(tgtCenter, srcCenter, tw, th);

  // Parallel offset — perpendicular to the edge direction
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY =  dx / len;
  const offset = data?.parallelOffset ?? 0;

  return (
    <path
      d={`M ${src.x + perpX * offset},${src.y + perpY * offset} L ${tgt.x + perpX * offset},${tgt.y + perpY * offset}`}
      style={style}
      markerEnd={markerEnd}
      fill="none"
    />
  );
}

// Module-level constants — XYFlow compares by reference; recreating per render
// causes full node/edge teardown.
const refNodeTypes  = { ref: RefNode };
const parallelEdgeTypes = { parallel: ParallelEdge };

// ── Data functions ───────────────────────────────────────────────────────────

/**
 * Build raw nodes and edges from the events Map.
 */
function eventsToReferenceGraph(events) {
  if (!events || events.size === 0) return { rawNodes: [], rawEdges: [] };

  const rawNodes = [];
  const rawEdges = [];
  const edgeIdSet = new Set();

  // Build event type index for validation
  const eventTypeMap = new Map(); // ref → eventType
  for (const [ref, event] of events) {
    const eventType = event.tags?.find(t => t[0] === 'type')?.[1] ?? '';
    if (SKIP_TYPES.has(eventType)) continue;
    eventTypeMap.set(ref, eventType);
  }

  // Build nodes
  for (const [ref, event] of events) {
    const eventType = event.tags?.find(t => t[0] === 'type')?.[1] ?? '';
    if (SKIP_TYPES.has(eventType)) continue;
    const label = event.tags?.find(t => t[0] === 'title')?.[1]
      || event.tags?.find(t => t[0] === 'd')?.[1]?.split(':').pop()
      || ref.split(':').pop()
      || '?';
    rawNodes.push({
      id: ref,
      type: 'ref',
      position: { x: 0, y: 0 },
      data: { ref, eventType, label, isDraft: !!event._isDraft, author: event.pubkey },
    });
  }

  // Edge helper — validates + deduplicates
  function pushEdge({ source, target, edgeType, tagName, tagIdx, label }) {
    if (source === target) return;
    if (!eventTypeMap.has(source) || !eventTypeMap.has(target)) return;
    const id = `${source}::${target}::${edgeType}::${tagName}::${tagIdx}`;
    if (edgeIdSet.has(id)) return;
    edgeIdSet.add(id);
    rawEdges.push({ id, source, target, edgeType, label: label ?? undefined, data: { edgeType } });
  }

  // Scan all events for references
  for (const [ref, event] of events) {
    const eventType = event.tags?.find(t => t[0] === 'type')?.[1] ?? '';
    if (SKIP_TYPES.has(eventType)) continue;

    const tags = event.tags || [];

    tags.forEach((tag, tagIdx) => {
      const name = tag[0];

      // Entity placement (place → entity)
      if (['item', 'feature', 'npc', 'clue', 'sound'].includes(name)) {
        const target = tag[1];
        if (typeof target === 'string' && target.startsWith('30078:')) {
          pushEdge({ source: ref, target, edgeType: 'placement', tagName: name, tagIdx });
        }
        return;
      }

      // Requires gates
      if (name === 'requires' || name === 'requires-not') {
        const target = tag[1];
        if (typeof target === 'string' && target.startsWith('30078:')) {
          pushEdge({ source: ref, target, edgeType: 'requires', tagName: name, tagIdx });
        }
        return;
      }

      // Portal connections — emit both directed edges
      if (name === 'exit' && eventType === 'portal') {
        // Collect all exit tags to find pairs; handled as a group below
        return;
      }

      // Dialogue links
      if (name === 'dialogue') {
        const nodeRef = tag[1];
        if (typeof nodeRef === 'string' && nodeRef.startsWith('30078:')) {
          pushEdge({ source: ref, target: nodeRef, edgeType: 'dialogue', tagName: name, tagIdx });
        }
        // Dialogue requires gate at [2]
        const reqRef = tag[2];
        if (typeof reqRef === 'string' && reqRef.startsWith('30078:')) {
          pushEdge({ source: ref, target: reqRef, edgeType: 'requires', tagName: `${name}-req`, tagIdx });
        }
        return;
      }

      // Dialogue option → next node
      if (name === 'option') {
        const nextRef = tag[2];
        if (typeof nextRef === 'string' && nextRef.startsWith('30078:')) {
          pushEdge({ source: ref, target: nextRef, edgeType: 'dialogue', tagName: name, tagIdx });
        }
        return;
      }

      // Action targets — scan ALL values in on-* tags for event refs
      if (name.startsWith('on-')) {
        for (let i = 1; i < tag.length; i++) {
          const val = tag[i];
          if (typeof val === 'string' && val.startsWith('30078:')) {
            pushEdge({ source: ref, target: val, edgeType: 'action', tagName: name, tagIdx: `${tagIdx}-${i}` });
          }
        }
        return;
      }
    });

    // Portal connections — scan exit tag pairs
    if (eventType === 'portal') {
      const exits = tags.filter(t => t[0] === 'exit');
      if (exits.length >= 2) {
        for (let i = 0; i < exits.length; i++) {
          for (let j = 0; j < exits.length; j++) {
            if (i === j) continue;
            const src = exits[i][1];
            const tgt = exits[j][1];
            if (typeof src === 'string' && src.startsWith('30078:') &&
                typeof tgt === 'string' && tgt.startsWith('30078:')) {
              pushEdge({ source: src, target: tgt, edgeType: 'portal', tagName: 'exit', tagIdx: `${i}->${j}` });
            }
          }
        }
      }
    }
  }

  return { rawNodes, rawEdges };
}

// Node dimensions used by layout and RefNode
const NODE_W = 140;
const NODE_H = 40;

/**
 * Compute force-directed layout positions. Mutates node positions.
 * Runs the simulation synchronously for a fixed number of ticks.
 * All edge types participate — connected nodes cluster naturally.
 */
function computeLayout(nodes, edges) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Build deduplicated simulation links (skip unknown endpoints)
  const simLinks = [];
  const seen = new Set();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    const key = [edge.source, edge.target].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    simLinks.push({ source: edge.source, target: edge.target, edgeType: edge.edgeType });
  }

  // Seed positions in a circle to give the simulation a clean start
  const R = Math.max(200, nodes.length * 12);
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    n.x = R * Math.cos(angle);
    n.y = R * Math.sin(angle);
  });

  // Per-type link weights: distance controls how far apart connected nodes sit;
  // strength controls how firmly the link enforces that distance.
  const LINK_DISTANCE = { portal: 100, placement: 140, dialogue: 90, requires: 220, action: 260 };
  const LINK_STRENGTH = { portal: 0.9, placement: 0.7, dialogue: 0.8, requires: 0.25, action: 0.15 };

  // Soft Y targets by event type — bias toward a top-to-bottom reading order
  // without overriding the organic clustering. Strength 0.08 is gentle enough
  // that connected nodes still pull each other; just adds orientation.
  forceSimulation(nodes)
    .force('link', forceLink(simLinks)
      .id(d => d.id)
      .distance(d => LINK_DISTANCE[d.edgeType] ?? 180)
      .strength(d => LINK_STRENGTH[d.edgeType] ?? 0.5))
    .force('charge', forceManyBody().strength(-800))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(NODE_W * 0.8))
    .force('x', forceX(0).strength(0.04))
    .force('y', forceY(0).strength(0.04))
    .stop()
    .tick(600);

  // d3 sets x/y as node centres; XYFlow wants top-left
  for (const node of nodes) {
    node.position = { x: node.x - NODE_W / 2, y: node.y - NODE_H / 2 };
  }
}

/**
 * Assign perpendicular parallel offsets to edges sharing the same node pair.
 * Called after filtering so visible edges are always centered.
 * Mutates edge.data.parallelOffset.
 */
function assignParallelOffsets(edges) {
  const SPACING = 8;
  const pairGroups = new Map();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('::');
    if (!pairGroups.has(key)) pairGroups.set(key, []);
    pairGroups.get(key).push(edge);
  }
  for (const group of pairGroups.values()) {
    const N = group.length;
    group.forEach((edge, i) => {
      edge.data = { ...edge.data, parallelOffset: (i - (N - 1) / 2) * SPACING };
    });
  }
  return edges;
}

/**
 * Build inline style for an edge given its type, highlight state, and fade state.
 */
function buildEdgeStyle(edgeType, highlighted, faded) {
  return {
    stroke: EDGE_COLOURS[edgeType] ?? 'var(--colour-dim)',
    strokeWidth: highlighted ? 2 : 1,
    strokeDasharray: EDGE_DASH[edgeType],
    opacity: faded ? 0.05 : 1,
  };
}

/**
 * Build markerEnd for an edge — arrowheads on action and requires edges only.
 */
function buildMarker(edgeType) {
  if (edgeType !== 'action' && edgeType !== 'requires') return undefined;
  return { type: MarkerType.ArrowClosed, color: EDGE_COLOURS[edgeType], width: 12, height: 12 };
}

// ── ReferenceGraph component ─────────────────────────────────────────────────

export default function ReferenceGraph({
  events, selectedRef, onSelectRef, onOpenSidebar, onEditEvent, trustSet, clientMode,
}) {
  const [activeFilters, setActiveFilters] = useState(() => new Set(EDGE_TYPES));

  // 1. Build raw graph
  const { rawNodes, rawEdges } = useMemo(
    () => eventsToReferenceGraph(events),
    [events]
  );

  // 2. Compute layout positions using dagre (uses rawEdges for rank structure)
  const layoutNodes = useMemo(() => {
    const nodes = rawNodes.map(n => ({ ...n, position: { x: 0, y: 0 } }));
    computeLayout(nodes, rawEdges);
    return nodes;
  }, [rawNodes, rawEdges]);

  // 3. Filter edges by active filter chips
  const filteredRawEdges = useMemo(
    () => rawEdges.filter(e => activeFilters.has(e.edgeType)),
    [rawEdges, activeFilters]
  );

  // 4. Assign parallel offsets after filtering (so visible edges are centered)
  const offsetEdges = useMemo(
    () => assignParallelOffsets(filteredRawEdges.map(e => ({ ...e, data: { ...e.data } }))),
    [filteredRawEdges]
  );

  // 5. Apply selection highlighting
  const { styledNodes, styledEdges } = useMemo(() => {
    if (!selectedRef) {
      return {
        styledNodes: layoutNodes.map(n => ({ ...n, data: { ...n.data, dimmed: false } })),
        styledEdges: offsetEdges.map(e => ({
          ...e,
          type: 'parallel',
          style: buildEdgeStyle(e.edgeType, false, false),
          markerEnd: buildMarker(e.edgeType),
        })),
      };
    }
    const connected = new Set();
    for (const e of offsetEdges) {
      if (e.source === selectedRef) connected.add(e.target);
      if (e.target === selectedRef) connected.add(e.source);
    }
    const highlighted = new Set([selectedRef, ...connected]);
    return {
      styledNodes: layoutNodes.map(n => ({
        ...n,
        data: { ...n.data, dimmed: !highlighted.has(n.id) },
      })),
      styledEdges: offsetEdges.map(e => {
        const touches = e.source === selectedRef || e.target === selectedRef;
        return {
          ...e,
          type: 'parallel',
          style: buildEdgeStyle(e.edgeType, touches, !touches),
          markerEnd: buildMarker(e.edgeType),
        };
      }),
    };
  }, [layoutNodes, offsetEdges, selectedRef]);

  // 6. XYFlow state
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(styledNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges);

  // Preserve drag positions across re-renders
  const positionOverrides = useRef(new Map());

  // Clear drag overrides when event set changes (fresh layout)
  useEffect(() => {
    positionOverrides.current.clear();
  }, [rawNodes]);

  // Sync styled nodes into XYFlow, merging drag position overrides
  useEffect(() => {
    setNodes(styledNodes.map(n => {
      const override = positionOverrides.current.get(n.id);
      return override ? { ...n, position: override } : n;
    }));
  }, [styledNodes, setNodes]);

  // Sync styled edges
  useEffect(() => {
    setEdges(styledEdges);
  }, [styledEdges, setEdges]);

  const onNodesChange = useCallback((changes) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        positionOverrides.current.set(change.id, change.position);
      }
    }
    onNodesChangeInternal(changes);
  }, [onNodesChangeInternal]);

  const onNodeClick = useCallback((_, node) => {
    const ref = node.data?.ref;
    onSelectRef(ref === selectedRef ? null : ref);
  }, [onSelectRef, selectedRef]);

  const onEdgeClick = useCallback((_, edge) => {
    onSelectRef(edge.source);
  }, [onSelectRef]);

  const onPaneClick = useCallback(() => {
    onSelectRef(null);
  }, [onSelectRef]);

  const toggleFilter = useCallback((et) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(et) ? next.delete(et) : next.add(et);
      return next;
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Filter chips */}
      <div style={{
        position: 'absolute', top: 14, left: 8, zIndex: 10,
        display: 'flex', gap: 4, flexWrap: 'wrap',
        fontFamily: 'inherit',
      }}>
        {EDGE_TYPES.map(et => {
          const active = activeFilters.has(et);
          const colour = EDGE_COLOURS[et];
          return (
            <button
              key={et}
              onClick={() => toggleFilter(et)}
              style={{
                background: active
                  ? `color-mix(in srgb, ${colour} 20%, var(--colour-bg))`
                  : 'var(--colour-bg)',
                border: `1px solid ${active ? colour : 'var(--colour-dim)'}`,
                color: active ? colour : 'var(--colour-dim)',
                font: 'inherit', fontSize: '0.5rem',
                padding: '3px 6px', cursor: 'pointer',
              }}
            >
              {et}
            </button>
          );
        })}

      </div>

      {/* Details button — top-right, visible when a node is selected */}
      {selectedRef && (
        <button
          onClick={() => onOpenSidebar?.(selectedRef)}
          style={{
            position: 'absolute', top: 14, right: 8, zIndex: 10,
            background: 'var(--colour-bg)',
            border: '1px solid var(--colour-highlight)',
            color: 'var(--colour-highlight)',
            font: 'inherit', fontSize: '0.5rem',
            padding: '1px 6px', cursor: 'pointer',
          }}
        >
          details
        </button>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={refNodeTypes}
        edgeTypes={parallelEdgeTypes}
        defaultEdgeOptions={{ type: 'parallel' }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 0.6 }}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--colour-dim)" gap={40} size={1} style={{ opacity: 0.1 }} />
        <Controls showInteractive={false} style={{ bottom: 10, left: 10 }} />
      </ReactFlow>
    </div>
  );
}
