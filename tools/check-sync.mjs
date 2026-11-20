#!/usr/bin/env node
// Fails if diagram-styles.json ↔ core.mjs STYLES are out of sync.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'tools/sync-styles.mjs'), '--check'], { stdio: 'inherit', cwd: root });
