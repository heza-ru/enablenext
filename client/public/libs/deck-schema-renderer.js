// client/public/libs/deck-schema-renderer.js
//
// Generic component/element interpreter for the 'schema' deck layout.
// Loaded via <script src="/libs/deck-schema-renderer.js"> AFTER deck-renderer.js.
// Renders a { elements: ElementSpec[] } tree two ways from one source, same
// discipline as every hand-coded layout in deck-renderer.js — except here the
// geometry lives in the LLM-authored slide spec itself (or a converter-
// extracted library entry), not in a hand-written per-layout geometry table.
(function () {
  var DR = window.DeckRenderer;
  var SW = DR.SW;
  var SH = DR.SH;

  function hexToCss(hex) {
    var h = (hex || 'FFFFFF').replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  function renderSchemaElements(elements, containerEl) {
    (elements || []).forEach(function (el, elIndex) {
      if (el.type === 'text') {
        var span = document.createElement('div');
        span.className = 'schema-text';
        // Record this element's true position in the slide's `elements` array
        // (not its position among only the text elements) so deck-editor.js's
        // inline-edit commit writes back to the correct array slot even when
        // the slide mixes shape/image elements before/between text elements
        // (the common case for real master-deck componentId slides).
        span.dataset.elIndex = String(elIndex);
        span.style.position = 'absolute';
        span.style.left = (el.x / SW) * 100 + '%';
        span.style.top = (el.y / SH) * 100 + '%';
        span.style.width = (el.w / SW) * 100 + '%';
        span.style.height = (el.h / SH) * 100 + '%';
        span.style.fontSize = (el.fontSize || 14) + 'pt';
        span.style.color = hexToCss(el.color || 'FFFFFF');
        span.style.fontWeight = el.fontWeight || 'normal';
        span.style.fontFamily = "'" + (el.fontFamily || 'DM Sans') + "',sans-serif";
        span.style.textAlign = el.align || 'left';
        span.textContent = el.text || '';
        // Auto-fit is deliberately NOT run here. renderDeck() builds every
        // slide's DOM tree BEFORE attaching it to the document, so at this
        // point `span` lives in a detached subtree with no computed layout:
        // scrollHeight and clientHeight are both 0 and the shrink loop can
        // never engage. The base/min sizes are stashed on the element instead,
        // and fitAllSchemaText() does the measuring once the tree is live
        // (called by renderDeck after mount, and by goTo per active slide).
        span.dataset.baseFontSize = String(el.fontSize || 14);
        span.dataset.minFontSize = String(el.minFontSize || 8);
        containerEl.appendChild(span);
      } else if (el.type === 'image') {
        if (!el.brandImage && !el.deckAsset) {
          throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
        }
        var img = document.createElement('img');
        img.className = 'schema-image';
        img.style.position = 'absolute';
        img.style.left = (el.x / SW) * 100 + '%';
        img.style.top = (el.y / SH) * 100 + '%';
        img.style.width = (el.w / SW) * 100 + '%';
        img.style.height = (el.h / SH) * 100 + '%';
        img.style.objectFit = 'contain';
        img.src = el.brandImage ? DR.brandImagePath(el.brandImage) : DR.deckAssetPath(el.deckAsset);
        containerEl.appendChild(img);
      } else if (el.type === 'shape') {
        var box = document.createElement('div');
        box.className = 'schema-shape';
        box.style.position = 'absolute';
        box.style.left = (el.x / SW) * 100 + '%';
        box.style.top = (el.y / SH) * 100 + '%';
        box.style.width = (el.w / SW) * 100 + '%';
        box.style.height = (el.h / SH) * 100 + '%';
        box.style.background = hexToCss(el.fill || '4a4560');
        if (el.shape === 'roundRect') {
          box.style.borderRadius = ((el.rectRadius || 0.06) / SW) * 100 + '%';
        } else if (el.shape === 'ellipse') {
          box.style.borderRadius = '50%';
        }
        containerEl.appendChild(box);
      } else {
        throw new Error('DeckSchemaRenderer: unknown element type "' + el.type + '"');
      }
    });
  }

  /**
   * Shrink one .schema-text element's font size until its content stops
   * overflowing its fixed box, down to a floor. Always restarts from the
   * element's authored base size so repeated calls (e.g. re-fitting on every
   * goTo) are idempotent and can grow the text back if the box got bigger.
   *
   * Only meaningful on an element that is attached to the document AND
   * visible — an element inside a `content-visibility:auto` non-active slide
   * skips layout, so callers must only fit the currently active slide.
   */
  function fitSchemaText(span) {
    var base = parseFloat(span.dataset.baseFontSize || '') || 14;
    var min = parseFloat(span.dataset.minFontSize || '') || 8;
    var currentSize = base;
    span.style.fontSize = currentSize + 'pt';
    while (span.scrollHeight > span.clientHeight && currentSize > min) {
      currentSize -= 1;
      span.style.fontSize = currentSize + 'pt';
    }
  }

  /**
   * Run the auto-fit pass over every .schema-text element under rootEl.
   * Call this only after rootEl is attached to the live document.
   */
  function fitAllSchemaText(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    var nodes = rootEl.querySelectorAll('.schema-text');
    for (var i = 0; i < nodes.length; i++) {
      fitSchemaText(nodes[i]);
    }
  }

  function exportSchemaElements(pptxSlide, elements) {
    (elements || []).forEach(function (el) {
      if (el.type === 'text') {
        pptxSlide.addText(el.text || '', {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fontSize: el.fontSize || 14,
          color: el.color || 'FFFFFF',
          bold: el.fontWeight === 'bold',
          fontFace: el.fontFamily || 'DM Sans',
          align: el.align || 'left',
          fit: 'shrink',
        });
      } else if (el.type === 'image') {
        if (!el.brandImage && !el.deckAsset) {
          throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
        }
        // Use the origin-prefixed path as-is. The primary export trigger
        // (triggerViaPreviewIframe in DownloadArtifact.tsx) runs downloadPptx()
        // INSIDE the Sandpack preview iframe, which is cross-origin from the
        // app — that is precisely why window._BRAND_ORIGIN is injected
        // (useArtifactProps.ts). Stripping the origin here produced a bare
        // /deck-assets/... path that resolved against the Sandpack origin and
        // silently dropped every schema-layout image from the exported PPTX.
        // This matches the 3 hand-coded addImage call sites in deck-renderer.js
        // and embedFontsInPptx's origin-aware fetch.
        var fullPath = el.brandImage ? DR.brandImagePath(el.brandImage) : DR.deckAssetPath(el.deckAsset);
        pptxSlide.addImage({ path: fullPath, x: el.x, y: el.y, w: el.w, h: el.h });
      } else if (el.type === 'shape') {
        pptxSlide.addShape(el.shape, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fill: { color: el.fill || '4a4560' },
          rectRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) : undefined,
        });
      } else {
        throw new Error('DeckSchemaRenderer: unknown element type "' + el.type + '"');
      }
    });
  }

  DR.registerLayout('schema', {
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'position:relative;';
      renderSchemaElements(spec.elements, slideEl);
    },
    exportPptx: function (pptxSlide, spec) {
      exportSchemaElements(pptxSlide, spec.elements);
    },
  });

  window.DeckSchemaRenderer = {
    renderSchemaElements: renderSchemaElements,
    exportSchemaElements: exportSchemaElements,
    fitSchemaText: fitSchemaText,
    fitAllSchemaText: fitAllSchemaText,
  };
})();
