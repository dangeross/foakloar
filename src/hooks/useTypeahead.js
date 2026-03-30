/**
 * useTypeahead.js — Ghost-text autocomplete for the command input.
 *
 * Returns { ghost, accept } where:
 *   ghost  — the suffix string to render greyed after the typed text
 *   accept — the full value to write into the input on Tab / → press
 *
 * Returns null when there is no completion.
 *
 * Completion rules:
 *   - One token typed  → complete verb alias or visible exit direction
 *   - Verb complete + space → complete noun (in-scope entities + inventory)
 *   - Only the single best (shortest) match is surfaced; if multiple candidates
 *     share the same prefix the ghost is empty until input disambiguates.
 */

import { useMemo } from 'react';
import { buildVerbMap, stripArticles } from '../engine/parser.js';
import { getTag, getTags } from '../engine/world.js';

// Static built-in verb aliases the engine always recognises.
const BUILT_IN_VERBS = [
  'look', 'l',
  'examine', 'x', 'inspect',
  'inventory', 'i',
  'take', 'get', 'grab', 'pick up',
  'drop',
  'attack',
  'talk', 'speak',
  'quests', 'q',
  'help', 'h',
  'yes', 'no',
  'restart',
];

/**
 * Collect all noun strings for an event (noun tags + title, lowercased).
 */
function eventNouns(event) {
  const nouns = [];
  const title = getTag(event, 'title');
  if (title) nouns.push(title.toLowerCase());
  for (const nt of getTags(event, 'noun')) {
    for (let i = 1; i < nt.length; i++) {
      if (nt[i]) nouns.push(nt[i].toLowerCase());
    }
  }
  return nouns;
}

/**
 * Given sorted candidates and a fragment, return the single best completion
 * suffix, or null if 0 or 2+ candidates share the same next character.
 */
function bestSuffix(candidates, fragment) {
  const matches = candidates.filter(
    (c) => c.startsWith(fragment) && c.length > fragment.length,
  );
  if (matches.length === 0) return null;
  // If all matches share the same next character, we can show the ghost up to
  // the point where they diverge — but for simplicity just show the shortest.
  const best = matches[0]; // already sorted shortest-first
  // If more than one match and they diverge immediately, show nothing.
  if (matches.length > 1 && matches[1][fragment.length] !== best[fragment.length]) {
    return null;
  }
  return best;
}

/**
 * Core suggestion logic (pure, no React).
 */
export function computeSuggestion(rawInput, engine, events) {
  if (!engine || !rawInput) return null;

  // Work in lowercase for matching; we'll reconstruct the display from rawInput.
  const lower = rawInput.toLowerCase();

  // Split on first run of spaces to get [verbPart, ...rest]
  const spaceIdx = lower.search(/\s/);
  const hasSpace = spaceIdx !== -1;
  const verbPart = hasSpace ? lower.slice(0, spaceIdx) : lower;
  const afterVerb = hasSpace ? rawInput.slice(spaceIdx + 1) : '';
  const afterVerbLower = afterVerb.toLowerCase();

  // Build verb candidate pool: built-ins + data-driven aliases for this room.
  const placeEvent = events?.get(engine.currentPlace);
  const verbMap = buildVerbMap(
    events || new Map(),
    placeEvent,
    engine.player?.state?.inventory || [],
    engine._getRoamingNpcList?.()?.map(({ event }) => event) || [],
  );
  const verbCandidates = [
    ...new Set([...BUILT_IN_VERBS, ...verbMap.keys()]),
  ].sort((a, b) => a.length - b.length);

  // Visible exit directions for this room.
  let directionCandidates = [];
  try {
    const { exits } = engine._resolveRoomExits(engine.currentPlace);
    directionCandidates = exits.map((e) => e.slot).filter(Boolean);
  } catch (_) { /* engine not ready */ }

  // ── Phase 1: completing the first token (verb or direction) ──────────────
  if (!hasSpace) {
    const allFirst = [...directionCandidates, ...verbCandidates];
    const best = bestSuffix(allFirst, verbPart);
    if (!best) return null;
    const ghost = best.slice(verbPart.length);
    return { ghost, accept: rawInput + ghost };
  }

  // ── Phase 2: verb is complete, completing the noun ───────────────────────
  // The verb token must resolve to a known verb or direction.
  const isKnownVerb = verbCandidates.includes(verbPart);
  const isDirection = directionCandidates.includes(verbPart);
  if (!isKnownVerb && !isDirection) return null;

  // Strip articles from what the player has typed for the noun so far.
  const nounFragment = stripArticles(afterVerbLower);

  // Collect in-scope nouns: current room entities + ground items + inventory.
  const nouns = [];
  if (placeEvent) {
    for (const type of ['feature', 'item', 'npc', 'portal']) {
      for (const ref of getTags(placeEvent, type)) {
        const ev = events?.get(ref[1]);
        if (ev) nouns.push(...eventNouns(ev));
      }
    }
  }
  // Items on the ground at this place (tracked in player state, not place tags)
  const placeItems = engine.player?.getPlaceItems?.(engine.currentPlace) || [];
  for (const dtag of placeItems) {
    const ev = events?.get(dtag);
    if (ev) nouns.push(...eventNouns(ev));
  }
  for (const dtag of engine.player?.state?.inventory || []) {
    const ev = events?.get(dtag);
    if (ev) nouns.push(...eventNouns(ev));
  }

  const nounCandidates = [...new Set(nouns)].sort((a, b) => a.length - b.length);
  const best = bestSuffix(nounCandidates, nounFragment);
  if (!best) return null;

  const ghost = best.slice(nounFragment.length);
  // Reconstruct: preserve the user's original verb casing + spacing.
  return { ghost, accept: rawInput + ghost };
}

/**
 * React hook — memoised on inputValue + engine identity + events ref.
 */
export function useTypeahead(inputValue, engine, events) {
  return useMemo(
    () => computeSuggestion(inputValue, engine, events),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputValue, engine?.currentPlace, engine?.player?.state?.inventory, events],
  );
}
