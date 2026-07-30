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
  var activeSlideIndex = 0;

  function isMounted() {
    return stage !== null;
  }

  function getStage() {
    return stage;
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

  function elementToKonvaNode(el, scale) {
    var common = { x: el.x * scale, y: el.y * scale, rotation: el.rotation || 0 };
    if (el.type === 'text') {
      return new window.Konva.Text({
        x: common.x, y: common.y, rotation: common.rotation,
        width: el.w * scale, height: el.h * scale,
        // pt->px: 1pt = 1/72in, and `scale` is already px-per-inch, so
        // px = pt * scale / 72 (matches deck-schema-renderer.js's CSS
        // `font-size: Npt`, which the browser resolves the same way at
        // 96dpi where scale===96). Refined further in Task 4.
        text: el.text || '', fontSize: (el.fontSize || 14) * scale / 72,
        fill: '#' + (el.color || 'FFFFFF'),
        fontStyle: (el.fontWeight === 'bold' || el.bold === true) ? 'bold' : 'normal',
        fontFamily: el.fontFamily || 'DM Sans',
        align: el.align || 'left',
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'shape') {
      var ShapeCtor = el.shape === 'ellipse' ? window.Konva.Ellipse : window.Konva.Rect;
      return new ShapeCtor({
        x: common.x, y: common.y, rotation: common.rotation,
        width: el.w * scale, height: el.h * scale,
        radiusX: (el.w * scale) / 2, radiusY: (el.h * scale) / 2, // only used by Ellipse
        fill: '#' + (el.fill || '4a4560'),
        cornerRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) * scale : 0,
        opacity: el.opacity != null ? el.opacity : 1,
      });
    }
    if (el.type === 'image') {
      var node = new window.Konva.Image({ x: common.x, y: common.y, rotation: common.rotation, width: el.w * scale, height: el.h * scale, image: undefined });
      var imgEl = new Image();
      var brandImage = el.brandImage, deckAsset = el.deckAsset;
      imgEl.src = brandImage ? window.DeckRenderer.brandImagePath(brandImage) : window.DeckRenderer.deckAssetPath(deckAsset);
      imgEl.onload = function () { node.image(imgEl); if (layer) layer.batchDraw(); };
      return node;
    }
    return null; // unknown type: skip, do not throw (same isolation discipline as renderDeck)
  }

  function mount(mountEl, slideIndex) {
    unmount(); // idempotent re-mount, mirrors deck-editor.js's enableEditing discipline
    activeSlideIndex = slideIndex || 0;
    var rect = mountEl.getBoundingClientRect();
    var scale = Math.min(rect.width / SW, rect.height / SH) || 1;
    stage = new window.Konva.Stage({ container: mountEl, width: SW * scale, height: SH * scale });
    layer = new window.Konva.Layer();
    stage.add(layer);
    var slide = window.DECK.slides[activeSlideIndex];
    var elements = (slide && slide.elements) || [];
    sortByZIndex(elements).forEach(function (item) {
      var node = elementToKonvaNode(item.el, scale);
      if (node) { node._elIndex = item.origIndex; layer.add(node); }
    });
    layer.draw();
  }

  function unmount() {
    if (stage) { stage.destroy(); stage = null; layer = null; }
  }

  window.CanvasEditor = { mount: mount, unmount: unmount, isMounted: isMounted, getStage: getStage };
})();
