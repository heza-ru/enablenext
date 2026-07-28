---
name: doc-creator
description: Use when the user asks to create a Word document, DOCX file, report, proposal, one-pager, brief, summary, or any formatted long-form document. Generates an interactive HTML preview with a one-click .docx download using docx.js — no code execution or API keys required.
user-invocable: true
allowed-tools: ["artifacts"]
---

# Document Creator Skill

Generate a single self-contained HTML artifact that:
1. **Renders a styled document preview** with Whatfix brand typography
2. **Includes a "Download Word" button** that generates a real `.docx` file using docx.js (runs in the browser, no server needed)

## Output Format — MANDATORY

ALWAYS deliver the HTML inside an artifact block. NEVER output it as a plain code block.

```
:::artifact{identifier="whatfix-document" type="text/html" title="DOCUMENT TITLE"}
```
<!DOCTYPE html>
...full HTML...
```
:::
```

Use a descriptive kebab-case identifier (e.g. `whatfix-q3-report`). Reuse the same identifier when updating.

## CRITICAL Rules

- **NO code execution** — everything runs client-side in the HTML artifact.
- **Every document is one object in `DOC.blocks[]`** — never write raw HTML/CSS for document content, only the artifact shape below.
- **NO EMOJIS** — ever.
- Sentence case for all headings — never title-case every word.

## Artifact Shape — MANDATORY

The artifact body is now data, not hand-authored HTML/CSS. Emit exactly this shape:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DOCUMENT_TITLE</title>
<script src="/libs/docx.iife.js"></script>
<script src="/libs/download-bridge.js"></script>
<script src="/libs/doc-renderer.js"></script>
</head>
<body>
<div id="doc-root"></div>
<script>
window.DOC = {
  "title": "DOCUMENT_TITLE",
  "subtitle": "Subtitle or document type",
  "author": "Name",
  "date": "Month Year",
  "blocks": [
    { "type": "heading1", "text": "Executive summary" },
    { "type": "paragraph", "text": "Opening paragraph summarizing the key point in two to three sentences." }
    /* ...one entry per block... */
  ]
};
DocRenderer.renderDoc(window.DOC, document.getElementById('doc-root'));
// window.downloadDocx() (exposed by doc-renderer.js) generates the native .docx export
</script>
</body>
</html>
```

**Never write CSS, positioning, or duplicated content in the artifact.** Every section of the document is one object in `blocks[]` with a `type` field (from the table below) and that block's content fields — nothing else. `doc-renderer.js` (loaded from `/libs/`, never regenerated) owns every visual decision.

## Block Reference

| `type` | Fields | Use for |
|---|---|---|
| `heading1` | `text` | Top-level section heading |
| `heading2` | `text` | Sub-section heading |
| `heading3` | `text` | Minor heading |
| `paragraph` | `text` | Body copy |
| `bullets` | `items` (string array, any length) | Unordered list |
| `numbered` | `items` (string array, any length) | Ordered/numbered list |
| `callout` | `text` | Orange-accent callout box for a key insight |
| `table` | `headers` (up to 6 columns), `rows` (array of string arrays, any number of rows, each sliced to match `headers`) | Structured/tabular data |
| `image` | `brandImage` (asset key, e.g. `"dap-dark"`), `caption?` | A brand logo or product graphic |
| `divider` | — | Horizontal rule between sections |
| `pageBreak` | — | Force a new page at this point |

Lists and table rows are never capped in length — a document can be as long as it needs to be. Table columns ARE capped at 6 by construction (a real Word rendering constraint, not a content-length one) — if you need more than 6 columns, that's two tables or a restructured table, not one wide one.

## Using brand images

Pass the asset key (filename without extension, e.g. `"dap-dark"`) as `image.brandImage`. `doc-renderer.js` resolves the key against `/brand/` and handles sizing — you never specify coordinates or dimensions.

Only PNG-only brand assets (the ones with no `.svg` version under `/brand/` — e.g. `dap-dark`, `mirror-dark`; see `PNG_ONLY_BRAND_IMAGES` in `doc-renderer.js` for the full list) can be embedded in the exported `.docx`. Exporting a document whose `image` block uses a non-PNG (SVG-resolved) key throws a clear error at export time instead of producing a file. The live HTML preview supports both PNG and SVG keys; only the `.docx` export path is restricted.

## Document metadata

`title`, `subtitle`, `author`, and `date` are front-matter, not visible content — none of them are printed on the page itself. They only populate the exported `.docx` file's properties (visible via Word's File > Info panel, not in the document body) and the downloaded filename:

- `title` → the `.docx` Title property and the download filename (slugified)
- `subtitle` → the `.docx` Description property
- `author` → the `.docx` Author property (defaults to "Whatfix" if omitted)
- `date` → the `.docx` Subject property

If the document itself needs a visible title on the page, add a `heading1` block for it — the top-level `title` field alone will not appear anywhere in the preview or the printed page.

## Page size

Every generated document is A4 (210mm × 297mm) by default — this is set once, centrally, in `doc-renderer.js`; you never configure it per document.

## After Generating

1. Add more sections or restructure the document?
2. Add a table or data section?
3. Change the document type (proposal, brief, one-pager)?
