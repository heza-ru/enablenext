// Konva-based canvas editor: the ONLY editing surface for a deck. Read-only
// view + PPTX export remain deck-renderer.js/deck-schema-renderer.js, entirely
// unmodified by this file — editing swaps to this canvas, mutates
// window.DECK.slides[i].elements in place, and handing control back to the
// existing renderer is just re-calling DeckRenderer.renderDeck with the
// mutated data (this file does not re-implement the view renderer).
(function () {
  var SW = window.DeckRenderer.SW; // 10
  var SH = window.DeckRenderer.SH; // 5.625
  var stage = null;
  var layer = null;
  var transformer = null;
  var activeSlideIndex = 0;
  var scale = 1;
  var selectedIndices = []; // kept sorted ascending
  var changeListeners = [];
  var keydownHandler = null;
  var lastMountEl = null;
  var NUDGE_STEP = 0.05; // inches
  var NUDGE_STEP_SHIFT = 0.2; // inches
  var DUPLICATE_OFFSET = 0.2; // inches
  var nonSchemaNoticeEl = null; // DOM overlay shown for non-schema (hand-coded) layouts

  function isMounted() {
    return stage !== null;
  }

  function getStage() {
    return stage;
  }

  // --- Coordinate conversion (pure, directly unit-testable) ------------
  // `scale` is px-per-inch (see mount()): px = inches * scale.
  function pxToInches(px, s) {
    return px / (s == null ? scale : s);
  }

  function inchesToPx(inches, s) {
    return inches * (s == null ? scale : s);
  }

  // Sort order matches deck-schema-renderer.js's sortByZIndex: elements with
  // an explicit zIndex are ordered by it; elements without one fall back to
  // their original array position, so mixed decks (some elements tagged,
  // some not) still render in a stable, predictable stacking order.
  function sortByZIndex(elements) {
    return (elements || [])
      .map(function (el, i) { return { el: el, origIndex: i }; })
      .sort(function (a, b) {
        var az = a.el.zIndex != null ? a.el.zIndex : a.origIndex;
        var bz = b.el.zIndex != null ? b.el.zIndex : b.origIndex;
        return az - bz;
      });
  }

  function elementToKonvaNode(el, s) {
    var common = { x: el.x * s, y: el.y * s, rotation: el.rotation || 0, draggable: true };
    if (el.type === 'text') {
      return new window.Konva.Text({
        x: common.x, y: common.y, rotation: common.rotation, draggable: true,
        width: el.w * s, height: el.h * s,
        // pt->px: 1pt = 1/72in, and `scale` is already px-per-inch, so
        // px = pt * scale / 72 (matches deck-schema-renderer.js's CSS
        // `font-size: Npt`, which the browser resolves the same way at
        // 96dpi where scale===96).
        text: el.text || '', fontSize: (el.fontSize || 14) * s / 72,
        fill: '#' + (el.color || 'FFFFFF'),
        fontStyle: (el.fontWeight === 'bold' || el.bold === true) ? 'bold' : 'normal',
        fontFamily: el.fontFamily || 'DM Sans',
        align: el.align || 'left',
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'shape') {
      var isEllipse = el.shape === 'ellipse';
      var ShapeCtor = isEllipse ? window.Konva.Ellipse : window.Konva.Rect;
      var radiusX = (el.w * s) / 2, radiusY = (el.h * s) / 2;
      // Every other element type (Rect/Text/Image) treats x/y as its
      // top-left corner, matching deck-schema-renderer.js's CSS
      // left/top positioning — including for ellipses, which it draws via
      // border-radius:50% on a top-left-positioned box, NOT a center-based
      // transform. Konva.Ellipse, however, treats x/y as the shape's
      // CENTER. Offset by the radius here so the schema's top-left x/y
      // renders in the same place a real DOM/CSS re-render would put it;
      // updateElementFromNode() below applies the exact inverse when
      // writing geometry back out.
      var shapeX = isEllipse ? common.x + radiusX : common.x;
      var shapeY = isEllipse ? common.y + radiusY : common.y;
      return new ShapeCtor({
        x: shapeX, y: shapeY, rotation: common.rotation, draggable: true,
        width: el.w * s, height: el.h * s,
        radiusX: radiusX, radiusY: radiusY, // only used by Ellipse
        fill: '#' + (el.fill || '4a4560'),
        cornerRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) * s : 0,
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'image') {
      var node = new window.Konva.Image({
        x: common.x, y: common.y, rotation: common.rotation, draggable: true,
        width: el.w * s, height: el.h * s, image: undefined,
      });
      var imgEl = new Image();
      var brandImage = el.brandImage, deckAsset = el.deckAsset;
      // uploadedImageUrl (Task 10's Upload tab) is a complete URL from the
      // deck-asset upload endpoint and needs no brandImagePath/deckAssetPath
      // resolution — same precedence as deck-schema-renderer.js's
      // resolveImageRef.
      imgEl.src = el.uploadedImageUrl
        ? el.uploadedImageUrl
        : (brandImage ? window.DeckRenderer.brandImagePath(brandImage) : window.DeckRenderer.deckAssetPath(deckAsset));
      imgEl.onload = function () { node.image(imgEl); if (layer) layer.batchDraw(); };
      return node;
    }
    return null; // unknown type: skip, do not throw (same isolation discipline as renderDeck)
  }

  // --- Selection / geometry sync ----------------------------------------

  function notifyChange() {
    changeListeners.forEach(function (cb) {
      try { cb(); } catch (e) { /* a bad listener must not break the editor */ }
    });
  }

  function onChange(cb) {
    if (typeof cb === 'function') changeListeners.push(cb);
  }

  // Konva.Ellipse maps width()/height() internally to radiusX*2/radiusY*2 in
  // real Konva, but jsdom unit tests use plain mock objects that only define
  // x()/y()/width()/height()/rotation() (per the brief). Detecting radiusX
  // explicitly keeps real-Ellipse behavior correct without relying on a mock
  // implementing radius accessors it was never asked to implement.
  function getNodeSizePx(node) {
    if (typeof node.radiusX === 'function') {
      return { w: node.radiusX() * 2, h: node.radiusY() * 2 };
    }
    return { w: node.width(), h: node.height() };
  }

  function setNodeSizePx(node, w, h) {
    if (typeof node.radiusX === 'function') {
      node.radiusX(w / 2);
      node.radiusY(h / 2);
    } else {
      node.width(w);
      node.height(h);
    }
  }

  // Converts a Konva node's current pixel/scale geometry back into the
  // SW x SH inch canvas and writes it into the corresponding DECK element.
  // Exposed for direct unit testing (no real canvas/pointer needed): pass a
  // mock object implementing .x()/.y()/.width()/.height()/.rotation() and
  // ._elIndex.
  function updateElementFromNode(node) {
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[activeSlideIndex];
    if (!slide || !slide.elements) return;
    var el = slide.elements[node._elIndex];
    if (!el) return;
    var size = getNodeSizePx(node);
    var nodeX = node.x(), nodeY = node.y();
    // Inverse of the center-offset applied in elementToKonvaNode: a
    // Konva.Ellipse's x()/y() are its center, but every DECK element
    // (ellipses included) stores/expects top-left x/y (see
    // deck-schema-renderer.js's CSS left/top + border-radius:50%
    // positioning). Only Ellipse needs correcting back to top-left before
    // writing to window.DECK.
    if (typeof node.radiusX === 'function') {
      nodeX -= size.w / 2;
      nodeY -= size.h / 2;
    }
    el.x = pxToInches(nodeX);
    el.y = pxToInches(nodeY);
    el.w = pxToInches(size.w);
    el.h = pxToInches(size.h);
    el.rotation = node.rotation() || 0;
    notifyChange();
    // Keep the floating toolbar (Task 7) glued to the element as it's
    // dragged/resized/rotated — its position was computed from the node's
    // pre-drag bounding box, so it must recompute once the node settles.
    if (window.CanvasToolbars && selectedIndices.length === 1 && selectedIndices[0] === node._elIndex) {
      window.CanvasToolbars.showFor(node._elIndex, node, stage);
    }
  }

  function handleDragEnd(e) {
    if (window.CanvasHistory) window.CanvasHistory.push();
    updateElementFromNode(e.target);
  }

  // Konva's Transformer resizes by adjusting scaleX/scaleY rather than
  // width/height directly. Standard Konva pattern: fold the scale into an
  // absolute width/height and reset scale to 1, so the next transform starts
  // from a clean baseline instead of compounding scale factors.
  function handleTransformEnd(e) {
    if (window.CanvasHistory) window.CanvasHistory.push();
    var node = e.target;
    var scaleX = node.scaleX();
    var scaleY = node.scaleY();
    if (scaleX !== 1 || scaleY !== 1) {
      var size = getNodeSizePx(node);
      node.scaleX(1);
      node.scaleY(1);
      setNodeSizePx(node, Math.max(5, size.w * scaleX), Math.max(5, size.h * scaleY));
    }
    updateElementFromNode(node);
  }

  function findNodeByIndex(elIndex) {
    if (!layer) return null;
    return layer.getChildren().find(function (n) { return n._elIndex === elIndex; });
  }

  function applySelection() {
    if (!layer || !transformer) return;
    var nodes = selectedIndices
      .map(findNodeByIndex)
      .filter(function (n) { return !!n; });
    transformer.nodes(nodes);
    transformer.moveToTop();
    layer.batchDraw();
    if (window.CanvasToolbars) {
      if (selectedIndices.length === 1 && nodes.length === 1) {
        window.CanvasToolbars.showFor(selectedIndices[0], nodes[0], stage);
      } else {
        window.CanvasToolbars.hide();
      }
    }
  }

  // Plain click: replace selection with just this element.
  function selectElement(elIndex) {
    if (!layer || !transformer) return;
    var node = findNodeByIndex(elIndex);
    if (!node) return;
    selectedIndices = [elIndex];
    applySelection();
  }

  // Shift-click: toggle this element in/out of the current selection.
  function toggleSelectElement(elIndex) {
    if (!layer || !transformer) return;
    var node = findNodeByIndex(elIndex);
    if (!node) return;
    var pos = selectedIndices.indexOf(elIndex);
    if (pos === -1) {
      selectedIndices = selectedIndices.concat([elIndex]).sort(function (a, b) { return a - b; });
    } else {
      selectedIndices = selectedIndices.slice(0, pos).concat(selectedIndices.slice(pos + 1));
    }
    applySelection();
  }

  function deselect() {
    selectedIndices = [];
    if (transformer) transformer.nodes([]);
    if (layer) layer.batchDraw();
    if (window.CanvasToolbars) window.CanvasToolbars.hide();
  }

  function getSelectedIndices() {
    return selectedIndices.slice();
  }

  // Creates a Konva node for a DECK element at the given origIndex and wires
  // its standard event handlers, adding it to the layer. Shared by mount()
  // (initial render) and duplicateSelected() (rendering new nodes for
  // duplicated elements) so the per-node setup logic lives in one place.
  function createAndAddNode(el, origIndex) {
    var node = elementToKonvaNode(el, scale);
    if (!node) return null;
    node._elIndex = origIndex;
    node.on('click tap', function (e) {
      if (e.evt && e.evt.shiftKey) {
        toggleSelectElement(node._elIndex);
      } else {
        selectElement(node._elIndex);
      }
    });
    node.on('dragend', handleDragEnd);
    node.on('transformend', handleTransformEnd);
    layer.add(node);
    return node;
  }

  function isEditableFocused() {
    var active = document.activeElement;
    if (!active) return false;
    var tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  function deleteSelected() {
    if (selectedIndices.length === 0) return;
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[activeSlideIndex];
    if (!slide || !slide.elements) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    // Highest index first so lower indices don't shift under us mid-splice.
    var toDelete = selectedIndices.slice().sort(function (a, b) { return b - a; });
    toDelete.forEach(function (idx) {
      var node = findNodeByIndex(idx);
      if (node) node.destroy();
      slide.elements.splice(idx, 1);
    });
    // Remaining nodes' _elIndex values are now stale wherever they pointed
    // past a deleted index — rebuild node tags to match the new array.
    reindexNodesAfterSplice(toDelete);
    selectedIndices = [];
    if (transformer) transformer.nodes([]);
    if (layer) layer.batchDraw();
    if (window.CanvasToolbars) window.CanvasToolbars.hide();
    notifyChange();
  }

  // After splicing out `deletedIndices` (original indices, any order) from
  // window.DECK's elements array, every remaining node's _elIndex must shift
  // down by however many deleted indices were below it, so node._elIndex
  // keeps matching its element's new position in the array.
  function reindexNodesAfterSplice(deletedIndices) {
    if (!layer) return;
    var sortedDeleted = deletedIndices.slice().sort(function (a, b) { return a - b; });
    layer.getChildren().forEach(function (node) {
      if (typeof node._elIndex !== 'number') return; // Transformer, etc.
      var shift = 0;
      for (var i = 0; i < sortedDeleted.length; i++) {
        if (sortedDeleted[i] < node._elIndex) shift++;
      }
      node._elIndex -= shift;
    });
  }

  function duplicateSelected() {
    if (selectedIndices.length === 0) return;
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[activeSlideIndex];
    if (!slide || !slide.elements) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    var newIndices = [];
    // Process in ascending order; each duplicate is appended, so earlier
    // duplicates don't affect later original indices.
    selectedIndices.slice().sort(function (a, b) { return a - b; }).forEach(function (idx) {
      var original = slide.elements[idx];
      if (!original) return;
      var copy = JSON.parse(JSON.stringify(original));
      copy.x = (copy.x || 0) + DUPLICATE_OFFSET;
      copy.y = (copy.y || 0) + DUPLICATE_OFFSET;
      var newIndex = slide.elements.length;
      slide.elements.push(copy);
      createAndAddNode(copy, newIndex);
      newIndices.push(newIndex);
    });
    selectedIndices = newIndices.sort(function (a, b) { return a - b; });
    applySelection();
    notifyChange();
  }

  function nudgeSelected(dx, dy) {
    if (selectedIndices.length === 0) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    selectedIndices.forEach(function (idx) {
      var node = findNodeByIndex(idx);
      if (!node) return;
      node.x(node.x() + inchesToPx(dx));
      node.y(node.y() + inchesToPx(dy));
      updateElementFromNode(node);
    });
    if (layer) layer.batchDraw();
  }

  // Ensures every element on the active slide has an explicit zIndex (its
  // current array index) before z-order shortcuts swap values around —
  // "forward"/"backward" is only well-defined relative to siblings once
  // every sibling has a concrete number to compare against.
  function ensureZIndices(elements) {
    elements.forEach(function (el, i) {
      if (el.zIndex == null) el.zIndex = i;
    });
  }

  function relayerNodes(elements) {
    if (!layer) return;
    sortByZIndex(elements).forEach(function (item) {
      var node = findNodeByIndex(item.origIndex);
      if (node) node.moveToTop();
    });
    if (transformer) transformer.moveToTop();
    layer.batchDraw();
  }

  function moveZOrder(direction) { // direction: +1 forward, -1 backward
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[activeSlideIndex];
    if (!slide || !slide.elements || selectedIndices.length === 0) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    var elements = slide.elements;
    ensureZIndices(elements);
    // For each selected element (stable ascending order), find the nearest
    // unselected sibling immediately above (forward) / below (backward) in
    // current sort order and swap zIndex values with it.
    selectedIndices.slice().sort(function (a, b) { return direction > 0 ? b - a : a - b; }).forEach(function (elIndex) {
      var currentSorted = sortByZIndex(elements);
      var pos = currentSorted.findIndex(function (item) { return item.origIndex === elIndex; });
      if (pos === -1) return;
      var neighborPos = pos + direction;
      while (neighborPos >= 0 && neighborPos < currentSorted.length && selectedIndices.indexOf(currentSorted[neighborPos].origIndex) !== -1) {
        neighborPos += direction;
      }
      if (neighborPos < 0 || neighborPos >= currentSorted.length) return;
      var a = currentSorted[pos].el;
      var b = currentSorted[neighborPos].el;
      var tmp = a.zIndex;
      a.zIndex = b.zIndex;
      b.zIndex = tmp;
    });
    relayerNodes(elements);
    notifyChange();
  }

  function moveZOrderExtreme(toFront) {
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[activeSlideIndex];
    if (!slide || !slide.elements || selectedIndices.length === 0) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    var elements = slide.elements;
    ensureZIndices(elements);
    var allZ = elements.map(function (el) { return el.zIndex; });
    var extreme = toFront ? Math.max.apply(null, allZ) : Math.min.apply(null, allZ);
    var nextVal = toFront ? extreme + 1 : extreme - 1;
    // Bring-to-front assigns ascending zIndex values while walking selected
    // indices in ascending order, so the lowest origIndex gets the lowest
    // (furthest back, among the group) new zIndex — relative order preserved.
    // Send-to-back assigns descending zIndex values (nextVal keeps
    // decrementing), so it must walk selected indices in DESCENDING order:
    // the highest origIndex gets the smallest decrement (ends up furthest
    // back among the group) and the lowest origIndex ends up closest to the
    // rest of the stack — this again preserves the selected elements'
    // relative order among themselves.
    selectedIndices.slice().sort(function (a, b) { return toFront ? a - b : b - a; }).forEach(function (elIndex) {
      var el = elements[elIndex];
      if (!el) return;
      el.zIndex = nextVal;
      nextVal = toFront ? nextVal + 1 : nextVal - 1;
    });
    relayerNodes(elements);
    notifyChange();
  }

  function handleKeydown(e) {
    if (!isMounted()) return;
    if (isEditableFocused()) return;
    var meta = e.metaKey || e.ctrlKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (meta && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (meta && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      // Task 8 installs _undoRedoHook = {undo, redo}; until then this is a no-op.
      if (window.CanvasEditor._undoRedoHook) {
        if (e.shiftKey) window.CanvasEditor._undoRedoHook.redo();
        else window.CanvasEditor._undoRedoHook.undo();
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      var step = e.shiftKey ? NUDGE_STEP_SHIFT : NUDGE_STEP;
      var dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      nudgeSelected(dx, dy);
      notifyChange();
      return;
    }
    if (e.altKey && e.key === ']') {
      e.preventDefault();
      if (e.shiftKey) moveZOrderExtreme(true);
      else moveZOrder(1);
      return;
    }
    if (e.altKey && e.key === '[') {
      e.preventDefault();
      if (e.shiftKey) moveZOrderExtreme(false);
      else moveZOrder(-1);
      return;
    }
  }

  function mount(mountEl, slideIndex) {
    unmount(); // idempotent re-mount, mirrors deck-editor.js's enableEditing discipline
    lastMountEl = mountEl;
    activeSlideIndex = slideIndex || 0;
    var rect = mountEl.getBoundingClientRect();
    scale = Math.min(rect.width / SW, rect.height / SH) || 1;
    stage = new window.Konva.Stage({ container: mountEl, width: SW * scale, height: SH * scale });
    layer = new window.Konva.Layer();
    stage.add(layer);
    var slide = window.DECK.slides[activeSlideIndex];

    // Only the 'schema' layout stores its content as elements[] (the shape
    // this whole file knows how to render). The 19 other hand-coded
    // deck-renderer.js layouts (stat/two_col/timeline/etc.) keep their
    // content in layout-specific fields (stats/items/...), so there is
    // nothing here to draw on the Konva stage — rendering the normal path
    // for them silently produces a blank canvas (just the empty
    // Transformer, zero content nodes). Show an explicit, non-alarming
    // notice instead, and skip the selection/drag/keyboard machinery since
    // there is nothing to select or drag. The stage/layer above are still
    // created so isMounted() stays true and unmount()/remount() and the
    // slide-action chrome (Change layout…/reorder/duplicate/delete) keep
    // working normally — "Change layout…" is in fact how the user escapes
    // this state.
    if (slide && slide.layout && slide.layout !== 'schema') {
      layer.draw();
      nonSchemaNoticeEl = document.createElement('div');
      nonSchemaNoticeEl.setAttribute('data-canvas-non-schema-notice', 'true');
      nonSchemaNoticeEl.style.cssText = [
        'position:absolute',
        'inset:0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'text-align:center',
        'padding:32px',
        'box-sizing:border-box',
        'background:#212121',
        'border:1px solid #171717',
        'color:#ececec',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:14px',
        'line-height:1.5',
        'pointer-events:none',
        'z-index:1',
      ].join(';');
      nonSchemaNoticeEl.textContent = 'This slide uses the \'' + slide.layout + '\' layout, which isn\'t canvas-editable yet. Use “Change layout…” to convert it to a componentId-based layout you can edit directly.';
      mountEl.appendChild(nonSchemaNoticeEl);

      // Always-visible "Change layout…" / slide-action chrome must still
      // work on a non-schema slide (it's the escape hatch), but the
      // selection/drag/keyboard machinery below is intentionally skipped.
      if (window.CanvasTemplatePicker) window.CanvasTemplatePicker._onMount(mountEl, activeSlideIndex);
      if (window.CanvasSlideActions) window.CanvasSlideActions._onMount(mountEl, activeSlideIndex);
      return;
    }

    transformer = new window.Konva.Transformer({
      rotateEnabled: true,
      // Konva's own default handles (corners + edges + rotation) — not
      // hand-rolled.
    });
    layer.add(transformer);
    var elements = (slide && slide.elements) || [];
    sortByZIndex(elements).forEach(function (item) {
      createAndAddNode(item.el, item.origIndex);
    });
    // Clicking empty stage area deselects, matching standard Konva
    // Transformer UX (click-away clears selection). Shift-click on empty
    // stage is a no-op (does not clear an existing multi-selection).
    stage.on('click tap', function (e) {
      if (e.target === stage && !(e.evt && e.evt.shiftKey)) deselect();
    });
    transformer.moveToTop();
    layer.draw();

    keydownHandler = handleKeydown;
    document.addEventListener('keydown', keydownHandler);

    // Always-visible "Change layout…" chrome (Task 11) — acts on the whole
    // current slide, unlike the per-selected-element toolbar/context menu, so
    // it lives on the mount/unmount lifecycle rather than the selection one.
    if (window.CanvasTemplatePicker) window.CanvasTemplatePicker._onMount(mountEl, activeSlideIndex);
    // Always-visible slide-level reorder/duplicate/delete chrome (parity
    // gap-fill for deck-editor.js's old reorderSlide/duplicateSlide/
    // deleteSlide) — same mount/unmount-lifecycle wiring as CanvasTemplatePicker.
    if (window.CanvasSlideActions) window.CanvasSlideActions._onMount(mountEl, activeSlideIndex);
  }

  function unmount() {
    if (stage) { stage.destroy(); stage = null; layer = null; transformer = null; }
    if (nonSchemaNoticeEl) {
      if (nonSchemaNoticeEl.parentNode) nonSchemaNoticeEl.parentNode.removeChild(nonSchemaNoticeEl);
      nonSchemaNoticeEl = null;
    }
    selectedIndices = [];
    if (window.CanvasToolbars) window.CanvasToolbars.hide();
    if (window.CanvasTemplatePicker) window.CanvasTemplatePicker._onUnmount();
    if (window.CanvasSlideActions) window.CanvasSlideActions._onUnmount();
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    // Note: change listeners are intentionally NOT cleared here — a consumer
    // (e.g. the future autosave queue) subscribes once and expects to keep
    // hearing about changes across mount/unmount cycles as the user
    // navigates between slides.
  }

  // Full rebuild of the Konva stage from the current window.DECK state.
  // mount() already calls unmount() first, so this is a clean re-render —
  // used by CanvasHistory's undo()/redo() after mutating window.DECK.slides
  // in place, since old Konva node references would otherwise point at
  // stale geometry.
  function remount() {
    if (!lastMountEl) return;
    mount(lastMountEl, activeSlideIndex);
  }

  window.CanvasEditor = {
    mount: mount,
    unmount: unmount,
    remount: remount,
    isMounted: isMounted,
    getStage: getStage,
    selectElement: selectElement,
    toggleSelectElement: toggleSelectElement,
    deselect: deselect,
    getSelectedIndices: getSelectedIndices,
    onChange: onChange,
    notifyChange: notifyChange,
    getActiveSlideIndex: function () { return activeSlideIndex; },
    // The module's internal lastMountEl (same one remount() already uses) —
    // needed so CanvasSlideActions can re-mount a DIFFERENT slide index onto
    // the SAME DOM element after a reorder/delete.
    getMountEl: function () { return lastMountEl; },
    // Real actions (not test-only internals) — same functions Task 5's
    // keyboard shortcuts call, exposed so the context menu (Task 6) and
    // toolbar (Task 7) can invoke them directly instead of synthesizing
    // fake KeyboardEvents.
    deleteSelected: deleteSelected,
    duplicateSelected: duplicateSelected,
    moveZOrder: moveZOrder,
    moveZOrderExtreme: moveZOrderExtreme,
    // Task 8 installs _undoRedoHook = {undo, redo}; until then this is a no-op.
    _undoRedoHook: null,
    // Exposed for direct unit testing without a real canvas.
    _pxToInches: pxToInches,
    _inchesToPx: inchesToPx,
    _updateElementFromNode: updateElementFromNode,
  };
})();
