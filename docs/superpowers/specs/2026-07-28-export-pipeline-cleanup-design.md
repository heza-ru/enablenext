# Export Pipeline Cleanup — Design Spec

**Date:** 2026-07-28
**Status:** Approved by user, pending implementation plan
**Scope:** Cleanup and bugfixes to the existing presentation/doc/excel artifact export pipeline. This is sub-project **C** of a three-part effort; sub-projects **A** (presentation methodology redesign for higher-fidelity, editable, Google-Slides-compatible export) and **B** (doc methodology redesign) are out of scope here and will get their own specs.

## Background

The chat app generates presentations, Word docs, and Excel files as self-contained HTML "artifacts" (via `agents/presentation-creator.skill.md`, `agents/doc-creator.skill.md`, `agents/excel-creator.skill.md`). Each artifact embeds its own export logic (PptxGenJS, docx.js, SheetJS respectively) plus a client-side script that captures the exported file and posts it back to the host app for download, orchestrated by `client/src/components/Artifacts/DownloadArtifact.tsx` and `Artifacts.tsx`.

An architecture scan surfaced several issues unrelated to the eventual methodology redesign but worth fixing now:

1. A server-side Playwright render route (`api/server/routes/artifacts.js`) was built, then abandoned in the very next commit when a client-side html2canvas approach replaced it. It is dead code, currently unreferenced by the client, and would throw in production since `playwright-core` is not a real dependency (only a transitive devDependency of the `playwright` e2e-test package).
2. The blob-interceptor / download-bridge logic (monkey-patches `URL.createObjectURL`/`click`, posts the captured blob via `postMessage`) is duplicated three times: inline in the presentation skill template, inline in the doc skill template, and hard-coded as an injected string in `DownloadArtifact.tsx`.
3. The download flow relies on guessed fixed timeouts (10s fallback trigger, 800ms hidden-iframe-ready wait, 1200ms html2canvas-ready wait, 40s hard cap) instead of real readiness signals — a plausible source of flakiness.
4. Stale UI copy: the "PDF (HD)" button tooltip still describes the abandoned server-side Playwright approach, not the current client-side html2canvas approach.
5. Version drift: skill templates hardcode CDN library versions (PptxGenJS 4.0.1, docx.js 8.5.0) that diverge from `client/package.json` (`pptxgenjs ^4.0.1`, `docx ^9.7.1`). `client/public/libs/` already contains bundled `pptxgen.bundle.js`, `docx.iife.js`, and `xlsx.full.min.js` — largely unused by the skill templates, which mostly load from CDN instead.

**Confirmed via code-level root-cause investigation (added after initial spec approval), two additional failure modes reported by the user:**

6. **DOCX export fails intermittently, worse on larger documents.** Root cause: `FALLBACK_MS = 10_000` in `DownloadArtifact.tsx` arms a 10-second timer (line ~665) that, if no `artifact-download` response arrives, starts a **second, fully independent** hidden-iframe run of the same export function (line ~671) — while the first run may still be in progress in the live artifact. `docx.js`'s `Packer.toBlob()` (and PptxGenJS's `writeFile()`, which fetches brand images) is genuinely async and takes longer as documents grow. Once generation exceeds 10s, both runs execute concurrently, competing for the same resources — producing duplicate downloads, resource contention, or an outright failure on one or both attempts. This is the same underlying "guessed timeout" pattern as item 3 above, now confirmed with a concrete reproduction mechanism.
7. **All exports fail once slide count is high enough, every time (not intermittent).** Root cause: `captureSlides()` (backing the "HD" PPTX/PDF buttons) has a **fixed 40-second timeout** wrapping a loop that screenshots every slide **sequentially, one at a time**, with no scaling by slide count. Per-slide capture time is roughly fixed; past a deck-size threshold, total capture time always exceeds 40 seconds, and the whole operation rejects with "Slide capture timed out" — both `downloadPdfHD` and `downloadPptxHD` then fail outright with no partial output. This is a hard, deterministic ceiling distinct from item 3's race condition — a readiness-signal fix alone does not address it, since the problem isn't "we don't know when it's ready," it's "the total work genuinely exceeds a fixed, non-scaling budget done serially."

## Decisions

### 1. Remove the dead Playwright render path entirely

Delete rather than fix-and-keep. If the future presentation redesign (sub-project A) needs server-side rendering for fidelity measurement, it should be built fresh against that project's actual requirements rather than resurrecting untested, already-abandoned code.

**Changes:**
- Delete `api/server/routes/artifacts.js`
- Remove its route registration from `api/server/routes/index.js` and `api/server/index.js`
- Remove the `npx playwright install chromium` build step from `render.yaml`
- Remove any `vite-env.d.ts` type additions that exist solely to support this route (verify during implementation whether they're solely for this or shared with other code)

### 2. Consolidate the download-bridge logic into one shared file

Create `client/public/libs/download-bridge.js` as the single canonical implementation of the blob-interceptor. Both skill templates change from inlining the logic to emitting a `<script src="/libs/download-bridge.js"></script>` tag in the generated artifact HTML. `DownloadArtifact.tsx`'s `runInHiddenIframe` injects the same `<script src>` tag instead of building an injected string via `Function(...)`.

This is a single point of maintenance for a security/reliability-sensitive piece of code (it monkey-patches global browser APIs), rather than three copies that can silently drift out of sync.

### 3. Replace guessed timeouts with real readiness signals

`download-bridge.js` posts a `bridge-ready` message once it has successfully patched `URL.createObjectURL`/`click` and is listening for the download-trigger message. `DownloadArtifact.tsx`'s postMessage trigger path and hidden-iframe fallback path wait for `bridge-ready` before considering the artifact ready to receive a download-trigger message, instead of a blind delay.

`captureSlides()`'s html2canvas readiness uses the script's actual `onload` callback (a real signal already available from the `<script>` element) rather than a fixed 1200ms delay after the artifact's own `onload`.

`FALLBACK_MS` (10s trigger-to-fallback) and the 40s hard cap in `captureSlides()` remain as true last-resort safety nets — they stop the flow from hanging forever if a signal never arrives — but are no longer the primary mechanism deciding when to proceed.

**Readiness vs. liveness (closes the duplicate-run race described in Background item 6):** the current design conflates two different questions — "is the artifact's bridge listening" (readiness) and "is the export still in progress" (liveness) — into one timer. Once `bridge-ready` fires, we know the artifact is alive and its listener is armed; a slow export after that point is not evidence the postMessage protocol failed, it's just a document that takes a while to build. The fallback-to-hidden-iframe path must only trigger when `bridge-ready` itself never arrives (the artifact genuinely doesn't support the protocol, e.g. an older cached artifact) — once we've confirmed the artifact is alive, we wait for the `artifact-download` response with a much longer, generous safety-net timeout (see item 4's scaled-budget approach for the same principle applied to slide capture) instead of racing a second concurrent run.

### 4. Fix the hard-capped, non-scaling slide-capture timeout for large decks

Replace `captureSlides()`'s fixed 40-second timeout and fully-sequential capture loop with an approach that scales with actual slide count:

- **Scale the safety-net timeout to slide count**: a base allowance plus a per-slide allowance (e.g. `10_000 + slideCount * 3_000`, capped at a sane absolute maximum like 5 minutes) instead of a flat 40 seconds. This is still a safety net, not a precise readiness signal — total capture time is inherently variable — but it scales with the actual amount of work instead of assuming a fixed ceiling regardless of deck size.
- **Process slides in small concurrent batches** (e.g. 3–4 at a time via `Promise.all` chunks) rather than one at a time, to overlap the async portions of each `html2canvas()` call (image decode, layout) instead of paying that cost fully serially for every slide.
- **Surface progress to the user** (e.g. "Capturing slide 12/40…") instead of a silent spinner — for large decks this is a genuinely long-running operation, and visible progress turns what currently looks like a hang/failure into a legible wait.
- **Fail gracefully with partial context**: if capture still times out on an extreme deck, the error surfaced to the user should say how many slides were captured before timing out, not just "Slide capture timed out" — actionable information, and useful signal if this needs raising again later.

### 5. Fix stale UI copy

Update the "PDF (HD)" button's tooltip in `DownloadArtifact.tsx` (currently: *"Server-side Playwright render — preserves all CSS effects including backdrop-filter and blend modes"*) to accurately describe the current client-side html2canvas screenshot approach, including the real limitation that html2canvas does not reliably support `backdrop-filter`/blend-modes (the opposite of what the stale copy claims).

### 6. Eliminate CDN version drift by loading from already-bundled local libraries

`client/public/libs/` already contains `pptxgen.bundle.js` (confirmed v4.0.1, matches skill assumption), `xlsx.full.min.js` (confirmed v0.18.5, matches skill assumption), and `docx.iife.js` (version unconfirmed by static inspection — see Risk below). Repoint all three skill templates (`presentation-creator.skill.md`, `doc-creator.skill.md`, `excel-creator.skill.md`) to load their respective library from the local `/libs/` bundle as the sole source, dropping the CDN load entirely. This removes both the version-drift risk and a runtime dependency on a third-party CDN being reachable.

**Risk requiring a runtime check during implementation:** `docx.iife.js` is a rolldown-bundled file with no clean version string extractable by static grep. `client/package.json` declares `docx ^9.7.1`, while `doc-creator.skill.md`'s `downloadDocx()` template code is written against the v8.5.0 API it currently loads from CDN. docx.js has breaking API changes between v8 and v9. Before repointing the doc skill to the local bundle, implementation must either (a) confirm the bundle is actually v8.x-API-compatible, or (b) update `downloadDocx()`'s template code to the v9 API if the bundle is v9. This must be verified with a real load-and-inspect (e.g. checking `docx.Packer` or a known v9-only export) rather than assumed.

## Non-goals

- No changes to the vector PPTX export methodology, the HD image-capture approach, or the doc/excel generation methodology — that's sub-projects A and B.
- No new features. This is cleanup only: dead code removal, deduplication, race-condition fixes, copy fixes, and dependency-source consolidation.

## Testing / Verification

- Manual smoke test of all three export paths (PPTX vector, PPTX HD, PDF, PDF Compat, DOCX, XLSX) after the local-lib repointing, to catch the docx version-compatibility risk and confirm nothing regressed.
- Confirm the dead route's removal doesn't break `render.yaml` deploys (i.e. nothing else depends on the Playwright install step).
- Confirm `bridge-ready` signaling doesn't introduce a new hang if an artifact's script fails to load at all (the existing `FALLBACK_MS`/large-doc safety nets must still fire in that case).
- **Scale-specific regression tests for items 6/7 in Background:** generate and export a large document (many pages/sections, enough to have previously exceeded 10s of build time) and confirm exactly one download fires, not two. Generate and export a deck with a slide count well past the old 40-second ceiling (e.g. 40–60 slides) via both "HD" buttons and confirm capture completes (with visible progress) rather than timing out.
