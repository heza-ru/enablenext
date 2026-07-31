# Hotfix report: blank canvas on non-schema layout slides

## Status

Fixed. Confirmed via jsdom unit tests and a real-browser Playwright repro.

## Root cause (given, not re-investigated)

`client/public/libs/canvas-editor.js`'s `mount()` only ever rendered
`window.DECK.slides[slideIndex].elements` (the `schema` layout's data
shape). The other 19 hand-coded `deck-renderer.js` layouts (`title`,
`content`, `stat`, `two_col`, `comparison`, `agenda`, `section`, `quote`,
`split`, `chart`, `process`, `icon_grid`, `timeline`, `closing`,
`case_study`, `mockup`, `matrix_2x2`, `event_speaker`, `objective`) keep
their content in layout-specific fields (`stats`, `items`, etc.), not
`elements[]`. Entering canvas-edit mode on any of these produced a
completely blank Konva stage.

## Fix

`client/public/libs/canvas-editor.js`, in `mount(mountEl, slideIndex)`:

- After resolving `slide = window.DECK.slides[activeSlideIndex]`, and
  after creating the `stage`/`layer` (so `isMounted()` stays true and the
  mount/unmount lifecycle is unaffected), check
  `slide.layout !== 'schema'`.
- If true: skip the Transformer/selection/drag/keyboard-shortcut wiring
  entirely (there's nothing to select or drag), and instead append a DOM
  overlay (`div[data-canvas-non-schema-notice]`, absolutely positioned
  over the mount element) reading:
  > This slide uses the '{layout}' layout, which isn't canvas-editable
  > yet. Use "Change layout…" to convert it to a componentId-based layout
  > you can edit directly.
  Styled with the same neutral chrome convention as
  `canvas-context-menu.js` (`#212121` background, `#171717` border,
  `#ececec` text, system font stack) — centered, readable, not
  alarming/red since this is an expected limitation, not an error.
  `pointer-events: none` on the overlay so it never blocks anything
  underneath.
- Still call `window.CanvasTemplatePicker._onMount(...)` and
  `window.CanvasSlideActions._onMount(...)` in this branch, so the
  "Change layout…"/"+ Add slide"/"↑"/"↓"/"Duplicate slide"/"Delete slide"
  chrome (Task 11/12/14) keeps working — "Change layout…" is the intended
  escape hatch out of this state.
- `unmount()` now also removes the overlay element (tracked in a new
  module-level `nonSchemaNoticeEl` variable) so repeated mount/unmount
  cycles don't leak DOM nodes.
- The existing `schema`-layout path (Konva element rendering,
  Transformer, selection, drag, keyboard shortcuts) is completely
  unchanged and only runs when `slide.layout === 'schema'` (or
  `slide.layout` is falsy, preserving old behavior for decks without an
  explicit `layout` field).

## Testing

### jsdom (`client/public/libs/__tests__/canvas-editor.test.js`)

Added a new `describe('CanvasEditor.mount on a non-schema (hand-coded)
layout slide', ...)` block with two tests:

1. Mounting a `layout: 'stat'` slide does not throw, `isMounted()` is
   `true`, the `[data-canvas-non-schema-notice]` element is present and
   its text mentions both the layout name and "Change layout", and the
   Konva layer has zero content nodes (no silent blank-canvas
   regression).
2. Mounting that same non-schema slide, then mounting a `layout:
   'schema'` slide on the same `mountEl` (simulating "Change layout…"
   swap + remount), removes the notice and renders the real element node
   normally.

Full `client/public/libs` suite: **357/357 passing** (baseline was
355/355; +2 new tests, 0 regressions, 0 skipped).

### Real-browser Playwright verification

Scratch harness (not committed): `/tmp/canvas-editor-hotfix-repro.html`
(loads the actual `konva.min.js`, `deck-renderer.js`, `canvas-editor.js`
from `client/public/libs/` against a two-slide `window.DECK`: slide 0
`layout: 'stat'`, slide 1 `layout: 'schema'`) driven by
`/tmp/canvas-editor-hotfix-verify.js` via `chromium.launch()`.

Results:
- Slide 0 (`stat`): `isMounted: true`, notice text = "This slide uses the
  'stat' layout, which isn't canvas-editable yet. Use "Change layout…" to
  convert it to a componentId-based layout you can edit directly.",
  `canvasCount: 1` (stage still created). Screenshot
  (`/tmp/hotfix-stat-slide.png`) confirms the message is visibly centered
  on a dark neutral background — no longer a blank canvas.
- Slide 1 (`schema`), mounted after slide 0 (simulating the
  "Change layout…" flow): `isMounted: true`, notice absent, Konva layer
  contains `['Text', 'Transformer']` — the real element rendered
  normally. Screenshot (`/tmp/hotfix-schema-slide.png`) confirms "Hello
  Schema" text renders on the stage as expected.
- Zero page errors/console errors in either case.

## Concerns / follow-ups (not blocking this hotfix)

- This only addresses the canvas-editor entry point going blank; it does
  not add real editing support for the 19 hand-coded layouts. That's
  explicitly out of scope per the fallback message itself ("Use 'Change
  layout…' to convert it").
- The overlay is a plain DOM `div` layered over the Konva `<canvas>`
  rather than a `Konva.Text` node, per the task's own suggestion that a
  DOM overlay is likely simpler/more reliable for text wrapping; this
  matches the existing pattern of DOM chrome (context menu, template
  picker, slide actions) already living alongside the canvas in this
  codebase.
- Did not re-verify Tasks 11/12/14's chrome buttons end-to-end in a real
  app shell (only confirmed their `_onMount`/`_onUnmount` hooks are still
  invoked identically in the new branch); recommend a quick manual smoke
  test of "Change layout…" from a `stat` slide in the actual running app
  before/soon after this ships, since that is the specific UX path this
  fix depends on to be non-dead-endy.
