/**
 * MapOverlay — fog-of-war player map rendered as a force-directed graph.
 *
 * The full world graph (all places + portals) is used for the force simulation
 * so node positions are stable regardless of which places have been visited.
 * Only visited nodes and used-portal edges are drawn.
 *
 * In "full" mode, adjacent unvisited places connected by used portals are also
 * shown as unnamed dim nodes.
 *
 * Pan by dragging. Zoom with [+]/[-] buttons (zooms around SVG centre).
 * Current node is centred on open. Pointer-events:none on the outer frame so
 * the game output behind it remains scrollable outside the map area.
 */
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { getTag } from '../engine/world.js';

const NODE_R = 5;
const LABEL_MAX = 25;
const VW = 600;  // force-sim coordinate space
const VH = 400;

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;

/** Stable seed from a string — simple hash to a 0–1 float. */
function seedPos(str, axis) {
  let h = axis === 'x' ? 0x9e3779b9 : 0x6c62272e;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  return ((h >>> 0) / 0xffffffff) * 0.6 + 0.2;
}

function truncate(str) {
  if (!str) return '?';
  return str.length > LABEL_MAX ? str.slice(0, LABEL_MAX - 1) + '…' : str;
}

export default function MapOverlay({ events, playerState, mapMode, currentPlace, onClose }) {
  const svgRef       = useRef(null); // <svg> element — used for getBoundingClientRect
  const gRef         = useRef(null); // <g> element — drawing target + receives transform
  const currentPosRef = useRef(null); // sim-space position of the current node

  // Transform stored in a ref so pan/zoom don't trigger React re-renders
  const tx = useRef({ x: 0, y: 0, scale: 2.4 });
  const dragRef = useRef(null);  // { startX, startY, ox, oy } while dragging

  const applyTransform = useCallback(() => {
    if (!gRef.current) return;
    const { x, y, scale } = tx.current;
    gRef.current.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
  }, []);

  // ── Build the FULL world graph ────────────────────────────────────────────
  const { allNodes, allLinks, visibleNodeIds, visibleLinkIds } = useMemo(() => {
    if (!events || !playerState) {
      return { allNodes: [], allLinks: [], visibleNodeIds: new Set(), visibleLinkIds: new Set() };
    }

    const visited    = new Set(playerState.visited    || []);
    const portalsUsed = new Set(playerState.portalsUsed || []);

    // All place nodes
    const nodeMap = new Map();
    for (const [ref, ev] of events) {
      if (getTag(ev, 'type') !== 'place') continue;
      const title = getTag(ev, 'title') || ref.split(':').pop();
      nodeMap.set(ref, {
        id: ref,
        title: truncate(title),
        x: seedPos(ref, 'x') * VW,
        y: seedPos(ref, 'y') * VH,
      });
    }

    // All portal edges
    const edgeSet = new Set();
    const allLinks = [];
    const visibleLinkIds = new Set();

    for (const [ref, ev] of events) {
      if (getTag(ev, 'type') !== 'portal') continue;
      const exits = (ev.tags || [])
        .filter((t) => t[0] === 'exit' && t[1]?.startsWith('30078:'))
        .map((t) => t[1]);
      if (exits.length < 2) continue;
      const [from, to] = exits;
      if (!nodeMap.has(from) || !nodeMap.has(to)) continue;
      const key = [from, to].sort().join('|');
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        allLinks.push({ source: from, target: to, id: ref });
      }
      if (portalsUsed.has(ref)) visibleLinkIds.add(ref);
    }

    // Visible nodes
    const visibleNodeIds = new Set(visited);
    if (mapMode === 'full') {
      // Show any place adjacent to a visited place via any portal (not just used ones),
      // plus the connecting edge. Iterate allLinks so the link id matches exactly.
      for (const l of allLinks) {
        const fromVisited = visited.has(l.source);
        const toVisited   = visited.has(l.target);
        if (fromVisited || toVisited) {
          visibleNodeIds.add(l.source);
          visibleNodeIds.add(l.target);
          visibleLinkIds.add(l.id);
        }
      }
    }

    return { allNodes: [...nodeMap.values()], allLinks, visibleNodeIds, visibleLinkIds };
  }, [events, playerState, mapMode]);

  // ── Force sim + draw ──────────────────────────────────────────────────────
  useEffect(() => {
    const g = gRef.current;
    const svg = svgRef.current;
    if (!g || !svg || allNodes.length === 0 || visibleNodeIds.size === 0) return;

    // Clear previous draw
    while (g.firstChild) g.removeChild(g.firstChild);

    const simNodes = allNodes.map((n) => ({ ...n }));
    const idToNode = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks = allLinks
      .map((l) => ({ ...l, source: idToNode.get(l.source), target: idToNode.get(l.target) }))
      .filter((l) => l.source && l.target);

    const sim = forceSimulation(simNodes)
      .force('link',    forceLink(simLinks).id((d) => d.id).distance(35).strength(1))
      .force('charge',  forceManyBody().strength(-40))
      .force('center',  forceCenter(VW / 2, VH / 2).strength(0.3))
      .force('collide', forceCollide(NODE_R + 6))
      .stop();

    for (let i = 0; i < 200; i++) sim.tick();

    const ns = 'http://www.w3.org/2000/svg';
    const visited = playerState.visited || [];

    // Draw edges
    for (const l of simLinks) {
      if (!visibleLinkIds.has(l.id)) continue;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', l.source.x);
      line.setAttribute('y1', l.source.y);
      line.setAttribute('x2', l.target.x);
      line.setAttribute('y2', l.target.y);
      line.setAttribute('stroke', 'var(--colour-dim)');
      line.setAttribute('stroke-width', '1');
      g.appendChild(line);
    }

    // Draw nodes
    const FONT_SIZE = 4.5;
    const CHAR_W    = FONT_SIZE * 0.55; // estimated char width for monospace
    const LBL_PAD   = 1.5;             // padding around label rect

    let currentPos = null;
    for (const n of simNodes) {
      if (!visibleNodeIds.has(n.id)) continue;
      const isCurrent = n.id === currentPlace;
      const isVisited = visited.includes(n.id);
      if (isCurrent) currentPos = { x: n.x, y: n.y };

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', n.x);
      circle.setAttribute('cy', n.y);
      circle.setAttribute('r', isCurrent ? NODE_R + 1 : NODE_R);
      circle.setAttribute('fill', isCurrent
        ? 'var(--colour-highlight)'
        : isVisited ? 'var(--colour-exits)' : 'none');
      circle.setAttribute('stroke', isCurrent
        ? 'var(--colour-highlight)'
        : isVisited ? 'var(--colour-exits)' : 'var(--colour-dim)');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('opacity', isVisited ? '1' : '0.4');
      g.appendChild(circle);

      if (isVisited && n.title) {
        const labelY  = n.y + NODE_R + FONT_SIZE + 2; // baseline y
        const estW    = n.title.length * CHAR_W;

        // Background rect
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x',      n.x - estW / 2 - LBL_PAD);
        rect.setAttribute('y',      labelY - FONT_SIZE - LBL_PAD + 1);
        rect.setAttribute('width',  estW + LBL_PAD * 2);
        rect.setAttribute('height', FONT_SIZE + LBL_PAD * 2);
        rect.setAttribute('fill',   'var(--colour-bg)');
        rect.setAttribute('opacity', '0.75');
        g.appendChild(rect);

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', n.x);
        text.setAttribute('y', labelY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', FONT_SIZE);
        text.setAttribute('fill', isCurrent ? 'var(--colour-highlight)' : 'var(--colour-text)');
        text.setAttribute('opacity', isCurrent ? '1' : '0.8');
        text.textContent = n.title;
        g.appendChild(text);
      }
    }

    // Store current node sim position for the centre button
    currentPosRef.current = currentPos;

    // Centre transform on current node on first draw (keep existing scale)
    if (currentPos) {
      const { width, height } = svg.getBoundingClientRect();
      const s = tx.current.scale;
      tx.current.x = width  / 2 - currentPos.x * s;
      tx.current.y = height / 2 - currentPos.y * s;
      applyTransform();
    }
  }, [allNodes, allLinks, visibleNodeIds, visibleLinkIds, currentPlace, playerState, applyTransform]);

  // ── Pan ───────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: tx.current.x, oy: tx.current.y };
    e.currentTarget.style.cursor = 'grabbing';
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    tx.current.x = dragRef.current.ox + (e.clientX - dragRef.current.startX);
    tx.current.y = dragRef.current.oy + (e.clientY - dragRef.current.startY);
    applyTransform();
  }, [applyTransform]);

  const onMouseUp = useCallback((e) => {
    dragRef.current = null;
    e.currentTarget.style.cursor = 'grab';
  }, []);

  // ── Centre on current node ────────────────────────────────────────────────
  const centreOnCurrent = useCallback(() => {
    const svg = svgRef.current;
    const pos = currentPosRef.current;
    if (!svg || !pos) return;
    const { width, height } = svg.getBoundingClientRect();
    const s = tx.current.scale;
    tx.current.x = width  / 2 - pos.x * s;
    tx.current.y = height / 2 - pos.y * s;
    applyTransform();
  }, [applyTransform]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoom = useCallback((delta) => {
    const svg = svgRef.current;
    if (!svg) return;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, tx.current.scale + delta));
    const { width, height } = svg.getBoundingClientRect();
    // Keep the SVG centre fixed in sim-space during zoom
    const cx = width / 2, cy = height / 2;
    const px = (cx - tx.current.x) / tx.current.scale;
    const py = (cy - tx.current.y) / tx.current.scale;
    tx.current = { x: cx - px * newScale, y: cy - py * newScale, scale: newScale };
    applyTransform();
  }, [applyTransform]);

  if (visibleNodeIds.size === 0) return null;

  const btnStyle = {
    color: 'var(--colour-dim)', background: 'none', border: 'none',
    font: 'inherit', fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1, padding: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '0.5rem', left: '0.5rem', right: '0.5rem',
        height: 'calc(50% - 0.5rem)',
        backgroundColor: 'var(--colour-bg)',
        border: '1px solid var(--colour-dim)',
        zIndex: 20,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Pan/zoom canvas — fills the full container */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ display: 'block', fontFamily: 'inherit', cursor: 'grab', pointerEvents: 'auto' }}
      >
        <g ref={gRef} />
      </svg>

      {/* [X] — top-left corner overlay */}
      <button
        onClick={onClose}
        style={{ ...btnStyle, position: 'absolute', top: '0.3rem', left: '0.3rem', pointerEvents: 'auto' }}
      >[X]</button>

      {/* [+] [-] [◎] — bottom-left corner overlay */}
      <div style={{ position: 'absolute', bottom: '0.3rem', left: '0.3rem', display: 'flex', gap: '0.4rem', pointerEvents: 'auto' }}>
        <button style={btnStyle} onClick={() => zoom(ZOOM_STEP)}>[+]</button>
        <button style={btnStyle} onClick={() => zoom(-ZOOM_STEP)}>[-]</button>
        <button style={btnStyle} onClick={centreOnCurrent}>[◎]</button>
      </div>
    </div>
  );
}
