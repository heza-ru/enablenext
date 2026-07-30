require('../deck-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-context-menu.js');

describe('CanvasContextMenu', () => {
  let mount;

  function fireContextMenu(target, x, y) {
    const evt = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
    });
    target.dispatchEvent(evt);
    return evt;
  }

  function menuItemEl(label) {
    return document.querySelector(`[data-menu-item="${label}"]`);
  }

  function clickMenuItem(label) {
    const el = menuItemEl(label);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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
    window.CanvasContextMenu.hide();
  });

  afterEach(() => {
    window.CanvasContextMenu.hide();
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('right-click with no selection does not show the menu', () => {
    const stage = window.CanvasEditor.getStage();
    const container = stage.container();
    fireContextMenu(container, 50, 60);
    expect(window.CanvasContextMenu.isVisible()).toBe(false);
  });

  it('right-click with a selection shows the menu at the click position and prevents the native menu', () => {
    window.CanvasEditor.selectElement(0);
    const stage = window.CanvasEditor.getStage();
    const container = stage.container();
    const evt = fireContextMenu(container, 123, 77);
    expect(window.CanvasContextMenu.isVisible()).toBe(true);
    expect(evt.defaultPrevented).toBe(true);
    const menu = document.querySelector('[data-canvas-context-menu]');
    expect(menu.style.left).toBe('123px');
    expect(menu.style.top).toBe('77px');
  });

  it('Escape hides the menu', () => {
    window.CanvasEditor.selectElement(0);
    const stage = window.CanvasEditor.getStage();
    fireContextMenu(stage.container(), 10, 10);
    expect(window.CanvasContextMenu.isVisible()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(window.CanvasContextMenu.isVisible()).toBe(false);
  });

  it('clicking outside the menu hides it', () => {
    window.CanvasEditor.selectElement(0);
    const stage = window.CanvasEditor.getStage();
    fireContextMenu(stage.container(), 10, 10);
    expect(window.CanvasContextMenu.isVisible()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(window.CanvasContextMenu.isVisible()).toBe(false);
  });

  it('clicking "Delete" removes the selected element the same way pressing Delete does', () => {
    window.CanvasEditor.selectElement(1); // element B
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Delete');
    const elements = window.DECK.slides[0].elements;
    expect(elements.length).toBe(2);
    expect(elements.map((e) => e.text)).toEqual(['A', 'C']);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([]);
    expect(window.CanvasContextMenu.isVisible()).toBe(false);
  });

  it('clicking "Duplicate" duplicates the selected element with a +0.2in offset', () => {
    window.CanvasEditor.selectElement(0);
    const originalBefore = { ...window.DECK.slides[0].elements[0] };
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Duplicate');
    const elements = window.DECK.slides[0].elements;
    expect(elements.length).toBe(4);
    const dup = elements[3];
    expect(elements[0]).toEqual(originalBefore);
    expect(dup.x).toBeCloseTo(originalBefore.x + 0.2, 10);
    expect(dup.y).toBeCloseTo(originalBefore.y + 0.2, 10);
    expect(window.CanvasEditor.getSelectedIndices()).toEqual([3]);
  });

  it('clicking "Bring to Front" matches Shift+Alt+] behavior', () => {
    window.CanvasEditor.selectElement(0);
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Bring to Front');
    const elements = window.DECK.slides[0].elements;
    expect(elements[0].zIndex).toBe(3); // max(0,1,2) + 1
  });

  it('clicking "Send to Back" matches Shift+Alt+[ behavior', () => {
    window.CanvasEditor.selectElement(2);
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Send to Back');
    const elements = window.DECK.slides[0].elements;
    expect(elements[2].zIndex).toBe(-1); // min(0,1,2) - 1
  });

  it('clicking "Bring Forward" matches Alt+] behavior', () => {
    window.CanvasEditor.selectElement(0);
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Bring Forward');
    const elements = window.DECK.slides[0].elements;
    expect(elements[0].zIndex).toBe(1);
    expect(elements[1].zIndex).toBe(0);
    expect(elements[2].zIndex).toBe(2);
  });

  it('clicking "Send Backward" matches Alt+[ behavior', () => {
    window.CanvasEditor.selectElement(2);
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    clickMenuItem('Send Backward');
    const elements = window.DECK.slides[0].elements;
    expect(elements[2].zIndex).toBe(1);
    expect(elements[1].zIndex).toBe(2);
    expect(elements[0].zIndex).toBe(0);
  });

  it('hides the menu when selection becomes empty via a subsequent keyboard Delete', () => {
    window.CanvasEditor.selectElement(0);
    fireContextMenu(window.CanvasEditor.getStage().container(), 10, 10);
    expect(window.CanvasContextMenu.isVisible()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(window.CanvasContextMenu.isVisible()).toBe(false);
  });
});
