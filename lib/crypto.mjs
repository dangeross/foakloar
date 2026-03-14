import { createHash } from 'node:crypto';
import { getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';

export function hashAnswer(answer, salt) {
  return createHash('sha256')
    .update(answer + salt)
    .digest('hex');
}

export function derivePuzzleKey(answer, salt) {
  const keySalt = salt + ':key';
  const privKeyHex = createHash('sha256')
    .update(answer + keySalt)
    .digest('hex');
  const pubKeyHex = getPublicKey(hexToBytes(privKeyHex));
  return { privKeyHex, pubKeyHex };
}

export function encryptContent(plaintext, authorPrivKeyHex, derivedPubKeyHex) {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(authorPrivKeyHex),
    derivedPubKeyHex
  );
  return nip44.v2.encrypt(plaintext, conversationKey);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
