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

  afterEach(() => {
    delete window._BRAND_ORIGIN;
  });

  it('calls addImage with the path as-is when no _BRAND_ORIGIN is injected', () => {
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' },
    ]);
    expect(slide.addImage).toHaveBeenCalledWith(expect.objectContaining({ path: '/brand/logo-dark.svg', x: 0, y: 0, w: 2, h: 2 }));
  });

  /**
   * Regression test for finding C1. The primary export trigger posts
   * 'artifact-download-request' into the live Sandpack preview iframe, which
   * is CROSS-ORIGIN from the app — that is exactly why window._BRAND_ORIGIN is
   * injected. exportSchemaElements used to strip the origin off the resolved
   * path ("export runs same-origin"), producing a bare /brand/... or
   * /deck-assets/... path that resolved against the Sandpack origin, so every
   * schema-layout image was silently missing from the exported PPTX. The path
   * must stay origin-prefixed, matching the 3 hand-coded addImage call sites
   * in deck-renderer.js and embedFontsInPptx's origin-aware font fetch.
   */
  it('keeps the ORIGIN-PREFIXED path when _BRAND_ORIGIN is injected (cross-origin export path)', () => {
    window._BRAND_ORIGIN = 'https://app.example.com';
    const slide = fakeSlide();
    window.DeckSchemaRenderer.exportSchemaElements(slide, [
      { type: 'image', x: 0, y: 0, w: 2, h: 2, brandImage: 'logo-dark' },
      { type: 'image', x: 1, y: 1, w: 2, h: 2, deckAsset: 'slide-42-image-1.png' },
    ]);
    expect(slide.addImage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: 'https://app.example.com/brand/logo-dark.svg' }),
    );
    expect(slide.addImage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: 'https://app.example.com/deck-assets/slide-42-image-1.png' }),
    );
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

/**
 * Auto-fit tests (finding I1).
 *
 * TESTING-ENVIRONMENT LIMITATION, STATED UP FRONT: jsdom does no CSS layout at
 * all, so scrollHeight/clientHeight are 0 on every element whether it is
 * attached to the document or not. These tests therefore still have to mock
 * those two properties to simulate overflow — jsdom cannot validate the real
 * browser behaviour either way.
 *
 * What these tests CAN and DO verify (and what the previous version of them
 * did not) is the *timing* bug: the fit pass must run against elements that
 * are ATTACHED to the live document, driven by renderDeck's post-mount pass,
 * not during the detached synchronous render() build phase where a real
 * browser reports 0/0 and the shrink loop is a silent no-op. Every test below
 * either attaches its container to document.body or asserts the build phase
 * deliberately leaves fitting alone.
 */
describe('DeckSchemaRenderer text auto-fit', () => {
  let mountEl;

  beforeEach(() => {
    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
  });
  afterEach(() => {
    mountEl.remove();
  });

  /** Mock overflow on an ALREADY-ATTACHED .schema-text element. */
  function mockOverflow(el, scrollHeight, clientHeight) {
    expect(el.isConnected).toBe(true); // guards the whole point of these tests
    Object.defineProperty(el, 'scrollHeight', {
      get: typeof scrollHeight === 'function' ? scrollHeight : () => scrollHeight,
      configurable: true,
    });
    Object.defineProperty(el, 'clientHeight', {
      get: typeof clientHeight === 'function' ? clientHeight : () => clientHeight,
      configurable: true,
    });
  }

  function schemaDeck(el) {
    return { slides: [{ layout: 'schema', elements: [el] }] };
  }

  /**
   * The core regression test for I1. renderDeck builds each slide's DOM tree
   * BEFORE appending it to mountEl, so a fit pass performed inside render()
   * measures a detached subtree. This drives the REAL renderDeck path with a
   * genuinely document-attached mount point and proves the fit still engages,
   * which is only possible if it happens after attachment.
   */
  it('engages the shrink pass through the real renderDeck path on a document-attached mount', () => {
    // Overflow has to be stubbed at element-creation time (there is no hook
    // between renderDeck's build and its post-mount fit), but the getters
    // record WHETHER the element was attached when the fit actually read them
    // — which is the property under test.
    const originalCreateElement = document.createElement.bind(document);
    let measuredWhileConnected = null;
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'div') {
        Object.defineProperty(el, 'scrollHeight', {
          configurable: true,
          get() {
            if (this.classList.contains('schema-text')) {
              measuredWhileConnected = this.isConnected;
              return 200;
            }
            return 0;
          },
        });
        Object.defineProperty(el, 'clientHeight', {
          configurable: true,
          get() {
            return this.classList.contains('schema-text') ? 50 : 0;
          },
        });
      }
      return el;
    });

    window.DeckRenderer.renderDeck(
      schemaDeck({ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Very long text that will not fit', fontSize: 20 }),
      mountEl,
    );
    document.createElement.mockRestore();

    const el = mountEl.querySelector('.schema-text');
    // The measurement happened, and it happened on live, attached content.
    expect(measuredWhileConnected).toBe(true);
    expect(parseFloat(el.style.fontSize)).toBeLessThan(20);
  });

  /**
   * The inverse of the above, and the assertion that actually pins the bug:
   * the synchronous build phase must NOT try to fit. If it did, in a real
   * browser it would measure 0/0 and no-op — so we assert here that the
   * detached build leaves the authored size untouched and stashes the base
   * sizes for the later, attached pass instead.
   */
  it('does not attempt to fit during the detached build phase (leaves authored size + base metadata)', () => {
    const detached = document.createElement('div');
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Long text', fontSize: 20, minFontSize: 10 }],
      detached,
    );
    const el = detached.querySelector('.schema-text');
    // Even with overflow simulated, nothing shrank: no fit ran at build time.
    Object.defineProperty(el, 'scrollHeight', { get: () => 200, configurable: true });
    Object.defineProperty(el, 'clientHeight', { get: () => 50, configurable: true });
    expect(el.style.fontSize).toBe('20pt');
    expect(el.dataset.baseFontSize).toBe('20');
    expect(el.dataset.minFontSize).toBe('10');
  });

  it('stops shrinking as soon as the text fits, not just at the floor (attached element)', () => {
    // clientHeight is derived from the element's *current* fontSize: overflow
    // resolves once fontSize drops to 16pt, well above the 8pt floor. Proves
    // the loop re-evaluates each iteration instead of bottoming out.
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Text that fits once shrunk to 16pt', fontSize: 20 }],
      mountEl,
    );
    const el = mountEl.querySelector('.schema-text');
    mockOverflow(el, 100, () => (parseFloat(el.style.fontSize) <= 16 ? 150 : 50));
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    expect(parseFloat(el.style.fontSize)).toBe(16);
  });

  it('never shrinks below minFontSize (default 8pt) (attached element)', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Extremely long text that never fits', fontSize: 20 }],
      mountEl,
    );
    const el = mountEl.querySelector('.schema-text');
    mockOverflow(el, 5000, 50);
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    expect(parseFloat(el.style.fontSize)).toBe(8);
  });

  it('does not shrink text that already fits (no overflow)', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 5, h: 5, text: 'Short', fontSize: 14 }],
      mountEl,
    );
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    const el = mountEl.querySelector('.schema-text');
    expect(el.style.fontSize).toBe('14pt'); // unchanged when there's no overflow
  });

  /**
   * Re-fitting must restart from the authored base size rather than compound
   * on the previous shrink, so that goTo() can re-run the pass on every view
   * without the text ratcheting permanently smaller (and so it can grow back
   * when the box gets bigger).
   */
  it('re-fitting is idempotent: restarts from the authored base size, never ratchets down', () => {
    window.DeckSchemaRenderer.renderSchemaElements(
      [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Long text', fontSize: 20 }],
      mountEl,
    );
    const el = mountEl.querySelector('.schema-text');
    mockOverflow(el, 100, () => (parseFloat(el.style.fontSize) <= 16 ? 150 : 50));
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    expect(parseFloat(el.style.fontSize)).toBe(16);
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    expect(parseFloat(el.style.fontSize)).toBe(16); // not 12
    // Box grows (no overflow at any size) -> text returns to its authored size.
    mockOverflow(el, 10, 500);
    window.DeckSchemaRenderer.fitAllSchemaText(mountEl);
    expect(parseFloat(el.style.fontSize)).toBe(20);
  });

  /**
   * Non-active .slide elements carry content-visibility:auto, which skips
   * their layout entirely, so off-screen slides cannot be measured reliably.
   * The fit is therefore re-run per active slide on navigation.
   */
  it('re-fits the newly active slide on goTo (per-view autofit, like PowerPoint)', () => {
    window.DeckRenderer.renderDeck(
      {
        slides: [
          { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'One', fontSize: 20 }] },
          { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 2, h: 1, text: 'Two', fontSize: 20 }] },
        ],
      },
      mountEl,
    );
    const second = mountEl.querySelectorAll('.slide')[1].querySelector('.schema-text');
    // Slide 2 was never measurable while inactive; simulate it overflowing now.
    mockOverflow(second, 200, 50);
    expect(parseFloat(second.style.fontSize)).toBe(20); // untouched while off-screen
    window.DeckRenderer.goTo(1);
    expect(parseFloat(second.style.fontSize)).toBeLessThan(20);
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
