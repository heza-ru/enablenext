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

  it('injects a variant-swap select populated with curated componentId options', () => {
    window.DeckEditor.enableEditing(mount);
    const select = mount.querySelector('.deck-editor-slide-bar select');
    expect(select).not.toBeNull();
    expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
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
