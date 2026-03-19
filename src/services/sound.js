/**
 * sound.js — Sound scoring system using Strudel.
 *
 * Sound tags reference `type: sound` events by a-tag. The client resolves
 * the sound event, reads its tags (note, oscillator, slow, fast, room,
 * delay, pan, crush), and builds a Strudel chain.
 *
 * Uses @strudel/web's initStrudel() for WebAudio synthesis.
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
// First evaluation flag — suppress effect one-shots on initial load
let firstEval = true;
// Track last active layers for restoring after one-shot
let lastLayers = [];
// Reference to events map (set on each evaluateSoundTags call)
let eventsMap = null;

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
    // Expose evaluate for dev testing
    if (import.meta.env.DEV) window.__strudelEval = strudelModule.evaluate;
    audioReady = true;
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

/**
 * Load all samples from sound events on world init.
 * Collects sample tags, dedupes by name, calls Strudel's samples().
 */
export async function loadSamples(events) {
  if (!audioReady || !strudelModule) return;
  const sampleMap = {};
  for (const [, event] of events) {
    if (getTag(event, 'type') !== 'sound') continue;
    for (const tag of getTags(event, 'sample')) {
      if (tag[1] && tag[2]) sampleMap[tag[1]] = tag[2];
    }
  }
  if (Object.keys(sampleMap).length === 0) return;
  try {
    await strudelModule.samples(sampleMap);
  } catch (e) {
    console.warn('Sample loading failed:', e.message || e);
  }
}

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
 * Stop all sound and suspend audio (for mute).
 */
export function hush() {
  _stopPatterns();
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'running') ctx.suspend();
  } catch { /* ignore */ }
}

/**
 * Stop current patterns without suspending AudioContext.
 * Used internally when switching layers.
 */
function _stopPatterns() {
  try { strudelModule?.hush(); } catch { /* ignore */ }
  activePatternId = null;
}

/**
 * Collect and evaluate all sound tags in scope.
 * Sound tags now reference `type: sound` events by a-tag.
 */
export function evaluateSoundTags(events, currentPlace, playerState, npcStates = {}) {
  if (!audioReady || muted) return;
  eventsMap = events;

  // Ensure AudioContext is running
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'suspended') ctx.resume();
  } catch { /* ignore */ }

  const placeEvent = events.get(currentPlace);
  if (!placeEvent) return;

  // Collect all sound tags + bpm in scope
  const inScope = [];

  // 1. World event (global BPM)
  for (const [, event] of events) {
    if (getTag(event, 'type') === 'world') {
      collectBpm(event);
      collectSoundTags(event, aTagOf(event), null, inScope);
      break;
    }
  }

  // 2. Current place (bpm override + sound tags)
  collectBpm(placeEvent);
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

  // 5. Clues in place (effect sounds on reveal)
  for (const tag of getTags(placeEvent, 'clue')) {
    const ref = tag[1];
    const event = events.get(ref);
    if (!event) continue;
    // Clue is "in scope" if it's been seen
    const seen = playerState.cluesSeen?.[ref];
    if (seen) collectSoundTags(event, ref, null, inScope);
  }

  // 6. Puzzles in place
  for (const tag of getTags(placeEvent, 'puzzle')) {
    const ref = tag[1];
    const event = events.get(ref);
    if (!event) continue;
    const solved = playerState.puzzlesSolved?.includes?.(ref);
    collectSoundTags(event, ref, solved ? 'solved' : 'unsolved', inScope);
  }

  // 7. Items in inventory
  for (const ref of playerState.inventory || []) {
    const event = events.get(ref);
    if (!event) continue;
    const state = playerState.states?.[ref];
    collectSoundTags(event, ref, state, inScope);
  }

  // Filter passing layers, handle effects
  const layers = [];
  const activeEffectIds = new Set();
  for (const { id, role, volume, soundRef, stateGate, currentState } of inScope) {
    if (stateGate && currentState !== stateGate) continue;
    if (role === 'effect') {
      activeEffectIds.add(id);
      if (!firedEffects.has(id) && soundRef) {
        // Suppress one-shots on first evaluation (page load)
        if (!firstEval) {
          playOneShotRef(soundRef, parseFloat(volume) || 1.0);
        }
        firedEffects.add(id);
      }
      continue;
    }
    if (!soundRef) continue;
    layers.push({ id, soundRef, volume: parseFloat(volume) || 0.5, role });
  }
  // Clean up effects no longer in scope
  for (const id of firedEffects) {
    if (!activeEffectIds.has(id)) firedEffects.delete(id);
  }

  // Build a combined pattern ID to detect changes
  const newPatternId = layers.map((l) => l.id).sort().join('|');

  if (newPatternId === activePatternId) return;
  activePatternId = newPatternId;

  firstEval = false;

  // Stop current patterns then immediately start new stack
  _stopPatterns();

  if (layers.length === 0) return;

  playLayers(layers);
}

/**
 * Play a one-shot sound by sound event ref (action-triggered).
 */
export async function playOneShotRef(soundRef, volume = 1.0) {
  if (!audioReady || muted || !soundRef) return;
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'suspended') await ctx.resume();
    await strudelReady;

    const code = buildStrudelCodeFromRef(soundRef, volume);
    if (!code) return;

    await strudelModule.evaluate(code);
    setTimeout(() => {
      _stopPatterns();
      if (lastLayers.length > 0) {
        playLayers(lastLayers);
      }
    }, 2000);
  } catch (e) {
    console.warn('Sound one-shot error:', e.message || e);
  }
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

function collectBpm(event) {
  const bpm = getTag(event, 'bpm');
  if (bpm) currentBpm = parseInt(bpm, 10) || 120;
}

/**
 * Collect sound tags from an event.
 * New shape: ["sound", "<sound-a-tag>", "<role>", "<volume>", "<state?>"]
 */
function collectSoundTags(event, eventRef, currentState, inScope) {
  for (const tag of getTags(event, 'sound')) {
    const soundRef = tag[1];  // a-tag ref to type:sound event
    // Skip old-format sound tags (role in position 1 instead of a-tag ref)
    if (!soundRef || !soundRef.startsWith('30078:')) continue;
    const role = tag[2];      // ambient, layer, effect
    const volume = tag[3];    // 0.0-1.0
    const stateGate = tag[4]; // optional state gate
    const id = `${eventRef}:${role}:${soundRef}:${stateGate || ''}`;
    inScope.push({ id, role, volume, soundRef, stateGate, currentState });
  }
}

/**
 * Build Strudel code from a `type: sound` event's tags.
 * Tags are applied in declaration order to build the chain.
 */
function buildStrudelCodeFromRef(soundRef, volume) {
  if (!eventsMap) return null;
  const soundEvent = eventsMap.get(soundRef);
  if (!soundEvent) return null;
  return buildStrudelCodeFromEvent(soundEvent, volume);
}

/**
 * Build Strudel code from a sound event's tags.
 * Tags are processed in declaration order to build the Strudel chain.
 */
function buildStrudelCodeFromEvent(soundEvent, mixVolume) {
  // Tags that take a single value
  const SINGLE_TAG_MAP = {
    note:         (v) => `note("${v}")`,
    oscillator:   (v) => `.s("${v}")`,
    noise:        ()  => `noise()`,
    slow:         (v) => `.slow(${parseFloat(v)})`,
    fast:         (v) => `.fast(${parseFloat(v)})`,
    room:         (v) => `.room(${parseFloat(v)})`,
    roomsize:     (v) => `.roomsize(${parseFloat(v)})`,
    pan:          (v) => `.pan(${parseFloat(v)})`,
    crush:        (v) => `.crush(${parseInt(v, 10)})`,
    shape:        (v) => `.shape(${parseFloat(v)})`,
    sustain:      (v) => `.sustain(${parseFloat(v)})`,
    attack:       (v) => `.attack(${parseFloat(v)})`,
    release:      (v) => `.release(${parseFloat(v)})`,
    lpf:          (v) => `.lpf(${parseFloat(v)})`,
    hpf:          (v) => `.hpf(${parseFloat(v)})`,
    vowel:        (v) => `.vowel("${v}")`,
    rev:          ()  => `.rev()`,
    palindrome:   ()  => `.palindrome()`,
    jux:          (v) => `.jux(${v})`,  // e.g. jux(rev)
    arp:          (v) => `.arp("${v}")`,
    'degrade-by': (v) => `.degradeBy(${parseFloat(v)})`,
  };

  let code = '';
  let baseGain = null;
  for (const tag of soundEvent.tags || []) {
    const name = tag[0];
    const val = tag[1];

    // Handle special multi-value tags
    if (name === 'delay') {
      const time = parseFloat(val) || 0.5;
      const feedback = parseFloat(tag[2]) || 0.3;
      code += `.delay(${time}, ${feedback})`;
      continue;
    }
    if (name === 'rand') {
      const min = parseFloat(val) || 0;
      const max = parseFloat(tag[2]) || 1;
      code += `.gain(rand.range(${min}, ${max}))`;
      continue;
    }
    if (name === 'gain') {
      baseGain = parseFloat(val) || 1.0;
      continue;  // Applied at the end with mixVolume
    }

    const fn = SINGLE_TAG_MAP[name];
    if (fn) {
      code += fn(val || '');
    }
  }

  if (!code) return null;

  // Gain = sound event's base gain × referencing tag's mix volume
  const finalGain = (baseGain ?? 1.0) * (mixVolume ?? 1.0);
  // Only add .gain() if rand isn't already controlling gain
  if (!code.includes('rand.range')) {
    code += `.gain(${finalGain})`;
  } else {
    // Scale the rand range by finalGain — already in the code, adjust via multiply
    // For simplicity, append a secondary gain
    code += `.gain(${finalGain})`;
  }

  return code;
}

/**
 * Build and play combined pattern using stack().
 */
async function playLayers(layers) {
  lastLayers = layers;
  try {
    await strudelReady;

    const expressions = layers
      .map((l) => buildStrudelCodeFromRef(l.soundRef, l.volume))
      .filter(Boolean);
    if (expressions.length === 0) return;

    const code = expressions.length === 1
      ? expressions[0]
      : `stack(${expressions.join(', ')})`;

    await strudelModule.evaluate(code);
  } catch (e) {
    console.warn('Sound play error:', e.message || e);
  }
}
