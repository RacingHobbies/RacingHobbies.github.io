import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const pages = ['index.html', 'catalogo.html', 'contacto.html', 'nosotros.html',
  'servicio-tecnico.html', 'garantia.html', 'privacidad.html', '404.html'];
const common = [...pages, '_headers', '.nojekyll',
  'robots.txt', 'sitemap.xml', 'site.webmanifest', '.well-known/security.txt'];
const targets = {
  apache: { destination: '.release', fixed: [...common, '.htaccess'] },
  cloudflare: { destination: '.cloudflare-pages', fixed: common }
};
const metadata = name => name === '.DS_Store' || name === 'Thumbs.db' || name.startsWith('._');
const hash = data => createHash('sha256').update(data).digest('base64');
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

function regular(root, relative) {
  let current = root;
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..') throw Error('Ruta inválida: ' + relative);
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Enlace simbólico no permitido: ' + relative);
  }
  if (!fs.statSync(current).isFile()) throw Error('No es un archivo regular: ' + relative);
  return current;
}

export function buildRelease(root, options = {}) {
  root = fs.realpathSync(root);
  const target = options.target || 'apache';
  const config = targets[target];
  if (!config) throw Error('Destino de publicación no permitido: ' + target);
  const destinationName = config.destination;
  const destination = path.join(root, destinationName);
  const workPrefix = destinationName.slice(1);
  function checkDestination() {
    if (!exists(destination)) return;
    const stat = fs.lstatSync(destination);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error(destinationName + ' debe ser un directorio real.');
  }
  checkDestination();
  const files = [...config.fixed];
  function walk(relative, extensions) {
    const dir = path.join(root, relative);
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('Directorio no permitido: ' + relative);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (metadata(entry.name)) continue;
      const child = relative + '/' + entry.name;
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw Error('Ruta no publicable: ' + child);
      if (entry.isDirectory()) walk(child, extensions);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(child);
      else throw Error('Archivo no publicable: ' + child);
    }
  }
  walk('assets', new Set(['.webp', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff2']));
  walk('css', new Set(['.css']));
  walk('js', new Set(['.js']));

  // Snapshot: HTML y recursos se validan antes de escribir el paquete.
  const snapshot = new Map(files.map(file => [file, fs.readFileSync(regular(root, file))]));
  let references = 0;
  for (const page of pages) {
    const html = snapshot.get(page).toString('utf8');
    for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const attr = name => tag.match(new RegExp('\\s' + name + '\\s*=\\s*(["\x27])(.*?)\\1', 'i'))?.[2];
      const isScript = /^<script\b/i.test(tag);
      if (isScript ? !attr('src') : attr('rel') !== 'stylesheet') continue;
      const url = attr(isScript ? 'src' : 'href');
      if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) || /[%\\#]/.test(url)) throw Error('URL SRI no local: ' + url);
      const relative = url.split('?')[0].replace(/^\//, '');
      if (relative.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Ruta SRI inválida: ' + relative);
      const data = snapshot.get(relative);
      if (!data || attr('integrity') !== 'sha256-' + hash(data)) throw Error('SRI incorrecto: ' + page + ' → ' + relative);
      references++;
    }
  }

  const staging = fs.mkdtempSync(path.join(root, '.' + workPrefix + '-staging-'));
  let backup;
  let archive;
  let manifest;
  try {
    for (const [relative, data] of snapshot) {
      const targetFile = path.join(staging, relative);
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, data, { flag: 'wx', mode: 0o644 });
      if (!fs.readFileSync(targetFile).equals(data)) throw Error('Copia incorrecta: ' + relative);
    }
    // Si otra tarea editó el sitio durante la copia, conservar el paquete anterior.
    for (const [relative, data] of snapshot) {
      if (!fs.readFileSync(regular(root, relative)).equals(data)) throw Error('El origen cambió durante el empaquetado: ' + relative);
    }
    // Conservar un entregable con nombre único antes de promover la carpeta
    // compartida .release, que otro flujo de trabajo podría modificar después.
    const artifactPrefix = target === 'apache' ? '.release-artifacts-' : '.cloudflare-artifacts-';
    const artifacts = fs.mkdtempSync(path.join(root, artifactPrefix));
    archive = path.join(artifacts, 'racing-hobbies.tar.gz');
    manifest = path.join(artifacts, 'manifest.json');
    const packed = spawnSync('tar', ['-czf', archive, '-C', staging, '.'], {
      encoding: 'utf8', timeout: 600000,
      env: { ...process.env, COPYFILE_DISABLE: '1' }
    });
    if (packed.error || packed.status !== 0) throw Error('No se pudo crear el archivo comprimido: ' + (packed.error?.message || packed.stderr));
    fs.writeFileSync(manifest, JSON.stringify({
      archiveSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      references,
      files: Object.fromEntries([...snapshot].map(([relative, data]) => [relative, createHash('sha256').update(data).digest('hex')]))
    }, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
    checkDestination();
    if (exists(destination)) {
      const backupDir = fs.mkdtempSync(path.join(root, '.' + workPrefix + '-backup-'));
      backup = path.join(backupDir, 'previous');
      fs.renameSync(destination, backup);
    }
    try { fs.renameSync(staging, destination); }
    catch (error) {
      if (backup && !exists(destination)) fs.renameSync(backup, destination);
      throw error;
    }
    return { target, destination, backup, archive, manifest, files: snapshot.size, references };
  } catch (error) {
    // Conservar la copia de diagnóstico; no borrar datos recursivamente.
    throw Error(error.message + ' (copia de diagnóstico: ' + staging + ')');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argument = process.argv[2];
    if (process.argv.length > 3 || (argument && argument !== '--target=cloudflare')) {
      throw Error('Solo se permite --target=cloudflare; el destino predeterminado es Apache.');
    }
    const target = argument ? 'cloudflare' : 'apache';
    console.log(JSON.stringify(buildRelease(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { target })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
