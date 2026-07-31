const fs = require('fs');
const path = require('path');

require('../deck-renderer.js');
require('../deck-schema-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-history.js');
require('../canvas-template-picker.js');

function mockOneEntryLibrary() {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({
      slides: [
        { componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] },
      ],
    }),
  });
}

function makeMountEl() {
  const mount = document.createElement('div');
  Object.defineProperty(mount, 'getBoundingClientRect', {
    value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    configurable: true,
  });
  document.body.appendChild(mount);
  return mount;
}

describe('CanvasTemplatePicker.setSlideComponent', () => {
  let mount;
  beforeEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Old' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Other slide' }] },
      ],
    };
    mockOneEntryLibrary();
  });

  afterEach(() => {
    window.CanvasTemplatePicker.close();
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
    delete global.fetch;
  });

  it('replaces the slide elements/componentId/layout with the fetched entry', async () => {
    window.CanvasEditor.mount(mount, 0);
    await window.CanvasTemplatePicker.setSlideComponent(0, 'slide-97');
    expect(window.DECK.slides[0].elements[0].text).toBe('Thank you!');
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
    expect(window.DECK.slides[0].layout).toBe('schema');
  });

  it('rejects with a clear error for an unknown componentId', async () => {
    await expect(window.CanvasTemplatePicker.setSlideComponent(0, 'slide-9999')).rejects.toThrow(/unknown componentId/);
  });

  it('caches the fetched library across calls (fetch only called once)', async () => {
    window.CanvasEditor.mount(mount, 0);
    await window.CanvasTemplatePicker.setSlideComponent(0, 'slide-97');
    await window.CanvasTemplatePicker.setSlideComponent(0, 'slide-97');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('pushes to CanvasHistory before mutating, then remounts/deselects/notifies in order, when the swapped slide is the active one', async () => {
    window.CanvasEditor.mount(mount, 0);
    const pushSpy = jest.spyOn(window.CanvasHistory, 'push');
    const remountSpy = jest.spyOn(window.CanvasEditor, 'remount');
    const deselectSpy = jest.spyOn(window.CanvasEditor, 'deselect');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    await window.CanvasTemplatePicker.setSlideComponent(0, 'slide-97');

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(remountSpy).toHaveBeenCalledTimes(1);
    expect(deselectSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    // push happens before the DECK mutation is visible to remount/notify;
    // remount/deselect/notify happen (in that order) after.
    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(remountSpy.mock.invocationCallOrder[0]);
    expect(remountSpy.mock.invocationCallOrder[0]).toBeLessThan(deselectSpy.mock.invocationCallOrder[0]);
    expect(deselectSpy.mock.invocationCallOrder[0]).toBeLessThan(notifySpy.mock.invocationCallOrder[0]);

    pushSpy.mockRestore();
    remountSpy.mockRestore();
    deselectSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('does not remount/deselect when swapping a slide other than the currently-mounted one, but still notifies', async () => {
    window.CanvasEditor.mount(mount, 0);
    const remountSpy = jest.spyOn(window.CanvasEditor, 'remount');
    const deselectSpy = jest.spyOn(window.CanvasEditor, 'deselect');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    await window.CanvasTemplatePicker.setSlideComponent(1, 'slide-97');

    expect(window.DECK.slides[1].componentId).toBe('slide-97');
    expect(remountSpy).not.toHaveBeenCalled();
    expect(deselectSpy).not.toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalledTimes(1);

    remountSpy.mockRestore();
    deselectSpy.mockRestore();
    notifySpy.mockRestore();
  });
});

describe('CanvasTemplatePicker trigger button + popover lifecycle', () => {
  let mount;
  beforeEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'S1' }] }] };
    mockOneEntryLibrary();
  });

  afterEach(() => {
    window.CanvasTemplatePicker.close();
    if (window.CanvasEditor.isMounted()) window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
    delete global.fetch;
  });

  function trigger() {
    return document.querySelector('[data-canvas-template-trigger]');
  }

  function popover() {
    return document.querySelector('[data-canvas-template-popover]');
  }

  it('mounting the canvas editor creates the trigger button; unmounting removes it', () => {
    expect(trigger()).toBeNull();
    window.CanvasEditor.mount(mount, 0);
    expect(trigger()).not.toBeNull();
    window.CanvasEditor.unmount();
    expect(trigger()).toBeNull();
  });

  it('clicking the trigger opens the popover; clicking it again while open closes it', async () => {
    window.CanvasEditor.mount(mount, 0);
    expect(popover()).toBeNull();
    trigger().click();
    expect(popover()).not.toBeNull();
    trigger().click();
    expect(popover()).toBeNull();
  });

  it('unmounting the canvas editor also closes an open popover', () => {
    window.CanvasEditor.mount(mount, 0);
    trigger().click();
    expect(popover()).not.toBeNull();
    window.CanvasEditor.unmount();
    expect(popover()).toBeNull();
  });

  it('Escape closes an open popover', () => {
    window.CanvasEditor.mount(mount, 0);
    trigger().click();
    expect(popover()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover()).toBeNull();
  });

  it('opening a second popover closes any previously-open one (single global popover)', () => {
    window.CanvasEditor.mount(mount, 0);
    trigger().click();
    const first = popover();
    expect(first).not.toBeNull();
    window.CanvasTemplatePicker.open(trigger(), 0);
    expect(document.querySelectorAll('[data-canvas-template-popover]').length).toBe(1);
  });
});

describe('CanvasTemplatePicker popover thumbnails (real master-deck-library.json)', () => {
  let mount;

  function range(start, end) {
    const ids = [];
    for (let i = start; i <= end; i++) ids.push('slide-' + i);
    return ids;
  }
  const curatedIds = [].concat(
    range(5, 9), // Title
    range(18, 19), // Agenda
    range(21, 25), // Section
    range(97, 100), // Closing
  );

  beforeEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
    mount = makeMountEl();
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'S1' }] }] };
    const realLibrary = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'brand', 'master-deck-library.json'), 'utf8'),
    );
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(realLibrary) });
    window.CanvasEditor.mount(mount, 0);
  });

  afterEach(() => {
    window.CanvasTemplatePicker.close();
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
    delete global.fetch;
  });

  it('renders exactly one live-rendered thumbnail per curated componentId', async () => {
    document.querySelector('[data-canvas-template-trigger]').click();
    // fetchLibrary() chains fetch().then(json).then(cache), and open()
    // chains a further .then() on top of that -- a couple of microtask
    // flushes are needed for the thumbnails to actually be appended.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const thumbs = document.querySelectorAll('[data-canvas-template-thumb]');
    expect(thumbs.length).toBe(curatedIds.length);
    const renderedIds = Array.from(thumbs).map((t) => t.dataset.componentId);
    expect(renderedIds.slice().sort()).toEqual(curatedIds.slice().sort());
    // Each thumbnail contains genuine rendered schema content, not a blank box.
    expect(thumbs[0].querySelector('.schema-text, .schema-shape, .schema-image')).not.toBeNull();
  });

  it('clicking a thumbnail swaps the slide and closes the popover', async () => {
    document.querySelector('[data-canvas-template-trigger]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const thumb = Array.from(document.querySelectorAll('[data-canvas-template-thumb]'))
      .find((t) => t.dataset.componentId === 'slide-97');
    expect(thumb).toBeTruthy();
    thumb.click();

    expect(document.querySelector('[data-canvas-template-popover]')).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
  });
});
