#!/usr/bin/env node
// Copies the inline <script> code of index.html and 3d.html into .check/*.js so ESLint and
// the TypeScript checker can read it. Lines stay on the same line numbers as in the HTML
// (everything outside the script is blanked), so reported lines match the page source.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.check');
mkdirSync(out, { recursive: true });

for (const [page, name] of [['index.html', 'index.js'], ['3d.html', '3d.js']]) {
  const html = readFileSync(join(root, page), 'utf8');
  const lines = html.split('\n');
  const keep = new Array(lines.length).fill('');
  let module = false;
  // only real code: skip text/plain examples and the JSON-LD block
  const re = /<script(?![^>]*type="(?:text\/plain|application\/ld\+json)")([^>]*)>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    if (/type="module"/.test(m[1])) module = true;
    const start = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length - 1;
    const code = m[2].split('\n');
    const first = lines[start].slice(lines[start].indexOf('>', lines[start].indexOf('<script')) + 1);
    code[0] = first.includes('</script>') ? first.slice(0, first.indexOf('</script>')) : first;
    code.forEach((l, i) => { keep[start + i] = l; });
  }
  let js = keep.join('\n');
  if (module) js = js.replace("'./vendor/three.module.js'", "'three'");
  // Page scripts import ./core.mjs; from .check/ that path is ../core.mjs
  js = js.replace(/from ['"]\.\/core\.mjs['"]/g, "from '../core.mjs'");
  writeFileSync(join(out, name), js);
  console.log(`${page} -> .check/${name}${module ? ' (module)' : ''}`);
}
