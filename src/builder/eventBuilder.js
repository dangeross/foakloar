/**
 * eventBuilder.js — Construct valid NOSTR dungeon events from form data.
 */

/**
 * Slugify a title for use in d-tags.
 * Lowercases, replaces spaces/special chars with hyphens, trims.
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Build a d-tag from components.
 */
export function buildDTag(worldSlug, eventType, name) {
  return `${worldSlug}:${eventType}:${slugify(name)}`;
}

/**
 * Build a full a-tag reference.
 */
export function buildATag(pubkey, dTag) {
  return `30078:${pubkey}:${dTag}`;
}

/**
 * Build an unsigned event template from draft data.
 * The signer will add pubkey, id, sig, and created_at.
 *
 * @param {Object} opts
 * @param {string} opts.eventType - place, portal, item, etc.
 * @param {string} opts.worldSlug - world t-tag value
 * @param {string} opts.dTag - full d-tag value
 * @param {Array} opts.tags - user-defined tags (from TagEditor)
 * @param {string} opts.content - event content field
 * @returns {{ kind: number, tags: string[][], content: string }}
 */
export function buildEventTemplate({ eventType, worldSlug, dTag, tags, content }) {
  // Start with identity tags (d, t, type) — always present, always first
  const allTags = [
    ['d', dTag],
    ['t', worldSlug],
    ['type', eventType],
  ];

  // Add user-defined tags (skip any that duplicate identity tags)
  const identityNames = new Set(['d', 't', 'type']);
  for (const tag of tags) {
    if (!identityNames.has(tag[0])) {
      allTags.push(tag);
    }
  }

  return {
    kind: 30078,
    tags: allTags,
    content: content || '',
  };
}

/**
 * Validate an event template before publishing.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateEvent(template) {
  const errors = [];

  // Check required tags
  const tagNames = new Set(template.tags.map((t) => t[0]));
  if (!tagNames.has('d')) errors.push('Missing d-tag');
  if (!tagNames.has('t')) errors.push('Missing t-tag (world)');
  if (!tagNames.has('type')) errors.push('Missing type tag');

  // Check d-tag is non-empty
  const dTag = template.tags.find((t) => t[0] === 'd');
  if (dTag && !dTag[1]) errors.push('D-tag value is empty');

  // Check event refs are well-formed
  for (const tag of template.tags) {
    for (let i = 1; i < tag.length; i++) {
      if (typeof tag[i] === 'string' && tag[i].startsWith('30078:')) {
        // Looks like an a-tag ref — validate format
        const parts = tag[i].split(':');
        if (parts.length < 3 || parts[1].length !== 64) {
          errors.push(`Invalid event ref in ${tag[0]} tag: ${tag[i]}`);
        }
      }
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Sign and publish an event template to a relay.
 *
 * @param {Object} signer - { signEvent(event) }
 * @param {Object} relay - relay ref (.current is the connected relay)
 * @param {Object} template - from buildEventTemplate
 * @returns {Promise<{ ok: boolean, event?: Object, error?: string }>}
 */
export async function publishEvent(signer, relay, template) {
  try {
    const unsigned = {
      ...template,
      created_at: Math.floor(Date.now() / 1000),
    };

    const signed = await signer.signEvent(unsigned);

    if (!relay.current) {
      return { ok: false, error: 'Not connected to relay.' };
    }

    await relay.current.publish(signed);
    return { ok: true, event: signed };
  } catch (err) {
    return { ok: false, error: err.message || 'Publish failed.' };
  }
}
