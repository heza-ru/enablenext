require('../deck-renderer.js');
require('../deck-schema-renderer.js');

describe('DeckSchemaRenderer.renderSchemaElements', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders a text element as a positioned, styled span', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 1, y: 0.5, w: 4, h: 1, text: 'Hello', fontSize: 20, color: 'FF6B18', fontWeight: 'bold' }],
      container,
    );
    const el = container.querySelector('.schema-text');
    expect(el.textContent).toBe('Hello');
    expect(el.style.left).toBe((1 / 10) * 100 + '%');
    expect(el.style.fontWeight).toBe('bold');
    expect(el.style.color).toBe('rgb(255, 107, 24)');
  });

  // Regression test: deck-editor.js's inline-edit commit handler needs to
  // know each text element's true index in the `elements` array (not its
  // index among only the text elements) to write edits back to the right
  // slot on slides that mix shape/image elements with text — see
  // task-10-report.md and deck-editor.test.js's matching regression test.
  it('tags each schema-text element with data-el-index reflecting its true position in elements[]', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [
        { type: 'shape', shape: 'rect', fill: '000000', x: 0, y: 0, w: 10, h: 5.625 },
        { type: 'text', x: 1, y: 0.5, w: 4, h: 1, text: 'First text' },
        { type: 'shape', shape: 'rect', fill: 'FFFFFF', x: 2, y: 2, w: 1, h: 1 },
        { type: 'text', x: 1, y: 2, w: 4, h: 1, text: 'Second text' },
      ],
      container,
    );
    const textEls = container.querySelectorAll('.schema-text');
    expect(textEls[0].dataset.elIndex).toBe('1');
    expect(textEls[1].dataset.elIndex).toBe('3');
  });

  it('renders an image element via brandImagePath', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' }],
      container,
    );
    const img = container.querySelector('.schema-image');
    expect(img.getAttribute('src')).toBe('/brand/logo-dark.svg');
  });

  it('renders an image element via deckAssetPath', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'image', x: 0, y: 0, w: 2, h: 2, deckAsset: 'slide-42-image-1.png' }],
      container,
    );
    const img = container.querySelector('.schema-image');
    expect(img.getAttribute('src')).toBe('/deck-assets/slide-42-image-1.png');
  });

  it('throws if an image element sets neither brandImage nor deckAsset', () => {
    expect(() =>
      window.DeckSchemaRenderer.renderSchemaElements([{ type: 'image', x: 0, y: 0, w: 1, h: 1 }], container),
    ).toThrow(/brandImage.*deckAsset/);
  });

  it('renders a shape element as a positioned div with fill', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'shape', x: 0, y: 0, w: 3, h: 0.5, shape: 'roundRect', fill: '4a4560', rectRadius: 0.1 }],
      container,
    );
    const el = container.querySelector('.schema-shape');
    expect(el.style.background).toBe('rgb(74, 69, 96)');
    expect(el.style.borderRadius).not.toBe('');
  });

  it('throws for an unknown element type', () => {
    expect(() =>
      window.DeckSchemaRenderer.renderSchemaElements([{ type: 'bogus' }], container),
    ).toThrow(/unknown element type/i);
  });
});

describe('DeckSchemaRenderer.exportSchemaElements', () => {
  function fakeSlide() {
    return { addText: jest.fn(), addImage: jest.fn(), addShape: jest.fn() };
  }

  it('calls addText for a text element with fontSize/color/bold mapped', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'text', x: 1, y: 0.5, w: 4, h: 1, text: 'Hello', fontSize: 20, color: 'FF6B18', fontWeight: 'bold' },
    ]);
    expect(slide.addText).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ x: 1, y: 0.5, w: 4, h: 1, fontSize: 20, color: 'FF6B18', bold: true }),
    );
  });

  it('calls addImage with an origin-free path (export never runs in the Sandpack iframe)', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' },
    ]);
    expect(slide.addImage).toHaveBeenCalledWith(expect.objectContaining({ path: '/brand/logo-dark.svg', x: 0, y: 0, w: 2, h: 2 }));
  });

  it('calls addShape for a shape element', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'shape', x: 0, y: 0, w: 3, h: 0.5, shape: 'roundRect', fill: '4a4560', rectRadius: 0.1 },
    ]);
    expect(slide.addShape).toHaveBeenCalledWith(
      'roundRect',
      expect.objectContaining({ x: 0, y: 0, w: 3, h: 0.5, fill: { color: '4a4560' }, rectRadius: 0.1 }),
    );
  });
});

describe("registerLayout('schema') integration", () => {
  it('registers a layout callable through DeckRenderer.getLayout', () => {
    const layout = window.DeckRenderer.getLayout('schema');
    expect(typeof layout.render).toBe('function');
    expect(typeof layout.exportPptx).toBe('function');
  });
});

describe('DeckSchemaRenderer text auto-fit', () => {
  it('shrinks fontSize when rendered text overflows its fixed box (real DOM overflow, not estimated)', () => {
    const container = document.createElement('div');
    // jsdom doesn't compute real scrollHeight from font metrics, so this test mocks the
    // element's scrollHeight/clientHeight getters to simulate overflow, then asserts the
    // shrink loop actually ran and reduced fontSize below the original.
    const originalCreateElement = document.createElement.bind(document);
    let capturedEl;
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'div' && !capturedEl) {
        capturedEl = el;
        Object.defineProperty(el, 'scrollHeight', { get: () => 200, configurable: true });
        Object.defineProperty(el, 'clientHeight', { get: () => 50, configurable: true });
      }
      return el;
    });
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Very long text that will not fit', fontSize: 20 }],
      container,
    );
    document.createElement.mockRestore();
    const el = container.querySelector('.schema-text');
    expect(parseFloat(el.style.fontSize)).toBeLessThan(20);
  });

  it('never shrinks below minFontSize (default 8pt)', () => {
    const container = document.createElement('div');
    // same overflow-mocking technique as above, extreme overflow, confirm floor at 8
    const originalCreateElement = document.createElement.bind(document);
    let capturedEl;
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'div' && !capturedEl) {
        capturedEl = el;
        Object.defineProperty(el, 'scrollHeight', { get: () => 5000, configurable: true });
        Object.defineProperty(el, 'clientHeight', { get: () => 50, configurable: true });
      }
      return el;
    });
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Extremely long text that never fits no matter what', fontSize: 20 }],
      container,
    );
    document.createElement.mockRestore();
    const el = container.querySelector('.schema-text');
    expect(parseFloat(el.style.fontSize)).toBe(8);
  });

  it('does not shrink text that already fits (no overflow)', () => {
    const container = document.createElement('div');
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 5, h: 5, text: 'Short', fontSize: 14 }],
      container,
    );
    const el = container.querySelector('.schema-text');
    expect(el.style.fontSize).toBe('14pt'); // unchanged when there's no overflow
  });
});

describe('DeckSchemaRenderer export auto-fit', () => {
  it('passes fit:"shrink" for every text element', () => {
    const slide = { addText: jest.fn(), addImage: jest.fn(), addShape: jest.fn() };
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Hello' },
    ]);
    expect(slide.addText).toHaveBeenCalledWith('Hello', expect.objectContaining({ fit: 'shrink' }));
  });
});
