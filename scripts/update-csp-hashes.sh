#!/usr/bin/env bash
set -euo pipefail

# Recalcula los hashes CSP de los bloques JSON-LD y los propaga a TODAS las
# cabeceras del sitio: el <meta http-equiv> de cada página (el único que rige
# en GitHub Pages), `_headers`, `.htaccess` y el ejemplo de nginx.
#
# Existe porque estos hashes se llevaban a mano y se desincronizaron: al
# cambiar el teléfono del JSON-LD sólo se actualizó `_headers`, y los otros
# tres sitios se quedaron con el par viejo. La auditoría sólo miraba
# `_headers`, así que el desfase pasó inadvertido.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js es necesario para actualizar los hashes CSP." >&2
  exit 1
}

node <<'NODE'
const crypto = require("crypto");
const fs = require("fs");

// El orden importa: es el que queda escrito en la directiva.
const jsonLdPages = ["index.html", "contacto.html"];
const blockPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;

const hashes = jsonLdPages.map((file) => {
  const match = fs.readFileSync(file, "utf8").match(blockPattern);
  if (!match) throw new Error(`${file}: no se encontró el bloque JSON-LD.`);
  const digest = crypto.createHash("sha256").update(match[1]).digest("base64");
  return `'sha256-${digest}'`;
});
const allowList = hashes.join(" ");

// Sustituye la lista completa de hashes de `script-src` y `script-src-elem`,
// venga en el orden que venga y sean los que sean.
const directivePattern = /(script-src(?:-elem)? 'self')((?: 'sha256-[A-Za-z0-9+/=]+')+)/g;

const targets = [
  ...fs.readdirSync(".").filter((file) => file.endsWith(".html")),
  "_headers",
  ".htaccess",
  "nginx-security-headers.conf.example",
];

let touched = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, "utf8");
  if (!directivePattern.test(original)) continue;
  directivePattern.lastIndex = 0;
  const updated = original.replace(
    directivePattern,
    (_full, head) => `${head} ${allowList}`
  );
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    touched += 1;
  }
}

console.log(`Hashes CSP JSON-LD actualizados (${touched} archivo(s) reescrito(s)).`);
NODE
