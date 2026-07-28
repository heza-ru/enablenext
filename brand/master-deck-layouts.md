# Whatfix Master Deck 2026 — Layout Catalog

Source files (added alongside this catalog, in this same `brand/` folder):
- `Copy of Master Deck 2026.pptx` — the master template, authoritative source
- `Copy of Master Deck 2026.odp` — OpenDocument copy of the same
- `Copy of Master Deck 2026.txt` — plain-text export of all slide content (useful for grepping content without opening the binary files)

This catalog is a navigable index of every layout category in the master deck, verified directly against the `.pptx` file (104 slides, 77 slide-layout definitions, 5 slide masters), not just the text export — so slide counts, dimensions, fonts, and colors below are measured, not guessed. Use this to pick a layout when building or extending the presentation generator's template library, and treat the `.pptx` as the source of truth for exact geometry when implementing a given layout — this catalog tells you *which slide number* to open for each one.

## ⚠️ Discrepancies vs. the currently-documented brand system

Two things in the master deck contradict what's currently written in `brand/typography.md` / `brand/palette.md` and baked into `agents/presentation-creator.skill.md`. Flagging rather than silently resolving — pick one before the redesign locks in a template library:

1. **Font.** Across all 104 slides, the deck uses **DM Sans** (706 uses) plus its **Medium** (413), **SemiBold** (69), and **Light** (40) weights, and **IBM Plex Sans** (186) plus its **Medium** (45) and **SemiBold** (4) weights, as the two font families — 1,224 DM Sans instances and 235 IBM Plex Sans instances combined. **Aeonik appears zero times.** The deck's own "best practices" slide (slide 2) states: *"Only use brand-approved fonts (IBM Plex Mono or DM Sans)"* — note it says Plex **Mono** in the instructions but the slides actually use IBM Plex **Sans**, so even the deck's own text has a small internal inconsistency. Either way, Aeonik is not part of this template at all — it's currently treated as the *primary* font in `presentation-creator.skill.md`, with DM Sans relegated to a PPTX-only fallback. That's inverted from what the master deck actually uses.
2. **Color.** The single most-used color across all slides (1,154 occurrences — more than white or black) is **`#36314C`**, used as the dominant dark slide background. It does not appear anywhere in `brand/palette.md`, which documents `#25223B` ("Ink 700") as the dark background instead. `#25223B` (38 uses) and `#35324A`/`#34324A` ("Ink", 78 uses combined) do appear in the deck, just far less often than `#36314C`. The Orange family is consistent with what's documented: `#FF6B18` (69 uses) plus close variants `#FD6B18` (158), `#F15B22`/`#F15C24` (130 combined), `#F9A352`, `#C53F27` — these read as a deliberate gradient/tint family around the same orange, not a discrepancy.

## Deck fundamentals (measured)

| Property | Value |
|---|---|
| Slide size | 10in × 5.625in (9,144,000 × 5,143,500 EMU) — matches the current skill's 16:9 dimensions exactly |
| Total slides | 104 |
| Slide layout definitions | 77 (Google Slides–exported generic names like `TITLE_AND_TWO_COLUMNS_1_2` — not descriptive; the *visual* distinctiveness lives in individual slides, not layout names, so this catalog indexes by slide content/category instead) |
| Slide masters | 5 |
| Theme color scheme | Generic Google Slides default (`058DC7` blue accent, etc.) — **not used**; every slide hardcodes brand colors directly on shapes instead of via the theme palette |

## Layout categories (in deck order, with slide pointers)

Each entry: **category** — purpose — slide range in `Copy of Master Deck 2026.pptx` — structural notes.

### Front matter (not layouts to reuse — reference/instructions only)
- **Slides 1–3**: cover + "best practices for using this deck" + shape-alignment tips. Not a slide type; informational only.

### 1. Title slides — slides 4–10
Section divider (slide 4) + 6 title-slide variants. Includes: a full "Design Presentation" cover with brand graphic; a pitch-deck title with 3-line subtitle list; a minimal "Powered by Whatfix" variant; and simpler single-subtitle variants. **Use for**: deck cover / opening slide.

### 2. Event / speaker slides — slides 11–16
- **Event Name** (slide 11): date/time/location block, for conference or webinar cover slides.
- **Speaker/Attendees** (slides 12–15): named speaker cards with title/role, including a "From the Founders' Desk" variant with two named executives, title, and role labels (e.g. "COO-Whatfix", "CEO-Whatfix").
- **Panel Discussion** (slide 16): grid of 4 name/designation/company cards.
**Use for**: event decks, webinar intros, exec-quote slides.

### 3. Agenda — slides 17–19
Numbered session list with time slots (up to 12 sessions across two slide variants — a 6-session and a 12-session layout) plus a one-line description per session. **Use for**: multi-session event agendas — richer than the current skill's simple numbered-list agenda type.

### 4. Section dividers — slides 20–25
Section-title-only slides with a large "Session" label and supporting line, in a few width/alignment variants (including a two-line variant and a subhead variant). **Use for**: chapter breaks — maps to the existing `section` layout type, this gives more variants to draw from.

### 5. Content — slides 26–37
The largest and most varied category. Includes:
- A 4-panel deep-dive layout with numbered feature blocks (bold micro-headline + supporting paragraph) — e.g. "Creates Contextual Scenarios from Organizational Knowledge" / "Measures Readiness and Skill Proficiency" etc.
- A "Key Takeaways" list layout (headline + 3 short takeaway lines with supporting detail).
- "Objective" layouts — large paragraph-style content blocks, several width variants (single-column, two-column, wide single-paragraph).
- A "Problem / Solution" two-panel layout, used twice with different content.
**Use for**: the bulk of narrative/explanatory content — this category alone justifies expanding the current skill's `content` layout into several more specific sub-types (deep-dive grid, takeaways list, objective block, problem/solution).

### 6. Case Study — slides 38–39
Section divider + a structured case-study layout: **THE CHALLENGE** / **THE SOLUTION** / **KEY RESULTS WITH WHATFIX** as three labeled blocks, plus a closing CTA block ("READY TO LEARN MORE?" with contact channels) and metadata (Industry / Region / Whatfix Solutions), a pull-quote testimonial with attribution, and a narrative summary paragraph. **Use for**: customer case studies, sales-enablement decks — not present at all in the current skill's layout vocabulary.

### 7. Plain text and simple image slides — slides 40–54
Title+text combinations in several column counts (1, 2, and 4 text blocks per slide), plus a "click to add title" card-pair layout (headline + 2 labeled sub-blocks, repeated across several slides — this is effectively a lighter-weight two-column comparison variant). **Use for**: simple explanatory slides that don't need heavy visual treatment.

### 8. Infographics — slides 55–68
- **Heading + infographic strip** (slide 55–57): 3 labeled stat/quote blocks in a row.
- **6-card grid layouts** (slides 58–67): "ADD TITLE" + description cards, repeated across many slide variants at different card counts/arrangements (2, 3, 4, 5, 6 cards) — this is a generalization of the current skill's `icon-grid` layout with more granular size options.
- **Process/workflow diagram** (slide 60, 68): a named 5-step cycle ("Ideation → Creation → Testing → Review/Feedback → Push to production") and a 4-quadrant frequency/complexity matrix ("Execute / Create / Migrate / Optimize" against Low/High axes) — the latter is a genuinely new layout type (a 2×2 strategic matrix) not in the current skill at all.
**Use for**: process explanations, feature grids, comparative frameworks.

### 9. Testimonial / stats / recognition — slides 69–77
- **Pull-quote** (slide 69–70): large quotation mark + attributed quote, close to the current skill's `quote` layout.
- **Company overview + numbers bar** (slide 71): narrative paragraph + a 4-metric stat row (45% / 84% / 3x / 10+), close to the current skill's `stat` layout but paired with body copy.
- **Cause-Effect** (slide 72): 6-item list layout, single column.
- **Numbered list + explanation** (slide 73): 3-item numbered list with a supporting paragraph.
- **Recognition/awards** (slide 74): analyst-recognition callout + testimonial quote with name/title/company.
- **Execution model / outcomes** (slide 75–76): two-column "Execution model → Outcomes" mapping with a Q&A-style supporting list.
- **Partners/customers stats** (slide 77): 3-metric stat row with supporting sub-copy per metric (125+ partners, 12 patents, 750+ customers).
**Use for**: social proof, credibility, and metrics-heavy slides — richer than the current skill's single `stat` layout.

### 10. Tables — slides 78–83
Plain data-table layouts in a few row/column-count variants (small 3-column table up through a denser multi-row table). **Use for**: structured comparative data — maps to the current skill's `comparison` layout but more general-purpose (not competitor-comparison-specific).

### 11. Multi-product graphic — slides 84–92
Full-bleed product-suite diagram slides in both light and dark mode, plus supporting slides describing the AI engine / product suite / analytics / roleplay simulation components with paired body text. **Use for**: product-suite overview slides — the current skill explicitly *forbids* full-bleed brand images on content slides; this category is the deck's own sanctioned exception, worth reconciling explicitly rather than treating as a violation of the no-full-bleed rule.

### 12. Mockups — slides 93–95
Desktop/laptop and mobile/tablet device-frame mockup placeholders ("You can replace the image on the screen with your own work"). **Use for**: product-screenshot slides — not present in the current skill at all.

### 13. Thank you — slides 96–104
Section divider + 4 near-identical "Thank you!" closing slide variants, plus repeated shape-alignment tip slides (informational, not a distinct layout — same content as slide 3, repeated as a reference reminder). **Use for**: closing slide — maps to the current skill's `closing` layout.

## How to use this catalog during implementation

For any category above, open `Copy of Master Deck 2026.pptx` to the referenced slide number(s) to read exact shape geometry, fills, and text formatting directly — this catalog intentionally indexes *what exists and where*, not a full re-transcription of every shape's position, since that's more reliably pulled straight from the source file at the point each layout is actually implemented in `deck-renderer.js` (per the presentation redesign spec) than pre-transcribed here and risking drift from the source.
