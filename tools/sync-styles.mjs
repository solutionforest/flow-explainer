#!/usr/bin/env node
/**
 * diagram-styles/ is the source of truth (one JSON file per style + pack.json).
 * This:
 *   1. Assembles diagram-styles.json (published bundle for Pages / tools)
 *   2. Embeds `styles` into core.mjs as `const STYLES=JSON.parse(...)`
 *
 *   node tools/sync-styles.mjs          # write bundle + core.mjs
 *   node tools/sync-styles.mjs --check  # exit 1 if either is out of date
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'diagram-styles');
const packPath = join(dir, 'pack.json');
const bundlePath = join(root, 'diagram-styles.json');
const corePath = join(root, 'core.mjs');
const BEGIN = '/* ---- begin generated STYLES (from diagram-styles/; run: node tools/sync-styles.mjs) ---- */';
const END = '/* ---- end generated STYLES ---- */';
const check = process.argv.includes('--check');

const pack = JSON.parse(readFileSync(packPath, 'utf8'));
if (pack.format !== 'flow-explainer.diagram-styles') {
  console.error('diagram-styles/pack.json: expected format "flow-explainer.diagram-styles"');
  process.exit(1);
}
if (!Array.isArray(pack.order) || !pack.order.includes('original')) {
  console.error('diagram-styles/pack.json: order must include "original"');
  process.exit(1);
}

/** @type {Record<string, unknown>} */
const styles = {};
for (const key of pack.order) {
  if (!/^[a-z][a-z0-9-]*$/.test(key)) {
    console.error('Invalid style id in pack.order:', key);
    process.exit(1);
  }
  const file = join(dir, key + '.json');
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('Missing or invalid style file:', file, e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const style = { ...raw };
  delete style.$schema;
  if (!style.name || !style.bg || !Array.isArray(style.blocks)) {
    console.error(key + '.json: missing required fields (name, bg, blocks, …)');
    process.exit(1);
  }
  styles[key] = style;
}

const onDisk = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'pack.json');
for (const f of onDisk) {
  const key = f.replace(/\.json$/, '');
  if (!pack.order.includes(key)) {
    console.error('Orphan style file not listed in pack.order:', f);
    process.exit(1);
  }
}

const bundle = {
  $schema: './diagram-styles.schema.json',
  format: 'flow-explainer.diagram-styles',
  version: pack.version,
  styles,
};
const bundleText = JSON.stringify(bundle, null, 2) + '\n';

const payload = JSON.stringify(styles);
const block = [
  BEGIN,
  '/** @type {Record<string,DiagramStyle>} */',
  'export const STYLES=/** @type {Record<string,DiagramStyle>} */(JSON.parse(' + JSON.stringify(payload) + '));',
  END,
].join('\n');

const core = readFileSync(corePath, 'utf8');
const ai = core.indexOf(BEGIN);
const bi = core.indexOf(END);
if (ai < 0 || bi < 0 || bi < ai) {
  console.error('core.mjs is missing generated STYLES markers; expected:\n' + BEGIN + '\n...\n' + END);
  process.exit(1);
}
const nextCore = core.slice(0, ai) + block + core.slice(bi + END.length);

let ok = true;
const curBundle = (() => {
  try {
    return readFileSync(bundlePath, 'utf8');
  } catch {
    return null;
  }
})();
if (curBundle !== bundleText) {
  if (check) {
    console.error('diagram-styles.json is out of sync with diagram-styles/; run: npm run styles:sync');
    ok = false;
  } else writeFileSync(bundlePath, bundleText), console.log('diagram-styles.json rebuilt from diagram-styles/');
} else if (!check) console.log('diagram-styles.json already matches diagram-styles/');

if (nextCore !== core) {
  if (check) {
    console.error('core.mjs STYLES are out of sync with diagram-styles/; run: npm run styles:sync');
    ok = false;
  } else writeFileSync(corePath, nextCore), console.log('core.mjs STYLES updated from diagram-styles/');
} else if (!check) console.log('core.mjs STYLES already match diagram-styles/');

if (check && ok) console.log('diagram-styles/ → bundle + core.mjs in sync');
process.exit(ok ? 0 : 1);
