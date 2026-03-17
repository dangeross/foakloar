/**
 * validateWorld.js — Cross-event validation for a world's event set.
 *
 * Single-event checks live in eventBuilder.js (validateEvent).
 * This module checks relationships between events: dangling refs,
 * puzzle answer availability, puzzle-type mismatches, etc.
 *
 * Works with both draft events (<PUBKEY> placeholders) and published events.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

function getTags(event, name) {
  return (event.tags || []).filter((t) => t[0] === name);
}

/**
 * Extract the d-tag portion from an a-tag ref.
 * "30078:<PUBKEY>:the-lake:feature:lamp" → "the-lake:feature:lamp"
 * "30078:abc...def:the-lake:feature:lamp" → "the-lake:feature:lamp"
 */
export function extractDTagFromRef(ref) {
  if (typeof ref !== 'string') return null;
  const parts = ref.split(':');
  if (parts.length < 3 || parts[0] !== '30078') return null;
  return parts.slice(2).join(':');
}

/**
 * Check if a string looks like an a-tag event ref.
 */
function isEventRef(value) {
  return typeof value === 'string' && value.startsWith('30078:');
}

/**
 * Build a lookup of d-tag → event for a set of events.
 */
function buildEventIndex(events) {
  const byDTag = new Map();
  const dTags = new Set();
  for (const event of events) {
    const dTag = getTagValue(event, 'd');
    if (dTag) {
      dTags.add(dTag);
      byDTag.set(dTag, event);
    }
  }
  return { dTags, byDTag };
}

/**
 * Resolve an a-tag ref against the known d-tag set.
 * Returns the matched d-tag or null.
 */
function resolveRef(ref, dTags) {
  const dTag = extractDTagFromRef(ref);
  if (!dTag) return null;
  return dTags.has(dTag) ? dTag : null;
}

// ── Main validator ───────────────────────────────────────────────────────────

/**
 * Validate cross-event relationships in a world.
 *
 * @param {Array} events - array of event templates { kind, tags, content }
 * @param {Object} answers - { puzzleDTag: answer } map (for NIP-44 checks)
 * @returns {{ errors: Array<{dTag, message}>, warnings: Array<{dTag, message}> }}
 */
export function validateWorld(events, answers = {}) {
  const errors = [];
  const warnings = [];
  const { dTags, byDTag } = buildEventIndex(events);

  for (const event of events) {
    const dTag = getTagValue(event, 'd') || '?';
    const eventType = getTagValue(event, 'type');

    // ── 1. Dangling event refs ─────────────────────────────────────────────
    for (const tag of event.tags || []) {
      for (let i = 1; i < tag.length; i++) {
        if (!isEventRef(tag[i])) continue;
        const resolved = resolveRef(tag[i], dTags);
        if (!resolved) {
          const refDTag = extractDTagFromRef(tag[i]);
          warnings.push({
            dTag,
            message: `${tag[0]} references "${refDTag}" which is not in this world`,
          });
        }
      }
    }

    // ── 2. Place puzzle tag referencing non-sequence puzzle ─────────────────
    if (eventType === 'place') {
      for (const tag of getTags(event, 'puzzle')) {
        const puzzleDTag = extractDTagFromRef(tag[1]) || tag[1];
        const puzzleEvent = byDTag.get(puzzleDTag);
        if (puzzleEvent) {
          const puzzleType = getTagValue(puzzleEvent, 'puzzle-type');
          if (puzzleType && puzzleType !== 'sequence') {
            warnings.push({
              dTag,
              message: `puzzle tag references "${puzzleDTag}" which is type "${puzzleType}" — only sequence puzzles auto-evaluate from place puzzle tags. Riddle puzzles need an on-interact trigger on a feature`,
            });
          }
        }
      }
    }

    // ── 3. NIP-44 content validation ───────────────────────────────────────
    const contentType = getTagValue(event, 'content-type');
    if (contentType === 'application/nip44') {
      const puzzleRef = getTags(event, 'puzzle')[0]?.[1];
      if (puzzleRef) {
        const puzzleDTagStr = extractDTagFromRef(puzzleRef) || puzzleRef;
        const puzzleEvent = byDTag.get(puzzleDTagStr);

        if (!puzzleEvent) {
          errors.push({
            dTag,
            message: `NIP-44 content references puzzle "${puzzleDTagStr}" which is not in this world`,
          });
        } else {
          const salt = getTagValue(puzzleEvent, 'salt');
          if (!salt) {
            errors.push({
              dTag,
              message: `NIP-44 content references puzzle "${puzzleDTagStr}" which has no salt tag — cannot derive encryption key`,
            });
          }
          if (!answers[puzzleDTagStr]) {
            errors.push({
              dTag,
              message: `NIP-44 content references puzzle "${puzzleDTagStr}" but no answer is stored — content cannot be encrypted at publish time`,
            });
          }
        }
      }
    }

    // ── 4. on-interact set-state targeting a puzzle without answer ──────────
    for (const tag of getTags(event, 'on-interact')) {
      const action = tag[2];
      const extRef = tag[4];
      if (action === 'set-state' && extRef && isEventRef(extRef)) {
        const targetDTag = resolveRef(extRef, dTags);
        if (targetDTag) {
          const targetEvent = byDTag.get(targetDTag);
          const targetType = getTagValue(targetEvent, 'type');
          if (targetType === 'puzzle') {
            const answerHash = getTagValue(targetEvent, 'answer-hash');
            if (answerHash && !answers[targetDTag]) {
              warnings.push({
                dTag,
                message: `on-interact targets puzzle "${targetDTag}" which has an answer-hash but no answer stored — puzzle will activate but cannot verify answers at publish time for NIP-44`,
              });
            }
          }
        }
      }
    }
  }

  // ── 5. Answer hash mismatch (sync check — collect for async verify) ────
  const puzzlesToVerify = [];
  for (const event of events) {
    const eventType = getTagValue(event, 'type');
    if (eventType !== 'puzzle') continue;
    const dTag = getTagValue(event, 'd');
    const answerHash = getTagValue(event, 'answer-hash');
    const salt = getTagValue(event, 'salt');
    if (dTag && answerHash && salt && answers[dTag]) {
      puzzlesToVerify.push({ dTag, answerHash, salt, answer: answers[dTag] });
    }
  }

  return { errors, warnings, puzzlesToVerify };
}

/**
 * Async verification of puzzle answer hashes.
 * The engine trims answers before hashing (case-sensitive).
 * This catches mismatches between stored answers and answer-hash tags.
 *
 * @param {Array<{dTag, answerHash, salt, answer}>} puzzlesToVerify
 * @returns {Promise<Array<{dTag, message}>>} — additional errors
 */
export async function verifyPuzzleHashes(puzzlesToVerify) {
  const errors = [];
  for (const { dTag, answerHash, salt, answer } of puzzlesToVerify) {
    const trimmed = answer.trim();
    const data = new TextEncoder().encode(trimmed + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hashHex !== answerHash) {
      errors.push({
        dTag,
        message: `Answer hash mismatch — stored answer "${answer}" does not match answer-hash.`,
      });
    }
  }
  return errors;
}
