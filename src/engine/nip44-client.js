import * as nip44 from 'nostr-tools/nip44';

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive a private key hex from answer + salt (matching publisher's derivePuzzleKey).
 * Uses SHA-256(answer + salt + ":key").
 */
export async function derivePrivateKey(answer, salt) {
  const keySalt = salt + ':key';
  const data = new TextEncoder().encode(answer + keySalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Decrypt NIP-44 ciphertext using a derived private key and the author's pubkey.
 */
export function decryptNip44(ciphertext, privKeyHex, authorPubKeyHex) {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(privKeyHex),
    authorPubKeyHex
  );
  return nip44.v2.decrypt(ciphertext, conversationKey);
}
