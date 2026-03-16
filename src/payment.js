/**
 * payment.js — LNURL-pay client for type: payment events.
 *
 * Supports:
 *   - Lightning Address (user@domain) → LNURL-pay endpoint
 *   - Raw LNURL (lnurl1...) → decoded URL
 *   - LUD-06: payRequest — invoice generation
 *   - LUD-11: verify — payment status polling
 */

import { bech32 } from '@scure/base';

/**
 * Resolve a Lightning Address or LNURL to a LNURL-pay metadata URL.
 */
export function resolveLnurl(lnurl) {
  // Lightning Address: user@domain
  if (lnurl.includes('@')) {
    const [user, domain] = lnurl.split('@');
    return `https://${domain}/.well-known/lnurlp/${user}`;
  }

  // Raw LNURL: bech32-encoded URL
  if (lnurl.toLowerCase().startsWith('lnurl')) {
    const { words } = bech32.decode(lnurl, 2000);
    const bytes = bech32.fromWords(words);
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  // Assume it's already a URL
  return lnurl;
}

/**
 * Fetch LNURL-pay metadata from the endpoint.
 * @returns {{ callback: string, minSendable: number, maxSendable: number, metadata: string, ... }}
 */
export async function fetchPayMetadata(lnurl) {
  const url = resolveLnurl(lnurl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`LNURL metadata fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.status === 'ERROR') throw new Error(data.reason || 'LNURL error');
  if (data.tag !== 'payRequest') throw new Error('Not a LNURL-pay endpoint');
  return data;
}

/**
 * Request an invoice from the LNURL-pay callback.
 * @param {string} callback - The callback URL from metadata
 * @param {number} amountMsats - Amount in millisatoshis
 * @returns {{ pr: string, verify?: string }} - Payment request + optional verify URL
 */
export async function fetchInvoice(callback, amountMsats) {
  const sep = callback.includes('?') ? '&' : '?';
  const url = `${callback}${sep}amount=${amountMsats}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Invoice fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.status === 'ERROR') throw new Error(data.reason || 'Invoice error');
  if (!data.pr) throw new Error('No payment request in response');
  return data;
}

/**
 * Poll the LUD-11 verify endpoint for payment status.
 * @param {string} verifyUrl - The verify URL from the invoice response
 * @returns {{ settled: boolean, preimage?: string }}
 */
export async function checkPaymentStatus(verifyUrl) {
  const res = await fetch(verifyUrl);
  if (!res.ok) throw new Error(`Verify fetch failed: ${res.status}`);
  const data = await res.json();
  return { settled: !!data.settled, preimage: data.preimage || null };
}

/**
 * Convert sats to millisatoshis.
 */
export function satsToMsats(sats) {
  return sats * 1000;
}
