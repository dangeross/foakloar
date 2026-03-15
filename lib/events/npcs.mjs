const T = 'the-lake';

export function npcs(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // The Hermit — static NPC in Hermit's Cottage
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:npc:hermit`],
        ['t', T],
        ['type', 'npc'],
        ['title', 'The Hermit'],
        ['noun', 'hermit', 'old man', 'man'],
        ['verb', 'talk', 'speak', 'chat', 'ask'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        // Dialogue entry points — last passing requires wins
        // after-cave: requires lake-history clue (from cave paintings in cave network)
        // after-chapel: requires lake-remembers clue (from examining the bronze altar)
        ['dialogue', a(`${T}:dialogue:hermit:greeting`)],
        ['dialogue', a(`${T}:dialogue:hermit:after-cave`),    a(`${T}:clue:lake-history`),    'seen'],
        ['dialogue', a(`${T}:dialogue:hermit:after-chapel`),  a(`${T}:clue:lake-remembers`),  'seen'],
        ['description', 'A weathered old man sits by a dying fire. His eyes are sharp despite his age. He watches you with quiet curiosity.'],
      ],
      content: '',
    },
  ];
}
