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
    (elements || []).forEach(function (el) {
      if (el.type === 'text') {
        var span = document.createElement('div');
        span.className = 'schema-text';
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
        });
      } else if (el.type === 'image') {
        if (!el.brandImage && !el.deckAsset) {
          throw new Error('DeckSchemaRenderer: image element must set brandImage or deckAsset');
        }
        var fullPath = el.brandImage ? DR.brandImagePath(el.brandImage) : DR.deckAssetPath(el.deckAsset);
        var path = fullPath.replace(/^https?:\/\/[^/]+/, ''); // export runs same-origin; strip any injected _BRAND_ORIGIN
        pptxSlide.addImage({ path: path, x: el.x, y: el.y, w: el.w, h: el.h });
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
  };
})();
