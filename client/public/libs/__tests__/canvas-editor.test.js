require('../deck-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');

describe('CanvasEditor.mount', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    Object.defineProperty(mount, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      configurable: true,
    });
    document.body.appendChild(mount);
    window.DECK = {
      title: 'T',
      slides: [{ layout: 'schema', elements: [{ type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' }] }],
    };
  });
  afterEach(() => {
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('reports mounted state correctly', () => {
    expect(window.CanvasEditor.isMounted()).toBe(false);
    window.CanvasEditor.mount(mount, 0);
    expect(window.CanvasEditor.isMounted()).toBe(true);
    window.CanvasEditor.unmount();
    expect(window.CanvasEditor.isMounted()).toBe(false);
  });

  it('creates exactly one Konva node per element in the active slide', () => {
    window.CanvasEditor.mount(mount, 0);
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    expect(layer.children.length).toBe(1);
  });

  it('re-mounting without an intervening unmount does not leak a second stage', () => {
    window.CanvasEditor.mount(mount, 0);
    window.CanvasEditor.mount(mount, 0);
    expect(mount.querySelectorAll('canvas').length).toBe(1);
  });

  it('renders shape and image elements alongside text, preserving zIndex order over document order', () => {
    window.DECK.slides[0].elements = [
      { type: 'shape', shape: 'ellipse', x: 0, y: 0, w: 2, h: 1, zIndex: 2 },
      { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello', zIndex: 0 },
      { type: 'image', x: 2, y: 2, w: 2, h: 2, deckAsset: 'foo.png', zIndex: 1 },
    ];
    window.CanvasEditor.mount(mount, 0);
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    expect(layer.children.length).toBe(3);
    const classNames = layer.children.map((n) => n.getClassName());
    expect(classNames).toEqual(['Text', 'Image', 'Ellipse']);
  });

  it('skips unknown element types without throwing', () => {
    window.DECK.slides[0].elements = [
      { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' },
      { type: 'wat', x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(() => window.CanvasEditor.mount(mount, 0)).not.toThrow();
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    expect(layer.children.length).toBe(1);
  });
});
