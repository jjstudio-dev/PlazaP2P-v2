# scripts/

## parse_issue.py

Script Python que lee el cuerpo de un GitHub Issue y añade la entrada al archivo JSON correspondiente en `data/`.

### Cuándo se ejecuta

Automáticamente por GitHub Actions en dos situaciones:

1. **`auto-approve.yml`** — cuando el mantenedor añade el label `aprobado` a cualquier Issue
2. **`mantenedor.yml`** — cuando se añade el label `mantenedor` y el autor coincide con `vars.MAINTAINER_LOGIN`

### Variables de entorno (inyectadas por el workflow)

| Variable | Contenido |
|----------|-----------|
| `ISSUE_BODY` | Cuerpo del Issue (texto con los campos del formulario) |
| `ISSUE_TITLE` | Título del Issue |
| `ISSUE_NUMBER` | Número del Issue (usado para generar el ID) |
| `ISSUE_USER` | Login de GitHub del autor |
| `ISSUE_LABELS` | JSON con los labels del Issue |

### Flujo de ejecución

```
1. Lee ISSUE_LABELS → detecta el tipo (nodo, evento, guia, comunidad, anuncio, mantenedor)
2. Lee ISSUE_BODY → parsea los campos del formulario (formato "### Campo\n\nValor")
3. Llama al builder correspondiente → construye el objeto JSON
4. Lee el archivo data/*.json existente → añade el nuevo objeto al array
5. Escribe el archivo actualizado
```

### Tipos y archivos destino

| Label del Issue | Builder | Archivo destino |
|-----------------|---------|-----------------|
| `nodo` | `build_nodo()` | `data/nodos.json` |
| `evento` | `build_evento()` | `data/eventos.json` |
| `aprendizaje` | `build_guia()` | `data/guias.json` |
| `comunidad` | `build_comunidad()` | `data/comunidades.json` |
| `anuncio` | `build_anuncio()` | `data/anuncios.json` |
| `mantenedor` | `build_mantenedor()` | `data/destacados.json` |

### Ejecutar localmente (para pruebas)

```bash
export ISSUE_BODY="### Nombre del negocio o alias

Mi Negocio Bitcoin

### Tipo de perfil

Profesional / Freelancer

### País

España"

export ISSUE_NUMBER="99"
export ISSUE_USER="test_user"
export ISSUE_LABELS='[{"name":"nodo"},{"name":"aprobado"}]'

python3 scripts/parse_issue.py
```

### Formato del cuerpo de Issue

GitHub renderiza los formularios YAML como texto con este formato:

```
### Nombre del campo

Valor del campo

### Otro campo

Otro valor
```

Los campos sin rellenar aparecen como `_No response_` y el parser los ignora.

### Añadir un nuevo tipo de entrada

1. Crear la plantilla en `.github/ISSUE_TEMPLATE/XX-nombre.yml` con el label apropiado
2. Añadir el archivo destino en `FILE_MAP` (línea ~22)
3. Crear la función `build_nuevo()` siguiendo el patrón de las existentes
4. Añadir la función a `BUILDERS` (línea ~227)
