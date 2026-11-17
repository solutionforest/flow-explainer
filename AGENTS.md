# flow-explainer

Turns pasted GitHub markdown (Mermaid `flowchart` / `sequenceDiagram` + numbered list as narration) into an animated step-by-step walkthrough for clients.

- `index.html` — 2D isometric SVG version. Live at https://alanlam.zo.space/flow-explainer (zo.space API route `/flow-explainer`).
- `3d.html` — Three.js version (real 3D blocks, rotatable camera). Live at https://alanlam.zo.space/flow-explainer/3d (route `/flow-explainer/:file`; Three.js 0.187.0 jsDelivr-minified in `vendor/`, imported as `./vendor/three.module.js` and served by route `/flow-explainer/vendor/:file`).
- Both files are standalone and edited directly; they share the same markdown parser, layout, panel, timeline and `#c=` client-link code (copied, not imported), so parser fixes must be applied to both.
- Both read the same `localStorage` key `flowx.md`; the 2D/3D button keeps the URL hash and works with both `/flow-explainer` ↔ `/flow-explainer/3d` and `index.html` ↔ `3d.html` (static hosting).
- Public repo: https://github.com/solutionforest/flow-explainer (MIT). README images in `docs/images/` were made with the Snapshot button; sample inputs in `examples/`.
- 📸 Snapshot (edit mode only): modal exports a README PNG (title header, optional step-number badges, group legend) + "Copy README text" (image link + numbered steps). Overlap checker lists label/box/step-number collisions; "minor" = label sitting on an arrow line.
  - 2D: `render()` places node labels (lift/side shift), arrow labels and badges greedily to avoid collisions; export serialises the SVG with scene CSS inlined.
  - 3D: `analyse(cam)` computes label/box screen rects analytically (must match `.lab` CSS transforms); export draws HTML labels onto the WebGL frame and crops to content; "Find a clean angle" scores 64 camera angles. `window.__fx` is a test handle.
