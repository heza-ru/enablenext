---
name: whatfix-brand
description: Master Whatfix brand guidelines for slides and documents. Real specs from Typography and colour '26.pdf. Covers palette, typography, layout, voice, and CSS variables. Always apply when generating Whatfix presentations or docs.
---

# Whatfix Brand Guidelines

## Brand Essence

Whatfix is a **digital adoption platform** — bright, energetic, professional, trustworthy. The brand anchors around **Whatfix Orange** as its ownable primary color, paired with rich inky dark blues and a deep crimson accent.

## Quick Reference

| Element | Value |
|---------|-------|
| Primary color | **Orange `#FF6B18`** |
| Dark background | Ink 700 `#25223B` |
| Dark surface | Ink `#35324A` |
| Light background | Gray 100 `#F9F9F2` (warm off-white) |
| Accent | Crimson `#872345` |
| Support | Bright Blue `#AED2F3` |
| Text on dark | White `#FFFFFF` |
| Text on light | Ink 700 `#25223B` |
| Primary font | **Aeonik** (files: `brand/fonts/Aeonik/`) |
| Web fallback | **DM Sans** (Google Fonts) |

Full details → `palette.md` · `typography.md`

## Slide Themes

### Dark Theme — **Default for Slides**
Use for: all presentations. Ink 700 background with orange accents is the professional Whatfix slide look.
**Orange is NEVER used as a full slide background — only as accent, headline color, or CTA.**

```css
--bg: #25223B;        /* Ink 700 — primary slide bg */
--surface: #35324A;   /* Ink — card/panel surfaces */
--primary: #FF6B18;   /* Orange — accents, stat numbers, headlines, progress bar */
--text: #FFFFFF;
--text-muted: #8A8A9C;
--border: rgba(255,255,255,0.08);
```

### Light Theme
Use for: printed docs, long-form reports, Google Slides exports, brand collateral.
Not ideal for projected presentations — dark theme is preferred for slides.

```css
--bg: #F9F9F2;        /* Gray 100 — warm off-white */
--surface: #FFFFFF;
--primary: #FF6B18;   /* Orange accents stay consistent */
--text: #25223B;      /* Ink 700 for text on light */
--text-muted: #8A8A9C;
--border: #E5E3DC;
```

### Orange Usage Rules
- ✅ Headline accent color (e.g. one key word in orange)
- ✅ Stat/KPI numbers
- ✅ Progress bars, underlines, decorative lines
- ✅ CTA buttons
- ✅ Section divider text
- ❌ Never as a full slide background — too loud, unprofessional
- ❌ Never as body/paragraph text color

## Available Graphics

All in `brand/graphics/Whatfix Product Graphic/`:

| Asset | Path | Use on |
|-------|------|--------|
| AI Agents logos (Authoring, Guidance, Insights) | `AI Agents Logos/Dark Mode/SVG/` | Dark slides |
| AI Agents logos (light) | `AI Agents Logos/Light Mode/SVG/` | Light slides |
| Product logos (DAP, Mirror, Product Analytics, ScreenSense) | `Product Logos/*/Dark Mode/` + `Light Mode/` | Product slides |
| Product Suite graphic | `Product Suite Graphic/Dark Mode/PNG/` | Hero / overview slides |

Always prefer **SVG** over JPG/PNG when available for crisp rendering at any size.

## CSS Variables — Paste Into Every Generated HTML

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap');

:root {
  /* Brand Colors */
  --wf-orange: #FF6B18;
  --wf-orange-700: #F55800;
  --wf-orange-300: #FFA450;
  --wf-orange-100: #FFE9DC;

  --wf-ink-700: #25223B;
  --wf-ink: #35324A;
  --wf-ink-300: #8A8A9C;

  --wf-crimson: #872345;
  --wf-crimson-300: #C63739;
  --wf-crimson-100: #FFDADA;

  --wf-bright-blue: #AED2F3;
  --wf-bright-blue-700: #7AB0E2;

  --wf-gray-100: #F9F9F2;  /* warm off-white — light slide bg */
  --wf-gray-300: #E5E3DC;
  --wf-gray: #B8B6A8;
  --wf-white: #FFFFFF;

  --wf-green: #72C87B;
  --wf-dg-300: #D6D6D6;
  --wf-dg-200: #E6E6E6;
  --wf-dg-100: #F2F2F2;

  /* Gradients */
  --wf-grad-hero: linear-gradient(135deg, #25223B 0%, #35324A 60%, #FF6B18 100%);
  --wf-grad-section: linear-gradient(135deg, #FF6B18 0%, #872345 100%);
  --wf-grad-warm: linear-gradient(135deg, #F9F9F2 0%, #FFE9DC 100%);

  /* Typography — DM Sans is the correct web substitute for Aeonik */
  --font-primary: 'DM Sans', -apple-system, sans-serif;

  /* Spacing */
  --slide-padding: clamp(2.5rem, 6vw, 6rem);
  --card-radius: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-primary); }
h1, h2, h3 { font-weight: 500; letter-spacing: -0.02em; line-height: 1.15; }
p, li { font-weight: 400; line-height: 1.65; }
```

## Slide Layout Principles

- **Sentence case always** — never title-case every word in a headline
- Max **3 bullets** per content slide, max **10 words** each
- Max **3 colors** on any single slide
- **Orange as accent** — use `#FF6B18` for the one thing that needs to stand out
- Stat slides: KPI number in Orange, huge (clamp 5–9rem), Aeonik Bold / DM Sans Bold
- Ink 700 is the darkest background — avoid pure black

## Voice & Tone

- **Outcome-first:** "Reduce onboarding time by 40%" over "Improve the onboarding experience"
- **Active voice:** "Whatfix guides users" not "Users are guided by Whatfix"
- **No buzzwords:** No "leverage synergies", "unlock value", "holistic approach"
- **Numbers as numerals:** 5 not five, 40% not forty percent
- **Sentence case:** "Software clicks with Whatfix" not "Software Clicks With Whatfix"

## Logo

The Whatfix logo appears bottom-right of slide pages (as seen in brand PDF). Use:
- White version on dark (Ink) backgrounds
- Color version on light (Gray 100) backgrounds
