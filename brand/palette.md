---
name: whatfix-palette
description: Official Whatfix brand color palette sourced from Typography and colour '26.pdf. Orange is the primary brand color, anchored by inky blues (Ink) and a deep red (Crimson).
---

# Whatfix Color Palette

## Primary Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Orange** | `#FF6B18` | 255 107 24 | Primary brand color — CTAs, accents, headlines |
| Orange 100 | `#FFE9DC` | 255 233 220 | Tints, backgrounds, soft highlights |
| **Ink 700** | `#25223B` | 37 34 59 | Darkest bg, dark slide backgrounds, hero fills |
| **Ink** | `#35324A` | 53 50 74 | Dark surfaces, secondary dark bg |
| **Crimson** | `#872345` | 135 35 69 | Complimentary accent, alerts, emphasis |
| Crimson 300 | `#FAB4B8` | 250 180 184 | Soft crimson tint |
| **Bright Blue** | `#AED2F3` | 174 210 243 | Supporting accent, data viz |
| Gray | `#B8B6A8` | 184 182 168 | Neutral text, borders |
| Gray 300 | `#E5E3DC` | 229 227 220 | Dividers, subtle backgrounds |
| **Gray 100** | `#F9F9F2` | 249 249 242 | Light/default slide background (warm off-white) |
| White | `#FFFFFF` | 255 255 255 | Cards, surfaces on dark backgrounds |

## Secondary Palette (Extended)

| Name | Hex | Usage |
|------|-----|-------|
| Orange 700 | `#F55800` | Darker orange for hover, depth |
| Orange 300 | `#FFA450` | Mid-tone orange tint |
| Orange 200 | `#FFC89E` | Soft orange fill |
| Ink 300 | `#8A8A9C` | Muted text, disabled states |
| Crimson 300 | `#C63739` | Mid-tone crimson |
| Crimson 200 | `#FAB4B8` | Soft crimson tint |
| Crimson 100 | `#FFDADA` | Palest crimson |
| Bright Blue 700 | `#7AB0E2` | Darker bright blue |
| Bright Blue 300 | `#C8E2FA` | Light blue tint |
| Bright Blue 200 | `#E1EEFA` | Palest blue |

## Digital / UI Greys (for cards, dividers, digital-only)

| Name | Hex | Usage |
|------|-----|-------|
| Digital Grey 300 | `#D6D6D6` | Borders, dividers |
| Digital Grey 200 | `#E6E6E6` | Section fills, light surfaces |
| Digital Grey 100 | `#F2F2F2` | Page backgrounds |
| Green 200 | `#72C87B` | Success states |
| Green 100 | `#D1E9D4` | Success backgrounds |

## Themes for Slides

### Light Theme — Default (matches brand doc aesthetic)
```css
--bg: #F9F9F2;        /* Gray 100 — warm off-white */
--surface: #FFFFFF;
--primary: #FF6B18;   /* Orange */
--text: #25223B;      /* Ink 700 */
--text-muted: #8A8A9C; /* Ink 300 */
--border: #E5E3DC;
```

### Dark Theme (tech, product, internal)
```css
--bg: #25223B;        /* Ink 700 */
--surface: #35324A;   /* Ink */
--primary: #FF6B18;   /* Orange stays consistent */
--text: #FFFFFF;
--text-muted: #8A8A9C;
--border: rgba(255,255,255,0.1);
```

## Gradient Recipes

```css
/* Hero — Orange warmth on dark ink */
background: linear-gradient(135deg, #25223B 0%, #35324A 60%, #FF6B18 100%);

/* Section divider — Orange to Crimson */
background: linear-gradient(135deg, #FF6B18 0%, #872345 100%);

/* Warm light bg — used in brand docs */
background: linear-gradient(135deg, #F9F9F2 0%, #FFE9DC 100%);
```

## Rules

- **Use only these colors — never invent arbitrary hex values**
- **Max 3 colors per slide**
- **Orange `#FF6B18` is an ACCENT only** — use for headlines, KPI numbers, CTAs, underlines, progress bars. Never as a full slide background — it reads as unprofessional and overpowering.
- **Default slide bg: Ink 700 `#25223B`** — dark, professional, makes orange pop
- Ink 700 / Ink for all dark backgrounds — not pure black `#000000`
- Gray 100 `#F9F9F2` is the correct light background — warm off-white, not pure white `#FFFFFF`
