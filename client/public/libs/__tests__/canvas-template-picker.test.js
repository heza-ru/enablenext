const fs = require('fs');
const path = require('path');

require('../deck-renderer.js');
require('../deck-schema-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-history.js');
require('../canvas-template-picker.js');

function mockOneEntryLibrary() {
  var library = {
    slides: [
      { componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] },
    ],
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(library)),
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify(realLibrary)) });
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

  it('renders the "+ Add slide" insert popover thumbnails too (curated ids), from the same real library', async () => {
    document.querySelector('[data-canvas-insert-trigger]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const popover = document.querySelector('[data-canvas-insert-popover]');
    expect(popover).not.toBeNull();
    const thumbs = popover.querySelectorAll('[data-canvas-template-thumb]');
    expect(thumbs.length).toBe(curatedIds.length);
  });

  it('clicking an insert-popover thumbnail inserts a new slide (does not swap the current one) and closes the popover', async () => {
    document.querySelector('[data-canvas-insert-trigger]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const popover = document.querySelector('[data-canvas-insert-popover]');
    const thumb = Array.from(popover.querySelectorAll('[data-canvas-template-thumb]'))
      .find((t) => t.dataset.componentId === 'slide-97');
    expect(thumb).toBeTruthy();
    thumb.click();

    expect(document.querySelector('[data-canvas-insert-popover]')).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(window.DECK.slides.length).toBe(2);
    expect(window.DECK.slides[1].componentId).toBe('slide-97');
    expect(window.DECK.slides[0].elements[0].text).toBe('S1'); // current slide untouched
  });
});

describe('CanvasTemplatePicker.insertSlideAfter (Task 12)', () => {
  let mount;
  beforeEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
    if (window.CanvasHistory && window.CanvasHistory._resetForTests) window.CanvasHistory._resetForTests();
    mount = makeMountEl();
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Current' }] },
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

  it('adds exactly one new slide at currentIndex + 1 with the componentId\'s elements', async () => {
    window.CanvasEditor.mount(mount, 0);
    const before = window.DECK.slides.length;
    await window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-97');
    expect(window.DECK.slides.length).toBe(before + 1);
    expect(window.DECK.slides[1].componentId).toBe('slide-97');
    expect(window.DECK.slides[1].layout).toBe('schema');
    expect(window.DECK.slides[1].elements[0].text).toBe('Thank you!');
  });

  it('does not mutate the current slide (reference or content, byte-identical before/after)', async () => {
    window.CanvasEditor.mount(mount, 0);
    const currentBefore = window.DECK.slides[0];
    const elementsBefore = currentBefore.elements;
    const snapshotBefore = JSON.stringify(currentBefore);

    await window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-97');

    expect(window.DECK.slides[0]).toBe(currentBefore);
    expect(window.DECK.slides[0].elements).toBe(elementsBefore);
    expect(JSON.stringify(window.DECK.slides[0])).toBe(snapshotBefore);
  });

  it('inserts after an arbitrary index, not just 0', async () => {
    window.CanvasEditor.mount(mount, 1);
    await window.CanvasTemplatePicker.insertSlideAfter(1, 'slide-97');
    expect(window.DECK.slides.length).toBe(3);
    expect(window.DECK.slides[2].componentId).toBe('slide-97');
    expect(window.DECK.slides[0].elements[0].text).toBe('Current');
    expect(window.DECK.slides[1].elements[0].text).toBe('Other slide');
  });

  it('rejects with a clear error for an unknown componentId, without mutating slides', async () => {
    const before = window.DECK.slides.length;
    await expect(window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-9999')).rejects.toThrow(/unknown componentId/);
    expect(window.DECK.slides.length).toBe(before);
  });

  it('pushes to CanvasHistory before mutating, then notifies after, and never remounts/deselects (no auto-navigation)', async () => {
    window.CanvasEditor.mount(mount, 0);
    const pushSpy = jest.spyOn(window.CanvasHistory, 'push');
    const remountSpy = jest.spyOn(window.CanvasEditor, 'remount');
    const deselectSpy = jest.spyOn(window.CanvasEditor, 'deselect');
    const notifySpy = jest.spyOn(window.CanvasEditor, 'notifyChange');

    await window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-97');

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(notifySpy.mock.invocationCallOrder[0]);
    // No auto-navigation: the currently-mounted slide's rendering must not be
    // disturbed by inserting a slide elsewhere in the array.
    expect(remountSpy).not.toHaveBeenCalled();
    expect(deselectSpy).not.toHaveBeenCalled();
    // activeSlideIndex itself is untouched -- still pointed at slide 0.
    expect(window.CanvasEditor.getActiveSlideIndex()).toBe(0);

    pushSpy.mockRestore();
    remountSpy.mockRestore();
    deselectSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('caches the fetched library across calls (fetch only called once), sharing Task 11\'s cache', async () => {
    await window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-97');
    await window.CanvasTemplatePicker.insertSlideAfter(0, 'slide-97');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('CanvasTemplatePicker "+ Add slide" trigger/popover lifecycle (Task 12)', () => {
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

  function swapTrigger() {
    return document.querySelector('[data-canvas-template-trigger]');
  }
  function insertTrigger() {
    return document.querySelector('[data-canvas-insert-trigger]');
  }
  function swapPopover() {
    return document.querySelector('[data-canvas-template-popover]');
  }
  function insertPopover() {
    return document.querySelector('[data-canvas-insert-popover]');
  }

  it('mounting creates BOTH the swap trigger and the insert trigger as separate buttons; unmounting removes both', () => {
    expect(swapTrigger()).toBeNull();
    expect(insertTrigger()).toBeNull();
    window.CanvasEditor.mount(mount, 0);
    expect(swapTrigger()).not.toBeNull();
    expect(insertTrigger()).not.toBeNull();
    expect(swapTrigger()).not.toBe(insertTrigger());
    expect(insertTrigger().textContent).toBe('+ Add slide');
    window.CanvasEditor.unmount();
    expect(swapTrigger()).toBeNull();
    expect(insertTrigger()).toBeNull();
  });

  it('clicking the insert trigger opens its own popover; clicking it again closes it', () => {
    window.CanvasEditor.mount(mount, 0);
    expect(insertPopover()).toBeNull();
    insertTrigger().click();
    expect(insertPopover()).not.toBeNull();
    insertTrigger().click();
    expect(insertPopover()).toBeNull();
  });

  it('opening the insert popover while the swap popover is open closes the swap popover (mutual exclusion)', () => {
    window.CanvasEditor.mount(mount, 0);
    swapTrigger().click();
    expect(swapPopover()).not.toBeNull();
    insertTrigger().click();
    expect(swapPopover()).toBeNull();
    expect(insertPopover()).not.toBeNull();
  });

  it('opening the swap popover while the insert popover is open closes the insert popover (mutual exclusion)', () => {
    window.CanvasEditor.mount(mount, 0);
    insertTrigger().click();
    expect(insertPopover()).not.toBeNull();
    swapTrigger().click();
    expect(insertPopover()).toBeNull();
    expect(swapPopover()).not.toBeNull();
  });

  it('unmounting closes an open insert popover too', () => {
    window.CanvasEditor.mount(mount, 0);
    insertTrigger().click();
    expect(insertPopover()).not.toBeNull();
    window.CanvasEditor.unmount();
    expect(insertPopover()).toBeNull();
  });

  it('Escape closes an open insert popover', () => {
    window.CanvasEditor.mount(mount, 0);
    insertTrigger().click();
    expect(insertPopover()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(insertPopover()).toBeNull();
  });
});

// Emergency hotfix regression coverage: in production this artifact runs
// inside a genuinely cross-origin (Sandpack) iframe, where a direct
// fetch(origin + '/brand/master-deck-library.json') is CORS-blocked --
// confirmed via a real production console log ("canvas-template-picker.js:33
// Uncaught (in promise) TypeError: Failed to fetch"), which broke both the
// "Change layout..." and "+ Add slide" pickers entirely. fetchLibrary() now
// falls back to relaying the request through window.parent (handled by
// DownloadArtifact.tsx's artifact-asset-fetch-request/-result listener) when
// the direct fetch fails.
describe('CanvasTemplatePicker fetchLibrary cross-origin fallback (CORS hotfix)', () => {
  beforeEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
  });

  afterEach(() => {
    window.CanvasTemplatePicker._resetLibraryCache();
    delete global.fetch;
    delete window.parent;
  });

  it('uses the direct fetch result as-is when it succeeds (no relay involved)', async () => {
    const library = { slides: [{ componentId: 'slide-97', elements: [] }] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify(library)) });
    window.parent = { postMessage: jest.fn() };

    const result = await window.CanvasTemplatePicker._fetchLibrary();

    expect(result).toEqual(library);
    expect(window.parent.postMessage).not.toHaveBeenCalled();
  });

  it('falls back to the parent relay when the direct fetch fails, and resolves with the relayed library', async () => {
    const library = { slides: [{ componentId: 'slide-97', elements: [] }] };
    global.fetch = jest.fn(() => Promise.reject(new Error('Failed to fetch')));
    window.parent = {
      postMessage: jest.fn((msg) => {
        expect(msg.type).toBe('artifact-asset-fetch-request');
        expect(msg.path).toBe('/brand/master-deck-library.json');
        expect(msg.encoding).toBe('text');
        setTimeout(() => {
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'artifact-asset-fetch-result', requestId: msg.requestId, data: JSON.stringify(library) },
            }),
          );
        }, 0);
      }),
    };

    const result = await window.CanvasTemplatePicker._fetchLibrary();

    expect(result).toEqual(library);
    expect(window.parent.postMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects (does not hang forever) when the parent relay never responds', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    global.fetch = jest.fn(() => Promise.reject(new Error('Failed to fetch')));
    window.parent = { postMessage: jest.fn() }; // never responds

    const resultPromise = window.CanvasTemplatePicker._fetchLibrary();
    const assertion = expect(resultPromise).rejects.toThrow(/timed out/);
    await jest.advanceTimersByTimeAsync(10000);
    await assertion;

    jest.useRealTimers();
  });
});
