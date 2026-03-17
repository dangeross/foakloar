/**
 * router.js — Simple path-based routing for world URLs.
 *
 * URL patterns:
 *   /w              → lobby (world index / create)
 *   /w/:slug        → load and play a world by its slug
 *   /               → redirect to /w/the-lake (default world)
 *
 * No external router library — just pathname parsing + pushState.
 */

const DEFAULT_WORLD = 'the-lake';

/**
 * Parse the current URL path into a route object.
 * @returns {{ page: 'lobby' | 'game', worldSlug: string | null }}
 */
export function parseRoute() {
  const path = window.location.pathname;

  // /w/:slug — play a world
  const worldMatch = path.match(/^\/w\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/i);
  if (worldMatch) {
    return { page: 'game', worldSlug: worldMatch[1].toLowerCase() };
  }

  // /w or /w/ — lobby
  if (path === '/w' || path === '/w/') {
    return { page: 'lobby', worldSlug: null };
  }

  // Legacy: bare / or anything else → default world
  return { page: 'game', worldSlug: DEFAULT_WORLD };
}

/**
 * Navigate to a world by slug. Uses pushState for SPA navigation.
 * @param {string} slug
 */
export function navigateToWorld(slug) {
  const url = `/w/${slug}`;
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to the lobby.
 */
export function navigateToLobby() {
  window.history.pushState({}, '', '/w');
  window.dispatchEvent(new PopStateEvent('popstate'));
}
