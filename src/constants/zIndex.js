/**
 * Z-index constants — single source of truth for stacking order.
 *
 * Layers (lowest to highest):
 *   GAME         — game UI, input
 *   GRAPH        — build mode graph (ReactFlow)
 *   GRAPH_HEADER — graph top bar, sidebar
 *   PANEL        — modal panels (EventEditor, DraftList, Trust, etc.)
 *   DROPDOWN     — dropdown menus inside panels
 *   TOOLTIP      — tooltips, popovers
 */

export const Z = {
  GAME:         10,
  GRAPH:        50,
  GRAPH_HEADER: 53,
  PANEL:        1100,  // above ReactFlow internals (max 1001)
  DROPDOWN:     1200,
  TOOLTIP:      1300,
};
