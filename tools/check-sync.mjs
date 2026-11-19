#!/usr/bin/env node
// Fails if diagram-styles.json ↔ index.html STYLES, or 3d.html shared blocks, are out of sync.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (/** @type {string} */ cmd, /** @type {string[]} */ args) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root });
run('node', [join(root, 'tools/sync-styles.mjs'), '--check']);
run('python3', [join(root, 'tools/sync-parser.py'), '--check']);
