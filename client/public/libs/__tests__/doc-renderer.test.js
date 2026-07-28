const fs = require('fs');
const path = require('path');

function loadDocRenderer() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'doc-renderer.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(src);
  return window.DocRenderer;
}

describe('DocRenderer registry', () => {
  it('registers and retrieves a block by type', () => {
    const DocRenderer = loadDocRenderer();
    const render = () => {};
    const exportDocx = () => [];
    DocRenderer.registerBlock('test_block', { render, exportDocx });
    const block = DocRenderer.getBlock('test_block');
    expect(block.render).toBe(render);
    expect(block.exportDocx).toBe(exportDocx);
  });

  it('throws a clear error for an unregistered block type', () => {
    const DocRenderer = loadDocRenderer();
    expect(() => DocRenderer.getBlock('does_not_exist')).toThrow(/does_not_exist/);
  });
});

describe('renderDoc', () => {
  it('mounts one block element per spec, tagged with its type, in order', () => {
    const DocRenderer = loadDocRenderer();
    DocRenderer.registerBlock('heading1', {
      render: (spec, containerEl) => {
        var h1 = document.createElement('h1');
        h1.textContent = spec.text;
        containerEl.appendChild(h1);
      },
      exportDocx: () => [],
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    // No top-level `title` here — this test is about generic block mounting/ordering, not the
    // cover section (covered separately below), and a title would add its own h1 ahead of this one.
    DocRenderer.renderDoc({ blocks: [{ type: 'heading1', text: 'Hello' }] }, mount);

    const page = mount.querySelector('.doc-page');
    expect(page).not.toBeNull();
    expect(page.querySelector('h1').textContent).toBe('Hello');
  });

  it('throws a clear error if a block spec names an unregistered type', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    expect(() =>
      DocRenderer.renderDoc({ blocks: [{ type: 'nonexistent' }] }, mount),
    ).toThrow(/nonexistent/);
  });
});

function makeDocxHelpers() {
  const calls = { Paragraph: [], TextRun: [] };
  class TextRun { constructor(opts) { calls.TextRun.push(opts); Object.assign(this, opts); } }
  class Paragraph { constructor(opts) { calls.Paragraph.push(opts); Object.assign(this, opts); } }
  const HeadingLevel = { HEADING_1: 'Heading1', HEADING_2: 'Heading2', HEADING_3: 'Heading3' };
  return { helpers: { Paragraph, TextRun, HeadingLevel }, calls };
}

describe('block: heading1/heading2/heading3', () => {
  it.each([['heading1', 'h1'], ['heading2', 'h2'], ['heading3', 'h3']])(
    '%s renders the right tag with the right text',
    (type, tag) => {
      const DocRenderer = loadDocRenderer();
      const containerEl = document.createElement('div');
      DocRenderer.getBlock(type).render({ type, text: 'Section title' }, containerEl);
      const el = containerEl.querySelector(tag);
      expect(el).not.toBeNull();
      expect(el.textContent).toBe('Section title');
    },
  );

  it('heading1 exports a HEADING_1 paragraph with the heading text', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('heading1').exportDocx({ type: 'heading1', text: 'Section title' }, helpers);
    expect(calls.Paragraph[0].heading).toBe('Heading1');
    expect(calls.TextRun[0].text).toBe('Section title');
  });
});

describe('block: paragraph', () => {
  it('renders a <p> with the body text', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('paragraph').render({ type: 'paragraph', text: 'Body copy.' }, containerEl);
    expect(containerEl.querySelector('p').textContent).toBe('Body copy.');
  });

  it('exports a plain (non-heading) paragraph with the body text', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('paragraph').exportDocx({ type: 'paragraph', text: 'Body copy.' }, helpers);
    expect(calls.Paragraph[0].heading).toBeUndefined();
    expect(calls.TextRun[0].text).toBe('Body copy.');
  });
});

describe('block: bullets', () => {
  it('renders one <li> per item inside a <ul>, uncapped', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('bullets').render({ type: 'bullets', items: ['One', 'Two', 'Three', 'Four', 'Five'] }, containerEl);
    const items = containerEl.querySelectorAll('ul li');
    expect(items.length).toBe(5); // uncapped — documents can be as long as needed
  });

  it('exports one bullet paragraph per item', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('bullets').exportDocx({ type: 'bullets', items: ['One', 'Two'] }, helpers);
    expect(calls.Paragraph.length).toBe(2);
    expect(calls.Paragraph[0].bullet).toEqual({ level: 0 });
  });
});

describe('block: numbered', () => {
  it('renders one <li> per item inside an <ol>', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('numbered').render({ type: 'numbered', items: ['First', 'Second'] }, containerEl);
    expect(containerEl.querySelectorAll('ol li').length).toBe(2);
  });

  it('exports one numbered paragraph per item, referencing the shared numbering config', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('numbered').exportDocx({ type: 'numbered', items: ['First', 'Second'] }, helpers);
    expect(calls.Paragraph.length).toBe(2);
    expect(calls.Paragraph[0].numbering).toEqual({ reference: 'default-numbering', level: 0 });
  });
});

describe('block: callout', () => {
  it('renders the callout text inside a .callout box', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('callout').render({ type: 'callout', text: 'Key insight.' }, containerEl);
    expect(containerEl.querySelector('.callout').textContent).toBe('Key insight.');
  });

  it('exports a shaded, bordered paragraph', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('callout').exportDocx({ type: 'callout', text: 'Key insight.' }, helpers);
    expect(calls.Paragraph[0].shading).toBeDefined();
    expect(calls.Paragraph[0].border.left).toBeDefined();
  });

  it('injects real CSS targeting .callout with the orange border + shading, so the preview matches the docx export visually (Bug 2 regression guard)', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    DocRenderer.renderDoc({ blocks: [{ type: 'callout', text: 'Key insight.' }] }, containerEl);

    expect(containerEl.querySelector('.callout')).not.toBeNull();
    const styleText = document.getElementById('doc-renderer-base-styles').textContent;
    expect(styleText).toMatch(/\.callout\s*\{[^}]*border-left:[^}]*#FF6B18/);
    expect(styleText).toMatch(/\.callout\s*\{[^}]*background:[^}]*#FFE9DC/);
  });
});

describe('block: divider', () => {
  it('renders an <hr>', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('divider').render({ type: 'divider' }, containerEl);
    expect(containerEl.querySelector('hr')).not.toBeNull();
  });

  it('exports a bottom-bordered empty paragraph', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    DocRenderer.getBlock('divider').exportDocx({ type: 'divider' }, helpers);
    expect(calls.Paragraph[0].border.bottom).toBeDefined();
  });
});

describe('injected base styles: table/lists/divider/image CSS (final-review fix)', () => {
  it('injects CSS for table/thead/tbody, ul/ol/li, hr, and figure/figcaption selectors', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DocRenderer.renderDoc({ blocks: [{ type: 'divider' }] }, mount);

    const styleText = document.getElementById('doc-renderer-base-styles').textContent;

    expect(styleText).toMatch(/\.doc-page table\s*\{[^}]*border-collapse:collapse/);
    expect(styleText).toMatch(/\.doc-page thead th\s*\{[^}]*background:#FF6B18[^}]*color:#FFFFFF/);
    expect(styleText).toMatch(/\.doc-page tbody td\s*\{[^}]*border-bottom:[^}]*#E5E3DC/);
    expect(styleText).toMatch(/\.doc-page tbody tr:nth-child\(even\) td\s*\{[^}]*background:#F9F9F2/);
    expect(styleText).toMatch(/\.doc-page ul,\s*\.doc-page ol\s*\{[^}]*padding-left/);
    expect(styleText).toMatch(/\.doc-page li\s*\{[^}]*font-size:\.95rem[^}]*line-height:1\.7/);
    expect(styleText).toMatch(/\.doc-page hr\s*\{[^}]*border-top:2px solid #E5E3DC/);
    expect(styleText).toMatch(/\.doc-page figure\s*\{/);
    expect(styleText).toMatch(/\.doc-page figcaption\s*\{/);
  });
});

describe('injected base styles: print stylesheet (print magnified-card bug fix)', () => {
  it('injects an @media print block', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DocRenderer.renderDoc({ blocks: [{ type: 'divider' }] }, mount);

    const styleText = document.getElementById('doc-renderer-base-styles').textContent;

    expect(styleText).toMatch(/@media print\s*\{/);
  });

  it('flattens .doc-page back to a plain flowing document for print, removing the screen-only card chrome', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DocRenderer.renderDoc({ blocks: [{ type: 'divider' }] }, mount);

    const styleText = document.getElementById('doc-renderer-base-styles').textContent;
    const printBlockMatch = styleText.match(/@media print\s*\{([\s\S]*)\}\s*$/);
    expect(printBlockMatch).not.toBeNull();
    const printBlock = printBlockMatch[1];

    expect(printBlock).toMatch(/\.doc-page\s*\{[^}]*box-shadow:none/);
    expect(printBlock).toMatch(/\.doc-page\s*\{[^}]*border-radius:0/);
  });

  it('adds a standalone @page rule sizing printed pages to A4', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DocRenderer.renderDoc({ blocks: [{ type: 'divider' }] }, mount);

    const styleText = document.getElementById('doc-renderer-base-styles').textContent;

    expect(styleText).toMatch(/@page\s*\{size:A4/);
  });
});

describe('block: table', () => {
  it('renders a header row and one row per data row, uncapped rows', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('table').render({
      type: 'table',
      headers: ['Feature', 'Status'],
      rows: [['Tables', 'Fixed'], ['Images', 'Fixed'], ['Numbered lists', 'Fixed']],
    }, containerEl);
    expect(containerEl.querySelectorAll('thead th').length).toBe(2);
    expect(containerEl.querySelectorAll('tbody tr').length).toBe(3); // rows uncapped
  });

  it('caps headers (and each row) at 6 columns by construction', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    const headers = ['A', 'B', 'C', 'D', 'E', 'F', 'G — dropped'];
    DocRenderer.getBlock('table').render({ type: 'table', headers, rows: [headers.slice()] }, containerEl);
    expect(containerEl.querySelectorAll('thead th').length).toBe(6);
    expect(containerEl.querySelectorAll('tbody tr td').length).toBe(6);
  });

  it('exports a real docx.js Table with a header row and data rows, same 6-column cap', () => {
    const DocRenderer = loadDocRenderer();
    const calls = { Table: [], TableRow: [], TableCell: [] };
    class TableCell { constructor(opts) { calls.TableCell.push(opts); Object.assign(this, opts); } }
    class TableRow { constructor(opts) { calls.TableRow.push(opts); Object.assign(this, opts); } }
    class Table { constructor(opts) { calls.Table.push(opts); Object.assign(this, opts); } }
    const { helpers: baseHelpers } = makeDocxHelpers();
    const helpers = Object.assign({}, baseHelpers, { Table, TableRow, TableCell, WidthType: { PERCENTAGE: 'pct' } });

    const result = DocRenderer.getBlock('table').exportDocx({
      type: 'table',
      headers: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      rows: [['1', '2', '3', '4', '5', '6', '7']],
    }, helpers);

    expect(result.length).toBe(1);
    expect(calls.TableRow.length).toBe(2); // 1 header row + 1 data row
    expect(calls.TableRow[0].children.length).toBe(6); // header row capped at 6
    expect(calls.TableRow[1].children.length).toBe(6); // data row capped at 6
  });
});

describe('block: image', () => {
  it('renders an <img> pointing at the resolved brand asset path, plus an optional caption', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'dap-dark', caption: 'DAP product mark' }, containerEl);
    const img = containerEl.querySelector('img');
    expect(img.src).toContain('/brand/dap-dark.png'); // dap-dark is PNG-only, matching deck-renderer.js's allowlist
    expect(containerEl.querySelector('figcaption').textContent).toBe('DAP product mark');
  });

  it('resolves a non-allowlisted key to .svg', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'authoring-agent-dark' }, containerEl);
    expect(containerEl.querySelector('img').src).toContain('/brand/authoring-agent-dark.svg');
  });

  it('exports an async ImageRun paragraph after fetching the real image bytes', async () => {
    const DocRenderer = loadDocRenderer();
    const { helpers } = makeDocxHelpers();
    const fetchedBuffers = [];
    class ImageRun { constructor(opts) { Object.assign(this, opts); } }
    helpers.ImageRun = ImageRun;
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => { const buf = new ArrayBuffer(4); fetchedBuffers.push(buf); return buf; } });

    const result = await DocRenderer.getBlock('image').exportDocx({ type: 'image', brandImage: 'dap-dark' }, helpers);

    expect(global.fetch).toHaveBeenCalledWith('/brand/dap-dark.png');
    expect(result[0].children[0]).toBeInstanceOf(ImageRun);
    expect(fetchedBuffers.length).toBe(1);
    delete global.fetch;
  });

  it('passes an explicit type:"png" to ImageRun so docx.js can name the embedded media part correctly (Bug 1 regression guard)', async () => {
    const DocRenderer = loadDocRenderer();
    const { helpers } = makeDocxHelpers();
    class ImageRun { constructor(opts) { Object.assign(this, opts); } }
    helpers.ImageRun = ImageRun;
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) });

    const result = await DocRenderer.getBlock('image').exportDocx({ type: 'image', brandImage: 'dap-dark' }, helpers);

    // Without an explicit `type`, docx.iife.js names the media part `<hash>.undefined` and the
    // resulting .docx has no matching [Content_Types].xml entry — a corrupt package (confirmed via
    // python-docx KeyError during verification). `type` must exactly match the fetched file's real
    // extension, which is `.png` for PNG-allowlisted brand images.
    expect(result[0].children[0].type).toBe('png');
    delete global.fetch;
  });

  it('throws a clear, descriptive error instead of silently producing a corrupt docx for a non-PNG-allowlisted (SVG) brand image', async () => {
    const DocRenderer = loadDocRenderer();
    const { helpers } = makeDocxHelpers();
    class ImageRun { constructor(opts) { Object.assign(this, opts); } }
    helpers.ImageRun = ImageRun;
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) });

    await expect(
      DocRenderer.getBlock('image').exportDocx({ type: 'image', brandImage: 'authoring-agent-dark' }, helpers),
    ).rejects.toThrow(/authoring-agent-dark/);
    // The fetch must not even be attempted for a non-embeddable SVG — fail before touching the network.
    expect(global.fetch).not.toHaveBeenCalled();
    delete global.fetch;
  });

  it('constructs a real docx.js ImageRun (via the actual docx.iife.js bundle) with type "png" for a PNG-allowlisted key', async () => {
    const docxSrc = fs.readFileSync(path.join(__dirname, '..', 'docx.iife.js'), 'utf8');
    // The test file is transpiled to a strict-mode ES module, where a plain eval() of `var docx = ...`
    // can't leak `docx` into any accessible scope. `new Function` gives the bundle its own (non-strict)
    // function scope we can pull `docx` back out of, without touching window/global.
    // eslint-disable-next-line no-new-func
    const RealDocx = new Function(docxSrc + '\nreturn docx;')();
    const RealImageRun = RealDocx.ImageRun;

    const DocRenderer = loadDocRenderer();
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) });

    const result = await DocRenderer.getBlock('image').exportDocx(
      { type: 'image', brandImage: 'dap-dark' },
      { Paragraph: class { constructor(opts) { Object.assign(this, opts); } }, TextRun: class { constructor(opts) { Object.assign(this, opts); } }, ImageRun: RealImageRun },
    );

    const imageRun = result[0].children[0];
    expect(imageRun).toBeInstanceOf(RealImageRun);
    expect(imageRun.imageData.type).toBe('png');
    delete global.fetch;
  });

  describe('window._BRAND_ORIGIN (Sandpack iframe origin patching)', () => {
    afterEach(() => {
      delete window._BRAND_ORIGIN;
    });

    it('prefixes the rendered <img src> with the injected brand origin when window._BRAND_ORIGIN is set', () => {
      window._BRAND_ORIGIN = 'https://example-app.com';
      const DocRenderer = loadDocRenderer();
      const containerEl = document.createElement('div');
      DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'dap-dark' }, containerEl);
      expect(containerEl.querySelector('img').src).toBe('https://example-app.com/brand/dap-dark.png');
    });

    it('falls back to a plain relative /brand/ path when window._BRAND_ORIGIN is not set', () => {
      const DocRenderer = loadDocRenderer();
      const containerEl = document.createElement('div');
      DocRenderer.getBlock('image').render({ type: 'image', brandImage: 'dap-dark' }, containerEl);
      expect(containerEl.querySelector('img').src).toContain('/brand/dap-dark.png');
      expect(containerEl.querySelector('img').src).not.toContain('example-app.com');
    });

    it('fetches from the origin-prefixed URL for docx export when window._BRAND_ORIGIN is set', async () => {
      window._BRAND_ORIGIN = 'https://example-app.com';
      const DocRenderer = loadDocRenderer();
      const { helpers } = makeDocxHelpers();
      class ImageRun { constructor(opts) { Object.assign(this, opts); } }
      helpers.ImageRun = ImageRun;
      global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) });

      await DocRenderer.getBlock('image').exportDocx({ type: 'image', brandImage: 'dap-dark' }, helpers);

      expect(global.fetch).toHaveBeenCalledWith('https://example-app.com/brand/dap-dark.png');
      delete global.fetch;
    });
  });
});

describe('block: pageBreak', () => {
  it('renders a page-break hint element', () => {
    const DocRenderer = loadDocRenderer();
    const containerEl = document.createElement('div');
    DocRenderer.getBlock('pageBreak').render({ type: 'pageBreak' }, containerEl);
    expect(containerEl.querySelector('.page-break')).not.toBeNull();
  });

  it('exports a real docx.js page break', () => {
    const DocRenderer = loadDocRenderer();
    const { helpers, calls } = makeDocxHelpers();
    class PageBreak {}
    helpers.PageBreak = PageBreak;
    const result = DocRenderer.getBlock('pageBreak').exportDocx({ type: 'pageBreak' }, helpers);
    expect(result[0].children[0]).toBeInstanceOf(PageBreak);
  });

  it('injects a validly #-prefixed hex color for the .page-break border, not a bare hex string (Bug 3 regression guard)', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DocRenderer.renderDoc({ blocks: [{ type: 'pageBreak' }] }, mount);

    const styleText = document.getElementById('doc-renderer-base-styles').textContent;
    // A bare (unprefixed) hex color inside a CSS declaration is invalid and gets silently dropped by
    // the browser; the fix must produce '#E5E3DC', not the bare 'E5E3DC' the pre-fix code emitted.
    expect(styleText).toContain('#E5E3DC');
    expect(styleText).not.toMatch(/dashed E5E3DC/); // the old, unprefixed (invalid) form must be gone
  });
});

describe('downloadDocx', () => {
  it('builds a Document with A4 page size and one exportDocx result per block, awaiting async blocks', async () => {
    const DocRenderer = loadDocRenderer();
    const exportedSpecs = [];
    DocRenderer.registerBlock('test_export_block', {
      render: () => {},
      exportDocx: async (spec) => { exportedSpecs.push(spec); return [{ marker: spec.text }]; },
    });

    let capturedDocumentOpts;
    class FakeDocument { constructor(opts) { capturedDocumentOpts = opts; } }
    class FakePacker { static toBlob() { return Promise.resolve(new Blob(['fake docx bytes'])); } }
    global.docx = {
      Document: FakeDocument, Packer: FakePacker, Paragraph: class {}, TextRun: class {},
      HeadingLevel: {}, AlignmentType: {}, BorderStyle: {}, ShadingType: {},
      TableRow: class {}, TableCell: class {}, Table: class {}, WidthType: {},
      PageBreak: class {}, ImageRun: class {},
    };
    window.docx = global.docx;

    // Mock URL and document APIs
    global.URL = { createObjectURL: jest.fn().mockReturnValue('blob:fake-url') };
    const mockLink = { href: '', download: '', click: jest.fn() };
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tag) => {
      if (tag === 'a') {
        return mockLink;
      }
      return originalCreateElement.call(document, tag);
    });
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    // No title here on purpose — this test is about block iteration/A4/numbering wiring in
    // isolation. Cover-section behavior (title present/absent) is covered separately below.
    window.DOC = {
      blocks: [{ type: 'test_export_block', text: 'A' }, { type: 'test_export_block', text: 'B' }],
    };

    await DocRenderer.downloadDocx();

    expect(exportedSpecs).toEqual([{ type: 'test_export_block', text: 'A' }, { type: 'test_export_block', text: 'B' }]);
    expect(capturedDocumentOpts.sections[0].properties.page.size).toEqual({ width: 11906, height: 16838 }); // A4 in twips
    expect(capturedDocumentOpts.sections[0].children).toEqual([{ marker: 'A' }, { marker: 'B' }]);
    expect(capturedDocumentOpts.numbering.config[0].reference).toBe('default-numbering'); // numbering config wired correctly

    // Cleanup
    document.createElement = originalCreateElement;
  });
});

describe('renderDoc: automatic cover section (restores pre-redesign visible title/subtitle/author/date)', () => {
  it('renders h1/.doc-subtitle/.doc-date/.accent-bar before the first content block when title is present', () => {
    const DocRenderer = loadDocRenderer();
    DocRenderer.registerBlock('marker_block', {
      render: (spec, containerEl) => {
        const div = document.createElement('div');
        div.className = 'marker-block';
        containerEl.appendChild(div);
      },
      exportDocx: () => [],
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    DocRenderer.renderDoc({
      title: 'Q3 Report',
      subtitle: 'Quarterly business review',
      author: 'Jane Doe',
      date: 'July 2026',
      blocks: [{ type: 'marker_block' }],
    }, mount);

    const page = mount.querySelector('.doc-page');
    const h1 = page.querySelector('h1');
    const subtitle = page.querySelector('.doc-subtitle');
    const dateEl = page.querySelector('.doc-date');
    const accentBar = page.querySelector('.accent-bar');
    expect(h1.textContent).toBe('Q3 Report');
    expect(subtitle.textContent).toBe('Quarterly business review');
    expect(dateEl.textContent).toContain('Jane Doe');
    expect(dateEl.textContent).toContain('July 2026');
    expect(accentBar).not.toBeNull();

    // All cover elements must precede the first real content block in DOM order.
    const marker = page.querySelector('.marker-block');
    const all = Array.from(page.children);
    expect(all.indexOf(h1)).toBeLessThan(all.indexOf(marker));
    expect(all.indexOf(subtitle)).toBeLessThan(all.indexOf(marker));
    expect(all.indexOf(dateEl)).toBeLessThan(all.indexOf(marker));
    expect(all.indexOf(accentBar)).toBeLessThan(all.indexOf(marker));
  });

  it('renders no cover section at all when title is absent (standalone spec with only blocks)', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    DocRenderer.renderDoc({ blocks: [{ type: 'divider' }] }, mount);

    const page = mount.querySelector('.doc-page');
    expect(page.querySelector('h1')).toBeNull();
    expect(page.querySelector('.doc-subtitle')).toBeNull();
    expect(page.querySelector('.doc-date')).toBeNull();
    expect(page.querySelector('.accent-bar')).toBeNull();
  });

  it('does not throw and does not render a malformed/empty date line when only title is present', () => {
    const DocRenderer = loadDocRenderer();
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    expect(() => {
      DocRenderer.renderDoc({ title: 'Solo Title', blocks: [] }, mount);
    }).not.toThrow();

    const page = mount.querySelector('.doc-page');
    expect(page.querySelector('h1').textContent).toBe('Solo Title');
    expect(page.querySelector('.doc-subtitle')).toBeNull();
    const dateEl = page.querySelector('.doc-date');
    expect(dateEl).not.toBeNull();
    expect(dateEl.textContent.trim().length).toBeGreaterThan(0);
    expect(dateEl.textContent).not.toMatch(/^\s*·|·\s*$/); // no dangling separator from a missing segment
  });
});

describe('downloadDocx: automatic cover section', () => {
  function setupDownloadDocxHarness() {
    class FakeDocument { constructor(opts) { this.__opts = opts; } }
    class FakePacker { static toBlob() { return Promise.resolve(new Blob(['fake docx bytes'])); } }
    global.docx = {
      Document: FakeDocument, Packer: FakePacker, Paragraph: class Paragraph { constructor(opts) { Object.assign(this, opts); } },
      TextRun: class TextRun { constructor(opts) { Object.assign(this, opts); } },
      HeadingLevel: {}, TableRow: class {}, TableCell: class {}, Table: class {}, WidthType: {},
      PageBreak: class {}, ImageRun: class {},
    };
    window.docx = global.docx;
    global.URL = { createObjectURL: jest.fn().mockReturnValue('blob:fake-url') };
    const mockLink = { href: '', download: '', click: jest.fn() };
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tag) => (tag === 'a' ? mockLink : originalCreateElement.call(document, tag)));
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
    return { originalCreateElement };
  }

  it('puts the cover Paragraphs (title/subtitle/date-line) first, before any block-derived Paragraphs, when title is present', async () => {
    const DocRenderer = loadDocRenderer();
    const { originalCreateElement } = setupDownloadDocxHarness();
    DocRenderer.registerBlock('marker_block2', {
      render: () => {},
      exportDocx: () => [new window.docx.Paragraph({ __marker: 'block' })],
    });

    let capturedOpts;
    const OrigDocument = window.docx.Document;
    window.docx.Document = class extends OrigDocument { constructor(opts) { super(opts); capturedOpts = opts; } };

    window.DOC = {
      title: 'Q3 Report', subtitle: 'Quarterly review', author: 'Jane Doe', date: 'July 2026',
      blocks: [{ type: 'marker_block2' }],
    };

    await DocRenderer.downloadDocx();

    const children = capturedOpts.sections[0].children;
    expect(children.length).toBe(4); // title + subtitle + date-line + 1 block paragraph
    expect(children[0].children[0].text).toBe('Q3 Report');
    expect(children[0].children[0].bold).toBe(true);
    expect(children[1].children[0].text).toBe('Quarterly review');
    expect(children[2].children[0].text).toContain('Jane Doe');
    expect(children[2].children[0].text).toContain('July 2026');
    expect(children[2].border.bottom).toBeDefined();
    expect(children[3].__marker).toBe('block'); // block-derived paragraph comes after the cover

    document.createElement = originalCreateElement;
  });

  it('does not throw and skips the cover entirely when title is absent', async () => {
    const DocRenderer = loadDocRenderer();
    const { originalCreateElement } = setupDownloadDocxHarness();
    DocRenderer.registerBlock('marker_block3', {
      render: () => {},
      exportDocx: () => [new window.docx.Paragraph({ __marker: 'onlyblock' })],
    });

    let capturedOpts;
    const OrigDocument = window.docx.Document;
    window.docx.Document = class extends OrigDocument { constructor(opts) { super(opts); capturedOpts = opts; } };

    window.DOC = { blocks: [{ type: 'marker_block3' }] };

    await expect(DocRenderer.downloadDocx()).resolves.not.toThrow();

    const children = capturedOpts.sections[0].children;
    expect(children.length).toBe(1);
    expect(children[0].__marker).toBe('onlyblock');

    document.createElement = originalCreateElement;
  });

  it('does not throw and produces no malformed date-line paragraph when title is present but subtitle/author/date are absent', async () => {
    const DocRenderer = loadDocRenderer();
    const { originalCreateElement } = setupDownloadDocxHarness();

    let capturedOpts;
    const OrigDocument = window.docx.Document;
    window.docx.Document = class extends OrigDocument { constructor(opts) { super(opts); capturedOpts = opts; } };

    window.DOC = { title: 'Solo Title', blocks: [] };

    await expect(DocRenderer.downloadDocx()).resolves.not.toThrow();

    const children = capturedOpts.sections[0].children;
    // title paragraph + date-line paragraph only (no subtitle paragraph since subtitle is absent)
    expect(children.length).toBe(2);
    expect(children[0].children[0].text).toBe('Solo Title');
    const dateLineText = children[1].children[0].text;
    expect(dateLineText.trim().length).toBeGreaterThan(0);
    expect(dateLineText).not.toMatch(/^\s*·|·\s*$/);

    document.createElement = originalCreateElement;
  });
});
