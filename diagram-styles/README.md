# Diagram styles

One JSON file per style. Edit here, then run:

```bash
npm run styles:sync
```

That rebuilds root `diagram-styles.json` (published bundle) and embeds the pack into `index.html` / `3d.html`.

| File | Role |
|------|------|
| `pack.json` | Format id, schema version, **display order** (must include `original`) |
| `<id>.json` | One style (`original.json`, `teal.json`, …) |
| `../diagram-styles.schema.json` | JSON Schema for the pack + each style |
| `../diagram-styles.json` | Generated bundle — do not edit by hand |

Client / embed links use `&s=<id>` (the filename without `.json`).
