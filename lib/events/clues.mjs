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
  ];
}
