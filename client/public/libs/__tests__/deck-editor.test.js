require('../deck-renderer.js');
require('../deck-schema-renderer.js');
require('../deck-editor.js');

describe('DeckEditor.enableEditing', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Original' }] }],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });

  afterEach(() => {
    delete window.DECK;
  });

  it('makes schema text elements contenteditable', () => {
    window.DeckEditor.enableEditing(mount);
    const el = mount.querySelector('.schema-text');
    expect(el.getAttribute('contenteditable')).toBe('true');
  });

  it('commits an edited text node back into window.DECK on blur', () => {
    window.DeckEditor.enableEditing(mount);
    const el = mount.querySelector('.schema-text');
    el.textContent = 'Edited';
    el.dispatchEvent(new Event('blur'));
    expect(window.DECK.slides[0].elements[0].text).toBe('Edited');
  });

  it('disableEditing removes contenteditable and stops committing', () => {
    window.DeckEditor.enableEditing(mount);
    window.DeckEditor.disableEditing(mount);
    const el = mount.querySelector('.schema-text');
    expect(el.hasAttribute('contenteditable')).toBe(false);
    el.textContent = 'Should not commit';
    el.dispatchEvent(new Event('blur'));
    expect(window.DECK.slides[0].elements[0].text).toBe('Original');
  });

  it('isEditing reflects current state', () => {
    expect(window.DeckEditor.isEditing()).toBe(false);
    window.DeckEditor.enableEditing(mount);
    expect(window.DeckEditor.isEditing()).toBe(true);
    window.DeckEditor.disableEditing(mount);
    expect(window.DeckEditor.isEditing()).toBe(false);
  });

  it('getDeck returns the live window.DECK reference', () => {
    expect(window.DeckEditor.getDeck()).toBe(window.DECK);
  });

  it('posts artifact-deck-updated to window.parent with the mutated deck after a commit', () => {
    const originalParent = window.parent;
    const postMessage = jest.fn();
    Object.defineProperty(window, 'parent', {
      value: { postMessage },
      configurable: true,
    });

    window.DeckEditor.enableEditing(mount);
    const el = mount.querySelector('.schema-text');
    el.textContent = 'Edited';
    el.dispatchEvent(new Event('blur'));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artifact-deck-updated', deck: window.DECK }),
      '*',
    );

    Object.defineProperty(window, 'parent', {
      value: originalParent,
      configurable: true,
    });
  });

  it('re-binds correctly when enableEditing is called again on a new mount without an intervening disableEditing', () => {
    const mountA = mount;
    window.DeckEditor.enableEditing(mountA);

    const mountB = document.createElement('div');
    window.DECK = {
      title: 'T2',
      slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Second' }] }],
    };
    window.DeckRenderer.renderDeck(window.DECK, mountB);

    // No disableEditing(mountA) call here: this must not silently no-op.
    window.DeckEditor.enableEditing(mountB);

    const elB = mountB.querySelector('.schema-text');
    expect(elB.getAttribute('contenteditable')).toBe('true');
    elB.textContent = 'Rebound';
    elB.dispatchEvent(new Event('blur'));
    expect(window.DECK.slides[0].elements[0].text).toBe('Rebound');
  });

  // Regression test (found during Task 10 end-to-end verification): real
  // master-deck componentId slides almost always mix shape/image elements
  // with text elements (e.g. a background rect before the title text). The
  // commit handler used to derive `elementIndex` from the loop position
  // among only the `.schema-text` NodeList matches, not the element's true
  // index in `slide.elements` — so on any slide where a non-text element
  // precedes the text element being edited, the edit silently wrote onto
  // the wrong array slot (typically adding a stray `.text` prop to a shape)
  // and the real text element was never updated. Fixed by having
  // deck-schema-renderer.js tag each schema-text node with `data-el-index`
  // (its true position in `elements`) and having deck-editor.js prefer that
  // over the loop index.
  it('commits to the correct elements[] index when text is preceded by shape/image elements', () => {
    const mountMixed = document.createElement('div');
    window.DECK = {
      title: 'Mixed',
      slides: [
        {
          layout: 'schema',
          elements: [
            { type: 'shape', shape: 'rect', fill: 'FF0000', x: 0, y: 0, w: 10, h: 5.625 },
            { type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Real text' },
          ],
        },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mountMixed);
    window.DeckEditor.enableEditing(mountMixed);

    const el = mountMixed.querySelector('.schema-text');
    el.textContent = 'Edited text';
    el.dispatchEvent(new Event('blur'));

    expect(window.DECK.slides[0].elements[0].type).toBe('shape');
    expect(window.DECK.slides[0].elements[0].text).toBeUndefined();
    expect(window.DECK.slides[0].elements[1].text).toBe('Edited text');
  });
});

describe('DeckEditor slide operations', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 1' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 2' }] },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });
  afterEach(() => { delete window.DECK; });

  it('reorderSlide moves a slide to a new index', () => {
    window.DeckEditor.reorderSlide(0, 1, mount);
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 2');
    expect(window.DECK.slides[1].elements[0].text).toBe('Slide 1');
  });

  it('duplicateSlide inserts a deep copy right after the original', () => {
    window.DeckEditor.duplicateSlide(0, mount);
    expect(window.DECK.slides.length).toBe(3);
    expect(window.DECK.slides[1].elements[0].text).toBe('Slide 1');
    window.DECK.slides[1].elements[0].text = 'Changed copy';
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 1'); // deep copy, not a reference
  });

  it('deleteSlide removes a slide', () => {
    window.DeckEditor.deleteSlide(0, mount);
    expect(window.DECK.slides.length).toBe(1);
    expect(window.DECK.slides[0].elements[0].text).toBe('Slide 2');
  });

  it('setSlideImage updates an image element brand reference', () => {
    window.DECK.slides[0].elements.push({ type: 'image', x: 0, y: 0, w: 1, h: 1, brandImage: 'logo-dark' });
    window.DeckEditor.setSlideImage(0, 1, { brandImage: 'logo-light' }, mount);
    expect(window.DECK.slides[0].elements[1].brandImage).toBe('logo-light');
    expect(window.DECK.slides[0].elements[1].deckAsset).toBeUndefined();
  });

  it('setSlideImage throws if the target element is not an image', () => {
    expect(() => window.DeckEditor.setSlideImage(0, 0, { brandImage: 'x' }, mount)).toThrow(/not an image element/);
  });
});

describe('DeckEditor.setSlideComponent', () => {
  let mount;
  beforeEach(() => {
    // setSlideComponent caches the fetched library in module-level state
    // (libraryCache) for the lifetime of the module, by design (see
    // deck-editor.js) -- so each test here needs a fresh module instance to
    // observe fetch call counts in isolation, rather than inheriting a warm
    // cache from an earlier test in this same describe block.
    jest.resetModules();
    require('../deck-renderer.js');
    require('../deck-schema-renderer.js');
    require('../deck-editor.js');
    mount = document.createElement('div');
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Old' }] }] };
    window.DeckRenderer.renderDeck(window.DECK, mount);
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ slides: [{ componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] }] }),
    });
  });
  afterEach(() => { delete window.DECK; delete global.fetch; });

  it('replaces the slide elements with the fetched componentId entry and re-renders', async () => {
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    expect(window.DECK.slides[0].elements[0].text).toBe('Thank you!');
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
    expect(window.DECK.slides[0].layout).toBe('schema');
  });

  it('rejects with a clear error for an unknown componentId', async () => {
    await expect(window.DeckEditor.setSlideComponent(0, 'slide-9999', mount)).rejects.toThrow(/unknown componentId/);
  });

  it('caches the fetched library across calls (fetch only called once)', async () => {
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // Regression test (task-17 fix round 1, Finding 1 -- CRITICAL): setSlideComponent
  // is async (it awaits a fetch() before calling renderDeck), so the
  // editing-state-preservation fix must survive across that await boundary too,
  // not just in the synchronous mutators.
  it('preserves editor chrome and contenteditable bindings after an awaited setSlideComponent call when editing was active', async () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-slide-bar').length).toBeGreaterThan(0);
    expect(mount.querySelectorAll('[contenteditable]').length).toBeGreaterThan(0);

    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);

    expect(window.DeckEditor.isEditing()).toBe(true);
    expect(mount.querySelectorAll('.deck-editor-slide-bar').length).toBeGreaterThan(0);
    expect(mount.querySelectorAll('[contenteditable]').length).toBeGreaterThan(0);
  });
});

describe('DeckEditor UI chrome', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 1' }, { type: 'image', x: 0, y: 0, w: 1, h: 1, brandImage: 'logo-dark' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 2' }] },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
  });
  afterEach(() => {
    // Several tests in this block call enableEditing(mount) without a matching
    // disableEditing() -- explicitly reset the module-level `editing` flag here
    // so it can't leak into a later test (e.g. the "editing was never enabled"
    // regression test below, which asserts isEditing() starts false).
    window.DeckEditor.disableEditing();
    delete window.DECK;
  });

  it('injects a control bar with reorder/duplicate/delete buttons per slide when editing is enabled', () => {
    window.DeckEditor.enableEditing(mount);
    const bars = mount.querySelectorAll('.deck-editor-slide-bar');
    expect(bars.length).toBe(2);
  });

  it('injects an image-swap button for every schema-image element', () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-image-swap').length).toBe(1);
  });

  it('injects a "Change layout" button (superseded by the visual thumbnail picker in task 19)', () => {
    window.DeckEditor.enableEditing(mount);
    const btn = mount.querySelector('.deck-editor-slide-bar [data-action="change-layout"]');
    expect(btn).not.toBeNull();
  });

  it('removes all injected chrome on disableEditing', () => {
    window.DeckEditor.enableEditing(mount);
    window.DeckEditor.disableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-chrome').length).toBe(0);
  });

  it('the first slide\'s "move up" button is disabled and the last slide\'s "move down" button is disabled', () => {
    window.DeckEditor.enableEditing(mount);
    const bars = mount.querySelectorAll('.deck-editor-slide-bar');
    const firstUp = bars[0].querySelector('[data-action="up"]');
    const lastDown = bars[1].querySelector('[data-action="down"]');
    expect(firstUp.disabled).toBe(true);
    expect(lastDown.disabled).toBe(true);
  });

  // Regression test (task-17 fix round 1, Finding 1 -- CRITICAL): every
  // mutator (reorderSlide/duplicateSlide/deleteSlide/setSlideImage/
  // setSlideComponent) calls window.DeckRenderer.renderDeck, which does
  // `mountEl.innerHTML = ''` and rebuilds the slide DOM from scratch. Before
  // this fix, none of the mutators re-invoked enableEditing afterward, so a
  // SINGLE click of any control-bar button silently destroyed all chrome and
  // all contenteditable bindings -- verified empirically that
  // `.deck-editor-slide-bar` count and `[contenteditable]` count both dropped
  // to 0 immediately after, even though isEditing() still reported true.
  it('duplicateSlide preserves editor chrome and contenteditable bindings when editing was active', () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelectorAll('.deck-editor-slide-bar').length).toBeGreaterThan(0);
    expect(mount.querySelectorAll('[contenteditable]').length).toBeGreaterThan(0);

    window.DeckEditor.duplicateSlide(0, mount);

    expect(window.DeckEditor.isEditing()).toBe(true);
    expect(mount.querySelectorAll('.deck-editor-slide-bar').length).toBe(3); // 2 original slides + 1 duplicate
    expect(mount.querySelectorAll('[contenteditable]').length).toBeGreaterThan(0);
  });

  it('does not enable editing chrome after a mutation when editing was never enabled', () => {
    expect(window.DeckEditor.isEditing()).toBe(false);
    window.DeckEditor.duplicateSlide(0, mount);
    expect(window.DeckEditor.isEditing()).toBe(false);
    expect(mount.querySelectorAll('.deck-editor-slide-bar').length).toBe(0);
    expect(mount.querySelectorAll('[contenteditable]').length).toBe(0);
  });
});

describe('DeckEditor visual variant picker', () => {
  let mount;
  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = { title: 'T', slides: [{ layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'S1' }] }] };
    window.DeckRenderer.renderDeck(window.DECK, mount);
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ slides: [{ componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] }] }),
    });
  });
  afterEach(() => { delete window.DECK; delete global.fetch; });

  it('shows a "Change layout" button instead of a native select', () => {
    window.DeckEditor.enableEditing(mount);
    expect(mount.querySelector('.deck-editor-slide-bar select')).toBeNull();
    expect(mount.querySelector('[data-action="change-layout"]')).not.toBeNull();
  });

  it('opens a thumbnail grid with a rendered mini-preview per curated componentId when clicked', async () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    await Promise.resolve(); // let the library fetch + thumbnail render settle
    const thumbs = mount.querySelectorAll('.deck-editor-variant-thumb');
    expect(thumbs.length).toBeGreaterThan(0);
    // each thumbnail actually contains rendered schema content, not just a label
    expect(thumbs[0].querySelector('.schema-text, .schema-shape, .schema-image')).not.toBeNull();
  });

  it('clicking a thumbnail calls setSlideComponent and closes the popover', async () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    await Promise.resolve();
    const thumb = Array.from(mount.querySelectorAll('.deck-editor-variant-thumb')).find((t) => t.dataset.componentId === 'slide-97');
    thumb.click();
    await Promise.resolve();
    expect(window.DECK.slides[0].componentId).toBe('slide-97');
    expect(mount.querySelector('.deck-editor-variant-popover')).toBeNull();
  });

  // Regression test (final review 2, Finding I1 -- IMPORTANT): the popover was
  // appended as a sibling of the slide bar but never tracked in chromeEls, so
  // disableEditing left it in the DOM, fully interactive, even in view mode.
  it('disableEditing removes an open variant popover', () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    expect(mount.querySelector('.deck-editor-variant-popover')).not.toBeNull();

    window.DeckEditor.disableEditing(mount);

    expect(mount.querySelector('.deck-editor-variant-popover')).toBeNull();
  });

  // Regression test (final review 2, Finding M2 -- the duplicate-popover guard
  // originally used `document.querySelector`, the same document-wide-query
  // anti-pattern Task 17's chromeEls fix removed elsewhere in this file). This
  // must use a DETACHED mount: the old document-wide guard only ever found a
  // prior popover by coincidence when the mount was attached to the live
  // document (an attached-mount version of this same test would pass against
  // both the old and new guard, proving nothing -- caught in this review's own
  // re-review). A detached mount is exactly the case the old guard failed:
  // `document.querySelector` cannot see into a detached subtree, so it always
  // reported "no existing popover" and produced one duplicate per click.
  it('clicking "Change layout" twice in a row leaves exactly one popover (detached mount)', () => {
    window.DeckEditor.enableEditing(mount);
    const btn = mount.querySelector('[data-action="change-layout"]');
    btn.click();
    btn.click();
    expect(mount.querySelectorAll('.deck-editor-variant-popover').length).toBe(1);
  });

  // Companion check for the real production shape (download-bridge.js passes
  // an attached document.body) -- both attached and detached must land on
  // exactly one popover per slide.
  it('clicking "Change layout" twice in a row leaves exactly one popover (attached mount)', () => {
    document.body.appendChild(mount);
    try {
      window.DeckEditor.enableEditing(mount);
      const btn = mount.querySelector('[data-action="change-layout"]');
      btn.click();
      btn.click();
      expect(mount.querySelectorAll('.deck-editor-variant-popover').length).toBe(1);
    } finally {
      window.DeckEditor.disableEditing(mount);
      mount.remove();
    }
  });

  // Regression test (final review 2, Finding M1): Escape dismisses an open
  // popover without requiring a layout pick or another mutation.
  it('Escape key closes an open variant popover', () => {
    window.DeckEditor.enableEditing(mount);
    mount.querySelector('[data-action="change-layout"]').click();
    expect(mount.querySelector('.deck-editor-variant-popover')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(mount.querySelector('.deck-editor-variant-popover')).toBeNull();
  });
});

describe('DeckEditor mutators notify the host of unsaved edits', () => {
  // Regression test (final review 2, Finding C1 -- CRITICAL): before this fix,
  // only the inline-text-edit blur handler (commitHandlerFor) ever posted
  // 'artifact-deck-updated' to window.parent. DownloadArtifact.tsx sets its
  // `pendingDeck` state from that message and only renders the Save button
  // when `isEditing && pendingDeck` is true -- so every structural mutation
  // (reorder/duplicate/delete/image-swap/variant-swap), now clickable via
  // Task 17/19's chrome, silently could never be saved: the preview updated
  // but no Save button ever appeared.
  let mount;
  let realParent;
  let postMessage;

  beforeEach(() => {
    mount = document.createElement('div');
    window.DECK = {
      title: 'T',
      slides: [
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 1' }] },
        { layout: 'schema', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Slide 2' }] },
      ],
    };
    window.DeckRenderer.renderDeck(window.DECK, mount);
    postMessage = jest.fn();
    realParent = window.parent;
    // window.parent === window by default in jsdom; simulate the artifact
    // iframe's actual cross-window relationship so the `window.parent !==
    // window` guard (shared with commitHandlerFor) takes the "post" branch.
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true });
  });
  afterEach(() => {
    // Several tests here call enableEditing(mount) without a matching
    // disableEditing() -- reset the module-level `editing` flag explicitly so
    // it can't leak into the next test (mirrors the same cleanup already done
    // in the 'DeckEditor UI chrome' describe block above).
    window.DeckEditor.disableEditing();
    Object.defineProperty(window, 'parent', { value: realParent, configurable: true });
    delete window.DECK;
  });

  it('duplicateSlide posts artifact-deck-updated when editing was active', () => {
    window.DeckEditor.enableEditing(mount);
    postMessage.mockClear(); // enableEditing's own render pass shouldn't count

    window.DeckEditor.duplicateSlide(0, mount);

    expect(postMessage).toHaveBeenCalledWith({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
  });

  it('does not post artifact-deck-updated when editing was not active', () => {
    window.DeckEditor.duplicateSlide(0, mount);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('setSlideComponent posts artifact-deck-updated after its awaited fetch resolves', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ slides: [{ componentId: 'slide-97', elements: [{ type: 'text', x: 0, y: 0, w: 5, h: 1, text: 'Thank you!' }] }] }),
    });
    window.DeckEditor.enableEditing(mount);
    postMessage.mockClear();

    await window.DeckEditor.setSlideComponent(0, 'slide-97', mount);

    expect(postMessage).toHaveBeenCalledWith({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
    delete global.fetch;
  });
});
