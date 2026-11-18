#!/usr/bin/env python3
"""Copy the blocks shared by both pages from index.html into 3d.html.

Both pages are standalone single files, so this block is duplicated on purpose:
  - helpers, the markdown + Mermaid parsers and the layout
  - the diagram styles (STYLES) and the settings / share / steps UI code
Edit them in index.html, then run:  python3 tools/sync-parser.py   (--check to verify)
"""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
BLOCKS = [
    # helpers, markdown + Mermaid parsers, layout, diagram styles + settings / share / steps UI
    ("core", "/* ---------- shared core:", "/* ---------- end of diagram styles + settings ---------- */"),
]
src = (root / "index.html").read_text()
dst_p = root / "3d.html"
dst = out = dst_p.read_text()
for name, begin, end in BLOCKS:
    a, b = src.index(begin), src.index(end)
    c, d = out.index(begin), out.index(end)
    out = out[:c] + src[a:b] + out[d:]
if out == dst:
    print("3d.html shared blocks already in sync")
elif "--check" in sys.argv:
    print("3d.html shared blocks are out of sync; run tools/sync-parser.py")
    sys.exit(1)
else:
    dst_p.write_text(out)
    print("3d.html shared blocks updated")
