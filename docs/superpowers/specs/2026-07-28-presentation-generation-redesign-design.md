# Presentation Generation Redesign — Design Spec

**Date:** 2026-07-28
**Status:** Fully drafted, including master-deck-verified design-system corrections and expanded layout catalog — pending final user review before an implementation plan is written
**Scope:** Sub-project **A** of the three-part export effort (see `2026-07-28-export-pipeline-cleanup-design.md` for sub-project **C**, already approved/implemented in parallel). Covers the presentation/slide generator only. Sub-project **B** (doc generator redesign) is a follow-up, informed by this spec's outcome, and gets its own design.

## Background

The current pipeline (`agents/presentation-creator.skill.md`) has the LLM author one large, fully self-contained HTML artifact per presentation: hand-written CSS for every slide layout, and — critically — each slide's content written out **twice**: once in the visible HTML markup, once again in parallel `data-*` attributes (`data-headline`, `data-bullets` as JSON strings, etc.) that a client-side PptxGenJS script scrapes at download time to reconstruct a native PPTX. A separate "HD" export path (added later, covered in the cleanup spec) screenshots each rendered slide with html2canvas and bundles the images into a PPTX — pixel-perfect visually, but the output isn't editable text/shapes.

This has three concrete costs:
1. **Slow, token-heavy generation** — the LLM writes full CSS-positioned markup plus a duplicated data representation for every slide, for every generation.
2. **Fragile fidelity** — the PPTX exporter reconstructs shapes by scraping `data-*` attributes off rendered DOM, which only works if the LLM keeps two representations byte-consistent; drift between them silently corrupts the export.
3. **Uncontrolled visual quality** — because the LLM authors raw CSS/positioning per slide from a long prompt of design rules, output quality depends on the model reliably following dozens of textual constraints (font sizes, whitespace ratios, layout variety) rather than those constraints being structurally impossible to violate.

### Research findings (external, informing this design)

A survey of how production AI presentation tools (Gamma, Beautiful.ai, Microsoft Copilot for PowerPoint, and open-source reference implementations like AWS's `generate-your-presentation-with-llm` and `slide-deck-ai`) architect generation converged on one consistent pattern, which this spec adopts:

> **The LLM decides content and layout *choice*. A separate, deterministic renderer — engineered once, not regenerated per request — decides pixels.** The LLM emits structured data (a fixed layout enum + content fields); a template/component system turns that data into both the on-screen render and the export, from the same source.

Supporting findings that shape specific decisions below:
- **Fidelity**: HTML→PPTX conversion should target "correct structure, correct text, correct relative positioning," not literal pixel-matching — browser and native-PPTX rendering differ by construction (font hinting, text-wrap algorithms). The reliable win is constraining what layout primitives exist in the first place (fixed grid, fixed type scale) so translation to native shapes is a lookup, not a reverse-engineered computation from arbitrary CSS.
- **Coordinate systems**: PPTX/OOXML uses EMUs (914,400/inch); the standard CSS-px→EMU conversion is `px × 9525` (96dpi assumption). One canonical conversion function, used consistently for position, size, and font metrics, is the concrete anti-pitfall.
- **Fonts**: Google Slides doesn't support embedded font *files* the way desktop PowerPoint does — it substitutes from its own web font catalog and will silently reflow text if a font isn't available. Mitigation is a small, deliberately chosen font pairing available both as a Google Slides web font and a safe CSS fallback.
- **Rendering performance at scale**: `content-visibility: auto` / `contain: layout style paint` on off-screen slide containers is a low-effort, high-value technique that pairs well with a shared renderer (it wasn't previously usable because slide markup was hand-authored per generation, not structurally consistent).
- **Design quality**: "AI slop" comes from *unconstrained* choice, not model capability — the fix is a finite, professionally-designed template library the model selects from, with structural constraints (whitespace ratios, type scale, one-idea-per-slide, action-title/governing-thought framing) enforced by the renderer rather than left to prompt-following.

### Ground truth from the actual master deck (added after initial spec approval)

The user provided the real, approved presentation template (`brand/Copy of Master Deck 2026.pptx`, `.odp`, `.txt`), which was verified directly (unzipped, parsed) and cataloged in `brand/master-deck-layouts.md`. This surfaced two corrections to the design system this spec was about to encode, now resolved in `brand/palette.md` and `brand/typography.md`:

- **Font**: the master deck uses **DM Sans** (1,224 instances across weights) and **IBM Plex Sans** (235 instances) — zero Aeonik across all 104 slides. The design system below uses DM Sans as primary, IBM Plex Sans as secondary, matching the verified template (not Aeonik-primary as the current, pre-redesign skill file has it).
- **Color**: the master deck's dominant dark slide background, by a wide margin (1,154 occurrences, more than white or black), is **`#36314C`** ("Ink 800" in the now-updated `palette.md`) — not `#25223B` ("Ink 700") as previously documented. Both remain valid Whatfix colors; `#36314C` is specifically what generated presentations should default to, since it matches the actual template being modeled.

It also surfaced **13 layout categories** with real content this project should draw from — several genuinely new relative to the current skill's vocabulary (Case Study, Mockups, a 2×2 strategic matrix, richer Agenda/Infographic variants) — folded into the Template Library below.

## Architecture

Replace the current "LLM writes HTML+CSS+data-attrs" model with a three-layer pipeline, while **keeping the existing artifact delivery mechanism unchanged** (still a single self-contained `:::artifact{type="text/html"}` block — this preserves compatibility with the Sandpack preview, the download-bridge/postMessage system, and everything already committed in the cleanup spec).

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Content layer (LLM)                                      │
│    Emits a JSON array of slide specs: { layout, ...fields } │
│    No CSS, no positioning, no duplicated content.           │
└───────────────────────────┬───────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Render layer (shared, pre-built — NOT LLM-authored)       │
│    /libs/deck-renderer.js — fixed template library.          │
│    Consumes the JSON, builds the visible HTML/CSS deck.      │
│    Enforces grid/type-scale/whitespace/one-idea-per-slide.   │
└───────────────────────────┬───────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Export layer (same shared file, same JSON source)         │
│    downloadPptx() reads the JSON directly — no DOM scraping. │
│    One canonical px→EMU conversion. Native, editable shapes. │
└─────────────────────────────────────────────────────────────┘
```

### 1. Content layer — what the LLM actually emits

The artifact's HTML body shrinks to: a `<div id="deck-root">` mount point, a `<script src="/libs/deck-renderer.js">` tag, and a single `<script>` block assigning the slide-spec JSON to a global (e.g. `window.DECK = [...]`) plus a title/theme header. Example slide specs, reusing the existing layout vocabulary so the design-rules knowledge already encoded in the current skill carries over conceptually (just moved from "prose instruction" to "schema"):

```json
{
  "theme": "dark",
  "slides": [
    { "layout": "title", "title": "Onboarding time drops 40% in week one", "eyebrow": "Whatfix · CS · Q3 2026", "subtitle": "One sentence of context.", "brandImage": "product-suite-dark" },
    { "layout": "agenda", "items": ["First section", "Second section", "Next steps"] },
    { "layout": "stat", "label": "Impact at a glance", "stats": [{"value": "40%", "label": "Reduction in onboarding time"}, {"value": "3×", "label": "Faster adoption"}] },
    { "layout": "two_col", "title": "Enterprise-grade integrations, zero rip-and-replace", "bullets": ["...", "..."], "rightBrandImage": "authoring-agent-dark" },
    { "layout": "comparison", "title": "We out-perform [Competitor] on the metrics that matter", "headers": ["Feature", "Whatfix", "Competitor A"], "highlightCol": 1, "rows": [["In-app guidance", "✓", "✗"]] }
  ]
}
```

Every field the LLM writes is content only. Layout is a name picked from a fixed enum (see Template Library below); positioning, spacing, colors, and typography never appear in LLM output. This is the direct fix for the token/speed problem — an average slide spec is on the order of tens of tokens instead of the current hundreds (full CSS-positioned markup plus a duplicated `data-*` JSON blob).

The skill file (`agents/presentation-creator.skill.md`) is rewritten around this: the two-step "propose structure, then build" workflow stays (it's a content/UX concern, unaffected by this change), but Step 2 changes from "write the full HTML template" to "emit the JSON slide array." The skill's design-rules section (action titles, one-idea-per-slide, 3-bullet/8-word limits, layout variety) becomes the schema documentation and validation guidance for the LLM, and is *additionally* enforced structurally in the renderer (see below) rather than relying solely on the LLM following prose instructions.

### 2. Render layer — the shared template library

`client/public/libs/deck-renderer.js`: a single, hand-engineered (not LLM-generated) vanilla-JS file, following the same pattern as `download-bridge.js` from the cleanup spec — one canonical implementation, loaded via `<script src>`, not regenerated per artifact. It owns:

- **The layout template library** — one render function per layout type, with hard-coded grid, spacing, and typography matching the Whatfix design system (Ink 800 `#36314C` dark background, DM Sans/IBM Plex Sans font stack, dark/light sandwich rules — per the master-deck-verified corrections above) — moved from "CSS the LLM must reproduce correctly every time" to "CSS that exists exactly once and is always correct." The enum, expanded from the current skill's 14 types (13 in its "Layout Variety" list plus the separately-defined `title` cover slide) using `brand/master-deck-layouts.md` as the source catalog:

  | Layout | Source | Notes |
  |---|---|---|
  | `title`, `agenda`, `section`, `content`, `two_col`, `stat`, `quote`, `split`, `chart`, `comparison`, `process`, `icon_grid`, `timeline`, `closing` | Current skill (carried over) | `comparison` generalizes to match the master deck's plain `tables` category too |
  | `case_study` | Master deck, slides 38–39 | Challenge / Solution / Key Results blocks + CTA + metadata — new |
  | `mockup` | Master deck, slides 93–95 | Device-frame screenshot placeholder (desktop/mobile) — new |
  | `matrix_2x2` | Master deck, slide 68 | Strategic quadrant matrix (e.g. frequency × complexity) — new |
  | `event_speaker` | Master deck, slides 11–16 | Event cover, named speaker/panel cards — new |
  | `objective` | Master deck, slides 31–33 | Large single-paragraph content block, several width variants — new |

  Two existing types get their parameter *ranges* widened to match the master deck rather than becoming new layout names: `agenda` should support session+time-slot pairs at up to 12 items (master deck slides 17–19), not just a plain numbered list; `icon_grid` should support variable card counts from 2–6 (master deck slides 58–67), not a fixed 2×2/3×2 grid.

  Layouts recommended **not** to add automatically: the master deck's full-bleed `multi_product_graphic` category (slides 84–92) directly conflicts with the current skill's "never use brand images as backgrounds" rule — worth a deliberate decision (see Design System below) rather than folding in silently.
- **Structural enforcement of the design rules** — e.g. the stat layout caps at 3 KPI entries by construction, the content layout caps at 3 bullets by construction, whitespace ratios are baked into the grid rather than left to LLM discretion. Rules that used to be prose instructions the model might drift from become impossible to violate.
- **Rendering performance**: `content-visibility: auto` and `contain: layout style paint` applied to all `.slide` containers except the active/visible one — a low-effort technique from the research that's only reliably applicable now that slide markup is structurally consistent (produced by one renderer, not ad hoc per generation). Full DOM virtualization (mount/unmount off-screen slides via `IntersectionObserver`) is called out as a **phase-2 stretch item** in Non-goals below — `content-visibility` alone should cover the realistic deck sizes here, and adding it is near-zero marginal cost once the renderer is unified; virtualization is a larger lift reserved for if profiling shows it's still needed.
- **Brand image resolution** — same `/brand/` asset table and priority rules (SVG > light PNG > dark PNG) as today, just centralized in the renderer instead of duplicated per-artifact HTML.

### 3. Export layer — PPTX from the same JSON, no DOM scraping

`downloadPptx()` lives in the same `deck-renderer.js` file and reads `window.DECK` directly — the same object the render layer consumed, not the rendered DOM. This eliminates the current failure mode entirely (visible HTML and `data-*` attributes drifting out of sync), because there is only one representation.

- **One canonical px→EMU conversion function**, used consistently for every shape's position, size, and font metrics: `EMU = px × 9525` (96dpi CSS-pixel assumption), applied against the same fixed grid units the render layer uses — so a slide's PPTX geometry is a direct, deterministic mapping from its grid position, not a re-derivation from computed DOM styles.
- **Font strategy**: PPTX text uses DM Sans as primary (confirmed natively available in Google Slides, avoiding the silent-substitution/reflow problem the research flags as the most common cross-platform fidelity break, and matching the master deck's actual usage — see above) with IBM Plex Sans as secondary. No font embedding is introduced in this phase (see Non-goals).
- **CSS effects that have no PPTX equivalent** (`backdrop-filter`, `mix-blend-mode`, SVG filters, complex transforms) are **not available as options** in the template library's layout definitions in the first place — the existing skill already avoids most of these for content slides, and centralizing the templates makes this an enforced constraint rather than a per-generation hope.
- **Fate of the "HD" screenshot export path** (html2canvas → image-only PPTX/PDF, covered in the cleanup spec's timeout fixes): once this native JSON→PPTX path is validated for fidelity, it directly produces editable, high-fidelity output — the original motivation for the image-based HD path (fidelity) is substantially addressed without sacrificing editability. Recommendation: **keep the HD buttons as a fallback path during rollout** (its cleanup-spec bugfixes are still valuable — some users may still want a pixel-identical flattened export for edge cases the template library doesn't cover well), but this is a decision worth revisiting once fidelity is validated — not something to remove preemptively in this spec.

## Design System (moved from prose to code)

The existing Whatfix color palette, typography scale, dark/light sandwich rules, and layout-variety rules from the current skill file (lines 95–164) carry over **largely unchanged in substance**, with the two master-deck-verified corrections above (Ink 800 `#36314C` as default dark bg, DM Sans/IBM Plex Sans as the font pairing) — this spec doesn't propose new visual design beyond those two corrections; it proposes moving enforcement of the design system from "the LLM must remember and correctly apply these rules to hand-written CSS every time" to "these rules are the only options the renderer exposes." The action-title / one-governing-thought-per-slide content rule likewise carries over as a schema field (e.g. a required, complete-sentence `title` per slide) rather than a prose reminder.

**Open question, not resolved by this spec**: the master deck's `multi_product_graphic` category uses full-bleed brand images on content slides, directly contradicting the current skill's explicit "never use brand images as slide backgrounds" rule (`agents/presentation-creator.skill.md`, CRITICAL Rules). Recommendation: treat it as a deliberate, narrow exception (its own `layout: "product_suite_fullbleed"` type, used only for product-suite-overview slides) rather than either silently adding it as a general capability or dropping it — but this is a design call worth explicit sign-off before implementation, not something to decide by default.

## Non-goals (this phase)

- **No React or other UI framework introduced into the artifact runtime.** `deck-renderer.js` stays vanilla JS/DOM, consistent with the existing artifact architecture (plain script tags, no build step inside the sandboxed iframe) and the `download-bridge.js` pattern from the cleanup spec.
- **No font embedding in the exported PPTX.** DM Sans's native availability in Google Slides is sufficient for this phase; embedding (with its ~500KB–2MB per-family cost and licensing constraints) is deferred until there's a concrete need for a non-web-safe font.
- **No automated visual-regression fidelity testing (render-both-and-diff) in this phase.** The research recommends this as the state of the art for catching fidelity regressions, and it's called out explicitly as a valuable follow-up (see Testing below), but stands up its own tooling (a PPTX→image converter, a perceptual diff step) and is scoped as a fast-follow, not a blocker to shipping the core redesign.
- **No full DOM virtualization of off-screen slides.** `content-visibility`/`contain` is the phase-1 performance technique; IntersectionObserver-based mount/unmount is a stretch item if profiling on realistically large decks shows it's still needed.
- **Doc generator redesign (sub-project B)** is explicitly out of scope — a separate spec, informed by whatever's learned building this.
- **Retiring the "HD" screenshot export path** is not decided in this spec — it stays as-is (with the cleanup spec's scaling/timeout fixes) pending real-world fidelity validation of the new native export.

## Migration

No conversion of already-generated presentations is needed or possible — existing chat artifacts are immutable message content, self-contained with their own (old-format) HTML/CSS/JS, and continue to work exactly as before. Only the skill file changes; every *new* generation uses the new JSON-spec format and the new `deck-renderer.js`. There is no versioning conflict since old artifacts don't reference `/libs/deck-renderer.js` at all.

## Testing / Verification

- **Manual side-by-side comparison** of a representative deck (mixed layout types, at least one of each template) generated under the old skill vs. the new one, checked in-app (visible render) and after PPTX export (opened in both Google Slides and PowerPoint if available) for layout correctness and font fidelity.
- **Regression check against the cleanup spec's scale tests**: re-run the large-deck (40–60 slide) export test from the cleanup spec against the new native PPTX path — this export should now be genuinely fast (JSON-driven, no per-slide screenshot capture) rather than needing the batching/progress-reporting mitigations built for the HD path.
- **Token/speed comparison**: measure generation token count and wall-clock time for an equivalent deck under the old vs. new skill, to confirm the expected efficiency win is real and not just theoretical.
- **Fast-follow (not blocking this spec)**: automated visual-regression fidelity testing — render the exported PPTX to images (e.g. via a headless LibreOffice convert-to-PNG step) and perceptually diff against the HTML render, to catch fidelity regressions in CI going forward rather than relying on manual spot-checks.
