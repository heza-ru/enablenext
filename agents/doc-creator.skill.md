---
name: doc-creator
description: Use when the user asks to create a Word document, DOCX file, report, proposal, one-pager, brief, or any formatted long-form document. Generates a downloadable .docx file via code execution.
user-invocable: true
allowed-tools: ["execute_code"]
---

# Document Creator Skill

When triggered, use code execution to generate a `.docx` file using Python's `python-docx` library with Whatfix brand styling.

## Output Rules

- Always produce a real `.docx` file — not inline markdown
- Use `python-docx` for full formatting control
- Apply Whatfix brand typography and colors throughout
- Include a cover page with title, subtitle, date, and Whatfix branding

## Brand Styling

```python
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# Whatfix brand colors (RGB tuples)
ORANGE   = RGBColor(0xFF, 0x6B, 0x18)   # #FF6B18 — headings, accents
INK_700  = RGBColor(0x25, 0x22, 0x3B)   # #25223B — body text, dark elements
INK      = RGBColor(0x35, 0x32, 0x4A)   # #35324A — subheadings
CRIMSON  = RGBColor(0x87, 0x23, 0x45)   # #872345 — callouts, warnings
GRAY_100 = RGBColor(0xF9, 0xF9, 0xF2)   # #F9F9F2 — page/table backgrounds
WHITE    = RGBColor(0xFF, 0xFF, 0xFF)

doc = Document()

# Page margins (2cm all sides)
for section in doc.sections:
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)
```

## Heading Styles

```python
def add_h1(doc, text):
    p = doc.add_heading(text, level=1)
    run = p.runs[0]
    run.font.color.rgb = ORANGE       # Orange H1
    run.font.size = Pt(28)
    run.font.bold = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT

def add_h2(doc, text):
    p = doc.add_heading(text, level=2)
    run = p.runs[0]
    run.font.color.rgb = INK_700
    run.font.size = Pt(18)
    run.font.bold = True

def add_body(doc, text):
    p = doc.add_paragraph(text)
    run = p.runs[0]
    run.font.color.rgb = INK_700
    run.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(8)

def add_callout(doc, text):
    """Orange left-border callout box."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.color.rgb = INK_700
    run.font.size = Pt(11)
    run.font.italic = True
    # Add shading
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'FFE9DC')  # Orange 100
    pPr.append(shd)
```

## Typography Rules

- **H1:** Aeonik Medium 28pt, Orange `#FF6B18` — document title / section openers
- **H2:** Aeonik Regular 18pt, Ink 700 `#25223B` — section headings
- **H3:** Aeonik Regular 14pt, Ink `#35324A` — subsections
- **Body:** Aeonik Regular 11pt, Ink 700 — line height 1.5
- **Callout/highlight:** Orange 100 background `#FFE9DC`, italic body text
- **Table headers:** Orange fill `#FF6B18`, white bold text
- **Sentence case always**

## Document Structure

For most documents, follow this structure:
1. Cover page (title, subtitle, date, prepared by)
2. Table of contents (if >5 pages)
3. Executive summary / overview
4. Body sections (H2 → H3 → body)
5. Conclusion / next steps
6. Appendix (if needed)

## After Generating

Ask:
1. Add a table of contents?
2. Include charts or tables?
3. Export as PDF instead?
