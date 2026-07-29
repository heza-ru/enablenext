---
name: excel-creator
description: Use when the user asks to create a spreadsheet, Excel file, CSV, table, data tracker, report template, dashboard, or any structured data output. Generates an interactive HTML preview with a one-click .xlsx download using ExcelJS — no code execution or API keys required.
user-invocable: true
allowed-tools: ["artifacts"]
---

# Excel Creator Skill

Generate a single self-contained HTML artifact that:
1. **Renders a styled table preview** of the spreadsheet data
2. **Includes a "Download Excel" button** that generates a real `.xlsx` file using ExcelJS (runs in the browser, no server needed)

## Output Format — MANDATORY

ALWAYS deliver the HTML inside an artifact block. NEVER output it as a plain code block.

```
:::artifact{identifier="whatfix-spreadsheet" type="text/html" title="SPREADSHEET TITLE"}
```
<!DOCTYPE html>
...full HTML...
```
:::
```

Use a descriptive kebab-case identifier (e.g. `whatfix-pipeline-tracker`). Reuse the same identifier when updating.

## CRITICAL Rules

- **NO code execution** — everything runs client-side in the HTML artifact
- **All colors from Whatfix palette only**
- **Load ExcelJS from the local bundle only**: `<script src="/libs/exceljs.bare.min.js"></script>` — replaces SheetJS Community Edition, which could only read cell styles, not write them (writing styles is a paid-only SheetJS feature); ExcelJS genuinely writes styling/freeze panes into the exported file.
- The preview table must be styled with Whatfix brand colors
- The downloaded `.xlsx` must also have Whatfix brand colors applied to headers

## Brand Colors

```
#25223B  Ink 700  — page background
#35324A  Ink      — table row alternating
#FF6B18  Orange   — header background, accents
#8A8A9C  Ink 300  — muted text
#FFFFFF  White    — header text, main text on dark
#F9F9F2  Gray 100 — light row alternating
#E5E3DC  Gray 300 — borders
```

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SPREADSHEET_TITLE</title>
<script src="/libs/exceljs.bare.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #25223B;
  color: #FFFFFF;
  min-height: 100vh;
  padding: 2rem;
}

.header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.5rem;
}
.header h1 { font-size: 1.4rem; font-weight: 600; color: #FFFFFF; }
.header .sub { font-size: .8rem; color: #8A8A9C; margin-top: .2rem; }


/* Tab bar for multi-sheet */
.tabs { display: flex; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.tab-btn {
  padding: .35rem .9rem; border-radius: 5px; font-size: .78rem; font-weight: 500;
  border: 1px solid rgba(255,255,255,.1); background: transparent; color: #8A8A9C;
  font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all .15s;
}
.tab-btn.active { background: #FF6B18; border-color: #FF6B18; color: #fff; }

/* Table */
.sheet-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,.08); }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }

thead tr { background: #FF6B18; }
thead th {
  padding: .65rem 1rem; text-align: left; font-weight: 600;
  color: #FFFFFF; white-space: nowrap; letter-spacing: .02em;
  border-right: 1px solid rgba(255,255,255,.15);
}
thead th:last-child { border-right: none; }

tbody tr:nth-child(even) { background: #35324A; }
tbody tr:nth-child(odd)  { background: #2d2a40; }
tbody tr:hover           { background: rgba(255,107,24,.08); }

tbody td {
  padding: .55rem 1rem; color: rgba(255,255,255,.85);
  border-right: 1px solid rgba(255,255,255,.05);
  border-bottom: 1px solid rgba(255,255,255,.05);
}
tbody td:last-child { border-right: none; }

/* Numeric cells right-aligned */
tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }

/* Summary row */
tfoot tr { background: rgba(255,107,24,.1); border-top: 2px solid rgba(255,107,24,.3); }
tfoot td { padding: .6rem 1rem; font-weight: 600; color: #FF6B18; }

.row-count { margin-top: .75rem; font-size: .72rem; color: #8A8A9C; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>SPREADSHEET TITLE</h1>
    <p class="sub">DESCRIPTION · DATE</p>
  </div>
</div>

<!-- Tab buttons (one per sheet — remove if single sheet) -->
<div class="tabs" id="tabs"></div>

<!-- Table container -->
<div class="sheet-wrap" id="sheet-wrap">
  <table id="preview-table">
    <!-- Rendered by JS from SHEETS data below -->
  </table>
</div>
<p class="row-count" id="row-count"></p>

<script>
// ══════════════════════════════════════════════════════
// SHEET DATA — edit this to define the spreadsheet
// Each sheet: { name, headers, rows, summaryRow (optional) }
// rows: array of arrays matching headers order
// summaryRow: array of footer values (use null for blank cells)
// ══════════════════════════════════════════════════════
const SHEETS = [
  {
    name: "Sheet 1",
    headers: ["Column A", "Column B", "Column C", "Column D"],
    numericCols: [2, 3],   // 0-based indices of numeric columns
    rows: [
      ["Row 1A", "Row 1B", 100, 200],
      ["Row 2A", "Row 2B", 150, 300],
      ["Row 3A", "Row 3B", 200, 400],
    ],
    summaryRow: ["Total", "", 450, 900],
  },
  // Add more sheet objects here for multi-sheet workbooks
];

// ── Render preview ────────────────────────────────────
let activeSheet = 0;

function renderSheet(idx) {
  activeSheet = idx;
  const sh = SHEETS[idx];
  const table = document.getElementById('preview-table');
  const numeric = new Set(sh.numericCols || []);

  let html = '<thead><tr>' +
    sh.headers.map(h => `<th>${h}</th>`).join('') +
    '</tr></thead><tbody>';

  sh.rows.forEach(row => {
    html += '<tr>' + row.map((cell, ci) =>
      `<td class="${numeric.has(ci) ? 'num' : ''}">${cell ?? ''}</td>`
    ).join('') + '</tr>';
  });
  html += '</tbody>';

  if (sh.summaryRow) {
    html += '<tfoot><tr>' + sh.summaryRow.map((cell, ci) =>
      `<td class="${numeric.has(ci) ? 'num' : ''}">${cell ?? ''}</td>`
    ).join('') + '</tr></tfoot>';
  }

  table.innerHTML = html;
  document.getElementById('row-count').textContent =
    `${sh.rows.length} rows · ${sh.headers.length} columns`;

  document.querySelectorAll('.tab-btn').forEach((btn, i) =>
    btn.classList.toggle('active', i === idx));
}

function buildTabs() {
  if (SHEETS.length < 2) return;
  const tabs = document.getElementById('tabs');
  SHEETS.forEach((sh, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = sh.name;
    btn.onclick = () => renderSheet(i);
    tabs.appendChild(btn);
  });
}

// ── Excel export ──────────────────────────────────────
// selectedSheetNames (optional string[]) added in Task 14 (export options
// picker) — when provided, only sheets whose `.name` is in the array get
// exported. Omitting it (or passing an empty/non-array value) preserves the
// existing "export every sheet" behavior exactly.
async function downloadExcel(selectedSheetNames) {
  const wb = new ExcelJS.Workbook();
  const sheetsToExport = (Array.isArray(selectedSheetNames) && selectedSheetNames.length > 0)
    ? SHEETS.filter(sh => selectedSheetNames.indexOf(sh.name) !== -1)
    : SHEETS;

  sheetsToExport.forEach(sh => {
    const ws = wb.addWorksheet(sh.name);
    const numeric = new Set(sh.numericCols || []);

    // Header row
    const headerRow = ws.addRow(sh.headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B18' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    // Data rows (right-align numeric columns to match preview)
    sh.rows.forEach(row => {
      const dataRow = ws.addRow(row);
      numeric.forEach(ci => {
        const cell = dataRow.getCell(ci + 1);
        cell.alignment = { horizontal: 'right' };
      });
    });

    // Summary row style (orange text, subtle fill)
    if (sh.summaryRow) {
      const summaryRow = ws.addRow(sh.summaryRow);
      summaryRow.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9DC' } };
        cell.font = { bold: true, color: { argb: 'FFFF6B18' }, name: 'Calibri', size: 11 };
        cell.border = { top: { style: 'medium', color: { argb: 'FFFF6B18' } } };
      });
      numeric.forEach(ci => {
        summaryRow.getCell(ci + 1).alignment = { horizontal: 'right' };
      });
    }

    // Column widths (set after rows are added — only affects width, not content)
    ws.columns = sh.headers.map((h, i) => ({
      width: Math.min(Math.max(
        h.length,
        ...sh.rows.map(r => String(r[i] ?? '').length),
        sh.summaryRow ? String(sh.summaryRow[i] ?? '').length : 0
      ) + 4, 40)
    }));

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const slug = document.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = url;
  a.download = slug + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Init
buildTabs();
renderSheet(0);
</script>
<script src="/libs/download-bridge.js"></script>
</body>
</html>
```

## Rules for Populating SHEETS

- `headers`: array of column name strings
- `rows`: array of arrays — each inner array must have same length as `headers`
- `numericCols`: 0-based indices of columns with numbers — right-aligns them in preview
- `summaryRow`: optional footer row (totals, averages etc) — use `null` for blank cells
- For multi-sheet workbooks add more objects to the `SHEETS` array
- Filename is auto-derived from `document.title` — set it to the spreadsheet topic
- `window.downloadExcel(selectedSheetNames)` accepts an optional `string[]` of sheet `name`s to export; omitting it exports every sheet in `SHEETS` (the existing default). The artifact itself never needs to pass this — the download UI's sheet-selection picker supplies it when the user deselects sheets before downloading.

## After Generating

1. Add more columns, rows, or sheets?
2. Add formulas or calculated columns?
3. Change the column layout or grouping?
