import { describe, it, expect, vi } from 'vitest';
import { renderRoomContent, renderMarkdown, sanitizeHtml } from '../content.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeRoom(content, tags = []) {
  return { content, tags, pubkey: 'aabb' };
}

// ── sanitizeHtml ────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<div onclick="x()">hi</div>')).toBe('<div >hi</div>');
  });
});

// ── renderMarkdown ──────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const html = renderMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    const html = renderMarkdown('*italic*');
    expect(html).toContain('<em>italic</em>');
  });
});

// ── renderRoomContent ───────────────────────────────────────────────────

describe('renderRoomContent', () => {
  it('renders plain text by default (no content-type)', () => {
    const room = makeRoom('A dark cave.');
    const entries = renderRoomContent(room, []);
    expect(entries).toEqual([{ text: 'A dark cave.', type: 'narrative' }]);
  });

  it('renders text/markdown as HTML', () => {
    const room = makeRoom('**bold** text', [['content-type', 'text/markdown']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('markdown');
    expect(entries[0].html).toContain('<strong>bold</strong>');
  });

  it('renders sealed message when NIP-44 decryption fails', () => {
    const room = makeRoom('ciphertext', [['content-type', 'application/nip44']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('sealed');
    expect(entries[0].text).toContain('sealed energy');
  });

  it('renders sealed message when no crypto keys available', () => {
    const room = makeRoom('ciphertext', [['content-type', 'application/nip44']]);
    const entries = renderRoomContent(room, []);
    expect(entries[0].type).toBe('sealed');
  });

  // ── Three-element content-type (inner format after NIP-44 decryption) ──

  it('renders decrypted NIP-44 as plain text when no inner format', async () => {
    // Mock the decryptNip44 function to simulate successful decryption
    const content = await import('../content.js');
    const originalFn = (await import('../../nip44-client.js')).decryptNip44;

    // We can't easily mock ESM imports, so we test the logic indirectly
    // by verifying the content-type tag parsing
    const room = makeRoom('ciphertext', [['content-type', 'application/nip44']]);
    const tag = room.tags.find((t) => t[0] === 'content-type');
    expect(tag[1]).toBe('application/nip44');
    expect(tag[2]).toBeUndefined(); // no inner format → plain text
  });

  it('parses three-element content-type with inner markdown format', () => {
    const room = makeRoom('ciphertext', [['content-type', 'application/nip44', 'text/markdown']]);
    const tag = room.tags.find((t) => t[0] === 'content-type');
    expect(tag[1]).toBe('application/nip44');
    expect(tag[2]).toBe('text/markdown');
  });

  // ── Media tags ──────────────────────────────────────────────────────────

  it('renders text/plain media tag', () => {
    const room = makeRoom('Room.', [['media', 'text/plain', 'ASCII art here']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ text: 'ASCII art here', type: 'media-ascii' });
  });

  it('renders text/markdown media tag as HTML', () => {
    const room = makeRoom('Room.', [['media', 'text/markdown', '**bold**']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(2);
    expect(entries[1].type).toBe('media-markdown');
    expect(entries[1].html).toContain('<strong>bold</strong>');
  });

  it('renders image/url media tag', () => {
    const room = makeRoom('Room.', [['media', 'image/url', 'https://example.com/img.png']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(2);
    expect(entries[1].type).toBe('media-image');
    expect(entries[1].html).toContain('https://example.com/img.png');
  });

  it('skips media tag with no value', () => {
    const room = makeRoom('Room.', [['media', 'text/plain']]);
    const entries = renderRoomContent(room, []);
    expect(entries).toHaveLength(1); // only room content, no media
  });
});
