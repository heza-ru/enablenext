# Hotfix: relay cross-origin asset fetches through the parent app (Task B)

## Root cause

The deck artifact runs inside a cross-origin Sandpack sandbox iframe in production. Two call sites did a direct `fetch(origin + path)` against the real app's static assets, which is CORS-blocked there:

1. `client/public/libs/deck-renderer.js`'s `embedFontsInPptx()` — fetched font binaries (`/brand/fonts/*.fntdata`). The uncaught CORS failure propagated out of `downloadPptx()`, killing the entire PPTX export.
2. `client/public/libs/canvas-template-picker.js`'s `fetchLibrary()` — fetched `/brand/master-deck-library.json`. The uncaught failure broke both the "Change layout…" and "+ Add slide" pickers.

## Fix

- Added a generic `artifact-asset-fetch-request` / `-result` relay in `client/src/components/Artifacts/DownloadArtifact.tsx` (alongside the existing Task 10 image-upload relay), doing a same-origin `fetch(window.location.origin + path)` from the parent page and posting the result (base64 for binary, text for JSON) back to the iframe. Added `arrayBufferToBase64()` helper.
- Added a `fetchViaParentIfNeeded(path, encoding)` client-side helper (duplicated per-file, matching this codebase's vanilla-JS IIFE convention) in both `deck-renderer.js` and `canvas-template-picker.js`: tries the direct fetch first, falls back to the postMessage relay (with a 10s timeout) only on failure. `deck-renderer.js` additionally has a `base64ToArrayBuffer()` helper to decode the relayed font binaries back into real `ArrayBuffer`s for `zip.file(...)`.
- `embedFontsInPptx()`'s entire font-fetching loop is now wrapped in try/catch: any failure (direct fetch or relay) logs `console.warn(...)` and returns the original, unmodified blob — so a font-embedding failure degrades to "PPTX without embedded fonts," never to "no PPTX at all."
- `fetchLibrary()` now does `fetchViaParentIfNeeded(path, 'text').then(JSON.parse)` instead of `fetch(...).then(r => r.json())`.

## Test updates

- Updated the `global.fetch` mocks in `deck-renderer.test.js` and `canvas-template-picker.test.js` to use `ok`/`text()`/`arrayBuffer()` shapes matching the new helper (mocks lacking an explicit `ok` property are still treated as success, since the helper only fails fast on `ok === false`, preserving all pre-existing test mocks unmodified where possible).
- Added new jsdom coverage: relay-fallback-succeeds, relay-timeout-doesn't-hang, and (for `embedFontsInPptx`) graceful degradation to the original blob with a console warning when both direct fetch and relay fail — no thrown/rejected promise.
- Added new `DownloadArtifact.test.tsx` coverage for the new relay listener: base64 round-trip of binary data, text/JSON passthrough, error-result posting, and ignoring unrelated message types.

## Test results

- `client/public/libs` suite: 357/357 → 363/363 passing (6 new tests, no regressions).
- `DownloadArtifact.test.tsx`: 36/36 → 40/40 passing (4 new tests, no regressions).

## Concerns

- None outstanding. Real-browser Playwright verification was intentionally skipped per the task instructions (network/messaging-layer fix, not a canvas-rasterization concern); jsdom/jest coverage is thorough for both the client-side fallback logic and the parent-side relay.
