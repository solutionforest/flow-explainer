import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore, examples, root } from './load-core.mjs';

const core = loadCore();
const files = readdirSync(join(root, 'examples')).filter(f => f.endsWith('.md')).map(f => ({ name: 'examples/' + f, md: readFileSync(join(root, 'examples', f), 'utf8') }));
const all = [...examples(), ...files];

/**
 * Parse one scene the way the pages do (buildScene without colours).
 * Parsed graphs come from the page code (typed there); here they are plain JSON copies.
 * @param {string} code @returns {any}
 */
function build(code) {
  const g = core.raw.parseMermaid(code);
  if (!g.fixed) core.raw.layout(g.nodes, g.links);
  return core.plain(g);
}

/** Structural rules every diagram type must follow. @param {any} g @param {string} where */
function checkGraph(g, where) {
  assert.ok(g.nodes.length > 0, where + ': no nodes');
  assert.ok(g.steps.length > 0, where + ': no steps');
  const ids = new Set(g.nodes.map((/** @type {any} */ n) => n.id));
  assert.equal(ids.size, g.nodes.length, where + ': duplicate node ids');
  for (const n of /** @type {any[]} */ (g.nodes)) {
    assert.equal(typeof n.label, 'string', where + ': label');
    assert.ok(Number.isFinite(n.gx) && Number.isFinite(n.gy), where + ': node ' + n.id + ' has no position');
    if (n.group != null) assert.ok(g.groups[n.group], where + ': node ' + n.id + ' points at a missing group');
  }
  g.links.forEach((/** @type {any} */ l, /** @type {number} */ i) => {
    assert.ok(ids.has(l.from) && ids.has(l.to), where + ': link ' + i + ' has a missing end');
    if (l.pts) for (const p of l.pts) assert.ok(p.every(Number.isFinite), where + ': link ' + i + ' has a bad point');
  });
  g.steps.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    const at = where + ' step ' + (i + 1);
    assert.ok(typeof s.title === 'string' && s.title.length, at + ': empty title');
    assert.ok(typeof s.auto === 'string' && s.auto.length, at + ': empty auto text');
    for (const id of s.nodes) assert.ok(ids.has(id), at + ': unknown node ' + id);
    if (s.kind === 'edge') {
      const l = g.links[s.link];
      assert.ok(l, at + ': unknown link ' + s.link);
      assert.ok((l.from === s.from && l.to === s.to) || (l.from === s.to && l.to === s.from), at + ': link does not join from/to');
    }
  });
}

for (const ex of all) {
  test('parses ' + ex.name, () => {
    const doc = core.parseMarkdown(ex.md);
    assert.ok(doc.scenes.length > 0, 'no mermaid block');
    doc.scenes.forEach((/** @type {any} */ sc, /** @type {number} */ k) => checkGraph(build(sc.code), ex.name + ' #' + (k + 1)));
  });
}

test('every diagram type is recognised', () => {
  const types = new Set(all.flatMap(ex => core.parseMarkdown(ex.md).scenes.map((/** @type {any} */ sc) => core.codeLines(sc.code)[0].split(/[\s(]/)[0].toLowerCase())));
  for (const t of ['flowchart', 'sequencediagram', 'statediagram-v2', 'classdiagram', 'erdiagram', 'gantt', 'pie', 'mindmap', 'journey', 'timeline', 'quadrantchart', 'gitgraph', 'xychart-beta', 'sankey-beta', 'block-beta', 'architecture-beta', 'c4context', 'kanban', 'packet-beta', 'requirementdiagram', 'radar-beta', 'treemap-beta', 'zenuml'])
    assert.ok([...types].some(x => x === t || x.startsWith(t.replace(/-.*/, ''))), 'no example for ' + t);
});

test('unsupported types give a clear error', () => {
  assert.throws(() => core.parseMermaid('sunburst\n  a'), /not supported yet/);
  assert.throws(() => core.parseMermaid(''), /empty/);
});

test('markdown: title, intro, numbered steps and box notes', () => {
  const doc = core.parseMarkdown('# Title\n\nIntro line.\n\n```mermaid\nflowchart LR\n  A[Shop] --> B[(DB)]\n```\n\n1. Saves it.\n\n- **Shop**: The store.\n');
  assert.equal(doc.docTitle, 'Title');
  const sc = doc.scenes[0];
  assert.deepEqual(sc.ordered, ['Saves it.']);
  assert.deepEqual(sc.named, [['Shop', 'The store.']]);
});

test('radar: one step per axis, curves compared', () => {
  const g = build('radar-beta\n axis a["Speed"], b["Price"], c["Care"]\n curve x["Us"]{5, 2, 4}\n curve y["Them"]{3, 4, 4}\n max 5');
  assert.equal(g.nodes.length, 6);
  assert.deepEqual(g.steps.map((/** @type {any} */ s) => s.title), ['Speed', 'Price', 'Care']);
  assert.match(g.steps[0].auto, /Us leads here/);
  assert.match(g.steps[2].auto, /tie/);
});

test('treemap: sections, totals and shares', () => {
  const g = build('treemap-beta\n"A"\n  "x": 30\n  "y": 10\n"B"\n  "z": 60');
  assert.equal(g.steps.length, 2);
  assert.match(g.steps[0].auto, /\*\*40%\*\*/);
  assert.match(g.steps[1].auto, /\*\*60%\*\*/);
});

test('zenuml: nested calls, replies and conditions', () => {
  const g = build('zenuml\n @Actor U\n @Starter(U)\n // asks\n S.go(x) {\n  D.save(x)\n  if(ok) {\n   S.done()\n  }\n  return y\n }');
  assert.deepEqual(g.steps.map((/** @type {any} */ s) => s.title), ['Go (x)', 'Save (x)', 'Done', 'Returns y']);
  assert.equal(g.steps[0].auto, 'asks');
  assert.equal(g.steps[2].tag, 'If: ok');
  assert.equal(g.steps[3].from, 'S');
  assert.equal(g.steps[3].to, 'U');
});

test('diagram styles define every field the renderers read', () => {
  const need = ['name', 'desc', 'bg', 'bg2', 'blocks', 'neutral', 'ink', 'edge', 'accent', 'accentFg', 'plate', 'plateFg', 'plateBd', 'on', 'onFg', 'muted', 'zone', 'zoneBd', 'chip', 'labShadow', 'shadow', 'gridOp', 'grid3', 'ground', 'mat', 'rough', 'opacity', 'outline', 'sw'];
  for (const [k, s] of Object.entries(core.STYLES)) {
    for (const f of need) assert.ok(s[f] !== undefined, k + ' is missing ' + f);
    assert.ok(Array.isArray(s.blocks) && s.blocks.length > 0, k + ': blocks');
    assert.ok(['standard', 'toon', 'basic', 'glass'].includes(s.mat), k + ': mat');
  }
  assert.ok(core.STYLES.original && core.STYLES.circuit);
});

// Snapshot of every example's parsed result: catches any change in parser output.
test('parser output matches the snapshot', () => {
  /** @type {Record<string, unknown>} */
  const snap = {};
  for (const ex of all) snap[ex.name] = core.parseMarkdown(ex.md).scenes.map((/** @type {any} */ sc) => {
    const g = build(sc.code);
    return { n: g.nodes.map((/** @type {any} */ n) => [n.id, n.label, n.shape, n.group ?? null, n.note || '', Math.round(n.gx * 100) / 100, Math.round(n.gy * 100) / 100]),
      l: g.links.map((/** @type {any} */ l) => [l.from, l.to, l.label, !!l.dotted, !!l.arrow]), s: g.steps.map((/** @type {any} */ s) => [s.kind, s.title, s.auto, s.tag || '', s.chip || '']) };
  });
  const file = join(root, 'tests', 'parser.snapshot.json');
  if (process.env.UPDATE_SNAPSHOT || !existsSync(file)) writeFileSync(file, JSON.stringify(snap, null, 1) + '\n');
  assert.deepEqual(snap, JSON.parse(readFileSync(file, 'utf8')));
});

test('3d.html has the same core as index.html', () => {
  const a = loadCore('index.html'), b = loadCore('3d.html');
  for (const ex of all.slice(0, 5)) assert.deepEqual(JSON.stringify(b.parseMarkdown(ex.md)), JSON.stringify(a.parseMarkdown(ex.md)));
});

test('zenuml: a participant declared by name only does not crash (regression)', () => {
  const g = build('zenuml\n  Alice\n  Bob as "The shop"\n  Alice->Bob: hi');
  assert.deepEqual(g.nodes.map((/** @type {any} */ n) => n.label), ['Alice', 'The shop']);
  assert.equal(g.steps[0].title, 'hi');
});

test('layout spacing: 2D by default', () => {
  const g = build('flowchart LR\n A --> B');
  assert.equal(Math.round((g.nodes[1].gx - g.nodes[0].gx) * 10) / 10, 3.1);
});

test('embed code: responsive and fixed-size iframe snippets', () => {
  const url = 'https://flow-explainer.laravel.cloud/embed#c=zAB-c&s=circuit';
  const r = core.embedCode(url, 'r', 'Ticket "order"');
  assert.match(r, /^<div style="position:relative;width:100%;aspect-ratio:16\/10">/);
  assert.match(r, /src="https:\/\/flow-explainer\.laravel\.cloud\/embed#c=zAB-c&amp;s=circuit"/);
  assert.match(r, /title="Ticket &quot;order&quot;"/);
  assert.match(r, /allowfullscreen/);
  const f = core.embedCode(url, '640x480');
  assert.match(f, /^<iframe .* width="640" height="480" /);
  assert.match(f, /title="Flow Explainer"/);
});

test('embed options: text panel and view switch flags', () => {
  assert.equal(core.embedOpts({ text: true, switchView: true }), '');
  assert.equal(core.embedOpts({ text: false, switchView: true }), '&t=0');
  assert.equal(core.embedOpts({ text: false, switchView: false }), '&t=0&v=0');
});

test('normalizeMdUrl: GitHub blob → raw, rejects bad schemes', () => {
  assert.equal(
    core.normalizeMdUrl('https://github.com/solutionforest/flow-explainer/blob/main/examples/ticket-order.md'),
    'https://raw.githubusercontent.com/solutionforest/flow-explainer/main/examples/ticket-order.md',
  );
  assert.equal(
    core.normalizeMdUrl('https://raw.githubusercontent.com/a/b/main/x.md'),
    'https://raw.githubusercontent.com/a/b/main/x.md',
  );
  assert.throws(() => core.normalizeMdUrl('not a url'), /does not look like a URL/);
  assert.throws(() => core.normalizeMdUrl('file:///tmp/x.md'), /http\(s\)/);
});

test('embed script: standalone tag for third-party sites', () => {
  const t = core.embedScript('zAB-c', {
    text: false,
    switchView: true,
    view: '2d',
    scriptSrc: 'https://solutionforest.github.io/flow-explainer/embed.js',
    size: 'r',
    title: 'Ticket "order"',
    style: 'circuit',
    icons: true,
  });
  assert.match(t, /^<script async src="https:\/\/solutionforest\.github\.io\/flow-explainer\/embed\.js"/);
  assert.match(t, /data-c="zAB-c"/);
  assert.match(t, /data-view="2d"/);
  assert.match(t, /data-text="0"/);
  assert.match(t, /data-s="circuit"/);
  assert.match(t, /data-title="Ticket &quot;order&quot;"/);
  assert.doesNotMatch(t, /data-i=/);
  assert.doesNotMatch(t, /data-switch=/);
  const locked = core.embedScript('x', {
    text: true,
    switchView: false,
    view: '3d',
    scriptSrc: 'https://flow-explainer.laravel.cloud/embed.js',
    size: '640x480',
    icons: false,
  });
  assert.match(locked, /data-view="3d"/);
  assert.match(locked, /data-text="1"/);
  assert.match(locked, /data-switch="0"/);
  assert.match(locked, /data-size="640x480"/);
  assert.match(locked, /data-i="0"/);
});
