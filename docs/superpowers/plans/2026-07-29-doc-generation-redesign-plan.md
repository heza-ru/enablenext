# Doc Generation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LLM-authored HTML-preview-plus-parallel-`DOC.sections`-array Word document format with a single JSON document-spec, a shared pre-built renderer that produces both the on-screen preview and the native `.docx` export from that one source, and real support for tables, images, ordered lists, and page breaks — content types that silently vanish from exports today.

**Architecture:** Per `docs/superpowers/specs/2026-07-29-doc-generation-redesign-design.md`: (1) the LLM emits `window.DOC = { title, subtitle, author, date, blocks: [{ type, ...fields }] }`; (2) `client/public/libs/doc-renderer.js` — one shared vanilla-JS file, loaded via `<script src>` like `deck-renderer.js`/`download-bridge.js` — renders that JSON into the visible document preview in natural document flow (no fixed canvas, no absolute positioning, unlike the deck renderer); (3) the same file's `downloadDocx()` reads `window.DOC` directly to build the native `.docx` via `docx.js`, using the same block data — no DOM scraping, no second hand-maintained array.

**Tech Stack:** Vanilla JS (`doc-renderer.js`, no build step, no framework — matching `deck-renderer.js`/`download-bridge.js`), `docx.js` v9.x (`client/public/libs/docx.iife.js`, already confirmed API-compatible with this repo's usage during the export-pipeline-cleanup plan), Jest + jsdom, Markdown (skill file rewrite).

## Global Constraints

- No fixed canvas, no per-block geometry table, no absolute positioning — blocks render in natural top-to-bottom document flow. This is the one fundamental architectural difference from the deck renderer's fixed-10x5.625in-canvas layout registry.
- Block list-like fields (`bullets.items`, `numbered.items`, `table.rows`) are **uncapped in length** — documents can grow arbitrarily long, unlike a fixed-size slide.
- `table.headers` (and every row) IS capped at **6 columns** by construction — this is a width constraint (very wide tables break in Word regardless of document length), not a length constraint.
- Page size is explicit **A4** (210mm × 297mm = 11906 × 16838 twips) in the `docx.js` `Document`'s `sections[0].properties.page.size` — never the implicit US Letter default.
- `doc-renderer.js` is one file, vanilla JS/DOM, no framework, no build step — loaded from `client/public/libs/doc-renderer.js`.
- Images are brand assets only, resolved via the same `/brand/<key>.<ext>` convention (including the PNG-only-key allowlist) already established in `deck-renderer.js` — no arbitrary/user-uploaded images.
- No headers/footers/page numbers, no multi-column layout, no table cell merging, no nested/multi-level bullet lists — all explicitly out of scope for this plan (see spec's Non-Goals).
- Font: body/headings use `'Calibri'` in the `.docx` export (closest system font to the preview's DM Sans) — this mismatch is an accepted, unchanged constraint, not something this plan fixes.
- This plan touches `agents/doc-creator.skill.md` and adds `client/public/libs/doc-renderer.js` only. It must not modify `agents/presentation-creator.skill.md`, `agents/excel-creator.skill.md`, or `deck-renderer.js`.

---

### Task 1: Foundational schema, block registry, and `renderDoc()`

**Files:**
- Create: `client/public/libs/doc-renderer.js`
- Create: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Produces: `DocRenderer.registerBlock(type, { render, exportDocx })`, `DocRenderer.getBlock(type)`, `DocRenderer.renderDoc(docSpec, mountEl)` — all attached to `window.DocRenderer` (no module system, matching the sandboxed-iframe constraint).
- Consumed by: Tasks 2–5 (each block type's render/export functions), Task 6 (`downloadDocx()`), Task 7 (the skill's generated artifact).

- [ ] **Step 1: Write a failing test for the block registry**

```javascript
// client/public/libs/__tests__/doc-renderer.test.js
const fs = require('fs');
const path = require('path');

function loadDocRenderer() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'doc-renderer.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(src);
  return window.DocRenderer;
}

describe('DocRenderer registry', () => {
  it('registers and retrieves a block by type', () => {
    const DocRenderer = loadDocRenderer();
    const render = () => {};
    const exportDocx = () => [];
    DocRenderer.registerBlock('test_block', { render, exportDocx });
    const block = DocRenderer.getBlock('test_block');
    expect(block.render).toBe(render);
    expect(block.exportDocx).toBe(exportDocx);
  });

  it('throws a clear error for an unregistered block type', () => {
    const DocRenderer = loadDocRenderer();
    expect(() => DocRenderer.getBlock('does_not_exist')).toThrow(/does_not_exist/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — `client/public/libs/doc-renderer.js` doesn't exist yet.

- [ ] **Step 3: Implement the registry skeleton**

```javascript
// client/public/libs/doc-renderer.js
//
// Shared document renderer + DOCX exporter for LLM-generated Word documents.
// Loaded via <script src="/libs/doc-renderer.js"> by the doc-creator skill's
// generated artifact. The artifact assigns a document-spec JSON to
// window.DOC; this file turns that into both the visible preview
// (renderDoc) and the native .docx export (downloadDocx, added in Task 6).
//
// Unlike deck-renderer.js, there is no fixed canvas here — a document
// flows top-to-bottom with no per-block geometry table. Each block is a
// registry entry with a render() (appends real DOM to the preview
// container, in flow order) and an exportDocx() (returns docx.js
// Paragraph/Table objects built from the same block data) — one source
// of truth, no DOM scraping, no duplicated content.
(function () {
  var registry = {};

  function registerBlock(type, def) {
    registry[type] = def;
  }

  function getBlock(type) {
    var block = registry[type];
    if (!block) {
      throw new Error('DocRenderer: no block registered for type "' + type + '"');
    }
    return block;
  }

  window.DocRenderer = {
    registerBlock: registerBlock,
    getBlock: getBlock,
  };
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Add `renderDoc()`, the base page CSS (A4 aspect ratio), and a test**

```javascript
// Add to the test file
describe('renderDoc', () => {
  it('mounts one block element per spec, tagged with its type, in order', () => {
    const DocRenderer = loadDocRenderer();
    DocRenderer.registerBlock('heading1', {
      render: (spec, containerEl) => {
        var h1 = document.createElement('h1');
        h1.textContent = spec.text;
        containerEl.appendChild(h1);
      },
      exportDocx: () => [],
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    DocRenderer.renderDoc({ title: 'Test Doc', blocks: [{ type: 'heading1', text: 'Hello' }] }, mount);

    const page = mount.querySelector('.doc-page');
    expect(page).not.toBeNull();
    expect(page.querySelector('h1').textContent).toBe('Hello');
  });

  it('throws a clear error if a block spec names an unregistered type', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    expect(() =>
      DocRenderer.renderDoc({ blocks: [{ type: 'nonexistent' }] }, mount),
    ).toThrow(/nonexistent/);
  });
});
```

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js` — expect FAIL, then implement:

```javascript
  var A4_WIDTH_MM = 210;
  var A4_HEIGHT_MM = 297;

  function injectBaseStyles() {
    if (document.getElementById('doc-renderer-base-styles')) return;
    var style = document.createElement('style');
    style.id = 'doc-renderer-base-styles';
    style.textContent =
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      "body{font-family:'DM Sans',sans-serif;background:#25223B;min-height:100vh;padding:2rem}" +
      '.doc-page{width:100%;max-width:800px;aspect-ratio:' + A4_WIDTH_MM + '/' + A4_HEIGHT_MM + ';' +
      'min-height:auto;margin:0 auto;background:#F9F9F2;border-radius:8px;' +
      'padding:clamp(2rem,5vw,4rem);box-shadow:0 4px 40px rgba(0,0,0,.4);color:#35324A;' +
      'overflow-y:auto}' +
      '.doc-page h1{font-size:2.2rem;font-weight:600;color:#FF6B18;line-height:1.15;margin-bottom:.5rem}' +
      '.doc-page h2{font-size:1.35rem;font-weight:600;color:#25223B;margin:1.75rem 0 .6rem;line-height:1.3}' +
      '.doc-page h3{font-size:1.05rem;font-weight:600;color:#35324A;margin:1.25rem 0 .4rem}' +
      '.doc-page p{font-size:.95rem;font-weight:400;line-height:1.7;color:#35324A;margin-bottom:.9rem}';
    document.head.appendChild(style);
  }

  function renderDoc(docSpec, mountEl) {
    injectBaseStyles();
    var pageEl = document.createElement('div');
    pageEl.className = 'doc-page';
    (docSpec.blocks || []).forEach(function (spec) {
      var block = getBlock(spec.type); // throws if unregistered — fail loudly, not silently
      block.render(spec, pageEl);
    });
    mountEl.innerHTML = '';
    mountEl.appendChild(pageEl);
  }
```

Add `renderDoc: renderDoc,` to the exported object. Run the tests again to verify they pass.

Note: `.doc-page`'s `aspect-ratio: 210/297` gives the on-screen preview real A4 proportions instead of the old flat `max-width: 800px` box, per the redesign spec's page-size requirement. `overflow-y:auto` keeps a long document scrollable within that visual frame rather than clipping content — this is a preview-only concession (the real `.docx` paginates for real via Task 6/4's page size and page-break work); it does not cap or hide any block's content.

- [ ] **Step 6: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: add doc-renderer.js foundation — block registry, renderDoc, A4-proportioned preview

Establishes the block-registry pattern (render + exportDocx sharing
one block spec, no per-block geometry table since documents flow
rather than occupy a fixed canvas) that every subsequent block type
registers into. Base preview CSS uses a real A4 aspect ratio instead
of a flat max-width box, per the redesign spec's page-size requirement."
```

---

### Task 2: Implement `heading1`, `heading2`, `heading3`, `paragraph` blocks — establishes the pattern

**Files:**
- Modify: `client/public/libs/doc-renderer.js`
- Modify: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Consumes: `DocRenderer.registerBlock`, `DocRenderer.getBlock` from Task 1.
- Produces: `heading1`, `heading2`, `heading3`, `paragraph` registry entries, each `{ render(spec, containerEl), exportDocx(spec, helpers) }`. `exportDocx`'s `helpers` parameter is `{ Paragraph, TextRun, HeadingLevel }` for this task — tests call `exportDocx` with a plain object of no-op constructor stand-ins recording calls, since the real `docx.js` library isn't loaded in the jsdom test environment (same convention as the deck renderer's mock-`pptxSlide` tests).

- [ ] **Step 1: Write failing tests for all four blocks**

```javascript
// Add to client/public/libs/__tests__/doc-renderer.test.js
function makeDocxHelpers() {
  const calls = { Paragraph: [], TextRun: [] };
  class TextRun { constructor(opts) { calls.TextRun.push(opts); Object.assign(this, opts); } }
  class Paragraph { constructor(opts) { calls.Paragraph.push(opts); Object.assign(this, opts); } }
  const HeadingLevel = { HEADING_1: 'Heading1', HEADING_2: 'Heading2', HEADING_3: 'Heading3' };
  return { helpers: { Paragraph, TextRun, HeadingLevel }, calls };
}

describe('block: heading1/heading2/heading3', () => {
  it.each([['heading1', 'h1'], ['heading2', 'h2'], ['heading3', 'h3']])(
    '%s renders the right tag with the right text',
    (type, tag) => {
      const DocRenderer = loadDocRenderer();
      const containerEl = document.createElement('div');
      DocRenderer.getBlock(type).render({ type, text: 'Section title' }, containerEl);
      const el = containerEl.querySelector(tag);
      expect(el).not.toBeNull();
      expect(el.textContent).toBe('Section title');
    },
  );

  it('heading1 exports a HEADING_1 paragraph with the heading text', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('heading1').exportDocx({ type: 'heading1', text: 'Section title' }, helpers);
    expect(calls.Paragraph[0].heading).toBe('Heading1');
    expect(calls.TextRun[0].text).toBe('Section title');
  });
});

describe('block: paragraph', () => {
  it('renders a <p> with the body text', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('paragraph').render({ type: 'paragraph', text: 'Body copy.' }, containerEl);
    expect(containerEl.querySelector('p').textContent).toBe('Body copy.');
  });

  it('exports a plain (non-heading) paragraph with the body text', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('paragraph').exportDocx({ type: 'paragraph', text: 'Body copy.' }, helpers);
    expect(calls.Paragraph[0].heading).toBeUndefined();
    expect(calls.TextRun[0].text).toBe('Body copy.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — none of the four blocks are registered yet.

- [ ] **Step 3: Implement all four blocks**

Colors/sizes ported directly from the current `agents/doc-creator.skill.md`'s preview CSS (lines 84-90) and `downloadDocx()`'s heading/paragraph handling (lines 224-243 of the current file):

```javascript
  var FONT = 'Calibri'; // closest system font to DM Sans, matching the current skill's accepted convention
  var INK700 = '25223B', INK = '35324A', ORANGE = 'FF6B18';

  registerBlock('heading1', {
    render: function (spec, containerEl) {
      var h1 = document.createElement('h1');
      h1.textContent = spec.text || '';
      containerEl.appendChild(h1);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_1,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 32, color: INK700, font: FONT })],
        spacing: { before: 360, after: 120 },
      })];
    },
  });

  registerBlock('heading2', {
    render: function (spec, containerEl) {
      var h2 = document.createElement('h2');
      h2.textContent = spec.text || '';
      containerEl.appendChild(h2);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_2,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 24, color: INK, font: FONT })],
        spacing: { before: 240, after: 80 },
      })];
    },
  });

  registerBlock('heading3', {
    render: function (spec, containerEl) {
      var h3 = document.createElement('h3');
      h3.textContent = spec.text || '';
      containerEl.appendChild(h3);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_3,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 20, color: INK, font: FONT })],
        spacing: { before: 200, after: 60 },
      })];
    },
  });

  registerBlock('paragraph', {
    render: function (spec, containerEl) {
      var p = document.createElement('p');
      p.textContent = spec.text || '';
      containerEl.appendChild(p);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        children: [new helpers.TextRun({ text: spec.text || '', size: 22, color: INK, font: FONT })],
        spacing: { after: 160 },
      })];
    },
  });
```

- [ ] **Step 4: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS (all tests, both new and from Task 1).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: implement heading1/heading2/heading3/paragraph blocks — establishes the pattern

Each block is a registry entry with a render() producing the visible
DOM and an exportDocx(spec, helpers) using injected docx.js
constructors — the pattern every remaining block in Tasks 3-5
follows. Colors/sizes ported directly from the current doc-creator
skill's existing preview CSS and downloadDocx() code."
```

---

### Task 3: Implement `bullets`, `numbered`, `callout`, `divider` blocks

**Files:**
- Modify: `client/public/libs/doc-renderer.js`
- Modify: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Consumes: same as Task 2.
- Produces: `bullets`, `numbered`, `callout`, `divider` registry entries. `numbered`'s `exportDocx` additionally needs `helpers.AlignmentType` is NOT required, but does need each `docx.js` numbered-paragraph to use `numbering: { reference: 'default-numbering', level: 0 }` — since wiring a real numbering definition happens once at the `Document` level in Task 6, this task's `exportDocx` for `numbered` must reference a numbering config named exactly `'default-numbering'` so Task 6's `Document({ numbering: { config: [{ reference: 'default-numbering', ... }] } })` matches it.

- [ ] **Step 1: Write failing tests for all four blocks**

```javascript
// Add to client/public/libs/__tests__/doc-renderer.test.js
describe('block: bullets', () => {
  it('renders one <li> per item inside a <ul>, uncapped', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('bullets').render({ type: 'bullets', items: ['One', 'Two', 'Three', 'Four', 'Five'] }, containerEl);
    const items = containerEl.querySelectorAll('ul li');
    expect(items.length).toBe(5); // uncapped — documents can be as long as needed
  });

  it('exports one bullet paragraph per item', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('bullets').exportDocx({ type: 'bullets', items: ['One', 'Two'] }, helpers);
    expect(calls.Paragraph.length).toBe(2);
    expect(calls.Paragraph[0].bullet).toEqual({ level: 0 });
  });
});

describe('block: numbered', () => {
  it('renders one <li> per item inside an <ol>', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('numbered').render({ type: 'numbered', items: ['First', 'Second'] }, containerEl);
    expect(containerEl.querySelectorAll('ol li').length).toBe(2);
  });

  it('exports one numbered paragraph per item, referencing the shared numbering config', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('numbered').exportDocx({ type: 'numbered', items: ['First', 'Second'] }, helpers);
    expect(calls.Paragraph.length).toBe(2);
    expect(calls.Paragraph[0].numbering).toEqual({ reference: 'default-numbering', level: 0 });
  });
});

describe('block: callout', () => {
  it('renders the callout text inside a .callout box', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('callout').render({ type: 'callout', text: 'Key insight.' }, containerEl);
    expect(containerEl.querySelector('.callout').textContent).toBe('Key insight.');
  });

  it('exports a shaded, bordered paragraph', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('callout').exportDocx({ type: 'callout', text: 'Key insight.' }, helpers);
    expect(calls.Paragraph[0].shading).toBeDefined();
    expect(calls.Paragraph[0].border.left).toBeDefined();
  });
});

describe('block: divider', () => {
  it('renders an <hr>', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('divider').render({ type: 'divider' }, containerEl);
    expect(containerEl.querySelector('hr')).not.toBeNull();
  });

  it('exports a bottom-bordered empty paragraph', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('divider').exportDocx({ type: 'divider' }, helpers);
    expect(calls.Paragraph[0].border.bottom).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — none of the four blocks exist yet.

- [ ] **Step 3: Implement `bullets` and `numbered`** (ported from the current skill's `bullets` handling, lines 245-252, generalized to add the new `numbered` sibling)

```javascript
  var GRAY300 = 'E5E3DC', ORANGE100 = 'FFE9DC';

  registerBlock('bullets', {
    render: function (spec, containerEl) {
      var ul = document.createElement('ul');
      (spec.items || []).forEach(function (text) { // uncapped — documents flow, no fixed canvas to overflow
        var li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      containerEl.appendChild(ul);
    },
    exportDocx: function (spec, helpers) {
      return (spec.items || []).map(function (text) {
        return new helpers.Paragraph({
          bullet: { level: 0 },
          children: [new helpers.TextRun({ text: text, size: 22, color: INK, font: FONT })],
          spacing: { after: 80 },
        });
      });
    },
  });

  registerBlock('numbered', {
    render: function (spec, containerEl) {
      var ol = document.createElement('ol');
      (spec.items || []).forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        ol.appendChild(li);
      });
      containerEl.appendChild(ol);
    },
    exportDocx: function (spec, helpers) {
      return (spec.items || []).map(function (text) {
        return new helpers.Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          children: [new helpers.TextRun({ text: text, size: 22, color: INK, font: FONT })],
          spacing: { after: 80 },
        });
      });
    },
  });
```

- [ ] **Step 4: Implement `callout` and `divider`** (ported verbatim from the current skill's `callout`/`divider` handling, lines 254-273)

```javascript
  registerBlock('callout', {
    render: function (spec, containerEl) {
      var div = document.createElement('div');
      div.className = 'callout';
      var p = document.createElement('p');
      p.textContent = spec.text || '';
      div.appendChild(p);
      containerEl.appendChild(div);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        children: [new helpers.TextRun({ text: spec.text || '', italics: true, size: 21, color: INK, font: FONT })],
        spacing: { after: 160, before: 80 },
        shading: { type: 'clear', fill: ORANGE100 },
        border: { left: { color: ORANGE, size: 16, style: 'single', space: 8 } },
        indent: { left: 240 },
      })];
    },
  });

  registerBlock('divider', {
    render: function (spec, containerEl) {
      var hr = document.createElement('hr');
      containerEl.appendChild(hr);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        border: { bottom: { color: GRAY300, size: 6, style: 'single', space: 4 } },
        spacing: { before: 200, after: 200 },
        children: [],
      })];
    },
  });
```

Note: `callout`/`divider`'s `exportDocx` pass plain string literals (`'clear'`, `'single'`) instead of `helpers.ShadingType.CLEAR`/`helpers.BorderStyle.SINGLE` — this matches the current skill's own `downloadDocx()` code, which already does this (its `ShadingType`/`BorderStyle` destructure is used elsewhere but these two calls use literals in the version being ported from); Task 6 wires the full real `helpers` object including `ShadingType`/`BorderStyle` for any block that needs them, but this task's tests only assert on the fields shown above, not on which style constant produced the string, so plain literals here are correct and match the ported source.

- [ ] **Step 5: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: implement bullets, numbered, callout, divider blocks

bullets/callout/divider ported directly from the current doc-creator
skill's existing CSS and downloadDocx() code. numbered is new (no
prior implementation) and references a shared 'default-numbering'
config that Task 6 wires at the Document level. List lengths are
uncapped per the redesign spec — documents flow, unlike a fixed-size
slide."
```

---

### Task 4: Implement `table` (6-column structural cap) and `pageBreak` blocks

**Files:**
- Modify: `client/public/libs/doc-renderer.js`
- Modify: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Consumes: same registry pattern as Tasks 2-3. `table`'s `exportDocx` additionally needs `helpers.Table`, `helpers.TableRow`, `helpers.TableCell`, `helpers.WidthType`. `pageBreak`'s `exportDocx` needs `helpers.PageBreak`.
- Produces: `table`, `pageBreak` registry entries. **This is the core integrity fix the redesign spec calls out** — today's `doc-creator.skill.md` has no `table` block type at all, so a table in the HTML preview silently disappears from the exported `.docx`.

- [ ] **Step 1: Write failing tests for both blocks**

```javascript
// Add to client/public/libs/__tests__/doc-renderer.test.js
describe('block: table', () => {
  it('renders a header row and one row per data row, uncapped rows', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('table').render({
      type: 'table',
      headers: ['Feature', 'Status'],
      rows: [['Tables', 'Fixed'], ['Images', 'Fixed'], ['Numbered lists', 'Fixed']],
    }, containerEl);
    expect(containerEl.querySelectorAll('thead th').length).toBe(2);
    expect(containerEl.querySelectorAll('tbody tr').length).toBe(3); // rows uncapped
  });

  it('caps headers (and each row) at 6 columns by construction', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    const headers = ['A', 'B', 'C', 'D', 'E', 'F', 'G — dropped'];
    DocRenderer.getBlock('table').render({ type: 'table', headers, rows: [headers.slice()] }, containerEl);
    expect(containerEl.querySelectorAll('thead th').length).toBe(6);
    expect(containerEl.querySelectorAll('tbody tr td').length).toBe(6);
  });

  it('exports a real docx.js Table with a header row and data rows, same 6-column cap', () => {
    const DocRenderer = loadDocRenderer();
    const calls = { Table: [], TableRow: [], TableCell: [] };
    class TableCell { constructor(opts) { calls.TableCell.push(opts); Object.assign(this, opts); } }
    class TableRow { constructor(opts) { calls.TableRow.push(opts); Object.assign(this, opts); } }
    class Table { constructor(opts) { calls.Table.push(opts); Object.assign(this, opts); } }
    const { helpers: baseHelpers } = makeDocxHelpers();
    const helpers = Object.assign({}, baseHelpers, { Table, TableRow, TableCell, WidthType: { PERCENTAGE: 'pct' } });

    const result = DocRenderer.getBlock('table').exportDocx({
      type: 'table',
      headers: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      rows: [['1', '2', '3', '4', '5', '6', '7']],
    }, helpers);

    expect(result.length).toBe(1);
    expect(calls.TableRow.length).toBe(2); // 1 header row + 1 data row
    expect(calls.TableRow[0].children.length).toBe(6); // header row capped at 6
    expect(calls.TableRow[1].children.length).toBe(6); // data row capped at 6
  });
});

describe('block: pageBreak', () => {
  it('renders a page-break hint element', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('pageBreak').render({ type: 'pageBreak' }, containerEl);
    expect(containerEl.querySelector('.page-break')).not.toBeNull();
  });

  it('exports a real docx.js page break', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    class PageBreak {}
    helpers.PageBreak = PageBreak;
    const result = DocRenderer.getBlock('pageBreak').exportDocx({ type: 'pageBreak' }, helpers);
    expect(result[0].children[0]).toBeInstanceOf(PageBreak);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — neither block exists yet.

- [ ] **Step 3: Implement `table`** (new — no prior source; CSS ported from the current skill's `.page table` styling, lines 92-96)

```javascript
  var MAX_TABLE_COLS = 6; // width constraint: very wide tables break in Word regardless of document length

  registerBlock('table', {
    render: function (spec, containerEl) {
      var table = document.createElement('table');
      var headers = (spec.headers || []).slice(0, MAX_TABLE_COLS); // structural cap: max 6 columns
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      headers.forEach(function (headerText) {
        var th = document.createElement('th');
        th.textContent = headerText;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      var tbody = document.createElement('tbody');
      (spec.rows || []).forEach(function (row) { // rows uncapped — length is not a canvas constraint here
        var tr = document.createElement('tr');
        row.slice(0, MAX_TABLE_COLS).forEach(function (cell) { // same 6-column cap applied per row
          var td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      containerEl.appendChild(table);
    },
    exportDocx: function (spec, helpers) {
      var headers = (spec.headers || []).slice(0, MAX_TABLE_COLS);
      function makeCell(text, isHeader) {
        return new helpers.TableCell({
          width: { size: Math.floor(100 / headers.length), type: helpers.WidthType.PERCENTAGE },
          shading: isHeader ? { fill: ORANGE } : undefined,
          children: [new helpers.Paragraph({
            children: [new helpers.TextRun({ text: text, color: isHeader ? 'FFFFFF' : INK, bold: !!isHeader, font: FONT, size: 20 })],
          })],
        });
      }
      var headerRow = new helpers.TableRow({ children: headers.map(function (h) { return makeCell(h, true); }) });
      var dataRows = (spec.rows || []).map(function (row) {
        return new helpers.TableRow({ children: row.slice(0, MAX_TABLE_COLS).map(function (cell) { return makeCell(cell, false); }) });
      });
      return [new helpers.Table({ rows: [headerRow].concat(dataRows), width: { size: 100, type: helpers.WidthType.PERCENTAGE } })];
    },
  });
```

- [ ] **Step 4: Implement `pageBreak`** (new — no prior source)

```javascript
  registerBlock('pageBreak', {
    render: function (spec, containerEl) {
      var div = document.createElement('div');
      div.className = 'page-break';
      containerEl.appendChild(div);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({ children: [new helpers.PageBreak()] })];
    },
  });
```

Add `.page-break{border-top:2px dashed ` + GRAY300 + `;margin:2rem 0;page-break-after:always}` to `injectBaseStyles()`'s `style.textContent` — this gives the preview a visible seam where a real page break falls, using the CSS `page-break-after` property as the closest print-context equivalent (this is a visual hint for the on-screen preview only; the real pagination is what Task 4's `exportDocx` produces).

- [ ] **Step 5: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: implement table (6-column cap) and pageBreak blocks

table is the core integrity fix this redesign exists for — the
current skill has no table block type at all, so a table in the HTML
preview silently vanishes from the exported .docx. Columns capped at
6 by construction (a genuine Word rendering constraint); rows
uncapped, since documents flow and have no fixed canvas to overflow.
pageBreak gives explicit pagination control in both paths."
```

---

### Task 5: Implement the `image` block (brand assets only)

**Files:**
- Modify: `client/public/libs/doc-renderer.js`
- Modify: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Consumes: same registry pattern. Reuses the deck renderer's brand-asset-key convention (see `client/public/libs/deck-renderer.js`'s `PNG_ONLY_BRAND_IMAGES` allowlist and `brandImagePath(key)` helper) — **duplicate that exact allowlist and helper into `doc-renderer.js`** (this file has no shared-module system with `deck-renderer.js`, so a small, deliberate duplication of this one lookup table is correct here, not a DRY violation to "fix" — the two files are independently loaded, standalone `<script src>` includes).
- Produces: `image` registry entry. `exportDocx` is **async** (must `fetch()` the real image bytes before constructing a `docx.js` `ImageRun`) — this is the one block type whose `exportDocx` returns a `Promise`, not a plain array; Task 6's `downloadDocx()` must `await` every block's `exportDocx` result to handle this uniformly.

- [ ] **Step 1: Write failing tests**

```javascript
// Add to client/public/libs/__tests__/doc-renderer.test.js
describe('block: image', () => {
  it('renders an <img> pointing at the resolved brand asset path, plus an optional caption', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'dap-dark', caption: 'DAP product mark' }, containerEl);
    const img = containerEl.querySelector('img');
    expect(img.src).toContain('/brand/dap-dark.png'); // dap-dark is PNG-only, matching deck-renderer.js's allowlist
    expect(containerEl.querySelector('figcaption').textContent).toBe('DAP product mark');
  });

  it('resolves a non-allowlisted key to .svg', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'authoring-agent-dark' }, containerEl);
    expect(containerEl.querySelector('img').src).toContain('/brand/authoring-agent-dark.svg');
  });

  it('exports an async ImageRun paragraph after fetching the real image bytes', async () => {
    const DocRenderer = loadDocRenderer();
    const { helpers } = makeDocxHelpers();
    const fetchedBuffers = [];
    class ImageRun { constructor(opts) { Object.assign(this, opts); } }
    helpers.ImageRun = ImageRun;
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => { const buf = new ArrayBuffer(4); fetchedBuffers.push(buf); return buf; } });

    const result = await DocRenderer.getBlock('image').exportDocx({ type: 'image', brandImage: 'dap-dark' }, helpers);

    expect(global.fetch).toHaveBeenCalledWith('/brand/dap-dark.png');
    expect(result[0].children[0]).toBeInstanceOf(ImageRun);
    expect(fetchedBuffers.length).toBe(1);
    delete global.fetch;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — `image` block doesn't exist yet.

- [ ] **Step 3: Implement `image`**

```javascript
  // Duplicated deliberately from deck-renderer.js's identical lookup table —
  // this file has no shared-module system with deck-renderer.js (both are
  // standalone <script src> includes), so this small table is copied, not
  // imported. Keep the two lists in sync if a new PNG-only brand asset is
  // added to /brand/.
  var PNG_ONLY_BRAND_IMAGES = {
    'ai-agents-suite-dark': true,
    'ai-agents-suite-light': true,
    'dap-dark': true,
    'dap-light': true,
    'mirror-dark': true,
    'product-analytics-dark': true,
    'product-suite-dark': true,
    'product-suite-full-dark': true,
    'product-suite-light': true,
    'screensense-dark': true,
    'screensense-suite-dark': true,
  };

  function brandImagePath(key) {
    var ext = PNG_ONLY_BRAND_IMAGES[key] ? 'png' : 'svg';
    return '/brand/' + key + '.' + ext;
  }

  registerBlock('image', {
    render: function (spec, containerEl) {
      var figure = document.createElement('figure');
      var img = document.createElement('img');
      img.src = brandImagePath(spec.brandImage);
      img.style.cssText = 'max-width:100%;height:auto;';
      figure.appendChild(img);
      if (spec.caption) {
        var figcaption = document.createElement('figcaption');
        figcaption.textContent = spec.caption;
        figure.appendChild(figcaption);
      }
      containerEl.appendChild(figure);
    },
    exportDocx: async function (spec, helpers) {
      var path = brandImagePath(spec.brandImage);
      var res = await fetch(path);
      var buffer = await res.arrayBuffer();
      var paragraphs = [new helpers.Paragraph({
        children: [new helpers.ImageRun({ data: buffer, transformation: { width: 400, height: 300 } })],
      })];
      if (spec.caption) {
        paragraphs.push(new helpers.Paragraph({
          children: [new helpers.TextRun({ text: spec.caption, italics: true, size: 18, color: INK, font: FONT })],
          spacing: { after: 160 },
        }));
      }
      return paragraphs;
    },
  });
```

- [ ] **Step 4: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS (all tests across every block implemented in Tasks 2-5).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: implement image block (brand assets only)

Reuses deck-renderer.js's brandImagePath/PNG_ONLY_BRAND_IMAGES
convention (deliberately duplicated, not imported — the two files
have no shared-module system). This is the one block whose
exportDocx is async (fetches real image bytes before building the
ImageRun), which Task 6's downloadDocx() must await uniformly."
```

---

### Task 6: Wire `downloadDocx()` — the export entrypoint, A4 page size, numbering config

**Files:**
- Modify: `client/public/libs/doc-renderer.js`
- Modify: `client/public/libs/__tests__/doc-renderer.test.js`

**Interfaces:**
- Consumes: every block's `exportDocx()` from Tasks 2-5, `window.DOC` (set by the artifact's own inline `<script>` per Task 7).
- Produces: `DocRenderer.downloadDocx()` — async, matching the existing `downloadDocx` contract `DownloadArtifact.tsx`'s `NATIVE_FORMATS` detection expects (a global function name whose invocation triggers a `<a download>` click on a blob URL, exactly like the deck renderer's `downloadPptx()`).

- [ ] **Step 1: Write a failing test asserting `downloadDocx` builds a `Document` with A4 page size and iterates every block**

```javascript
// Add to client/public/libs/__tests__/doc-renderer.test.js
describe('downloadDocx', () => {
  it('builds a Document with A4 page size and one exportDocx result per block, awaiting async blocks', async () => {
    const DocRenderer = loadDocRenderer();
    const exportedSpecs = [];
    DocRenderer.registerBlock('test_export_block', {
      render: () => {},
      exportDocx: async (spec) => { exportedSpecs.push(spec); return [{ marker: spec.text }]; },
    });

    let capturedDocumentOpts;
    class FakeDocument { constructor(opts) { capturedDocumentOpts = opts; } }
    class FakePacker { static toBlob() { return Promise.resolve(new Blob(['fake docx bytes'])); } }
    global.docx = {
      Document: FakeDocument, Packer: FakePacker, Paragraph: class {}, TextRun: class {},
      HeadingLevel: {}, AlignmentType: {}, BorderStyle: {}, ShadingType: {},
      TableRow: class {}, TableCell: class {}, Table: class {}, WidthType: {},
      PageBreak: class {}, ImageRun: class {},
    };
    window.docx = global.docx;

    window.DOC = {
      title: 'Test Doc', subtitle: 'Sub', author: 'Author', date: 'Jan 2026',
      blocks: [{ type: 'test_export_block', text: 'A' }, { type: 'test_export_block', text: 'B' }],
    };

    await DocRenderer.downloadDocx();

    expect(exportedSpecs).toEqual([{ type: 'test_export_block', text: 'A' }, { type: 'test_export_block', text: 'B' }]);
    expect(capturedDocumentOpts.sections[0].properties.page.size).toEqual({ width: 11906, height: 16838 }); // A4 in twips
    expect(capturedDocumentOpts.sections[0].children).toEqual([{ marker: 'A' }, { marker: 'B' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — `downloadDocx` doesn't exist yet.

- [ ] **Step 3: Implement `downloadDocx`**

```javascript
  async function downloadDocx() {
    var doc = window.DOC;
    var helpers = {
      Paragraph: window.docx.Paragraph, TextRun: window.docx.TextRun,
      HeadingLevel: window.docx.HeadingLevel, AlignmentType: window.docx.AlignmentType,
      BorderStyle: window.docx.BorderStyle, ShadingType: window.docx.ShadingType,
      TableRow: window.docx.TableRow, TableCell: window.docx.TableCell,
      Table: window.docx.Table, WidthType: window.docx.WidthType,
      PageBreak: window.docx.PageBreak, ImageRun: window.docx.ImageRun,
    };

    var children = [];
    for (var i = 0; i < (doc.blocks || []).length; i++) {
      var spec = doc.blocks[i];
      var block = getBlock(spec.type);
      var items = await Promise.resolve(block.exportDocx(spec, helpers)); // uniform await — image's exportDocx is async, the rest resolve immediately
      children = children.concat(items);
    }

    var docxDoc = new window.docx.Document({
      creator: 'Whatfix',
      title: doc.title,
      description: doc.subtitle,
      numbering: {
        config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'start' }] }],
      },
      styles: {
        default: { document: { run: { font: FONT, size: 22, color: INK }, paragraph: { spacing: { line: 360 } } } },
      },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 } } }, // A4 in twips (210mm x 297mm), per redesign spec
        children: children,
      }],
    });

    var blob = await window.docx.Packer.toBlob(docxDoc);
    var slug = (doc.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
```

Add `downloadDocx: downloadDocx,` to the exported `window.DocRenderer` object, **and** expose it as a bare global too — `window.downloadDocx = downloadDocx;` — matching the deck renderer's `window.downloadPptx` precedent, since `DownloadArtifact.tsx`'s `NATIVE_FORMATS` detection looks up `window['downloadDocx']` directly. **Also add a literal reference to the string `downloadDocx` inside Task 7's artifact template's inline `<script>` block** (a documentation comment, exactly like the deck renderer's fix for the same detection contract) — do this now while wiring this function, and confirm it in Task 7's own step, so the two tasks don't each assume the other handled it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest public/libs/__tests__/doc-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/doc-renderer.js client/public/libs/__tests__/doc-renderer.test.js
git commit -m "feat: wire downloadDocx() — A4 page size, shared numbering config, uniform async block export

Reads window.DOC directly, no DOM scraping. Awaits every block's
exportDocx() uniformly (only the image block's is actually async,
but this keeps the loop simple and correct regardless of which
blocks a given document uses). Sets explicit A4 page size (11906 x
16838 twips) instead of docx.js's implicit US Letter default, and
wires the shared 'default-numbering' config the numbered block's
paragraphs reference."
```

---

### Task 7: Rewrite `agents/doc-creator.skill.md`'s Output Format to emit the new JSON format

**Files:**
- Modify: `agents/doc-creator.skill.md`

**Interfaces:**
- Consumes: the full `doc-renderer.js` registry from Tasks 1-6 (all 10 block types and their expected field shapes).
- Produces: the new artifact HTML shape the LLM emits — no automated test (prompt-template markdown, not application code); verified manually in Task 8.

- [ ] **Step 1: Rewrite the "Output Format", "CRITICAL Rules", "Brand Colors", and "HTML Template" sections**

Keep the file's frontmatter (`name`, `description`, `user-invocable`, `allowed-tools`) and the "Output Format — MANDATORY" artifact-block wrapper instructions unchanged — replace everything from "## CRITICAL Rules" through the end of the "## HTML Template" section with:

```markdown
## CRITICAL Rules

- **NO code execution** — everything runs client-side in the HTML artifact.
- **Every document is one object in `DOC.blocks[]`** — never write raw HTML/CSS for document content, only the artifact shape below.
- **NO EMOJIS** — ever.
- Sentence case for all headings — never title-case every word.

## Artifact Shape — MANDATORY

The artifact body is now data, not hand-authored HTML/CSS. Emit exactly this shape:

\`\`\`html
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
\`\`\`

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

## Page size

Every generated document is A4 (210mm × 297mm) by default — this is set once, centrally, in `doc-renderer.js`; you never configure it per document.
```

- [ ] **Step 2: Confirm the literal string `downloadDocx` appears inside the fenced artifact template**, matching Task 6's note about `DownloadArtifact.tsx`'s substring-based capability detection (the same fix class the presentation redesign needed at its own final review) — the template shown in Step 1 above already includes the `// window.downloadDocx() (exposed by doc-renderer.js)...` comment inside the `<script>` block; verify it's present after you paste this section in, don't drop it.

- [ ] **Step 3: Commit**

```bash
git add agents/doc-creator.skill.md
git commit -m "refactor: rewrite doc-creator skill around the JSON block-spec schema

Output Format now emits window.DOC + three <script src> tags instead
of a full hand-authored HTML preview plus a hand-synced DOC.sections
array — the direct fix for the dual-representation drift bug this
redesign exists for (a table in the old preview could silently
vanish from the export; that's now structurally impossible). CRITICAL
Rules trimmed to real LLM content decisions; every block's CSS/docx.js
mechanics now live in doc-renderer.js. Includes the literal
'downloadDocx' string inside the artifact template so
DownloadArtifact.tsx's existing substring-based native-format
detection actually fires for the new format."
```

---

### Task 8: End-to-end verification

**Files:** none modified — this task is entirely verification, matching the redesign spec's Testing/Verification section.

**Interfaces:** none — terminal task.

- [ ] **Step 1: Generate a representative document under the new skill and check the visible render**

Prompt the chatbot for a document covering a mix of block types (at minimum: heading1, paragraph, bullets, numbered, callout, table, image, pageBreak). Confirm the artifact renders correctly in the side panel with real A4 proportions, and that the table and image actually appear (the exact gap this redesign fixes).

- [ ] **Step 2: Export to `.docx` and check fidelity in Microsoft Word / Google Docs (if available)**

Click "Download Word", open the result. Confirm: text is real editable text (not an image), the table is a real Word table with all its rows/columns present, the image renders, the numbered list actually numbers, the page size is A4, and a `pageBreak` block produces a real new page.

- [ ] **Step 3: Confirm old chat history still renders**

Open a chat from before this plan's changes that contains a document artifact generated under the old skill. Confirm it still renders and still exports correctly — old artifacts are self-contained and don't reference `/libs/doc-renderer.js` at all.

No commit for this task — it's verification only. If any step surfaces a bug, open a new task (not part of this plan) to fix it, following systematic-debugging to find the root cause before patching.

---

## Plan Self-Review Notes

- **Spec coverage**: Architecture (Tasks 1, 6), Block layer (Task 7), Render layer (Tasks 1-5), Export layer (Tasks 2-6), A4 page size (Task 6), Non-goals respected (no font embedding, no arbitrary images, no headers/footers/page numbers, no multi-column, no cell merging, no nested lists, no changes to the deck/excel skills or deck-renderer.js), Migration (Task 8 Step 3), Testing (Task 8 all steps).
- **Type/signature consistency checked**: `registerBlock(type, {render, exportDocx})` shape is identical across all 10 block registrations in Tasks 2-5; `getBlock` throws consistently; `downloadDocx` is exposed both on `DocRenderer` and as a bare global, matching the deck renderer's `downloadPptx` precedent and `DownloadArtifact.tsx`'s actual lookup contract (unmodified by this plan). `exportDocx`'s `helpers` parameter shape is consistent across every block that uses it.
- **Placeholder scan**: no vague "implement appropriately" steps — every block's render/export code is given in full (Tasks 2-5), matching the fully-detailed style used for the deck redesign's early, pattern-establishing tasks, since this plan has only 10 block types total (vs. 19 layouts) and no task needed the terser "mechanical port" treatment Task 4 of the deck plan used.
