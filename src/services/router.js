/**
 * router.js — Simple path-based routing for world URLs.
 *
 * URL patterns:
 *   /               → landing page
 *   /w              → lobby (world index / search)
 *   /w/:slug        → load and play a world by its slug
 *   /w/:slug-XXXXXXXX → pinned world (XXXXXXXX = first 4 bytes of author pubkey)
 *   /guide          → guide table of contents
 *   /guide/:page    → guide page
 *   /u/:npub        → author profile page
 *
 * No external router library — just pathname parsing + pushState.
 */

import { nip19 } from 'nostr-tools';

const DEFAULT_WORLD = 'the-lake';

/**
 * Split a full world URL slug into world tag + optional pubkey prefix.
 * A pubkey prefix is exactly 8 lowercase hex chars at the end,
 * e.g. "the-lake-c08d7b5a" → { worldSlug: "the-lake", pubkeyPrefix: "c08d7b5a" }.
 * @param {string} full — the raw slug from the URL
 * @returns {{ worldSlug: string, pubkeyPrefix: string|null }}
 */
export function splitWorldSlug(full) {
  const lower = full.toLowerCase();
  const m = lower.match(/^(.+)-([0-9a-f]{8})$/);
  if (m) return { worldSlug: m[1], pubkeyPrefix: m[2] };
  return { worldSlug: lower, pubkeyPrefix: null };
}

/**
 * Build a pinned world URL slug: "the-lake-c08d7b5a".
 * @param {string} worldSlug
 * @param {string} pubkeyHex — full 64-char hex pubkey
 * @returns {string}
 */
export function pinnedSlug(worldSlug, pubkeyHex) {
  return `${worldSlug}-${pubkeyHex.slice(0, 8)}`;
}

/**
 * Parse the current URL path into a route object.
 * @returns {{ page: 'lobby' | 'game' | 'profile', worldSlug?: string, pubkeyPrefix?: string|null, pubkeyHex?: string, npub?: string }}
 */
export function parseRoute() {
  const path = window.location.pathname;

  // /w/:slug — play a world (slug may include 8-char hex pubkey prefix suffix)
  const worldMatch = path.match(/^\/w\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/i);
  if (worldMatch) {
    const { worldSlug, pubkeyPrefix } = splitWorldSlug(worldMatch[1]);
    return { page: 'game', worldSlug, pubkeyPrefix };
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

  // / or unknown → landing page
  return { page: 'landing' };
}

/**
 * Navigate to a world by slug. Uses pushState for SPA navigation.
 * @param {string} slug — world slug (may already include pubkey prefix)
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

/**
 * Navigate to the landing page.
 */
export function navigateToLanding() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}
