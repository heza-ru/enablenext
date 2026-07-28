# Doc Generation Redesign Design

**Scope:** Sub-project **B** of the three-part export effort (see `2026-07-28-export-pipeline-cleanup-design.md` for sub-project C, and `2026-07-28-presentation-generation-redesign-design.md` for sub-project A, both already implemented). Covers the Word/DOCX document generator only (`agents/doc-creator.skill.md`). Informed directly by A's outcome and process.

## Problem

`agents/doc-creator.skill.md` has the exact dual-representation problem A's redesign eliminated for slides: the LLM hand-authors a raw HTML `.page` preview **and** a separate `DOC.sections` JavaScript array, and must keep the two in sync manually on every generation. There is no structural guarantee they match.

Concretely, today:
- The preview's CSS already styles `<table>` elements, but `DOC.sections` has **no `table` type at all** — a table the LLM puts in the HTML preview silently disappears from the exported `.docx`.
- No image support of any kind (brand logos/product graphics), even though the deck renderer already has a working, working `/brand/`-asset-key convention to reuse.
- No ordered/numbered lists — only unordered bullets.
- No explicit page size — the generated `.docx` silently gets `docx.js`'s implicit US Letter default, not A4, with no way to control pagination (no page-break concept anywhere).
- Fonts: preview uses DM Sans/Google Fonts import; export uses `'Calibri'` as "closest system font" — this mismatch is a reasonable, accepted constraint (real font embedding is out of scope, same as the deck redesign's non-goals) and is **not** changed by this redesign.

## Architecture

Same shape as the presentation redesign, adapted for a flowing document instead of a fixed-canvas slide:

1. The LLM emits one JSON document-spec: `window.DOC = { title, subtitle, author, date, blocks: [ { type, ...fields }, ... ] }`.
2. A new shared file, `client/public/libs/doc-renderer.js` — one vanilla-JS file, loaded via `<script src="/libs/doc-renderer.js">` exactly like `deck-renderer.js`/`download-bridge.js` (no build step, no framework, sandboxed-iframe constraint) — owns every visual decision:
   - `DocRenderer.renderDoc(docSpec, mountEl)` renders the on-screen HTML preview directly from `DOC.blocks`, in document order (natural vertical flow — no absolute positioning, no fixed canvas, unlike the deck renderer's `.slide` stacking).
   - `DocRenderer.downloadDocx()` reads `window.DOC` directly and builds the real `.docx` via `docx.js`, using the **same block data** — no DOM scraping, no second hand-maintained representation.
3. `agents/doc-creator.skill.md`'s "Output Format" is rewritten so the LLM emits only the JSON spec plus the three `<script src>` tags (`docx.iife.js`, `download-bridge.js`, `doc-renderer.js`) — never hand-authored HTML/CSS or a parallel `DOC.sections`-style array again.

### Block registry (not a layout registry)

Unlike slides, a document has no fixed canvas — there is no per-block geometry table and no absolute positioning. The registry shape is simpler:

```js
DocRenderer.registerBlock(type, {
  render: function (spec, containerEl) { /* appends real DOM to containerEl, in flow order */ },
  exportDocx: function (spec, helpers) { /* returns one or more docx.js Paragraph/Table objects via helpers */ },
});
DocRenderer.renderDoc(docSpec, mountEl);   // iterates docSpec.blocks, appends each block's render() output in order
DocRenderer.getBlock(type);                // throws a clear error naming the unregistered type, matching getLayout's fail-loud convention
DocRenderer.downloadDocx();                // reads window.DOC, builds the docx.Document from every block's exportDocx(), triggers download
```

`helpers` bundles the `docx` classes a block's `exportDocx` needs (`Paragraph`, `TextRun`, `HeadingLevel`, `BorderStyle`, `ShadingType`, `Table`, `TableRow`, `TableCell`, `WidthType`) so every block function has the same signature shape, mirroring the deck renderer's `(pptxSlide, spec)` convention.

### Block types

| `type` | Fields | Cap | Notes |
|---|---|---|---|
| `heading1` | `text` | — | Top-level section heading |
| `heading2` | `text` | — | Sub-section heading |
| `heading3` | `text` | — | Minor heading |
| `paragraph` | `text` | — | Body copy |
| `bullets` | `items` (string array) | — (length uncapped) | Unordered list |
| `numbered` | `items` (string array) | — (length uncapped) | **New.** Ordered list |
| `callout` | `text` | — | Existing orange-accent callout box |
| `table` | `headers` (string array), `rows` (array of string arrays) | **headers capped at 6 columns**, each row sliced to match; rows uncapped | **New.** Real table support — the gap that silently dropped content today |
| `image` | `brandImage` (asset key, same `/brand/` resolution convention — including the deck renderer's PNG-only-key allowlist — as `two_col`/`mockup`), `caption?` | — | **New.** Brand assets only, no arbitrary upload |
| `divider` | — | — | Existing horizontal rule |
| `pageBreak` | — | — | **New.** Explicit pagination control, both a real `docx.js` page break and a CSS page-break hint in the preview |

Table column cap (6) is the one width-based structural cap for this redesign, consistent with your call that documents should be **uncapped in length** (they can grow as long as needed — no fixed canvas to overflow) but still **capped in width** where a real rendering constraint exists (very wide tables break in Word regardless of document length).

### Page size (A4)

`docx.js`'s `Document` config gets an explicit `sections[0].properties.page.size` set to A4 (210mm × 297mm, expressed in twips: `11906 x 16838`), replacing today's implicit US Letter default. The HTML preview's `.page` container is resized to the same aspect ratio (currently a flat `max-width: 800px` with no height/aspect-ratio relationship at all) so the on-screen preview visually approximates real A4 page proportions, including roughly where a `pageBreak` block would fall.

## Non-Goals

- Real font embedding (Calibri-as-DM-Sans-substitute stands, matching the accepted precedent from the deck redesign).
- Arbitrary/user-uploaded images — brand assets only, same restriction as the deck renderer.
- Headers, footers, and page numbers — a real, separate feature; not required to fix the dual-representation/table-loss bugs this redesign targets.
- Multi-column page layout.
- Table cell merging/spanning.
- Nested/multi-level bullet lists — flat lists only in this pass; a fast-follow if a real need surfaces.
- Any change to `agents/presentation-creator.skill.md`, `agents/excel-creator.skill.md`, or `deck-renderer.js` — this redesign touches only the doc generator.

## Migration

Old artifacts (generated under the current dual-HTML+`DOC.sections` approach) are immutable, self-contained HTML — they inline `docx.iife.js`'s usage directly and never reference `/libs/doc-renderer.js`. They are unaffected by this redesign and continue to render/export exactly as before.

## Testing / Verification

Same TDD discipline as the deck renderer: Jest + jsdom unit tests per block type (`render()` produces the right DOM/content, `exportDocx()` produces the right `docx.js` call shape via a `helpers` mock), a `renderDoc`/registry test suite mirroring `deck-renderer.test.js`'s structure, and a `downloadDocx()` test asserting it iterates `DOC.blocks` and calls each registered block's `exportDocx` in order. End-to-end verification (a representative multi-block document, checking the real generated `.docx`'s XML for A4 page size, table presence, and image presence) follows the same adapted-substitute approach used for the deck renderer's Task 8, given this environment has no live browser/backend to drive the actual chat UI.
