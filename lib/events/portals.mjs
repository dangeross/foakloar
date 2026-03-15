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

    // Clearing ↔ Hermit's Cottage (east/west)
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:clearing-to-cottage`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('clearing'), 'east', 'Smoke rises from a chimney through the trees to the east.'],
        ['exit', p('hermit-cottage'), 'west', 'A path leads west back to the clearing.'],
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

    // Chapel ↔ Crypt (down/up) — hidden until altar prayed
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:chapel-to-crypt`],
        ['t', T],
        ['type', 'portal'],
        ['state', 'hidden'],
        ['transition', 'hidden', 'visible', 'A section of the chapel floor grinds open, revealing stone steps descending into darkness.'],
        ['exit', p('ruined-chapel'), 'down', 'Stone steps descend into a crypt below the chapel.'],
        ['exit', p('chapel-crypt'), 'up', 'Stone steps lead back up to the chapel.'],
      ],
      content: '',
    },

    // 8. Dark Cave ↔ Cave Network (down/up) — replaces old cave-to-lake
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:cave-to-lake`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('dark-cave'), 'down', 'A rough-hewn stairway descends into darkness.'],
        ['exit', p('cave-network'), 'up', 'Worn steps lead back up to the cave.'],
      ],
      content: '',
    },

    // Cave Network ↔ Underground Lake (down/up)
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:network-to-lake`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('cave-network'), 'down', 'The passage descends toward the sound of water.'],
        ['exit', p('underground-lake'), 'up', 'A narrow passage leads back up to the cave network.'],
        ['requires',     `30078:${pubkey}:${T}:item:brass-lantern`, '',     'You need a light source.'],
        ['requires-not', `30078:${pubkey}:${T}:item:brass-lantern`, 'off',  'It is pitch black. You stumble and turn back.'],
        ['requires-not', `30078:${pubkey}:${T}:item:brass-lantern`, 'dead', 'It is pitch black. You stumble and turn back.'],
      ],
      content: '',
    },

    // 9. Underground Lake ↔ Mechanism Chamber (north/south) — gated by iron gate + chapel riddle
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:lake-to-mechanism`],
        ['t', T],
        ['type', 'portal'],
        ['exit', p('underground-lake'), 'north', 'A heavy iron gate blocks the passage north.'],
        ['exit', p('mechanism-chamber'), 'south', 'The passage leads south to the underground lake.'],
        ['requires', `30078:${pubkey}:${T}:puzzle:chapel-riddle`, 'solved', 'The gate holds fast. Something is missing.'],
        ['state', 'visible'],
      ],
      content: '',
    },

    // Mechanism Chamber ↔ Sanctum (down/up) — hidden until mechanism puzzle solved
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:mechanism-to-sanctum`],
        ['t', T],
        ['type', 'portal'],
        ['state', 'hidden'],
        ['transition', 'hidden', 'visible', 'The floor splits open, revealing stone steps descending into warm golden light.'],
        ['exit', p('mechanism-chamber'), 'down', 'Stone steps descend into warm golden light.'],
        ['exit', p('sanctum'), 'up', 'Steps lead back up to the mechanism chamber.'],
      ],
      content: '',
    },
  ];
}
