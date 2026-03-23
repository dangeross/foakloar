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
// Preview mode — when true, evaluateSoundTags skips ambient playback
let previewActive = false;

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
  previewActive = false;
  _stopPatterns();
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
  // Don't re-evaluate ambient while previewing a sound in the editor
  if (previewActive) return;

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
 * Parse sound event tags into a params object for playback.
 */
function parseSoundEventParams(soundEvent, volume) {
  const tags = soundEvent.tags || [];
  const get = (name) => tags.find((t) => t[0] === name)?.[1] ?? null;

  const notePattern = get('note');
  const sample = get('sample');
  const noise = tags.some((t) => t[0] === 'noise');
  const oscillator = get('oscillator') || get('s');
  if (!notePattern && !sample && !noise && !oscillator) return null;

  const params = {};
  if (oscillator) params.s = oscillator;
  if (get('gain')) params.gain = parseFloat(get('gain')) * volume;
  else params.gain = 0.5 * volume;

  // ADSR
  if (get('sustain')) params.sustain = parseFloat(get('sustain'));
  if (get('release')) params.release = parseFloat(get('release'));
  if (get('attack')) params.attack = parseFloat(get('attack'));
  if (get('decay')) params.decay = parseFloat(get('decay'));

  // Filters
  if (get('lpf')) params.lpf = parseFloat(get('lpf'));
  if (get('hpf')) params.hpf = parseFloat(get('hpf'));
  if (get('bpf')) params.bpf = parseFloat(get('bpf'));
  if (get('bpq')) params.bpq = parseFloat(get('bpq'));
  if (get('lpq')) params.lpq = parseFloat(get('lpq'));
  if (get('hpq')) params.hpq = parseFloat(get('hpq'));
  if (get('ftype')) params.ftype = get('ftype');

  // Filter envelope — LP
  if (get('lpenv')) params.lpenv = parseFloat(get('lpenv'));
  if (get('lpattack')) params.lpattack = parseFloat(get('lpattack'));
  if (get('lpdecay')) params.lpdecay = parseFloat(get('lpdecay'));
  if (get('lpsustain')) params.lpsustain = parseFloat(get('lpsustain'));
  if (get('lprelease')) params.lprelease = parseFloat(get('lprelease'));
  // Filter envelope — HP
  if (get('hpenv')) params.hpenv = parseFloat(get('hpenv'));
  if (get('hpattack')) params.hpattack = parseFloat(get('hpattack'));
  if (get('hpdecay')) params.hpdecay = parseFloat(get('hpdecay'));
  if (get('hpsustain')) params.hpsustain = parseFloat(get('hpsustain'));
  if (get('hprelease')) params.hprelease = parseFloat(get('hprelease'));
  // Filter envelope — BP
  if (get('bpenv')) params.bpenv = parseFloat(get('bpenv'));
  if (get('bpattack')) params.bpattack = parseFloat(get('bpattack'));
  if (get('bpdecay')) params.bpdecay = parseFloat(get('bpdecay'));
  if (get('bpsustain')) params.bpsustain = parseFloat(get('bpsustain'));
  if (get('bprelease')) params.bprelease = parseFloat(get('bprelease'));

  // Pitch envelope
  if (get('penv')) params.penv = parseFloat(get('penv'));
  if (get('pattack')) params.pattack = parseFloat(get('pattack'));
  if (get('pdecay')) params.pdecay = parseFloat(get('pdecay'));
  if (get('prelease')) params.prelease = parseFloat(get('prelease'));
  if (get('pcurve')) params.pcurve = parseFloat(get('pcurve'));
  if (get('panchor')) params.panchor = parseFloat(get('panchor'));

  // FM synthesis
  if (get('fm')) params.fm = parseFloat(get('fm'));
  if (get('fmh')) params.fmh = parseFloat(get('fmh'));
  if (get('fmattack')) params.fmattack = parseFloat(get('fmattack'));
  if (get('fmdecay')) params.fmdecay = parseFloat(get('fmdecay'));
  if (get('fmsustain')) params.fmsustain = parseFloat(get('fmsustain'));
  if (get('fmenv')) params.fmenv = get('fmenv');

  // Vibrato
  if (get('vib')) params.vib = parseFloat(get('vib'));
  if (get('vibmod')) params.vibmod = parseFloat(get('vibmod'));

  // Effects
  if (get('room')) params.room = parseFloat(get('room'));
  if (get('roomsize')) params.roomsize = parseFloat(get('roomsize'));
  if (get('crush')) params.crush = parseFloat(get('crush'));
  if (get('pan')) params.pan = parseFloat(get('pan'));
  if (get('vowel')) params.vowel = get('vowel');
  if (get('shape')) params.shape = parseFloat(get('shape'));
  if (get('delaytime')) params.delaytime = parseFloat(get('delaytime'));
  if (get('delayfeedback')) params.delayfeedback = parseFloat(get('delayfeedback'));
  if (get('phaser')) params.phaser = parseFloat(get('phaser'));
  if (get('phaserdepth')) params.phaserdepth = parseFloat(get('phaserdepth'));
  if (get('phasercenter')) params.phasercenter = parseFloat(get('phasercenter'));
  if (get('phasersweep')) params.phasersweep = parseFloat(get('phasersweep'));

  // Dynamics
  if (get('velocity')) params.velocity = parseFloat(get('velocity'));
  if (get('postgain')) params.postgain = parseFloat(get('postgain'));

  // Sample manipulation
  if (get('n')) params.n = parseFloat(get('n'));
  if (get('begin')) params.begin = parseFloat(get('begin'));
  if (get('end')) params.end = parseFloat(get('end'));
  if (get('speed')) params.speed = parseFloat(get('speed'));
  if (get('cut')) params.cut = parseFloat(get('cut'));
  if (get('loop')) params.loop = parseFloat(get('loop'));
  if (get('loop-begin')) params.loopBegin = parseFloat(get('loop-begin'));
  if (get('loop-end')) params.loopEnd = parseFloat(get('loop-end'));

  // Other
  if (get('orbit')) params.orbit = parseFloat(get('orbit'));
  if (get('dry')) params.dry = parseFloat(get('dry'));

  return { params, notePattern, sample, noise, oscillator };
}

/**
 * Play a one-shot sound via superdough, with Web Audio fallback.
 * superdough fires individual notes/samples without interfering with ambient.
 * Falls back to raw Web Audio API if superdough is unavailable.
 */
export async function playOneShotRef(soundRef, volume = 1.0) {
  if (!audioReady || muted || !soundRef) return;

  if (!eventsMap) return;
  const soundEvent = eventsMap.get(soundRef);
  if (!soundEvent) return;

  const parsed = parseSoundEventParams(soundEvent, volume);
  if (!parsed) return;
  const { params, notePattern, sample, noise, oscillator } = parsed;
  const duration = (params.sustain || 0.3) + (params.release || 0.2);

  // Try superdough first (full Strudel engine — samples, effects, filters)
  const superdough = window.strudelScope?.superdough;
  const getCtx = strudelModule?.getAudioContext || window.strudelScope?.getAudioContext;
  const ctx = getCtx?.();

  if (superdough && ctx) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      if (sample) {
        await superdough({ ...params, s: sample }, now, duration);
      } else if (noise) {
        await superdough({ ...params, s: 'white' }, now, duration);
      } else if (oscillator && !notePattern) {
        // Oscillator-only (e.g. white noise effect) — no note needed
        await superdough({ ...params }, now, duration);
      } else if (notePattern) {
        const notes = notePattern.trim().split(/\s+/).filter((n) => n !== '~');
        const spacing = duration + 0.05;
        for (let i = 0; i < notes.length; i++) {
          await superdough({ ...params, note: notes[i] }, now + i * spacing, duration);
        }
      }
      return; // superdough succeeded
    } catch (e) {
      // Fall through to Web Audio
    }
  }

  // Fallback: raw Web Audio API (oscillator notes only, no samples)
  try {
    const fallbackCtx = ctx || new AudioContext();
    if (fallbackCtx.state === 'suspended') await fallbackCtx.resume();
    const now = fallbackCtx.currentTime;

    if (noise) {
      // Noise burst
      const bufLen = fallbackCtx.sampleRate * duration;
      const buf = fallbackCtx.createBuffer(1, bufLen, fallbackCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        const pos = j / bufLen;
        const cluster = Math.sin(j * 0.02) > 0 ? 1 : 0.2;
        const env = pos < 0.15 ? Math.pow(pos / 0.15, 2) : Math.exp(-(pos - 0.15) * 4);
        data[j] = (Math.random() * 2 - 1) * cluster * env;
      }
      const src = fallbackCtx.createBufferSource();
      src.buffer = buf;
      const gainNode = fallbackCtx.createGain();
      gainNode.gain.value = params.gain || 0.1;
      const lo = fallbackCtx.createBiquadFilter();
      lo.type = 'lowpass';
      lo.frequency.value = params.lpf || 1000;
      const hi = fallbackCtx.createBiquadFilter();
      hi.type = 'highpass';
      hi.frequency.value = params.hpf || 100;
      src.connect(hi); hi.connect(lo); lo.connect(gainNode); gainNode.connect(fallbackCtx.destination);
      src.start(now); src.stop(now + duration + 0.05);
    } else if (notePattern) {
      // Oscillator notes
      const oscType = params.s || 'sine';
      const noteToFreq = (name) => {
        const match = name.match(/^([a-g]#?)(\d)$/i);
        if (!match) return 440;
        const semitones = { c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2,
          'c#': -8, 'd#': -6, 'f#': -3, 'g#': -1, 'a#': 1 };
        const semi = semitones[match[1].toLowerCase()] ?? 0;
        const octave = parseInt(match[2], 10);
        return 440 * Math.pow(2, (semi + (octave - 4) * 12) / 12);
      };
      const notes = notePattern.trim().split(/\s+/).filter((n) => n !== '~');
      const spacing = duration + 0.05;
      for (let i = 0; i < notes.length; i++) {
        const freq = noteToFreq(notes[i]);
        const t = now + i * spacing;
        const osc = fallbackCtx.createOscillator();
        const gainNode = fallbackCtx.createGain();
        osc.type = oscType;
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(params.gain || 0.3, t);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gainNode); gainNode.connect(fallbackCtx.destination);
        osc.start(t); osc.stop(t + duration + 0.05);
      }
    }
  } catch (e) {
    console.warn('Sound one-shot fallback error:', e.message || e);
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
  // Helper: if value contains spaces or mini-notation, quote it; otherwise use raw number
  const num = (v) => isNaN(Number(v)) ? `"${v}"` : parseFloat(v);

  const CHAIN_TAG_MAP = {
    note:         (v) => `.note("${v}")`,
    s:            (v) => `.s("${v}")`,
    oscillator:   (v) => `.s("${v}")`,
    slow:         (v) => `.slow(${num(v)})`,
    fast:         (v) => `.fast(${num(v)})`,
    room:         (v) => `.room(${num(v)})`,
    roomsize:     (v) => `.roomsize(${num(v)})`,
    pan:          (v) => `.pan(${num(v)})`,
    crush:        (v) => `.crush(${num(v)})`,
    shape:        (v) => `.shape(${num(v)})`,
    sustain:      (v) => `.sustain(${num(v)})`,
    attack:       (v) => `.attack(${num(v)})`,
    decay:        (v) => `.decay(${num(v)})`,
    release:      (v) => `.release(${num(v)})`,
    lpf:          (v) => `.lpf(${num(v)})`,
    hpf:          (v) => `.hpf(${num(v)})`,
    vowel:        (v) => `.vowel("${v}")`,
    // Filters (extended)
    bpf:          (v) => `.bpf(${num(v)})`,
    bpq:          (v) => `.bpq(${num(v)})`,
    lpq:          (v) => `.lpq(${num(v)})`,
    hpq:          (v) => `.hpq(${num(v)})`,
    ftype:        (v) => `.ftype("${v}")`,
    // Filter envelope — LP
    lpenv:        (v) => `.lpenv(${num(v)})`,
    lpattack:     (v) => `.lpattack(${num(v)})`,
    lpdecay:      (v) => `.lpdecay(${num(v)})`,
    lpsustain:    (v) => `.lpsustain(${num(v)})`,
    lprelease:    (v) => `.lprelease(${num(v)})`,
    // Filter envelope — HP
    hpenv:        (v) => `.hpenv(${num(v)})`,
    hpattack:     (v) => `.hpattack(${num(v)})`,
    hpdecay:      (v) => `.hpdecay(${num(v)})`,
    hpsustain:    (v) => `.hpsustain(${num(v)})`,
    hprelease:    (v) => `.hprelease(${num(v)})`,
    // Filter envelope — BP
    bpenv:        (v) => `.bpenv(${num(v)})`,
    bpattack:     (v) => `.bpattack(${num(v)})`,
    bpdecay:      (v) => `.bpdecay(${num(v)})`,
    bpsustain:    (v) => `.bpsustain(${num(v)})`,
    bprelease:    (v) => `.bprelease(${num(v)})`,
    fanchor:      (v) => `.fanchor(${num(v)})`,
    // Pitch envelope
    penv:         (v) => `.penv(${num(v)})`,
    pattack:      (v) => `.pattack(${num(v)})`,
    pdecay:       (v) => `.pdecay(${num(v)})`,
    prelease:     (v) => `.prelease(${num(v)})`,
    pcurve:       (v) => `.pcurve(${num(v)})`,
    panchor:      (v) => `.panchor(${num(v)})`,
    // FM synthesis
    fm:           (v) => `.fm(${num(v)})`,
    fmh:          (v) => `.fmh(${num(v)})`,
    fmattack:     (v) => `.fmattack(${num(v)})`,
    fmdecay:      (v) => `.fmdecay(${num(v)})`,
    fmsustain:    (v) => `.fmsustain(${num(v)})`,
    fmenv:        (v) => `.fmenv("${v}")`,
    // Vibrato
    vib:          (v) => `.vib(${num(v)})`,
    vibmod:       (v) => `.vibmod(${num(v)})`,
    // Tremolo
    tremolodepth: (v) => `.tremolodepth(${num(v)})`,
    tremolosync:  (v) => `.tremolosync(${num(v)})`,
    tremoloskew:  (v) => `.tremoloskew(${num(v)})`,
    tremolophase: (v) => `.tremolophase(${num(v)})`,
    tremoloshape: (v) => `.tremoloshape("${v}")`,
    // Distortion (extended)
    distort:      (v) => `.distort(${num(v)})`,
    coarse:       (v) => `.coarse(${num(v)})`,
    // Dynamics
    velocity:     (v) => `.velocity(${num(v)})`,
    postgain:     (v) => `.postgain(${num(v)})`,
    compressor:   (v) => `.compressor(${num(v)})`,
    // Sample manipulation
    n:            (v) => `.n(${num(v)})`,
    begin:        (v) => `.begin(${num(v)})`,
    end:          (v) => `.end(${num(v)})`,
    speed:        (v) => `.speed(${num(v)})`,
    cut:          (v) => `.cut(${num(v)})`,
    loop:         (v) => `.loop(${num(v)})`,
    'loop-begin':    (v) => `.loopBegin(${num(v)})`,
    'loop-end':      (v) => `.loopEnd(${num(v)})`,
    'loop-at':       (v) => `.loopAt(${num(v)})`,
    clip:         (v) => `.clip(${num(v)})`,
    chop:         (v) => `.chop(${num(v)})`,
    striate:      (v) => `.striate(${num(v)})`,
    fit:          (v) => `.fit(${num(v)})`,
    // Effects (extended)
    delaytime:    (v) => `.delaytime(${num(v)})`,
    delayfeedback:(v) => `.delayfeedback(${num(v)})`,
    roomfade:     (v) => `.roomfade(${num(v)})`,
    roomlp:       (v) => `.roomlp(${num(v)})`,
    roomdim:      (v) => `.roomdim(${num(v)})`,
    phaser:       (v) => `.phaser(${num(v)})`,
    phaserdepth:  (v) => `.phaserdepth(${num(v)})`,
    phasercenter: (v) => `.phasercenter(${num(v)})`,
    phasersweep:  (v) => `.phasersweep(${num(v)})`,
    // Other
    orbit:        (v) => `.orbit(${num(v)})`,
    dry:          (v) => `.dry(${num(v)})`,
    xfade:        (v) => `.xfade(${num(v)})`,
    // Pattern (loop only)
    early:        (v) => `.early(${num(v)})`,
    late:         (v) => `.late(${num(v)})`,
    swing:        (v) => `.swing(${num(v)})`,
    iter:         (v) => `.iter(${num(v)})`,
    ply:          (v) => `.ply(${num(v)})`,
    // Existing
    rev:          ()  => `.rev()`,
    palindrome:   ()  => `.palindrome()`,
    jux:          (v) => `.jux(${v})`,  // e.g. jux(rev)
    arp:          (v) => `.arp("${v}")`,
    'degrade-by': (v) => `.degradeBy(${num(v)})`,
  };

  const tags = soundEvent.tags || [];

  // Find the starter tag (first note, noise, or oscillator) regardless of position
  const STARTER_NAMES = new Set(['note', 'noise', 'oscillator', 's']);
  const starterTag = tags.find((t) => STARTER_NAMES.has(t[0]));
  if (!starterTag) return null; // no valid starter

  let code = '';
  if (starterTag[0] === 'note') code = `note("${starterTag[1]}")`;
  else if (starterTag[0] === 's') code = `s("${starterTag[1]}")`;
  else if (starterTag[0] === 'oscillator') code = `s("${starterTag[1]}")`;
  else if (starterTag[0] === 'noise') code = `noise()`;

  let baseGain = null;
  let bpmPrefix = '';
  for (const tag of tags) {
    const name = tag[0];
    const val = tag[1];
    // Skip the starter tag (already processed) and identity tags
    if (tag === starterTag) continue;

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

    const fn = CHAIN_TAG_MAP[name];
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
    // Stop ambient and prevent re-evaluation during preview
    previewActive = true;
    _stopPatterns();
    await strudelModule.evaluate(code);
    return true;
  } catch (e) {
    console.warn('Sound preview error:', e.message || e);
    return false;
  }
}

/**
 * Stop sound preview. Ambient resumes on next evaluateSoundTags call.
 */
export function stopPreview() {
  previewActive = false;
  _stopPatterns();
}

/**
 * Play a one-shot from builder tags (for Effect preview button).
 * Uses superdough directly — doesn't interfere with ambient.
 */
export async function playOneShotFromTags(tags, volume = 1.0) {
  if (!audioReady || muted) return;
  const fakeEvent = { tags: tags.map((t) => [...t]) };
  const parsed = parseSoundEventParams(fakeEvent, volume);
  if (!parsed) return;
  const { params, notePattern, sample, noise, oscillator } = parsed;
  const duration = (params.sustain || 0.3) + (params.release || 0.2);

  const superdough = window.strudelScope?.superdough;
  const getCtx = strudelModule?.getAudioContext || window.strudelScope?.getAudioContext;
  const ctx = getCtx?.();
  if (!superdough || !ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;

  try {
    if (sample) {
      await superdough({ ...params, s: sample }, now, duration);
    } else if (noise) {
      await superdough({ ...params, s: 'white' }, now, duration);
    } else if (oscillator && !notePattern) {
      await superdough({ ...params }, now, duration);
    } else if (notePattern) {
      const notes = notePattern.trim().split(/\s+/).filter((n) => n !== '~');
      const spacing = duration + 0.05;
      for (let i = 0; i < notes.length; i++) {
        await superdough({ ...params, note: notes[i] }, now + i * spacing, duration);
      }
    }
  } catch (e) {
    console.warn('One-shot preview error:', e.message || e);
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

  // s("...") or .s("...") → oscillator (starter or chained)
  const oscStarterMatch = code.match(/^s\("([^"]+)"\)/);
  const oscChainMatch = code.match(/\.s\("([^"]+)"\)/);
  if (oscStarterMatch) tags.push(['oscillator', oscStarterMatch[1]]);
  else if (oscChainMatch) tags.push(['oscillator', oscChainMatch[1]]);

  // Single-value float methods
  const floatMethods = [
    ['gain', 'gain'], ['slow', 'slow'], ['fast', 'fast'],
    ['pan', 'pan'], ['lpf', 'lpf'], ['hpf', 'hpf'],
    ['room', 'room'], ['roomsize', 'roomsize'],
    ['shape', 'shape'], ['sustain', 'sustain'],
    ['attack', 'attack'], ['decay', 'decay'], ['release', 'release'],
    // Filters (extended)
    ['bpf', 'bpf'], ['bpq', 'bpq'], ['lpq', 'lpq'], ['hpq', 'hpq'],
    // Filter envelopes — LP
    ['lpenv', 'lpenv'], ['lpattack', 'lpattack'], ['lpdecay', 'lpdecay'],
    ['lpsustain', 'lpsustain'], ['lprelease', 'lprelease'],
    // Filter envelopes — HP
    ['hpenv', 'hpenv'], ['hpattack', 'hpattack'], ['hpdecay', 'hpdecay'],
    ['hpsustain', 'hpsustain'], ['hprelease', 'hprelease'],
    // Filter envelopes — BP
    ['bpenv', 'bpenv'], ['bpattack', 'bpattack'], ['bpdecay', 'bpdecay'],
    ['bpsustain', 'bpsustain'], ['bprelease', 'bprelease'],
    ['fanchor', 'fanchor'],
    // Pitch envelope
    ['penv', 'penv'], ['pattack', 'pattack'], ['pdecay', 'pdecay'],
    ['prelease', 'prelease'], ['pcurve', 'pcurve'], ['panchor', 'panchor'],
    // FM synthesis
    ['fm', 'fm'], ['fmh', 'fmh'], ['fmattack', 'fmattack'],
    ['fmdecay', 'fmdecay'], ['fmsustain', 'fmsustain'],
    // Vibrato
    ['vib', 'vib'], ['vibmod', 'vibmod'],
    // Tremolo
    ['tremolodepth', 'tremolodepth'], ['tremolosync', 'tremolosync'],
    ['tremoloskew', 'tremoloskew'], ['tremolophase', 'tremolophase'],
    // Distortion (extended)
    ['distort', 'distort'], ['coarse', 'coarse'],
    // Dynamics
    ['velocity', 'velocity'], ['postgain', 'postgain'], ['compressor', 'compressor'],
    // Sample manipulation
    ['n', 'n'], ['begin', 'begin'], ['end', 'end'], ['speed', 'speed'],
    ['cut', 'cut'], ['loop', 'loop'], ['loopBegin', 'loop-begin'], ['loopEnd', 'loop-end'],
    ['loopAt', 'loop-at'], ['clip', 'clip'], ['chop', 'chop'],
    ['striate', 'striate'], ['fit', 'fit'],
    // Effects (extended)
    ['delaytime', 'delaytime'], ['delayfeedback', 'delayfeedback'],
    ['roomfade', 'roomfade'], ['roomlp', 'roomlp'], ['roomdim', 'roomdim'],
    ['phaser', 'phaser'], ['phaserdepth', 'phaserdepth'],
    ['phasercenter', 'phasercenter'], ['phasersweep', 'phasersweep'],
    // Other
    ['orbit', 'orbit'], ['dry', 'dry'], ['xfade', 'xfade'],
    // Pattern
    ['early', 'early'], ['late', 'late'], ['swing', 'swing'],
    ['iter', 'iter'], ['ply', 'ply'],
  ];
  for (const [method, tagName] of floatMethods) {
    // Match both plain numbers .gain(0.5) and quoted mini-notation .lpf("600 250")
    const reQuoted = new RegExp(`\\.${method}\\("([^"]+)"\\)`);
    const rePlain = new RegExp(`\\.${method}\\(([\\d.]+)\\)`);
    const mq = code.match(reQuoted);
    const mp = code.match(rePlain);
    if (mq) tags.push([tagName, mq[1]]);
    else if (mp) tags.push([tagName, mp[1]]);
  }

  // crush (integer)
  const crushMatch = code.match(/\.crush\((\d+)\)/);
  if (crushMatch) tags.push(['crush', crushMatch[1]]);

  // vowel
  const vowelMatch = code.match(/\.vowel\("([^"]+)"\)/);
  if (vowelMatch) tags.push(['vowel', vowelMatch[1]]);

  // String-value methods
  const ftypeMatch = code.match(/\.ftype\("([^"]+)"\)/);
  if (ftypeMatch) tags.push(['ftype', ftypeMatch[1]]);

  const fmenvMatch = code.match(/\.fmenv\("([^"]+)"\)/);
  if (fmenvMatch) tags.push(['fmenv', fmenvMatch[1]]);

  const tremoloshapeMatch = code.match(/\.tremoloshape\("([^"]+)"\)/);
  if (tremoloshapeMatch) tags.push(['tremoloshape', tremoloshapeMatch[1]]);

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
