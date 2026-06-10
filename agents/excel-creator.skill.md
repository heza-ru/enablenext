---
name: excel-creator
description: Use when the user asks to create a spreadsheet, Excel file, CSV, table, data tracker, dashboard, report template, or any structured data output. Generates a downloadable file via code execution.
user-invocable: true
allowed-tools: ["execute_code"]
---

# Excel Creator Skill

When triggered, use code execution to generate a `.xlsx` file using Python's `openpyxl` library.

## Output Rules

- Always produce a real `.xlsx` file via code execution — not a markdown table
- Use `openpyxl` for full formatting control; fall back to `pandas` + `xlsxwriter` for data-heavy sheets
- Apply Whatfix brand colors to headers and key rows
- Include column auto-sizing, frozen header row, and filter dropdowns by default
- For dashboards: use multiple sheets (Summary + Data tabs)

## Brand Styling

```python
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Whatfix brand colors
ORANGE     = "FF6B18"   # header fill
INK_700    = "25223B"   # header text (white on orange) → use FFFFFF
INK        = "35324A"   # subheader fill
WHITE      = "FFFFFF"
GRAY_100   = "F9F9F2"   # alternating row fill
GRAY_300   = "E5E3DC"   # border color
CRIMSON    = "872345"   # alert/negative values

# Header style
header_fill = PatternFill(start_color=ORANGE, end_color=ORANGE, fill_type="solid")
header_font = Font(name="Calibri", bold=True, color=WHITE, size=11)
header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Subheader style  
sub_fill = PatternFill(start_color=INK, end_color=INK, fill_type="solid")
sub_font = Font(name="Calibri", bold=True, color=WHITE, size=10)

# Alternating row fill
alt_fill = PatternFill(start_color=GRAY_100, end_color=GRAY_100, fill_type="solid")

# Border
thin = Side(style="thin", color=GRAY_300)
border = Border(left=thin, right=thin, top=thin, bottom=thin)
```

## Standard Sheet Structure

```python
import openpyxl
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "Sheet Name"

# Freeze header row
ws.freeze_panes = "A2"

# Auto-filter
ws.auto_filter.ref = ws.dimensions

# Auto-size columns
for col in ws.columns:
    max_len = max(len(str(cell.value or "")) for cell in col)
    ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 50)

wb.save("output.xlsx")
print("Saved: output.xlsx")
```

## After Generating

Ask:
1. Add more columns or sheets?
2. Include formulas or calculated fields?
3. Export as CSV instead?
