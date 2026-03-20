/**
 * POST /api/validate — Validate a NOSTR dungeon world file.
 *
 * Accepts a JSON body with the same shape as world files:
 *   { events: [...], answers?: {...}, externalRefs?: [...] }
 *
 * Returns structured validation results with actionable fix suggestions.
 *
 * Works as:
 *   - Vercel serverless function (default export)
 *   - Cloudflare Pages function (onRequestPost)
 *   - Any framework that calls handler(req, res)
 */

import { validateEvent } from '../src/builder/eventBuilder.js';
import { validateWorld, verifyPuzzleHashes, extractDTagFromRef } from '../src/builder/validateWorld.js';

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ── JSON with comments parser ────────────────────────────────────────────────

function stripJsonComments(raw) {
  const lines = raw.split('\n');
  const cleanLines = [];
  for (const line of lines) {
    let inStr = false;
    let result = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && (i === 0 || line[i - 1] !== '\\')) inStr = !inStr;
      if (!inStr && c === '/' && i + 1 < line.length && line[i + 1] === '/') break;
      result += c;
    }
    cleanLines.push(result);
  }
  let cleaned = cleanLines.join('\n');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned;
}

function parseLenient(raw) {
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(stripJsonComments(raw));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

/**
 * Check if a dangling ref is covered by the externalRefs list.
 * Matches against d-tags extracted from the issue message.
 */
function isExternalRef(issue, externalDTags) {
  if (issue.category !== 'dangling-ref' || externalDTags.size === 0) return false;
  // Extract the referenced d-tag from the message
  const match = issue.message.match(/references "([^"]+)" which is not in this world/);
  if (!match) return false;
  return externalDTags.has(match[1]);
}

// ── Core validation logic ────────────────────────────────────────────────────

async function validate(data) {
  const events = data.events || [];
  const answers = data.answers || {};
  const externalRefs = data.externalRefs || [];

  if (!Array.isArray(events) || events.length === 0) {
    return {
      valid: false,
      eventCount: 0,
      summary: { errors: 1, warnings: 0 },
      issues: [{
        level: 'error',
        category: 'parse-error',
        message: 'No events found. Expected { "events": [...] }',
        fix: 'Provide an array of event objects in the "events" field. Each event needs { kind: 30078, tags: [...], content: "..." }.',
      }],
    };
  }

  // Build external refs lookup — accept both d-tags and full a-tag refs
  const externalDTags = new Set();
  for (const ref of externalRefs) {
    const dTag = extractDTagFromRef(ref);
    externalDTags.add(dTag || ref); // if it's already a d-tag, use as-is
  }

  const issues = [];

  // Build d-tag → event index
  const eventByDTag = new Map();
  for (const ev of events) {
    const dTag = getTagValue(ev, 'd');
    if (dTag) eventByDTag.set(dTag, ev);
  }

  // ── Per-event validation ────────────────────────────────────────────────
  for (const event of events) {
    const dTag = getTagValue(event, 'd') || '?';
    const eventType = getTagValue(event, 'type');
    const { errors, warnings } = validateEvent(event);

    for (const issue of errors) {
      issues.push({ level: 'error', dTag, eventType, ...issue });
    }
    for (const issue of warnings) {
      issues.push({ level: 'warning', dTag, eventType, ...issue });
    }
  }

  // ── Cross-event validation ──────────────────────────────────────────────
  const { errors: crossErrors, warnings: crossWarnings, puzzlesToVerify } = validateWorld(events, answers);

  for (const issue of crossErrors) {
    // Skip errors for declared external refs
    if (isExternalRef(issue, externalDTags)) continue;
    const event = eventByDTag.get(issue.dTag);
    issues.push({
      level: 'error',
      eventType: event ? getTagValue(event, 'type') : null,
      ...issue,
    });
  }

  for (const issue of crossWarnings) {
    // Skip warnings for declared external refs entirely
    if (isExternalRef(issue, externalDTags)) continue;
    const event = eventByDTag.get(issue.dTag);
    issues.push({
      level: 'warning',
      eventType: event ? getTagValue(event, 'type') : null,
      ...issue,
    });
  }

  // ── Puzzle hash verification ────────────────────────────────────────────
  const hashErrors = await verifyPuzzleHashes(puzzlesToVerify || []);
  for (const issue of hashErrors) {
    const event = eventByDTag.get(issue.dTag);
    issues.push({
      level: 'error',
      eventType: event ? getTagValue(event, 'type') : null,
      ...issue,
    });
  }

  // ── Clean and return ────────────────────────────────────────────────────
  const cleanIssues = issues.map((i) => {
    const obj = { ...i };
    if (!obj.tag) delete obj.tag;
    if (!obj.fix) delete obj.fix;
    if (!obj.eventType) delete obj.eventType;
    return obj;
  });

  const errorCount = cleanIssues.filter((i) => i.level === 'error').length;
  const warnCount = cleanIssues.filter((i) => i.level === 'warning').length;

  return {
    valid: errorCount === 0,
    eventCount: events.length,
    externalRefs: externalRefs.length > 0 ? externalRefs.length : undefined,
    summary: { errors: errorCount, warnings: warnCount },
    issues: cleanIssues,
  };
}

// ── Read raw body (bypass Vercel's auto-JSON-parse for commented JSON) ───────

async function readRawBody(req) {
  // Vercel with bodyParser:false — try req.body first
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf-8');
  if (typeof req.body === 'string' && req.body.length > 0) return req.body;
  if (req.body && typeof req.body === 'object' && req.body.events) return req.body;
  // Read from stream (Vercel serverless uses Node IncomingMessage)
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) throw new Error('Empty request body');
  return Buffer.concat(chunks).toString('utf-8');
}

// Disable Vercel's body parser — we handle JSON with comments ourselves.
export const config = { api: { bodyParser: false } };

// ── Vercel handler (default export) ──────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  try {
    const body = await readRawBody(req);
    const data = parseLenient(body);
    const result = await validate(data);

    res.writeHead(result.valid ? 200 : 422, {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(result));
  } catch (e) {
    const bodyType = req.body === undefined ? 'undefined'
      : req.body === null ? 'null'
      : Buffer.isBuffer(req.body) ? `Buffer(${req.body.length})`
      : typeof req.body === 'string' ? `string(${req.body.length})`
      : typeof req.body;
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      valid: false,
      summary: { errors: 1, warnings: 0 },
      issues: [{
        level: 'error',
        category: 'parse-error',
        message: `Failed to parse request body: ${e.message} [bodyType=${bodyType}]`,
        fix: 'Send a valid JSON object with an "events" array. Comments (//) and trailing commas are allowed.',
      }],
    }));
  }
}

// ── Web-standard Request/Response (Cloudflare Pages, Deno, Bun) ──────────────

export async function onRequestPost({ request }) {
  try {
    const raw = await request.text();
    const data = parseLenient(raw);
    const result = await validate(data);

    return new Response(JSON.stringify(result), {
      status: result.valid ? 200 : 422,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      valid: false,
      summary: { errors: 1, warnings: 0 },
      issues: [{
        level: 'error',
        category: 'parse-error',
        message: `Failed to parse request body: ${e.message}`,
        fix: 'Send a valid JSON object with an "events" array.',
      }],
    }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { validate, parseLenient };
