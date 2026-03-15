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
        ['exit', 'east'],
        ['exit', 'south'],
        ['feature', a(`${T}:feature:weathered-journal`)],
        ['feature', a(`${T}:feature:standing-stone`)],
      ],
      content:
        'You stand in a sun-dappled clearing. Tall oaks ring the space, their branches ' +
        'filtering the light into golden shafts. A worn path leads north toward darkness. ' +
        'To the west, crumbling stonework is visible through the trees. ' +
        'To the east, smoke rises from a chimney hidden among the oaks. ' +
        'To the south, the forest thickens into an impenetrable wall — but the undergrowth ' +
        'looks recently disturbed, as if someone has been trying to cut a path.',
    },

    // Hermit's Cottage — east of clearing
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:hermit-cottage`],
        ['t', T],
        ['type', 'place'],
        ['title', "Hermit's Cottage"],
        ['exit', 'west'],
        ['feature', a(`${T}:feature:locked-chest`)],
        ['npc', a(`${T}:npc:hermit`)],
      ],
      content:
        'A small stone cottage, low-ceilinged and cluttered. Dried herbs hang from the ' +
        'rafters. A workbench is covered in half-finished carvings. Bookshelves line the ' +
        'walls, stuffed with crumbling volumes. In the corner sits a heavy wooden chest. ' +
        'An old man sits by the fireplace, watching you.',
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
        ['item', a(`${T}:item:brass-lantern`)],
      ],
      content:
        'The air is cool and damp. You stand in a natural cavern, its walls slick with ' +
        'moisture. Something glints on the ground nearby. An old brass lantern sits on a ' +
        'ledge. A rough-hewn stairway descends into darkness.',
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
        ['feature', a(`${T}:feature:stained-glass`)],
        ['feature', a(`${T}:feature:bronze-altar`)],
      ],
      content:
        'What remains of a chapel stands open to the sky. The roof collapsed long ago, ' +
        'and ivy crawls over the broken pews. A bronze altar squats before the east wall, ' +
        'green with age. At the far end, a stone wall bears a crumbling inscription, ' +
        'still partly legible.',
    },

    // Chapel Crypt — below chapel, hidden until altar prayed
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:chapel-crypt`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Chapel Crypt'],
        ['exit', 'up'],
        ['feature', a(`${T}:feature:wall-carvings`)],
        ['feature', a(`${T}:feature:stone-sarcophagus`)],
      ],
      content:
        'Stone steps descend into a vaulted crypt. The air is cold and dry, preserved ' +
        'for centuries. Carved pillars line the walls, and at the far end a stone ' +
        'sarcophagus rests on a raised dais. The walls are covered in intricate carvings.',
    },

    // Cave Network — below dark cave, requires lantern
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:cave-network`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Cave Network'],
        ['exit', 'up'],
        ['exit', 'down'],
        ['requires',     a(`${T}:item:brass-lantern`), '',     'You need a light source.'],
        ['requires-not', a(`${T}:item:brass-lantern`), 'off',  'It is pitch black. You are likely to be eaten by a grue.'],
        ['requires-not', a(`${T}:item:brass-lantern`), 'dead', 'It is pitch black. You are likely to be eaten by a grue.'],
        ['feature', a(`${T}:feature:cave-paintings`)],
      ],
      content:
        'Your lantern light plays across a junction of tunnels. The walls are streaked ' +
        'with mineral deposits — red ochre, pale calcite, veins of something that glitters. ' +
        'Ancient paintings cover the wall to your left. The passage continues down into ' +
        'deeper darkness.',
    },

    // 4. Underground Lake — markdown content
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:underground-lake`],
        ['t', T],
        ['type', 'place'],
        ['title', 'Underground Lake'],
        ['content-type', 'text/markdown'],
        ['exit', 'up'],
        ['exit', 'north'],
        ['feature', a(`${T}:feature:iron-gate`)],
      ],
      content:
        'You emerge onto a narrow ledge above an underground lake. The water is **black and still**, reflecting nothing. The cavern stretches beyond sight.\n\n' +
        'To the north, a heavy iron gate bars a passage cut into the rock. The air is cold and tastes of **stone and deep water**.\n\n' +
        '> *Something vast moves beneath the surface — a ripple, then stillness.*',
    },

    // The Mechanism Chamber — north of underground lake, with ASCII art
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:mechanism-chamber`],
        ['t', T],
        ['type', 'place'],
        ['title', 'The Mechanism Chamber'],
        ['exit', 'south'],
        ['exit', 'down'],
        ['feature', a(`${T}:feature:mechanism`)],
        ['puzzle', a(`${T}:puzzle:mechanism-sequence`)],
        ['media', 'text/plain',
          '        _______________\n' +
          '       /               \\\n' +
          '      |   [O]     [|]   |\n' +
          '      |                 |\n' +
          '      |  ~~~~~~~~~~~   |\n' +
          '      |  ~ CHANNELS ~  |\n' +
          '      |  ~~~~~~~~~~~   |\n' +
          '       \\_____________/'],
      ],
      content:
        'A circular chamber carved from living rock. Orichalcum channels trace ' +
        'intricate patterns across the walls and floor, all converging on a complex ' +
        'device set into the north wall. The air hums with a low, expectant vibration. ' +
        'The passage south leads back to the underground lake.',
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
