---
name: presentation-creator
description: Use when the user asks for a presentation, slides, slide deck, pitch deck, POC playbook, demo playbook, proof of concept deck, sales playbook, or engagement playbook. Generates an interactive HTML artifact rendered inline — no code execution or API keys required.
user-invocable: true
allowed-tools: ["artifacts", "file_search"]
---

# Presentation Creator Skill

Generate a single complete self-contained HTML artifact that:
1. **Renders as interactive professional slides** in the side panel
2. **Exposes a `downloadPptx()` function** used by the artifact panel to generate a real `.pptx` file client-side using PptxGenJS

## Workflow — Always Follow This Two-Step Process

**Step 1 — Understand and propose structure (do this first, every time)**

Before writing any HTML, read the user's input and extract:
- **Audience** — technical / executive / mixed / specific stakeholders named
- **Tone** — consultative / assertive / educational / celebratory
- **Goal** — win evaluation / progress to POC / close the deal / inform / align
- **Must include** — specific slides, data, comparisons, or flows the user named
- **Must avoid** — topics, slides, or framing to leave out
- **Length** — explicit ("keep it under 10 slides") or inferred from context

Then reply with:
1. The slide structure you've decided on (slide number, type, action title, one-line rationale)
2. Why you chose that flow — what story it tells
3. A prompt: _"Looks good? Say 'build it' or tell me what to change."_

**Example structure proposal:**
> Here's the structure I'd suggest for this deck:
>
> 1. **Title** — Whatfix for [Customer]: From Evaluation to Decision _(sets stakes)_
> 2. **Agenda** — What we'll cover today _(orients the room)_
> 3. **Content** — What we heard from your team _(shows we listened)_
> 4. **Stat** — The cost of the status quo _(creates urgency)_
> 5. **Two-col** — Why Whatfix beats [Competitor] on analytics _(addresses key concern)_
> 6. **Two-col** — Enterprise-grade integrations, zero rip-and-replace _(de-risks switch)_
> 7. **Stat** — Customers like you, results like this _(social proof)_
> 8. **Section** — What a POC looks like _(makes next step concrete)_
> 9. **Closing** — Ready to run a 30-day POC? _(clear CTA)_
>
> Want to swap any slides, add a competitive table, or adjust the flow before I build it?

**Step 2 — Build**

Only start generating HTML after the user approves the structure or gives edits. When they say "build it", "looks good", "go ahead", or give specific tweaks — incorporate any changes and generate the full artifact.

---

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

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PRESENTATION_TITLE</title>
<script src="/libs/pptxgen.bundle.js"></script>
<script src="/libs/jszip.min.js"></script>
<script src="/libs/download-bridge.js"></script>
<script src="/libs/deck-renderer.js"></script>
<script src="/libs/deck-schema-renderer.js"></script>
<script src="/libs/icons.js"></script>
<script src="/libs/konva.min.js"></script>
<script src="/libs/canvas-editor.js"></script>
<script src="/libs/canvas-toolbars.js"></script>
<script src="/libs/canvas-context-menu.js"></script>
<script src="/libs/canvas-history.js"></script>
<script src="/libs/canvas-autosave.js"></script>
<script src="/libs/canvas-image-editor.js"></script>
<script src="/libs/canvas-template-picker.js"></script>
<script src="/libs/canvas-slide-actions.js"></script>
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
// window.downloadPptx() (exposed by deck-renderer.js) generates the native .pptx export
</script>
</body>
</html>
```

**Never write CSS, positioning, or duplicated content in the artifact.** Every slide is one object in `slides[]` with a `layout` field (from the table below) and that layout's content fields — nothing else. `deck-renderer.js` (loaded from `/libs/`, never regenerated) owns every visual decision.

**The canvas editor is automatic — no extra authoring needed.** Once `konva.min.js` and the `canvas-*.js` scripts are included in the script-tag list above, the artifact panel's "Edit" button host-triggers a full Konva-based canvas editor over the current slide: free drag/resize/rotate of every element via on-canvas handles, multi-select, floating per-element toolbars, a contextual right-click menu, undo/redo, autosave (changes persist continuously — there is no explicit Save action), image upload/crop, and both template pickers (swap the current slide's layout in place, or insert a new slide from a template) — with zero additional code in the artifact itself. It is wired up entirely by `canvas-editor.js` and its companion scripts reading and mutating `window.DECK` in place. Never hand-write editing affordances (edit buttons, drag handles, contenteditable attributes) into the artifact; just include the script tags and the rest follows.

## Layout Reference

| `layout` | Fields | Use for |
|---|---|---|
| `title` | `title`, `eyebrow`, `subtitle` | Deck cover — **fallback only; prefer a real `componentId` (`slide-5`..`slide-9`; NOT `slide-10`, that's an Event Name slide), see below** |
| `agenda` | `items` (array of strings, up to 12), `label?` (defaults to "AGENDA") | Session/section overview — **fallback only; prefer a real `componentId` (`slide-18`..`slide-19`), see below** |
| `section` | `title`, `eyebrow?` (small label above title) | Chapter break — **fallback only; prefer a real `componentId` (`slide-21`..`slide-25`), see below** |
| `content` | `title`, `bullets` (up to 3) | Bulleted explanation |
| `two_col` | `title`, `bullets` (up to 4), `rightBrandImage?` | Context + visual |
| `stat` | `stats` (up to 3, each `{value, label}`) | KPI callout |
| `quote` | `quote`, `cite?` | Pull quote |
| `split` | `title`, `eyebrow?`, `body`, `rightColor?` (hex, defaults to orange), `rightBrandImage?` | Full-bleed two-panel |
| `chart` | `title`, `bars` (up to 6, each `{label, value}`), `type?` (`"bar"` default, `"pie"`, `"line"`, or `"area"`) | Simple bar, pie, line, or area comparison |
| `comparison` | `title`, `headers` (up to 4 columns), `rows` (up to 5, each row sliced to 4 cells) | Feature/competitor table |
| `process` | `title`, `steps` (up to 5, each `{label, desc, num?}`) | Sequential workflow |
| `icon_grid` | `title`, `cols?` (2 or 3, default 3), `cards` (up to 6, each `{title, desc, icon?}` — see `window.DeckIcons.ICON_NAMES` below for valid `icon` values) | Feature/capability grid |
| `timeline` | `title`, `milestones` (up to 6, each `{date, title, body}`) | Roadmap/history |
| `closing` | `title`, `body?`, `cta?` | Deck close — **fallback only; prefer a real `componentId` (`slide-97`..`slide-100`), see below** |
| `case_study` | `challenge`, `solution`, `results`, `cta?`, `metadata?` (`{industry?, region?, solution?}`) | Customer case study |
| `mockup` | `device` (`"desktop"` \| `"mobile"`), `screenshotBrandImage?` | Product screenshot |
| `matrix_2x2` | `title`, `xAxisLabel`, `yAxisLabel`, `quadrants` (exactly 4, each `{label, items?}` up to 3 items) | Strategic framework |
| `event_speaker` | `eventName`+`date`+`location` OR `speakers` (up to 4, each `{name, title, company}`) | Event/panel slide |
| `objective` | `label`, `body` | Single-paragraph context block |
| `schema` | `elements` (array of raw `{type: "text"\|"image"\|"shape", x, y, w, h, ...}` primitives) | Verbatim/edited master-deck slide, or a fully custom one-off — see "Schema Layout & the Master Deck Library" below |

Every content rule from the previous version of this skill (action titles, one-idea-per-slide, layout variety, whitespace) is now enforced by `deck-renderer.js` itself — the caps above (max 3 bullets, max 3 stats, etc.) are structural, not suggestions. Still write good `title`/`headline` copy — the schema doesn't write your words for you, it just guarantees the layout can't be violated.

## CRITICAL Rules

- **NO EMOJIS** — ever.
- **Every slide is one object in `DECK.slides[]`** — never write raw HTML/CSS for slide content, only the artifact shape above.
- **Pick the layout that matches the content**, not the one that's easiest to write — see Layout Reference above.
- **Title, section, agenda, and closing slides default to a real master-deck `componentId`, not the hand-coded `title`/`section`/`agenda`/`closing` layout** — see "Schema Layout & the Master Deck Library" below for the exact ranges and when the hand-coded fallback is actually acceptable.
- **Brand images are accents, not backgrounds** — pass an asset key only via the `rightBrandImage`/`screenshotBrandImage` field on a layout that accepts one; `deck-renderer.js` constrains size and placement so a brand image can never become a full-bleed slide background.

## Content Rules (apply before writing any slide spec)

1. **Action titles** — every `title`/`headline` field is a complete sentence stating the takeaway. Ghost deck test: reading only the titles in sequence must tell the full story.
2. **One idea per slide** — if a slide needs two conclusions, split it into two slide objects.
3. **Trust the schema's caps** — `content` accepts more than 3 bullets but only the first 3 render; if you have more than 3 points, that's two slides, not one.
4. **Top-down structure** — key message first.
5. **Varied layouts** — never repeat the same `layout` value on consecutive slides.
6. **Closing content matches the deck's purpose** — a sales/pitch-facing deck may reasonably close with a demo/POC call-to-action, but an internal, executive-readout, technical, or informational deck should close with a plain thank-you/summary and must **not** include a sales CTA just because a `componentId` example happened to have one baked in. If you're using a `componentId`-sourced closing slide (`slide-97`..`100`) and the deck doesn't call for a CTA, don't invent one just because the source example's text field is easy to overwrite with pitch copy — write a purpose-appropriate line (e.g. "Thank you!" or "Questions?") instead. If the deck genuinely does call for a CTA, either edit the closing text to something specific to this deck (never boilerplate carried over unedited) or pick a different variant in the range that fits better — don't ship a mismatched CTA just because it was the path of least typing.

---

## Schema Layout & the Master Deck Library

Beyond the 19 hand-coded layouts above, a slide can use `"layout": "schema"` to render a raw `{ elements: [...] }` tree of primitive `text` / `image` / `shape` elements with explicit `x`/`y`/`w`/`h` (inches) — either fully hand-authored, or copied from a real slide in the Whatfix master deck.

**The library**: `client/public/brand/master-deck-library.json` holds one entry per slide of the 104-slide master deck (`brand/Copy of Master Deck 2026.pptx`), each shaped `{ "componentId": "slide-N", "elements": [...] }`. It's a 531KB JSON blob — don't `file_search` it as your first move for the common categories below; the "Practical examples" subsection right after the Workflow paragraph embeds a real, already-picked `elements` excerpt for each one, ready to copy and adapt directly. Reach for `file_search` on this file (and on `brand/master-deck-layouts.md`'s category table) only when you need a *different* variant than the one embedded — e.g. another of the 5 title-slide options, a different Thank-you close, or one of the other infographic-grid slide counts (`slide-58`..`slide-67` span 3–5 cards across variants in the extracted library, plus a process-diagram outlier at `slide-60`). Image elements reference `deckAsset` filenames served from `client/public/deck-assets/`.

**DEFAULT TO A REAL `componentId` FOR TITLE, SECTION, AGENDA, AND CLOSING SLIDES — this is a directive, not a suggestion.** The whole reason the master-deck library and `componentId` lookup exist is a direct user complaint that generated decks used generic, flat hand-coded cover/section/agenda/thank-you slides instead of the user's own real brand designs. The 4 hand-coded layouts below exist as a fallback for when nothing in the library fits — they are **not** the default choice for these categories:

| Category | Old hand-coded fallback | Prefer this `componentId` range instead (verified against `brand/master-deck-layouts.md`) |
|---|---|---|
| Deck cover / opening slide | `title` | `slide-5`..`slide-9` (title slides — slide 4 is a section-divider-style header; slides 5–9 are the 5 real title-slide variants; **`slide-10` is NOT a title variant** — its `elements` are an "Event Name" cover ("Event Name" / "Date:" / "Time:" / "Location:"), same category as `slide-11` — do not pick it for a deck cover, it renders event-placeholder copy instead) |
| Chapter break | `section` | `slide-21`..`slide-25` (section dividers — **`slide-20` is excluded**: it's the single-text category-divider header "Section Slides", not a usable divider layout) |
| Session/agenda overview | `agenda` | `slide-18`..`slide-19` (agenda — numbered session list with time slots; **`slide-17` is excluded**: it's the single-text category-divider header "Agenda", not a usable agenda layout) |
| Deck close | `closing` | `slide-97`..`slide-100` (the 4 near-identical "Thank you!" variants; **`slide-96` is excluded** — single-text category-divider header "Thank you Slides" — and **`slide-101`..`slide-104` are excluded** — repeated shape-alignment tip slides, not thank-you content) |

**Workflow**: for any title/section/agenda/closing slide, first decide what that category actually needs to say based on the deck's real content and purpose — don't start from a specific slide. Use the matching embedded example in "Practical examples" below only as a **reference for `elements` field shape and conventions** (how a title cover is composed, how an agenda's session rows repeat, what a closing slide's decorative collage looks like) — not as the slide you reuse by default. Then pick whichever `componentId` in the documented range (`slide-5`..`9` for title, `slide-97`..`100` for closing, etc. — not only the one embedded above) genuinely matches what this deck needs; `file_search` the rest of the range in `master-deck-library.json` (and `brand/master-deck-layouts.md`'s category table) whenever the embedded example isn't clearly the best fit for this specific deck — not only when it's structurally broken. **Reusing the same `componentId` (e.g. always `slide-5` for every cover, always `slide-97` for every close) across different decks and requests is exactly the failure mode this rule exists to prevent** — vary the choice based on the deck's actual audience, tone, and purpose, the same way you'd vary layout choices elsewhere in this skill. Only fall back to the plain `title`/`section`/`agenda`/`closing` layout when you've checked the range and genuinely nothing fits (e.g. every variant in range has fixed copy that can't be adapted to the content, or — per the known limitations below — the only remaining unused variant is one of the mis-scaled/oversized-shape slides that can't be cleanly copied). Don't skip the check just because the hand-coded layout is less typing; the fallback existing at all is not license to default to it.

### Practical examples: real `componentId` excerpts to copy directly

Each of these is pulled verbatim from `client/public/brand/master-deck-library.json` (not hand-written) — the hex fills, coordinates, and placeholder copy below are the actual extracted values for that slide. Copy the block, adjust `.text` fields (and drop any noted out-of-bounds decorative element), and paste into `elements`. Where an excerpt is truncated for length, a comment says so and gives the full original element count — `file_search` the same `componentId` in the library file if you need the untruncated array.

**Title cover — `slide-5`** (5 elements, full — nothing truncated):
```json
[
  { "type": "text", "text": "Design Presentation Whatfix", "x": 0.5, "y": 1.26, "w": 3.75, "h": 1.51 },
  { "type": "shape", "shape": "rect", "fill": "F15C24", "x": 4.58, "y": 2.7, "w": 2.27, "h": 3.28 },
  { "type": "shape", "shape": "rect", "fill": "F8A354", "x": 4.23, "y": 0.26, "w": 2.63, "h": 2.44 },
  { "type": "shape", "shape": "rect", "fill": "F8A354", "x": 1.46, "y": 2.69, "w": 3.12, "h": 3.29 },
  { "type": "shape", "shape": "rect", "fill": "C44028", "x": 4.23, "y": 2.69, "w": 1.54, "h": 2.66 }
]
```
Swap the title text for the deck's real cover line; the 4 rects are the brand color-block motif — leave their fills/positions alone unless redesigning the cover.

**Agenda — `slide-19`** (16 elements total; showing the "Agenda" label plus the first 2 of 6 numbered sessions — 4 more `Session N` / time / description triplets follow at the same x, incrementing y by ~0.66in each):
```json
[
  { "type": "shape", "shape": "rect", "fill": "FFFFFF", "x": 0.4, "y": 0.36, "w": 1.51, "h": 0.57 },
  { "type": "text", "text": "Agenda", "x": 0.4, "y": 0.36, "w": 1.51, "h": 0.57 },
  { "type": "text", "text": "Session 18:00 AM ", "x": 0.5, "y": 1.12, "w": 0.69, "h": 0.57 },
  { "type": "text", "text": "Session 29:00 AM ", "x": 0.5, "y": 1.78, "w": 0.69, "h": 0.57 },
  { "type": "text", "text": "&quot;Lorem ipsum dolor sit amet, consectetur adipiscing elit, t  ", "x": 1.48, "y": 1.12, "w": 2.86, "h": 0.57 },
  { "type": "text", "text": "&quot;Lorem ipsum dolor sit amet, consectetur adipiscing elit, t  ", "x": 1.48, "y": 1.78, "w": 2.86, "h": 0.57 }
  // ... 4 more Session N / time text elements + 4 more matching description text elements (Sessions 3–6), same pattern
]
```
Note the source text literally contains `Session 18:00 AM` (session number and time concatenated with no separator) and HTML-escaped `&quot;` — clean both up when you replace the copy with real session data.

**Section divider — `slide-25`** (4 elements, full — nothing truncated):
```json
[
  { "type": "shape", "shape": "rect", "fill": "E1EEFA", "x": 0.41, "y": 2.27, "w": 2.86, "h": 0.48 },
  { "type": "text", "text": "Lorem ipsum dolor sit dolor sit", "x": 0.39, "y": 1.6, "w": 4.6, "h": 1.12 },
  { "type": "text", "text": "Subhead ", "x": 0.39, "y": 4.56, "w": 4.6, "h": 0.44 },
  { "type": "shape", "shape": "rect", "fill": "E1EEFA", "x": 4.99, "y": 0.58, "w": 4.46, "h": 4.46 }
]
```
The two large `E1EEFA` rects are the section-divider's light accent blocks; replace the two text elements with the chapter title and (optionally) a subhead line.

**Closing — `slide-97`** (11 elements, full — nothing truncated):
```json
[
  { "type": "shape", "shape": "rect", "fill": "FFE9DC", "x": 5.4, "y": 0, "w": 4.6, "h": 5.63 },
  { "type": "text", "text": "Thank you!", "x": 0, "y": 2.26, "w": 5.64, "h": 0.74 },
  { "type": "shape", "shape": "rect", "fill": "824E3B", "x": 5.4, "y": 4.45, "w": 2.29, "h": 0.83 },
  { "type": "shape", "shape": "rect", "fill": "FAC1AA", "x": 7.68, "y": 2.89, "w": 2.32, "h": 0.83 },
  { "type": "shape", "shape": "rect", "fill": "FFA450", "x": 6.99, "y": 3.89, "w": 1.32, "h": 1.32 },
  { "type": "shape", "shape": "rect", "fill": "36314C", "x": 6.88, "y": 1.24, "w": 1.56, "h": 1.34 },
  { "type": "shape", "shape": "rect", "fill": "F05B22", "x": 6.62, "y": 2.58, "w": 2, "h": 1.04 },
  { "type": "shape", "shape": "rect", "fill": "FAC1AA", "x": 8.09, "y": 2.74, "w": 0.8, "h": 0.32 },
  { "type": "shape", "shape": "rect", "fill": "824E3B", "x": 6.35, "y": 4.3, "w": 0.8, "h": 0.32 },
  { "type": "shape", "shape": "rect", "fill": "BF7357", "x": 6.67, "y": 0.18, "w": 1.5, "h": 1.48 },
  { "type": "shape", "shape": "rect", "fill": "BF7357", "x": 6.4, "y": 0, "w": 0.69, "h": 0.64 }
]
```
Swap `"Thank you!"` for a real closing line — per Content Rule 6 above, only make it a CTA if the deck's actual purpose calls for one (e.g. a sales/pitch deck), otherwise keep it a plain thank-you/summary line; the right-hand block of warm-toned rects (none of which are text — this variant has no baked-in CTA copy, just decorative color blocks) is a decorative collage — leave it as-is.

**Key Takeaways list — `slide-28`** (26 elements total; showing the headline plus the first of 3 takeaway columns — 2 more identical-shape columns follow at `x≈3.64` and `x≈6.8`, and 5 small decorative `deckAsset` icon images are omitted):
```json
[
  { "type": "text", "text": "Key Takeaways", "x": 0.5, "y": 0.53, "w": 6.06, "h": 0.44 },
  { "type": "shape", "shape": "rect", "fill": "FFA450", "x": 0.5, "y": 1.51, "w": 2.7, "h": 3.57 },
  { "type": "text", "text": "Lorem Ipsum", "x": 0.76, "y": 2.05, "w": 2.08, "h": 0.2 },
  { "type": "text", "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ", "x": 0.59, "y": 2.63, "w": 2.39, "h": 0.95 },
  { "type": "text", "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit", "x": 0.59, "y": 3.65, "w": 2.49, "h": 0.56 },
  { "type": "text", "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit", "x": 0.59, "y": 4.33, "w": 2.49, "h": 0.56 }
  // ... 2 more takeaway columns, each: 1 colored-rect card background + 1 short heading text + 2 supporting detail texts, plus 5 small deckAsset icon images atop each card
]
```
Each takeaway is a colored card (heading + 2 supporting lines) — this is the richer, 3-column version of the hand-coded `content` layout's bullet list; use it when a takeaway needs its own short supporting detail rather than a single bullet line.

**Problem/Solution two-panel — `slide-35`** (10 elements, full — nothing truncated, but note the last image is the known out-of-bounds corner decoration, safe to drop per the Known Limitations below):
```json
[
  { "type": "text", "text": "AI agent performing operations on behalf of the users", "x": 0.4, "y": 1.26, "w": 2.8, "h": 1.3 },
  { "type": "text", "text": "Problem", "x": 4.99, "y": 1.36, "w": 2, "h": 0.4 },
  { "type": "text", "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam", "x": 4.99, "y": 1.72, "w": 3.75, "h": 1.1 },
  { "type": "text", "text": "Solution", "x": 4.99, "y": 3.02, "w": 1.08, "h": 0.4 },
  { "type": "text", "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam", "x": 4.99, "y": 3.36, "w": 3.56, "h": 1.1 },
  { "type": "shape", "shape": "rect", "fill": "F15B22", "x": 1.2, "y": 2.04, "w": 1.51, "h": 1.8 },
  { "type": "shape", "shape": "rect", "fill": "F15B22", "x": 1.1, "y": 2.91, "w": 0.44, "h": 0.76 },
  { "type": "shape", "shape": "rect", "fill": "C53F27", "x": 1.1, "y": 2.91, "w": 0.44, "h": 0.76 },
  { "type": "shape", "shape": "rect", "fill": "F9A352", "x": 0.5, "y": 0.53, "w": 0.27, "h": 0.31 }
  // dropped: { "type": "image", "deckAsset": "slide35-image1.png", "x": 10.18, "y": 0, "w": 2.66, "h": 1.76 } — corner decoration past the 10in canvas edge, per Known Limitations
]
```
Left column is a title + orange color-block illustration; right column stacks the `Problem` label/body over the `Solution` label/body. Use for a single problem framed against its solution, one panel each.

**Infographic grid (5-card) — `slide-61`** (30 elements total; showing 1 of 5 card text elements plus 1 of ~24 decorative shape elements — the rest are small colored rects/circles forming a central Venn-style graphic and are cosmetic, not per-card content):
```json
[
  { "type": "text", "text": "ADD TITLELorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. Donec facilisis lacus eget mauris.", "x": 0.34, "y": 1.36, "w": 2.32, "h": 1.01 }
  // ... 4 more identically-shaped card text elements at different x/y (two columns of cards flanking a central decorative graphic at x≈3.5-6.5)
  // ... ~24 small decorative shape elements (colored rects/circles composing the central graphic) — cosmetic, copy as a block or omit and rebuild a simpler center visual
]
```
Each card's `text` concatenates a bold "ADD TITLE" placeholder heading with its body copy in one run (the extractor's multi-run concatenation limitation, noted below) — split it back into a heading + a separate body line when you replace the placeholder copy. This is the 5-card variant; other slides in `slide-58`..`slide-67` have 3 or 4 cards for smaller grids.

**`componentId` vs `elements` — these are alternatives, not both required:**
- To reuse a master-deck slide **verbatim** (no text changes), look up its `componentId` entry in the library via `file_search` and copy its `elements` array directly into the slide spec as-is.
- To reuse a master-deck slide **with different text** (e.g. put a real thank-you message into the generic "Thank you!" variant at `slide-97`), copy that same `elements` array into the slide spec and edit only the `.text` fields on the relevant `text` elements — everything else (position, fills, images) stays untouched.
- To author a **fully custom** schema slide with no master-deck source, just write `elements` directly (Task 2's original design) — no `componentId` involved at all.
- There is **no automatic merge/lookup at render time** — `deck-schema-renderer.js` only ever reads whatever `elements` array is present on the slide spec. `componentId` is a lookup key for you (the author) to use via `file_search` while writing the artifact, not a live reference the renderer resolves — always inline the actual `elements` array into the artifact's `window.DECK`, never emit `componentId` alone expecting it to render something.

**`elements[]` field reference — use these EXACT field names, every one of them.** This matters most when authoring a fully custom schema slide (no `componentId` source to copy from) — a guessed, HTML-like field name (`src` instead of `brandImage`/`deckAsset`, `bold: true` instead of `fontWeight: "bold"`) is silently ignored, not an error: the slide still renders, just without the image/bold text you meant to add. There is no validation step that would catch this — get the field names right the first time.

- `{ "type": "text", "x", "y", "w", "h", "text", "fontSize"?, "color"? (hex, no `#`, e.g. `"FFFFFF"`), "fontWeight"?: `"bold"` (NOT a `bold: true` boolean — there is no `bold` field), "fontFamily"?, "align"?: `"left"|"center"|"right"`, "opacity"? (0-1 float) }`
- `{ "type": "image", "x", "y", "w", "h", "brandImage"? (a key from the Brand Graphics list below, e.g. `"logo-dark"` — NOT a `src` path, and NOT an extension: `brandImagePath` derives `.svg` vs `.png` itself), "deckAsset"? (a full filename from `client/public/deck-assets/`, e.g. `"slide-42-image-1.png"`), "uploadedImageUrl"? (a complete URL, set by the canvas editor's image Upload tab when a user uploads their own image through `api/server/routes/files/deckAsset.js` — used as-is with no path resolution; not something to author by hand in a generated deck), "focusX"?/"focusY"? (0-1 floats, default 0.5/0.5 i.e. centered — a crop/focus-point offset consumed as CSS `object-position` when the image renders with `object-fit: cover`; render-only, NOT applied during PPTX export) }` — set exactly one of `brandImage`/`deckAsset`/`uploadedImageUrl`, never a `src` field.
- `{ "type": "shape", "x", "y", "w", "h", "shape": `"rect"|"roundRect"|"ellipse"`, "fill"? (hex, no `#`), "rectRadius"? (inches, `roundRect` only), "opacity"? (0-1 float) }`

**Known limitations of the extracted library** (fragility in the regex-based PPTX→schema converter, not something to work around by hand — just be aware when picking a `componentId`):
- **Grouped-shape positions and sizes**: shapes nested inside PowerPoint/Slides group containers (`<p:grpSp>`) keep their local offset/extent rather than the group's fully composed transform (position **and scale**), so ~18-20% of slides have at least one element that falls outside the visible 10in × 5.625in canvas. This shows up in two meaningfully different ways — **don't treat them the same**:
  - **Small offset-only decorative image (safe to drop)**: a small (~2.66in × 1.76in) corner logo/badge positioned just past one edge (e.g. `x≈10.0-10.2, y=0`), with the rest of the slide's content (its text, main layout) unaffected. Confirmed on `slide-6`, `slide-8`, `slide-11`, `slide-23`, `slide-34`, `slide-35`, `slide-55`, `slide-70`, `slide-71`, `slide-72`, `slide-73`, `slide-77`, `slide-87` — in each of these, the core text content is correct and usable as-is; if you copy `elements` from one of these, just drop (or reposition) that one small out-of-bounds image.
  - **Oversized/mis-scaled background shape or image (NOT safe to just drop or reposition)**: on `slide-10`, `slide-16`, `slide-27`, `slide-29`, `slide-31`, `slide-34`, `slide-76`, at least one `shape` or `image` element is both mispositioned **and** dramatically wrong-sized — e.g. `slide-16`, `slide-27`, `slide-29`, and `slide-34` each have a `14.11in × 14.11in` rect (several times larger than the entire canvas) at a negative `y`, which is clearly a group-clipped circle/panel whose group scale wasn't composed correctly (a scale bug, not just an offset bug); `slide-10`, `slide-31`, and `slide-76` have similarly oversized background images/shapes (up to ~7in × 8in) extending well past the canvas on multiple sides. These elements are the slide's **intended background design** — deleting them per the "just drop the out-of-bounds element" guidance above would leave the slide with no background at all, and repositioning alone won't fix it since the size is also wrong. Do not reference these specific `componentId`s expecting a clean copy-paste result; if you need one of these slide's category, either pick a different slide in the same category (per `brand/master-deck-layouts.md`) or manually reconstruct the background shape/size by hand rather than trusting the extracted geometry.
  - Two further slides, `slide-24` and `slide-81`, have only negligible (~0.01-0.03in) overflow — not worth avoiding, well within normal rounding.
- **Theme-color fills**: only literal solid RGB fills (`<a:srgbClr>`) are extracted; shapes filled via a theme/scheme color (`<a:schemeClr>`) come through with their text intact but no shape background — don't be surprised if a copied shape has no visible fill.
- **Multi-run text concatenation**: adjacent text runs within one paragraph are joined with no separator (e.g. `slide-16`'s panel cards read as `"NameDesignationCompany"` instead of three lines) — split these back into separate lines/labels yourself when copying.
- **Category-divider slides are intentionally thin** — `slide-4`, `slide-12`, `slide-17`, `slide-20`, `slide-26`, `slide-38`, `slide-40`, `slide-56`, `slide-78`, `slide-84`, `slide-93`, `slide-96` are single-title section headers in the source deck (e.g. "Agenda", "Tables", "Thank you Slides") — that's correct extraction, not a converter miss; don't reference them expecting real slide content.

**`chart` layout, `type: "pie"`**: the `chart` layout (see Layout Reference table) also accepts `"type": "pie"` alongside its default bar rendering — same `bars` field (`{label, value}`), rendered as a pie/donut instead of a bar comparison. Omit `type` (or set `"bar"`) for the original bar chart.

**`chart` layout, `type: "line"` / `type: "area"`**: also available for trends over an ordered sequence (`bars` doubles as the point series, same `{label, value}` shape and same max-6 cap). Both export as native PowerPoint line/area charts; in the HTML preview `"line"` renders as thin value stems and `"area"` as filled columns along the same left-to-right sequence.

**`icon_grid` layout, real icons**: the `icon` field on each `icon_grid` card is now rendered (previously accepted but ignored). Set it to one of the 12 curated names in `window.DeckIcons.ICON_NAMES`: `check`, `arrow-right`, `star`, `clock`, `chart`, `target`, `lightbulb`, `shield`, `users`, `globe`, `gear`, `flag`. These are inline SVGs bundled in `/libs/icons.js` — no network dependency, no arbitrary icon names.

---

## Brand Graphics

All graphics are served from `/brand/` (pre-built into the app). Use them on relevant slides — prefer a brand graphic over a blank colored rectangle whenever content matches a product.

**Asset priority for agent logos: SVG > PNG.** SVGs are transparent vectors — they always render cleanly on any background. For suite composite images (product-suite, ai-agents-suite etc.) use the dark variant on dark slides and the light variant on light slides — they are designed for their respective backgrounds.

### Using brand images

Pass the asset key (filename without extension, e.g. `"authoring-agent-dark"`) as the relevant field on a layout that accepts one (`two_col.rightBrandImage`, `mockup.screenshotBrandImage`). `deck-renderer.js` resolves the key against `/brand/` and handles sizing/positioning — you never specify coordinates.

### Available Files

Priority: **SVG ✦ > light PNG ◆ > dark PNG** (dark PNGs have opaque backgrounds).

| File | Contents | Format | Use on |
|------|----------|--------|--------|
| `/brand/authoring-agent-dark.svg` | Authoring Agent logo | SVG ✦ | Dark-bg slides |
| `/brand/authoring-agent-light.svg` | Authoring Agent logo | SVG ✦ | Light-bg slides |
| `/brand/authoring-agent-box-dark.svg` | Authoring Agent in box | SVG ✦ | Dark card insets |
| `/brand/guidance-agent-dark.svg` | Guidance Agent logo | SVG ✦ | Dark-bg slides |
| `/brand/guidance-agent-light.svg` | Guidance Agent logo | SVG ✦ | Light-bg slides |
| `/brand/guidance-agent-box-dark.svg` | Guidance Agent in box | SVG ✦ | Dark card insets |
| `/brand/guidance-agent-box-light.svg` | Guidance Agent in box | SVG ✦ | Light card insets |
| `/brand/insights-agent-dark.svg` | Insights Agent logo | SVG ✦ | Dark-bg slides |
| `/brand/insights-agent-light.svg` | Insights Agent logo | SVG ✦ | Light-bg slides |
| `/brand/insights-agent-box-dark.svg` | Insights Agent in box | SVG ✦ | Dark card insets |
| `/brand/insights-agent-box-light.svg` | Insights Agent in box | SVG ✦ | Light card insets |
| `/brand/product-suite-light.png` | Full product suite diagram | PNG ◆ | Any slide |
| `/brand/ai-agents-suite-light.png` | AI Agents suite highlight | PNG ◆ | AI agent slides |
| `/brand/dap-light.png` | DAP product logo | PNG ◆ | DAP slides |
| `/brand/authoring-agent-light.png` | Authoring Agent logo | PNG | Fallback only |
| `/brand/guidance-agent-light.png` | Guidance Agent logo | PNG | Fallback only |
| `/brand/insights-agent-light.png` | Insights Agent logo | PNG | Fallback only |
| `/brand/product-suite-full-dark.png` | Full suite with all logos | PNG | Architecture slides (no light alt) |
| `/brand/screensense-suite-dark.png` | ScreenSense suite highlight | PNG | ScreenSense slides (no light alt) |
| `/brand/mirror-dark.png` | Mirror product logo | PNG | Mirror slides (no light alt) |
| `/brand/screensense-dark.png` | ScreenSense product logo | PNG | ScreenSense slides (no light alt) |
| `/brand/product-analytics-dark.png` | Product Analytics logo | PNG | Analytics slides (no light alt) |

✦ = SVG vector, transparent background — always prefer over PNG.  ◆ = light PNG, neutral background — prefer over dark PNG.

**Rules:**
- Use dark variants on dark slides (default), light variants on white/gray slides
- For product-specific content (DAP, ScreenSense, Mirror, etc.), use the matching product logo key
- For AI Agent content, use the matching agent logo key or `ai-agents-suite-dark`

---

## Playbook Mode — POC / Demo / Sales Playbooks

Use this mode when the request contains: POC playbook, proof of concept deck, demo playbook, sales playbook, engagement playbook, or any structured document combining section dividers with checklists/tables.

**Visual identity**: Crimson (#872345) cover, dark Ink 700 section dividers with Orange split right panel, white background table slides with Crimson headers.

### Additional CSS for Playbook Mode

Add these inside the existing `<style>` tag:

```css
/* ── PLAYBOOK: COVER ──────────────────────────────────── */
.slide.cover { display: flex; flex-direction: row; }
.slide.cover .left {
  flex: 0 0 58%; background: #872345;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: clamp(2rem,5vw,4rem) clamp(2rem,5vw,4.5rem) clamp(2.5rem,6vh,4rem);
}
.slide.cover .right {
  flex: 1; background: #FF6B18; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.slide.cover .right img {
  width: 85%; height: 85%; object-fit: contain; opacity: 0.92;
}
.slide.cover .right::before {
  content: ''; position: absolute; width: 160%; height: 160%; border-radius: 50%;
  border: clamp(20px,4vw,48px) solid rgba(255,255,255,0.15); top: -30%; left: -85%;
}
.slide.cover .tagline { font-size: 0.62rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 1.75rem; }
.slide.cover h1 { font-size: clamp(1.5rem,3vw,2.8rem); font-weight: 500; color: #fff; line-height: 1.15; max-width: 18ch; margin-bottom: 0.75rem; letter-spacing: -0.02em; }
.slide.cover .doc-type { font-size: clamp(0.82rem,1.35vw,1rem); font-weight: 300; color: rgba(255,255,255,0.55); margin-bottom: 2.5rem; }
.logo-row { display: flex; align-items: center; gap: 1.25rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.15); }
.wf-wordmark { font-size: 0.92rem; font-weight: 700; color: #fff; }
.customer-badge { font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.82); padding-left: 1.25rem; border-left: 1px solid rgba(255,255,255,0.18); }
.disclaimer-cover { position: absolute; bottom: 0.5rem; left: 0; right: 0; font-size: 0.46rem; color: rgba(255,255,255,0.2); padding: 0 clamp(2rem,5vw,4.5rem); text-align: center; font-style: italic; }

/* ── PLAYBOOK: SECTION DIVIDER ────────────────────────── */
.slide.section-div { display: flex; flex-direction: row; }
.slide.section-div .left {
  flex: 0 0 58%; background: #25223B;
  display: flex; flex-direction: column; justify-content: center; padding: clamp(2rem,5vw,4.5rem);
}
.slide.section-div .right {
  flex: 1; background: #FF6B18; position: relative; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 1.5rem 1.75rem;
}
.slide.section-div .sec-label { font-size: 0.62rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 0.75rem; }
.slide.section-div h2 { font-size: clamp(1.5rem,2.8vw,2.6rem); font-weight: 500; color: #fff; line-height: 1.15; max-width: 16ch; letter-spacing: -0.02em; }
.sd-badge { position: relative; z-index: 1; font-size: 0.62rem; font-weight: 700; color: rgba(255,255,255,0.55); }

/* ── PLAYBOOK: TABLE SLIDE ────────────────────────────── */
.slide.table-slide { flex-direction: column; background: #fff; display: flex; }
.ts-header { flex-shrink: 0; padding: 1.2rem clamp(1.5rem,4vw,3rem) 0.75rem; border-bottom: 2px solid #E5E3DC; display: flex; align-items: center; justify-content: space-between; }
.ts-header h2 { font-size: clamp(0.95rem,1.7vw,1.45rem); font-weight: 500; color: #872345; }
.ts-wf { font-size: 0.6rem; font-weight: 700; color: #872345; }
.ts-body { flex: 1; overflow: auto; padding: 0.5rem clamp(1.5rem,4vw,3rem) 0; }
table.ptable { width: 100%; border-collapse: collapse; font-size: clamp(0.62rem,1.05vw,0.82rem); }
table.ptable thead tr { background: #872345; }
table.ptable thead th { padding: 0.55rem 0.8rem; font-weight: 500; color: #fff; text-align: left; border-right: 1px solid rgba(255,255,255,0.1); }
table.ptable thead th:last-child { border-right: none; }
table.ptable tbody tr:nth-child(even) { background: #F9F9F2; }
table.ptable tbody tr:nth-child(odd)  { background: #fff; }
table.ptable tbody td { padding: 0.5rem 0.8rem; color: #35324A; border-bottom: 1px solid #E5E3DC; border-right: 1px solid #E5E3DC; vertical-align: middle; line-height: 1.45; }
table.ptable tbody td:last-child { border-right: none; }
table.ptable tbody td strong { font-weight: 600; color: #25223B; }
.badge { display: inline-block; padding: 0.16rem 0.55rem; border-radius: 4px; font-size: 0.68rem; font-weight: 500; white-space: nowrap; }
.badge.complete   { background: #D4EDDA; color: #166534; }
.badge.pending    { background: #FEF3C7; color: #92400E; }
.badge.inprogress { background: #DBEAFE; color: #1E40AF; }
.badge.present    { background: #FFE9DC; color: #C2410C; border: 1px solid rgba(255,107,24,0.22); }
.badge.notpresent { background: #F9F9F2; color: #8A8A9C; border: 1px solid #E5E3DC; }
.ts-disclaimer { flex-shrink: 0; padding: 0.3rem clamp(1.5rem,4vw,3rem); font-size: 0.5rem; color: #8A8A9C; border-top: 1px solid #E5E3DC; font-style: italic; }
.slide-counter.dark-text  { color: rgba(0,0,0,0.2); }
.slide-counter.light-text { color: rgba(255,255,255,0.2); }
```

### Playbook Slide Types

**Cover** — `data-type="cover"` — include brand image on the right panel:
```html
<section class="slide cover active" data-type="cover"
  data-title="Proof of Concept Playbook"
  data-doc-type="Proof of Concept Playbook"
  data-customer="Customer Name"
  data-tagline="Drive Digital Adoption"
  data-brand-image="product-suite-dark"
  data-bi-x="6.2" data-bi-y="0.6" data-bi-w="3.4" data-bi-h="4.4">
  <div class="left">
    <p class="tagline">Drive Digital Adoption</p>
    <h1>Proof of Concept Playbook</h1>
    <p class="doc-type">Proof of Concept Playbook</p>
    <div class="logo-row">
      <span class="wf-wordmark">Whatfix</span>
      <span class="customer-badge">Customer Name</span>
    </div>
  </div>
  <div class="right">
    <img src="/brand/product-suite-dark.png" loading="eager" alt="">
  </div>
  <p class="disclaimer-cover">Disclaimer: Please treat all information as confidential and do not share outside your organization. By default all calls will be recorded &amp; provided to you for internal use.</p>
</section>
```

**Section divider** — `data-type="section-div"`:
```html
<section class="slide section-div" data-type="section-div"
  data-sec-label="Section 01" data-title="POC Prerequisites">
  <div class="left">
    <p class="sec-label">Section 01</p>
    <h2>POC Prerequisites</h2>
  </div>
  <div class="right"><span class="sd-badge">Whatfix</span></div>
</section>
```

**Table slide** — `data-type="table"`:
```html
<section class="slide table-slide" data-type="table" data-title="POC Stages">
  <div class="ts-header"><h2>POC Stages</h2><span class="ts-wf">Whatfix</span></div>
  <div class="ts-body">
    <table class="ptable">
      <thead><tr><th>S No</th><th>Pre-requisite</th><th>Status</th><th>Ownership</th></tr></thead>
      <tbody>
        <tr><td><strong>1</strong></td><td>Identify the application for PoC</td><td><span class="badge complete">Complete</span></td><td>Customer Team</td></tr>
        <tr><td><strong>2</strong></td><td>Install Whatfix Studio</td><td><span class="badge pending">Pending</span></td><td>Whatfix and Customer Team</td></tr>
      </tbody>
    </table>
  </div>
  <p class="ts-disclaimer">Disclaimer: Please treat all information as confidential and do not share outside your organization.</p>
</section>
```

**Success metrics table** — `data-type="success-metrics"`: same structure as table slide, 5 columns: Use Case/Area · Content Type · Env With Data · Env Without Data · Scope Notes. Use `.badge.present` / `.badge.notpresent` for data columns.

### Navigation JS update for Playbook Mode

Add inside the `go()` function after updating `sc.textContent`:
```js
sc.className = 'slide-counter ' +
  (slides[cur].classList.contains('table-slide') ? 'dark-text' : 'light-text');
```

### PPTX Export for Playbook Slides

Add to `downloadPptx()` alongside the dark-deck handlers:

```js
const DISCLAIMER_TEXT = 'Disclaimer: Please treat all information as confidential and do not share outside your organization. By default all calls will be recorded & provided to you for internal use.';
function stripHtml(str) { const d = document.createElement('div'); d.innerHTML = str; return (d.textContent || d.innerText || '').trim(); }

if (type === 'cover') {
  s.addShape(pptx.ShapeType.rect, { x:0,   y:0, w:5.8, h:SH, fill:{ color:'872345' } });
  s.addShape(pptx.ShapeType.rect, { x:5.8, y:0, w:4.2, h:SH, fill:{ color:'FF6B18' } });
  // Brand image on the orange right panel
  if (biKey && _imgs[biKey] && _imgs[biKey].data) addBrandImg(s, biKey, biX, biY, biW, biH);
  s.addText((slide.dataset.tagline||'').toUpperCase(), { x:.5,y:.55,w:5,h:.3,fontSize:7,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:3,transparency:55,margin:0});
  s.addText(slide.dataset.title||'', { x:.5,y:2.9,w:5,h:1.8,fontSize:24,color:'FFFFFF',fontFace:FONT,bold:false,valign:'top',wrap:true,margin:0});
  s.addText(slide.dataset.docType||'', { x:.5,y:4.85,w:4.8,h:.42,fontSize:11,color:'FFFFFF',fontFace:FONT,transparency:38,margin:0});
  s.addShape(pptx.ShapeType.rect, { x:.5,y:5.45,w:5,h:.02,fill:{ color:'FFFFFF' },transparency:80});
  s.addText('Whatfix', { x:.5,y:5.0,w:1.8,h:.35,fontSize:11,color:'FFFFFF',fontFace:FONT,bold:true,margin:0});
  if (slide.dataset.customer) s.addText(slide.dataset.customer, { x:2.55,y:5.0,w:3,h:.35,fontSize:11,color:'FFFFFF',fontFace:FONT,margin:0});
  s.addText(DISCLAIMER_TEXT, { x:0,y:5.35,w:SW,h:.2,fontSize:5,color:'FFFFFF',fontFace:FONT,align:'center',transparency:72,margin:0});

} else if (type === 'section-div') {
  s.addShape(pptx.ShapeType.rect, { x:0,   y:0, w:5.8, h:SH, fill:{ color:'25223B' } });
  s.addShape(pptx.ShapeType.rect, { x:5.8, y:0, w:4.2, h:SH, fill:{ color:'FF6B18' } });
  if (slide.dataset.secLabel)
    s.addText(slide.dataset.secLabel.toUpperCase(), { x:.5,y:2.55,w:5,h:.3,fontSize:7,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:4,transparency:70,margin:0});
  s.addText(slide.dataset.title||'', { x:.5,y:2.9,w:5,h:1.8,fontSize:24,color:'FFFFFF',fontFace:FONT,bold:false,wrap:true,margin:0});

} else if (type === 'table' || type === 'success-metrics') {
  s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color:'FFFFFF' } });
  s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color:'872345' } });
  s.addText(slide.dataset.title||'', { x:.4,y:.18,w:9.2,h:.65,fontSize:18,color:'872345',fontFace:FONT,bold:false,margin:0});
  s.addText('Whatfix', { x:8.5,y:.22,w:1.3,h:.35,fontSize:8,color:'872345',fontFace:FONT,bold:true,align:'right',margin:0});
  s.addShape(pptx.ShapeType.rect, { x:.4,y:1.0,w:9.2,h:0.008,fill:{ color:'E5E3DC' } });
  const domTable = slide.querySelector('table');
  if (domTable) {
    const headers = [...domTable.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const bodyRows = [...domTable.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => stripHtml(td.innerHTML)));
    const isSnO = /^s\s?no/i.test(headers[0]);
    const colWs = isSnO && headers.length===4 ? [.55,4.2,2.0,3.05] : headers.length===5 ? [2.1,1.5,1.7,1.9,2.6] : headers.map(() => 9.2/headers.length);
    const tableData = [
      headers.map(h => ({ text:h, options:{ bold:true,color:'FFFFFF',fill:'872345',fontFace:FONT,fontSize:9,align:'left',valign:'middle' } })),
      ...bodyRows.map((row,ri) => row.map(cell => ({ text:cell, options:{ color:'35324A',fontFace:FONT,fontSize:8.5,fill:ri%2===0?'FFFFFF':'F9F9F2',valign:'middle' } })))
    ];
    if (tableData.length > 1) s.addTable(tableData, { x:.4,y:1.05,w:9.2,colW:colWs,border:{ type:'solid',color:'E5E3DC',pt:.4 },rowH:.62 });
  }
  s.addText(DISCLAIMER_TEXT, { x:.4,y:5.32,w:9.2,h:.22,fontSize:5,color:'8A8A9C',fontFace:FONT,italic:true,margin:0});
}
```

### Typical playbook structure
1. Cover — title + customer name + brand graphic
2. Section divider — "POC Prerequisites"
3. Table slide — POC Stages checklist
4. Section divider — "Use Cases and Success Criteria"
5. Success Metrics table
6. Closing — next steps (dark deck `closing` type)

---

## Key Rules for Populating the Playbook Template

These rules are specific to **Playbook Mode** and its hand-authored `data-*`-attribute HTML above. They do not apply to the default `DECK.slides[]` JSON format described earlier in this file — that format has no `data-*` attributes at all; `deck-renderer.js` derives everything (including the PPTX export) from the `slides[]` array itself.

1. **data-* attributes on each `<section>` drive the PPTX** — always fill both the visible HTML and the data attributes. They must stay in sync.
2. **Slide order in HTML = slide order in PPTX** — processed in DOM order
3. **Action titles everywhere** — every `data-headline` and `data-title` must be a complete sentence stating the takeaway
4. **Vary layouts** — do not use the same slide type more than twice in a row
5. **Speaker notes** — put in `<div class="notes">` inside the slide; carried to PPTX notes pane automatically
6. **Brand graphics are mandatory on title, closing, and any product-specific slide** — add `data-brand-image` and the corresponding `<img>` in HTML; the PPTX export will embed the graphic automatically if it has been preloaded

## After Generating

After delivering the artifact, always offer specific iteration options based on what was built. Examples:

- _"Want me to move the competitive slide earlier, or add a dedicated ROI slide?"_
- _"Should I add speaker notes to every slide?"_
- _"Want a two-column layout on slide 5 instead of bullets?"_
- _"Should I add a SAP Enable Now column to the comparison table?"_
- _"Want to switch this to a playbook format for the POC conversation?"_

When the user asks for a change, update the artifact in place using the same identifier — never generate a new artifact for an iteration on the same deck.

---

## Pre-Delivery Quality Checklist (run before every artifact)

Sourced from Claude Design official spec + consulting presentation standards.

For the default `DECK.slides[]` format, `deck-renderer.js` already enforces the caps, colors, typography, and PPTX plumbing below by construction (it's never regenerated, so these can't drift) — the **Content** checklist is the one that still depends on judgment calls you make when writing the slide spec. The **Design**, **Typography**, **Technical**, and the `data-*`-specific **Brand** items only need active checking in **Playbook Mode**, where the HTML/CSS is hand-authored per artifact.

**Content**
- [ ] Ghost deck test: reading only slide titles tells the full story
- [ ] Every title is an action sentence (states the takeaway, not a topic label)
- [ ] No slide has more than 3 bullets; no bullet exceeds 10 words
- [ ] No consecutive slides use the same layout type

**Design** (Playbook Mode)
- [ ] All colors are from the Whatfix palette — zero invented hex values
- [ ] No more than 3 colors used on any single slide
- [ ] Orange is used as an accent only — never as a full slide background
- [ ] No gradients not in the approved palette recipes
- [ ] Whitespace is generous: slides feel spacious, not cramped

**Typography** (Playbook Mode)
- [ ] Slide headlines ≥ `clamp(1.4rem,2.6vw,2.2rem)` in HTML, ≥ 22pt in PPTX
- [ ] Body text ≥ `clamp(0.85rem,1.5vw,1.05rem)` in HTML, ≥ 14pt in PPTX
- [ ] `text-wrap: pretty` on all headings
- [ ] Sentence case throughout (no title-casing every word)

**Brand**
- [ ] Brand graphic on title slide, closing slide, and all product-specific slides
- [ ] Dark variant images on dark slides, light variants on light slides
- [ ] (Playbook Mode only) `data-brand-image` and `<img>` are in sync (same key)

**Technical** (Playbook Mode)
- [ ] `data-*` attributes match visible HTML for every slide (PPTX export parity)
- [ ] PptxGenJS hex colors have no `#` prefix
- [ ] `downloadPptx()` is `async` and `await`s `pptx.write(...)` (dark-deck `downloadPptx()` in `deck-renderer.js` uses `pptx.write({ outputType: 'blob' })`, not `pptx.writeFile()`)
- [ ] No `pptx.addFont()` call (removed in v4)
- [ ] `prefers-reduced-motion` media query present in `<style>`
- [ ] `text-wrap: pretty` in `<style>` on `h1, h2, h3`
