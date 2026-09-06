#!/usr/bin/env bash
set -euo pipefail

# Genera un paquete publicable con una lista explícita de rutas del sitio.
# Así una carga manual nunca incluye capturas, logs, notas internas ni secretos.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_NAME="${1:-.release}"

case "$OUTPUT_NAME" in
  ""|.|..|/*|*/*|*\ *)
    echo "ERROR: el destino debe ser un directorio hijo simple, por ejemplo .release." >&2
    exit 1
    ;;
esac

OUTPUT_DIR="$PROJECT_DIR/$OUTPUT_NAME"
[[ "$OUTPUT_DIR" != "$PROJECT_DIR" ]] || {
  echo "ERROR: el destino no puede ser la raíz del proyecto." >&2
  exit 1
}

command -v cp >/dev/null 2>&1 || {
  echo "ERROR: cp es necesario para crear el paquete." >&2
  exit 1
}

bash "$PROJECT_DIR/scripts/security-audit.sh"
bash "$PROJECT_DIR/scripts/update-sri.sh"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

for file in "$PROJECT_DIR"/*.html "$PROJECT_DIR"/robots.txt "$PROJECT_DIR"/sitemap.xml \
  "$PROJECT_DIR"/site.webmanifest "$PROJECT_DIR"/.nojekyll "$PROJECT_DIR"/.htaccess \
  "$PROJECT_DIR"/_headers; do
  [[ -f "$file" ]] || continue
  cp "$file" "$OUTPUT_DIR/"
done

cp -R "$PROJECT_DIR/assets" "$PROJECT_DIR/css" "$PROJECT_DIR/js" "$PROJECT_DIR/.well-known" \
  "$OUTPUT_DIR/"

checked=0
for file in "$PROJECT_DIR"/*.html; do
  while IFS= read -r tag; do
    src="$(printf '%s\n' "$tag" | sed -n 's/.*src="\([^"]*\)".*/\1/p')"
    relative="${src%%\?*}"
    relative="${relative#/}"
    if ! cmp -s "$PROJECT_DIR/$relative" "$OUTPUT_DIR/$relative"; then
      echo "ERROR: el paquete no coincide para $relative." >&2
      exit 1
    fi
    checked=$((checked + 1))
  done < <(rg '<script[^>]+src=' "$file")
  while IFS= read -r tag; do
    src="$(printf '%s\n' "$tag" | sed -n 's/.*href="\([^"]*\)".*/\1/p')"
    relative="${src%%\?*}"
    relative="${relative#/}"
    if ! cmp -s "$PROJECT_DIR/$relative" "$OUTPUT_DIR/$relative"; then
      echo "ERROR: el paquete no coincide para $relative." >&2
      exit 1
    fi
    checked=$((checked + 1))
  done < <(rg '<link[^>]+rel="stylesheet"' "$file")
done

find "$OUTPUT_DIR" -type f \( -name '.DS_Store' -o -name '._*' -o -name 'Thumbs.db' \) -delete
if find "$OUTPUT_DIR" -type f \( -name '.DS_Store' -o -name '._*' -o -name 'Thumbs.db' -o -name '*.map' \) -print -quit | grep -q .; then
  echo "ERROR: el paquete contiene metadatos o mapas fuente." >&2
  exit 1
fi

echo "Paquete de producción creado en: $OUTPUT_DIR ($checked scripts/hojas comparados)"
