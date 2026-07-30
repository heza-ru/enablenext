// Floating per-element-type toolbar for the Konva canvas editor. Pure UI:
// every control writes directly into the corresponding window.DECK element
// field and mutates the live Konva node to match, then calls
// window.CanvasEditor.notifyChange() so future autosave (Task 9) observes
// the edit. canvas-editor.js's selection-change handler (Task 7 wiring in
// applySelection()/deleteSelected()/updateElementFromNode()/unmount()) is
// the only caller of showFor()/hide() — this file has no opinion on *when*
// it should be shown, only *what* to render once told which element.
(function () {
  var toolbarEl = null;
  var GAP = 8; // px between the node's bounding box and the toolbar

  function isVisible() {
    return !!toolbarEl && toolbarEl.style.display !== 'none';
  }

  function hide() {
    if (toolbarEl) toolbarEl.style.display = 'none';
  }

  function buildToolbar() {
    if (toolbarEl) return toolbarEl;
    toolbarEl = document.createElement('div');
    toolbarEl.setAttribute('data-canvas-toolbar', 'true');
    toolbarEl.style.cssText = [
      'position:fixed',
      'z-index:100000',
      'display:none',
      'align-items:center',
      'gap:10px',
      'padding:6px 10px',
      'background:#212121',
      'border:1px solid #171717',
      'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.45)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:12px',
      'color:#ececec',
      'user-select:none',
      'white-space:nowrap',
    ].join(';');
    document.body.appendChild(toolbarEl);
    return toolbarEl;
  }

  // --- hex color <-> DECK's #-less hex convention -------------------------
  // DECK stores colors/fills as bare hex ("FFFFFF"); <input type="color">
  // requires a leading "#". Exposed on the public API purely so the test
  // suite can assert the round-trip directly without reaching into DOM
  // internals.
  function toInputColor(deckHex) {
    var h = deckHex || '000000';
    return h.charAt(0) === '#' ? h : '#' + h;
  }

  function fromInputColor(inputValue) {
    var v = inputValue || '#000000';
    return v.charAt(0) === '#' ? v.slice(1) : v;
  }

  // --- small DOM helpers ---------------------------------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') node.style.cssText = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function label(text) {
    var s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = 'opacity:0.65;font-size:11px;';
    return s;
  }

  function redraw(node) {
    if (node.getLayer && node.getLayer()) node.getLayer().batchDraw();
  }

  function mutate(elIndex, mutator) {
    var slideIndex = window.CanvasEditor.getActiveSlideIndex();
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[slideIndex];
    if (!slide || !slide.elements) return;
    var deckEl = slide.elements[elIndex];
    if (!deckEl) return;
    mutator(deckEl);
    window.CanvasEditor.notifyChange();
  }

  // --- control set builders -------------------------------------------------

  function buildTextControls(container, elIndex, node, deckEl) {
    // Font family: exactly the two brand fonts embedded per the design spec.
    var fontSelect = el('select', { 'data-toolbar-control': 'fontFamily' }, [
      el('option', { value: 'DM Sans' }, [document.createTextNode('DM Sans')]),
      el('option', { value: 'IBM Plex Sans' }, [document.createTextNode('IBM Plex Sans')]),
    ]);
    fontSelect.value = deckEl.fontFamily || 'DM Sans';
    fontSelect.addEventListener('change', function () {
      mutate(elIndex, function (e) { e.fontFamily = fontSelect.value; });
      node.fontFamily(fontSelect.value);
      redraw(node);
    });

    // Size (points, matches DECK's fontSize field).
    var sizeInput = el('input', {
      type: 'number', min: '6', max: '200', 'data-toolbar-control': 'fontSize',
      style: 'width:52px;background:#171717;color:#ececec;border:1px solid #333;border-radius:4px;padding:3px 4px;',
    });
    sizeInput.value = deckEl.fontSize || 14;
    sizeInput.addEventListener('change', function () {
      var pt = parseFloat(sizeInput.value);
      if (!isFinite(pt)) return;
      pt = Math.max(6, Math.min(200, pt));
      sizeInput.value = pt;
      mutate(elIndex, function (e) { e.fontSize = pt; });
      // Same pt->px conversion elementToKonvaNode() uses: scale is
      // px-per-inch, so px = pt * scale / 72.
      var stageScale = node.getStage() ? node.getStage().width() / window.DeckRenderer.SW : 96;
      node.fontSize(pt * stageScale / 72);
      redraw(node);
    });

    // Color (bare-hex DECK convention <-> #-prefixed <input type="color">).
    var colorInput = el('input', {
      type: 'color', 'data-toolbar-control': 'color',
      style: 'width:28px;height:24px;border:none;background:none;padding:0;cursor:pointer;',
    });
    colorInput.value = toInputColor(deckEl.color);
    colorInput.addEventListener('input', function () {
      var hex = fromInputColor(colorInput.value);
      mutate(elIndex, function (e) { e.color = hex; });
      node.fill('#' + hex);
      redraw(node);
    });

    // Bold toggle: canonical fontWeight field, NOT the legacy bold boolean.
    var boldBtn = el('button', {
      type: 'button', 'data-toolbar-control': 'bold',
      style: 'width:26px;height:24px;border:1px solid #444;border-radius:4px;background:#171717;color:#ececec;font-weight:bold;cursor:pointer;',
    });
    boldBtn.textContent = 'B';
    function syncBoldVisual() {
      var isBold = deckEl.fontWeight === 'bold';
      boldBtn.style.background = isBold ? '#4a4a4a' : '#171717';
    }
    syncBoldVisual();
    boldBtn.addEventListener('click', function () {
      var next = deckEl.fontWeight === 'bold' ? 'normal' : 'bold';
      mutate(elIndex, function (e) { e.fontWeight = next; });
      syncBoldVisual();
      node.fontStyle(next === 'bold' ? 'bold' : 'normal');
      redraw(node);
    });

    // Align: three toggle buttons, left/center/right.
    var alignWrap = el('span', { style: 'display:inline-flex;gap:2px;' });
    ['left', 'center', 'right'].forEach(function (a) {
      var btn = el('button', {
        type: 'button', 'data-toolbar-control': 'align-' + a,
        style: 'width:24px;height:24px;border:1px solid #444;border-radius:4px;background:#171717;color:#ececec;cursor:pointer;font-size:11px;',
      });
      btn.textContent = a.charAt(0).toUpperCase();
      function syncAlignVisual() {
        var current = deckEl.align || 'left';
        btn.style.background = current === a ? '#4a4a4a' : '#171717';
      }
      syncAlignVisual();
      btn.addEventListener('click', function () {
        mutate(elIndex, function (e) { e.align = a; });
        node.align(a);
        redraw(node);
        syncAlignVisual();
      });
      alignWrap.appendChild(btn);
    });

    container.appendChild(label('Font'));
    container.appendChild(fontSelect);
    container.appendChild(sizeInput);
    container.appendChild(colorInput);
    container.appendChild(boldBtn);
    container.appendChild(alignWrap);
  }

  function buildImageControls(container, elIndex) {
    var replaceBtn = el('button', {
      type: 'button', 'data-toolbar-control': 'replace-image',
      style: 'padding:4px 10px;border:1px solid #444;border-radius:4px;background:#171717;color:#ececec;cursor:pointer;',
    });
    replaceBtn.textContent = 'Replace image';
    replaceBtn.addEventListener('click', function () {
      if (window.CanvasToolbars._imageEditorHook && window.CanvasToolbars._imageEditorHook.replace) {
        window.CanvasToolbars._imageEditorHook.replace(elIndex);
      }
    });

    var cropBtn = el('button', {
      type: 'button', 'data-toolbar-control': 'crop-image',
      style: 'padding:4px 10px;border:1px solid #444;border-radius:4px;background:#171717;color:#ececec;cursor:pointer;',
    });
    cropBtn.textContent = 'Crop';
    cropBtn.addEventListener('click', function () {
      if (window.CanvasToolbars._imageEditorHook && window.CanvasToolbars._imageEditorHook.crop) {
        window.CanvasToolbars._imageEditorHook.crop(elIndex);
      }
    });

    container.appendChild(replaceBtn);
    container.appendChild(cropBtn);
  }

  function buildShapeControls(container, elIndex, node, deckEl) {
    var fillInput = el('input', {
      type: 'color', 'data-toolbar-control': 'fill',
      style: 'width:28px;height:24px;border:none;background:none;padding:0;cursor:pointer;',
    });
    fillInput.value = toInputColor(deckEl.fill);
    fillInput.addEventListener('input', function () {
      var hex = fromInputColor(fillInput.value);
      mutate(elIndex, function (e) { e.fill = hex; });
      node.fill('#' + hex);
      redraw(node);
    });

    var opacityInput = el('input', {
      type: 'range', min: '0', max: '1', step: '0.05', 'data-toolbar-control': 'opacity',
    });
    opacityInput.value = deckEl.opacity != null ? deckEl.opacity : 1;
    opacityInput.addEventListener('input', function () {
      var val = parseFloat(opacityInput.value);
      if (!isFinite(val)) return;
      mutate(elIndex, function (e) { e.opacity = val; });
      node.opacity(val);
      redraw(node);
    });

    container.appendChild(label('Fill'));
    container.appendChild(fillInput);
    container.appendChild(label('Opacity'));
    container.appendChild(opacityInput);
  }

  // --- positioning -----------------------------------------------------------
  // Same clamping *shape* as canvas-context-menu.js's show(x, y) (keep
  // top-left within the viewport), re-derived here because this toolbar is
  // centered on a node's bounding box and prefers above/below placement
  // rather than being pinned to a raw click point.
  function position(node, stage) {
    var container = stage.container();
    var containerRect = container.getBoundingClientRect();
    var box = node.getClientRect({ relativeTo: stage });
    var nodeLeft = containerRect.left + box.x;
    var nodeTop = containerRect.top + box.y;
    var nodeRight = nodeLeft + box.width;
    var nodeBottom = nodeTop + box.height;
    var nodeCenterX = (nodeLeft + nodeRight) / 2;

    var rect = toolbarEl.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    var top;
    if (nodeTop - rect.height - GAP >= 0) {
      top = nodeTop - rect.height - GAP; // room above: prefer it
    } else {
      top = nodeBottom + GAP; // else below
    }
    top = Math.max(4, Math.min(top, vh - rect.height - 4));

    var left = nodeCenterX - rect.width / 2;
    left = Math.max(4, Math.min(left, vw - rect.width - 4));

    toolbarEl.style.left = left + 'px';
    toolbarEl.style.top = top + 'px';
  }

  function showFor(elIndex, node, stage) {
    var slideIndex = window.CanvasEditor.getActiveSlideIndex();
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[slideIndex];
    var deckEl = slide && slide.elements && slide.elements[elIndex];
    if (!deckEl) { hide(); return; }

    var toolbar = buildToolbar();
    toolbar.innerHTML = '';
    toolbar.style.display = 'flex';

    if (deckEl.type === 'text') buildTextControls(toolbar, elIndex, node, deckEl);
    else if (deckEl.type === 'image') buildImageControls(toolbar, elIndex);
    else if (deckEl.type === 'shape') buildShapeControls(toolbar, elIndex, node, deckEl);
    else { hide(); return; }

    position(node, stage);
  }

  window.CanvasToolbars = {
    showFor: showFor,
    hide: hide,
    isVisible: isVisible,
    // Task 10 installs {replace(elIndex), crop(elIndex)}; until then image
    // controls no-op.
    _imageEditorHook: null,
    // Exposed for direct unit testing of the hex conversion round-trip.
    _toInputColor: toInputColor,
    _fromInputColor: fromInputColor,
  };
})();
