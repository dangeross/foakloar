/**
 * Payment events — The Ferryman and ferry toll.
 *
 * The Ferryman is a static NPC at the Underground Lake. Offers passage
 * across the lake to the Mechanism Chamber for 10 sats via Lightning.
 * Payment gives a ferry-token receipt item; a shortcut portal requires it.
 */

const T = 'the-lake';

export function paymentEvents(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // The Ferryman — static NPC at the Underground Lake
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:npc:ferryman`],
        ['t', T],
        ['type', 'npc'],
        ['title', 'The Ferryman'],
        ['noun', 'ferryman', 'ferryman', 'hooded figure', 'figure'],
        ['verb', 'talk', 'speak', 'ask'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['dialogue', a(`${T}:dialogue:ferryman-greeting`)],
        ['route', a(`${T}:place:underground-lake`)],
      ],
      content:
        'A hooded figure stands motionless at the water\'s edge. ' +
        'Ancient. Patient. A long pole rests in one skeletal hand. ' +
        'A flat-bottomed boat is tethered to the jetty beside them.',
    },

    // Ferryman dialogue — single node with one option
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:ferryman-greeting`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', 'The figure extends an open palm. Ten sats. No more, no less.'],
        ['option', 'Pay the toll', a(`${T}:payment:ferry-toll`)],
        ['option', 'Walk away', ''],
      ],
      content: '',
    },

    // Payment event — 10 sats via Lightning Address
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:payment:ferry-toll`],
        ['t', T],
        ['type', 'payment'],
        ['amount', '10'],
        ['unit', 'sats'],
        ['lnurl', 'limefox4616@breez.tips'],
        ['on-complete', '', 'give-item', a(`${T}:item:ferry-token`)],
      ],
      content: 'Passage across the underground lake.',
    },

    // Ferry token — receipt item from payment
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:item:ferry-token`],
        ['t', T],
        ['type', 'item'],
        ['title', 'A Ferry Token'],
        ['noun', 'token', 'ferry token'],
      ],
      content: 'A smooth black stone, warm to the touch. The Ferryman will honour it.',
    },

    // Shortcut portal — underground lake → mechanism chamber via ferry
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:ferry-crossing`],
        ['t', T],
        ['type', 'portal'],
        ['requires', a(`${T}:item:ferry-token`), '', ''],
        ['exit', a(`${T}:place:underground-lake`), 'across', 'The Ferryman\'s boat is tethered to the jetty.'],
        ['exit', a(`${T}:place:mechanism-chamber`), 'across', 'The boat can carry you back across the lake.'],
      ],
      content: '',
    },
  ];
}
