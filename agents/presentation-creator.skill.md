---
name: presentation-creator
description: Use when the user asks for a presentation, slides, slide deck, pitch deck, or wants to visualize information as a slideshow. Generates a pixel-perfect self-contained HTML artifact rendered inline.
user-invocable: true
allowed-tools: ["artifacts"]
---

# Presentation Creator Skill

When triggered, generate a single complete self-contained HTML artifact as the presentation.

## Brand Requirements

**Always apply Whatfix brand guidelines** from `brand/whatfix-brand.md`:
- Primary color: **Orange `#FF6B18`** — not blue, not purple
- Light theme bg: `#F9F9F2` (warm off-white) · Dark theme bg: `#25223B` (Ink 700)
- Font: **DM Sans** from Google Fonts (web substitute for Aeonik, per brand guidelines)
- Paste the full CSS variables block from `whatfix-brand.md` into every slide's `<style>`
- Use `var(--wf-orange)`, `var(--wf-ink-700)`, `var(--font-primary)` throughout
- Default theme: **light** (`#F9F9F2` bg) — matches brand doc aesthetic. Use dark for internal/technical content.
- SVG product logos available in `brand/graphics/Whatfix Product Graphic/` — inline SVGs on relevant slides

## Output Rules

- Artifact type: `html` — renders inline in the side panel
- Everything must be inline. No external CDN. Google Fonts `@import` is allowed.
- One slide = one idea. Never crowd a slide.
- Always include: title slide → agenda → content slides → closing slide.

## HTML Skeleton

Use this exact structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRESENTATION TITLE</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', sans-serif;
  background: #0f0f13;
  color: #f0f0f5;
  height: 100vh;
  overflow: hidden;
}

.deck {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 6rem;
  opacity: 0;
  transform: translateX(60px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

.slide.active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: all;
}

.slide.exit {
  opacity: 0;
  transform: translateX(-60px);
}

/* Title slide */
.slide.title { background: linear-gradient(135deg, #0f0f13 0%, #1a1a2e 100%); align-items: center; text-align: center; }
.slide.title h1 { font-size: clamp(3rem, 6vw, 5rem); font-weight: 800; color: #f0f0f5; line-height: 1.1; }
.slide.title .subtitle { font-size: 1.25rem; color: rgba(240,240,245,0.6); margin-top: 1rem; }
.slide.title .accent-line { width: 80px; height: 4px; background: #6c63ff; margin: 1.5rem auto; border-radius: 2px; }

/* Section divider */
.slide.section { background: #6c63ff; }
.slide.section h2 { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; color: #fff; }

/* Content slide */
.slide.content h2 { font-size: clamp(1.8rem, 3vw, 2.5rem); font-weight: 700; color: #6c63ff; margin-bottom: 2rem; }
.slide.content ul { list-style: none; }
.slide.content ul li { font-size: 1.2rem; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: rgba(240,240,245,0.9); }
.slide.content ul li::before { content: '→ '; color: #6c63ff; font-weight: 700; }

/* Stat slide */
.slide.stat { background: #1a1a24; align-items: center; text-align: center; }
.slide.stat .big-number { font-size: clamp(5rem, 12vw, 10rem); font-weight: 800; color: #6c63ff; line-height: 1; }
.slide.stat .stat-label { font-size: 1.4rem; color: rgba(240,240,245,0.7); margin-top: 1rem; }

/* Quote slide */
.slide.quote { background: #1a1a24; align-items: center; text-align: center; }
.slide.quote .quote-mark { font-size: 8rem; color: rgba(108,99,255,0.2); line-height: 0.5; margin-bottom: 1rem; }
.slide.quote blockquote { font-size: clamp(1.3rem, 2.5vw, 2rem); font-style: italic; color: #f0f0f5; max-width: 800px; line-height: 1.6; }
.slide.quote cite { font-size: 1rem; color: rgba(240,240,245,0.5); margin-top: 1.5rem; display: block; }

/* Split layout */
.slide.split { flex-direction: row; gap: 4rem; padding: 4rem 6rem; }
.slide.split .col { flex: 1; }
.slide.split h2 { font-size: 2rem; font-weight: 700; color: #6c63ff; margin-bottom: 1rem; }

/* Closing slide */
.slide.closing { background: linear-gradient(135deg, #6c63ff 0%, #a855f7 100%); align-items: center; text-align: center; }
.slide.closing h2 { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; color: #fff; }
.slide.closing p { font-size: 1.3rem; color: rgba(255,255,255,0.85); margin-top: 1rem; }

/* Progress bar */
.progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.08); z-index: 100; }
.progress-fill { height: 100%; background: #6c63ff; transition: width 0.4s ease; }

/* Counter */
.counter { position: fixed; bottom: 1.5rem; right: 2rem; font-size: 0.85rem; color: rgba(240,240,245,0.4); z-index: 100; letter-spacing: 0.05em; }

/* Nav hint */
.nav-hint { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: rgba(240,240,245,0.2); z-index: 100; }

/* Speaker notes */
.notes { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.92); color: #f0f0f5; padding: 1.5rem 3rem; font-size: 0.95rem; border-top: 2px solid #6c63ff; z-index: 200; }
.notes.visible { display: block; }
</style>
</head>
<body>

<div class="deck">

  <section class="slide title active">
    <h1>PRESENTATION TITLE</h1>
    <div class="accent-line"></div>
    <p class="subtitle">SUBTITLE OR DATE</p>
  </section>

  <!-- ADD MORE SLIDES HERE following the patterns above -->

  <section class="slide closing">
    <h2>Thank You</h2>
    <p>CLOSING MESSAGE OR CTA</p>
  </section>

</div>

<div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
<div class="counter" id="counter">1 / N</div>
<div class="nav-hint">← → navigate · F fullscreen · N notes</div>

<script>
const slides = document.querySelectorAll('.slide');
const progress = document.getElementById('progress');
const counter = document.getElementById('counter');
let current = 0;

function goTo(n) {
  slides[current].classList.remove('active');
  slides[current].classList.add('exit');
  setTimeout(() => slides[current < n ? current : n].classList.remove('exit'), 400);
  current = Math.max(0, Math.min(n, slides.length - 1));
  slides[current].classList.add('active');
  slides[current].classList.remove('exit');
  progress.style.width = ((current + 1) / slides.length * 100) + '%';
  counter.textContent = (current + 1) + ' / ' + slides.length;
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(current + 1); }
  if (e.key === 'ArrowLeft') goTo(current - 1);
  if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
  if (e.key === 'n' || e.key === 'N') {
    const notes = slides[current].querySelector('.notes');
    if (notes) notes.classList.toggle('visible');
  }
});

document.querySelector('.deck').addEventListener('click', e => {
  const x = e.clientX / window.innerWidth;
  x > 0.5 ? goTo(current + 1) : goTo(current - 1);
});

goTo(0);
</script>
</body>
</html>
```

## Design Rules

**All colors MUST come from the official Whatfix palette only — no invented or arbitrary colors.**

### Default Theme — Dark (Ink + Orange)
```
bg:           #25223B  (Ink 700)
surface:      #35324A  (Ink)
accent:       #FF6B18  (Orange) — use for headlines, stats, CTAs, lines. NEVER as full bg.
text:         #FFFFFF
text-muted:   #8A8A9C  (Ink 300)
border:       rgba(255,255,255,0.08)
section-div:  gradient #FF6B18 → #872345  (Orange to Crimson)
```

Use light theme only for printed docs or Google Slides exports:
```
bg: #F9F9F2  surface: #FFFFFF  text: #25223B  accent: #FF6B18
```

**Typography:** DM Sans (Google Fonts). Headlines medium weight, max 8 words (clamp 2–5rem). Body max 3 bullets × 10 words each. Sentence case always.

**Stats:** KPI number in `#FF6B18` (Orange), huge size. Never print raw numbers — use SVG/CSS bar or ring chart.

**Content:** Real, relevant content only. No lorem ipsum. Label illustrative data.

## After Generating

Ask:
1. Adjust theme or colors?
2. Add, remove, or reorder slides?
3. Add speaker notes to any slides?
