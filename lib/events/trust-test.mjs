/**
 * Trust test events — secondary authors for testing Phase 14 trust model.
 *
 * Three secondary authors:
 *   - Collaborator — listed on world event, full trust
 *   - Vouched      — vouched by collaborator (portal scope only)
 *   - Untrusted    — no trust relationship at all
 */

const T = 'the-lake';

/**
 * Collaborator events — a new place and portal connecting to the clearing's south exit.
 * These should appear in canonical mode (collaborator is directly trusted).
 */
export function collaboratorEvents(genesisPubkey, collabPubkey) {
  const gp = (name) => `30078:${genesisPubkey}:${T}:place:${name}`;
  const cp = (name) => `30078:${collabPubkey}:${T}:place:${name}`;

  return [
    // Collaborator's place — The Old Bridge
    {
      kind: 30078,
      pubkey: collabPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:old-bridge`],
        ['t', T],
        ['type', 'place'],
        ['title', 'The Old Bridge'],
        ['exit', 'north'],
      ],
      content:
        'A crumbling stone bridge spans a dried riverbed. The stonework is ancient — ' +
        'older than the chapel, older than the lake itself. Lichen covers every surface. ' +
        'The path leads back north through the undergrowth.',
    },

    // Collaborator's portal — Clearing south ↔ Old Bridge north
    {
      kind: 30078,
      pubkey: collabPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:clearing-to-bridge`],
        ['t', T],
        ['type', 'portal'],
        ['exit', gp('clearing'), 'south', 'A freshly cut path leads south through the undergrowth.'],
        ['exit', cp('old-bridge'), 'north', 'The path leads back north to the clearing.'],
      ],
      content: '',
    },
  ];
}

/**
 * Vouch event — collaborator vouches for the vouched pubkey (portal scope only).
 */
export function vouchEvents(collabPubkey, vouchedPubkey) {
  return [
    {
      kind: 30078,
      pubkey: collabPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:vouch:collab-vouches-vouched`],
        ['t', T],
        ['type', 'vouch'],
        ['pubkey', vouchedPubkey],
        ['scope', 'portal'],
        ['can-vouch', 'false'],
      ],
      content: '',
    },
  ];
}

/**
 * Vouched author's portal — connects the Old Bridge east to a hidden grove.
 * Only visible in community mode (vouched, not a direct collaborator).
 */
export function vouchedEvents(collabPubkey, vouchedPubkey) {
  const cp = (name) => `30078:${collabPubkey}:${T}:place:${name}`;
  const vp = (name) => `30078:${vouchedPubkey}:${T}:place:${name}`;

  return [
    // Vouched author's place — The Hidden Grove
    {
      kind: 30078,
      pubkey: vouchedPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:hidden-grove`],
        ['t', T],
        ['type', 'place'],
        ['title', 'The Hidden Grove'],
        ['exit', 'west'],
      ],
      content:
        'A secluded grove, almost perfectly circular. The trees here grow in an unnatural ' +
        'spiral pattern. Wildflowers carpet the ground in colours you have never seen before. ' +
        'The air smells of honey and rain.',
    },

    // Vouched author's portal — Old Bridge east ↔ Hidden Grove west
    {
      kind: 30078,
      pubkey: vouchedPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:bridge-to-grove`],
        ['t', T],
        ['type', 'portal'],
        ['exit', cp('old-bridge'), 'east', 'A faint trail leads east into dense foliage.'],
        ['exit', vp('hidden-grove'), 'west', 'The trail leads back west to the bridge.'],
      ],
      content: '',
    },
  ];
}

/**
 * Untrusted events — a rogue portal claiming the clearing's south exit.
 * Should only appear in explorer mode (open collaboration) or be filtered out.
 */
export function untrustedEvents(genesisPubkey, untrustedPubkey) {
  const gp = (name) => `30078:${genesisPubkey}:${T}:place:${name}`;
  const up = (name) => `30078:${untrustedPubkey}:${T}:place:${name}`;

  return [
    // Untrusted place — The Void
    {
      kind: 30078,
      pubkey: untrustedPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:place:the-void`],
        ['t', T],
        ['type', 'place'],
        ['title', 'The Void'],
        ['exit', 'south'],
      ],
      content:
        'You stand in absolute nothingness. This place should not exist. ' +
        'Something went very wrong.',
    },

    // Untrusted portal — also claims clearing south exit (contested with collaborator's portal)
    {
      kind: 30078,
      pubkey: untrustedPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${T}:portal:clearing-to-void`],
        ['t', T],
        ['type', 'portal'],
        ['exit', gp('clearing'), 'south', 'A swirling portal of darkness beckons south.'],
        ['exit', up('the-void'), 'south', 'The void stretches endlessly.'],
      ],
      content: '',
    },
  ];
}
