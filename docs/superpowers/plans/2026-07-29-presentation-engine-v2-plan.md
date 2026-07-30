# Presentation Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, data-driven "schema" slide layout (component/element JSON tree, additive to the 19 hand-coded layouts), a reusable PPTX→schema converter run against the real master deck, icon/chart improvements, and a structured in-panel editor with real persistence — so generated decks can draw on the full visual variety of the master deck and be fixed up directly instead of only by regeneration.

**Architecture:** `client/public/libs/deck-schema-renderer.js` is a new sibling file to `deck-renderer.js`, loaded after it, that registers one new layout (`'schema'`) whose `render`/`exportPptx` walk a `{ elements: [...] }` tree instead of being hand-coded per slide. `scripts/pptx-to-schema.js` is an offline Node tool (jszip + regex-based OOXML text/shape extraction, matching the existing EMU-to-inches technique already used in this codebase) that converts a `.pptx` into that schema plus extracted images. The structured editor is a third new file, `client/public/libs/deck-editor.js`, that mutates `window.DECK` in place and re-renders; persistence reuses LibreChat's existing `useUpdateMessageMutation` (already used by `EditMessage.tsx` for saving edited message text) to write the updated artifact JSON back into the message that produced it.

**Tech Stack:** Vanilla JS (deck-renderer.js/deck-schema-renderer.js/deck-editor.js — no build step, loaded via `<script>` in the sandboxed artifact iframe), PptxGenJS 4.0.1 (already vendored), Node + jszip 3.10.1 (already a root dependency, hoisted from `api/package.json`) for the converter script, React/TypeScript + the existing `librechat-data-provider/react-query` hooks for the editor-toggle UI in `DownloadArtifact.tsx`.

## Global Constraints

- Canvas units are **inches** on the existing fixed `SW=10, SH=5.625` canvas (`client/public/libs/deck-renderer.js:16-17`) — the converter must emit element coordinates in inches (EMU / 914400), not pixels, so the new schema layout shares one coordinate system with all 19 existing layouts and PptxGenJS's native inch units. Do not introduce a second (pixel-based) coordinate convention anywhere in this plan.
- The 19 existing hand-coded layouts are never modified in a way that changes their rendered output or `exportPptx` shape counts — this is a purely additive architecture (per the design spec's Migration section). Existing Jest snapshots/assertions for those layouts must stay green.
- Every new renderer/editor file follows the existing IIFE + `window.X = {...}` pattern already used by `deck-renderer.js`/`doc-renderer.js`/`download-bridge.js` — no ES module syntax, no bundler, since these load as plain `<script>` tags with no build step in the artifact iframe.
- Any image path (brand asset or extracted deck asset) goes through an origin-aware helper (`brandImagePath`/`deckAssetPath`), never a bare `/brand/...` or `/deck-assets/...` string, because the live preview renders in a cross-origin Sandpack iframe (`window._BRAND_ORIGIN`, established in `client/src/hooks/Artifacts/useArtifactProps.ts`).
- No stock or AI-generated images anywhere in this plan (confirmed out of scope with the project owner) — image support is limited to real brand assets and real images extracted from a reference deck.
- No free-form drag/resize/rotate editing — the editor is inline-text, layout/variant swap, reorder/duplicate/delete, and image swap only (confirmed scope: "Structured editing").
- TDD throughout: Jest + jsdom for every renderer/editor function (`client/public/libs/__tests__/*.test.js`, same pattern as the existing 64-test `deck-renderer.test.js`), plain Node `assert`-based tests for the converter script (no jsdom needed — it never touches the DOM).
- Commit after each passing step, per this repo's existing commit granularity in `deck-renderer.js`'s history. Per standing project policy carried over from prior work in this session, **do not run `git commit` unless the user explicitly says so for this plan** — if that instruction is still in force when this plan executes, treat every "Commit" step below as "stage the change and record it in the task report" instead, and flag this to the user before the first task starts.

---

## File Structure

| File | Responsibility |
|---|---|
| `client/public/libs/deck-schema-renderer.js` (new) | Element interpreter: walks a component/element JSON tree, renders DOM for preview, emits PptxGenJS calls for export. Registers layout `'schema'` into `window.DeckRenderer`'s existing registry. |
| `client/public/libs/deck-renderer.js` (modify, 2 lines) | Export `brandImagePath` and a new `deckAssetPath` helper on `window.DeckRenderer` so `deck-schema-renderer.js` and `deck-editor.js` can reuse them instead of duplicating origin-patching logic. |
| `client/public/libs/__tests__/deck-schema-renderer.test.js` (new) | Jest+jsdom tests for the interpreter. |
| `scripts/pptx-to-schema.js` (new) | Offline Node CLI: `.pptx` → schema JSON + extracted images. Reusable for any future reference deck, not just the master deck. |
| `scripts/__tests__/pptx-to-schema.test.js` (new) | Node `assert` tests against a small hand-built fixture `.pptx` (built in-memory with jszip, not the real 104-slide master deck). |
| `client/public/brand/master-deck-library.json` (new, generated data) | Output of running the converter once against `brand/Copy of Master Deck 2026.pptx` — the real, faithful slide-variant library the LLM selects `componentId`s from. |
| `client/public/deck-assets/` (new dir, generated data) | Real images extracted from the master deck by the converter (distinct from `client/public/brand/`, which holds hand-picked brand assets, not deck-extracted photos/graphics). |
| `client/public/libs/icons.js` (new) | Bounded, curated inline-SVG icon set + lookup function, consumed by `icon_grid`'s `render`/`exportPptx`. |
| `client/public/libs/deck-renderer.js` (modify, `icon_grid` only) | Wire the existing `icon` field through to the new icon set (currently accepted, never rendered). |
| `client/public/libs/deck-renderer.js` (modify, `chart` only) | Add a `type: 'pie'` branch alongside the existing (implicit) bar rendering. |
| `client/public/libs/deck-editor.js` (new) | Structured editor: contenteditable text commit, layout/variant swap, slide reorder/duplicate/delete, brand-image picker — all mutating `window.DECK` and calling `window.DeckRenderer.renderDeck()` to re-render. |
| `client/public/libs/__tests__/deck-editor.test.js` (new) | Jest+jsdom tests for the editor's DECK-mutation logic. |
| `client/src/components/Artifacts/DownloadArtifact.tsx` (modify) | Add an "Edit" toggle button, a new `artifact-editor-toggle` postMessage, and a save path wired to `useUpdateMessageMutation`. |
| `client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx` (modify) | Tests for the new edit-toggle button and save-message flow. |
| `agents/presentation-creator.skill.md` (modify) | Document the new `layout: "schema"` option, `componentId` values available in `master-deck-library.json`, the icon set, the chart `type` field, and the editor. |

---

## Task 1: Export `brandImagePath` + add `deckAssetPath` on `window.DeckRenderer`

**Files:**
- Modify: `client/public/libs/deck-renderer.js:1393-1405` (the `window.DeckRenderer = {...}` export block)
- Test: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Produces: `window.DeckRenderer.brandImagePath(key: string): string` (already exists internally; now exported), `window.DeckRenderer.deckAssetPath(filename: string): string` (new — same origin-prefixing as `brandImagePath`, but resolves under `/deck-assets/` instead of `/brand/`, and takes a filename with its own extension rather than a key + inferred extension, since deck-extracted assets aren't limited to the PNG/SVG split `PNG_ONLY_BRAND_IMAGES` encodes).

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-renderer.test.js — add near existing brandImagePath tests
describe('DeckRenderer.brandImagePath export', () => {
  it('exposes brandImagePath on the public API', () => {
    expect(typeof window.DeckRenderer.brandImagePath).toBe('function');
    expect(window.DeckRenderer.brandImagePath('logo-dark')).toBe('/brand/logo-dark.svg');
  });
});

describe('DeckRenderer.deckAssetPath', () => {
  afterEach(() => {
    delete window._BRAND_ORIGIN;
  });

  it('resolves a bare relative path with no origin set', () => {
    expect(window.DeckRenderer.deckAssetPath('slide-42-image-1.png')).toBe(
      '/deck-assets/slide-42-image-1.png',
    );
  });

  it('prepends window._BRAND_ORIGIN when present, matching brandImagePath', () => {
    window._BRAND_ORIGIN = 'https://app.example.com';
    expect(window.DeckRenderer.deckAssetPath('slide-42-image-1.png')).toBe(
      'https://app.example.com/deck-assets/slide-42-image-1.png',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/deck-renderer.test.js -t "deckAssetPath"`
Expected: FAIL — `window.DeckRenderer.deckAssetPath is not a function`.

- [ ] **Step 3: Implement**

In `client/public/libs/deck-renderer.js`, add a sibling function right after `brandImagePath` (around line 66):

```javascript
function deckAssetPath(filename) {
  var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
  return origin + '/deck-assets/' + filename;
}
```

Then update the export block (currently `client/public/libs/deck-renderer.js:1393-1404`):

```javascript
window.DeckRenderer = {
  SW: SW,
  SH: SH,
  registerLayout: registerLayout,
  getLayout: getLayout,
  inchesToPercent: inchesToPercent,
  renderDeck: renderDeck,
  downloadPptx: downloadPptx,
  brandImagePath: brandImagePath,
  deckAssetPath: deckAssetPath,
  goTo: goTo,
  next: next,
  prev: prev,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full suite (65 tests: 64 existing + these).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: export brandImagePath and add deckAssetPath on DeckRenderer"
```

---

## Task 2: Schema element interpreter (`deck-schema-renderer.js`)

**Files:**
- Create: `client/public/libs/deck-schema-renderer.js`
- Test: `client/public/libs/__tests__/deck-schema-renderer.test.js`

**Interfaces:**
- Consumes: `window.DeckRenderer.registerLayout(name, def)`, `window.DeckRenderer.brandImagePath(key)`, `window.DeckRenderer.deckAssetPath(filename)`, `window.DeckRenderer.SW`/`SH` (Task 1).
- Produces: registers layout `'schema'` such that a slide spec of the shape
  ```js
  { layout: 'schema', elements: [ /* ElementSpec[] */ ] }
  ```
  renders and exports correctly. `ElementSpec` union (this is the schema every later task, including the converter in Task 3 and the editor in Task 7, must emit/consume — treat these field names as final):
  ```ts
  type ElementSpec =
    | { type: 'text'; x: number; y: number; w: number; h: number; text: string;
        fontSize?: number /* pt, default 14 */; color?: string /* hex, no '#', default 'FFFFFF' */;
        fontWeight?: 'normal' | 'bold' /* default 'normal' */;
        fontFamily?: string /* default 'DM Sans' */; align?: 'left' | 'center' | 'right' /* default 'left' */ }
    | { type: 'image'; x: number; y: number; w: number; h: number;
        brandImage?: string /* key into brandImagePath */; deckAsset?: string /* filename into deckAssetPath */ }
      // exactly one of brandImage/deckAsset must be set — validated, throws otherwise
    | { type: 'shape'; x: number; y: number; w: number; h: number;
        shape: 'rect' | 'roundRect' | 'ellipse' | 'line'; fill?: string /* hex, no '#' */;
        rectRadius?: number /* only for roundRect, inches, default 0.06 */ };
  ```
  Also exposes the two pure functions directly for reuse by the editor (Task 7/8, which needs to re-render after mutating `window.DECK` — it just calls `renderDeck()` again, but the picker UI needs to enumerate/validate element types):
  `window.DeckSchemaRenderer.renderSchemaElements(elements, containerEl)` and
  `window.DeckSchemaRenderer.exportSchemaElements(pptxSlide, elements)`.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-schema-renderer.test.js
require('../deck-renderer.js');
require('../deck-schema-renderer.js');

describe('DeckSchemaRenderer.renderSchemaElements', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders a text element as a positioned, styled span', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 1, y: 0.5, w: 4, h: 1, text: 'Hello', fontSize: 20, color: 'FF6B18', fontWeight: 'bold' }],
      container,
    );
    const el = container.querySelector('.schema-text');
    expect(el.textContent).toBe('Hello');
    expect(el.style.left).toBe((1 / 10) * 100 + '%');
    expect(el.style.fontWeight).toBe('bold');
    expect(el.style.color).toBe('rgb(255, 107, 24)');
  });

  it('renders an image element via brandImagePath', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' }],
      container,
    );
    const img = container.querySelector('.schema-image');
    expect(img.getAttribute('src')).toBe('/brand/logo-dark.svg');
  });

  it('renders an image element via deckAssetPath', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'image', x: 0, y: 0, w: 2, h: 2, deckAsset: 'slide-42-image-1.png' }],
      container,
    );
    const img = container.querySelector('.schema-image');
    expect(img.getAttribute('src')).toBe('/deck-assets/slide-42-image-1.png');
  });

  it('throws if an image element sets neither brandImage nor deckAsset', () => {
    expect(() =>
      window.DeckSchemaRenderer.renderSchemaElements([{ type: 'image', x: 0, y: 0, w: 1, h: 1 }], container),
    ).toThrow(/brandImage.*deckAsset/);
  });

  it('renders a shape element as a positioned div with fill', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'shape', x: 0, y: 0, w: 3, h: 0.5, shape: 'roundRect', fill: '4a4560', rectRadius: 0.1 }],
      container,
    );
    const el = container.querySelector('.schema-shape');
    expect(el.style.background).toBe('rgb(74, 69, 96)');
    expect(el.style.borderRadius).not.toBe('');
  });

  it('throws for an unknown element type', () => {
    expect(() =>
      window.DeckSchemaRenderer.renderSchemaElements([{ type: 'bogus' }], container),
    ).toThrow(/unknown element type/i);
  });
});

describe('DeckSchemaRenderer.exportSchemaElements', () => {
  function fakeSlide() {
    return { addText: jest.fn(), addImage: jest.fn(), addShape: jest.fn() };
  }

  it('calls addText for a text element with fontSize/color/bold mapped', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'text', x: 1, y: 0.5, w: 4, h: 1, text: 'Hello', fontSize: 20, color: 'FF6B18', fontWeight: 'bold' },
    ]);
    expect(slide.addText).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ x: 1, y: 0.5, w: 4, h: 1, fontSize: 20, color: 'FF6B18', bold: true }),
    );
  });

  it('calls addImage with an origin-free path (export never runs in the Sandpack iframe)', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' },
    ]);
    expect(slide.addImage).toHaveBeenCalledWith(expect.objectContaining({ path: '/brand/logo-dark.svg', x: 0, y: 0, w: 2, h: 2 }));
  });

  it('calls addShape for a shape element', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'shape', x: 0, y: 0, w: 3, h: 0.5, shape: 'roundRect', fill: '4a4560', rectRadius: 0.1 },
    ]);
    expect(slide.addShape).toHaveBeenCalledWith(
      'roundRect',
      expect.objectContaining({ x: 0, y: 0, w: 3, h: 0.5, fill: { color: '4a4560' }, rectRadius: 0.1 }),
    );
  });
});

describe("registerLayout('schema') integration", () => {
  it('registers a layout callable through DeckRenderer.getLayout', () => {
    const layout = window.DeckRenderer.getLayout('schema');
    expect(typeof layout.render).toBe('function');
    expect(typeof layout.exportPptx).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/deck-schema-renderer.test.js`
Expected: FAIL — `Cannot find module '../deck-schema-renderer.js'`.

- [ ] **Step 3: Implement**

```javascript
// client/public/libs/deck-schema-renderer.js
//
// Generic component/element interpreter for the 'schema' deck layout.
// Loaded via <script src="/libs/deck-schema-renderer.js"> AFTER deck-renderer.js.
// Renders a { elements: ElementSpec[] } tree two ways from one source, same
// discipline as every hand-coded layout in deck-renderer.js — except here the
// geometry lives in the LLM-authored slide spec itself (or a converter-
// extracted library entry), not in a hand-written per-layout geometry table.
(function () {
  var DR = window.DeckRenderer;
  var SW = DR.SW;
  var SH = DR.SH;

  function hexToCss(hex) {
    var h = (hex || 'FFFFFF').replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  function renderSchemaElements(elements, containerEl) {
    (elements || []).forEach(function (el) {
      if (el.type === 'text') {
        var span = document.createElement('div');
        span.className = 'schema-text';
        span.style.position = 'absolute';
        span.style.left = (el.x / SW) * 100 + '%';
        span.style.top = (el.y / SH) * 100 + '%';
        span.style.width = (el.w / SW) * 100 + '%';
        span.style.height = (el.h / SH) * 100 + '%';
        span.style.fontSize = (el.fontSize || 14) + 'pt';
        span.style.color = hexToCss(el.color || 'FFFFFF');
        span.style.fontWeight = el.fontWeight || 'normal';
        span.style.fontFamily = "'" + (el.fontFamily || 'DM Sans') + "',sans-serif";
        span.style.textAlign = el.align || 'left';
        span.textContent = el.text || '';
        containerEl.appendChild(span);
      } else if (el.type === 'image') {
        if (!el.brandImage && !el.deckAsset) {
          throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
        }
        var img = document.createElement('img');
        img.className = 'schema-image';
        img.style.position = 'absolute';
        img.style.left = (el.x / SW) * 100 + '%';
        img.style.top = (el.y / SH) * 100 + '%';
        img.style.width = (el.w / SW) * 100 + '%';
        img.style.height = (el.h / SH) * 100 + '%';
        img.style.objectFit = 'contain';
        img.src = el.brandImage ? DR.brandImagePath(el.brandImage) : DR.deckAssetPath(el.deckAsset);
        containerEl.appendChild(img);
      } else if (el.type === 'shape') {
        var box = document.createElement('div');
        box.className = 'schema-shape';
        box.style.position = 'absolute';
        box.style.left = (el.x / SW) * 100 + '%';
        box.style.top = (el.y / SH) * 100 + '%';
        box.style.width = (el.w / SW) * 100 + '%';
        box.style.height = (el.h / SH) * 100 + '%';
        box.style.background = hexToCss(el.fill || '4a4560');
        if (el.shape === 'roundRect') {
          box.style.borderRadius = ((el.rectRadius || 0.06) / SW) * 100 + '%';
        } else if (el.shape === 'ellipse') {
          box.style.borderRadius = '50%';
        }
        containerEl.appendChild(box);
      } else {
        throw new Error('DeckSchemaRenderer: unknown element type "' + el.type + '"');
      }
    });
  }

  function exportSchemaElements(pptxSlide, elements) {
    (elements || []).forEach(function (el) {
      if (el.type === 'text') {
        pptxSlide.addText(el.text || '', {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fontSize: el.fontSize || 14,
          color: el.color || 'FFFFFF',
          bold: el.fontWeight === 'bold',
          fontFace: el.fontFamily || 'DM Sans',
          align: el.align || 'left',
        });
      } else if (el.type === 'image') {
        if (!el.brandImage && !el.deckAsset) {
          throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
        }
        // Export always runs in the app's own origin (never the cross-origin
        // Sandpack preview), so a bare relative path resolves correctly here
        // even when window._BRAND_ORIGIN is set for the live preview's benefit.
        var path = el.brandImage
          ? '/brand/' + el.brandImage + (/* mirrors brandImagePath's PNG allowlist */ false ? '.png' : '.svg')
          : '/deck-assets/' + el.deckAsset;
        // Reuse the real helper so the PNG-only allowlist stays single-sourced.
        path = el.brandImage ? DR.brandImagePath(el.brandImage).replace(/^https?:\/\/[^/]+/, '') : '/deck-assets/' + el.deckAsset;
        pptxSlide.addImage({ path: path, x: el.x, y: el.y, w: el.w, h: el.h });
      } else if (el.type === 'shape') {
        pptxSlide.addShape(el.shape, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fill: { color: el.fill || '4a4560' },
          rectRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) : undefined,
        });
      } else {
        throw new Error('DeckSchemaRenderer: unknown element type "' + el.type + '"');
      }
    });
  }

  DR.registerLayout('schema', {
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'position:relative;';
      renderSchemaElements(spec.elements, slideEl);
    },
    exportPptx: function (pptxSlide, spec) {
      exportSchemaElements(pptxSlide, spec.elements);
    },
  });

  window.DeckSchemaRenderer = {
    renderSchemaElements: renderSchemaElements,
    exportSchemaElements: exportSchemaElements,
  };
})();
```

Note on the image-export path: the dead first assignment to `path` is intentionally replaced by the second line — remove the first attempt entirely during implementation (it was left above only to show the reasoning trail; the real file must contain just the working `DR.brandImagePath(...).replace(...)` line, not both). Write it cleanly as:

```javascript
} else if (el.type === 'image') {
  if (!el.brandImage && !el.deckAsset) {
    throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
  }
  var fullPath = el.brandImage ? DR.brandImagePath(el.brandImage) : DR.deckAssetPath(el.deckAsset);
  var path = fullPath.replace(/^https?:\/\/[^/]+/, ''); // export runs same-origin; strip any injected _BRAND_ORIGIN
  pptxSlide.addImage({ path: path, x: el.x, y: el.y, w: el.w, h: el.h });
}
```

Add the new script tag to wherever `agents/presentation-creator.skill.md` documents the artifact's required `<script>` tags (Task 10 handles the prose; for now just note in the implementer's report that Task 10 must add `<script src="/libs/deck-schema-renderer.js">` after the `deck-renderer.js` tag).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/deck-schema-renderer.test.js`
Expected: PASS, all cases above.

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-schema-renderer.js client/public/libs/__tests__/deck-schema-renderer.test.js
git commit -m "feat: add generic schema element interpreter layout"
```

---

## Task 3: PPTX → schema converter tool

**Files:**
- Create: `scripts/pptx-to-schema.js`
- Test: `scripts/__tests__/pptx-to-schema.test.js`

**Interfaces:**
- Consumes: the `ElementSpec` shape from Task 2 (must emit exactly that field set).
- Produces: CLI `node scripts/pptx-to-schema.js <input.pptx> <output.json> [--assets-dir=<dir>]`; also exports `convertPptxToSchema(buffer): Promise<{ slides: Array<{ componentId: string, elements: ElementSpec[] }>, assets: Array<{ filename: string, data: Buffer }> }>` for the test and for Task 6 to call directly instead of shelling out.

- [ ] **Step 1: Write the failing test with an in-memory fixture**

```js
// scripts/__tests__/pptx-to-schema.test.js
const assert = require('assert');
const test = require('node:test');
const JSZip = require('jszip');
const { convertPptxToSchema } = require('../pptx-to-schema.js');

// Minimal single-slide OOXML fixture: one text box + one filled rectangle.
// EMU: 914400 per inch. A 2in x 1in text box at (1in, 0.5in):
const SLIDE_XML = `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="457200"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
          <a:prstGeom prst="rect"/>
          <a:solidFill><a:srgbClr val="4A4560"/></a:solidFill>
        </p:spPr>
        <p:txBody><a:p><a:r><a:t>Hello Slide</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

test('convertPptxToSchema extracts one slide with a text+shape element', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', SLIDE_XML);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  const result = await convertPptxToSchema(buffer);

  assert.strictEqual(result.slides.length, 1);
  const slide = result.slides[0];
  assert.strictEqual(typeof slide.componentId, 'string');
  assert.ok(slide.elements.length >= 1);

  const textEl = slide.elements.find((e) => e.type === 'text');
  assert.ok(textEl, 'expected a text element');
  assert.strictEqual(textEl.text, 'Hello Slide');
  assert.strictEqual(textEl.x, 1); // 914400 EMU / 914400 = 1in
  assert.strictEqual(textEl.y, 0.5);
  assert.strictEqual(textEl.w, 2);
  assert.strictEqual(textEl.h, 1);

  const shapeEl = slide.elements.find((e) => e.type === 'shape');
  assert.ok(shapeEl, 'expected a shape element for the fill');
  assert.strictEqual(shapeEl.fill, '4A4560');
});

test('convertPptxToSchema extracts embedded images into result.assets', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld><p:spTree>
        <p:pic>
          <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr>
          <p:blipFill><a:blip r:embed="rId1"/></p:blipFill>
        </p:pic>
      </p:spTree></p:cSld>
    </p:sld>`);
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="...image" Target="../media/image1.png"/>
    </Relationships>`,
  );
  zip.file('ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  const result = await convertPptxToSchema(buffer);
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].filename, 'slide1-image1.png');
  const imgEl = result.slides[0].elements.find((e) => e.type === 'image');
  assert.ok(imgEl);
  assert.strictEqual(imgEl.deckAsset, 'slide1-image1.png');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/__tests__/pptx-to-schema.test.js`
Expected: FAIL — `Cannot find module '../pptx-to-schema.js'`.

- [ ] **Step 3: Implement**

```javascript
// scripts/pptx-to-schema.js
//
// Reusable PPTX -> schema-JSON converter (Presentation Engine v2, Task 3).
// Not part of the browser bundle -- run offline/on-demand against any
// reference .pptx (the master deck now, a different deck in the future).
// Uses lightweight regex-based OOXML extraction (same EMU-to-inches
// technique already used elsewhere in this codebase) rather than a full
// XML-parser dependency, since the shapes we care about (a:sp text/fill,
// p:pic images, a:xfrm geometry) are a small, well-known, fixed subset of
// the OOXML schema.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;

function emuToInches(emu) {
  return Math.round((Number(emu) / EMU_PER_INCH) * 100) / 100;
}

function extractXfrm(shapeXml) {
  const off = shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return {
    x: emuToInches(off[1]),
    y: emuToInches(off[2]),
    w: emuToInches(ext[1]),
    h: emuToInches(ext[2]),
  };
}

function extractShapes(slideXml, rels, mediaByRelId, slideIndex, assets) {
  const elements = [];
  let idx = 0;

  // p:sp (text box / filled shape)
  const spRe = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(slideXml))) {
    const shapeXml = m[1];
    const rect = extractXfrm(shapeXml);
    if (!rect) continue;

    const fillMatch = shapeXml.match(/<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"\/>/);
    if (fillMatch) {
      elements.push({ type: 'shape', shape: 'rect', fill: fillMatch[1], ...rect });
    }

    const textMatches = [...shapeXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('');
    if (textMatches.trim().length > 0) {
      elements.push({ type: 'text', text: textMatches, ...rect });
    }
    idx++;
  }

  // p:pic (image)
  const picRe = /<p:pic>([\s\S]*?)<\/p:pic>/g;
  let picIdx = 0;
  while ((m = picRe.exec(slideXml))) {
    const picXml = m[1];
    const rect = extractXfrm(picXml);
    const relMatch = picXml.match(/r:embed="(rId\d+)"/);
    if (!rect || !relMatch) continue;
    const relId = relMatch[1];
    const mediaPath = mediaByRelId[relId];
    if (!mediaPath) continue;
    picIdx++;
    const ext = path.extname(mediaPath);
    const filename = 'slide' + slideIndex + '-image' + picIdx + ext;
    assets.push({ filename: filename, mediaPath: mediaPath });
    elements.push({ type: 'image', deckAsset: filename, ...rect });
  }

  return elements;
}

function parseRels(relsXml) {
  const map = {};
  if (!relsXml) return map;
  const re = /<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = re.exec(relsXml))) {
    map[m[1]] = m[2].replace(/^\.\.\//, 'ppt/');
  }
  return map;
}

async function convertPptxToSchema(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slides = [];
  const assetRefs = [];

  for (const slideFile of slideFiles) {
    const slideIndex = Number(slideFile.match(/slide(\d+)\.xml/)[1]);
    const slideXml = await zip.file(slideFile).async('string');
    const relsFile = 'ppt/slides/_rels/slide' + slideIndex + '.xml.rels';
    const relsXml = zip.file(relsFile) ? await zip.file(relsFile).async('string') : null;
    const mediaByRelId = parseRels(relsXml);

    const elements = extractShapes(slideXml, relsXml, mediaByRelId, slideIndex, assetRefs);
    slides.push({ componentId: 'slide-' + slideIndex, elements: elements });
  }

  const assets = [];
  for (const ref of assetRefs) {
    const mediaFile = zip.file(ref.mediaPath);
    if (!mediaFile) continue;
    const data = await mediaFile.async('nodebuffer');
    assets.push({ filename: ref.filename, data: data });
  }

  return { slides: slides, assets: assets };
}

async function main() {
  const [, , inputPath, outputPath, ...rest] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/pptx-to-schema.js <input.pptx> <output.json> [--assets-dir=<dir>]');
    process.exit(1);
  }
  const assetsDirArg = rest.find((a) => a.startsWith('--assets-dir='));
  const assetsDir = assetsDirArg ? assetsDirArg.split('=')[1] : 'client/public/deck-assets';

  const buffer = fs.readFileSync(inputPath);
  const result = await convertPptxToSchema(buffer);

  fs.mkdirSync(assetsDir, { recursive: true });
  for (const asset of result.assets) {
    fs.writeFileSync(path.join(assetsDir, asset.filename), asset.data);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ slides: result.slides }, null, 2));

  console.log(
    'Wrote ' + result.slides.length + ' slide(s) to ' + outputPath +
      ' and ' + result.assets.length + ' asset(s) to ' + assetsDir,
  );
}

module.exports = { convertPptxToSchema: convertPptxToSchema };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/__tests__/pptx-to-schema.test.js`
Expected: PASS, both cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/pptx-to-schema.js scripts/__tests__/pptx-to-schema.test.js
git commit -m "feat: add reusable pptx-to-schema converter tool"
```

---

## Task 4: Curated icon set + wire `icon_grid`'s dead `icon` field

**Files:**
- Create: `client/public/libs/icons.js`
- Modify: `client/public/libs/deck-renderer.js:745-812` (`icon_grid` layout's `render`/`exportPptx`)
- Test: `client/public/libs/__tests__/icons.test.js` (new), extend `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Produces: `window.DeckIcons.getIcon(name: string): { svg: string, viewBox: string } | null` — a small, bounded, curated set (10-12 common presentation icons: `check`, `arrow-right`, `star`, `clock`, `chart`, `target`, `lightbulb`, `shield`, `users`, `globe`, `gear`, `flag`), not an arbitrary external icon-name lookup. `icon_grid` cards may now set `icon: 'check'` and get a real rendered icon instead of the current empty colored square.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/icons.test.js
require('../icons.js');

describe('DeckIcons.getIcon', () => {
  it('returns svg markup for a known icon name', () => {
    const icon = window.DeckIcons.getIcon('check');
    expect(icon).not.toBeNull();
    expect(icon.svg).toContain('<path');
    expect(icon.viewBox).toBe('0 0 24 24');
  });

  it('returns null for an unknown icon name', () => {
    expect(window.DeckIcons.getIcon('not-a-real-icon')).toBeNull();
  });

  it('lists all 12 curated icons', () => {
    expect(window.DeckIcons.ICON_NAMES.length).toBe(12);
  });
});
```

```js
// client/public/libs/__tests__/deck-renderer.test.js — extend icon_grid describe block
it('renders a real icon svg when card.icon matches a known name', () => {
  document.body.innerHTML = '';
  require('../icons.js');
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('icon_grid').render(
    { title: 'T', cards: [{ title: 'A', desc: 'B', icon: 'check' }] },
    slideEl,
  );
  const iconEl = slideEl.querySelector('.ig-icon svg');
  expect(iconEl).not.toBeNull();
});

it('falls back to the plain colored square when card.icon is unset or unknown', () => {
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('icon_grid').render(
    { title: 'T', cards: [{ title: 'A', desc: 'B' }] },
    slideEl,
  );
  expect(slideEl.querySelector('.ig-icon svg')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/icons.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// client/public/libs/icons.js
//
// Bounded, curated inline-SVG icon set for icon_grid. Deliberately NOT an
// arbitrary icon-name lookup against an external service (e.g. a CDN icon
// font) -- every artifact must render standalone, offline, with no network
// dependency beyond this file. All paths are simple, single-color, 24x24
// viewBox strokes so they tint correctly against the orange accent color.
(function () {
  var ICONS = {
    check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" fill="none" stroke-width="2"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" fill="none" stroke-width="2"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" fill="none" stroke-width="2"/>',
    chart: '<path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" fill="none" stroke-width="2"/>',
    target: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" fill="none" stroke-width="2"/>',
    lightbulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" stroke="currentColor" fill="none" stroke-width="2"/>',
    shield: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="currentColor" fill="none" stroke-width="2"/>',
    users: '<circle cx="9" cy="8" r="3" stroke="currentColor" fill="none" stroke-width="2"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 8a3 3 0 1 1 4 2.8M17 14c2.5.3 5 2 5 6" stroke="currentColor" fill="none" stroke-width="2"/>',
    globe: '<circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" stroke="currentColor" fill="none" stroke-width="2"/>',
    gear: '<circle cx="12" cy="12" r="3" stroke="currentColor" fill="none" stroke-width="2"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.3-.9c.6.5 1.3.9 2.1 1.2L10 21h4l.5-2.5a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" stroke="currentColor" fill="none" stroke-width="1.5"/>',
    flag: '<path d="M5 21V4M5 4h13l-3 4 3 4H5" stroke="currentColor" fill="none" stroke-width="2"/>',
  };
  var NAMES = Object.keys(ICONS);

  function getIcon(name) {
    if (!ICONS[name]) return null;
    return { svg: ICONS[name], viewBox: '0 0 24 24' };
  }

  window.DeckIcons = {
    getIcon: getIcon,
    ICON_NAMES: NAMES,
  };
})();
```

Then in `deck-renderer.js`'s `icon_grid.render` (currently `client/public/libs/deck-renderer.js:764-766`, the plain `<div class="ig-icon">` block), replace the icon `<div>` body:

```javascript
var icon = document.createElement('div');
icon.className = 'ig-icon';
icon.style.cssText = 'width:2rem;height:2rem;flex-shrink:0;background:rgba(255,107,24,.12);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#FF6B18;';
var iconDef = (typeof window.DeckIcons !== 'undefined') ? window.DeckIcons.getIcon(card.icon) : null;
if (iconDef) {
  icon.innerHTML = '<svg width="18" height="18" viewBox="' + iconDef.viewBox + '">' + iconDef.svg + '</svg>';
}
```

`icon_grid.exportPptx` needs the equivalent for PPTX — PptxGenJS supports SVG paths poorly across renderers, so the export path draws the icon's bounding shape only when an icon name is set, keeping the same visual weight without a fragile SVG-to-PPTX path conversion:

```javascript
// inside the cards.forEach in exportPptx, after the existing addShape('rect', ...) accent mark:
if (card.icon && window.DeckIcons && window.DeckIcons.getIcon(card.icon)) {
  pptxSlide.addShape('roundRect', {
    x: cx + 0.15, y: cy + 0.15, w: 0.32, h: 0.32, fill: { color: 'FF6B18' }, transparency: 88, rectRadius: 0.05,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/icons.test.js client/public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full combined suite green.

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/icons.js client/public/libs/deck-renderer.js client/public/libs/__tests__/icons.test.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: add curated icon set and wire icon_grid's icon field"
```

---

## Task 5: `chart` layout — add a pie-chart variant

**Files:**
- Modify: `client/public/libs/deck-renderer.js:599-670` (`chart` layout)
- Test: extend `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Produces: `chart` spec gains an optional `type: 'bar' | 'pie'` field (default `'bar'`, preserving all existing behavior/tests unchanged when omitted). When `type === 'pie'`, `spec.bars` (reused field name — still `{ label, value }[]`, capped at 6 per the existing structural cap) renders as a CSS conic-gradient donut in preview and as PptxGenJS `addChart('pie', ...)` in export.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-renderer.test.js — extend chart describe block
it('renders a bar chart by default when type is unset (existing behavior unchanged)', () => {
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('chart').render({ title: 'T', bars: [{ label: 'A', value: 5 }] }, slideEl);
  expect(slideEl.querySelector('.chart-rows')).not.toBeNull();
  expect(slideEl.querySelector('.chart-pie')).toBeNull();
});

it('renders a pie chart when type is "pie"', () => {
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('chart').render(
    { title: 'T', type: 'pie', bars: [{ label: 'A', value: 5 }, { label: 'B', value: 5 }] },
    slideEl,
  );
  expect(slideEl.querySelector('.chart-pie')).not.toBeNull();
  expect(slideEl.querySelector('.chart-rows')).toBeNull();
});

it('exportPptx calls addChart for a pie chart instead of addShape bars', () => {
  const pptxSlide = { addText: jest.fn(), addShape: jest.fn(), addChart: jest.fn() };
  window.DeckRenderer.getLayout('chart').exportPptx(pptxSlide, {
    title: 'T', type: 'pie', bars: [{ label: 'A', value: 5 }, { label: 'B', value: 5 }],
  });
  expect(pptxSlide.addChart).toHaveBeenCalledWith(
    'pie',
    expect.arrayContaining([expect.objectContaining({ name: 'T', labels: ['A', 'B'], values: [5, 5] })]),
    expect.any(Object),
  );
  expect(pptxSlide.addShape).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/deck-renderer.test.js -t "pie"`
Expected: FAIL — no `.chart-pie` element, `addChart` never called.

- [ ] **Step 3: Implement**

In `render` (`client/public/libs/deck-renderer.js:604`), branch at the top on `spec.type === 'pie'` before the existing bar-rendering code, leaving that existing code as the `else` branch untouched:

```javascript
render: function (spec, slideEl) {
  slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
  var h2 = document.createElement('h2');
  h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.5rem;font-family:'DM Sans',sans-serif;";
  h2.textContent = spec.title || '';
  slideEl.appendChild(h2);

  var bars = (spec.bars || []).slice(0, 6);
  if (spec.type === 'pie') {
    var total = bars.reduce(function (sum, b) { return sum + b.value; }, 0) || 1;
    var colors = ['#FF6B18', '#F9A352', '#4a4560', '#8A8A9C', '#35324A', '#C53F27'];
    var acc = 0;
    var stops = bars.map(function (b, i) {
      var start = (acc / total) * 100;
      acc += b.value;
      var end = (acc / total) * 100;
      return colors[i % colors.length] + ' ' + start + '% ' + end + '%';
    }).join(', ');
    var pie = document.createElement('div');
    pie.className = 'chart-pie';
    pie.style.cssText = 'width:10rem;height:10rem;border-radius:50%;background:conic-gradient(' + stops + ');margin:0 auto;';
    var legend = document.createElement('div');
    legend.className = 'chart-pie-legend';
    legend.style.cssText = 'display:flex;flex-direction:column;gap:.4rem;margin-top:1rem;';
    bars.forEach(function (b, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:#fff;';
      row.innerHTML = '<span style="width:.7rem;height:.7rem;border-radius:2px;background:' + colors[i % colors.length] + ';"></span>' + b.label + ' (' + b.value + ')';
      legend.appendChild(row);
    });
    slideEl.appendChild(pie);
    slideEl.appendChild(legend);
    return;
  }

  // existing bar-chart rendering (unchanged) continues here:
  var rows = document.createElement('div');
  // ... rest of existing implementation ...
},
```

In `exportPptx` (`client/public/libs/deck-renderer.js:643`), branch the same way:

```javascript
exportPptx: function (pptxSlide, spec) {
  var g = registry.chart.geometry;
  pptxSlide.addText(spec.title || '', {
    x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
    fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
  });
  var bars = (spec.bars || []).slice(0, 6);

  if (spec.type === 'pie') {
    pptxSlide.addChart(
      'pie',
      [{ name: spec.title || '', labels: bars.map(function (b) { return b.label; }), values: bars.map(function (b) { return b.value; }) }],
      { x: g.bars.x, y: g.bars.y, w: g.bars.w, h: g.bars.h, showLegend: true, legendPos: 'r' },
    );
    return;
  }

  // existing bar-chart export (unchanged) continues here:
  var max = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1]));
  // ... rest of existing implementation ...
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full suite green (existing bar-chart tests + new pie tests).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: add pie chart variant to chart layout"
```

---

## Task 6: Run the converter against the master deck, wire the library into the skill

**Files:**
- Create (generated data): `client/public/brand/master-deck-library.json`, `client/public/deck-assets/*`
- Modify: `agents/presentation-creator.skill.md` (new section documenting `layout: "schema"`, `componentId`, and the extracted library)

**Interfaces:**
- Consumes: `convertPptxToSchema` (Task 3).
- Produces: a real, faithful `master-deck-library.json` the LLM can reference by `componentId` (e.g. `"slide-11"` for the Event Name variant, per `brand/master-deck-layouts.md`'s slide-number index) when it authors a `{ layout: "schema", componentId: "slide-11" }`-style slide — resolved by looking up that `componentId`'s `elements` in the library and merging any per-slide text overrides the LLM supplies (see prose spec below).

- [ ] **Step 1: Run the converter**

```bash
node scripts/pptx-to-schema.js "brand/Copy of Master Deck 2026.pptx" client/public/brand/master-deck-library.json --assets-dir=client/public/deck-assets
```

- [ ] **Step 2: Spot-check the output**

Read `client/public/brand/master-deck-library.json` and confirm: slide count matches the 104 slides documented in `brand/master-deck-layouts.md`; at least one known-content slide (e.g. the slide 96-104 "Thank you!" range) has a `text` element containing "Thank you" text. Confirm `client/public/deck-assets/` contains extracted image files with non-zero size (`ls -la client/public/deck-assets | head`).

If the regex-based extraction in Task 3 misses shapes on some slides (e.g. grouped shapes `<p:grpSp>`, which the Task 3 fixture didn't cover), file it as a known limitation in the report rather than expanding Task 3's scope here — note which slide ranges are affected so `agents/presentation-creator.skill.md` can steer the LLM away from referencing those specific `componentId`s until a follow-up improves the converter.

- [ ] **Step 3: Document usage in the skill file**

Add a new section to `agents/presentation-creator.skill.md` (placement: after the existing layout-registry documentation, before the "Available Files" table), explaining:
- `layout: "schema"` slides reference a real master-deck variant via `componentId` (values are the `componentId`s in `client/public/brand/master-deck-library.json`, named `slide-N` for master-deck slide N — cross-reference `brand/master-deck-layouts.md`'s category table to pick the right N for a given category, e.g. `slide-96`..`slide-104` for thank-you variants, `slide-20`..`slide-25` for section dividers).
- To override text on a referenced component (e.g. put real content into a generic "Thank you" slide), the LLM sets `elements` directly on the slide spec instead of `componentId`, copying the shape from the library entry and only changing `.text` — i.e. `componentId` and `elements` are alternatives, not both required; `componentId`-only slides render the library content verbatim, `elements`-only slides are fully custom schema slides (Task 2's original design), and there is no automatic merge step in the renderer — the LLM (or the editor's variant picker, Task 8) is responsible for copying+editing elements when it wants a real variant with different text.
- Add `<script src="/libs/deck-schema-renderer.js">` and `<script src="/libs/icons.js">` to the required script-tag list, immediately after the existing `<script src="/libs/deck-renderer.js">` line.
- Document the new `chart` `type: "pie"` field (Task 5) and the `icon_grid` `icon` field's now-real effect (Task 4), listing the 12 valid icon names from `window.DeckIcons.ICON_NAMES`.

- [ ] **Step 4: Verify the documented script tags actually work end-to-end**

Using the `run` skill's `examples/playwright.md` pattern (adapted, per this project's established substitute-verification approach): build a minimal HTML file with the 3 script tags in the documented order (`pptxgen.bundle.js`, `deck-renderer.js`, `deck-schema-renderer.js`, `icons.js`) plus a `window.DECK` containing one `componentId`-referenced slide (look up its `elements` from `master-deck-library.json` and inline them for this smoke test) and one hand-authored custom `elements` slide; load it in headless Chromium; confirm both slides render with no console errors; call `downloadPptx()` and confirm a non-empty `.pptx` blob downloads.

- [ ] **Step 5: Commit**

```bash
git add client/public/brand/master-deck-library.json client/public/deck-assets agents/presentation-creator.skill.md
git commit -m "feat: generate master-deck schema library and document schema layout usage"
```

---

## Task 7: Editor core — inline text editing + DECK mutation (`deck-editor.js`)

**Files:**
- Create: `client/public/libs/deck-editor.js`
- Test: `client/public/libs/__tests__/deck-editor.test.js`

**Interfaces:**
- Consumes: `window.DeckRenderer.renderDeck`, `window.DECK` (the in-memory deck spec already established by the prior redesign).
- Produces:
  - `window.DeckEditor.enableEditing(mountEl)` — walks all `.schema-text` nodes (Task 2) and any other layout's text nodes tagged with `data-deck-field` (a new, small annotation this task adds to the hand-coded layouts' text elements — see Step 3) and makes them `contenteditable`, committing on `blur` back into `window.DECK`.
  - `window.DeckEditor.disableEditing(mountEl)` — reverses it.
  - `window.DeckEditor.isEditing(): boolean`.
  - `window.DeckEditor.getDeck(): object` — returns the live-mutated `window.DECK` (used by the save flow in Task 9).

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-editor.test.js
require('../deck-renderer.js');
require('../deck-schema-renderer.js');
require('../deck-editor.js');

describe('DeckEditor.enableEditing', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Original' }] }],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });

  afterEach(() => {
    delete window.DECK;
  });

  it('makes schema text elements contenteditable', () => {
    window.DeckEditor.enableEditing(mount);
    const el = mount.querySelector('.schema-text');
    expect(el.isContentEditable).toBe(true);
  });

  it('commits an edited text node back into window.DECK on blur', () => {
    window.DeckEditor.enableEditing(mount);
    const el = mount.querySelector('.schema-text');
    el.textContent = 'Edited';
    el.dispatchEvent(new Event('blur'));
    expect(window.DECK.slides[0].elements[0].text).toBe('Edited');
  });

  it('disableEditing removes contenteditable and stops committing', () => {
    window.DeckEditor.enableEditing(mount);
    window.DeckEditor.disableEditing(mount);
    const el = mount.querySelector('.schema-text');
    expect(el.isContentEditable).toBe(false);
    el.textContent = 'Should not commit';
    el.dispatchEvent(new Event('blur'));
    expect(window.DECK.slides[0].elements[0].text).toBe('Original');
  });

  it('isEditing reflects current state', () => {
    expect(window.DeckEditor.isEditing()).toBe(false);
    window.DeckEditor.enableEditing(mount);
    expect(window.DeckEditor.isEditing()).toBe(true);
    window.DeckEditor.disableEditing(mount);
    expect(window.DeckEditor.isEditing()).toBe(false);
  });

  it('getDeck returns the live window.DECK reference', () => {
    expect(window.DeckEditor.getDeck()).toBe(window.DECK);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/deck-editor.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Tag each `.schema-text` element (Task 2) with its DECK path so the editor can commit edits back without re-deriving DOM position → slide index mapping. Update `deck-schema-renderer.js`'s text-element branch to accept and set an index, and update `renderSchemaElements` call sites: since `renderSchemaElements` doesn't currently know its own slide index, the simplest correct approach is for `deck-editor.js` itself to attach `data-slide-index`/`data-element-index` when it wires up editing (not at render time) — this keeps Task 2 untouched and keeps this concern inside `deck-editor.js`:

```javascript
// client/public/libs/deck-editor.js
//
// Structured editor for LLM-generated decks: inline text editing, mutating
// window.DECK directly (single-source-of-truth discipline shared with the
// rest of this renderer). Layout/variant swap, reorder/duplicate/delete,
// and the brand-image picker are added in Task 8; this file lays the
// contenteditable + commit-on-blur foundation both build on.
(function () {
  var editing = false;
  var boundHandlers = []; // { el, handler } pairs, so disableEditing can remove exactly what enableEditing added

  function commitHandlerFor(slideIndex, elementIndex, el) {
    return function () {
      var deck = window.DECK;
      if (!deck || !deck.slides || !deck.slides[slideIndex]) return;
      var slide = deck.slides[slideIndex];
      if (slide.elements && slide.elements[elementIndex]) {
        slide.elements[elementIndex].text = el.textContent;
      }
    };
  }

  function enableEditing(mountEl) {
    if (editing) return;
    editing = true;
    var slideEls = mountEl.querySelectorAll('.slide');
    slideEls.forEach(function (slideEl, slideIndex) {
      var textEls = slideEl.querySelectorAll('.schema-text');
      textEls.forEach(function (el, elementIndex) {
        el.setAttribute('contenteditable', 'true');
        el.dataset.slideIndex = String(slideIndex);
        el.dataset.elementIndex = String(elementIndex);
        var handler = commitHandlerFor(slideIndex, elementIndex, el);
        el.addEventListener('blur', handler);
        boundHandlers.push({ el: el, handler: handler });
      });
    });
  }

  function disableEditing(mountEl) {
    boundHandlers.forEach(function (pair) {
      pair.el.removeAttribute('contenteditable');
      pair.el.removeEventListener('blur', pair.handler);
    });
    boundHandlers = [];
    editing = false;
  }

  function isEditing() {
    return editing;
  }

  function getDeck() {
    return window.DECK;
  }

  window.DeckEditor = {
    enableEditing: enableEditing,
    disableEditing: disableEditing,
    isEditing: isEditing,
    getDeck: getDeck,
  };
})();
```

Note: this task deliberately scopes inline editing to `.schema-text` elements only (the new `'schema'` layout from Task 2), not to all 19 hand-coded layouts' bespoke DOM structures — retrofitting `data-deck-field` annotations onto every hand-coded layout's `render()` is a larger, separable follow-up; record this scoping decision in the task report so it's visible to the final review rather than silently narrowing the spec's "click any text on a slide" language.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/deck-editor.test.js`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-editor.js client/public/libs/__tests__/deck-editor.test.js
git commit -m "feat: add inline contenteditable text editing to deck-editor.js"
```

---

## Task 8: Editor — layout/variant picker, reorder/duplicate/delete, brand-image picker

**Files:**
- Modify: `client/public/libs/deck-editor.js` (add to the same `window.DeckEditor` object from Task 7)
- Test: extend `client/public/libs/__tests__/deck-editor.test.js`

**Interfaces:**
- Consumes: `window.DECK.slides` (array mutation), `window.DeckRenderer.renderDeck`.
- Produces:
  - `window.DeckEditor.reorderSlide(fromIndex, toIndex)`
  - `window.DeckEditor.duplicateSlide(index)`
  - `window.DeckEditor.deleteSlide(index)`
  - `window.DeckEditor.setSlideImage(slideIndex, elementIndex, imageRef)` where `imageRef` is `{ brandImage: string }` or `{ deckAsset: string }` (mirrors Task 2's `ElementSpec` union) — throws if the target element isn't `type: 'image'`.
  - All four re-render via `window.DeckRenderer.renderDeck(window.DECK, mountEl)` — so each function takes the `mountEl` as its last argument, matching `renderDeck`'s own signature, rather than assuming a module-level mount reference.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-editor.test.js — extend with a new describe block
describe('DeckEditor slide operations', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 1' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 2' }] },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });
  afterEach(() => { delete window.DECK; });

  it('reorderSlide moves a slide to a new index', () => {
    window.DeckEditor.reorderSlide(0, 1, mount);
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 2');
    expect(window.DECK.slides[1].elements[0].text).toBe('Slide 1');
  });

  it('duplicateSlide inserts a deep copy right after the original', () => {
    window.DeckEditor.duplicateSlide(0, mount);
    expect(window.DECK.slides.length).toBe(3);
    expect(window.DECK.slides[1].elements[0].text).toBe('Slide 1');
    window.DECK.slides[1].elements[0].text = 'Changed copy';
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 1'); // deep copy, not a reference
  });

  it('deleteSlide removes a slide', () => {
    window.DeckEditor.deleteSlide(0, mount);
    expect(window.DECK.slides.length).toBe(1);
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 2');
  });

  it('setSlideImage updates an image element brand reference', () => {
    window.DECK.slides[0].elements.push({ type: 'image', x: 0, y: 0, w: 1, h: 1, brandImage: 'logo-dark' });
    window.DeckEditor.setSlideImage(0, 1, { brandImage: 'logo-light' }, mount);
    expect(window.DECK.slides[0].elements[1].brandImage).toBe('logo-light');
    expect(window.DECK.slides[0].elements[1].deckAsset).toBeUndefined();
  });

  it('setSlideImage throws if the target element is not an image', () => {
    expect(() => window.DeckEditor.setSlideImage(0, 0, { brandImage: 'x' }, mount)).toThrow(/not an image element/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/public/libs/__tests__/deck-editor.test.js -t "slide operations"`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Implement**

Add to the same IIFE in `client/public/libs/deck-editor.js`, before the `window.DeckEditor = {...}` assignment:

```javascript
function reorderSlide(fromIndex, toIndex, mountEl) {
  var slides = window.DECK.slides;
  var moved = slides.splice(fromIndex, 1)[0];
  slides.splice(toIndex, 0, moved);
  window.DeckRenderer.renderDeck(window.DECK, mountEl);
}

function duplicateSlide(index, mountEl) {
  var slides = window.DECK.slides;
  var copy = JSON.parse(JSON.stringify(slides[index]));
  slides.splice(index + 1, 0, copy);
  window.DeckRenderer.renderDeck(window.DECK, mountEl);
}

function deleteSlide(index, mountEl) {
  window.DECK.slides.splice(index, 1);
  window.DeckRenderer.renderDeck(window.DECK, mountEl);
}

function setSlideImage(slideIndex, elementIndex, imageRef, mountEl) {
  var el = window.DECK.slides[slideIndex].elements[elementIndex];
  if (!el || el.type !== 'image') {
    throw new Error('DeckEditor.setSlideImage: target element is not an image element');
  }
  delete el.brandImage;
  delete el.deckAsset;
  if (imageRef.brandImage) el.brandImage = imageRef.brandImage;
  if (imageRef.deckAsset) el.deckAsset = imageRef.deckAsset;
  window.DeckRenderer.renderDeck(window.DECK, mountEl);
}
```

And extend the export object:

```javascript
window.DeckEditor = {
  enableEditing: enableEditing,
  disableEditing: disableEditing,
  isEditing: isEditing,
  getDeck: getDeck,
  reorderSlide: reorderSlide,
  duplicateSlide: duplicateSlide,
  deleteSlide: deleteSlide,
  setSlideImage: setSlideImage,
};
```

Note: this task deliberately does not build the visual thumbnail-strip/picker UI chrome (buttons, drag handles) inside `deck-editor.js` — per the spec, that chrome "lives inside deck-renderer.js" conceptually but is simplest as a thin DOM layer the *editor toggle* in Task 9 renders, since it needs to live in the artifact's iframe alongside the deck but is only shown when editing is active. Task 9 builds that chrome and calls these four functions as its button handlers; this task's job is only the correct, tested mutation logic those buttons will call.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/public/libs/__tests__/deck-editor.test.js`
Expected: PASS, full file green (Task 7 + Task 8 tests).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-editor.js client/public/libs/__tests__/deck-editor.test.js
git commit -m "feat: add slide reorder/duplicate/delete and image-swap to deck-editor.js"
```

---

## Task 9: Editor toggle in the artifact panel + persistence via `useUpdateMessageMutation`

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx`
- Modify: `client/public/libs/download-bridge.js` (small addition — see Step 3)
- Test: extend `client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx`

**Interfaces:**
- Consumes: `useUpdateMessageMutation(conversationId: string)` from `librechat-data-provider/react-query` (`.mutate({ conversationId, model, text, messageId })`, exact usage already proven in `client/src/components/Chat/Messages/Content/EditMessage.tsx:31,98-103`), `detectNativeFormats`/`NATIVE_FORMATS` (existing, `DownloadArtifact.tsx:29-37`), the postMessage bridge pattern (`bridge-ready`/`artifact-download-request`, existing).
- Produces: a new postMessage type `artifact-editor-toggle` (host → iframe, `{ type: 'artifact-editor-toggle', enabled: boolean }`, handled by `download-bridge.js` calling `window.DeckEditor.enableEditing`/`disableEditing` against `document.body`) and `artifact-deck-updated` (iframe → host, `{ type: 'artifact-deck-updated', deck: object }`, fired once per edit commit so the host can enable a "Save" button without polling). An "Edit" toggle button appears in the download-button row only when `detectNativeFormats(content)` includes the PPTX format (i.e. only for decks, not docs/sheets — the editor is presentation-only per the spec's Non-Goals). Clicking "Save" reconstructs the artifact's full source text with the updated `window.DECK` JSON substituted for the original, and calls `updateMessageMutation.mutate(...)` exactly as `EditMessage.tsx` does.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx — new describe block
// (mirrors this file's existing mocking pattern for useGetStartupConfig/useAuthContext/etc.)
jest.mock('librechat-data-provider/react-query', () => ({
  ...jest.requireActual('librechat-data-provider/react-query'),
  useUpdateMessageMutation: jest.fn(),
}));

describe('Presentation editor toggle', () => {
  const mockMutate = jest.fn();
  beforeEach(() => {
    (useUpdateMessageMutation as jest.Mock).mockReturnValue({ mutate: mockMutate });
  });

  it('shows an Edit button only for deck content (PPTX-capable artifacts)', () => {
    const { getByRole, queryByRole } = renderDownloadArtifact({
      content: '<script src="/libs/deck-renderer.js"></script>',
    });
    expect(getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('does not show an Edit button for doc/xlsx-only artifacts', () => {
    const { queryByRole } = renderDownloadArtifact({
      content: '<script src="/libs/doc-renderer.js"></script>',
    });
    expect(queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('posts artifact-editor-toggle to the preview iframe on click', () => {
    const { getByRole } = renderDownloadArtifact({
      content: '<script src="/libs/deck-renderer.js"></script>',
    });
    const postMessage = jest.fn();
    // ... wire postMessage onto the mocked preview iframe's contentWindow, per this file's
    // existing previewRef mocking helper ...
    getByRole('button', { name: /edit/i }).click();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artifact-editor-toggle', enabled: true }),
      '*',
    );
  });

  it('calls updateMessageMutation.mutate with reconstructed text on Save after an artifact-deck-updated message', () => {
    const { getByRole } = renderDownloadArtifact({
      content: ':::artifact{identifier="deck-1"}\n```json\n{"title":"Old"}\n```\n:::',
      messageId: 'msg-1',
      conversationId: 'conv-1',
    });
    getByRole('button', { name: /edit/i }).click();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'artifact-deck-updated', deck: { title: 'New' } } }),
    );
    getByRole('button', { name: /save/i }).click();
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', messageId: 'msg-1', text: expect.stringContaining('"title":"New"') }),
    );
  });
});
```

Adapt the mock/render helper names to whatever `renderDownloadArtifact`-equivalent setup this test file already uses for its other `describe` blocks (read the file's existing tests immediately before writing these to match its established render-helper signature exactly — do not invent a new one).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx -t "editor toggle"`
Expected: FAIL — no Edit button rendered, `useUpdateMessageMutation` never called.

- [ ] **Step 3: Implement**

In `download-bridge.js`, add a handler for the new toggle message (small addition, alongside the existing `artifact-download-request` listener at `client/public/libs/download-bridge.js:72-87`):

```javascript
window.addEventListener('message', function (e) {
  if (!e.data || e.data.type !== 'artifact-editor-toggle') return;
  if (typeof window.DeckEditor === 'undefined') return; // non-deck artifacts don't load deck-editor.js
  if (e.data.enabled) {
    window.DeckEditor.enableEditing(document.body);
  } else {
    window.DeckEditor.disableEditing(document.body);
  }
});
```

And, so edits actually notify the host (needed for the Save button's enabled state and for reading the final deck), extend `deck-editor.js`'s commit handler from Task 7 to also post `artifact-deck-updated` after mutating `window.DECK`:

```javascript
// client/public/libs/deck-editor.js — inside commitHandlerFor's returned function, after the mutation:
if (typeof window.parent !== 'undefined' && window.parent !== window) {
  window.parent.postMessage({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
}
```
(Cover this addition with one more `deck-editor.test.js` case: mock `window.parent.postMessage`, confirm it's called with the mutated deck after a commit.)

In `DownloadArtifact.tsx`, near the existing native-format button row (around where `nativeFormats` from `detectNativeFormats(content)` is mapped into buttons, `DownloadArtifact.tsx:317`):

```tsx
import { useUpdateMessageMutation } from 'librechat-data-provider/react-query';
// ...
const isDeckArtifact = nativeFormats.some((f) => f.ext === 'pptx');
const [isEditing, setIsEditing] = useState(false);
const [pendingDeck, setPendingDeck] = useState<object | null>(null);
const updateMessageMutation = useUpdateMessageMutation(conversationId ?? '');

useEffect(() => {
  const handle = (e: MessageEvent) => {
    if (e.data?.type === 'artifact-deck-updated') {
      setPendingDeck(e.data.deck);
    }
  };
  window.addEventListener('message', handle);
  return () => window.removeEventListener('message', handle);
}, []);

const toggleEditing = () => {
  const next = !isEditing;
  setIsEditing(next);
  const client = previewRef.current?.getClient();
  const iframeWindow = client?.iframe?.contentWindow;
  iframeWindow?.postMessage({ type: 'artifact-editor-toggle', enabled: next }, '*');
};

const saveEditedDeck = () => {
  if (!pendingDeck || !messageId) return;
  const updatedText = content.replace(
    /window\.DECK\s*=\s*\{[\s\S]*?\};/,
    'window.DECK = ' + JSON.stringify(pendingDeck) + ';',
  );
  updateMessageMutation.mutate({
    conversationId: conversationId ?? '',
    model: conversationModel ?? 'gpt-3.5-turbo',
    text: updatedText,
    messageId,
  });
  setPendingDeck(null);
};
```

Note: `content.replace(/window\.DECK\s*=\s*\{[\s\S]*?\};/, ...)` assumes the artifact's `window.DECK = {...};` assignment is a single top-level statement, matching how `agents/presentation-creator.skill.md` already instructs the LLM to emit it (verify this against a real generated artifact's source during Step 4 below — if the assignment style has drifted, e.g. now uses `const DECK = ...` or omits the trailing semicolon, adjust the regex to match the actual current convention rather than the one assumed here, and note the correction in the task report).

Render the buttons conditionally:

```tsx
{isDeckArtifact && (
  <>
    <Button onClick={toggleEditing}>{isEditing ? 'Done Editing' : 'Edit'}</Button>
    {isEditing && pendingDeck && (
      <Button onClick={saveEditedDeck} disabled={updateMessageMutation.isLoading}>
        Save
      </Button>
    )}
  </>
)}
```

(`messageId`, `conversationId`, `conversationModel`, and `content` must already be in scope in this component — confirm their exact prop/variable names by reading the component's current top-level destructuring before wiring this in; they are referenced elsewhere in the file for the existing download/Drive logic.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx`
Expected: PASS, full file green.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx client/public/libs/download-bridge.js client/public/libs/deck-editor.js client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx client/public/libs/__tests__/deck-editor.test.js
git commit -m "feat: add deck editor toggle and save-to-message persistence"
```

---

## Task 10: Final documentation pass + end-to-end verification

**Files:**
- Modify: `agents/presentation-creator.skill.md` (editor-usage note, script tag list finalized)
- No new test files — this task is verification-only, per this project's established adapted-Playwright pattern (no live dev server/DB in this environment).

**Interfaces:** none new — this task wires together and verifies Tasks 1-9.

- [ ] **Step 1: Update the skill file's required script-tag list**

Confirm `agents/presentation-creator.skill.md` lists, in order: `pptxgen.bundle.js`, `download-bridge.js`, `deck-renderer.js`, `deck-schema-renderer.js`, `icons.js`, `deck-editor.js`. Add one paragraph explaining that the structured editor (contenteditable text, layout swap, reorder/duplicate/delete, image picker) is available automatically once `deck-editor.js` is included — no additional LLM-authored code is needed, it's host-triggered via the artifact panel's "Edit" button.

- [ ] **Step 2: Full regression run**

Run: `npx jest client/public/libs client/src/components/Artifacts` and `node --test scripts/__tests__/`
Expected: 100% pass, no regressions in the pre-existing 117+ tests from prior phases plus all new tests from Tasks 1-9.

- [ ] **Step 3: Real end-to-end smoke test**

Build a small standalone HTML fixture with the final script-tag list, a `window.DECK` mixing a `componentId`-referenced master-deck slide (Task 6), a custom `elements` schema slide (Task 2), and one legacy hand-coded-layout slide (e.g. `title`), load it in headless Chromium (adapted `run` skill pattern), and confirm: all three slides render with no console errors; toggling `artifact-editor-toggle` makes schema text elements editable and typing + blur updates `window.DECK`; `downloadPptx()` still produces a valid non-empty `.pptx` for the mixed deck (schema-layout slides included).

- [ ] **Step 4: Commit**

```bash
git add agents/presentation-creator.skill.md
git commit -m "docs: finalize presentation engine v2 script list and editor usage notes"
```

---

## Tasks 11-14: Artifacts panel capability additions (added mid-execution, folded into this plan per user request)

These four tasks were added after Task 6 started, in response to a request to make the artifacts panel "more capable" as a whole (all artifact types, not just decks), plus a specific correctness bug: the user reported that "the initial view is a bit distorted based on how much space the artifact panel covers" — i.e. the preview doesn't account for the artifacts panel's actual (resizable) width/height, so it visually distorts. Task 11 fixes that root bug; Tasks 12-14 are the general panel QOL additions. Scoped to what's tractable without contradicting this plan's existing Global Constraints. **Explicitly deferred, not built here:** a per-format PPTX aspect-ratio option (e.g. 4:3) — the plan's Global Constraints fix the canvas at `SW=10, SH=5.625` (16:9) across all 19 hand-coded layouts plus the new schema layout (Task 2) and the master-deck library (Task 6); supporting a second aspect ratio would mean re-deriving geometry for every layout, which is a separate, much larger project, not a "while we're at it" addition. This limitation is called out explicitly in Task 14 rather than silently dropped.

---

## Task 11: Fix preview distortion — lock deck aspect ratio regardless of artifacts panel size

**Files:**
- Modify: `client/public/libs/deck-renderer.js` (`injectBaseStyles()`, currently `client/public/libs/deck-renderer.js:75-86`)
- Test: extend `client/public/libs/__tests__/deck-renderer.test.js`

**Root cause:** the artifacts panel is a resizable `react-resizable-panels` pane (`client/src/components/SidePanel/SidePanelGroup.tsx`) that can be dragged to any width, and the deck preview renders inside a Sandpack iframe whose viewport exactly matches whatever size that panel currently is. `deck-renderer.js`'s base styles set `.deck{width:100vw;height:100vh}` with `.slide{position:absolute;inset:0}` — this stretches the deck to fill the iframe's full viewport with NO aspect-ratio lock, so whenever the panel isn't exactly 16:9 (its default/common state, since the panel is user-resizable and often narrower or squarer than 16:9), the 16:9-designed slide layouts visually distort/cramp relative to their intended design. Compare with `doc-renderer.js`, which already does this correctly via `.doc-page{aspect-ratio:...;max-width:800px}` (`client/public/libs/doc-renderer.js:39`) — decks need the equivalent treatment.

**Interfaces:** no new public API — this is a pure CSS fix inside the existing `injectBaseStyles()` function. `renderDeck`/`goTo`/`downloadPptx` signatures and behavior are unchanged.

- [ ] **Step 1: Write the failing test**

```js
// client/public/libs/__tests__/deck-renderer.test.js
describe('deck aspect-ratio lock (preview distortion fix)', () => {
  it('sets the .deck element to a fixed 16/9 aspect-ratio that fits within the viewport regardless of container shape', () => {
    document.body.innerHTML = '';
    window.DeckRenderer.renderDeck({ title: 'T', slides: [{ layout: 'title', title: 'X' }] }, document.body);
    const styleEl = document.getElementById('deck-renderer-base-styles');
    expect(styleEl.textContent).toMatch(/\.deck\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    // must use min()-style clamping against both viewport dimensions, not just width or just height
    expect(styleEl.textContent).toMatch(/\.deck\{[^}]*width:\s*min\(/);
    expect(styleEl.textContent).toMatch(/\.deck\{[^}]*height:\s*min\(/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js -t "distortion"`
Expected: FAIL — current `.deck` CSS has no `aspect-ratio` or `min()` clamping.

- [ ] **Step 3: Implement**

In `injectBaseStyles()` (`client/public/libs/deck-renderer.js:75-86`), change the `html,body` and `.deck` rules to center-and-letterbox instead of stretch-fill. Replace:

```javascript
'html,body{width:100%;height:100%;overflow:hidden;background:#1a1728;' +
"font-family:'DM Sans','IBM Plex Sans',-apple-system,sans-serif}" +
'.deck{width:100vw;height:100vh;position:relative;overflow:hidden}' +
```

with:

```javascript
'html,body{width:100%;height:100%;overflow:hidden;background:#1a1728;' +
'display:flex;align-items:center;justify-content:center;' +
"font-family:'DM Sans','IBM Plex Sans',-apple-system,sans-serif}" +
// Locks the deck to its designed 16:9 (SW=10 / SH=5.625) aspect ratio regardless of
// the artifacts panel's actual resizable width/height -- min() picks whichever of
// width-constrained-by-viewport-width or height-constrained-by-viewport-height is
// smaller, so the deck always fits inside the container without stretching/distorting,
// letterboxing (via the flex-centered html/body above) instead.
'.deck{width:min(100vw,177.78vh);height:min(100vh,56.25vw);aspect-ratio:16/9;position:relative;overflow:hidden;flex-shrink:0}' +
```

(`177.78vh` = `100vh * 16/9`; `56.25vw` = `100vw * 9/16` — both are the standard CSS `min()`-based aspect-ratio-locked-fit-inside-viewport technique. Keep every other rule in `injectBaseStyles()`, including `.slide{position:absolute;inset:0;...}`, unchanged — slides continue to fill the now-correctly-shaped `.deck` box exactly as before.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full suite green (this is a pure CSS-string change, so no other existing test should be affected — confirm that's actually true, since some existing tests may assert on the base-styles string content and need their expectations widened rather than broken).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "fix: lock deck preview to 16:9 aspect ratio regardless of artifacts panel size"
```

---

## Task 12: Fullscreen + zoom preview mode

**Files:**
- Modify: `client/src/components/Artifacts/Artifacts.tsx`
- Test: `client/src/components/Artifacts/__tests__/Artifacts.test.tsx` (create if it doesn't already exist — check first)

**Interfaces:**
- Produces: a `isFullscreen` boolean state and a header toggle button (Maximize2/Minimize2 icons from `lucide-react`, already a project dependency — confirm the exact import path matches other icon imports already in this file, e.g. `import { Code, Play, RefreshCw, X, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';`) plus a `zoomLevel` number state (default `1`, clamped `0.5`-`2`, step `0.25`) with ZoomIn/ZoomOut/reset buttons, shown only when `activeTab === 'preview'`.

- [ ] **Step 1: Write the failing tests**

Read the existing `Artifacts.tsx` test setup conventions first (check for an existing test file in `client/src/components/Artifacts/__tests__/` for a sibling component, e.g. `DownloadArtifact.test.tsx`, and match its mocking pattern for `useArtifacts`, `useMediaQuery`, Recoil state, etc. — do not invent a different setup). Then write:

```tsx
it('renders a fullscreen toggle button in the header', () => {
  const { getByRole } = renderArtifacts(); // use this file's established render helper
  expect(getByRole('button', { name: /fullscreen|maximize/i })).toBeInTheDocument();
});

it('applies a fixed inset-0 full-viewport class when fullscreen is toggled on (desktop)', () => {
  const { getByRole, container } = renderArtifacts();
  getByRole('button', { name: /fullscreen|maximize/i }).click();
  expect(container.querySelector('.fixed.inset-0')).not.toBeNull();
});

it('shows zoom controls only on the preview tab', () => {
  const { getByRole, queryByRole } = renderArtifacts({ activeTab: 'code' });
  expect(queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument();
});

it('clamps zoom level between 0.5 and 2 in steps of 0.25', () => {
  const { getByRole } = renderArtifacts({ activeTab: 'preview' });
  const zoomOut = getByRole('button', { name: /zoom out/i });
  for (let i = 0; i < 10; i++) zoomOut.click();
  // whatever internal state exposure this test file's convention uses (e.g. a data-zoom attribute
  // on the preview wrapper) — confirm against how ArtifactTabs/ArtifactPreview expose testable state
  // in existing tests before picking the exact assertion here.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/Artifacts.test.tsx`
Expected: FAIL — no fullscreen/zoom UI exists yet.

- [ ] **Step 3: Implement**

In `Artifacts.tsx`, add state near the existing `isVisible`/`isClosing` state block:

```tsx
const [isFullscreen, setIsFullscreen] = useState(false);
const [zoomLevel, setZoomLevel] = useState(1);

const adjustZoom = (delta: number) => {
  setZoomLevel((prev) => Math.min(2, Math.max(0.5, Math.round((prev + delta) * 100) / 100)));
};
```

Add a toggle button next to the existing close button in the header's button group (around `Artifacts.tsx:322-334`, right before the `DownloadArtifact`/close `Button`):

```tsx
{!isMobile && (
  <Button
    size="icon"
    variant="ghost"
    onClick={() => setIsFullscreen((v) => !v)}
    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
  >
    {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
  </Button>
)}
{activeTab === 'preview' && (
  <>
    <Button size="icon" variant="ghost" onClick={() => adjustZoom(-0.25)} aria-label="Zoom out">
      <ZoomOut size={16} aria-hidden="true" />
    </Button>
    <Button size="icon" variant="ghost" onClick={() => adjustZoom(0.25)} aria-label="Zoom in">
      <ZoomIn size={16} aria-hidden="true" />
    </Button>
  </>
)}
```

For the fullscreen container, reuse the exact same escape-hatch pattern this file already uses for the mobile case (`Artifacts.tsx:147-148`'s `<div className="fixed inset-0 z-[100]">` equivalent, rendered by the parent `SidePanelGroup` — for desktop fullscreen, wrap this component's own root return value): change the outer wrapper's className (currently at `Artifacts.tsx:224-241`) to add `isFullscreen && !isMobile ? 'fixed inset-0 z-[100]' : ''` via the existing `cn(...)` call, alongside the existing mobile/desktop branch — do not replace the mobile logic, only add a fullscreen branch that applies when `!isMobile`.

For zoom, wrap the existing preview content (`Artifacts.tsx:339-346`'s `<div className="absolute inset-0 flex flex-col">...</div>`) with a scaling wrapper active only for the preview tab:

```tsx
<div
  className="absolute inset-0 flex flex-col overflow-auto"
  style={activeTab === 'preview' ? { transform: `scale(${zoomLevel})`, transformOrigin: 'top center' } : undefined}
>
  <ArtifactTabs ... />
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/Artifacts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Artifacts/Artifacts.tsx client/src/components/Artifacts/__tests__/Artifacts.test.tsx
git commit -m "feat: add fullscreen and zoom controls to artifacts panel"
```

---

## Task 13: Version history — side-by-side compare

**Files:**
- Modify: `client/src/components/Artifacts/ArtifactVersion.tsx`
- Modify: `client/src/components/Artifacts/Artifacts.tsx` (render a second, read-only preview pane when compare mode is active)
- Test: extend/create the corresponding test files for both.

**Interfaces:**
- Produces: `ArtifactVersion` gains a "Compare with..." entry per version in its existing `DropdownPopup` (`ArtifactVersion.tsx:38-48`'s `dropdownItems`), which calls a new `onCompareVersion: (index: number) => void` prop (added alongside the existing `onVersionChange` prop) instead of switching the current version. `Artifacts.tsx` holds a new `compareVersionId: string | null` state; when set, it renders a second `ArtifactPreview`-equivalent pane side-by-side with the current one (split 50/50 via a simple flex row), showing the artifact content at that version, read-only (no download/edit controls on the comparison pane). A "Stop comparing" close button (reuse the existing `X` icon pattern) clears `compareVersionId`.

Scope note (deliberately conservative — do not exceed this): this is a side-by-side **rendered preview** comparison (two artifacts shown next to each other so the user can visually spot differences), NOT a text/semantic diff engine. Building real content-level diffing for arbitrary LLM-generated HTML/PPTX-driving-JSON is a substantially larger, separate project and is out of scope here.

- [ ] **Step 1: Write the failing tests**

```tsx
// ArtifactVersion.test.tsx additions — match this file's existing test conventions
it('includes a "Compare with" action for every non-current version', () => {
  const onCompareVersion = jest.fn();
  const { getByText } = renderArtifactVersion({ currentIndex: 0, totalVersions: 3, onCompareVersion });
  // open dropdown per this file's existing pattern, then:
  fireEvent.click(getByText(/compare with version 2/i));
  expect(onCompareVersion).toHaveBeenCalledWith(1);
});
```

```tsx
// Artifacts.test.tsx additions
it('renders a second read-only preview pane when a comparison version is selected', () => {
  const { container } = renderArtifacts({ compareVersionId: 'version-2-id' });
  expect(container.querySelectorAll('[data-testid="artifact-preview-pane"]').length).toBe(2);
});

it('clears the comparison pane when "Stop comparing" is clicked', () => {
  const { getByRole, queryAllByTestId } = renderArtifacts({ compareVersionId: 'version-2-id' });
  getByRole('button', { name: /stop comparing/i }).click();
  expect(queryAllByTestId('artifact-preview-pane').length).toBe(1);
});
```

(Add a `data-testid="artifact-preview-pane"` to whatever wrapper element already hosts a single preview instance today, so both the existing single-pane case and this task's two-pane case are identifiable in tests — confirm the current DOM structure in `ArtifactTabs.tsx`/`ArtifactPreview.tsx` before deciding exactly where this testid belongs.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/ArtifactVersion.test.tsx components/Artifacts/__tests__/Artifacts.test.tsx`
Expected: FAIL — no compare action, no second pane.

- [ ] **Step 3: Implement**

In `ArtifactVersion.tsx`, add the new prop and extend `dropdownItems` (`ArtifactVersion.tsx:9-16` props, `:38-48` items):

```tsx
interface ArtifactVersionProps {
  currentIndex: number;
  totalVersions: number;
  onVersionChange: (index: number) => void;
  onCompareVersion: (index: number) => void;
}
```

Add one more menu entry per version (skip the current index) that calls `onCompareVersion(index)` instead of `handleValueChange`, labeled e.g. `Compare with version ${index + 1}` — keep the existing version-switch entries unchanged, this is additive.

In `Artifacts.tsx`, add `const [compareVersionId, setCompareVersionId] = useState<string | null>(null);`, pass `onCompareVersion={(index) => setCompareVersionId(orderedArtifactIds[index])}` to the existing `<ArtifactVersion .../>` usage (`Artifacts.tsx:311-320`), and in the main content area (`Artifacts.tsx:338-346`), when `compareVersionId` is set, render a flex row with two panes: the existing `ArtifactTabs` (current artifact) on the left, and a second, read-only preview of `artifacts?.[compareVersionId]` on the right (look up the artifact object the same way `useArtifacts`/Recoil already does — check `useArtifacts.ts` for the exact `artifacts` accessor shape before wiring this, since this task needs direct access to a NON-current artifact's content, which the existing hook doesn't currently expose — you may need to read `store.artifactsState` directly via `useRecoilValue` in `Artifacts.tsx` itself, the same store the existing `useArtifacts` hook already reads from).

Add a "Stop comparing" button (reuse the `X` icon) that calls `setCompareVersionId(null)`, visible only when `compareVersionId` is set.

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/ArtifactVersion.test.tsx components/Artifacts/__tests__/Artifacts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Artifacts/ArtifactVersion.tsx client/src/components/Artifacts/Artifacts.tsx client/src/components/Artifacts/__tests__/ArtifactVersion.test.tsx client/src/components/Artifacts/__tests__/Artifacts.test.tsx
git commit -m "feat: add side-by-side version comparison to artifacts panel"
```

---

## Task 14: Export options picker (DOCX page size, XLSX sheet selection)

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx`
- Modify: `agents/doc-creator.skill.md` (`downloadDocx()` gains an optional page-size parameter)
- Modify: `agents/excel-creator.skill.md` (`downloadExcel()` gains an optional sheet-selection parameter)
- Test: extend `client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx`, `client/public/libs/__tests__/doc-renderer.test.js`, and wherever excel-creator's `downloadExcel` has existing test coverage (check first — if none exists yet, per this repo's established pattern for the other renderers, add a small one alongside this change).

**Interfaces:**
- **PPTX**: no new option in this task — the fixed 16:9 canvas is a Global Constraint of this whole plan (see the note at the top of this Tasks 11-13 section); do not add a PPTX aspect-ratio picker here.
- **DOCX**: `downloadDocx(options)` where `options` is optional, `{ pageSize?: 'A4' | 'Letter' }` (default `'A4'`, preserving current behavior exactly when omitted). `'Letter'` uses twips `12240 x 15840` (8.5in x 11in) instead of the current hardcoded `11906 x 16838` (A4). This affects only the exported `.docx`'s page-size section property — the live HTML preview's `@page{size:A4}` CSS (added in a prior phase) is a print-preview convenience and is NOT changed by this task (it stays A4-only for on-screen preview; only the real exported file's page size changes) — call this scoping decision out explicitly in the report if it feels like it should also change the preview, since that's a larger, separate concern (this task is about the export function's parameter, not the live preview's CSS).
- **XLSX**: `downloadExcel(selectedSheetNames)` where `selectedSheetNames` is an optional `string[]` (default: all sheets, preserving current behavior exactly when omitted). When provided, only sheets whose `.name` is in the array get `wb.addWorksheet(...)`'d.
- **UI**: `DownloadArtifact.tsx` gets a small options step before invoking a DOCX or XLSX download: for DOCX, a 2-option radio/select (A4/Letter) in a small popover anchored to the download button; for XLSX, a checkbox list of sheet names (read the sheet names from the artifact's `content` string — same pattern already used by `detectNativeFormats`/`NATIVE_FORMATS` to sniff the artifact's capabilities from its source text, i.e. parse `SHEETS = [...]`'s `name:` fields out of `content` via a regex, since there is no other structured place to read them from before the artifact actually runs). If parsing the sheet names fails or finds none, skip the picker and download all sheets (fail open to current behavior, never block a download).

- [ ] **Step 1: Write the failing tests**

```tsx
// DownloadArtifact.test.tsx additions
it('shows a page-size picker before downloading a DOCX artifact', () => {
  const { getByRole } = renderDownloadArtifact({ content: '<script src="/libs/doc-renderer.js"></script>' });
  getByRole('button', { name: /docx/i }).click();
  expect(getByRole('radio', { name: /a4/i })).toBeInTheDocument();
  expect(getByRole('radio', { name: /letter/i })).toBeInTheDocument();
});

it('shows a sheet-selection checklist before downloading an XLSX artifact with multiple sheets', () => {
  const content = `SHEETS = [{ name: 'Summary', ... }, { name: 'Detail', ... }];`;
  const { getByRole } = renderDownloadArtifact({ content });
  getByRole('button', { name: /xlsx/i }).click();
  expect(getByRole('checkbox', { name: /summary/i })).toBeInTheDocument();
  expect(getByRole('checkbox', { name: /detail/i })).toBeInTheDocument();
});

it('falls back to downloading all sheets when sheet names cannot be parsed from content', () => {
  const { getByRole, queryByRole } = renderDownloadArtifact({ content: '<script src="/libs/exceljs.bare.min.js"></script>' });
  getByRole('button', { name: /xlsx/i }).click();
  expect(queryByRole('checkbox')).not.toBeInTheDocument(); // no picker shown, proceeds straight to download
});
```

```js
// doc-renderer.test.js additions
it('downloadDocx defaults to A4 page size when no options are passed (existing behavior unchanged)', () => {
  // assert the Document sectionProperties page size matches the existing 11906x16838 constants
});

it('downloadDocx uses Letter page size (12240x15840) when options.pageSize is "Letter"', () => {
  // call downloadDocx({ pageSize: 'Letter' }), assert the Letter twip values are used
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx public/libs/__tests__/doc-renderer.test.js`
Expected: FAIL — no picker UI, `downloadDocx`/`downloadExcel` don't accept options yet.

- [ ] **Step 3: Implement**

In `agents/doc-creator.skill.md`'s `downloadDocx()`, change the signature to accept an options object and branch the page-size twip constants:

```javascript
async function downloadDocx(options) {
  var pageSize = (options && options.pageSize === 'Letter')
    ? { width: 12240, height: 15840 }
    : { width: 11906, height: 16838 }; // A4, existing default — unchanged when options is omitted
  // ... existing Document(...) construction, but read page.size from pageSize.width/height
  // instead of the current hardcoded 11906/16838 literals ...
}
```

In `agents/excel-creator.skill.md`'s `downloadExcel()`, accept an optional array and filter `SHEETS` before the existing `SHEETS.forEach(sh => { ws.addWorksheet(...) })` loop:

```javascript
async function downloadExcel(selectedSheetNames) {
  var sheetsToExport = (Array.isArray(selectedSheetNames) && selectedSheetNames.length > 0)
    ? SHEETS.filter(function (sh) { return selectedSheetNames.indexOf(sh.name) !== -1; })
    : SHEETS; // default: all sheets, existing behavior unchanged when omitted
  // ... existing export loop, but iterate sheetsToExport instead of SHEETS ...
}
```

In `DownloadArtifact.tsx`, before dispatching the existing `downloadPptx`/`downloadDocx`/`downloadExcel` trigger (wherever the per-format button's `onClick` currently calls `triggerViaPreviewIframe`/`runInHiddenIframe` directly — read the current click-handler wiring first since this task inserts a step before it, not after), add: for DOCX, a small popover with an A4/Letter radio group that, on confirm, calls the existing download-trigger path but passes `{ pageSize }` as an argument through the existing postMessage protocol (extend the `artifact-download-request` message to include an optional `args` field: `{ type: 'artifact-download-request', fn: 'downloadDocx', args: [{ pageSize }] }`, and update `download-bridge.js`'s handler at `client/public/libs/download-bridge.js:72-87` to call `window[fn].apply(null, e.data.args || [])` instead of `window[fn]()`, preserving today's zero-arg behavior for every other trigger function that doesn't pass `args`). For XLSX, parse sheet names out of `content` via `content.match(/name:\s*['"]([^'"]+)['"]/g)` (or a more targeted regex against the `SHEETS = [...]` block specifically — verify against a real generated excel-creator artifact's actual source text before finalizing this regex, since it must match real LLM-generated output, not just an idealized example), render a checkbox list, and pass the selected array the same way through `args`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx public/libs/__tests__/doc-renderer.test.js public/libs/__tests__/download-bridge.test.js`
Expected: PASS, including a regression check that every existing zero-arg download trigger (PPTX, and DOCX/XLSX with no options selected) still works exactly as before — `download-bridge.js`'s `.apply(null, e.data.args || [])` change must be verified not to break the current no-args call path.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx client/public/libs/download-bridge.js agents/doc-creator.skill.md agents/excel-creator.skill.md client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx client/public/libs/__tests__/doc-renderer.test.js client/public/libs/__tests__/download-bridge.test.js
git commit -m "feat: add DOCX page-size and XLSX sheet-selection export options"
```

---

## Task 15: Embed real fonts in exported PPTX (fixes font-substitution/reflow bug)

**Background — why this task exists:** a previously-reported bug (from before this plan) was that opening an exported `.pptx` on another machine substitutes a fallback font for DM Sans/IBM Plex Sans (since PptxGenJS 4.0.1, confirmed via `node_modules/pptxgenjs/types/index.d.ts`, has no font-embedding API — `fontFace: 'DM Sans'` only labels the intended font, it never embeds it), which in turn causes text to reflow inside its fixed-size box and can look like content "shifted." Researched what Presenton (the reference project) actually does here: confirmed via its public GitHub source (`servers/fastapi/services/export_task_service.py`) that Presenton *also* uses PptxGenJS under the hood for PPTX generation — it does not have some superior proprietary export engine, so there is nothing to "port" from its code for this specific problem. The real, standards-compliant fix is OOXML's own font-embedding mechanism (`<p:embeddedFontLst>` + `ppt/fonts/*.fntdata` parts + `embedTrueTypeFonts="1"` on `<p:presentation>`), applied as a post-processing step on the blob PptxGenJS already produces. This is grounded in a **real, verified example**: `brand/Copy of Master Deck 2026.pptx` already has DM Sans and IBM Plex Sans embedded exactly this way (PowerPoint wrote it when the deck was originally saved) — the exact XML shapes and relationship-ID wiring below were extracted and confirmed directly from that real file, not written from memory or guesswork.

**Files:**
- Create: `client/public/brand/fonts/DMSans-regular.fntdata`, `DMSans-bold.fntdata`, `DMSans-italic.fntdata`, `DMSans-boldItalic.fntdata`, `IBMPlexSans-regular.fntdata`, `IBMPlexSans-bold.fntdata`, `IBMPlexSans-italic.fntdata`, `IBMPlexSans-boldItalic.fntdata` (8 files, extracted once from the master deck — see Step 1)
- Modify: `scripts/copy-libs.mjs` (vendor `jszip.min.js` to `client/public/libs/`, same pattern already used for pptxgenjs/xlsx/docx)
- Modify: `client/public/libs/deck-renderer.js` (`downloadPptx()`, currently `client/public/libs/deck-renderer.js:1372-1391`)
- Test: extend `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Produces: a new `embedFontsInPptx(blob)` async function in `deck-renderer.js` that takes the `Blob` `pptx.write({ outputType: 'blob' })` already produces, returns a new `Blob` with the 2 font families (DM Sans, IBM Plex Sans) embedded via real OOXML font parts. `downloadPptx()` calls it once, right after `pptx.write(...)`, before creating the object URL — no other behavior in `downloadPptx()` changes.

- [ ] **Step 1: Extract the 8 real font files from the master deck (one-time, not part of the browser bundle)**

```bash
export PATH="/opt/homebrew/bin:$PATH"
node -e "
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const NAMES = {
  'DMSans-regular.fntdata': 'DMSans-regular.fntdata',
  'DMSans-bold.fntdata': 'DMSans-bold.fntdata',
  'DMSans-italic.fntdata': 'DMSans-italic.fntdata',
  'DMSans-boldItalic.fntdata': 'DMSans-boldItalic.fntdata',
  'IBMPlexSans-regular.fntdata': 'IBMPlexSans-regular.fntdata',
  'IBMPlexSans-bold.fntdata': 'IBMPlexSans-bold.fntdata',
  'IBMPlexSans-italic.fntdata': 'IBMPlexSans-italic.fntdata',
  'IBMPlexSans-boldItalic.fntdata': 'IBMPlexSans-boldItalic.fntdata',
};
(async () => {
  const buf = fs.readFileSync('brand/Copy of Master Deck 2026.pptx');
  const zip = await JSZip.loadAsync(buf);
  fs.mkdirSync('client/public/brand/fonts', { recursive: true });
  for (const name of Object.keys(NAMES)) {
    const entry = zip.file('ppt/fonts/' + name);
    if (!entry) { console.error('MISSING', name); continue; }
    const data = await entry.async('nodebuffer');
    fs.writeFileSync(path.join('client/public/brand/fonts', name), data);
    console.log('wrote', name, data.length, 'bytes');
  }
})();
"
```

Confirm all 8 files were written with non-trivial sizes (tens of KB each, matching real font binaries — e.g. `DMSans-regular.fntdata` should be ~23KB, `IBMPlexSans-regular.fntdata` should be ~87KB, per the sizes already confirmed present in the source deck).

- [ ] **Step 2: Vendor jszip.min.js for browser use**

In `scripts/copy-libs.mjs`, add an entry to the existing `LIBS` array (matching its current pattern for pptxgenjs/xlsx/docx — read the array's existing entries first to match the exact object shape used) that copies `node_modules/jszip/dist/jszip.min.js` to `client/public/libs/jszip.min.js`. Run `export PATH="/opt/homebrew/bin:$PATH" && node scripts/copy-libs.mjs` and confirm `client/public/libs/jszip.min.js` now exists.

- [ ] **Step 3: Write the failing test**

```js
// client/public/libs/__tests__/deck-renderer.test.js
describe('embedFontsInPptx', () => {
  it('adds a fntdata content-type declaration, font relationship entries, and an embeddedFontLst to the pptx zip', async () => {
    // Build a minimal fake "pptx" zip via JSZip matching the real shape closely enough to assert against,
    // OR (preferred, since this project already establishes real-file-based verification): load the actual
    // pptx.write({outputType:'blob'}) output from a tiny real DeckRenderer.downloadPptx() run, pass it through
    // embedFontsInPptx, then re-open the RESULT with JSZip and assert:
    const JSZip = require('jszip');
    // ... construct or obtain `resultBlob` from window.DeckRenderer.embedFontsInPptx(someBlob) ...
    const resultZip = await JSZip.loadAsync(resultBlob);
    expect(resultZip.file('ppt/fonts/DMSans-regular.fntdata')).not.toBeNull();
    expect(resultZip.file('ppt/fonts/IBMPlexSans-regular.fntdata')).not.toBeNull();
    const contentTypes = await resultZip.file('[Content_Types].xml').async('string');
    expect(contentTypes).toContain('Extension="fntdata"');
    const rels = await resultZip.file('ppt/_rels/presentation.xml.rels').async('string');
    expect(rels).toContain('fonts/DMSans-regular.fntdata');
    const presentationXml = await resultZip.file('ppt/presentation.xml').async('string');
    expect(presentationXml).toContain('embedTrueTypeFonts="1"');
    expect(presentationXml).toContain('<p:embeddedFontLst>');
    expect(presentationXml).toContain('typeface="DM Sans"');
    expect(presentationXml).toContain('typeface="IBM Plex Sans"');
  });
});
```

(jsdom/JSZip interaction was confirmed flaky for full end-to-end blob generation in Task 6's environment — if this test hits the same limitation, fall back to constructing a minimal synthetic zip via JSZip directly in the test, matching real PptxGenJS output's file structure closely enough — `[Content_Types].xml`, `ppt/presentation.xml`, `ppt/_rels/presentation.xml.rels` — rather than requiring a full real `pptx.write()` round-trip inside the test. Note this substitution in the implementer's report if taken.)

- [ ] **Step 4: Run the test to verify it fails**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js -t "embedFontsInPptx"`
Expected: FAIL — function doesn't exist yet.

- [ ] **Step 5: Implement**

Add to `deck-renderer.js` (requires the `JSZip` global from the newly-vendored `client/public/libs/jszip.min.js` script tag — add that script tag to the required script-tag list documented in `agents/presentation-creator.skill.md`, alongside `deck-schema-renderer.js`/`icons.js` from Task 10, loaded before `deck-renderer.js` since `downloadPptx()` needs `window.JSZip` at call time):

```javascript
var EMBEDDED_FONTS = [
  { typeface: 'DM Sans', regular: 'DMSans-regular.fntdata', bold: 'DMSans-bold.fntdata', italic: 'DMSans-italic.fntdata', boldItalic: 'DMSans-boldItalic.fntdata' },
  { typeface: 'IBM Plex Sans', regular: 'IBMPlexSans-regular.fntdata', bold: 'IBMPlexSans-bold.fntdata', italic: 'IBMPlexSans-italic.fntdata', boldItalic: 'IBMPlexSans-boldItalic.fntdata' },
];

async function embedFontsInPptx(blob) {
  var zip = await window.JSZip.loadAsync(blob);

  // 1. Fetch and add each font binary under ppt/fonts/ -- origin-aware, same reasoning as
  // brandImagePath: this runs in the artifact's own context, which may be the cross-origin
  // Sandpack preview iframe when downloadPptx() is invoked from the live preview.
  var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
  var relEntries = [];
  var embeddedFontXml = '';
  var nextRid = 200; // starts well above any rId PptxGenJS itself assigns, to avoid collisions
  for (var i = 0; i < EMBEDDED_FONTS.length; i++) {
    var font = EMBEDDED_FONTS[i];
    var ids = {};
    var variants = ['regular', 'bold', 'italic', 'boldItalic'];
    for (var v = 0; v < variants.length; v++) {
      var key = variants[v];
      var filename = font[key];
      var resp = await fetch(origin + '/brand/fonts/' + filename);
      var buf = await resp.arrayBuffer();
      zip.file('ppt/fonts/' + filename, buf);
      var rid = 'rId' + nextRid++;
      ids[key] = rid;
      relEntries.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/' + filename + '"/>');
    }
    embeddedFontXml += '<p:embeddedFont><p:font typeface="' + font.typeface + '"/>' +
      '<p:regular r:id="' + ids.regular + '"/><p:bold r:id="' + ids.bold + '"/>' +
      '<p:italic r:id="' + ids.italic + '"/><p:boldItalic r:id="' + ids.boldItalic + '"/></p:embeddedFont>';
  }

  // 2. [Content_Types].xml -- add the fntdata Default entry once, before </Types>.
  var contentTypes = await zip.file('[Content_Types].xml').async('string');
  if (contentTypes.indexOf('Extension="fntdata"') === -1) {
    contentTypes = contentTypes.replace('</Types>', '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>');
  }
  zip.file('[Content_Types].xml', contentTypes);

  // 3. ppt/_rels/presentation.xml.rels -- append the new font relationships before </Relationships>.
  var rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  rels = rels.replace('</Relationships>', relEntries.join('') + '</Relationships>');
  zip.file('ppt/_rels/presentation.xml.rels', rels);

  // 4. ppt/presentation.xml -- set embedTrueTypeFonts/saveSubsetFonts on <p:presentation>,
  // and insert <p:embeddedFontLst> right after </p:notesSz> (confirmed exact element order --
  // sldSz, notesSz, embeddedFontLst, defaultTextStyle -- against a real PowerPoint-saved file).
  var presentationXml = await zip.file('ppt/presentation.xml').async('string');
  if (presentationXml.indexOf('embedTrueTypeFonts') === -1) {
    presentationXml = presentationXml.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" saveSubsetFonts="1" ');
  }
  presentationXml = presentationXml.replace('</p:notesSz>', '</p:notesSz><p:embeddedFontLst>' + embeddedFontXml + '</p:embeddedFontLst>');
  zip.file('ppt/presentation.xml', presentationXml);

  return zip.generateAsync({ type: 'blob' });
}
```

Update `downloadPptx()` (`client/public/libs/deck-renderer.js:1382`, the line `var blob = await pptx.write({ outputType: 'blob' });`) to:

```javascript
var blob = await pptx.write({ outputType: 'blob' });
blob = await embedFontsInPptx(blob);
```

Export `embedFontsInPptx` on `window.DeckRenderer` for testability, alongside the other exports from Task 1.

- [ ] **Step 6: Run the test to verify it passes**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full suite green — confirm no regression to any of the 19 existing layouts' `downloadPptx()` behavior (font embedding is additive to the zip, it must not change any slide content/shape/text that was already being written correctly).

- [ ] **Step 7: Commit**

```bash
git add client/public/brand/fonts scripts/copy-libs.mjs client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js client/public/libs/jszip.min.js agents/presentation-creator.skill.md
git commit -m "feat: embed real DM Sans and IBM Plex Sans fonts in exported PPTX files"
```

---

## Task 16: Auto-fit text when a schema layout is reused with different content

**Background:** when the LLM reuses a `componentId` from `master-deck-library.json` (Task 6) for a new topic — the whole point of that library being reusable across any future presentation, not just the master deck's own content — the substituted text is a different length than the original. Schema text elements (Task 2) have fixed `x/y/w/h`, so longer replacement text can overflow its box, and shorter text can look sparse. Researched how Presenton handles this (its `slide-editor` frontend, `servers/nextjs/components/slide-editor/layout/flowLayout.ts`): it does NOT shrink font size to fit a fixed box — it resizes the *container* to match the text's estimated natural size via a flex/flow layout engine. Adopting that fully would mean replacing this plan's fixed-absolute-position `ElementSpec` model (Task 2) with a full flow-layout engine, a much larger architecture change than warranted here. Instead, this task uses the narrower, well-established "shrink text on overflow" technique — which PptxGenJS 4.0.1 already supports natively for the export path (confirmed via `node_modules/pptxgenjs/types/index.d.ts:1816`: `fit?: 'none' | 'shrink' | 'resize'` on `addText` options, which PowerPoint itself computes the font-scale for), paired with a real DOM-overflow-based shrink loop for the preview path (accurate, not a heuristic character-width estimate like Presenton's own `text-line-height.ts` uses).

**Files:**
- Modify: `client/public/libs/deck-schema-renderer.js` (`renderSchemaElements`'s text branch, `exportSchemaElements`'s text branch)
- Test: extend `client/public/libs/__tests__/deck-schema-renderer.test.js`

**Interfaces:**
- `ElementSpec`'s `text` type gains one new optional field: `minFontSize?: number` (pt, default `8`) — the floor below which auto-fit stops shrinking. No other field changes; every other existing field/default from Task 2 is unchanged.
- Preview: after appending a `.schema-text` element to the DOM with its full `fontSize`, check for real overflow (`el.scrollHeight > el.clientHeight` — a real, browser-computed measurement, not a character-count estimate) and, if overflowing, reduce `fontSize` in a loop (e.g. 1pt steps) until it fits or `minFontSize` is reached, whichever comes first.
- Export: `exportSchemaElements`'s text branch passes `fit: 'shrink'` in the `addText` options object, alongside the existing `fontSize`/`color`/`bold`/`fontFace`/`align` fields — PowerPoint computes the actual shrink factor when the file is opened/edited, this task does not need to replicate that calculation.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-schema-renderer.test.js — extend existing describe blocks
describe('DeckSchemaRenderer text auto-fit', () => {
  it('shrinks fontSize when rendered text overflows its fixed box (real DOM overflow, not estimated)', () => {
    const container = document.createElement('div');
    // jsdom doesn't compute real scrollHeight from font metrics, so this test mocks the
    // element's scrollHeight/clientHeight getters to simulate overflow, then asserts the
    // shrink loop actually ran and reduced fontSize below the original.
    const originalCreateElement = document.createElement.bind(document);
    let capturedEl;
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'div' && !capturedEl) {
        capturedEl = el;
        Object.defineProperty(el, 'scrollHeight', { get: () => 200, configurable: true });
        Object.defineProperty(el, 'clientHeight', { get: () => 50, configurable: true });
      }
      return el;
    });
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Very long text that will not fit', fontSize: 20 }],
      container,
    );
    document.createElement.mockRestore();
    const el = container.querySelector('.schema-text');
    expect(parseFloat(el.style.fontSize)).toBeLessThan(20);
  });

  it('never shrinks below minFontSize (default 8pt)', () => {
    // same overflow-mocking technique as above, extreme overflow, confirm floor at 8
  });

  it('does not shrink text that already fits (no overflow)', () => {
    const container = document.createElement('div');
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 5, h: 5, text: 'Short', fontSize: 14 }],
      container,
    );
    const el = container.querySelector('.schema-text');
    expect(el.style.fontSize).toBe('14pt'); // unchanged when there's no overflow
  });
});

describe('DeckSchemaRenderer export auto-fit', () => {
  it('passes fit:"shrink" for every text element', () => {
    const slide = { addText: jest.fn(), addImage: jest.fn(), addShape: jest.fn() };
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Hello' },
    ]);
    expect(slide.addText).toHaveBeenCalledWith('Hello', expect.objectContaining({ fit: 'shrink' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js -t "auto-fit"`
Expected: FAIL — no shrink loop exists yet, `fit: 'shrink'` not passed.

- [ ] **Step 3: Implement**

In `renderSchemaElements`'s text branch (`client/public/libs/deck-schema-renderer.js`, added in Task 2), after `containerEl.appendChild(span)`:

```javascript
var minFontSize = el.minFontSize || 8;
var currentSize = el.fontSize || 14;
while (span.scrollHeight > span.clientHeight && currentSize > minFontSize) {
  currentSize -= 1;
  span.style.fontSize = currentSize + 'pt';
}
```

(Place this immediately after the text element's `containerEl.appendChild(span)` call in the existing `if (el.type === 'text')` branch — the element must already be attached to the DOM for `scrollHeight`/`clientHeight` to be real, non-zero values.)

In `exportSchemaElements`'s text branch, add `fit: 'shrink'` to the existing `pptxSlide.addText(el.text || '', { ... })` options object (alongside the existing `x/y/w/h/fontSize/color/bold/fontFace/align` fields from Task 2 — do not remove or change any of those).

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js`
Expected: PASS, full file green (Task 2's original tests + these new ones).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-schema-renderer.js client/public/libs/__tests__/deck-schema-renderer.test.js
git commit -m "feat: auto-fit schema text when a reused layout's content overflows its box"
```

---

## Task 17: Editor UI chrome — slide control bar, image-swap, and variant/componentId-swap picker (added after the first final review, per user request)

**Background:** Tasks 7-9 built real, tested editor capabilities — inline text edit (Task 7), `reorderSlide`/`duplicateSlide`/`deleteSlide`/`setSlideImage` (Task 8) — but Task 9 only ever wired up the Edit/Save toggle and inline text editing into actual clickable UI. `reorderSlide`/`duplicateSlide`/`deleteSlide`/`setSlideImage` have been callable-but-buttonless this entire time — reachable only via the JS console, never by clicking anything in the panel. Separately, the user asked for a genuine gap to be closed: no capability exists to swap which real master-deck variant (`componentId`) a slide uses — the editor can edit an existing slide's text/images, but can't change which of e.g. the 5 real title-slide designs or 4 real closing-slide designs is in use. This task closes both gaps in one pass: it adds real UI chrome for all five editor capabilities (reorder, duplicate, delete, image-swap, variant-swap), living inside the deck's own DOM (injected by `deck-editor.js` itself when editing is enabled), not as new host-side React UI — this keeps the same architecture Task 7 already established (editing chrome lives where editing happens, calling `window.DeckEditor`'s functions directly and synchronously, no new postMessage round-trip needed per click).

**Files:**
- Modify: `client/public/libs/deck-schema-renderer.js` (tag `.schema-image` elements with `data-el-index`, mirroring the existing `.schema-text` tagging — currently only text elements carry this attribute, per `deck-schema-renderer.js:32`)
- Modify: `client/public/libs/deck-editor.js` (add `setSlideComponent`, add UI-chrome injection to `enableEditing`/`disableEditing`)
- Test: extend `client/public/libs/__tests__/deck-schema-renderer.test.js`, `client/public/libs/__tests__/deck-editor.test.js`

**Interfaces:**
- `window.DeckEditor.setSlideComponent(slideIndex, componentId, mountEl): Promise<void>` — fetches `master-deck-library.json` (origin-aware, cached after first fetch — same pattern as `brandImagePath`/`deckAssetPath`: `origin + '/brand/master-deck-library.json'`), finds the entry whose `componentId` matches, deep-copies its `elements` into `window.DECK.slides[slideIndex].elements`, sets `slide.layout = 'schema'` and `slide.componentId = componentId`, then calls `renderDeck`. Throws (rejects) with a clear error if the componentId isn't found in the fetched library.
- `enableEditing(mountEl)` (extends Task 7's existing function) additionally injects, per rendered `.slide` element: a small control bar (↑/↓ reorder buttons, Duplicate, Delete, and a "Change layout…" `<select>` populated from a curated variant list — see below) and, per `.schema-image` element, a "Swap image" button. `disableEditing()` additionally removes all injected chrome (tag every injected element with a shared class, e.g. `deck-editor-chrome`, so `disableEditing` can `querySelectorAll('.deck-editor-chrome').forEach(el => el.remove())` alongside its existing contenteditable-reversal logic).
- Curated variant list (do NOT expose all 104 master-deck slides — many are known-broken per Task 6/10's documented limitations, or are divider/tip slides with no real content). Reuse the corrected ranges from `agents/presentation-creator.skill.md`'s componentId preference table (Title, Agenda, Section, Closing) — **verify these exact ranges against the file's current content yourself before hardcoding them** (the ranges were corrected once already during this plan's final review; do not silently re-introduce a stale range).

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-schema-renderer.test.js — extend the image element test
it('tags image elements with data-el-index, mirroring text elements', () => {
  const container = document.createElement('div');
  window.DeckSchemaRenderer.renderSchemaElements(
    [
      { type: 'shape', x: 0, y: 0, w: 1, h: 1, shape: 'rect' },
      { type: 'image', x: 0, y: 0, w: 1, h: 1, brandImage: 'logo-dark' },
    ],
    container,
  );
  const img = container.querySelector('.schema-image');
  expect(img.dataset.elIndex).toBe('1'); // true array index, not loop-among-images index
});
```

```js
// client/public/libs/__tests__/deck-editor.test.js — new describe block
describe('DeckEditor.setSlideComponent', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Old' }] }] };
    window.DeckRenderer.renderDeck(window.DECK, mount);
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ slides: [{ componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] }] }),
    });
  });
  afterEach(() => { delete window.DECK; delete global.fetch; });

  it('replaces the slide elements with the fetched componentId entry and re-renders', async () => {
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    expect(window.DECK.slides[0].elements[0].text).toBe('Thank you!');
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
    expect(window.DECK.slides[0].layout).toBe('schema');
  });

  it('rejects with a clear error for an unknown componentId', async () => {
    await expect(window.DeckEditor.setSlideComponent(0, 'slide-9999', mount)).rejects.toThrow(/unknown componentId/);
  });

  it('caches the fetched library across calls (fetch only called once)', async () => {
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('DeckEditor UI chrome', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 1' }, { type: 'image', x: 0, y: 0, w: 1, h: 1, brandImage: 'logo-dark' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 2' }] },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });
  afterEach(() => { delete window.DECK; });

  it('injects a control bar with reorder/duplicate/delete buttons per slide when editing is enabled', () => {
    window.DeckEditor.enableEditing(mount);
    const bars = mount.querySelectorAll('.deck-editor-slide-bar');
    expect(bars.length).toBe(2);
  });

  it('injects an image-swap button for every schema-image element', () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-image-swap').length).toBe(1);
  });

  it('injects a variant-swap select populated with curated componentId options', () => {
    window.DeckEditor.enableEditing(mount);
    const select = mount.querySelector('.deck-editor-slide-bar select');
    expect(select).not.toBeNull();
    expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
  });

  it('removes all injected chrome on disableEditing', () => {
    window.DeckEditor.enableEditing(mount);
    window.DeckEditor.disableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-chrome').length).toBe(0);
  });

  it('the first slide\'s "move up" button is disabled and the last slide\'s "move down" button is disabled', () => {
    window.DeckEditor.enableEditing(mount);
    const bars = mount.querySelectorAll('.deck-editor-slide-bar');
    const firstUp = bars[0].querySelector('[data-action="up"]');
    const lastDown = bars[1].querySelector('[data-action="down"]');
    expect(firstUp.disabled).toBe(true);
    expect(lastDown.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js public/libs/__tests__/deck-editor.test.js`
Expected: FAIL — `data-el-index` missing on images, `setSlideComponent` undefined, no chrome elements exist.

- [ ] **Step 3: Implement**

In `deck-schema-renderer.js`'s image branch (the `else if (el.type === 'image')` block, added in Task 2), add one line mirroring the text branch's existing tagging:
```javascript
img.dataset.elIndex = String(elIndex); // mirrors the .schema-text tagging above — same forEach's elIndex is already in scope
```

In `deck-editor.js`, add (before the `window.DeckEditor = {...}` export):
```javascript
var libraryCache = null;
function fetchLibrary() {
  if (libraryCache) return Promise.resolve(libraryCache);
  var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
  return fetch(origin + '/brand/master-deck-library.json')
    .then(function (r) { return r.json(); })
    .then(function (data) { libraryCache = data; return data; });
}

function setSlideComponent(slideIndex, componentId, mountEl) {
  return fetchLibrary().then(function (library) {
    var entry = (library.slides || []).filter(function (s) { return s.componentId === componentId; })[0];
    if (!entry) throw new Error('DeckEditor.setSlideComponent: unknown componentId "' + componentId + '"');
    var slide = window.DECK.slides[slideIndex];
    slide.layout = 'schema';
    slide.componentId = componentId;
    slide.elements = JSON.parse(JSON.stringify(entry.elements));
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  });
}

// Curated, known-good componentId ranges for the variant-swap picker -- deliberately NOT
// exposing all 104 master-deck slides (many are dividers/tip-slides/known-broken per
// Task 6/10's documented limitations). VERIFY these ranges against the current content of
// agents/presentation-creator.skill.md's componentId preference table before shipping --
// they were corrected once already during this plan's final review; do not hardcode a
// stale copy.
var CURATED_VARIANTS = [
  { category: 'Title', ids: ['slide-5', 'slide-6', 'slide-7', 'slide-8', 'slide-9'] },
  { category: 'Agenda', ids: ['slide-18', 'slide-19'] },
  { category: 'Section', ids: ['slide-21', 'slide-22', 'slide-23', 'slide-24', 'slide-25'] },
  { category: 'Closing', ids: ['slide-97', 'slide-98', 'slide-99', 'slide-100'] },
];

function buildVariantSelect(slideIndex, mountEl) {
  var select = document.createElement('select');
  select.className = 'deck-editor-chrome';
  var placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Change layout…';
  select.appendChild(placeholder);
  CURATED_VARIANTS.forEach(function (group) {
    var optgroup = document.createElement('optgroup');
    optgroup.label = group.category;
    group.ids.forEach(function (id) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
  select.addEventListener('click', function (e) { e.stopPropagation(); });
  select.addEventListener('change', function () {
    if (!select.value) return;
    setSlideComponent(slideIndex, select.value, mountEl);
  });
  return select;
}

function makeChromeButton(label, action, onClick, disabled) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'deck-editor-chrome';
  b.setAttribute('data-action', action);
  b.textContent = label;
  b.disabled = !!disabled;
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    onClick();
  });
  return b;
}

function injectSlideBar(slideEl, slideIndex, totalSlides, mountEl) {
  var bar = document.createElement('div');
  bar.className = 'deck-editor-chrome deck-editor-slide-bar';
  bar.style.cssText = 'position:absolute;top:8px;right:8px;z-index:1000;display:flex;gap:4px;';
  bar.appendChild(makeChromeButton('↑', 'up', function () { reorderSlide(slideIndex, slideIndex - 1, mountEl); }, slideIndex === 0));
  bar.appendChild(makeChromeButton('↓', 'down', function () { reorderSlide(slideIndex, slideIndex + 1, mountEl); }, slideIndex === totalSlides - 1));
  bar.appendChild(makeChromeButton('Duplicate', 'duplicate', function () { duplicateSlide(slideIndex, mountEl); }));
  bar.appendChild(makeChromeButton('Delete', 'delete', function () { deleteSlide(slideIndex, mountEl); }, totalSlides <= 1));
  bar.appendChild(buildVariantSelect(slideIndex, mountEl));
  slideEl.appendChild(bar);
}

function injectImageSwapButtons(slideEl, slideIndex, mountEl) {
  var images = slideEl.querySelectorAll('.schema-image');
  images.forEach(function (imgEl, loopIndex) {
    var elementIndex = imgEl.dataset.elIndex !== undefined ? parseInt(imgEl.dataset.elIndex, 10) : loopIndex;
    var btn = makeChromeButton('Swap image', 'swap-image', function () {
      var name = window.prompt('Brand image key (e.g. logo-dark, logo-light):');
      if (name) setSlideImage(slideIndex, elementIndex, { brandImage: name }, mountEl);
    });
    btn.className += ' deck-editor-image-swap';
    btn.style.cssText = 'position:absolute;left:' + imgEl.style.left + ';top:' + imgEl.style.top + ';z-index:1000;';
    slideEl.appendChild(btn);
  });
}
```

Update `enableEditing` to also call, inside its existing `slideEls.forEach(function (slideEl, slideIndex) {...})` loop (after the existing text-binding logic): `injectSlideBar(slideEl, slideIndex, slideEls.length, mountEl); injectImageSwapButtons(slideEl, slideIndex, mountEl);`

Update `disableEditing` to also do, before its existing `boundHandlers = []` reset: `document.querySelectorAll('.deck-editor-chrome').forEach(function (el) { el.remove(); });` — note this queries the whole document, not a specific mount, matching the existing `boundHandlers` design (Task 7's `disableEditing` already accepts-but-ignores `mountEl` for the same reason: bindings/chrome aren't tracked per-mount, they're tracked globally since only one mount is ever "active" for editing at a time in this singleton-`DECK` architecture).

Add the new functions to the `window.DeckEditor = {...}` export: `setSlideComponent: setSlideComponent,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js public/libs/__tests__/deck-editor.test.js`
Expected: PASS, full files green.

Also run the full `client/public/libs` suite to confirm no regressions (baseline before this task: 219/219 — the count after the final-review fix wave).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-schema-renderer.js client/public/libs/deck-editor.js client/public/libs/__tests__/deck-schema-renderer.test.js client/public/libs/__tests__/deck-editor.test.js
git commit -m "feat: add editor UI chrome for reorder/duplicate/delete/image-swap/variant-swap"
```

---

## Task 18: More chart types (line, area)

**Background:** `chart` currently supports `type: 'bar'` (default) and `type: 'pie'` (Task 5). PptxGenJS 4.0.1 natively supports 9 chart types (`node_modules/pptxgenjs/types/index.d.ts:620`: `'area' | 'bar' | 'bar3D' | 'bubble' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter'`). This task adds `'line'` and `'area'` — both use the exact same `bars: {label,value}[]` data shape already established, so they're a natural, low-risk extension of the exact pattern Task 5 already proved out. Deliberately deferred: `scatter`/`bubble` (need `{x,y}` point pairs, a genuinely different data shape than `{label,value}` — a separate future addition, not a small extension), `radar`/`doughnut`/`bar3D` (marginal value over what `bar`/`pie` already cover for this deck-generation use case).

**Files:**
- Modify: `client/public/libs/deck-renderer.js` (`chart` layout's `render`/`exportPptx`, same functions Task 5 touched)
- Test: extend `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:** `chart` spec's `type` field gains two more valid values: `'line'`, `'area'` (alongside the existing `'bar'`/`'pie'`). Same `bars` field, same structural 6-item cap already enforced.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-renderer.test.js — extend chart describe block
it('renders a simple line/area indicator when type is "line" or "area" (preview treats them the same visually — a connected trend line over the bars, distinguished by fill)', () => {
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('chart').render({ title: 'T', type: 'line', bars: [{ label: 'A', value: 5 }, { label: 'B', value: 8 }] }, slideEl);
  expect(slideEl.querySelector('.chart-line')).not.toBeNull();
});

it('exportPptx calls addChart with "line" for type:"line"', () => {
  const pptxSlide = { addText: jest.fn(), addShape: jest.fn(), addChart: jest.fn() };
  window.DeckRenderer.getLayout('chart').exportPptx(pptxSlide, {
    title: 'T', type: 'line', bars: [{ label: 'A', value: 5 }, { label: 'B', value: 8 }],
  });
  expect(pptxSlide.addChart).toHaveBeenCalledWith('line', expect.arrayContaining([expect.objectContaining({ labels: ['A', 'B'], values: [5, 8] })]), expect.any(Object));
});

it('exportPptx calls addChart with "area" for type:"area"', () => {
  const pptxSlide = { addText: jest.fn(), addShape: jest.fn(), addChart: jest.fn() };
  window.DeckRenderer.getLayout('chart').exportPptx(pptxSlide, {
    title: 'T', type: 'area', bars: [{ label: 'A', value: 5 }, { label: 'B', value: 8 }],
  });
  expect(pptxSlide.addChart).toHaveBeenCalledWith('area', expect.anything(), expect.any(Object));
});

it('bar chart (default/unset type) behavior is unchanged', () => {
  const slideEl = document.createElement('section');
  window.DeckRenderer.getLayout('chart').render({ title: 'T', bars: [{ label: 'A', value: 5 }] }, slideEl);
  expect(slideEl.querySelector('.chart-rows')).not.toBeNull();
  expect(slideEl.querySelector('.chart-line')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js -t "line"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `chart`'s `render` (already branches on `spec.type === 'pie'` at the top, per Task 5 — add a sibling branch for `'line'`/`'area'` right after the pie branch's `return`, before the existing bar-rendering fallthrough code):

```javascript
if (spec.type === 'line' || spec.type === 'area') {
  var lineWrap = document.createElement('div');
  lineWrap.className = 'chart-line';
  lineWrap.style.cssText = 'position:relative;height:14rem;display:flex;align-items:flex-end;gap:.5rem;padding:0 .5rem;';
  var maxVal = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1]));
  bars.forEach(function (bar) {
    var col = document.createElement('div');
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;';
    var fill = document.createElement('div');
    var pct = Math.round((bar.value / maxVal) * 100);
    fill.style.cssText = 'width:100%;border-radius:4px 4px 0 0;height:' + pct + '%;' +
      (spec.type === 'area' ? 'background:rgba(255,107,24,.35);border-top:2px solid #FF6B18;' : 'background:#FF6B18;width:4px;margin:0 auto;');
    var label = document.createElement('span');
    label.style.cssText = "font-size:.75rem;color:rgba(255,255,255,.7);margin-top:.4rem;font-family:'DM Sans',sans-serif;";
    label.textContent = bar.label;
    col.appendChild(fill);
    col.appendChild(label);
    lineWrap.appendChild(col);
  });
  slideEl.appendChild(lineWrap);
  return;
}
```

In `exportPptx` (same pie-branch pattern from Task 5 — add a sibling branch):

```javascript
if (spec.type === 'line' || spec.type === 'area') {
  pptxSlide.addChart(
    spec.type,
    [{ name: spec.title || '', labels: bars.map(function (b) { return b.label; }), values: bars.map(function (b) { return b.value; }) }],
    { x: g.bars.x, y: g.bars.y, w: g.bars.w, h: g.bars.h, showLegend: false },
  );
  return;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS, full suite green (existing bar/pie tests + these).

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: add line and area chart variants"
```

---

## Task 19: Visual thumbnail previews for the variant/layout picker

**Background:** Task 17 builds the variant-swap picker as a plain `<select>` with text-only `componentId` options (e.g. "slide-97"). This task upgrades it to show an actual small live-rendered preview of each candidate layout's real content — the way other AI slide-generation tools show visual template thumbnails — reusing `DeckSchemaRenderer.renderSchemaElements` (already built, Task 2) to render each candidate at a small scale, so there's no separate rendering path to maintain and no risk of a thumbnail drifting out of sync with what actually renders.

**Files:**
- Modify: `client/public/libs/deck-editor.js` (replace `buildVariantSelect` with a thumbnail-grid picker)
- Test: extend `client/public/libs/__tests__/deck-editor.test.js`

**Interfaces:** the "Change layout…" control in each slide's chrome bar changes from a native `<select>` to a button that toggles a small popover panel containing a grid of thumbnail buttons (one per curated `componentId`, grouped by category header, same `CURATED_VARIANTS` list Task 17 established). Clicking a thumbnail calls the existing `setSlideComponent(slideIndex, componentId, mountEl)` and closes the popover. No new public API — this is purely a chrome-rendering change inside `deck-editor.js`.

- [ ] **Step 1: Write the failing tests**

```js
// client/public/libs/__tests__/deck-editor.test.js — extend the UI chrome describe block
describe('DeckEditor visual variant picker', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'S1' }] }] };
    window.DeckRenderer.renderDeck(window.DECK, mount);
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ slides: [{ componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] }] }),
    });
  });
  afterEach(() => { delete window.DECK; delete global.fetch; });

  it('shows a "Change layout" button instead of a native select', () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelector('.deck-editor-slide-bar select')).toBeNull();
    expect(mount.querySelector('[data-action="change-layout"]')).not.toBeNull();
  });

  it('opens a thumbnail grid with a rendered mini-preview per curated componentId when clicked', async () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    await Promise.resolve(); // let the library fetch + thumbnail render settle
    const thumbs = mount.querySelectorAll('.deck-editor-variant-thumb');
    expect(thumbs.length).toBeGreaterThan(0);
    // each thumbnail actually contains rendered schema content, not just a label
    expect(thumbs[0].querySelector('.schema-text, .schema-shape, .schema-image')).not.toBeNull();
  });

  it('clicking a thumbnail calls setSlideComponent and closes the popover', async () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    await Promise.resolve();
    const thumb = Array.from(mount.querySelectorAll('.deck-editor-variant-thumb')).find((t) => t.dataset.componentId === 'slide-97');
    thumb.click();
    await Promise.resolve();
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
    expect(mount.querySelector('.deck-editor-variant-popover')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-editor.test.js -t "visual variant picker"`
Expected: FAIL — no `[data-action="change-layout"]` button exists yet (Task 17 built a `<select>`, not a button+popover).

- [ ] **Step 3: Implement**

Replace `buildVariantSelect` (built in Task 17) with:

```javascript
function buildThumbnail(componentId, elements, slideIndex, mountEl, popover) {
  var thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'deck-editor-chrome deck-editor-variant-thumb';
  thumb.dataset.componentId = componentId;
  // Fixed small box at the deck's real 16:9 ratio; render the real elements at full
  // scale inside an inner div, then CSS-scale the whole thing down -- reuses
  // DeckSchemaRenderer verbatim, so the thumbnail can never drift from the real render.
  thumb.style.cssText = 'width:96px;height:54px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.2);background:#25223B;padding:0;cursor:pointer;';
  var inner = document.createElement('div');
  inner.style.cssText = 'width:960px;height:540px;position:relative;transform:scale(0.1);transform-origin:top left;';
  window.DeckSchemaRenderer.renderSchemaElements(elements, inner);
  thumb.appendChild(inner);
  thumb.addEventListener('click', function (e) {
    e.stopPropagation();
    setSlideComponent(slideIndex, componentId, mountEl);
    popover.remove();
  });
  return thumb;
}

function openVariantPopover(anchorBtn, slideIndex, mountEl) {
  var existing = document.querySelector('.deck-editor-variant-popover');
  if (existing) existing.remove();
  var popover = document.createElement('div');
  popover.className = 'deck-editor-chrome deck-editor-variant-popover';
  popover.style.cssText = 'position:absolute;top:32px;right:8px;z-index:1001;background:#1a1728;border:1px solid rgba(255,255,255,.2);padding:8px;display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;';
  fetchLibrary().then(function (library) {
    CURATED_VARIANTS.forEach(function (group) {
      var groupLabel = document.createElement('div');
      groupLabel.className = 'deck-editor-chrome';
      groupLabel.style.cssText = "font-size:10px;color:rgba(255,255,255,.6);font-family:'DM Sans',sans-serif;";
      groupLabel.textContent = group.category;
      var row = document.createElement('div');
      row.className = 'deck-editor-chrome';
      row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      group.ids.forEach(function (id) {
        var entry = (library.slides || []).filter(function (s) { return s.componentId === id; })[0];
        if (!entry) return; // skip silently if a curated id is somehow missing from the library
        row.appendChild(buildThumbnail(id, entry.elements, slideIndex, mountEl, popover));
      });
      popover.appendChild(groupLabel);
      popover.appendChild(row);
    });
  });
  anchorBtn.parentElement.appendChild(popover);
}
```

Update `injectSlideBar` to replace its `bar.appendChild(buildVariantSelect(...))` line with:
```javascript
bar.appendChild(makeChromeButton('Change layout…', 'change-layout', function () { openVariantPopover(bar, slideIndex, mountEl); }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-editor.test.js`
Expected: PASS, full file green.

Also run the full `client/public/libs` suite to confirm no regressions.

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-editor.js client/public/libs/__tests__/deck-editor.test.js
git commit -m "feat: replace text-only variant picker with visual thumbnail previews"
```

---

## Second Final Whole-Branch Review (after Tasks 17-19)

Dispatch the final code reviewer again (per subagent-driven-development), on the most capable available model, against the diff from Task 17's own BASE through Task 19's HEAD (the rest of the branch, Tasks 1-16 plus the first final-review fix wave, was already reviewed clean and should not need re-reading in full — but the reviewer should still check these tasks' interaction with what they touch: Task 7's `disableEditing`, Task 8's four mutation functions, Task 2's `data-el-index` tagging, Task 5's chart-type branching pattern, and the corrected componentId ranges from the first final review's M2 fix). Specifically check: (a) the curated `CURATED_VARIANTS` ranges in `deck-editor.js` actually match the current, corrected ranges in `agents/presentation-creator.skill.md` (not a stale copy from before the M2 fix), (b) `disableEditing`'s document-wide chrome removal doesn't remove anything it shouldn't (e.g. if any other, unrelated part of the app happens to use a `.deck-editor-chrome` class name — grep to confirm uniqueness), (c) the image-swap button's positioning (copying `imgEl.style.left`/`top`) actually lands visibly over or near the image it corresponds to, not off-screen, (d) `setSlideComponent`'s fetched-and-cached library isn't stale if `master-deck-library.json` could ever change during a session (acceptable to leave as session-lifetime cache, but confirm this is a deliberate, reasonable choice, not an oversight), (e) Task 19's thumbnail rendering doesn't leak duplicate popovers if "Change layout" is clicked multiple times without closing (confirm the `existing.remove()` guard actually works), (f) Task 18's `line`/`area` branches don't break the existing `bar`/`pie` fallthrough logic (the same `if (spec.type === 'pie') { ...; return; }` early-return pattern must still work unchanged).

---

## Final Whole-Branch Review (Tasks 1-16, superseded by the Second Final Whole-Branch Review above after Task 17 was added)

After Task 16, dispatch the final code reviewer (per subagent-driven-development) against the full diff from Task 1's BASE through Task 16's HEAD, with this plan's Global Constraints as its attention lens — specifically checking: (a) no existing 19-layout behavior changed, (b) every new image reference is origin-aware, (c) the converter's regex extraction has no un-flagged silent gaps, (d) the editor's save path reconstructs `window.DECK` text losslessly (no truncation/escaping bugs in the `JSON.stringify` substitution), (e) the `.mutate()` call shape in Task 9 matches `EditMessage.tsx`'s proven usage exactly, (f) `download-bridge.js`'s new `.apply(null, e.data.args || [])` change (Task 14) does not break any existing zero-arg download trigger for any of the three generators, (g) Task 11's aspect-ratio CSS fix doesn't regress any existing layout's rendered appearance (16:9 content should look identical to before, only non-16:9 containers should now letterbox instead of stretch), (h) Task 15's font-embedding XML surgery (rId numbering, element insertion points) doesn't corrupt the pptx for any of the 19 existing layouts or the new schema layout — ideally verified by actually opening a generated file in PowerPoint/LibreOffice or an OOXML validator, not just asserting the strings are present, (i) Task 16's preview shrink-loop only engages on real overflow and never fires for the 19 existing hand-coded layouts (which don't use `.schema-text` at all).
