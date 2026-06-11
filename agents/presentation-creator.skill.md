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
- **Load PptxGenJS from cdnjs only**: `<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js"></script>` — this is the only permitted CDN; never use jsdelivr, unpkg, or a local `/libs/` path
- **PptxGenJS hex colors NEVER use `#` prefix** — `'FF6B18'` not `'#FF6B18'` (causes file corruption)
- **Never encode opacity in hex** — use the `opacity` property instead of 8-char hex strings
- **Never reuse option objects** across PptxGenJS calls — it mutates them in-place
- Google Fonts `@import` is allowed

## Content Rules (apply before generating any slide)

1. **Action titles** — every slide title is a complete sentence stating the takeaway, not a topic label. "Onboarding time drops 40% in week one" not "Onboarding Results". Ghost deck test: reading only the titles in sequence must tell the full story.
2. **One idea per slide** — if a slide needs two conclusions, split it into two slides
3. **Max 3–4 bullets per slide, max 40 words of body text** — if the audience is reading, they are not listening
4. **Top-down structure** — key message first, supporting evidence below. Never bury the conclusion at the end
5. **Varied layouts** — never repeat the same layout on consecutive slides. Alternate between: bullets, two-column, stat callout, quote, chart, image+text
6. **Every content slide needs a visual element** — a shape, stat callout, icon row, or chart accent. No text-only content slides

## Design Rules

### Color palette (Whatfix only)
```
#25223B  Ink 700    — dark slide backgrounds, section dividers
#35324A  Ink        — card/surface backgrounds on dark slides
#FF6B18  Orange     — headlines, stat numbers, accent bars, CTAs
#8A8A9C  Ink 300    — muted text, captions, metadata
#872345  Crimson    — playbook cover, table headers
#AED2F3  Bright Blue — data / chart accent
#F9F9F2  Gray 100   — light slide backgrounds
#E5E3DC  Gray 300   — borders, dividers
#FFFFFF  White      — text on dark, light slide background
```

### Typography
- Slide title (action title): `clamp(1.6rem, 3vw, 2.4rem)` bold — left-aligned except on title/closing slides
- Body text: `clamp(0.9rem, 1.6vw, 1.1rem)` regular
- Stat callouts / big numbers: `clamp(3.5rem, 8vw, 6rem)` bold, Orange
- Captions / metadata: `0.7rem` Ink 300
- **No accent lines under titles** — use whitespace or a background color change instead (accent lines are the hallmark of AI-generated slides)

### Dark / Light Sandwich
- Title slide: dark (Ink 700)
- Section dividers: dark (Ink 700) with Orange right panel
- Content slides: dark (Ink 700) — use the `#35324A` card background for contrast blocks
- Stat slides: dark (Ink 35324A) with Orange numbers
- Closing slide: dark (Ink 700)
- Table / playbook data slides: white (`#FFFFFF`) with Crimson headers

### Layout Variety (pick appropriate type per slide)
- **`content`** — headline + 3–4 short bullets with left-edge Orange dot
- **`two-col`** — headline spans full width; below: left column text/bullets, right column visual (stat, icon row, or chart bar)
- **`stat`** — 2–3 large KPI numbers centered, each with a one-line label
- **`quote`** — large quotation mark, italic blockquote, cite attribution
- **`split`** — full-bleed left panel (dark) with text, right panel (Orange or Crimson) with accent visual
- **`chart`** — bar chart with value labels, built from inline HTML bars
- **`agenda`** — numbered list with counter bubbles
- **`section`** — gradient banner, section number, section title centered
- **`closing`** — dark, centered, CTA button

## Choosing the Right Mode

| Mode | When to use | Cover color |
|------|-------------|-------------|
| **Dark deck** (default) | Pitches, product showcases, executive presentations | Ink 700 |
| **Playbook** | POC playbooks, demo playbooks, sales playbooks | Crimson |

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
<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1728; font-family: 'DM Sans', sans-serif; }

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
  display: flex; flex-direction: column;
  justify-content: flex-end;
  padding: clamp(2.5rem,6vw,5rem) clamp(2.5rem,6vw,5.5rem) clamp(3rem,7vh,5rem);
  background: linear-gradient(150deg, #25223B 0%, #2e2b42 60%, #35324A 100%);
}
.slide.title .eyebrow {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: #FF6B18; margin-bottom: 1rem;
}
.slide.title h1 {
  font-size: clamp(2.4rem,5vw,4.2rem); font-weight: 700;
  color: #fff; line-height: 1.1; max-width: 15ch; margin-bottom: 1rem;
}
.slide.title .title-bar {
  width: 48px; height: 4px; background: #FF6B18; border-radius: 2px; margin-bottom: 1.2rem;
}
.slide.title .subtitle {
  font-size: clamp(0.95rem,1.6vw,1.15rem); font-weight: 300;
  color: rgba(255,255,255,0.5); max-width: 44ch; line-height: 1.6;
}
.slide.title .meta {
  position: absolute; bottom: clamp(1.5rem,4vh,3rem);
  right: clamp(2rem,5vw,5rem); font-size: 0.7rem; color: rgba(255,255,255,0.2);
}

/* ── AGENDA ──────────────────────────────────────── */
.slide.agenda {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,5rem);
}
.slide.agenda .label {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: #FF6B18; margin-bottom: 1.75rem;
}
.slide.agenda ol { list-style: none; counter-reset: a; }
.slide.agenda ol li {
  counter-increment: a; display: flex; align-items: center;
  gap: 1.25rem; padding: 0.7rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: clamp(0.95rem,1.8vw,1.3rem); font-weight: 400;
  color: rgba(255,255,255,0.85);
}
.slide.agenda ol li::before {
  content: counter(a,decimal-leading-zero);
  font-size: 0.7rem; font-weight: 700; color: #FF6B18;
  background: rgba(255,107,24,0.12); border: 1px solid rgba(255,107,24,0.3);
  width: 2rem; height: 2rem; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

/* ── SECTION ─────────────────────────────────────── */
.slide.section {
  display: flex; flex-direction: row;
}
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
  border: clamp(20px,3vw,40px) solid rgba(255,255,255,0.15);
  top: -25%; left: -80%;
}
.slide.section .sec-num {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 0.75rem;
}
.slide.section h2 {
  font-size: clamp(1.8rem,3.5vw,3rem); font-weight: 700;
  color: #fff; line-height: 1.15; max-width: 18ch;
}

/* ── CONTENT (bullets) ───────────────────────────── */
.slide.content {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.content h2 {
  font-size: clamp(1.4rem,2.6vw,2.2rem); font-weight: 600;
  color: #FF6B18; line-height: 1.2; margin-bottom: 2rem; max-width: 28ch;
}
.slide.content ul { list-style: none; display: flex; flex-direction: column; gap: 0.85rem; }
.slide.content ul li {
  display: flex; align-items: flex-start; gap: 1rem;
  font-size: clamp(0.88rem,1.55vw,1.08rem); font-weight: 300;
  color: rgba(255,255,255,0.85); line-height: 1.55;
  padding-bottom: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.slide.content ul li:last-child { border-bottom: none; }
.slide.content ul li .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #FF6B18; flex-shrink: 0; margin-top: 0.45rem;
}

/* ── TWO-COLUMN ──────────────────────────────────── */
.slide.two-col {
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(2rem,5vw,4.5rem);
}
.slide.two-col h2 {
  font-size: clamp(1.4rem,2.6vw,2.2rem); font-weight: 600;
  color: #FF6B18; margin-bottom: 1.75rem; max-width: 34ch;
}
.slide.two-col .cols { display: flex; gap: 3vw; align-items: flex-start; }
.slide.two-col .col-left { flex: 1.1; }
.slide.two-col .col-right {
  flex: 0.9; background: #35324A; border-radius: 8px;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem;
}
.slide.two-col ul { list-style: none; display: flex; flex-direction: column; gap: 0.8rem; }
.slide.two-col ul li {
  display: flex; align-items: flex-start; gap: 0.85rem;
  font-size: clamp(0.85rem,1.5vw,1.05rem); font-weight: 300;
  color: rgba(255,255,255,0.82); line-height: 1.5;
}
.slide.two-col ul li .dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #FF6B18; flex-shrink: 0; margin-top: 0.5rem;
}
.col-right .stat-row { display: flex; flex-direction: column; align-items: flex-start; }
.col-right .stat-row .big { font-size: clamp(2rem,4vw,3.2rem); font-weight: 700; color: #FF6B18; line-height: 1; }
.col-right .stat-row .lbl { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; }

/* ── STAT ────────────────────────────────────────── */
.slide.stat {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; background: #35324A; text-align: center;
}
.slide.stat .stat-label {
  font-size: clamp(0.9rem,1.6vw,1.2rem); font-weight: 400;
  color: rgba(255,255,255,0.4); margin-bottom: 2.5rem;
}
.kpi-grid { display: flex; gap: clamp(2.5rem,6vw,6rem); align-items: flex-end; flex-wrap: wrap; justify-content: center; }
.kpi { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
.big-num { font-size: clamp(3.2rem,8vw,6rem); font-weight: 700; color: #FF6B18; line-height: 1; letter-spacing: -0.03em; }
.kpi-lbl { font-size: clamp(0.75rem,1.3vw,0.95rem); color: rgba(255,255,255,0.5); max-width: 12ch; text-align: center; }

/* ── QUOTE ───────────────────────────────────────── */
.slide.quote {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; background: #35324A; padding: clamp(2rem,5vw,6rem);
}
.slide.quote .qmark { font-size: 6rem; color: rgba(255,107,24,0.18); line-height: 0.6; font-family: Georgia, serif; margin-bottom: 1.5rem; }
.slide.quote blockquote {
  font-size: clamp(1.05rem,1.9vw,1.55rem); font-weight: 300; font-style: italic;
  color: #fff; max-width: 680px; line-height: 1.65; text-align: center;
}
.slide.quote cite {
  display: block; margin-top: 1.75rem; font-size: 0.82rem; font-weight: 500;
  font-style: normal; color: #FF6B18; letter-spacing: 0.08em; text-transform: uppercase;
}

/* ── CLOSING ─────────────────────────────────────── */
.slide.closing {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
  background: linear-gradient(150deg, #25223B 0%, #2e2b42 100%);
}
.slide.closing h2 {
  font-size: clamp(2.2rem,4.5vw,4rem); font-weight: 700;
  color: #fff; line-height: 1.1; margin-bottom: 1rem;
}
.slide.closing .closing-bar {
  width: 48px; height: 4px; background: #FF6B18; border-radius: 2px; margin: 0 auto 1.2rem;
}
.slide.closing p { font-size: 1rem; font-weight: 300; color: rgba(255,255,255,0.5); }
.slide.closing .cta-btn {
  margin-top: 2rem; padding: 0.7rem 2.2rem; background: #FF6B18;
  color: #fff; border-radius: 6px; font-size: 0.9rem; font-weight: 600;
  display: inline-block; letter-spacing: 0.02em;
}

/* ── Chrome ───────────────────────────────────────── */
.progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.06); z-index: 100; }
.progress-fill { height: 100%; background: #FF6B18; border-radius: 0 2px 2px 0; transition: width 0.3s ease; }
.slide-counter { position: fixed; bottom: 1.25rem; right: 1.75rem; font-size: 0.65rem; font-weight: 500; color: rgba(255,255,255,0.2); z-index: 100; letter-spacing: 0.08em; }
.nav-hint { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); font-size: 0.6rem; color: rgba(255,255,255,0.12); z-index: 100; white-space: nowrap; }
.notes { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 300; background: rgba(8,6,18,0.95); color: rgba(255,255,255,0.75); padding: 1rem 3rem; font-size: 0.82rem; line-height: 1.6; border-top: 2px solid #FF6B18; }
.notes.visible { display: block; }

</style>
</head>
<body>

<div class="deck">

  <!-- ═══ TITLE — dark, bottom-anchored ═══════════ -->
  <section class="slide title active" data-type="title"
    data-title="YOUR ACTION TITLE HERE"
    data-subtitle="Supporting context — one line"
    data-eyebrow="Whatfix · Department · Month Year"
    data-meta="Prepared by Name · Month Year">
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

  <!-- ═══ TWO-COLUMN (text + stat accent) ══════════ -->
  <section class="slide two-col" data-type="two-col"
    data-headline="Two-column action title for context+data slides"
    data-left-bullets='["Key context point one","Key context point two","Key context point three"]'
    data-right-stats='[{"value":"40%","label":"Reduction in time"},{"value":"3×","label":"Faster adoption"}]'>
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
        <div class="stat-row"><span class="big">40%</span><span class="lbl">Reduction in time</span></div>
        <div class="stat-row"><span class="big">3×</span><span class="lbl">Faster adoption</span></div>
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

  <!-- ═══ CLOSING ═══════════════════════════════════ -->
  <section class="slide closing" data-type="closing"
    data-title="Thank you"
    data-body="Next step or closing thought."
    data-cta="Get in touch">
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
};
const FONT = 'Lato';

function downloadPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title  = document.title;
  pptx.author = 'Whatfix';

  slides.forEach(slide => {
    const type = slide.dataset.type;
    const s = pptx.addSlide();

    if (type === 'title') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:5.2, w:'100%', h:2.4, fill:{ color: C.ink } });
      if (slide.dataset.eyebrow)
        s.addText(slide.dataset.eyebrow.toUpperCase(), { x:.55, y:.5, w:9, h:.3, fontSize:7, color:C.orange, fontFace:FONT, bold:true, charSpacing:3 , margin:0});
      s.addText(slide.dataset.title || '', { x:.55, y:1, w:8.5, h:2.8, fontSize:36, color:C.white, fontFace:FONT, bold:true, valign:'top' , margin:0});
      s.addShape(pptx.ShapeType.rect, { x:.55, y:3.95, w:.5, h:.055, fill:{ color: C.orange } });
      if (slide.dataset.subtitle)
        s.addText(slide.dataset.subtitle, { x:.55, y:4.15, w:9, h:.8, fontSize:13, color:C.ink300, fontFace:FONT , margin:0});
      if (slide.dataset.meta)
        s.addText(slide.dataset.meta, { x:7, y:5.2, w:3, h:.35, fontSize:8, color:C.ink300, fontFace:FONT, align:'right' , margin:0});

    } else if (type === 'agenda') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink700 } });
      s.addText('AGENDA', { x:.55, y:.45, w:3, h:.3, fontSize:7, color:C.orange, fontFace:FONT, bold:true, charSpacing:4 , margin:0});
      const items = JSON.parse(slide.dataset.items || '[]');
      items.forEach((item, i) => {
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:1.25 + i*.85, w:.38, h:.38, fill:{ color: C.ink }, line:{ color: C.orange, width:1 } });
        s.addText(`0${i+1}`, { x:.55, y:1.25 + i*.85, w:.38, h:.38, fontSize:7.5, color:C.orange, fontFace:FONT, bold:true, align:'center', valign:'middle' , margin:0});
        s.addText(item, { x:1.1, y:1.25 + i*.85, w:8.7, h:.38, fontSize:16, color:C.white, fontFace:FONT, valign:'middle' , margin:0});
        s.addShape(pptx.ShapeType.line, { x:.55, y:1.7 + i*.85, w:9.2, h:0, line:{ color:'2a2840', width:.5 } });
      });

    } else if (type === 'section') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:6.2, h:'100%', fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:6.2, y:0, w:3.8, h:'100%', fill:{ color: C.orange } });
      if (slide.dataset.secnum)
        s.addText(slide.dataset.secnum.toUpperCase(), { x:.55, y:2.3, w:5.4, h:.35, fontSize:7.5, color:C.white, fontFace:FONT, bold:true, charSpacing:3, transparency:65 , margin:0});
      s.addText(slide.dataset.title || '', { x:.55, y:2.7, w:5.4, h:2, fontSize:26, color:C.white, fontFace:FONT, bold:true , margin:0});

    } else if (type === 'content') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.055, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.55, y:.3, w:9, h:1.2, fontSize:24, color:C.orange, fontFace:FONT, bold:true , margin:0});
      const bullets = JSON.parse(slide.dataset.bullets || '[]');
      bullets.forEach((b, i) => {
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:1.85 + i*.95 + .05, w:.1, h:.1, fill:{ color: C.orange } });
        s.addText(b, { x:.8, y:1.8 + i*.95, w:9, h:.65, fontSize:15, color:C.white, fontFace:FONT , margin:0});
        if (i < bullets.length - 1)
          s.addShape(pptx.ShapeType.line, { x:.55, y:2.5 + i*.95, w:8.9, h:0, line:{ color:'2a2840', width:.4 } });
      });
      const notesEl = slide.querySelector('.notes');
      if (notesEl) s.addNotes(notesEl.textContent.trim());

    } else if (type === 'two-col') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.055, fill:{ color: C.orange } });
      s.addText(slide.dataset.headline || '', { x:.55, y:.3, w:9, h:.9, fontSize:22, color:C.orange, fontFace:FONT, bold:true , margin:0});
      const lBullets = JSON.parse(slide.dataset.leftBullets || '[]');
      lBullets.forEach((b, i) => {
        s.addShape(pptx.ShapeType.ellipse, { x:.55, y:1.6 + i*.75 + .05, w:.1, h:.1, fill:{ color: C.orange } });
        s.addText(b, { x:.8, y:1.55 + i*.75, w:4.5, h:.6, fontSize:14, color:C.white, fontFace:FONT , margin:0});
      });
      s.addShape(pptx.ShapeType.rect, { x:5.6, y:1.4, w:3.85, h:3.8, fill:{ color: C.ink }, rectRadius:.06 });
      const rStats = JSON.parse(slide.dataset.rightStats || '[]');
      rStats.forEach((st, i) => {
        s.addText(st.value, { x:5.7, y:1.65 + i*1.75, w:3.65, h:1.1, fontSize:42, color:C.orange, fontFace:FONT, bold:true, align:'center' , margin:0});
        s.addText(st.label, { x:5.7, y:2.85 + i*1.75, w:3.65, h:.4, fontSize:11, color:C.ink300, fontFace:FONT, align:'center' , margin:0});
      });

    } else if (type === 'stat') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.055, fill:{ color: C.orange } });
      if (slide.dataset.title)
        s.addText(slide.dataset.title, { x:.5, y:.45, w:9.3, h:.55, fontSize:16, color:C.ink300, fontFace:FONT, align:'center' , margin:0});
      const stats = JSON.parse(slide.dataset.stats || '[]');
      const colW = 10 / stats.length;
      stats.forEach((st, i) => {
        s.addText(st.value, { x:i*colW+.3, y:1.4, w:colW-.6, h:2.3, fontSize:56, color:C.orange, fontFace:FONT, bold:true, align:'center' , margin:0});
        s.addText(st.label, { x:i*colW+.3, y:3.9, w:colW-.6, h:.9, fontSize:12, color:C.ink300, fontFace:FONT, align:'center', wrap:true , margin:0});
      });

    } else if (type === 'quote') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.055, fill:{ color: C.orange } });
      s.addText('“', { x:.4, y:.2, w:2, h:1.4, fontSize:72, color:C.orange, fontFace:'Georgia', bold:true , margin:0});
      const qt = slide.querySelector('blockquote')?.textContent?.trim() || '';
      s.addText(qt, { x:.5, y:1.5, w:9.3, h:2.6, fontSize:20, color:C.white, fontFace:FONT, italic:true, align:'center', wrap:true , margin:0});
      const cite = slide.querySelector('cite')?.textContent?.trim() || '';
      if (cite)
        s.addText('— ' + cite, { x:.5, y:4.3, w:9.3, h:.45, fontSize:11, color:C.orange, fontFace:FONT, bold:true, align:'center', charSpacing:2 , margin:0});

    } else if (type === 'closing') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: C.ink700 } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.055, fill:{ color: C.orange } });
      s.addShape(pptx.ShapeType.rect, { x:0, y:5.57, w:'100%', h:.055, fill:{ color: C.orange } });
      s.addText(slide.dataset.title || 'Thank you', { x:.5, y:1.3, w:9.3, h:2.2, fontSize:42, color:C.white, fontFace:FONT, bold:true, align:'center' , margin:0});
      s.addShape(pptx.ShapeType.rect, { x:4.65, y:3.65, w:.5, h:.05, fill:{ color: C.orange } });
      if (slide.dataset.body)
        s.addText(slide.dataset.body, { x:.5, y:3.9, w:9.3, h:.6, fontSize:14, color:C.ink300, fontFace:FONT, align:'center' , margin:0});
      if (slide.dataset.cta) {
        s.addShape(pptx.ShapeType.roundRect, { x:3.9, y:4.7, w:2.5, h:.6, rectRadius:.07, fill:{ color: C.orange } });
        s.addText(slide.dataset.cta, { x:3.9, y:4.7, w:2.5, h:.6, fontSize:12, color:C.white, fontFace:FONT, bold:true, align:'center', valign:'middle' , margin:0});
      }
    }
  });

  const slug = (document.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  pptx.writeFile({ fileName: slug + '.pptx' });
}

// Artifact-panel download bridge — receives a trigger from the panel header,
// installs a one-shot blob interceptor around the named function, captures the
// generated file, and postMessages the binary back to the parent window.
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'artifact-download-request') return;
  if (typeof window[e.data.fn] !== 'function') return;
  var src = e.source || window.parent;
  var blobs = new Map();
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(b) { var u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
  var origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function() {
    if (this.tagName === 'A' && this.download && this.href && this.href.indexOf('blob:') === 0) {
      var blob = blobs.get(this.href);
      if (blob) {
        var fn = this.download; var mime = blob.type || 'application/octet-stream';
        var r = new FileReader();
        r.onload = function() { src.postMessage({ type:'artifact-download', filename:fn, data:r.result.split(',')[1], mimeType:mime }, '*'); URL.createObjectURL = origCreate; HTMLElement.prototype.click = origClick; };
        r.readAsDataURL(blob); return;
      }
    }
    origClick.call(this);
  };
  try { window[e.data.fn](); } catch(err) { URL.createObjectURL = origCreate; HTMLElement.prototype.click = origClick; }
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
}
.slide.cover .right::before {
  content: ''; position: absolute; width: 160%; height: 160%; border-radius: 50%;
  border: clamp(20px,4vw,48px) solid rgba(255,255,255,0.18); top: -30%; left: -85%;
}
.slide.cover .right::after {
  content: ''; position: absolute; width: 110%; height: 110%; border-radius: 50%;
  border: clamp(14px,2.5vw,32px) solid rgba(255,255,255,0.28); top: -5%; left: -55%;
}
.cover-arc3 { position: absolute; width: 68%; height: 68%; border-radius: 50%; border: clamp(10px,1.8vw,22px) solid rgba(255,255,255,0.35); top: 16%; left: -30%; }
.slide.cover .tagline { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 1.75rem; }
.slide.cover h1 { font-size: clamp(1.6rem,3.2vw,3rem); font-weight: 700; color: #fff; line-height: 1.15; max-width: 18ch; margin-bottom: 0.75rem; }
.slide.cover .doc-type { font-size: clamp(0.85rem,1.4vw,1.05rem); font-weight: 300; color: rgba(255,255,255,0.6); margin-bottom: 2.5rem; }
.logo-row { display: flex; align-items: center; gap: 1.25rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.18); }
.wf-wordmark { font-size: 0.95rem; font-weight: 800; color: #fff; }
.customer-badge { font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.85); padding-left: 1.25rem; border-left: 1px solid rgba(255,255,255,0.2); }
.disclaimer-cover { position: absolute; bottom: 0.5rem; left: 0; right: 0; font-size: 0.48rem; color: rgba(255,255,255,0.22); padding: 0 clamp(2rem,5vw,4.5rem); text-align: center; font-style: italic; }

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
.slide.section-div .sec-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 0.75rem; }
.slide.section-div h2 { font-size: clamp(1.6rem,3vw,2.8rem); font-weight: 700; color: #fff; line-height: 1.15; max-width: 16ch; }
.sd-badge { position: relative; z-index: 1; font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.6); }

/* ── PLAYBOOK: TABLE SLIDE ────────────────────────────── */
.slide.table-slide { flex-direction: column; background: #fff; display: flex; }
.ts-header { flex-shrink: 0; padding: 1.4rem clamp(1.5rem,4vw,3rem) 0.85rem; border-bottom: 2px solid #E5E3DC; display: flex; align-items: center; justify-content: space-between; }
.ts-header h2 { font-size: clamp(1rem,1.8vw,1.55rem); font-weight: 700; color: #872345; }
.ts-wf { font-size: 0.62rem; font-weight: 800; color: #872345; }
.ts-body { flex: 1; overflow: auto; padding: 0.6rem clamp(1.5rem,4vw,3rem) 0; }
table.ptable { width: 100%; border-collapse: collapse; font-size: clamp(0.65rem,1.1vw,0.85rem); }
table.ptable thead tr { background: #872345; }
table.ptable thead th { padding: 0.6rem 0.85rem; font-weight: 600; color: #fff; text-align: left; border-right: 1px solid rgba(255,255,255,0.12); }
table.ptable thead th:last-child { border-right: none; }
table.ptable tbody tr:nth-child(even) { background: #F9F9F2; }
table.ptable tbody tr:nth-child(odd)  { background: #fff; }
table.ptable tbody td { padding: 0.55rem 0.85rem; color: #35324A; border-bottom: 1px solid #E5E3DC; border-right: 1px solid #E5E3DC; vertical-align: middle; line-height: 1.45; }
table.ptable tbody td:last-child { border-right: none; }
table.ptable tbody td strong { font-weight: 600; color: #25223B; }
.badge { display: inline-block; padding: 0.18rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.badge.complete   { background: #D4EDDA; color: #166534; }
.badge.pending    { background: #FEF3C7; color: #92400E; }
.badge.inprogress { background: #DBEAFE; color: #1E40AF; }
.badge.present    { background: #FFE9DC; color: #C2410C; border: 1px solid rgba(255,107,24,0.25); }
.badge.notpresent { background: #F9F9F2; color: #8A8A9C; border: 1px solid #E5E3DC; }
.ts-disclaimer { flex-shrink: 0; padding: 0.35rem clamp(1.5rem,4vw,3rem); font-size: 0.52rem; color: #8A8A9C; border-top: 1px solid #E5E3DC; font-style: italic; }
.slide-counter.dark-text  { color: rgba(0,0,0,0.22); }
.slide-counter.light-text { color: rgba(255,255,255,0.22); }
```

### Playbook Slide Types

**Cover** — `data-type="cover"`:
```html
<section class="slide cover active" data-type="cover"
  data-title="Proof of Concept Playbook"
  data-doc-type="Proof of Concept Playbook"
  data-customer="Customer Name"
  data-tagline="Drive Digital Adoption">
  <div class="left">
    <p class="tagline">Drive Digital Adoption</p>
    <h1>Proof of Concept Playbook</h1>
    <p class="doc-type">Proof of Concept Playbook</p>
    <div class="logo-row">
      <span class="wf-wordmark">Whatfix</span>
      <span class="customer-badge">Customer Name</span>
    </div>
  </div>
  <div class="right"><div class="cover-arc3"></div></div>
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
  s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:5.8, h:'100%', fill:{ color:'872345' } });
  s.addShape(pptx.ShapeType.rect, { x:5.8, y:0, w:4.2, h:'100%', fill:{ color:'FF6B18' } });
  s.addShape(pptx.ShapeType.ellipse, { x:3.5, y:-1.5, w:8, h:8, line:{ color:'FFFFFF', width:1.5, transparency:75 }, fill:{ type:'none' } });
  s.addText((slide.dataset.tagline||'').toUpperCase(), { x:.5,y:.55,w:5,h:.3,fontSize:7,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:3,transparency:55 , margin:0});
  s.addText(slide.dataset.title||'', { x:.5,y:3.0,w:5,h:1.8,fontSize:26,color:'FFFFFF',fontFace:FONT,bold:true,valign:'top' , margin:0});
  s.addText(slide.dataset.docType||'', { x:.5,y:4.95,w:4.8,h:.45,fontSize:11,color:'FFFFFF',fontFace:FONT,transparency:38 , margin:0});
  s.addShape(pptx.ShapeType.rect, { x:.5,y:5.55,w:5,h:.02,fill:{ color:'FFFFFF' },transparency:80 });
  s.addText('Whatfix', { x:.5,y:5.72,w:1.8,h:.35,fontSize:11,color:'FFFFFF',fontFace:FONT,bold:true , margin:0});
  if (slide.dataset.customer) s.addText(slide.dataset.customer, { x:2.55,y:5.72,w:3,h:.35,fontSize:11,color:'FFFFFF',fontFace:FONT , margin:0});
  s.addText(DISCLAIMER_TEXT, { x:0,y:5.38,w:10,h:.2,fontSize:5,color:'FFFFFF',fontFace:FONT,align:'center',transparency:72 , margin:0});

} else if (type === 'section-div') {
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:5.8,h:'100%',fill:{ color:'25223B' } });
  s.addShape(pptx.ShapeType.rect, { x:5.8,y:0,w:4.2,h:'100%',fill:{ color:'FF6B18' } });
  if (slide.dataset.secLabel)
    s.addText(slide.dataset.secLabel.toUpperCase(), { x:.5,y:2.6,w:5,h:.3,fontSize:7,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:4,transparency:70 , margin:0});
  s.addText(slide.dataset.title||'', { x:.5,y:3.0,w:5,h:1.8,fontSize:24,color:'FFFFFF',fontFace:FONT,bold:true , margin:0});

} else if (type === 'table' || type === 'success-metrics') {
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:'100%',h:'100%',fill:{ color:'FFFFFF' } });
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:'100%',h:.05,fill:{ color:'872345' } });
  s.addText(slide.dataset.title||'', { x:.4,y:.2,w:9.2,h:.65,fontSize:18,color:'872345',fontFace:FONT,bold:true , margin:0});
  s.addText('Whatfix', { x:8.5,y:.25,w:1.3,h:.35,fontSize:8,color:'872345',fontFace:FONT,bold:true,align:'right' , margin:0});
  s.addShape(pptx.ShapeType.line, { x:.4,y:1.0,w:9.2,h:0,line:{ color:'E5E3DC',width:.5 } });
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
    if (tableData.length > 1) s.addTable(tableData, { x:.4,y:1.1,w:9.2,colW:colWs,border:{ type:'solid',color:'E5E3DC',pt:.4 },rowH:.65 });
  }
  s.addText(DISCLAIMER_TEXT, { x:.4,y:5.35,w:9.2,h:.2,fontSize:5,color:'8A8A9C',fontFace:FONT,italic:true , margin:0});
}
```

### Typical playbook structure
1. Cover — title + customer name
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

## After Generating

1. Add more slides or adjust layout types?
2. Switch between dark deck and playbook format?
3. Add speaker notes to specific slides?
