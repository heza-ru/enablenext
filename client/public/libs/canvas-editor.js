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
  var selectedIndex = null;
  var changeListeners = [];

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
      imgEl.src = brandImage ? window.DeckRenderer.brandImagePath(brandImage) : window.DeckRenderer.deckAssetPath(deckAsset);
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
  }

  function handleDragEnd(e) {
    updateElementFromNode(e.target);
  }

  // Konva's Transformer resizes by adjusting scaleX/scaleY rather than
  // width/height directly. Standard Konva pattern: fold the scale into an
  // absolute width/height and reset scale to 1, so the next transform starts
  // from a clean baseline instead of compounding scale factors.
  function handleTransformEnd(e) {
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

  function selectElement(elIndex) {
    if (!layer || !transformer) return;
    var node = layer.getChildren().find(function (n) { return n._elIndex === elIndex; });
    if (!node) return;
    selectedIndex = elIndex;
    transformer.nodes([node]);
    layer.batchDraw();
  }

  function deselect() {
    selectedIndex = null;
    if (transformer) transformer.nodes([]);
    if (layer) layer.batchDraw();
  }

  function getSelectedIndex() {
    return selectedIndex;
  }

  function mount(mountEl, slideIndex) {
    unmount(); // idempotent re-mount, mirrors deck-editor.js's enableEditing discipline
    activeSlideIndex = slideIndex || 0;
    var rect = mountEl.getBoundingClientRect();
    scale = Math.min(rect.width / SW, rect.height / SH) || 1;
    stage = new window.Konva.Stage({ container: mountEl, width: SW * scale, height: SH * scale });
    layer = new window.Konva.Layer();
    stage.add(layer);
    transformer = new window.Konva.Transformer({
      rotateEnabled: true,
      // Konva's own default handles (corners + edges + rotation) — not
      // hand-rolled.
    });
    layer.add(transformer);
    var slide = window.DECK.slides[activeSlideIndex];
    var elements = (slide && slide.elements) || [];
    sortByZIndex(elements).forEach(function (item) {
      var node = elementToKonvaNode(item.el, scale);
      if (node) {
        node._elIndex = item.origIndex;
        node.on('click tap', function () { selectElement(node._elIndex); });
        node.on('dragend', handleDragEnd);
        node.on('transformend', handleTransformEnd);
        layer.add(node);
      }
    });
    // Clicking empty stage area deselects, matching standard Konva
    // Transformer UX (click-away clears selection).
    stage.on('click tap', function (e) {
      if (e.target === stage) deselect();
    });
    transformer.moveToTop();
    layer.draw();
  }

  function unmount() {
    if (stage) { stage.destroy(); stage = null; layer = null; transformer = null; }
    selectedIndex = null;
    // Note: change listeners are intentionally NOT cleared here — a consumer
    // (e.g. the future autosave queue) subscribes once and expects to keep
    // hearing about changes across mount/unmount cycles as the user
    // navigates between slides.
  }

  window.CanvasEditor = {
    mount: mount,
    unmount: unmount,
    isMounted: isMounted,
    getStage: getStage,
    selectElement: selectElement,
    deselect: deselect,
    getSelectedIndex: getSelectedIndex,
    onChange: onChange,
    // Exposed for direct unit testing without a real canvas.
    _pxToInches: pxToInches,
    _inchesToPx: inchesToPx,
    _updateElementFromNode: updateElementFromNode,
  };
})();
