const T = 'the-lake';

export function items(pubkey) {
  return [
    // 10. Iron Key — in Dark Cave
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:item:iron-key`],
        ['t', T],
        ['type', 'item'],
        ['title', 'An Iron Key'],
        ['noun', 'key', 'iron key'],
        ['description', 'Heavy and cold. The bow is shaped like a serpent.'],
      ],
      content: '',
    },
  ];
}
