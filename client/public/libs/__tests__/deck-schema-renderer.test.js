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
