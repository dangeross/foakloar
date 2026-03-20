#!/usr/bin/env node
/**
 * validate-world.mjs — CLI tool for validating NOSTR dungeon world files.
 *
 * Runs both per-event validation (tag shapes, required fields) and
 * cross-event validation (dangling refs, puzzle types, verb collisions).
 *
 * Usage:
 *   node tools/validate-world.mjs <world-file.json>
 *   node tools/validate-world.mjs <patch-file.json> --base <existing-world.json>
 *   node tools/validate-world.mjs <world-file.json> --json
 *
 * Options:
 *   --base <file>    Provide an existing world for context. Events from the base
 *                    are used for cross-validation but issues are only reported
 *                    for the input file's events.
 *   --json           Output structured JSON instead of human-readable text.
 *   --errors-only    Only show errors, not warnings.
 *
 * External refs:
 *   Add "externalRefs" to the JSON file to declare d-tags that exist outside
 *   this file (e.g. in an existing world). Dangling refs matching these are
 *   silently skipped instead of being reported as warnings.
 *
 *   { "events": [...], "externalRefs": ["world:npc:guard", "world:place:town"] }
 */

import { readFileSync } from 'fs';
import { validateEvent } from '../src/builder/eventBuilder.js';
import { validateWorld, verifyPuzzleHashes, extractDTagFromRef } from '../src/builder/validateWorld.js';

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

function parseWorldFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = stripJsonComments(raw);
    return JSON.parse(cleaned);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTagValue(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

function getDTag(event) {
  return getTagValue(event, 'd') || '?';
}

function getEventType(event) {
  return getTagValue(event, 'type');
}

/**
 * Check if a dangling ref issue references a declared external d-tag.
 */
function isExternalRef(issue, externalDTags) {
  if (issue.category !== 'dangling-ref' || externalDTags.size === 0) return false;
  const match = issue.message.match(/references "([^"]+)" which is not in this world/);
  if (!match) return false;
  return externalDTags.has(match[1]);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  json: args.includes('--json'),
  errorsOnly: args.includes('--errors-only'),
  base: null,
};

const baseIdx = args.indexOf('--base');
if (baseIdx !== -1 && args[baseIdx + 1]) {
  flags.base = args[baseIdx + 1];
}

const inputFile = args.find((a) => !a.startsWith('--') && a !== flags.base);

if (!inputFile) {
  console.error('Usage: node tools/validate-world.mjs <world-file.json> [--base <file>] [--json] [--errors-only]');
  process.exit(1);
}

// ── Load files ───────────────────────────────────────────────────────────────

let data;
try {
  data = parseWorldFile(inputFile);
} catch (e) {
  console.error(`Failed to parse ${inputFile}: ${e.message}`);
  process.exit(1);
}

const events = data.events || [];
const answers = data.answers || {};
const externalRefs = data.externalRefs || [];

if (events.length === 0) {
  console.error('No events found in input file. Expected { "events": [...] }');
  process.exit(1);
}

// Build external refs lookup — accept both d-tags and full a-tag refs
const externalDTags = new Set();
for (const ref of externalRefs) {
  const dTag = extractDTagFromRef(ref);
  externalDTags.add(dTag || ref);
}

// Build d-tag → event index
const eventByDTag = new Map();
for (const ev of events) {
  const dTag = getDTag(ev);
  if (dTag !== '?') eventByDTag.set(dTag, ev);
}

// Load base world if provided
let baseEvents = [];
if (flags.base) {
  try {
    const baseData = parseWorldFile(flags.base);
    baseEvents = baseData.events || [];
    // Add base event d-tags to external set so their refs don't warn
    for (const ev of baseEvents) {
      const dTag = getDTag(ev);
      if (dTag !== '?') externalDTags.add(dTag);
    }
  } catch (e) {
    console.error(`Failed to parse base file ${flags.base}: ${e.message}`);
    process.exit(1);
  }
}

// ── Run per-event validation ─────────────────────────────────────────────────

const issues = [];

for (const event of events) {
  const dTag = getDTag(event);
  const eventType = getEventType(event);
  const { errors, warnings } = validateEvent(event);

  for (const issue of errors) {
    issues.push({ level: 'error', dTag, eventType, ...issue });
  }
  for (const issue of warnings) {
    issues.push({ level: 'warning', dTag, eventType, ...issue });
  }
}

// ── Run cross-event validation ───────────────────────────────────────────────

// Merge base events for cross-validation context
const allEvents = flags.base ? [...baseEvents, ...events] : events;
const { errors: crossErrors, warnings: crossWarnings, puzzlesToVerify } = validateWorld(allEvents, answers);

// Only report issues from input events (not base events)
const inputDTags = new Set();
for (const ev of events) {
  const dTag = getDTag(ev);
  if (dTag !== '?') inputDTags.add(dTag);
}

for (const issue of crossErrors) {
  if (flags.base && !inputDTags.has(issue.dTag)) continue;
  if (isExternalRef(issue, externalDTags)) continue;
  const event = eventByDTag.get(issue.dTag);
  issues.push({
    level: 'error',
    eventType: event ? getEventType(event) : null,
    ...issue,
  });
}

for (const issue of crossWarnings) {
  if (flags.base && !inputDTags.has(issue.dTag)) continue;
  if (isExternalRef(issue, externalDTags)) continue;
  const event = eventByDTag.get(issue.dTag);
  issues.push({
    level: 'warning',
    eventType: event ? getEventType(event) : null,
    ...issue,
  });
}

// ── Async: verify puzzle hashes ──────────────────────────────────────────────

const hashErrors = await verifyPuzzleHashes(puzzlesToVerify || []);
for (const issue of hashErrors) {
  if (flags.base && !inputDTags.has(issue.dTag)) continue;
  const event = eventByDTag.get(issue.dTag);
  issues.push({
    level: 'error',
    eventType: event ? getEventType(event) : null,
    ...issue,
  });
}

// ── Filter ───────────────────────────────────────────────────────────────────

const filtered = flags.errorsOnly ? issues.filter((i) => i.level === 'error') : issues;

// ── Output ───────────────────────────────────────────────────────────────────

const errorCount = filtered.filter((i) => i.level === 'error').length;
const warnCount = filtered.filter((i) => i.level === 'warning').length;

if (flags.json) {
  const cleanIssues = filtered.map((i) => {
    const obj = { ...i };
    if (!obj.tag) delete obj.tag;
    if (!obj.fix) delete obj.fix;
    if (!obj.eventType) delete obj.eventType;
    return obj;
  });

  const output = {
    valid: errorCount === 0,
    file: inputFile,
    eventCount: events.length,
    ...(externalDTags.size > 0 ? { externalRefs: externalDTags.size } : {}),
    summary: { errors: errorCount, warnings: warnCount },
    issues: cleanIssues,
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`\n  Validating: ${inputFile}`);
  console.log(`  Events: ${events.length}`);
  if (flags.base) console.log(`  Base world: ${flags.base} (${baseEvents.length} events)`);
  if (externalDTags.size > 0) console.log(`  External refs: ${externalDTags.size} declared`);
  console.log();

  if (filtered.length === 0) {
    console.log('  ✓ No issues found.\n');
  } else {
    const byDTag = new Map();
    for (const issue of filtered) {
      if (!byDTag.has(issue.dTag)) byDTag.set(issue.dTag, []);
      byDTag.get(issue.dTag).push(issue);
    }

    for (const [dTag, tagIssues] of byDTag) {
      const type = tagIssues[0].eventType;
      console.log(`  ${dTag}${type ? ` [${type}]` : ''}`);
      for (const issue of tagIssues) {
        const icon = issue.level === 'error' ? '✗' : '!';
        console.log(`    ${icon} [${issue.level}] ${issue.message}`);
        if (issue.tag) console.log(`      tag: ${issue.tag}`);
        if (issue.fix) console.log(`      fix: ${issue.fix}`);
      }
      console.log();
    }

    console.log(`  Summary: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`);
  }
  console.log();
}

process.exit(errorCount > 0 ? 1 : 0);
