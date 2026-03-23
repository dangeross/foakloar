/**
 * Theme system — resolves colours, effects, font, and cursor from world event tags.
 * Built-in presets provide defaults; individual tags override specific values.
 */

import { getTag, getTags } from '../engine/world.js';

const PRESETS = {
  'terminal-green': {
    bg:        '#000000',
    text:      '#00ff41',
    title:     '#a7f3d0',
    dim:       '#16a34a',
    highlight: '#ffffff',
    error:     '#f87171',
    item:      '#facc15',
    npc:       '#fbbf24',
    clue:      '#22d3ee',
    puzzle:    '#c084fc',
    exits:     '#16a34a',
  },
  'parchment': {
    bg:        '#f5e6c8',
    text:      '#3d2b1f',
    title:     '#1a0f00',
    dim:       '#8b7355',
    highlight: '#000000',
    error:     '#8b0000',
    item:      '#b8860b',
    npc:       '#556b2f',
    clue:      '#2f4f4f',
    puzzle:    '#4b0082',
    exits:     '#8b7355',
  },
  'void-blue': {
    bg:        '#000814',
    text:      '#00b4d8',
    title:     '#90e0ef',
    dim:       '#0077b6',
    highlight: '#caf0f8',
    error:     '#e63946',
    item:      '#ffd166',
    npc:       '#06d6a0',
    clue:      '#a8dadc',
    puzzle:    '#e0aaff',
    exits:     '#0077b6',
  },
  'blood-red': {
    bg:        '#0a0000',
    text:      '#ff2020',
    title:     '#ff6666',
    dim:       '#8b0000',
    highlight: '#ffffff',
    error:     '#ff0000',
    item:      '#ff8c00',
    npc:       '#cd853f',
    clue:      '#b0c4de',
    puzzle:    '#da70d6',
    exits:     '#8b0000',
  },
  'monochrome': {
    bg:        '#111111',
    text:      '#eeeeee',
    title:     '#ffffff',
    dim:       '#888888',
    highlight: '#ffffff',
    error:     '#ff4444',
    item:      '#cccccc',
    npc:       '#dddddd',
    clue:      '#aaaaaa',
    puzzle:    '#bbbbbb',
    exits:     '#888888',
  },
};

// Default effects per theme preset
const PRESET_EFFECTS = {
  'terminal-green': 'crt',
  'void-blue':      'crt',
  'blood-red':      'static',
  'parchment':      'typewriter',
  'monochrome':     'clean',
  'custom':         'clean',
};

// Effect bundle definitions — each value is the default intensity (0 = off)
const EFFECT_BUNDLES = {
  crt:        { scanlines: 0.35, glow: 0.4, flicker: 1, vignette: 0.6, noise: 0 },
  static:     { scanlines: 0.35, glow: 0.4, flicker: 1, vignette: 0.6, noise: 0.3 },
  typewriter: { scanlines: 0, glow: 0, flicker: 0, vignette: 0.4, noise: 0 },
  clean:      { scanlines: 0, glow: 0, flicker: 0, vignette: 0, noise: 0 },
  none:       { scanlines: 0, glow: 0, flicker: 0, vignette: 0, noise: 0 },
};

// Named font → CSS font-family mapping
const FONT_MAP = {
  'ibm-plex-mono': "'IBM Plex Mono', monospace",
  'courier':       "'Courier New', Courier, monospace",
  'arcade':         "'Silkscreen', monospace",
  'pixel':         "'Pixelify Sans', monospace",
  'serif':         "'Lora', Georgia, serif",
};

// Font size overrides — pixel fonts need larger sizes to be readable
const FONT_SIZE_MAP = {
  'pixel': '15px',
  'arcade': '15px',
};

// Panel font size — pixel fonts need a bump at small UI sizes
const FONT_SIZE_PANEL_MAP = {
  'pixel': '13px',
  'arcade': '13px',
};

// Google Fonts URLs for fonts that need loading
const FONT_URLS = {
  'ibm-plex-mono': 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap',
  'arcade':         'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap',
  'pixel':         'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;700&display=swap',
  'serif':         'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap',
};

const DEFAULT_PRESET = 'terminal-green';

/**
 * Resolve a full colour map from a world event.
 */
export function resolveTheme(worldEvent) {
  if (!worldEvent) return PRESETS[DEFAULT_PRESET];

  const themeName = getTag(worldEvent, 'theme') || DEFAULT_PRESET;
  const base = { ...(PRESETS[themeName] || PRESETS[DEFAULT_PRESET]) };

  for (const tag of getTags(worldEvent, 'colour')) {
    const slot = tag[1];
    const value = tag[2];
    if (slot && value) base[slot] = value;
  }

  return base;
}

/**
 * Resolve effects from world event tags.
 * Priority: individual effect tags > effects bundle tag > theme preset default
 */
export function resolveEffects(worldEvent) {
  const themeName = worldEvent ? (getTag(worldEvent, 'theme') || DEFAULT_PRESET) : DEFAULT_PRESET;
  const bundleName = worldEvent ? getTag(worldEvent, 'effects') : null;
  const effectiveBundle = bundleName || PRESET_EFFECTS[themeName] || 'crt';
  const base = { ...(EFFECT_BUNDLES[effectiveBundle] || EFFECT_BUNDLES.crt) };

  if (!worldEvent) return base;

  // Individual tag overrides
  const scanlines = getTag(worldEvent, 'scanlines');
  if (scanlines != null) base.scanlines = parseFloat(scanlines) || 0;

  const glow = getTag(worldEvent, 'glow');
  if (glow != null) base.glow = parseFloat(glow) || 0;

  const flicker = getTag(worldEvent, 'flicker');
  if (flicker != null) base.flicker = flicker === 'on' ? 1 : 0;

  const vignette = getTag(worldEvent, 'vignette');
  if (vignette != null) base.vignette = parseFloat(vignette) || 0;

  const noise = getTag(worldEvent, 'noise');
  if (noise != null) base.noise = parseFloat(noise) || 0;

  return base;
}

/**
 * Resolve font from world event.
 * Returns a CSS font-family string.
 */
export function resolveFont(worldEvent) {
  const fontTag = worldEvent ? getTag(worldEvent, 'font') : null;
  const fontName = fontTag || 'ibm-plex-mono';
  return FONT_MAP[fontName] || fontName;
}

/**
 * Resolve font size from world event.
 * Pixel-style fonts need a larger base size to be readable.
 */
export function resolveFontSize(worldEvent) {
  const fontTag = worldEvent ? getTag(worldEvent, 'font') : null;
  const fontName = fontTag || 'ibm-plex-mono';
  return FONT_SIZE_MAP[fontName] || '15px';
}

/**
 * Resolve panel font size — pixel fonts need a bump in small UI contexts.
 * Returns a CSS size string or null (use default).
 */
export function resolveFontSizePanel(worldEvent) {
  const fontTag = worldEvent ? getTag(worldEvent, 'font') : null;
  const fontName = fontTag || 'ibm-plex-mono';
  return FONT_SIZE_PANEL_MAP[fontName] || null;
}

/**
 * Resolve cursor style from world event.
 * Returns 'block' | 'underline' | 'beam'
 */
export function resolveCursor(worldEvent) {
  const cursorTag = worldEvent ? getTag(worldEvent, 'cursor') : null;
  const valid = ['block', 'underline', 'beam'];
  return valid.includes(cursorTag) ? cursorTag : 'beam';
}

/**
 * Load a Google Font if needed for the given font tag value.
 */
export function loadFont(worldEvent) {
  const fontTag = worldEvent ? getTag(worldEvent, 'font') : null;
  const fontName = fontTag || 'ibm-plex-mono';
  const url = FONT_URLS[fontName];
  if (!url) return;

  // Don't add duplicate link elements
  const existing = document.querySelector(`link[href="${url}"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Apply a resolved theme to the document as CSS custom properties.
 */
export function applyTheme(colours) {
  const root = document.documentElement;
  for (const [slot, value] of Object.entries(colours)) {
    root.style.setProperty(`--colour-${slot}`, value);
  }
}

/**
 * Reset theme to defaults by removing inline overrides.
 * The CSS :root defaults (Tide's End) take effect.
 */
export function resetTheme() {
  const root = document.documentElement;
  const props = ['bg', 'text', 'title', 'dim', 'highlight', 'error', 'item', 'npc', 'clue', 'puzzle', 'exits'];
  for (const p of props) root.style.removeProperty(`--colour-${p}`);
  const effects = ['scanlines', 'glow', 'flicker', 'vignette', 'noise'];
  for (const e of effects) root.style.removeProperty(`--effect-${e}`);
  root.style.removeProperty('--font-family');
  root.style.removeProperty('--cursor-style');
}

/**
 * Apply resolved effects as CSS custom properties.
 */
export function applyEffects(effects) {
  const root = document.documentElement;
  root.style.setProperty('--effect-scanlines', String(effects.scanlines));
  root.style.setProperty('--effect-glow', String(effects.glow));
  root.style.setProperty('--effect-flicker', effects.flicker ? '1' : '0');
  root.style.setProperty('--effect-vignette', String(effects.vignette));
  root.style.setProperty('--effect-noise', String(effects.noise));
}

/**
 * Apply font and cursor to the document.
 */
export function applyFontAndCursor(fontFamily, cursorStyle, fontSize, fontSizePanel) {
  const root = document.documentElement;
  root.style.setProperty('--font-family', fontFamily);
  root.style.setProperty('--cursor-style', cursorStyle);
  root.style.setProperty('--font-size', fontSize || '15px');
  if (fontSizePanel) {
    root.style.setProperty('--font-size-panel', fontSizePanel);
  } else {
    root.style.removeProperty('--font-size-panel');
  }
}
