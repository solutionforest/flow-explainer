#!/usr/bin/env python3
"""Copy the shared markdown + Mermaid parser block from index.html into 3d.html.

Both pages are standalone single files, so the parser is duplicated on purpose.
Edit it in index.html, then run:  python3 tools/sync-parser.py
"""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
BEGIN, END = "/* ---------- markdown ---------- */", "/* ---------- layout ---------- */"
def block(s):
    a, b = s.index(BEGIN), s.index(END)
    return a, b
src = (root / "index.html").read_text()
a, b = block(src)
dst_p = root / "3d.html"
dst = dst_p.read_text()
c, d = block(dst)
out = dst[:c] + src[a:b] + dst[d:]
if out == dst:
    print("3d.html parser already in sync")
elif "--check" in sys.argv:
    print("3d.html parser is out of sync; run tools/sync-parser.py")
    sys.exit(1)
else:
    dst_p.write_text(out)
    print("3d.html parser updated")
