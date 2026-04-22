# PlazaP2P v2

**Directorio P2P de Economía Circular Bitcoin — España**

> Páginas amarillas descentralizadas para personas y negocios que practican economía circular con Bitcoin. Sin intermediarios. Sin comisiones. 100% open source.

**[Ver demo en vivo →](YOUR_SITE_URL)**

---

## ¿Qué cambia respecto a V1?

| | V1 | V2 |
|---|---|---|
| **Envío** | Abrir Issue en GitHub (requería cuenta) | Formulario web — sin cuenta GitHub |
| **Backend** | Python `parse_issue.py` | Node.js `parse-issue.mjs` (0 dependencias npm) |
| **Automatización** | 2 workflows (`auto-approve.yml` + `mantenedor.yml`) | 1 workflow unificado (`submission-pr.yml`) |
| **Flujo de aprobación** | Añadir label `aprobado` → commit directo | Issue → PR automático → revisar → mergear |
| **Hosting** | GitHub Pages | Cloudflare Pages (edge, Functions incluidas) |
| **Rate limiting** | Sin protección | IP-based via Cloudflare KV |
| **Seguridad** | Sin sanitización | Prevención de inyección `###`, validación dual cliente/servidor |
| **UX formulario** | — | Borrador auto-guardado, contadores de caracteres, link al issue tras envío |

El repo V1 está archivado en GitHub como referencia histórica.

---

## Cómo funciona

```
Usuario → submit.html → Cloudflare Function → GitHub Issue (con label)
    → GitHub Actions parse-issue.mjs → JSON actualizado
    → PR automático → mantenedor revisa y mergea → Cloudflare Pages despliega
```

El ciclo desde envío hasta publicación es de aproximadamente **1-2 minutos** tras la aprobación.

---

## Estructura

```
plazap2p-v2/
├── index.html                    ← SPA estática completa
├── submit.html                   ← formularios de alta (sin cuenta GitHub)
├── css/style.css                 ← diseño cyberpunk
├── js/app.js                     ← filtros, tabs, renders, URL state
├── data/
│   ├── nodos.json
│   ├── eventos.json
│   ├── guias.json
│   ├── comunidades.json
│   ├── anuncios.json
│   ├── destacados.json
│   └── mantenimiento.json
├── functions/
│   └── api/submit.js             ← Cloudflare Function (crea el Issue)
├── scripts/
│   └── parse-issue.mjs           ← parser Issue → JSON (Node.js, 0 deps)
├── wrangler.jsonc                ← config Cloudflare Pages
└── .github/
    ├── ISSUE_TEMPLATE/           ← 6 plantillas (fallback GitHub directo)
    └── workflows/
        └── submission-pr.yml     ← automatización unificada
```

---

## Setup rápido

### 1. Crea el repo y haz push
```bash
git init && git branch -m main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git add . && git commit -m "init: plazap2p-v2"
git push -u origin main
```

### 2. Reemplaza los placeholders

| Archivo | Placeholder | Valor |
|---|---|---|
| `index.html` | `YOUR_GITHUB_REPO` | URL del repo |
| `data/comunidades.json` | `YOUR_GITHUB_REPO` | URL del repo |
| `data/mantenimiento.json` | `YOUR_GITHUB_USERNAME` / `YOUR_GITHUB_REPO` | usuario / URL |
| `.github/ISSUE_TEMPLATE/config.yml` | `YOUR_SITE_URL` | URL de Cloudflare Pages |
| `README.md` | `YOUR_SITE_URL` | URL de Cloudflare Pages |

### 3. Labels en GitHub (`Settings → Labels`)

| Label | Función |
|---|---|
| `nodo` `evento` `aprendizaje` `comunidad` `anuncio` `mantenedor` | Tipo de entrada |
| `pendiente-revision` | Estado inicial al crear el Issue |
| `auto-pr` | Marca PRs generados automáticamente |

### 4. Variable de Actions (`Settings → Secrets and variables → Actions → Variables`)
```
MAINTAINER_LOGIN = tu_usuario_github
```

### 5. Cloudflare Pages
- Conecta el repo → Pages desde `main`
- Secrets: `GITHUB_TOKEN` (PAT con Issues: Read & Write), `GITHUB_REPO` (`usuario/repo`)
- KV namespace:
  ```bash
  npx wrangler kv namespace create RATE_LIMIT_KV
  npx wrangler kv namespace create RATE_LIMIT_KV --preview
  ```
  Pega los IDs en `wrangler.jsonc`

### 6. Permisos de Actions
`Settings → Actions → General`:
- Read and write permissions ✓
- Allow GitHub Actions to create and approve pull requests ✓

---

## Tecnologías

- **HTML / CSS / JavaScript** puro — sin frameworks, sin npm
- **Cloudflare Pages** — hosting en el edge global
- **Cloudflare Functions** — endpoint `/api/submit` sin servidor propio
- **Cloudflare KV** — rate limiting por IP
- **GitHub Issues** — sistema de formularios (vía API y plantillas)
- **GitHub Actions** — pipeline de publicación automática (Node.js 24)

---

## Licencia

[Creative Commons Atribución 4.0 Internacional (CC BY 4.0)](LICENSE)

Libre para usar, modificar y redistribuir — citando al proyecto original y creador (PlazaP2P).

---

*Directorio P2P · Sin intermediarios · Sin comisiones · Código abierto · Usa, aporta o dona libremente
