#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-https://racinghobbiesec.com/}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl es necesario."
command -v rg >/dev/null 2>&1 || fail "rg es necesario."
command -v openssl >/dev/null 2>&1 || fail "openssl es necesario."

target_host="$(printf '%s' "$TARGET_URL" | sed -E 's#^https://([^/:]+).*#\1#')"
if [[ -z "$target_host" || "$target_host" == "$TARGET_URL" ]]; then
  fail "TARGET_URL debe ser una URL HTTPS válida."
fi

supports_tls() {
  local protocol="$1"
  printf '' |
    openssl s_client "-$protocol" -connect "$target_host:443" -servername "$target_host" 2>/dev/null |
    openssl x509 -noout -subject >/dev/null 2>&1
}

for protocol in tls1 tls1_1; do
  if supports_tls "$protocol"; then
    fail "$target_host todavía acepta el protocolo obsoleto $protocol."
  fi
done

for protocol in tls1_2 tls1_3; do
  supports_tls "$protocol" ||
    fail "$target_host no acepta el protocolo TLS requerido: $protocol."
done

printf '' |
  openssl s_client -connect "$target_host:443" -servername "$target_host" 2>/dev/null |
  openssl x509 -checkend 2592000 -noout >/dev/null 2>&1 ||
  fail "El certificado TLS de $target_host vence en menos de 30 días o no es válido."

headers="$(curl -fsSIL --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$TARGET_URL")" ||
  fail "No se pudo consultar $TARGET_URL."
headers_lower="$(printf '%s\n' "$headers" | tr '[:upper:]' '[:lower:]')"
body="$(curl -fsSL --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$TARGET_URL")" ||
  fail "No se pudo leer el contenido de $TARGET_URL."
if printf '%s\n' "$body" | rg -q 'aes\.js|slowAES|__test='; then
  fail "El servidor responde el challenge legado de OpenResty en vez del sitio."
fi

# Los métodos de escritura se prueban solo en el servidor aislado de
# security-regression.test.mjs. En producción este verificador es de lectura:
# un DELETE sobre la raíz no es un diagnóstico seguro de un servidor desconocido.

http_url="${TARGET_URL/https:/http:}"
http_headers="$(curl -fsSI --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$http_url")" ||
  fail "No se pudo consultar la versión HTTP de $http_url."

target_origin="https://$target_host"
not_found_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$target_origin/__racing_hobbies_security_probe__.html" || true)"
[[ "$not_found_status" == "404" ]] ||
  fail "Una ruta inexistente no devuelve 404 real: HTTP $not_found_status."
not_found_headers="$(curl -sS -D - -o /dev/null --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$target_origin/__racing_hobbies_security_probe__.html")" ||
  fail "No se pudo verificar la respuesta 404."
not_found_headers_lower="$(printf '%s\n' "$not_found_headers" | tr '[:upper:]' '[:lower:]')"
for error_header in 'content-security-policy:' 'x-frame-options: deny' 'x-content-type-options: nosniff'; do
  printf '%s\n' "$not_found_headers_lower" | rg -q -F "$error_header" ||
    fail "La respuesta 404 carece de la cabecera: $error_header"
done

for probe_path in /.env /.git/HEAD /package.json /config.json /server-status /nginx_status; do
  probe_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "$target_origin$probe_path" || true)"
  [[ "$probe_status" == 403 || "$probe_status" == 404 ]] ||
    fail "No se pudo confirmar el bloqueo de $probe_path: HTTP $probe_status"
done

printf '%s\n' "$http_headers" | rg -q '^HTTP/[0-9.]+ (301|302|307|308) ' ||
  fail "HTTP no redirige a HTTPS: $http_url"

printf '%s\n' "$http_headers" | tr '[:upper:]' '[:lower:]' | rg -q '^location: https://' ||
  fail "La redirección HTTP no apunta a HTTPS: $http_url"

# pages.dev es un dominio técnico de Cloudflare: no existe ni debe existir un
# alias "www" por proyecto. La comprobación sigue siendo obligatoria para el
# dominio comercial cuando se conecte más adelante.
if [[ "$target_host" != www.* && "$target_host" != *.pages.dev ]]; then
  www_headers="$(curl -fsSIL --max-time 20 -A 'RacingHobbiesSecurityCheck/1.0' "https://www.$target_host/")" ||
    fail "No se pudo consultar el alias www."
  printf '%s\n' "$www_headers" | rg -q '^HTTP/[0-9.]+ (301|302|307|308) ' ||
    fail "www.$target_host no redirige al dominio canónico."
  printf '%s\n' "$www_headers" | tr '[:upper:]' '[:lower:]' | rg -q "^location: https://$target_host/" ||
    fail "www.$target_host no redirige a https://$target_host/."
fi

required_headers=(
  'content-security-policy:'
  'cross-origin-opener-policy: same-origin'
  'cross-origin-resource-policy: same-origin'
  'strict-transport-security:'
  'x-frame-options: deny'
  'x-content-type-options: nosniff'
  'permissions-policy:'
  'referrer-policy:'
  'origin-agent-cluster: ?1'
  'x-dns-prefetch-control: off'
  'x-download-options: noopen'
  'x-permitted-cross-domain-policies: none'
)

for expected in "${required_headers[@]}"; do
  printf '%s\n' "$headers_lower" | rg -q -F "$expected" ||
    fail "Falta la cabecera de producción: $expected"
done

csp_directives=(
  "default-src 'self'"
  "object-src 'none'"
  "script-src-attr 'none'"
  "style-src-attr 'none'"
  "img-src 'self'"
  "form-action 'self'"
  "frame-ancestors 'none'"
  "upgrade-insecure-requests"
)
for directive in "${csp_directives[@]}"; do
  printf '%s\n' "$headers_lower" | rg -q -F "content-security-policy:" &&
    printf '%s\n' "$headers_lower" | rg -q -F "$directive" ||
    fail "La CSP de producción no contiene: $directive"
done
printf '%s\n' "$headers_lower" | rg -q 'strict-transport-security:.*max-age=[1-9][0-9]*.*includesubdomains' ||
  fail "HSTS no tiene max-age positivo e includeSubDomains."

cookie_headers="$(printf '%s\n' "$headers_lower" | rg '^set-cookie:' || true)"
if [[ -n "$cookie_headers" ]]; then
  while IFS= read -r cookie; do
    for attribute in secure httponly samesite=; do
      printf '%s\n' "$cookie" | rg -q -F "; $attribute" ||
        fail "Una cookie de producción carece del atributo $attribute."
    done
  done <<< "$cookie_headers"
fi

printf '%s\n' "$body" | rg -q 'Racing Hobbies Ecuador' ||
  fail "La respuesta no parece ser el sitio actual de Racing Hobbies."

printf '%s\n' "$body" | rg -q 'js/main\.min\.js\?v=[0-9]+' ||
  fail "La respuesta no contiene el bundle endurecido del sitio actual."

printf '%s\n' "$body" | rg -q 'catalogo\.html' ||
  fail "La respuesta no contiene la estructura del sitio actual."

echo "Seguridad de producción verificada: $TARGET_URL"
