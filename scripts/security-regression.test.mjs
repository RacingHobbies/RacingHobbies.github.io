import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildRelease } from './package-production.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-security-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (name, data = 'fixture') => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), data);
  };
  const sri = createHash('sha256').update('fixture').digest('base64');
  for (const name of ['index', 'catalogo', 'contacto', 'nosotros', 'servicio-tecnico', 'garantia', 'privacidad', '404']) {
    put(name + '.html', '<script src="js/app.js?v=1" integrity="sha256-' + sri + '"></script>');
  }
  for (const name of ['js/app.js', 'css/app.css', 'assets/image.png', '.well-known/security.txt', '.htaccess', '_headers', '.nojekyll', 'robots.txt', 'sitemap.xml', 'site.webmanifest']) put(name);
  return { root, put };
}

test('la protección 404 usa una ruta válida también en URLs anidadas', () => {
  const html = fs.readFileSync(path.join(project, '404.html'), 'utf8');
  assert.match(html, /src="\/js\/frame-guard\.min\.js\?v=1"/);
});

test('CAA interpreta dig +short y no obliga a cambiar la CA del hosting', t => {
  const { root, put } = fixture(t);
  put('bin/dig', '#!/bin/sh\ncase "$*" in\n' +
    '  *"TXT _dmarc."*) echo \'"v=DMARC1; p=reject"\';;\n' +
    '  *"TXT "*) echo \'"v=spf1 -all"\';;\n' +
    '  *"DS "*) echo "123 13 2 ABC";;\n' +
    '  *"DNSKEY "*) echo "257 3 13 ABC";;\n' +
    '  *"+dnssec"*) echo ";; flags: qr rd ra ad;";;\n' +
    '  *"MX "*) :;;\n' +
    '  *"CAA "*) printf "%s\\n" "$TEST_CAA";;\n' +
    '  *) exit 1;;\nesac\n');
  fs.chmodSync(path.join(root, 'bin/dig'), 0o755);
  for (const [records, expected] of [['0 issue "letsencrypt.org"', 0], ['0 issue "pki.goog"', 0], ['0 iodef "mailto:security@example.test"', 1]]) {
    const result = spawnSync('bash', [path.join(project, 'scripts/verify-domain-security.sh'), 'example.test'], {
      encoding: 'utf8', timeout: 60000,
      env: { ...process.env, PATH: path.join(root, 'bin') + ':' + process.env.PATH, TEST_CAA: records }
    });
    assert.equal(result.status, expected, result.stderr);
  }
});

test('rechaza destinos destructivos antes de auditar o modificar el proyecto', () => {
  for (const target of ['assets', 'js', 'css', '.', '..', '/', '../outside', '.release/../assets']) {
    const result = spawnSync('bash', [path.join(project, 'scripts/package-production.sh'), target], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 1, target);
    assert.match(result.stderr, /destino fijo/);
  }
});

test('publica un snapshot verificable y conserva la versión anterior', t => {
  const { root, put } = fixture(t);
  put('.release/keep.txt', 'old release');
  put('assets/.DS_Store');
  put('docs/private.md');
  const result = buildRelease(root);
  assert.equal(result.references, 8);
  assert.equal(fs.readFileSync(path.join(result.backup, 'keep.txt'), 'utf8'), 'old release');
  assert.equal(fs.existsSync(path.join(root, '.release/docs')), false);
  assert.equal(fs.existsSync(path.join(root, '.release/assets/.DS_Store')), false);
  assert.equal(fs.readFileSync(path.join(root, '.release/js/app.js'), 'utf8'), 'fixture');
  const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'));
  assert.equal(manifest.archiveSha256, createHash('sha256').update(fs.readFileSync(result.archive)).digest('hex'));
  const extracted = path.join(root, 'extracted');
  fs.mkdirSync(extracted);
  const unpacked = spawnSync('tar', ['-xzf', result.archive, '-C', extracted], { encoding: 'utf8', timeout: 3000 });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  for (const [relative, digest] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(extracted, relative))).digest('hex'), digest, relative);
  }
  // La copia única sobrevive a cambios posteriores en la carpeta compartida.
  put('.release/js/app.js', 'later edit');
  assert.equal(fs.readFileSync(path.join(extracted, 'js/app.js'), 'utf8'), 'fixture');
});

test('genera una salida Cloudflare separada sin configuración Apache', t => {
  const { root } = fixture(t);
  const result = buildRelease(root, { target: 'cloudflare' });
  assert.equal(path.basename(result.destination), '.cloudflare-pages');
  assert.equal(fs.existsSync(path.join(result.destination, '.htaccess')), false);
  assert.equal(fs.readFileSync(path.join(result.destination, '_headers'), 'utf8'), 'fixture');
  assert.equal(fs.existsSync(path.join(result.destination, 'index.html')), true);
});

test('SRI incorrecto conserva intacta la publicación anterior', t => {
  const { root, put } = fixture(t);
  put('.release/keep.txt', 'old release');
  put('js/app.js', 'unexpected change');
  assert.throws(() => buildRelease(root), /SRI incorrecto/);
  assert.equal(fs.readFileSync(path.join(root, '.release/keep.txt'), 'utf8'), 'old release');
});

test('rechaza secretos anidados y extensiones ejecutables', t => {
  for (const name of ['assets/deep/.env', 'assets/deep/payload.PHP', 'js/debug.map']) {
    const { root, put } = fixture(t);
    put(name);
    assert.throws(() => buildRelease(root), /no publicable/);
  }
});

test('rechaza enlaces simbólicos de recursos y destino, incluso rotos', t => {
  for (const name of ['assets/link.png', '.release']) {
    const { root } = fixture(t);
    fs.symlinkSync(path.join(root, 'nonexistent'), path.join(root, name));
    assert.throws(() => buildRelease(root), /no publicable|directorio real/);
    assert.equal(fs.lstatSync(path.join(root, name)).isSymbolicLink(), true);
  }
});

for (const rewrite of [false, true]) {
  test('Apache real: .htaccess con mod_rewrite=' + rewrite, { skip: !fs.existsSync('/usr/libexec/apache2/mod_headers.so'), timeout: 20000 }, async t => {
    const { root, put } = fixture(t);
    put('.htaccess', fs.readFileSync(path.join(project, '.htaccess')));
    for (const name of ['.env', '.DS_Store', 'backup.BAK', 'payload.PHP', 'config.json', '.git/HEAD']) put(name, 'PRIVATE_FIXTURE');
    fs.mkdirSync(path.join(root, 'empty'));
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1');
    await once(listener, 'listening');
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const modules = ['mpm_prefork', 'authz_core', 'unixd', 'headers', 'mime', 'dir', 'autoindex', ...(rewrite ? ['rewrite'] : [])];
    put('httpd.conf', [
      'ServerRoot "' + root + '"',
      ...modules.map(name => 'LoadModule ' + name + '_module /usr/libexec/apache2/mod_' + name + '.so'),
      'Listen 127.0.0.1:' + port, 'ServerName localhost',
      'PidFile "' + root + '/httpd.pid"', 'ErrorLog "' + root + '/error.log"',
      'DocumentRoot "' + root + '"', 'TypesConfig /private/etc/apache2/mime.types',
      // TRACE se desactiva a nivel servidor; LimitExcept no lo controla.
      'TraceEnable off', 'StartServers 1', 'MinSpareServers 1', 'MaxSpareServers 2',
      '<Directory "' + root + '">', 'AllowOverride All', 'Options FollowSymLinks', 'Require all granted', '</Directory>'
    ].join('\n'));
    const child = spawn('/usr/sbin/httpd', ['-f', path.join(root, 'httpd.conf'), '-DFOREGROUND'], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    t.after(async () => { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } });
    const base = 'http://127.0.0.1:' + port;
    const request = (route, options = {}) => fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(2000), ...options });
    let ready;
    for (let i = 0; i < 30; i++) {
      try { ready = await request('/'); break; }
      catch { if (child.exitCode !== null) throw Error(errors); await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, errors);
    assert.equal(ready.status, 200, fs.readFileSync(path.join(root, 'error.log'), 'utf8'));
    for (const route of ['/.env', '/.DS_Store', '/backup.BAK', '/payload.PHP', '/config.json', '/empty/']) {
      const response = await request(route);
      assert.equal(response.status, 403, route);
      assert.equal((await response.text()).includes('PRIVATE_FIXTURE'), false);
    }
    assert.equal((await request('/.well-known/security.txt')).status, 200);
    const missing = await request('/nested/missing.html');
    assert.equal(missing.status, 404);
    assert.ok(missing.headers.get('content-security-policy'));
    assert.equal(missing.headers.get('x-content-type-options'), 'nosniff');
    assert.match((await request('/js/app.js')).headers.get('cache-control'), /must-revalidate/);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await request('/', { method })).status, 403, method);
    if (rewrite) {
      assert.equal((await request('/.git/HEAD')).status, 403);
      const redirect = await new Promise((resolve, reject) => {
        const req = http.get(base + '/catalogo.html', { headers: { Host: 'racinghobbiesec.com' } }, response => {
          response.resume();
          response.on('end', () => resolve(response));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(Error('timeout')));
      });
      assert.equal(redirect.statusCode, 308);
      assert.equal(redirect.headers.location, 'https://racinghobbiesec.com/catalogo.html');
    }
  });
}
