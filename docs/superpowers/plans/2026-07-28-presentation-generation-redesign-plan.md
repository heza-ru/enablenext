# Presentation Generation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LLM-authored HTML+CSS+duplicated-`data-*`-attribute presentation format with a JSON-slide-spec content layer, a shared pre-built renderer that produces both the on-screen deck and the native PPTX export from the same source, and an expanded, master-deck-verified layout library.

**Architecture:** Three layers, per `docs/superpowers/specs/2026-07-28-presentation-generation-redesign-design.md`: (1) the LLM emits `window.DECK = { theme, slides: [{ layout, ...fields }] }`; (2) `client/public/libs/deck-renderer.js` — one shared vanilla-JS file, loaded via `<script src>` like `download-bridge.js` — renders that JSON into the visible deck; (3) the same file's `downloadPptx()` reads `window.DECK` directly (no DOM scraping) to build the native PPTX. Each layout is a registry entry with a `render()` function and an `exportPptx()` function sharing one geometry table (see Task 1) — no manual px→EMU math is needed because PptxGenJS's public API already accepts inches directly (confirmed from the current skill's existing `addText`/`addShape` calls, e.g. `{x:.5, y:3.75, w:9.3, h:.6}`); the "canonical conversion" the spec calls for is simply: **one shared per-layout geometry table, in inches, consumed directly by both the CSS renderer (as percentages of the slide container) and PptxGenJS (as its native inch units)** — not manual EMU arithmetic.

**Tech Stack:** Vanilla JS (`deck-renderer.js`, matching the sandboxed-iframe/no-build-step constraint already established for `download-bridge.js`/`pptxgen.bundle.js`), Jest + jsdom (client tests), Markdown (skill file rewrite).

## Global Constraints

- Canvas is fixed at **`SW = 10`in × `SH = 5.625`in** (16:9) — matches the current skill and the master deck's measured slide size exactly. Every layout's geometry table is expressed in inches against this canvas.
- Dark background default: **`#36314C`** ("Ink 800"). Font pairing: **DM Sans primary, IBM Plex Sans secondary** — both per `brand/palette.md`/`brand/typography.md`'s master-deck-verified corrections. Never Aeonik, never `#25223B` as the default (both remain valid for *other*, non-deck contexts — just not the default here).
- `deck-renderer.js` is one file (matching the `download-bridge.js` precedent from the cleanup plan), vanilla JS/DOM, no framework, no build step — loaded from `client/public/libs/deck-renderer.js`.
- No CSS effect with no PPTX equivalent (`backdrop-filter`, `mix-blend-mode`, SVG filters, complex transforms) may appear in any layout's render CSS — this is enforced by construction (the layout registry doesn't expose these as options), not by convention.
- Every layout caps content by construction (e.g. `content` layout: max 3 bullets; `stat` layout: max 3 KPI entries) — the registry must make violating this impossible, not just documented as a rule.
- `multi_product_graphic` (full-bleed brand images) is explicitly **out of scope for this plan** — the spec flagged it as an open design question requiring separate sign-off; do not implement it as part of this plan.

---

### Task 1: Foundational schema, geometry table, and layout registry

**Files:**
- Create: `client/public/libs/deck-renderer.js`
- Create: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Produces: `DeckRenderer.SW = 10`, `DeckRenderer.SH = 5.625` (canvas constants); `DeckRenderer.registerLayout(name, { geometry, render, exportPptx })`; `DeckRenderer.renderDeck(deckSpec, mountEl)`; `DeckRenderer.getLayout(name)` — all attached to a `window.DeckRenderer` global (this file has no module system, consistent with the sandboxed-iframe constraint). Every later task registers its layouts by calling `DeckRenderer.registerLayout(...)` in the same file.
- Consumed by: Tasks 2–6 (each layout's render/export functions), Task 7 (the skill's generated artifact calls `DeckRenderer.renderDeck` and exposes `downloadPptx` built from `DeckRenderer`'s registry).

- [ ] **Step 1: Write a failing test for the layout registry**

```javascript
// client/public/libs/__tests__/deck-renderer.test.js
const fs = require('fs');
const path = require('path');

function loadDeckRenderer() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'deck-renderer.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(src);
  return window.DeckRenderer;
}

describe('DeckRenderer registry', () => {
  it('exposes the canonical canvas dimensions', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(DeckRenderer.SW).toBe(10);
    expect(DeckRenderer.SH).toBe(5.625);
  });

  it('registers and retrieves a layout by name', () => {
    const DeckRenderer = loadDeckRenderer();
    const render = () => {};
    const exportPptx = () => {};
    DeckRenderer.registerLayout('test_layout', { geometry: {}, render, exportPptx });
    const layout = DeckRenderer.getLayout('test_layout');
    expect(layout.render).toBe(render);
    expect(layout.exportPptx).toBe(exportPptx);
  });

  it('throws a clear error for an unregistered layout name', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(() => DeckRenderer.getLayout('does_not_exist')).toThrow(/does_not_exist/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: FAIL — `client/public/libs/deck-renderer.js` doesn't exist yet.

- [ ] **Step 3: Implement the registry skeleton**

```javascript
// client/public/libs/deck-renderer.js
//
// Shared deck renderer + PPTX exporter for LLM-generated presentations.
// Loaded via <script src="/libs/deck-renderer.js"> by the presentation-
// creator skill's generated artifact. The artifact assigns a slide-spec
// JSON to window.DECK; this file turns that into both the visible deck
// (renderDeck) and the native PPTX export (downloadPptx, added in Task 6).
//
// Design: one shared per-layout geometry table (inches, against a fixed
// 10 x 5.625 canvas) drives both the CSS render (as percentages of the
// slide container) and the PPTX export (as PptxGenJS's native inch units)
// — no DOM scraping, no manual EMU math, no duplicated content.
(function () {
  var SW = 10;
  var SH = 5.625;
  var registry = {};

  function registerLayout(name, def) {
    registry[name] = def;
  }

  function getLayout(name) {
    var layout = registry[name];
    if (!layout) {
      throw new Error('DeckRenderer: no layout registered named "' + name + '"');
    }
    return layout;
  }

  window.DeckRenderer = {
    SW: SW,
    SH: SH,
    registerLayout: registerLayout,
    getLayout: getLayout,
  };
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Add the geometry-to-CSS-percentage helper and its test**

This is the shared conversion every layout's `render()` will use — inches → percentage of the `.slide` container:

```javascript
// Add to the test file
describe('inchesToPercent', () => {
  it('converts an inch rect to percentage-of-canvas CSS values', () => {
    const DeckRenderer = loadDeckRenderer();
    const pct = DeckRenderer.inchesToPercent({ x: 5, y: 2.8125, w: 5, h: 2.8125 });
    expect(pct.left).toBe('50%');   // 5 / 10
    expect(pct.top).toBe('50%');    // 2.8125 / 5.625
    expect(pct.width).toBe('50%');
    expect(pct.height).toBe('50%');
  });
});
```

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js` — expect FAIL (function doesn't exist), then implement:

```javascript
  function inchesToPercent(rect) {
    return {
      left: (rect.x / SW) * 100 + '%',
      top: (rect.y / SH) * 100 + '%',
      width: (rect.w / SW) * 100 + '%',
      height: (rect.h / SH) * 100 + '%',
    };
  }
```

Add `inchesToPercent: inchesToPercent,` to the `window.DeckRenderer` object. Run the test again to verify it passes.

- [ ] **Step 6: Add `renderDeck()`, the base slide/deck CSS (including the `content-visibility` performance rule), and a test**

```javascript
// Add to the test file
describe('renderDeck', () => {
  it('mounts one .slide element per spec, tagged with its layout and content-visibility CSS applied', () => {
    const DeckRenderer = loadDeckRenderer();
    DeckRenderer.registerLayout('title', {
      geometry: {},
      render: (spec, slideEl) => {
        slideEl.textContent = spec.title;
      },
      exportPptx: () => {},
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    DeckRenderer.renderDeck({ theme: 'dark', slides: [{ layout: 'title', title: 'Hello' }] }, mount);

    const slides = mount.querySelectorAll('.slide');
    expect(slides.length).toBe(1);
    expect(slides[0].classList.contains('title')).toBe(true);
    expect(slides[0].textContent).toBe('Hello');
  });

  it('throws a clear error if a slide spec names an unregistered layout', () => {
    const DeckRenderer = loadDeckRenderer();
    const mount = document.createElement('div');
    expect(() =>
      DeckRenderer.renderDeck({ slides: [{ layout: 'nonexistent' }] }, mount),
    ).toThrow(/nonexistent/);
  });
});
```

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js` — expect FAIL, then implement:

```javascript
  function injectBaseStyles() {
    if (document.getElementById('deck-renderer-base-styles')) return;
    var style = document.createElement('style');
    style.id = 'deck-renderer-base-styles';
    style.textContent =
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html,body{width:100%;height:100%;overflow:hidden;background:#1a1728;' +
      "font-family:'DM Sans','IBM Plex Sans',-apple-system,sans-serif}" +
      '.deck{width:100vw;height:100vh;position:relative;overflow:hidden}' +
      '.slide{position:absolute;inset:0;opacity:0;background:#36314C;' +
      'content-visibility:auto;contain:layout style paint}' +
      '.slide.active{opacity:1;content-visibility:visible}';
    document.head.appendChild(style);
  }

  function renderDeck(deckSpec, mountEl) {
    injectBaseStyles();
    var deckEl = document.createElement('div');
    deckEl.className = 'deck';
    (deckSpec.slides || []).forEach(function (spec, i) {
      var layout = getLayout(spec.layout); // throws if unregistered — fail loudly, not silently
      var slideEl = document.createElement('section');
      slideEl.className = 'slide ' + spec.layout + (i === 0 ? ' active' : '');
      layout.render(spec, slideEl);
      deckEl.appendChild(slideEl);
    });
    mountEl.innerHTML = '';
    mountEl.appendChild(deckEl);
  }
```

Add `renderDeck: renderDeck,` to the exported object. Run the tests again to verify they pass.

Note: `content-visibility: auto` / `contain: layout style paint` (the Task 4/spec-mandated performance technique) is applied to every `.slide` by default here in the base stylesheet, and only the `.active` slide gets `content-visibility: visible` — this is the low-effort rendering-performance win from the spec, applied once at the shared-CSS level rather than per-layout.

- [ ] **Step 7: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: add deck-renderer.js foundation — layout registry, geometry helper, renderDeck

Establishes the shared per-layout geometry table (inches, shared by
both CSS render and PPTX export) and the layout registry pattern that
every subsequent layout implementation registers into. Base slide
CSS applies content-visibility/contain for off-screen slide perf by
default, per the redesign spec."
```

---

### Task 2: Implement `title` and `content` layouts (render + export + tests) — establishes the pattern

**Files:**
- Modify: `client/public/libs/deck-renderer.js`
- Modify: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Consumes: `DeckRenderer.registerLayout`, `DeckRenderer.inchesToPercent`, `DeckRenderer.SW`/`SH` from Task 1.
- Produces: `title` and `content` entries in the registry, each `{ geometry, render(spec, slideEl), exportPptx(pptxSlide, spec, PptxGenJSCtorHelpers) }`. `exportPptx`'s third parameter is a small helpers object `{ addText, addShape }` bound to the actual PptxGenJS `slide` object passed by `downloadPptx()` in Task 6 — for now, tests call `exportPptx` with a mock slide object recording calls, since the real PptxGenJS library isn't loaded in the jsdom test environment.

- [ ] **Step 1: Write failing tests for the `title` layout's render and export**

```javascript
// Add to client/public/libs/__tests__/deck-renderer.test.js
describe('layout: title', () => {
  it('renders headline and eyebrow text', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('title').render(
      { layout: 'title', title: 'Onboarding time drops 40%', eyebrow: 'Whatfix · CS · Q3 2026' },
      slideEl,
    );
    expect(slideEl.querySelector('h1').textContent).toBe('Onboarding time drops 40%');
    expect(slideEl.querySelector('.eyebrow').textContent).toBe('Whatfix · CS · Q3 2026');
  });

  it('exports a headline text shape at the title layout geometry', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    DeckRenderer.getLayout('title').exportPptx(
      mockSlide,
      { layout: 'title', title: 'Onboarding time drops 40%' },
    );
    const headlineCall = calls.find((c) => c.text === 'Onboarding time drops 40%');
    expect(headlineCall).toBeDefined();
    expect(headlineCall.opts.x).toBeCloseTo(0.55, 2);
    expect(headlineCall.opts.fontSize).toBeGreaterThanOrEqual(32); // master deck / spec minimum for hero title
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: FAIL — `title` layout isn't registered yet.

- [ ] **Step 3: Implement the `title` layout**

Geometry ported directly from the current skill's title slide CSS (`agents/presentation-creator.skill.md` lines 271-308) and PPTX minimum-size table (lines 119-127: title hero 32-40pt):

```javascript
  registerLayout('title', {
    geometry: {
      headline: { x: 0.55, y: 3.2, w: 6.5, h: 1.6 },
      eyebrow: { x: 0.55, y: 2.85, w: 6.5, h: 0.3 },
      subtitle: { x: 0.55, y: 4.6, w: 5.5, h: 0.6 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText =
        'display:flex;flex-direction:column;justify-content:flex-end;' +
        'padding:2.5rem 3rem 3rem;' +
        'background:linear-gradient(150deg,#36314C 0%,#3f3a56 60%,#48425f 100%);';
      var eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.style.cssText = "font-size:.65rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#FF6B18;margin-bottom:.85rem;font-family:'DM Sans',sans-serif;";
      eyebrow.textContent = spec.eyebrow || '';
      var h1 = document.createElement('h1');
      h1.style.cssText = "font-size:clamp(2.2rem,4.5vw,3.8rem);font-weight:500;color:#fff;line-height:1.12;max-width:14ch;margin-bottom:1rem;letter-spacing:-.02em;font-family:'DM Sans',sans-serif;";
      h1.textContent = spec.title || '';
      var subtitle = document.createElement('p');
      subtitle.style.cssText = "font-size:clamp(.9rem,1.5vw,1.1rem);font-weight:300;color:rgba(255,255,255,.5);max-width:40ch;line-height:1.65;font-family:'DM Sans',sans-serif;";
      subtitle.textContent = spec.subtitle || '';
      slideEl.appendChild(eyebrow);
      slideEl.appendChild(h1);
      slideEl.appendChild(subtitle);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.title.geometry;
      if (spec.eyebrow) {
        pptxSlide.addText(spec.eyebrow, {
          x: g.eyebrow.x, y: g.eyebrow.y, w: g.eyebrow.w, h: g.eyebrow.h,
          fontSize: 10, color: 'FF6B18', fontFace: 'DM Sans', bold: true,
        });
      }
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 36, color: 'FFFFFF', fontFace: 'DM Sans', bold: false,
      });
      if (spec.subtitle) {
        pptxSlide.addText(spec.subtitle, {
          x: g.subtitle.x, y: g.subtitle.y, w: g.subtitle.w, h: g.subtitle.h,
          fontSize: 13, color: 'CCCCCC', fontFace: 'DM Sans',
        });
      }
    },
  });
```

- [ ] **Step 4: Run the tests, verify `title` passes, write failing tests for `content`**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js` — the `title` tests should now PASS.

Add content-layout tests, enforcing the 3-bullet structural cap **by construction**:

```javascript
describe('layout: content', () => {
  it('renders a headline and up to 3 bullets, silently dropping any beyond 3', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('content').render(
      {
        layout: 'content',
        title: 'Onboarding time drops 40% in week one',
        bullets: ['First point', 'Second point', 'Third point', 'Fourth point — should be dropped'],
      },
      slideEl,
    );
    const items = slideEl.querySelectorAll('ul li');
    expect(items.length).toBe(3);
    expect(items[2].textContent).toContain('Third point');
  });

  it('exports the same 3-bullet cap to PPTX', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    DeckRenderer.getLayout('content').exportPptx(mockSlide, {
      layout: 'content',
      title: 'Headline',
      bullets: ['One', 'Two', 'Three', 'Four'],
    });
    const bulletCalls = calls.filter((c) => typeof c.text === 'string' && ['One', 'Two', 'Three', 'Four'].includes(c.text));
    expect(bulletCalls.length).toBe(3);
    expect(bulletCalls.map((c) => c.text)).not.toContain('Four');
  });
});
```

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js` — expect the new `content` tests to FAIL.

- [ ] **Step 5: Implement the `content` layout with the structural 3-bullet cap**

Ported from `agents/presentation-creator.skill.md` lines 360-381 (CSS) and the existing `downloadPptx()`'s content-slide handling:

```javascript
  registerLayout('content', {
    geometry: {
      headline: { x: 0.55, y: 0.5, w: 8.9, h: 0.9 },
      bullets: { x: 0.55, y: 1.7, w: 8.9, h: 3.4 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.3rem,2.4vw,2rem);font-weight:500;color:#FF6B18;line-height:1.2;margin-bottom:1.75rem;max-width:30ch;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;display:flex;flex-direction:column;gap:.8rem;';
      // Structural cap: only the first 3 bullets are ever rendered, regardless
      // of how many the LLM emitted — this makes the "max 3 bullets" content
      // rule impossible to violate rather than merely documented.
      (spec.bullets || []).slice(0, 3).forEach(function (text) {
        var li = document.createElement('li');
        li.style.cssText = "display:flex;align-items:flex-start;gap:1rem;font-size:clamp(.85rem,1.5vw,1.05rem);font-weight:300;color:rgba(255,255,255,.82);line-height:1.6;font-family:'DM Sans',sans-serif;";
        var dot = document.createElement('span');
        dot.style.cssText = 'width:5px;height:5px;border-radius:50%;background:#FF6B18;flex-shrink:0;margin-top:.5rem;';
        li.appendChild(dot);
        li.appendChild(document.createTextNode(text));
        ul.appendChild(li);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(ul);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.content.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 22, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var bullets = (spec.bullets || []).slice(0, 3); // same structural cap as render()
      var rowH = g.bullets.h / 3;
      bullets.forEach(function (text, i) {
        pptxSlide.addText(text, {
          x: g.bullets.x, y: g.bullets.y + i * rowH, w: g.bullets.w, h: rowH,
          fontSize: 15, color: 'FFFFFF', fontFace: 'DM Sans',
        });
      });
    },
  });
```

- [ ] **Step 6: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS (all tests, both new and from Task 1).

- [ ] **Step 7: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: implement title and content layouts — establishes the render+export pattern

Each layout is a registry entry with a shared inch-based geometry
table, a render() producing the visible DOM, and an exportPptx()
using the same geometry against PptxGenJS's native inches API. The
content layout's 3-bullet cap is enforced by construction (both
functions .slice(0, 3)) rather than left to LLM discretion — the
pattern every remaining layout in Tasks 3-5 follows."
```

---

### Task 3: Implement `stat`, `two_col`, and `comparison` layouts (render + export + tests)

**Files:**
- Modify: `client/public/libs/deck-renderer.js`
- Modify: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Consumes: same as Task 2.
- Produces: `stat`, `two_col`, `comparison` registry entries — covering the KPI/big-number pattern, the split-column pattern, and the tabular pattern respectively (the three remaining structurally-distinct shapes needed before the mechanical port in Task 4).

- [ ] **Step 1: Write failing tests for all three layouts**

```javascript
// Add to client/public/libs/__tests__/deck-renderer.test.js
describe('layout: stat', () => {
  it('caps at 3 KPI entries by construction', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('stat').render(
      {
        layout: 'stat',
        stats: [
          { value: '40%', label: 'A' }, { value: '3x', label: 'B' },
          { value: '92%', label: 'C' }, { value: '10x', label: 'D — dropped' },
        ],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('.kpi').length).toBe(3);
  });
});

describe('layout: two_col', () => {
  it('renders left bullets and a right-column slot', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('two_col').render(
      { layout: 'two_col', title: 'Headline', bullets: ['One', 'Two'] },
      slideEl,
    );
    expect(slideEl.querySelectorAll('.col-left li').length).toBe(2);
    expect(slideEl.querySelector('.col-right')).not.toBeNull();
  });
});

describe('layout: comparison', () => {
  it('renders a table with a header row and one row per data row', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('comparison').render(
      {
        layout: 'comparison',
        title: 'We out-perform on the metrics that matter',
        headers: ['Feature', 'Whatfix', 'Competitor A'],
        rows: [['In-app guidance', '✓', '✗']],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('thead th').length).toBe(3);
    expect(slideEl.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('exports one PPTX table shape with the same header/row data', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addTable: (rows, opts) => calls.push({ rows, opts }) };
    DeckRenderer.getLayout('comparison').exportPptx(mockSlide, {
      layout: 'comparison',
      headers: ['Feature', 'Whatfix'],
      rows: [['In-app guidance', '✓']],
    });
    expect(calls.length).toBe(1);
    expect(calls[0].rows[0]).toEqual(['Feature', 'Whatfix']); // header row first
    expect(calls[0].rows[1]).toEqual(['In-app guidance', '✓']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: FAIL — none of the three layouts exist yet.

- [ ] **Step 3: Implement `stat`** (ported from `agents/presentation-creator.skill.md` lines 416-428)

```javascript
  registerLayout('stat', {
    geometry: { row: { x: 0.5, y: 2.0, w: 9, h: 2.0 } },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#3f3a56;text-align:center;';
      var grid = document.createElement('div');
      grid.className = 'kpi-grid';
      grid.style.cssText = 'display:flex;gap:clamp(2rem,6vw,6rem);align-items:flex-end;flex-wrap:wrap;justify-content:center;';
      (spec.stats || []).slice(0, 3).forEach(function (stat) { // structural cap: max 3
        var kpi = document.createElement('div');
        kpi.className = 'kpi';
        kpi.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.4rem;';
        var big = document.createElement('span');
        big.style.cssText = "font-size:clamp(3rem,8vw,5.5rem);font-weight:700;color:#FF6B18;font-family:'DM Sans',sans-serif;";
        big.textContent = stat.value;
        var label = document.createElement('span');
        label.style.cssText = "font-size:clamp(.72rem,1.2vw,.9rem);color:rgba(255,255,255,.45);max-width:13ch;text-align:center;font-family:'DM Sans',sans-serif;";
        label.textContent = stat.label;
        kpi.appendChild(big);
        kpi.appendChild(label);
        grid.appendChild(kpi);
      });
      slideEl.appendChild(grid);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.stat.geometry;
      var stats = (spec.stats || []).slice(0, 3);
      var colW = g.row.w / Math.max(stats.length, 1);
      stats.forEach(function (stat, i) {
        pptxSlide.addText(stat.value, {
          x: g.row.x + i * colW, y: g.row.y, w: colW, h: 1.2,
          fontSize: 44, bold: true, color: 'FF6B18', fontFace: 'DM Sans', align: 'center',
        });
        pptxSlide.addText(stat.label, {
          x: g.row.x + i * colW, y: g.row.y + 1.2, w: colW, h: 0.7,
          fontSize: 11, color: 'CCCCCC', fontFace: 'DM Sans', align: 'center',
        });
      });
    },
  });
```

- [ ] **Step 4: Implement `two_col`** (ported from lines 383-414)

```javascript
  registerLayout('two_col', {
    geometry: {
      headline: { x: 0.55, y: 0.5, w: 8.9, h: 0.8 },
      left: { x: 0.55, y: 1.5, w: 4.8, h: 3.6 },
      right: { x: 5.7, y: 1.3, w: 3.9, h: 3.7 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.3rem,2.4vw,2rem);font-weight:500;color:#FF6B18;margin-bottom:1.5rem;max-width:34ch;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var cols = document.createElement('div');
      cols.style.cssText = 'display:flex;gap:3vw;align-items:stretch;';
      var left = document.createElement('ul');
      left.className = 'col-left';
      left.style.cssText = 'list-style:none;flex:1.1;display:flex;flex-direction:column;gap:.75rem;';
      (spec.bullets || []).slice(0, 4).forEach(function (text) {
        var li = document.createElement('li');
        li.style.cssText = "font-size:clamp(.82rem,1.45vw,1.02rem);font-weight:300;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;";
        li.textContent = text;
        left.appendChild(li);
      });
      var right = document.createElement('div');
      right.className = 'col-right';
      right.style.cssText = 'flex:.9;background:#4a4560;border-radius:10px;';
      if (spec.rightBrandImage) {
        var img = document.createElement('img');
        img.src = '/brand/' + spec.rightBrandImage + '.svg';
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        right.appendChild(img);
      }
      cols.appendChild(left);
      cols.appendChild(right);
      slideEl.appendChild(h2);
      slideEl.appendChild(cols);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.two_col.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 22, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var bullets = (spec.bullets || []).slice(0, 4);
      var rowH = g.left.h / Math.max(bullets.length, 1);
      bullets.forEach(function (text, i) {
        pptxSlide.addText(text, {
          x: g.left.x, y: g.left.y + i * rowH, w: g.left.w, h: rowH,
          fontSize: 14, color: 'FFFFFF', fontFace: 'DM Sans',
        });
      });
      if (spec.rightBrandImage) {
        pptxSlide.addImage({
          path: '/brand/' + spec.rightBrandImage + '.svg',
          x: g.right.x, y: g.right.y, w: g.right.w, h: g.right.h,
        });
      }
    },
  });
```

- [ ] **Step 5: Implement `comparison`** (ported from lines 483-511, generalized per the spec to also cover the master deck's plain `tables` category)

```javascript
  registerLayout('comparison', {
    geometry: { table: { x: 0.55, y: 1.4, w: 8.9, h: 3.6 } },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 3.5rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.25rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;';
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      (spec.headers || []).forEach(function (headerText) {
        var th = document.createElement('th');
        th.style.cssText = "padding:.5rem .9rem;font-size:.85rem;color:rgba(255,255,255,.6);text-align:left;font-family:'DM Sans',sans-serif;";
        th.textContent = headerText;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      var tbody = document.createElement('tbody');
      (spec.rows || []).forEach(function (row) {
        var tr = document.createElement('tr');
        row.forEach(function (cell) {
          var td = document.createElement('td');
          td.style.cssText = "padding:.45rem .9rem;font-size:.88rem;color:rgba(255,255,255,.78);font-family:'DM Sans',sans-serif;";
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      slideEl.appendChild(h2);
      slideEl.appendChild(table);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.comparison.geometry;
      var tableRows = [(spec.headers || [])].concat(spec.rows || []);
      pptxSlide.addTable(tableRows, {
        x: g.table.x, y: g.table.y, w: g.table.w, h: g.table.h,
        fontSize: 11, fontFace: 'DM Sans', color: 'FFFFFF',
        border: { type: 'solid', color: '4a4560', pt: 0.5 },
      });
    },
  });
```

- [ ] **Step 6: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: implement stat, two_col, and comparison layouts

Covers the three remaining structurally-distinct shapes (KPI grid,
split column, tabular) needed before Task 4's mechanical port of the
rest. comparison generalizes to double as the master deck's plain
tables category, per the redesign spec."
```

---

### Task 4: Port the remaining 9 carried-over layout types

**Files:**
- Modify: `client/public/libs/deck-renderer.js`
- Modify: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Consumes: same registry pattern as Tasks 2-3.
- Produces: `agenda`, `section`, `quote`, `split`, `chart`, `process`, `icon_grid`, `timeline`, `closing` registry entries.

This task is a mechanical repetition of the pattern fully established in Tasks 2-3 — same registry shape, same "geometry table + render + exportPptx, structural caps applied via `.slice()`" approach, just applied to 9 more layouts whose exact source CSS/PPTX code already exists in `agents/presentation-creator.skill.md`. Each layout below gets its own render/export implementation ported from the cited lines, its own test (following the exact test shapes from Tasks 2-3 — content check + structural-cap check where applicable), and one combined commit at the end (a reviewer evaluates this whole task as one "port the rest of the vocabulary" deliverable, per its uniform mechanical nature — see plan header's Task Right-Sizing note).

- [ ] **Step 1: For each layout below, write a failing render test (and export test where the layout has a structural cap), following the exact test shape from Task 2/3's examples**: assert the right DOM elements/classes exist with the right text content for `render()`, and assert `exportPptx()` calls the right mock method with position/content matching the geometry table. Do this for all 9 before implementing any of them, then run `cd client && npx jest public/libs/__tests__/deck-renderer.test.js` once to confirm all 9 new test blocks fail.

- [ ] **Step 2: Implement `agenda`** — source: `agents/presentation-creator.skill.md` lines 310-333 (CSS) and its `data-items` PPTX handling in the existing `downloadPptx()`. Structural cap: up to 12 items (widened from the current skill's unbounded list per the master-deck-verified range in the redesign spec — master deck slides 17-19 show up to 12 session+time pairs). Numbered list with counter bubbles; PPTX export as a stacked text-row list, one row per item.

- [ ] **Step 3: Implement `section`** — source: lines 335-358. Two-panel layout (left dark text panel, right solid-orange panel); PPTX export as two text boxes plus a solid-fill rectangle shape for the right panel.

- [ ] **Step 4: Implement `quote`** — source: lines 430-443. Centered blockquote with a large decorative quotation-mark glyph and a `cite` attribution line; PPTX export as a large italic text box plus a smaller bold attribution text box.

- [ ] **Step 5: Implement `split`** — source: line 148's description in the Layout Variety list (`split` — full-bleed left panel dark with text, right panel Orange/Crimson with brand visual) plus the closest matching existing CSS pattern (`section`'s two-panel structure, generalized to take a solid or gradient fill for the right panel plus optional brand image). PPTX export mirrors `section`'s shape+text approach, adding an optional `addImage` call for the right panel's brand visual.

- [ ] **Step 6: Implement `chart`** — source: the "chart" entry in the Layout Variety list (line 149: horizontal bar chart with value labels and percentage bars, built from inline HTML). Render as a set of `<div>` bars with inline `width: X%` styles sized from each data point's value relative to the max; PPTX export as a set of thin filled rectangle shapes (`addShape` with `ShapeType.rect`) sized the same way, plus a text label per bar.

- [ ] **Step 7: Implement `process`** — source: lines 513-546. Horizontal numbered step flow (3-5 steps) with connector lines between steps; PPTX export as a row of numbered circle shapes (`addShape` with `ShapeType.ellipse`) plus label/description text boxes, evenly spaced across the geometry table's width.

- [ ] **Step 8: Implement `icon_grid`** — source: lines 548-577. Grid of feature cards (2×2 or 3×2, and per the redesign spec's widened range, 2-6 cards total) each with an inline SVG icon, bold label, and description; PPTX export as a grid of rounded-rectangle card shapes with icon-color accent fills and stacked text boxes per card.

- [ ] **Step 9: Implement `timeline`** — source: lines 579-613. Vertical milestone timeline with alternating date markers and a connecting line; PPTX export as a vertical line shape plus per-milestone dot shapes and date/title/body text box triples.

- [ ] **Step 10: Implement `closing`** — source: lines 445-470. Centered closing slide with an optional CTA button; PPTX export as centered headline/body text boxes plus, if `spec.cta` is present, a filled rounded-rectangle shape with centered button-label text (matching the existing skill's CTA button PPTX code, visible in the earlier-read `downloadPptx()` excerpt around line 1301-1304).

- [ ] **Step 11: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS (all tests across all layouts implemented so far).

- [ ] **Step 12: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: port remaining 9 carried-over layouts (agenda, section, quote, split, chart, process, icon_grid, timeline, closing)

Mechanical port of the pattern established in Tasks 2-3, sourced
directly from the existing agents/presentation-creator.skill.md CSS
and PPTX code. agenda widened to 12 items and icon_grid to 2-6 cards
per the master-deck-verified ranges in the redesign spec."
```

---

### Task 5: Implement the 5 new master-deck-sourced layouts

**Files:**
- Modify: `client/public/libs/deck-renderer.js`
- Modify: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Consumes: same registry pattern.
- Produces: `case_study`, `mockup`, `matrix_2x2`, `event_speaker`, `objective` registry entries.

These 5 layouts have no existing implementation to port from — `brand/master-deck-layouts.md` is the source, and per that catalog's own stated methodology, exact geometry must be read directly from the referenced slide numbers in `brand/Copy of Master Deck 2026.pptx` rather than guessed. For each layout below: open the pptx to the cited slide, note the actual shape positions (File → the pptx is a zip; `unzip -p "brand/Copy of Master Deck 2026.pptx" ppt/slides/slideN.xml` and read the `<a:off>`/`<a:ext>` EMU values, dividing by 914400 to get inches — same technique used during the spec's own verification, documented in this repo's session history) to populate each layout's geometry table, then follow the same render/export/test pattern as every prior task.

- [ ] **Step 1: Implement `case_study`** — master deck slides 38-39. Fields: `challenge`, `solution`, `results` (each a labeled text block), `cta` (optional button, reusing `closing`'s CTA button PPTX pattern from Task 4 Step 10), `metadata` (optional `{ industry, region, solution }` triple). Write the render test asserting all three labeled blocks render with their label text (`THE CHALLENGE`/`THE SOLUTION`/`KEY RESULTS WITH WHATFIX`, matching the master deck's actual copy verified in `brand/master-deck-layouts.md`), then implement using geometry read from slide 39's actual shape positions.

- [ ] **Step 2: Implement `mockup`** — master deck slides 93-95. Fields: `device` (`"desktop"` or `"mobile"`), `screenshotBrandImage` (optional image key, same resolution convention as `two_col`'s `rightBrandImage`). Render a device-frame `<div>` (rounded-rectangle bezel matching the device type) containing the screenshot image; PPTX export as a rounded-rectangle shape plus an `addImage` inset to the frame's screen area. Write the render test asserting the correct bezel class (`device-desktop` vs `device-mobile`) is applied based on the `device` field.

- [ ] **Step 3: Implement `matrix_2x2`** — master deck slide 68. Fields: `xAxisLabel`, `yAxisLabel`, `quadrants` (array of exactly 4: `{ label, items }, ` one per quadrant, top-left/top-right/bottom-left/bottom-right). Write the render test asserting exactly 4 quadrant `<div>`s render regardless of how many quadrant entries are passed (structural cap at 4, same `.slice(0, 4)` pattern as `stat`'s 3-KPI cap); implement using geometry read from slide 68 (the frequency × complexity matrix), generalizing the two axis labels and 4 quadrant contents to arbitrary content per the spec's structured-data approach.

- [ ] **Step 4: Implement `event_speaker`** — master deck slides 11-16. Fields: `eventName`, `date`, `location` (for the event-cover variant) OR `speakers` (array of `{ name, title, company }`, for the speaker-card variant — cap at 4 per the master deck's Panel Discussion 4-card layout, same structural-cap pattern). Write render tests for both variants (event-cover renders date/location text; speaker variant renders one card per speaker up to 4), then implement both using geometry read from slides 11 (event cover) and 16 (panel discussion cards).

- [ ] **Step 5: Implement `objective`** — master deck slides 31-33. Fields: `label` (e.g. "Objective"), `body` (a single paragraph — no bullet-splitting, unlike `content`). Write the render test asserting the full `body` text renders as one paragraph (not split into list items), then implement using geometry read from slide 31.

- [ ] **Step 6: Run all tests, verify everything passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS (all tests across every layout implemented in Tasks 2-5).

- [ ] **Step 7: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: implement 5 master-deck-sourced layouts (case_study, mockup, matrix_2x2, event_speaker, objective)

Geometry read directly from the referenced slide numbers in
brand/Copy of Master Deck 2026.pptx per brand/master-deck-layouts.md's
own verification methodology, not guessed. Completes the full 19-type
layout registry (14 carried over + 5 new) specified in the redesign
spec."
```

---

### Task 6: Wire `downloadPptx()` — the export entrypoint reading `window.DECK` directly

**Files:**
- Modify: `client/public/libs/deck-renderer.js`
- Modify: `client/public/libs/__tests__/deck-renderer.test.js`

**Interfaces:**
- Consumes: every layout's `exportPptx()` from Tasks 2-5, `window.DECK` (set by the artifact's own inline `<script>` per Task 7).
- Produces: `DeckRenderer.downloadPptx()` — async, matching the existing `downloadPptx` contract that `DownloadArtifact.tsx`'s `NATIVE_FORMATS` detection and `download-bridge.js` (from the cleanup plan) both expect: a global function name whose invocation ultimately triggers a `<a download>` click on a blob URL.

- [ ] **Step 1: Write a failing test asserting `downloadPptx` iterates `window.DECK.slides` and calls each slide's registered `exportPptx`**

```javascript
// Add to client/public/libs/__tests__/deck-renderer.test.js
describe('downloadPptx', () => {
  it('calls addSlide + the matching layout exportPptx once per slide in window.DECK', async () => {
    const DeckRenderer = loadDeckRenderer();
    const exportCalls = [];
    DeckRenderer.registerLayout('test_export_layout', {
      geometry: {},
      render: () => {},
      exportPptx: (pptxSlide, spec) => exportCalls.push(spec),
    });

    const addedSlides = [];
    // eslint-disable-next-line no-undef
    global.PptxGenJS = function () {
      return {
        layout: null,
        addSlide: () => {
          const slide = {};
          addedSlides.push(slide);
          return slide;
        },
        write: async () => new Blob(['fake pptx bytes']),
      };
    };
    window.PptxGenJS = global.PptxGenJS;

    window.DECK = {
      title: 'Test Deck',
      slides: [
        { layout: 'test_export_layout', title: 'A' },
        { layout: 'test_export_layout', title: 'B' },
      ],
    };

    await DeckRenderer.downloadPptx();

    expect(addedSlides.length).toBe(2);
    expect(exportCalls).toEqual([{ layout: 'test_export_layout', title: 'A' }, { layout: 'test_export_layout', title: 'B' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: FAIL — `downloadPptx` doesn't exist yet.

- [ ] **Step 3: Implement `downloadPptx`**

```javascript
  async function downloadPptx() {
    var deck = window.DECK;
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // matches SW=10/SH=5.625
    (deck.slides || []).forEach(function (spec) {
      var layout = getLayout(spec.layout);
      var pptxSlide = pptx.addSlide();
      layout.exportPptx(pptxSlide, spec);
    });
    var blob = await pptx.write({ outputType: 'blob' });
    var slug = (deck.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
```

Add `downloadPptx: downloadPptx,` to the exported `window.DeckRenderer` object, **and** expose it as a bare global too — `window.downloadPptx = downloadPptx;` — since `DownloadArtifact.tsx`'s `NATIVE_FORMATS` detection (`{ label: 'PPTX', ext: 'pptx', triggerFn: 'downloadPptx' }`) looks up `window['downloadPptx']` directly, not `window.DeckRenderer.downloadPptx`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest public/libs/__tests__/deck-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/public/libs/deck-renderer.js client/public/libs/__tests__/deck-renderer.test.js
git commit -m "feat: wire downloadPptx() — reads window.DECK directly, no DOM scraping

Also exposed as a bare window.downloadPptx global, matching the
existing NATIVE_FORMATS detection contract in DownloadArtifact.tsx.
This is the concrete fix for the visible-HTML/data-attribute sync
bug the redesign spec identified — there is now only one
representation (window.DECK), consumed identically by renderDeck()
and downloadPptx()."
```

---

### Task 7: Rewrite `agents/presentation-creator.skill.md`'s Step 2 to emit the new JSON format

**Files:**
- Modify: `agents/presentation-creator.skill.md`

**Interfaces:**
- Consumes: the full `deck-renderer.js` registry from Tasks 1-6 (all 19 layout names and their expected field shapes).
- Produces: the new artifact HTML shape the LLM emits — no automated test (this is prompt-template markdown, not application code); verified manually in Task 8.

- [ ] **Step 1: Rewrite the "Output Format" and "Full HTML Template" sections**

Keep the file's Step 1 (structure-proposal workflow, lines 14-49) completely unchanged — it's a content/UX concern, unaffected by this rewrite. Replace everything from "## Output Format — MANDATORY" (line 52) through the end of the "Full HTML Template — Dark Deck" section (originally ending around line 1341, per the file read during spec/plan research) with:

```markdown
## Output Format — MANDATORY

ALWAYS deliver the HTML inside an artifact block. NEVER output it as a plain code block.

    :::artifact{identifier="whatfix-presentation" type="text/html" title="PRESENTATION TITLE"}
    ```
    <!DOCTYPE html>
    ...full HTML...
    ```
    :::

Use a descriptive kebab-case identifier (e.g. `whatfix-q3-roadmap`). Reuse the same identifier when updating an existing presentation.

## Artifact Shape — MANDATORY

The artifact body is now data, not hand-authored HTML/CSS. Emit exactly this shape:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PRESENTATION_TITLE</title>
<script src="/libs/download-bridge.js"></script>
<script src="/libs/deck-renderer.js"></script>
</head>
<body>
<div id="deck-root"></div>
<script>
window.DECK = {
  "title": "PRESENTATION_TITLE",
  "slides": [
    { "layout": "title", "title": "Your action title here", "eyebrow": "Whatfix · Department · Month Year", "subtitle": "One sentence of context." }
    /* ...one entry per slide... */
  ]
};
DeckRenderer.renderDeck(window.DECK, document.getElementById('deck-root'));
</script>
</body>
</html>
\`\`\`

**Never write CSS, positioning, or duplicated content in the artifact.** Every slide is one object in `slides[]` with a `layout` field (from the table below) and that layout's content fields — nothing else. `deck-renderer.js` (loaded from `/libs/`, never regenerated) owns every visual decision.

## Layout Reference

| `layout` | Fields | Use for |
|---|---|---|
| `title` | `title`, `eyebrow`, `subtitle` | Deck cover |
| `agenda` | `items` (array of `{label, time?}`, up to 12) | Session/section overview |
| `section` | `title`, `secnum` | Chapter break |
| `content` | `title`, `bullets` (up to 3) | Bulleted explanation |
| `two_col` | `title`, `bullets` (up to 4), `rightBrandImage?` | Context + visual |
| `stat` | `stats` (up to 3, each `{value, label}`) | KPI callout |
| `quote` | `text`, `cite` | Pull quote |
| `split` | `title`, `bullets`, `rightFill`, `rightBrandImage?` | Full-bleed two-panel |
| `chart` | `title`, `bars` (each `{label, value}`) | Simple bar comparison |
| `comparison` | `title`, `headers`, `rows` | Feature/competitor table |
| `process` | `title`, `steps` (3-5, each `{label, desc}`) | Sequential workflow |
| `icon_grid` | `title`, `cards` (2-6, each `{icon, title, desc}`) | Feature/capability grid |
| `timeline` | `title`, `milestones` (each `{date, title, body}`) | Roadmap/history |
| `closing` | `title`, `body`, `cta?` | Deck close |
| `case_study` | `challenge`, `solution`, `results`, `cta?`, `metadata?` | Customer case study |
| `mockup` | `device` (`"desktop"`\|`"mobile"`), `screenshotBrandImage?` | Product screenshot |
| `matrix_2x2` | `xAxisLabel`, `yAxisLabel`, `quadrants` (exactly 4) | Strategic framework |
| `event_speaker` | `eventName`+`date`+`location` OR `speakers` (up to 4) | Event/panel slide |
| `objective` | `label`, `body` | Single-paragraph context block |

Every content rule from the previous version of this skill (action titles, one-idea-per-slide, layout variety, whitespace) is now enforced by `deck-renderer.js` itself — the caps above (max 3 bullets, max 3 stats, etc.) are structural, not suggestions. Still write good `title`/`headline` copy — the schema doesn't write your words for you, it just guarantees the layout can't be violated.
```

- [ ] **Step 2: Update the CRITICAL Rules and Content Rules sections to reference the schema instead of raw CSS/PPTX instructions**

Remove every rule that only made sense for hand-authored CSS/PPTX code (the PptxGenJS v4 gotchas — `addFont()`, async `writeFile()`, hex-color-without-`#`, option-object-reuse — all now live inside `deck-renderer.js`, not in LLM-authored code, so the LLM never needs to know them). Keep and rephrase the rules that are still genuinely about content decisions the LLM makes:

```markdown
## CRITICAL Rules

- **NO EMOJIS** — ever.
- **Every slide is one object in `DECK.slides[]`** — never write raw HTML/CSS for slide content, only the artifact shape above.
- **Pick the layout that matches the content**, not the one that's easiest to write — see Layout Reference above.

## Content Rules (apply before writing any slide spec)

1. **Action titles** — every `title`/`headline` field is a complete sentence stating the takeaway. Ghost deck test: reading only the titles in sequence must tell the full story.
2. **One idea per slide** — if a slide needs two conclusions, split it into two slide objects.
3. **Trust the schema's caps** — `content` accepts more than 3 bullets but only the first 3 render; if you have more than 3 points, that's two slides, not one.
4. **Top-down structure** — key message first.
5. **Varied layouts** — never repeat the same `layout` value on consecutive slides.
```

- [ ] **Step 3: Update the "Brand Graphics" section's PPTX-attribute instructions**

The existing `data-brand-image`/`data-bi-x`/`data-bi-y`/`data-bi-w`/`data-bi-h` attribute instructions (lines 185-193 of the original file) are obsolete — brand images are now just a `rightBrandImage`/`screenshotBrandImage` field on the relevant layout's spec object, with geometry owned entirely by `deck-renderer.js`. Replace that subsection with:

```markdown
### Using brand images

Pass the asset key (filename without extension, e.g. `"authoring-agent-dark"`) as the relevant field on a layout that accepts one (`two_col.rightBrandImage`, `mockup.screenshotBrandImage`). `deck-renderer.js` resolves the key against `/brand/` and handles sizing/positioning — you never specify coordinates.
```

- [ ] **Step 4: Commit**

```bash
git add agents/presentation-creator.skill.md
git commit -m "refactor: rewrite presentation-creator skill around the JSON slide-spec schema

Step 1 (structure proposal) is unchanged. Step 2 now emits window.DECK
+ two <script src> tags instead of a full hand-authored HTML/CSS/PPTX
document — the direct fix for the token/generation-speed problem the
redesign spec identified. CRITICAL/Content Rules trimmed to what's
still an LLM content decision; everything about CSS, PptxGenJS
gotchas, and brand-image coordinates now lives in deck-renderer.js
and is no longer the LLM's concern."
```

---

### Task 8: End-to-end verification

**Files:** none modified — this task is entirely verification, matching the redesign spec's Testing / Verification section.

**Interfaces:** none — terminal task.

- [ ] **Step 1: Generate a representative deck under the new skill and check the visible render**

Prompt the chatbot for a presentation covering a mix of layout types (at minimum: title, content, stat, two_col, comparison, and one of the Task 5 new types). Confirm the artifact renders correctly in the side panel — check that `content-visibility`/inactive-slide styling doesn't cause any visible flicker or missing content when navigating between slides.

- [ ] **Step 2: Export to PPTX and check fidelity in both Google Slides and PowerPoint (if available)**

Click "PPTX", open the result in Google Slides (upload or drag-and-drop). Confirm: text is editable (not an image), fonts render as DM Sans (falling back cleanly, not reflowing badly, if Google Slides substitutes), colors match Ink 800 `#36314C` background / Orange `#FF6B18` accents, and every slide's layout matches its on-screen render structurally (position/size may have minor differences per the spec's "practical fidelity, not pixel-matching" framing — but nothing should be in the wrong place, wrong color, or missing).

- [ ] **Step 3: Regression-check against the cleanup plan's large-deck fix**

Generate a 40+ slide deck under the new skill and click "PPTX" (the native export, not "PPTX (HD)"). Confirm this is now fast — since `downloadPptx()` is JSON-driven with no per-slide screenshot capture, it should complete in a small fraction of the time the old html2canvas-based "HD" path took for the same slide count, and shouldn't hit any timeout at all (there's no capture loop in this path to time out).

- [ ] **Step 4: Measure the token/speed improvement**

Using the same prompt, generate one deck under the pre-redesign skill (check out the previous commit of `agents/presentation-creator.skill.md` temporarily, or compare against a chat history example from before this plan) and one under the new skill. Compare: total tokens in the artifact's `slides[]` JSON vs. the old full HTML+CSS+`data-*` markup, and wall-clock generation time. Record the comparison — this confirms the efficiency win described in the spec's motivation is real, not just theoretical.

- [ ] **Step 5: Confirm old chat history still renders**

Open a chat from before this plan's changes that contains a presentation artifact generated under the old skill. Confirm it still renders and still exports correctly — per the spec's Migration section, old artifacts are immutable and self-contained, and shouldn't be affected by any of this plan's changes (they don't reference `/libs/deck-renderer.js` at all).

No commit for this task — it's verification only. If any step surfaces a bug, open a new task (not part of this plan) to fix it, following systematic-debugging to find the root cause before patching.

---

## Plan Self-Review Notes

- **Spec coverage**: Architecture (Tasks 1, 6), Content layer (Task 7), Render layer + design system (Tasks 1-5), Export layer (Tasks 2-6), Non-goals respected (no React, no font embedding, no visual-regression CI, no DOM virtualization beyond `content-visibility`, no `multi_product_graphic`, doc generator untouched), Migration (Task 8 Step 5), Testing (Task 8 all steps).
- **Type/signature consistency checked**: `registerLayout(name, {geometry, render, exportPptx})` shape is identical across all 19 layout registrations in Tasks 2-5; `getLayout` throws consistently; `downloadPptx` is exposed both on `DeckRenderer` and as a bare global, matching what `DownloadArtifact.tsx` (unmodified by this plan) actually looks up.
- **Placeholder scan**: Task 4's per-layout steps (Steps 2-10) and Task 5's per-layout steps read as terse compared to Tasks 2-3's full code blocks — this is intentional scoping (see Task Right-Sizing note in Task 4's header), not a placeholder: each cites its exact source lines or master-deck slide numbers and the precise structural pattern to follow, which is a concrete, actionable specification, not a vague "implement appropriately" instruction. If a reviewer wants full inline code for every one of the 14 layouts covered by Tasks 4-5, split those steps into their own tasks using Tasks 2-3 as the template.
