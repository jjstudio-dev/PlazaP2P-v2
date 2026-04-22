/**
 * Cloudflare Pages Function: POST /api/submit
 *
 * Receives a form submission from submit.html and creates a GitHub Issue
 * on behalf of the user (no GitHub account required).
 *
 * Required Cloudflare secret (set via dashboard or wrangler):
 *   GITHUB_TOKEN  — fine-grained PAT with "Issues: Read and write" on this repo
 *
 * Required Cloudflare variable (set via dashboard or wrangler):
 *   GITHUB_REPO   — e.g. "VoidHashh/plazap2p-v2"
 *
 * Optional Cloudflare KV binding (see wrangler.jsonc):
 *   RATE_LIMIT_KV — KV namespace for IP-based rate limiting
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY_BYTES = 50_000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_TTL = 3600;

const TYPE_LABEL = {
  nodo:        'nodo',
  evento:      'evento',
  aprendizaje: 'aprendizaje',
  comunidad:   'comunidad',
  anuncio:     'anuncio',
  multimedia:  'multimedia',
  herramienta: 'herramienta',
};

const TYPE_PREFIX = {
  nodo:        '[NODO]',
  evento:      '[EVENTO]',
  aprendizaje: '[APRENDIZAJE]',
  comunidad:   '[COMUNIDAD]',
  anuncio:     '[ANUNCIO]',
  multimedia:  '[MULTIMEDIA]',
  herramienta: '[HERRAMIENTA]',
};

const REQUIRED_FIELDS = {
  nodo:        ['nombre', 'pais', 'presentacion', 'tipo_entidad', 'tipo_accion', 'acepta_crypto'],
  evento:      ['nombre', 'fecha', 'lugar', 'descripcion', 'organizador'],
  aprendizaje: ['titulo', 'tipo', 'nivel', 'categoria', 'descripcion', 'link'],
  comunidad:   ['nombre', 'plataforma', 'link', 'pais', 'descripcion'],
  anuncio:     ['tipo', 'titulo', 'descripcion', 'zona', 'contacto'],
  multimedia:  ['titulo', 'tipo', 'descripcion', 'link'],
  herramienta: ['nombre', 'tipo', 'descripcion', 'link'],
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    return await handlePost(context);
  } catch (err) {
    console.error('Unhandled error:', err);
    return json({ ok: false, error: 'Error interno del servidor. Inténtalo más tarde.' }, 500);
  }
}

async function handlePost({ request, env }) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ ok: false, error: 'Servidor no configurado correctamente.' }, 500);
  }

  // Payload size guard (before parsing)
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'Solicitud demasiado grande.' }, 413);
  }

  // Rate limiting via Cloudflare KV (graceful fallback if KV not configured)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    const limited = await checkRateLimit(env.RATE_LIMIT_KV, ip);
    if (limited) {
      return json({ ok: false, error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' }, 429);
    }
  }

  // Parse body
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  // Honeypot check
  if (payload?.data?._hp) {
    return json({ ok: true, issue_url: null }); // silently discard bot submissions
  }

  const { type, data } = payload;

  if (!TYPE_LABEL[type] || !data || typeof data !== 'object') {
    return json({ ok: false, error: 'Tipo de entrada no reconocido.' }, 400);
  }

  // Server-side required field validation
  const missing = (REQUIRED_FIELDS[type] || []).filter(f => {
    const v = data[f];
    return !v || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length) {
    return json({ ok: false, error: `Faltan campos obligatorios: ${missing.join(', ')}` }, 400);
  }

  // Optional email format validation
  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      return json({ ok: false, error: 'Formato de email inválido.' }, 400);
    }
  }

  // Sanitize all text values (strip markdown headings + HTML tags)
  const safeData = sanitizeData(data);

  // Validate owner/repo
  const repoPath = env.GITHUB_REPO.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const [owner, repo] = repoPath.split('/');
  if (!owner || !repo) {
    return json({ ok: false, error: 'Configuración de repositorio inválida.' }, 500);
  }

  const issueBody  = buildIssueBody(type, safeData);
  const issueTitle = buildIssueTitle(type, safeData);

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method:  'POST',
    headers: {
      'Authorization':        `Bearer ${env.GITHUB_TOKEN}`,
      'Accept':               'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type':         'application/json',
      'User-Agent':           'PlazaP2P-Submit-Function/2.0',
    },
    body: JSON.stringify({
      title:  issueTitle,
      body:   issueBody,
      labels: [TYPE_LABEL[type], 'pendiente-revision'],
    }),
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    console.error('GitHub API error:', ghRes.status, errText);
    return json({ ok: false, error: 'Error al crear el issue en GitHub. Inténtalo más tarde.' }, 502);
  }

  const issue = await ghRes.json();
  return json({ ok: true, issue_url: issue.html_url });
}

// ── Rate limiting ──────────────────────────────────────────────────────────────
async function checkRateLimit(kv, ip) {
  const key = `rl:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= RATE_LIMIT_MAX) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_TTL });
  return false;
}

// ── Sanitization ───────────────────────────────────────────────────────────────
function sanitizeText(v) {
  if (typeof v !== 'string') return v;
  return v
    .replace(/^#{1,6}\s+/gm, '')  // strip markdown headings (section injection)
    .replace(/<[^>]*>/g, '')        // strip HTML tags
    .trim();
}

function sanitizeData(data) {
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === '_hp') continue;
    out[key] = Array.isArray(val)
      ? val.map(v => sanitizeText(v))
      : sanitizeText(val);
  }
  return out;
}

// ── Issue body builder ─────────────────────────────────────────────────────────
function buildIssueBody(type, data) {
  const builders = { nodo, evento, aprendizaje, comunidad, anuncio, multimedia, herramienta };
  return builders[type](data);
}

function buildIssueTitle(type, data) {
  const name = data.nombre || data.titulo || 'Sin título';
  return `${TYPE_PREFIX[type]} ${name}`;
}

function field(label, value) {
  const v = Array.isArray(value)
    ? value.map(x => `- [x] ${x}`).join('\n')
    : (value || '').trim();
  return `### ${label}\n\n${v || '_No response_'}\n\n`;
}

function nodo(d) {
  return [
    field('Tipo de perfil *',                              d.tipo_entidad),
    field('¿Qué haces aquí? *',                           d.tipo_accion),
    field('Nombre del negocio o alias *',                  d.nombre),
    field('Presentación *',                                d.presentacion),
    field('Servicios o productos que ofreces / buscas *', d.servicios),
    field('País *',                                        d.pais),
    field('Ciudad / Región',                               d.ciudad),
    field('Dirección física (solo si tienes local)',       d.direccion),
    field('Horario de atención',                           d.horario),
    field('Link Google Maps u OpenStreetMap',              d.maps),
    field('Categoría principal *',                         d.categoria),
    field('Tags adicionales (máx. 5, separados por coma)',d.tags),
    field('Acepta / Paga en *',                            d.acepta_crypto || []),
    field('Wallet pública BTC o ETH (opcional — genera confianza)', d.wallet),
    field('Página web',                                    d.web),
    field('Email de contacto',                             d.email),
    field('Telegram',                                      d.telegram),
    field('Nostr (npub)',                                  d.nostr),
    field('Twitter / X',                                   d.twitter),
    field('Instagram',                                     d.instagram),
    field('YouTube / Odysee / canal de video',             d.youtube),
    field('LinkedIn',                                      d.linkedin),
    field('GitHub / GitLab (perfiles tech)',               d.github),
    field('Portfolio o ejemplos de trabajo',               d.portfolio),
    field('Logo o foto (link a imagen)',                   d.foto),
    field('Idiomas en los que puedes operar',              d.idiomas),
    field('Año de inicio de actividad',                    d.fundacion),
    field('Información adicional',                         d.notas),
  ].join('');
}

function evento(d) {
  return [
    field('Nombre del evento',              d.nombre),
    field('Tipo de evento',                 d.tipo),
    field('Fecha',                          d.fecha),
    field('Hora y zona horaria',            d.hora),
    field('Lugar',                          d.lugar),
    field('País / Zona',                    d.pais),
    field('Descripción del evento',         d.descripcion),
    field('Coste de entrada',               d.coste),
    field('Link de registro o más info',    d.registro),
    field('Organizador / Contacto',         d.organizador),
    field('Idioma del evento',              d.idioma),
    field('Imagen del evento (opcional)',   d.foto),
  ].join('');
}

function aprendizaje(d) {
  return [
    field('Título',            d.titulo),
    field('Tipo de recurso',   d.tipo),
    field('Nivel',             d.nivel),
    field('Categoría',         d.categoria),
    field('Idioma del recurso',d.idioma),
    field('Descripción breve', d.descripcion),
    field('Link al recurso',   d.link),
    field('Autor o fuente',    d.autor),
    field('¿Es gratuito?',     d.gratuito),
  ].join('');
}

function comunidad(d) {
  return [
    field('Nombre de la comunidad',              d.nombre),
    field('Plataforma principal',                d.plataforma),
    field('Link de acceso',                      d.link),
    field('Alcance geográfico',                  d.pais),
    field('Ciudad (si es local)',                d.ciudad),
    field('Número aproximado de miembros',       d.miembros),
    field('Descripción y enfoque',               d.descripcion),
    field('Idioma principal',                    d.idioma),
    field('Contacto del responsable o admin',    d.contacto),
  ].join('');
}

function anuncio(d) {
  return [
    field('Tipo de anuncio',                       d.tipo),
    field('Título del anuncio',                    d.titulo),
    field('Descripción completa',                  d.descripcion),
    field('Zona o alcance',                        d.zona),
    field('Vigencia del anuncio',                  d.duracion),
    field('Presupuesto o valor ofrecido (si aplica)', d.presupuesto),
    field('Contacto',                              d.contacto),
  ].join('');
}

function multimedia(d) {
  return [
    field('Título',                     d.titulo),
    field('Tipo',                       d.tipo),
    field('Descripción breve',          d.descripcion),
    field('Link principal',             d.link),
    field('Autor / Responsable',        d.autor),
    field('Idioma principal',           d.idioma),
    field('Frecuencia de publicación',  d.frecuencia),
    field('¿Es gratuito?',              d.gratuito),
  ].join('');
}

function herramienta(d) {
  return [
    field('Nombre',                    d.nombre),
    field('Categoría',                 d.tipo),
    field('Descripción breve',         d.descripcion),
    field('Link oficial',              d.link),
    field('Plataforma',                d.plataforma),
    field('¿Es open source?',          d.open_source),
    field('Logo (URL directa a imagen)', d.logo),
  ].join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
