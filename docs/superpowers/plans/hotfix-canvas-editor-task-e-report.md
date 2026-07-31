# Hotfix: consolidate presentation download format buttons (Task E)

## Problem

`client/src/components/Artifacts/DownloadArtifact.tsx` rendered, for
presentation-deck artifacts, a flat row of 7-8 equal-weight buttons in one
toolbar: the native `PPTX` button, an optional `Drive` save button, `PDF`,
`PDF (Compat)`, `PDF (HD)`, `PPTX (HD)`, `HTML`, and finally `Edit`/`Done
Editing`. A user reported this was genuinely hard to navigate.

## Fix

Consolidated every download-FORMAT option for presentation artifacts (native
format, PDF, PDF (Compat), PDF (HD), PPTX (HD), HTML) into a single
`Download` button that opens a dropdown menu, built from this codebase's
existing `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/
`DropdownMenuItem` (Radix-based, exported from `@librechat/client` /
`packages/client/src/components/DropdownMenu.tsx`). No handler logic was
touched — this is a pure JSX reorganization:

- Each dropdown item calls the exact same `onClick` handler the old button
  did (`handleDownloadClick`/`printPdf`/`printPdfCompat`/`downloadPdfHD`/
  `downloadPptxHD`/`downloadHtml`), with the same `done === 'x'` checkmark
  indicator and the same `aria-label`/`title` text.
- The DOCX page-size picker and XLSX sheet-selection picker are unchanged
  (`docxPicker`/`xlsxPicker` state, `confirmDocxDownload`/
  `confirmXlsxDownload`) — they're rendered once, anchored under the single
  Download button, instead of once per native-format button. Selecting
  DOCX/XLSX in the menu closes the menu (Radix's default item-select
  behavior) and the picker dialog appears independently of the menu's
  open/closed state, exactly as before.
- `Edit`/`Done Editing` stays its own, always-visible button OUTSIDE the
  dropdown (a distinct primary action, not a download variant) — hiding it in
  a menu would make editing harder to discover, the opposite of the goal.
- Per-format `Drive` save buttons, `driveError`/`driveLink` feedback, and
  `downloadError` feedback all stay OUTSIDE the dropdown, always visible —
  live status feedback (spinners, errors, success links) must never be
  hidden behind a closed menu.
- Non-presentation (DOCX/XLSX-only) artifacts are explicitly out of scope:
  the component now branches on `isPresentationArtifact` and renders the
  **exact original** flat-button-row JSX, byte-for-byte, for that path — only
  the `isPresentationArtifact` branch was touched.

### Button count in the header (presentation artifacts)

- **Before**: up to 8 buttons — `PPTX`, optional `Drive`, `PDF`,
  `PDF (Compat)`, `PDF (HD)`, `PPTX (HD)`, `HTML`, `Edit`/`Done Editing`
  (plus inline Drive error/success text when active).
- **After**: 2-3 always-visible controls — `Download` (opens a 6-item
  dropdown: PPTX, PDF, PDF (Compat), PDF (HD), PPTX (HD), HTML), optional
  `Drive`, and `Edit`/`Done Editing`. Live Drive/download error/success
  feedback still appears inline next to these when active, same as before.

Non-presentation (DOCX/XLSX-only) artifacts: unchanged, still a flat row.

## Testing

Baseline (before test updates, after the JSX change): 35/40 passed, 5
failed — all failures were tests asserting on the old flat-button DOM
structure (native-format button/tooltip queries that now require opening the
dropdown first).

Fixed by:
- Adding an `openDownloadMenu()` test helper. Radix's `DropdownMenuTrigger`
  only opens on a full pointerdown/pointerup gesture (or Enter/Space/
  ArrowDown keydown) — it has no plain `onClick` handler — so
  `fireEvent.click`/`fireEvent.pointerDown` never opened it in jsdom.
  Switched to `@testing-library/user-event` (`userEvent.setup({ delay: null
  })`), which simulates the full event sequence and reliably opens the menu
  under both real and fake timers.
- Updating the 5 failing tests (PDF (HD) tooltip test, the 3
  readiness-vs-liveness tests, and the zero-args-PPTX regression test) to call
  `await openDownloadMenu(getByLabelText)` before clicking/querying a format
  item — no assertions were weakened, only the interaction path was adapted.
- Adding a new `describe('DownloadArtifact — consolidated download dropdown
  (presentation artifacts)')` block (5 new tests): confirms the toolbar
  collapses to a closed `Download` trigger + a separately-visible `Edit`
  button with no individual PDF/PDF (Compat)/PDF (HD)/PPTX (HD) buttons in the
  DOM by default; confirms the dropdown reveals all 6 expected menu items
  with their labels once opened; confirms clicking the PPTX menu item still
  dispatches the identical `postMessage` the old flat button did; confirms
  clicking HTML in the menu still triggers the same client-side download
  (`URL.createObjectURL`); confirms the Drive button stays visible without
  opening the dropdown at all.

Final: **45/45 passed** (40 baseline + 5 new), 0 failures.

Also ran `tsc --noEmit` (no new errors in this file) and `eslint --fix`
(fixed formatting-only issues; the remaining `i18next/no-literal-string`
errors on literal labels like `PDF (Compat)`/`Open ↗`/`Drive failed` are
pre-existing on `main` for this exact file — confirmed via `git stash` +
re-lint — and are unchanged in kind/count by this JSX reorganization, not a
regression introduced here).

## Report contract

- **Status**: Complete.
- **Commit SHA**: see `git log -1` after this report is committed.
- **Test summary**: baseline 35/40 (5 failing due to DOM-structure change),
  after fix 45/45 (40 original + 5 new dropdown-specific tests).
- **Concerns**: none blocking. Pre-existing `i18next/no-literal-string` lint
  debt on this file is unchanged in nature (same literal English labels,
  just relocated into `DropdownMenuItem`s) and was not introduced by this
  change.
