# flow-explainer

Turns pasted GitHub markdown (Mermaid flowchart, sequence, state, class, ER, gantt, pie, mindmap, journey, timeline, quadrantChart, gitGraph, xychart, sankey, block, architecture, C4, kanban, packet, requirementDiagram + numbered list as narration) into an animated step-by-step walkthrough for clients.

- `index.html` — 2D isometric SVG version. Also served from zo.space API route `/flow-explainer` (not linked publicly).
- `3d.html` — Three.js version (real 3D blocks, rotatable camera). Also served via zo.space (route `/flow-explainer/:file`; Three.js 0.187.0 jsDelivr-minified in `vendor/`, imported as `./vendor/three.module.js` and served by route `/flow-explainer/vendor/:file`).
- Both files are standalone and edited directly; they share the same markdown parser, layout, panel, timeline and `#c=` client-link code (copied, not imported). The parser block (`/* ---------- markdown` … `/* ---------- layout`) is edited in `index.html` only, then copied with `python3 tools/sync-parser.py` (`--check` to verify). Non-parser fixes (render, buildScene, iconFor) still go into both files by hand.
- Every diagram type is converted into the same `{nodes,links,steps,groups}` graph. Extra node fields: `note`, `icon` (forced emoji), `iconFallback`, `ci` (palette index), `hk` (height factor: pie, journey, xychart, sankey, packet). Graph flags: `fixed` (parser set `gx/gy`, skip `layout()`; non-pie fixed parsers call `routeFixed()` to give links `pts`: timeline, quadrant, git, xychart, block, kanban, packet), `noZones` (colour groups without zone slabs, mindmap), `diagramTitle` (used when the markdown has no heading).
- Both read the same `localStorage` key `flowx.md`; the 2D/3D button keeps the URL hash and works with both `/flow-explainer` ↔ `/flow-explainer/3d` and `index.html` ↔ `3d.html` (static hosting).
- Public repo: https://github.com/solutionforest/flow-explainer (MIT). README images in `docs/images/` were made with the Snapshot button; sample inputs in `examples/`.
- 📸 Snapshot (edit mode only): modal exports a README PNG (title header, optional step-number badges, group legend) + "Copy README text" (image link + numbered steps). Overlap checker lists label/box/step-number collisions; "minor" = label sitting on an arrow line.
  - 2D: `render()` places node labels (lift/side shift), arrow labels and badges greedily to avoid collisions; export serialises the SVG with scene CSS inlined.
  - 3D: `analyse(cam)` computes label/box screen rects analytically (must match `.lab` CSS transforms); export draws HTML labels onto the WebGL frame and crops to content; "Find a clean angle" scores 64 camera angles. `window.__fx` is a test handle.

- Branding: credit "by Solution Forest" in the footer of both pages links to https://solutionforest.net/. Do not add personal demo-site links to the README or repo.
