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

  it('selectElement/getSelectedIndices/deselect track selection state', () => {
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([]);
    window.CanvasEditor.selectElement(0);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([0]);
    window.CanvasEditor.deselect();
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([]);
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

describe('CanvasEditor ellipse x/y: Konva center vs. DECK top-left semantics', () => {
  // Regression coverage for the Critical review finding: Konva.Ellipse
  // treats x/y as its CENTER, but every DECK element (ellipses included)
  // stores/expects top-left x/y — deck-schema-renderer.js positions an
  // ellipse via CSS left/top + border-radius:50%, not a center-based
  // transform. elementToKonvaNode() must offset by the radius when
  // constructing the node, and updateElementFromNode() must apply the exact
  // inverse when writing geometry back out, so an untouched ellipse
  // round-trips to its original top-left x/y rather than drifting by half
  // its width/height.
  let mount;
  const ELLIPSE = { type: 'shape', shape: 'ellipse', x: 1, y: 2, w: 2, h: 1.5, fill: 'e94560' };

  beforeEach(() => {
    mount = document.createElement('div');
    Object.defineProperty(mount, 'getBoundingClientRect', {
      // 800x450 over a 10 x 5.625in canvas => scale === 80 px/in exactly.
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      configurable: true,
    });
    document.body.appendChild(mount);
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ ...ELLIPSE }] }] };
    window.CanvasEditor.mount(mount, 0);
  });
  afterEach(() => {
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('positions the Konva node at top-left + radius (its center), not directly at the schema top-left x/y', () => {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    const node = layer.getChildren().find((n) => n._elIndex === 0);
    // radiusX = (2in * 80) / 2 = 80px, radiusY = (1.5in * 80) / 2 = 60px.
    expect(node.x()).toBe(1 * 80 + 80); // 160
    expect(node.y()).toBe(2 * 80 + 60); // 220
  });

  it('round-trips an untouched ellipse to its exact original top-left x/y (no half-width/height drift)', () => {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    const node = layer.getChildren().find((n) => n._elIndex === 0);
    // Fire dragend without moving the node at all.
    node.fire('dragend', { target: node }, true);
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBe(1);
    expect(el.y).toBe(2);
    expect(el.w).toBe(2);
    expect(el.h).toBe(1.5);
  });

  it('a real drag on the ellipse writes back top-left semantics matching the pixel delta moved', () => {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    const node = layer.getChildren().find((n) => n._elIndex === 0);
    // Move the node's (center) position by +40px/+80px (0.5in/1.0in at
    // scale 80) — simulating what Konva's own drag would do to x()/y().
    node.x(node.x() + 40);
    node.y(node.y() + 80);
    node.fire('dragend', { target: node }, true);
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBe(1.5); // 1 + 0.5in, top-left, not center
    expect(el.y).toBe(3); // 2 + 1.0in
    expect(el.w).toBe(2);
    expect(el.h).toBe(1.5);
  });
});

describe('CanvasEditor multi-select (shift-click)', () => {
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
      slides: [{
        layout: 'schema',
        elements: [
          { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'A' },
          { type: 'text', x: 1, y: 1, w: 1, h: 1, text: 'B' },
          { type: 'text', x: 2, y: 2, w: 1, h: 1, text: 'C' },
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

  function nodeFor(idx) {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    return layer.getChildren().find((n) => n._elIndex === idx);
  }

  it('plain click selects only the clicked element, replacing prior selection', () => {
    window.CanvasEditor.selectElement(0);
    nodeFor(1).fire('click', { target: nodeFor(1), evt: {} }, true);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([1]);
  });

  it('shift-click toggles an element into the selection', () => {
    nodeFor(0).fire('click', { target: nodeFor(0), evt: { shiftKey: true } }, true);
    nodeFor(1).fire('click', { target: nodeFor(1), evt: { shiftKey: true } }, true);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([0, 1]);
  });

  it('shift-click toggles an element back out of the selection', () => {
    nodeFor(0).fire('click', { target: nodeFor(0), evt: { shiftKey: true } }, true);
    nodeFor(1).fire('click', { target: nodeFor(1), evt: { shiftKey: true } }, true);
    nodeFor(0).fire('click', { target: nodeFor(0), evt: { shiftKey: true } }, true);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([1]);
  });

  it('shift-click on empty stage is a no-op (does not clear selection)', () => {
    nodeFor(0).fire('click', { target: nodeFor(0), evt: { shiftKey: true } }, true);
    nodeFor(1).fire('click', { target: nodeFor(1), evt: { shiftKey: true } }, true);
    const stage = window.CanvasEditor.getStage();
    stage.fire('click', { target: stage, evt: { shiftKey: true } }, true);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([0, 1]);
  });

  it('plain click on empty stage deselects everything', () => {
    nodeFor(0).fire('click', { target: nodeFor(0), evt: { shiftKey: true } }, true);
    nodeFor(1).fire('click', { target: nodeFor(1), evt: { shiftKey: true } }, true);
    const stage = window.CanvasEditor.getStage();
    stage.fire('click', { target: stage, evt: {} }, true);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([]);
  });
});

describe('CanvasEditor keyboard shortcuts', () => {
  let mount;
  const SCALE = 80; // 800px / 10in

  function dispatchKey(opts) {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts }));
  }

  beforeEach(() => {
    mount = document.createElement('div');
    Object.defineProperty(mount, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      configurable: true,
    });
    document.body.appendChild(mount);
    window.DECK = {
      title: 'T',
      slides: [{
        layout: 'schema',
        elements: [
          { type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'A' },
          { type: 'text', x: 1, y: 1, w: 1, h: 1, text: 'B' },
          { type: 'text', x: 2, y: 2, w: 1, h: 1, text: 'C' },
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

  it('Delete removes the selected element and leaves other elements\' identity/order intact', () => {
    window.CanvasEditor.selectElement(1); // element B
    dispatchKey({ key: 'Delete' });
    const elements = window.DECK.slides[0].elements;
    expect(elements.length).toBe(2);
    expect(elements.map((e) => e.text)).toEqual(['A', 'C']);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([]);
  });

  it('Delete with multiple selected removes all selected elements (highest index first)', () => {
    window.CanvasEditor.selectElement(0);
    window.CanvasEditor.toggleSelectElement(2);
    dispatchKey({ key: 'Backspace' });
    const elements = window.DECK.slides[0].elements;
    expect(elements.length).toBe(1);
    expect(elements[0].text).toBe('B');
  });

  it('Cmd/Ctrl+D duplicates the selected element with a +0.2in offset, without mutating the original', () => {
    window.CanvasEditor.selectElement(0);
    const originalBefore = { ...window.DECK.slides[0].elements[0] };
    dispatchKey({ key: 'd', ctrlKey: true });
    const elements = window.DECK.slides[0].elements;
    expect(elements.length).toBe(4);
    const original = elements[0];
    const dup = elements[3];
    expect(original).toEqual(originalBefore);
    expect(dup.x).toBeCloseTo(original.x + 0.2, 10);
    expect(dup.y).toBeCloseTo(original.y + 0.2, 10);
    expect(dup).not.toBe(original);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([3]);
  });

  it('ArrowRight nudges the selected element by 0.05in normally', () => {
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: 'ArrowRight' });
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBeCloseTo(0.05, 10);
    expect(el.y).toBeCloseTo(0, 10);
  });

  it('Shift+ArrowDown nudges the selected element by 0.2in', () => {
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: 'ArrowDown', shiftKey: true });
    const el = window.DECK.slides[0].elements[0];
    expect(el.x).toBeCloseTo(0, 10);
    expect(el.y).toBeCloseTo(0.2, 10);
  });

  it('Alt+] initializes zIndex on all elements and brings the selected element forward one step', () => {
    window.CanvasEditor.selectElement(0); // origIndex 0, currently lowest stacking
    dispatchKey({ key: ']', altKey: true });
    const elements = window.DECK.slides[0].elements;
    expect(elements[0].zIndex).toBe(1);
    expect(elements[1].zIndex).toBe(0);
    expect(elements[2].zIndex).toBe(2);
  });

  it('Alt+[ sends the selected element backward one step', () => {
    window.CanvasEditor.selectElement(2); // origIndex 2, currently highest stacking
    dispatchKey({ key: '[', altKey: true });
    const elements = window.DECK.slides[0].elements;
    expect(elements[2].zIndex).toBe(1);
    expect(elements[1].zIndex).toBe(2);
    expect(elements[0].zIndex).toBe(0);
  });

  it('Shift+Alt+] brings the selected element to the very front', () => {
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: ']', altKey: true, shiftKey: true });
    const elements = window.DECK.slides[0].elements;
    expect(elements[0].zIndex).toBe(3); // max(0,1,2) + 1
  });

  it('Shift+Alt+[ sends the selected element to the very back', () => {
    window.CanvasEditor.selectElement(2);
    dispatchKey({ key: '[', altKey: true, shiftKey: true });
    const elements = window.DECK.slides[0].elements;
    expect(elements[2].zIndex).toBe(-1); // min(0,1,2) - 1
  });

  it('ignores keyboard shortcuts when an input element has focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: 'Delete' });
    expect(window.DECK.slides[0].elements.length).toBe(3);
    input.remove();
  });

  it('ignores keyboard shortcuts when a textarea element has focus', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: 'ArrowRight' });
    expect(window.DECK.slides[0].elements[0].x).toBe(0);
    textarea.remove();
  });

  it('fires onChange when deleting, duplicating, nudging, and z-ordering', () => {
    const cb = jest.fn();
    window.CanvasEditor.onChange(cb);
    window.CanvasEditor.selectElement(0);
    dispatchKey({ key: 'ArrowRight' });
    expect(cb).toHaveBeenCalled();
  });

  it('Cmd+Z is a no-op when no _undoRedoHook is installed (does not throw)', () => {
    expect(() => dispatchKey({ key: 'z', ctrlKey: true })).not.toThrow();
  });

  it('Cmd+Z/Cmd+Shift+Z call the installed _undoRedoHook', () => {
    const undo = jest.fn();
    const redo = jest.fn();
    window.CanvasEditor._undoRedoHook = { undo, redo };
    dispatchKey({ key: 'z', ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
    window.CanvasEditor._undoRedoHook = null;
  });
});
