#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# El entorno de Pages solo necesita Node: el empaquetador valida la lista de
# archivos y todos los hashes SRI antes de crear la salida.
node "$PROJECT_DIR/scripts/package-production.mjs" --target=cloudflare
