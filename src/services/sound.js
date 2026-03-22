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
// Known preset aliases for sample libraries
const SAMPLE_PRESETS = {
  dirt: 'github:tidalcycles/Dirt-Samples',
  classic: 'https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json',
};

export async function loadSamples(events) {
  if (!audioReady || !strudelModule) return;

  // 1. Load preset sample libraries from world event ["samples", "<preset-or-url>"]
  for (const [, event] of events) {
    if (getTag(event, 'type') !== 'world') continue;
    for (const tag of getTags(event, 'samples')) {
      const val = tag[1];
      if (!val) continue;
      const url = SAMPLE_PRESETS[val] || val;
      try {
        await strudelModule.samples(url);
        console.log(`Loaded sample library: ${val}`);
      } catch (e) {
        console.warn(`Sample library "${val}" failed:`, e.message || e);
      }
    }
    break;
  }

  // 2. Load custom samples from sound events ["sample", "<name>", "<url>"]
  const sampleMap = {};
  for (const [, event] of events) {
    if (getTag(event, 'type') !== 'sound') continue;
    for (const tag of getTags(event, 'sample')) {
      if (tag[1] && tag[2]) sampleMap[tag[1]] = tag[2];
    }
  }
  if (Object.keys(sampleMap).length > 0) {
    try {
      await strudelModule.samples(sampleMap);
    } catch (e) {
      console.warn('Custom sample loading failed:', e.message || e);
    }
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
 * Play a one-shot sound via superdough (Strudel's low-level synth trigger).
 * Does not interfere with ambient Strudel patterns — fires individual notes
 * directly without going through the pattern evaluator.
 */
export async function playOneShotRef(soundRef, volume = 1.0) {
  if (!audioReady || muted || !soundRef) return;
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    await strudelReady;

    if (!eventsMap) return;
    const soundEvent = eventsMap.get(soundRef);
    if (!soundEvent) return;

    const superdough = window.strudelScope?.superdough;
    if (!superdough) return;

    // Build value object from sound event tags
    const tags = soundEvent.tags || [];
    const get = (name) => tags.find((t) => t[0] === name)?.[1] ?? null;

    const notePattern = get('note');
    const sample = get('sample');
    const noise = tags.some((t) => t[0] === 'noise');
    if (!notePattern && !sample && !noise) return;

    // Base params from tags
    const params = {};
    if (get('oscillator')) params.s = get('oscillator');
    if (get('gain')) params.gain = parseFloat(get('gain')) * volume;
    else params.gain = 0.5 * volume;
    if (get('sustain')) params.sustain = parseFloat(get('sustain'));
    if (get('release')) params.release = parseFloat(get('release'));
    if (get('attack')) params.attack = parseFloat(get('attack'));
    if (get('lpf')) params.lpf = parseFloat(get('lpf'));
    if (get('hpf')) params.hpf = parseFloat(get('hpf'));
    if (get('room')) params.room = parseFloat(get('room'));
    if (get('roomsize')) params.roomsize = parseFloat(get('roomsize'));
    if (get('crush')) params.crush = parseFloat(get('crush'));
    if (get('pan')) params.pan = parseFloat(get('pan'));
    if (get('vowel')) params.vowel = get('vowel');
    if (get('shape')) params.shape = parseFloat(get('shape'));

    const duration = (params.sustain || 0.3) + (params.release || 0.2);
    const now = ctx.currentTime;

    if (sample) {
      // Sample-based one-shot
      await superdough({ ...params, s: sample }, now, duration);
    } else if (noise) {
      await superdough({ ...params, s: 'white' }, now, duration);
    } else {
      // Note-based — play each note in sequence
      const notes = notePattern.trim().split(/\s+/).filter((n) => n !== '~');
      const spacing = duration + 0.05;
      for (let i = 0; i < notes.length; i++) {
        await superdough({ ...params, note: notes[i] }, now + i * spacing, duration);
      }
    }
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
  let bpmPrefix = '';
  for (const tag of soundEvent.tags || []) {
    const name = tag[0];
    const val = tag[1];

    // BPM sets global tempo, prepended before the pattern
    if (name === 'bpm') {
      bpmPrefix = `setbpm(${parseInt(val, 10) || 120})\n`;
      continue;
    }
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
  code = bpmPrefix + code;

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
 * Build Strudel code from raw tag arrays (for builder preview).
 * Takes tags in the same format as event.tags: [["note", "c3"], ["oscillator", "sine"], ...]
 */
export function buildStrudelCodeFromTags(tags) {
  // Wrap tags in a fake event object for buildStrudelCodeFromEvent
  return buildStrudelCodeFromEvent({ tags }, 1.0);
}

/**
 * Preview a sound from builder tags — evaluates and plays.
 * Returns true if playback started.
 */
export async function previewSound(tags, rawCode = null) {
  // Auto-init audio if not ready (preview button counts as user gesture)
  if (!audioReady) {
    const ok = await initAudio();
    if (!ok) return false;
  }
  try {
    const ctx = strudelModule?.getAudioContext?.();
    if (ctx?.state === 'suspended') await ctx.resume();
    await strudelReady;
    const code = rawCode || (tags ? buildStrudelCodeFromTags(tags) : null);
    if (!code) return false;
    await strudelModule.evaluate(code);
    return true;
  } catch (e) {
    console.warn('Sound preview error:', e.message || e);
    return false;
  }
}

/**
 * Stop sound preview.
 */
export function stopPreview() {
  _stopPatterns();
  // Restore ambient layers if any were playing
  if (lastLayers.length > 0) {
    playLayers(lastLayers);
  }
}

/**
 * Decompile Strudel code string back into tag arrays.
 * Extracts known function calls via regex.
 */
export function decompileStrudelCode(code) {
  const tags = [];
  if (!code || typeof code !== 'string') return tags;

  // Source: note("...") or noise()
  const noteMatch = code.match(/note\("([^"]+)"\)/);
  if (noteMatch) tags.push(['note', noteMatch[1]]);

  const noiseMatch = code.match(/\bnoise\(\)/);
  if (noiseMatch && !noteMatch) tags.push(['noise', '']);

  // .s("...") → oscillator
  const oscMatch = code.match(/\.s\("([^"]+)"\)/);
  if (oscMatch) tags.push(['oscillator', oscMatch[1]]);

  // Single-value float methods
  const floatMethods = [
    ['gain', 'gain'], ['slow', 'slow'], ['fast', 'fast'],
    ['pan', 'pan'], ['lpf', 'lpf'], ['hpf', 'hpf'],
    ['room', 'room'], ['roomsize', 'roomsize'],
    ['shape', 'shape'], ['sustain', 'sustain'],
    ['attack', 'attack'], ['release', 'release'],
  ];
  for (const [method, tagName] of floatMethods) {
    const re = new RegExp(`\\.${method}\\(([\\d.]+)\\)`);
    const m = code.match(re);
    if (m) tags.push([tagName, m[1]]);
  }

  // crush (integer)
  const crushMatch = code.match(/\.crush\((\d+)\)/);
  if (crushMatch) tags.push(['crush', crushMatch[1]]);

  // vowel
  const vowelMatch = code.match(/\.vowel\("([^"]+)"\)/);
  if (vowelMatch) tags.push(['vowel', vowelMatch[1]]);

  // arp
  const arpMatch = code.match(/\.arp\("([^"]+)"\)/);
  if (arpMatch) tags.push(['arp', arpMatch[1]]);

  // delay (two values)
  const delayMatch = code.match(/\.delay\(([\d.]+),\s*([\d.]+)\)/);
  if (delayMatch) tags.push(['delay', delayMatch[1], delayMatch[2]]);

  // degradeBy
  const degradeMatch = code.match(/\.degradeBy\(([\d.]+)\)/);
  if (degradeMatch) tags.push(['degrade-by', degradeMatch[1]]);

  // rand (gain with rand.range)
  const randMatch = code.match(/\.gain\(rand\.range\(([\d.]+),\s*([\d.]+)\)\)/);
  if (randMatch) tags.push(['rand', randMatch[1], randMatch[2]]);

  // jux
  const juxMatch = code.match(/\.jux\((\w+)\)/);
  if (juxMatch) tags.push(['jux', juxMatch[1]]);

  // rev (no args)
  if (/\.rev\(\)/.test(code)) tags.push(['rev', '']);

  // palindrome (no args)
  if (/\.palindrome\(\)/.test(code)) tags.push(['palindrome', '']);

  return tags;
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
