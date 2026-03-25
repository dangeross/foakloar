/**
 * content.js — Content rendering helpers (markdown, media, NIP-44 decrypt).
 * No React imports.
 */

import { marked } from 'marked';
import { decryptNip44 } from './nip44-client.js';
import { getTag, getTags } from './world.js';

// Configure marked for safe inline rendering (no raw HTML passthrough)
marked.setOptions({ breaks: true, gfm: true });

// Allowlist-based HTML sanitizer — strips everything not explicitly permitted.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'em', 'i', 'strong', 'b', 'u', 's', 'del',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'sup', 'sub',
]);
const ALLOWED_ATTRS = {
  a:   new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'style']),
  td:  new Set(['align']),
  th:  new Set(['align']),
  code: new Set(['class']),  // for syntax highlighting
};
// Protocols allowed in href/src attributes
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function sanitizeHtml(html) {
  // First: strip dangerous elements and their content entirely
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<applet[\s\S]*?<\/applet>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Then: allowlist remaining tags and attributes
  return cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/gi, (match, tagName, attrStr) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ''; // strip unknown tags entirely

    // Closing tags — no attributes
    if (match.startsWith('</')) return `</${tag}>`;

    // Parse and filter attributes
    const allowedSet = ALLOWED_ATTRS[tag];
    if (!attrStr || !allowedSet) {
      // Self-closing tags
      return match.endsWith('/>') ? `<${tag} />` : `<${tag}>`;
    }

    const safeAttrs = [];
    const attrRegex = /([a-zA-Z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      // Block all event handlers (on*)
      if (attrName.startsWith('on')) continue;
      // Only allow permitted attributes for this tag
      if (!allowedSet.has(attrName)) continue;

      // Validate URL attributes (href, src)
      if (attrName === 'href' || attrName === 'src') {
        try {
          const url = new URL(attrValue, 'https://localhost');
          if (!SAFE_PROTOCOLS.has(url.protocol)) continue;
        } catch { continue; }
      }

      // Sanitize style attribute — only allow safe CSS properties
      if (attrName === 'style') {
        const safeStyle = attrValue
          .replace(/expression\s*\(/gi, '')  // block CSS expressions
          .replace(/url\s*\(/gi, '')          // block url() in CSS
          .replace(/javascript:/gi, '')       // block javascript: in CSS
          .replace(/;?\s*position\s*:/gi, '') // block position
          .replace(/;?\s*z-index\s*:/gi, ''); // block z-index
        safeAttrs.push(`style="${safeStyle}"`);
        continue;
      }

      safeAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`);
    }

    const attrString = safeAttrs.length ? ' ' + safeAttrs.join(' ') : '';
    return match.endsWith('/>') ? `<${tag}${attrString} />` : `<${tag}${attrString}>`;
  });
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
      // Render decrypted content — default markdown, text/plain opt-out
      if (innerFormat === 'text/plain') {
        entries.push({ text: decrypted, type: 'win' });
      } else {
        entries.push({ html: renderMarkdown(decrypted), type: 'markdown' });
      }
    } else {
      entries.push({ text: 'The air hums with sealed energy. You lack the key to read what is written here.', type: 'sealed' });
    }
  } else if (contentType === 'text/plain') {
    entries.push({ text: room.content, type: 'narrative' });
  } else {
    // Default: render as markdown (covers text/markdown and no content-type)
    entries.push({ html: renderMarkdown(room.content), type: 'markdown' });
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
      // Validate URL protocol — only http/https allowed (block javascript:, data:, etc.)
      try {
        const url = new URL(mediaValue);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          entries.push({ html: `<img src="${url.href}" alt="media" style="max-width: 100%; margin-top: 0.5rem;" />`, type: 'media-image' });
        }
      } catch { /* invalid URL — skip silently */ }
    }
  }

  return entries;
}
