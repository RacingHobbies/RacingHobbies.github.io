#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Ningún argumento puede seleccionar una carpeta fuente para reemplazarla.
if [[ "$#" -gt 1 || ( "$#" -eq 1 && "$1" != '.release' ) ]]; then
  echo 'ERROR: solo se permite el destino fijo .release.' >&2
  exit 1
fi
bash "$PROJECT_DIR/scripts/security-audit.sh"
# Validar lo aprobado; nunca recalcular SRI para aceptar alteraciones.
node "$PROJECT_DIR/scripts/package-production.mjs"
