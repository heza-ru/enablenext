// Upload/crop editor modal for the Konva canvas editor's image elements.
// Opened from Task 7's floating toolbar ("Replace image"/"Crop" buttons —
// canvas-toolbars.js's buildImageControls() calls
// window.CanvasToolbars._imageEditorHook.replace(elIndex)/.crop(elIndex),
// wired to this file's open() at the bottom). Pure UI + a postMessage relay:
// every committed change writes directly into window.DECK + mutates the live
// Konva node, then calls window.CanvasEditor.notifyChange() so autosave
// (Task 9) observes it — same "no separate commit step" convention as
// canvas-toolbars.js.
//
// Cross-origin note (investigated up front, see task-10-report.md): the deck
// artifact renders inside a genuinely cross-origin Sandpack iframe with no
// access to the parent app's auth token, so this file cannot call the
// upload endpoint (api/server/routes/files/deckAsset.js) directly. Instead it
// posts the file (as a data URL) to window.parent, which relays it to the
// endpoint using its own auth and posts the resulting URL back. See
// DownloadArtifact.tsx's 'artifact-image-upload-request' listener.
(function () {
  var overlayEl = null;
  var currentElIndex = null;
  var currentTab = 'upload'; // 'upload' | 'assets'
  var pendingRequestId = null;

  // Same curated list documented in agents/presentation-creator.skill.md's
  // "Brand Graphics" table. Hardcoded here (not read off disk / a manifest)
  // because there is no directory-listing endpoint and building one is out
  // of scope for this task — see task-10-report.md's scope note.
  var BRAND_IMAGES = [
    { key: 'authoring-agent-dark', path: '/brand/authoring-agent-dark.svg', label: 'Authoring Agent (dark)' },
    { key: 'authoring-agent-light', path: '/brand/authoring-agent-light.svg', label: 'Authoring Agent (light)' },
    { key: 'authoring-agent-box-dark', path: '/brand/authoring-agent-box-dark.svg', label: 'Authoring Agent (box, dark)' },
    { key: 'guidance-agent-dark', path: '/brand/guidance-agent-dark.svg', label: 'Guidance Agent (dark)' },
    { key: 'guidance-agent-light', path: '/brand/guidance-agent-light.svg', label: 'Guidance Agent (light)' },
    { key: 'guidance-agent-box-dark', path: '/brand/guidance-agent-box-dark.svg', label: 'Guidance Agent (box, dark)' },
    { key: 'guidance-agent-box-light', path: '/brand/guidance-agent-box-light.svg', label: 'Guidance Agent (box, light)' },
    { key: 'insights-agent-dark', path: '/brand/insights-agent-dark.svg', label: 'Insights Agent (dark)' },
    { key: 'insights-agent-light', path: '/brand/insights-agent-light.svg', label: 'Insights Agent (light)' },
    { key: 'insights-agent-box-dark', path: '/brand/insights-agent-box-dark.svg', label: 'Insights Agent (box, dark)' },
    { key: 'insights-agent-box-light', path: '/brand/insights-agent-box-light.svg', label: 'Insights Agent (box, light)' },
    { key: 'product-suite-light', path: '/brand/product-suite-light.png', label: 'Product suite diagram' },
    { key: 'ai-agents-suite-light', path: '/brand/ai-agents-suite-light.png', label: 'AI Agents suite' },
    { key: 'dap-light', path: '/brand/dap-light.png', label: 'DAP logo' },
    { key: 'product-suite-full-dark', path: '/brand/product-suite-full-dark.png', label: 'Full suite (dark)' },
    { key: 'screensense-suite-dark', path: '/brand/screensense-suite-dark.png', label: 'ScreenSense suite (dark)' },
    { key: 'mirror-dark', path: '/brand/mirror-dark.png', label: 'Mirror logo (dark)' },
    { key: 'screensense-dark', path: '/brand/screensense-dark.png', label: 'ScreenSense logo (dark)' },
    { key: 'product-analytics-dark', path: '/brand/product-analytics-dark.png', label: 'Product Analytics logo (dark)' },
  ];

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') node.style.cssText = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function currentElement() {
    var slideIndex = window.CanvasEditor.getActiveSlideIndex();
    var slide = window.DECK && window.DECK.slides && window.DECK.slides[slideIndex];
    return slide && slide.elements && slide.elements[currentElIndex];
  }

  function findKonvaNode(elIndex) {
    var stage = window.CanvasEditor.getStage && window.CanvasEditor.getStage();
    if (!stage) return null;
    var layer = stage.getLayers()[0];
    if (!layer) return null;
    var found = null;
    layer.getChildren().forEach(function (n) {
      if (n._elIndex === elIndex) found = n;
    });
    return found;
  }

  function mutate(mutator) {
    var deckEl = currentElement();
    if (!deckEl) return;
    if (window.CanvasHistory) window.CanvasHistory.push();
    mutator(deckEl);
    window.CanvasEditor.notifyChange();
  }

  // Live-updates the Konva Image node's source to match the element's
  // current image reference, mirroring canvas-editor.js's
  // elementToKonvaNode() image branch precedence.
  function refreshKonvaImage() {
    var node = findKonvaNode(currentElIndex);
    var deckEl = currentElement();
    if (!node || !deckEl) return;
    var src = deckEl.uploadedImageUrl
      ? deckEl.uploadedImageUrl
      : (deckEl.brandImage
        ? window.DeckRenderer.brandImagePath(deckEl.brandImage)
        : window.DeckRenderer.deckAssetPath(deckEl.deckAsset));
    var imgEl = new Image();
    imgEl.src = src;
    imgEl.onload = function () {
      node.image(imgEl);
      if (node.getLayer && node.getLayer()) node.getLayer().batchDraw();
    };
  }

  function setImageSource(fields) {
    // fields: one of { uploadedImageUrl } or { brandImage }. Always clears
    // the other image reference fields so exactly one is set at a time
    // (matches resolveImageRef's contract: brandImage/deckAsset/
    // uploadedImageUrl are mutually exclusive).
    mutate(function (e) {
      delete e.uploadedImageUrl;
      delete e.brandImage;
      delete e.deckAsset;
      Object.keys(fields).forEach(function (k) { e[k] = fields[k]; });
    });
    refreshKonvaImage();
  }

  // --- Upload tab -----------------------------------------------------------

  function requestId() {
    return 'img-upload-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function readFileAsDataUrl(file, cb) {
    var reader = new FileReader();
    reader.onload = function () { cb(reader.result); };
    reader.readAsDataURL(file);
  }

  function handleUploadResult(e) {
    if (!e.data || e.data.type !== 'artifact-image-upload-result') return;
    if (!pendingRequestId || e.data.requestId !== pendingRequestId) return;
    pendingRequestId = null;
    var statusEl = overlayEl && overlayEl.querySelector('[data-image-editor="upload-status"]');
    if (e.data.error) {
      if (statusEl) statusEl.textContent = 'Upload failed: ' + e.data.error;
      return;
    }
    if (statusEl) statusEl.textContent = '';
    setImageSource({ uploadedImageUrl: e.data.url });
    close();
  }

  function startUpload(file) {
    if (!file) return;
    var statusEl = overlayEl && overlayEl.querySelector('[data-image-editor="upload-status"]');
    if (statusEl) statusEl.textContent = 'Uploading…';
    readFileAsDataUrl(file, function (dataUrl) {
      var reqId = requestId();
      pendingRequestId = reqId;
      window.parent.postMessage({
        type: 'artifact-image-upload-request',
        requestId: reqId,
        dataUrl: dataUrl,
        filename: file.name,
        mimeType: file.type,
      }, '*');
    });
  }

  function buildUploadTab() {
    var wrap = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

    var dropZone = el('div', {
      'data-image-editor': 'drop-zone',
      style: [
        'border:2px dashed #444', 'border-radius:8px', 'padding:24px',
        'text-align:center', 'cursor:pointer', 'font-size:12px', 'opacity:0.8',
      ].join(';'),
      text: 'Drag an image here, or click to choose a file',
    });

    var fileInput = el('input', {
      type: 'file', accept: 'image/*', 'data-image-editor': 'file-input',
      style: 'display:none;',
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      startUpload(file);
    });

    dropZone.addEventListener('click', function () { fileInput.click(); });
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.style.background = '#2a2a2a'; });
    dropZone.addEventListener('dragleave', function () { dropZone.style.background = 'transparent'; });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.style.background = 'transparent';
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      startUpload(file);
    });

    var status = el('div', {
      'data-image-editor': 'upload-status',
      style: 'font-size:11px;opacity:0.75;min-height:14px;',
    });

    wrap.appendChild(dropZone);
    wrap.appendChild(fileInput);
    wrap.appendChild(status);
    return wrap;
  }

  // --- Existing assets tab ---------------------------------------------------

  function buildAssetsTab() {
    var grid = el('div', {
      'data-image-editor': 'assets-grid',
      style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-height:320px;overflow-y:auto;',
    });
    BRAND_IMAGES.forEach(function (asset) {
      var thumbBtn = el('button', {
        type: 'button', 'data-image-editor': 'asset', 'data-asset-key': asset.key,
        title: asset.label,
        style: [
          'display:flex', 'flex-direction:column', 'align-items:center', 'gap:4px',
          'padding:6px', 'background:#171717', 'border:1px solid #333', 'border-radius:6px',
          'cursor:pointer', 'color:#ececec', 'font-size:10px',
        ].join(';'),
      });
      var img = el('img', {
        src: asset.path, alt: asset.label,
        style: 'width:100%;height:40px;object-fit:contain;background:#0d0d0d;border-radius:3px;',
      });
      var caption = el('span', { text: asset.label, style: 'text-align:center;line-height:1.2;' });
      thumbBtn.appendChild(img);
      thumbBtn.appendChild(caption);
      thumbBtn.addEventListener('click', function () {
        setImageSource({ brandImage: asset.key });
        close();
      });
      grid.appendChild(thumbBtn);
    });
    return grid;
  }

  // --- Crop / focus-point control ---------------------------------------------

  function buildFocusControls() {
    var wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #333;' });
    wrap.appendChild(el('div', { style: 'font-size:11px;opacity:0.7;', text: 'Focus point (crop preview only — export uses the full image)' }));

    var deckEl = currentElement() || {};

    function sliderRow(labelText, field, dataAttr) {
      var row = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
      row.appendChild(el('span', { style: 'width:110px;font-size:11px;opacity:0.75;', text: labelText }));
      var slider = el('input', {
        type: 'range', min: '0', max: '100', step: '1', 'data-image-editor': dataAttr,
        style: 'flex:1;',
      });
      var initial = deckEl[field] != null ? deckEl[field] : 0.5;
      slider.value = String(Math.round(initial * 100));
      slider.addEventListener('input', function () {
        var frac = parseFloat(slider.value) / 100;
        mutate(function (e) { e[field] = frac; });
        var node = findKonvaNode(currentElIndex);
        redraw(node);
      });
      row.appendChild(slider);
      return row;
    }

    wrap.appendChild(sliderRow('Horizontal focus', 'focusX', 'focus-x'));
    wrap.appendChild(sliderRow('Vertical focus', 'focusY', 'focus-y'));
    return wrap;
  }

  function redraw(node) {
    if (node && node.getLayer && node.getLayer()) node.getLayer().batchDraw();
  }

  // --- Modal chrome -----------------------------------------------------------

  function buildOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = el('div', {
      'data-canvas-image-editor': 'true',
      style: [
        'position:fixed', 'inset:0', 'z-index:200000', 'display:none',
        'align-items:center', 'justify-content:center',
        'background:rgba(0,0,0,0.55)',
      ].join(';'),
    });
    overlayEl.addEventListener('mousedown', function (e) {
      if (e.target === overlayEl) close();
    });
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function renderModal() {
    var overlay = buildOverlay();
    overlay.innerHTML = '';

    var modal = el('div', {
      'data-image-editor': 'modal',
      style: [
        'width:420px', 'max-width:90vw', 'max-height:80vh', 'overflow-y:auto',
        'background:#212121', 'border:1px solid #171717', 'border-radius:8px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.5)', 'padding:16px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:13px', 'color:#ececec',
      ].join(';'),
    });

    var header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' });
    header.appendChild(el('div', { style: 'font-weight:600;', text: 'Image' }));
    var closeBtn = el('button', {
      type: 'button', 'data-image-editor': 'close',
      style: 'background:none;border:none;color:#ececec;cursor:pointer;font-size:16px;line-height:1;',
      text: '×',
    });
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var tabBar = el('div', { style: 'display:flex;gap:4px;margin-bottom:12px;' });
    ['upload', 'assets'].forEach(function (tab) {
      var btn = el('button', {
        type: 'button', 'data-image-editor-tab': tab,
        style: [
          'flex:1', 'padding:6px 0', 'border:1px solid #444', 'border-radius:4px',
          'cursor:pointer', 'font-size:12px',
          'background:' + (currentTab === tab ? '#4a4a4a' : '#171717'),
          'color:#ececec',
        ].join(';'),
        text: tab === 'upload' ? 'Upload' : 'Existing assets',
      });
      btn.addEventListener('click', function () {
        currentTab = tab;
        renderModal();
      });
      tabBar.appendChild(btn);
    });
    modal.appendChild(tabBar);

    var body = el('div', { 'data-image-editor': 'tab-body' });
    body.appendChild(currentTab === 'upload' ? buildUploadTab() : buildAssetsTab());
    modal.appendChild(body);

    modal.appendChild(buildFocusControls());

    overlay.appendChild(modal);
  }

  function open(elIndex) {
    currentElIndex = elIndex;
    currentTab = 'upload';
    pendingRequestId = null;
    renderModal();
    var overlay = buildOverlay();
    overlay.style.display = 'flex';
  }

  function openToCrop(elIndex) {
    currentElIndex = elIndex;
    currentTab = 'upload';
    pendingRequestId = null;
    renderModal();
    var overlay = buildOverlay();
    overlay.style.display = 'flex';
    var focusSection = overlay.querySelector('[data-image-editor="focus-x"]');
    if (focusSection && focusSection.scrollIntoView) focusSection.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    if (overlayEl) overlayEl.style.display = 'none';
    currentElIndex = null;
    pendingRequestId = null;
  }

  window.addEventListener('message', handleUploadResult);

  window.CanvasImageEditor = {
    open: open,
    close: close,
    // Exposed for direct unit testing without reaching into DOM internals.
    _BRAND_IMAGES: BRAND_IMAGES,
  };

  window.CanvasToolbars = window.CanvasToolbars || {};
  window.CanvasToolbars._imageEditorHook = {
    replace: function (elIndex) { window.CanvasImageEditor.open(elIndex); },
    crop: function (elIndex) { openToCrop(elIndex); },
  };
})();
