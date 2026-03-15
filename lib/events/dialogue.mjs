const T = 'the-lake';

export function dialogue(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // ── Entry point: greeting (unconditional default) ────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:greeting`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "Hm? A visitor. It's been... a while. What brings you to these woods?"],
        ['option', 'Ask about the cave',   a(`${T}:dialogue:hermit:cave`)],
        ['option', 'Ask about the chapel',  a(`${T}:dialogue:hermit:chapel`)],
        ['option', 'Leave',                 ''],
      ],
      content: '',
    },

    // ── Entry point: after-cave (requires hermit:cave visited) ───────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:after-cave`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "Back again. The cave spoke to you, did it? Good. There's more to find."],
        ['option', 'Ask about the chapel',     a(`${T}:dialogue:hermit:chapel`)],
        ['option', "Ask what's below the cave", a(`${T}:dialogue:hermit:below`)],
        ['option', 'Leave',                     ''],
      ],
      content: '',
    },

    // ── Entry point: after-chapel (requires hermit:chapel visited) ───────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:after-chapel`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "You found the chapel. I wondered if you would. The watchers left more than prayers there."],
        ['option', 'Ask about the lake',    a(`${T}:dialogue:hermit:lake`)],
        ['option', 'Ask about the serpent',  a(`${T}:dialogue:hermit:serpent`)],
        ['option', 'Leave',                  ''],
      ],
      content: '',
    },

    // ── Cave branch ──────────────────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:cave`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "North of the clearing, there's a cave. Old. Older than me. Take a light — the dark below doesn't forgive the careless. There are paintings on the walls, if you look."],
        ['option', 'Ask about the paintings',  a(`${T}:dialogue:hermit:paintings`)],
        ['option', 'Thank him and leave',       ''],
      ],
      content: '',
    },

    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:paintings`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "They painted what they saw. The lake, the serpent, the ones who came before. Don't dismiss the art of the ancients — it tells truth more honestly than words."],
        ['option', 'Leave', ''],
      ],
      content: '',
    },

    // ── Chapel branch ────────────────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:chapel`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "The chapel was built by the first watchers. They knew about the serpent. Pray at the altar — if you've earned the right."],
        ['option', 'Ask about the watchers',  a(`${T}:dialogue:hermit:watchers`)],
        ['option', 'Thank him and leave',      ''],
      ],
      content: '',
    },

    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:watchers`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "They watched the lake. Tended the serpent. Kept the mechanism. That's all I know. Or all I'll say."],
        ['option', 'Leave', ''],
      ],
      content: '',
    },

    // ── Below (from after-cave) ──────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:below`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "Below the cave network there's water. A lake. Black and still. Something lives there — old, patient. Not unfriendly, but... discerning. It chooses who passes."],
        ['option', 'Ask about the serpent',  a(`${T}:dialogue:hermit:serpent`)],
        ['option', 'Leave',                  ''],
      ],
      content: '',
    },

    // ── Serpent ───────────────────────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:serpent`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "The serpent is a guardian. Not yours, not mine. It guards what's beneath. If you want to pass, you'll need its mark — an amulet of orichalcum. The crypt beneath the chapel holds answers."],
        ['option', 'Leave', ''],
      ],
      content: '',
    },

    // ── Lake (from after-chapel) ─────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:lake`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "The lake remembers what we forgot. That's not metaphor — what sleeps beneath those waters dreamed something vast. The mechanism was built to wake it, or to keep it sleeping. I was never sure which."],
        ['option', 'Ask about the mechanism',  a(`${T}:dialogue:hermit:mechanism`)],
        ['option', 'Leave',                     ''],
      ],
      content: '',
    },

    // ── Mechanism ────────────────────────────────────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:dialogue:hermit:mechanism`],
        ['t', T],
        ['type', 'dialogue'],
        ['text', "North of the lake, through the serpent's passage. You'll need the staff and the amulet. Beyond that... I cannot help you. Some doors open only for those who earned the key."],
        ['option', 'Leave', ''],
      ],
      content: '',
    },
  ];
}
