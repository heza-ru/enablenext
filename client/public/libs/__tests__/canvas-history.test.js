require('../deck-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-toolbars.js');
require('../canvas-history.js');

describe('CanvasHistory', () => {
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
    window.CanvasHistory._resetForTests();
  });

  afterEach(() => {
    window.CanvasHistory._resetForTests();
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('exposes the CanvasHistory API and wires the CanvasEditor undo/redo hook', () => {
    expect(window.CanvasHistory).toBeDefined();
    expect(typeof window.CanvasHistory.push).toBe('function');
    expect(typeof window.CanvasHistory.undo).toBe('function');
    expect(typeof window.CanvasHistory.redo).toBe('function');
    expect(typeof window.CanvasHistory.canUndo).toBe('function');
    expect(typeof window.CanvasHistory.canRedo).toBe('function');
    expect(window.CanvasEditor._undoRedoHook.undo).toBe(window.CanvasHistory.undo);
    expect(window.CanvasEditor._undoRedoHook.redo).toBe(window.CanvasHistory.redo);
  });

  it('canUndo/canRedo reflect empty stacks initially', () => {
    expect(window.CanvasHistory.canUndo()).toBe(false);
    expect(window.CanvasHistory.canRedo()).toBe(false);
  });

  it('push() followed by a mutation, then undo(), restores the exact prior window.DECK state', () => {
    const before = JSON.parse(JSON.stringify(window.DECK));
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 99;
    expect(window.CanvasHistory.canUndo()).toBe(true);
    window.CanvasHistory.undo();
    expect(window.DECK).toEqual(before);
    expect(window.CanvasHistory.canUndo()).toBe(false);
    expect(window.CanvasHistory.canRedo()).toBe(true);
  });

  it('undo() then redo() replays the mutation exactly', () => {
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 99;
    const afterMutation = JSON.parse(JSON.stringify(window.DECK));
    window.CanvasHistory.undo();
    window.CanvasHistory.redo();
    expect(window.DECK).toEqual(afterMutation);
    expect(window.CanvasHistory.canRedo()).toBe(false);
    expect(window.CanvasHistory.canUndo()).toBe(true);
  });

  it('a sequence of two pushes/mutations undoes step by step to the exact expected state at each point', () => {
    const state0 = JSON.parse(JSON.stringify(window.DECK));

    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 1;
    const state1 = JSON.parse(JSON.stringify(window.DECK));

    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 2;
    const state2 = JSON.parse(JSON.stringify(window.DECK));

    expect(window.DECK).toEqual(state2);

    window.CanvasHistory.undo();
    expect(window.DECK).toEqual(state1);

    window.CanvasHistory.undo();
    expect(window.DECK).toEqual(state0);

    expect(window.CanvasHistory.canUndo()).toBe(false);

    window.CanvasHistory.redo();
    expect(window.DECK).toEqual(state1);

    window.CanvasHistory.redo();
    expect(window.DECK).toEqual(state2);

    expect(window.CanvasHistory.canRedo()).toBe(false);
  });

  it('undo() on an empty past stack is a no-op', () => {
    const before = JSON.parse(JSON.stringify(window.DECK));
    window.CanvasHistory.undo();
    expect(window.DECK).toEqual(before);
  });

  it('redo() on an empty future stack is a no-op', () => {
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 1;
    const before = JSON.parse(JSON.stringify(window.DECK));
    window.CanvasHistory.redo();
    expect(window.DECK).toEqual(before);
  });

  it('a new push() after an undo clears the redo (future) stack', () => {
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 1;
    window.CanvasHistory.undo();
    expect(window.CanvasHistory.canRedo()).toBe(true);

    // A brand-new action invalidates whatever was in the redo stack.
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 2;
    expect(window.CanvasHistory.canRedo()).toBe(false);
  });

  it('caps the past stack at 50 entries, dropping the oldest (not the newest)', () => {
    for (let i = 0; i < 60; i++) {
      window.CanvasHistory.push();
      window.DECK.slides[0].elements[0].x = i;
    }
    // Walk back as far as possible and count how many undos succeed.
    let undoCount = 0;
    while (window.CanvasHistory.canUndo()) {
      window.CanvasHistory.undo();
      undoCount++;
    }
    expect(undoCount).toBe(50);
    // After undoing everything available, we should have landed on the
    // state as of the 10th push (60 - 50 = 10), i.e. x === 9 (the value set
    // right after the 10th push, before the 11th push captured it) — the
    // oldest 10 snapshots were dropped, not the newest.
    expect(window.DECK.slides[0].elements[0].x).toBe(9);
  });

  it('undo() calls CanvasEditor.remount(), deselect(), and CanvasToolbars.hide()', () => {
    const remountSpy = jest.spyOn(window.CanvasEditor, 'remount');
    const deselectSpy = jest.spyOn(window.CanvasEditor, 'deselect');
    const hideSpy = jest.spyOn(window.CanvasToolbars, 'hide');
    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 1;
    window.CanvasHistory.undo();
    expect(remountSpy).toHaveBeenCalled();
    expect(deselectSpy).toHaveBeenCalled();
    expect(hideSpy).toHaveBeenCalled();
    remountSpy.mockRestore();
    deselectSpy.mockRestore();
    hideSpy.mockRestore();
  });

  it('undo() and redo() each trigger a subscriber registered via CanvasEditor.onChange() (autosave path)', () => {
    const onChangeSpy = jest.fn();
    window.CanvasEditor.onChange(onChangeSpy);

    window.CanvasHistory.push();
    window.DECK.slides[0].elements[0].x = 1;
    onChangeSpy.mockClear();

    window.CanvasHistory.undo();
    expect(onChangeSpy).toHaveBeenCalled();

    onChangeSpy.mockClear();
    window.CanvasHistory.redo();
    expect(onChangeSpy).toHaveBeenCalled();
  });

  it('remount() rebuilds the Konva stage from the current window.DECK state (stale node refs are gone)', () => {
    const staleStage = window.CanvasEditor.getStage();
    window.DECK.slides[0].elements.push({ type: 'text', x: 3, y: 3, w: 1, h: 1, text: 'D' });
    window.CanvasEditor.remount();
    const newStage = window.CanvasEditor.getStage();
    expect(newStage).not.toBe(staleStage);
    const layer = newStage.getLayers()[0];
    const elementNodes = layer.getChildren().filter((n) => n.getClassName() !== 'Transformer');
    expect(elementNodes.length).toBe(4);
  });

  describe('real mutation call sites push exactly once per logical action', () => {
    beforeEach(() => {
      jest.spyOn(window.CanvasHistory, 'push');
    });
    afterEach(() => {
      window.CanvasHistory.push.mockRestore();
    });

    it('deleteSelected() with multiple selected pushes once, not per element', () => {
      window.CanvasEditor.selectElement(0);
      window.CanvasEditor.toggleSelectElement(1);
      window.CanvasEditor.deleteSelected();
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('duplicateSelected() with multiple selected pushes once', () => {
      window.CanvasEditor.selectElement(0);
      window.CanvasEditor.toggleSelectElement(1);
      window.CanvasEditor.duplicateSelected();
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('a single ArrowRight keypress with multiple selected elements pushes once', () => {
      window.CanvasEditor.selectElement(0);
      window.CanvasEditor.toggleSelectElement(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }));
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('Alt+] (moveZOrder) pushes once', () => {
      window.CanvasEditor.selectElement(0);
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ']', altKey: true }));
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('Shift+Alt+] (moveZOrderExtreme) pushes once', () => {
      window.CanvasEditor.selectElement(0);
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ']', altKey: true, shiftKey: true }));
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('a real dragend pushes once', () => {
      const stage = window.CanvasEditor.getStage();
      const layer = stage.getLayers()[0];
      const node = layer.getChildren().find((n) => n._elIndex === 0);
      node.x(node.x() + 40);
      node.fire('dragend', { target: node }, true);
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('a real transformend pushes once', () => {
      const stage = window.CanvasEditor.getStage();
      const layer = stage.getLayers()[0];
      const node = layer.getChildren().find((n) => n._elIndex === 0);
      node.fire('transformend', { target: node }, true);
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
    });

    it('a CanvasToolbars control edit pushes once via the shared mutate() helper', () => {
      window.DECK.slides[0].elements[0].fontFamily = 'DM Sans';
      const stage = window.CanvasEditor.getStage();
      const layer = stage.getLayers()[0];
      const node = layer.getChildren().find((n) => n._elIndex === 0);
      window.CanvasToolbars.showFor(0, node, stage);
      const select = document.querySelector('[data-toolbar-control="fontFamily"]');
      select.value = 'IBM Plex Sans';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(window.CanvasHistory.push).toHaveBeenCalledTimes(1);
      window.CanvasToolbars.hide();
    });
  });
});
