/**
 * Guide — Tutorial documentation pages.
 *
 * Renders markdown guide pages with sidebar navigation,
 * themed to match the Tide's End coastal palette.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { navigateToGuide, navigateToLobby, navigateToWorld } from '../services/router.js';
import { validateImport, importEvents, parseJsonLenient } from '../builder/draftStore.js';
import ImportPreviewPanel from '../builder/components/ImportPreviewPanel.jsx';

// Import all guide markdown files at build time
const guideModules = import.meta.glob('/docs/guide/*.md', { query: '?raw', import: 'default' });
// Import all tutorial JSON files at build time
const tutorialModules = import.meta.glob('/docs/guide/tutorials/*.json', { query: '?raw', import: 'default' });

const TUTORIALS = [
  { id: '01-getting-started', title: 'Getting Started', subtitle: 'Worlds, Places, Portals' },
  { id: '02-items-and-features', title: 'Items & Features', subtitle: 'Pickable objects, fixed things' },
  { id: '03-state-and-logic', title: 'State & Logic', subtitle: 'Transitions, Requires, Counters' },
  { id: '04-characters', title: 'Characters', subtitle: 'NPCs, Dialogue, Roaming' },
  { id: '05-puzzles', title: 'Puzzles & Secrets', subtitle: 'Riddles, Sequences, Clues' },
  { id: '06-quests', title: 'Quests', subtitle: 'Tracking, Quest types' },
  { id: '07-combat', title: 'Combat', subtitle: 'Weapons, Health, Death' },
  { id: '08-sound', title: 'Sound', subtitle: 'Ambient, Layers, Effects' },
  { id: '09-recipes', title: 'Recipes', subtitle: 'Crafting, Ingredients' },
  { id: '10-payments', title: 'Payments', subtitle: 'Lightning, LNURL gates' },
  { id: '11-endgame', title: 'Endgame', subtitle: 'Endings, Restart' },
];

const SHOWCASES = [
  { id: 'cartographers-instrument', title: "The Cartographer's Instrument", subtitle: 'A musical puzzle world' },
];

const PAGES = [...TUTORIALS, ...SHOWCASES];

// Tide's End theme
const THEME = {
  bg: '#1a1a2e',
  text: '#c8c8a9',
  accent: '#5e8b7e',
  highlight: '#d4a574',
  dim: '#5e8b7e',
  codeBg: '#12122a',
  tableBorder: '#3a3a5e',
  sidebarBg: '#151528',
};

const GUIDE_CSS = `
  .guide-content {
    line-height: 1.7;
    font-size: 0.8rem;
  }
  .guide-content h1 {
    color: ${THEME.highlight};
    font-size: 1.3rem;
    margin: 1.5rem 0 0.75rem;
    border-bottom: 1px solid ${THEME.tableBorder};
    padding-bottom: 0.3rem;
  }
  .guide-content h2 {
    color: ${THEME.highlight};
    font-size: 1rem;
    margin: 1.2rem 0 0.5rem;
  }
  .guide-content h3 {
    color: ${THEME.accent};
    font-size: 0.85rem;
    margin: 1rem 0 0.4rem;
  }
  .guide-content p {
    margin: 0.5rem 0;
  }
  .guide-content ul, .guide-content ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  .guide-content li {
    margin: 0.25rem 0;
  }
  .guide-content code {
    background: ${THEME.codeBg};
    color: ${THEME.highlight};
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-size: 0.75rem;
  }
  .guide-content pre {
    background: ${THEME.codeBg};
    border: 1px solid ${THEME.tableBorder};
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.75rem 0;
    border-radius: 3px;
  }
  .guide-content pre code {
    background: none;
    padding: 0;
    color: ${THEME.text};
    font-size: 0.7rem;
  }
  .guide-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75rem 0;
    font-size: 0.7rem;
  }
  .guide-content th {
    background: ${THEME.codeBg};
    color: ${THEME.highlight};
    text-align: left;
    padding: 0.3rem 0.5rem;
    border: 1px solid ${THEME.tableBorder};
  }
  .guide-content td {
    padding: 0.3rem 0.5rem;
    border: 1px solid ${THEME.tableBorder};
    vertical-align: top;
  }
  .guide-content blockquote {
    border-left: 3px solid ${THEME.accent};
    margin: 0.75rem 0;
    padding: 0.3rem 0.75rem;
    color: ${THEME.dim};
    font-style: italic;
  }
  .guide-content a {
    color: ${THEME.highlight};
    text-decoration: underline;
    text-decoration-color: ${THEME.tableBorder};
  }
  .guide-content a:hover {
    text-decoration-color: ${THEME.highlight};
  }
  .guide-content strong {
    color: ${THEME.highlight};
  }
  .guide-content hr {
    border: none;
    border-top: 1px solid ${THEME.tableBorder};
    margin: 1.5rem 0;
  }
  .guide-content img {
    max-width: 100%;
  }
  .guide-content ul {
    list-style: none;
  }
  .guide-content ul li::before {
    content: '·';
    color: ${THEME.accent};
    margin-right: 0.5em;
    margin-left: -1em;
  }
  .guide-content ol li::marker {
    color: ${THEME.accent};
  }

  /* Scrollbar — match theme */
  html::-webkit-scrollbar, .guide-root::-webkit-scrollbar { width: 6px; }
  html::-webkit-scrollbar-track, .guide-root::-webkit-scrollbar-track { background: ${THEME.bg}; }
  html::-webkit-scrollbar-thumb, .guide-root::-webkit-scrollbar-thumb { background: ${THEME.tableBorder}; border-radius: 3px; }
  html::-webkit-scrollbar-thumb:hover, .guide-root::-webkit-scrollbar-thumb:hover { background: ${THEME.accent}; }
  html { scrollbar-color: ${THEME.tableBorder} ${THEME.bg}; }
`;

function Sidebar({ currentPage, onNavigate, open, onToggle }) {
  return (
    <>
      {/* Mobile toggle — only visible on small screens */}
      <button
        className="cursor-pointer hover:opacity-80"
        style={{
          position: 'fixed', top: '0.5rem', left: '0.5rem', zIndex: 50,
          color: THEME.highlight, background: THEME.sidebarBg,
          border: `1px solid ${THEME.tableBorder}`,
          font: 'inherit', fontSize: '0.7rem', padding: '4px 8px',
          display: 'none',
        }}
        id="guide-sidebar-toggle"
        onClick={onToggle}
      >
        ☰ guide
      </button>

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: '200px',
          backgroundColor: THEME.sidebarBg,
          borderRight: `1px solid ${THEME.tableBorder}`,
          padding: '1rem 0.75rem',
          overflowY: 'auto',
          transform: open ? 'translateX(0)' : undefined,
          transition: 'transform 0.2s ease',
          zIndex: 40,
        }}
        className="guide-sidebar"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigateToLobby()}
            className="cursor-pointer hover:opacity-80"
            style={{ color: THEME.dim, background: 'none', border: 'none', font: 'inherit', fontSize: '0.65rem' }}
          >
            ← lobby
          </button>
          <button
            onClick={onToggle}
            className="cursor-pointer hover:opacity-80 guide-sidebar-close"
            style={{
              color: THEME.dim, background: 'none', border: 'none',
              font: 'inherit', fontSize: '0.7rem', display: 'none',
            }}
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => onNavigate(null)}
          className="block w-full text-left cursor-pointer hover:opacity-80 mb-3"
          style={{
            color: !currentPage ? THEME.highlight : THEME.text,
            background: 'none', border: 'none', font: 'inherit', fontSize: '0.8rem',
            fontWeight: !currentPage ? 'bold' : 'normal',
          }}
        >
          Guide
        </button>

        <div className="flex flex-col gap-0.5">
          {TUTORIALS.map((p) => {
            const active = currentPage === p.id;
            const num = p.id.split('-')[0];
            return (
              <button
                key={p.id}
                onClick={() => { onNavigate(p.id); if (window.innerWidth < 640) onToggle(); }}
                className="block w-full text-left cursor-pointer hover:opacity-80 px-2 py-1"
                style={{
                  color: active ? THEME.highlight : THEME.text,
                  background: active ? THEME.codeBg : 'none',
                  border: 'none', font: 'inherit', fontSize: '0.65rem',
                  borderLeft: active ? `2px solid ${THEME.highlight}` : '2px solid transparent',
                }}
              >
                <span style={{ color: THEME.dim, marginRight: '0.3em' }}>{num}.</span>
                {p.title}
              </button>
            );
          })}
        </div>

        {SHOWCASES.length > 0 && (
          <>
            <div style={{ borderTop: `1px solid ${THEME.tableBorder}`, margin: '0.75rem 0 0.5rem', paddingTop: '0.5rem' }}>
              <span style={{ color: THEME.highlight, fontSize: '0.7rem' }}>Showcase</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {SHOWCASES.map((p) => {
                const active = currentPage === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { onNavigate(p.id); if (window.innerWidth < 640) onToggle(); }}
                    className="block w-full text-left cursor-pointer hover:opacity-80 px-2 py-1"
                    style={{
                      color: active ? THEME.highlight : THEME.text,
                      background: active ? THEME.codeBg : 'none',
                      border: 'none', font: 'inherit', fontSize: '0.65rem',
                      borderLeft: active ? `2px solid ${THEME.highlight}` : '2px solid transparent',
                    }}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 39,
            display: 'none',
          }}
          className="guide-overlay"
          onClick={onToggle}
        />
      )}

      {/* Mobile styles */}
      <style>{`
        @media (max-width: 639px) {
          #guide-sidebar-toggle { display: ${open ? 'none' : 'block'} !important; }
          .guide-sidebar { transform: translateX(${open ? '0' : '-100%'}) !important; }
          .guide-overlay { display: ${open ? 'block' : 'none'} !important; }
          .guide-main { margin-left: 0 !important; padding-left: 1rem !important; padding-top: 2.5rem !important; }
          .guide-sidebar-close { display: block !important; }
        }
      `}</style>
    </>
  );
}

function GuideTOC({ onNavigate }) {
  return (
    <div>
      <h1 style={{ color: THEME.highlight, fontSize: '1.3rem', marginBottom: '0.5rem', fontWeight: 'normal' }}>
        foakloar guide
      </h1>
      <p style={{ color: THEME.dim, fontSize: '0.75rem', marginBottom: '1.5rem', maxWidth: 600 }}>
        Learn to build text adventure worlds. Each tutorial has a companion world you can import and explore.
      </p>
      <div className="flex flex-col gap-1" style={{ maxWidth: 600 }}>
        {TUTORIALS.map((p) => {
          const num = p.id.split('-')[0];
          return (
            <button
              key={p.id}
              onClick={() => onNavigate(p.id)}
              className="text-left cursor-pointer hover:opacity-80 px-3 py-2"
              style={{
                color: THEME.text,
                background: 'none',
                border: `1px solid ${THEME.tableBorder}`,
                font: 'inherit', fontSize: '0.75rem',
              }}
            >
              <span style={{ color: THEME.highlight, marginRight: '0.5em' }}>
                {num}.
              </span>
              <strong style={{ color: THEME.text }}>{p.title}</strong>
              <span style={{ color: THEME.dim, marginLeft: '0.5em', fontSize: '0.65rem' }}>
                — {p.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {SHOWCASES.length > 0 && (
        <>
          <h2 style={{ color: THEME.highlight, fontSize: '1rem', marginTop: '2rem', marginBottom: '0.5rem', fontWeight: 'normal' }}>
            Showcase
          </h2>
          <p style={{ color: THEME.dim, fontSize: '0.75rem', marginBottom: '1rem', maxWidth: 600 }}>
            Complete worlds that demonstrate advanced mechanics working together.
          </p>
          <div className="flex flex-col gap-1" style={{ maxWidth: 600 }}>
            {SHOWCASES.map((p) => (
              <button
                key={p.id}
                onClick={() => onNavigate(p.id)}
                className="text-left cursor-pointer hover:opacity-80 px-3 py-2"
                style={{
                  color: THEME.text,
                  background: 'none',
                  border: `1px solid ${THEME.tableBorder}`,
                  font: 'inherit', fontSize: '0.75rem',
                }}
              >
                <strong style={{ color: THEME.text }}>{p.title}</strong>
                <span style={{ color: THEME.dim, marginLeft: '0.5em', fontSize: '0.65rem' }}>
                  — {p.subtitle}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GuidePage({ pageId }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importPreview, setImportPreview] = useState(null);

  async function handleTutorialImport(filename) {
    const key = `/docs/guide/tutorials/${filename}`;
    const loader = tutorialModules[key];
    if (!loader) return;
    try {
      const raw = await loader();
      const data = parseJsonLenient(raw);
      // Detect world slug from the data
      const worldEvent = data.events?.find((e) => e.tags?.find((t) => t[0] === 'type')?.[1] === 'world');
      const detectedSlug = worldEvent?.tags?.find((t) => t[0] === 't')?.[1];
      if (!detectedSlug) return;
      const validation = validateImport(detectedSlug, data);
      setImportPreview({ validation, data, worldSlug: detectedSlug });
    } catch (e) {
      console.warn('Tutorial import error:', e);
    }
  }

  useEffect(() => {
    setLoading(true);
    const key = `/docs/guide/${pageId}.md`;
    const loader = guideModules[key];
    if (loader) {
      loader().then((raw) => {
        setContent(raw);
        setLoading(false);
      }).catch(() => {
        setContent('# Page not found');
        setLoading(false);
      });
    } else {
      setContent('# Page not found');
      setLoading(false);
    }
    window.scrollTo(0, 0);
  }, [pageId]);

  const html = useMemo(() => {
    if (!content) return '';
    let rendered = marked(content, { breaks: true });
    // Convert relative tutorial links (any JSON in tutorials/)
    rendered = rendered.replace(
      /<a href="tutorials\/([^"]+\.json)"[^>]*>([^<]+)<\/a>/g,
      '<a href="/guide/$1" class="tutorial-link" style="color:' + THEME.highlight + '">$2</a>'
    );
    // Convert standalone page ID references to links (not inside tags or filenames)
    for (const p of PAGES) {
      const re = new RegExp(`(?<![/\\w.-])(${p.id})(?![/\\w."<])`, 'g');
      rendered = rendered.replace(re, `<a href="/guide/${p.id}" style="color:${THEME.highlight};text-decoration:underline">${p.id}</a>`);
    }
    // Convert "02: Items and Features" style bold references to links
    for (const p of PAGES) {
      const num = p.id.split('-')[0];
      const re = new RegExp(`<strong>${num}:([^<]+)<\\/strong>`, 'g');
      rendered = rendered.replace(re, `<a href="/guide/${p.id}" style="color:${THEME.highlight};text-decoration:underline;font-weight:bold">${num}:$1</a>`);
    }
    return rendered;
  }, [content]);

  const idx = PAGES.findIndex((p) => p.id === pageId);
  const prev = idx > 0 ? PAGES[idx - 1] : null;
  const next = idx < PAGES.length - 1 ? PAGES[idx + 1] : null;

  if (loading) return <p style={{ color: THEME.dim }}>Loading...</p>;

  return (
    <div>
      <div
        className="guide-content"
        style={{ maxWidth: 700 }}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const link = e.target.closest('a[href^="/guide/"]');
          if (link) {
            e.preventDefault();
            const path = link.getAttribute('href');
            // Tutorial JSON link — trigger import
            const jsonMatch = path.match(/^\/guide\/([^/]+\.json)$/);
            if (jsonMatch) {
              handleTutorialImport(jsonMatch[1]);
              return;
            }
            // Guide page link — navigate
            const pageMatch = path.match(/^\/guide\/([a-z0-9-]+)/);
            if (pageMatch) navigateToGuide(pageMatch[1]);
          }
        }}
      />
      <div className="flex justify-between mt-6 pt-3" style={{ borderTop: `1px solid ${THEME.tableBorder}`, maxWidth: 700 }}>
        {prev ? (
          <button
            onClick={() => navigateToGuide(prev.id)}
            className="cursor-pointer hover:opacity-80"
            style={{ color: THEME.dim, background: 'none', border: 'none', font: 'inherit', fontSize: '0.7rem' }}
          >
            ← {prev.title}
          </button>
        ) : <span />}
        {next ? (
          <button
            onClick={() => navigateToGuide(next.id)}
            className="cursor-pointer hover:opacity-80"
            style={{ color: THEME.highlight, background: 'none', border: 'none', font: 'inherit', fontSize: '0.7rem' }}
          >
            {next.title} →
          </button>
        ) : <span />}
      </div>

      {/* Import preview panel */}
      {importPreview && (
        <ImportPreviewPanel
          validation={importPreview.validation}
          onConfirm={() => {
            importEvents(importPreview.worldSlug, importPreview.data);
            setImportPreview(null);
            navigateToWorld(importPreview.worldSlug);
          }}
          onClose={() => setImportPreview(null)}
        />
      )}
    </div>
  );
}

export default function Guide({ guidePage }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (pageId) => {
    navigateToGuide(pageId);
    setSidebarOpen(false);
  };

  return (
    <div className="font-mono guide-root" style={{
      backgroundColor: THEME.bg,
      color: THEME.text,
      minHeight: '100vh',
      '--colour-bg': THEME.bg,
      '--colour-text': THEME.text,
      '--colour-dim': THEME.dim,
      '--colour-highlight': THEME.highlight,
      '--colour-title': THEME.highlight,
      '--colour-item': THEME.highlight,
      '--colour-error': '#c47070',
      '--colour-exits': THEME.accent,
      '--colour-clue': THEME.accent,
    }}>
      <style>{GUIDE_CSS}</style>
      <Sidebar
        currentPage={guidePage}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="guide-main" style={{ marginLeft: '200px', padding: '1.5rem 2rem' }}>
        {guidePage ? (
          <GuidePage pageId={guidePage} />
        ) : (
          <GuideTOC onNavigate={handleNavigate} />
        )}
      </div>
    </div>
  );
}
