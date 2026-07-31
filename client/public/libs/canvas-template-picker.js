// Swap-in-place template picker, ported from deck-editor.js's
// openVariantPopover/CURATED_VARIANTS/fetchLibrary/setSlideComponent (read in
// full before that file's Task 14 deletion). Same curated categories, same
// origin-aware fetch + session cache, same buildThumbnail technique (a real
// DeckSchemaRenderer.renderSchemaElements at full scale inside a CSS-scaled-
// down box, so the thumbnail can never drift from the real render) — none of
// that changes for the Konva model.
//
// What DOES change: there's no DOM-sibling slide structure to hang a trigger
// button or popover off of (Konva renders to a single <canvas>, not one DOM
// node per slide element), and there's only ever one canvas editor instance
// mounted at a time (unlike the old view that could show multiple slides at
// once) — so "only one popover open across the whole deck" collapses to a
// single global open/close, and both the trigger button and the popover are
// floating chrome appended to document.body with position:fixed, positioned
// off getBoundingClientRect() the same way canvas-context-menu.js/
// canvas-toolbars.js already do for their own floating chrome.
(function () {
  // --- Variant/componentId swap (verbatim port) ---------------------------
  var libraryCache = null;
  function fetchLibrary() {
    if (libraryCache) return Promise.resolve(libraryCache);
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return fetch(origin + '/brand/master-deck-library.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { libraryCache = data; return data; });
  }

  // Same curated, known-good componentId ranges as deck-editor.js's
  // CURATED_VARIANTS (Title 5-9, Agenda 18-19, Section 21-25, Closing
  // 97-100), matching agents/presentation-creator.skill.md's componentId
  // preference table.
  var CURATED_VARIANTS = [
    { category: 'Title', ids: ['slide-5', 'slide-6', 'slide-7', 'slide-8', 'slide-9'] },
    { category: 'Agenda', ids: ['slide-18', 'slide-19'] },
    { category: 'Section', ids: ['slide-21', 'slide-22', 'slide-23', 'slide-24', 'slide-25'] },
    { category: 'Closing', ids: ['slide-97', 'slide-98', 'slide-99', 'slide-100'] },
  ];

  // Adapted for the Konva model: mutates window.DECK.slides[slideIndex]
  // exactly like the original (layout='schema', componentId, deep-cloned
  // elements), but re-rendering is now CanvasHistory.push() before the
  // mutation (Task 8's one-snapshot-per-logical-action convention, every
  // other mutation site in this plan does this) and CanvasEditor.remount() +
  // deselect() + notifyChange() after, instead of the old DOM-based
  // reRenderPreservingEditingState. remount()/deselect() only apply if the
  // swapped slide is the one currently mounted; notifyChange() always fires
  // so autosave (Task 9, which didn't exist when deck-editor.js was written)
  // observes the change regardless.
  function setSlideComponent(slideIndex, componentId) {
    return fetchLibrary().then(function (library) {
      var entry = (library.slides || []).filter(function (s) { return s.componentId === componentId; })[0];
      if (!entry) throw new Error('CanvasTemplatePicker.setSlideComponent: unknown componentId "' + componentId + '"');
      if (window.CanvasHistory) window.CanvasHistory.push();
      var slide = window.DECK.slides[slideIndex];
      slide.layout = 'schema';
      slide.componentId = componentId;
      slide.elements = JSON.parse(JSON.stringify(entry.elements));
      if (window.CanvasEditor && window.CanvasEditor.getActiveSlideIndex() === slideIndex) {
        window.CanvasEditor.remount(); // old Konva node references are gone after this
        window.CanvasEditor.deselect();
      }
      if (window.CanvasEditor) window.CanvasEditor.notifyChange();
    });
  }

  // --- Thumbnails (verbatim port of buildThumbnail's technique) -----------
  function buildThumbnail(componentId, elements, slideIndex) {
    var thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.setAttribute('data-canvas-template-thumb', 'true');
    thumb.dataset.componentId = componentId;
    // Fixed small box at the deck's real 16:9 ratio; render the real elements
    // at full scale inside an inner div, then CSS-scale the whole thing down
    // -- reuses DeckSchemaRenderer verbatim, so the thumbnail can never drift
    // from the real render. Same 96x54px box, same styling as the original.
    thumb.style.cssText = 'width:96px;height:54px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.2);background:#171717;padding:0;cursor:pointer;';
    var inner = document.createElement('div');
    inner.style.cssText = 'width:960px;height:540px;position:relative;transform:scale(0.1);transform-origin:top left;';
    window.DeckSchemaRenderer.renderSchemaElements(elements, inner);
    thumb.appendChild(inner);
    thumb.addEventListener('click', function (e) {
      e.stopPropagation();
      setSlideComponent(slideIndex, componentId);
      close();
    });
    return thumb;
  }

  // --- Popover (single global instance -- see file header) -----------------
  var popoverEl = null;
  var escHandler = null;

  function isOpen() {
    return !!popoverEl;
  }

  function close() {
    if (!popoverEl) return;
    popoverEl.remove();
    popoverEl = null;
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  // Positions the popover fixed relative to the trigger button's own
  // getBoundingClientRect() -- same clamping shape as canvas-context-menu.js's
  // show(x, y) / canvas-toolbars.js's position(), re-derived here since this
  // popover anchors below a button rather than a raw click point or a node's
  // bounding box.
  function position(anchorEl, popover) {
    var anchorRect = anchorEl.getBoundingClientRect();
    var rect = popover.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var left = Math.max(4, Math.min(anchorRect.left, vw - rect.width - 4));
    var top = Math.max(4, Math.min(anchorRect.bottom + 4, vh - rect.height - 4));
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }

  function open(anchorEl, slideIndex) {
    close(); // only one popover open at a time, globally (see file header)
    var popover = document.createElement('div');
    popover.setAttribute('data-canvas-template-popover', 'true');
    popover.style.cssText = [
      'position:fixed',
      'z-index:100000',
      'background:#212121',
      'border:1px solid #171717',
      'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.45)',
      'padding:8px',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'max-height:300px',
      'overflow-y:auto',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#ececec',
    ].join(';');
    document.body.appendChild(popover);
    popoverEl = popover;
    position(anchorEl, popover);

    fetchLibrary().then(function (library) {
      if (popoverEl !== popover) return; // closed (or re-opened) before this resolved
      CURATED_VARIANTS.forEach(function (group) {
        var groupLabel = document.createElement('div');
        groupLabel.style.cssText = "font-size:10px;color:rgba(255,255,255,.6);font-family:'DM Sans',sans-serif;";
        groupLabel.textContent = group.category;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
        group.ids.forEach(function (id) {
          var entry = (library.slides || []).filter(function (s) { return s.componentId === id; })[0];
          if (!entry) return; // skip silently if a curated id is somehow missing from the library
          row.appendChild(buildThumbnail(id, entry.elements, slideIndex));
        });
        popover.appendChild(groupLabel);
        popover.appendChild(row);
      });
      position(anchorEl, popover); // re-clamp now that content changed the popover's size
    });

    escHandler = function (e) {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escHandler);
  }

  // --- Trigger button lifecycle (new chrome -- old deck-editor.js's
  // "Change layout…" button lived inline in a per-slide control bar; there's
  // no such DOM structure here, so this is always-visible chrome tied to
  // CanvasEditor's mount()/unmount() lifecycle instead of per-selected-
  // element like Task 6's context menu). ------------------------------------
  var triggerBtn = null;
  var triggerMountEl = null;

  function positionTrigger() {
    if (!triggerBtn || !triggerMountEl) return;
    var rect = triggerMountEl.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    triggerBtn.style.top = (rect.top + 8) + 'px';
    triggerBtn.style.right = (vw - rect.right + 8) + 'px';
  }

  function onMount(mountEl, slideIndex) {
    onUnmount();
    triggerMountEl = mountEl;
    triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.setAttribute('data-canvas-template-trigger', 'true');
    triggerBtn.textContent = 'Change layout…';
    triggerBtn.style.cssText = [
      'position:fixed',
      'z-index:100000',
      'padding:5px 10px',
      'background:#212121',
      'border:1px solid #171717',
      'border-radius:6px',
      'color:#ececec',
      'font-size:12px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'cursor:pointer',
    ].join(';');
    triggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen()) { close(); return; }
      open(triggerBtn, slideIndex);
    });
    document.body.appendChild(triggerBtn);
    positionTrigger();
  }

  function onUnmount() {
    close();
    if (triggerBtn) { triggerBtn.remove(); triggerBtn = null; }
    triggerMountEl = null;
  }

  window.CanvasTemplatePicker = {
    open: open,
    close: close,
    isOpen: isOpen,
    setSlideComponent: setSlideComponent,
    // Called by canvas-editor.js's mount()/unmount() -- same guarded
    // "if (window.CanvasTemplatePicker)" wiring style as CanvasToolbars/
    // CanvasHistory's cross-module hooks elsewhere in this codebase.
    _onMount: onMount,
    _onUnmount: onUnmount,
    // Exposed for direct unit testing.
    _fetchLibrary: fetchLibrary,
    _CURATED_VARIANTS: CURATED_VARIANTS,
    _resetLibraryCache: function () { libraryCache = null; },
  };
})();
