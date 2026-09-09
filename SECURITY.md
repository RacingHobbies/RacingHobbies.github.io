# Seguridad y publicación

La implementación revisada es estática, sin backend ni autenticación propios. El
carrito solo guarda identificadores de productos y cantidades en el navegador,
y el formulario compone un enlace de WhatsApp sin enviar datos a un servidor
propio.

## Revisión y despliegue de prueba del 7 de septiembre de 2026

- Vista pública gratuita: <https://racing-hobbies-preview.pages.dev/>.
  Se desplegó en Cloudflare Pages mediante Direct Upload, sin comprar ni
  conectar un dominio, sin tocar DNS ni pagos y sin conceder a Cloudflare
  acceso al repositorio de GitHub.
- Despliegue validado: **360 archivos, 8 páginas y 86 referencias SRI**. La
  variante de Cloudflare conserva `_headers` y excluye `.htaccess`, que solo
  corresponde a Apache.
- Comprobaciones públicas: portada y catálogo responden correctamente; la ruta
  limpia `/catalogo` funciona; una ruta inexistente devuelve un 404 real; y
  `.env`, `.git/HEAD`, `package.json`, `_headers` y `.htaccess` no son públicos.
  El catálogo muestra 51 productos, el carrito persiste entre páginas y genera
  el pedido por WhatsApp. No se observaron errores ni advertencias en la consola
  durante la prueba de portada, catálogo, carrito y 404.
- Cabeceras verificadas: CSP estricta, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, COOP, CORP, `Permissions-Policy`,
  `Referrer-Policy` y aislamiento de origen. El dominio técnico `pages.dev`
  incluye `X-Robots-Tag: noindex, nofollow` para evitar indexación durante las
  pruebas.
- Auditoría local: 8 páginas superan las comprobaciones de CSP, integridad,
  enlaces y sintaxis. Son comprobaciones acotadas, no una garantía de ausencia
  de vulnerabilidades.
- Regresión: 10 pruebas aprobadas, incluidas peticiones a Apache aislado con y
  sin mod_rewrite, rechazo de destinos peligrosos y preservación del paquete
  anterior ante errores de integridad, además de la salida específica para
  Cloudflare Pages.
- Corregidos: bloqueo Apache de archivos ocultos y extensiones en mayúsculas,
  caché de JS/CSS, ruta de protección en errores 404 anidados, publicación
  sin borrados recursivos y lectura de registros CAA.
- El dominio comercial `racinghobbiesec.com`, su DNS y el hosting anterior no
  se modificaron. Su migración queda deliberadamente pendiente hasta que se
  decida adquirir o conectar un dominio; entonces habrá que volver a verificar
  SSL, DNS, SPF/DMARC y redirecciones canónicas.
- El entregable verificado es
  `.release-artifacts-Etpg2W/racing-hobbies.tar.gz`: **361 archivos, 8 páginas
  y 86 referencias SRI verificadas**. Se extrajo a una carpeta temporal y se
  comprobaron todos los archivos contra el manifiesto, además de volver a
  calcular SRI sobre los recursos extraídos. SHA-256 del archivo:
  `843f64488656daf96725111b83f853184443b3ec5746de9ad897a1537c675b54`.
- La carpeta compartida `.release` perdió archivos después de un empaquetado
  exitoso; no se identificó el proceso responsable. Por ello se genera también
  un archivo comprimido en una ubicación única antes de sustituir `.release`.
  Para este despliegue, usar el entregable verificado anterior. Esto no
  equivale a un despliegue en el hosting.

## Antes de publicar

Ejecuta:

```bash
./scripts/build-production.sh
./scripts/security-audit.sh
./scripts/package-production.sh
```

Para Cloudflare Pages usa en su lugar `./scripts/package-cloudflare.sh`; genera
`.cloudflare-pages/` sin configuración exclusiva de Apache. El proyecto de
prueba actual es Direct Upload: las actualizaciones se cargan manualmente al
proyecto `racing-hobbies-preview`. Si más adelante se desea despliegue continuo
desde GitHub, conviene crear entonces un proyecto conectado al repositorio.

El primer comando regenera los artefactos minificados. El segundo comprueba
CSP, hashes JSON-LD, iframes, scripts, enlaces externos, `security.txt` y
sintaxis JavaScript. También rechaza JavaScript/CSS inline nuevo y recalcula
SRI de todos los scripts y hojas CSS locales.
Además verifica la integridad de los bundles vendorizados.
El build actualiza automáticamente esos hashes SRI mediante
`scripts/update-sri.sh`.
Para una publicación manual, extrae el archivo comprimido que indique el
empaquetador en una carpeta vacía y sube únicamente su contenido, incluidos
los archivos ocultos de configuración. No subas el comprimido ni su manifiesto
al directorio público, ni la raíz del proyecto: contiene material interno.
El empaquetador acepta únicamente `.release`, rechaza enlaces simbólicos y
archivos fuera de su lista permitida, valida SRI sobre los bytes que copia y
conserva la versión anterior en `.release-backup-*/previous`. No borra carpetas
fuente ni actualiza hashes para aceptar cambios no revisados. Si falla, conserva
el paquete anterior y una copia de diagnóstico cuando ya inició la escritura.
También genera `.release-artifacts-*/racing-hobbies.tar.gz` y `manifest.json`
con SHA-256 del comprimido y de cada archivo. Estos entregables tienen una
ubicación única para no depender de cambios posteriores en `.release`.

Pruebas de regresión: `node --test scripts/security-regression.test.mjs`.
Incluyen destinos destructivos, SRI alterado, enlaces simbólicos y un Apache
aislado en localhost (estas últimas requieren los módulos Apache de macOS).
`apachectl -t` por sí solo no prueba este `.htaccess`: debe atender peticiones
desde su directorio para comprobar su comportamiento.

## Cabeceras obligatorias

El archivo `_headers` debe ser aplicado por el proveedor. La configuración
esperada incluye CSP, `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy`,
CORP y COOP.
Como el sitio es estático, el servidor debe aceptar únicamente `GET`, `HEAD` y
`OPTIONS`, y rechazar métodos de escritura y extensiones ejecutables.
En Apache, `mod_rewrite` es necesario para HTTPS y el bloqueo de directorios
ocultos completos; `FilesMatch` solo cubre nombres de archivo. Configura
`TraceEnable off` en el servidor/VirtualHost: no se puede poner en `.htaccess`
y `LimitExcept` no desactiva TRACE. Consulta la
[documentación de Apache](https://httpd.apache.org/docs/2.4/mod/core.html#traceenable).
Las pruebas de métodos de escritura se ejecutan en un servidor de prueba aislado.
El verificador público usa GET/HEAD; un `200` de un challenge no prueba que se
haya escrito o borrado contenido y tampoco confirma el bloqueo del origen.
El servidor también debe redirigir HTTP a HTTPS antes de servir contenido. El
dominio canónico es `https://racinghobbiesec.com/`; conviene redirigir
`www` a ese origen para reducir la superficie pública.
El certificado TLS debe renovarse con antelación; el verificador exige al menos
30 días de vigencia restante.
También exige TLS 1.2 y 1.3, y rechaza TLS 1.0/1.1.
Comprueba además que las rutas inexistentes devuelvan 404 y que no sean
accesibles archivos `.env`, `.git`, `package.json`, `config.json` ni
endpoints de estado del servidor.

## DNS

Comprueba la capa DNS con:

```bash
./scripts/verify-domain-security.sh racinghobbiesec.com
```

Activa DNSSEC coordinando el proveedor DNS y el registrador. Restringe CAA a
las autoridades que realmente utilice el hosting para emitir y renovar todos
los certificados. Ejemplo **solo si el proveedor usa Let's Encrypt**:

```text
racinghobbiesec.com. CAA 0 issue "letsencrypt.org"
```

No elimines otras autoridades sin confirmar que ningún servicio las necesita.
`issuewild` es opcional: sin él, `issue` también regula certificados comodín.
Consulta la [documentación CAA de Let's Encrypt](https://letsencrypt.org/docs/caa/).
El verificador comprueba la presencia de `issue`, pero no conoce qué autoridades
están autorizadas por el propietario ni garantiza la renovación del certificado.

Como el dominio también publica MX, debe tener además SPF para sus emisores
legítimos y DMARC con `p=quarantine` o `p=reject`. No conviene copiar
`v=spf1 mx -all` si también se envía correo desde Google Workspace u otro
proveedor: en ese caso hay que añadir el mecanismo `include` correspondiente.

Después del despliegue, valida el dominio real:

```bash
./scripts/verify-production-security.sh https://racinghobbiesec.com/
```

El verificador debe terminar con éxito. Si falla diciendo que el contenido no
parece el sitio actual o que faltan cabeceras, el dominio todavía está sirviendo
otra versión o el hosting no aplica `_headers`; no debe considerarse publicado
de forma segura.

## Publicación en InfinityFree

El DNS actual apunta a InfinityFree. En el panel del proveedor:

1. Renueva o reinstala el certificado SSL para `racinghobbiesec.com` y
   `www.racinghobbiesec.com`.
2. Activa la redirección HTTPS y configura `www` para redirigir al dominio
   canónico `https://racinghobbiesec.com/`.
3. Extrae el comprimido verificado en una carpeta vacía y sube **su contenido**
   al directorio público (`htdocs`), incluyendo `.htaccess`; no subas el
   comprimido, su manifiesto ni la raíz del proyecto.
4. Comprueba los métodos no permitidos en un entorno de prueba controlado y
   verifica con GET que una ruta inexistente devuelva `404` en producción.
5. Inventaría primero los emisores de correo legítimos antes de endurecer SPF
   y DMARC; aplicar rechazo sin ese inventario puede bloquear correo válido.
   Coordina DNSSEC con el registrador y revisa CAA con el proveedor de SSL,
   sin eliminar autoridades necesarias para la renovación.

Repite ambos verificadores después de cada cambio. No consideres terminado el
despliegue hasta que los dos terminen con éxito.

GitHub Pages no aplica `_headers`, por lo que solo ofrece la CSP declarativa de
los HTML y el guardia anti-clickjacking del cliente. Para obtener HSTS,
`frame-ancestors` y el resto de cabeceras, publica en un host que soporte
`_headers` o coloca Cloudflare delante del dominio. Si el servidor es Apache o
cPanel, sube también `.htaccess`; si es Nginx u OpenResty, usa
`nginx-security-headers.conf.example` dentro del bloque `server`.
