---
name: doc-creator
description: Use when the user asks to create a Word document, DOCX file, report, proposal, one-pager, brief, summary, or any formatted long-form document. Generates an interactive HTML preview with a one-click .docx download using docx.js — no code execution or API keys required.
user-invocable: true
allowed-tools: ["artifacts"]
---

# Document Creator Skill

Generate a single self-contained HTML artifact that:
1. **Renders a styled document preview** with Whatfix brand typography
2. **Includes a "Download Word" button** that generates a real `.docx` file using docx.js (runs in the browser, no server needed)

## Output Format — MANDATORY

ALWAYS deliver the HTML inside an artifact block. NEVER output it as a plain code block.

```
:::artifact{identifier="whatfix-document" type="text/html" title="DOCUMENT TITLE"}
```
<!DOCTYPE html>
...full HTML...
```
:::
```

Use a descriptive kebab-case identifier (e.g. `whatfix-q3-report`). Reuse the same identifier when updating.

## CRITICAL Rules

- **NO code execution** — everything runs client-side in the HTML artifact
- **All colors from Whatfix palette only**
- Google Fonts `@import` is allowed. Load docx.js from cdnjs only: `<script src="https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js"></script>` — never use a local `/libs/` path
- Sentence case for all headings — never title-case every word
- No emojis

## Brand Colors

```
#25223B  Ink 700  — dark bg, H1 color in preview
#35324A  Ink      — body text on light bg
#FF6B18  Orange   — H1/accent color in DOCX, callout borders
#8A8A9C  Ink 300  — captions, metadata
#F9F9F2  Gray 100 — document page bg (warm off-white)
#FFE9DC  Orange 100 — callout box fill
#E5E3DC  Gray 300 — dividers, table borders
```

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DOCUMENT_TITLE</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #25223B;
  min-height: 100vh;
  padding: 2rem;
}

/* Toolbar */
.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 800px; margin: 0 auto 1.5rem;
}
.toolbar .doc-meta h1 { font-size: 1rem; font-weight: 600; color: #FFFFFF; }
.toolbar .doc-meta p  { font-size: .75rem; color: #8A8A9C; margin-top: .15rem; }

.dl-btn {
  display: flex; align-items: center; gap: .5rem;
  padding: .45rem 1.1rem; background: rgba(255,107,24,.12);
  border: 1px solid rgba(255,107,24,.4); border-radius: 6px;
  color: #FF6B18; font-size: .78rem; font-weight: 500;
  font-family: 'DM Sans', sans-serif; cursor: pointer;
  transition: background .2s;
}
.dl-btn:hover { background: rgba(255,107,24,.22); }
.dl-btn svg { width: 13px; height: 13px; }

/* Document page */
.page {
  max-width: 800px; margin: 0 auto;
  background: #F9F9F2; border-radius: 8px;
  padding: clamp(2rem, 5vw, 4rem);
  box-shadow: 0 4px 40px rgba(0,0,0,.4);
  color: #35324A;
}

/* Typography */
.page h1 { font-size: 2.2rem; font-weight: 600; color: #FF6B18; line-height: 1.15; margin-bottom: .5rem; }
.page .doc-subtitle { font-size: 1.05rem; font-weight: 300; color: #8A8A9C; margin-bottom: .5rem; }
.page .doc-date { font-size: .78rem; color: #8A8A9C; margin-bottom: 2rem; }
.page hr { border: none; border-top: 2px solid #E5E3DC; margin: 1.75rem 0; }
.page h2 { font-size: 1.35rem; font-weight: 600; color: #25223B; margin: 1.75rem 0 .6rem; line-height: 1.3; }
.page h3 { font-size: 1.05rem; font-weight: 600; color: #35324A; margin: 1.25rem 0 .4rem; }
.page p  { font-size: .95rem; font-weight: 400; line-height: 1.7; color: #35324A; margin-bottom: .9rem; }
.page ul, .page ol { padding-left: 1.5rem; margin-bottom: .9rem; }
.page li { font-size: .95rem; line-height: 1.7; color: #35324A; margin-bottom: .3rem; }

/* Callout box */
.callout {
  background: #FFE9DC; border-left: 4px solid #FF6B18;
  border-radius: 0 6px 6px 0; padding: .9rem 1.25rem;
  margin: 1.25rem 0;
}
.callout p { margin: 0; font-size: .9rem; font-style: italic; color: #35324A; }

/* Table */
.page table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: .88rem; }
.page thead th { background: #FF6B18; color: #FFFFFF; font-weight: 600; padding: .55rem .85rem; text-align: left; }
.page tbody td { padding: .5rem .85rem; border-bottom: 1px solid #E5E3DC; color: #35324A; }
.page tbody tr:nth-child(even) td { background: #F9F9F2; }

/* Cover page accent bar */
.accent-bar { width: 48px; height: 4px; background: #FF6B18; border-radius: 2px; margin: 1rem 0 1.75rem; }
</style>
</head>
<body>

<div class="toolbar">
  <div class="doc-meta">
    <h1>DOCUMENT TITLE</h1>
    <p>Whatfix · June 2026</p>
  </div>
  <button class="dl-btn" onclick="downloadDocx()">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
    </svg>
    Download Word
  </button>
</div>

<!-- ═══ DOCUMENT PREVIEW ════════════════════════════════ -->
<div class="page" id="doc-preview">

  <!-- Cover -->
  <h1>Document Title Here</h1>
  <p class="doc-subtitle">Subtitle or document type</p>
  <p class="doc-date">Prepared by Name &nbsp;·&nbsp; Whatfix &nbsp;·&nbsp; June 2026</p>
  <div class="accent-bar"></div>

  <hr>

  <!-- Body sections — add as many h2/h3/p/ul blocks as needed -->
  <h2>Executive summary</h2>
  <p>Opening paragraph that summarises the key point of this document in two to three sentences. Lead with the outcome, not the process.</p>

  <div class="callout">
    <p>Key insight or important callout that deserves special attention from the reader.</p>
  </div>

  <h2>Section heading in sentence case</h2>
  <p>Body copy goes here. Keep paragraphs short — three to five sentences maximum. Use Aeonik Light weight for longer reads.</p>
  <ul>
    <li>First bullet point — outcome oriented</li>
    <li>Second bullet point — specific and measurable</li>
    <li>Third bullet point — actionable</li>
  </ul>

  <h2>Next steps</h2>
  <p>Clear action items with owners and dates.</p>

</div>

<script>
// ══════════════════════════════════════════════════════
// DOCUMENT DATA — mirrors the HTML preview above.
// Edit both the HTML and this data object together.
// ══════════════════════════════════════════════════════
const DOC = {
  title:    "Document Title Here",
  subtitle: "Subtitle or document type",
  author:   "Name",
  date:     "June 2026",
  sections: [
    {
      type: "heading1",
      text: "Executive summary"
    },
    {
      type: "paragraph",
      text: "Opening paragraph that summarises the key point of this document in two to three sentences. Lead with the outcome, not the process."
    },
    {
      type: "callout",
      text: "Key insight or important callout that deserves special attention from the reader."
    },
    {
      type: "heading1",
      text: "Section heading in sentence case"
    },
    {
      type: "paragraph",
      text: "Body copy goes here. Keep paragraphs short — three to five sentences maximum."
    },
    {
      type: "bullets",
      items: [
        "First bullet point — outcome oriented",
        "Second bullet point — specific and measurable",
        "Third bullet point — actionable",
      ]
    },
    {
      type: "heading1",
      text: "Next steps"
    },
    {
      type: "paragraph",
      text: "Clear action items with owners and dates."
    },
  ]
};

// ── DOCX export ───────────────────────────────────────
async function downloadDocx() {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, ShadingType,
    TableRow, TableCell, Table, WidthType,
  } = docx;

  // Whatfix colors (ARGB — alpha + RGB)
  const ORANGE  = 'FFFF6B18';
  const INK700  = 'FF25223B';
  const INK     = 'FF35324A';
  const GRAY100 = 'FFF9F9F2';
  const ORANGE100 = 'FFFFE9DC';
  const GRAY300 = 'FFE5E3DC';

  const FONT = 'Calibri';  // closest system font to DM Sans

  const children = [];

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: DOC.title, bold: true, size: 56, color: 'FF6B18', font: FONT })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: DOC.subtitle, size: 24, color: '8A8A9C', font: FONT })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Prepared by ${DOC.author}  ·  Whatfix  ·  ${DOC.date}`, size: 18, color: '8A8A9C', font: FONT })],
      spacing: { after: 300 },
      border: { bottom: { color: 'FF6B18', size: 12, style: BorderStyle.SINGLE, space: 8 } }
    })
  );

  // Sections
  DOC.sections.forEach(sec => {
    if (sec.type === 'heading1') {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: sec.text, bold: true, size: 32, color: '25223B', font: FONT })],
        spacing: { before: 360, after: 120 },
      }));

    } else if (sec.type === 'heading2') {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: sec.text, bold: true, size: 24, color: '35324A', font: FONT })],
        spacing: { before: 240, after: 80 },
      }));

    } else if (sec.type === 'paragraph') {
      children.push(new Paragraph({
        children: [new TextRun({ text: sec.text, size: 22, color: '35324A', font: FONT })],
        spacing: { after: 160 },
      }));

    } else if (sec.type === 'callout') {
      children.push(new Paragraph({
        children: [new TextRun({ text: sec.text, italics: true, size: 21, color: '35324A', font: FONT })],
        spacing: { after: 160, before: 80 },
        shading: { type: ShadingType.CLEAR, fill: 'FFE9DC' },
        border: { left: { color: 'FF6B18', size: 16, style: BorderStyle.SINGLE, space: 8 } },
        indent: { left: 240 },
      }));

    } else if (sec.type === 'bullets') {
      (sec.items || []).forEach(item => {
        children.push(new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: item, size: 22, color: '35324A', font: FONT })],
          spacing: { after: 80 },
        }));
      });

    } else if (sec.type === 'divider') {
      children.push(new Paragraph({
        border: { bottom: { color: 'E5E3DC', size: 6, style: BorderStyle.SINGLE, space: 4 } },
        spacing: { before: 200, after: 200 },
        children: [],
      }));
    }
  });

  const doc = new Document({
    creator: 'Whatfix',
    title: DOC.title,
    description: DOC.subtitle,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: '35324A' },
          paragraph: { spacing: { line: 360 } },
        }
      }
    },
    sections: [{ children }],
  });

  const base64 = await Packer.toBase64String(doc);
  const slug = (DOC.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  window.parent.postMessage({
    type: 'artifact-download',
    filename: slug + '.docx',
    data: base64,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }, '*');
}
</script>
</body>
</html>
```

## Rules for Populating DOC

- The HTML `<div class="page">` is the visual preview — write it as clean HTML
- The `DOC.sections` array drives the `.docx` export — keep them in sync with the HTML
- Section types: `heading1`, `heading2`, `paragraph`, `callout`, `bullets`, `divider`
- For `bullets` use `{ type: "bullets", items: ["...", "..."] }`
- Filename is derived from `DOC.title`

## After Generating

1. Add more sections or restructure the document?
2. Add a table or data section?
3. Change the document type (proposal, brief, one-pager)?
