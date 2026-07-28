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

### 4. Fix stale UI copy

Update the "PDF (HD)" button's tooltip in `DownloadArtifact.tsx` (currently: *"Server-side Playwright render — preserves all CSS effects including backdrop-filter and blend modes"*) to accurately describe the current client-side html2canvas screenshot approach, including the real limitation that html2canvas does not reliably support `backdrop-filter`/blend-modes (the opposite of what the stale copy claims).

### 5. Eliminate CDN version drift by loading from already-bundled local libraries

`client/public/libs/` already contains `pptxgen.bundle.js` (confirmed v4.0.1, matches skill assumption), `xlsx.full.min.js` (confirmed v0.18.5, matches skill assumption), and `docx.iife.js` (version unconfirmed by static inspection — see Risk below). Repoint all three skill templates (`presentation-creator.skill.md`, `doc-creator.skill.md`, `excel-creator.skill.md`) to load their respective library from the local `/libs/` bundle as the sole source, dropping the CDN load entirely. This removes both the version-drift risk and a runtime dependency on a third-party CDN being reachable.

**Risk requiring a runtime check during implementation:** `docx.iife.js` is a rolldown-bundled file with no clean version string extractable by static grep. `client/package.json` declares `docx ^9.7.1`, while `doc-creator.skill.md`'s `downloadDocx()` template code is written against the v8.5.0 API it currently loads from CDN. docx.js has breaking API changes between v8 and v9. Before repointing the doc skill to the local bundle, implementation must either (a) confirm the bundle is actually v8.x-API-compatible, or (b) update `downloadDocx()`'s template code to the v9 API if the bundle is v9. This must be verified with a real load-and-inspect (e.g. checking `docx.Packer` or a known v9-only export) rather than assumed.

## Non-goals

- No changes to the vector PPTX export methodology, the HD image-capture approach, or the doc/excel generation methodology — that's sub-projects A and B.
- No new features. This is cleanup only: dead code removal, deduplication, race-condition fixes, copy fixes, and dependency-source consolidation.

## Testing / Verification

- Manual smoke test of all three export paths (PPTX vector, PPTX HD, PDF, PDF Compat, DOCX, XLSX) after the local-lib repointing, to catch the docx version-compatibility risk and confirm nothing regressed.
- Confirm the dead route's removal doesn't break `render.yaml` deploys (i.e. nothing else depends on the Playwright install step).
- Confirm `bridge-ready` signaling doesn't introduce a new hang if an artifact's script fails to load at all (the existing `FALLBACK_MS`/40s safety nets must still fire in that case).
