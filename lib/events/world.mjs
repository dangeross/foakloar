const T = 'the-lake';

export function world(pubkey) {
  const a = (dtag) => `30078:${pubkey}:${dtag}`;

  return [
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:world`],
        ['t', T],
        ['type', 'world'],

        // Identity
        ['title', 'The Lake'],
        ['author', 'Ross'],
        ['version', '1.0.0'],
        ['lang', 'en'],
        ['tag', 'mystery'],
        ['tag', 'ancient'],
        ['tag', 'exploration'],
        ['tag', 'puzzle'],
        ['cw', 'mild-peril'],

        // Bootstrap
        ['start', a(`${T}:place:clearing`)],
        ['relay', 'wss://relay.primal.net'],
        ['relay', 'wss://nos.lol'],

        // Collaboration
        ['collaboration', 'closed'],

        // Aesthetic
        ['theme', 'terminal-green'],
        ['font', 'ibm-plex-mono'],
        ['cursor', 'block'],

        // Cover media
        ['content-type', 'text/plain'],
        ['media', 'text/plain', '    ~  ~  ~\n  ~ THE  ~\n  ~ LAKE ~\n    ~  ~  ~'],
      ],
      content: 'An ancient lake, hidden underground. Something sleeps beneath it.\n\nThe world above has forgotten it exists. You haven\'t.',
    },
  ];
}
