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
  var chromeEls = []; // elements injected by injectSlideBar/injectImageSwapButtons/openVariantPopover, tracked
  // directly (not re-derived via document.querySelectorAll('.deck-editor-chrome')) so removal works even when
  // the mount hasn't been attached to the live document yet -- mirrors the boundHandlers pattern above.
  var docListeners = []; // { type, handler } pairs added on `document` by chrome (currently only the variant
  // popover's Escape-to-dismiss). Tracked so disableEditing tears them down alongside the chrome elements
  // themselves, since removing an element does not unregister a document-level listener that closes over it.

  function commitHandlerFor(slideIndex, elementIndex, el) {
    return function () {
      var deck = window.DECK;
      if (!deck || !deck.slides || !deck.slides[slideIndex]) return;
      var slide = deck.slides[slideIndex];
      if (slide.elements && slide.elements[elementIndex]) {
        slide.elements[elementIndex].text = el.textContent;
      }
      notifyDeckUpdated();
    };
  }

  // Injects the chrome stylesheet once per document, mirroring the
  // injectBaseStyles() guard pattern in deck-renderer.js (a document.getElementById
  // check, not a module-level flag, so it survives across module re-requires in
  // tests and works correctly if this file is ever loaded into more than one
  // document/iframe).
  //
  // Color choice (task-17 fix round 1, Finding 2, corrected per human
  // clarification): this chrome is the CHATBOT APP's own editing tool overlaid
  // on the deck, not part of the slide content being edited -- so it must look
  // native to the LibreChat app shell, not to the presentation's own brand
  // palette (Orange #FF6B18 / Ink #25223B belong to slide content and are
  // deliberately NOT used here). Values below are hardcoded copies of
  // LibreChat's own neutral dark-mode tokens (see client/src/style.css's
  // --gray-850/--gray-900/--gray-100/--gray-600 custom properties) rather than
  // `var(--...)` references, because this stylesheet is injected into a
  // cross-origin deck-render iframe that does not inherit the parent
  // document's CSS custom properties.
  function injectEditorChromeStyles() {
    if (document.getElementById('deck-editor-chrome-styles')) return;
    var style = document.createElement('style');
    style.id = 'deck-editor-chrome-styles';
    style.textContent =
      '.deck-editor-slide-bar{' +
        'position:absolute;top:10px;right:10px;z-index:1000;' +
        'display:flex;align-items:center;gap:4px;' +
        'padding:5px;border-radius:999px;' +
        'background:rgba(23,23,23,0.85);' + // gray-850, translucent
        'border:1px solid rgba(255,255,255,0.1);' +
        '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
        'box-shadow:0 2px 10px rgba(0,0,0,0.35);' +
        "font-family:'DM Sans',-apple-system,sans-serif" +
      '}' +
      '.deck-editor-chrome-btn{' +
        'appearance:none;-webkit-appearance:none;border:none;outline:none;' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'min-width:28px;height:28px;padding:0 10px;' +
        'border-radius:999px;background:transparent;color:#ececec;' + // gray-100
        "font-family:'DM Sans',-apple-system,sans-serif;font-size:13px;font-weight:500;" +
        'line-height:1;cursor:pointer;white-space:nowrap;' +
        'transition:background-color .12s ease,color .12s ease' +
      '}' +
      '.deck-editor-chrome-btn:hover:not(:disabled){background:#424242}' + // gray-600
      '.deck-editor-chrome-btn:focus-visible{box-shadow:0 0 0 2px rgba(236,236,236,0.6)}' +
      '.deck-editor-chrome-btn:disabled{color:#8a8a8a;cursor:not-allowed;opacity:.5}' +
      '.deck-editor-image-swap{' +
        'position:absolute;z-index:1000;transform:translate(-4px,-4px);' +
        'appearance:none;-webkit-appearance:none;border:none;outline:none;' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'height:24px;padding:0 10px;border-radius:999px;' +
        'background:rgba(13,13,13,0.85);color:#ececec;' + // gray-900, translucent
        'border:1px solid rgba(255,255,255,0.1);' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
        "font-family:'DM Sans',-apple-system,sans-serif;font-size:11px;font-weight:500;" +
        'line-height:1;cursor:pointer;white-space:nowrap;box-shadow:0 1px 6px rgba(0,0,0,0.35);' +
        'transition:background-color .12s ease' +
      '}' +
      '.deck-editor-image-swap:hover{background:#424242}' + // gray-600
      '.deck-editor-image-swap:focus-visible{box-shadow:0 0 0 2px rgba(236,236,236,0.6)}';
    document.head.appendChild(style);
  }

  function enableEditing(mountEl) {
    // Clear any bindings left over from a prior enableEditing call (e.g. a
    // previous mount that was never explicitly disabled) before wiring up
    // this mountEl, so re-invoking enableEditing is always idempotent and
    // never silently no-ops against stale elements.
    disableEditing();
    injectEditorChromeStyles();
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
    docListeners.forEach(function (l) { document.removeEventListener(l.type, l.handler); });
    docListeners = [];
    editing = false;
  }

  function isEditing() {
    return editing;
  }

  function getDeck() {
    return window.DECK;
  }

  // Every mutator below re-renders the deck via window.DeckRenderer.renderDeck,
  // which (deck-renderer.js:163) does `mountEl.innerHTML = ''` and rebuilds the
  // slide DOM from scratch -- destroying any contenteditable bindings and
  // injected chrome that enableEditing had wired up. If editing was active
  // before the mutation, we must call enableEditing(mountEl) again afterward
  // to restore it, or the deck silently becomes non-editable after exactly one
  // reorder/duplicate/delete/image-swap/variant-swap (see task-17 fix round 1
  // review finding -- verified empirically that chrome count and
  // [contenteditable] count both drop to 0 after a single mutation without
  // this). We must NOT re-enable editing if it wasn't active already, since
  // these functions are also callable programmatically outside editor mode.
  //
  // This is also the single place the host is notified that an unsaved edit
  // exists (final review 2, Finding C1 -- CRITICAL): DownloadArtifact.tsx sets
  // its `pendingDeck` state from the `artifact-deck-updated` message and only
  // renders the Save button when `isEditing && pendingDeck`, so before this
  // fix every structural mutation (reorder/duplicate/delete/image-swap/
  // variant-swap) was silently unsavable -- only inline text edits
  // (commitHandlerFor) ever posted the message. Posting it here covers all
  // five mutators at once since they all route through this helper. Gated on
  // `wasEditing` for the same reason the enableEditing call is: outside editor
  // mode there is no Save affordance to notify, mirroring how
  // commitHandlerFor only ever runs while editing.
  function reRenderPreservingEditingState(mountEl) {
    var wasEditing = editing;
    window.DeckRenderer.renderDeck(window.DECK, mountEl);
    if (wasEditing) {
      enableEditing(mountEl);
      notifyDeckUpdated();
    }
  }

  function notifyDeckUpdated() {
    if (typeof window.parent !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
    }
  }

  function reorderSlide(fromIndex, toIndex, mountEl) {
    var slides = window.DECK.slides;
    var moved = slides.splice(fromIndex, 1)[0];
    slides.splice(toIndex, 0, moved);
    reRenderPreservingEditingState(mountEl);
  }

  function duplicateSlide(index, mountEl) {
    var slides = window.DECK.slides;
    var copy = JSON.parse(JSON.stringify(slides[index]));
    slides.splice(index + 1, 0, copy);
    reRenderPreservingEditingState(mountEl);
  }

  function deleteSlide(index, mountEl) {
    window.DECK.slides.splice(index, 1);
    reRenderPreservingEditingState(mountEl);
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
    reRenderPreservingEditingState(mountEl);
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
      // Captured just before the re-render (not at the top of this function)
      // so it reflects editing state at the moment of mutation, same as the
      // synchronous mutators' reRenderPreservingEditingState -- this is an
      // async function, so `editing` could in principle change while the
      // fetch was in flight.
      reRenderPreservingEditingState(mountEl);
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

  function buildThumbnail(componentId, elements, slideIndex, mountEl, popover) {
    var thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'deck-editor-chrome deck-editor-variant-thumb';
    thumb.dataset.componentId = componentId;
    // Fixed small box at the deck's real 16:9 ratio; render the real elements at full
    // scale inside an inner div, then CSS-scale the whole thing down -- reuses
    // DeckSchemaRenderer verbatim, so the thumbnail can never drift from the real render.
    thumb.style.cssText = 'width:96px;height:54px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.2);background:#171717;padding:0;cursor:pointer;';
    var inner = document.createElement('div');
    inner.style.cssText = 'width:960px;height:540px;position:relative;transform:scale(0.1);transform-origin:top left;';
    window.DeckSchemaRenderer.renderSchemaElements(elements, inner);
    thumb.appendChild(inner);
    thumb.addEventListener('click', function (e) {
      e.stopPropagation();
      setSlideComponent(slideIndex, componentId, mountEl);
      closeVariantPopover(popover);
    });
    return thumb;
  }

  // Single teardown path for the variant popover: removes the element, drops it
  // from chromeEls, and unregisters its Escape listener (both from `document`
  // and from docListeners). Used by every close trigger (thumbnail pick,
  // Escape, re-opening the picker) so no path can leave a half-removed popover
  // or an orphaned document listener behind.
  function closeVariantPopover(popover) {
    popover.remove();
    var i = chromeEls.indexOf(popover);
    if (i !== -1) chromeEls.splice(i, 1);
    var handler = popover._deckEditorKeyHandler;
    if (handler) {
      document.removeEventListener('keydown', handler);
      for (var j = docListeners.length - 1; j >= 0; j--) {
        if (docListeners[j].handler === handler) docListeners.splice(j, 1);
      }
      delete popover._deckEditorKeyHandler;
    }
  }

  function openVariantPopover(anchorBtn, slideIndex, mountEl) {
    // Scoped to the anchor's own subtree rather than `document` (final review 2,
    // Finding M2 -- the same document-wide-query anti-pattern Task 17's chromeEls
    // fix removed elsewhere in this file): the popover is appended as a sibling of
    // the slide bar, so its parent is the only place a prior one can be, and this
    // guard then works identically whether or not the mount is attached to the
    // live document.
    var existing = anchorBtn.parentElement.querySelector('.deck-editor-variant-popover');
    if (existing) closeVariantPopover(existing);
    var popover = document.createElement('div');
    popover.className = 'deck-editor-chrome deck-editor-variant-popover';
    popover.style.cssText = 'position:absolute;top:32px;right:8px;z-index:1001;background:#171717;border:1px solid rgba(255,255,255,.2);padding:8px;display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;';
    fetchLibrary().then(function (library) {
      CURATED_VARIANTS.forEach(function (group) {
        var groupLabel = document.createElement('div');
        groupLabel.className = 'deck-editor-chrome';
        groupLabel.style.cssText = "font-size:10px;color:rgba(255,255,255,.6);font-family:'DM Sans',sans-serif;";
        groupLabel.textContent = group.category;
        var row = document.createElement('div');
        row.className = 'deck-editor-chrome';
        row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
        group.ids.forEach(function (id) {
          var entry = (library.slides || []).filter(function (s) { return s.componentId === id; })[0];
          if (!entry) return; // skip silently if a curated id is somehow missing from the library
          row.appendChild(buildThumbnail(id, entry.elements, slideIndex, mountEl, popover));
        });
        popover.appendChild(groupLabel);
        popover.appendChild(row);
      });
    });
    var onKeyDown = function (e) {
      if (e.key === 'Escape') closeVariantPopover(popover);
    };
    popover._deckEditorKeyHandler = onKeyDown;
    document.addEventListener('keydown', onKeyDown);
    docListeners.push({ type: 'keydown', handler: onKeyDown });
    anchorBtn.parentElement.appendChild(popover);
    // Tracked as chrome (final review 2, Finding I1 -- IMPORTANT): without this,
    // disableEditing left an open popover in the DOM and fully interactive, so
    // clicking a thumbnail after leaving edit mode still mutated window.DECK.
    chromeEls.push(popover);
  }

  function makeChromeButton(label, action, onClick, disabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-editor-chrome deck-editor-chrome-btn';
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
    bar.appendChild(makeChromeButton('↑', 'up', function () { reorderSlide(slideIndex, slideIndex - 1, mountEl); }, slideIndex === 0));
    bar.appendChild(makeChromeButton('↓', 'down', function () { reorderSlide(slideIndex, slideIndex + 1, mountEl); }, slideIndex === totalSlides - 1));
    bar.appendChild(makeChromeButton('Duplicate', 'duplicate', function () { duplicateSlide(slideIndex, mountEl); }));
    bar.appendChild(makeChromeButton('Delete', 'delete', function () { deleteSlide(slideIndex, mountEl); }, totalSlides <= 1));
    bar.appendChild(makeChromeButton('Change layout…', 'change-layout', function () { openVariantPopover(bar, slideIndex, mountEl); }));
    slideEl.appendChild(bar);
    chromeEls.push(bar); // child buttons are removed along with their parent
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
      // Positioning (left/top) is instance-specific per image element and stays
      // inline; all other visual styling (background/color/shape/hover) lives in
      // the .deck-editor-image-swap class from injectEditorChromeStyles() above.
      btn.style.left = imgEl.style.left;
      btn.style.top = imgEl.style.top;
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
