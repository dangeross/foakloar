const T = 'the-lake';

export function puzzle(pubkey, answerHash, derivedPubKey) {
  return [
    // 17. Chapel Riddle — hash puzzle
    {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:puzzle:chapel-riddle`],
        ['t', T],
        ['type', 'puzzle'],
        ['puzzle-type', 'riddle'],
        ['answer-hash', answerHash],
        ['salt', `${T}:puzzle:chapel-riddle:v1`],
        ['on-complete', 'flag', 'set-flag', 'chapel-solved'],
        ['on-complete', 'key', 'give-crypto-key', derivedPubKey],
      ],
      content:
        'I have a neck but no head, a body but no soul. ' +
        'I guard what you seek but ask nothing in return. What am I?',
    },
  ];
}
