# Seguridad y publicación

Este sitio es estático. No contiene backend, autenticación ni secretos: el
carrito solo guarda identificadores de productos y cantidades en el navegador,
y el formulario compone un enlace de WhatsApp sin enviar datos a un servidor
propio.

## Antes de publicar

Ejecuta:

```bash
./scripts/build-production.sh
./scripts/security-audit.sh
./scripts/package-production.sh
```

El primer comando regenera los artefactos minificados. El segundo comprueba
CSP, hashes JSON-LD, iframes, scripts, enlaces externos, `security.txt` y
sintaxis JavaScript. También rechaza JavaScript/CSS inline nuevo y recalcula
SRI de todos los scripts y hojas CSS locales.
Además verifica la integridad de los bundles vendorizados.
El build actualiza automáticamente esos hashes SRI mediante
`scripts/update-sri.sh`.
Para una publicación manual, sube únicamente `.release/`; nunca subas la raíz
del proyecto, porque contiene capturas y material interno de trabajo.

## Cabeceras obligatorias

El archivo `_headers` debe ser aplicado por el proveedor. La configuración
esperada incluye CSP, `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy`,
CORP y COOP.
Como el sitio es estático, el servidor debe aceptar únicamente `GET`, `HEAD` y
`OPTIONS`, y rechazar métodos de escritura y extensiones ejecutables.
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

La política recomendada exige DNSSEC y estos registros CAA:

```text
racinghobbiesec.com. CAA 0 issue "letsencrypt.org"
racinghobbiesec.com. CAA 0 issuewild "letsencrypt.org"
```

No debe haber otras autoridades certificadoras autorizadas.

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
3. Sube **el contenido de `.release/`** al directorio público (`htdocs`),
   incluyendo `.htaccess`; no subas la raíz del proyecto.
4. Comprueba que `POST`, `PUT`, `PATCH`, `DELETE`, `TRACE` y `CONNECT` devuelvan
   `403` o `405`, y que una ruta inexistente devuelva `404`.
5. En el proveedor DNS publica SPF con `-all`, DMARC con `p=quarantine` o
   `p=reject`, activa DNSSEC y elimina de CAA todas las autoridades salvo
   `letsencrypt.org`.

Repite ambos verificadores después de cada cambio. No consideres terminado el
despliegue hasta que los dos terminen con éxito.

GitHub Pages no aplica `_headers`, por lo que solo ofrece la CSP declarativa de
los HTML y el guardia anti-clickjacking del cliente. Para obtener HSTS,
`frame-ancestors` y el resto de cabeceras, publica en un host que soporte
`_headers` o coloca Cloudflare delante del dominio. Si el servidor es Apache o
cPanel, sube también `.htaccess`; si es Nginx u OpenResty, usa
`nginx-security-headers.conf.example` dentro del bloque `server`.
