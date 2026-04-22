#!/usr/bin/env node
/**
 * Parses a GitHub Issue body (from YAML form templates) and appends the
 * entry to the correct data/*.json file. Triggered by submission-pr.yml.
 *
 * Env vars injected by the workflow:
 *   ISSUE_BODY, ISSUE_TITLE, ISSUE_NUMBER, ISSUE_USER, ISSUE_LABELS
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const DATA_DIR  = path.join(ROOT, 'data');

const FILE_MAP = {
  nodo:        path.join(DATA_DIR, 'nodos.json'),
  evento:      path.join(DATA_DIR, 'eventos.json'),
  aprendizaje: path.join(DATA_DIR, 'guias.json'),
  comunidad:   path.join(DATA_DIR, 'comunidades.json'),
  anuncio:     path.join(DATA_DIR, 'anuncios.json'),
  mantenedor:  path.join(DATA_DIR, 'destacados.json'),
  multimedia:  path.join(DATA_DIR, 'multimedia.json'),
  herramienta: path.join(DATA_DIR, 'herramientas.json'),
};

// ── GitHub output helpers ─────────────────────────────────────────────────────
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '';

function setOutput(name, value) {
  if (!GITHUB_OUTPUT) return;
  const delimiter = '__END__';
  fs.appendFileSync(GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function finish(status, message, entryName = '') {
  setOutput('status',     status);
  setOutput('message',    message);
  setOutput('entry_name', entryName);
  if (status === 'error') {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

// ── Body parser ───────────────────────────────────────────────────────────────
function parseBody(body) {
  const sections = {};
  let currentKey   = null;
  let currentLines = [];

  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      if (currentKey !== null) {
        sections[currentKey] = currentLines.join('\n').trim();
      }
      currentKey   = line.slice(4).trim().replace(/\s*\*\s*$/, '').trim();
      currentLines = [];
    } else if (currentKey !== null) {
      if (line.trim() !== '_No response_') {
        currentLines.push(line);
      }
    }
  }
  if (currentKey !== null) {
    sections[currentKey] = currentLines.join('\n').trim();
  }
  return sections;
}

function parseCheckboxes(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.match(/^-\s+\[x\]\s+(.+)/i))
    .filter(Boolean)
    .map(m => m[1].trim());
}

function parseList(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l)
    .map(l => l.startsWith('- ') ? l.slice(2).trim() : l)
    .filter(l => l);
}

function clean(val) {
  return (val || '').trim();
}

function shortCategoria(raw) {
  return raw ? raw.split(' — ')[0].trim() : '';
}

function issueId(type, num) {
  return `${type}-${String(num).padStart(4, '0')}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Type detector ─────────────────────────────────────────────────────────────
function detectType(labelsJson) {
  let labels;
  try { labels = JSON.parse(labelsJson); } catch { return null; }
  for (const lbl of labels) {
    if (FILE_MAP[lbl.name]) return lbl.name;
  }
  return null;
}

// ── Builders ──────────────────────────────────────────────────────────────────
function buildNodo(s, num, user) {
  return {
    id:           issueId('nodo', num),
    tipo_entidad: clean(s['Tipo de perfil']),
    tipo_accion:  clean(s['¿Qué haces aquí?']).split(' — ')[0],
    nombre:       clean(s['Nombre del negocio o alias']),
    presentacion: clean(s['Presentación']),
    servicios:    parseList(s['Servicios o productos que ofreces / buscas']),
    pais:         clean(s['País']),
    ciudad:       clean(s['Ciudad / Región']),
    direccion:    clean(s['Dirección física (solo si tienes local)']),
    horario:      clean(s['Horario de atención']),
    maps:         clean(s['Link Google Maps u OpenStreetMap']),
    categoria:    shortCategoria(s['Categoría principal']),
    tags:         (s['Tags adicionales (máx. 5, separados por coma)'] || '')
                    .split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    acepta_crypto: parseCheckboxes(s['Acepta / Paga en']),
    wallet:       clean(s['Wallet pública BTC o ETH (opcional — genera confianza)']),
    web:          clean(s['Página web']),
    email:        clean(s['Email de contacto']),
    telegram:     clean(s['Telegram']),
    nostr:        clean(s['Nostr (npub)']),
    twitter:      clean(s['Twitter / X']),
    instagram:    clean(s['Instagram']),
    youtube:      clean(s['YouTube / Odysee / canal de video']),
    linkedin:     clean(s['LinkedIn']),
    github:       clean(s['GitHub / GitLab (perfiles tech)']),
    portfolio:    clean(s['Portfolio o ejemplos de trabajo']),
    foto:         clean(s['Logo o foto (link a imagen)']),
    idiomas:      clean(s['Idiomas en los que puedes operar']),
    fundacion:    clean(s['Año de inicio de actividad']),
    notas:        clean(s['Información adicional']),
    github_user:  user,
    fecha_alta:   today(),
    aprobado:     true,
  };
}

function buildEvento(s, num, user) {
  return {
    id:          issueId('evento', num),
    nombre:      clean(s['Nombre del evento']),
    tipo:        clean(s['Tipo de evento']),
    fecha:       clean(s['Fecha']),
    hora:        clean(s['Hora y zona horaria']),
    lugar:       clean(s['Lugar']),
    pais:        clean(s['País / Zona']),
    descripcion: clean(s['Descripción del evento']),
    coste:       clean(s['Coste de entrada']),
    registro:    clean(s['Link de registro o más info']),
    organizador: clean(s['Organizador / Contacto']),
    idioma:      clean(s['Idioma del evento']),
    foto:        clean(s['Imagen del evento (opcional)']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

function buildGuia(s, num, user) {
  return {
    id:          issueId('guia', num),
    titulo:      clean(s['Título']),
    tipo:        clean(s['Tipo de recurso']),
    nivel:       clean(s['Nivel']),
    categoria:   clean(s['Categoría']),
    idioma:      clean(s['Idioma del recurso']),
    descripcion: clean(s['Descripción breve']),
    link:        clean(s['Link al recurso']),
    autor:       clean(s['Autor o fuente']),
    gratuito:    clean(s['¿Es gratuito?']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

function buildComunidad(s, num, user) {
  return {
    id:          issueId('com', num),
    nombre:      clean(s['Nombre de la comunidad']),
    plataforma:  clean(s['Plataforma principal']),
    link:        clean(s['Link de acceso']),
    pais:        clean(s['Alcance geográfico']),
    ciudad:      clean(s['Ciudad (si es local)']),
    miembros:    clean(s['Número aproximado de miembros']),
    descripcion: clean(s['Descripción y enfoque']),
    idioma:      clean(s['Idioma principal']),
    contacto:    clean(s['Contacto del responsable o admin']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

function buildAnuncio(s, num, user) {
  return {
    id:          issueId('anuncio', num),
    tipo:        clean(s['Tipo de anuncio']),
    titulo:      clean(s['Título del anuncio']),
    descripcion: clean(s['Descripción completa']),
    zona:        clean(s['Zona o alcance']),
    duracion:    clean(s['Vigencia del anuncio']),
    presupuesto: clean(s['Presupuesto o valor ofrecido (si aplica)']),
    contacto:    clean(s['Contacto']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

function buildMantenedor(s, num, user) {
  const refId   = clean(s['ID de referencia (si ya existe en el directorio)']);
  const rawJson = clean(s['Datos completos en JSON (si es entrada nueva)']);
  const tipo    = clean(s['Tipo de entrada']).toLowerCase();
  const ordenRaw = clean(s['Orden de aparición en Destacados (1 = primero)']) || '99';
  const orden   = parseInt(ordenRaw, 10) || 99;

  const base = {
    id:               issueId('dest', num),
    tipo,
    motivo:           clean(s['Motivo / nota del mantenedor']),
    orden,
    destacado_desde:  today(),
    github_user:      user,
    aprobado:         true,
  };

  if (refId) {
    base.ref_id = refId;
  } else if (rawJson) {
    try {
      const extra = JSON.parse(rawJson);
      Object.assign(base, extra);
      base.curado = true;
    } catch { /* malformed JSON — skip */ }
  }

  return base;
}

function buildMultimedia(s, num, user) {
  return {
    id:          issueId('media', num),
    titulo:      clean(s['Título']),
    tipo:        clean(s['Tipo']),
    descripcion: clean(s['Descripción breve']),
    link:        clean(s['Link principal']),
    autor:       clean(s['Autor / Responsable']),
    idioma:      clean(s['Idioma principal']),
    frecuencia:  clean(s['Frecuencia de publicación']),
    gratuito:    clean(s['¿Es gratuito?']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

function buildHerramienta(s, num, user) {
  return {
    id:          issueId('tool', num),
    nombre:      clean(s['Nombre']),
    tipo:        clean(s['Categoría']),
    descripcion: clean(s['Descripción breve']),
    link:        clean(s['Link oficial']),
    plataforma:  clean(s['Plataforma']),
    open_source: clean(s['¿Es open source?']),
    logo:        clean(s['Logo (URL directa a imagen)']),
    github_user: user,
    fecha_alta:  today(),
    aprobado:    true,
  };
}

const BUILDERS = {
  nodo:        buildNodo,
  evento:      buildEvento,
  aprendizaje: buildGuia,
  comunidad:   buildComunidad,
  anuncio:     buildAnuncio,
  mantenedor:  buildMantenedor,
  multimedia:  buildMultimedia,
  herramienta: buildHerramienta,
};

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const body        = process.env.ISSUE_BODY    || '';
  const issueNumber = parseInt(process.env.ISSUE_NUMBER || '0', 10);
  const issueUser   = process.env.ISSUE_USER    || 'anonymous';
  const labelsJson  = process.env.ISSUE_LABELS  || '[]';

  if (issueNumber <= 0) {
    finish('error', 'Invalid issue number — aborting.');
    return;
  }

  const issueType = detectType(labelsJson);
  if (!issueType) {
    finish('skip', 'No recognised type label found — skipping.');
    return;
  }

  const sections = parseBody(body);
  const builder  = BUILDERS[issueType];
  const entry    = builder(sections, issueNumber, issueUser);

  const jsonFile  = FILE_MAP[issueType];
  const existing  = fs.existsSync(jsonFile)
    ? JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
    : [];

  if (existing.some(e => e.id === entry.id)) {
    finish('skip', `Duplicate: entry ${entry.id} already exists — skipping.`);
    return;
  }

  existing.push(entry);
  fs.writeFileSync(jsonFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');

  const label = entry.nombre || entry.titulo || entry.id;
  finish('success', `✅ Added ${issueType} entry "${label}" → ${path.basename(jsonFile)}`, label);
}

try {
  main();
} catch (err) {
  finish('error', err.message || String(err));
}
