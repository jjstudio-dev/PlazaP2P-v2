/* ============================================================
   PLAZAP2P — app.js
   ============================================================ */

// ── i18n ───────────────────────────────────────────────────
const TRANSLATIONS = {
  es: {
    'nav.directorio':   'Directorio',
    'nav.eventos':      'Eventos',
    'nav.aprende':      'Aprende',
    'nav.comunidades':  'Comunidades',
    'nav.anuncios':     'Tablón',
    'nav.multimedia':   'Multimedia',
    'nav.herramientas': 'Herramientas',
    'nav.mapa':         'Mapa',
    'nav.nostr':        'Nostr',
    'hero.eyebrow':     '// RED P2P · BITCOIN · ESPAÑA //',
    'hero.lead':        'La plaza de la',
    'hero.main':        'economía circular',
    'hero.sub':         'Servicios reales. Personas reales. Sin intermediarios.',
    'btn.addnode':      '⊕ AÑADIR NODO',
  },
  en: {
    'nav.directorio':   'Directory',
    'nav.eventos':      'Events',
    'nav.aprende':      'Learn',
    'nav.comunidades':  'Communities',
    'nav.anuncios':     'Board',
    'nav.multimedia':   'Multimedia',
    'nav.herramientas': 'Tools',
    'nav.mapa':         'Map',
    'nav.nostr':        'Nostr',
    'hero.eyebrow':     '// P2P NETWORK · BITCOIN · SPAIN //',
    'hero.lead':        'The plaza of the',
    'hero.main':        'circular economy',
    'hero.sub':         'Real services. Real people. No middlemen.',
    'btn.addnode':      '⊕ ADD NODE',
  },
};

let _currentLang = localStorage.getItem('lang') || 'es';

function applyLang(lang) {
  _currentLang = lang;
  localStorage.setItem('lang', lang);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.es;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = lang === 'es' ? 'EN' : 'ES';
}

function toggleLang() {
  applyLang(_currentLang === 'es' ? 'en' : 'es');
}

// ── Security helpers ──────────────────────────────────────
function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, c => map[c]);
}

function isSafeUrl(str) {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

const DATA_BASE = './data/';
const DATA_FILES = {
  nodos:        'nodos.json',
  eventos:      'eventos.json',
  guias:        'guias.json',
  comunidades:  'comunidades.json',
  anuncios:     'anuncios.json',
  destacados:   'destacados.json',
  multimedia:   'multimedia.json',
  herramientas: 'herramientas.json',
  nostr:        'nostr.json',
};

let _initDone = false;

let state = {
  nodos:          [],
  eventos:        [],
  guias:          [],
  comunidades:    [],
  anuncios:       [],
  destacados:     [],
  multimedia:     [],
  herramientas:   [],
  nostr:          [],
  mantenimiento:  {},
  activeTab:      'directorio'
};

// ── Bootstrap ──────────────────────────────────────────────
async function init() {
  showSkeletons('nodos-grid', 6);
  await loadAllData();
  setupTabs();
  setupFilters();
  setupHeroSearch();
  renderAll();       // URL updates bloqueadas durante init (_initDone = false)
  updateCounts();
  updateStats();
  applyLang(_currentLang);
  _initDone = true;  // habilitar URL updates
  restoreFilterState(); // lee la URL original y activa la sección correcta
}

function scrollToNav() {
  switchTab('directorio');
  document.getElementById('main-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupHeroSearch() {
  const input = document.getElementById('hero-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const val = input.value;
    switchTab('directorio');
    const dirInput = document.querySelector('#panel-directorio [data-filter="search"]');
    if (dirInput) { dirInput.value = val; renderNodos(); }
    if (val.length === 1) {
      document.getElementById('main-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

async function loadAllData() {
  const loads = Object.entries(DATA_FILES).map(async ([key, file]) => {
    try {
      const res = await fetch(DATA_BASE + file);
      const data = await res.json();
      state[key] = data.filter(d => d.aprobado !== false);
    } catch {
      state[key] = [];
    }
  });

  const loadMant = fetch(DATA_BASE + 'mantenimiento.json')
    .then(r => r.json())
    .then(d => { state.mantenimiento = d; })
    .catch(() => {});

  await Promise.all([...loads, loadMant]);
}

// ── URL filter state ───────────────────────────────────────
function pushFilterState(tabName, filters) {
  if (!_initDone) return;
  const params = new URLSearchParams();
  params.set('tab', tabName);
  Object.entries(filters).forEach(([k, v]) => {
    if (v && k !== 'orden') params.set(k, v);
    else if (v && k === 'orden' && v !== 'reciente') params.set(k, v);
  });
  history.replaceState(null, '', '?' + params.toString());
}

function restoreFilterState() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') || 'directorio';

  // Activate the correct tab visually first
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.querySelectorAll('.section-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + tab)
  );
  state.activeTab = tab;

  // Restore filter values into the panel's inputs
  const panel = document.getElementById('panel-' + tab);
  if (panel) {
    params.forEach((value, key) => {
      if (key === 'tab') return;
      const el = panel.querySelector(`[data-filter="${key}"]`);
      if (el) el.value = value;
    });
  }

  // Re-render with restored filters
  if (tab === 'directorio')   renderNodos();
  if (tab === 'eventos')      renderEventos();
  if (tab === 'aprende')      renderGuias();
  if (tab === 'comunidades')  renderComunidades();
  if (tab === 'anuncios')     renderAnuncios();
  if (tab === 'multimedia')   renderMultimedia();
  if (tab === 'herramientas') renderHerramientas();
  if (tab === 'mapa')         renderMapa();
  if (tab === 'nostr')        renderNostr();
}

// ── Tab switching ──────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.section-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + tabName)
  );

  if (tabName === 'directorio')   renderNodos();
  if (tabName === 'eventos')      renderEventos();
  if (tabName === 'aprende')      renderGuias();
  if (tabName === 'comunidades')  renderComunidades();
  if (tabName === 'anuncios')     renderAnuncios();
  if (tabName === 'multimedia')   renderMultimedia();
  if (tabName === 'herramientas') renderHerramientas();
  if (tabName === 'mapa')         renderMapa();
  if (tabName === 'nostr')        renderNostr();
}

// ── Filters ────────────────────────────────────────────────
function setupFilters() {
  const inputs = document.querySelectorAll('.filter-select, .filter-input');
  inputs.forEach(el => el.addEventListener('change', handleFilterChange));
  inputs.forEach(el => el.addEventListener('input',  handleFilterChange));
  document.querySelectorAll('.btn-clear-filters').forEach(btn =>
    btn.addEventListener('click', clearFilters)
  );
}

function handleFilterChange(e) {
  const panel = e.target.closest('.section-panel');
  if (!panel) return;
  const section = panel.id.replace('panel-', '');
  if (section === 'directorio')   renderNodos();
  if (section === 'eventos')      renderEventos();
  if (section === 'aprende')      renderGuias();
  if (section === 'comunidades')  renderComunidades();
  if (section === 'anuncios')     renderAnuncios();
  if (section === 'multimedia')   renderMultimedia();
  if (section === 'herramientas') renderHerramientas();
  if (section === 'nostr')        renderNostr();
}

function clearFilters() {
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  document.querySelectorAll('.filter-input').forEach(i => i.value = '');
  history.replaceState(null, '', location.pathname);
  switchTab(state.activeTab);
}

function getFilters(panelId) {
  const panel = document.getElementById(panelId);
  const out = {};
  panel.querySelectorAll('[data-filter]').forEach(el => {
    out[el.dataset.filter] = el.value.trim().toLowerCase();
  });
  return out;
}

// ── Sorting ────────────────────────────────────────────────
function applySorting(arr, orden, nameField = 'nombre') {
  const s = [...arr];
  if (!orden || orden === 'reciente')
    return s.sort((a, b) => new Date(b.fecha_alta) - new Date(a.fecha_alta));
  if (orden === 'az')
    return s.sort((a, b) => (a[nameField] || '').localeCompare(b[nameField] || '', 'es'));
  if (orden === 'za')
    return s.sort((a, b) => (b[nameField] || '').localeCompare(a[nameField] || '', 'es'));
  return s;
}

// ── Stats ──────────────────────────────────────────────────
function updateStats() {
  const el = id => document.getElementById(id);
  if (el('stat-nodos'))    animateCountUp(el('stat-nodos'),    state.nodos.length);
  if (el('stat-eventos'))  animateCountUp(el('stat-eventos'),  state.eventos.length);
if (el('stat-paises'))   animateCountUp(el('stat-paises'),   state.comunidades.length);
}

function animateCountUp(el, target, duration = 700) {
  if (!el) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateCounts() {
  const map = {
    directorio:   state.nodos.length,
    eventos:      state.eventos.length,
    aprende:      state.guias.length,
    comunidades:  state.comunidades.length,
    anuncios:     state.anuncios.length,
    multimedia:   state.multimedia.length,
    herramientas: state.herramientas.length,
    mapa:         state.nodos.length,
    nostr:        state.nostr.length,
  };
  document.querySelectorAll('.tab-count').forEach(el => {
    const tab = el.dataset.countFor;
    if (map[tab] !== undefined) el.textContent = map[tab];
  });
}

// ── Skeleton loading ───────────────────────────────────────
function showSkeletons(gridId, count = 6) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = Array(count).fill(`
    <div class="card card-skeleton">
      <div class="card-accent skeleton-bar"></div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-avatar skeleton-block"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">
            <div class="skeleton-line" style="width:70%;height:13px"></div>
            <div class="skeleton-line" style="width:40%;height:10px"></div>
          </div>
        </div>
        <div class="skeleton-line" style="width:100%;height:10px;margin:14px 0 6px"></div>
        <div class="skeleton-line" style="width:85%;height:10px;margin-bottom:6px"></div>
        <div class="skeleton-line" style="width:65%;height:10px"></div>
      </div>
    </div>`).join('');
}

// ── NUEVO badge ────────────────────────────────────────────
function isNuevo(fechaAlta) {
  if (!fechaAlta) return false;
  return (Date.now() - new Date(fechaAlta).getTime()) / 86400000 <= 30;
}

function nuevoBadge(fechaAlta) {
  return isNuevo(fechaAlta) ? '<span class="badge-nuevo">NUEVO</span>' : '';
}

// ── Initials avatar ────────────────────────────────────────
function initialsAvatar(nombre, categoria) {
  const words = (nombre || '').trim().split(/[\s\-_]+/).filter(Boolean);
  const initials = (
    (words[0]?.[0] || '') + (words[1]?.[0] || '')
  ).toUpperCase() || '?';

  const cat = (categoria || '').toLowerCase();
  const colorClass =
    cat.includes('tech')         ? 'avatar-cyan'    :
    cat.includes('dise')         ? 'avatar-magenta' :
    cat.includes('salud') || cat.includes('legal') ? 'avatar-green' :
    cat.includes('aliment') || cat.includes('hostel') || cat.includes('come') ? 'avatar-orange' :
    'avatar-yellow';

  return `<div class="avatar-initials ${colorClass}">${initials}</div>`;
}

// ── Copy contact ───────────────────────────────────────────
function bestContact(n) {
  if (n.telegram) return { type: 'telegram', value: n.telegram };
  if (n.email)    return { type: 'email',    value: n.email };
  if (n.web)      return { type: 'web',      value: n.web };
  return null;
}

function wireCopyButtons(container) {
  container.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const val = btn.dataset.v;
      const doFallback = () => {
        const ta = document.createElement('textarea');
        ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      };
      const finish = () => {
        btn.textContent = '✓'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '⧉'; btn.classList.remove('copied'); }, 2000);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(finish).catch(doFallback);
      } else { doFallback(); finish(); }
    });
  });
}

// ── Render all on load ─────────────────────────────────────
function renderAll() {
  renderNodos();
  renderEventos();
  renderGuias();
  renderComunidades();
  renderAnuncios();
  renderMultimedia();
  renderHerramientas();
  renderNostr();
  renderDestacados();
  renderRecientes();
}

// ── Interactive map ────────────────────────────────────────
const CITY_COORDS = {
  'madrid':                    [40.4168, -3.7038],
  'barcelona':                 [41.3851,  2.1734],
  'malaga':                    [36.7213, -4.4214],
  'valencia':                  [39.4699, -0.3763],
  'sevilla':                   [37.3891, -5.9845],
  'bilbao':                    [43.2630, -2.9350],
  'zaragoza':                  [41.6488, -0.8891],
  'alicante':                  [38.3452, -0.4810],
  'las palmas de gran canaria':[28.1235,-15.4366],
  'santa cruz de tenerife':    [28.4636,-16.2518],
  'palma de mallorca':         [39.5696,  2.6502],
  'leon':                      [42.5987, -5.5671],
  'pontevedra':                [42.4314, -8.6443],
  'vigo':                      [42.2314, -8.7124],
  'girona':                    [41.9794,  2.8214],
  'guadalajara':               [40.6322, -3.1665],
  'badajoz':                   [38.8794, -6.9706],
  'huelva':                    [37.2614, -6.9447],
  'cangas de onis':            [43.3539, -5.1238],
  'cordoba':                   [37.8882, -4.7794],
  'granada':                   [37.1773, -3.5986],
  'murcia':                    [37.9922, -1.1307],
  'valladolid':                [41.6523, -4.7245],
  'pamplona':                  [42.8188, -1.6440],
  'vitoria':                   [42.8467, -2.6726],
  'donostia':                  [43.3183, -1.9812],
  'santander':                 [43.4623, -3.8099],
  'oviedo':                    [43.3603, -5.8448],
  'a coruna':                  [43.3623, -8.4115],
  'burgos':                    [42.3440, -3.6969],
  'salamanca':                 [40.9701, -5.6635],
  'toledo':                    [39.8628, -4.0273],
  'tarragona':                 [41.1189,  1.2445],
  'lleida':                    [41.6148,  0.6274],
};

let _mapInstance = null;
let _mapMarkers  = [];

// Países activos en el directorio — añadir más según crezca la red
const COUNTRY_MARKERS = [
  { pais: 'España', coords: [40.2, -3.5], flag: '🇪🇸' },
];

function normalizeCity(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizePais(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderMapa() {
  const container = document.getElementById('mapa-leaflet');
  const noMapaMsg = document.getElementById('mapa-sin-nodos');

  if (typeof L === 'undefined') {
    if (container) container.innerHTML = emptyState('Mapa no disponible. Recarga la página.');
    pushFilterState('mapa', {});
    return;
  }

  if (!container) return;

  if (!_mapInstance) {
    _mapInstance = L.map('mapa-leaflet').setView([40.2, -3.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(_mapInstance);
  }

  _mapMarkers.forEach(m => m.remove());
  _mapMarkers = [];

  // Contar nodos por país (normalizado)
  const nodosPorPais = {};
  state.nodos.forEach(n => {
    const key = normalizePais(n.pais);
    nodosPorPais[key] = (nodosPorPais[key] || 0) + 1;
  });

  // Marcadores fijos por país con conteo
  COUNTRY_MARKERS.forEach(({ pais, coords, flag }) => {
    const key = normalizePais(pais);
    const count = nodosPorPais[key] || 0;
    const estado = count === 0
      ? '<br><small style="color:#888">Próximamente — ¡sé el primero!</small>'
      : `<br><small>${count} nodo${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}</small>`;
    const popup = `${flag} <strong>${escapeHTML(pais)}</strong>${estado}`;
    const marker = L.marker(coords).addTo(_mapInstance).bindPopup(popup);
    _mapMarkers.push(marker);
  });

  // Marcadores individuales de ciudad para cada nodo
  state.nodos.forEach(n => {
    const key = normalizeCity(n.ciudad);
    const coords = CITY_COORDS[key];
    if (!coords) return;
    const popup = `<strong>${escapeHTML(n.nombre)}</strong><br><small>${escapeHTML(n.categoria || '')}</small><br>${escapeHTML((n.presentacion || '').slice(0, 100))}${n.presentacion?.length > 100 ? '…' : ''}`;
    const marker = L.marker(coords).addTo(_mapInstance).bindPopup(popup);
    _mapMarkers.push(marker);
  });

  if (noMapaMsg) noMapaMsg.style.display = 'none';

  setTimeout(() => _mapInstance.invalidateSize(), 300);
  pushFilterState('mapa', {});
}

// ── Recién añadido strip ───────────────────────────────────
function renderRecientes() {
  const all = [
    ...state.nodos.map(e => ({ fecha_alta: e.fecha_alta, nombre: e.nombre, tipo: 'nodo', tab: 'directorio' })),
    ...state.eventos.map(e => ({ fecha_alta: e.fecha_alta, nombre: e.nombre, tipo: 'evento', tab: 'eventos' })),
    ...state.guias.map(e => ({ fecha_alta: e.fecha_alta, nombre: e.titulo, tipo: 'recurso', tab: 'aprende' })),
    ...state.comunidades.map(e => ({ fecha_alta: e.fecha_alta, nombre: e.nombre, tipo: 'comunidad', tab: 'comunidades' })),
    ...state.anuncios.map(e => ({ fecha_alta: e.fecha_alta, nombre: e.titulo, tipo: 'anuncio', tab: 'anuncios' })),
    ...(state.multimedia || []).map(e => ({ fecha_alta: e.fecha_alta, nombre: e.titulo, tipo: 'media', tab: 'multimedia' })),
    ...(state.herramientas || []).map(e => ({ fecha_alta: e.fecha_alta, nombre: e.nombre, tipo: 'herramienta', tab: 'herramientas' })),
    ...(state.nostr || []).map(e => ({ fecha_alta: e.fecha_alta, nombre: e.nombre, tipo: 'nostr', tab: 'nostr' })),
  ];
  const recent = all
    .filter(e => e.fecha_alta)
    .sort((a, b) => new Date(b.fecha_alta) - new Date(a.fecha_alta))
    .slice(0, 5);
  const strip = document.getElementById('recientes-strip');
  const row = document.getElementById('recientes-row');
  if (!strip || !row) return;
  if (!recent.length) { strip.style.display = 'none'; return; }
  strip.style.display = '';
  row.innerHTML = recent.map(e => `
    <div class="reciente-card" onclick="switchTab('${e.tab}')">
      <span class="reciente-tipo">${escapeHTML(e.tipo.toUpperCase())}</span>
      <div class="reciente-nombre">${escapeHTML(e.nombre)}</div>
      <div class="reciente-fecha">${escapeHTML(e.fecha_alta)}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// DESTACADOS
// ─────────────────────────────────────────────────────────────
function renderDestacados() {
  const strip = document.getElementById('destacados-strip');
  const row   = document.getElementById('destacados-row');
  if (!strip || !row) return;

  const PLURALS = { nodo: 'nodos', evento: 'eventos', guia: 'guias', comunidad: 'comunidades', anuncio: 'anuncios' };

  const resolved = state.destacados
    .sort((a, b) => (a.orden || 99) - (b.orden || 99))
    .map(d => {
      if (d.curado) return { ...d, _motivo: d.motivo };
      const pool = state[PLURALS[d.tipo]] || [];
      const found = pool.find(x => x.id === d.ref_id);
      return found ? { ...found, _motivo: d.motivo } : null;
    })
    .filter(Boolean);

  if (!resolved.length) { strip.style.display = 'none'; return; }
  strip.style.display = '';

  row.innerHTML = resolved.map(d => `
    <div class="destacado-card">
      <div class="destacado-star">★ DESTACADO</div>
      <div class="card-name">${escapeHTML(d.nombre || d.titulo || '')}</div>
      <div class="card-location" style="margin-top:4px">
        <span class="loc-dot">◉</span>${[d.ciudad, d.pais].filter(Boolean).map(escapeHTML).join(' / ') || 'Online'}
      </div>
      ${d._motivo ? `<div class="destacado-motivo">"${escapeHTML(d._motivo)}"</div>` : ''}
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// DIRECTORIO
// ─────────────────────────────────────────────────────────────
function renderNodos() {
  const f = getFilters('panel-directorio');
  const filtered = state.nodos.filter(n => {
    if (f.pais      && !n.pais?.toLowerCase().includes(f.pais))           return false;
    if (f.categoria && !n.categoria?.toLowerCase().includes(f.categoria)) return false;
    if (f.tipo      && !n.tipo_accion?.toLowerCase().includes(f.tipo))    return false;
    if (f.crypto) {
      const has = n.acepta_crypto?.some(c => c.toLowerCase().includes(f.crypto));
      if (!has) return false;
    }
    if (f.nostr === 'si' && !n.nostr) return false;
    if (f.search) {
      const hay = [n.nombre, n.presentacion, n.servicios?.join(' '), n.tags?.join(' ')]
        .join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  const sorted = applySorting(filtered, f.orden, 'nombre');
  const grid = document.getElementById('nodos-grid');
  grid.innerHTML = sorted.length
    ? sorted.map(nodoCard).join('')
    : emptyState('No hay nodos con esos filtros.');

  grid.querySelectorAll('.btn-more').forEach((btn, i) => {
    btn.addEventListener('click', () => openModal(sorted[i]));
  });
  wireCopyButtons(grid);
  pushFilterState('directorio', f);
}

function nodoCard(n) {
  const tipo = n.tipo_accion?.toUpperCase() || '';
  const badgeClass = tipo.includes('OFREZCO') ? 'ofrezco'
                   : tipo.includes('BUSCO')   ? 'busco' : 'ambos';
  const badgeText  = tipo.includes('AMBOS') ? 'OFREZCO / BUSCO' : tipo;

  const cat = (n.categoria || '').split(' ')[0].toLowerCase();
  const loc  = [n.ciudad, n.pais].filter(Boolean).map(escapeHTML).join(' / ') || 'Online';
  const tags = (n.tags || []).slice(0, 4).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join('');
  const cryptoBadges = cryptoToHTML(n.acepta_crypto || []);

  const contact = bestContact(n);
  const copyBtn = contact
    ? `<button class="btn-copy" data-v="${escapeHTML(contact.value)}" title="Copiar ${escapeHTML(contact.type)}">⧉</button>`
    : '';

  const contacts = [];
  if (n.telegram) {
    const tgUrl = n.telegram.startsWith('http') ? n.telegram : 'https://t.me/' + n.telegram.replace('@', '');
    if (isSafeUrl(tgUrl)) contacts.push(`<a class="contact-link" href="${escapeHTML(tgUrl)}" target="_blank">✈ TG</a>`);
  }
  if (n.web && isSafeUrl(n.web)) contacts.push(`<a class="contact-link" href="${escapeHTML(n.web)}" target="_blank">🌐 Web</a>`);
  if (n.email)    contacts.push(`<a class="contact-link" href="mailto:${escapeHTML(n.email)}">✉ Mail</a>`);
  if (n.twitter) {
    const twUrl = n.twitter.startsWith('http') ? n.twitter : 'https://twitter.com/' + n.twitter.replace('@', '');
    if (isSafeUrl(twUrl)) contacts.push(`<a class="contact-link" href="${escapeHTML(twUrl)}" target="_blank">𝕏</a>`);
  }

  const avatarContent = (n.foto && !n.foto.includes('placeholder') && isSafeUrl(n.foto))
    ? `<img src="${escapeHTML(n.foto)}" alt="${escapeHTML(n.nombre)}" loading="lazy">`
    : initialsAvatar(n.nombre, n.categoria);

  return `
    <div class="card">
      <div class="card-accent ${cat}"></div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-avatar">${avatarContent}</div>
          <div class="card-meta">
            <div class="card-name">${escapeHTML(n.nombre)}${nuevoBadge(n.fecha_alta)}</div>
            <div class="card-location"><span class="loc-dot">◉</span>${loc}</div>
          </div>
          <span class="badge badge-${badgeClass}">${escapeHTML(badgeText)}</span>
        </div>
        <p class="card-desc">${escapeHTML(n.presentacion)}</p>
        <div class="card-tags">${tags}</div>
        <div class="card-crypto">${cryptoBadges}</div>
        <div class="card-footer">
          <div class="card-contacts">${contacts.join('')}</div>
          <div style="display:flex;gap:6px;align-items:center">
            ${copyBtn}
            <button class="btn-more">VER ▸</button>
          </div>
        </div>
      </div>
    </div>`;
}

function cryptoToHTML(list) {
  const map = {
    'bitcoin (btc)':       ['BTC', 'btc'],
    'lightning network':   ['⚡ LN', 'ln'],
    'ethereum (eth)':      ['ETH', 'eth'],
    'usdt / usdc':         ['USDT', 'usdt'],
    'monero (xmr)':        ['XMR', 'xmr'],
    'solana (sol)':        ['SOL', 'sol'],
    'trueque':             ['⇄ TRUEQUE', 'trueque'],
    'euro / moneda fiat':  ['€ FIAT', 'fiat']
  };
  return list.map(c => {
    const key = c.toLowerCase();
    const match = Object.entries(map).find(([k]) => key.includes(k));
    if (match) return `<span class="crypto-badge ${match[1][1]}">${match[1][0]}</span>`;
    return `<span class="crypto-badge fiat">${c.split('(')[0].trim()}</span>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────
function openModal(n) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const shareUrl = `${location.origin}${location.pathname}?tab=directorio&search=${encodeURIComponent(n.nombre)}`;
  const services = (n.servicios || []).map(s => `<li>${escapeHTML(s)}</li>`).join('');
  const cryptoBadges = cryptoToHTML(n.acepta_crypto || []);
  const tags = (n.tags || []).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join(' ');
  const links = buildLinks(n);

  content.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${escapeHTML(n.nombre)}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${field('Tipo', n.tipo_entidad)}
      ${field('Acción', n.tipo_accion)}
      ${field('Categoría', n.categoria)}
      ${n.pais ? field('Ubicación', [n.ciudad, n.pais].filter(Boolean).join(' — ')) : ''}
      ${n.direccion ? field('Dirección', n.direccion) : ''}
      ${n.horario ? field('Horario', n.horario) : ''}
      <div class="modal-field">
        <div class="modal-field-label">Presentación</div>
        <div class="modal-field-value">${escapeHTML(n.presentacion)}</div>
      </div>
      ${services ? `
      <div class="modal-field">
        <div class="modal-field-label">Servicios</div>
        <ul class="modal-services">${services}</ul>
      </div>` : ''}
      <div class="modal-field">
        <div class="modal-field-label">Acepta / Paga en</div>
        <div class="card-crypto mt-8">${cryptoBadges}</div>
      </div>
      ${n.wallet ? field('Wallet pública', n.wallet) : ''}
      ${n.idiomas ? field('Idiomas', n.idiomas) : ''}
      ${n.fundacion ? field('Desde', n.fundacion) : ''}
      ${n.notas ? field('Notas', n.notas) : ''}
      ${tags ? `<div class="modal-field"><div class="modal-field-label">Tags</div><div class="card-tags mt-8">${tags}</div></div>` : ''}
      <div class="modal-links">
        ${links}
        <button class="modal-link btn-share-modal" data-url="${shareUrl}">⇧ COMPARTIR</button>
      </div>
    </div>`;

  content.querySelector('.btn-share-modal')?.addEventListener('click', function() {
    const url = this.dataset.url;
    if (navigator.share) {
      navigator.share({ title: n.nombre, url });
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        this.textContent = '✓ COPIADO';
        setTimeout(() => { this.textContent = '⇧ COMPARTIR'; }, 2000);
      });
    }
  });

  overlay.classList.add('open');
}

function field(label, value) {
  if (!value) return '';
  return `
    <div class="modal-field">
      <div class="modal-field-label">${label}</div>
      <div class="modal-field-value">${escapeHTML(value)}</div>
    </div>`;
}

function buildLinks(n) {
  const links = [];
  if (n.web && isSafeUrl(n.web))           links.push(link(n.web, '🌐 Web'));
  if (n.telegram) {
    const tgUrl = n.telegram.startsWith('http') ? n.telegram : `https://t.me/${n.telegram.replace('@', '')}`;
    if (isSafeUrl(tgUrl)) links.push(link(tgUrl, '✈ Telegram'));
  }
  if (n.email)                              links.push(link(`mailto:${escapeHTML(n.email)}`, '✉ Email'));
  if (n.twitter) {
    const twUrl = n.twitter.startsWith('http') ? n.twitter : `https://twitter.com/${n.twitter.replace('@', '')}`;
    if (isSafeUrl(twUrl)) links.push(link(twUrl, '𝕏 Twitter'));
  }
  if (n.instagram)                          links.push(link(`https://instagram.com/${encodeURIComponent(n.instagram.replace('@', ''))}`, '📷 Instagram'));
  if (n.linkedin && isSafeUrl(n.linkedin))  links.push(link(n.linkedin, 'in LinkedIn'));
  if (n.github && isSafeUrl(n.github))      links.push(link(n.github, '⌥ GitHub'));
  if (n.youtube && isSafeUrl(n.youtube))    links.push(link(n.youtube, '▶ YouTube'));
  if (n.portfolio && isSafeUrl(n.portfolio)) links.push(link(n.portfolio, '◈ Portfolio'));
  if (n.nostr)                              links.push(link(`https://primal.net/p/${encodeURIComponent(n.nostr)}`, '⚡ Nostr'));
  if (n.maps && isSafeUrl(n.maps))          links.push(link(n.maps, '◉ Maps'));
  return links.join('');
}

function link(href, label) {
  return `<a class="modal-link" href="${escapeHTML(href)}" target="_blank" rel="noopener">${label}</a>`;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
// MODAL DONACIONES
// ─────────────────────────────────────────────────────────────
function buildAddressHTML(label, icon, value) {
  if (!value) return `
    <div class="donar-addr-block">
      <div class="donar-addr-label"><span class="addr-icon">${icon}</span>${label}</div>
      <div class="donar-addr-value"><span class="donar-addr-pending">Próximamente disponible</span></div>
    </div>`;
  return `
    <div class="donar-addr-block">
      <div class="donar-addr-label"><span class="addr-icon">${icon}</span>${label}</div>
      <div class="donar-addr-value">
        <span class="addr-text">${value}</span>
        <button class="btn-copy" data-v="${value}" title="Copiar dirección">⧉</button>
      </div>
    </div>`;
}

function openDonarModal() {
  const m = state.mantenimiento;
  const overlay = document.getElementById('modal-donar-overlay');

  document.getElementById('donar-mensaje').textContent = m.mensaje || '';
  document.getElementById('donar-gracias').textContent = m.mensaje_gracias || '';
  document.getElementById('donar-addresses').innerHTML =
    buildAddressHTML('Lightning Network', '⚡', m.ln_address) +
    buildAddressHTML('Bitcoin on-chain', '₿', m.btc_address);

  wireCopyButtons(document.getElementById('donar-addresses'));
  overlay.classList.add('open');
}

function closeDonarModal() {
  document.getElementById('modal-donar-overlay').classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────────────
function renderEventos() {
  const f = getFilters('panel-eventos');
  const filtered = state.eventos.filter(e => {
    if (f.pais && !e.pais?.toLowerCase().includes(f.pais)) return false;
    if (f.tipo && !e.tipo?.toLowerCase().includes(f.tipo)) return false;
    if (f.search) {
      const hay = [e.nombre, e.descripcion, e.lugar].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  const sorted = applySorting(filtered, f.orden, 'nombre');
  const grid = document.getElementById('eventos-grid');
  grid.innerHTML = sorted.length
    ? sorted.map(eventoCard).join('')
    : emptyState('No hay eventos con esos filtros.');
  pushFilterState('eventos', f);
}

function eventoCard(e) {
  const registroUrl = e.registro && isSafeUrl(e.registro) ? escapeHTML(e.registro) : null;
  return `
    <div class="event-card">
      <div class="event-date-box">
        <span class="event-date">📅 ${escapeHTML(e.fecha)}</span>
        ${e.hora ? `<span class="event-time">⏱ ${escapeHTML(e.hora)}</span>` : ''}
      </div>
      <div class="event-name">${escapeHTML(e.nombre)}${nuevoBadge(e.fecha_alta)}</div>
      <div class="event-lugar">📍 ${escapeHTML(e.lugar)}</div>
      <p class="event-desc">${escapeHTML(e.descripcion)}</p>
      <div class="event-footer">
        <span class="event-coste">${escapeHTML(e.coste || 'Gratuito')}</span>
        <span class="event-tipo-badge">${escapeHTML(e.tipo?.split('/')[0].trim() ?? '')}</span>
        ${registroUrl ? `<a class="btn-link" href="${registroUrl}" target="_blank">ASISTIR ▸</a>` : ''}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// GUÍAS
// ─────────────────────────────────────────────────────────────
function renderGuias() {
  const f = getFilters('panel-aprende');
  const filtered = state.guias.filter(g => {
    if (f.nivel     && !g.nivel?.toLowerCase().includes(f.nivel))        return false;
    if (f.categoria && !g.categoria?.toLowerCase().includes(f.categoria)) return false;
    if (f.idioma    && !g.idioma?.toLowerCase().includes(f.idioma))       return false;
    if (f.search) {
      const hay = [g.titulo, g.descripcion, g.autor].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  const sorted = applySorting(filtered, f.orden, 'titulo');
  const grid = document.getElementById('guias-grid');
  grid.innerHTML = sorted.length
    ? sorted.map(guiaCard).join('')
    : emptyState('No hay recursos con esos filtros.');
  pushFilterState('aprende', f);
}

function guiaCard(g) {
  const nivel = g.nivel?.split(' ')[0].toLowerCase() || '';
  const linkUrl = g.link && isSafeUrl(g.link) ? escapeHTML(g.link) : '#';
  return `
    <div class="guia-card">
      <div class="guia-meta">
        <span class="nivel-badge ${nivel}">${escapeHTML(g.nivel?.split(' ')[0] ?? '')}</span>
        <span class="guia-tipo-badge">${escapeHTML(g.tipo?.split('/')[0].trim() ?? '')}</span>
        ${g.idioma ? `<span class="guia-tipo-badge">${escapeHTML(g.idioma)}</span>` : ''}
      </div>
      <div class="guia-title">${escapeHTML(g.titulo)}${nuevoBadge(g.fecha_alta)}</div>
      <p class="guia-desc">${escapeHTML(g.descripcion)}</p>
      <div class="guia-footer">
        <span class="guia-autor">${g.autor ? '— ' + escapeHTML(g.autor) : ''} ${g.gratuito === 'Sí' || g.gratuito === 'Sí — Open Source' ? '· GRATIS' : ''}</span>
        <a class="btn-link" href="${linkUrl}" target="_blank" rel="noopener">ABRIR ▸</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// COMUNIDADES
// ─────────────────────────────────────────────────────────────
function renderComunidades() {
  const f = getFilters('panel-comunidades');
  const filtered = state.comunidades.filter(c => {
    if (f.pais       && !c.pais?.toLowerCase().includes(f.pais))           return false;
    if (f.plataforma && !c.plataforma?.toLowerCase().includes(f.plataforma)) return false;
    if (f.search) {
      const hay = [c.nombre, c.descripcion].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  const sorted = applySorting(filtered, f.orden, 'nombre');
  const grid = document.getElementById('comunidades-grid');
  grid.innerHTML = sorted.length
    ? sorted.map(comunidadCard).join('')
    : emptyState('No hay comunidades con esos filtros.');
  pushFilterState('comunidades', f);
}

function comunidadCard(c) {
  const linkUrl = c.link && isSafeUrl(c.link) ? escapeHTML(c.link) : '#';
  return `
    <div class="com-card">
      <div class="com-plataforma">▸ ${escapeHTML(c.plataforma)}</div>
      <div class="com-name">${escapeHTML(c.nombre)}${nuevoBadge(c.fecha_alta)}</div>
      ${c.miembros ? `<div class="com-miembros">◉ ${escapeHTML(String(c.miembros))} miembros · ${escapeHTML(c.pais)}</div>` : ''}
      <p class="com-desc">${escapeHTML(c.descripcion)}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        ${c.idioma ? `<span class="guia-tipo-badge">${escapeHTML(c.idioma)}</span>` : '<span></span>'}
        <a class="btn-link" href="${linkUrl}" target="_blank" rel="noopener">ENTRAR ▸</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// ANUNCIOS
// ─────────────────────────────────────────────────────────────
function renderAnuncios() {
  const f = getFilters('panel-anuncios');
  const filtered = state.anuncios.filter(a => {
    if (f.tipo && !a.tipo?.toLowerCase().includes(f.tipo)) return false;
    if (f.search) {
      const hay = [a.titulo, a.descripcion].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  const sorted = applySorting(filtered, f.orden, 'titulo');
  const grid = document.getElementById('anuncios-grid');
  grid.innerHTML = sorted.length
    ? sorted.map(anuncioCard).join('')
    : emptyState('No hay anuncios con esos filtros.');
  pushFilterState('anuncios', f);
}

function anuncioCard(a) {
  return `
    <div class="anuncio-card">
      <span class="anuncio-tipo">${escapeHTML(a.tipo)}</span>
      <div class="anuncio-title">${escapeHTML(a.titulo)}${nuevoBadge(a.fecha_alta)}</div>
      <p class="anuncio-desc">${escapeHTML(a.descripcion)}</p>
      <div class="anuncio-footer">
        <span>📍 ${escapeHTML(a.zona || 'Online')}</span>
        <span>⏱ ${escapeHTML(a.duracion || 'Sin fecha límite')}</span>
        <span>✉ ${escapeHTML(a.contacto)}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// MULTIMEDIA
// ─────────────────────────────────────────────────────────────
function renderMultimedia() {
  const grid = document.getElementById('multimedia-grid');
  if (!grid) return;
  const f = getFilters('panel-multimedia');
  const filtered = state.multimedia.filter(m => {
    if (f.tipo   && !m.tipo?.toLowerCase().includes(f.tipo))     return false;
    if (f.idioma && !m.idioma?.toLowerCase().includes(f.idioma)) return false;
    if (f.search) {
      const hay = [m.titulo, m.descripcion, m.autor].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });
  const sorted = applySorting(filtered, f.orden, 'titulo');
  grid.innerHTML = sorted.length
    ? sorted.map(multimediaCard).join('')
    : emptyState('No hay contenido multimedia con esos filtros.');
  pushFilterState('multimedia', f);
}

function multimediaCard(m) {
  const icons = { YouTube: '▶', Podcast: '🎙', Newsletter: '✉', Blog: '◈', Livestream: '⚡' };
  const linkUrl = m.link && isSafeUrl(m.link) ? escapeHTML(m.link) : '#';
  return `
    <div class="guia-card">
      <div class="guia-meta">
        <span class="guia-tipo-badge">${icons[m.tipo] || '▸'} ${escapeHTML(m.tipo || '')}</span>
        ${m.idioma    ? `<span class="guia-tipo-badge">${escapeHTML(m.idioma)}</span>` : ''}
        ${m.frecuencia ? `<span class="guia-tipo-badge">${escapeHTML(m.frecuencia)}</span>` : ''}
      </div>
      <div class="guia-title">${escapeHTML(m.titulo)}${nuevoBadge(m.fecha_alta)}</div>
      <p class="guia-desc">${escapeHTML(m.descripcion)}</p>
      <div class="guia-footer">
        <span class="guia-autor">${m.autor ? '— ' + escapeHTML(m.autor) : ''}${m.gratuito === 'Sí' ? ' · GRATIS' : ''}</span>
        <a class="btn-link" href="${linkUrl}" target="_blank" rel="noopener">ABRIR ▸</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// HERRAMIENTAS
// ─────────────────────────────────────────────────────────────
const TOOL_SECTIONS = [
  { key: 'Exchange',          icon: '⇄',  label: 'Exchange'          },
  { key: 'Aggregator',        icon: '◈',  label: 'Aggregator'        },
  { key: 'P2P',               icon: '⇄',  label: 'P2P'               },
  { key: 'Indie exchange',    icon: '⇄',  label: 'Indie Exchange'    },
  { key: 'DEX',               icon: '⟲',  label: 'DEX'               },
  { key: 'ATM',               icon: '₿',  label: 'ATM'               },
  { key: 'Marketplace',       icon: '◆',  label: 'Marketplace'       },
  { key: 'Shopping',          icon: '◆',  label: 'Shopping'          },
  { key: 'Tool',              icon: '⚙',  label: 'Tool'              },
  { key: 'OS & Live USB',     icon: '⊙',  label: 'OS & Live USB'     },
  { key: 'Encryption',        icon: '⬟',  label: 'Encryption'        },
  { key: 'Browser',           icon: '◎',  label: 'Browser'           },
  { key: 'Password Manager',  icon: '⊛',  label: 'Password Manager'  },
  { key: 'Messaging',         icon: '◈',  label: 'Messaging'         },
  { key: 'VPN',               icon: '⬡',  label: 'VPN'               },
  { key: 'Hosting',           icon: '⊞',  label: 'Hosting'           },
  { key: 'VPS',               icon: '⊞',  label: 'VPS'               },
  { key: 'Domains',           icon: '◉',  label: 'Domains'           },
  { key: 'Email',             icon: '✉',  label: 'Email'             },
  { key: 'Email alias',       icon: '✉',  label: 'Email Alias'       },
  { key: 'SMS',               icon: '□',  label: 'SMS'               },
  { key: 'e-SIM',             icon: '□',  label: 'e-SIM'             },
  { key: 'Cards',             icon: '▭',  label: 'Cards'             },
  { key: 'Gift cards',        icon: '◇',  label: 'Gift Cards'        },
  { key: 'AI',                icon: '◈',  label: 'AI'                },
  { key: 'Proxy store',       icon: '◉',  label: 'Proxy Store'       },
  { key: 'Utilities',         icon: '⊗',  label: 'Utilities'         },
  { key: 'Other services',    icon: '◦',  label: 'Other Services'    },
];

function renderHerramientas() {
  const container = document.getElementById('herramientas-grid');
  if (!container) return;
  const f = getFilters('panel-herramientas');
  const filtered = state.herramientas.filter(h => {
    if (f.tipo && !h.tipo?.toLowerCase().includes(f.tipo.toLowerCase())) return false;
    if (f.search) {
      const hay = [h.nombre, h.descripcion, h.tipo].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = emptyState('No hay herramientas con esos filtros.');
    pushFilterState('herramientas', f);
    return;
  }

  // Group by tipo preserving TOOL_SECTIONS order
  const grouped = {};
  TOOL_SECTIONS.forEach(s => { grouped[s.key] = []; });
  filtered.forEach(h => {
    const key = h.tipo || 'Other services';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  });
  // Sort each group A→Z by default or by orden filter
  TOOL_SECTIONS.forEach(s => {
    grouped[s.key] = applySorting(grouped[s.key], f.orden || 'az', 'nombre');
  });

  container.innerHTML = TOOL_SECTIONS
    .filter(s => grouped[s.key]?.length > 0)
    .map(s => `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-icon">${s.icon}</span>
          <span class="tool-section-name">${s.label}</span>
          <span class="tool-section-count">${grouped[s.key].length}</span>
        </div>
        <div class="cards-grid">${grouped[s.key].map(herramientaCard).join('')}</div>
      </div>`).join('');

  pushFilterState('herramientas', f);
}

function herramientaCard(h) {
  const logoUrl = h.logo && isSafeUrl(h.logo) ? escapeHTML(h.logo) : null;
  const logoHtml = logoUrl
    ? `<div class="tool-logo-wrap"><img class="tool-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'"></div>`
    : '';
  const linkUrl = h.link && isSafeUrl(h.link) ? escapeHTML(h.link) : '#';
  return `
    <div class="guia-card">
      <div class="tool-header">
        ${logoHtml}
        <div class="guia-title">${escapeHTML(h.nombre)}${nuevoBadge(h.fecha_alta)}</div>
      </div>
      <div class="guia-meta">
        ${h.plataforma ? `<span class="guia-tipo-badge">${escapeHTML(h.plataforma)}</span>` : ''}
        ${h.open_source === 'Sí' ? '<span class="guia-tipo-badge" style="color:#30d158;border-color:rgba(48,209,88,0.25)">Open Source</span>' : ''}
      </div>
      <p class="guia-desc">${escapeHTML(h.descripcion)}</p>
      <div class="guia-footer">
        <span></span>
        <a class="btn-link" href="${linkUrl}" target="_blank" rel="noopener">ABRIR ▸</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// NOSTR
// ─────────────────────────────────────────────────────────────
function renderNostr() {
  const grid = document.getElementById('nostr-grid');
  if (!grid) return;
  const f = getFilters('panel-nostr');
  const filtered = state.nostr.filter(n => {
    if (f.tipo       && !n.tipo?.toLowerCase().includes(f.tipo))       return false;
    if (f.plataforma && !n.plataforma?.toLowerCase().includes(f.plataforma)) return false;
    if (f.search) {
      const hay = [n.nombre, n.descripcion, n.tipo].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });
  const sorted = applySorting(filtered, f.orden, 'nombre');
  grid.innerHTML = sorted.length
    ? sorted.map(nostrCard).join('')
    : emptyState('No hay recursos Nostr con esos filtros.');
  pushFilterState('nostr', f);
}

function nostrCard(n) {
  const tipoColor = { Cliente: '#bf5af2', Relay: '#00d4ff', Herramienta: '#f7931a', 'Red Social': '#30d158' };
  const color = tipoColor[n.tipo] || '#86868b';
  const logoUrl = n.logo && isSafeUrl(n.logo) ? escapeHTML(n.logo) : null;
  const logoHtml = logoUrl
    ? `<img class="nostr-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'">`
    : `<span class="nostr-logo-icon">⚡</span>`;
  const linkUrl = n.link && isSafeUrl(n.link) ? escapeHTML(n.link) : '#';
  return `
    <div class="nostr-card">
      <div class="nostr-header">
        <div class="nostr-logo-wrap">${logoHtml}</div>
        <div>
          <div class="nostr-title">${escapeHTML(n.nombre)}${nuevoBadge(n.fecha_alta)}</div>
          <div class="nostr-badges">
            <span class="nostr-badge" style="color:${color};border-color:${color}33;background:${color}11">${escapeHTML(n.tipo)}</span>
            ${n.plataforma ? `<span class="nostr-badge-plain">${escapeHTML(n.plataforma)}</span>` : ''}
            ${n.open_source === 'Sí' ? '<span class="nostr-badge-os">Open Source</span>' : ''}
            ${n.zaps ? '<span class="nostr-badge-zaps">⚡ Zaps</span>' : ''}
          </div>
        </div>
      </div>
      <p class="nostr-desc">${escapeHTML(n.descripcion)}</p>
      <div class="nostr-footer">
        <span></span>
        <a class="btn-link" href="${linkUrl}" target="_blank" rel="noopener">ABRIR ▸</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function emptyState(msg) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-state-icon">◈</div>
    <h3>Sin resultados</h3>
    <p>${msg}</p>
    <a class="btn-alta" href="submit.html" target="_blank" rel="noopener">⊕ AÑADIR ENTRADA</a>
  </div>`;
}

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDonarModal(); }
  });
  init();
});
