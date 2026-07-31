# Presentation Editor v2 (Canvas Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current contenteditable-based deck editor with a genuine Konva canvas editor (drag/resize/rotate, floating per-element toolbars, multi-select, z-order, undo/redo, safe autosave, image upload+crop), without touching the existing DOM/CSS view renderer or PPTX export pipeline. Also fix two real contributors to generated decks not matching the real master deck template (background color, componentId lookup friction).

**Architecture:** Dual-renderer. `deck-renderer.js`/`deck-schema-renderer.js` (view + PPTX export) are NOT modified except to add `rotation`/`zIndex` field support. A new Konva-based `canvas-editor.js` becomes the ONLY editing surface, replacing `deck-editor.js` entirely. Editing mutates `window.DECK`'s `elements[]` in place (same single-source-of-truth discipline as before); toggling edit off, or an autosave round-trip, hands control back to the unmodified view renderer.

**Tech Stack:** Konva (`konva` + `react-konva`... actually plain `konva` only — this is vanilla JS inside the artifact iframe, no React/framework), same vanilla-JS-in-a-`<script>`-tag convention as every other `/libs/*.js` file.

## Global Constraints

- Full design rationale lives in `docs/superpowers/specs/2026-07-31-presentation-editor-v2-design.md` — read it once before starting Task 1, it is NOT re-derived per-task below.
- Node/npm/npx are at `/opt/homebrew/bin`, not on the default PATH — every command needs `export PATH="/opt/homebrew/bin:$PATH" &&` prefixed.
- `deck-renderer.js`, `deck-schema-renderer.js`'s existing render/export logic for the 19 hand-coded layouts and the schema layout's text/image/shape branches are NOT to be rewritten — only extended (rotation/zIndex support) exactly where each task specifies. Do not "clean up" or restructure anything not explicitly in scope.
- `deck-editor.js` is fully replaced and deleted once `canvas-editor.js` reaches parity (Task 14) — no dual editor code paths left shipped.
- Autosave MUST use a serialized queue (never more than one `useEditArtifact` mutation in flight; each save's `original` param is always the exact `updated` string the previous queued save actually sent) — see the design spec's "Autosave" section for the exact race this prevents. This is a correctness requirement, not a nice-to-have.
- Canvas interaction tasks (drag/resize/rotate/selection/toolbar positioning) MUST include real-browser Playwright verification in the task's own report — jsdom has no real `<canvas>` 2D context and cannot prove these work.
- Chrome UI (toolbars, buttons, menus) uses the app's own neutral dark theme (`#171717`/`#212121` surfaces, `#ececec` text, matching the existing `injectEditorChromeStyles` convention from the prior editor) — never the deck's own brand palette (`#FF6B18`/`#25223B`/`#36314C`), which is reserved for slide content.
- All new/modified files under `client/public/libs/` follow the existing IIFE-per-file convention (`(function () { ... })();`), reading `window.DeckRenderer`/`window.DeckSchemaRenderer` and exposing their own `window.X` global, matching every existing file in that directory.

---

## Task 1: Vendor Konva + `rotation`/`zIndex` schema support

**Files:**
- Modify: `package.json`, `scripts/copy-libs.mjs` (vendor `konva` the same way `html2canvas`/`jszip`/etc. are vendored — `npm install konva`, copy `node_modules/konva/konva.min.js` → `client/public/libs/konva.min.js`)
- Modify: `client/public/libs/deck-schema-renderer.js` (`renderSchemaElements`, `exportSchemaElements`)
- Test: `client/public/libs/__tests__/deck-schema-renderer.test.js`

**Interfaces:**
- Produces: `ElementSpec` gains `rotation?: number` (degrees, CSS-style: positive = clockwise) and `zIndex?: number` (paint order; absent = render in array order, exactly matching current behavior).

- [ ] **Step 1: Install and vendor Konva**

```bash
export PATH="/opt/homebrew/bin:$PATH" && npm install konva@9 --save
```

Add to `scripts/copy-libs.mjs`'s `LIBS` array:
```js
{
  src:  'node_modules/konva/konva.min.js',
  dest: 'konva.min.js',
},
```

Run `node scripts/copy-libs.mjs` and confirm `client/public/libs/konva.min.js` exists.

- [ ] **Step 2: Write failing tests for rotation/zIndex in the render path**

```js
// client/public/libs/__tests__/deck-schema-renderer.test.js — add to the renderSchemaElements describe block
it('applies `rotation` on a text element as a CSS transform', () => {
  window.DeckSchemaRenderer.renderSchemaElements(
    [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Tilted', rotation: 15 }],
    container,
  );
  const el = container.querySelector('.schema-text');
  expect(el.style.transform).toBe('rotate(15deg)');
});

it('applies `rotation` on a shape element as a CSS transform', () => {
  window.DeckSchemaRenderer.renderSchemaElements(
    [{ type: 'shape', shape: 'rect', x: 0, y: 0, w: 2, h: 1, fill: 'FFFFFF', rotation: -8 }],
    container,
  );
  const el = container.querySelector('.schema-shape');
  expect(el.style.transform).toBe('rotate(-8deg)');
});

it('renders elements in zIndex order when present, array order otherwise', () => {
  window.DeckSchemaRenderer.renderSchemaElements(
    [
      { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'C', zIndex: 3 },
      { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'A', zIndex: 1 },
      { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'B', zIndex: 2 },
    ],
    container,
  );
  const texts = [...container.querySelectorAll('.schema-text')].map((el) => el.textContent);
  expect(texts).toEqual(['A', 'B', 'C']);
});

it('elements without zIndex render in array order, unaffected by zIndex-bearing siblings (backward compatible)', () => {
  window.DeckSchemaRenderer.renderSchemaElements(
    [
      { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'First' },
      { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'Second' },
    ],
    container,
  );
  const texts = [...container.querySelectorAll('.schema-text')].map((el) => el.textContent);
  expect(texts).toEqual(['First', 'Second']);
});
```

And export-path tests:
```js
// exportSchemaElements describe block
it('exports `rotation` as PptxGenJS rotate', () => {
  const slide = fakeSlide();
  window.DeckSchemaRenderer.exportSchemaElements(slide, [
    { type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Tilted', rotation: 15 },
  ]);
  expect(slide.addText).toHaveBeenCalledWith('Tilted', expect.objectContaining({ rotate: 15 }));
});

it('exports elements in zIndex order when present', () => {
  const slide = fakeSlide();
  const calls = [];
  slide.addText = jest.fn((text) => calls.push(text));
  window.DeckSchemaRenderer.exportSchemaElements(slide, [
    { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'C', zIndex: 3 },
    { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'A', zIndex: 1 },
    { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'B', zIndex: 2 },
  ]);
  expect(calls).toEqual(['A', 'B', 'C']);
});
```

- [ ] **Step 2b: Run tests, confirm they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js -t "rotation|zIndex"`
Expected: FAIL (rotation/zIndex not yet implemented; ordering test may pass by coincidence on array order — confirm the zIndex-ordering test specifically fails).

- [ ] **Step 3: Implement**

In `renderSchemaElements`: before the `(elements || []).forEach(...)` loop, compute a stably-sorted copy: `var sorted = (elements || []).map(function(el, i){ return {el: el, origIndex: i}; }).sort(function(a,b){ var az = a.el.zIndex != null ? a.el.zIndex : a.origIndex; var bz = b.el.zIndex != null ? b.el.zIndex : b.origIndex; return az - bz; });` then iterate `sorted` instead of `elements` directly — but the `elIndex` used for `data-el-index` tagging (and passed through resolveImageRef/etc.) must remain `origIndex`, NOT the sorted-loop position (this is the exact same "true array index" discipline already established for text-among-shapes — do not regress it while adding sort). Replace `.forEach(function (el, elIndex) {` with `.forEach(function (item) { var el = item.el; var elIndex = item.origIndex;`.

Add, in each of the text/shape branches (NOT the image branch — rotating an `<img>` in place is out of scope for this task, image elements don't get `rotation` support until the canvas editor can produce it in a later task if ever needed): `if (el.rotation) span.style.transform = 'rotate(' + el.rotation + 'deg)';` (and same for `box` in the shape branch).

In `exportSchemaElements`: same stable-sort approach for iteration order. In the text branch's `textOpts` object, add: `if (el.rotation) textOpts.rotate = el.rotation;` (PptxGenJS's `rotate` option, degrees). In the shape branch's options object, add the same `rotate` key.

- [ ] **Step 4: Run tests, verify pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/deck-schema-renderer.test.js`
Expected: PASS, full file green, no regressions to existing tests (the `data-el-index` regression tests specifically must still pass unchanged).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/copy-libs.mjs client/public/libs/konva.min.js client/public/libs/deck-schema-renderer.js client/public/libs/__tests__/deck-schema-renderer.test.js
git commit -m "feat: vendor Konva, add rotation/zIndex support to schema elements"
```

---

## Task 2: Investigate and choose the image-upload endpoint

**Background:** The design spec calls for an "Upload" tab in the new image editor. This app's existing upload mechanism (`useFileHandling`/`useUploadFileMutation` in `client/src/hooks/Files/`) is tightly coupled to the chat message-composer flow (conversation ID, ephemeral agent state, endpoint file config) — reusing it as-is for "upload an image to swap into a deck element" is very likely wrong. `api/server/routes/files/avatar.js` (`POST /files/images/avatar`) is a standalone, conversation-independent image upload endpoint already in this codebase — a much closer structural match for what's needed here. This task is investigation-first, not a blind implementation.

**Files:**
- Read: `api/server/routes/files/avatar.js`, `api/server/routes/files/images.js`, `api/server/routes/files/multer.js`, `client/src/hooks/Files/useFileHandling.ts`
- Create (if no suitable existing endpoint): `api/server/routes/files/deckAsset.js` + wiring into `api/server/routes/files/index.js`
- Test: whichever new/reused route gets chosen

**Interfaces:**
- Produces: a documented, working `POST` endpoint that accepts an image file + auth token and returns a URL usable as an `<img src>` — this is what Task 10 (image editor) consumes. Document the exact request/response shape in this task's report.

- [ ] **Step 1: Read the three existing route files and `useFileHandling.ts` fully.** Determine: does `avatar.js`'s pattern (or `images.js`) already do what's needed (accept an arbitrary image, store it, return a stable URL), or does it have avatar-specific behavior (e.g. resizing to a fixed square, overwriting the user's single avatar record) that makes it unsuitable to reuse directly?

- [ ] **Step 2a (if a suitable existing endpoint exists):** Document its exact contract (method, path, auth header, multipart field name, response JSON shape) in this task's report. No code changes needed — skip to Step 4.

- [ ] **Step 2b (if none exists — build a minimal standalone endpoint):** Create `api/server/routes/files/deckAsset.js` modeled directly on `avatar.js`'s structure (same multer/auth middleware pattern) but WITHOUT avatar-specific behavior (no fixed resize, no single-record overwrite — just: accept an image, store it via whatever storage strategy `avatar.js`/`images.js` already uses — local disk, S3, whatever this app's existing `FileSources` config supports — and return its URL). Wire it into `api/server/routes/files/index.js` alongside the existing routes.

- [ ] **Step 3 (if built new):** Write a request test (following `api/server/routes/files/files.test.js`'s existing conventions) covering: successful upload returns a URL, rejects non-image mimetypes, rejects unauthenticated requests.

- [ ] **Step 4: Run the relevant server test suite**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd api && npx jest server/routes/files`
Expected: PASS.

- [ ] **Step 5: Commit** (only if new code was written; if Step 2a applied, this task ends with just the report, no commit needed — say so explicitly in the report)

```bash
git add api/server/routes/files/deckAsset.js api/server/routes/files/index.js api/server/routes/files/deckAsset.test.js
git commit -m "feat: add standalone image-upload endpoint for the deck image editor"
```

---

## Task 3: `canvas-editor.js` — Konva stage bootstrap + element-to-node mapping (read-only first)

**Files:**
- Create: `client/public/libs/canvas-editor.js`
- Test: `client/public/libs/__tests__/canvas-editor.test.js` (data/state-layer tests only — see Task 3b for the Playwright interaction tests)

**Interfaces:**
- Consumes: `window.DECK` (same shape as `deck-renderer.js` reads), `window.Konva` (global from the vendored bundle).
- Produces: `window.CanvasEditor = { mount(mountEl), unmount(), isMounted() }`. `mount(mountEl)` creates a Konva `Stage`+`Layer` sized to the deck's 10×5.625in canvas (scaled to fit `mountEl`, same aspect-ratio-lock discipline as `deck-renderer.js`'s `.deck` CSS), and renders the CURRENTLY ACTIVE slide's `elements[]` as Konva nodes (`Konva.Text` for type `text`, `Konva.Image` for type `image`, `Konva.Rect`/`Konva.Ellipse` for type `shape`) — read-only, no selection/dragging yet (that's Task 4).

- [ ] **Step 1: Write failing tests for the data-layer parts of stage setup**

```js
// client/public/libs/__tests__/canvas-editor.test.js
require('../deck-renderer.js');
require('../canvas-editor.js');

describe('CanvasEditor.mount', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    window.DECK = {
      title: 'T',
      slides: [{ layout: 'schema', elements: [{ type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' }] }],
    };
  });
  afterEach(() => {
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('reports mounted state correctly', () => {
    expect(window.CanvasEditor.isMounted()).toBe(false);
    window.CanvasEditor.mount(mount, 0);
    expect(window.CanvasEditor.isMounted()).toBe(true);
    window.CanvasEditor.unmount();
    expect(window.CanvasEditor.isMounted()).toBe(false);
  });

  it('creates exactly one Konva node per element in the active slide', () => {
    window.CanvasEditor.mount(mount, 0);
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    expect(layer.children.length).toBe(1);
  });

  it('re-mounting without an intervening unmount does not leak a second stage', () => {
    window.CanvasEditor.mount(mount, 0);
    window.CanvasEditor.mount(mount, 0);
    expect(mount.querySelectorAll('canvas').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, confirm fail** (module doesn't exist yet).

- [ ] **Step 3: Implement `canvas-editor.js`**

```javascript
// client/public/libs/canvas-editor.js
//
// Konva-based canvas editor: the ONLY editing surface for a deck. Read-only
// view + PPTX export remain deck-renderer.js/deck-schema-renderer.js, entirely
// unmodified by this file — editing swaps to this canvas, mutates
// window.DECK.slides[i].elements in place, and handing control back to the
// existing renderer is just re-calling DeckRenderer.renderDeck with the
// mutated data (this file does not re-implement the view renderer).
(function () {
  var SW = window.DeckRenderer.SW; // 10
  var SH = window.DeckRenderer.SH; // 5.625
  var stage = null;
  var layer = null;
  var activeSlideIndex = 0;

  function isMounted() {
    return stage !== null;
  }

  function getStage() {
    return stage;
  }

  function elementToKonvaNode(el, scale) {
    var common = { x: el.x * scale, y: el.y * scale, rotation: el.rotation || 0 };
    if (el.type === 'text') {
      return new window.Konva.Text({
        x: common.x, y: common.y, rotation: common.rotation,
        width: el.w * scale, height: el.h * scale,
        text: el.text || '', fontSize: (el.fontSize || 14) * (scale / 10) * 7.2, // pt->px approx, refined in Task 4
        fill: '#' + (el.color || 'FFFFFF'),
        fontStyle: (el.fontWeight === 'bold' || el.bold === true) ? 'bold' : 'normal',
        fontFamily: el.fontFamily || 'DM Sans',
        align: el.align || 'left',
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'shape') {
      var ShapeCtor = el.shape === 'ellipse' ? window.Konva.Ellipse : window.Konva.Rect;
      return new ShapeCtor({
        x: common.x, y: common.y, rotation: common.rotation,
        width: el.w * scale, height: el.h * scale,
        radiusX: (el.w * scale) / 2, radiusY: (el.h * scale) / 2, // only used by Ellipse
        fill: '#' + (el.fill || '4a4560'),
        cornerRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) * scale : 0,
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'image') {
      var node = new window.Konva.Image({ x: common.x, y: common.y, rotation: common.rotation, width: el.w * scale, height: el.h * scale, image: undefined });
      var imgEl = new Image();
      var brandImage = el.brandImage, deckAsset = el.deckAsset;
      imgEl.src = brandImage ? window.DeckRenderer.brandImagePath(brandImage) : window.DeckRenderer.deckAssetPath(deckAsset);
      imgEl.onload = function () { node.image(imgEl); if (layer) layer.batchDraw(); };
      return node;
    }
    return null; // unknown type: skip, do not throw (same isolation discipline as renderDeck)
  }

  function mount(mountEl, slideIndex) {
    unmount(); // idempotent re-mount, mirrors deck-editor.js's enableEditing discipline
    activeSlideIndex = slideIndex || 0;
    var rect = mountEl.getBoundingClientRect();
    var scale = Math.min(rect.width / SW, rect.height / SH);
    stage = new window.Konva.Stage({ container: mountEl, width: SW * scale, height: SH * scale });
    layer = new window.Konva.Layer();
    stage.add(layer);
    var slide = window.DECK.slides[activeSlideIndex];
    var elements = (slide && slide.elements) || [];
    var sorted = elements.map(function (el, i) { return { el: el, origIndex: i }; })
      .sort(function (a, b) { var az = a.el.zIndex != null ? a.el.zIndex : a.origIndex; var bz = b.el.zIndex != null ? b.el.zIndex : b.origIndex; return az - bz; });
    sorted.forEach(function (item) {
      var node = elementToKonvaNode(item.el, scale);
      if (node) { node._elIndex = item.origIndex; layer.add(node); }
    });
    layer.draw();
  }

  function unmount() {
    if (stage) { stage.destroy(); stage = null; layer = null; }
  }

  window.CanvasEditor = { mount: mount, unmount: unmount, isMounted: isMounted, getStage: getStage };
})();
```

- [ ] **Step 4: Run tests, verify pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && cd client && npx jest public/libs/__tests__/canvas-editor.test.js`
Expected: PASS. Note: Konva requires `HTMLCanvasElement.prototype.getContext` — if jsdom's default canvas stub is insufficient, add `canvas` (the npm package providing a real 2D context polyfill for Node) as a devDependency and configure jest per Konva's own documented Node/jsdom test setup; document whatever was actually needed in the report.

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/canvas-editor.js client/public/libs/__tests__/canvas-editor.test.js
git commit -m "feat: Konva stage bootstrap and read-only element rendering for the canvas editor"
```

---

## Task 3b: Real-browser verification of Task 3's read-only render

**Files:** none modified — this is a verification-only task producing a Playwright script and a report, following the exact technique already used this session to verify the render-isolation and image-fallback fixes (serve `client/public` statically, load a real Chromium page via `playwright-core`, inspect the actual rendered canvas).

- [ ] **Step 1:** Write a throwaway Playwright script (not committed — same pattern as the ad-hoc `/tmp/deck-repro*` scripts used earlier this session) that serves `client/public/libs/*` statically, loads an HTML page with `konva.min.js` + `deck-renderer.js` + `canvas-editor.js`, sets a real multi-element `window.DECK`, calls `CanvasEditor.mount(...)`, and asserts via `page.evaluate` that the stage's layer contains the right node count/types and that a screenshot shows visible content (not a blank canvas).
- [ ] **Step 2:** Run it, capture a screenshot to `/tmp` for your own visual confirmation, and report the concrete result (node counts, screenshot non-blank confirmation) in the task report — do not claim success without this real-browser evidence.

No commit for this task (verification only) — append findings to the ledger via the normal task-review flow.

---

## Task 4: Selection, drag, resize, rotate (Konva Transformer)

**Files:**
- Modify: `client/public/libs/canvas-editor.js`
- Test: `client/public/libs/__tests__/canvas-editor.test.js` (data-layer: does dragging update `window.DECK`'s element x/y correctly) + a Playwright verification (interaction-layer: does an actual pointer drag/resize/rotate work in a real browser)

**Interfaces:**
- Produces: `window.CanvasEditor` gains `selectElement(elIndex)`, `deselect()`, `getSelectedIndex()`. Every Konva node gets `draggable: true` and a click handler wiring it into a shared `Konva.Transformer`. On `dragend`/`transformend`, the corresponding `window.DECK.slides[activeSlideIndex].elements[elIndex]`'s `x`/`y`/`w`/`h`/`rotation` are updated (converting Konva's pixel/scale coordinates back to the SW×SH inch canvas) and `notifyDeckUpdated()`-equivalent behavior fires (see Task 9's autosave queue — this task just needs to emit a change event, e.g. `window.CanvasEditor._onChange` callback list, that Task 9 subscribes to; do not implement persistence here).

- [ ] Follow the design spec's "Selection & manipulation" section exactly: a single shared `Konva.Transformer` attached/detached to the current node(s) on click/shift-click, standard corner+edge+rotation handles (Konva's own defaults — do not hand-roll handle drawing). Write the coordinate-conversion math (Konva px ↔ inches) as an isolated, directly-unit-testable pure function (e.g. `pxToInches(px, scale)` / `inchesToPx(inches, scale)`) so the data-layer test suite can verify it precisely without a real canvas.
- [ ] Write jsdom tests for the coordinate conversion functions and for "dragend updates window.DECK's element geometry" (simulate by calling the drag handler directly with a mock Konva event object, not a real pointer gesture — that's the Playwright test's job).
- [ ] Write a Playwright verification script proving an actual simulated pointer drag (`page.mouse.down/move/up`) on a real rendered element moves it and updates the underlying data — same rigor as Task 3b.
- [ ] Commit: `git commit -m "feat: selection, drag, resize, rotate via Konva Transformer"`.

---

## Task 5: Multi-select + keyboard shortcuts + z-order

**Files:** Modify `client/public/libs/canvas-editor.js`; Test: `deck-schema-renderer` unaffected, `canvas-editor.test.js` extended.

**Interfaces:** Produces shift-click multi-select (array of selected indices, dashed group outline via Konva's `Transformer` multi-node support), and keyboard handlers for: Delete/Backspace, Cmd/Ctrl+D duplicate, arrow-key nudge (Shift = larger step), Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z (wired to Task 8's undo/redo stack — implement the KEY BINDING here, the stack itself is Task 8; if Task 8 isn't done yet when this task runs, stub the undo/redo call sites with a documented TODO comment pointing at Task 8, per plan ordering these tasks run in sequence so this should not actually happen), Alt+]/Alt+[ and Shift+Alt+]/Shift+Alt+[ for z-order (mutating `zIndex` on the selected element(s), re-sorting the layer).

- [ ] Implement per the design spec's exact shortcut list. Write jsdom tests dispatching real `KeyboardEvent`s at the mounted stage's container and asserting the resulting `window.DECK` mutation (delete removes the element, duplicate deep-copies it, z-order shortcuts change `zIndex` correctly, arrow keys change `x`/`y` by the right inch-equivalent step).
- [ ] Commit: `git commit -m "feat: multi-select, keyboard shortcuts, and z-order controls"`.

---

## Task 6: "⋮ More" contextual menu

**Files:** Modify `client/public/libs/canvas-editor.js` (or new `client/public/libs/canvas-context-menu.js` if that keeps the file more focused — implementer's judgment).

**Interfaces:** A small floating menu (app-neutral-theme chrome, per Global Constraints) appearing near the current selection on right-click or a persistent "⋮" affordance, exposing Duplicate/Bring to Front/Forward/Send Backward/Back/Delete/Ungroup as clickable items — same actions as Task 5's shortcuts, click-driven for discoverability.

- [ ] Implement, reusing Task 5's action functions directly (no duplicated logic between the menu and the keyboard handlers).
- [ ] jsdom test: menu item clicks produce the same `window.DECK` mutations as the equivalent keyboard shortcut.
- [ ] Commit: `git commit -m "feat: contextual actions menu for the canvas editor"`.

---

## Task 7: `canvas-toolbars.js` — floating per-element-type toolbar

**Files:**
- Create: `client/public/libs/canvas-toolbars.js`
- Test: `client/public/libs/__tests__/canvas-toolbars.test.js`

**Interfaces:** `window.CanvasToolbars = { showFor(elIndex, node, stage), hide() }`, called by `canvas-editor.js`'s selection-change handler (single-selection only — hidden during multi-select, per the design's floating-toolbar-follows-one-element model). Renders the type-specific control set from the design spec (text: font/size/color/bold/align; image: replace/crop; shape: fill/opacity) into a `position:fixed` DOM element positioned above/below the node's current screen-space bounding box (clamped to viewport, same "detect if there's room above, else show below" logic Presenton uses — described in the research, re-derive the actual clamping math here since Presenton's own code isn't being copied verbatim).

- [ ] Implement per spec. Each control's `onChange` writes directly into the corresponding `window.DECK` element field (`fontFamily`/`fontSize`/`color`/`fontWeight`/`align` for text; `fill`/`opacity` for shape) and re-draws the Konva node to reflect it live.
- [ ] jsdom tests: toolbar renders the right control set per element type; each control's change handler mutates the right field.
- [ ] Playwright verification: toolbar actually appears near a real selected element and stays within the viewport when the element is near an edge.
- [ ] Commit: `git commit -m "feat: floating per-element-type toolbar"`.

---

## Task 8: Undo/redo stack

**Files:** Modify `client/public/libs/canvas-editor.js` (or new `client/public/libs/canvas-history.js`).

**Interfaces:** `window.CanvasHistory = { push(), undo(), redo(), canUndo(), canRedo() }`. `push()` deep-clones current `window.DECK` onto a `past` stack (bounded — cap at, e.g., 50 entries, dropping the oldest, to avoid unbounded memory growth in a long editing session) before every mutating action from Tasks 4-7 (each of those tasks' mutation call sites gets a `CanvasHistory.push()` immediately before mutating). `undo()`/`redo()` swap `window.DECK` to a popped snapshot and re-render the canvas from it.

- [ ] Wire `push()` calls into every mutation site from Tasks 4-7 (drag/resize/rotate/delete/duplicate/z-order/toolbar edits) — go back and add these call sites, this task explicitly depends on and modifies code from the earlier tasks.
- [ ] jsdom tests: a sequence of mutations followed by undo/redo produces the exact expected `window.DECK` state at each step; the history cap actually bounds stack growth.
- [ ] Commit: `git commit -m "feat: undo/redo history stack for the canvas editor"`.

---

## Task 9: Autosave — serialized save queue

**Files:**
- Create: `client/public/libs/canvas-autosave.js`
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx` (remove the explicit Save button/`pendingDeck`/`saveEditedDeck` click-driven flow, replace with autosave-queue consumption)
- Test: `client/public/libs/__tests__/canvas-autosave.test.js`, `client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx`

**Interfaces:**
- `canvas-autosave.js`: `window.CanvasAutosave = { onDeckChanged() }` — called by `canvas-editor.js` on every mutation (debounced internally, ~1s). Posts `{type:'artifact-deck-updated', deck: window.DECK}` to `window.parent` exactly like the old `deck-editor.js` did — the WIRE PROTOCOL to the host app does not change, only what triggers it and how often.
- `DownloadArtifact.tsx`: the existing `artifact-deck-updated` listener (`setPendingDeck`) is replaced with a save-queue consumer implementing the exact invariants from the design spec's "Autosave" section: at most one `useEditArtifact` mutation in flight; a pending-but-not-yet-fired change coalesces into the next queued save; each save's `original` is the exact `updated` string the previous save in the queue sent (or `artifact.content` for the first); on failure, retry once from current server-confirmed content, then surface a visible "autosave failed" indicator.

- [ ] **This is the most correctness-critical task in the plan.** Write the concurrency test FIRST (TDD, extra rigor): simulate two `artifact-deck-updated` messages arriving within the debounce window, mock `useEditArtifact`'s mutate to resolve asynchronously with realistic latency (e.g. `setTimeout` 50-100ms), and assert: (a) only one mutation is ever in flight at a time (never two concurrent calls), (b) the SECOND call's `original` argument is exactly the FIRST call's `updated` argument (not a stale pre-first-save snapshot), (c) if the mock mutate is made to reject once, the queue retries with the still-correct `original` rather than silently dropping the edit.
- [ ] Implement the queue per the design spec. Remove `pendingDeck` state, the Save button, and `saveEditedDeck` from `DownloadArtifact.tsx` entirely — replace with a small non-blocking "autosave failed, retrying" / "autosave failed" indicator (new localized string, following this file's existing `localize()` convention) shown only on a confirmed double-failure.
- [ ] Run the full `DownloadArtifact.test.tsx` suite and fix any tests that assumed the old explicit-Save flow (several existing tests reference `pendingDeck`/Save button behavior — update them to reflect autosave, don't just delete coverage).
- [ ] Commit: `git commit -m "feat: serialized autosave queue, replacing the explicit Save button"`.

---

## Task 10: `canvas-image-editor.js` — upload + crop/focus-point

**Files:**
- Create: `client/public/libs/canvas-image-editor.js`
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx` or `download-bridge.js` if the upload itself must happen in the parent app context (the deck iframe is cross-origin per `_BRAND_ORIGIN` and likely has no auth token access — investigate this concretely as the first step and document the actual relay mechanism chosen, e.g. postMessage the file to the parent, parent calls Task 2's endpoint with its own auth, parent posts the resulting URL back)
- Test: `client/public/libs/__tests__/canvas-image-editor.test.js` + relevant `DownloadArtifact.test.tsx` additions

**Interfaces:** A modal/sheet (app-neutral chrome) with "Upload" and "Existing assets" tabs, opened from Task 7's image toolbar's "Replace image" button. Selecting an image sets the target element's `brandImage`/`deckAsset` field (reusing `resolveImageRef`-compatible values — no new field type) and closes. Includes a crop/focus-point control that maps to `objectFit`/focus-position (new optional `ElementSpec` fields `focusX`/`focusY`, 0-1, consumed by `deck-schema-renderer.js`'s image branch as `object-position` CSS / re-centered crop in export — this is a small, additive change to that file, write it as part of this task, not Task 1).

- [ ] Investigate and document the cross-origin upload relay mechanism (auth token access from inside the iframe) BEFORE writing UI code — this determines whether the upload button posts a message to the parent or can call the endpoint directly.
- [ ] Implement the modal, both tabs, and the focus-point control.
- [ ] Add `focusX`/`focusY` support to `deck-schema-renderer.js`'s image render/export branches, with jsdom tests.
- [ ] Playwright verification: the modal opens, tab-switches, and an "Existing assets" pick actually updates the canvas's rendered image.
- [ ] Commit: `git commit -m "feat: image upload/crop editor for canvas image elements"`.

---

## Task 11: Swap-in-place template picker ported to the canvas editor

**Files:** Modify `client/public/libs/canvas-editor.js` (port `deck-editor.js`'s `openVariantPopover`/`CURATED_VARIANTS`/`fetchLibrary`/`setSlideComponent` logic, unchanged in behavior).

**Interfaces:** Same as the existing Task 19 behavior from the prior editor — a "Change layout…" affordance opens a thumbnail popover (still using `DeckSchemaRenderer.renderSchemaElements` for genuine live-rendered thumbnails, per the original design) that swaps the CURRENT slide's `elements`/`componentId` in place.

- [ ] Port the existing logic verbatim (read `deck-editor.js` before it's deleted in Task 14 — this task runs BEFORE that deletion specifically so there's a working reference to port from). Adapt only what's needed to fit the Konva chrome/positioning model instead of DOM-sibling positioning.
- [ ] Reuse the existing test suite's assertions (adapted to the new file) — this functionality must not regress.
- [ ] Commit: `git commit -m "feat: port swap-in-place template picker to the canvas editor"`.

---

## Task 12: "+ Add slide" insert-from-template picker

**Files:** Modify `client/public/libs/canvas-editor.js`.

**Interfaces:** A new, separate thumbnail-grid picker (same curated `CURATED_VARIANTS` source, same live-thumbnail-rendering technique as Task 11) that INSERTS a new slide after the current one (via the existing `reorderSlide`-adjacent splice pattern, mirroring `duplicateSlide`'s array-splice discipline) rather than swapping the current slide.

- [ ] Implement per the design spec, explicitly distinct UI/action from Task 11's picker (separate button, separate popover — do not conflate "change this slide" with "add a new slide").
- [ ] jsdom test: triggering an insert with a chosen componentId adds exactly one new slide at `currentIndex + 1` with that componentId's elements, and does not mutate the current slide.
- [ ] Commit: `git commit -m "feat: insert-new-slide-from-template picker"`.

---

## Task 13: Artifact-side wiring — replace `deck-editor.js` script tag, update `download-bridge.js` and the skill template

**Files:**
- Modify: `client/public/libs/download-bridge.js` (`artifact-editor-toggle` handler now targets `window.CanvasEditor.mount`/`unmount` instead of `window.DeckEditor.enableEditing`/`disableEditing`)
- Modify: `agents/presentation-creator.skill.md` (script tag list: remove `deck-editor.js`, add `konva.min.js`, `canvas-editor.js`, `canvas-toolbars.js`, `canvas-image-editor.js`, `canvas-autosave.js`, `canvas-history.js` if it's a separate file per Task 8's implementer choice; update the "structured editor is automatic" paragraph to accurately describe canvas editing instead of contenteditable)

**Interfaces:** No new interfaces — this is pure wiring/documentation.

- [ ] Update `download-bridge.js`'s message handler.
- [ ] Update the skill file's script tag list and prose.
- [ ] Run `download-bridge.test.js` and fix any assertions referencing the old `window.DeckEditor` target.
- [ ] Commit: `git commit -m "chore: wire download-bridge.js and the skill template to the canvas editor"`.

---

## Task 14: Delete `deck-editor.js` and its test file

**Files:**
- Delete: `client/public/libs/deck-editor.js`, `client/public/libs/__tests__/deck-editor.test.js`

**Interfaces:** None — this task only runs once Tasks 3-13 have collectively reached behavioral parity (reorder/duplicate/delete/image-swap/variant-swap/insert-new all exist in the new canvas editor).

- [ ] Confirm (re-read the plan's own task list above) that every capability `deck-editor.js` provided has a canvas-editor equivalent shipped in an earlier task. If ANY gap is found, STOP and report it rather than deleting — do not delete prematurely.
- [ ] Delete both files.
- [ ] Run the full `client/public/libs` suite and confirm nothing else references the deleted file.
- [ ] Commit: `git commit -m "chore: remove the superseded contenteditable-based deck editor"`.

---

## Task 15: Color reconciliation — `#25223B` → `#36314C`

**Files:**
- Modify: `client/public/libs/deck-renderer.js` (every hardcoded `#25223B`/`25223B` in the 19 hand-coded layouts' render/exportPptx functions, plus `injectBaseStyles()`'s `.slide` default background and the title layout's gradient)
- Modify: `brand/palette.md` (correct the documented primary dark background, per `brand/master-deck-layouts.md`'s measured audit — `#36314C` is the actual dominant color at 1,154 uses vs. `#25223B`'s 38)
- Test: `client/public/libs/__tests__/deck-renderer.test.js` (update any test asserting the old color as an expected value)

**Interfaces:** None — pure value substitution, no shape/API change.

- [ ] `grep -n "25223B" client/public/libs/deck-renderer.js` — enumerate every call site (both the CSS hex `#25223B` and the bare PPTX-export hex `25223B` without `#`) before editing, so none are missed.
- [ ] Replace each with `#36314C` / `36314C` respectively. Leave `deck-schema-renderer.js`'s own code untouched (it has no hardcoded background color — schema slides get their background from an authored `shape` element, not a CSS default) — this task is scoped to `deck-renderer.js`'s hand-coded layouts only.
- [ ] Update `brand/palette.md`: correct the primary dark background entry to `#36314C`, demote `#25223B` to a secondary/rare variant, matching the measured counts already documented in `brand/master-deck-layouts.md`.
- [ ] Update any existing test in `deck-renderer.test.js` that hardcodes an expectation of `#25223B`/`25223B` as the background — search for it explicitly (`grep -n "25223B" client/public/libs/__tests__/deck-renderer.test.js`) rather than assuming none exist.
- [ ] Run the full suite, confirm green.
- [ ] Commit: `git commit -m "fix: reconcile hand-coded layout background color with the master deck's actual dominant color"`.

---

## Task 16: Practical componentId reference in the skill file

**Files:**
- Modify: `agents/presentation-creator.skill.md` (the "Schema Layout & the Master Deck Library" section)

**Interfaces:** None — documentation only.

- [ ] Pick one representative `componentId` per category from the skill's existing preference ranges (Title: one of slide-5..9, Agenda: one of slide-18..19, Section: one of slide-21..25, Closing: one of slide-97..100) plus 2-3 from the richer content categories in `brand/master-deck-layouts.md` (e.g. one "Key Takeaways" list, one "Problem/Solution" two-panel, one 6-card infographic grid).
- [ ] For each, pull its actual `elements` array from `client/public/brand/master-deck-library.json` (read the file directly — do not fabricate example content) and embed a short, real excerpt (not the full array if it's very long — truncate with a comment noting more elements exist, but keep enough that the shape/field-name conventions are unambiguous) directly in the skill file, replacing the "`file_search` a 531KB JSON blob" instruction with "here's a real example you can copy and adapt directly."
- [ ] Keep the existing `file_search`-based workflow as a secondary option for finding OTHER variants beyond the embedded examples, but the embedded examples should be the primary, lowest-friction path for the common categories.
- [ ] No tests (documentation-only task) — self-review by reading the final file section for accuracy against the actual JSON.
- [ ] Commit: `git commit -m "docs: replace file_search-only componentId workflow with embedded practical examples"`.

---

## Task 17: Final whole-branch review + real-browser UI/UX pass

Dispatch the final code reviewer (per subagent-driven-development) on the most capable available model, against the full diff from Task 1's BASE through Task 16's HEAD, with this plan's Global Constraints as the attention lens, PLUS a dedicated real-browser UI/UX pass (not just code read-through) specifically checking, per the user's explicit ask for "proper quality control taking into account UI and UX":
(a) does dragging/resizing/rotating feel responsive in a real browser (no visible lag on a multi-element slide),
(b) do floating toolbars stay reachable and correctly clamped at all four viewport edges,
(c) is the autosave-failed indicator visible and clear without being intrusive,
(d) does the whole editor chrome feel visually native to this app (neutral theme, not deck-brand colors) rather than looking bolted-on,
(e) the autosave queue's concurrency invariants (Task 9) hold under a realistic rapid-editing sequence, not just the isolated unit test,
(f) `rotation`/`zIndex` round-trip correctly end-to-end: edit in the canvas → autosave → reload → view-mode DOM render and PPTX export both reflect the same rotation/z-order,
(g) Task 14's deletion of `deck-editor.js` didn't leave any capability gap versus what it used to provide,
(h) the color reconciliation (Task 15) doesn't leave any stray `#25223B` reference anywhere in `deck-renderer.js` or `brand/palette.md`.

Handle findings via the normal fix-loop (one fix dispatch, one scoped re-review, adjudicate residuals) before considering this plan complete.
