const T = 'the-lake';

export function features(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // 11. Bronze Altar — examine surfaces clue
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:bronze-altar`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Bronze Altar'],
        ['noun', 'altar', 'bronze altar'],
        ['verb', 'examine'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:lake-remembers`)],
        ['description', 'A squat bronze altar, green with verdigris. Strange symbols are etched into its surface.'],
      ],
      content: '',
    },

    // 12. Crumbling Inscription — examine surfaces puzzle
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:crumbling-inscription`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Crumbling Inscription'],
        ['noun', 'inscription', 'writing', 'wall'],
        ['verb', 'examine'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:puzzle:chapel-riddle`)],
        ['description', 'Faded letters carved deep into stone. Most have been worn away by time.'],
      ],
      content: '',
    },

    // 13. Weathered Journal — examine surfaces tutorial clue
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:weathered-journal`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Weathered Journal'],
        ['noun', 'journal', 'book', 'diary'],
        ['verb', 'examine'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:journal-entry`)],
        ['description', 'A leather-bound journal, warped by rain. A few pages are still legible.'],
      ],
      content: '',
    },

    // 14. Iron Gate — locked, requires chapel-solved
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:iron-gate`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Iron Gate'],
        ['noun', 'gate', 'door', 'iron gate'],
        ['verb', 'open', 'examine', 'push'],
        ['state', 'locked'],
        ['transition', 'locked', 'locked', 'The gate holds fast.'],
        ['requires', 'chapel-solved', 'The gate holds fast. Something is missing.'],
        ['on-interact', 'open', 'set-state', 'open'],
        ['description', 'A heavy iron gate, cold to the touch. There is no visible lock.'],
      ],
      content: '',
    },
  ];
}
