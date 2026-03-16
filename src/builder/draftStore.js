/**
 * draftStore.js — Draft CRUD against localStorage.
 *
 * Drafts are unsigned event templates stored locally until published.
 * Uses the same shape as the bulk import/export format:
 *
 *   { events: [{ kind, tags, content, _draft: { id, createdAt, updatedAt } }],
 *     answers: {} }
 *
 * Event refs use `<PUBKEY>` placeholder — resolved at publish time.
 *
 * Storage key: `drafts:<world-slug>`
 */

const STORAGE_PREFIX = 'drafts:';
const PUBKEY_PLACEHOLDER = '<PUBKEY>';

function getKey(worldSlug) {
  return `${STORAGE_PREFIX}${worldSlug}`;
}

function readStore(worldSlug) {
  try {
    const raw = localStorage.getItem(getKey(worldSlug));
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old format: { drafts: [...] } → { events: [...] }
      if (parsed.drafts && !parsed.events) {
        return migrateOldFormat(parsed);
      }
      return parsed;
    }
  } catch {
    // Corrupt — start fresh
  }
  return { events: [], answers: {} };
}

/** Migrate from old draft format to event template format */
function migrateOldFormat(old) {
  const events = old.drafts.map((d) => {
    // Reconstruct tags: old format had separate eventType + tags
    const hasDTag = d.tags?.some((t) => t[0] === 'd');
    const hasTTag = d.tags?.some((t) => t[0] === 't');
    const hasTypeTag = d.tags?.some((t) => t[0] === 'type');

    const tags = [];
    if (!hasDTag && d.dTag) tags.push(['d', d.dTag]);
    if (!hasTTag) tags.push(['t', '']);  // will be filled on edit
    if (!hasTypeTag && d.eventType) tags.push(['type', d.eventType]);
    tags.push(...(d.tags || []));

    return {
      kind: 30078,
      tags,
      content: d.content || '',
      _draft: {
        id: d.id || crypto.randomUUID(),
        createdAt: d.createdAt || Date.now(),
        updatedAt: d.updatedAt || Date.now(),
      },
    };
  });
  return { events, answers: {} };
}

function writeStore(worldSlug, store) {
  localStorage.setItem(getKey(worldSlug), JSON.stringify(store));
}

// ── Helpers to read tags from event templates ──────────────────────────────

function getTagValue(event, tagName) {
  const tag = event.tags?.find((t) => t[0] === tagName);
  return tag?.[1] ?? null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load all draft events for a world.
 * Returns array of event templates with _draft metadata.
 */
export function loadDrafts(worldSlug) {
  return readStore(worldSlug).events;
}

/**
 * Load the answers map.
 */
export function loadAnswers(worldSlug) {
  return readStore(worldSlug).answers || {};
}

/**
 * Save a new draft event template. Returns the entry with _draft metadata.
 */
export function saveDraft(worldSlug, event) {
  const store = readStore(worldSlug);
  const now = Date.now();
  const entry = {
    kind: event.kind || 30078,
    tags: event.tags || [],
    content: event.content || '',
    _draft: {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    },
  };
  store.events.push(entry);
  writeStore(worldSlug, store);
  return entry;
}

/**
 * Update an existing draft by id.
 */
export function updateDraft(worldSlug, id, updates) {
  const store = readStore(worldSlug);
  const idx = store.events.findIndex((e) => e._draft?.id === id);
  if (idx === -1) return null;
  store.events[idx] = {
    ...store.events[idx],
    ...updates,
    _draft: {
      ...store.events[idx]._draft,
      updatedAt: Date.now(),
    },
  };
  writeStore(worldSlug, store);
  return store.events[idx];
}

/**
 * Delete a draft by id.
 */
export function deleteDraft(worldSlug, id) {
  const store = readStore(worldSlug);
  store.events = store.events.filter((e) => e._draft?.id !== id);
  writeStore(worldSlug, store);
}

/**
 * Get a single draft by id.
 */
export function getDraft(worldSlug, id) {
  const store = readStore(worldSlug);
  return store.events.find((e) => e._draft?.id === id) || null;
}

/**
 * Save or update an answer for a puzzle d-tag.
 */
export function saveAnswer(worldSlug, dTag, answer) {
  const store = readStore(worldSlug);
  store.answers = store.answers || {};
  store.answers[dTag] = answer;
  writeStore(worldSlug, store);
}

// ── Import / Export ────────────────────────────────────────────────────────

/**
 * Import events from a JSON object (the lighthouse format).
 * Each event becomes a draft. Existing drafts with the same d-tag are skipped.
 *
 * @param {string} worldSlug
 * @param {{ events: Array, answers?: Object }} data
 * @returns {{ imported: number, skipped: number }}
 */
export function importEvents(worldSlug, data) {
  const store = readStore(worldSlug);
  const existingDTags = new Set(store.events.map((e) => getTagValue(e, 'd')).filter(Boolean));
  const now = Date.now();
  let imported = 0;
  let skipped = 0;

  for (const event of (data.events || [])) {
    const dTag = getTagValue(event, 'd');
    if (dTag && existingDTags.has(dTag)) {
      skipped++;
      continue;
    }
    store.events.push({
      kind: event.kind || 30078,
      tags: event.tags || [],
      content: event.content || '',
      _draft: {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      },
    });
    if (dTag) existingDTags.add(dTag);
    imported++;
  }

  // Merge answers
  if (data.answers) {
    store.answers = { ...(store.answers || {}), ...data.answers };
  }

  writeStore(worldSlug, store);
  return { imported, skipped };
}

/**
 * Export all drafts as a clean JSON object (no _draft metadata).
 * Suitable for sharing or re-importing.
 *
 * @param {string} worldSlug
 * @returns {{ events: Array, answers: Object }}
 */
export function exportDrafts(worldSlug) {
  const store = readStore(worldSlug);
  const events = store.events.map(({ kind, tags, content }) => ({
    kind,
    tags,
    content,
  }));
  return {
    events,
    answers: store.answers || {},
  };
}

/**
 * Replace `<PUBKEY>` placeholder with actual pubkey in all tag values.
 *
 * @param {Object} event - event template { kind, tags, content }
 * @param {string} pubkey - hex pubkey to substitute
 * @returns {Object} - new event with substituted tags
 */
export function resolvePubkeyPlaceholder(event, pubkey) {
  return {
    ...event,
    tags: event.tags.map((tag) =>
      tag.map((val) =>
        typeof val === 'string' ? val.replaceAll(PUBKEY_PLACEHOLDER, pubkey) : val
      )
    ),
  };
}

/**
 * Bulk publish all drafts.
 *
 * @param {string} worldSlug
 * @param {string} pubkey - publisher's pubkey (for placeholder substitution)
 * @param {Object} signer - { signEvent(event) }
 * @param {Object} relay - relay ref (.current)
 * @returns {Promise<{ published: number, failed: number, errors: string[] }>}
 */
export async function bulkPublish(worldSlug, pubkey, signer, relay) {
  const store = readStore(worldSlug);
  let published = 0;
  let failed = 0;
  const errors = [];
  const publishedIds = [];

  for (const event of store.events) {
    try {
      const resolved = resolvePubkeyPlaceholder(event, pubkey);
      const unsigned = {
        kind: resolved.kind,
        tags: resolved.tags,
        content: resolved.content,
        created_at: Math.floor(Date.now() / 1000),
      };
      const signed = await signer.signEvent(unsigned);
      await relay.current.publish(signed);
      published++;
      if (event._draft?.id) publishedIds.push(event._draft.id);
    } catch (err) {
      failed++;
      const dTag = getTagValue(event, 'd') || '?';
      errors.push(`${dTag}: ${err.message}`);
    }
  }

  // Remove successfully published drafts
  if (publishedIds.length > 0) {
    const idSet = new Set(publishedIds);
    store.events = store.events.filter((e) => !idSet.has(e._draft?.id));
    writeStore(worldSlug, store);
  }

  return { published, failed, errors };
}
