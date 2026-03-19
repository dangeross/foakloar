/**
 * sound.js — Sound scoring system using Strudel.
 *
 * Uses @strudel/web's initStrudel() which creates a global repl
 * and registers all pattern functions (note, s, slow, etc.) globally.
 * Patterns play via .play() and stop via hush().
 *
 * Progressive enhancement — errors caught silently.
 */

let audioReady = false;
let muted = false;
let currentBpm = 120;
let strudelReady = null; // promise from initStrudel
let strudelModule = null; // cached @strudel/web module

// Currently playing pattern id
let activePatternId = null;
// Set of effect IDs that have already fired (to detect new ones)
let firedEffects = new Set();

const MUTE_KEY = 'foakloar:sound-muted';

/**
 * Initialize Strudel. Must be called from a user gesture (click).
 */
export async function initAudio() {
  if (audioReady) return true;
  try {
    strudelModule = await import('@strudel/web');
    strudelReady = strudelModule.initStrudel();
    await strudelReady;
    audioReady = true;
    // On first init, start unmuted (user clicked to enable)
    muted = false;
    localStorage.setItem(MUTE_KEY, 'false');
    return true;
  } catch (e) {
    console.warn('Sound init failed:', e);
    return false;
  }
}

export function isAudioReady() { return audioReady; }
export function isMuted() { return muted; }

export function setMuted(val) {
  muted = val;
  localStorage.setItem(MUTE_KEY, String(val));
  if (muted) hush();
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

/**
 * Stop all sound.
 */
export function hush() {
  try {
    strudelModule?.hush();
    // Suspend AudioContext for instant silence
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'running') ctx.suspend();
  } catch { /* ignore */ }
  activePatternId = null;
}

/**
 * Collect and evaluate all sound tags in scope.
 * Builds a single combined pattern from all active layers.
 */
export function evaluateSoundTags(events, currentPlace, playerState, npcStates = {}) {
  if (!audioReady || muted) return;

  // Ensure AudioContext is running (may have been suspended by hush)
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'suspended') ctx.resume();
  } catch { /* ignore */ }

  const placeEvent = events.get(currentPlace);
  if (!placeEvent) return;

  // Collect all sound tags in scope
  const inScope = [];

  // 1. World event (global BPM)
  for (const [, event] of events) {
    if (getTag(event, 'type') === 'world') {
      collectSoundTags(event, aTagOf(event), null, inScope);
      break;
    }
  }

  // 2. Current place
  collectSoundTags(placeEvent, currentPlace, null, inScope);

  // 3. Features in place
  for (const tag of getTags(placeEvent, 'feature')) {
    const ref = tag[1];
    const event = events.get(ref);
    if (!event) continue;
    const state = playerState.states?.[ref] ?? getDefaultState(event);
    if (state === 'hidden') continue;
    collectSoundTags(event, ref, state, inScope);
  }

  // 4. NPCs in place (static)
  for (const tag of getTags(placeEvent, 'npc')) {
    const ref = tag[1];
    const event = events.get(ref);
    if (!event) continue;
    const npcState = npcStates[ref];
    collectSoundTags(event, ref, npcState?.state, inScope);
  }

  // 5. Items in inventory
  for (const ref of playerState.inventory || []) {
    const event = events.get(ref);
    if (!event) continue;
    const state = playerState.states?.[ref];
    collectSoundTags(event, ref, state, inScope);
  }

  // Filter passing layers, handle effects, build a combined pattern ID
  const layers = [];
  const activeEffectIds = new Set();
  for (const { id, role, volume, pattern, stateGate, currentState } of inScope) {
    if (stateGate && currentState !== stateGate) continue;
    if (role === 'bpm') {
      currentBpm = parseInt(volume, 10) || 120;
      continue;
    }
    if (role === 'effect') {
      // One-shot: fire only when newly entering scope
      activeEffectIds.add(id);
      if (!firedEffects.has(id) && pattern) {
        playOneShot(pattern, parseFloat(volume) || 1.0);
        firedEffects.add(id);
      }
      continue;
    }
    if (!pattern) continue;
    layers.push({ id, pattern, volume: parseFloat(volume) || 0.5, role });
  }
  // Clean up effects no longer in scope (so they fire again on re-entry)
  for (const id of firedEffects) {
    if (!activeEffectIds.has(id)) firedEffects.delete(id);
  }

  // Build a combined pattern ID to detect changes
  const newPatternId = layers.map((l) => l.id).sort().join('|');

  // Only restart if layers changed
  if (newPatternId === activePatternId) return;
  activePatternId = newPatternId;

  // Stop current sound
  hush();

  if (layers.length === 0) return;

  // Build and play combined pattern using stack()
  playLayers(layers);
}

// ── Helpers ────────────────────────────────────────────────────────────

function getTag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] ?? null;
}

function getTags(event, name) {
  return (event.tags || []).filter((t) => t[0] === name);
}

function getDefaultState(event) {
  return event.tags?.find((t) => t[0] === 'state')?.[1] ?? null;
}

function aTagOf(event) {
  const d = getTag(event, 'd');
  return d ? `30078:${event.pubkey}:${d}` : '';
}

function collectSoundTags(event, eventRef, currentState, inScope) {
  for (const tag of getTags(event, 'sound')) {
    const role = tag[1];
    const volume = tag[2];
    const pattern = tag[3];
    const stateGate = tag[4];
    const id = `${eventRef}:${role}:${pattern || 'bpm'}:${stateGate || ''}`;
    inScope.push({ id, role, volume, pattern, stateGate, currentState });
  }
}

/**
 * Build Strudel code from layers and play via .play().
 */
async function playLayers(layers) {
  lastLayers = layers;
  try {
    await strudelReady;

    // Build each layer as a Strudel expression, then stack them
    const expressions = layers.map((l) => buildStrudelCode(l.pattern, l.volume)).filter(Boolean);
    if (expressions.length === 0) return;

    const code = expressions.length === 1
      ? expressions[0]
      : `stack(${expressions.join(', ')})`;

    await strudelModule.evaluate(code);
  } catch (e) {
    console.warn('Sound play error:', e.message || e);
  }
}

/**
 * Play a one-shot sound effect (action-triggered).
 * Pattern is evaluated, plays once, then stops.
 */
export async function playOneShot(pattern, volume = 1.0) {
  if (!audioReady || muted || !pattern) return;
  try {
    // Ensure AudioContext is running
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'suspended') await ctx.resume();

    await strudelReady;
    const code = buildStrudelCode(pattern, volume);
    if (!code) return;
    // Play for one cycle then stop — wrap in .firstOf(1, x => x, silence)
    // Simpler: just evaluate and let it play one cycle
    await strudelModule.evaluate(code);
    // Stop after ~2 seconds (one cycle at typical BPM)
    setTimeout(() => {
      try { strudelModule?.hush(); } catch { /* ignore */ }
      // Restart ambient layers if they were playing
      if (activePatternId && lastLayers.length > 0) {
        playLayers(lastLayers);
      }
    }, 2000);
  } catch (e) {
    console.warn('Sound one-shot error:', e.message || e);
  }
}

// Track last active layers for restoring after one-shot
let lastLayers = [];

// Map spec preset names to built-in oscillator types
const SYNTH_MAP = {
  pad: 'sine',
  strings: 'triangle',
  bells: 'sine',
  sine: 'sine',
  triangle: 'triangle',
  square: 'square',
  saw: 'sawtooth',
};

/**
 * Convert spec sound notation to valid Strudel code.
 */
function buildStrudelCode(patternStr, volume) {
  if (!patternStr) return null;

  let clean = patternStr;
  let synth = null;
  let modifier = '';

  // perc(name) → use note with short percussive envelope
  const percMatch = clean.match(/^perc\((\w+)\)(.*)$/);
  if (percMatch) {
    const sample = percMatch[1];
    const rest = percMatch[2].trim();
    // Map perc names to notes with short decay
    const percNote = { bd: 'c1', sd: 'e2', hh: 'g5' }[sample] || 'c2';
    const pattern = rest ? `${percNote} ${rest}` : percNote;
    return `note("${pattern}").sound("square").decay(0.05).sustain(0).gain(${volume})`;
  }

  // slow(name) / fast(name) → synth + speed modifier
  clean = clean.replace(/\bslow\((\w+)\)/g, (_, name) => {
    synth = SYNTH_MAP[name] || name;
    modifier += '.slow(2)';
    return '';
  });
  clean = clean.replace(/\bfast\((\w+)\)/g, (_, name) => {
    synth = SYNTH_MAP[name] || name;
    modifier += '.fast(2)';
    return '';
  });

  clean = clean.trim();
  if (!clean || /^[~\s]+$/.test(clean)) return null;

  let code = `note("${clean}")`;
  if (synth) code += `.sound("${synth}")`;
  code += modifier;
  code += `.gain(${volume})`;

  return code;
}
