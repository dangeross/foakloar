const T = 'the-lake';

export function quests(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    // ── The Errand (open) — find the journal and visit the hermit ──────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:quest:the-errand`],
        ['t', T],
        ['type', 'quest'],
        ['title', 'The Errand'],
        ['quest-type', 'open'],
        ['involves', a(`${T}:clue:journal-entry`)],
        ['involves', a(`${T}:place:hermit-cottage`)],
        ['requires', a(`${T}:clue:journal-entry`), 'visible', ''],
        ['requires', a(`${T}:place:hermit-cottage`), 'visited', ''],
      ],
      content: 'Read the journal and visit the hermit in his cottage.',
    },

    // ── The Forge (hidden) — chapel crypt chain ────────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:quest:the-forge`],
        ['t', T],
        ['type', 'quest'],
        ['title', 'The Forge'],
        ['quest-type', 'hidden'],
        ['involves', a(`${T}:puzzle:chapel-riddle`)],
        ['involves', a(`${T}:item:serpent-amulet`)],
        ['involves', a(`${T}:item:serpent-staff`)],
        ['involves', a(`${T}:feature:mechanism`)],
        ['requires', a(`${T}:puzzle:chapel-riddle`), 'solved', ''],
        ['requires', a(`${T}:item:serpent-amulet`), '', ''],
        ['requires', a(`${T}:item:serpent-staff`), '', ''],
        ['requires', a(`${T}:feature:mechanism`), 'activated', ''],
      ],
      content: 'The chapel holds secrets older than the lake. Find them all.',
    },

    // ── The Descent (mystery) — opaque quest, no spoilers ──────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:quest:the-descent`],
        ['t', T],
        ['type', 'quest'],
        ['title', 'The Descent'],
        ['quest-type', 'mystery'],
        ['involves', a(`${T}:place:dark-cave`)],
        ['involves', a(`${T}:feature:cave-paintings`)],
        ['involves', a(`${T}:place:underground-lake`)],
        ['involves', a(`${T}:place:mechanism-chamber`)],
        ['requires', a(`${T}:place:mechanism-chamber`), 'visited', ''],
      ],
      content: 'Something waits in the deep.',
    },

    // ── The Path (sequential) — breadcrumb trail ───────────────────────────
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:quest:the-path`],
        ['t', T],
        ['type', 'quest'],
        ['title', 'The Path'],
        ['quest-type', 'sequential'],
        ['involves', a(`${T}:clue:journal-entry`)],
        ['involves', a(`${T}:place:dark-cave`)],
        ['involves', a(`${T}:puzzle:chapel-riddle`)],
        ['involves', a(`${T}:item:serpent-staff`)],
        ['requires', a(`${T}:clue:journal-entry`), 'visible', ''],
        ['requires', a(`${T}:place:dark-cave`), 'visited', ''],
        ['requires', a(`${T}:puzzle:chapel-riddle`), 'solved', ''],
        ['requires', a(`${T}:item:serpent-staff`), '', ''],
      ],
      content: 'Follow the trail. Each step reveals the next.',
    },
  ];
}
