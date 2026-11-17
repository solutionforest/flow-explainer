import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { root } from './load-core.mjs';

const { resolveFile } = createRequire(import.meta.url)(join(root, 'server.js'));
const rel = (/** @type {string} */ p) => { const f = resolveFile(p); return f && f.slice(root.length + 1); };

test('pages, with or without a trailing slash', () => {
  for (const [u, f] of [['/', 'index.html'], ['/3d', '3d.html'], ['/3d/', '3d.html'], ['/embed', 'index.html'], ['/embed/', 'index.html'], ['/embed/3d', '3d.html'], ['/embed/3d/', '3d.html'], ['/index.html', 'index.html'], ['/3d.html', '3d.html']])
    assert.equal(rel(u), f, u);
});

test('assets load from the /3d/ and /embed/ sub-paths', () => {
  assert.equal(rel('/embed/3d/vendor/three.module.js'), 'vendor/three.module.js');
  assert.equal(rel('/embed/vendor/inter-latin.woff2'), 'vendor/inter-latin.woff2');
  assert.equal(rel('/3d/favicon.svg'), 'favicon.svg');
  assert.equal(rel('/robots.txt'), 'robots.txt');
});

test('private files and path tricks are refused', () => {
  for (const u of ['/package.json', '/.git/config', '/.cloud/config.json', '/node_modules/x.js', '/server.js', '/tools/sync-parser.py', '/tsconfig.json', '/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/%E0%A4%A', '/nope', '/a%00b'])
    assert.equal(resolveFile(u), null, u);
});
