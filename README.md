# Racing Hobbies Ecuador — Sitio web oficial

Sitio estático para **Racing Hobbies** (Quito, Ecuador): tienda de radio
control, repuestos y servicio técnico. La experiencia editorial se organiza
como una secuencia de escenas a pantalla completa: fondos tipo papel/paddock,
contraste claro/oscuro, naranja de la marca, tipografía cinética, navegación
inmersiva, galerías laterales, producto protagonista y movimiento continuo.

Todo el contenido (productos, precios, fotos, marcas, datos de contacto y
horarios) proviene del sitio actual de la marca (racinghobbiesec.com).

## Cómo verlo

No necesita dependencias para verse o publicarse: los archivos optimizados de
producción ya están incluidos. Opciones:

```bash
# Opción 1: abrir directamente
open index.html

# Opción 2: servidor local (recomendado)
python3 -m http.server 8080
# → http://localhost:8080
```

## Publicación

### Vista de prueba segura en Cloudflare Pages

La versión revisada está desplegada gratuitamente en
<https://racing-hobbies-preview.pages.dev/>. Es una vista de prueba en
Cloudflare Pages: no se compró ni conectó ningún dominio, no se modificaron DNS
y no se añadió ningún método de pago. Las respuestas aplican las reglas de
`_headers`, incluidas CSP estricta, HSTS, protección anti-clickjacking y
políticas de permisos. Además, el subdominio gratuito lleva
`X-Robots-Tag: noindex, nofollow` para que los buscadores no lo traten como el
sitio comercial definitivo.

El proyecto se creó mediante **Direct Upload**, sin conceder a Cloudflare
acceso al repositorio de GitHub. Para preparar una actualización manual:

```bash
./scripts/package-cloudflare.sh
# subir el contenido de .cloudflare-pages/ en el proyecto
# racing-hobbies-preview del panel de Cloudflare Pages
```

La salida de Cloudflare excluye `.htaccess`, que solo corresponde a Apache, y
conserva `_headers`. Antes de subirla, el empaquetador valida archivos, rutas e
integridad SRI. Direct Upload es apropiado para estas pruebas; si después se
quieren despliegues automáticos desde GitHub, se crea un proyecto conectado al
repositorio al pasar al dominio definitivo.

Sube **solo los archivos del sitio**, nunca la carpeta entera: `.playwright-cli/`,
`output/`, `.claude/` y `docs/` son material de trabajo (capturas, logs con trazas
de error y rutas locales del equipo) y en GitHub Pages el repositorio es público.
El `.gitignore` ya los excluye; para una carga manual usa
`./scripts/package-production.sh`, extrae el comprimido indicado en una carpeta
vacía y sube únicamente su contenido, incluidos los archivos ocultos. No subas
el comprimido ni su manifiesto al directorio público. Consulta `SECURITY.md`
para identificar el entregable verificado y los pendientes del hosting.

### Publicación anterior en GitHub Pages

En <https://racinghobbies.github.io/>, desde el repositorio
[`RacingHobbies/RacingHobbies.github.io`](https://github.com/RacingHobbies/RacingHobbies.github.io)
(rama `main`, carpeta raíz, HTTPS forzado).

Es un repositorio *de organización* (`<org>.github.io`) a propósito: las páginas
enlazan recursos con rutas absolutas de raíz (`/css/…`, `/js/…`), así que el sitio
**solo funciona servido en la raíz del dominio**. Un repositorio normal lo
publicaría bajo `/nombre-del-repo/` y todos los CSS, scripts e imágenes darían 404.

Para actualizar basta con empujar a `main`; GitHub Pages reconstruye solo:

```bash
bash scripts/build-production.sh   # si tocaste css/*.css o js/*.js
bash scripts/update-sri.sh         # recalcula integrity; sin esto el navegador
                                   # bloquea el recurso y el fallo es silencioso
                                   # (build-production.sh ya llama a este y a
                                   # update-csp-hashes.sh; ejecútalos sueltos
                                   # sólo si editaste HTML a mano)
./scripts/security-audit.sh        # debe decir OK antes de publicar
git add -A && git commit -m "…" && git push
```

### Seguridad según el hosting

| Hosting | ¿Lee `_headers`? | Qué protege al usuario |
|---|---|---|
| Netlify / Cloudflare Pages | **Sí** | Todo: CSP, HSTS, `X-Frame-Options`, `Permissions-Policy` |
| **GitHub Pages** | **No, lo ignora** | Solo la `<meta>` CSP de cada HTML + `js/frame-guard.min.js` |
| cPanel / Apache | No | Necesitaría un `.htaccess` equivalente |

En GitHub Pages **no se pueden enviar cabeceras**. Estas defensas no existen ahí
y no se pueden suplir desde el HTML, porque `<meta>` ignora `frame-ancestors`:

- **Anti-clickjacking** (`X-Frame-Options` / `frame-ancestors`) → suplido a medias
  por `js/frame-guard.min.js`, que es un parche de cliente, no una garantía.
- **HSTS** → activa al menos "Enforce HTTPS" en los ajustes de GitHub Pages.
- **`Permissions-Policy`**, **COOP/CORP**.

La solución real es poner **Cloudflare (plan gratuito)** delante del dominio y
configurar ahí las cabeceras de `_headers`, migrar a Netlify/Cloudflare Pages o
aplicar `.htaccess`/`nginx-security-headers.conf.example` en el servidor que
controle el DNS. Comprueba el resultado en <https://securityheaders.com> y con
`scripts/verify-production-security.sh`; el hosting real no debe asumirse por
la documentación del repositorio.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | Portada: hero cinético, collage accionable, T-Maxx protagonista, vitrina, marcas, deck social y ubicación real |
| `catalogo.html` | Catálogo con los 51 productos reales: búsqueda, filtros, orden y selección compartible |
| `servicio-tecnico.html` | Taller: piezas, reparación, mantenimiento, diagnóstico |
| `nosotros.html` | Historia, misión y valores (texto real de la marca) |
| `contacto.html` | Formulario (abre WhatsApp) + datos de la tienda |
| `css/styles.css` | Todo el diseño (variables de color al inicio) |
| `css/styles.min.css` | Hoja optimizada que cargan las páginas publicadas |
| `js/config.js` | **Teléfono y número de WhatsApp** (cambiar aquí) |
| `js/data.js` | **Catálogo de productos** (nombres, precios, categorías, fotos) |
| `js/main.js` | Carrito, menú inmersivo, transiciones de página, scroll inercial, modal accesible, horario vivo, mapa bajo demanda, reveals, escenas GSAP, parallax y progreso de lectura |
| `js/catalog.js` | Búsqueda sin acentos, filtros/orden, atajo `/` y selección compartible |
| `js/contact.js` | Validación del formulario |
| `js/*.min.js` | JavaScript optimizado que cargan las páginas publicadas |
| `scripts/security-audit.sh` | Auditoría local de regresión de CSP, cabeceras, scripts y enlaces |
| `scripts/verify-production-security.sh` | Verifica cabeceras y contenido del dominio publicado |
| `SECURITY.md` | Runbook de publicación y verificación de seguridad |
| `nginx-security-headers.conf.example` | Cabeceras listas para Nginx/OpenResty |
| `.htaccess` | HTTPS, cabeceras, 404 y bloqueo de archivos sensibles para Apache/cPanel |
| `VENDOR-SHA256SUMS` | Huellas SHA-256 de los bundles de terceros y del guardia anti-clickjacking |
| `scripts/verify-domain-security.sh` | Comprueba SPF, DMARC, DNSSEC y presencia de CAA; no modifica DNS |
| `scripts/security-regression.test.mjs` | Pruebas del empaquetador, reglas Apache, página 404 y verificador CAA |
| `assets/img/` | Fotos reales de productos y logos de marcas |
| `assets/img/social/` | Pósters de los reels de Instagram que salen en "Lo que pasa en redes" |
| `assets/fonts/` | Anton y Archivo (woff2 locales, licencia OFL) |
| `_headers` | CSP, anti-clickjacking, permisos, HSTS y caché. **GitHub Pages lo ignora** |
| `js/frame-guard.js` | Anti-clickjacking de cliente, porque GitHub Pages no manda cabeceras |
| `.nojekyll` | Sin él, GitHub Pages descarta `.well-known/` y el `security.txt` da 404 |
| `.gitignore` | Evita publicar capturas, logs y rutas locales en un repo público |
| `site.webmanifest` | Metadatos de instalación y color del sitio |
| `robots.txt` / `sitemap.xml` | Descubrimiento e indexación |
| `scripts/build-production.sh` | Regenera CSS/JS minificados tras editar fuentes |
| `scripts/update-sri.sh` | Recalcula automáticamente la integridad SRI del HTML |
| `scripts/update-csp-hashes.sh` | Recalcula los hashes CSP del JSON-LD y los propaga a los cuatro sitios que declaran la política |
| `scripts/package-production.sh` | Genera una carpeta publicable y un comprimido único con manifiesto SHA-256 |
| `scripts/package-cloudflare.sh` | Genera y valida `.cloudflare-pages/` para una carga directa, sin archivos exclusivos de Apache |

## Datos reales configurados

- **WhatsApp / celular:** 099 801 9836 (`js/config.js`)
- **Fijo:** 02 334-1561 — **Email:** racinghobbiesquito@gmail.com
- **Dirección:** Av. Eloy Alfaro N40-413 y Granados, frente a Petroecuador
- **Horarios:** Lun 10:00–14:00 — Mar–Vie 9:30–18:30 — Sáb 9:30–16:30
- **Redes:** IG/TikTok @racinghobbies, Facebook (perfil oficial)

## Ediciones frecuentes

- **Agregar/editar productos:** `RH_PRODUCTS` en `js/data.js`. Campos: `id`
  (único), `name`, `cat` (slug de `RH_CATEGORIES`), `price`, `tag`
  (`"top" | "nuevo" | "oferta" | null`), `img` (ruta en `assets/img/`),
  `desc`, `specs`.
- **Cambiar colores:** editar las variables del bloque
  **"LANDONORRIS.COM UX SYSTEM"** al final de `css/styles.css`: `--ln-paper`,
  `--ln-ink`, `--ln-dark`, `--ln-accent` y `--ln-line`.
- **Después de editar CSS o JS:** ejecuta
  `bash scripts/build-production.sh` para actualizar los archivos minificados
  que usa el sitio publicado.
- **Logo oficial:** `assets/img/logo-oficial-t.webp` (completo, fondo
  transparente, usado grande en el hero) y `assets/img/logo-mark.webp` (solo el
  óvalo, usado en header y footer).
- **Cambiar los reels de "Lo que pasa en redes":** las 7 tarjetas viven en
  `index.html` (bloque `.social-fan`). Cada una enlaza a un reel y muestra su
  póster desde `assets/img/social/`. Para reemplazar uno, copia el enlace del
  reel en Instagram y baja su póster —Instagram lo publica en la etiqueta
  `og:image`, sin necesidad de iniciar sesión:

  ```bash
  CODE=DSJDcBdj7EB   # el código que va después de /reel/
  UA="Mozilla/5.0 (compatible; facebookexternalhit/1.1)"
  IMG=$(curl -s -A "$UA" "https://www.instagram.com/reel/$CODE/" \
    | grep -o 'property="og:image" content="[^"]*"' | head -1 \
    | sed 's/.*content="//;s/"$//' | python3 -c 'import sys,html;print(html.unescape(sys.stdin.read().strip()))')
  curl -s -A "$UA" "$IMG" -o /tmp/reel.jpg
  cwebp -q 82 -resize 240 0 /tmp/reel.jpg -o assets/img/social/NOMBRE-240.webp
  cwebp -q 82 /tmp/reel.jpg -o assets/img/social/NOMBRE.webp
  ```

  Luego actualiza en esa tarjeta el `href`, el `src`/`srcset`, el `alt` y el
  `aria-label`. Los pósters llegan a 361×640, así que no conviene mostrarlos
  más anchos que eso.

## Cómo funciona la compra

El carrito se guarda en `localStorage`. Al pulsar **"Pedir por WhatsApp"** se
genera un mensaje con el detalle del pedido y el total hacia el número
configurado; pago y entrega se coordinan por chat (retiro en local o envío
por Servientrega).

## Seguridad

- Sin dependencias externas ni CDNs: código, fuentes e imágenes son locales.
- `Content-Security-Policy` estricta en cada página; sin estilos ni scripts
  inline ejecutables; los dos bloques JSON-LD están autorizados mediante hash,
  sin abrir `unsafe-inline`; los atributos de evento inline están bloqueados y
  solo la portada autoriza el iframe de Google Maps.
- El mapa de Google se carga únicamente tras una acción explícita del visitante;
  antes de eso no se solicita ningún recurso de Google Maps y el iframe usa
  `sandbox` con permisos mínimos.
- `_headers` añade CSP con `frame-ancestors`, HSTS, anti-MIME-sniffing,
  aislamiento de origen, política de permisos reforzada y protección anti-clickjacking
  **solo si el hosting lee el formato** (Netlify/Cloudflare Pages y similares).
  GitHub Pages no lo hace: ver "Seguridad según el hosting" más arriba.
- Datos dinámicos renderizados con `textContent`/escape HTML; imágenes de
  productos limitadas a rutas locales permitidas; carrito validado, limitado,
  deduplicado y tolerante a datos corruptos al leer `localStorage`; búsquedas
  desde la URL limitadas a 80 caracteres; enlaces externos con
  `rel="noopener noreferrer"`.
- El script de producción fija las versiones del minificador CSS y JavaScript
  para que cada compilación sea reproducible.
- Antes de publicar, ejecuta `./scripts/security-audit.sh`; detecta regresiones
  de CSP, iframes no autorizados, scripts remotos, enlaces `_blank` inseguros,
  hashes JSON-LD desactualizados y errores de sintaxis JavaScript.
- Después de publicar, ejecuta `./scripts/verify-production-security.sh URL`;
  el despliegue debe aplicar realmente `_headers` y servir esta versión del
  sitio. La vista gratuita actual supera la comprobación con
  `https://racing-hobbies-preview.pages.dev/`.
- Las páginas informativas y los enlaces de contacto siguen siendo útiles sin
  JavaScript; catálogo dinámico, carrito y validación enriquecida requieren JS.

## Rendimiento y accesibilidad

- Imágenes de catálogo en WebP: el conjunto pasa de unos 22 MB en PNG a menos
  de 3 MB, con carga diferida y dimensiones reservadas para evitar saltos.
- Navegación inmersiva responsive con bloqueo de scroll, Escape y ciclo de
  foco; modal y carrito aíslan el fondo con `inert` y devuelven el foco al
  control de origen.
- Animaciones respetan `prefers-reduced-motion`; foco visible, enlace de salto,
  regiones vivas y mensajes de error asociados a cada campo.
- Cada sección se presenta como un sector numerado, separado por una línea de
  meta animada; los barridos ambientales y la iluminación reactiva al puntero
  refuerzan la atmósfera de circuito sin bloquear la interacción.
- El estado “abierto/cerrado” se calcula en la zona horaria de Quito y el
  catálogo permite copiar o compartir la URL exacta de cualquier filtro.
