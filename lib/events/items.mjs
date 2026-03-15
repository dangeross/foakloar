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

    // Brass Lantern — stateful item with battery counter
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:item:brass-lantern`],
        ['t', T],
        ['type', 'item'],
        ['title', 'A Brass Lantern'],
        ['noun', 'lantern', 'brass lantern', 'lamp', 'light'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'turn on', 'switch on', 'light'],
        ['verb', 'turn off', 'switch off', 'extinguish', 'douse'],
        ['state', 'off'],
        ['transition', 'off', 'on', 'The lantern flickers to life, casting warm light around you.'],
        ['transition', 'on', 'flickering', 'The lantern flickers ominously.'],
        ['transition', 'flickering', 'dead', 'The lantern dies. Darkness.'],
        ['transition', 'on', 'off', 'You turn off the lantern. Darkness presses close.'],
        ['transition', 'flickering', 'off', 'You turn off the flickering lantern.'],
        ['transition', 'off', 'off', 'The lantern is already off.'],
        ['transition', 'on', 'on', 'The lantern is already on.'],
        ['transition', 'flickering', 'on', 'The lantern is already on — barely.'],
        ['transition', 'dead', 'dead', 'The lantern is dead. Nothing happens.'],
        ['counter', 'battery', '50'],
        ['on-move', 'on', 'decrement', 'battery', '1'],
        ['on-move', 'flickering', 'decrement', 'battery', '1'],
        ['on-counter-low', 'battery', '20', 'set-state', 'flickering'],
        ['on-counter-zero', 'battery', 'set-state', 'dead'],
        ['on-interact', 'turn on', 'set-state', 'on'],
        ['on-interact', 'turn off', 'set-state', 'off'],
        ['description', 'A sturdy brass lantern, dented but functional. A small dial on the side reads the battery level.'],
      ],
      content: '',
    },

    // Serpent Amulet — given by sarcophagus in chapel crypt
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:item:serpent-amulet`],
        ['t', T],
        ['type', 'item'],
        ['title', 'Serpent Amulet'],
        ['noun', 'amulet', 'serpent amulet'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'insert', 'place', 'put'],
        ['on-interact', 'insert', 'set-state', 'amulet-placed', `30078:${pubkey}:${T}:feature:mechanism`],
        ['description', 'An amulet of orichalcum, shaped like a coiled serpent. It is warm to the touch, as if alive.'],
      ],
      content: '',
    },

    // Serpent Staff — given by sarcophagus in chapel crypt
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:item:serpent-staff`],
        ['t', T],
        ['type', 'item'],
        ['title', 'Serpent Staff'],
        ['noun', 'staff', 'serpent staff'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'insert', 'place', 'put'],
        ['on-interact', 'insert', 'set-state', 'activated', `30078:${pubkey}:${T}:feature:mechanism`],
        ['description', 'A staff of dark wood, carved with serpent scales. The head is shaped like a coiled serpent, matching the amulet.'],
      ],
      content: '',
    },
  ];
}
