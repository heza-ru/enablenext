# Presentation Engine v2 Design

**Scope:** Follow-on to the presentation generation redesign (`2026-07-28-presentation-generation-redesign-design.md`, fully implemented). That redesign fixed the dual-representation/content-loss bug and shipped 19 hand-coded layouts. This spec addresses feedback that those 19 layouts are too generic relative to the real master deck — which has multiple distinct visual variants per category (6 title variants, several section-divider variants, 4 thank-you variants, etc., per `brand/master-deck-layouts.md`) — and a request to move toward a richer, more editable, more faithful system, informed by the open-source [Presenton](https://github.com/presenton/presenton) project's approach where compatible with this app's architecture.

## Problem

1. **Layout genericity.** Each master-deck category (title, section, closing, agenda, event/speaker, etc.) has multiple real, distinct visual variants — the current registry has exactly one hand-coded version of each, so generated decks feel repetitive and don't reflect the actual richness of the source deck.
2. **Marginal cost of variety is too high.** Adding N more layout variants under the current architecture means hand-writing N more `render()`/`exportPptx()` pairs — every new variant is bespoke code, not data.
3. **No structured editing.** Once a deck is generated, fixing a typo, swapping a layout, reordering slides, or changing an image means asking the LLM to regenerate — there's no direct-manipulation path.
4. **Icon/chart support is thin.** `icon_grid`'s `icon` field is accepted but never rendered (a known gap); `chart` only supports a single bar-chart shape.

## What Presenton offers, and what's actually reusable

Presenton is a full standalone product (Next.js frontend, FastAPI/Python backend, its own database, auth, multi-user workspaces, BYOK model-provider switching, Docker/Electron packaging) — **none of that is reusable or relevant here**: this app already has all of that via LibreChat (auth, workspaces, model selection), and this system is architecturally a single self-contained HTML artifact rendered in a sandboxed iframe with no build step and no server component beyond static file serving. Adopting Presenton's app-level infrastructure would mean fighting our own host app.

What **is** reusable, because it's plain data, not code: **Presenton's template format** — each of its 7 built-in templates (general, executive, modern, momentum, standard, swift, dynamic) is a JSON file describing slides as a tree of `components` → `variants` → `elements` (vectors/shapes, text, images), each with absolute pixel positions on a 1280×720 canvas. This is engine-agnostic (Apache 2.0 licensed — attribution required, their specific demo content/images are not reused, only the schema shape) and can be interpreted by any renderer, including ours.

Also confirmed compatible and valuable from Presenton's broader feature set:
- **AI template generation from an existing PPTX** — Presenton can convert an uploaded `.pptx` into its JSON template format. We adopt the *idea* (a real PPTX→schema converter, not Presenton's own Python implementation) as a reusable tool, not a one-off script — usable now for the master deck, and again in the future for any other reference deck.
- **Icon support** and **chart-type variety** — genuine gaps in our current layout set, confirmed against Presenton's richer built-in support.

Explicitly out of scope (confirmed with the project owner):
- Stock/generated images (Pexels/Pixabay/DALL-E) for non-brand content — declined; image support stays limited to real brand assets.
- Free-form drag-and-drop canvas editing — declined in favor of structured editing (see below).
- Any of Presenton's own infrastructure (auth, multi-user workspaces, BYOK, Ollama, MCP server, Docker/Electron).

## Architecture

### 1. Generic component/element interpreter (replaces per-layout hand-coding)

A new engine inside `deck-renderer.js` (or a new sibling file, e.g. `deck-schema-renderer.js` — decided during planning) that walks a component/element JSON tree and renders it two ways from one source, exactly like the rest of this redesign's discipline:
- **Preview**: elements → DOM/CSS (vectors → CSS shapes/backgrounds, text → styled text nodes, images → `<img>`), positioned via the same inches-based (or a pixel-based, converted) canvas scaling already established.
- **Export**: elements → PptxGenJS calls (vectors → `addShape`, text → `addText`, images → `addImage`) — one interpreter, not one function pair per layout.

Existing hand-coded layouts (the 19 from the prior redesign) are **not deleted** — they remain a fast, simple path for straightforward content. The interpreter is additive: a new, richer path for slides that come from real extracted deck data.

### 2. PPTX → schema converter (reusable tool)

A script (Node, run offline/on-demand — not part of the live browser bundle) that:
1. Unzips a given `.pptx`, reads each slide's XML (shapes, text runs, positions, colors, embedded images — same EMU-to-real-units technique already proven in the original redesign's Task 5).
2. Emits the component/element JSON schema described above.
3. Extracts embedded images from `ppt/media/` into real static files (`client/public/brand/` or a new `client/public/deck-assets/`), not re-fetched from any external source.

Run once now against `brand/Copy of Master Deck 2026.pptx` to produce a real, faithful slide-variant library. Kept as a general tool (documented, not deleted after first use) so a future different reference deck can go through the same pipeline.

### 3. Icon and chart improvements

- Wire `icon_grid`'s existing `icon` field to an actual small inline-SVG icon set (a bounded, curated library — not arbitrary icon-name lookup against an external service), fixing the known "accepted but not rendered" gap.
- Extend `chart` (or add a sibling layout) to support at least one additional chart shape beyond bars (e.g. a simple line/pie variant), using the same shared-geometry-drives-both-paths discipline.

### 4. Structured editor in the artifact panel

Confirmed scope: **structured editing, not free-form canvas manipulation.**
- Click any text on a slide → edits inline (`contenteditable`), writes directly back into the in-memory `window.DECK` JSON — same single-source-of-truth discipline as the rest of this system.
- A per-slide layout/variant picker (swap which real variant is used for a given category).
- Slide reorder / duplicate / delete via a simple list or thumbnail strip.
- A brand-image picker for any image-bearing field.
- Lives inside `deck-renderer.js` (same file that already owns rendering), toggled by a new "Edit" control in the artifact panel (`DownloadArtifact.tsx`/`Artifacts.tsx`), using the same postMessage pattern already established (`bridge-ready`, `artifact-download-request`) — not a new communication mechanism.
- **Persistence**: an edited deck saves as a new artifact version, reusing the existing `ArtifactVersion` mechanism — this is a real integration point with the artifact-versioning system and needs its own careful design during planning (how the edited HTML gets written back to conversation/message storage is a LibreChat-level question, not just a `deck-renderer.js` one).

## Non-Goals

- Free-form drag/resize/rotate canvas editing.
- Stock or AI-generated images for non-brand content.
- Any Presenton infrastructure (auth, workspaces, BYOK, Ollama, MCP, Docker/Electron packaging).
- Changes to the doc generator or excel generator — this spec is presentation-only.
- Real-time multi-user collaborative editing of a single deck.

## Migration

The 19 existing hand-coded layouts remain fully supported and untouched — this is a purely additive architecture. Decks generated under the prior redesign (JSON `window.DECK` + hand-coded layouts) continue to work exactly as today; the new interpreter is an additional path the LLM can select into (e.g. `layout: "schema"` with a `componentId` referencing the extracted master-deck library), not a replacement requiring migration.

## Testing / Verification

Same TDD discipline as the rest of this project: Jest + jsdom unit tests for the interpreter (given a small hand-written component/element fixture, confirm correct DOM output and correct PptxGenJS call shape), for the converter script (given a small fixture `.pptx`, confirm correct schema/image extraction — likely needs its own fixture file, not the full 100+-slide master deck, for fast tests), and for the editor's DECK-mutation logic (contenteditable commit, reorder, variant swap all correctly update the in-memory spec). End-to-end verification follows the established adapted-substitute approach (real Playwright render + real export generation + inspection) given this environment's lack of a live browser/backend to drive the actual chat UI end-to-end.
