#!/usr/bin/env node
// Strict type check ("level 10"): TypeScript strict mode on the page code, with a baseline.
// Like a PHPStan baseline: errors that already exist are listed in tsc-baseline.json and allowed;
// any NEW error fails. When you fix errors, run `npm run typecheck:baseline` so the baseline shrinks.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = join(root, 'tsc-baseline.json');
execFileSync(process.execPath, [join(root, 'tools/extract-scripts.mjs')], { stdio: 'ignore' });

let out = '';
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8' });
} catch (e) { out = String(e.stdout || ''); }

// key = file + error code + message (no line numbers, so unrelated edits don't break the baseline)
const now = new Map();
const lines = [];
for (const l of out.split('\n')) {
  const m = l.match(/^\.check\/([\w.]+)\((\d+),\d+\): error (TS\d+): (.*)$/);
  if (!m) continue;
  const page = m[1] === 'index.js' ? 'index.html' : '3d.html';
  const key = `${page} ${m[3]} ${m[4]}`;
  now.set(key, (now.get(key) || 0) + 1);
  lines.push({ key, where: `${page}:${m[2]}`, text: `${m[3]} ${m[4]}` });
}
const total = [...now.values()].reduce((a, b) => a + b, 0);

if (process.argv.includes('--update-baseline')) {
  const obj = Object.fromEntries([...now.entries()].sort());
  writeFileSync(baselineFile, JSON.stringify({ note: 'Known TypeScript strict-mode errors. Only shrink this file: fix errors, then run npm run typecheck:baseline.', total, errors: obj }, null, 1) + '\n');
  console.log(`Baseline written: ${total} known strict-mode errors.`);
  process.exit(0);
}

const base = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')).errors : {};
const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
const seen = new Map();
const fresh = [];
for (const e of lines) {
  const n = (seen.get(e.key) || 0) + 1;
  seen.set(e.key, n);
  if (n > (base[e.key] || 0)) fresh.push(e);
}
if (fresh.length) {
  console.error(`✖ ${fresh.length} new strict-mode type error(s) (not in tsc-baseline.json):`);
  for (const e of fresh.slice(0, 50)) console.error(`  ${e.where}  ${e.text}`);
  if (fresh.length > 50) console.error(`  …and ${fresh.length - 50} more`);
  console.error('Fix them (add JSDoc types / null checks). Only add to the baseline if the error is a false positive.');
  process.exit(1);
}
console.log(`✓ Strict type check: no new errors. ${total} known error(s) left in the baseline${total < baseTotal ? ` (down from ${baseTotal} — run npm run typecheck:baseline to lock in the progress)` : ''}.`);
