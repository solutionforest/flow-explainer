// Loads the shared, DOM-free part of index.html (markdown + Mermaid parsers, layout, diagram styles)
// into a Node VM so it can be unit-tested without a browser. The pages stay standalone files.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '/* ---------- shared core:';
const ENDS = ['/* ---------- isometric drawing ---------- */', '/* ---------- 3D scene (three.js) ---------- */'];

/** @param {string} [page] */
export function loadCore(page = 'index.html') {
  const html = readFileSync(join(root, page), 'utf8');
  const a = html.indexOf(START), b = Math.max(...ENDS.map(e => html.indexOf(e)));
  if (a < 0 || b < 0) throw new Error('core markers not found in ' + page);
  const code = html.slice(a, b);
  const ctx = vm.createContext({ console, location: { hash: '', pathname: '/', search: '', origin: 'http://x' } });
  const names = ['parseMarkdown', 'parseMermaid', 'layout', 'cleanText', 'codeLines', 'STYLES', 'esc', 'mdInline', 'fmtNum'];
  vm.runInContext(code + '\n;globalThis.__core={' + names.join(',') + '};', ctx, { filename: page });
  const core = /** @type {any} */ (ctx).__core;
  // values from the VM realm have other Array/Object prototypes: hand back plain copies
  /** @param {unknown} x @returns {any} */
  const plain = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 'up' || k === 'down' ? undefined : v)));
  return { ...core, parseMarkdown: (/** @type {string} */ md) => plain(core.parseMarkdown(md)), parseMermaid: (/** @type {string} */ code) => plain(core.parseMermaid(code)),
    layout: (/** @type {unknown[]} */ n, /** @type {unknown[]} */ l) => { const nodes = n, links = l; core.layout(nodes, links); }, STYLES: plain(core.STYLES), raw: core, plain };
}

/** All example markdown: examples/*.md plus the ones built into index.html. */
export function examples() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script type="text\/plain" id="(ex\d+)">([\s\S]*?)<\/script>/g)) out.push({ name: m[1], md: m[2] });
  return out;
}
