#!/usr/bin/env node
// Fails if the shared blocks of 3d.html differ from index.html (see tools/sync-parser.py).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('python3', [join(root, 'tools/sync-parser.py'), '--check'], { stdio: 'inherit' });
