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

```
:::artifact{identifier="whatfix-presentation" type="text/html" title="PRESENTATION TITLE"}
```
<!DOCTYPE html>
...full HTML...
```
:::
```

Use a descriptive kebab-case identifier (e.g. `whatfix-q3-roadmap`). Reuse the same identifier when updating an existing presentation.

## CRITICAL Rules

- **NO EMOJIS** — ever. Use inline SVG icons or Unicode symbols (→ ● ◆ ▸) only
- **ALL colors from Whatfix palette only** — zero invented hex values
- **Layout must look like PowerPoint slides** — fixed 16:9 viewport, `position:absolute` full-bleed, not a scrolling webpage
- **Load PptxGenJS from cdnjs only**: `<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/4.0.1/pptxgen.bundle.js"></script>` — use **v4.0.1 exactly**. Never use 3.x, jsdelivr, unpkg, or a local `/libs/` path (the local `/libs/pptxgen.bundle.js` is the fallback and is also v4.0.1)
- **PptxGenJS v4 has no `addFont()` method** — do NOT call `pptx.addFont()` (removed in v4); font embedding is not supported
- **`pptx.writeFile()` is async in v4** — `downloadPptx()` must be an `async` function and must `await pptx.writeFile(...)`
- **PptxGenJS hex colors NEVER use `#` prefix** — `'FF6B18'` not `'#FF6B18'` (causes file corruption)
- **Never encode opacity in hex** — use the `transparency` property instead of 8-char hex strings
- **Never reuse option objects** across PptxGenJS calls — it mutates them in-place
- **PPTX slide dimensions: `SW = 10"` wide, `SH = 5.625"` tall** (LAYOUT_16x9). Never use `w:'100%'` or `h:'100%'` — always use explicit `w:SW` (`10`) and `h:SH` (`5.625`) for full-bleed shapes
- **Brand font is Aeonik** (loaded via `@font-face` from `/libs/fonts/`) with DM Sans as PPTX font (DM Sans is natively available in Google Slides — no embedding needed)
- Google Fonts `@import` is allowed

## Content Rules (apply before generating any slide)

1. **Action titles** — every slide title is a complete sentence stating the takeaway, not a topic label. "Onboarding time drops 40% in week one" not "Onboarding Results". Ghost deck test: reading only the titles in sequence must tell the full story.
2. **One idea per slide** — if a slide needs two conclusions, split it into two slides
3. **Hard limits for content: max 3 bullets, max 8 words per bullet** — if you can't say it in 8 words, you have two ideas. No paragraphs, no sentences, only tight phrases
4. **Minimum font sizes (never go below these):** PPTX headline 22pt, bullets 15pt, captions 9pt. In HTML: headline `clamp(1.4rem,2.6vw,2.2rem)`, bullets `clamp(0.9rem,1.6vw,1.1rem)`
5. **Top-down structure** — key message first, supporting evidence below. Never bury the conclusion at the end
6. **Varied layouts** — never repeat the same layout on consecutive slides. Alternate between: bullets, two-column, stat callout, quote, chart, image+text
7. **Every content slide needs a visual anchor** — a brand graphic, stat callout, or chart. No text-only slides. If you have no data visual, use a brand graphic in the right column
8. **Generous whitespace** — better to have 3 bullets with breathing room than 5 cramped ones. Slide titles should never wrap to 3 lines

## Design Rules

### Color palette (Whatfix only)
```
#25223B  Ink 700    — dark slide backgrounds, section dividers
#35324A  Ink        — card/surface backgrounds on dark slides
#FF6B18  Orange     — stat numbers, accent bars, CTAs, headline accent
#F55800  Orange 700 — hover/pressed CTAs
#8A8A9C  Ink 300    — muted text, captions, metadata
#872345  Crimson    — playbook cover, table headers
#AED2F3  Bright Blue — data / chart accent
#F9F9F2  Gray 100   — light slide backgrounds
#E5E3DC  Gray 300   — borders, dividers
#FFFFFF  White      — text on dark, light slide background
```

**Orange usage rules:**
- Use for: stat numbers, accent bars, CTA buttons, one key word in a headline
- Never use as full slide background or body paragraph color

### Typography
- **Primary font: Aeonik** — load via `@font-face` from `/libs/fonts/Aeonik-Medium.ttf` (weight 500), `Aeonik-Regular.ttf` (400), `Aeonik-Bold.ttf` (700), `Aeonik-Light.ttf` (300)
- **Fallback stack:** `'Aeonik', 'DM Sans', -apple-system, sans-serif`

**Minimum sizes — never go below these (source: Claude PowerPoint official spec)**
| Role | HTML clamp | PPTX pt | Weight |
|------|-----------|---------|--------|
| Title slide hero | `clamp(2.2rem,4.5vw,3.8rem)` | 32–40pt | 500 |
| Slide headline | `clamp(1.4rem,2.6vw,2.2rem)` | 22–28pt | 500 |
| Section title | `clamp(1.7rem,3.2vw,2.8rem)` | 26–32pt | 500 |
| Body / bullets | `clamp(0.85rem,1.5vw,1.05rem)` | 14–16pt | 300–400 |
| Stat / KPI | `clamp(3rem,8vw,5.5rem)` | 40–52pt | 700 |
| Caption / label | `0.72rem` | 9–11pt | 400 |

- `text-wrap: pretty` on all `h1`, `h2`, `h3` — prevents orphaned single words at line ends
- **Sentence case always** — never title-case every word except acronyms or brand names
- Line height: headlines 1.1–1.15 · body 1.55–1.65
- Letter spacing: headlines `−0.02em` · body `0` · labels/eyebrows `+0.12–0.18em`
- **No accent lines under titles** — use whitespace, background color, or brand graphics instead

### Dark / Light Sandwich
- Title slide: dark (Ink 700)
- Section dividers: dark (Ink 700) with Orange right panel
- Content slides: dark (Ink 700) — use `#35324A` card backgrounds for contrast blocks
- Stat slides: dark (#35324A) with Orange numbers
- Closing slide: dark (Ink 700)
- Table / playbook data slides: white (`#FFFFFF`) with Crimson headers

### Layout Variety (pick appropriate type per slide)
- **`content`** — headline + 3–4 short bullets with left-edge Orange dot
- **`two-col`** — headline spans full width; left column text/bullets, right column brand graphic or stat card
- **`stat`** — 2–3 large KPI numbers centered, each with a one-line label
- **`quote`** — large quotation mark, italic blockquote, cite attribution
- **`split`** — full-bleed left panel (dark) with text, right panel (Orange or Crimson) with brand visual
- **`chart`** — horizontal bar chart with value labels and percentage bars, built from inline HTML
- **`agenda`** — numbered list with counter bubbles
- **`section`** — two-panel layout: left dark with text, right Orange
- **`closing`** — dark, centered, CTA button
- **`comparison`** — side-by-side two-column feature/competitor comparison with header row; use for head-to-head evaluations, before/after, or option trade-offs
- **`process`** — numbered horizontal step flow (3–5 steps) with connector lines; use for workflows, onboarding sequences, implementation phases
- **`icon-grid`** — 2×2 or 3×2 grid of feature/capability cards, each with an SVG icon, bold label, and one-line descriptor; use for product capabilities, benefits, or team structure
- **`timeline`** — vertical milestone timeline with alternating left/right entries and date markers; use for roadmaps, history, or project phases

## Choosing the Right Mode

| Mode | When to use | Cover color |
|------|-------------|-------------|
| **Dark deck** (default) | Pitches, product showcases, executive presentations | Ink 700 |
| **Playbook** | POC playbooks, demo playbooks, sales playbooks | Crimson |

---

## Brand Graphics

All graphics are served from `/brand/` (pre-built into the app). Use them on relevant slides — prefer a brand graphic over a blank colored rectangle whenever content matches a product.

### Using in HTML slides
Use `<img>` with explicit size and `object-fit: contain`. Always set `loading="eager"`.
**Prefer SVG over PNG** for AI Agent logos — SVGs are vector and render crisply at any size:
```html
<!-- AI Agent logos: use .svg for HTML, .png for PPTX data-brand-image -->
<img src="/brand/authoring-agent-dark.svg" loading="eager"
     style="width:100%;height:100%;object-fit:contain;" alt="">

<!-- Product suite composites (no SVG available): use .png -->
<img src="/brand/product-suite-dark.png" loading="eager"
     style="width:100%;height:100%;object-fit:contain;" alt="">
```

### Using in PPTX (data-brand-image attribute)
Add `data-brand-image` to a `<section>` to embed the graphic in the PPTX. Optionally control position/size with `data-bi-x`, `data-bi-y`, `data-bi-w`, `data-bi-h` (all in inches). If omitted, sensible per-type defaults apply.

```html
<section class="slide two-col" data-type="two-col"
  data-brand-image="authoring-agent-dark"
  data-bi-x="5.8" data-bi-y="1.3" data-bi-w="3.7" data-bi-h="3.7"
  ...>
```

### Available Files

| File | Contents | Use on |
|------|----------|--------|
| `/brand/product-suite-dark.png` | Full product suite diagram | Dark slides, overview/closing |
| `/brand/ai-agents-suite-dark.png` | Product suite — AI Agents highlight | AI agent slides |
| `/brand/screensense-suite-dark.png` | Product suite — ScreenSense highlight | ScreenSense slides |
| `/brand/product-suite-full-dark.png` | Full product suite with all logos | Architecture / product overview |
| `/brand/product-suite-light.png` | Full product suite (light bg) | Light-background slides |
| `/brand/ai-agents-suite-light.png` | AI Agents suite (light) | Light-background slides |
| `/brand/authoring-agent-dark.svg` ✦ | Authoring Agent logo | Authoring Agent slides (HTML) |
| `/brand/guidance-agent-dark.svg` ✦ | Guidance Agent logo | Guidance Agent slides (HTML) |
| `/brand/insights-agent-dark.svg` ✦ | Insights Agent logo | Insights Agent slides (HTML) |
| `/brand/authoring-agent-box-dark.svg` ✦ | Authoring Agent logo in box | Dark card insets (HTML) |
| `/brand/guidance-agent-box-dark.svg` ✦ | Guidance Agent logo in box | Dark card insets (HTML) |
| `/brand/insights-agent-box-dark.svg` ✦ | Insights Agent logo in box | Dark card insets (HTML) |
| `/brand/authoring-agent-light.svg` ✦ | Authoring Agent logo (light) | Light-background slides (HTML) |
| `/brand/guidance-agent-light.svg` ✦ | Guidance Agent logo (light) | Light-background slides (HTML) |
| `/brand/insights-agent-light.svg` ✦ | Insights Agent logo (light) | Light-background slides (HTML) |
| `/brand/authoring-agent-dark.png` | Authoring Agent logo | PPTX data-brand-image only |
| `/brand/guidance-agent-dark.png` | Guidance Agent logo | PPTX data-brand-image only |
| `/brand/insights-agent-dark.png` | Insights Agent logo | PPTX data-brand-image only |
| `/brand/authoring-agent-box-dark.png` | Authoring Agent logo in box | PPTX data-brand-image only |
| `/brand/guidance-agent-box-dark.png` | Guidance Agent logo in box | PPTX data-brand-image only |
| `/brand/insights-agent-box-dark.png` | Insights Agent logo in box | PPTX data-brand-image only |
| `/brand/authoring-agent-light.png` | Authoring Agent logo (light) | PPTX data-brand-image only |
| `/brand/guidance-agent-light.png` | Guidance Agent logo (light) | PPTX data-brand-image only |
| `/brand/insights-agent-light.png` | Insights Agent logo (light) | PPTX data-brand-image only |

✦ = SVG (vector) — use these in `<img src="...">` tags for pixel-perfect HTML rendering at any size.
| `/brand/dap-dark.png` | DAP product logo | DAP-focused slides |
| `/brand/dap-light.png` | DAP product logo (light) | Light-background slides |
| `/brand/mirror-dark.png` | Mirror product logo | Mirror slides |
| `/brand/screensense-dark.png` | ScreenSense product logo | ScreenSense slides |
| `/brand/product-analytics-dark.png` | Product Analytics logo | Analytics slides |

**Rules:**
- Use dark variants on dark slides (default), light variants on white/gray slides
- Never stretch or crop brand graphics — always `object-fit: contain`
- For `title` and `closing` slides, add `data-brand-image="product-suite-dark"` unless the content is product-specific
- For product-specific slides (DAP, ScreenSense, Mirror, etc.), use the matching product logo
- For AI Agent slides, use the matching agent logo or `ai-agents-suite-dark`

---

## Full HTML Template — Dark Deck

Replace ALL_CAPS placeholders. The `data-*` attributes on each `<section>` drive the PPTX export — **always fill them in AND the visible HTML**; they must stay in sync.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRESENTATION_TITLE</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/4.0.1/pptxgen.bundle.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');
@font-face { font-family:'Aeonik'; src:url('/libs/fonts/Aeonik-Light.ttf') format('truetype'); font-weight:300; font-style:normal; font-display:swap; }
@font-face { font-family:'Aeonik'; src:url('/libs/fonts/Aeonik-Regular.ttf') format('truetype'); font-weight:400; font-style:normal; font-display:swap; }
@font-face { font-family:'Aeonik'; src:url('/libs/fonts/Aeonik-Medium.ttf') format('truetype'); font-weight:500; font-style:normal; font-display:swap; }
@font-face { font-family:'Aeonik'; src:url('/libs/fonts/Aeonik-Bold.ttf') format('truetype'); font-weight:700; font-style:normal; font-display:swap; }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1728; font-family: 'Aeonik', 'DM Sans', sans-serif; }

/* ── Deck ─────────────────────────────────────────── */
.deck { width: 100vw; height: 100vh; position: relative; overflow: hidden; }

/* ── Slide base ───────────────────────────────────── */
.slide {
  position: absolute; inset: 0;
  opacity: 0; transform: translateX(60px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none; will-change: transform, opacity;
  background: #25223B;
}
.slide.active  { opacity: 1; transform: translateX(0); pointer-events: all; }
.slide.exit    { opacity: 0; transform: translateX(-60px); }

/* ── TITLE ───────────────────────────────────────── */
.slide.title {
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: clamp(2.5rem,6vw,5rem) clamp(2.5rem,6vw,5.5rem) clamp(3rem,7vh,5rem);
  background: linear-gradient(150deg, #25223B 0%, #2e2b42 60%, #35324A 100%);
  overflow: hidden;
}
.slide.title .brand-graphic {
  position: absolute; top: 0; right: 0; width: 42%; height: 80%;
  display: flex; align-items: center; justify-content: flex-end;
  padding: clamp(1.5rem,4vh,3.5rem); pointer-events: none;
}
.slide.title .brand-graphic img { width: 100%; height: 100%; object-fit: contain; opacity: 0.9; }
.slide.title .eyebrow {
  position: relative; z-index: 1;
  font-size: 0.65rem; font-weight: 500; letter-spacing: 0.16em;
  text-transform: uppercase; color: #FF6B18; margin-bottom: 0.85rem;
}
.slide.title h1 {
  position: relative; z-index: 1;
  font-size: clamp(2.2rem,4.5vw,3.8rem); font-weight: 500;
  color: #fff; line-height: 1.12; max-width: 14ch; margin-bottom: 1rem;
  letter-spacing: -0.02em;
}
.slide.title .title-bar {
  width: 40px; height: 3px; background: #FF6B18; border-radius: 2px;
  margin-bottom: 1rem; position: relative; z-index: 1;
}
.slide.title .subtitle {
  position: relative; z-index: 1;
  font-size: clamp(0.9rem,1.5vw,1.1rem); font-weight: 300;
  color: rgba(255,255,255,0.5); max-width: 40ch; line-height: 1.65;
}
.slide.title .meta {
  position: absolute; bottom: clamp(1.5rem,4vh,3rem);
  right: clamp(2rem,5vw,5rem); font-size: 0.65rem; color: rgba(255,255,255,0.18);
  letter-spacing: 0.04em;
}

/* ── AGENDA ──────────────────────────────────────── */
.slide.agenda {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,5rem);
}
.slide.agenda .label {
  font-size: 0.62rem; font-weight: 500; letter-spacing: 0.18em;
  text-transform: uppercase; color: #FF6B18; margin-bottom: 1.75rem;
}
.slide.agenda ol { list-style: none; counter-reset: a; }
.slide.agenda ol li {
  counter-increment: a; display: flex; align-items: center;
  gap: 1.25rem; padding: 0.65rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: clamp(0.9rem,1.75vw,1.25rem); font-weight: 400;
  color: rgba(255,255,255,0.82);
}
.slide.agenda ol li::before {
  content: counter(a,decimal-leading-zero);
  font-size: 0.65rem; font-weight: 700; color: #FF6B18;
  background: rgba(255,107,24,0.1); border: 1px solid rgba(255,107,24,0.25);
  width: 1.9rem; height: 1.9rem; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

/* ── SECTION ─────────────────────────────────────── */
.slide.section { display: flex; flex-direction: row; }
.slide.section .sec-left {
  flex: 0 0 62%; background: #25223B;
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,5rem);
}
.slide.section .sec-right {
  flex: 1; background: #FF6B18; position: relative; overflow: hidden;
}
.slide.section .sec-right::before {
  content: ''; position: absolute;
  width: 150%; height: 150%; border-radius: 50%;
  border: clamp(20px,3vw,40px) solid rgba(255,255,255,0.12);
  top: -25%; left: -80%;
}
.slide.section .sec-num {
  font-size: 0.62rem; font-weight: 500; letter-spacing: 0.18em;
  text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 0.75rem;
}
.slide.section h2 {
  font-size: clamp(1.7rem,3.2vw,2.8rem); font-weight: 500;
  color: #fff; line-height: 1.15; max-width: 18ch; letter-spacing: -0.02em;
}

/* ── CONTENT (bullets) ───────────────────────────── */
.slide.content {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.content h2 {
  font-size: clamp(1.3rem,2.4vw,2rem); font-weight: 500;
  color: #FF6B18; line-height: 1.2; margin-bottom: 1.75rem; max-width: 30ch;
  letter-spacing: -0.02em;
}
.slide.content ul { list-style: none; display: flex; flex-direction: column; gap: 0.8rem; }
.slide.content ul li {
  display: flex; align-items: flex-start; gap: 1rem;
  font-size: clamp(0.85rem,1.5vw,1.05rem); font-weight: 300;
  color: rgba(255,255,255,0.82); line-height: 1.6;
  padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.slide.content ul li:last-child { border-bottom: none; }
.slide.content ul li .dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #FF6B18; flex-shrink: 0; margin-top: 0.5rem;
}

/* ── TWO-COLUMN ──────────────────────────────────── */
.slide.two-col {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.two-col h2 {
  font-size: clamp(1.3rem,2.4vw,2rem); font-weight: 500;
  color: #FF6B18; margin-bottom: 1.5rem; max-width: 34ch; letter-spacing: -0.02em;
}
.slide.two-col .cols { display: flex; gap: 3vw; align-items: stretch; }
.slide.two-col .col-left { flex: 1.1; }
.slide.two-col .col-right {
  flex: 0.9; background: #35324A; border-radius: 10px;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column;
  gap: 0.9rem; justify-content: center; overflow: hidden;
}
.slide.two-col .col-right img {
  width: 100%; height: 100%; object-fit: contain; border-radius: 6px;
}
.slide.two-col ul { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
.slide.two-col ul li {
  display: flex; align-items: flex-start; gap: 0.85rem;
  font-size: clamp(0.82rem,1.45vw,1.02rem); font-weight: 300;
  color: rgba(255,255,255,0.8); line-height: 1.55;
}
.slide.two-col ul li .dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #FF6B18; flex-shrink: 0; margin-top: 0.5rem;
}
.col-right .stat-row { display: flex; flex-direction: column; align-items: flex-start; }
.col-right .stat-row .big { font-size: clamp(2rem,4vw,3rem); font-weight: 700; color: #FF6B18; line-height: 1; letter-spacing: -0.03em; }
.col-right .stat-row .lbl { font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 0.2rem; }

/* ── STAT ────────────────────────────────────────── */
.slide.stat {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; background: #35324A; text-align: center;
}
.slide.stat .stat-label {
  font-size: clamp(0.85rem,1.5vw,1.1rem); font-weight: 400;
  color: rgba(255,255,255,0.35); margin-bottom: 2.5rem; letter-spacing: 0.02em;
}
.kpi-grid { display: flex; gap: clamp(2rem,6vw,6rem); align-items: flex-end; flex-wrap: wrap; justify-content: center; }
.kpi { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.big-num { font-size: clamp(3rem,8vw,5.5rem); font-weight: 700; color: #FF6B18; line-height: 1; letter-spacing: -0.04em; }
.kpi-lbl { font-size: clamp(0.72rem,1.2vw,0.9rem); color: rgba(255,255,255,0.45); max-width: 13ch; text-align: center; line-height: 1.4; }

/* ── QUOTE ───────────────────────────────────────── */
.slide.quote {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; background: #35324A; padding: clamp(2rem,5vw,6rem);
}
.slide.quote .qmark { font-size: 5rem; color: rgba(255,107,24,0.15); line-height: 0.6; font-family: Georgia, serif; margin-bottom: 1.5rem; }
.slide.quote blockquote {
  font-size: clamp(1rem,1.8vw,1.5rem); font-weight: 300; font-style: italic;
  color: #fff; max-width: 640px; line-height: 1.7; text-align: center;
}
.slide.quote cite {
  display: block; margin-top: 1.75rem; font-size: 0.78rem; font-weight: 500;
  font-style: normal; color: #FF6B18; letter-spacing: 0.1em; text-transform: uppercase;
}

/* ── CLOSING ─────────────────────────────────────── */
.slide.closing {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; overflow: hidden;
  background: linear-gradient(150deg, #25223B 0%, #2e2b42 100%);
}
.slide.closing .closing-bg {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; opacity: 0.07; pointer-events: none;
}
.slide.closing .closing-bg img { width: 110%; height: 110%; object-fit: cover; }
.slide.closing h2 {
  position: relative; z-index: 1;
  font-size: clamp(2rem,4vw,3.6rem); font-weight: 500;
  color: #fff; line-height: 1.1; margin-bottom: 0.8rem; letter-spacing: -0.02em;
}
.slide.closing .closing-bar {
  width: 36px; height: 3px; background: #FF6B18; border-radius: 2px;
  margin: 0 auto 1rem; position: relative; z-index: 1;
}
.slide.closing p { font-size: 1rem; font-weight: 300; color: rgba(255,255,255,0.45); position: relative; z-index: 1; }
.slide.closing .cta-btn {
  margin-top: 1.75rem; padding: 0.65rem 2rem; background: #FF6B18;
  color: #fff; border-radius: 6px; font-size: 0.88rem; font-weight: 500;
  display: inline-block; letter-spacing: 0.02em; position: relative; z-index: 1;
}

/* ── Chrome ───────────────────────────────────────── */
.progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 2px; background: rgba(255,255,255,0.06); z-index: 100; }
.progress-fill { height: 100%; background: #FF6B18; border-radius: 0 2px 2px 0; transition: width 0.3s ease; }
.slide-counter { position: fixed; bottom: 1.25rem; right: 1.75rem; font-size: 0.62rem; font-weight: 400; color: rgba(255,255,255,0.18); z-index: 100; letter-spacing: 0.1em; }
.nav-hint { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); font-size: 0.58rem; color: rgba(255,255,255,0.1); z-index: 100; white-space: nowrap; }
.notes { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 300; background: rgba(8,6,18,0.95); color: rgba(255,255,255,0.72); padding: 1rem 3rem; font-size: 0.8rem; line-height: 1.65; border-top: 2px solid #FF6B18; }
.notes.visible { display: block; }

/* ── text-wrap: pretty on all headings ───────────── */
h1, h2, h3 { text-wrap: pretty; }

/* ── COMPARISON ──────────────────────────────────── */
.slide.comparison {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(1.5rem,4vw,3.5rem);
}
.slide.comparison h2 {
  font-size: clamp(1.2rem,2.2vw,1.8rem); font-weight: 500;
  color: #FF6B18; margin-bottom: 1.25rem; letter-spacing: -0.02em;
}
.cmp-table { width: 100%; border-collapse: collapse; }
.cmp-table thead tr { background: #35324A; }
.cmp-table thead th {
  padding: 0.5rem 0.9rem; font-size: clamp(0.7rem,1.1vw,0.85rem);
  font-weight: 500; color: rgba(255,255,255,0.6); text-align: left;
  border-bottom: 1px solid rgba(255,107,24,0.3);
}
.cmp-table thead th:first-child { color: rgba(255,255,255,0.35); }
.cmp-table thead th.highlight { color: #FF6B18; }
.cmp-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
.cmp-table tbody td {
  padding: 0.45rem 0.9rem; font-size: clamp(0.72rem,1.1vw,0.88rem);
  font-weight: 300; color: rgba(255,255,255,0.78);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  vertical-align: middle;
}
.cmp-table tbody td:first-child { color: rgba(255,255,255,0.45); font-weight: 400; }
.cmp-tick { color: #72C87B; font-size: 1em; }
.cmp-cross { color: rgba(255,255,255,0.2); }
.cmp-table .col-ours { background: rgba(255,107,24,0.05); }

/* ── PROCESS ─────────────────────────────────────── */
.slide.process {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.process h2 {
  font-size: clamp(1.2rem,2.2vw,1.8rem); font-weight: 500;
  color: #FF6B18; margin-bottom: 1.75rem; letter-spacing: -0.02em;
}
.process-row {
  display: flex; align-items: flex-start; gap: 0; justify-content: space-between;
}
.process-step {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  position: relative; text-align: center;
}
.process-step:not(:last-child)::after {
  content: ''; position: absolute; top: 1.1rem; left: 60%; width: 80%;
  height: 1px; background: linear-gradient(90deg, #FF6B18 0%, rgba(255,107,24,0.15) 100%);
}
.ps-num {
  width: 2.2rem; height: 2.2rem; border-radius: 50%; flex-shrink: 0;
  background: #FF6B18; display: flex; align-items: center; justify-content: center;
  font-size: 0.78rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem;
  position: relative; z-index: 1;
}
.ps-label {
  font-size: clamp(0.72rem,1.2vw,0.88rem); font-weight: 500;
  color: #fff; margin-bottom: 0.3rem; line-height: 1.3;
}
.ps-desc {
  font-size: clamp(0.62rem,0.95vw,0.75rem); font-weight: 300;
  color: rgba(255,255,255,0.45); line-height: 1.5; max-width: 14ch; margin: 0 auto;
}

/* ── ICON GRID ───────────────────────────────────── */
.slide.icon-grid {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4rem);
}
.slide.icon-grid h2 {
  font-size: clamp(1.2rem,2.2vw,1.8rem); font-weight: 500;
  color: #FF6B18; margin-bottom: 1.5rem; letter-spacing: -0.02em;
}
.ig-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
}
.ig-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.ig-card {
  background: #35324A; border-radius: 8px; padding: 1.1rem 1.25rem;
  display: flex; align-items: flex-start; gap: 0.9rem;
  border: 1px solid rgba(255,255,255,0.05);
}
.ig-icon {
  width: 2rem; height: 2rem; flex-shrink: 0;
  background: rgba(255,107,24,0.12); border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.ig-icon svg { width: 1rem; height: 1rem; stroke: #FF6B18; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ig-text .ig-title {
  font-size: clamp(0.78rem,1.2vw,0.9rem); font-weight: 500; color: #fff; margin-bottom: 0.2rem;
}
.ig-text .ig-desc {
  font-size: clamp(0.65rem,1vw,0.75rem); font-weight: 300; color: rgba(255,255,255,0.45); line-height: 1.5;
}

/* ── TIMELINE ────────────────────────────────────── */
.slide.timeline {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.timeline h2 {
  font-size: clamp(1.2rem,2.2vw,1.8rem); font-weight: 500;
  color: #FF6B18; margin-bottom: 1.25rem; letter-spacing: -0.02em;
}
.tl-track {
  position: relative; padding-left: 2rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.tl-track::before {
  content: ''; position: absolute; left: 0.55rem; top: 0.4rem; bottom: 0.4rem;
  width: 1px; background: linear-gradient(180deg, #FF6B18 0%, rgba(255,107,24,0.1) 100%);
}
.tl-item { display: flex; align-items: flex-start; gap: 1rem; position: relative; }
.tl-dot {
  position: absolute; left: -1.64rem; top: 0.22rem;
  width: 0.65rem; height: 0.65rem; border-radius: 50%;
  background: #FF6B18; flex-shrink: 0; z-index: 1;
  box-shadow: 0 0 0 3px rgba(255,107,24,0.15);
}
.tl-date {
  font-size: 0.65rem; font-weight: 500; color: #FF6B18;
  letter-spacing: 0.08em; text-transform: uppercase;
  min-width: 6rem; padding-top: 0.05rem; flex-shrink: 0;
}
.tl-content .tl-title {
  font-size: clamp(0.78rem,1.2vw,0.9rem); font-weight: 500; color: #fff; margin-bottom: 0.15rem;
}
.tl-content .tl-body {
  font-size: clamp(0.65rem,1vw,0.75rem); font-weight: 300; color: rgba(255,255,255,0.45); line-height: 1.5;
}

/* ── Reduced-motion override ──────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .slide { transition: none; }
  * { animation: none !important; transition: none !important; }
}

/* ── Print / PDF export ─────────────────────────────
   When the PDF button opens this HTML in a new tab, @media print
   stacks all slides as individual landscape pages.                */
@media print {
  @page { size: landscape; margin: 0; }
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body { width: 100%; height: auto; overflow: visible !important; background: #25223B !important; }
  .deck { position: relative !important; height: auto !important; overflow: visible !important; }
  .slide {
    position: relative !important; inset: auto !important;
    opacity: 1 !important; transform: none !important; pointer-events: all !important;
    display: block !important;
    width: 100vw !important; height: 100vh !important;
    page-break-after: always; break-after: page;
  }
  .slide:last-child { page-break-after: avoid; break-after: avoid; }
  .progress-bar, .slide-counter, .nav-hint, .notes { display: none !important; }
}

</style>
</head>
<body>

<div class="deck">

  <!-- ═══ TITLE — dark, brand graphic top-right ════ -->
  <section class="slide title active" data-type="title"
    data-title="YOUR ACTION TITLE HERE"
    data-subtitle="Supporting context — one line"
    data-eyebrow="Whatfix · Department · Month Year"
    data-meta="Prepared by Name · Month Year"
    data-brand-image="product-suite-dark">
    <div class="brand-graphic">
      <img src="/brand/product-suite-dark.png" loading="eager" alt="">
    </div>
    <p class="eyebrow">Whatfix · Department · Month Year</p>
    <h1>Your action title captures the core message</h1>
    <div class="title-bar"></div>
    <p class="subtitle">One sentence of supporting context or framing.</p>
    <div class="meta">Prepared by Name · Month Year</div>
  </section>

  <!-- ═══ AGENDA ═══════════════════════════════════ -->
  <section class="slide agenda" data-type="agenda"
    data-items='["First section","Second section","Third section","Next steps"]'>
    <p class="label">Agenda</p>
    <ol>
      <li>First section</li>
      <li>Second section</li>
      <li>Third section</li>
      <li>Next steps</li>
    </ol>
  </section>

  <!-- ═══ SECTION DIVIDER ══════════════════════════ -->
  <section class="slide section" data-type="section"
    data-secnum="Section 01" data-title="Section Title as a Complete Sentence">
    <div class="sec-left">
      <p class="sec-num">Section 01</p>
      <h2>Section title states the key takeaway</h2>
    </div>
    <div class="sec-right"></div>
  </section>

  <!-- ═══ CONTENT (bullets) ════════════════════════ -->
  <section class="slide content" data-type="content"
    data-headline="Action title: the point of this slide in one sentence"
    data-bullets='["First point — outcome oriented, max 15 words","Second point — specific and measurable","Third point — actionable, no padding words"]'>
    <h2>Action title: the point of this slide in one sentence</h2>
    <ul>
      <li><span class="dot"></span>First point — outcome oriented, max 15 words</li>
      <li><span class="dot"></span>Second point — specific and measurable</li>
      <li><span class="dot"></span>Third point — actionable, no padding words</li>
    </ul>
    <div class="notes">Speaker notes.</div>
  </section>

  <!-- ═══ TWO-COLUMN (text + brand graphic) ═════════ -->
  <section class="slide two-col" data-type="two-col"
    data-headline="Two-column action title for context and data slides"
    data-left-bullets='["Key context point one","Key context point two","Key context point three"]'
    data-right-stats='[{"value":"40%","label":"Reduction in time"},{"value":"3×","label":"Faster adoption"}]'
    data-brand-image="authoring-agent-dark"
    data-bi-x="5.7" data-bi-y="1.3" data-bi-w="3.9" data-bi-h="3.7">
    <h2>Two-column action title for context and data slides</h2>
    <div class="cols">
      <div class="col-left">
        <ul>
          <li><span class="dot"></span>Key context point one</li>
          <li><span class="dot"></span>Key context point two</li>
          <li><span class="dot"></span>Key context point three</li>
        </ul>
      </div>
      <div class="col-right">
        <img src="/brand/authoring-agent-dark.png" loading="eager" alt="">
      </div>
    </div>
  </section>

  <!-- ═══ STAT / KPI ════════════════════════════════ -->
  <section class="slide stat" data-type="stat"
    data-title="Impact at a glance"
    data-stats='[{"value":"40%","label":"Reduction in onboarding time"},{"value":"3×","label":"Faster software adoption"},{"value":"92%","label":"User satisfaction"}]'>
    <p class="stat-label">Impact at a glance</p>
    <div class="kpi-grid">
      <div class="kpi"><span class="big-num">40%</span><span class="kpi-lbl">Reduction in onboarding time</span></div>
      <div class="kpi"><span class="big-num">3×</span><span class="kpi-lbl">Faster software adoption</span></div>
      <div class="kpi"><span class="big-num">92%</span><span class="kpi-lbl">User satisfaction</span></div>
    </div>
  </section>

  <!-- ═══ COMPARISON ══════════════════════════════════ -->
  <section class="slide comparison" data-type="comparison"
    data-headline="We out-perform [Competitor] on the metrics that matter"
    data-headers='["Feature","Whatfix","Competitor A","Competitor B"]'
    data-highlight-col="1"
    data-rows='[
      ["In-app guidance","✓","✓","✗"],
      ["Self-serve analytics","✓","✗","✗"],
      ["No-code authoring","✓","✓","✗"],
      ["Enterprise SSO","✓","✓","✓"],
      ["AI-powered flows","✓","✗","✗"]
    ]'>
    <h2>We out-perform [Competitor] on the metrics that matter</h2>
    <table class="cmp-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th class="highlight">Whatfix</th>
          <th>Competitor A</th>
          <th>Competitor B</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>In-app guidance</td><td class="col-ours"><span class="cmp-tick">✓</span></td><td><span class="cmp-tick">✓</span></td><td><span class="cmp-cross">✗</span></td></tr>
        <tr><td>Self-serve analytics</td><td class="col-ours"><span class="cmp-tick">✓</span></td><td><span class="cmp-cross">✗</span></td><td><span class="cmp-cross">✗</span></td></tr>
        <tr><td>No-code authoring</td><td class="col-ours"><span class="cmp-tick">✓</span></td><td><span class="cmp-tick">✓</span></td><td><span class="cmp-cross">✗</span></td></tr>
        <tr><td>Enterprise SSO</td><td class="col-ours"><span class="cmp-tick">✓</span></td><td><span class="cmp-tick">✓</span></td><td><span class="cmp-tick">✓</span></td></tr>
        <tr><td>AI-powered flows</td><td class="col-ours"><span class="cmp-tick">✓</span></td><td><span class="cmp-cross">✗</span></td><td><span class="cmp-cross">✗</span></td></tr>
      </tbody>
    </table>
  </section>

  <!-- ═══ PROCESS ══════════════════════════════════ -->
  <section class="slide process" data-type="process"
    data-headline="Four steps from contract to full adoption"
    data-steps='[
      {"num":"01","label":"Kickoff","desc":"Stakeholders aligned, scope locked"},
      {"num":"02","label":"Configure","desc":"Flows built, branding applied"},
      {"num":"03","label":"Pilot","desc":"50 users, 2-week feedback loop"},
      {"num":"04","label":"Scale","desc":"Full rollout, analytics live"}
    ]'>
    <h2>Four steps from contract to full adoption</h2>
    <div class="process-row">
      <div class="process-step">
        <div class="ps-num">01</div>
        <div class="ps-label">Kickoff</div>
        <div class="ps-desc">Stakeholders aligned, scope locked</div>
      </div>
      <div class="process-step">
        <div class="ps-num">02</div>
        <div class="ps-label">Configure</div>
        <div class="ps-desc">Flows built, branding applied</div>
      </div>
      <div class="process-step">
        <div class="ps-num">03</div>
        <div class="ps-label">Pilot</div>
        <div class="ps-desc">50 users, 2-week feedback loop</div>
      </div>
      <div class="process-step">
        <div class="ps-num">04</div>
        <div class="ps-label">Scale</div>
        <div class="ps-desc">Full rollout, analytics live</div>
      </div>
    </div>
  </section>

  <!-- ═══ ICON GRID ══════════════════════════════════ -->
  <section class="slide icon-grid" data-type="icon-grid"
    data-headline="Three agents, one platform — everything teams need"
    data-cols="3"
    data-cards='[
      {"icon":"edit","title":"Authoring Agent","desc":"Create flows in minutes, no dev needed"},
      {"icon":"compass","title":"Guidance Agent","desc":"Real-time nudges at the moment of need"},
      {"icon":"bar-chart-2","title":"Insights Agent","desc":"Usage data that drives adoption decisions"},
      {"icon":"shield","title":"Enterprise Security","desc":"SSO, RBAC, SOC 2 Type II"},
      {"icon":"zap","title":"AI Automation","desc":"Predict friction, auto-suggest content"},
      {"icon":"layers","title":"All Integrations","desc":"Salesforce, SAP, Workday, and 200+ more"}
    ]'>
    <h2>Three agents, one platform — everything teams need</h2>
    <div class="ig-grid">
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        <div class="ig-text"><div class="ig-title">Authoring Agent</div><div class="ig-desc">Create flows in minutes, no dev needed</div></div>
      </div>
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg></div>
        <div class="ig-text"><div class="ig-title">Guidance Agent</div><div class="ig-desc">Real-time nudges at the moment of need</div></div>
      </div>
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
        <div class="ig-text"><div class="ig-title">Insights Agent</div><div class="ig-desc">Usage data that drives adoption decisions</div></div>
      </div>
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="ig-text"><div class="ig-title">Enterprise Security</div><div class="ig-desc">SSO, RBAC, SOC 2 Type II</div></div>
      </div>
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
        <div class="ig-text"><div class="ig-title">AI Automation</div><div class="ig-desc">Predict friction, auto-suggest content</div></div>
      </div>
      <div class="ig-card">
        <div class="ig-icon"><svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>
        <div class="ig-text"><div class="ig-title">All Integrations</div><div class="ig-desc">Salesforce, SAP, Workday, and 200+ more</div></div>
      </div>
    </div>
  </section>

  <!-- ═══ TIMELINE ══════════════════════════════════ -->
  <section class="slide timeline" data-type="timeline"
    data-headline="From pilot to enterprise rollout in 90 days"
    data-milestones='[
      {"date":"Week 1–2","title":"Kickoff & discovery","body":"Scope agreed, technical access granted"},
      {"date":"Week 3–4","title":"Build & configure","body":"First 10 flows authored and branded"},
      {"date":"Week 5–6","title":"Pilot launch","body":"50 users live, feedback captured"},
      {"date":"Week 7–10","title":"Iterate & expand","body":"Flows refined, rollout to 500 users"},
      {"date":"Week 11–12","title":"Full deployment","body":"All users live, analytics dashboard active"}
    ]'>
    <h2>From pilot to enterprise rollout in 90 days</h2>
    <div class="tl-track">
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-date">Week 1–2</div>
        <div class="tl-content"><div class="tl-title">Kickoff &amp; discovery</div><div class="tl-body">Scope agreed, technical access granted</div></div>
      </div>
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-date">Week 3–4</div>
        <div class="tl-content"><div class="tl-title">Build &amp; configure</div><div class="tl-body">First 10 flows authored and branded</div></div>
      </div>
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-date">Week 5–6</div>
        <div class="tl-content"><div class="tl-title">Pilot launch</div><div class="tl-body">50 users live, feedback captured</div></div>
      </div>
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-date">Week 7–10</div>
        <div class="tl-content"><div class="tl-title">Iterate &amp; expand</div><div class="tl-body">Flows refined, rollout to 500 users</div></div>
      </div>
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-date">Week 11–12</div>
        <div class="tl-content"><div class="tl-title">Full deployment</div><div class="tl-body">All users live, analytics dashboard active</div></div>
      </div>
    </div>
  </section>

  <!-- ═══ CLOSING ═══════════════════════════════════ -->
  <section class="slide closing" data-type="closing"
    data-title="Thank you"
    data-body="Next step or closing thought."
    data-cta="Get in touch"
    data-brand-image="product-suite-dark">
    <div class="closing-bg">
      <img src="/brand/product-suite-dark.png" loading="eager" alt="">
    </div>
    <h2>Thank you</h2>
    <div class="closing-bar"></div>
    <p>Next step or closing thought.</p>
    <span class="cta-btn">Get in touch</span>
  </section>

</div>

<!-- Chrome -->
<div class="progress-bar"><div class="progress-fill" id="pf"></div></div>
<div class="slide-counter" id="sc"></div>
<div class="nav-hint">&#8592; &#8594; navigate &nbsp;&#183;&nbsp; F fullscreen &nbsp;&#183;&nbsp; N notes</div>

<script>
// ── Navigation ────────────────────────────────────────────────────────────
const slides = [...document.querySelectorAll('.slide')];
const pf = document.getElementById('pf');
const sc = document.getElementById('sc');
let cur = 0;

function go(n) {
  slides[cur].classList.remove('active');
  slides[cur].classList.add('exit');
  const prev = cur;
  cur = Math.max(0, Math.min(n, slides.length - 1));
  setTimeout(() => slides[prev].classList.remove('exit'), 340);
  slides[cur].classList.add('active');
  pf.style.width = ((cur + 1) / slides.length * 100) + '%';
  sc.textContent = (cur + 1) + ' / ' + slides.length;
  document.querySelectorAll('.notes.visible').forEach(el => el.classList.remove('visible'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
  else if (e.key === 'ArrowLeft') go(cur - 1);
  else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
  else if (e.key === 'n' || e.key === 'N') {
    const n = slides[cur].querySelector('.notes');
    if (n) n.classList.toggle('visible');
  }
});
document.querySelector('.deck').addEventListener('click', e => {
  go(e.clientX / window.innerWidth > 0.5 ? cur + 1 : cur - 1);
});
go(0);

// ── PPTX Export ───────────────────────────────────────────────────────────
// Whatfix brand colors — NO '#' prefix (causes PptxGenJS file corruption)
const C = {
  ink700:  '25223B',
  ink:     '35324A',
  orange:  'FF6B18',
  ink300:  '8A8A9C',
  crimson: '872345',
  white:   'FFFFFF',
  gray100: 'F9F9F2',
  gray300: 'E5E3DC',
  blue:    'AED2F3',
};

// Slide canvas: LAYOUT_16x9 = 10" × 5.625"
const SW = 10;
const SH = 5.625;

// DM Sans: natively available in Google Slides (Google Font) — no embedding needed.
// Using DM Sans means zero font substitution when the PPTX is opened in Google Slides.
const FONT = 'DM Sans';

// ── Brand image registry
// Each entry: { data: base64DataURI, nw: naturalPixelWidth, nh: naturalPixelHeight }
// nw/nh are the image's actual pixel dimensions — required for PptxGenJS sizing.contain
// to compute the correct crop/letterbox values without distortion.
var _imgs = {};
var _IMG_PATHS = {
  'product-suite-dark':      '/brand/product-suite-dark.png',
  'product-suite-full-dark': '/brand/product-suite-full-dark.png',
  'product-suite-light':     '/brand/product-suite-light.png',
  'ai-agents-suite-dark':    '/brand/ai-agents-suite-dark.png',
  'ai-agents-suite-light':   '/brand/ai-agents-suite-light.png',
  'screensense-suite-dark':  '/brand/screensense-suite-dark.png',
  'authoring-agent-dark':    '/brand/authoring-agent-dark.png',
  'authoring-agent-box-dark':'/brand/authoring-agent-box-dark.png',
  'guidance-agent-dark':     '/brand/guidance-agent-dark.png',
  'guidance-agent-box-dark': '/brand/guidance-agent-box-dark.png',
  'insights-agent-dark':     '/brand/insights-agent-dark.png',
  'insights-agent-box-dark': '/brand/insights-agent-box-dark.png',
  'dap-dark':                '/brand/dap-dark.png',
  'dap-light':               '/brand/dap-light.png',
  'mirror-dark':             '/brand/mirror-dark.png',
  'screensense-dark':        '/brand/screensense-dark.png',
  'product-analytics-dark':  '/brand/product-analytics-dark.png',
};

// Detect the app origin so brand asset fetches resolve against the real server.
// Priority: (1) _BRAND_ORIGIN injected by LibreChat before the Sandpack iframe loads,
// (2) window.location.origin (works in blob-URL tabs and same-origin iframes),
// (3) window.parent.location.origin (works in the DownloadArtifact hidden srcdoc iframe).
function _getOrigin() {
  if (window._BRAND_ORIGIN) return window._BRAND_ORIGIN;
  var o = window.location.origin;
  if (o && o !== 'null') return o;
  try { return window.parent.location.origin; } catch (e) {}
  return '';
}

// Load one image: fetch → detect natural dimensions → store as { data, nw, nh }.
function _loadImgEntry(key, blob) {
  return new Promise(function (res) {
    var objUrl = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var nw = img.naturalWidth || 0;
      var nh = img.naturalHeight || 0;
      URL.revokeObjectURL(objUrl);
      var fr = new FileReader();
      fr.onload = function () { _imgs[key] = { data: fr.result, nw: nw, nh: nh }; res(); };
      fr.onerror = res;
      fr.readAsDataURL(blob);
    };
    img.onerror = function () { URL.revokeObjectURL(objUrl); res(); };
    img.src = objUrl;
  });
}

// Eager preload on page load (for the DownloadArtifact hidden iframe path where it works).
(function () {
  var origin = _getOrigin();
  if (!origin) return;
  Object.keys(_IMG_PATHS).forEach(function (key) {
    fetch(origin + _IMG_PATHS[key])
      .then(function (r) { return r.blob(); })
      .then(function (blob) { return _loadImgEntry(key, blob); })
      .catch(function () {});
  });
})();

// Helper: embed a brand image into a PPTX slide with correct aspect-ratio contain.
// PptxGenJS sizing.contain needs the image's actual pixel dimensions as the first
// argument — using the placement dims instead causes wrong crop calculations.
function addBrandImg(s, key, x, y, w, h) {
  var entry = _imgs[key];
  if (!key || !entry || !entry.data) return;
  var nw = entry.nw > 0 ? entry.nw : Math.round(w * 96);
  var nh = entry.nh > 0 ? entry.nh : Math.round(h * 96);
  s.addImage({ data: entry.data, x: x, y: y, w: w, h: h,
               sizing: { type: 'contain', w: nw, h: nh } });
}

// downloadPptx is async because pptx.writeFile() returns a Promise in PptxGenJS v4.
// NOTE: pptx.addFont() was removed in PptxGenJS v4 — do not add it back.
async function downloadPptx() {
  // Lazily load any images not yet fetched (handles Sandpack cross-origin iframe).
  var origin = _getOrigin();
  if (origin) {
    var missing = Object.keys(_IMG_PATHS).filter(function (k) { return !_imgs[k] || !_imgs[k].data; });
    if (missing.length) {
      var proms = missing.map(function (key) {
        return fetch(origin + _IMG_PATHS[key])
          .then(function (r) { return r.blob(); })
          .then(function (blob) { return _loadImgEntry(key, blob); })
          .catch(function () {});
      });
      // Wait up to 4 s; proceed even if some images don't load.
      await Promise.race([Promise.allSettled(proms), new Promise(function (r) { setTimeout(r, 4000); })]);
    }
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title  = document.title;
  pptx.author = 'Whatfix';

  slides.forEach(slide => {
    const type = slide.dataset.type;
    const s = pptx.addSlide();

    // Resolve brand image key and position from data attributes
    const biKey = slide.dataset.brandImage || null;
    const biX = parseFloat(slide.dataset.biX || '6.5');
    const biY = parseFloat(slide.dataset.biY || '0.8');
    const biW = parseFloat(slide.dataset.biW || '3.2');
    const biH = parseFloat(slide.dataset.biH || '3.6');

    if (type === 'title') {
      // Full background
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      // Subtle darker lower band to ground the text (stays fully within slide)
      s.addShape(pptx.ShapeType.rect, { x:0, y:3.2, w:SW, h:2.425, fill:{ color: C.ink } });
      // Brand graphic — top-right quadrant
      if (biKey) addBrandImg(s, biKey, biX, biY, biW, biH);
      // Eyebrow
      if (slide.dataset.eyebrow)
        s.addText(slide.dataset.eyebrow.toUpperCase(), { x:.55, y:.6, w:6, h:.3, fontSize:7, color:C.orange, fontFace:FONT, bold:true, charSpacing:3, margin:0 });
      // Title — anchored in the middle-lower section, max h ensures within bounds
      s.addText(slide.dataset.title || '', { x:.55, y:1.1, w:7.6, h:1.9, fontSize:32, color:C.white, fontFace:FONT, bold:false, valign:'top', wrap:true, margin:0 });
      // Orange accent bar
      s.addShape(pptx.ShapeType.rect, { x:.55, y:3.18, w:.42, h:.05, fill:{ color: C.orange } });
      // Subtitle
      if (slide.dataset.subtitle)
        s.addText(slide.dataset.subtitle, { x:.55, y:3.35, w:7.5, h:.65, fontSize:12, color:C.ink300, fontFace:FONT, wrap:true, margin:0 });
      // Meta bottom-right (within bounds: 5.15 + 0.35 = 5.5 < 5.625)
      if (slide.dataset.meta)
        s.addText(slide.dataset.meta, { x:6.6, y:5.15, w:3.1, h:.35, fontSize:7.5, color:C.ink300, fontFace:FONT, align:'right', margin:0 });

    } else if (type === 'agenda') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addText('AGENDA', { x:.55, y:.45, w:3, h:.3, fontSize:7, color:C.orange, fontFace:FONT, bold:true, charSpacing:4, margin:0 });
      const items = JSON.parse(slide.dataset.items || '[]');
      const maxItems = Math.min(items.length, 6);
      // Dynamic spacing: distribute items evenly within the content area (1.0 to 5.3)
      const areaH = 4.3;
      const itemH = Math.min(0.85, areaH / maxItems);
      items.slice(0, maxItems).forEach((item, i) => {
        const iy = 1.05 + i * itemH;
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:iy, w:.36, h:.36, fill:{ color: C.ink }, line:{ color: C.orange, width:1 } });
        s.addText('0' + (i + 1), { x:.55, y:iy, w:.36, h:.36, fontSize:7, color:C.orange, fontFace:FONT, bold:true, align:'center', valign:'middle', margin:0 });
        s.addText(item, { x:1.08, y:iy, w:8.7, h:itemH - 0.1, fontSize:15, color:C.white, fontFace:FONT, valign:'middle', margin:0 });
        if (i < maxItems - 1)
          s.addShape(pptx.ShapeType.rect, { x:.55, y:iy + itemH - 0.06, w:9.2, h:0.008, fill:{ color:'2a2840' } });
      });

    } else if (type === 'section') {
      s.addShape(pptx.ShapeType.rect, { x:0,   y:0, w:6.2, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:6.2, y:0, w:3.8, h:SH, fill:{ color: C.orange } });
      if (slide.dataset.secnum)
        s.addText(slide.dataset.secnum.toUpperCase(), { x:.55, y:2.35, w:5.4, h:.35, fontSize:7.5, color:C.white, fontFace:FONT, bold:true, charSpacing:3, transparency:65, margin:0 });
      s.addText(slide.dataset.title || '', { x:.55, y:2.75, w:5.4, h:1.95, fontSize:26, color:C.white, fontFace:FONT, bold:false, wrap:true, margin:0 });

    } else if (type === 'content') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.55, y:.25, w:9.1, h:1.15, fontSize:22, color:C.orange, fontFace:FONT, bold:false, wrap:true, margin:0 });
      const bullets = JSON.parse(slide.dataset.bullets || '[]');
      const maxB = Math.min(bullets.length, 4);
      // Distribute bullets in the remaining content area (1.55 to 5.35)
      const bAreaH = 3.8;
      const bSpacing = Math.min(0.95, bAreaH / maxB);
      bullets.slice(0, maxB).forEach((b, i) => {
        const by = 1.55 + i * bSpacing;
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:by + .06, w:.13, h:.13, fill:{ color: C.orange } });
        s.addText(b, { x:.82, y:by, w:8.95, h:bSpacing - 0.15, fontSize:14, color:C.white, fontFace:FONT, wrap:true, margin:0 });
        if (i < maxB - 1)
          s.addShape(pptx.ShapeType.rect, { x:.55, y:by + bSpacing - 0.1, w:9.2, h:0.008, fill:{ color:'2a2840' } });
      });
      if (biKey) addBrandImg(s, biKey, biX, biY, biW, biH);
      const notesEl = slide.querySelector('.notes');
      if (notesEl) s.addNotes(notesEl.textContent.trim());

    } else if (type === 'two-col') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.55, y:.25, w:9.1, h:.9, fontSize:20, color:C.orange, fontFace:FONT, bold:false, wrap:true, margin:0 });
      const lBullets = JSON.parse(slide.dataset.leftBullets || '[]');
      const maxLB = Math.min(lBullets.length, 5);
      const lAreaH = 3.7;
      const lSpacing = Math.min(0.78, lAreaH / maxLB);
      lBullets.slice(0, maxLB).forEach((b, i) => {
        const by = 1.45 + i * lSpacing;
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:by + .06, w:.13, h:.13, fill:{ color: C.orange } });
        s.addText(b, { x:.82, y:by, w:4.55, h:lSpacing - 0.08, fontSize:13, color:C.white, fontFace:FONT, wrap:true, margin:0 });
      });
      // Right panel: brand image if available, otherwise stat cards
      if (biKey && _imgs[biKey] && _imgs[biKey].data) {
        s.addShape(pptx.ShapeType.roundRect, { x:5.6, y:1.3, w:3.9, h:3.85, fill:{ color: C.ink }, rectRadius:.08 });
        addBrandImg(s, biKey, biX, biY, biW, biH);
      } else {
        s.addShape(pptx.ShapeType.roundRect, { x:5.6, y:1.3, w:3.9, h:3.85, fill:{ color: C.ink }, rectRadius:.08 });
        const rStats = JSON.parse(slide.dataset.rightStats || '[]');
        const maxRS = Math.min(rStats.length, 2);
        rStats.slice(0, maxRS).forEach((st, i) => {
          const sy = 1.65 + i * 1.8;
          if (sy + 1.4 <= 5.15) {
            s.addText(st.value, { x:5.7, y:sy,       w:3.7, h:1.1, fontSize:38, color:C.orange, fontFace:FONT, bold:true,  align:'center', margin:0 });
            s.addText(st.label, { x:5.7, y:sy + 1.15, w:3.7, h:.4,  fontSize:10, color:C.ink300, fontFace:FONT, bold:false, align:'center', margin:0 });
          }
        });
      }

    } else if (type === 'stat') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      if (slide.dataset.title)
        s.addText(slide.dataset.title, { x:.5, y:.4, w:9.3, h:.55, fontSize:14, color:C.ink300, fontFace:FONT, align:'center', margin:0 });
      const stats = JSON.parse(slide.dataset.stats || '[]');
      const numStats = Math.min(stats.length, 4);
      const colW = SW / numStats;
      stats.slice(0, numStats).forEach((st, i) => {
        s.addText(st.value, { x:i*colW+.3, y:1.35, w:colW-.6, h:2.25, fontSize:52, color:C.orange, fontFace:FONT, bold:true,  align:'center', margin:0 });
        s.addText(st.label, { x:i*colW+.3, y:3.75, w:colW-.6, h:.95,  fontSize:11, color:C.ink300, fontFace:FONT, bold:false, align:'center', wrap:true, margin:0 });
      });

    } else if (type === 'quote') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText('"', { x:.4, y:.15, w:2, h:1.35, fontSize:72, color:C.orange, fontFace:'Georgia', bold:true, margin:0 });
      const qt = slide.querySelector('blockquote')?.textContent?.trim() || '';
      s.addText(qt, { x:.5, y:1.45, w:9.3, h:2.55, fontSize:19, color:C.white, fontFace:FONT, italic:true, align:'center', wrap:true, margin:0 });
      const cite = slide.querySelector('cite')?.textContent?.trim() || '';
      if (cite)
        s.addText('— ' + cite, { x:.5, y:4.2, w:9.3, h:.45, fontSize:10.5, color:C.orange, fontFace:FONT, bold:true, align:'center', charSpacing:2, margin:0 });

    } else if (type === 'comparison') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.45, y:.2, w:9.2, h:.9, fontSize:20, color:C.orange, fontFace:FONT, bold:false, wrap:true, margin:0 });
      const cmpHeaders = JSON.parse(slide.dataset.headers || '[]');
      const cmpRows = JSON.parse(slide.dataset.rows || '[]');
      const highlightCol = parseInt(slide.dataset.highlightCol || '1', 10);
      const colW = 9.2 / Math.max(cmpHeaders.length, 1);
      const tableData = [
        cmpHeaders.map((h, ci) => ({
          text: h,
          options: { bold:true, color: ci === highlightCol ? C.orange : C.ink300, fill:C.ink, fontFace:FONT, fontSize:9, align:'center', valign:'middle' }
        })),
        ...cmpRows.map(row => row.map((cell, ci) => ({
          text: cell === '✓' ? '✓' : cell === '✗' ? '–' : cell,
          options: {
            color: cell === '✓' ? '72C87B' : cell === '✗' ? '4a4760' : C.white,
            fill: ci === highlightCol ? '2e2a46' : C.ink700,
            fontFace: FONT, fontSize: 10, align: 'center', valign: 'middle',
            bold: cell === '✓' || cell === '✗'
          }
        })))
      ];
      if (tableData.length > 1) s.addTable(tableData, { x:.45, y:1.2, w:9.2, colW: cmpHeaders.map(() => colW), border:{ type:'solid', color:'2d2b40', pt:.5 }, rowH:.62 });

    } else if (type === 'process') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.45, y:.2, w:9.2, h:.9, fontSize:20, color:C.orange, fontFace:FONT, wrap:true, margin:0 });
      const steps = JSON.parse(slide.dataset.steps || '[]');
      const nSteps = Math.min(steps.length, 5);
      const stepW = 9.2 / nSteps;
      steps.slice(0, nSteps).forEach((st, i) => {
        const sx = .45 + i * stepW;
        const cx = sx + stepW / 2;
        // Connector line
        if (i < nSteps - 1) s.addShape(pptx.ShapeType.rect, { x:cx + .25, y:2.78, w:stepW - .5, h:.02, fill:{ color: C.orange }, transparency:55 });
        // Number bubble
        s.addShape(pptx.ShapeType.ellipse, { x:cx - .28, y:2.52, w:.55, h:.55, fill:{ color: C.orange } });
        s.addText(st.num || ('0' + (i + 1)), { x:cx - .28, y:2.52, w:.55, h:.55, fontSize:10, color:C.white, fontFace:FONT, bold:true, align:'center', valign:'middle', margin:0 });
        // Label
        s.addText(st.label || '', { x:sx, y:3.2, w:stepW, h:.45, fontSize:12, color:C.white, fontFace:FONT, bold:false, align:'center', wrap:true, margin:0 });
        // Desc
        s.addText(st.desc || '', { x:sx + .05, y:3.72, w:stepW - .1, h:.7, fontSize:9, color:C.ink300, fontFace:FONT, align:'center', wrap:true, margin:0 });
      });

    } else if (type === 'icon-grid') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.45, y:.2, w:9.2, h:.9, fontSize:20, color:C.orange, fontFace:FONT, wrap:true, margin:0 });
      const cards = JSON.parse(slide.dataset.cards || '[]');
      const cols = parseInt(slide.dataset.cols || '3', 10);
      const rows = Math.ceil(cards.slice(0, 6).length / cols);
      const cardW = (9.2 - (cols - 1) * .18) / cols;
      const cardH = (3.85 - (rows - 1) * .18) / rows;
      cards.slice(0, 6).forEach((card, i) => {
        const col = i % cols; const row = Math.floor(i / cols);
        const cx = .45 + col * (cardW + .18);
        const cy = 1.25 + row * (cardH + .18);
        s.addShape(pptx.ShapeType.roundRect, { x:cx, y:cy, w:cardW, h:cardH, fill:{ color: C.ink }, rectRadius:.06 });
        // Orange accent dot
        s.addShape(pptx.ShapeType.rect, { x:cx + .15, y:cy + cardH * .25, w:.06, h:.06, fill:{ color: C.orange } });
        s.addText(card.title || '', { x:cx + .28, y:cy + .15, w:cardW - .38, h:.38, fontSize:11, color:C.white, fontFace:FONT, bold:false, margin:0 });
        s.addText(card.desc || '', { x:cx + .15, y:cy + .55, w:cardW - .25, h:cardH - .7, fontSize:9, color:C.ink300, fontFace:FONT, wrap:true, margin:0 });
      });

    } else if (type === 'timeline') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:.05, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.45, y:.2, w:9.2, h:.9, fontSize:20, color:C.orange, fontFace:FONT, wrap:true, margin:0 });
      const milestones = JSON.parse(slide.dataset.milestones || '[]');
      const maxM = Math.min(milestones.length, 5);
      // Vertical spine
      s.addShape(pptx.ShapeType.rect, { x:.95, y:1.2, w:.02, h:SH - 1.4, fill:{ color: C.orange }, transparency:55 });
      const mSpacing = (SH - 1.55) / maxM;
      milestones.slice(0, maxM).forEach((m, i) => {
        const my = 1.25 + i * mSpacing;
        // Dot
        s.addShape(pptx.ShapeType.ellipse, { x:.78, y:my - .01, w:.18, h:.18, fill:{ color: C.orange } });
        // Date label
        s.addText(m.date || '', { x:1.25, y:my - .05, w:2.2, h:.28, fontSize:8, color:C.orange, fontFace:FONT, bold:true, charSpacing:1.5, margin:0 });
        // Title
        s.addText(m.title || '', { x:3.6, y:my - .05, w:6.2, h:.28, fontSize:12, color:C.white, fontFace:FONT, bold:false, margin:0 });
        // Body
        if (m.body) s.addText(m.body, { x:3.6, y:my + .26, w:6.2, h:.28, fontSize:9, color:C.ink300, fontFace:FONT, margin:0 });
      });

    } else if (type === 'closing') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:SW, h:SH, fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0,          w:SW, h:.05, fill:{ color: C.orange } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:SH - .05,   w:SW, h:.05, fill:{ color: C.orange } });
      // Brand graphic as subtle background watermark (large, low opacity not directly
      // available in PptxGenJS for images; embed at reduced size in corner instead)
      if (biKey && _imgs[biKey] && _imgs[biKey].data)
        addBrandImg(s, biKey, 5.8, 1.8, 3.8, 3.8);
      s.addText(slide.dataset.title || 'Thank you', { x:.5, y:1.2, w:9.3, h:2.1, fontSize:40, color:C.white, fontFace:FONT, bold:false, align:'center', margin:0 });
      s.addShape(pptx.ShapeType.rect, { x:4.66, y:3.55, w:.42, h:.05, fill:{ color: C.orange } });
      if (slide.dataset.body)
        s.addText(slide.dataset.body, { x:.5, y:3.75, w:9.3, h:.6, fontSize:13, color:C.ink300, fontFace:FONT, align:'center', margin:0 });
      if (slide.dataset.cta) {
        s.addShape(pptx.ShapeType.roundRect, { x:3.88, y:4.55, w:2.55, h:.62, rectRadius:.07, fill:{ color: C.orange } });
        s.addText(slide.dataset.cta, { x:3.88, y:4.55, w:2.55, h:.62, fontSize:12, color:C.white, fontFace:FONT, bold:true, align:'center', valign:'middle', margin:0 });
      }
    }
  });

  const slug = (document.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  await pptx.writeFile({ fileName: slug + '.pptx' });
}

// Artifact-panel download bridge — intercepts the blob URL click PptxGenJS emits
// and relays the file data to the parent frame as a base64 message.
// downloadPptx() is async, so the bridge awaits the returned Promise before cleanup.
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'artifact-download-request') return;
  if (typeof window[e.data.fn] !== 'function') return;
  var src = e.source || window.parent;
  var blobs = new Map();
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(b) { var u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
  var origClick = HTMLElement.prototype.click;
  function restore() { URL.createObjectURL = origCreate; HTMLElement.prototype.click = origClick; }
  HTMLElement.prototype.click = function() {
    if (this.tagName === 'A' && this.download && this.href && this.href.indexOf('blob:') === 0) {
      var blob = blobs.get(this.href);
      if (blob) {
        var fn = this.download; var mime = blob.type || 'application/octet-stream';
        var r = new FileReader();
        r.onload = function() { src.postMessage({ type:'artifact-download', filename:fn, data:r.result.split(',')[1], mimeType:mime }, '*'); restore(); };
        r.readAsDataURL(blob); return;
      }
    }
    origClick.call(this);
  };
  Promise.resolve(window[e.data.fn]()).catch(function(err) { console.error('[pptx bridge] error:', err); restore(); });
});
</script>
</body>
</html>
```

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

## Key Rules for Populating the Template

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

**Content**
- [ ] Ghost deck test: reading only slide titles tells the full story
- [ ] Every title is an action sentence (states the takeaway, not a topic label)
- [ ] No slide has more than 3 bullets; no bullet exceeds 10 words
- [ ] No consecutive slides use the same layout type

**Design**
- [ ] All colors are from the Whatfix palette — zero invented hex values
- [ ] No more than 3 colors used on any single slide
- [ ] Orange is used as an accent only — never as a full slide background
- [ ] No gradients not in the approved palette recipes
- [ ] Whitespace is generous: slides feel spacious, not cramped

**Typography**
- [ ] Slide headlines ≥ `clamp(1.4rem,2.6vw,2.2rem)` in HTML, ≥ 22pt in PPTX
- [ ] Body text ≥ `clamp(0.85rem,1.5vw,1.05rem)` in HTML, ≥ 14pt in PPTX
- [ ] `text-wrap: pretty` on all headings
- [ ] Sentence case throughout (no title-casing every word)

**Brand**
- [ ] Brand graphic on title slide, closing slide, and all product-specific slides
- [ ] Dark variant images on dark slides, light variants on light slides
- [ ] `data-brand-image` and `<img>` are in sync (same key)

**Technical**
- [ ] `data-*` attributes match visible HTML for every slide (PPTX export parity)
- [ ] PptxGenJS hex colors have no `#` prefix
- [ ] `downloadPptx()` is `async` and `await`s `pptx.writeFile()`
- [ ] No `pptx.addFont()` call (removed in v4)
- [ ] `prefers-reduced-motion` media query present in `<style>`
- [ ] `text-wrap: pretty` in `<style>` on `h1, h2, h3`
