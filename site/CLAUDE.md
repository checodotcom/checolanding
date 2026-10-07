# checodotcom — landing page

Sitio personal de Sergio (alias web **checodotcom**): portafolio de diseño web, desarrollo front-end y fotografía, con llamado a contacto para clientes. Es una sola página con anclas. El tono es callado y editorial: grises sobre un fondo casi blanco. El único gesto grande es el wordmark.

- **Idioma:** español (`lang="es"`). Voz corta, sin signos de exclamación. La marca va en minúsculas (`checodotcom`).
- **Diseño de referencia:** un canvas de Claude Design (artboard `Main.dc.html`, 1440 px de ancho). La implementación final debe replicarlo.
- **Sistema de diseño:** "checodotcom" (tokens en `ds/checodotcom/tokens.json`). Este documento resume sus reglas y las decisiones posteriores que lo modifican.
- **Stack de producción:** Astro 7 (salida estática) + Sanity como CMS, con el Studio incrustado en `/admin`. Ver "Stack y contenido".

---

## Stack y contenido

- **Código:** todo vive en `site/`. Componentes en `src/components/`, estilos globales en `src/styles/global.css`, página en `src/pages/index.astro`.
- **CMS:** proyecto de Sanity `0yp7ue4b`, dataset `production`. El Studio se sirve en `/admin` (integración `@sanity/astro` con `studioRouterHistory: "hash"`, necesaria en hosting estático). `/admin` va en `robots.txt` como `Disallow`.
- **Esquemas** (`src/sanity/schemas/`): `project` (nombre, tipo, año, mes, descripción, imagen con hotspot) y `siteSettings` (correo y redes, documento único con id `siteSettings`).
- **Datos:** `src/data/projects.ts` y `src/data/settings.ts` leen de Sanity en el build. Si Sanity falla o no hay proyectos, `projects.ts` usa datos de ejemplo (hay un `TODO` para quitarlos). Sin correo o URL, la página muestra `[placeholder]` y no genera enlace.
- **Orden de proyectos:** año y mes de conclusión, del más reciente al más antiguo; el desempate es la fecha de creación. Nunca se numeran.
- **Sitio estático:** lo publicado en Sanity solo aparece tras un rebuild.
- **Desarrollo:** `npm run dev -- --port 4373` para la landing con recarga en vivo. El Studio **no** carga en dev (error "Outdated Optimize Dep" de Vite); para editar contenido usa `npm run admin` (build + preview en el puerto 4373, que es el origen CORS autorizado).
- **Hosting:** Cloudflare Pages, desplegado desde GitHub (rama `main`) en `https://checodot.com`. Configuración: raíz `site`, build `npm run build`, salida `dist`, Node 24 (`.node-version`).
- **Formulario de contacto (backend):** Worker en `worker/index.ts` (config en `wrangler.jsonc`; el build de Cloudflare ejecuta `npm run build` y luego `npx wrangler deploy`, con raíz `site`). Solo atiende `POST /api/contact` (`assets.run_worker_first: ["/api/*"]`); el resto sale directo de `dist/`. Valida en el servidor (correo estricto, nombre ≥ 2, mensaje ≤ 250, cuerpo ≤ 4 KB), exige `Origin` en `ALLOWED_ORIGINS`, descarta el honeypot en silencio y limpia saltos de línea para evitar inyección de cabeceras. Envía con el binding `send_email` (`CONTACT_EMAIL`) vía Email Routing: remitente `contacto@checodot.com` (var `MAIL_FROM`), `Reply-To` con el correo del visitante, cuerpo UTF-8 en base64. El destino `MAIL_TO` es un **secreto en el panel de Cloudflare**, no está en el repo. Va en **Settings → Runtime variables and secrets** (pestaña Production, casilla *Secret*); la tarjeta "Variables and secrets" de la sección *Builds* es solo de compilación y el Worker **no** la ve (síntoma: el log dice `MAIL_TO definido: false` y el formulario responde 502). `observability` está activada en `wrangler.jsonc`: los errores de envío se leen en Observability → Logs (línea `[contact] no se pudo enviar:`). Para probar en local: `.dev.vars` con `MAIL_TO` falso y `ALLOWED_ORIGINS=http://localhost:8788`, y `npx wrangler dev --port 8788` (los correos simulados caen como `.eml` en `.wrangler/`).
- **Lista de contactos (D1):** cada envío válido se guarda en la base D1 `checodotcom-contactos` (binding `DB`, tabla `contactos`: `id`, `creado_en` en **hora de Ciudad de México** (la calcula el Worker con la zona `America/Mexico_City`; la migración `0002` convirtió las filas viejas, que estaban en UTC), `nombre`, `correo`, `mensaje`, `estado` ∈ `nuevo` | `respondido` | `descartado`). Solo se guarda lo que el visitante escribe; no hay IP. El Worker **guarda primero y avisa por correo después**; responde error solo si fallan las dos cosas. Se consulta en el panel (D1 → checodotcom-contactos → Console): `SELECT * FROM contactos ORDER BY id DESC;` y se marca con `UPDATE contactos SET estado = 'respondido' WHERE id = N;`. El esquema vive en `migrations/`; cada migración nueva se aplica a la base real **antes** de desplegar el código que la usa: `npx wrangler d1 migrations apply checodotcom-contactos --remote`. En local: la misma orden con `--local`.
- **Correo de aviso:** `worker/email-template.ts` genera un `multipart/alternative` (texto + HTML con estilos en línea y tablas, paleta del sitio; Georgia y la sans del sistema sustituyen a Baskervville e Inter, que no existen en el correo). Lleva marca, "Nuevo contacto", nombre, correo, mensaje, botón "Responder" (mailto) y pie con n.º de contacto y hora de México. Todo lo que escribe el visitante se escapa antes de entrar al HTML. El asunto sigue siendo `Contacto: {nombre}` (útil para el filtro de Gmail).
- **Formulario en la página:** el botón Continuar tiene su sitio reservado (`visibility: hidden`; en estrecho tiene su propia fila y en ancho nunca baja de línea), así que al aparecer no empuja el bloque de redes.
- **Email Routing:** activo en `checodot.com` (MX `route1/2/3.mx.cloudflare.net`, SPF y DKIM de Cloudflare). Regla `contacto@checodot.com` → Gmail de Sergio; catch-all apagado. DMARC en `p=none`.
- **Flujo de contenido:** al publicar en Sanity, un webhook (filtro `_type in ["project","siteSettings"]`, solo documentos publicados) llama al deploy hook de Cloudflare y el sitio se reconstruye solo. La URL del deploy hook es secreta: vive solo en Sanity, nunca en el repo.
- **CORS en Sanity:** cada origen necesita **Allow credentials** o el Studio muestra "Not Allowed". Autorizados: `http://localhost:4373` y `https://checodot.com`. Si se agrega otro dominio, repetirlo ahí.
- **Dependencia fijada:** `@sanity/ui` debe ir como dependencia directa en `^4`, porque `sanity@6` la necesita y la integración arrastra la 3.

---

## Regla global: proporción áurea (φ = 1.618)

Todo tamaño sale de la proporción áurea. Antes de inventar un valor nuevo, usa uno de estas escalas.

| Escala | Valores |
| --- | --- |
| Tamaño de fuente (px) | 13 · 16 · 26 · 42 · 68 · 178 |
| Interlineado (px) | 21 · 26 · 34 · 55 |
| Espaciado (px) | 5 · 8 · 13 · 21 · 34 · 55 · 89 · 144 |
| Proporciones | Imágenes 1.618 : 1 · columnas 1 : 1.618 · ancho de imagen 61.8 % |

- El texto corrido va a 16/26 (26 ≈ 16 × φ).
- El wordmark del hero mide 178 px, que es 26 × φ⁴: proporción áurea respecto al nav de 26 px.

---

## Tokens

### Color

El texto siempre va en gris, nunca en negro.

| Token | Valor | Uso |
| --- | --- | --- |
| `surface` | `#f5f5f3` (Hueso, default) | Fondo de página. Alternativas en evaluación: Blanco `#ffffff`, Niebla `#ebebe9`. |
| `surface-raised` | `#fbfbfa` | Header flotante y placeholders de imagen. |
| `line` | `#dcdcda` | Hairlines de 1 px: separadores de sección, borde del header, divisor de columnas. Solo decorativo. |
| `ink-display` | `#828280` | Wordmark y proyectos inactivos de la lista. Solo para texto de 24 px o más, o en estados secundarios. |
| `ink-muted` | `#666664` | Nav en reposo, etiquetas, metadatos, captions. |
| `ink` | `#4a4a48` | Párrafos. |
| `ink-strong` | `#262626` | Hover, estado activo, nombres destacados, anillo de foco. |

### Tipografía

```html
<link href="https://fonts.googleapis.com/css2?family=Baskervville:ital,wght@0,400;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

- **Baskervville** (serif, siempre peso 400): solo para el wordmark (hero, header y footer), los nombres de proyecto en la ficha del portafolio y el correo en Contacto.
- **Inter** (sans): todo lo demás.
- **Títulos de sección:** después del hero se usa *solo* la etiqueta sans: Inter 500, 13/21, mayúsculas, tracking `0.06em`, cifras tabulares, por ejemplo `01 — Portafolio`. Los títulos grandes en serif se quitaron a propósito porque se veían repetitivos. No los reintroduzcas.

| Estilo | Fuente | Tamaño |
| --- | --- | --- |
| Wordmark del hero | Baskervville | `clamp(56px, 12.36vw, 178px)` / 1, tracking `-0.03em`, en una línea. En móvil `15.4vw`. |
| Nav del hero | Inter | 26/34, apilado |
| Logo del header y del footer | Baskervville | 26/34, tracking `-0.02em` |
| Nombre de proyecto / título | Baskervville | 26/34 |
| Correo de contacto | Baskervville | 42/55 |
| Cuerpo y nav del header | Inter | 16/26 |
| Small y metadatos | Inter | 13/21 |
| Etiqueta | Inter 500 | 13/21, mayúsculas, `0.06em` |

### Forma

- Por default todo lleva esquinas cuadradas y ningún elemento lleva sombra. Las imágenes y los anillos de foco van a 2 px.
- **Única excepción:** el header flotante lleva radio de 8 px y una sombra sutil (decisión de Sergio).

---

## Layout

- **Margen lateral:** 34 px en desktop, 13 px en móvil (≤ 720 px).
- **Secciones:** padding vertical de 89 px, separadas por una hairline superior (`line`).
- **Contacto y Acerca:** dos columnas en proporción 1 : 1.618 (`flex: 1` / `flex: 1.618`, base 320 px, se apilan al envolver). El texto tiene un ancho máximo de 610 px.

---

## Secciones

### 1. Hero (`#inicio`)

- No tiene header ni barra superior. La primera pantalla es solo el wordmark y el nav.
- El alto mínimo es de 860 px. El contenido va pegado abajo (`justify-content: flex-end`).
- "checodotcom" va abajo a la izquierda, en una línea.
- El nav (Portafolio, Contacto, Acerca) va apilado a la derecha del wordmark, alineado a su línea base (`align-items: last baseline`), con un gap de 34 px.
- En móvil el nav va apilado arriba a la derecha (16/26, a `13px` del borde superior y al margen derecho) y el wordmark queda abajo a la izquierda. El hero mide `100svh` en lugar de 860 px, para que el wordmark no quede cortado bajo el pliegue.

### Header flotante (aparece con el scroll)

- Está oculto mientras se ve el hero. Aparece **solo** cuando la sección Portafolio llega a ≤ 89 px del borde superior, y se oculta al regresar.
- **Posición:** fijo, a `top: 13px` y a 34 px de cada lado (13 px en móvil).
- **Caja:** fondo `surface-raised`, borde de 1 px `line`, `border-radius: 8px` y sombra `0 1px 2px rgba(38,38,38,.04), 0 8px 34px rgba(38,38,38,.06)`.
- **Contenido:** el logo serif a la izquierda (lleva a `#inicio`) y el nav sans de 16 px a la derecha, con gap de 34 px.
- **Transición:** `translateY` + `opacity` en 260 ms. Cuando está oculto lleva `visibility: hidden` y `aria-hidden="true"` para que el teclado no entre en él.

### 2. Portafolio (`#portafolio`)

- Ocupa el alto de una pantalla de escritorio común: **900 px** (`min-height`). El padding es de 89 px arriba (deja libre el header flotante) y 55 px abajo.
  - En el canvas no se puede usar `100vh`: ahí vale el alto del artboard completo y empuja el resto de las secciones fuera del cuadro. En producción se puede evaluar `min-height: 100svh` con un tope.
- **Estructura** (basada en un índice editorial de 3 columnas): `grid-template-columns: repeat(3, minmax(0,1fr))`, column-gap de 34 px.
- **Columna 1, lista.** Lleva un divisor vertical de 1 px a la derecha y padding de 34 px.
  - Arriba va la etiqueta `01 — Portafolio`. Debajo, la lista de proyectos **sin líneas divisoras**.
  - Cada fila tiene tres columnas: **fecha de conclusión** (116 px, formato `Mayo 2026`), nombre (16 px) y tipo (13 px).
  - **Orden:** por fecha de conclusión, del más reciente al más antiguo. Se ordena en el código a partir de `year` y `month`; nunca se numeran.
  - Al fondo de la columna va una nota pequeña: "Web · Editorial · Fotografía".
- **Columnas 2 y 3, media.** Muestran la imagen del proyecto seleccionado, alineada **abajo a la izquierda**. Mide el 61.8 % del ancho, con proporción 1.618 : 1 y mínimo de 280 px. Debajo van el nombre (Baskervville 26) y una descripción (13 px).
- **Interacción:** al pasar el cursor o hacer clic en una fila, cambia la imagen. La fila activa va en `ink-strong` y las demás en `ink-display`, y se marca con `aria-current="true"`.
  - **Enlaces:** cada proyecto tiene un campo opcional "URL del proyecto" en Sanity. Con URL, la fila es un `<a>` (la fila completa), y la imagen y el nombre bajo la imagen también llevan a esa liga; todos abren en pestaña nueva (`target="_blank"`, `rel="noopener noreferrer"`). El enlace de la imagen duplica el del nombre, por eso va con `tabindex="-1"` y `aria-hidden`. Sin URL, la fila es un `<button>` y no hay enlaces. En táctil (`(hover: none)`), el primer toque en una fila con URL solo la selecciona (vista previa) y el segundo toque, sobre la fila ya activa, navega; la imagen y el nombre bajo la imagen navegan desde el primer toque. Con cursor se selecciona al pasar y se navega al hacer clic; con teclado, al enfocar (`:focus-visible`).
- **Móvil (≤ 900 px):** una sola columna. Se quita el divisor y la imagen ocupa el 100 %.

**Datos actuales** (los gestiona Sergio en Sanity; esto es una foto del 7 de octubre de 2026, las fechas siguen sin confirmar):

| Proyecto | Tipo | Conclusión | Descripción |
| --- | --- | --- | --- |
| Panoramica Store | Vanilla JS | Octubre 2026 | Sitio catálogo para proyecto emergente |
| Galena | Astro | Octubre 2026 | Sitio estático para agencia Galena |
| Clínica quiropráctica | Astro, Componentes | Septiembre 2026 | Sitio web demo para clínica quiropráctica |
| Privateclub | Eleventy, Nunjucks | Agosto 2026 | Blog de música con estética de Windows 95 |

La columna "Tipo" ahora lista tecnologías, no categorías (antes: Demo, Shopify, Editorial, Foto). Sin imagen, cada proyecto muestra el placeholder `[imagen]`.

### 3. Contacto (`#contact`)

- Etiqueta `02 — Contacto`.
- Texto: "¿Tienes un proyecto, una marca que necesita sitio o una sesión de fotos? Escríbeme y platicamos."
- "[tu correo]" es un campo donde el **visitante** escribe su correo (no el de Sergio): serif 42/55 con hairline debajo, el ancho sigue al texto. Cuando el correo es válido (`algo@dominio.xx`, mínimo 2 letras tras el punto) aparece el botón "Continuar" con la estética del header flotante (`surface-raised`, borde `line`, radio 8 px, misma sombra; excepción pedida por Sergio). Al pulsarlo se abre un `<dialog>` modal con la misma estética (fondo desenfocado, entrada de 260 ms con fade y `translateY`; respeta `prefers-reduced-motion`). Contenido, de arriba abajo: correo ya escrito (serif 26/34, editable), Nombre completo (obligatorio), Mensaje (opcional, máx. 250 caracteres con contador, placeholder "Cuéntame qué tienes en mente."), botones Cancelar y Enviar. Se cierra con Esc, clic en el fondo, la × o Cancelar. El `POST` va a `/api/contact` (JSON `{ email, name, message, website }`; `website` es un honeypot anti-bots). Estados: "Enviando…", "No se pudo enviar. Intenta de nuevo." y, al enviar, una confirmación dentro del mismo diálogo: etiqueta "MENSAJE ENVIADO", título serif "Listo, {primer nombre}." (42/55; 26/34 en móvil), "Te respondo a {correo} lo antes posible." y un único botón "Ver portafolio" que cierra el diálogo y baja a `#portafolio` (sin la × ni un "Cerrar" aparte, para que no haya dos controles con la misma acción; Esc y el clic en el fondo siguen cerrando). El panel cambia de altura con transición y el foco pasa a ese botón; un `aria-live` oculto anuncia el mensaje. Al cerrar tras un envío se limpian el formulario y el campo de la página.
- El envío lo atiende `/api/contact` (ver "Stack y contenido"). Si falta el secreto `MAIL_TO` en Cloudflare, el formulario responde error.
- El campo "correo" de "Ajustes del sitio" ya no se muestra en Contacto; queda disponible como destinatario de los avisos.
- Links: Instagram · GitHub · LinkedIn, en pestaña nueva. URLs por defecto en `src/data/settings.ts` (instagram.com/sergioherrasti, github.com/checodotcom, linkedin.com/in/sergio-herrasti-de-la-garza); las de "Ajustes del sitio" en Sanity las reemplazan cuando están publicadas.

### 4. Acerca (`#about`)

- Etiqueta `03 — Acerca`.
- Dos párrafos sobre Sergio: Product Analyst que diseña y desarrolla sitios y tiendas a la medida, y checodotcom como el lugar que reúne ese trabajo y su fotografía.
- Debajo, una cuadrícula de 3 × 2 separada por una hairline, para mostrar el recorrido full stack: Diseño (Web · UX/UI), Desarrollo (Astro · Eleventy · JS · Node · APIs), Foto (Retrato · Calle), Contenido (Sanity · Shopify), Infraestructura (Cloudflare · Git · DNS) y Medición (Analítica de producto). Sergio puede afinar las herramientas de Medición.

### Footer

- El logo serif de 26 px a la izquierda (lleva a `#inicio`).
- A la derecha: "© 2026 · Ciudad de México".

---

## Accesibilidad

- El contraste de los grises pasa incluso sobre Niebla: `ink-muted` 4.8 : 1. `ink-display` solo se usa en texto grande o en estados secundarios.
- Los objetivos táctiles miden ≥ 44 px: las filas del portafolio y los links del header llevan padding vertical.
- El foco visible es un anillo de 2 px en `ink-strong`, con offset de 3 px.
- Usa elementos semánticos reales: `<nav aria-label>`, `<button>` en la lista y `<a href="#…">` para las anclas.

---

## Pendientes

- [ ] Imágenes reales de cada proyecto (hoy son placeholders).
- [ ] Confirmar las fechas de conclusión de los proyectos.
- [ ] Correo de contacto y URLs de Instagram, GitHub y LinkedIn.
- [ ] Elegir el fondo definitivo (Hueso, Blanco o Niebla) y quitar los otros.
- [ ] Actualizar el README del sistema de diseño con lo que cambió: la regla áurea, la escala nueva, el header flotante con sombra y radio de 8 px, y que los títulos de sección usan solo la etiqueta sans.
- [x] Formulario de contacto conectado y probado de punta a punta (el aviso llega al Gmail de Sergio).
- [ ] Opcional: protección extra contra bots (Cloudflare Turnstile o una regla de rate limiting en WAF).
- [ ] Publicar el documento "Ajustes del sitio" en Sanity (correo y redes); hoy la API no lo devuelve.
- [ ] Decidir si la nota de la lista ("Web · Editorial · Fotografía") y el copy de Acerca siguen vigentes ahora que el portafolio lista tecnologías y no incluye fotografía.
- [x] Hosting en Cloudflare Pages, webhook de rebuild desde Sanity y CORS de producción.
- [x] Definir el stack de producción: Astro + Sanity (ver "Stack y contenido").
- [ ] Decidir si cada proyecto tendrá su propia página de detalle.

## Reglas para Claude

- Respeta la escala áurea. No uses valores sueltos (40, 64, 72…) que no estén en ella.
- No agregues sombras, degradados ni esquinas redondeadas fuera del header flotante.
- No reintroduzcas títulos serif en las secciones.
- Mantén el hero sin header. El header solo aparece al llegar a Portafolio.
- No inventes datos: lo que falte va como `[placeholder]`.
