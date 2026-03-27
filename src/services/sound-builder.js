/**
 * sound-builder.js — Pure functions for building/decompiling Strudel code from event tags.
 *
 * No state, no side effects. Used by sound.js for playback and by the builder for preview/edit.
 */

// ── Helpers ────────────────────────────────────────────────────────────

/** If value is a number, use raw. Otherwise quote as mini-notation string. */
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

const STARTER_NAMES = new Set(['note', 'noise', 'oscillator', 's']);

// ── Build ──────────────────────────────────────────────────────────────

/**
 * Build Strudel code from a sound event's tags.
 * Tags are processed in declaration order to build the Strudel chain.
 */
export function buildStrudelCodeFromEvent(soundEvent, mixVolume) {
  const tags = soundEvent.tags || [];

  // Find the starter tag (first note, noise, or oscillator) regardless of position
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

// ── Parse ──────────────────────────────────────────────────────────────

/**
 * Parse sound event tags into a params object for superdough playback.
 */
export function parseSoundEventParams(soundEvent, volume) {
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

// ── Decompile ──────────────────────────────────────────────────────────

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

  // jux
  const juxMatch = code.match(/\.jux\((\w+)\)/);
  if (juxMatch) tags.push(['jux', juxMatch[1]]);

  // rev (no args)
  if (/\.rev\(\)/.test(code)) tags.push(['rev', '']);

  // palindrome (no args)
  if (/\.palindrome\(\)/.test(code)) tags.push(['palindrome', '']);

  return tags;
}
