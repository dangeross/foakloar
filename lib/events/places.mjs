const T = 'the-lake';

export function places(pubkey, sanctumEncryptedContent) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // 1. Sunlit Clearing — genesis place
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:clearing`],
        ['t', T],
        ['type', 'place'],
        ['title', 'A Sunlit Clearing'],
        ['exit', 'north'],
        ['exit', 'west'],
        ['exit', 'south'],
        ['feature', a(`${T}:feature:weathered-journal`)],
      ],
      content:
        'You stand in a sun-dappled clearing. Tall oaks ring the space, their branches ' +
        'filtering the light into golden shafts. A worn path leads north toward darkness. ' +
        'To the west, crumbling stonework is visible through the trees. ' +
        'To the south, the forest thickens into an impenetrable wall — but the undergrowth ' +
        'looks recently disturbed, as if someone has been trying to cut a path.',
    },

    // 2. Dark Cave
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:dark-cave`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Dark Cave'],
        ['exit', 'south'],
        ['exit', 'down'],
        ['item', a(`${T}:item:iron-key`)],
        ['feature', a(`${T}:feature:bronze-altar`)],
      ],
      content:
        'The air is cool and damp. You stand in a natural cavern, its walls slick with ' +
        'moisture. A bronze altar squats in the centre, green with age. Something glints ' +
        'on the ground nearby. A rough-hewn stairway descends into darkness.',
    },

    // 3. Ruined Chapel
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:ruined-chapel`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Ruined Chapel'],
        ['exit', 'east'],
        ['feature', a(`${T}:feature:crumbling-inscription`)],
      ],
      content:
        'What remains of a chapel stands open to the sky. The roof collapsed long ago, ' +
        'and ivy crawls over the broken pews. At the far end, a stone wall bears a ' +
        'crumbling inscription, still partly legible.',
    },

    // 4. Underground Lake
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:underground-lake`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Underground Lake'],
        ['exit', 'up'],
        ['exit', 'north'],
        ['feature', a(`${T}:feature:iron-gate`)],
      ],
      content:
        'You emerge onto a narrow ledge above an underground lake. The water is black ' +
        'and still, reflecting nothing. The cavern stretches beyond sight. To the north, ' +
        'a heavy iron gate bars a passage cut into the rock.',
    },

    // 5. The Sanctum — NIP-44 sealed
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:sanctum`],
        ['t', T],
        ['type', 'place'],
        ['title', 'The Sanctum'],
        ['state', 'sealed'],
        ['content-type', 'application/nip44'],
      ],
      content: sanctumEncryptedContent,
    },
  ];
}
