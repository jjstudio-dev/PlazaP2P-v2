#!/usr/bin/env node
/**
 * Generates feed.xml (RSS 2.0) from all data/*.json files.
 * Run: node scripts/generate-feed.mjs
 * Env: SITE_URL (optional, defaults to https://plazap2p.pages.dev)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const SITE_URL = process.env.SITE_URL || 'https://plazap2p.pages.dev';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return [];
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const all = [
  ...readJson('nodos.json').map(e => ({ title: e.nombre, desc: e.presentacion, date: e.fecha_alta, tab: 'directorio' })),
  ...readJson('eventos.json').map(e => ({ title: e.nombre, desc: e.descripcion, date: e.fecha_alta, tab: 'eventos' })),
  ...readJson('guias.json').map(e => ({ title: e.titulo, desc: e.descripcion, date: e.fecha_alta, tab: 'aprende' })),
  ...readJson('comunidades.json').map(e => ({ title: e.nombre, desc: e.descripcion, date: e.fecha_alta, tab: 'comunidades' })),
  ...readJson('anuncios.json').map(e => ({ title: e.titulo, desc: e.descripcion, date: e.fecha_alta, tab: 'anuncios' })),
  ...readJson('multimedia.json').map(e => ({ title: e.titulo, desc: e.descripcion, date: e.fecha_alta, tab: 'multimedia' })),
  ...readJson('herramientas.json').map(e => ({ title: e.nombre, desc: e.descripcion, date: e.fecha_alta, tab: 'herramientas' })),
  ...readJson('nostr.json').map(e => ({ title: e.nombre, desc: e.descripcion, date: e.fecha_alta, tab: 'nostr' })),
];

const items = all
  .filter(e => e.title && e.date)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 20);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PlazaP2P — Directorio Bitcoin España</title>
    <link>${SITE_URL}</link>
    <description>Últimas entradas del directorio P2P de economía circular con Bitcoin</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map(e => `    <item>
      <title>${esc(e.title)}</title>
      <link>${SITE_URL}/?tab=${e.tab}</link>
      <description>${esc(e.desc)}</description>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
    </item>`).join('\n')}
  </channel>
</rss>
`;

fs.writeFileSync(path.join(ROOT, 'feed.xml'), xml, 'utf8');
console.log(`✅ feed.xml generated — ${items.length} items`);
