#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-racinghobbiesec.com}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v dig >/dev/null 2>&1 || fail "dig es necesario."

spf_records="$(dig +short TXT "$DOMAIN" | tr -d '"')"
printf '%s\n' "$spf_records" | grep -Eq '(^|[[:space:]])v=spf1([[:space:]]|$)' ||
  fail "$DOMAIN no publica SPF."
printf '%s\n' "$spf_records" | grep -Eq '(^|[[:space:]])-all([[:space:]]|$)' ||
  fail "$DOMAIN publica SPF sin política final -all."

dmarc_records="$(dig +short TXT "_dmarc.$DOMAIN" | tr -d '"')"
printf '%s\n' "$dmarc_records" | grep -Eq '(^|[;[:space:]])v=DMARC1([;[:space:]]|$)' ||
  fail "$DOMAIN no publica un registro DMARC válido."
printf '%s\n' "$dmarc_records" | grep -Eq '(^|;[[:space:]]*)p=(quarantine|reject)(;|$)' ||
  fail "$DOMAIN no publica DMARC con quarantine o reject."

ds_records="$(dig +short DS "$DOMAIN")"
[[ -n "$ds_records" ]] ||
  fail "$DOMAIN no tiene DNSSEC activo: falta un registro DS."
dnskey_records="$(dig +short DNSKEY "$DOMAIN")"
[[ -n "$dnskey_records" ]] ||
  fail "$DOMAIN publica DS pero no DNSKEY."
dnssec_answer="$(dig +dnssec +noall +answer +comments A "$DOMAIN")"
printf '%s\n' "$dnssec_answer" | grep -Eq 'flags:.*(^|[;[:space:]])ad([;[:space:]]|$)' ||
  fail "$DOMAIN no aparece validado por DNSSEC (falta la bandera AD)."

mx_hosts="$(dig +short MX "$DOMAIN" | awk '{print $2}' | sed 's/\\.$//' )"
while IFS= read -r mx_host; do
  [[ -z "$mx_host" ]] && continue
  mx_addresses="$(dig +short A "$mx_host"; dig +short AAAA "$mx_host")"
  [[ -n "$mx_addresses" ]] || fail "El servidor MX $mx_host no resuelve a una dirección."
done <<< "$mx_hosts"

caa_records="$(dig +short CAA "$DOMAIN")"
[[ -n "$caa_records" ]] ||
  fail "$DOMAIN no tiene política CAA."

# dig +short devuelve flags, etiqueta y valor (sin nombre ni TTL).
# La CA legitima depende del hosting; issuewild es opcional.
printf '%s\n' "$caa_records" | awk '
  $2 == "issue" { issue = 1 }
  END { exit !issue }
' || fail "No se encontró una política CAA issue explícita en este dominio."

echo "Comprobaciones DNS básicas superadas para $DOMAIN."
echo "CAA observado (confirmar con el proveedor que permite renovar todos los certificados):"
printf '%s\n' "$caa_records"
