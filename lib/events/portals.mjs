const T = 'the-lake';

export function portals(pubkey) {
  const p = (name) => `30078:${pubkey}:${T}:place:${name}`;

  return [
    // 6. Clearing ↔ Dark Cave (north/south)
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:clearing-to-cave`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('clearing'), 'north', 'A dark cave entrance looms to the north.'],
        ['exit', p('dark-cave'), 'south', 'Pale daylight filters through the cave mouth to the south.'],
      ],
      content: '',
    },

    // 7. Clearing ↔ Ruined Chapel (west/east)
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:clearing-to-chapel`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('clearing'), 'west', 'Crumbling stonework is visible through the trees.'],
        ['exit', p('ruined-chapel'), 'east', 'A sun-dappled clearing lies to the east.'],
      ],
      content: '',
    },

    // 8. Dark Cave ↔ Underground Lake (down/up)
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:cave-to-lake`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('dark-cave'), 'down', 'A rough-hewn stairway descends into darkness.'],
        ['exit', p('underground-lake'), 'up', 'Worn steps lead back up to the cave.'],
      ],
      content: '',
    },

    // 9. Underground Lake ↔ Sanctum (north/south) — gated
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:lake-to-sanctum`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('underground-lake'), 'north', 'A heavy iron gate blocks the passage north.'],
        ['exit', p('sanctum'), 'south', 'The way back south.'],
        ['requires', 'chapel-solved', 'The gate holds fast. Something is missing.'],
        ['state', 'visible'],
      ],
      content: '',
    },
  ];
}
