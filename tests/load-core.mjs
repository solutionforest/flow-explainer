// Loads the shared core module for unit tests (markdown + Mermaid parsers, layout, diagram styles).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {Promise<any>} */
export async function loadCore() {
  const mod = await import(pathToFileURL(join(root, 'core.mjs')).href);
  /** @param {unknown} x @returns {any} */
  const plain = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 'up' || k === 'down' ? undefined : v)));
  return {
    embedCode: mod.embedCode,
    embedScript: mod.embedScript,
    embedOpts: mod.embedOpts,
    normalizeMdUrl: mod.normalizeMdUrl,
    parseMarkdown: (/** @type {string} */ md) => plain(mod.parseMarkdown(md)),
    parseMermaid: (/** @type {string} */ code) => plain(mod.parseMermaid(code)),
    layout: (/** @type {unknown[]} */ n, /** @type {unknown[]} */ l) => { mod.layout(n, l); },
    cleanText: mod.cleanText,
    codeLines: mod.codeLines,
    STYLES: plain(mod.STYLES),
    esc: mod.esc,
    mdInline: mod.mdInline,
    fmtNum: mod.fmtNum,
    raw: mod,
    plain,
  };
}

/** All example markdown: examples/*.md plus the ones built into index.html. */
export function examples() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script type="text\/plain" id="(ex\d+)">([\s\S]*?)<\/script>/g)) out.push({ name: m[1], md: m[2] });
  return out;
}
