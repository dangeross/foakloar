const T = 'the-lake';

export function sounds(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // ── Ambient drones ────────────────────────────────────────────────
    // Forest ambience — lighter, for the clearing
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:forest-ambient`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'e4 ~ g4 ~'],
        ['oscillator', 'triangle'],
        ['slow', '3'],
      ],
      content: '',
    },
    // Cave drone — deep ambient for dark cave
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:cave-drone`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'c2 ~ ~ ~'],
        ['oscillator', 'sine'],
        ['slow', '4'],
        ['room', '0.8'],
      ],
      content: '',
    },
    // Deep drone — lower, heavier, for cave network and below
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:deep-drone`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'f1 ~ ~ ~ ~ ~ ~ ~'],
        ['oscillator', 'sine'],
        ['slow', '6'],
        ['room', '0.9'],
      ],
      content: '',
    },
    // Lake ambient — vast, still, underground lake
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:lake-ambient`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'c1 ~ ~ ~ ~ ~ ~ ~'],
        ['oscillator', 'sine'],
        ['slow', '8'],
        ['room', '1.0'],
        ['delay', '0.4'],
      ],
      content: '',
    },

    // ── Layers ────────────────────────────────────────────────────────
    // Water drip — sparse, dark cave
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:water-drip`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'a5 ~ ~ ~ ~ ~ ~ ~'],
        ['oscillator', 'sine'],
        ['fast', '2'],
      ],
      content: '',
    },
    // Water echo — faster drips, deeper tunnels
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:water-echo`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'e5 ~ a5 ~ ~ ~ g5 ~'],
        ['oscillator', 'sine'],
        ['fast', '3'],
        ['room', '0.6'],
        ['delay', '0.3'],
      ],
      content: '',
    },
    // Lantern hum — constant low tone
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:lantern-hum`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'g2'],
        ['oscillator', 'sine'],
        ['lpf', '400'],
        ['sustain', '2'],
        ['release', '0.1'],
        ['slow', '2'],
        ['gain', '0.6'],
      ],
      content: '',
    },
    // Lantern crackle — noise texture overlay
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:lantern-crackle`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['noise', ''],
        ['lpf', '500'],
        ['shape', '0.4'],
        ['degrade-by', '0.15'],
        ['rand', '0.1', '0.35'],
        ['fast', '6'],
      ],
      content: '',
    },

    // ── Effects (one-shots) ───────────────────────────────────────────
    // Item pickup chime
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:pickup`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'c4 e4 g4'],
        ['oscillator', 'sine'],
        ['fast', '4'],
      ],
      content: '',
    },
    // Chapel ambient — reverent, stone
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:sound:chapel-ambient`],
        ['t', T],
        ['w', 'foakloar'],
        ['type', 'sound'],
        ['note', 'a3 ~ e3 ~'],
        ['oscillator', 'triangle'],
        ['slow', '4'],
        ['room', '0.7'],
      ],
      content: '',
    },
  ];
}
