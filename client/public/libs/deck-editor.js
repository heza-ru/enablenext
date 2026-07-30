// Structured editor for LLM-generated decks: inline text editing, mutating
// window.DECK directly (single-source-of-truth discipline shared with the
// rest of this renderer). Layout/variant swap, reorder/duplicate/delete,
// and the brand-image picker are added in Task 8; this file lays the
// contenteditable + commit-on-blur foundation both build on.
//
// Scoping note: inline editing is wired up only for `.schema-text` elements
// (the new 'schema' layout, Task 2) and any element explicitly tagged with
// `data-deck-field` by a hand-coded layout. Retrofitting `data-deck-field`
// annotations onto all 19 pre-existing hand-coded layouts' bespoke DOM
// structures is out of scope for this task and left as a separable
// follow-up (see task-7-report.md).
(function () {
  var editing = false;
  var boundHandlers = []; // { el, handler } pairs, so disableEditing can remove exactly what enableEditing added
  var chromeEls = []; // elements injected by injectSlideBar/injectImageSwapButtons, tracked directly (not
  // re-derived via document.querySelectorAll('.deck-editor-chrome')) so removal works even when the
  // mount hasn't been attached to the live document yet -- mirrors the boundHandlers pattern above.

  function commitHandlerFor(slideIndex, elementIndex, el) {
    return function () {
      var deck = window.DECK;
      if (!deck || !deck.slides || !deck.slides[slideIndex]) return;
      var slide = deck.slides[slideIndex];
      if (slide.elements && slide.elements[elementIndex]) {
        slide.elements[elementIndex].text = el.textContent;
      }
      if (typeof window.parent !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
      }
    };
  }

  function enableEditing(mountEl) {
    // Clear any bindings left over from a prior enableEditing call (e.g. a
    // previous mount that was never explicitly disabled) before wiring up
    // this mountEl, so re-invoking enableEditing is always idempotent and
    // never silently no-ops against stale elements.
    disableEditing();
    editing = true;
    var slideEls = mountEl.querySelectorAll('.slide');
    slideEls.forEach(function (slideEl, slideIndex) {
      var textEls = slideEl.querySelectorAll('.schema-text, [data-deck-field]');
      textEls.forEach(function (el, loopIndex) {
        // `.schema-text` elements carry `data-el-index` (set by
        // deck-schema-renderer.js) recording their true position in the
        // slide's `elements` array. Using the plain loop index instead would
        // be wrong for any slide that mixes shape/image elements with text
        // (the common case for real master-deck componentId slides) — see
        // task-10-report.md for the bug this fixes. `data-deck-field`
        // elements (not yet used by any hand-coded layout) have no such
        // attribute, so they fall back to the loop index unchanged.
        var elementIndex = el.dataset.elIndex !== undefined ? parseInt(el.dataset.elIndex, 10) : loopIndex;
        el.setAttribute('contenteditable', 'true');
        el.dataset.slideIndex = String(slideIndex);
        el.dataset.elementIndex = String(elementIndex);
        var handler = commitHandlerFor(slideIndex, elementIndex, el);
        el.addEventListener('blur', handler);
        boundHandlers.push({ el: el, handler: handler });
      });
      injectSlideBar(slideEl, slideIndex, slideEls.length, mountEl);
      injectImageSwapButtons(slideEl, slideIndex, mountEl);
    });
  }

  function disableEditing(mountEl) {
    // mountEl is accepted (per the documented signature) but unused: we
    // track exactly which elements were bound in boundHandlers regardless of
    // which mount they came from, so no re-derivation from mountEl is
    // needed to reverse enableEditing.
    boundHandlers.forEach(function (pair) {
      pair.el.removeAttribute('contenteditable');
      pair.el.removeEventListener('blur', pair.handler);
    });
    boundHandlers = [];
    // Removes chrome injected by injectSlideBar/injectImageSwapButtons below.
    // Not scoped to mountEl, matching the boundHandlers design above: chrome
    // isn't tracked per-mount because only one mount is ever "active" for
    // editing at a time in this singleton-DECK architecture. Elements are
    // removed via the tracked chromeEls array (not a document-wide
    // `.deck-editor-chrome` query) so this works correctly even before the
    // mount has been attached to the live document.
    chromeEls.forEach(function (el) { el.remove(); });
    chromeEls = [];
    editing = false;
  }

  function isEditing() {
    return editing;
  }

  function getDeck() {
    return window.DECK;
  }

  function reorderSlide(fromIndex, toIndex, mountEl) {
    var slides = window.DECK.slides;
    var moved = slides.splice(fromIndex, 1)[0];
    slides.splice(toIndex, 0, moved);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function duplicateSlide(index, mountEl) {
    var slides = window.DECK.slides;
    var copy = JSON.parse(JSON.stringify(slides[index]));
    slides.splice(index + 1, 0, copy);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function deleteSlide(index, mountEl) {
    window.DECK.slides.splice(index, 1);
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  function setSlideImage(slideIndex, elementIndex, imageRef, mountEl) {
    var el = window.DECK.slides[slideIndex].elements[elementIndex];
    if (!el || el.type !== 'image') {
      throw new Error('DeckEditor.setSlideImage: target element is not an image element');
    }
    delete el.brandImage;
    delete el.deckAsset;
    if (imageRef.brandImage) el.brandImage = imageRef.brandImage;
    if (imageRef.deckAsset) el.deckAsset = imageRef.deckAsset;
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
  }

  // --- Variant/componentId swap ---------------------------------------
  //
  // Fetches the master-deck library (origin-aware, same pattern as
  // brandImagePath/deckAssetPath) and swaps a slide's `elements` for a
  // curated master-deck variant's, in place. Cached for the session: the
  // library is a static, pre-built JSON asset that does not change during
  // a single editing session, so a one-time fetch-and-cache is a deliberate
  // simplification, not an oversight.
  var libraryCache = null;
  function fetchLibrary() {
    if (libraryCache) return Promise.resolve(libraryCache);
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return fetch(origin + '/brand/master-deck-library.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { libraryCache = data; return data; });
  }

  function setSlideComponent(slideIndex, componentId, mountEl) {
    return fetchLibrary().then(function (library) {
      var entry = (library.slides || []).filter(function (s) { return s.componentId === componentId; })[0];
      if (!entry) throw new Error('DeckEditor.setSlideComponent: unknown componentId "' + componentId + '"');
      var slide = window.DECK.slides[slideIndex];
      slide.layout = 'schema';
      slide.componentId = componentId;
      slide.elements = JSON.parse(JSON.stringify(entry.elements));
      window.DeckRenderer.renderDeck(window.DECK, mountEl);
    });
  }

  // Curated, known-good componentId ranges for the variant-swap picker --
  // deliberately NOT exposing all 104 master-deck slides (many are
  // dividers/tip-slides/known-broken per Task 6/10's documented
  // limitations). These match the corrected ranges in
  // agents/presentation-creator.skill.md's componentId preference table
  // (Title 5-9, Agenda 18-19, Section 21-25, Closing 97-100) as of this
  // plan's final review.
  var CURATED_VARIANTS = [
    { category: 'Title', ids: ['slide-5', 'slide-6', 'slide-7', 'slide-8', 'slide-9'] },
    { category: 'Agenda', ids: ['slide-18', 'slide-19'] },
    { category: 'Section', ids: ['slide-21', 'slide-22', 'slide-23', 'slide-24', 'slide-25'] },
    { category: 'Closing', ids: ['slide-97', 'slide-98', 'slide-99', 'slide-100'] },
  ];

  function buildVariantSelect(slideIndex, mountEl) {
    var select = document.createElement('select');
    select.className = 'deck-editor-chrome';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Change layout…';
    select.appendChild(placeholder);
    CURATED_VARIANTS.forEach(function (group) {
      var optgroup = document.createElement('optgroup');
      optgroup.label = group.category;
      group.ids.forEach(function (id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
    select.addEventListener('click', function (e) { e.stopPropagation(); });
    select.addEventListener('change', function () {
      if (!select.value) return;
      setSlideComponent(slideIndex, select.value, mountEl);
    });
    return select;
  }

  function makeChromeButton(label, action, onClick, disabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-editor-chrome';
    b.setAttribute('data-action', action);
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function injectSlideBar(slideEl, slideIndex, totalSlides, mountEl) {
    var bar = document.createElement('div');
    bar.className = 'deck-editor-chrome deck-editor-slide-bar';
    bar.style.cssText = 'position:absolute;top:8px;right:8px;z-index:1000;display:flex;gap:4px;';
    bar.appendChild(makeChromeButton('↑', 'up', function () { reorderSlide(slideIndex, slideIndex - 1, mountEl); }, slideIndex === 0));
    bar.appendChild(makeChromeButton('↓', 'down', function () { reorderSlide(slideIndex, slideIndex + 1, mountEl); }, slideIndex === totalSlides - 1));
    bar.appendChild(makeChromeButton('Duplicate', 'duplicate', function () { duplicateSlide(slideIndex, mountEl); }));
    bar.appendChild(makeChromeButton('Delete', 'delete', function () { deleteSlide(slideIndex, mountEl); }, totalSlides <= 1));
    bar.appendChild(buildVariantSelect(slideIndex, mountEl));
    slideEl.appendChild(bar);
    chromeEls.push(bar); // children (buttons/select) are removed along with their parent
  }

  function injectImageSwapButtons(slideEl, slideIndex, mountEl) {
    var images = slideEl.querySelectorAll('.schema-image');
    images.forEach(function (imgEl, loopIndex) {
      var elementIndex = imgEl.dataset.elIndex !== undefined ? parseInt(imgEl.dataset.elIndex, 10) : loopIndex;
      var btn = makeChromeButton('Swap image', 'swap-image', function () {
        var name = window.prompt('Brand image key (e.g. logo-dark, logo-light):');
        if (name) setSlideImage(slideIndex, elementIndex, { brandImage: name }, mountEl);
      });
      btn.className += ' deck-editor-image-swap';
      btn.style.cssText = 'position:absolute;left:' + imgEl.style.left + ';top:' + imgEl.style.top + ';z-index:1000;';
      slideEl.appendChild(btn);
      chromeEls.push(btn);
    });
  }

  window.DeckEditor = {
    enableEditing: enableEditing,
    disableEditing: disableEditing,
    isEditing: isEditing,
    getDeck: getDeck,
    reorderSlide: reorderSlide,
    duplicateSlide: duplicateSlide,
    deleteSlide: deleteSlide,
    setSlideImage: setSlideImage,
    setSlideComponent: setSlideComponent,
  };
})();
