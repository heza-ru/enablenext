require('../deck-renderer.js');
require('../deck-schema-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-history.js');
require('../canvas-slide-actions.js');

function makeMountEl() {
  const mount = document.createElement('div');
  Object.defineProperty(mount, 'getBoundingClientRect', {
    value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    configurable: true,
  });
  document.body.appendChild(mount);
  return mount;
}

function slide(text) {
  return { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: text }] };
}

describe('CanvasSlideActions.reorderSlide', () => {
  let mount;
  beforeEach(() => {
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [slide('A'), slide('B'), slide('C')] };
  });

  afterEach(() => {
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('swaps the two slides\' array positions and re-mounts at the new index', () => {
    window.CanvasEditor.mount(mount, 1); // active = 'B'
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');

    window.CanvasSlideActions.reorderSlide(-1); // move 'B' up, swapping with 'A'

    expect(window.DECK.slides[0].elements[0].text).toBe('B');
    expect(window.DECK.slides[1].elements[0].text).toBe('A');
    expect(window.DECK.slides[2].elements[0].text).toBe('C');
    expect(mountSpy).toHaveBeenCalledWith(mount, 0);
    expect(window.CanvasEditor.getActiveSlideIndex()).toBe(0);

    mountSpy.mockRestore();
  });

  it('moving down swaps with the next slide and re-mounts at the new (higher) index', () => {
    window.CanvasEditor.mount(mount, 0); // active = 'A'
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');

    window.CanvasSlideActions.reorderSlide(1);

    expect(window.DECK.slides[0].elements[0].text).toBe('B');
    expect(window.DECK.slides[1].elements[0].text).toBe('A');
    expect(mountSpy).toHaveBeenCalledWith(mount, 1);
    expect(window.CanvasEditor.getActiveSlideIndex()).toBe(1);

    mountSpy.mockRestore();
  });

  it('no-ops when moving up from index 0', () => {
    window.CanvasEditor.mount(mount, 0);
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');
    const before = window.DECK.slides.map((s) => s.elements[0].text);

    window.CanvasSlideActions.reorderSlide(-1);

    expect(window.DECK.slides.map((s) => s.elements[0].text)).toEqual(before);
    expect(mountSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();

    mountSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('no-ops when moving down from the last index', () => {
    window.CanvasEditor.mount(mount, 2);
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');
    const before = window.DECK.slides.map((s) => s.elements[0].text);

    window.CanvasSlideActions.reorderSlide(1);

    expect(window.DECK.slides.map((s) => s.elements[0].text)).toEqual(before);
    expect(mountSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();

    mountSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('pushes to CanvasHistory before mutating, then notifies after', () => {
    window.CanvasEditor.mount(mount, 0);
    const pushSpy = jest.spyOn(window.CanvasHistory, 'push');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    window.CanvasSlideActions.reorderSlide(1);

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(notifySpy.mock.invocationCallOrder[0]);

    pushSpy.mockRestore();
    notifySpy.mockRestore();
  });
});

describe('CanvasSlideActions.duplicateSlide', () => {
  let mount;
  beforeEach(() => {
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [slide('A'), slide('B')] };
  });

  afterEach(() => {
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('deep-clones the active slide and splices it in right after, without disturbing the original', () => {
    window.CanvasEditor.mount(mount, 0);

    window.CanvasSlideActions.duplicateSlide();

    expect(window.DECK.slides.length).toBe(3);
    expect(window.DECK.slides[0].elements[0].text).toBe('A');
    expect(window.DECK.slides[1].elements[0].text).toBe('A');
    expect(window.DECK.slides[2].elements[0].text).toBe('B');
    expect(window.DECK.slides[1]).not.toBe(window.DECK.slides[0]);
    expect(window.DECK.slides[1].elements).not.toBe(window.DECK.slides[0].elements);

    // Mutating the duplicate must not affect the original (deep clone, not shared refs).
    window.DECK.slides[1].elements[0].text = 'MUTATED';
    expect(window.DECK.slides[0].elements[0].text).toBe('A');
  });

  it('does not remount or change the active slide index', () => {
    window.CanvasEditor.mount(mount, 0);
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');

    window.CanvasSlideActions.duplicateSlide();

    expect(mountSpy).not.toHaveBeenCalled();
    expect(window.CanvasEditor.getActiveSlideIndex()).toBe(0);

    mountSpy.mockRestore();
  });

  it('pushes to CanvasHistory before mutating, then notifies after', () => {
    window.CanvasEditor.mount(mount, 0);
    const pushSpy = jest.spyOn(window.CanvasHistory, 'push');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    window.CanvasSlideActions.duplicateSlide();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(notifySpy.mock.invocationCallOrder[0]);

    pushSpy.mockRestore();
    notifySpy.mockRestore();
  });
});

describe('CanvasSlideActions.deleteSlide', () => {
  let mount;
  beforeEach(() => {
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [slide('A'), slide('B'), slide('C')] };
  });

  afterEach(() => {
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('removes the active slide and remounts at min(idx, length-1)', () => {
    window.CanvasEditor.mount(mount, 1); // active = 'B'
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');

    window.CanvasSlideActions.deleteSlide();

    expect(window.DECK.slides.length).toBe(2);
    expect(window.DECK.slides.map((s) => s.elements[0].text)).toEqual(['A', 'C']);
    expect(mountSpy).toHaveBeenCalledWith(mount, 1); // 'C' now occupies index 1

    mountSpy.mockRestore();
  });

  it('remounts at length-1 when deleting the last slide', () => {
    window.CanvasEditor.mount(mount, 2); // active = 'C', last index
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');

    window.CanvasSlideActions.deleteSlide();

    expect(window.DECK.slides.length).toBe(2);
    expect(mountSpy).toHaveBeenCalledWith(mount, 1);

    mountSpy.mockRestore();
  });

  it('guards against deleting the last remaining slide', () => {
    window.DECK.slides = [slide('OnlyOne')];
    window.CanvasEditor.mount(mount, 0);
    const mountSpy = jest.spyOn(window.CanvasEditor, 'mount');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    window.CanvasSlideActions.deleteSlide();

    expect(window.DECK.slides.length).toBe(1);
    expect(mountSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();

    mountSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('pushes to CanvasHistory before mutating, then notifies after', () => {
    window.CanvasEditor.mount(mount, 0);
    const pushSpy = jest.spyOn(window.CanvasHistory, 'push');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    window.CanvasSlideActions.deleteSlide();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(notifySpy.mock.invocationCallOrder[0]);

    pushSpy.mockRestore();
    notifySpy.mockRestore();
  });
});

describe('CanvasSlideActions trigger button lifecycle', () => {
  let mount;
  beforeEach(() => {
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [slide('A'), slide('B'), slide('C')] };
  });

  afterEach(() => {
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  function up() { return document.querySelector('[data-canvas-slide-reorder-up]'); }
  function down() { return document.querySelector('[data-canvas-slide-reorder-down]'); }
  function dup() { return document.querySelector('[data-canvas-slide-duplicate]'); }
  function del() { return document.querySelector('[data-canvas-slide-delete]'); }

  it('mounting creates all four buttons; unmounting removes them', () => {
    expect(up()).toBeNull();
    window.CanvasEditor.mount(mount, 1);
    expect(up()).not.toBeNull();
    expect(down()).not.toBeNull();
    expect(dup()).not.toBeNull();
    expect(del()).not.toBeNull();
    window.CanvasEditor.unmount();
    expect(up()).toBeNull();
    expect(down()).toBeNull();
    expect(dup()).toBeNull();
    expect(del()).toBeNull();
  });

  it('disables the up button at index 0 and the down button at the last index', () => {
    window.CanvasEditor.mount(mount, 0);
    expect(up().disabled).toBe(true);
    expect(down().disabled).toBe(false);
    window.CanvasEditor.unmount();

    window.CanvasEditor.mount(mount, 2);
    expect(up().disabled).toBe(false);
    expect(down().disabled).toBe(true);
  });

  it('disables the delete button when only one slide remains', () => {
    window.DECK.slides = [slide('OnlyOne')];
    window.CanvasEditor.mount(mount, 0);
    expect(del().disabled).toBe(true);
  });

  it('does not disable the delete button when more than one slide remains', () => {
    window.CanvasEditor.mount(mount, 0);
    expect(del().disabled).toBe(false);
  });

  it('clicking the duplicate button invokes CanvasSlideActions.duplicateSlide', () => {
    window.CanvasEditor.mount(mount, 0);
    dup().click();
    expect(window.DECK.slides.length).toBe(4);
  });
});
