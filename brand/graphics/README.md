# Graphics Assets

Place Whatfix brand assets here. The presentation skill and document generator will reference these.

## Expected Files

| File | Purpose |
|------|---------|
| `logo-white.svg` | White logo — use on dark backgrounds |
| `logo-blue.svg` | Blue logo — use on light backgrounds |
| `logo-mark.svg` | Icon-only mark — for slide footers, favicons |
| `pattern-dots.svg` | Subtle dot pattern for slide backgrounds |
| `pattern-grid.svg` | Grid pattern for tech/product slides |
| `icon-set.svg` | Sprite sheet of Whatfix product icons |

## Usage in Slides

Since slides are self-contained HTML, either:
1. **Inline SVG** — paste SVG source directly into the HTML (preferred)
2. **Base64 data URI** — convert with `base64 -i logo.svg` and embed as `<img src="data:image/svg+xml;base64,...">`

## SVG Logo Placeholder

Until real assets are added, the skill will use this inline SVG wordmark:

```svg
<svg viewBox="0 0 120 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="22" font-family="Sora, sans-serif" font-weight="800"
        font-size="22" fill="currentColor">whatfix</text>
</svg>
```
