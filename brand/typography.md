---
name: whatfix-typography
description: Official Whatfix typography rules sourced from Typography and colour '26.pdf. Primary font is Aeonik (TTF files in brand/fonts/Aeonik/). Web fallback is DM Sans from Google Fonts.
---

# Whatfix Typography

## Fonts

### Primary — Aeonik
The primary typeface for all Whatfix design. Chosen for clean legibility and unique characters.
Files are in `brand/fonts/Aeonik/`.

| Weight | File | Usage |
|--------|------|-------|
| Aeonik Medium | `Aeonik-Medium.ttf` | **Display / headlines** — primary font for all large type |
| Aeonik Regular | `Aeonik-Regular.ttf` | Headers, subheads, body copy, explanatory text |
| Aeonik Bold | `Aeonik-Bold.ttf` | Some headlines, CTAs, accents |
| Aeonik Light | `Aeonik-Light.ttf` | Body text, subhead text, quotes (longer reads) |
| Aeonik Regular Italic | `Aeonik-RegularItalic.ttf` | Callout text, accent text, pull quotes |

**Only use these 5 weights.** No other weights in any execution.

### Web / Fallback — DM Sans
Used when Aeonik is not available (Google Workspace, web apps, HTML artifacts).
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap');
```
Only use DM Sans in **Regular (400) and Medium (500)** weights. Bold (700) sparingly for headlines only.

### @font-face for Local Embedding (HTML artifacts)
```css
@font-face {
  font-family: 'Aeonik';
  src: url('brand/fonts/Aeonik/Aeonik-Medium.ttf') format('truetype');
  font-weight: 500;
}
@font-face {
  font-family: 'Aeonik';
  src: url('brand/fonts/Aeonik/Aeonik-Regular.ttf') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'Aeonik';
  src: url('brand/fonts/Aeonik/Aeonik-Bold.ttf') format('truetype');
  font-weight: 700;
}
@font-face {
  font-family: 'Aeonik';
  src: url('brand/fonts/Aeonik/Aeonik-Light.ttf') format('truetype');
  font-weight: 300;
}
@font-face {
  font-family: 'Aeonik';
  src: url('brand/fonts/Aeonik/Aeonik-RegularItalic.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
}
/* Fallback stack */
font-family: 'Aeonik', 'DM Sans', -apple-system, sans-serif;
```

> **For self-contained HTML artifacts** (slides rendered in browser): Aeonik cannot load from local paths in a sandboxed iframe. Use DM Sans as the primary font — this is explicitly endorsed in the brand guidelines as the correct substitute for web contexts.

## Type Scale

### Slides / Presentation

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Hero title | `clamp(3.5rem, 7vw, 6rem)` | Medium (500) | Title slide only |
| Slide headline | `clamp(2rem, 4vw, 3.5rem)` | Medium (500) | One per slide |
| Section title | `clamp(2.5rem, 5vw, 4rem)` | Medium (500) | Section divider slides |
| Subheadline | `1.4rem` | Regular (400) | Supporting line under headline |
| Body / bullets | `1.1rem – 1.2rem` | Light (300) or Regular (400) | Max 3 bullets × 10 words |
| Stat / KPI | `clamp(4rem, 10vw, 8rem)` | Bold (700) | Color: Orange `#FF6B18` |
| Pull quote | `1.5rem – 2rem` | Light Italic | Aeonik italic for quotes |
| Caption / label | `0.8rem` | Regular (400) | Muted color |

### Documents / Long-form

| Role | Size | Weight |
|------|------|--------|
| H1 Display | `46–48pt` | Medium |
| H2 | `28–32pt` | Medium or Regular |
| H3 / Subhead | `18–22pt` | Regular |
| Body copy | `14–16pt` | Regular or Light |
| Captions | `10–12pt` | Regular |

## Rules

- **Sentence case always** — Headlines, headers, subheads. Never title case every word. Rare exceptions for all-caps labels only.
- **Line height:** Headlines 1.1–1.2 · Body 1.6–1.7
- **Letter spacing:** Headlines `−0.02em` · Body `0`
- **Minimum font size:** 8pt (digital ads) — nothing smaller
- **No mixing of weight extremes** — don't pair Black with Air on the same slide
- **Bold orange on dark** — Orange `#FF6B18` text on Ink bg is a core brand pattern
