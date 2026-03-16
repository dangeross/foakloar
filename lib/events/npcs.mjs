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
      ],
      content: 'A weathered old man sits by a dying fire. His eyes are sharp despite his age. He watches you with quiet curiosity.',
    },

    // The Collector — roaming NPC, cave network + underground
    // Silent, unsettling presence. Steals keys from the player.
    // Deposits stolen items at the Flooded Passage stash.
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:npc:collector`],
        ['t', T],
        ['type', 'npc'],
        ['title', 'The Collector'],
        ['noun', 'collector', 'figure', 'presence'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['speed', '3'],
        ['order', 'random'],
        ['route', a(`${T}:place:cave-network`)],
        ['route', a(`${T}:place:flooded-passage`)],
        ['route', a(`${T}:place:echo-chamber`)],
        ['route', a(`${T}:place:underground-lake`)],
        ['stash', a(`${T}:place:flooded-passage`)],
        ['on-encounter', 'player', 'steals-item', a(`${T}:item:iron-key`)],
        ['on-enter', a(`${T}:place:flooded-passage`), 'deposits'],
      ],
      content: 'A tall, gaunt figure draped in shadow. It moves without sound, its long fingers curling and uncurling. It does not acknowledge you — it is interested only in what you carry.',
    },
  ];
}
