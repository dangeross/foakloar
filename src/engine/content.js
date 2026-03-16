/**
 * content.js — Content rendering helpers (markdown, media, NIP-44 decrypt).
 * No React imports.
 */

import { marked } from 'marked';
import { decryptNip44 } from '../nip44-client.js';
import { getTag, getTags } from '../world.js';

// Configure marked for safe inline rendering (no raw HTML)
marked.setOptions({ breaks: true, gfm: true });

export function sanitizeHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/on\w+="[^"]*"/gi, '');
}

export function renderMarkdown(text) {
  return sanitizeHtml(marked.parse(text));
}

/**
 * Render room content (main body + media tags) into an output array.
 * Each entry is { text, type } or { html, type }.
 * Returns the array of entries.
 */
export function renderRoomContent(room, cryptoKeys) {
  const entries = [];

  const contentTypeTag = room.tags.find((t) => t[0] === 'content-type');
  const contentType = contentTypeTag?.[1];
  const innerFormat = contentTypeTag?.[2]; // e.g. "text/markdown" after NIP-44 decryption

  if (contentType === 'application/nip44') {
    let decrypted = null;
    for (const privKey of cryptoKeys) {
      try {
        decrypted = decryptNip44(room.content, privKey, room.pubkey);
        break;
      } catch {}
    }
    if (decrypted) {
      // Render decrypted content according to inner format (third element of content-type)
      if (innerFormat === 'text/markdown') {
        entries.push({ html: renderMarkdown(decrypted), type: 'markdown' });
      } else {
        entries.push({ text: decrypted, type: 'win' });
      }
    } else {
      entries.push({ text: 'The air hums with sealed energy. You lack the key to read what is written here.', type: 'sealed' });
    }
  } else if (contentType === 'text/markdown') {
    entries.push({ html: renderMarkdown(room.content), type: 'markdown' });
  } else {
    entries.push({ text: room.content, type: 'narrative' });
  }

  // Media tags
  for (const tag of getTags(room, 'media')) {
    const mediaType = tag[1];
    const mediaValue = tag[2];
    if (!mediaValue) continue;
    if (mediaType === 'text/plain' || mediaType === 'text/x-ansi') {
      entries.push({ text: mediaValue, type: 'media-ascii' });
    } else if (mediaType === 'text/markdown') {
      entries.push({ html: renderMarkdown(mediaValue), type: 'media-markdown' });
    } else if (mediaType === 'image/url') {
      entries.push({ html: `<img src="${mediaValue}" alt="media" style="max-width: 100%; margin-top: 0.5rem;" />`, type: 'media-image' });
    }
  }

  return entries;
}
