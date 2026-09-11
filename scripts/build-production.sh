#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Versiones fijadas: compilaciones reproducibles y menor riesgo de cadena
# de suministro que ejecutar paquetes cambiantes con la etiqueta "latest".
LIGHTNINGCSS_VERSION="1.33.0"
TERSER_VERSION="5.49.0"

npx --yes "lightningcss-cli@${LIGHTNINGCSS_VERSION}" --minify css/styles.css -o css/styles.min.css

for source in config data main catalog contact frame-guard; do
  npx --yes "terser@${TERSER_VERSION}" "js/${source}.js" \
    --compress \
    --mangle \
    --comments false \
    --output "js/${source}.min.js"
done

bash scripts/update-csp-hashes.sh
bash scripts/update-sri.sh

echo "Archivos de producción actualizados."
