# Export Pipeline Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead code, deduplicate the triplicated download-bridge logic, replace guessed timeouts with real readiness signals (fixing a duplicate-export race on slow documents and a hard-cap failure on large decks), fix stale UI copy, and eliminate CDN version drift in the presentation/doc/excel export pipeline.

**Architecture:** No architecture change — this is bugfix/cleanup work against the existing artifact-download system (`client/src/components/Artifacts/DownloadArtifact.tsx` + the three `agents/*.skill.md` templates). The one new file is `client/public/libs/download-bridge.js`, a shared vanilla-JS module replacing three inline copies of the same blob-interception logic.

**Tech Stack:** TypeScript/React (client), Express (api), vanilla JS (artifact-embedded scripts and the new shared library file), Jest + jsdom (client tests).

## Global Constraints

- No new npm dependencies — every change here removes dependencies or consolidates existing code, never adds new libraries.
- `client/public/libs/*.js` files are plain vanilla JS (no build step, no TypeScript, no framework) — they're loaded via `<script src>` inside a sandboxed iframe running arbitrary LLM-generated HTML, consistent with the existing `pptxgen.bundle.js`/`docx.iife.js`/`xlsx.full.min.js` pattern.
- Every behavior change in `DownloadArtifact.tsx` must preserve the existing public behavior for artifacts that predate this change (old chat history) — old artifacts inline their own blob-interceptor copy and don't reference `/libs/download-bridge.js`, so the hidden-iframe fallback path must keep working for HTML that has no `bridge-ready` signal at all (see Task 3).
- Whatfix design-system values referenced in this plan (colors, fonts) are unaffected by this plan — that's sub-project A's scope, not this one.

---

### Task 1: Delete the dead Playwright render route

**Files:**
- Delete: `api/server/routes/artifacts.js`
- Modify: `api/server/routes/index.js:2` (remove `const artifacts = require('./artifacts');`), `api/server/routes/index.js:31` (remove `artifacts,` from the exports object)
- Modify: `api/server/index.js:170` (remove `app.use('/api/artifacts', routes.artifacts);`)
- Test: `api/server/routes/__tests__/index.test.js` (create if no existing test covers route registration — see Step 1)

**Interfaces:**
- Consumes: nothing from other tasks (first task, no dependencies).
- Produces: nothing consumed by later tasks — this is pure removal, verified independently.

- [ ] **Step 1: Write a failing test asserting the route is gone**

Check whether `api/server/routes/__tests__/index.test.js` already exists:

```bash
ls api/server/routes/__tests__/index.test.js 2>/dev/null || echo "does not exist"
```

If it doesn't exist, create it:

```javascript
// api/server/routes/__tests__/index.test.js
const routes = require('../index');

describe('routes/index', () => {
  it('does not export an artifacts route (removed dead Playwright render path)', () => {
    expect(routes.artifacts).toBeUndefined();
  });
});
```

If it already exists, add the `it(...)` block above inside its existing `describe`.

- [ ] **Step 2: Run the test to verify it currently fails**

Run: `cd api && npx jest server/routes/__tests__/index.test.js`
Expected: FAIL — `routes.artifacts` is currently defined (not `undefined`).

- [ ] **Step 3: Delete the route file and its registrations**

```bash
rm api/server/routes/artifacts.js
```

In `api/server/routes/index.js`, remove line 2 (`const artifacts = require('./artifacts');`) and remove the `artifacts,` entry from the exports object (line 31).

In `api/server/index.js`, remove line 170 (`app.use('/api/artifacts', routes.artifacts);`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx jest server/routes/__tests__/index.test.js`
Expected: PASS

- [ ] **Step 5: Verify the server still starts cleanly**

Run: `npm run backend` (from repo root) and confirm no error referencing `artifacts.js` or `playwright-core` on startup. Stop the server (Ctrl+C) once you've confirmed a clean start.

- [ ] **Step 6: Commit**

```bash
git add api/server/routes/artifacts.js api/server/routes/index.js api/server/index.js api/server/routes/__tests__/index.test.js
git commit -m "chore: remove dead Playwright render route

Abandoned in the same commit series that replaced it with the
client-side html2canvas capture path. playwright-core isn't a real
dependency (only a transitive devDependency of @playwright/test),
so this route would throw MODULE_NOT_FOUND in a production install
that omits devDependencies."
```

Note: no `render.yaml` or `vite-env.d.ts` change is needed for this task — verified during spec review that neither file references this route (see `docs/superpowers/specs/2026-07-28-export-pipeline-cleanup-design.md`, item 1).

---

### Task 2: Create the shared `download-bridge.js` and consolidate all three call sites

**Files:**
- Create: `client/public/libs/download-bridge.js`
- Create: `client/public/libs/__tests__/download-bridge.test.js`
- Modify: `agents/presentation-creator.skill.md:1312-1338` (replace inline bridge with `<script src>`)
- Modify: `agents/doc-creator.skill.md:317-339` (replace inline bridge with `<script src>`)
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx:172-219` (replace injected-string bridge with `<script src>` injection)

**Interfaces:**
- Produces: `download-bridge.js` exposes no JS API to import — it's a side-effecting script that, once loaded, (a) posts `{ type: 'bridge-ready' }` to `window.parent` via `postMessage`, and (b) listens for `{ type: 'artifact-download-request', fn: string }` messages and, on receipt, patches `URL.createObjectURL`/`HTMLElement.prototype.click`/`EventTarget.prototype.dispatchEvent`, invokes `window[fn]()`, and posts back `{ type: 'artifact-download', filename, data, mimeType }` once a blob is captured. Also immediately patches the same globals unconditionally on load (for the hidden-iframe direct-invoke path, which doesn't go through the `artifact-download-request` message) — this preserves both trigger modes used by `DownloadArtifact.tsx`.
- Consumed by: Task 3 (readiness signal), which listens for `bridge-ready`.

- [ ] **Step 1: Write `download-bridge.js`**

This is the canonical merge of the three existing copies (the presentation skill's message-triggered version, the doc skill's near-identical variant, and `DownloadArtifact.tsx`'s always-on injected version), unified to support both trigger modes and to emit `bridge-ready`:

```javascript
// client/public/libs/download-bridge.js
//
// Shared blob-interceptor for artifact-generated file downloads (PPTX/DOCX/XLSX).
// Loaded via <script src="/libs/download-bridge.js"> by every LLM-generated
// artifact (presentation-creator, doc-creator, excel-creator skills) and by
// DownloadArtifact.tsx's hidden-iframe fallback path.
//
// Two ways this gets used:
//   1. Message-triggered: host posts { type: 'artifact-download-request', fn }
//      to this window; this script invokes window[fn](), captures the blob
//      the function creates via a download <a> click, and posts back
//      { type: 'artifact-download', filename, data, mimeType }.
//   2. Direct-invoke: the host calls window[fn]() itself (hidden-iframe path);
//      the global patches below are already active by the time it does, so
//      the same blob capture happens without needing the request message.
//
// On load, posts { type: 'bridge-ready' } so the host knows this artifact
// supports the protocol, instead of guessing with a fixed timeout.
(function () {
  var blobs = new Map();

  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) {
    var u = origCreate(b);
    if (b instanceof Blob) blobs.set(u, b);
    return u;
  };

  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { blobs.delete(u); }, 90000);
    origRevoke(u);
  };

  function intercept(el, targetWindow) {
    if (!el.download || !el.href || el.href.indexOf('blob:') !== 0) return false;
    var blob = blobs.get(el.href);
    if (!blob) return false;
    var filename = el.download;
    var mimeType = blob.type || 'application/octet-stream';
    var reader = new FileReader();
    reader.onload = function () {
      var data = String(reader.result).split(',')[1];
      targetWindow.postMessage(
        { type: 'artifact-download', filename: filename, data: data, mimeType: mimeType },
        '*',
      );
    };
    reader.readAsDataURL(blob);
    return true;
  }

  var origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    if (this.tagName === 'A' && intercept(this, window.parent)) return;
    origClick.call(this);
  };

  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this.tagName === 'A' && intercept(this, window.parent)) {
      return true;
    }
    return origDispatch.call(this, ev);
  };

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'artifact-download-request') return;
    var fn = e.data.fn;
    if (typeof window[fn] !== 'function') return;
    var target = e.source || window.parent;
    // Re-run intercept() against the message's source window for this call,
    // since the global patches above default to window.parent.
    var origClickForRequest = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function () {
      if (this.tagName === 'A' && intercept(this, target)) return;
      origClickForRequest.call(this);
    };
    Promise.resolve(window[fn]()).catch(function (err) {
      // eslint-disable-next-line no-console
      console.error('[download-bridge] error running ' + fn + ':', err);
    });
  });

  window.parent.postMessage({ type: 'bridge-ready' }, '*');
})();
```

- [ ] **Step 2: Write a jsdom test for the pure blob-capture behavior**

`download-bridge.js` runs as a side-effecting script, not an importable module, so the test loads it into a fresh `vm` context and exercises the DOM patches directly:

```javascript
// client/public/libs/__tests__/download-bridge.test.js
const fs = require('fs');
const path = require('path');

describe('download-bridge.js', () => {
  const scriptSrc = fs.readFileSync(
    path.join(__dirname, '..', 'download-bridge.js'),
    'utf8',
  );

  function loadBridge() {
    const posted = [];
    // Minimal window.parent stub to capture postMessage calls.
    window.parent = { postMessage: (msg) => posted.push(msg) };
    // eslint-disable-next-line no-eval
    eval(scriptSrc);
    return posted;
  }

  it('posts bridge-ready on load', () => {
    const posted = loadBridge();
    expect(posted).toContainEqual({ type: 'bridge-ready' });
  });

  it('captures a blob created via URL.createObjectURL and intercepts the download click', async () => {
    const posted = loadBridge();
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'test.txt';
    document.body.appendChild(a);
    a.click();

    // FileReader.onload is async — wait a tick for it to fire.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const downloadMsg = posted.find((m) => m.type === 'artifact-download');
    expect(downloadMsg).toBeDefined();
    expect(downloadMsg.filename).toBe('test.txt');
    expect(downloadMsg.mimeType).toBe('text/plain');
  });

  it('does not intercept a click on an anchor with no blob: href', () => {
    loadBridge();
    let realClickCalled = false;
    const a = document.createElement('a');
    a.href = 'https://example.com/file.txt';
    a.download = 'file.txt';
    document.body.appendChild(a);
    a.addEventListener('click', (e) => {
      // Real navigation would happen here in a browser; jsdom just fires the event.
      realClickCalled = true;
      e.preventDefault();
    });
    a.click();
    expect(realClickCalled).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails (file doesn't exist yet if you did Step 2 before Step 1 — otherwise skip to confirming Step 1's file is correct)**

Run: `cd client && npx jest libs/__tests__/download-bridge.test.js`
Expected: PASS if Step 1 is already written correctly. If any assertion fails, fix `download-bridge.js` before proceeding — do not move on with a failing test.

- [ ] **Step 4: Replace the presentation skill's inline bridge with a `<script src>` reference**

In `agents/presentation-creator.skill.md`, replace lines 1312–1337 (the entire `// Artifact-panel download bridge...` comment through the closing `});` of the `window.addEventListener('message', ...)` block) with:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/4.0.1/pptxgen.bundle.js"></script>
<script src="/libs/download-bridge.js"></script>
```

(The PptxGenJS script tag already exists elsewhere in the template — only add the `download-bridge.js` line; don't duplicate the PptxGenJS tag. Check the existing `<head>` for the current PptxGenJS `<script>` tag and add the `download-bridge.js` line immediately after it, inside `<body>` before the closing `</body>`, matching where the old inline bridge script lived.)

- [ ] **Step 5: Replace the doc skill's inline bridge with the same `<script src>` reference**

In `agents/doc-creator.skill.md`, replace lines 317–339 (`// Artifact-panel download bridge` through the closing `});`) with:

```html
<script src="/libs/download-bridge.js"></script>
```

- [ ] **Step 6: Replace `DownloadArtifact.tsx`'s injected-string bridge with a `<script src>` injection**

In `client/src/components/Artifacts/DownloadArtifact.tsx`, replace lines 172–219 (the `const IframeFunction = win.Function as any; IframeFunction(...)` block) with code that appends a `<script>` tag pointing at the same shared file, inside the hidden iframe's document:

```typescript
        const bridgeScript = win.document.createElement('script');
        bridgeScript.src = `${window.location.origin}/libs/download-bridge.js`;
        win.document.head.appendChild(bridgeScript);

        win[fnName]();
        console.log(`${LOG} [hiddenIframe] ${fnName}() invoked — waiting for blob interception`);
```

Remove the now-unused `IframeFunction` variable declaration and the large inline string. Keep the surrounding `try { ... } catch (err) { ... }` block structure intact — only the body changes.

- [ ] **Step 7: Manually verify all three export paths still work end-to-end**

This step is a manual smoke test — the blob-capture *logic* is unit-tested in Step 2/3, but the full iframe/postMessage integration across three different call sites needs a real browser:

1. Start the dev server (`npm run backend` in one terminal, `cd client && npm run dev` in another, or whatever the existing local dev workflow is).
2. Generate a presentation via the chatbot, click "PPTX" — confirm the file downloads and opens correctly.
3. Generate a doc, click "DOCX" — confirm the file downloads and opens correctly.
4. Generate a spreadsheet, click "XLSX" — confirm the file downloads and opens correctly.

If any of these fail, do not proceed to Step 8 — return to Steps 4–6 and diagnose before committing.

- [ ] **Step 8: Commit**

```bash
git add client/public/libs/download-bridge.js client/public/libs/__tests__/download-bridge.test.js agents/presentation-creator.skill.md agents/doc-creator.skill.md client/src/components/Artifacts/DownloadArtifact.tsx
git commit -m "refactor: consolidate triplicated download-bridge logic into one shared file

The blob-interceptor (monkey-patches URL.createObjectURL/click) existed
as three near-identical but not-identical copies: inline in the
presentation skill, inline in the doc skill, and injected as a string
in DownloadArtifact.tsx. Now one canonical file at
client/public/libs/download-bridge.js, loaded via <script src> from
all three call sites. Also posts a bridge-ready message on load, used
by the next task to replace guessed timeouts with a real signal."
```

---

### Task 3: Replace guessed timeouts with real readiness signals (fixes the DOCX/large-doc duplicate-export race)

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx` (the `downloadNative` function and its `FALLBACK_MS` timer, and `runInHiddenIframe`'s 800ms wait)
- Test: `client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx` (create)

**Interfaces:**
- Consumes: `bridge-ready` message from Task 2's `download-bridge.js`.
- Produces: no new exports — this changes internal timing behavior of `downloadNative`/`runInHiddenIframe`, observable only via the `artifact-download`/no-duplicate behavior tested below.

- [ ] **Step 1: Write a failing test asserting no duplicate hidden-iframe fallback fires once bridge-ready is received**

This test exercises the specific race described in the spec: previously, `FALLBACK_MS` (10s) fired regardless of whether the artifact was alive, racing a second export. After this task, receiving `bridge-ready` should cancel that race entirely (not just delay it) — the fallback should only fire if `bridge-ready` itself never arrives.

```typescript
// client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx
import { render, fireEvent } from '@testing-library/react';
import DownloadArtifact from '../DownloadArtifact';

// Mock heavy provider hooks this component depends on so the test can focus
// on the timing logic under test.
jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: {} }),
}));
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ token: 'test-token' }),
}));
jest.mock('~/hooks/Artifacts/useArtifactProps', () => ({
  __esModule: true,
  default: () => ({ fileKey: 'test.pptx' }),
}));
jest.mock('~/Providers/EditorContext', () => ({
  useCodeState: () => ({ currentCode: '<html>...downloadPptx()...</html>' }),
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (s: string) => s }));

describe('DownloadArtifact — readiness vs. liveness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('does not create a hidden-iframe fallback if bridge-ready arrives before the old fixed fallback delay', () => {
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '' } as never} />,
    );

    fireEvent.click(getByLabelText('Download as PPTX'));

    // Simulate the artifact's download-bridge.js confirming it's alive.
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'bridge-ready' } }),
    );

    // Advance well past the old fixed FALLBACK_MS (10s) — since bridge-ready
    // already confirmed liveness, no second hidden iframe should ever appear.
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('does create a hidden-iframe fallback if bridge-ready never arrives', () => {
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '' } as never} />,
    );

    fireEvent.click(getByLabelText('Download as PPTX'));

    // No bridge-ready message — simulating an older artifact with no bridge script.
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx`
Expected: The first test FAILS — with the current `FALLBACK_MS`-only logic, the fallback iframe fires at 10s regardless of `bridge-ready`, so `document.querySelectorAll('iframe').length` is `> 0` when the test expects `0`.

- [ ] **Step 3: Implement the readiness-vs-liveness fix**

In `client/src/components/Artifacts/DownloadArtifact.tsx`, add a new ref tracking whether `bridge-ready` has been received for the in-flight download, and change the `bridge-ready`/`artifact-download` message listener and the fallback-timer logic:

Add a new ref near the existing `fallbackTimerRef`/`iframeCleanupRef` declarations (around line 254-256):

```typescript
  // Set once 'bridge-ready' arrives for the in-flight download — once true,
  // the fallback timer is cancelled outright rather than just delayed,
  // because we now know the artifact is alive and its listener is armed.
  const bridgeReadyRef = useRef(false);
```

Modify the existing message-listener `useEffect` (currently only handling `artifact-download`, lines 263-276) to also handle `bridge-ready`:

```typescript
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type === 'bridge-ready') {
        bridgeReadyRef.current = true;
        if (fallbackTimerRef.current) {
          console.log(
            `${LOG} bridge-ready received — artifact is alive, cancelling fallback race`,
          );
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        return;
      }
      if (e.data?.type !== 'artifact-download') return;
      if (fallbackTimerRef.current) {
        console.log(
          `${LOG} artifact-download received — postMessage succeeded, cancelling fallback timer`,
        );
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);
```

Reset `bridgeReadyRef.current = false` at the start of every new download attempt, in `downloadNative` (right after the existing fallback-timer/iframe cleanup at the top of the function, around line 649-654):

```typescript
    bridgeReadyRef.current = false;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;
```

Change the fallback timer callback itself (around line 665-672) to check `bridgeReadyRef.current` before falling back — this handles the edge case where `bridge-ready` and the fallback timer fire in the same tick:

```typescript
        fallbackTimerRef.current = setTimeout(() => {
          if (bridgeReadyRef.current) {
            // Artifact is alive and just slow (large document) — do not race
            // a second export. Let the original run to completion.
            fallbackTimerRef.current = null;
            return;
          }
          console.warn(
            `${LOG} No bridge-ready after ${FALLBACK_MS} ms. ` +
              `The artifact may not have the download-bridge.js listener (older artifact). ` +
              `Running hidden-iframe fallback.`,
          );
          fallbackTimerRef.current = null;
          iframeCleanupRef.current = runInHiddenIframe(content, fmt.triggerFn);
        }, FALLBACK_MS);
```

Note this changes `FALLBACK_MS`'s meaning: it's no longer "how long we wait for the whole export to finish" — it's "how long we wait for the artifact to confirm it's alive at all." Update the constant's comment (around line 87) to reflect this:

```typescript
/**
 * How long to wait for a 'bridge-ready' signal before assuming the artifact
 * doesn't support the download-bridge.js protocol at all (e.g. an older
 * cached artifact) and falling back to the hidden-iframe path. Once
 * bridge-ready arrives, this is no longer consulted for the current
 * download — a slow export after that point is not evidence of failure,
 * just a document that takes a while to build (see bridgeReadyRef).
 */
const FALLBACK_MS = 10_000;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx`
Expected: Both tests PASS.

- [ ] **Step 5: Manually verify against a slow, real document**

Generate a large presentation or document (enough content that PptxGenJS/docx.js generation genuinely takes more than 10 seconds — e.g. a 30+ slide deck with several brand images) and click Download. Confirm exactly one file downloads, not two, and that it downloads successfully even though generation took longer than the old 10-second fallback window.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx
git commit -m "fix: stop racing a duplicate export on slow (large) documents

FALLBACK_MS previously fired unconditionally at 10s, starting a second
concurrent export even if the first was still legitimately in
progress — the root cause of intermittent DOCX/PPTX export failures
on larger documents. Now bridge-ready (from download-bridge.js)
confirms liveness once, and the fallback race is cancelled outright
rather than just delayed — a slow export is no longer treated as a
failure signal."
```

---

### Task 4: Fix the hard-capped, non-scaling slide-capture timeout for large decks

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx` (the `captureSlides` function)
- Test: `client/src/components/Artifacts/__tests__/captureSlides.test.ts` (create — isolates the pure timeout/batching math from the DOM-heavy capture loop)

**Interfaces:**
- Produces: `computeCaptureTimeout(slideCount: number): number` and `chunk<T>(items: T[], size: number): T[][]` — small pure helper functions extracted from `captureSlides`, exported for direct testing. Later tasks don't depend on these, but they're named here so a reviewer can check the implementation matches.

- [ ] **Step 1: Write failing tests for the two pure helper functions**

```typescript
// client/src/components/Artifacts/__tests__/captureSlides.test.ts
import { computeCaptureTimeout, chunk } from '../DownloadArtifact';

describe('computeCaptureTimeout', () => {
  it('returns the base allowance for a small deck', () => {
    // base 10_000 + 3_000/slide, so 5 slides = 10_000 + 15_000 = 25_000
    expect(computeCaptureTimeout(5)).toBe(25_000);
  });

  it('scales linearly with slide count', () => {
    expect(computeCaptureTimeout(40)).toBe(10_000 + 40 * 3_000); // 130_000
  });

  it('caps at the absolute maximum (5 minutes) for extreme deck sizes', () => {
    expect(computeCaptureTimeout(1000)).toBe(300_000);
  });
});

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single group if size >= array length', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx jest components/Artifacts/__tests__/captureSlides.test.ts`
Expected: FAIL — `computeCaptureTimeout` and `chunk` are not yet exported from `DownloadArtifact.tsx`.

- [ ] **Step 3: Implement the two helper functions and export them**

Add near the top of `client/src/components/Artifacts/DownloadArtifact.tsx`, after the `FALLBACK_MS` declaration:

```typescript
/**
 * Safety-net timeout for captureSlides(), scaled to slide count instead of a
 * flat ceiling. Still a safety net, not a precise readiness signal — total
 * capture time is inherently variable — but it scales with the actual
 * amount of work instead of assuming every deck takes the same time
 * regardless of size. Base allowance covers html2canvas script load + the
 * fonts/settle delay; per-slide allowance covers the capture loop itself.
 */
export function computeCaptureTimeout(slideCount: number): number {
  const BASE_MS = 10_000;
  const PER_SLIDE_MS = 3_000;
  const MAX_MS = 300_000; // 5 minutes
  return Math.min(BASE_MS + slideCount * PER_SLIDE_MS, MAX_MS);
}

/** Splits `items` into groups of at most `size`, preserving order. */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npx jest components/Artifacts/__tests__/captureSlides.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the helpers into `captureSlides` — replace the fixed timeout and add batched, progress-reporting capture**

Replace the existing `captureSlides` function (lines 460-551) with a version that: (a) uses `computeCaptureTimeout(slideEls.length)` instead of the flat `40_000`, (b) processes slides in batches of 4 via `chunk` instead of one at a time, (c) reports progress via an optional callback, and (d) includes the count of slides captured before a timeout in the rejection error:

```typescript
  const captureSlides = (
    html: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const patchedHtml = patchLibUrls(html);

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;width:1280px;height:720px;border:0;top:-9999px;left:-9999px;pointer-events:none;';
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          document.body.removeChild(iframe);
        } catch {
          /* already removed */
        }
      };

      let capturedCount = 0;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const armTimeout = (slideCount: number) => {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `Slide capture timed out after capturing ${capturedCount} of ${slideCount} slides`,
            ),
          );
        }, computeCaptureTimeout(slideCount));
      };

      iframe.onload = () => {
        setTimeout(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const win = iframe.contentWindow as any;
            const doc = iframe.contentDocument as Document;

            await new Promise<void>((res, rej) => {
              const s = doc.createElement('script');
              s.src =
                'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
              s.onload = () => res();
              s.onerror = () => rej(new Error('html2canvas failed to load from CDN'));
              doc.head.appendChild(s);
            });

            const slideEls = [...doc.querySelectorAll<HTMLElement>('.slide')];
            if (slideEls.length === 0) throw new Error('No .slide elements found in artifact');

            armTimeout(slideEls.length);

            const FORCE_VISIBLE = `
              .slide {
                position: relative !important;
                inset: auto !important;
                opacity: 1 !important;
                transform: none !important;
                display: block !important;
                width: 1280px !important;
                height: 720px !important;
                pointer-events: none !important;
              }
              .deck { position: relative !important; height: auto !important; overflow: visible !important; }
              .progress-bar, .slide-counter, .nav-hint, .notes { display: none !important; }
            `;
            const styleEl = doc.createElement('style');
            styleEl.textContent = FORCE_VISIBLE;
            doc.head.appendChild(styleEl);

            const pngs: string[] = [];
            const batches = chunk(slideEls, 4);
            for (const batch of batches) {
              const batchPngs = await Promise.all(
                batch.map((el) =>
                  (win.html2canvas as any)(el, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#36314C',
                    width: 1280,
                    height: 720,
                    logging: false,
                  }).then((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png')),
                ),
              );
              pngs.push(...batchPngs);
              capturedCount = pngs.length;
              onProgress?.(capturedCount, slideEls.length);
            }

            if (timeoutId) clearTimeout(timeoutId);
            cleanup();
            resolve(pngs);
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            cleanup();
            reject(err);
          }
        }, 1200);
      };

      iframe.srcdoc = patchedHtml;
    });
```

Note: `backgroundColor: '#36314C'` replaces the old `'#25223B'` — matching the Ink 800 correction from the presentation redesign spec's master-deck verification (this file's slide-capture background should match whatever the deck's actual dark background is; update this again if/when sub-project A changes the underlying design system).

- [ ] **Step 6: Wire progress reporting into the two callers (`downloadPdfHD`, `downloadPptxHD`)**

Update both call sites (around lines 559-594 and 601-628) to pass an `onProgress` callback that updates the `done` state used for the button's flash/label, and surface the new partial-context error message. In `downloadPdfHD`:

```typescript
  const downloadPdfHD = async () => {
    if (!content) return;
    flash('pdf-hd');
    try {
      const pngs = await captureSlides(content, (doneCount, total) => {
        console.log(`${LOG} PDF (HD) capture progress: ${doneCount}/${total}`);
      });
      /* ...unchanged... */
    } catch (err) {
      console.error(`${LOG} HD PDF failed:`, err);
      flash('pdf-hd-err');
    }
  };
```

Apply the same `onProgress` callback (with a `PPTX (HD)` log prefix) to `downloadPptxHD`.

- [ ] **Step 7: Add a test confirming the timeout scales (not a fixed 40s) using fake timers**

```typescript
// Add to client/src/components/Artifacts/__tests__/captureSlides.test.ts
describe('computeCaptureTimeout — regression for the large-deck bug', () => {
  it('exceeds the old fixed 40-second ceiling for a 40-slide deck', () => {
    // The bug this fixes: the old code used a flat 40_000ms regardless of
    // slide count, which a 40-slide deck (or larger) would always exceed.
    expect(computeCaptureTimeout(40)).toBeGreaterThan(40_000);
  });
});
```

Run: `cd client && npx jest components/Artifacts/__tests__/captureSlides.test.ts`
Expected: PASS (this test documents the regression being fixed; it should already pass given Step 3's implementation, but write it before moving on to confirm the fix actually addresses the reported bug shape, not just an abstract timeout formula).

- [ ] **Step 8: Manually verify with a large deck**

Generate a presentation with 40+ slides (or manually duplicate slide `<section>` elements in a generated artifact's HTML to reach that count for testing purposes) and click "PDF (HD)" or "PPTX (HD)". Confirm capture completes successfully rather than timing out, and check the browser console for the progress log lines.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx client/src/components/Artifacts/__tests__/captureSlides.test.ts
git commit -m "fix: scale slide-capture timeout to deck size instead of a flat 40s cap

captureSlides() previously had a fixed 40-second timeout wrapping a
fully sequential per-slide capture loop, so any sufficiently large
deck would always time out (deterministic, not a race). Now the
timeout scales with slide count (computeCaptureTimeout), slides
capture in small concurrent batches instead of one at a time, and a
timeout failure reports how many slides were captured before it
fired."
```

---

### Task 5: Fix stale UI copy on the "PDF (HD)" button

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx:763-764`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (copy-only change, no behavior change).

- [ ] **Step 1: Write a failing test asserting the tooltip text is accurate**

```typescript
// Add to client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx
it('PDF (HD) button tooltip describes the actual client-side html2canvas approach, not the abandoned server-side one', () => {
  const { getByLabelText } = render(
    <DownloadArtifact
      artifact={{ content: '...downloadPptx()...' } as never}
    />,
  );
  const button = getByLabelText('Export as PDF (server-rendered, pixel-perfect)', {
    exact: false,
  });
  expect(button).toBeUndefined();
});
```

Actually — a cleaner assertion is a direct string check on the `title` attribute, since `aria-label` and `title` are separate. Replace the test above with:

```typescript
it('PDF (HD) button tooltip describes the client-side capture approach', () => {
  const { getByTitle, queryByTitle } = render(
    <DownloadArtifact
      artifact={{ content: '...downloadPptx()...' } as never}
    />,
  );
  expect(
    queryByTitle(/Server-side Playwright render/i),
  ).toBeNull();
  expect(
    getByTitle(/screenshots each slide/i),
  ).toBeDefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx`
Expected: FAIL — the current tooltip text is `"Server-side Playwright render — preserves all CSS effects including backdrop-filter and blend modes"`, which matches the stale-copy pattern the test rejects, and doesn't contain "screenshots each slide".

- [ ] **Step 3: Fix the tooltip text**

In `client/src/components/Artifacts/DownloadArtifact.tsx`, change lines 763-764:

```typescript
            aria-label="Export as PDF (client-rendered, pixel-perfect)"
            title="Screenshots each slide at 2× resolution in-browser and assembles a printable PDF — preserves visual fidelity but does not support backdrop-filter or blend modes"
```

(Previously: `aria-label="Export as PDF (server-rendered, pixel-perfect)"` / `title="Server-side Playwright render — preserves all CSS effects including backdrop-filter and blend modes"`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx jest components/Artifacts/__tests__/DownloadArtifact.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx client/src/components/Artifacts/__tests__/DownloadArtifact.test.tsx
git commit -m "fix: correct stale 'server-side Playwright' tooltip on PDF (HD) button

The button has used the client-side html2canvas capture path since
the Playwright route was abandoned (see Task 1); the tooltip still
described the old approach, and incorrectly claimed backdrop-filter/
blend-mode support that html2canvas doesn't actually have."
```

---

### Task 6: Eliminate CDN version drift — repoint skill templates to already-bundled local libraries

**Files:**
- Modify: `agents/presentation-creator.skill.md` (PptxGenJS `<script src>` references)
- Modify: `agents/doc-creator.skill.md` (docx.js `<script src>` reference)
- Modify: `agents/excel-creator.skill.md` (SheetJS `<script src>` reference)
- Test: manual verification only (see Step 3) — there is no automated test target here since the change is entirely inside LLM-prompt template markdown, not runtime application code; the risk this task must resolve (docx.js version compatibility) is inherently a runtime check, not a unit-testable property.

**Interfaces:**
- Consumes: `client/public/libs/pptxgen.bundle.js`, `docx.iife.js`, `xlsx.full.min.js` — already present on disk (confirmed during spec review), previously unused by two of the three skills.
- Produces: nothing consumed by other tasks — this is the last task in this plan.

- [ ] **Step 1: Verify the `docx.iife.js` bundle's API compatibility before changing anything**

This is the risk flagged in the spec: `client/package.json` declares `docx ^9.7.1`, but `doc-creator.skill.md`'s `downloadDocx()` template code is written against the v8.5.0 API it currently loads from CDN. Confirm which API the local bundle actually exposes before repointing the skill:

```bash
node -e "
global.window = global;
require('/Users/mohammad.haider/Documents/enablenext/client/public/libs/docx.iife.js');
console.log('Packer' in window.docx, typeof window.docx.Packer);
console.log(Object.keys(window.docx).slice(0, 30));
"
```

Check the printed key list against the doc skill's actual usage (`agents/doc-creator.skill.md` — search for `docx.` API calls, e.g. `docx.Document`, `docx.Packer`, `docx.Paragraph`, `docx.HeadingLevel`, `docx.ShadingType` or similar). If every API the skill calls exists on the loaded `window.docx` object with the same call shape, the bundle is compatible — proceed to Step 2. If any call shape differs (e.g. a renamed export, a changed constructor signature), **stop and update `downloadDocx()`'s template code in `agents/doc-creator.skill.md` to match the v9 API before proceeding** — do not repoint the `<script src>` until this is confirmed, since doing so would silently break every future generated document.

- [ ] **Step 2: Repoint all three skill templates to their local bundles**

In `agents/presentation-creator.skill.md`, find every `<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/4.0.1/pptxgen.bundle.js">` reference (there should be exactly one canonical one in the template, per the CRITICAL Rules section's own instruction) and change it to:

```html
<script src="/libs/pptxgen.bundle.js"></script>
```

Also update the CRITICAL Rules bullet describing this (currently: *"Load PptxGenJS from cdnjs only... Never use... a local `/libs/` path (the local `/libs/pptxgen.bundle.js` is the fallback and is also v4.0.1)"*) to reflect that the local path is now the **only** source, not a fallback:

```markdown
- **Load PptxGenJS from the local bundle only**: `<script src="/libs/pptxgen.bundle.js"></script>` — this is the same v4.0.1 build previously loaded from cdnjs, now the sole source (no CDN dependency, no version drift risk)
```

In `agents/doc-creator.skill.md`, find the CDN docx.js `<script src>` reference and its accompanying "never a local /libs/ path" instruction, and invert both:

```html
<script src="/libs/docx.iife.js"></script>
```

```markdown
- **Load docx.js from the local bundle only**: `<script src="/libs/docx.iife.js"></script>` — verified compatible with this skill's API usage (see implementation notes); no CDN dependency
```

In `agents/excel-creator.skill.md`, find the CDN SheetJS reference and change it the same way:

```html
<script src="/libs/xlsx.full.min.js"></script>
```

- [ ] **Step 3: Manually verify all three exports still work after repointing**

Repeat the same three-format smoke test from Task 2's Step 7 (generate a presentation → PPTX, generate a doc → DOCX, generate a spreadsheet → XLSX, confirm each downloads and opens correctly). This is the test for this task — since the change is confined to prompt-template markdown consumed by an LLM, there's no code path to unit-test; the artifact this produces is what needs verifying.

- [ ] **Step 4: Commit**

```bash
git add agents/presentation-creator.skill.md agents/doc-creator.skill.md agents/excel-creator.skill.md
git commit -m "fix: load PptxGenJS/docx.js/SheetJS from local bundles, not CDN

Closes the version-drift gap between what the skill templates
hardcoded (CDN URLs pinned to specific versions) and what
client/package.json declares. The local bundles at client/public/libs/
were already present and version-matched (confirmed during spec
review) but mostly unused. Removes a runtime dependency on
third-party CDN availability for every generated artifact."
```

---

## Plan Self-Review Notes

- **Spec coverage**: all six items from `2026-07-28-export-pipeline-cleanup-design.md`'s Decisions section map 1:1 to Tasks 1–6. The Background section's items 6/7 (the two user-reported bugs) are addressed by Tasks 3 and 4 respectively.
- **Corrected inaccuracies carried forward**: Task 1 reflects the corrected understanding (no `render.yaml` or `vite-env.d.ts` changes needed) rather than the original, inaccurate spec draft.
- **Type/signature consistency**: `computeCaptureTimeout` and `chunk` are defined once (Task 4, Step 3) and used consistently in the same task's Step 5 and Step 7 — no other task references them.
- **Testing approach**: pure logic (timeout scaling, batching, blob capture mechanics) gets real Jest/jsdom tests; full iframe/postMessage integration behavior and prompt-template changes get explicit manual verification steps, since that matches both the existing codebase's test conventions (util/hook-level unit tests, not iframe-integration E2E) and the original spec's own "Testing / Verification" section.
