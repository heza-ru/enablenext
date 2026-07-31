# Presentation Editor v2 (Canvas Parity) — Design Spec

**Goal:** Replace the current contenteditable-based deck editor with a genuine canvas editor (Presenton-parity: free drag/resize/rotate, floating per-element toolbars, multi-select, z-order, undo/redo, autosave, image upload+crop) — without touching the existing, already-working DOM/CSS view renderer or PPTX export pipeline. Separately, fix two real contributors to generated decks not visually matching the real master deck template.

## Background

The current editor (`deck-editor.js`, built across an earlier session) supports: inline contenteditable text, reorder/duplicate/delete buttons, an image-swap prompt, and a layout-swap thumbnail popover. It has no free positioning, no resize/rotate, no per-element rich toolbar, no undo/redo, and persists via an explicit Save button.

Research into Presenton (`github.com/presenton/presenton`, verified against real source, not marketing copy) confirmed its editor is a `react-konva` canvas: Konva `Transformer` for resize/rotate handles, floating per-element-type toolbars (`FloatingToolbar.tsx` portaled to `document.body`, positioned relative to the selected element), multi-select with dashed group outlines, keyboard shortcuts for duplicate/delete/z-order/undo-redo, a Redux undo/redo stack, a debounced autosave (`useAutoSave.tsx`), and an `ImageEditor.tsx` (upload/crop/focus-point — plus AI-gen/stock search, explicitly out of scope here per the user's decision).

Separately, generated decks visually diverge from the real master deck (`brand/Copy of Master Deck 2026.pptx`) even when not touching the componentId system at all: the hand-coded fallback layouts use `#25223B` as their dark background, but `brand/master-deck-layouts.md`'s own measured audit found the master deck's actual dominant background color is `#36314C` (1,154 occurrences vs. `#25223B`'s 38) — a discrepancy flagged in that document but never resolved in code. Separately, the componentId lookup workflow requires `file_search` against a 531KB/24,865-line `master-deck-library.json`, which is impractical to search effectively in practice (no natural-language content to match beyond nested numeric coordinates), making the hand-coded fallback the path of least resistance.

## Non-Goals (explicitly out of scope, confirmed with the user)

- AI image generation / stock-photo search in the image editor (upload + crop/focus-point only).
- Natural-language chat-based editing panel (Presenton's parallel `Chat.tsx` edit flow).
- Changing the DOM/CSS view renderer or PPTX export pipeline's own rendering logic (dual-renderer architecture, see below — they are not touched).

## Architecture

### Dual-renderer: Konva edit surface, existing DOM/CSS view+export untouched

Editing swaps the visible surface to a Konva canvas; toggling edit off (or after an autosave round-trip) writes geometry/content changes back into `elements[]` and hands control back to the existing `deck-renderer.js`/`deck-schema-renderer.js` DOM renderer, completely unmodified. The Konva canvas is seeded from the same slide spec data at edit-open time and is the only new rendering surface — the 19 hand-coded layouts, the schema layout, chart types, and the PPTX exporter (`downloadPptx`/`exportSchemaElements`) are not touched by this work at all.

Files:
- New: `client/public/libs/canvas-editor.js` — Konva stage setup, element-to-Konva-node mapping, selection/transformer wiring, keyboard shortcuts, undo/redo stack, autosave queue trigger. Loaded via `<script src="/libs/canvas-editor.js">`, replacing `deck-editor.js` in the artifact template (old `deck-editor.js` is removed once this ships — no dual editor code paths left behind).
- New: `client/public/libs/canvas-toolbars.js` — floating per-element-type toolbar DOM (text/image/shape), positioned relative to the Konva stage's current selection bounds.
- New: `client/public/libs/canvas-image-editor.js` — upload + crop/focus-point UI (a modal/sheet, not a Konva node).
- Modify: `agents/presentation-creator.skill.md` — script tag list (swap `deck-editor.js` → the three new files), remove now-stale "the structured editor is automatic" paragraph description, replace with a short accurate description of the canvas editor.
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx` — the Edit/Save button pair, the `artifact-editor-toggle` postMessage, and `saveEditedDeck` become: an Edit toggle (unchanged trigger), autosave queue consumption (no more explicit Save button/state), and an updated `artifact-deck-updated` listener contract (still receives the mutated deck, but on a serialized-queue cadence, not a single manual click).
- Modify: `client/public/libs/download-bridge.js` — `artifact-editor-toggle` relays to the new canvas editor's enable/disable API instead of `window.DeckEditor`.

### Data model additions

`ElementSpec` (documented in `agents/presentation-creator.skill.md`'s new field reference) gains two new optional fields, both backward compatible (undefined/0 for every existing slide, no migration needed):
- `rotation?: number` — degrees, 0 default.
- `zIndex?: number` — paint order within the slide's `elements[]`, default = array order (i.e., absent `zIndex` means "render in array order," matching all 104 existing master-deck-library entries and every hand-authored deck unchanged).

`deck-schema-renderer.js`'s `renderSchemaElements`/`exportSchemaElements` gain support for both fields (CSS `transform: rotate()` / PptxGenJS `rotate` for rotation; a stable sort by `zIndex` before rendering/exporting, falling back to array order when absent) — this is the ONE change to the existing DOM/CSS+export pipeline this project needs, since the canvas editor can produce rotated/z-ordered elements that must still render correctly outside edit mode and in the exported PPTX.

### Selection & manipulation (`canvas-editor.js`)

- Konva `Transformer` bound to the current selection: corner/edge resize handles + a rotation handle, matching Presenton's actual mechanism.
- Multi-select via shift-click, dashed bounding box for the group selection and each member.
- Keyboard shortcuts: `Delete`/`Backspace` (delete selection), `Cmd/Ctrl+D` (duplicate selection), arrow keys (nudge position, Shift+arrow = larger nudge), `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` (undo/redo), `Alt+]` / `Alt+[` (bring forward/backward), `Shift+Alt+]` / `Shift+Alt+[` (bring to front/send to back) — z-order shortcuts mutate the element's `zIndex`.
- A "⋮ More" contextual menu (matching Presenton's `ComponentActionsMenu`) exposing the same actions via click for discoverability, not just shortcuts.

### Floating toolbars (`canvas-toolbars.js`)

One toolbar DOM element, portaled to `document.body`, repositioned on every selection/transform change to sit above (or below, if clipped) the selection's bounding box in screen coordinates. Contents swap based on the selected element's `type`:
- `text`: font family (constrained to DM Sans/IBM Plex Sans, matching brand fonts already embedded), size, color, bold, align.
- `image`: "Replace image" (opens `canvas-image-editor.js`), "Crop" (focus-point mode).
- `shape`: fill color, opacity.

Uses the same neutral app-chrome theme established in the prior editor work (`#171717`/`#212121` surfaces, `#ececec` text) — not the deck's own brand palette, for the same reason as before (this is app tooling, not slide content).

### Undo/redo

A local history stack (past/future arrays of `window.DECK` snapshots — deep-cloned JSON, matching the existing `duplicateSlide`'s deep-copy discipline), independent of persistence. Every mutating action (move/resize/rotate/add/delete/duplicate/z-order/toolbar edit) pushes a snapshot before applying the change. Undo/redo only ever touches local state; whether/when that state gets persisted is the autosave queue's separate concern.

### Autosave (serialized queue — the one piece requiring real care)

**Root constraint discovered during design:** `replaceArtifactContent` (`api/server/services/Artifacts/update.js`) persists by finding the exact `original` string as a literal substring inside the message's current stored text and splicing in `updated` — it is NOT a wholesale-document PUT (unlike Presenton's own autosave, which is why naively porting "debounce and fire" would be unsafe here). If two saves are in flight concurrently and resolve out of order, a later-dispatched save carrying a stale `original` will either fail its `indexOf` lookup (edit silently dropped) or, worse, a late-resolving stale response could overwrite a newer save's result.

**Design:** a save queue with these invariants:
1. At most one `useEditArtifact` mutation in flight at a time.
2. Edits are debounced (~1s, matching Presenton) into a single pending snapshot; if more edits arrive while a save is in flight, they coalesce into the NEXT queued save rather than firing a new one immediately.
3. Each save's `original` parameter is always the exact `updated` string the PREVIOUS save in this queue actually sent (or `artifact.content` for the first save this session) — never a snapshot from before that save was dispatched — so the substring match always succeeds regardless of debounce timing.
4. On a failed save (network error, or `replaceArtifactContent` returning null because the substring wasn't found — e.g. a concurrent edit from elsewhere), retry once from the current server-confirmed content; on a second failure, surface a visible "autosave failed" indicator (non-blocking — local edits are never lost, only the persistence lags) rather than silently dropping the edit.

### Image handling (`canvas-image-editor.js`)

A modal/sheet with two tabs: "Upload" (drag/drop or file picker, using whatever asset-upload path this app's chat file attachments already use — no new upload infrastructure) and "Existing assets" (pick from `client/public/brand/` and `client/public/deck-assets/`, i.e. the same brandImage/deckAsset universe the schema renderer already supports). A crop/focus-point control sets `objectFit`/focus-position within the element's frame, mapped onto the existing `brandImage`/`deckAsset` fields — no new image-reference field type.

### Template pickers

- Existing swap-in-place popover (Task 19, `deck-editor.js`'s `openVariantPopover` logic) is ported as-is into the new canvas editor's chrome, unchanged in behavior.
- New "+ Add slide" thumbnail-grid picker (separate button, separate popover) that inserts a new slide after the current one from a chosen `componentId`, matching Presenton's actual "Use Template" behavior (insert, not swap).

### Template-fidelity fixes (independent of the editor work, same plan)

1. **Color reconciliation**: every hand-coded layout in `deck-renderer.js` (and `injectBaseStyles()`'s `.slide` default background) that currently hardcodes `#25223B` changes to `#36314C`, matching the master deck's actual measured dominant color. `brand/palette.md` gets a corresponding correction/addition (documenting `#36314C` as the primary dark background, `#25223B` demoted to a secondary/rare variant, matching the real usage counts). PPTX export color strings updated to match (`25223B` → `36314C` in every `fill:{color:...}` call site).
2. **Practical componentId reference**: replace the "`file_search` a 531KB JSON blob" instruction in `agents/presentation-creator.skill.md` with a small, curated, embedded-in-the-skill-file reference — one representative example `elements[]` array (or a short excerpt) per category (title/agenda/section/closing, plus 2-3 of the richer content categories from `brand/master-deck-layouts.md`), so a real componentId is actually the path of least resistance during generation instead of file_search friction pushing toward the hand-coded fallback.

## Testing strategy

Konva requires a real `<canvas>` 2D rendering context, which jsdom does not provide by default. Two tiers:
- **Data/state layer** (undo/redo stack, autosave queue serialization, `rotation`/`zIndex` schema handling in `deck-schema-renderer.js`, color reconciliation): normal jsdom/jest unit tests, same conventions as the rest of this codebase.
- **Canvas interaction layer** (drag/resize/rotate, selection, floating toolbar positioning): Playwright against a real Chromium browser — the same technique already used this session to find and verify the render-isolation crash bug — since jsdom cannot meaningfully exercise actual canvas pointer/transform behavior.

## Quality control plan (per the user's explicit ask)

Given the scope (new rendering subsystem + persistence-safety-critical autosave + UI/UX-sensitive canvas interactions), this ships via subagent-driven-development with the same discipline as the original 19-task plan: fresh implementer per task, task-level spec+quality review, fix-loop on findings, and a final whole-branch review before merge — with the addition that:
- Every task touching actual canvas interaction (drag/resize/rotate/selection/toolbar positioning) must include a real-browser Playwright verification in its own report, not just jsdom assertions, since jsdom cannot prove those work at all.
- The autosave queue task specifically must include a concurrency test proving the "stale `original`" race described above cannot occur (e.g., two rapid edits within the debounce window followed by inspecting the actual sequence of `original`/`updated` pairs sent).
- A dedicated UI/UX review pass (real browser, real interaction, not just code read-through) checks: does dragging/resizing feel responsive (no visible lag), do toolbars stay reachable at viewport edges, is the autosave-failed indicator clear, does the whole thing feel native to this app's existing visual language rather than looking bolted-on.
