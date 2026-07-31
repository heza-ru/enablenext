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

  // How much larger than the element's own box the "virtual" crop frame is,
  // for approximate focusX/focusY export cropping (see exportSchemaElements
  // below). 1.35 gives +/-17.5% of pan room in each axis around center —
  // enough to meaningfully favor one edge/corner of the source image without
  // needing its real aspect ratio.
  var FOCUS_CROP_OVERSCAN = 1.35;

  function hexToCss(hex) {
    var h = (hex || 'FFFFFF').replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  // Recovers brandImage/deckAsset from a `src` path when an image element
  // doesn't set either field explicitly. Production evidence (a real
  // generated deck): the LLM authored image elements as
  // { type:'image', src:'/brand/KEY.ext', ... } -- a more "natural" HTML-like
  // convention it guessed instead of our actual brandImage/deckAsset
  // contract -- using otherwise-real, valid asset keys. Rather than relying
  // solely on prompt-following (skill docs) to prevent this recurring, the
  // renderer defensively recovers the real reference from `src` itself.
  // Only the KEY is recovered for /brand/ paths (extension is re-derived by
  // brandImagePath from its own PNG-only list), since the LLM's guessed
  // extension in `src` isn't necessarily correct.
  function resolveImageRef(el) {
    // uploadedImageUrl (Task 10's Upload tab) is a COMPLETE URL returned by
    // the deck-asset upload endpoint's storage strategy (local/S3/Azure/etc,
    // the same mechanism avatar.js uses) — it does NOT live under
    // client/public/deck-assets/ and needs no brandImagePath/deckAssetPath
    // resolution, unlike brandImage/deckAsset. Checked first since it's the
    // most specific/complete reference an element can carry.
    if (el.uploadedImageUrl) {
      return { uploadedImageUrl: el.uploadedImageUrl };
    }
    if (el.brandImage || el.deckAsset) {
      return { brandImage: el.brandImage, deckAsset: el.deckAsset };
    }
    if (typeof el.src === 'string') {
      var brandMatch = el.src.match(/^\/brand\/([^/]+)\.[a-zA-Z0-9]+$/);
      if (brandMatch) return { brandImage: brandMatch[1] };
      var assetMatch = el.src.match(/^\/deck-assets\/(.+)$/);
      if (assetMatch) return { deckAsset: assetMatch[1] };
    }
    return {};
  }

  // Recovers "bold" from either our documented `fontWeight: 'bold'` field or
  // a plain `bold: true` boolean -- production evidence (same real deck): the
  // LLM authored `bold: true` on several text elements, a natural boolean
  // convention it guessed instead of our actual fontWeight contract, and
  // every one of those silently rendered/exported as normal weight.
  function isBold(el) {
    return el.fontWeight === 'bold' || el.bold === true;
  }

  // Stably sorts a copy of `elements` by `zIndex` (paint order) while
  // preserving each element's true original array index for callers that
  // need to key back into the source array (data-el-index tagging, edit
  // commit handlers, etc.) -- the exact "true array index, not sorted-loop
  // position" discipline already established for text-among-shapes tagging
  // above must not regress when sorting is introduced.
  function sortByZIndex(elements) {
    return (elements || [])
      .map(function (el, i) { return { el: el, origIndex: i }; })
      .sort(function (a, b) {
        var az = a.el.zIndex != null ? a.el.zIndex : a.origIndex;
        var bz = b.el.zIndex != null ? b.el.zIndex : b.origIndex;
        return az - bz;
      });
  }

  function renderSchemaElements(elements, containerEl) {
    sortByZIndex(elements).forEach(function (item) {
      var el = item.el;
      var elIndex = item.origIndex;
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
        span.style.fontWeight = isBold(el) ? 'bold' : (el.fontWeight || 'normal');
        span.style.fontFamily = "'" + (el.fontFamily || 'DM Sans') + "',sans-serif";
        span.style.textAlign = el.align || 'left';
        if (el.opacity != null) span.style.opacity = String(el.opacity);
        if (el.rotation) span.style.transform = 'rotate(' + el.rotation + 'deg)';
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
        var imageRef = resolveImageRef(el);
        if (!imageRef.uploadedImageUrl && !imageRef.brandImage && !imageRef.deckAsset) {
          // Degrade gracefully instead of throwing: a missing image reference
          // is a common, recoverable authoring slip (especially for
          // componentId-copied library elements) and shouldn't cost the rest
          // of the slide's real content. Before this, a single such element
          // threw synchronously inside renderDeck's per-slide render loop,
          // which (prior to that loop's own isolation fix) aborted rendering
          // of the ENTIRE deck, not just this one element or slide.
          var placeholder = document.createElement('div');
          placeholder.className = 'schema-image-placeholder';
          placeholder.dataset.elIndex = String(elIndex);
          placeholder.style.position = 'absolute';
          placeholder.style.left = (el.x / SW) * 100 + '%';
          placeholder.style.top = (el.y / SH) * 100 + '%';
          placeholder.style.width = (el.w / SW) * 100 + '%';
          placeholder.style.height = (el.h / SH) * 100 + '%';
          placeholder.style.display = 'flex';
          placeholder.style.alignItems = 'center';
          placeholder.style.justifyContent = 'center';
          placeholder.style.border = '1px dashed rgba(255,255,255,.4)';
          placeholder.style.background = 'rgba(255,255,255,.05)';
          placeholder.style.color = 'rgba(255,255,255,.6)';
          placeholder.style.fontSize = '.7rem';
          placeholder.style.fontFamily = "'DM Sans',sans-serif";
          placeholder.style.textAlign = 'center';
          placeholder.textContent = 'Image unavailable';
          containerEl.appendChild(placeholder);
          return;
        }
        var img = document.createElement('img');
        img.className = 'schema-image';
        // Mirrors the .schema-text tagging above: records this element's true
        // position in the slide's `elements` array so deck-editor.js's
        // image-swap chrome (and any other future consumer) targets the
        // correct array slot even when text/shape elements are interleaved.
        img.dataset.elIndex = String(elIndex);
        img.style.position = 'absolute';
        img.style.left = (el.x / SW) * 100 + '%';
        img.style.top = (el.y / SH) * 100 + '%';
        img.style.width = (el.w / SW) * 100 + '%';
        img.style.height = (el.h / SH) * 100 + '%';
        // focusX/focusY (Task 10's crop/focus-point control, 0-1 floats,
        // default centered) only have a visible effect once the fit mode can
        // actually crop the image — 'contain' (the prior unconditional
        // default) never crops, so object-position would be a no-op under
        // it. Switch to 'cover' whenever a focus point is set; otherwise
        // keep the existing 'contain' behavior so untouched elements render
        // exactly as before.
        var hasFocus = el.focusX != null || el.focusY != null;
        img.style.objectFit = hasFocus ? 'cover' : 'contain';
        if (hasFocus) {
          var focusX = el.focusX != null ? el.focusX : 0.5;
          var focusY = el.focusY != null ? el.focusY : 0.5;
          img.style.objectPosition = (focusX * 100) + '% ' + (focusY * 100) + '%';
        }
        img.src = imageRef.uploadedImageUrl
          ? imageRef.uploadedImageUrl
          : (imageRef.brandImage ? DR.brandImagePath(imageRef.brandImage) : DR.deckAssetPath(imageRef.deckAsset));
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
        if (el.opacity != null) box.style.opacity = String(el.opacity);
        if (el.rotation) box.style.transform = 'rotate(' + el.rotation + 'deg)';
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
   *
   * Nodes living inside deck-editor.js chrome (e.g. an open "Change layout"
   * variant popover, whose ~16 thumbnails each render real schema content via
   * renderSchemaElements, including real .schema-text spans) are skipped: they
   * are not part of the actual slide content this pass is meant to fit, and
   * needlessly shrink-fitting ~150-200 extra thumbnail nodes on every re-run
   * (e.g. goTo navigation back to a slide with the popover left open) just
   * wastes cycles and slightly shrinks thumbnail text for no reason.
   */
  function fitAllSchemaText(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    var nodes = rootEl.querySelectorAll('.schema-text');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest('.deck-editor-chrome')) continue;
      fitSchemaText(nodes[i]);
    }
  }

  function exportSchemaElements(pptxSlide, elements) {
    sortByZIndex(elements).forEach(function (item) {
      var el = item.el;
      if (el.type === 'text') {
        var textOpts = {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fontSize: el.fontSize || 14,
          color: el.color || 'FFFFFF',
          bold: isBold(el),
          fontFace: el.fontFamily || 'DM Sans',
          align: el.align || 'left',
          fit: 'shrink',
        };
        if (el.opacity != null) textOpts.transparency = Math.round((1 - el.opacity) * 100);
        if (el.rotation) textOpts.rotate = el.rotation;
        pptxSlide.addText(el.text || '', textOpts);
      } else if (el.type === 'image') {
        var imageRef = resolveImageRef(el);
        if (!imageRef.uploadedImageUrl && !imageRef.brandImage && !imageRef.deckAsset) {
          // Export-side counterpart of the render-path placeholder above:
          // degrade gracefully (a placeholder shape + label) instead of
          // throwing and aborting the rest of this slide's export (and, before
          // downloadPptx's own per-slide isolation fix, the entire .pptx file).
          // PptxGenJS has no native "broken image" concept, so a shape + text
          // pair stands in for the missing image.
          pptxSlide.addShape('rect', {
            x: el.x, y: el.y, w: el.w, h: el.h,
            fill: { color: '3a3550' },
            line: { color: 'FFFFFF', width: 0.75, dashType: 'dash' },
          });
          pptxSlide.addText('Image unavailable', {
            x: el.x, y: el.y, w: el.w, h: el.h,
            fontSize: 10, color: 'CCCCCC', align: 'center', valign: 'middle',
          });
          return;
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
        var fullPath = imageRef.uploadedImageUrl
          ? imageRef.uploadedImageUrl
          : (imageRef.brandImage ? DR.brandImagePath(imageRef.brandImage) : DR.deckAssetPath(imageRef.deckAsset));
        // focusX/focusY (crop/focus-point): approximate box-relative crop for
        // PPTX export, using ONLY the element's own placement box (el.w/el.h)
        // — no dependency on the source image's natural pixel dimensions.
        //
        // This corrects an earlier claim in this comment (that pptxgenjs's
        // sizing:{type:'crop'} needs the source's natural pixel/inch size,
        // unavailable synchronously at export time). Reading the actual
        // implementation (node_modules/pptxgenjs/dist/pptxgen.cjs.js,
        // ImageSizingXml.crop, ~line 5077, and its call site ~line 5565)
        // shows the "imgSize" fed into the crop-percentage math is simply
        // `{w: cx, h: cy}` — the `addImage` call's own `options.w`/`options.h`
        // (set at ~line 5148), NOT the image's natural dimensions. There is a
        // `getSizeFromImage`/`sizeOf` helper (~line 5019) that reads real
        // image dimensions, but it is commented out/unused and not wired
        // into this crop path. So the crop math is entirely box-relative —
        // we control both sides of the ratio (options.w/h and sizing.w/h/x/y
        // are all in the same inches-based coordinate space as el.w/el.h) and
        // never need the real source pixel size.
        //
        // Technique: addImage's own options.w/h (the "virtual frame" that
        // seeds the crop-percentage denominator) is set LARGER than the
        // element's real box by a fixed overscan factor, simulating a zoom.
        // sizing:{type:'crop'} then asks pptxgenjs to crop that virtual frame
        // down to a window of el.w x el.h — which also becomes the actual
        // final rendered size (pptxgenjs overwrites the image's a:ext with
        // sizing.w/h; a:off keeps the addImage x/y untouched), positioned
        // within the virtual frame per focusX/focusY. This mirrors CSS
        // `object-fit: cover` + `object-position` in the render path, using a
        // fixed overscan instead of the real image aspect ratio (which
        // genuinely isn't available synchronously) — so it is an
        // approximation: a source image whose native aspect differs a lot
        // from the box may pan less "into" the image than the HTML preview
        // shows, but it does not distort or mis-position the crop, and it is
        // no worse than the plain box-fill stretch this code fell back to
        // before this fix.
        var hasExportFocus = el.focusX != null || el.focusY != null;
        if (hasExportFocus) {
          var exportFocusX = el.focusX != null ? el.focusX : 0.5;
          var exportFocusY = el.focusY != null ? el.focusY : 0.5;
          var virtualW = el.w * FOCUS_CROP_OVERSCAN;
          var virtualH = el.h * FOCUS_CROP_OVERSCAN;
          // Rounded to avoid float noise (e.g. 0.7999999999999998) in the
          // exported offset — inch-level precision here is already far
          // finer than this approximation's real accuracy.
          var cropOffsetX = Math.round(exportFocusX * (virtualW - el.w) * 1e6) / 1e6;
          var cropOffsetY = Math.round(exportFocusY * (virtualH - el.h) * 1e6) / 1e6;
          pptxSlide.addImage({
            path: fullPath,
            x: el.x, y: el.y, w: virtualW, h: virtualH,
            sizing: { type: 'crop', w: el.w, h: el.h, x: cropOffsetX, y: cropOffsetY },
          });
        } else {
          pptxSlide.addImage({ path: fullPath, x: el.x, y: el.y, w: el.w, h: el.h });
        }
      } else if (el.type === 'shape') {
        var shapeFill = { color: el.fill || '4a4560' };
        if (el.opacity != null) shapeFill.transparency = Math.round((1 - el.opacity) * 100);
        var shapeOpts = {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fill: shapeFill,
          rectRadius: el.shape === 'roundRect' ? (el.rectRadius || 0.06) : undefined,
        };
        if (el.rotation) shapeOpts.rotate = el.rotation;
        pptxSlide.addShape(el.shape, shapeOpts);
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
