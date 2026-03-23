/**
 * router.js — Simple path-based routing for world URLs.
 *
 * URL patterns:
 *   /w              → lobby (world index / create)
 *   /w/:slug        → load and play a world by its slug
 *   /u/:npub        → author profile page
 *   /               → redirect to /w/the-lake (default world)
 *
 * No external router library — just pathname parsing + pushState.
 */

import { nip19 } from 'nostr-tools';

const DEFAULT_WORLD = 'the-lake';

/**
 * Parse the current URL path into a route object.
 * @returns {{ page: 'lobby' | 'game' | 'profile', worldSlug?: string, pubkeyHex?: string, npub?: string }}
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

  // /guide — guide table of contents
  if (path === '/guide' || path === '/guide/') {
    return { page: 'guide', guidePage: null };
  }

  // /guide/:page — guide page
  const guideMatch = path.match(/^\/guide\/([a-z0-9-]+)$/i);
  if (guideMatch) {
    return { page: 'guide', guidePage: guideMatch[1] };
  }

  // /u/:npub — author profile
  const profileMatch = path.match(/^\/u\/(npub1[a-z0-9]+)$/i);
  if (profileMatch) {
    try {
      const decoded = nip19.decode(profileMatch[1]);
      if (decoded.type === 'npub') {
        return { page: 'profile', pubkeyHex: decoded.data, npub: profileMatch[1] };
      }
    } catch {
      // Invalid npub — fall through to default
    }
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

/**
 * Navigate to an author's profile page.
 * @param {string} npub — bech32-encoded public key (npub1...)
 */
export function navigateToGuide(page = null) {
  const url = page ? `/guide/${page}` : '/guide';
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToProfile(npub) {
  window.history.pushState({}, '', `/u/${npub}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
