# Flow Explainer

Paste a GitHub markdown diagram, get an animated step-by-step walkthrough you can send to a client.

Flow Explainer reads a [Mermaid](https://mermaid.js.org/) diagram (flowchart, sequence, state, class, ER, gantt, pie or mindmap) and plays it one arrow at a time: the camera moves to each step, a dot travels along the arrow, and a side panel explains what is happening in plain language. It comes in a flat isometric **2D** version and a rotatable **3D** version, and it can export a clean PNG for your README.

![Flow Explainer 3D playing the ticket-order example](docs/images/demo-3d.gif)

**Try it:** [2D](https://alanlam.zo.space/flow-explainer) · [3D](https://alanlam.zo.space/flow-explainer/3d) · [this README's diagram as a client link](https://alanlam.zo.space/flow-explainer#c=zXZNLbtswEIb3OsUPdBMTsYA-F10USFM3WSSp4bSLwAiQkTi2CFMclaQsG_AteoBeo8fqEQrSj6DZCNK85_tHr3AtA75aGTDZdJaMY49B_CoUxdPTU8u-JaOLhZWhbshH3MwK4EH6s_mD9I8jjMefdlMKkdGSX2kZ3A4TbeI8PaA9DewfC2TbPthzCJix0-x3mDFp9vPbQy58_k4Je09O-SwbDiCnQd7LEHa4r9nx_MKZliJrhPSZkrI959w76kIjcYepW87PZpOLL7cTmJaWPPo_8lK6LWpr2EVY41Y73Bi3mt835DkbUngy5ehvHbsA41ClSdIKlzk18_CHOo-jBK8oXpcJFbrMh3Bl4nVfnUBhYSwjNhRRi4tkXADhgBza0NJTWxZvSmRmxi2h1B6cUmjI6YDYMCJvIqLk96o3No7NEWSJO4lNyjQBfWeFNOuyeFtisma_RSUbVFxLm_iislKvMmfO3kz75BfHCJG7c3SWtqwxmNjkpjW17AkLsVaG1IysuGVZvCuh1N_fv_7gqIZSqBuuVwEL8ZA1e0tdl1IsVWz3Igda53Gmd1c5bJvA7gUsi_ep5kvJlEJHqWqaZmjE8hEfjDuQSXEwMbBdlMWHLMxRLkgW9RSVhugScg5Qamppq9TH7A7UMgayq9h46ZfNeYYgfcxe1iamXaKIDWVRjKHUi8tOhX4kBUPM-p1-rMPq_LNnV5_GDwl2H_YIXN9W7FnDmhBBAY68p2jElbnV88WmLt-bZwjWJKLGBaP5tOY5QibjOR2HEwT2a_YQD6pr6V2EcWux63Qx_wA)

No build step, no server and no account. It is two HTML files plus Three.js, and your diagram never leaves the browser.

## How it works

```mermaid
flowchart LR
  You([You]) -->|Paste markdown| Edit[Edit drawer]
  Edit -->|Press Render| Reader[Markdown reader]
  Reader -->|Boxes and arrows| Scene[Animated scene]
  Scene -->|Snapshot| Png[(README image)]
  Scene -->|Copy client link| Link[Share link]
  Link -->|Opens in browser| Client([Your client])
```

1. You paste a GitHub markdown file that contains a mermaid diagram.
2. Pressing **Render** hands the text to the built-in reader. Nothing is uploaded.
3. Every box becomes a block and every arrow becomes one step, played with the camera following along.
4. **📸 Snapshot** checks for overlapping labels and saves a PNG for your README.
5. **Copy client link** packs the whole diagram into the link itself.
6. Your client opens the link and presses **Play**: the same walkthrough, without the editing tools.

The diagram above is GitHub's own Mermaid rendering. Here is the same markdown after going through Flow Explainer's **📸 Snapshot** button:

![How Flow Explainer works, exported with the 2D Snapshot button](docs/images/how-it-works-2d.png)

The full source of that picture is [`examples/how-it-works.md`](examples/how-it-works.md). You can paste it straight into the editor.

## Quick start

1. Open the [2D](https://alanlam.zo.space/flow-explainer) or [3D](https://alanlam.zo.space/flow-explainer/3d) page, or [run it yourself](#run-it-yourself).
2. Press **✎ Edit**, paste your markdown (or press **Open .md**, or pick an example), then **Render ▶**.
3. Press **▶ Play**, or step with **Next / Back**, the ← → keys, or the numbered timeline at the bottom.
4. Press **🔗 Copy client link** and send it. The link opens in view-only mode, without Edit or Snapshot.

| Step through a diagram (2D) | Paste your markdown |
|---|---|
| ![2D player on step 3 of a sign-in sequence diagram](docs/images/player-2d.png) | ![Edit drawer with a sequence diagram pasted in](docs/images/edit-drawer.png) |

The **2D / 3D** button in the corner switches views and keeps the same diagram.

## Writing the markdown

A file has up to three parts. Only the diagram is required.

````markdown
# How an online ticket order is handled          ← title (optional)

What happens behind the scenes after a customer presses "Buy".   ← intro (optional)

```mermaid
flowchart LR
  C([Customer]) -->|Places order| S[Online Shop]
  S -->|Asks for payment| P[Payment Gateway]
  P --> D{Payment OK?}
  D -->|No| F[Show error to customer]
  D -->|Yes| O[(Order Database)]
```

1. The customer picks a ticket on the website and presses **Buy**.   ← one line per arrow, in order
2. The shop never touches card details. It hands the customer to the payment gateway.
3. The gateway checks the card with the bank and reports back.
4. If the payment fails, the customer sees a clear message. Nothing is charged.
5. If the payment succeeds, the order is saved as **paid**.

- **Order Database**: The single record of who bought what.   ← "About" note shown with that box
````

```mermaid
flowchart TD
  A[Mermaid block] --> B{Which type?}
  B -->|flowchart / graph| C[Each arrow = one step]
  B -->|sequenceDiagram| D[Each message = one step]
  B -->|state / class / ER / mindmap| H[Each line between boxes = one step]
  B -->|gantt / pie| I[Each task or slice = one step]
  C --> E{Numbered list below it?}
  D --> E
  H --> E
  I --> E
  E -->|Yes| F[Line N explains step N]
  E -->|No| G[Auto text: A hands over to B]
```

**Tips for client-friendly walkthroughs**

- Write the numbered list. Without it the step text is generated ("Online Shop hands over to Payment Gateway"), which works but reads dry.
- Keep box names short. Long names are the main cause of overlapping labels.
- Keep one scene to about 15–20 boxes. Several mermaid blocks in one file become separate scenes you pick from a dropdown.
- Box icons are picked from the name (database, email, payment, user, and so on). Emoji in the label work too.

### Supported Mermaid

Besides flowcharts and sequence diagrams, six more Mermaid types are turned into the same step-by-step walkthrough, each with plain-language step text written for you. Each one has a ready-to-paste file in [`examples/`](examples/).

![State, class, ER, gantt, pie and mindmap examples rendered by Flow Explainer](docs/images/diagram-types.png)

| Type | What one step shows | Example |
|---|---|---|
| State | One change, e.g. "When **approve** happens, **Review** changes to **Approved**." | [`article-lifecycle.md`](examples/article-lifecycle.md) |
| Class | One relationship, e.g. "**Ticket** is a kind of **Product**, so it gets everything Product has." | [`shop-classes.md`](examples/shop-classes.md) |
| ER | One relationship, e.g. "Each **Customer** places **zero or more** order. Each order is linked to **exactly one** customer." | [`shop-database.md`](examples/shop-database.md) |
| Gantt | One task, with its dates and what it waits for | [`launch-plan.md`](examples/launch-plan.md) |
| Pie | One slice and its share of the total | [`traffic-sources.md`](examples/traffic-sources.md) |
| Mindmap | One branch, e.g. "**Orders** includes **Payment**." | [`shop-mindmap.md`](examples/shop-mindmap.md) |


| Feature | Supported |
|---|---|
| `flowchart` / `graph` (any direction; the layout always runs along the isometric diagonal) | ✅ |
| Shapes: `[box]` `([rounded])` `{decision}` `[(database)]` `((circle))` | ✅ |
| Arrow labels `-->\|text\|` or `-- text -->`, dotted arrows `-.->` | ✅ |
| Thick arrows `==>`, chains `A --> B --> C`, `A & B --> C` | ✅ (thick drawn as normal) |
| `subgraph` (shown as coloured zones with a legend) | ✅ |
| `sequenceDiagram` with `actor`, `participant`, `->>`, `-->>` | ✅ |
| `alt` / `else` / `opt` / `loop` / `par` blocks (shown as step tags) | ✅ |
| `stateDiagram` / `stateDiagram-v2`: `[*]` start and end, transition labels, composite `state X { }` (zones), `<<choice>>` / `<<fork>>` / `<<join>>`, notes and descriptions (shown as box notes) | ✅ |
| `classDiagram`: classes with members (shown as box notes), all relationship arrows (inheritance, composition, aggregation, association, dependency, realization) with labels and cardinality, `namespace` (zones), `note for` | ✅ |
| `erDiagram`: entities with attributes (shown as box notes), crow's-foot cardinality turned into plain sentences, identifying `--` and non-identifying `..` | ✅ |
| `gantt`: sections (zones), `done` / `active` / `crit` / `milestone`, `after` dependencies, dates and durations; steps play in start-date order | ✅ (`excludes` weekends ignored) |
| `pie`: each slice becomes a block whose height matches its value; steps go from biggest to smallest | ✅ |
| `mindmap`: indentation tree, node shapes, each main branch gets its own colour | ✅ (`::icon` ignored) |
| journey, timeline, quadrant, git graph and other types | ❌ shows "not supported yet" |

## 📸 Snapshot: a README picture with an overlap check

When you write a README you want a picture of the diagram, and you want to be sure no label is hiding another one. **📸 Snapshot** (editing view only) does both.

```mermaid
sequenceDiagram
  actor You
  participant FX as Flow Explainer
  participant Repo as Your README
  You->>FX: Press Snapshot
  FX->>FX: Draw the picture and check every label, box and step number
  alt Something overlaps
    FX-->>You: List of problem spots, circled in red if you tick the box
    You->>FX: Find a clean angle (3D) or shorten names
  else Nothing overlaps
    FX-->>You: ✓ Nothing overlaps
  end
  You->>FX: Download PNG + Copy README text
  You->>Repo: Commit the image and paste the text
```

![Snapshot window showing the overlap check and export buttons](docs/images/snapshot-window.png)

- **Preview** with the diagram title on top and numbered markers on each arrow that match the step list.
- **Overlap check:** "✓ Nothing overlaps", or a list such as *label "Order Database" covers box "Show error to customer"*. A label sitting on an arrow line is marked **minor**.
- **2D** moves labels up or sideways automatically to make room.
- **3D** labels stay with their blocks, so **🔄 Find a clean angle** tries 64 camera angles and keeps the one with the fewest overlaps. **What I see now** uses your current camera.
- **Download PNG** (about 1800–2200 px wide), **Copy image**, and **Copy README text**, which gives you this, ready to paste:

  ```markdown
  ![How an online ticket order is handled](how-an-online-ticket-order-is-handled.png)

  1. **Customer → Online Shop** — The customer picks a ticket on the website and presses **Buy**.
  2. **Online Shop → Payment Gateway** — The shop never touches card details. …
  ```

Every image in this README was made this way. Here is the 3D export of the ticket example after **Find a clean angle**:

![Ticket order example, 3D snapshot export](docs/images/ticket-order-3d.png)

## 2D or 3D?

| | 2D (`index.html`) | 3D (`3d.html`) |
|---|---|---|
| Look | Flat isometric SVG, like a technical illustration | Real 3D blocks with soft shadows |
| Camera | Pan and zoom | Drag to rotate, scroll or pinch to zoom, shift-drag to move |
| Labels | Rearranged automatically to avoid overlaps | Fixed to blocks; pick a clean angle instead |
| Weight | One file, no dependencies | One file + Three.js (`vendor/`, ~800 KB) |
| Best for | README images, older phones | Client meetings and demos |

If a browser has no WebGL, the 3D page opens the 2D page automatically.

## Run it yourself

Any static file server works. The 3D page loads Three.js as an ES module, so open it over `http://`, not `file://`.

```bash
git clone https://github.com/solutionforest/flow-explainer.git
cd flow-explainer
python3 -m http.server 8000
# 2D: http://localhost:8000/index.html
# 3D: http://localhost:8000/3d.html
```

To host it, upload the folder to GitHub Pages, Cloudflare Pages, Netlify, S3 or any web server. Both `/3d.html` and an extensionless `/3d` path work.

## Privacy

- Your markdown is kept in your browser's local storage (`flowx.md`) so it survives a reload.
- A client link stores the diagram compressed inside the part of the address after `#`. Browsers never send that part to a server, so the host only sees a request for the page.
- Anyone who has a client link can read the diagram, so treat it like the document itself.

## Project layout

```
index.html          2D version (SVG, no dependencies)
3d.html             3D version (Three.js)
vendor/             Three.js 0.187.0 (three.module.js + three.core.js, MIT)
examples/           Sample markdown files, ready to paste
tools/sync-parser.py  Copies the shared parser from index.html into 3d.html
docs/images/        Images used in this README
```

Both pages share the same markdown reader, step panel, timeline and client-link code, copied into each file so each one stands alone. Edit the parser (everything between `/* ---------- markdown` and `/* ---------- layout`) in `index.html`, then run `python3 tools/sync-parser.py` to copy it into `3d.html`.

## Known limits

- Dense diagrams can have crossing arrows; split them into several scenes.
- In the overview of a long flow, far-away blocks look small until you start stepping.
- The interface is in English. Diagram text can be any language, including Chinese.
- Copy image depends on browser clipboard support; use Download PNG where it is blocked.

## License

[MIT](LICENSE) © Solution Forest. Three.js is MIT-licensed by the three.js authors.
