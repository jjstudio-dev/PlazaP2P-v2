# data/

Archivos JSON que forman la "base de datos" del directorio.
Son archivos de texto plano, editables directamente o actualizados automáticamente por `parse_issue.py` al aprobar un Issue.

---

## nodos.json — Directorio de perfiles

Personas, negocios y proyectos que aceptan Bitcoin o hacen trueque.

```json
{
  "id":           "nodo-0001",
  "tipo_entidad": "Profesional / Freelancer | Negocio físico | Negocio online | Proyecto / DAO | ONG | Comunidad",
  "tipo_accion":  "OFREZCO | BUSCO | AMBOS",
  "nombre":       "Nombre del negocio o alias",
  "presentacion": "Descripción breve (3-6 líneas)",
  "servicios":    ["Servicio 1", "Servicio 2"],
  "pais":         "España",
  "ciudad":       "Madrid",
  "direccion":    "Calle, número (solo si tiene local físico)",
  "horario":      "Lun–Vie 10:00–18:00",
  "maps":         "https://maps.app.goo.gl/...",
  "categoria":    "tech | diseño | legal | salud | educacion | alimentacion | arte | finanzas | hosteleria | ...",
  "tags":         ["bitcoin", "lightning", "remoto"],
  "acepta_crypto":["Bitcoin (BTC)", "Lightning Network", "Trueque / Intercambio de valor"],
  "wallet":       "bc1q...",
  "web":          "https://...",
  "email":        "hola@...",
  "telegram":     "@usuario",
  "nostr":        "npub1...",
  "twitter":      "@usuario",
  "instagram":    "@usuario",
  "youtube":      "https://youtube.com/@...",
  "linkedin":     "https://linkedin.com/in/...",
  "github":       "https://github.com/...",
  "portfolio":    "https://...",
  "foto":         "https://i.imgur.com/...",
  "idiomas":      "Español, English",
  "fundacion":    "2021",
  "notas":        "Información adicional",
  "github_user":  "usuario_github_que_envió_el_issue",
  "fecha_alta":   "2026-04-20",
  "aprobado":     true
}
```

---

## eventos.json — Eventos y meetups

Meetups, talleres, conferencias y eventos de la comunidad Bitcoin española.

```json
{
  "id":          "evento-0001",
  "nombre":      "Nombre del evento",
  "tipo":        "Meetup / Quedada informal | Taller / Workshop | Conferencia / Charla | Hackathon | Mercado / Feria | Evento online | Retiro | Otro",
  "fecha":       "23 de Abril de 2026",
  "hora":        "18:00 CET",
  "lugar":       "Nombre del local, dirección — ciudad",
  "pais":        "España",
  "descripcion": "Descripción del evento",
  "coste":       "Gratis | 10€ | Donación voluntaria",
  "registro":    "https://... o @telegram",
  "organizador": "Nombre o @telegram del organizador",
  "idioma":      "Español",
  "foto":        "https://i.imgur.com/...",
  "fuente":      "2140meetups.com (si fue importado)",
  "github_user": "usuario_github",
  "fecha_alta":  "2026-04-20",
  "aprobado":    true
}
```

---

## guias.json — Recursos educativos

Artículos, cursos, herramientas y libros sobre Bitcoin y economía circular.

```json
{
  "id":          "guia-0001",
  "titulo":      "Título del recurso",
  "tipo":        "Artículo / Guía escrita | Curso completo | Herramienta / Software | Libro / Whitepaper | Video / Podcast",
  "nivel":       "Principiante | Intermedio | Avanzado",
  "categoria":   "Bitcoin — fundamentos | Bitcoin — técnico | Privacidad y seguridad | Economía circular | Nostr | Herramientas",
  "idioma":      "Español | English | Bilingüe",
  "descripcion": "Descripción breve del recurso",
  "link":        "https://...",
  "autor":       "Nombre del autor o proyecto",
  "gratuito":    "Sí | No | Freemium",
  "github_user": "usuario_github",
  "fecha_alta":  "2026-04-20",
  "aprobado":    true
}
```

---

## comunidades.json — Comunidades colaboradoras

Grupos, canales y comunidades del ecosistema Bitcoin en España.

```json
{
  "id":          "com-0001",
  "nombre":      "Nombre de la comunidad",
  "plataforma":  "Telegram | Discord | Nostr | Matrix | Web | Twitter / X | Otra",
  "link":        "https://t.me/...",
  "web":         "https://... (si tiene web propia)",
  "pais":        "España",
  "ciudad":      "Ciudad (si es local)",
  "miembros":    "~500 | Activa | En crecimiento",
  "descripcion": "Descripción y enfoque de la comunidad",
  "idioma":      "Español",
  "contacto":    "@admin o email",
  "lightning":   "dirección@getalby.com (si acepta donaciones)",
  "nostr":       "npub1...",
  "fuente":      "2140meetups.com (si fue importada)",
  "github_user": "usuario_github",
  "fecha_alta":  "2026-04-20",
  "aprobado":    true
}
```

---

## anuncios.json — Tablón P2P

Anuncios de busco/ofrezco, trueques e intercambios entre personas.

```json
{
  "id":          "anuncio-0001",
  "tipo":        "Ofrezco servicio | Busco servicio | Intercambio / trueque directo | Busco colaborador / socio | Alquilo / Vendo | Otro",
  "titulo":      "Título del anuncio",
  "descripcion": "Descripción completa",
  "zona":        "Online | Madrid | España | ...",
  "duracion":    "Hasta cubrir la plaza | 30 días | Acuerdo mensual",
  "presupuesto": "0.01 BTC | Negociable | Trueque",
  "contacto":    "@telegram o email",
  "github_user": "usuario_github",
  "fecha_alta":  "2026-04-20",
  "aprobado":    true
}
```

---

## destacados.json — Selección del mantenedor

Entradas curadas por el mantenedor para el strip de destacados.
Puede referenciar entradas existentes por `ref_id` o contener datos propios.

```json
{
  "id":               "dest-0001",
  "tipo":             "nodo | evento | guia | comunidad | anuncio",
  "ref_id":           "nodo-0001 (si referencia una entrada del directorio)",
  "motivo":           "Por qué merece estar destacado",
  "orden":            1,
  "destacado_desde":  "2026-04-20",
  "github_user":      "nombre_usuario_github",
  "aprobado":         true,
  "curado":           true
}
```

---

## Notas

- Todos los archivos son arrays JSON (`[]`)
- Los IDs siguen el formato `tipo-NNNN` (ej: `nodo-0042`)
- `fecha_alta` usa formato ISO 8601: `YYYY-MM-DD`
- Los campos vacíos se dejan como `""` (string vacío), nunca `null`
- `aprobado: true` es requerido para que la web muestre la entrada
