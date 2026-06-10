---
name: presentation-creator
description: Use when the user asks for a presentation, slides, slide deck, pitch deck, POC playbook, demo playbook, proof of concept deck, sales playbook, or engagement playbook. Generates an interactive HTML artifact rendered inline with a one-click PPTX download — no code execution or API keys required.
user-invocable: true
allowed-tools: ["artifacts", "file_search"]
---

# Presentation Creator Skill

Generate a single complete self-contained HTML artifact that:
1. **Renders as interactive professional slides** in the side panel
2. **Includes a "Download PPTX" button** that generates a real `.pptx` file client-side using PptxGenJS — no server, no code execution, no API key needed

## CRITICAL Rules

- **NO EMOJIS** — ever. Use inline SVG icons or Unicode symbols (→ ● ◆ ▸) only
- **NO local file paths** — use `file_search` to read SVG brand assets and paste the XML inline
- **ALL colors from Whatfix palette only** — zero invented hex values
- **Layout must look like PowerPoint slides** — fixed 16:9 viewport, `position:absolute` full-bleed, not a scrolling webpage
- Google Fonts `@import` is allowed. PptxGenJS is served locally at `/libs/pptxgen.bundle.js` — use that path, never a CDN URL

## Choosing the Right Mode

There are **two visual modes**. Select based on the request:

| Mode | When to use | Key visual |
|------|-------------|------------|
| **Dark deck** (default) | Pitches, product showcases, executive presentations, keynotes | Ink 700 (#25223B) bg, Orange accents |
| **Playbook** | POC playbooks, demo playbooks, sales playbooks, proof of concept decks, engagement guides | Crimson (#872345) cover, white table slides, Orange split panels |

## Brand Colors (these exact values only)

```
#25223B  Ink 700    — dark deck slide bg, playbook section divider left panel
#35324A  Ink        — surface / card backgrounds
#FF6B18  Orange     — accent: headlines, stat numbers, CTAs, split right panels
#8A8A9C  Ink 300    — muted text, captions, disclaimer text
#872345  Crimson    — playbook cover bg, playbook table headers, section headings on white
#AED2F3  Bright Blue — data viz
#F9F9F2  Gray 100   — light bg, alternating table rows
#E5E3DC  Gray 300   — borders, table dividers
#FFFFFF  White      — text on dark, table slide background
```

## Full HTML Template

Replace ALL_CAPS placeholders with real content. The slide data array at the bottom drives both the HTML rendering and the PPTX export — **keep them in sync**.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRESENTATION_TITLE</title>
<script src="/libs/pptxgen.bundle.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #25223B; font-family: 'DM Sans', sans-serif; }

/* ── Deck ─────────────────────────────────────────── */
.deck { width: 100vw; height: 100vh; position: relative; overflow: hidden; }

/* ── Slides ───────────────────────────────────────── */
.slide {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  justify-content: center; align-items: flex-start;
  padding: clamp(2.5rem, 6vw, 6rem); background: #25223B;
  opacity: 0; transform: translateX(80px);
  transition: opacity 0.35s ease, transform 0.35s ease;
  pointer-events: none; will-change: transform, opacity;
}
.slide.active  { opacity: 1; transform: translateX(0); pointer-events: all; }
.slide.exit    { opacity: 0; transform: translateX(-80px); }

/* TITLE */
.slide.title {
  background: linear-gradient(145deg, #25223B 0%, #35324A 100%);
  justify-content: flex-end; padding-bottom: clamp(3rem, 8vh, 6rem);
}
.slide.title .eyebrow { font-size: .8rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #FF6B18; margin-bottom: .75rem; }
.slide.title h1 { font-size: clamp(2.8rem, 5.5vw, 5rem); font-weight: 700; color: #fff; line-height: 1.1; max-width: 14ch; }
.slide.title .bar { width: 56px; height: 4px; background: #FF6B18; border-radius: 2px; margin: 1.25rem 0; }
.slide.title .subtitle { font-size: 1.05rem; font-weight: 300; color: rgba(255,255,255,.55); max-width: 48ch; }
.slide.title .meta { position: absolute; bottom: clamp(1.5rem,4vh,3rem); right: clamp(2rem,5vw,5rem); font-size: .75rem; color: rgba(255,255,255,.25); }

/* AGENDA */
.slide.agenda { background: #25223B; }
.slide.agenda .label { font-size: .75rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #FF6B18; margin-bottom: 2rem; }
.slide.agenda ol { list-style: none; counter-reset: a; display: flex; flex-direction: column; gap: .9rem; }
.slide.agenda ol li { counter-increment: a; display: flex; align-items: center; gap: 1.25rem; font-size: clamp(1rem,2vw,1.4rem); font-weight: 400; color: rgba(255,255,255,.85); }
.slide.agenda ol li::before { content: counter(a,decimal-leading-zero); font-size: .75rem; font-weight: 700; color: #FF6B18; background: rgba(255,107,24,.1); border: 1px solid rgba(255,107,24,.3); width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* SECTION */
.slide.section { background: linear-gradient(135deg,#FF6B18 0%,#872345 100%); align-items: center; text-align: center; justify-content: center; }
.slide.section .sec-num { font-size: .8rem; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.6); margin-bottom: 1.25rem; }
.slide.section h2 { font-size: clamp(2.5rem,5vw,4.5rem); font-weight: 700; color: #fff; line-height: 1.1; max-width: 18ch; }

/* CONTENT */
.slide.content::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:#FF6B18; }
.slide.content h2 { font-size: clamp(1.6rem,3vw,2.8rem); font-weight: 600; color: #FF6B18; line-height: 1.2; margin-bottom: 2.25rem; max-width: 22ch; }
.slide.content ul { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.slide.content ul li { display: flex; align-items: flex-start; gap: 1rem; font-size: clamp(.9rem,1.6vw,1.15rem); font-weight: 300; color: rgba(255,255,255,.85); line-height: 1.5; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.06); }
.slide.content ul li:last-child { border-bottom: none; }
.slide.content ul li .dot { width: 6px; height: 6px; border-radius: 50%; background: #FF6B18; flex-shrink: 0; margin-top: .5rem; }

/* STAT */
.slide.stat { background: #35324A; align-items: center; justify-content: center; text-align: center; flex-direction: column; }
.slide.stat .stat-title { font-size: clamp(1rem,2vw,1.5rem); font-weight: 400; color: rgba(255,255,255,.45); margin-bottom: 2.5rem; }
.kpi-grid { display: flex; gap: clamp(2rem,5vw,5rem); align-items: flex-end; justify-content: center; flex-wrap: wrap; }
.kpi { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
.big-num { font-size: clamp(3.5rem,9vw,7rem); font-weight: 700; color: #FF6B18; line-height: 1; letter-spacing: -.03em; }
.kpi-lbl { font-size: clamp(.8rem,1.4vw,1rem); font-weight: 400; color: rgba(255,255,255,.55); max-width: 14ch; text-align: center; }

/* QUOTE */
.slide.quote { background: #35324A; align-items: center; justify-content: center; text-align: center; }
.slide.quote .qmark { font-size: 5rem; color: rgba(255,107,24,.2); line-height: .6; font-family: Georgia,serif; margin-bottom: 1.25rem; }
.slide.quote blockquote { font-size: clamp(1.1rem,2vw,1.7rem); font-weight: 300; font-style: italic; color: #fff; max-width: 680px; line-height: 1.65; }
.slide.quote cite { display: block; margin-top: 1.75rem; font-size: .85rem; font-weight: 500; font-style: normal; color: #FF6B18; letter-spacing: .06em; text-transform: uppercase; }

/* SPLIT */
.slide.split { flex-direction: row; gap: 4vw; align-items: stretch; padding: clamp(2rem,5vw,5rem); }
.slide.split .col { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.slide.split .divider { width: 1px; background: rgba(255,255,255,.08); flex-shrink: 0; }
.slide.split h2 { font-size: clamp(1.3rem,2.5vw,2.1rem); font-weight: 600; color: #FF6B18; margin-bottom: 1.25rem; line-height: 1.2; }
.slide.split p, .slide.split li { font-size: clamp(.85rem,1.5vw,1.05rem); font-weight: 300; color: rgba(255,255,255,.8); line-height: 1.6; }

/* CHART */
.slide.chart { background: #25223B; }
.slide.chart::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:#FF6B18; }
.slide.chart h2 { font-size: clamp(1.4rem,2.5vw,2.2rem); font-weight: 600; color: #FF6B18; margin-bottom: 2.25rem; }
.bar-chart { display: flex; align-items: flex-end; gap: 1.25rem; height: 220px; }
.bar-group { display: flex; flex-direction: column; align-items: center; gap: .4rem; flex: 1; }
.bar { width: 100%; border-radius: 4px 4px 0 0; background: linear-gradient(180deg,#FF6B18 0%,rgba(255,107,24,.35) 100%); }
.bar-val { font-size: .8rem; font-weight: 700; color: #FF6B18; }
.bar-lbl { font-size: .7rem; color: rgba(255,255,255,.45); text-align: center; }

/* CLOSING */
.slide.closing { background: linear-gradient(145deg,#25223B 0%,#35324A 100%); align-items: center; text-align: center; justify-content: center; }
.slide.closing h2 { font-size: clamp(2.5rem,5vw,4.5rem); font-weight: 700; color: #fff; line-height: 1.1; margin-bottom: 1.25rem; }
.slide.closing .bar { width: 56px; height: 4px; background: #FF6B18; border-radius: 2px; margin: 0 auto 1.25rem; }
.slide.closing p { font-size: 1.05rem; font-weight: 300; color: rgba(255,255,255,.55); }
.slide.closing .cta-btn { margin-top: 2.25rem; padding: .75rem 2.25rem; background: #FF6B18; color: #fff; border-radius: 6px; font-size: .95rem; font-weight: 500; display: inline-block; }

/* ── Chrome ───────────────────────────────────────── */
.progress-bar { position:fixed; top:0; left:0; right:0; height:3px; background:rgba(255,255,255,.06); z-index:100; }
.progress-fill { height:100%; background:#FF6B18; border-radius:0 2px 2px 0; transition:width .35s ease; }
.slide-counter { position:fixed; bottom:1.25rem; right:1.75rem; font-size:.7rem; font-weight:500; color:rgba(255,255,255,.22); z-index:100; letter-spacing:.08em; }
.nav-hint { position:fixed; bottom:1.25rem; left:50%; transform:translateX(-50%); font-size:.65rem; color:rgba(255,255,255,.14); z-index:100; white-space:nowrap; }

/* ── Download button ──────────────────────────────── */
.dl-btn {
  position: fixed; top: 1rem; right: 1rem; z-index: 200;
  display: flex; align-items: center; gap: .5rem;
  padding: .45rem 1rem; background: rgba(255,107,24,.12);
  border: 1px solid rgba(255,107,24,.35); border-radius: 6px;
  color: #FF6B18; font-size: .75rem; font-weight: 500;
  font-family: 'DM Sans', sans-serif; cursor: pointer;
  transition: background .2s ease;
}
.dl-btn:hover { background: rgba(255,107,24,.22); }
.dl-btn svg { width: 14px; height: 14px; }

/* ── Speaker notes ────────────────────────────────── */
.notes { display:none; position:fixed; bottom:0; left:0; right:0; z-index:300; background:rgba(8,6,18,.95); color:rgba(255,255,255,.75); padding:1.1rem 3rem; font-size:.85rem; line-height:1.6; border-top:2px solid #FF6B18; }
.notes.visible { display:block; }
</style>
</head>
<body>

<div class="deck">

  <!-- ═══ TITLE ════════════════════════════════════ -->
  <section class="slide title active" data-type="title"
    data-title="PRESENTATION TITLE"
    data-subtitle="Supporting subtitle or context"
    data-eyebrow="Whatfix · Department · June 2026"
    data-meta="Prepared by Name · June 2026">
    <p class="eyebrow">Whatfix · Department · June 2026</p>
    <h1>Presentation Title</h1>
    <div class="bar"></div>
    <p class="subtitle">Supporting subtitle or context line here.</p>
    <div class="meta">Prepared by Name · June 2026</div>
  </section>

  <!-- ═══ AGENDA ═══════════════════════════════════ -->
  <section class="slide agenda" data-type="agenda"
    data-items='["First section topic","Second section topic","Third section topic","Closing and next steps"]'>
    <p class="label">Agenda</p>
    <ol>
      <li>First section topic</li>
      <li>Second section topic</li>
      <li>Third section topic</li>
      <li>Closing and next steps</li>
    </ol>
  </section>

  <!-- ═══ SECTION ══════════════════════════════════ -->
  <section class="slide section" data-type="section"
    data-secnum="Section 01" data-title="First Section Title">
    <p class="sec-num">Section 01</p>
    <h2>First Section Title</h2>
  </section>

  <!-- ═══ CONTENT ══════════════════════════════════ -->
  <section class="slide content" data-type="content"
    data-headline="Slide headline in sentence case"
    data-bullets='["First key point — keep to ten words maximum","Second key point — one sentence, outcome-oriented","Third key point — no more than three bullets"]'>
    <h2>Slide headline in sentence case</h2>
    <ul>
      <li><span class="dot"></span>First key point — keep to ten words maximum</li>
      <li><span class="dot"></span>Second key point — one sentence, outcome-oriented</li>
      <li><span class="dot"></span>Third key point — no more than three bullets</li>
    </ul>
    <div class="notes">Speaker notes go here.</div>
  </section>

  <!-- ═══ STAT ══════════════════════════════════════ -->
  <section class="slide stat" data-type="stat"
    data-title="Impact at a glance"
    data-stats='[{"value":"40%","label":"Reduction in onboarding time"},{"value":"3x","label":"Faster software adoption"},{"value":"92%","label":"User satisfaction score"}]'>
    <p class="stat-title">Impact at a glance</p>
    <div class="kpi-grid">
      <div class="kpi"><span class="big-num">40%</span><span class="kpi-lbl">Reduction in onboarding time</span></div>
      <div class="kpi"><span class="big-num">3x</span><span class="kpi-lbl">Faster software adoption</span></div>
      <div class="kpi"><span class="big-num">92%</span><span class="kpi-lbl">User satisfaction score</span></div>
    </div>
  </section>

  <!-- ═══ CLOSING ═══════════════════════════════════ -->
  <section class="slide closing" data-type="closing"
    data-title="Thank you"
    data-body="Next step or closing thought."
    data-cta="Get in touch">
    <h2>Thank you</h2>
    <div class="bar"></div>
    <p>Next step or closing thought.</p>
    <span class="cta-btn">Get in touch</span>
  </section>

</div>

<!-- Chrome -->
<div class="progress-bar"><div class="progress-fill" id="pf"></div></div>
<div class="slide-counter" id="sc">1 / 6</div>
<div class="nav-hint">&#8592; &#8594; navigate &nbsp;&#183;&nbsp; F fullscreen &nbsp;&#183;&nbsp; N notes</div>

<!-- Download PPTX button -->
<button class="dl-btn" onclick="downloadPptx()">
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
  </svg>
  Download PPTX
</button>

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
  setTimeout(() => slides[prev].classList.remove('exit'), 380);
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
  if (e.target.closest('.dl-btn')) return;
  go(e.clientX / window.innerWidth > 0.5 ? cur + 1 : cur - 1);
});
go(0);

// ── PPTX Export ───────────────────────────────────────────────────────────
// Whatfix brand colors (no leading #)
const C = {
  ink700:   '25223B',
  ink:      '35324A',
  orange:   'FF6B18',
  ink300:   '8A8A9C',
  crimson:  '872345',
  white:    'FFFFFF',
};
const FONT = 'Calibri'; // closest system font to DM Sans

function downloadPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';          // 13.33" × 7.5"  16:9
  pptx.title  = document.title;
  pptx.author = 'Whatfix';

  slides.forEach(slide => {
    const type  = slide.dataset.type;
    const s     = pptx.addSlide();

    if (type === 'title') {
      // Background gradient approximation
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink700} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:5.5, w:'100%', h:2, fill:{color: C.ink} });
      // Eyebrow
      if (slide.dataset.eyebrow)
        s.addText(slide.dataset.eyebrow.toUpperCase(), { x:.5, y:.4, w:12, h:.35, fontSize:8, color:C.orange, fontFace:FONT, bold:true, charSpacing:3 });
      // Title
      s.addText(slide.dataset.title || '', { x:.5, y:.9, w:11, h:2.8, fontSize:38, color:C.white, fontFace:FONT, bold:true, valign:'top' });
      // Orange bar
      s.addShape(pptx.ShapeType.rect, { x:.5, y:3.85, w:.55, h:.06, fill:{color:C.orange} });
      // Subtitle
      if (slide.dataset.subtitle)
        s.addText(slide.dataset.subtitle, { x:.5, y:4.05, w:10, h:.9, fontSize:14, color:C.ink300, fontFace:FONT });
      // Meta
      if (slide.dataset.meta)
        s.addText(slide.dataset.meta, { x:9, y:7.1, w:4.1, h:.3, fontSize:8, color:C.ink300, fontFace:FONT, align:'right' });

    } else if (type === 'agenda') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink700} });
      s.addText('AGENDA', { x:.5, y:.45, w:3, h:.35, fontSize:8, color:C.orange, fontFace:FONT, bold:true, charSpacing:4 });
      const items = JSON.parse(slide.dataset.items || '[]');
      items.forEach((item, i) => {
        s.addText(`0${i+1}`, { x:.5, y:1.3 + i * .9, w:.5, h:.5, fontSize:9, color:C.orange, fontFace:FONT, bold:true, align:'center' });
        s.addText(item, { x:1.2, y:1.3 + i * .9, w:11, h:.5, fontSize:18, color:C.white, fontFace:FONT });
      });

    } else if (type === 'section') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.orange} });
      s.addShape(pptx.ShapeType.rect, { x:6.667, y:0, w:6.666, h:'100%', fill:{color: C.crimson} });
      if (slide.dataset.secnum)
        s.addText(slide.dataset.secnum.toUpperCase(), { x:.5, y:2.5, w:12.3, h:.4, fontSize:9, color:'FFFFFF', fontFace:FONT, bold:true, align:'center', charSpacing:3 });
      s.addText(slide.dataset.title || '', { x:.5, y:3.0, w:12.3, h:2, fontSize:36, color:C.white, fontFace:FONT, bold:true, align:'center' });

    } else if (type === 'content') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink700} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.06, fill:{color: C.orange} });
      s.addText(slide.dataset.headline || '', { x:.5, y:.35, w:12, h:1.5, fontSize:28, color:C.orange, fontFace:FONT, bold:true });
      const bullets = JSON.parse(slide.dataset.bullets || '[]');
      bullets.forEach((b, i) => {
        s.addShape(pptx.ShapeType.ellipse, { x:.5, y:2.2 + i * 1.1 + .15, w:.1, h:.1, fill:{color: C.orange} });
        s.addText(b, { x:.75, y:2.15 + i * 1.1, w:12, h:.7, fontSize:17, color:C.white, fontFace:FONT });
        if (i < bullets.length - 1)
          s.addShape(pptx.ShapeType.rect, { x:.5, y:2.95 + i * 1.1, w:12.3, h:.01, fill:{color:'403E55'} });
      });
      // Speaker notes
      const notesEl = slide.querySelector('.notes');
      if (notesEl) s.addNotes(notesEl.textContent.trim());

    } else if (type === 'stat') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.06, fill:{color: C.orange} });
      if (slide.dataset.title)
        s.addText(slide.dataset.title, { x:.5, y:.4, w:12.3, h:.6, fontSize:18, color:C.ink300, fontFace:FONT, align:'center' });
      const stats = JSON.parse(slide.dataset.stats || '[]');
      const colW  = 13.33 / stats.length;
      stats.forEach((st, i) => {
        s.addText(st.value, { x: i*colW + .3, y:1.6, w:colW - .6, h:2.5, fontSize:60, color:C.orange, fontFace:FONT, bold:true, align:'center' });
        s.addText(st.label, { x: i*colW + .3, y:4.3, w:colW - .6, h:1, fontSize:13, color:C.ink300, fontFace:FONT, align:'center', wrap:true });
      });

    } else if (type === 'quote') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.06, fill:{color: C.orange} });
      s.addText('“', { x:.4, y:.2, w:2, h:1.5, fontSize:80, color:C.orange, fontFace:'Georgia', bold:true });
      const qt = slide.querySelector('blockquote')?.textContent?.trim() || '';
      s.addText(qt, { x:.5, y:1.6, w:12.3, h:3, fontSize:22, color:C.white, fontFace:FONT, italic:true, align:'center', wrap:true });
      const cite = slide.querySelector('cite')?.textContent?.trim() || '';
      if (cite)
        s.addText('— ' + cite, { x:.5, y:5.1, w:12.3, h:.5, fontSize:12, color:C.orange, fontFace:FONT, bold:true, align:'center', charSpacing:2 });

    } else if (type === 'closing') {
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color: C.ink700} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:.06, fill:{color: C.orange} });
      s.addShape(pptx.ShapeType.rect, { x:0, y:7.44, w:'100%', h:.06, fill:{color: C.orange} });
      s.addText(slide.dataset.title || 'Thank you', { x:.5, y:1.5, w:12.3, h:2.5, fontSize:44, color:C.white, fontFace:FONT, bold:true, align:'center' });
      s.addShape(pptx.ShapeType.rect, { x:6.1, y:4.2, w:.55, h:.05, fill:{color: C.orange} });
      if (slide.dataset.body)
        s.addText(slide.dataset.body, { x:.5, y:4.4, w:12.3, h:.7, fontSize:15, color:C.ink300, fontFace:FONT, align:'center' });
      if (slide.dataset.cta) {
        s.addShape(pptx.ShapeType.roundRect, { x:5.3, y:5.4, w:2.7, h:.65, rectRadius:.08, fill:{color: C.orange} });
        s.addText(slide.dataset.cta, { x:5.3, y:5.4, w:2.7, h:.65, fontSize:13, color:C.white, fontFace:FONT, bold:true, align:'center' });
      }
    }
  });

  // Filename from title, slugified
  const slug = (document.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  pptx.writeFile({ fileName: slug + '.pptx' });
}
</script>
</body>
</html>
```

## Key Rules for Populating the Template

1. **data-* attributes on each `<section>` drive the PPTX** — always fill them in as well as the visible HTML. They must be valid JSON where shown.
2. **Slide order in HTML = slide order in PPTX** — they are processed in DOM order.
3. For multi-word stat values like `"$2.4M"` — keep inside the JSON string.
4. Speaker notes: put in `<div class="notes">` inside the slide — they carry over to the PPTX notes pane automatically.

## Using Brand Graphics

Use `file_search` to read an SVG from `brand/graphics/Whatfix Product Graphic/`, paste the raw `<svg>` XML into the slide HTML. Do not use `<img src="...">` paths.

---

## Playbook Mode — POC / Demo / Sales Playbooks

Use this mode when the request contains: POC playbook, proof of concept deck, demo playbook, sales playbook, engagement playbook, or any structured document combining section dividers with checklists/tables.

**Visual identity**: Crimson (#872345) cover panel, dark Ink 700 section dividers with Orange split right panel, white background table slides with Crimson headers. Based on Whatfix's official POC Playbook format.

### Additional CSS for Playbook Mode

Add these blocks inside the same `<style>` tag (alongside the dark deck styles, which remain available for non-table slides):

```css
/* ── PLAYBOOK: COVER ──────────────────────────────────── */
.slide.cover .left {
  flex: 0 0 58%; background: #872345; display: flex; flex-direction: column;
  justify-content: flex-end; padding: clamp(2rem,5vw,4rem) clamp(2rem,5vw,4.5rem);
  padding-bottom: clamp(2.5rem,6vh,4rem);
}
.slide.cover .right {
  flex: 1; background: #FF6B18; position: relative; overflow: hidden;
}
.slide.cover .right::before {
  content: ''; position: absolute; width: 160%; height: 160%; border-radius: 50%;
  border: clamp(20px,4vw,48px) solid rgba(255,255,255,.18); top: -30%; left: -85%;
}
.slide.cover .right::after {
  content: ''; position: absolute; width: 110%; height: 110%; border-radius: 50%;
  border: clamp(14px,2.5vw,32px) solid rgba(255,255,255,.28); top: -5%; left: -55%;
}
.cover-arc3 {
  position: absolute; width: 68%; height: 68%; border-radius: 50%;
  border: clamp(10px,1.8vw,22px) solid rgba(255,255,255,.35); top: 16%; left: -30%;
}
.slide.cover .tagline { font-size:.68rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.45); margin-bottom:1.75rem; }
.slide.cover h1 { font-size:clamp(1.6rem,3.2vw,3rem); font-weight:700; color:#fff; line-height:1.15; max-width:18ch; margin-bottom:.75rem; }
.slide.cover .doc-type { font-size:clamp(.85rem,1.4vw,1.05rem); font-weight:300; color:rgba(255,255,255,.6); margin-bottom:2.5rem; }
.logo-row { display:flex; align-items:center; gap:1.25rem; padding-top:1.25rem; border-top:1px solid rgba(255,255,255,.18); }
.wf-wordmark { font-size:.95rem; font-weight:800; color:#fff; }
.customer-badge { font-size:.88rem; font-weight:600; color:rgba(255,255,255,.85); padding-left:1.25rem; border-left:1px solid rgba(255,255,255,.2); }
.disclaimer-cover { position:absolute; bottom:.5rem; left:0; right:0; font-size:.48rem; color:rgba(255,255,255,.22); padding:0 clamp(2rem,5vw,4.5rem); text-align:center; font-style:italic; }

/* ── PLAYBOOK: SECTION DIVIDER ────────────────────────── */
.slide.section-div .left {
  flex: 0 0 58%; background: #25223B; display: flex; flex-direction: column;
  justify-content: center; padding: clamp(2rem,5vw,4.5rem);
}
.slide.section-div .right {
  flex: 1; background: #FF6B18; position: relative; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 1.5rem 1.75rem;
}
.slide.section-div .right::before { content:''; position:absolute; inset:0; background:linear-gradient(145deg,rgba(0,0,0,.1) 0%,transparent 55%); }
.slide.section-div .sec-label { font-size:.65rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.3); margin-bottom:.75rem; }
.slide.section-div h2 { font-size:clamp(1.6rem,3vw,2.8rem); font-weight:700; color:#fff; line-height:1.15; max-width:16ch; }
.sd-badge { position:relative; z-index:1; font-size:.65rem; font-weight:700; color:rgba(255,255,255,.6); }

/* ── PLAYBOOK: TABLE SLIDE ────────────────────────────── */
.slide.table-slide { flex-direction: column; background: #fff; }
.ts-header {
  flex-shrink: 0; padding: 1.4rem clamp(1.5rem,4vw,3rem) .85rem;
  border-bottom: 2px solid #E5E3DC;
  display: flex; align-items: center; justify-content: space-between;
}
.ts-header h2 { font-size:clamp(1rem,1.8vw,1.55rem); font-weight:700; color:#872345; }
.ts-wf { font-size:.62rem; font-weight:800; color:#872345; }
.ts-body { flex:1; overflow:auto; padding:.6rem clamp(1.5rem,4vw,3rem) 0; }

table.ptable { width:100%; border-collapse:collapse; font-size:clamp(.65rem,1.1vw,.85rem); }
table.ptable thead tr { background:#872345; }
table.ptable thead th { padding:.6rem .85rem; font-weight:600; color:#fff; text-align:left; border-right:1px solid rgba(255,255,255,.12); }
table.ptable thead th:last-child { border-right:none; }
table.ptable tbody tr:nth-child(even) { background:#F9F9F2; }
table.ptable tbody tr:nth-child(odd)  { background:#fff; }
table.ptable tbody td { padding:.55rem .85rem; color:#35324A; border-bottom:1px solid #E5E3DC; border-right:1px solid #E5E3DC; vertical-align:middle; line-height:1.45; }
table.ptable tbody td:last-child { border-right:none; }
table.ptable tbody td strong { font-weight:600; color:#25223B; }

/* Status badges */
.badge { display:inline-block; padding:.18rem .6rem; border-radius:4px; font-size:.7rem; font-weight:600; white-space:nowrap; }
.badge.complete   { background:#D4EDDA; color:#166534; }
.badge.pending    { background:#FEF3C7; color:#92400E; }
.badge.inprogress { background:#DBEAFE; color:#1E40AF; }
.badge.present    { background:#FFE9DC; color:#C2410C; border:1px solid rgba(255,107,24,.25); }
.badge.notpresent { background:#F9F9F2; color:#8A8A9C; border:1px solid #E5E3DC; }

.ts-disclaimer { flex-shrink:0; padding:.35rem clamp(1.5rem,4vw,3rem); font-size:.52rem; color:#8A8A9C; border-top:1px solid #E5E3DC; font-style:italic; }

/* ── Slide counter: light on dark slides, dark on white slides ── */
.slide-counter.dark-text  { color: rgba(0,0,0,.22); }
.slide-counter.light-text { color: rgba(255,255,255,.22); }
```

### Playbook Slide Types

**Cover** (`<section class="slide cover">`)
```html
<section class="slide cover active"
  data-type="cover"
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

**Section divider** (`<section class="slide section-div">`)
```html
<section class="slide section-div"
  data-type="section-div"
  data-sec-label="Section 01"
  data-title="POC Prerequisites">
  <div class="left">
    <p class="sec-label">Section 01</p>
    <h2>POC Prerequisites</h2>
  </div>
  <div class="right">
    <span class="sd-badge">Whatfix &nbsp;2</span>
  </div>
</section>
```

**Table slide** (`<section class="slide table-slide">`)
```html
<section class="slide table-slide" data-type="table" data-title="POC Stages">
  <div class="ts-header">
    <h2>POC Stages</h2>
    <span class="ts-wf">Whatfix</span>
  </div>
  <div class="ts-body">
    <table class="ptable">
      <thead>
        <tr><th>S No</th><th>Pre-requisites</th><th>Status</th><th>Ownership</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1</strong></td>
          <td>Identify the application for PoC</td>
          <td><span class="badge complete">Complete</span></td>
          <td>Customer Team</td>
        </tr>
        <tr>
          <td><strong>2</strong></td>
          <td>Install Whatfix Studio (for content creators)</td>
          <td><span class="badge pending">Pending</span></td>
          <td>Whatfix and Customer Team</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p class="ts-disclaimer">Disclaimer: Please treat all information as confidential and do not share outside your organization. By default all calls will be recorded &amp; provided to you for internal use.</p>
</section>
```

**Success metrics table** (`data-type="success-metrics"`) — same structure as table slide but with 5 columns: Use Case/Area · Content Type · Env With Data · Env Without Data · Scope Notes. Use `.badge.present` / `.badge.notpresent` for the data columns.

### Navigation JS addition for Playbook Mode

Add this to the `go()` function so the counter color flips correctly on white slides:

```js
// after updating sc.textContent:
sc.className = 'slide-counter ' +
  (slides[cur].classList.contains('table-slide') ? 'dark-text' : 'light-text');
```

### PPTX Export for Playbook Slides

Add these branches inside `downloadPptx()` alongside the existing dark-deck handlers:

```js
const DISCLAIMER_TEXT = 'Disclaimer: Please treat all information as confidential and do not share outside your organization. By default all calls will be recorded & provided to you for internal use.';

function stripHtml(str) {
  const d = document.createElement('div'); d.innerHTML = str;
  return (d.textContent || d.innerText || '').trim();
}

// In the slides.forEach loop, add:
if (type === 'cover') {
  s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:7.73, h:'100%', fill:{color:'872345'} });
  s.addShape(pptx.ShapeType.rect, { x:7.73, y:0, w:5.6, h:'100%', fill:{color:'FF6B18'} });
  s.addShape(pptx.ShapeType.ellipse, { x:4.8, y:-1.5, w:8, h:8, line:{color:'FFFFFF',width:1.5,transparency:75}, fill:{type:'none'} });
  s.addShape(pptx.ShapeType.ellipse, { x:5.8, y:-.5, w:6, h:6, line:{color:'FFFFFF',width:1.2,transparency:70}, fill:{type:'none'} });
  s.addText((slide.dataset.tagline||'Drive Digital Adoption').toUpperCase(), { x:.5,y:.55,w:7,h:.3,fontSize:7.5,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:3,transparency:55 });
  s.addText(slide.dataset.title||'', { x:.5,y:3.2,w:7,h:2,fontSize:28,color:'FFFFFF',fontFace:FONT,bold:true,valign:'top' });
  s.addText(slide.dataset.docType||'', { x:.5,y:5.4,w:6.5,h:.5,fontSize:12,color:'FFFFFF',fontFace:FONT,transparency:38 });
  s.addShape(pptx.ShapeType.rect, { x:.5,y:6.2,w:7,h:.02,fill:{color:'FFFFFF'},transparency:80 });
  s.addText('Whatfix', { x:.5,y:6.45,w:2,h:.4,fontSize:11,color:'FFFFFF',fontFace:FONT,bold:true });
  if (slide.dataset.customer) s.addText(slide.dataset.customer, { x:2.8,y:6.45,w:4.5,h:.4,fontSize:11,color:'FFFFFF',fontFace:FONT });
  s.addText(DISCLAIMER_TEXT, { x:0,y:7.3,w:13.33,h:.2,fontSize:5.5,color:'FFFFFF',fontFace:FONT,align:'center',transparency:72 });

} else if (type === 'section-div') {
  s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:7.73, h:'100%', fill:{color:'25223B'} });
  s.addShape(pptx.ShapeType.rect, { x:7.73, y:0, w:5.6, h:'100%', fill:{color:'FF6B18'} });
  if (slide.dataset.secLabel)
    s.addText(slide.dataset.secLabel.toUpperCase(), { x:.5,y:2.9,w:7,h:.35,fontSize:7.5,color:'FFFFFF',fontFace:FONT,bold:true,charSpacing:4,transparency:70 });
  s.addText(slide.dataset.title||'', { x:.5,y:3.3,w:7,h:2,fontSize:26,color:'FFFFFF',fontFace:FONT,bold:true });

} else if (type === 'table' || type === 'success-metrics') {
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'} });
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:'100%',h:.055,fill:{color:'872345'} });
  s.addText(slide.dataset.title||'', { x:.4,y:.2,w:12.5,h:.75,fontSize:20,color:'872345',fontFace:FONT,bold:true });
  s.addShape(pptx.ShapeType.rect, { x:.4,y:1.05,w:12.5,h:.02,fill:{color:'E5E3DC'} });
  s.addText('Whatfix', { x:11.5,y:.25,w:1.6,h:.4,fontSize:8,color:'872345',fontFace:FONT,bold:true,align:'right' });
  const domTable = slide.querySelector('table');
  if (domTable) {
    const headers = [...domTable.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const bodyRows = [...domTable.querySelectorAll('tbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => stripHtml(td.innerHTML))
    );
    const isSnO = /^s\s?no/i.test(headers[0]);
    const colWs = isSnO && headers.length===4 ? [.6,4.5,2.2,3.2]
                : headers.length===5 ? [2.2,1.6,1.8,2,4.9]
                : headers.map(() => 12.5/headers.length);
    const tableData = [
      headers.map(h => ({ text:h, options:{bold:true,color:'FFFFFF',fill:'872345',fontFace:FONT,fontSize:9.5,align:'left',valign:'middle'} })),
      ...bodyRows.map((row,ri) => row.map(cell => ({ text:cell, options:{color:'35324A',fontFace:FONT,fontSize:9,fill:ri%2===0?'FFFFFF':'F9F9F2',valign:'middle'} })))
    ];
    if (tableData.length>1) s.addTable(tableData, { x:.4,y:1.15,w:12.5,colW:colWs,border:{type:'solid',color:'E5E3DC',pt:.5},rowH:.72 });
  }
  s.addText(DISCLAIMER_TEXT, { x:.4,y:7.22,w:12.5,h:.22,fontSize:5.5,color:'8A8A9C',fontFace:FONT,italic:true });
}
```

### Typical playbook structure

1. Cover — title + customer name
2. Section divider — "POC Prerequisites"
3. Table slide — POC Stages checklist (S No / Pre-requisite / Status / Ownership)
4. Section divider — "Use Cases and Success Criteria"
5. Success Metrics table (repeat for multiple pages of use cases)
6. Closing — next steps (use the existing `closing` dark slide type from the dark deck)

---

## After Generating

1. Adjust slide content or add slides?
2. Add speaker notes?
3. Convert dark deck to playbook format (or vice versa)?
