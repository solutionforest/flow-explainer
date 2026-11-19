#!/usr/bin/env node
/**
 * diagram-styles.json is the source of truth for diagram palettes.
 * This embeds `styles` into index.html as `const STYLES=JSON.parse(...)`
 * so the pages stay standalone (no fetch / no build step at runtime).
 *
 *   node tools/sync-styles.mjs          # write into index.html
 *   node tools/sync-styles.mjs --check  # exit 1 if HTML is out of date
 * Then run: python3 tools/sync-parser.py
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'diagram-styles.json');
const htmlPath = join(root, 'index.html');
const BEGIN = '/* ---- begin generated STYLES (from diagram-styles.json; run: node tools/sync-styles.mjs) ---- */';
const END = '/* ---- end generated STYLES ---- */';

const doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (doc.format !== 'flow-explainer.diagram-styles') {
  console.error('diagram-styles.json: expected format "flow-explainer.diagram-styles"');
  process.exit(1);
}
if (!doc.styles || typeof doc.styles !== 'object' || !doc.styles.original) {
  console.error('diagram-styles.json: styles.original is required');
  process.exit(1);
}

const payload = JSON.stringify(doc.styles);
const block = [
  BEGIN,
  '/** @type {Record<string,DiagramStyle>} */',
  'const STYLES=/** @type {Record<string,DiagramStyle>} */(JSON.parse(' + JSON.stringify(payload) + '));',
  END,
].join('\n');

const html = readFileSync(htmlPath, 'utf8');
const a = html.indexOf(BEGIN);
const b = html.indexOf(END);
if (a < 0 || b < 0 || b < a) {
  console.error('index.html is missing generated STYLES markers; expected:\n' + BEGIN + '\n...\n' + END);
  process.exit(1);
}
const next = html.slice(0, a) + block + html.slice(b + END.length);
const check = process.argv.includes('--check');
if (next === html) {
  console.log('index.html STYLES already match diagram-styles.json');
  process.exit(0);
}
if (check) {
  console.error('index.html STYLES are out of sync with diagram-styles.json; run: node tools/sync-styles.mjs && python3 tools/sync-parser.py');
  process.exit(1);
}
writeFileSync(htmlPath, next);
console.log('index.html STYLES updated from diagram-styles.json');
