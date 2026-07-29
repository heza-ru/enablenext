//
// Shared document renderer + DOCX exporter for LLM-generated Word documents.
// Loaded via <script src="/libs/doc-renderer.js"> by the doc-creator skill's
// generated artifact. The artifact assigns a document-spec JSON to
// window.DOC; this file turns that into both the visible preview
// (renderDoc) and the native .docx export (downloadDocx, added in Task 6).
//
// Unlike deck-renderer.js, there is no fixed canvas here — a document
// flows top-to-bottom with no per-block geometry table. Each block is a
// registry entry with a render() (appends real DOM to the preview
// container, in flow order) and an exportDocx() (returns docx.js
// Paragraph/Table objects built from the same block data) — one source
// of truth, no DOM scraping, no duplicated content.
(function () {
  var registry = {};

  var A4_WIDTH_MM = 210;
  var A4_HEIGHT_MM = 297;

  function registerBlock(type, def) {
    registry[type] = def;
  }

  function getBlock(type) {
    var block = registry[type];
    if (!block) {
      throw new Error('DocRenderer: no block registered for type "' + type + '"');
    }
    return block;
  }

  function injectBaseStyles() {
    if (document.getElementById('doc-renderer-base-styles')) return;
    var style = document.createElement('style');
    style.id = 'doc-renderer-base-styles';
    style.textContent =
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      "body{font-family:'DM Sans',sans-serif;background:#25223B;min-height:100vh;padding:2rem}" +
      '.doc-page{width:100%;max-width:800px;aspect-ratio:' + A4_WIDTH_MM + '/' + A4_HEIGHT_MM + ';' +
      'min-height:auto;margin:0 auto;background:#F9F9F2;border-radius:8px;' +
      'padding:clamp(2rem,5vw,4rem);box-shadow:0 4px 40px rgba(0,0,0,.4);color:#35324A;' +
      'overflow-y:auto}' +
      '.doc-page h1{font-size:2.2rem;font-weight:600;color:#FF6B18;line-height:1.15;margin-bottom:.5rem}' +
      '.doc-page h2{font-size:1.35rem;font-weight:600;color:#25223B;margin:1.75rem 0 .6rem;line-height:1.3}' +
      '.doc-page h3{font-size:1.05rem;font-weight:600;color:#35324A;margin:1.25rem 0 .4rem}' +
      '.doc-page p{font-size:.95rem;font-weight:400;line-height:1.7;color:#35324A;margin-bottom:.9rem}' +
      '.callout{border-left:4px solid #' + ORANGE + ';background:#' + ORANGE100 + ';' +
      'padding:.75rem 1rem;margin:1rem 0}' +
      '.callout p{font-style:italic;margin-bottom:0}' +
      '.page-break{border-top:2px dashed #' + GRAY300 + ';margin:2rem 0;page-break-after:always}' +
      '.doc-page ul,.doc-page ol{padding-left:1.5rem;margin-bottom:.9rem}' +
      '.doc-page li{font-size:.95rem;line-height:1.7;color:#' + INK + ';margin-bottom:.3rem}' +
      '.doc-page hr{border:none;border-top:2px solid #' + GRAY300 + ';margin:1.75rem 0}' +
      '.doc-page table{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:.88rem}' +
      '.doc-page thead th{background:#' + ORANGE + ';color:#FFFFFF;font-weight:600;padding:.55rem .85rem;text-align:left}' +
      '.doc-page tbody td{padding:.5rem .85rem;border-bottom:1px solid #' + GRAY300 + ';color:#' + INK + '}' +
      '.doc-page tbody tr:nth-child(even) td{background:#F9F9F2}' +
      '.doc-page figure{margin:1.25rem 0}' +
      '.doc-page figure img{max-width:100%;height:auto;display:block}' +
      '.doc-page figcaption{font-size:.8rem;color:#' + GRAY500 + ';margin-top:.4rem}' +
      '.doc-page .doc-subtitle{font-size:1.1rem;font-weight:500;color:#' + GRAY500 + ';margin-bottom:.5rem}' +
      '.doc-page .doc-date{font-size:.8rem;color:#' + GRAY500 + ';margin-bottom:0}' +
      '.doc-page .accent-bar{width:48px;height:4px;background:#' + ORANGE + ';border-radius:2px;margin:1rem 0 1.75rem}' +
      '@page{size:A4;margin:20mm}' +
      '@media print{' +
      'body{background:#FFFFFF;padding:0}' +
      '.doc-page{width:auto;max-width:none;aspect-ratio:none;margin:0;' +
      'background:#FFFFFF;border-radius:0;box-shadow:none;padding:0;overflow:visible}' +
      '.page-break{border-top:none;margin:0;page-break-after:always}' +
      '}';
    document.head.appendChild(style);
  }

  // Shared by renderDoc (preview) and downloadDocx (export) so the visible cover line reads
  // identically in both places: "Prepared by {author}  ·  Whatfix  ·  {date}", gracefully
  // dropping the author/date segments when absent instead of rendering an empty/malformed line.
  function buildCoverDateLine(docSpec) {
    var parts = [];
    if (docSpec.author) parts.push('Prepared by ' + docSpec.author);
    parts.push('Whatfix');
    if (docSpec.date) parts.push(docSpec.date);
    return parts.join('  ·  ');
  }

  function renderDoc(docSpec, mountEl) {
    injectBaseStyles();
    var pageEl = document.createElement('div');
    pageEl.className = 'doc-page';
    if (docSpec.title) {
      // Cover section is automatic/structural — generated from title/subtitle/author/date, not
      // dependent on the LLM remembering to add its own heading1 block (restores pre-redesign behavior).
      var h1 = document.createElement('h1');
      h1.textContent = docSpec.title;
      pageEl.appendChild(h1);
      if (docSpec.subtitle) {
        var subtitleEl = document.createElement('p');
        subtitleEl.className = 'doc-subtitle';
        subtitleEl.textContent = docSpec.subtitle;
        pageEl.appendChild(subtitleEl);
      }
      var dateEl = document.createElement('p');
      dateEl.className = 'doc-date';
      dateEl.textContent = buildCoverDateLine(docSpec);
      pageEl.appendChild(dateEl);
      var accentBar = document.createElement('div');
      accentBar.className = 'accent-bar';
      pageEl.appendChild(accentBar);
      pageEl.appendChild(document.createElement('hr'));
    }
    (docSpec.blocks || []).forEach(function (spec) {
      var block = getBlock(spec.type); // throws if unregistered — fail loudly, not silently
      block.render(spec, pageEl);
    });
    mountEl.innerHTML = '';
    mountEl.appendChild(pageEl);
  }

  var FONT = 'Calibri'; // closest system font to DM Sans, matching the current skill's accepted convention
  var INK700 = '25223B', INK = '35324A', ORANGE = 'FF6B18';
  var GRAY300 = 'E5E3DC', ORANGE100 = 'FFE9DC', GRAY500 = '8A8A9C'; // GRAY500: existing muted caption gray, now named + reused for the cover's subtitle/date-line

  registerBlock('heading1', {
    render: function (spec, containerEl) {
      var h1 = document.createElement('h1');
      h1.textContent = spec.text || '';
      containerEl.appendChild(h1);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_1,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 32, color: INK700, font: FONT })],
        spacing: { before: 360, after: 120 },
      })];
    },
  });

  registerBlock('heading2', {
    render: function (spec, containerEl) {
      var h2 = document.createElement('h2');
      h2.textContent = spec.text || '';
      containerEl.appendChild(h2);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_2,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 24, color: INK, font: FONT })],
        spacing: { before: 240, after: 80 },
      })];
    },
  });

  registerBlock('heading3', {
    render: function (spec, containerEl) {
      var h3 = document.createElement('h3');
      h3.textContent = spec.text || '';
      containerEl.appendChild(h3);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        heading: helpers.HeadingLevel.HEADING_3,
        children: [new helpers.TextRun({ text: spec.text || '', bold: true, size: 20, color: INK, font: FONT })],
        spacing: { before: 200, after: 60 },
      })];
    },
  });

  registerBlock('paragraph', {
    render: function (spec, containerEl) {
      var p = document.createElement('p');
      p.textContent = spec.text || '';
      containerEl.appendChild(p);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        children: [new helpers.TextRun({ text: spec.text || '', size: 22, color: INK, font: FONT })],
        spacing: { after: 160 },
      })];
    },
  });

  registerBlock('bullets', {
    render: function (spec, containerEl) {
      var ul = document.createElement('ul');
      (spec.items || []).forEach(function (text) { // uncapped — documents flow, no fixed canvas to overflow
        var li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      containerEl.appendChild(ul);
    },
    exportDocx: function (spec, helpers) {
      return (spec.items || []).map(function (text) {
        return new helpers.Paragraph({
          bullet: { level: 0 },
          children: [new helpers.TextRun({ text: text, size: 22, color: INK, font: FONT })],
          spacing: { after: 80 },
        });
      });
    },
  });

  registerBlock('numbered', {
    render: function (spec, containerEl) {
      var ol = document.createElement('ol');
      (spec.items || []).forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        ol.appendChild(li);
      });
      containerEl.appendChild(ol);
    },
    exportDocx: function (spec, helpers) {
      return (spec.items || []).map(function (text) {
        return new helpers.Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          children: [new helpers.TextRun({ text: text, size: 22, color: INK, font: FONT })],
          spacing: { after: 80 },
        });
      });
    },
  });

  registerBlock('callout', {
    render: function (spec, containerEl) {
      var div = document.createElement('div');
      div.className = 'callout';
      var p = document.createElement('p');
      p.textContent = spec.text || '';
      div.appendChild(p);
      containerEl.appendChild(div);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        children: [new helpers.TextRun({ text: spec.text || '', italics: true, size: 21, color: INK, font: FONT })],
        spacing: { after: 160, before: 80 },
        shading: { type: 'clear', fill: ORANGE100 },
        border: { left: { color: ORANGE, size: 16, style: 'single', space: 8 } },
        indent: { left: 240 },
      })];
    },
  });

  var MAX_TABLE_COLS = 6; // width constraint: very wide tables break in Word regardless of document length

  registerBlock('table', {
    render: function (spec, containerEl) {
      var table = document.createElement('table');
      var headers = (spec.headers || []).slice(0, MAX_TABLE_COLS); // structural cap: max 6 columns
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      headers.forEach(function (headerText) {
        var th = document.createElement('th');
        th.textContent = headerText;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      var tbody = document.createElement('tbody');
      (spec.rows || []).forEach(function (row) { // rows uncapped — length is not a canvas constraint here
        var tr = document.createElement('tr');
        row.slice(0, MAX_TABLE_COLS).forEach(function (cell) { // same 6-column cap applied per row
          var td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      containerEl.appendChild(table);
    },
    exportDocx: function (spec, helpers) {
      var headers = (spec.headers || []).slice(0, MAX_TABLE_COLS);
      function makeCell(text, isHeader) {
        return new helpers.TableCell({
          width: { size: Math.floor(100 / headers.length), type: helpers.WidthType.PERCENTAGE },
          shading: isHeader ? { fill: ORANGE } : undefined,
          children: [new helpers.Paragraph({
            children: [new helpers.TextRun({ text: text, color: isHeader ? 'FFFFFF' : INK, bold: !!isHeader, font: FONT, size: 20 })],
          })],
        });
      }
      var headerRow = new helpers.TableRow({ children: headers.map(function (h) { return makeCell(h, true); }) });
      var dataRows = (spec.rows || []).map(function (row) {
        return new helpers.TableRow({ children: row.slice(0, MAX_TABLE_COLS).map(function (cell) { return makeCell(cell, false); }) });
      });
      return [new helpers.Table({
        rows: [headerRow].concat(dataRows),
        width: { size: 100, type: helpers.WidthType.PERCENTAGE },
        layout: helpers.TableLayoutType.FIXED,
      })];
    },
  });

  registerBlock('pageBreak', {
    render: function (spec, containerEl) {
      var div = document.createElement('div');
      div.className = 'page-break';
      containerEl.appendChild(div);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({ children: [new helpers.PageBreak()] })];
    },
  });

  registerBlock('divider', {
    render: function (spec, containerEl) {
      var hr = document.createElement('hr');
      containerEl.appendChild(hr);
    },
    exportDocx: function (spec, helpers) {
      return [new helpers.Paragraph({
        border: { bottom: { color: GRAY300, size: 6, style: 'single', space: 4 } },
        spacing: { before: 200, after: 200 },
        children: [],
      })];
    },
  });

  // Duplicated deliberately from deck-renderer.js's identical lookup table —
  // this file has no shared-module system with deck-renderer.js (both are
  // standalone <script src> includes), so this small table is copied, not
  // imported. Keep the two lists in sync if a new PNG-only brand asset is
  // added to /brand/.
  var PNG_ONLY_BRAND_IMAGES = {
    'ai-agents-suite-dark': true,
    'ai-agents-suite-light': true,
    'dap-dark': true,
    'dap-light': true,
    'mirror-dark': true,
    'product-analytics-dark': true,
    'product-suite-dark': true,
    'product-suite-full-dark': true,
    'product-suite-light': true,
    'screensense-dark': true,
    'screensense-suite-dark': true,
  };

  function brandImagePath(key) {
    var ext = PNG_ONLY_BRAND_IMAGES[key] ? 'png' : 'svg';
    // The live preview renders inside a Sandpack iframe on a different origin
    // than the app, so a bare relative path 404s there. patchHtmlForSandpack()
    // (client/src/hooks/Artifacts/useArtifactProps.ts) injects
    // window._BRAND_ORIGIN with the app's real origin for exactly this case;
    // prepend it when present. Falls back to a bare relative path for
    // standalone/local contexts (e.g. tests, a plain HTML file with no
    // Sandpack wrapper) where no such origin is injected.
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return origin + '/brand/' + key + '.' + ext;
  }

  registerBlock('image', {
    render: function (spec, containerEl) {
      var figure = document.createElement('figure');
      var img = document.createElement('img');
      img.src = brandImagePath(spec.brandImage);
      img.style.cssText = 'max-width:100%;height:auto;';
      figure.appendChild(img);
      if (spec.caption) {
        var figcaption = document.createElement('figcaption');
        figcaption.textContent = spec.caption;
        figure.appendChild(figcaption);
      }
      containerEl.appendChild(figure);
    },
    exportDocx: async function (spec, helpers) {
      // docx.js's ImageRun requires an explicit `type` matching the embedded bytes' real format
      // (see docx.iife.js ~line 15067: the media part is named `<hash>.<type>` and a missing/wrong
      // `type` produces a package with no matching [Content_Types].xml entry — a corrupt .docx that
      // python-docx/Word cannot open). docx.js *can* accept `type: 'svg'`, but only together with a
      // `fallback` raster image (it dereferences `options.fallback.type` unconditionally for SVGs,
      // ~line 15068) — we don't have a PNG fallback for any brand SVG, so SVG-only brand images are
      // not embeddable via this path. Restrict DOCX image export to the PNG-only allowlist (the same
      // one brandImagePath() already uses for the live preview) and fail loudly, not silently, for
      // anything else — a clear thrown error beats shipping a corrupt file.
      if (!PNG_ONLY_BRAND_IMAGES[spec.brandImage]) {
        throw new Error(
          'DocRenderer: cannot embed brand image "' + spec.brandImage + '" in a .docx export — ' +
          'it resolves to an SVG, and docx.js can only embed SVGs alongside a raster fallback image ' +
          'that is not available here. Only PNG-allowlisted brand images (see PNG_ONLY_BRAND_IMAGES) ' +
          'can be used in an image block that will be exported to .docx.'
        );
      }
      var path = brandImagePath(spec.brandImage);
      var res = await fetch(path);
      var buffer = await res.arrayBuffer();
      var paragraphs = [new helpers.Paragraph({
        children: [new helpers.ImageRun({ data: buffer, type: 'png', transformation: { width: 400, height: 300 } })],
      })];
      if (spec.caption) {
        paragraphs.push(new helpers.Paragraph({
          children: [new helpers.TextRun({ text: spec.caption, italics: true, size: 18, color: INK, font: FONT })],
          spacing: { after: 160 },
        }));
      }
      return paragraphs;
    },
  });

  async function downloadDocx() {
    var doc = window.DOC;
    var helpers = {
      // AlignmentType/BorderStyle/ShadingType are deliberately not passed here — every block below
      // uses plain string literals ('single', 'clear', etc.) for those, and docx.js accepts both;
      // no block reads helpers.AlignmentType/BorderStyle/ShadingType, so they'd be dead weight.
      Paragraph: window.docx.Paragraph, TextRun: window.docx.TextRun,
      HeadingLevel: window.docx.HeadingLevel,
      TableRow: window.docx.TableRow, TableCell: window.docx.TableCell,
      Table: window.docx.Table, WidthType: window.docx.WidthType,
      TableLayoutType: window.docx.TableLayoutType,
      PageBreak: window.docx.PageBreak, ImageRun: window.docx.ImageRun,
    };

    var children = [];
    if (doc.title) {
      // Mirrors renderDoc's cover section — same title/subtitle/author/date fields, automatic
      // and structural, matching the pre-redesign visible cover (not just invisible file metadata).
      children.push(new helpers.Paragraph({
        children: [new helpers.TextRun({ text: doc.title, bold: true, size: 56, color: ORANGE, font: FONT })],
        spacing: { after: 120 },
      }));
      if (doc.subtitle) {
        children.push(new helpers.Paragraph({
          children: [new helpers.TextRun({ text: doc.subtitle, size: 24, color: GRAY500, font: FONT })],
          spacing: { after: 80 },
        }));
      }
      children.push(new helpers.Paragraph({
        children: [new helpers.TextRun({ text: buildCoverDateLine(doc), size: 18, color: GRAY500, font: FONT })],
        spacing: { after: 300 },
        border: { bottom: { color: ORANGE, size: 12, style: 'single', space: 8 } }, // 'single', matching divider/callout's existing string-literal border style convention
      }));
    }
    for (var i = 0; i < (doc.blocks || []).length; i++) {
      var spec = doc.blocks[i];
      var block = getBlock(spec.type);
      var items = await Promise.resolve(block.exportDocx(spec, helpers)); // uniform await — image's exportDocx is async, the rest resolve immediately
      children = children.concat(items);
    }

    var docxDoc = new window.docx.Document({
      creator: doc.author || 'Whatfix', // doc.author, if the skill supplied one, becomes the file's Author property
      title: doc.title,
      description: doc.subtitle,
      subject: doc.date, // doc.date has no dedicated docx property; "subject" is the closest core-properties fit
      numbering: {
        config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'start' }] }],
      },
      styles: {
        default: { document: { run: { font: FONT, size: 22, color: INK }, paragraph: { spacing: { line: 360 } } } },
      },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 } } }, // A4 in twips (210mm x 297mm), per redesign spec
        children: children,
      }],
    });

    var blob = await window.docx.Packer.toBlob(docxDoc);
    var slug = (doc.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  window.DocRenderer = {
    registerBlock: registerBlock,
    getBlock: getBlock,
    renderDoc: renderDoc,
    downloadDocx: downloadDocx,
  };
  window.downloadDocx = downloadDocx;
})();
