require('../deck-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-toolbars.js');

describe('CanvasToolbars', () => {
  let mount;

  function control(selector) {
    return document.querySelector(`[data-toolbar-control="${selector}"]`);
  }

  function fireInput(node, value) {
    node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function fireChange(node, value) {
    node.value = value;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fireClick(node) {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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
          { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello', fontSize: 14, color: 'FFFFFF', fontFamily: 'DM Sans', fontWeight: 'normal', align: 'left' },
          { type: 'shape', shape: 'rect', x: 0, y: 0, w: 2, h: 1, fill: '4a4560', opacity: 1 },
          { type: 'image', x: 2, y: 2, w: 2, h: 2, deckAsset: 'foo.png' },
        ],
      }],
    };
    window.CanvasEditor.mount(mount, 0);
  });

  afterEach(() => {
    window.CanvasToolbars.hide();
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  function findNode(elIndex) {
    const stage = window.CanvasEditor.getStage();
    const layer = stage.getLayers()[0];
    return layer.getChildren().find((n) => n._elIndex === elIndex);
  }

  describe('hex color conversion', () => {
    it('round-trips bare hex -> #-prefixed and back', () => {
      expect(window.CanvasToolbars._toInputColor('FFFFFF')).toBe('#FFFFFF');
      expect(window.CanvasToolbars._fromInputColor('#FFFFFF')).toBe('FFFFFF');
      expect(window.CanvasToolbars._fromInputColor(window.CanvasToolbars._toInputColor('4a4560'))).toBe('4a4560');
    });

    it('tolerates an already-#-prefixed DECK value defensively', () => {
      expect(window.CanvasToolbars._toInputColor('#ABCDEF')).toBe('#ABCDEF');
    });
  });

  describe('showFor / hide / isVisible', () => {
    it('is hidden until showFor is called', () => {
      expect(window.CanvasToolbars.isVisible()).toBe(false);
    });

    it('hide() hides a shown toolbar', () => {
      const stage = window.CanvasEditor.getStage();
      window.CanvasToolbars.showFor(0, findNode(0), stage);
      expect(window.CanvasToolbars.isVisible()).toBe(true);
      window.CanvasToolbars.hide();
      expect(window.CanvasToolbars.isVisible()).toBe(false);
    });
  });

  describe('text controls', () => {
    beforeEach(() => {
      const stage = window.CanvasEditor.getStage();
      window.CanvasToolbars.showFor(0, findNode(0), stage);
    });

    it('renders exactly the text control set', () => {
      expect(control('fontFamily')).toBeTruthy();
      expect(control('fontSize')).toBeTruthy();
      expect(control('color')).toBeTruthy();
      expect(control('bold')).toBeTruthy();
      expect(control('align-left')).toBeTruthy();
      expect(control('align-center')).toBeTruthy();
      expect(control('align-right')).toBeTruthy();
      // Shape/image-only controls must not leak in.
      expect(control('fill')).toBeFalsy();
      expect(control('replace-image')).toBeFalsy();
    });

    it('font family select is constrained to exactly DM Sans / IBM Plex Sans', () => {
      const options = Array.from(control('fontFamily').options).map((o) => o.value);
      expect(options).toEqual(['DM Sans', 'IBM Plex Sans']);
    });

    it('changing font family writes el.fontFamily and updates the node', () => {
      fireChange(control('fontFamily'), 'IBM Plex Sans');
      expect(window.DECK.slides[0].elements[0].fontFamily).toBe('IBM Plex Sans');
      expect(findNode(0).fontFamily()).toBe('IBM Plex Sans');
    });

    it('changing font size writes el.fontSize', () => {
      fireChange(control('fontSize'), '32');
      expect(window.DECK.slides[0].elements[0].fontSize).toBe(32);
    });

    it('changing color writes el.color as bare hex (no #)', () => {
      fireInput(control('color'), '#00ff00');
      expect(window.DECK.slides[0].elements[0].color).toBe('00ff00');
    });

    it('clicking bold toggles el.fontWeight between bold/normal (not the legacy bold field)', () => {
      const el0 = window.DECK.slides[0].elements[0];
      expect(el0.fontWeight).toBe('normal');
      fireClick(control('bold'));
      expect(el0.fontWeight).toBe('bold');
      expect(el0.bold).toBeUndefined();
      fireClick(control('bold'));
      expect(el0.fontWeight).toBe('normal');
    });

    it('clicking an align button writes el.align', () => {
      fireClick(control('align-right'));
      expect(window.DECK.slides[0].elements[0].align).toBe('right');
    });
  });

  describe('shape controls', () => {
    beforeEach(() => {
      const stage = window.CanvasEditor.getStage();
      window.CanvasToolbars.showFor(1, findNode(1), stage);
    });

    it('renders exactly the shape control set', () => {
      expect(control('fill')).toBeTruthy();
      expect(control('opacity')).toBeTruthy();
      expect(control('fontFamily')).toBeFalsy();
      expect(control('replace-image')).toBeFalsy();
    });

    it('changing fill writes el.fill as bare hex', () => {
      fireInput(control('fill'), '#123456');
      expect(window.DECK.slides[0].elements[1].fill).toBe('123456');
    });

    it('changing opacity writes el.opacity as a number', () => {
      fireInput(control('opacity'), '0.5');
      expect(window.DECK.slides[0].elements[1].opacity).toBe(0.5);
    });
  });

  describe('image controls', () => {
    beforeEach(() => {
      const stage = window.CanvasEditor.getStage();
      window.CanvasToolbars.showFor(2, findNode(2), stage);
    });

    afterEach(() => {
      window.CanvasToolbars._imageEditorHook = null;
    });

    it('renders exactly the image control set', () => {
      expect(control('replace-image')).toBeTruthy();
      expect(control('crop-image')).toBeTruthy();
      expect(control('fill')).toBeFalsy();
      expect(control('fontFamily')).toBeFalsy();
    });

    it('no-ops when no image editor hook is installed', () => {
      expect(() => fireClick(control('replace-image'))).not.toThrow();
    });

    it('calls the installed hook with the element index', () => {
      const replace = jest.fn();
      const crop = jest.fn();
      window.CanvasToolbars._imageEditorHook = { replace, crop };
      fireClick(control('replace-image'));
      expect(replace).toHaveBeenCalledWith(2);
      fireClick(control('crop-image'));
      expect(crop).toHaveBeenCalledWith(2);
    });
  });

  describe('wiring into CanvasEditor selection', () => {
    it('selecting a single element shows the toolbar with the right control set', () => {
      window.CanvasEditor.selectElement(0);
      expect(window.CanvasToolbars.isVisible()).toBe(true);
      expect(control('fontFamily')).toBeTruthy();
    });

    it('deselecting hides the toolbar', () => {
      window.CanvasEditor.selectElement(0);
      expect(window.CanvasToolbars.isVisible()).toBe(true);
      window.CanvasEditor.deselect();
      expect(window.CanvasToolbars.isVisible()).toBe(false);
    });

    it('multi-select hides the toolbar', () => {
      window.CanvasEditor.selectElement(0);
      expect(window.CanvasToolbars.isVisible()).toBe(true);
      window.CanvasEditor.toggleSelectElement(1);
      expect(window.CanvasToolbars.isVisible()).toBe(false);
    });

    it('deleting the selected element hides the toolbar', () => {
      window.CanvasEditor.selectElement(0);
      expect(window.CanvasToolbars.isVisible()).toBe(true);
      window.CanvasEditor.deleteSelected();
      expect(window.CanvasToolbars.isVisible()).toBe(false);
    });
  });
});
