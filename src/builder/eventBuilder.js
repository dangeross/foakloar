/**
 * eventBuilder.js — Construct valid NOSTR dungeon events from form data.
 */

import { TAG_SCHEMAS, TAGS_BY_EVENT_TYPE, getTagSchema, tagToValues } from './tagSchema.js';
import { derivePuzzleKeypair } from '../engine/nip44-client.js';

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
  // World events use <slug>:world (no name suffix)
  if (eventType === 'world') return `${worldSlug}:world`;
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
    ...(eventType === 'world' ? [['w', 'foakloar']] : []),
    ['type', eventType],
  ];

  // Add user-defined tags (skip any that duplicate identity tags)
  const identityNames = new Set(['d', 't', 'type', 'w']);
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
  const warnings = [];

  // ── Identity tags ────────────────────────────────────────────────────────
  const tagNames = new Set(template.tags.map((t) => t[0]));
  if (!tagNames.has('d')) errors.push('Missing d-tag');
  if (!tagNames.has('t')) errors.push('Missing t-tag (world)');
  if (!tagNames.has('type')) errors.push('Missing type tag');

  const dTag = template.tags.find((t) => t[0] === 'd');
  if (dTag && !dTag[1]) errors.push('D-tag value is empty');

  const typeTag = template.tags.find((t) => t[0] === 'type')?.[1];

  // World events need the protocol tag for relay discovery
  if (typeTag === 'world' && !tagNames.has('w')) {
    warnings.push('World event missing w-tag (protocol identifier)');
  }

  // ── Event ref format ─────────────────────────────────────────────────────
  for (const tag of template.tags) {
    for (let i = 1; i < tag.length; i++) {
      if (typeof tag[i] === 'string' && tag[i].startsWith('30078:')) {
        // Skip validation for refs with <PUBKEY> placeholder (resolved at publish time)
        if (tag[i].includes('<PUBKEY>')) continue;
        const parts = tag[i].split(':');
        if (parts.length < 3 || parts[1].length !== 64) {
          errors.push(`Invalid event ref in ${tag[0]}: ${tag[i]}`);
        }
      }
    }
  }

  // ── Schema-based field validation ────────────────────────────────────────
  if (typeTag) {
    // Check required fields on each tag
    for (const tag of template.tags) {
      const tagName = tag[0];
      const schema = getTagSchema(tagName, typeTag);
      if (!schema) continue;

      const values = tagToValues(tag, schema.fields);
      for (const field of schema.fields) {
        if (field.required && !values[field.name]) {
          errors.push(`${schema.label || tagName}: "${field.name}" is required`);
        }
      }
    }

    // Check event type has at least a title (for types that use one)
    const typesWithTitle = ['place', 'item', 'feature', 'clue', 'npc', 'payment', 'world', 'quest', 'recipe'];
    if (typesWithTitle.includes(typeTag) && !tagNames.has('title')) {
      errors.push('Missing title tag');
    }

    // Content field required on most event types (optional on portals and world events)
    const contentOptionalTypes = ['portal', 'world', 'vouch', 'consequence', 'dialogue', 'recipe', 'payment', 'quest', 'sound'];
    if (!contentOptionalTypes.includes(typeTag) && !template.content) {
      errors.push('Missing content — add a description in the content field');
    }

    // Portal must have at least one exit
    if (typeTag === 'portal' && !tagNames.has('exit')) {
      errors.push('Portal must have at least one exit');
    }

    // Place should have at least one exit (warning, not error)
    if (typeTag === 'place' && !tagNames.has('exit')) {
      warnings.push('Place has no exits — players cannot leave');
    }

    // Items/features/NPCs need at least one noun for parser
    const typesWithNoun = ['item', 'feature', 'npc'];
    if (typesWithNoun.includes(typeTag) && !tagNames.has('noun')) {
      warnings.push(`${typeTag} has no noun — players cannot refer to it`);
    }

    // Triggers with no action selected
    const triggerNames = ['on-interact', 'on-enter', 'on-encounter', 'on-attacked',
      'on-health', 'on-player-health', 'on-health-zero', 'on-player-health-zero', 'on-move', 'on-counter', 'on-complete', 'on-fail'];
    for (const tag of template.tags) {
      if (triggerNames.includes(tag[0])) {
        const schema = getTagSchema(tag[0], typeTag);
        if (schema) {
          const values = tagToValues(tag, schema.fields);
          if (!values.action) {
            errors.push(`${schema.label}: no action type selected`);
          }
        }
      }
    }

    // State machine: transitions without initial state
    if (tagNames.has('transition') && !tagNames.has('state')) {
      warnings.push('Has transitions but no initial state');
    }

    // Verb declared but no matching on-interact
    const interactableTypes = ['feature', 'item', 'npc'];
    if (interactableTypes.includes(typeTag)) {
      const verbs = template.tags.filter((t) => t[0] === 'verb').map((t) => t[1]);
      const onInteractVerbs = new Set(
        template.tags.filter((t) => t[0] === 'on-interact').map((t) => t[1])
      );
      for (const verb of verbs) {
        if (verb && verb !== 'examine' && !onInteractVerbs.has(verb)) {
          warnings.push(`Verb "${verb}" has no matching on-interact — players can type it but nothing happens`);
        }
      }
    }

    // on-interact tag with unexpected element count (>5)
    for (const tag of template.tags) {
      if (tag[0] === 'on-interact' && tag.length > 5) {
        warnings.push(`on-interact "${tag[1]}" has ${tag.length - 1} fields (expected max 4) — extra elements are ignored`);
      }
    }

    // NIP-44 content-type without puzzle tag
    const contentTypeTag = template.tags.find((t) => t[0] === 'content-type');
    if (contentTypeTag?.[1] === 'application/nip44' && !tagNames.has('puzzle')) {
      errors.push('NIP-44 encrypted content requires a puzzle tag to determine the encryption key');
    }

    // Warn about unknown tags for this event type
    const allowedTags = new Set([...(TAGS_BY_EVENT_TYPE[typeTag] || []), 'd', 't', 'type']);
    for (const tag of template.tags) {
      if (!allowedTags.has(tag[0])) {
        warnings.push(`"${tag[0]}" is not expected on ${typeTag} events`);
      }
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

/**
 * Encrypt NIP-44 content if the event requires it.
 *
 * Checks for content-type: application/nip44, looks up the puzzle answer
 * from the answers map, derives the puzzle keypair, and encrypts the content
 * using the signer's encryptTo method.
 *
 * @param {Object} template - event template { kind, tags, content }
 * @param {Object} signer - signer with encryptTo(pubkey, plaintext)
 * @param {Object} answers - { puzzleDTag: answer } map
 * @param {Map|Object} allEvents - events map to look up puzzle salt
 * @returns {Promise<Object>} - template with encrypted content (or unchanged)
 */
async function maybeEncryptContent(template, signer, answers, allEvents) {
  const contentTypeTag = template.tags.find((t) => t[0] === 'content-type');
  if (!contentTypeTag || contentTypeTag[1] !== 'application/nip44') return template;
  if (!template.content) return template;
  if (!signer?.encryptTo) {
    throw new Error('NIP-44 encryption requires a signer with encryptTo support');
  }

  // Find puzzle d-tag — either from a "puzzle" tag on this event or matching puzzle event
  const puzzleTag = template.tags.find((t) => t[0] === 'puzzle');
  const puzzleDTag = puzzleTag?.[1];
  if (!puzzleDTag) {
    throw new Error('NIP-44 event has no puzzle tag — cannot determine encryption key');
  }

  // Look up the answer
  const answer = answers?.[puzzleDTag];
  if (!answer) {
    throw new Error(`No answer found for puzzle "${puzzleDTag}" — cannot encrypt content`);
  }

  // Find the puzzle event to get its salt
  let salt = null;
  if (allEvents instanceof Map) {
    for (const [, evt] of allEvents) {
      const d = evt.tags?.find((t) => t[0] === 'd')?.[1];
      if (d === puzzleDTag) {
        salt = evt.tags?.find((t) => t[0] === 'salt')?.[1];
        break;
      }
    }
  }
  // Also check if allEvents is an array-like (draft events)
  if (!salt && Array.isArray(allEvents)) {
    for (const evt of allEvents) {
      const d = evt.tags?.find((t) => t[0] === 'd')?.[1];
      if (d === puzzleDTag) {
        salt = evt.tags?.find((t) => t[0] === 'salt')?.[1];
        break;
      }
    }
  }
  if (!salt) {
    throw new Error(`Puzzle "${puzzleDTag}" has no salt — cannot derive encryption key`);
  }

  // Derive puzzle keypair and encrypt
  const { pubKeyHex } = await derivePuzzleKeypair(answer, salt);
  const ciphertext = await signer.encryptTo(pubKeyHex, template.content);

  return { ...template, content: ciphertext };
}

/**
 * Sign and publish an event template to a relay.
 *
 * @param {Object} signer - { signEvent(event), encryptTo?(pubkey, plaintext) }
 * @param {Object} relay - relay ref (.current is the connected relay)
 * @param {Object} template - from buildEventTemplate
 * @param {Object} [options] - { answers, allEvents } for NIP-44 encryption
 * @returns {Promise<{ ok: boolean, event?: Object, error?: string }>}
 */
export async function publishEvent(signer, relay, template, options = {}) {
  try {
    // Encrypt NIP-44 content if needed
    const prepared = await maybeEncryptContent(
      template, signer, options.answers, options.allEvents
    );

    const unsigned = {
      ...prepared,
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
