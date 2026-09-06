#!/usr/bin/env bash
set -euo pipefail

# Recalcula la integridad SRI de todos los scripts y estilos locales incluidos
# por las páginas HTML. Se ejecuta después de cualquier build de producción.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js es necesario para actualizar SRI." >&2
  exit 1
}

node <<'NODE'
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const htmlFiles = fs.readdirSync(".").filter((file) => file.endsWith(".html"));
const tagPattern = /<(script\b[^>]*\bsrc="[^"]+"[^>]*|link\b[^>]*\brel="stylesheet"[^>]*)>/gi;
const attrPattern = /\b(src|href)="([^"]+)"/i;

for (const file of htmlFiles) {
  const original = fs.readFileSync(file, "utf8");
  const updated = original.replace(tagPattern, (tag) => {
    const match = tag.match(attrPattern);
    if (!match) return tag;
    const url = match[2];
    if (/^(?:https?:)?\/\//i.test(url)) {
      throw new Error(`${file}: recurso remoto no permitido para SRI local: ${url}`);
    }
    const relative = url.split("?", 1)[0].replace(/^\/+/, "");
    if (!relative || !fs.existsSync(relative) || !fs.statSync(relative).isFile()) {
      throw new Error(`${file}: no existe el recurso SRI: ${relative}`);
    }
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(relative))
      .digest("base64");
    const integrity = `sha256-${digest}`;
    if (/\bintegrity="[^"]*"/i.test(tag)) {
      return tag.replace(/\bintegrity="[^"]*"/i, `integrity="${integrity}"`);
    }
    return tag.replace(/>$/, ` integrity="${integrity}">`);
  });
  if (updated !== original) fs.writeFileSync(file, updated);
}
NODE

echo "SRI actualizado para scripts y hojas CSS locales."
