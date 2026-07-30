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
    // The layer also carries the shared Konva.Transformer (Task 4) — filter
    // it out since it's editor chrome, not an element node.
    const elementNodes = layer.getChildren().filter((n) => n.getClassName() !== 'Transformer');
    expect(elementNodes.length).toBe(1);
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
    const elementNodes = layer.getChildren().filter((n) => n.getClassName() !== 'Transformer');
    expect(elementNodes.length).toBe(3);
    const classNames = elementNodes.map((n) => n.getClassName());
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
    const elementNodes = layer.getChildren().filter((n) => n.getClassName() !== 'Transformer');
    expect(elementNodes.length).toBe(1);
  });

  it('makes every rendered node draggable', () => {
    window.DECK.slides[0].elements = [
      { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' },
      { type: 'shape', shape: 'ellipse', x: 0, y: 0, w: 2, h: 1 },
    ];
    window.CanvasEditor.mount(mount, 0);
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    const nodes = layer.getChildren().filter((n) => n.getClassName() !== 'Transformer');
    expect(nodes.length).toBe(2);
    nodes.forEach((n) => expect(n.draggable()).toBe(true));
  });
});

describe('CanvasEditor coordinate conversion (pxToInches / inchesToPx)', () => {
  // scale = 80 corresponds to an 800px-wide mount over the 10in canvas
  // width (matches this suite's mocked getBoundingClientRect elsewhere).
  const scale = 80;

  it('pxToInches converts pixels to inches using the given scale', () => {
    expect(window.CanvasEditor._pxToInches(80, scale)).toBe(1);
    expect(window.CanvasEditor._pxToInches(240, scale)).toBe(3);
    expect(window.CanvasEditor._pxToInches(40, scale)).toBe(0.5);
  });

  it('inchesToPx converts inches to pixels using the given scale', () => {
    expect(window.CanvasEditor._inchesToPx(1, scale)).toBe(80);
    expect(window.CanvasEditor._inchesToPx(3, scale)).toBe(240);
    expect(window.CanvasEditor._inchesToPx(0.5, scale)).toBe(40);
  });

  it('round-trips px -> inches -> px without drift', () => {
    const px = 356;
    const inches = window.CanvasEditor._pxToInches(px, scale);
    expect(window.CanvasEditor._inchesToPx(inches, scale)).toBeCloseTo(px, 10);
  });
});

describe('CanvasEditor selection + geometry sync on drag/transform end', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    Object.defineProperty(mount, 'getBoundingClientRect', {
      // 800x450 over a 10 x 5.625in canvas => scale === 80 px/in exactly.
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      configurable: true,
    });
    document.body.appendChild(mount);
    window.DECK = {
      title: 'T',
      slides: [{
        layout: 'schema',
        elements: [
          { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' },
          { type: 'image', x: 2, y: 2, w: 2, h: 1.5, deckAsset: 'foo.png' },
        ],
      }],
    };
    window.CanvasEditor.mount(mount, 0);
  });
  afterEach(() => {
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('selectElement/getSelectedIndex/deselect track selection state', () => {
    expect(window.CanvasEditor.getSelectedIndex()).toBe(null);
    window.CanvasEditor.selectElement(0);
    expect(window.CanvasEditor.getSelectedIndex()).toBe(0);
    window.CanvasEditor.deselect();
    expect(window.CanvasEditor.getSelectedIndex()).toBe(null);
  });

  it('_updateElementFromNode converts a mock node\'s px geometry to the correct inch values on window.DECK', () => {
    // scale === 80 px/in here (800px / 10in). Mock a Konva node the way a
    // real dragend/transformend event's e.target would look, without any
    // real canvas or pointer gesture.
    const mockNode = {
      _elIndex: 0,
      x: () => 400, // 400px / 80 = 5in
      y: () => 240, // 240px / 80 = 3in
      width: () => 160, // 160px / 80 = 2in
      height: () => 80, // 80px / 80 = 1in
      rotation: () => 45,
    };
    window.CanvasEditor._updateElementFromNode(mockNode);
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBe(5);
    expect(el.y).toBe(3);
    expect(el.w).toBe(2);
    expect(el.h).toBe(1);
    expect(el.rotation).toBe(45);
  });

  it('_updateElementFromNode writes to the correct element by _elIndex, leaving others untouched', () => {
    const originalFirstEl = { ...window.DECK.slides[0].elements[0] };
    const mockNode = {
      _elIndex: 1, // the image element
      x: () => 80, y: () => 160, width: () => 240, height: () => 120, rotation: () => 0,
    };
    window.CanvasEditor._updateElementFromNode(mockNode);
    const img = window.DECK.slides[0].elements[1];
    expect(img.x).toBe(1);
    expect(img.y).toBe(2);
    expect(img.w).toBe(3);
    expect(img.h).toBe(1.5);
    // element 0 (text) must be untouched by an update targeting element 1.
    expect(window.DECK.slides[0].elements[0]).toEqual(originalFirstEl);
  });

  it('fires onChange listeners when geometry is updated', () => {
    const cb = jest.fn();
    window.CanvasEditor.onChange(cb);
    const mockNode = {
      _elIndex: 0, x: () => 0, y: () => 0, width: () => 80, height: () => 80, rotation: () => 0,
    };
    window.CanvasEditor._updateElementFromNode(mockNode);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('dragend on a real Konva node updates window.DECK via the same code path', () => {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    const textNode = layer.getChildren().find((n) => n._elIndex === 0);
    // Simulate what a real drag does to the node's position, then fire the
    // dragend event exactly as Konva would (handler reads e.target).
    textNode.x(400); // 5in
    textNode.y(240); // 3in
    textNode.fire('dragend', { target: textNode }, true);
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBe(5);
    expect(el.y).toBe(3);
  });
});
