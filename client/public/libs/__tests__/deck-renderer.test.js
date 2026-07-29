const fs = require('fs');
const path = require('path');

function loadDeckRenderer() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'deck-renderer.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(src);
  return window.DeckRenderer;
}

describe('DeckRenderer registry', () => {
  it('exposes the canonical canvas dimensions', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(DeckRenderer.SW).toBe(10);
    expect(DeckRenderer.SH).toBe(5.625);
  });

  it('registers and retrieves a layout by name', () => {
    const DeckRenderer = loadDeckRenderer();
    const render = () => {};
    const exportPptx = () => {};
    DeckRenderer.registerLayout('test_layout', { geometry: {}, render, exportPptx });
    const layout = DeckRenderer.getLayout('test_layout');
    expect(layout.render).toBe(render);
    expect(layout.exportPptx).toBe(exportPptx);
  });

  it('throws a clear error for an unregistered layout name', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(() => DeckRenderer.getLayout('does_not_exist')).toThrow(/does_not_exist/);
  });
});

describe('inchesToPercent', () => {
  it('converts an inch rect to percentage-of-canvas CSS values', () => {
    const DeckRenderer = loadDeckRenderer();
    const pct = DeckRenderer.inchesToPercent({ x: 5, y: 2.8125, w: 5, h: 2.8125 });
    expect(pct.left).toBe('50%');   // 5 / 10
    expect(pct.top).toBe('50%');    // 2.8125 / 5.625
    expect(pct.width).toBe('50%');
    expect(pct.height).toBe('50%');
  });
});

describe('renderDeck', () => {
  it('mounts one .slide element per spec, tagged with its layout and content-visibility CSS applied', () => {
    const DeckRenderer = loadDeckRenderer();
    DeckRenderer.registerLayout('title', {
      geometry: {},
      render: (spec, slideEl) => {
        slideEl.textContent = spec.title;
      },
      exportPptx: () => {},
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    DeckRenderer.renderDeck({ theme: 'dark', slides: [{ layout: 'title', title: 'Hello' }] }, mount);

    const slides = mount.querySelectorAll('.slide');
    expect(slides.length).toBe(1);
    expect(slides[0].classList.contains('title')).toBe(true);
    expect(slides[0].textContent).toBe('Hello');
  });

  it('throws a clear error if a slide spec names an unregistered layout', () => {
    const DeckRenderer = loadDeckRenderer();
    const mount = document.createElement('div');
    expect(() =>
      DeckRenderer.renderDeck({ slides: [{ layout: 'nonexistent' }] }, mount),
    ).toThrow(/nonexistent/);
  });
});

describe('layout: title', () => {
  it('renders headline and eyebrow text', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('title').render(
      { layout: 'title', title: 'Onboarding time drops 40%', eyebrow: 'Whatfix · CS · Q3 2026' },
      slideEl,
    );
    expect(slideEl.querySelector('h1').textContent).toBe('Onboarding time drops 40%');
    expect(slideEl.querySelector('.eyebrow').textContent).toBe('Whatfix · CS · Q3 2026');
  });

  it('exports a headline text shape at the title layout geometry', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    DeckRenderer.getLayout('title').exportPptx(
      mockSlide,
      { layout: 'title', title: 'Onboarding time drops 40%' },
    );
    const headlineCall = calls.find((c) => c.text === 'Onboarding time drops 40%');
    expect(headlineCall).toBeDefined();
    expect(headlineCall.opts.x).toBeCloseTo(0.55, 2);
    expect(headlineCall.opts.fontSize).toBeGreaterThanOrEqual(32); // master deck / spec minimum for hero title
  });
});

describe('layout: content', () => {
  it('renders a headline and up to 3 bullets, silently dropping any beyond 3', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('content').render(
      {
        layout: 'content',
        title: 'Onboarding time drops 40% in week one',
        bullets: ['First point', 'Second point', 'Third point', 'Fourth point — should be dropped'],
      },
      slideEl,
    );
    const items = slideEl.querySelectorAll('ul li');
    expect(items.length).toBe(3);
    expect(items[2].textContent).toContain('Third point');
  });

  it('exports the same 3-bullet cap to PPTX', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    DeckRenderer.getLayout('content').exportPptx(mockSlide, {
      layout: 'content',
      title: 'Headline',
      bullets: ['One', 'Two', 'Three', 'Four'],
    });
    const bulletCalls = calls.filter((c) => typeof c.text === 'string' && ['One', 'Two', 'Three', 'Four'].includes(c.text));
    expect(bulletCalls.length).toBe(3);
    expect(bulletCalls.map((c) => c.text)).not.toContain('Four');
  });
});

describe('layout: stat', () => {
  it('caps at 3 KPI entries by construction', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('stat').render(
      {
        layout: 'stat',
        stats: [
          { value: '40%', label: 'A' }, { value: '3x', label: 'B' },
          { value: '92%', label: 'C' }, { value: '10x', label: 'D — dropped' },
        ],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('.kpi').length).toBe(3);
  });
});

describe('layout: two_col', () => {
  it('renders left bullets and a right-column slot', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('two_col').render(
      { layout: 'two_col', title: 'Headline', bullets: ['One', 'Two'] },
      slideEl,
    );
    expect(slideEl.querySelectorAll('.col-left li').length).toBe(2);
    expect(slideEl.querySelector('.col-right')).not.toBeNull();
  });
});

describe('layout: comparison', () => {
  it('renders a table with a header row and one row per data row', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('comparison').render(
      {
        layout: 'comparison',
        title: 'We out-perform on the metrics that matter',
        headers: ['Feature', 'Whatfix', 'Competitor A'],
        rows: [['In-app guidance', '✓', '✗']],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('thead th').length).toBe(3);
    expect(slideEl.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('exports one PPTX table shape with the same header/row data', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addTable: (rows, opts) => calls.push({ rows, opts }), addText: () => {} };
    DeckRenderer.getLayout('comparison').exportPptx(mockSlide, {
      layout: 'comparison',
      title: 'We out-perform on the metrics that matter',
      headers: ['Feature', 'Whatfix'],
      rows: [['In-app guidance', '✓']],
    });
    expect(calls.length).toBe(1);
    expect(calls[0].rows[0]).toEqual(['Feature', 'Whatfix']); // header row first
    expect(calls[0].rows[1]).toEqual(['In-app guidance', '✓']);
  });

  it('exports the slide title as text (not just the table)', () => {
    const DeckRenderer = loadDeckRenderer();
    const textCalls = [];
    const mockSlide = { addTable: () => {}, addText: (text, opts) => textCalls.push({ text, opts }) };
    DeckRenderer.getLayout('comparison').exportPptx(mockSlide, {
      layout: 'comparison',
      title: 'We out-perform on the metrics that matter',
      headers: ['Feature', 'Whatfix'],
      rows: [['In-app guidance', '✓']],
    });
    expect(textCalls.length).toBe(1);
    expect(textCalls[0].text).toBe('We out-perform on the metrics that matter');
  });

  it('caps headers at 4 columns and rows at 5, silently dropping any beyond', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('comparison').render(
      {
        layout: 'comparison',
        title: 'Comparison',
        headers: ['Col1', 'Col2', 'Col3', 'Col4', 'Col5 — dropped'],
        rows: [
          ['A1', 'A2', 'A3', 'A4', 'A5'],
          ['B1', 'B2', 'B3', 'B4', 'B5'],
          ['C1', 'C2', 'C3', 'C4', 'C5'],
          ['D1', 'D2', 'D3', 'D4', 'D5'],
          ['E1', 'E2', 'E3', 'E4', 'E5'],
          ['F1 — dropped', 'F2', 'F3', 'F4', 'F5'],
        ],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('thead th').length).toBe(4);
    expect(slideEl.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('exports the same header and row caps to PPTX', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addTable: (rows, opts) => calls.push({ rows, opts }), addText: () => {} };
    DeckRenderer.getLayout('comparison').exportPptx(mockSlide, {
      layout: 'comparison',
      title: 'Comparison',
      headers: ['A', 'B', 'C', 'D', 'E — dropped'],
      rows: [
        ['1a', '1b', '1c', '1d', '1e'],
        ['2a', '2b', '2c', '2d', '2e'],
        ['3a', '3b', '3c', '3d', '3e'],
        ['4a', '4b', '4c', '4d', '4e'],
        ['5a', '5b', '5c', '5d', '5e'],
        ['6a — dropped', '6b', '6c', '6d', '6e'],
      ],
    });
    expect(calls.length).toBe(1);
    expect(calls[0].rows[0]).toEqual(['A', 'B', 'C', 'D']); // header capped at 4
    expect(calls[0].rows.length).toBe(6); // header + 5 rows = 6 total
    expect(calls[0].rows[5]).toEqual(['5a', '5b', '5c', '5d']); // 5th row capped at 4 columns
  });
});

describe('layout: agenda', () => {
  function makeItems(n) {
    return Array.from({ length: n }, (_, i) => `Item ${i + 1}`);
  }

  it('renders a numbered list item per agenda entry', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('agenda').render(
      { layout: 'agenda', items: ['First section', 'Second section', 'Next steps'] },
      slideEl,
    );
    const items = slideEl.querySelectorAll('ol li');
    expect(items.length).toBe(3);
    expect(items[1].textContent).toContain('Second section');
  });

  it('caps at 12 items in render, silently dropping any beyond', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('agenda').render({ layout: 'agenda', items: makeItems(15) }, slideEl);
    expect(slideEl.querySelectorAll('ol li').length).toBe(12);
  });

  it('exports the same 12-item cap to PPTX', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }), addShape: () => {} };
    DeckRenderer.getLayout('agenda').exportPptx(mockSlide, { layout: 'agenda', items: makeItems(15) });
    const itemCalls = calls.filter((c) => typeof c.text === 'string' && c.text.startsWith('Item '));
    expect(itemCalls.length).toBe(12);
    expect(itemCalls.map((c) => c.text)).not.toContain('Item 13');
  });
});

describe('layout: section', () => {
  it('renders a two-panel layout with title text in the left panel', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('section').render(
      { layout: 'section', title: 'Part Two: Rollout', eyebrow: 'Section 02' },
      slideEl,
    );
    expect(slideEl.querySelector('.sec-left h2').textContent).toBe('Part Two: Rollout');
    expect(slideEl.querySelector('.sec-right')).not.toBeNull();
  });

  it('exports a title text box and a solid-fill rectangle for the right panel', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('section').exportPptx(mockSlide, { layout: 'section', title: 'Part Two: Rollout' });
    const titleCall = calls.find((c) => c.kind === 'text' && c.text === 'Part Two: Rollout');
    expect(titleCall).toBeDefined();
    const rightShape = calls.find((c) => c.kind === 'shape' && c.opts.x === 6.2);
    expect(rightShape).toBeDefined();
  });
});

describe('layout: quote', () => {
  it('renders the quote text and cite attribution', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('quote').render(
      { layout: 'quote', quote: 'This changed everything.', cite: 'VP of Success, Acme Corp' },
      slideEl,
    );
    expect(slideEl.querySelector('blockquote').textContent).toBe('This changed everything.');
    expect(slideEl.querySelector('cite').textContent).toBe('VP of Success, Acme Corp');
    expect(slideEl.querySelector('.qmark')).not.toBeNull();
  });

  it('exports an italic quote text box and a bold attribution text box', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    DeckRenderer.getLayout('quote').exportPptx(mockSlide, {
      layout: 'quote',
      quote: 'This changed everything.',
      cite: 'VP of Success',
    });
    const quoteCall = calls.find((c) => c.text === 'This changed everything.');
    expect(quoteCall).toBeDefined();
    expect(quoteCall.opts.italic).toBe(true);
    const citeCall = calls.find((c) => typeof c.text === 'string' && c.text.includes('VP of Success'));
    expect(citeCall).toBeDefined();
    expect(citeCall.opts.bold).toBe(true);
  });
});

describe('layout: split', () => {
  it('renders left panel text and a right panel', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('split').render(
      { layout: 'split', title: 'Built for scale', rightBrandImage: 'mark' },
      slideEl,
    );
    expect(slideEl.querySelector('.split-left h2').textContent).toBe('Built for scale');
    expect(slideEl.querySelector('.split-right img')).not.toBeNull();
  });

  it('exports a title text box, a right-panel shape, and an image when provided', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
      addImage: (opts) => calls.push({ kind: 'image', opts }),
    };
    DeckRenderer.getLayout('split').exportPptx(mockSlide, {
      layout: 'split',
      title: 'Built for scale',
      rightBrandImage: 'mark',
    });
    expect(calls.find((c) => c.kind === 'text' && c.text === 'Built for scale')).toBeDefined();
    expect(calls.find((c) => c.kind === 'shape' && c.opts.x === 6.2)).toBeDefined();
    const imgCall = calls.find((c) => c.kind === 'image');
    expect(imgCall).toBeDefined();
    expect(imgCall.opts.path).toBe('/brand/mark.svg');
  });

  it('resolves PNG-only brand image keys to .png, not .svg', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('split').render(
      { layout: 'split', title: 'Built for scale', rightBrandImage: 'product-suite-light' },
      slideEl,
    );
    expect(slideEl.querySelector('.split-right img').src).toContain('/brand/product-suite-light.png');

    const calls = [];
    const mockSlide = {
      addText: () => {},
      addShape: () => {},
      addImage: (opts) => calls.push(opts),
    };
    DeckRenderer.getLayout('split').exportPptx(mockSlide, {
      layout: 'split',
      title: 'Built for scale',
      rightBrandImage: 'product-suite-light',
    });
    expect(calls[0].path).toBe('/brand/product-suite-light.png');
  });

  describe('window._BRAND_ORIGIN (Sandpack iframe origin patching)', () => {
    afterEach(() => {
      delete window._BRAND_ORIGIN;
    });

    it('prefixes the rendered <img src> with the injected brand origin when window._BRAND_ORIGIN is set', () => {
      window._BRAND_ORIGIN = 'https://example-app.com';
      const DeckRenderer = loadDeckRenderer();
      const slideEl = document.createElement('section');
      DeckRenderer.getLayout('split').render(
        { layout: 'split', title: 'Built for scale', rightBrandImage: 'dap-dark' },
        slideEl,
      );
      expect(slideEl.querySelector('.split-right img').src).toBe('https://example-app.com/brand/dap-dark.png');
    });

    it('falls back to a plain relative /brand/ path when window._BRAND_ORIGIN is not set', () => {
      const DeckRenderer = loadDeckRenderer();
      const slideEl = document.createElement('section');
      DeckRenderer.getLayout('split').render(
        { layout: 'split', title: 'Built for scale', rightBrandImage: 'dap-dark' },
        slideEl,
      );
      const src = slideEl.querySelector('.split-right img').src;
      expect(src).toContain('/brand/dap-dark.png');
      expect(src).not.toContain('example-app.com');
    });

    it('prefixes the PPTX exportPptx() addImage path with the injected brand origin when window._BRAND_ORIGIN is set', () => {
      window._BRAND_ORIGIN = 'https://example-app.com';
      const DeckRenderer = loadDeckRenderer();
      const calls = [];
      const mockSlide = {
        addText: () => {},
        addShape: () => {},
        addImage: (opts) => calls.push(opts),
      };
      DeckRenderer.getLayout('split').exportPptx(mockSlide, {
        layout: 'split',
        title: 'Built for scale',
        rightBrandImage: 'dap-dark',
      });
      expect(calls[0].path).toBe('https://example-app.com/brand/dap-dark.png');
    });
  });
});

describe('layout: chart', () => {
  function makeBars(n) {
    return Array.from({ length: n }, (_, i) => ({ label: `Bar ${i + 1}`, value: i + 1 }));
  }

  it('renders one bar row per data point with a width proportional to value', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('chart').render(
      { layout: 'chart', bars: [{ label: 'A', value: 50 }, { label: 'B', value: 100 }] },
      slideEl,
    );
    const rows = slideEl.querySelectorAll('.chart-row');
    expect(rows.length).toBe(2);
    const fills = slideEl.querySelectorAll('.bar-fill');
    expect(fills[1].style.width).toBe('100%'); // max value bar fills 100%
    expect(fills[0].style.width).toBe('50%');
  });

  it('caps at 6 bars in both render and export', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('chart').render({ layout: 'chart', bars: makeBars(9) }, slideEl);
    expect(slideEl.querySelectorAll('.chart-row').length).toBe(6);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('chart').exportPptx(mockSlide, { layout: 'chart', bars: makeBars(9) });
    const labelCalls = calls.filter((c) => c.kind === 'text' && typeof c.text === 'string' && c.text.startsWith('Bar '));
    expect(labelCalls.length).toBe(6);
    expect(labelCalls.map((c) => c.text)).not.toContain('Bar 7');
  });
});

describe('layout: process', () => {
  function makeSteps(n) {
    return Array.from({ length: n }, (_, i) => ({ label: `Step ${i + 1}`, desc: 'desc' }));
  }

  it('renders one step per entry with a numbered bubble', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('process').render({ layout: 'process', steps: makeSteps(3) }, slideEl);
    const steps = slideEl.querySelectorAll('.process-step');
    expect(steps.length).toBe(3);
    expect(steps[0].querySelector('.ps-num').textContent).toBe('01');
    expect(steps[1].querySelector('.ps-label').textContent).toBe('Step 2');
  });

  it('caps at 5 steps in both render and export', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('process').render({ layout: 'process', steps: makeSteps(8) }, slideEl);
    expect(slideEl.querySelectorAll('.process-step').length).toBe(5);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ text, opts }),
      addShape: () => {},
    };
    DeckRenderer.getLayout('process').exportPptx(mockSlide, { layout: 'process', steps: makeSteps(8) });
    const labelCalls = calls.filter((c) => typeof c.text === 'string' && c.text.startsWith('Step '));
    expect(labelCalls.length).toBe(5);
    expect(labelCalls.map((c) => c.text)).not.toContain('Step 6');
  });

  it('exports the numbered bubble and label at the source-verified vertical positions', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('process').exportPptx(mockSlide, { layout: 'process', steps: makeSteps(1) });
    // Source (agents/presentation-creator.skill.md:1240-1243): ellipse y=2.52, label y=3.2
    const ellipseCall = calls.find((c) => c.kind === 'shape' && c.shapeType === 'ellipse');
    expect(ellipseCall).toBeDefined();
    expect(ellipseCall.opts.y).toBeCloseTo(2.52, 5);
    const labelCall = calls.find((c) => c.kind === 'text' && c.text === 'Step 1');
    expect(labelCall).toBeDefined();
    expect(labelCall.opts.y).toBeCloseTo(3.2, 5);
  });
});

describe('layout: icon_grid', () => {
  function makeCards(n) {
    return Array.from({ length: n }, (_, i) => ({ title: `Feature ${i + 1}`, desc: 'desc' }));
  }

  it('renders one card per entry', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('icon_grid').render({ layout: 'icon_grid', cards: makeCards(4) }, slideEl);
    const cards = slideEl.querySelectorAll('.ig-card');
    expect(cards.length).toBe(4);
    expect(cards[0].querySelector('.ig-title').textContent).toBe('Feature 1');
  });

  it('caps at 6 cards in both render and export', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('icon_grid').render({ layout: 'icon_grid', cards: makeCards(9) }, slideEl);
    expect(slideEl.querySelectorAll('.ig-card').length).toBe(6);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ text, opts }),
      addShape: () => {},
    };
    DeckRenderer.getLayout('icon_grid').exportPptx(mockSlide, { layout: 'icon_grid', cards: makeCards(9) });
    const titleCalls = calls.filter((c) => typeof c.text === 'string' && c.text.startsWith('Feature '));
    expect(titleCalls.length).toBe(6);
    expect(titleCalls.map((c) => c.text)).not.toContain('Feature 7');
  });

  it('clamps an out-of-range cols value to 3 (only 2 or 3 are supported)', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('icon_grid').render(
      { layout: 'icon_grid', cols: 5, cards: makeCards(6) },
      slideEl,
    );
    expect(slideEl.querySelector('.ig-grid').style.gridTemplateColumns).toBe('repeat(3,1fr)');
  });

  it('renders a real icon svg when card.icon matches a known name', () => {
    document.body.innerHTML = '';
    require('../icons.js');
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('icon_grid').render(
      { title: 'T', cards: [{ title: 'A', desc: 'B', icon: 'check' }] },
      slideEl,
    );
    const iconEl = slideEl.querySelector('.ig-icon svg');
    expect(iconEl).not.toBeNull();
  });

  it('falls back to the plain colored square when card.icon is unset or unknown', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('icon_grid').render(
      { title: 'T', cards: [{ title: 'A', desc: 'B' }] },
      slideEl,
    );
    expect(slideEl.querySelector('.ig-icon svg')).toBeNull();
  });
});

describe('layout: timeline', () => {
  function makeMilestones(n) {
    return Array.from({ length: n }, (_, i) => ({ date: `202${i}`, title: `Milestone ${i + 1}`, body: 'body' }));
  }

  it('renders one timeline item per milestone', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('timeline').render({ layout: 'timeline', milestones: makeMilestones(3) }, slideEl);
    const items = slideEl.querySelectorAll('.tl-item');
    expect(items.length).toBe(3);
    expect(items[1].querySelector('.tl-title').textContent).toBe('Milestone 2');
  });

  it('caps at 6 milestones in both render and export', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('timeline').render({ layout: 'timeline', milestones: makeMilestones(9) }, slideEl);
    expect(slideEl.querySelectorAll('.tl-item').length).toBe(6);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ text, opts }),
      addShape: () => {},
    };
    DeckRenderer.getLayout('timeline').exportPptx(mockSlide, { layout: 'timeline', milestones: makeMilestones(9) });
    const titleCalls = calls.filter((c) => typeof c.text === 'string' && c.text.startsWith('Milestone '));
    expect(titleCalls.length).toBe(6);
    expect(titleCalls.map((c) => c.text)).not.toContain('Milestone 7');
  });
});

describe('layout: closing', () => {
  it('renders the closing title and, when present, a CTA button', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('closing').render(
      { layout: 'closing', title: 'Thank you', body: 'Questions welcome', cta: 'Get in touch' },
      slideEl,
    );
    expect(slideEl.querySelector('h2').textContent).toBe('Thank you');
    expect(slideEl.querySelector('.cta-btn').textContent).toBe('Get in touch');
  });

  it('omits the CTA button entirely when spec.cta is absent', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('closing').render({ layout: 'closing', title: 'Thank you' }, slideEl);
    expect(slideEl.querySelector('.cta-btn')).toBeNull();
  });

  it('exports a CTA shape and label only when spec.cta is present', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('closing').exportPptx(mockSlide, { layout: 'closing', title: 'Thank you', cta: 'Get in touch' });
    expect(calls.find((c) => c.kind === 'text' && c.text === 'Get in touch')).toBeDefined();
    expect(calls.find((c) => c.kind === 'shape' && c.shapeType === 'roundRect')).toBeDefined();

    const callsNoCta = [];
    const mockSlideNoCta = {
      addText: (text, opts) => callsNoCta.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => callsNoCta.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('closing').exportPptx(mockSlideNoCta, { layout: 'closing', title: 'Thank you' });
    expect(callsNoCta.find((c) => c.kind === 'shape' && c.shapeType === 'roundRect')).toBeUndefined();
  });
});

describe('layout: case_study', () => {
  it('renders the three labeled blocks with the master-deck-verified label copy', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('case_study').render(
      {
        layout: 'case_study',
        challenge: 'Onboarding took 6 weeks per new hire.',
        solution: 'Whatfix in-app guidance embedded in the CRM.',
        results: 'Time-to-productivity dropped 40%.',
      },
      slideEl,
    );
    const labels = Array.from(slideEl.querySelectorAll('.cs-label')).map((el) => el.textContent);
    expect(labels).toEqual(['THE CHALLENGE', 'THE SOLUTION', 'KEY RESULTS WITH WHATFIX']);
    const bodies = Array.from(slideEl.querySelectorAll('.cs-body')).map((el) => el.textContent);
    expect(bodies).toEqual([
      'Onboarding took 6 weeks per new hire.',
      'Whatfix in-app guidance embedded in the CRM.',
      'Time-to-productivity dropped 40%.',
    ]);
  });

  it('renders the CTA button and metadata triple only when present', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('case_study').render(
      {
        layout: 'case_study',
        challenge: 'c', solution: 's', results: 'r',
        cta: 'Ready to learn more?',
        metadata: { industry: 'Retail', region: 'APAC', solution: 'DAP' },
      },
      slideEl,
    );
    expect(slideEl.querySelector('.cta-btn').textContent).toBe('Ready to learn more?');
    expect(slideEl.querySelector('.cs-metadata').textContent).toContain('Retail');
    expect(slideEl.querySelector('.cs-metadata').textContent).toContain('APAC');
    expect(slideEl.querySelector('.cs-metadata').textContent).toContain('DAP');

    const slideElNoExtras = document.createElement('section');
    DeckRenderer.getLayout('case_study').render(
      { layout: 'case_study', challenge: 'c', solution: 's', results: 'r' },
      slideElNoExtras,
    );
    expect(slideElNoExtras.querySelector('.cta-btn')).toBeNull();
    expect(slideElNoExtras.querySelector('.cs-metadata')).toBeNull();
  });

  it('exports the three labeled blocks, and the CTA shape only when present', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ kind: 'text', text, opts }),
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
    };
    DeckRenderer.getLayout('case_study').exportPptx(mockSlide, {
      layout: 'case_study', challenge: 'c', solution: 's', results: 'r', cta: 'Ready to learn more?',
    });
    expect(calls.find((c) => c.kind === 'text' && c.text === 'THE CHALLENGE')).toBeDefined();
    expect(calls.find((c) => c.kind === 'text' && c.text === 'THE SOLUTION')).toBeDefined();
    expect(calls.find((c) => c.kind === 'text' && c.text === 'KEY RESULTS WITH WHATFIX')).toBeDefined();
    expect(calls.find((c) => c.kind === 'text' && c.text === 'Ready to learn more?')).toBeDefined();
    expect(calls.find((c) => c.kind === 'shape' && c.shapeType === 'roundRect')).toBeDefined();
  });

  it('does not set position:relative on the slide root, so the shared .slide{position:absolute} base rule applies', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('case_study').render(
      { layout: 'case_study', challenge: 'c', solution: 's', results: 'r' },
      slideEl,
    );
    expect(slideEl.style.position).not.toBe('relative');
  });
});

describe('layout: mockup', () => {
  it('applies the device-desktop bezel class for device "desktop"', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('mockup').render({ layout: 'mockup', device: 'desktop' }, slideEl);
    const frame = slideEl.querySelector('.device-frame');
    expect(frame.classList.contains('device-desktop')).toBe(true);
    expect(frame.classList.contains('device-mobile')).toBe(false);
  });

  it('applies the device-mobile bezel class for device "mobile"', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('mockup').render({ layout: 'mockup', device: 'mobile' }, slideEl);
    const frame = slideEl.querySelector('.device-frame');
    expect(frame.classList.contains('device-mobile')).toBe(true);
    expect(frame.classList.contains('device-desktop')).toBe(false);
  });

  it('renders the screenshot image when screenshotBrandImage is given', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('mockup').render(
      { layout: 'mockup', device: 'desktop', screenshotBrandImage: 'product-shot' },
      slideEl,
    );
    const img = slideEl.querySelector('.device-screen');
    expect(img.getAttribute('src')).toBe('/brand/product-shot.svg');
  });

  it('exports a rounded-rectangle bezel plus an inset screenshot image', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = {
      addShape: (shapeType, opts) => calls.push({ kind: 'shape', shapeType, opts }),
      addImage: (opts) => calls.push({ kind: 'image', opts }),
    };
    DeckRenderer.getLayout('mockup').exportPptx(mockSlide, {
      layout: 'mockup', device: 'mobile', screenshotBrandImage: 'product-shot',
    });
    expect(calls.find((c) => c.kind === 'shape' && c.shapeType === 'roundRect')).toBeDefined();
    const imageCall = calls.find((c) => c.kind === 'image');
    expect(imageCall).toBeDefined();
    expect(imageCall.opts.path).toBe('/brand/product-shot.svg');
  });
});

describe('layout: matrix_2x2', () => {
  it('renders exactly 4 quadrants when given exactly 4', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('matrix_2x2').render(
      {
        layout: 'matrix_2x2',
        xAxisLabel: 'Complexity',
        yAxisLabel: 'Frequency',
        quadrants: [
          { label: 'Execute', items: ['a'] },
          { label: 'Create', items: ['b'] },
          { label: 'Migrate', items: ['c'] },
          { label: 'Analyze', items: ['d'] },
        ],
      },
      slideEl,
    );
    const quads = slideEl.querySelectorAll('.mx-quadrant');
    expect(quads.length).toBe(4);
    expect(quads[0].querySelector('.mx-q-label').textContent).toBe('Execute');
    expect(slideEl.querySelector('.mx-x-axis').textContent).toBe('Complexity');
    expect(slideEl.querySelector('.mx-y-axis').textContent).toBe('Frequency');
  });

  it('caps at exactly 4 quadrants regardless of how many are passed in (both render and export)', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('matrix_2x2').render(
      {
        layout: 'matrix_2x2',
        quadrants: [
          { label: 'Q1', items: [] }, { label: 'Q2', items: [] }, { label: 'Q3', items: [] },
          { label: 'Q4', items: [] }, { label: 'Q5 - dropped', items: [] }, { label: 'Q6 - dropped', items: [] },
        ],
      },
      slideEl,
    );
    expect(slideEl.querySelectorAll('.mx-quadrant').length).toBe(4);

    const slideElFew = document.createElement('section');
    DeckRenderer.getLayout('matrix_2x2').render(
      { layout: 'matrix_2x2', quadrants: [{ label: 'Only one', items: [] }] },
      slideElFew,
    );
    expect(slideElFew.querySelectorAll('.mx-quadrant').length).toBe(4);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ text, opts }),
      addShape: () => {},
    };
    DeckRenderer.getLayout('matrix_2x2').exportPptx(mockSlide, {
      layout: 'matrix_2x2',
      quadrants: [
        { label: 'Q1', items: [] }, { label: 'Q2', items: [] }, { label: 'Q3', items: [] },
        { label: 'Q4', items: [] }, { label: 'Q5 - dropped', items: [] },
      ],
    });
    const labelCalls = calls.filter((c) => typeof c.text === 'string' && /^Q\d/.test(c.text));
    expect(labelCalls.length).toBe(4);
    expect(labelCalls.map((c) => c.text)).not.toContain('Q5 - dropped');
  });
});

describe('layout: event_speaker', () => {
  it('renders the event-cover variant (eventName/date/location)', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('event_speaker').render(
      { layout: 'event_speaker', eventName: 'Whatfix Connect', date: 'Oct 14, 2026', location: 'San Francisco' },
      slideEl,
    );
    expect(slideEl.querySelector('.ev-name').textContent).toBe('Whatfix Connect');
    expect(slideEl.querySelector('.ev-datetime').textContent).toContain('Oct 14, 2026');
    expect(slideEl.querySelector('.ev-datetime').textContent).toContain('San Francisco');
    expect(slideEl.querySelector('.speaker-card')).toBeNull();
  });

  it('renders the speaker-card variant (one card per speaker)', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('event_speaker').render(
      {
        layout: 'event_speaker',
        speakers: [
          { name: 'Jane Doe', title: 'CEO', company: 'Acme' },
          { name: 'John Roe', title: 'COO', company: 'Acme' },
        ],
      },
      slideEl,
    );
    const cards = slideEl.querySelectorAll('.speaker-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.sp-name').textContent).toBe('Jane Doe');
    expect(cards[0].querySelector('.sp-title').textContent).toBe('CEO');
    expect(cards[0].querySelector('.sp-company').textContent).toBe('Acme');
    expect(slideEl.querySelector('.ev-name')).toBeNull();
  });

  it('caps the speaker-card variant at exactly 4 speakers in both render and export', () => {
    const DeckRenderer = loadDeckRenderer();
    const speakers = Array.from({ length: 6 }, (_, i) => ({ name: `Speaker ${i + 1}`, title: 'Role', company: 'Co' }));
    const slideEl = document.createElement('section');
    DeckRenderer.getLayout('event_speaker').render({ layout: 'event_speaker', speakers }, slideEl);
    expect(slideEl.querySelectorAll('.speaker-card').length).toBe(4);

    const calls = [];
    const mockSlide = {
      addText: (text, opts) => calls.push({ text, opts }),
      addShape: () => {},
    };
    DeckRenderer.getLayout('event_speaker').exportPptx(mockSlide, { layout: 'event_speaker', speakers });
    const nameCalls = calls.filter((c) => typeof c.text === 'string' && c.text.startsWith('Speaker '));
    expect(nameCalls.length).toBe(4);
    expect(nameCalls.map((c) => c.text)).not.toContain('Speaker 5');
  });
});

describe('layout: objective', () => {
  it('renders the full body as a single paragraph, not split into list items', () => {
    const DeckRenderer = loadDeckRenderer();
    const slideEl = document.createElement('section');
    const body = 'This is a long objective paragraph that should never be split into bullet points, even though it is long.';
    DeckRenderer.getLayout('objective').render({ layout: 'objective', label: 'Objective', body }, slideEl);
    expect(slideEl.querySelector('.obj-label').textContent).toBe('Objective');
    expect(slideEl.querySelector('.obj-body').textContent).toBe(body);
    expect(slideEl.querySelectorAll('li').length).toBe(0);
    expect(slideEl.querySelectorAll('.obj-body').length).toBe(1);
  });

  it('exports the label and full body text', () => {
    const DeckRenderer = loadDeckRenderer();
    const calls = [];
    const mockSlide = { addText: (text, opts) => calls.push({ text, opts }) };
    const body = 'A single-paragraph objective statement.';
    DeckRenderer.getLayout('objective').exportPptx(mockSlide, { layout: 'objective', label: 'Objective', body });
    expect(calls.find((c) => c.text === 'Objective')).toBeDefined();
    expect(calls.find((c) => c.text === body)).toBeDefined();
  });
});

describe('DeckRenderer.brandImagePath export', () => {
  it('exposes brandImagePath on the public API', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(typeof DeckRenderer.brandImagePath).toBe('function');
    expect(DeckRenderer.brandImagePath('logo-dark')).toBe('/brand/logo-dark.svg');
  });
});

describe('DeckRenderer.deckAssetPath', () => {
  afterEach(() => {
    delete window._BRAND_ORIGIN;
  });

  it('resolves a bare relative path with no origin set', () => {
    const DeckRenderer = loadDeckRenderer();
    expect(DeckRenderer.deckAssetPath('slide-42-image-1.png')).toBe(
      '/deck-assets/slide-42-image-1.png',
    );
  });

  it('prepends window._BRAND_ORIGIN when present, matching brandImagePath', () => {
    const DeckRenderer = loadDeckRenderer();
    window._BRAND_ORIGIN = 'https://app.example.com';
    expect(DeckRenderer.deckAssetPath('slide-42-image-1.png')).toBe(
      'https://app.example.com/deck-assets/slide-42-image-1.png',
    );
  });
});

describe('downloadPptx', () => {
  it('calls addSlide + the matching layout exportPptx once per slide in window.DECK', async () => {
    const DeckRenderer = loadDeckRenderer();
    const exportCalls = [];
    DeckRenderer.registerLayout('test_export_layout', {
      geometry: {},
      render: () => {},
      exportPptx: (pptxSlide, spec) => exportCalls.push(spec),
    });

    const addedSlides = [];
    // eslint-disable-next-line no-undef
    global.PptxGenJS = function () {
      return {
        layout: null,
        addSlide: () => {
          const slide = {};
          addedSlides.push(slide);
          return slide;
        },
        write: async () => new Blob(['fake pptx bytes']),
      };
    };
    window.PptxGenJS = global.PptxGenJS;

    // Mock URL.createObjectURL since it's not available in Node.js
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    // Mock document APIs for the download link
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

    window.DECK = {
      title: 'Test Deck',
      slides: [
        { layout: 'test_export_layout', title: 'A' },
        { layout: 'test_export_layout', title: 'B' },
      ],
    };

    await DeckRenderer.downloadPptx();

    expect(addedSlides.length).toBe(2);
    expect(exportCalls).toEqual([{ layout: 'test_export_layout', title: 'A' }, { layout: 'test_export_layout', title: 'B' }]);
  });

  it('sets the dark Ink 800 background on every added slide before exportPptx runs', async () => {
    const DeckRenderer = loadDeckRenderer();
    const backgroundAtExportTime = [];
    DeckRenderer.registerLayout('test_bg_layout', {
      geometry: {},
      render: () => {},
      exportPptx: (pptxSlide) => backgroundAtExportTime.push(pptxSlide.background),
    });

    const addedSlides = [];
    // eslint-disable-next-line no-undef
    global.PptxGenJS = function () {
      return {
        layout: null,
        addSlide: () => {
          const slide = {};
          addedSlides.push(slide);
          return slide;
        },
        write: async () => new Blob(['fake pptx bytes']),
      };
    };
    window.PptxGenJS = global.PptxGenJS;

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

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

    window.DECK = {
      title: 'Test Deck',
      slides: [
        { layout: 'test_bg_layout', title: 'A' },
        { layout: 'test_bg_layout', title: 'B' },
      ],
    };

    await DeckRenderer.downloadPptx();

    expect(addedSlides.length).toBe(2);
    addedSlides.forEach((slide) => {
      expect(slide.background).toEqual({ color: '25223B' });
    });
    // Background must be set BEFORE exportPptx runs, so the layout sees it too.
    expect(backgroundAtExportTime).toEqual([{ color: '25223B' }, { color: '25223B' }]);
  });
});

describe('slide navigation (goTo/next/prev)', () => {
  function renderThreeSlideDeck(DeckRenderer) {
    DeckRenderer.registerLayout('nav_test_layout', {
      geometry: {},
      render: (spec, slideEl) => {
        slideEl.textContent = spec.title;
      },
      exportPptx: () => {},
    });
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    DeckRenderer.renderDeck(
      {
        slides: [
          { layout: 'nav_test_layout', title: 'One' },
          { layout: 'nav_test_layout', title: 'Two' },
          { layout: 'nav_test_layout', title: 'Three' },
        ],
      },
      mount,
    );
    return mount.querySelectorAll('.slide');
  }

  it('goTo(n) moves .active to the target slide and removes it from the previous one', () => {
    const DeckRenderer = loadDeckRenderer();
    const slides = renderThreeSlideDeck(DeckRenderer);
    expect(slides[0].classList.contains('active')).toBe(true);

    DeckRenderer.goTo(2);

    expect(slides[0].classList.contains('active')).toBe(false);
    expect(slides[1].classList.contains('active')).toBe(false);
    expect(slides[2].classList.contains('active')).toBe(true);
  });

  it('goTo with an out-of-range index is a no-op', () => {
    const DeckRenderer = loadDeckRenderer();
    const slides = renderThreeSlideDeck(DeckRenderer);

    DeckRenderer.goTo(99);
    expect(slides[0].classList.contains('active')).toBe(true);
    expect(slides[1].classList.contains('active')).toBe(false);
    expect(slides[2].classList.contains('active')).toBe(false);

    DeckRenderer.goTo(-1);
    expect(slides[0].classList.contains('active')).toBe(true);
  });

  it('next()/prev() move correctly and clamp at the boundaries', () => {
    const DeckRenderer = loadDeckRenderer();
    const slides = renderThreeSlideDeck(DeckRenderer);

    DeckRenderer.prev(); // already on slide 0 — should stay
    expect(slides[0].classList.contains('active')).toBe(true);

    DeckRenderer.next();
    expect(slides[1].classList.contains('active')).toBe(true);
    expect(slides[0].classList.contains('active')).toBe(false);

    DeckRenderer.next();
    expect(slides[2].classList.contains('active')).toBe(true);

    DeckRenderer.next(); // already on last slide — should stay
    expect(slides[2].classList.contains('active')).toBe(true);

    DeckRenderer.prev();
    expect(slides[1].classList.contains('active')).toBe(true);
  });

  it('advances the active slide on an ArrowRight keydown event on document', () => {
    const DeckRenderer = loadDeckRenderer();
    const slides = renderThreeSlideDeck(DeckRenderer);
    expect(slides[0].classList.contains('active')).toBe(true);

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(slides[0].classList.contains('active')).toBe(false);
    expect(slides[1].classList.contains('active')).toBe(true);
  });
});
