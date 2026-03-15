const T = 'the-lake';

export function features(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // 11. Bronze Altar — stateful feature with clue reveal and hidden portal
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:bronze-altar`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Bronze Altar'],
        ['noun', 'altar', 'bronze altar'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'pray', 'kneel', 'worship'],
        ['state', 'cold'],
        ['transition', 'cold', 'examined', 'You run your fingers over the symbols. They pulse faintly beneath your touch, and the altar grows warm.'],
        ['transition', 'examined', 'prayed', 'You kneel and press your palms to the warm bronze. The symbols blaze white. A deep grinding echoes from beneath the chapel floor.'],
        ['transition', 'examined', 'examined', 'The altar is warm. The symbols have already revealed their secret.'],
        ['transition', 'prayed', 'prayed', 'The altar is silent now. The way below is open.'],
        ['on-interact', 'examine', 'set-state', 'examined'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:lake-remembers`)],
        ['on-interact', 'pray', 'set-state', 'prayed'],
        ['on-interact', 'pray', 'set-state', 'visible', a(`${T}:portal:chapel-to-crypt`)],
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
        ['verb', 'examine', 'x', 'look at', 'inspect', 'read'],
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
        ['verb', 'examine', 'x', 'look at', 'inspect', 'read'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:journal-entry`)],
        ['description', 'A leather-bound journal, warped by rain. A few pages are still legible.'],
      ],
      content: '',
    },

    // Standing Stone — stateful, examine reveals clue
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:standing-stone`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Standing Stone'],
        ['noun', 'stone', 'standing stone', 'monolith'],
        ['verb', 'examine', 'x', 'look at', 'inspect', 'read'],
        ['state', 'weathered'],
        ['transition', 'weathered', 'read', 'You brush away the lichen and trace the carved letters with your fingertips. An inscription emerges from the worn surface:\n\n"The serpent guards something old. What sleeps beneath the water remembers what the world forgot."'],
        ['transition', 'read', 'read', 'You have already read the inscription. The serpent guards something old.'],
        ['on-interact', 'examine', 'set-state', 'read'],
        ['description', 'A tall stone, rough-hewn and ancient, stands at the edge of the clearing. Lichen covers most of its surface, but you can make out faint carved letters beneath.'],
      ],
      content: '',
    },

    // Stained Glass Window — examine reveals clue about serpent and staff
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:stained-glass`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Stained Glass Window'],
        ['noun', 'window', 'glass', 'stained glass'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:serpent-staff`)],
        ['description', 'Fragments of coloured glass still cling to the chapel window frame. The surviving panels depict a serpent coiled around a staff, held aloft before something vast and dark.'],
      ],
      content: '',
    },

    // Locked Chest — requires iron key to interact
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:locked-chest`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Locked Chest'],
        ['noun', 'chest', 'locked chest'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'open', 'unlock'],
        ['requires', a(`${T}:item:iron-key`), '', 'The chest is bound with a heavy lock. You need a key.'],
        ['description', 'A heavy wooden chest, bound with iron bands. You turn the iron key and the lock clicks open. Inside, a serpent amulet rests on faded cloth.'],
      ],
      content: '',
    },

    // Cave Paintings — examine reveals clue about lake history
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:cave-paintings`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Cave Paintings'],
        ['noun', 'paintings', 'cave paintings', 'paint', 'art'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:lake-history`)],
        ['description', 'Faded ochre figures dance across the cave wall. They depict people gathered around a body of water, arms raised. Something vast coils beneath the surface.'],
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
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'open', 'push', 'pull'],
        ['state', 'locked'],
        ['transition', 'locked', 'open', 'With a groan of ancient hinges, the gate swings open.'],
        ['transition', 'locked', 'locked', 'The gate holds fast.'],
        ['transition', 'open', 'open', 'The gate is already open.'],
        ['requires', a(`${T}:puzzle:chapel-riddle`), 'solved', 'The gate holds fast. Something is missing.'],
        ['on-interact', 'open', 'set-state', 'open'],
        ['description', 'A heavy iron gate, cold to the touch. There is no visible lock.'],
      ],
      content: '',
    },

    // Wall Carvings — in chapel crypt, reveals clue
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:wall-carvings`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Wall Carvings'],
        ['noun', 'carvings', 'wall carvings', 'walls'],
        ['verb', 'examine', 'x', 'look at', 'inspect', 'read'],
        ['on-interact', 'examine', 'set-state', 'visible', a(`${T}:clue:crypt-carvings`)],
        ['description', 'Intricate carvings cover the crypt walls. They depict a serpent coiled around a staff, descending into water. Beneath the images, text is carved in a steady hand.'],
      ],
      content: '',
    },

    // Stone Sarcophagus — in chapel crypt, contains serpent amulet
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:stone-sarcophagus`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'Stone Sarcophagus'],
        ['noun', 'sarcophagus', 'tomb', 'coffin'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['verb', 'open'],
        ['state', 'sealed'],
        ['transition', 'sealed', 'open', 'The heavy lid grinds aside. Inside, on a bed of crumbled velvet, lie a serpent amulet and a serpent staff, both of orichalcum.'],
        ['transition', 'sealed', 'sealed', 'The sarcophagus is sealed shut. The lid is immensely heavy.'],
        ['transition', 'open', 'open', 'The sarcophagus is already open. The velvet lining is crumbling to dust.'],
        ['on-interact', 'open', 'set-state', 'open'],
        ['on-interact', 'open', 'give-item', a(`${T}:item:serpent-amulet`)],
        ['on-interact', 'open', 'give-item', a(`${T}:item:serpent-staff`)],
        ['description', 'A stone sarcophagus rests on a raised dais. The lid is carved with a serpent motif. It looks sealed but not locked — just very heavy.'],
      ],
      content: '',
    },
    // The Mechanism — sequence puzzle feature in Mechanism Chamber
    // Items set-state externally: amulet → amulet-placed, staff → activated
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:feature:mechanism`],
        ['t', T],
        ['type', 'feature'],
        ['title', 'The Mechanism'],
        ['noun', 'mechanism', 'device', 'channels', 'orichalcum'],
        ['verb', 'examine', 'x', 'look at', 'inspect'],
        ['state', 'dormant'],
        ['transition', 'dormant', 'dormant', 'The mechanism is cold and still. Two recesses are carved into its face — one round, one long and narrow.'],
        ['transition', 'dormant', 'amulet-placed', 'You place the serpent amulet into the round recess. It clicks into place and begins to glow faintly. The orichalcum channels pulse with dim light. The narrow recess waits.'],
        ['transition', 'amulet-placed', 'amulet-placed', 'The amulet glows in its recess. The narrow slot beside it is still empty.'],
        ['transition', 'amulet-placed', 'activated', 'You slide the serpent staff into the narrow slot. The staff locks into place. The orichalcum channels blaze with golden light, racing across the walls and floor. The mechanism hums — a deep, resonant tone that shakes dust from the ceiling. The floor beneath the mechanism splits open, revealing stone steps descending into warm light.'],
        ['transition', 'activated', 'activated', 'The mechanism hums steadily. Golden light pulses through the orichalcum channels. The way below is open.'],
        ['description', 'A complex device of dark stone and orichalcum channels, set into the north wall. Two recesses are carved into its face — one round, one long and narrow. The orichalcum channels trace intricate patterns across the wall and floor, all converging on this point.'],
      ],
      content: '',
    },
  ];
}
