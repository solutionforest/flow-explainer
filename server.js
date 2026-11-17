// @ts-check
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Page routes. A trailing slash is allowed (`/3d/`, `/embed/`). */
/** @type {Record<string, string>} */
const PAGES = {
  '/': 'index.html',
  '/index': 'index.html',
  '/3d': '3d.html',
  '/embed': 'index.html',
  '/embed/3d': '3d.html',
};

/** Files that are part of the repo but not of the site. */
const PRIVATE = /(^|\/)(\.|node_modules\/|package(-lock)?\.json$|tsconfig[\w.]*\.json$|tsc-baseline\.json$|eslint\.config|server\.js$|tools\/|tests\/)/;

/**
 * @param {string} p
 * @returns {boolean}
 */
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Map a URL path to a file inside `root`, or null.
 * - `/`, `/3d`, `/embed`, `/embed/3d` (with or without a trailing slash) serve the two pages.
 * - Pages under `/3d/`, `/embed/` and `/embed/3d/` load `vendor/…`, `favicon.svg` and so on with relative
 *   URLs, so `/embed/3d/vendor/three.module.js` is served from `/vendor/three.module.js`.
 * - Dotfiles, node_modules and project config are never served.
 * @param {string} urlPath  pathname, still URL-encoded
 * @param {string} [root]
 * @returns {string | null}
 */
function resolveFile(urlPath, root = ROOT) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0] || '/');
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const page = PAGES[p.replace(/\/+$/, '') || '/'];
  if (page) return path.join(root, page);

  p = p.replace(/^\/(?:embed\/3d|embed|3d)(?=\/)/, '');
  const rel = path.posix.normalize(p).replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
  if (!rel || rel.startsWith('..') || PRIVATE.test(rel)) return null;
  const full = path.join(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  if (isFile(full)) return full;
  if (!path.extname(rel) && isFile(full + '.html')) return full + '.html';
  return null;
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const filePath = resolveFile(pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

if (require.main === module) {
  const server = http.createServer(handle);
  server.listen(PORT, () => {
    console.log(`Flow Explainer listening on port ${PORT}`);
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}

module.exports = { resolveFile, handle, PAGES };
