const T = 'the-lake';

export function consequences(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // Death — player health reaches zero
    // Respawns at the clearing, drops inventory at death location
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:consequence:death`],
        ['t', T],
        ['type', 'consequence'],
        ['title', 'Death'],
        ['respawn', a(`${T}:place:clearing`)],
        ['clears', 'inventory'],
        ['clears', 'states'],
        ['clears', 'counters'],
      ],
      content:
        'Everything goes dark. The cold seeps in, then nothing.\n\n' +
        '...\n\n' +
        'You wake in the clearing, the sky bright above you. ' +
        'Your belongings are gone — scattered somewhere behind you.',
    },

    // Darkness — lantern dies in the caves
    // Less severe: respawn at dark cave entrance, keep inventory but lose counter progress
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:consequence:darkness`],
        ['t', T],
        ['type', 'consequence'],
        ['title', 'Consumed by Darkness'],
        ['respawn', a(`${T}:place:dark-cave`)],
        ['clears', 'counters'],
      ],
      content:
        'The last ember of light dies. Darkness swallows you whole.\n\n' +
        'You stumble, hands against cold stone, until — somehow — ' +
        'you find your way back to the cave mouth.',
    },
  ];
}
