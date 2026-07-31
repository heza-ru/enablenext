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
//
// Task 12 adds a SEPARATE "+ Add slide" trigger + popover to this same file
// (rather than a new file) because it reuses so much of the above machinery
// (fetchLibrary/CURATED_VARIANTS/buildThumbnail, the single global popoverEl,
// the mount/unmount-driven trigger lifecycle) — see insertSlideAfter(),
// openInsert(), and the second trigger button in onMount() below. It is a
// distinct action from Task 11's swap (INSERTS a new slide rather than
// replacing the current one), so it gets its own button/popover, but shares
// the underlying popover machinery so only one of the two can be open at once.
(function () {
  // Emergency hotfix (see deck-renderer.js's identical helper for the full
  // story): this file's canvas artifact iframe is genuinely cross-origin
  // (Sandpack) in production, so a direct fetch() against the real app's
  // static assets gets CORS-blocked there even though it works fine in
  // jsdom tests and any same-origin fallback context. Try the direct fetch
  // first (cheap, and correct wherever CORS isn't a problem); only fall back
  // to relaying the request through the parent app (DownloadArtifact.tsx's
  // artifact-asset-fetch-request/-result listener, which does a same-origin
  // fetch from the parent page and posts the result back) when the direct
  // attempt fails. Duplicated in deck-renderer.js rather than shared/imported
  // since both are separate vanilla-JS IIFE files per this codebase's
  // convention -- keep the two in sync if this logic changes.
  function fetchViaParentIfNeeded(path, encoding) {
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return fetch(origin + path).then(function (r) {
      if (r.ok === false) throw new Error('fetch failed: ' + r.status);
      return encoding === 'base64' ? r.arrayBuffer() : r.text();
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        var requestId = 'assetfetch_' + Math.random().toString(36).slice(2);
        var timeout = setTimeout(function () {
          window.removeEventListener('message', handler);
          reject(new Error('asset fetch relay timed out for ' + path));
        }, 10000);
        function handler(e) {
          if (!e.data || e.data.type !== 'artifact-asset-fetch-result' || e.data.requestId !== requestId) return;
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (e.data.error) { reject(new Error(e.data.error)); return; }
          resolve(e.data.data);
        }
        window.addEventListener('message', handler);
        window.parent.postMessage({ type: 'artifact-asset-fetch-request', requestId: requestId, path: path, encoding: encoding }, '*');
      });
    });
  }

  // --- Variant/componentId swap (verbatim port) ---------------------------
  var libraryCache = null;
  function fetchLibrary() {
    if (libraryCache) return Promise.resolve(libraryCache);
    return fetchViaParentIfNeeded('/brand/master-deck-library.json', 'text')
      .then(function (text) { return JSON.parse(text); })
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

  // Task 12 ("+ Add slide"): inserts a brand-new slide right after
  // `afterIndex`, deep-cloning the same library entry setSlideComponent()
  // swaps in-place, but splicing it into window.DECK.slides rather than
  // overwriting an existing one -- same array-splice discipline as
  // deck-editor.js's duplicateSlide (window.DECK.slides.splice(index+1, 0,
  // copy)). Per design: no remount()/deselect() and no activeSlideIndex
  // change -- the Konva canvas only ever mounts one slide at a time and has
  // no mechanism of its own to decide "now show a different slide"; that's
  // the surrounding artifact view's job whenever it next navigates there.
  // notifyChange() still fires so autosave (Task 9) observes the new slide.
  function insertSlideAfter(afterIndex, componentId) {
    return fetchLibrary().then(function (library) {
      var entry = (library.slides || []).filter(function (s) { return s.componentId === componentId; })[0];
      if (!entry) throw new Error('CanvasTemplatePicker.insertSlideAfter: unknown componentId "' + componentId + '"');
      if (window.CanvasHistory) window.CanvasHistory.push();
      var newSlide = { layout: 'schema', componentId: componentId, elements: JSON.parse(JSON.stringify(entry.elements)) };
      window.DECK.slides.splice(afterIndex + 1, 0, newSlide);
      if (window.CanvasEditor) window.CanvasEditor.notifyChange();
    });
  }

  // --- Thumbnails (verbatim port of buildThumbnail's technique) -----------
  // `onSelect(componentId)` is called on click, then the popover is closed --
  // shared by both the swap popover (onSelect calls setSlideComponent) and
  // the Task 12 insert popover (onSelect calls insertSlideAfter).
  function buildThumbnail(componentId, elements, onSelect) {
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
      onSelect(componentId);
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

  // True only if the currently-open popover (if any) is the one identified by
  // `attr` -- lets each trigger button's own click-to-toggle-close behavior
  // ("click again while open closes it") stay scoped to ITS OWN popover
  // rather than also closing (then immediately reopening) the other picker's.
  function isOpenWithAttr(attr) {
    return !!(popoverEl && popoverEl.getAttribute(attr) === 'true');
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

  // Shared popover builder: `onSelect(componentId)` runs when a thumbnail is
  // clicked, `popoverAttr` names the marker attribute so tests/CSS can tell
  // the swap popover and the Task 12 insert popover apart even though they
  // share this single global popoverEl (only one open at a time, globally,
  // covering BOTH pickers -- see file header and open()/openInsert() below).
  function openPopover(anchorEl, onSelect, popoverAttr) {
    close(); // only one popover open at a time, globally (see file header)
    var popover = document.createElement('div');
    popover.setAttribute(popoverAttr, 'true');
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
          row.appendChild(buildThumbnail(id, entry.elements, onSelect));
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

  // Public: swap-in-place popover (Task 11).
  function open(anchorEl, slideIndex) {
    openPopover(anchorEl, function (componentId) {
      setSlideComponent(slideIndex, componentId);
    }, 'data-canvas-template-popover');
  }

  // Public: insert-new-slide popover (Task 12). Shares openPopover()'s single
  // global popoverEl with open() above, so opening either one closes the
  // other -- "only one picker popover open at a time" covers both by
  // construction rather than a second parallel mechanism.
  function openInsert(anchorEl, afterIndex) {
    openPopover(anchorEl, function (componentId) {
      insertSlideAfter(afterIndex, componentId);
    }, 'data-canvas-insert-popover');
  }

  // --- Trigger button lifecycle (new chrome -- old deck-editor.js's
  // "Change layout…" button lived inline in a per-slide control bar; there's
  // no such DOM structure here, so this is always-visible chrome tied to
  // CanvasEditor's mount()/unmount() lifecycle instead of per-selected-
  // element like Task 6's context menu). ------------------------------------
  var triggerBtn = null;
  var insertTriggerBtn = null;
  var triggerMountEl = null;
  var TRIGGER_STYLE = [
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

  function positionTrigger() {
    if (!triggerMountEl) return;
    var rect = triggerMountEl.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    if (triggerBtn) {
      triggerBtn.style.top = (rect.top + 8) + 'px';
      triggerBtn.style.right = (vw - rect.right + 8) + 'px';
    }
    // Task 12's "+ Add slide" trigger lives in the opposite corner (top-left
    // of the mount el) from Task 11's "Change layout…" trigger (top-right),
    // so the two are always visually and functionally distinct chrome, never
    // stacked on top of one another.
    if (insertTriggerBtn) {
      insertTriggerBtn.style.top = (rect.top + 8) + 'px';
      insertTriggerBtn.style.left = (rect.left + 8) + 'px';
    }
  }

  function onMount(mountEl, slideIndex) {
    onUnmount();
    triggerMountEl = mountEl;

    triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.setAttribute('data-canvas-template-trigger', 'true');
    triggerBtn.textContent = 'Change layout…';
    triggerBtn.style.cssText = TRIGGER_STYLE;
    triggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpenWithAttr('data-canvas-template-popover')) { close(); return; }
      open(triggerBtn, slideIndex);
    });
    document.body.appendChild(triggerBtn);

    // Task 12: separate "+ Add slide" trigger -- inserts a new slide after
    // whichever slide is currently mounted, rather than swapping it. Same
    // lifecycle (mount/unmount), same popover technique, distinct button and
    // popover so "change this slide" and "add a new slide" can never be
    // confused for one another.
    insertTriggerBtn = document.createElement('button');
    insertTriggerBtn.type = 'button';
    insertTriggerBtn.setAttribute('data-canvas-insert-trigger', 'true');
    insertTriggerBtn.textContent = '+ Add slide';
    insertTriggerBtn.style.cssText = TRIGGER_STYLE;
    insertTriggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpenWithAttr('data-canvas-insert-popover')) { close(); return; }
      openInsert(insertTriggerBtn, window.CanvasEditor.getActiveSlideIndex());
    });
    document.body.appendChild(insertTriggerBtn);

    positionTrigger();
  }

  function onUnmount() {
    close();
    if (triggerBtn) { triggerBtn.remove(); triggerBtn = null; }
    if (insertTriggerBtn) { insertTriggerBtn.remove(); insertTriggerBtn = null; }
    triggerMountEl = null;
  }

  window.CanvasTemplatePicker = {
    open: open,
    close: close,
    isOpen: isOpen,
    setSlideComponent: setSlideComponent,
    // Task 12: insert-new-slide-from-template picker. Shares this module's
    // fetchLibrary()/CURATED_VARIANTS/buildThumbnail machinery (see comments
    // above) rather than duplicating a second fetch+cache elsewhere.
    openInsert: openInsert,
    insertSlideAfter: insertSlideAfter,
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
