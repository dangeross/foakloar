const T = 'the-lake';

export function clues(pubkey) {
  return [
    // 15. Lake Remembers — surfaced by bronze altar examine
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:clue:lake-remembers`],
        ['t', T],
        ['type', 'clue'],
        ['title', 'The Lake Remembers'],
        ['state', 'hidden'],
      ],
      content: 'The lake remembers what the cave forgets.',
    },

    // Serpent Staff — surfaced by stained glass window
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:clue:serpent-staff`],
        ['t', T],
        ['type', 'clue'],
        ['title', 'The Serpent and the Staff'],
        ['state', 'hidden'],
      ],
      content: 'The glass tells a story: a serpent wrapped around a staff, held aloft before a stone mechanism. The staff turns what hands cannot.',
    },

    // Lake History — surfaced by cave paintings
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:clue:lake-history`],
        ['t', T],
        ['type', 'clue'],
        ['title', 'The Ancient Lake'],
        ['state', 'hidden'],
      ],
      content: 'The paintings tell of an age when the lake was known. People came to it, spoke to what lived beneath. Then they sealed it away. The mechanism was their lock.',
    },

    // 16. Journal Entry — surfaced by weathered journal examine
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:clue:journal-entry`],
        ['t', T],
        ['type', 'clue'],
        ['title', 'A Faded Journal Entry'],
        ['state', 'hidden'],
      ],
      content:
        'This world is made of places, connected by passages that anyone may build. ' +
        'Look carefully at what you find. Examine things. The answers are here ' +
        'if you know where to look.',
    },

    // Crypt Carvings — surfaced by wall carvings in chapel crypt
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:clue:crypt-carvings`],
        ['t', T],
        ['type', 'clue'],
        ['title', 'The Serpent Descends'],
        ['state', 'hidden'],
      ],
      content: 'The serpent descends with the staff into the deep water. What it guards is not treasure but memory. The mechanism remembers the sequence: amulet first, then staff, then the word spoken to the water.',
    },
  ];
}
