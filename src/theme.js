/**
 * Theme system — resolves colour slots from world event tags.
 * Built-in presets provide defaults; `colour` tags override individual slots.
 */

import { getTag, getTags } from './world.js';

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

// Default fallback
const DEFAULT_PRESET = 'terminal-green';

/**
 * Resolve a full colour map from a world event.
 * 1. Start with theme preset defaults
 * 2. Override with explicit colour tags
 */
export function resolveTheme(worldEvent) {
  if (!worldEvent) return PRESETS[DEFAULT_PRESET];

  const themeName = getTag(worldEvent, 'theme') || DEFAULT_PRESET;
  const base = { ...(PRESETS[themeName] || PRESETS[DEFAULT_PRESET]) };

  // Override individual slots from colour tags
  for (const tag of getTags(worldEvent, 'colour')) {
    const slot = tag[1];
    const value = tag[2];
    if (slot && value) base[slot] = value;
  }

  return base;
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
