#!/usr/bin/env bash
set -euo pipefail

# Auditoría local de regresión para el sitio estático.
# No sustituye una revisión del hosting: las cabeceras solo existen en
# producción si el proveedor aplica `_headers` (o una configuración equivalente).

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v rg >/dev/null 2>&1 || fail "rg es necesario para la auditoría."
command -v node >/dev/null 2>&1 || fail "Node.js es necesario para validar JavaScript."
command -v openssl >/dev/null 2>&1 || fail "OpenSSL es necesario para validar hashes CSP."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum es necesario para validar dependencias vendorizadas."
bash -n scripts/verify-production-security.sh scripts/verify-domain-security.sh ||
  fail "La sintaxis de un verificador de seguridad es inválida."
bash -n scripts/update-sri.sh scripts/build-production.sh scripts/package-production.sh ||
  fail "La sintaxis del flujo de build/SRI es inválida."

html_files=( *.html )
shopt -s nullglob

for file in "${html_files[@]}"; do
  rg -q 'Content-Security-Policy' "$file" || fail "$file no declara CSP."
  rg -q "script-src-attr 'none'" "$file" || fail "$file permite atributos de script inline."
  rg -q "script-src-elem 'self'" "$file" || fail "$file no restringe los elementos script."
  rg -q "style-src-attr 'none'" "$file" || fail "$file permite estilos inline."
  rg -q "style-src-elem 'self'" "$file" || fail "$file permite hojas de estilo externas."
  rg -q "img-src 'self';" "$file" || fail "$file permite imágenes data: o externas."
  rg -q "object-src 'none'" "$file" || fail "$file no bloquea plugins embebidos."
  rg -q "base-uri 'self'" "$file" || fail "$file no restringe base-uri."
  rg -q "form-action 'self'" "$file" || fail "$file no restringe form-action."
done

rg -q "frame-src https://www.google.com" index.html || fail "La portada no permite el mapa autorizado."
for file in catalogo.html contacto.html garantia.html nosotros.html privacidad.html servicio-tecnico.html 404.html; do
  rg -q "frame-src 'none'" "$file" || fail "$file permite iframes no necesarios."
done

rg -q "frame-ancestors 'none'" _headers || fail "Falta frame-ancestors en las cabeceras de hosting."
rg -q 'Cross-Origin-Opener-Policy: same-origin' _headers || fail "COOP no está aislando el contexto de navegación."
rg -q 'Cross-Origin-Resource-Policy: same-origin' _headers || fail "CORP no está restringiendo recursos cross-origin."
rg -q 'Strict-Transport-Security:' _headers || fail "Falta HSTS en las cabeceras de hosting."
rg -q 'X-Content-Type-Options: nosniff' _headers || fail "Falta nosniff en las cabeceras de hosting."
rg -q 'Permissions-Policy:' _headers || fail "Falta Permissions-Policy en las cabeceras de hosting."
rg -q 'X-Frame-Options: DENY' _headers || fail "Falta X-Frame-Options DENY en las cabeceras de hosting."
rg -q "img-src 'self';" _headers || fail "La CSP del hosting permite imágenes fuera de self."
rg -q "img-src 'self';" nginx-security-headers.conf.example ||
  fail "La plantilla Nginx permite imágenes fuera de self."
for directive in "script-src-attr 'none'" "style-src-elem 'self'" "style-src-attr 'none'"; do
  rg -Fq "$directive" _headers ||
    fail "La CSP del hosting no contiene: $directive"
done
for header in \
  'Origin-Agent-Cluster: ?1' \
  'Referrer-Policy: strict-origin-when-cross-origin' \
  'X-DNS-Prefetch-Control: off' \
  'X-Download-Options: noopen' \
  'X-Permitted-Cross-Domain-Policies: none'; do
  rg -Fq "$header" _headers || fail "Falta la cabecera de hosting: $header"
done

if rg -n "unsafe-inline|unsafe-eval|script-src[^;]*\\*" \
  --glob '*.html' _headers nginx-security-headers.conf.example; then
  fail "La CSP contiene una relajación insegura."
fi
if rg -n "unsafe-inline|unsafe-eval|script-src[^;]*\\*" .htaccess; then
  fail "La CSP Apache contiene una relajación insegura."
fi

if rg -n 'data:image' --glob '*.html' --glob '*.css' --glob '*.js' --glob '!*.map'; then
  fail "Se encontró una imagen data: que la CSP estricta bloquearía."
fi
rg -q 'return 308 https://\$host\$request_uri;' nginx-security-headers.conf.example ||
  fail "La plantilla Nginx no fuerza HTTP a HTTPS."
for nginx_directive in \
  'autoindex off;' \
  'error_page 404 /404.html;' \
  'location ~ (^|/)\.(?!well-known' \
  'package\.json|config\.json' \
  'location ~* \.(?:php[0-9]?|phtml|phar' \
  'if ($request_method !~ ^(GET|HEAD|OPTIONS)$)' \
  'deny all;'; do
  rg -Fq "$nginx_directive" nginx-security-headers.conf.example ||
    fail "Falta en la plantilla Nginx la defensa: $nginx_directive"
done

[[ -f .htaccess ]] || fail "Falta la configuración Apache de seguridad (.htaccess)."
for apache_directive in \
  'Options -Indexes' \
  'ErrorDocument 404 /404.html' \
  'Header always set Strict-Transport-Security' \
  'Header always set X-Content-Type-Options "nosniff"' \
  'Header always set X-Frame-Options "DENY"' \
  'RewriteRule (^|/)\.(?!well-known' \
  'LimitExcept GET HEAD OPTIONS' \
  'FilesMatch "^(?:\.|.*\.(?:bak|old|orig|swp|swo|map))$"' \
  'Require all denied'; do
  rg -Fq "$apache_directive" .htaccess ||
    fail "Falta en .htaccess la defensa Apache: $apache_directive"
done
for apache_csp_directive in \
  "script-src-attr 'none'" \
  "style-src-elem 'self'" \
  "style-src-attr 'none'" \
  "frame-ancestors 'none'" \
  "img-src 'self'"; do
  rg -Fq "$apache_csp_directive" .htaccess ||
    fail "Falta en .htaccess la directiva CSP: $apache_csp_directive"
done

if rg -n 'href="javascript:|src="javascript:|srcdoc=' --glob '*.html' --glob '*.js' --glob '!*.min.js'; then
  fail "Se encontraron destinos o documentos ejecutables inseguros."
fi

if rg -n '<[^>]+\bon[a-z]+\s*=' --glob '*.html'; then
  fail "Se encontraron manejadores de evento inline."
fi

if rg -n '<script[^>]+src="(?:https?:)?//' --glob '*.html'; then
  fail "Se encontró un script remoto fuera del control del sitio."
fi
if rg -n '<img[^>]+(?:src|srcset)="(?:https?:)?//' --glob '*.html'; then
  fail "Se encontró una imagen remota fuera del control del sitio."
fi

if rg --pcre2 -n '<script(?![^>]*\bsrc=)(?![^>]*type="application/ld\+json")' --glob '*.html'; then
  fail "Se encontró JavaScript inline fuera de JSON-LD."
fi

if rg --pcre2 -n '<style\b|\sstyle\s*=' --glob '*.html'; then
  fail "Se encontró CSS inline fuera de las hojas verificadas."
fi

for file in "${html_files[@]}"; do
  while IFS= read -r tag; do
    src="$(printf '%s\n' "$tag" | sed -n 's/.*src="\([^"]*\)".*/\1/p')"
    integrity="$(printf '%s\n' "$tag" | sed -n 's/.*integrity="\(sha256-[^"]*\)".*/\1/p')"
    [[ -n "$src" && -n "$integrity" ]] ||
      fail "$file contiene un script sin integridad SRI."
    relative="${src%%\?*}"
    relative="${relative#/}"
    [[ -f "$relative" ]] || fail "No existe el script SRI: $relative"
    actual="sha256-$(openssl dgst -sha256 -binary "$relative" | openssl base64 -A)"
    [[ "$actual" == "$integrity" ]] ||
      fail "El hash SRI no coincide para $relative."
  done < <(rg '<script[^>]+src=' "$file")

  while IFS= read -r tag; do
    src="$(printf '%s\n' "$tag" | sed -n 's/.*href="\([^"]*\)".*/\1/p')"
    integrity="$(printf '%s\n' "$tag" | sed -n 's/.*integrity="\(sha256-[^"]*\)".*/\1/p')"
    [[ -n "$src" && -n "$integrity" ]] ||
      fail "$file contiene una hoja CSS sin integridad SRI."
    relative="${src%%\?*}"
    relative="${relative#/}"
    [[ -f "$relative" ]] || fail "No existe la hoja CSS SRI: $relative"
    actual="sha256-$(openssl dgst -sha256 -binary "$relative" | openssl base64 -A)"
    [[ "$actual" == "$integrity" ]] ||
      fail "El hash SRI no coincide para $relative."
  done < <(rg '<link[^>]+rel="stylesheet"' "$file")
done

scan_files=( *.html js/*.js css/*.css README.md SECURITY.md .well-known/security.txt *.json *.example _headers .htaccess )
if rg -n \
  -g '!*.min.js' \
  -e '-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}' \
  "${scan_files[@]}"; then
  fail "Se detectó una credencial o clave privada en el paquete publicado."
fi

secret_files="$(find . -maxdepth 3 -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' \) -not -name '.env.example' -print)"
if [[ -n "$secret_files" ]]; then
  printf '%s\n' "$secret_files"
  fail "Hay archivos potencialmente secretos dentro del paquete publicado."
fi

# macOS puede regenerar .DS_Store mientras el proyecto está abierto. Están
# excluidos por .gitignore y los servidores configurados aquí bloquean todos
# los archivos ocultos salvo .well-known, por lo que no son un fallo de código.

missing_rel="$({
  rg -n 'target="_blank"' --glob '*.html' |
    while IFS=: read -r file line _; do sed -n "${line}p" "$file"; done |
    rg -v 'rel="noopener noreferrer"' || true
})"
if [[ -n "$missing_rel" ]]; then
  printf '%s\n' "$missing_rel"
  fail "Hay enlaces _blank sin noopener noreferrer."
fi

node --check js/main.js
node --check js/catalog.js
node --check js/contact.js
node --check js/frame-guard.js

for file in index.html contacto.html; do
  hash="$({
    perl -0777 -ne 'if (/<script type="application\/ld\+json">(.*?)<\/script>/s) { print $1 }' "$file"
  } | openssl dgst -sha256 -binary | openssl base64 -A)"
  rg -q "$hash" _headers || fail "El hash CSP JSON-LD de $file no coincide con _headers."
done

rg -q 'sandbox' js/main.min.js || fail "El artefacto minificado no contiene el sandbox del mapa."
rg -q 'frame-guard.min.js' --glob '*.html' || fail "Falta el guardia anti-clickjacking en HTML."
rg -q 'Contact: mailto:' .well-known/security.txt || fail "security.txt no tiene contacto."
rg -q 'Canonical: https://' .well-known/security.txt || fail "security.txt no tiene URL canónica."
rg -v '^#' VENDOR-SHA256SUMS | sha256sum --check - >/dev/null ||
  fail "Cambió la integridad de una dependencia vendorizada."

echo "Auditoría de seguridad local: OK (${#html_files[@]} páginas, CSP, cabeceras, scripts y enlaces verificados)."
