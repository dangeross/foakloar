// Default relay URLs (used when world event doesn't specify relays)
export const DEFAULT_RELAY_URLS = ['wss://relay.primal.net', 'wss://nos.lol'];

// Legacy default — used only as fallback when no route is matched
export const DEFAULT_WORLD_TAG = 'the-lake';

// Re-export for backwards compat with modules that import RELAY_URLS
export const RELAY_URLS = DEFAULT_RELAY_URLS;
