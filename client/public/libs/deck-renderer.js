//
// Shared deck renderer + PPTX exporter for LLM-generated presentations.
// Loaded via <script src="/libs/deck-renderer.js"> by the presentation-
// creator skill's generated artifact. The artifact assigns a slide-spec
// JSON to window.DECK; this file turns that into both the visible deck
// (renderDeck) and the native PPTX export (downloadPptx, added in Task 6).
//
// Design: each layout owns a geometry table (inches, against a fixed
// 10 x 5.625 canvas) that exportPptx() consumes directly as PptxGenJS's
// native inch units — no manual EMU math, no content duplicated between
// render() and exportPptx(). render() itself uses hand-tuned responsive
// CSS (flexbox/grid/clamp) rather than reading the geometry table, so the
// two are visually matched by convention, not by shared arithmetic;
// inchesToPercent() below exists for any layout that wants to derive CSS
// percentages straight from geometry.
(function () {
  var SW = 10;
  var SH = 5.625;
  var registry = {};
  // Slide-navigation state for the currently-rendered deck (reset each renderDeck() call).
  var currentSlides = [];
  var currentIndex = 0;
  var keyListenerAttached = false;

  function registerLayout(name, def) {
    registry[name] = def;
  }

  function getLayout(name) {
    var layout = registry[name];
    if (!layout) {
      throw new Error('DeckRenderer: no layout registered named "' + name + '"');
    }
    return layout;
  }

  // Brand assets that only exist as PNG (no .svg counterpart) — see the
  // "Available Files" table in agents/presentation-creator.skill.md, which
  // documents these same keys as PNG. Every other key is assumed to be an
  // SVG, since that's the common case (agent logos + their box variants).
  var PNG_ONLY_BRAND_IMAGES = {
    'ai-agents-suite-dark': true,
    'ai-agents-suite-light': true,
    'dap-dark': true,
    'dap-light': true,
    'mirror-dark': true,
    'product-analytics-dark': true,
    'product-suite-dark': true,
    'product-suite-full-dark': true,
    'product-suite-light': true,
    'screensense-dark': true,
    'screensense-suite-dark': true,
  };

  function brandImagePath(key) {
    var ext = PNG_ONLY_BRAND_IMAGES[key] ? 'png' : 'svg';
    // The live preview renders inside a Sandpack iframe on a different origin
    // than the app, so a bare relative path 404s there. patchHtmlForSandpack()
    // (client/src/hooks/Artifacts/useArtifactProps.ts) injects
    // window._BRAND_ORIGIN with the app's real origin for exactly this case;
    // prepend it when present. Falls back to a bare relative path for
    // standalone/local contexts (e.g. tests, a plain HTML file with no
    // Sandpack wrapper) where no such origin is injected.
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return origin + '/brand/' + key + '.' + ext;
  }

  function deckAssetPath(filename) {
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    return origin + '/deck-assets/' + filename;
  }

  function inchesToPercent(rect) {
    return {
      left: (rect.x / SW) * 100 + '%',
      top: (rect.y / SH) * 100 + '%',
      width: (rect.w / SW) * 100 + '%',
      height: (rect.h / SH) * 100 + '%',
    };
  }

  function injectBaseStyles() {
    if (document.getElementById('deck-renderer-base-styles')) return;
    var style = document.createElement('style');
    style.id = 'deck-renderer-base-styles';
    style.textContent =
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html,body{width:100%;height:100%;overflow:hidden;background:#1a1728;' +
      'display:flex;align-items:center;justify-content:center;' +
      "font-family:'DM Sans','IBM Plex Sans',-apple-system,sans-serif}" +
      // Locks the deck to its designed 16:9 (SW=10 / SH=5.625) aspect ratio regardless of
      // the artifacts panel's actual resizable width/height -- min() picks whichever of
      // width-constrained-by-viewport-width or height-constrained-by-viewport-height is
      // smaller, so the deck always fits inside the container without stretching/distorting,
      // letterboxing (via the flex-centered html/body above) instead.
      '.deck{width:min(100vw,177.78vh);height:min(100vh,56.25vw);aspect-ratio:16/9;position:relative;overflow:hidden;flex-shrink:0}' +
      '.slide{position:absolute;inset:0;opacity:0;background:#25223B;' +
      'content-visibility:auto;contain:layout style paint}' +
      '.slide.active{opacity:1;content-visibility:visible}';
    document.head.appendChild(style);
  }

  function goTo(index) {
    if (!currentSlides.length) return;
    if (index < 0 || index >= currentSlides.length) return;
    var prevEl = currentSlides[currentIndex];
    if (prevEl) prevEl.classList.remove('active');
    currentIndex = index;
    var nextEl = currentSlides[currentIndex];
    if (nextEl) nextEl.classList.add('active');
  }

  function next() {
    goTo(currentIndex + 1);
  }

  function prev() {
    goTo(currentIndex - 1);
  }

  function renderDeck(deckSpec, mountEl) {
    injectBaseStyles();
    var deckEl = document.createElement('div');
    deckEl.className = 'deck';
    currentSlides = [];
    currentIndex = 0;
    (deckSpec.slides || []).forEach(function (spec, i) {
      var layout = getLayout(spec.layout); // throws if unregistered — fail loudly, not silently
      var slideEl = document.createElement('section');
      slideEl.className = 'slide ' + spec.layout + (i === 0 ? ' active' : '');
      layout.render(spec, slideEl);
      deckEl.appendChild(slideEl);
      currentSlides.push(slideEl);
    });
    mountEl.innerHTML = '';
    mountEl.appendChild(deckEl);

    if (!keyListenerAttached) {
      keyListenerAttached = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
      });
    }
  }

  registerLayout('title', {
    geometry: {
      headline: { x: 0.55, y: 3.2, w: 6.5, h: 1.6 },
      eyebrow: { x: 0.55, y: 2.85, w: 6.5, h: 0.3 },
      subtitle: { x: 0.55, y: 4.6, w: 5.5, h: 0.6 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText =
        'display:flex;flex-direction:column;justify-content:flex-end;' +
        'padding:2.5rem 3rem 3rem;' +
        'background:linear-gradient(150deg,#25223B 0%,#3f3a56 60%,#48425f 100%);';
      var eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.style.cssText = "font-size:.65rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#FF6B18;margin-bottom:.85rem;font-family:'DM Sans',sans-serif;";
      eyebrow.textContent = spec.eyebrow || '';
      var h1 = document.createElement('h1');
      h1.style.cssText = "font-size:clamp(2.2rem,4.5vw,3.8rem);font-weight:500;color:#fff;line-height:1.12;max-width:14ch;margin-bottom:1rem;letter-spacing:-.02em;font-family:'DM Sans',sans-serif;";
      h1.textContent = spec.title || '';
      var subtitle = document.createElement('p');
      subtitle.style.cssText = "font-size:clamp(.9rem,1.5vw,1.1rem);font-weight:300;color:rgba(255,255,255,.5);max-width:40ch;line-height:1.65;font-family:'DM Sans',sans-serif;";
      subtitle.textContent = spec.subtitle || '';
      slideEl.appendChild(eyebrow);
      slideEl.appendChild(h1);
      slideEl.appendChild(subtitle);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.title.geometry;
      if (spec.eyebrow) {
        pptxSlide.addText(spec.eyebrow, {
          x: g.eyebrow.x, y: g.eyebrow.y, w: g.eyebrow.w, h: g.eyebrow.h,
          fontSize: 10, color: 'FF6B18', fontFace: 'DM Sans', bold: true,
        });
      }
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 36, color: 'FFFFFF', fontFace: 'DM Sans', bold: false,
      });
      if (spec.subtitle) {
        pptxSlide.addText(spec.subtitle, {
          x: g.subtitle.x, y: g.subtitle.y, w: g.subtitle.w, h: g.subtitle.h,
          fontSize: 13, color: 'CCCCCC', fontFace: 'DM Sans',
        });
      }
    },
  });

  registerLayout('content', {
    geometry: {
      headline: { x: 0.55, y: 0.5, w: 8.9, h: 0.9 },
      bullets: { x: 0.55, y: 1.7, w: 8.9, h: 3.4 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.3rem,2.4vw,2rem);font-weight:500;color:#FF6B18;line-height:1.2;margin-bottom:1.75rem;max-width:30ch;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;display:flex;flex-direction:column;gap:.8rem;';
      // Structural cap: only the first 3 bullets are ever rendered, regardless
      // of how many the LLM emitted — this makes the "max 3 bullets" content
      // rule impossible to violate rather than merely documented.
      (spec.bullets || []).slice(0, 3).forEach(function (text) {
        var li = document.createElement('li');
        li.style.cssText = "display:flex;align-items:flex-start;gap:1rem;font-size:clamp(.85rem,1.5vw,1.05rem);font-weight:300;color:rgba(255,255,255,.82);line-height:1.6;font-family:'DM Sans',sans-serif;";
        var dot = document.createElement('span');
        dot.style.cssText = 'width:5px;height:5px;border-radius:50%;background:#FF6B18;flex-shrink:0;margin-top:.5rem;';
        li.appendChild(dot);
        li.appendChild(document.createTextNode(text));
        ul.appendChild(li);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(ul);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.content.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 22, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var bullets = (spec.bullets || []).slice(0, 3); // same structural cap as render()
      var rowH = g.bullets.h / 3;
      bullets.forEach(function (text, i) {
        pptxSlide.addText(text, {
          x: g.bullets.x, y: g.bullets.y + i * rowH, w: g.bullets.w, h: rowH,
          fontSize: 15, color: 'FFFFFF', fontFace: 'DM Sans',
        });
      });
    },
  });

  registerLayout('stat', {
    geometry: { row: { x: 0.5, y: 2.0, w: 9, h: 2.0 } },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#3f3a56;text-align:center;';
      var grid = document.createElement('div');
      grid.className = 'kpi-grid';
      grid.style.cssText = 'display:flex;gap:clamp(2rem,6vw,6rem);align-items:flex-end;flex-wrap:wrap;justify-content:center;';
      (spec.stats || []).slice(0, 3).forEach(function (stat) { // structural cap: max 3
        var kpi = document.createElement('div');
        kpi.className = 'kpi';
        kpi.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.4rem;';
        var big = document.createElement('span');
        big.style.cssText = "font-size:clamp(3rem,8vw,5.5rem);font-weight:700;color:#FF6B18;font-family:'DM Sans',sans-serif;";
        big.textContent = stat.value;
        var label = document.createElement('span');
        label.style.cssText = "font-size:clamp(.72rem,1.2vw,.9rem);color:rgba(255,255,255,.45);max-width:13ch;text-align:center;font-family:'DM Sans',sans-serif;";
        label.textContent = stat.label;
        kpi.appendChild(big);
        kpi.appendChild(label);
        grid.appendChild(kpi);
      });
      slideEl.appendChild(grid);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.stat.geometry;
      var stats = (spec.stats || []).slice(0, 3);
      var colW = g.row.w / Math.max(stats.length, 1);
      stats.forEach(function (stat, i) {
        pptxSlide.addText(stat.value, {
          x: g.row.x + i * colW, y: g.row.y, w: colW, h: 1.2,
          fontSize: 44, bold: true, color: 'FF6B18', fontFace: 'DM Sans', align: 'center',
        });
        pptxSlide.addText(stat.label, {
          x: g.row.x + i * colW, y: g.row.y + 1.2, w: colW, h: 0.7,
          fontSize: 11, color: 'CCCCCC', fontFace: 'DM Sans', align: 'center',
        });
      });
    },
  });

  registerLayout('two_col', {
    geometry: {
      headline: { x: 0.55, y: 0.5, w: 8.9, h: 0.8 },
      left: { x: 0.55, y: 1.5, w: 4.8, h: 3.6 },
      right: { x: 5.7, y: 1.3, w: 3.9, h: 3.7 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.3rem,2.4vw,2rem);font-weight:500;color:#FF6B18;margin-bottom:1.5rem;max-width:34ch;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var cols = document.createElement('div');
      cols.style.cssText = 'display:flex;gap:3vw;align-items:stretch;';
      var left = document.createElement('ul');
      left.className = 'col-left';
      left.style.cssText = 'list-style:none;flex:1.1;display:flex;flex-direction:column;gap:.75rem;';
      (spec.bullets || []).slice(0, 4).forEach(function (text) {
        var li = document.createElement('li');
        li.style.cssText = "font-size:clamp(.82rem,1.45vw,1.02rem);font-weight:300;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;";
        li.textContent = text;
        left.appendChild(li);
      });
      var right = document.createElement('div');
      right.className = 'col-right';
      right.style.cssText = 'flex:.9;background:#4a4560;border-radius:10px;';
      if (spec.rightBrandImage) {
        var img = document.createElement('img');
        img.src = brandImagePath(spec.rightBrandImage);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        right.appendChild(img);
      }
      cols.appendChild(left);
      cols.appendChild(right);
      slideEl.appendChild(h2);
      slideEl.appendChild(cols);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.two_col.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 22, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var bullets = (spec.bullets || []).slice(0, 4);
      var rowH = g.left.h / Math.max(bullets.length, 1);
      bullets.forEach(function (text, i) {
        pptxSlide.addText(text, {
          x: g.left.x, y: g.left.y + i * rowH, w: g.left.w, h: rowH,
          fontSize: 14, color: 'FFFFFF', fontFace: 'DM Sans',
        });
      });
      if (spec.rightBrandImage) {
        pptxSlide.addImage({
          path: brandImagePath(spec.rightBrandImage),
          x: g.right.x, y: g.right.y, w: g.right.w, h: g.right.h,
        });
      }
    },
  });

  registerLayout('comparison', {
    geometry: {
      headline: { x: 0.55, y: 0.5, w: 8.9, h: 0.7 },
      table: { x: 0.55, y: 1.4, w: 8.9, h: 3.6 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 3.5rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.25rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;';
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      // Structural cap: max 4 headers to fit within 8.9in width constraint
      (spec.headers || []).slice(0, 4).forEach(function (headerText) {
        var th = document.createElement('th');
        th.style.cssText = "padding:.5rem .9rem;font-size:.85rem;color:rgba(255,255,255,.6);text-align:left;font-family:'DM Sans',sans-serif;";
        th.textContent = headerText;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      var tbody = document.createElement('tbody');
      // Structural cap: max 5 rows to fit within 3.6in height constraint
      (spec.rows || []).slice(0, 5).forEach(function (row) {
        var tr = document.createElement('tr');
        row.slice(0, 4).forEach(function (cell) {
          var td = document.createElement('td');
          td.style.cssText = "padding:.45rem .9rem;font-size:.88rem;color:rgba(255,255,255,.78);font-family:'DM Sans',sans-serif;";
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      slideEl.appendChild(h2);
      slideEl.appendChild(table);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.comparison.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 18, color: 'FF6B18', fontFace: 'DM Sans',
      });
      // Structural cap: match render() limits (max 4 headers, max 5 rows with 4 cols each)
      var cappedHeaders = (spec.headers || []).slice(0, 4);
      var cappedRows = (spec.rows || []).slice(0, 5).map(function (row) {
        return row.slice(0, 4);
      });
      var tableRows = [cappedHeaders].concat(cappedRows);
      pptxSlide.addTable(tableRows, {
        x: g.table.x, y: g.table.y, w: g.table.w, h: g.table.h,
        fontSize: 11, fontFace: 'DM Sans', color: 'FFFFFF',
        border: { type: 'solid', color: '4a4560', pt: 0.5 },
      });
    },
  });

  registerLayout('agenda', {
    geometry: {
      label: { x: 0.55, y: 0.45, w: 3, h: 0.3 },
      items: { x: 0.55, y: 1.05, w: 9.2, h: 4.3 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var label = document.createElement('p');
      label.className = 'label';
      label.style.cssText = "font-size:.62rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#FF6B18;margin-bottom:1.75rem;font-family:'DM Sans',sans-serif;";
      label.textContent = spec.label || 'AGENDA';
      var ol = document.createElement('ol');
      ol.style.cssText = 'list-style:none;display:flex;flex-direction:column;';
      // Structural cap: max 12 items (master-deck-verified range for session+time pairs)
      (spec.items || []).slice(0, 12).forEach(function (text, i) {
        var li = document.createElement('li');
        li.style.cssText = "display:flex;align-items:center;gap:1.25rem;padding:.65rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:clamp(.9rem,1.75vw,1.25rem);font-weight:400;color:rgba(255,255,255,.82);font-family:'DM Sans',sans-serif;";
        var num = document.createElement('span');
        num.className = 'agenda-num';
        num.style.cssText = "font-size:.65rem;font-weight:700;color:#FF6B18;background:rgba(255,107,24,.1);border:1px solid rgba(255,107,24,.25);width:1.9rem;height:1.9rem;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;";
        num.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
        var txt = document.createElement('span');
        txt.className = 'agenda-text';
        txt.textContent = text;
        li.appendChild(num);
        li.appendChild(txt);
        ol.appendChild(li);
      });
      slideEl.appendChild(label);
      slideEl.appendChild(ol);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.agenda.geometry;
      pptxSlide.addText(spec.label || 'AGENDA', {
        x: g.label.x, y: g.label.y, w: g.label.w, h: g.label.h,
        fontSize: 7, color: 'FF6B18', fontFace: 'DM Sans', bold: true,
      });
      var items = (spec.items || []).slice(0, 12); // same structural cap as render()
      var itemH = items.length ? Math.min(0.85, g.items.h / items.length) : 0.85;
      items.forEach(function (text, i) {
        var iy = g.items.y + i * itemH;
        pptxSlide.addShape('ellipse', {
          x: g.items.x, y: iy, w: 0.36, h: 0.36,
          fill: { color: '35324A' }, line: { color: 'FF6B18', width: 1 },
        });
        pptxSlide.addText((i + 1 < 10 ? '0' : '') + (i + 1), {
          x: g.items.x, y: iy, w: 0.36, h: 0.36,
          fontSize: 7, color: 'FF6B18', fontFace: 'DM Sans', bold: true, align: 'center', valign: 'middle',
        });
        pptxSlide.addText(text, {
          x: g.items.x + 0.53, y: iy, w: g.items.w - 0.53, h: itemH - 0.1,
          fontSize: 15, color: 'FFFFFF', fontFace: 'DM Sans', valign: 'middle',
        });
        if (i < items.length - 1) {
          pptxSlide.addShape('rect', {
            x: g.items.x, y: iy + itemH - 0.06, w: g.items.w, h: 0.008, fill: { color: '2a2840' },
          });
        }
      });
    },
  });

  registerLayout('section', {
    geometry: {
      secnum: { x: 0.55, y: 2.35, w: 5.4, h: 0.35 },
      title: { x: 0.55, y: 2.75, w: 5.4, h: 1.95 },
      right: { x: 6.2, y: 0, w: 3.8, h: 5.625 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:row;';
      var left = document.createElement('div');
      left.className = 'sec-left';
      left.style.cssText = 'flex:0 0 62%;background:#3f3a56;display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      if (spec.eyebrow) {
        var secNum = document.createElement('p');
        secNum.className = 'sec-num';
        secNum.style.cssText = "font-size:.62rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:.75rem;font-family:'DM Sans',sans-serif;";
        secNum.textContent = spec.eyebrow;
        left.appendChild(secNum);
      }
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.7rem,3.2vw,2.8rem);font-weight:500;color:#fff;line-height:1.15;max-width:18ch;letter-spacing:-.02em;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      left.appendChild(h2);
      var right = document.createElement('div');
      right.className = 'sec-right';
      right.style.cssText = 'flex:1;background:#FF6B18;position:relative;overflow:hidden;';
      slideEl.appendChild(left);
      slideEl.appendChild(right);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.section.geometry;
      pptxSlide.addShape('rect', {
        x: g.right.x, y: g.right.y, w: g.right.w, h: g.right.h, fill: { color: 'FF6B18' },
      });
      if (spec.eyebrow) {
        pptxSlide.addText(spec.eyebrow, {
          x: g.secnum.x, y: g.secnum.y, w: g.secnum.w, h: g.secnum.h,
          fontSize: 7.5, color: 'FFFFFF', fontFace: 'DM Sans', bold: true, transparency: 65,
        });
      }
      pptxSlide.addText(spec.title || '', {
        x: g.title.x, y: g.title.y, w: g.title.w, h: g.title.h,
        fontSize: 26, color: 'FFFFFF', fontFace: 'DM Sans',
      });
    },
  });

  registerLayout('quote', {
    geometry: {
      qmark: { x: 0.4, y: 0.15, w: 2, h: 1.35 },
      quote: { x: 0.5, y: 1.45, w: 9.3, h: 2.55 },
      cite: { x: 0.5, y: 4.2, w: 9.3, h: 0.45 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#35324A;padding:2.5rem 4rem;';
      var qmark = document.createElement('span');
      qmark.className = 'qmark';
      qmark.style.cssText = "font-size:5rem;color:rgba(255,107,24,.15);line-height:.6;font-family:Georgia,serif;margin-bottom:1.5rem;";
      qmark.textContent = '“';
      var bq = document.createElement('blockquote');
      bq.style.cssText = "font-size:clamp(1rem,1.8vw,1.5rem);font-weight:300;font-style:italic;color:#fff;max-width:640px;line-height:1.7;text-align:center;font-family:'DM Sans',sans-serif;";
      bq.textContent = spec.quote || '';
      var cite = document.createElement('cite');
      cite.style.cssText = "display:block;margin-top:1.75rem;font-size:.78rem;font-weight:500;font-style:normal;color:#FF6B18;letter-spacing:.1em;text-transform:uppercase;font-family:'DM Sans',sans-serif;";
      cite.textContent = spec.cite || '';
      slideEl.appendChild(qmark);
      slideEl.appendChild(bq);
      slideEl.appendChild(cite);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.quote.geometry;
      pptxSlide.addText('"', {
        x: g.qmark.x, y: g.qmark.y, w: g.qmark.w, h: g.qmark.h,
        fontSize: 72, color: 'FF6B18', fontFace: 'Georgia', bold: true,
      });
      pptxSlide.addText(spec.quote || '', {
        x: g.quote.x, y: g.quote.y, w: g.quote.w, h: g.quote.h,
        fontSize: 19, color: 'FFFFFF', fontFace: 'DM Sans', italic: true, align: 'center',
      });
      if (spec.cite) {
        pptxSlide.addText('— ' + spec.cite, {
          x: g.cite.x, y: g.cite.y, w: g.cite.w, h: g.cite.h,
          fontSize: 10.5, color: 'FF6B18', fontFace: 'DM Sans', bold: true, align: 'center',
        });
      }
    },
  });

  registerLayout('split', {
    geometry: {
      eyebrow: { x: 0.55, y: 2.35, w: 5.4, h: 0.35 },
      title: { x: 0.55, y: 2.75, w: 5.4, h: 1.95 },
      right: { x: 6.2, y: 0, w: 3.8, h: 5.625 },
      image: { x: 6.5, y: 1.3, w: 3.0, h: 3.0 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:row;';
      var left = document.createElement('div');
      left.className = 'split-left';
      left.style.cssText = 'flex:0 0 62%;background:#3f3a56;display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      if (spec.eyebrow) {
        var eyebrow = document.createElement('p');
        eyebrow.className = 'split-eyebrow';
        eyebrow.style.cssText = "font-size:.62rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:.75rem;font-family:'DM Sans',sans-serif;";
        eyebrow.textContent = spec.eyebrow;
        left.appendChild(eyebrow);
      }
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.7rem,3.2vw,2.8rem);font-weight:500;color:#fff;line-height:1.15;max-width:18ch;letter-spacing:-.02em;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      left.appendChild(h2);
      if (spec.body) {
        var body = document.createElement('p');
        body.style.cssText = "font-size:clamp(.85rem,1.5vw,1.05rem);font-weight:300;color:rgba(255,255,255,.6);margin-top:1rem;max-width:32ch;line-height:1.6;font-family:'DM Sans',sans-serif;";
        body.textContent = spec.body;
        left.appendChild(body);
      }
      var right = document.createElement('div');
      right.className = 'split-right';
      right.style.cssText = 'flex:1;background:' + (spec.rightColor || '#FF6B18') + ';position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;';
      if (spec.rightBrandImage) {
        var img = document.createElement('img');
        img.src = brandImagePath(spec.rightBrandImage);
        img.style.cssText = 'width:70%;height:70%;object-fit:contain;';
        right.appendChild(img);
      }
      slideEl.appendChild(left);
      slideEl.appendChild(right);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.split.geometry;
      pptxSlide.addShape('rect', {
        x: g.right.x, y: g.right.y, w: g.right.w, h: g.right.h,
        fill: { color: (spec.rightColor || 'FF6B18').replace('#', '') },
      });
      if (spec.eyebrow) {
        pptxSlide.addText(spec.eyebrow, {
          x: g.eyebrow.x, y: g.eyebrow.y, w: g.eyebrow.w, h: g.eyebrow.h,
          fontSize: 7.5, color: 'FFFFFF', fontFace: 'DM Sans', bold: true, transparency: 65,
        });
      }
      pptxSlide.addText(spec.title || '', {
        x: g.title.x, y: g.title.y, w: g.title.w, h: g.title.h,
        fontSize: 26, color: 'FFFFFF', fontFace: 'DM Sans',
      });
      if (spec.rightBrandImage) {
        pptxSlide.addImage({
          path: brandImagePath(spec.rightBrandImage),
          x: g.image.x, y: g.image.y, w: g.image.w, h: g.image.h,
        });
      }
    },
  });

  registerLayout('chart', {
    geometry: {
      headline: { x: 0.55, y: 0.4, w: 8.9, h: 0.7 },
      bars: { x: 0.55, y: 1.5, w: 8.9, h: 3.6 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.5rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';

      var bars = (spec.bars || []).slice(0, 6);
      if (spec.type === 'pie') {
        var total = bars.reduce(function (sum, b) { return sum + b.value; }, 0) || 1;
        var colors = ['#FF6B18', '#F9A352', '#4a4560', '#8A8A9C', '#35324A', '#C53F27'];
        var acc = 0;
        var stops = bars.map(function (b, i) {
          var start = (acc / total) * 100;
          acc += b.value;
          var end = (acc / total) * 100;
          return colors[i % colors.length] + ' ' + start + '% ' + end + '%';
        }).join(', ');
        var pie = document.createElement('div');
        pie.className = 'chart-pie';
        pie.style.cssText = 'width:10rem;height:10rem;border-radius:50%;background:conic-gradient(' + stops + ');margin:0 auto;';
        var legend = document.createElement('div');
        legend.className = 'chart-pie-legend';
        legend.style.cssText = 'display:flex;flex-direction:column;gap:.4rem;margin-top:1rem;';
        bars.forEach(function (b, i) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:#fff;';
          row.innerHTML = '<span style="width:.7rem;height:.7rem;border-radius:2px;background:' + colors[i % colors.length] + ';"></span>' + b.label + ' (' + b.value + ')';
          legend.appendChild(row);
        });
        slideEl.appendChild(h2);
        slideEl.appendChild(pie);
        slideEl.appendChild(legend);
        return;
      }

      var rows = document.createElement('div');
      rows.className = 'chart-rows';
      rows.style.cssText = 'display:flex;flex-direction:column;gap:.9rem;';
      // Structural cap: max 6 bars to fit within the fixed 3.6in bars geometry
      var max = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1]));
      bars.forEach(function (bar) {
        var row = document.createElement('div');
        row.className = 'chart-row';
        row.style.cssText = 'display:flex;align-items:center;gap:.9rem;';
        var label = document.createElement('span');
        label.className = 'chart-label';
        label.style.cssText = "flex:0 0 8rem;font-size:.8rem;color:rgba(255,255,255,.7);font-family:'DM Sans',sans-serif;";
        label.textContent = bar.label;
        var track = document.createElement('div');
        track.className = 'bar-track';
        track.style.cssText = 'flex:1;height:.6rem;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;';
        var fill = document.createElement('div');
        fill.className = 'bar-fill';
        var pct = Math.round((bar.value / max) * 100);
        fill.style.cssText = 'height:100%;background:#FF6B18;border-radius:4px;width:' + pct + '%;';
        track.appendChild(fill);
        var value = document.createElement('span');
        value.className = 'chart-value';
        value.style.cssText = "flex:0 0 3rem;font-size:.8rem;color:#FF6B18;font-weight:500;text-align:right;font-family:'DM Sans',sans-serif;";
        value.textContent = String(bar.value);
        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(value);
        rows.appendChild(row);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(rows);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.chart.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var bars = (spec.bars || []).slice(0, 6); // same structural cap as render()

      if (spec.type === 'pie') {
        pptxSlide.addChart(
          'pie',
          [{ name: spec.title || '', labels: bars.map(function (b) { return b.label; }), values: bars.map(function (b) { return b.value; }) }],
          { x: g.bars.x, y: g.bars.y, w: g.bars.w, h: g.bars.h, showLegend: true, legendPos: 'r' },
        );
        return;
      }

      var max = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1]));
      var rowH = g.bars.h / Math.max(bars.length, 1);
      var trackX = g.bars.x + 2.2;
      var trackW = g.bars.w - 2.2 - 0.9;
      bars.forEach(function (bar, i) {
        var ry = g.bars.y + i * rowH;
        pptxSlide.addText(bar.label, {
          x: g.bars.x, y: ry, w: 2.0, h: rowH, fontSize: 11, color: 'CCCCCC', fontFace: 'DM Sans', valign: 'middle',
        });
        pptxSlide.addShape('rect', {
          x: trackX, y: ry + rowH * 0.35, w: trackW, h: rowH * 0.3, fill: { color: '4a4560' },
        });
        pptxSlide.addShape('rect', {
          x: trackX, y: ry + rowH * 0.35, w: trackW * (bar.value / max), h: rowH * 0.3, fill: { color: 'FF6B18' },
        });
        pptxSlide.addText(String(bar.value), {
          x: trackX + trackW + 0.1, y: ry, w: 0.8, h: rowH, fontSize: 11, color: 'FF6B18', bold: true, fontFace: 'DM Sans', valign: 'middle',
        });
      });
    },
  });

  registerLayout('process', {
    geometry: {
      headline: { x: 0.45, y: 0.2, w: 9.2, h: 0.9 },
      steps: { x: 0.45, y: 2.52, w: 9.2, h: 1.9 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4.5rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.75rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var row = document.createElement('div');
      row.className = 'process-row';
      row.style.cssText = 'display:flex;align-items:flex-start;gap:0;justify-content:space-between;';
      // Structural cap: max 5 steps per the 3-5 step process spec
      (spec.steps || []).slice(0, 5).forEach(function (step, i) {
        var stepEl = document.createElement('div');
        stepEl.className = 'process-step';
        stepEl.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;position:relative;text-align:center;';
        var num = document.createElement('span');
        num.className = 'ps-num';
        num.style.cssText = 'width:2.2rem;height:2.2rem;border-radius:50%;flex-shrink:0;background:#FF6B18;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;color:#fff;margin-bottom:.75rem;';
        num.textContent = step.num || ((i + 1 < 10 ? '0' : '') + (i + 1));
        var label = document.createElement('div');
        label.className = 'ps-label';
        label.style.cssText = "font-size:clamp(.72rem,1.2vw,.88rem);font-weight:500;color:#fff;margin-bottom:.3rem;line-height:1.3;font-family:'DM Sans',sans-serif;";
        label.textContent = step.label || '';
        var desc = document.createElement('div');
        desc.className = 'ps-desc';
        desc.style.cssText = "font-size:clamp(.62rem,.95vw,.75rem);font-weight:300;color:rgba(255,255,255,.45);line-height:1.5;max-width:14ch;margin:0 auto;font-family:'DM Sans',sans-serif;";
        desc.textContent = step.desc || '';
        stepEl.appendChild(num);
        stepEl.appendChild(label);
        stepEl.appendChild(desc);
        row.appendChild(stepEl);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(row);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.process.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var steps = (spec.steps || []).slice(0, 5); // same structural cap as render()
      var stepW = g.steps.w / Math.max(steps.length, 1);
      steps.forEach(function (step, i) {
        var sx = g.steps.x + i * stepW;
        var cx = sx + stepW / 2;
        if (i < steps.length - 1) {
          pptxSlide.addShape('rect', {
            x: cx + 0.25, y: g.steps.y + 0.26, w: stepW - 0.5, h: 0.02, fill: { color: 'FF6B18' }, transparency: 55,
          });
        }
        pptxSlide.addShape('ellipse', {
          x: cx - 0.28, y: g.steps.y, w: 0.55, h: 0.55, fill: { color: 'FF6B18' },
        });
        pptxSlide.addText(step.num || ((i + 1 < 10 ? '0' : '') + (i + 1)), {
          x: cx - 0.28, y: g.steps.y, w: 0.55, h: 0.55,
          fontSize: 10, color: 'FFFFFF', fontFace: 'DM Sans', bold: true, align: 'center', valign: 'middle',
        });
        pptxSlide.addText(step.label || '', {
          x: sx, y: g.steps.y + 0.68, w: stepW, h: 0.45,
          fontSize: 12, color: 'FFFFFF', fontFace: 'DM Sans', align: 'center',
        });
        pptxSlide.addText(step.desc || '', {
          x: sx + 0.05, y: g.steps.y + 1.2, w: stepW - 0.1, h: 0.7,
          fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans', align: 'center',
        });
      });
    },
  });

  registerLayout('icon_grid', {
    geometry: {
      headline: { x: 0.45, y: 0.2, w: 9.2, h: 0.9 },
      grid: { x: 0.45, y: 1.25, w: 9.2, h: 3.85 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 4rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.5rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var cols = spec.cols === 2 ? 2 : 3; // structural cap: only 2 or 3 columns are supported
      var grid = document.createElement('div');
      grid.className = 'ig-grid' + (cols === 2 ? ' cols-2' : '');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:1rem;';
      // Structural cap: max 6 cards (2x2 to 3x2 grid)
      (spec.cards || []).slice(0, 6).forEach(function (card) {
        var cardEl = document.createElement('div');
        cardEl.className = 'ig-card';
        cardEl.style.cssText = 'background:#4a4560;border-radius:8px;padding:1.1rem 1.25rem;display:flex;align-items:flex-start;gap:.9rem;border:1px solid rgba(255,255,255,.05);';
        var icon = document.createElement('div');
        icon.className = 'ig-icon';
        icon.style.cssText = 'width:2rem;height:2rem;flex-shrink:0;background:rgba(255,107,24,.12);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#FF6B18;';
        var iconDef = (typeof window.DeckIcons !== 'undefined') ? window.DeckIcons.getIcon(card.icon) : null;
        if (iconDef) {
          icon.innerHTML = '<svg width="18" height="18" viewBox="' + iconDef.viewBox + '">' + iconDef.svg + '</svg>';
        }
        var text = document.createElement('div');
        text.className = 'ig-text';
        var title = document.createElement('div');
        title.className = 'ig-title';
        title.style.cssText = "font-size:clamp(.78rem,1.2vw,.9rem);font-weight:500;color:#fff;margin-bottom:.2rem;font-family:'DM Sans',sans-serif;";
        title.textContent = card.title || '';
        var desc = document.createElement('div');
        desc.className = 'ig-desc';
        desc.style.cssText = "font-size:clamp(.65rem,1vw,.75rem);font-weight:300;color:rgba(255,255,255,.45);line-height:1.5;font-family:'DM Sans',sans-serif;";
        desc.textContent = card.desc || '';
        text.appendChild(title);
        text.appendChild(desc);
        cardEl.appendChild(icon);
        cardEl.appendChild(text);
        grid.appendChild(cardEl);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(grid);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.icon_grid.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var cards = (spec.cards || []).slice(0, 6); // same structural cap as render()
      var cols = spec.cols === 2 ? 2 : 3; // same structural cap as render()
      var rows = Math.ceil(cards.length / cols);
      var cardW = (g.grid.w - (cols - 1) * 0.18) / cols;
      var cardH = (g.grid.h - (rows - 1) * 0.18) / Math.max(rows, 1);
      cards.forEach(function (card, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var cx = g.grid.x + col * (cardW + 0.18);
        var cy = g.grid.y + row * (cardH + 0.18);
        pptxSlide.addShape('roundRect', { x: cx, y: cy, w: cardW, h: cardH, fill: { color: '35324A' }, rectRadius: 0.06 });
        pptxSlide.addShape('rect', { x: cx + 0.15, y: cy + cardH * 0.25, w: 0.06, h: 0.06, fill: { color: 'FF6B18' } });
        if (card.icon && window.DeckIcons && window.DeckIcons.getIcon(card.icon)) {
          pptxSlide.addShape('roundRect', {
            x: cx + 0.15, y: cy + 0.15, w: 0.32, h: 0.32, fill: { color: 'FF6B18' }, transparency: 88, rectRadius: 0.05,
          });
        }
        pptxSlide.addText(card.title || '', {
          x: cx + 0.28, y: cy + 0.15, w: cardW - 0.38, h: 0.38, fontSize: 11, color: 'FFFFFF', fontFace: 'DM Sans',
        });
        pptxSlide.addText(card.desc || '', {
          x: cx + 0.15, y: cy + 0.55, w: cardW - 0.25, h: cardH - 0.7, fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans',
        });
      });
    },
  });

  registerLayout('timeline', {
    geometry: {
      headline: { x: 0.45, y: 0.2, w: 9.2, h: 0.9 },
      track: { x: 0.95, y: 1.2, w: 0.02, h: SH - 1.4 },
      items: { x: 1.25, y: 1.25, w: 8.2, h: SH - 1.55 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 4.5rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.2rem,2.2vw,1.8rem);font-weight:500;color:#FF6B18;margin-bottom:1.25rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      var track = document.createElement('div');
      track.className = 'tl-track';
      track.style.cssText = 'position:relative;padding-left:2rem;display:flex;flex-direction:column;gap:.75rem;';
      // Structural cap: max 6 milestones to fit within the fixed vertical geometry
      (spec.milestones || []).slice(0, 6).forEach(function (m) {
        var item = document.createElement('div');
        item.className = 'tl-item';
        item.style.cssText = 'display:flex;align-items:flex-start;gap:1rem;position:relative;';
        var dot = document.createElement('span');
        dot.className = 'tl-dot';
        dot.style.cssText = 'width:.65rem;height:.65rem;border-radius:50%;background:#FF6B18;flex-shrink:0;';
        var date = document.createElement('span');
        date.className = 'tl-date';
        date.style.cssText = "font-size:.65rem;font-weight:500;color:#FF6B18;letter-spacing:.08em;text-transform:uppercase;min-width:6rem;flex-shrink:0;font-family:'DM Sans',sans-serif;";
        date.textContent = m.date || '';
        var content = document.createElement('div');
        content.className = 'tl-content';
        var title = document.createElement('div');
        title.className = 'tl-title';
        title.style.cssText = "font-size:clamp(.78rem,1.2vw,.9rem);font-weight:500;color:#fff;margin-bottom:.15rem;font-family:'DM Sans',sans-serif;";
        title.textContent = m.title || '';
        var body = document.createElement('div');
        body.className = 'tl-body';
        body.style.cssText = "font-size:clamp(.65rem,1vw,.75rem);font-weight:300;color:rgba(255,255,255,.45);line-height:1.5;font-family:'DM Sans',sans-serif;";
        body.textContent = m.body || '';
        content.appendChild(title);
        content.appendChild(body);
        item.appendChild(dot);
        item.appendChild(date);
        item.appendChild(content);
        track.appendChild(item);
      });
      slideEl.appendChild(h2);
      slideEl.appendChild(track);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.timeline.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
      });
      var milestones = (spec.milestones || []).slice(0, 6); // same structural cap as render()
      pptxSlide.addShape('rect', {
        x: g.track.x, y: g.track.y, w: g.track.w, h: g.track.h, fill: { color: 'FF6B18' }, transparency: 55,
      });
      var mSpacing = g.items.h / Math.max(milestones.length, 1);
      milestones.forEach(function (m, i) {
        var my = g.items.y + i * mSpacing;
        pptxSlide.addShape('ellipse', { x: 0.78, y: my - 0.01, w: 0.18, h: 0.18, fill: { color: 'FF6B18' } });
        pptxSlide.addText(m.date || '', {
          x: g.items.x, y: my - 0.05, w: 2.2, h: 0.28, fontSize: 8, color: 'FF6B18', fontFace: 'DM Sans', bold: true,
        });
        pptxSlide.addText(m.title || '', {
          x: 3.6, y: my - 0.05, w: 6.2, h: 0.28, fontSize: 12, color: 'FFFFFF', fontFace: 'DM Sans',
        });
        if (m.body) {
          pptxSlide.addText(m.body, {
            x: 3.6, y: my + 0.26, w: 6.2, h: 0.28, fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans',
          });
        }
      });
    },
  });

  registerLayout('closing', {
    geometry: {
      title: { x: 0.5, y: 1.2, w: 9.3, h: 2.1 },
      bar: { x: 4.66, y: 3.55, w: 0.42, h: 0.05 },
      body: { x: 0.5, y: 3.75, w: 9.3, h: 0.6 },
      cta: { x: 3.88, y: 4.55, w: 2.55, h: 0.62 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(2rem,4vw,3.6rem);font-weight:500;color:#fff;line-height:1.1;margin-bottom:.8rem;letter-spacing:-.02em;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || 'Thank you';
      var bar = document.createElement('div');
      bar.className = 'closing-bar';
      bar.style.cssText = 'width:36px;height:3px;background:#FF6B18;border-radius:2px;margin:0 auto 1rem;';
      slideEl.appendChild(h2);
      slideEl.appendChild(bar);
      if (spec.body) {
        var body = document.createElement('p');
        body.style.cssText = "font-size:1rem;font-weight:300;color:rgba(255,255,255,.45);font-family:'DM Sans',sans-serif;";
        body.textContent = spec.body;
        slideEl.appendChild(body);
      }
      if (spec.cta) {
        var cta = document.createElement('span');
        cta.className = 'cta-btn';
        cta.style.cssText = "margin-top:1.75rem;padding:.65rem 2rem;background:#FF6B18;color:#fff;border-radius:6px;font-size:.88rem;font-weight:500;display:inline-block;letter-spacing:.02em;font-family:'DM Sans',sans-serif;";
        cta.textContent = spec.cta;
        slideEl.appendChild(cta);
      }
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.closing.geometry;
      pptxSlide.addText(spec.title || 'Thank you', {
        x: g.title.x, y: g.title.y, w: g.title.w, h: g.title.h,
        fontSize: 40, color: 'FFFFFF', fontFace: 'DM Sans', align: 'center',
      });
      pptxSlide.addShape('rect', {
        x: g.bar.x, y: g.bar.y, w: g.bar.w, h: g.bar.h, fill: { color: 'FF6B18' },
      });
      if (spec.body) {
        pptxSlide.addText(spec.body, {
          x: g.body.x, y: g.body.y, w: g.body.w, h: g.body.h,
          fontSize: 13, color: 'CCCCCC', fontFace: 'DM Sans', align: 'center',
        });
      }
      if (spec.cta) {
        pptxSlide.addShape('roundRect', {
          x: g.cta.x, y: g.cta.y, w: g.cta.w, h: g.cta.h, rectRadius: 0.07, fill: { color: 'FF6B18' },
        });
        pptxSlide.addText(spec.cta, {
          x: g.cta.x, y: g.cta.y, w: g.cta.w, h: g.cta.h,
          fontSize: 12, color: 'FFFFFF', fontFace: 'DM Sans', bold: true, align: 'center', valign: 'middle',
        });
      }
    },
  });

  // Geometry read from brand/Copy of Master Deck 2026.pptx, slide 39
  // (ppt/slides/slide39.xml <a:off>/<a:ext> EMU values / 914400):
  // - "THE CHALLENGE" label x=0.361 y=1.722 w=1.020 h=0.135; body x=0.239 y=2.030 w=3.030 h=1.076
  // - "THE SOLUTION" label x=4.373 y=1.734 w=0.908 h=0.135; body x=4.166 y=2.083 w=2.975 h=0.988
  // - "KEY RESULTS WITH WHATFIX" label x=0.396 y=3.485 w=2.108 h=0.337; body x=0.274 y=3.824 w=3.939 h=0.927
  // - CTA block ("READY TO LEARN MORE?" + contact) background x=5.281 y=3.422 w=1.860 h=1.761
  // - metadata panel (Industry/Region/Whatfix Solutions) background x=0.477 y=1.625 w=2.542 h=4.059,
  //   with Industry x=0.644 y=1.773 w=2.232 h=0.501, Region x=0.644 y=2.212 w=2.232 h=0.501,
  //   Whatfix Solutions x=0.605 y=3.006 w=1.986 h=1.215
  registerLayout('case_study', {
    geometry: {
      challenge: { label: { x: 0.36, y: 1.72, w: 3.0, h: 0.2 }, body: { x: 0.24, y: 2.03, w: 3.03, h: 1.08 } },
      solution: { label: { x: 4.37, y: 1.73, w: 3.0, h: 0.2 }, body: { x: 4.17, y: 2.08, w: 2.98, h: 0.99 } },
      results: { label: { x: 0.4, y: 3.49, w: 3.9, h: 0.2 }, body: { x: 0.27, y: 3.82, w: 3.94, h: 0.93 } },
      cta: { x: 5.28, y: 3.9, w: 1.86, h: 0.62 },
      metadata: {
        industry: { x: 0.64, y: 1.77, w: 2.23, h: 0.5 },
        region: { x: 0.64, y: 2.21, w: 2.23, h: 0.5 },
        solution: { x: 0.6, y: 3.0, w: 2.0, h: 1.2 },
      },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 3rem;';
      var blocks = [
        { label: 'THE CHALLENGE', body: spec.challenge },
        { label: 'THE SOLUTION', body: spec.solution },
        { label: 'KEY RESULTS WITH WHATFIX', body: spec.results },
      ];
      var row = document.createElement('div');
      row.className = 'cs-blocks';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:1.5rem;margin-bottom:1.5rem;';
      blocks.forEach(function (block) {
        var wrap = document.createElement('div');
        wrap.className = 'cs-block';
        wrap.style.cssText = 'flex:1;min-width:8rem;';
        var label = document.createElement('p');
        label.className = 'cs-label';
        label.style.cssText = "font-size:.62rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#FF6B18;margin-bottom:.5rem;font-family:'DM Sans',sans-serif;";
        label.textContent = block.label;
        var body = document.createElement('p');
        body.className = 'cs-body';
        body.style.cssText = "font-size:.82rem;font-weight:300;color:rgba(255,255,255,.78);line-height:1.55;font-family:'DM Sans',sans-serif;";
        body.textContent = block.body || '';
        wrap.appendChild(label);
        wrap.appendChild(body);
        row.appendChild(wrap);
      });
      slideEl.appendChild(row);
      if (spec.metadata) {
        var meta = document.createElement('div');
        meta.className = 'cs-metadata';
        meta.style.cssText = 'display:flex;gap:1.25rem;margin-bottom:1rem;';
        [['Industry', spec.metadata.industry], ['Region', spec.metadata.region], ['Solution', spec.metadata.solution]]
          .forEach(function (pair) {
            if (!pair[1]) return;
            var item = document.createElement('span');
            item.className = 'cs-meta-item';
            item.style.cssText = "font-size:.72rem;color:rgba(255,255,255,.6);font-family:'DM Sans',sans-serif;";
            item.textContent = pair[0] + ': ' + pair[1];
            meta.appendChild(item);
          });
        slideEl.appendChild(meta);
      }
      if (spec.cta) {
        var cta = document.createElement('span');
        cta.className = 'cta-btn';
        cta.style.cssText = "align-self:flex-start;padding:.55rem 1.5rem;background:#FF6B18;color:#fff;border-radius:6px;font-size:.8rem;font-weight:500;display:inline-block;letter-spacing:.02em;font-family:'DM Sans',sans-serif;";
        cta.textContent = spec.cta;
        slideEl.appendChild(cta);
      }
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.case_study.geometry;
      var blocks = [
        { key: 'challenge', label: 'THE CHALLENGE', body: spec.challenge },
        { key: 'solution', label: 'THE SOLUTION', body: spec.solution },
        { key: 'results', label: 'KEY RESULTS WITH WHATFIX', body: spec.results },
      ];
      blocks.forEach(function (block) {
        var bg = g[block.key];
        pptxSlide.addText(block.label, {
          x: bg.label.x, y: bg.label.y, w: bg.label.w, h: bg.label.h,
          fontSize: 9, color: 'FF6B18', fontFace: 'DM Sans', bold: true,
        });
        pptxSlide.addText(block.body || '', {
          x: bg.body.x, y: bg.body.y, w: bg.body.w, h: bg.body.h,
          fontSize: 11, color: 'FFFFFF', fontFace: 'DM Sans',
        });
      });
      if (spec.metadata) {
        if (spec.metadata.industry) {
          pptxSlide.addText('Industry: ' + spec.metadata.industry, {
            x: g.metadata.industry.x, y: g.metadata.industry.y, w: g.metadata.industry.w, h: g.metadata.industry.h,
            fontSize: 10, color: 'CCCCCC', fontFace: 'DM Sans',
          });
        }
        if (spec.metadata.region) {
          pptxSlide.addText('Region: ' + spec.metadata.region, {
            x: g.metadata.region.x, y: g.metadata.region.y, w: g.metadata.region.w, h: g.metadata.region.h,
            fontSize: 10, color: 'CCCCCC', fontFace: 'DM Sans',
          });
        }
        if (spec.metadata.solution) {
          pptxSlide.addText('Solution: ' + spec.metadata.solution, {
            x: g.metadata.solution.x, y: g.metadata.solution.y, w: g.metadata.solution.w, h: g.metadata.solution.h,
            fontSize: 10, color: 'CCCCCC', fontFace: 'DM Sans',
          });
        }
      }
      if (spec.cta) {
        // Reuses the `closing` layout's CTA button PPTX pattern (roundRect + centered bold text).
        pptxSlide.addShape('roundRect', {
          x: g.cta.x, y: g.cta.y, w: g.cta.w, h: g.cta.h, rectRadius: 0.07, fill: { color: 'FF6B18' },
        });
        pptxSlide.addText(spec.cta, {
          x: g.cta.x, y: g.cta.y, w: g.cta.w, h: g.cta.h,
          fontSize: 11, color: 'FFFFFF', fontFace: 'DM Sans', bold: true, align: 'center', valign: 'middle',
        });
      }
    },
  });

  // Geometry read from brand/Copy of Master Deck 2026.pptx, slides 93-95
  // (ppt/slides/slide94.xml / slide95.xml <a:off>/<a:ext> EMU values / 914400):
  // - shared header bar: x=0.500 y=0.525 w=9.000 h=0.698 (slide94 Google Shape;3256 / slide95 Google Shape;3322)
  // - desktop screen area (slide94 Google Shape;3251, the monitor's largest clean rect):
  //   x=5.687 y=1.499 w=3.433 h=2.046 — used as the device frame, with a 5% inset for the screenshot.
  // - mobile screen area (slide95 Google Shape;3278, the phone body's largest clean rect):
  //   x=5.678 y=2.266 w=1.231 h=1.952 — used as the device frame, with a similar inset for the screenshot.
  registerLayout('mockup', {
    geometry: {
      header: { x: 0.5, y: 0.525, w: 9, h: 0.698 },
      desktop: {
        frame: { x: 1.9, y: 1.35, w: 6.2, h: 3.6 },
        screen: { x: 2.08, y: 1.53, w: 5.84, h: 3.24 },
      },
      mobile: {
        frame: { x: 3.9, y: 1.0, w: 2.2, h: 4.1 },
        screen: { x: 4.07, y: 1.2, w: 1.86, h: 3.7 },
      },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 3rem;';
      var isMobile = spec.device === 'mobile';
      var frame = document.createElement('div');
      frame.className = 'device-frame ' + (isMobile ? 'device-mobile' : 'device-desktop');
      frame.style.cssText = isMobile
        ? 'width:26%;aspect-ratio:9/16;background:#1a1728;border-radius:1.6rem;border:6px solid #4a4560;display:flex;align-items:center;justify-content:center;overflow:hidden;'
        : 'width:80%;aspect-ratio:16/9;background:#1a1728;border-radius:.7rem;border:6px solid #4a4560;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      if (spec.screenshotBrandImage) {
        var img = document.createElement('img');
        img.className = 'device-screen';
        img.src = brandImagePath(spec.screenshotBrandImage);
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        frame.appendChild(img);
      }
      slideEl.appendChild(frame);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.mockup.geometry;
      var d = spec.device === 'mobile' ? g.mobile : g.desktop;
      pptxSlide.addShape('roundRect', {
        x: d.frame.x, y: d.frame.y, w: d.frame.w, h: d.frame.h,
        rectRadius: spec.device === 'mobile' ? 0.18 : 0.08,
        fill: { color: '1a1728' }, line: { color: '4a4560', width: 3 },
      });
      if (spec.screenshotBrandImage) {
        pptxSlide.addImage({
          path: brandImagePath(spec.screenshotBrandImage),
          x: d.screen.x, y: d.screen.y, w: d.screen.w, h: d.screen.h,
        });
      }
    },
  });

  // Geometry read from brand/Copy of Master Deck 2026.pptx, slide 68
  // (ppt/slides/slide68.xml <a:off>/<a:ext> EMU values / 914400):
  // - headline: x=0.500 y=0.492 w=9.307 h=0.488 (Google Shape;2827)
  // - "Frequency" axis label: x=3.989 y=2.705 w=1.721 h=0.360 (Google Shape;2864)
  // - "Complexity" axis label: x=6.425 y=4.538 w=1.025 h=0.337 (Google Shape;2848)
  // The real slide is an 8-bubble frequency/complexity scatter (Execute/Create/Migrate/
  // Quick Win/Optimize Efforts/Analyze/Categorize/Improve Effectiveness), spanning roughly
  // x=0.3-9.3, y=1.0-4.9 — generalized here into a plain 2x2 grid (per this layout's spec:
  // exactly 4 quadrants) occupying that same overall plot-area footprint.
  registerLayout('matrix_2x2', {
    geometry: {
      headline: { x: 0.5, y: 0.492, w: 9.307, h: 0.488 },
      yAxisLabel: { x: 0.15, y: 2.2, w: 0.3, h: 1.6 },
      xAxisLabel: { x: 6.425, y: 4.538, w: 1.025, h: 0.337 },
      grid: { x: 0.5, y: 1.05, w: 9, h: 3.55 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 3rem;';
      var h2 = document.createElement('h2');
      h2.style.cssText = "font-size:clamp(1.1rem,2vw,1.6rem);font-weight:500;color:#FF6B18;margin-bottom:1rem;font-family:'DM Sans',sans-serif;";
      h2.textContent = spec.title || '';
      slideEl.appendChild(h2);
      var axes = document.createElement('div');
      axes.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:.4rem;';
      var yAxis = document.createElement('span');
      yAxis.className = 'mx-y-axis';
      yAxis.style.cssText = "font-size:.7rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Sans',sans-serif;";
      yAxis.textContent = spec.yAxisLabel || '';
      var xAxis = document.createElement('span');
      xAxis.className = 'mx-x-axis';
      xAxis.style.cssText = "font-size:.7rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Sans',sans-serif;";
      xAxis.textContent = spec.xAxisLabel || '';
      axes.appendChild(yAxis);
      axes.appendChild(xAxis);
      slideEl.appendChild(axes);
      var grid = document.createElement('div');
      grid.className = 'matrix-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:.6rem;flex:1;';
      // Structural cap: exactly 4 quadrants, always — pad with empty ones if fewer are given,
      // slice off any beyond 4 (matches this layout's spec: top-left/top-right/bottom-left/bottom-right).
      var quadrants = (spec.quadrants || []).slice(0, 4);
      while (quadrants.length < 4) quadrants.push({ label: '', items: [] });
      quadrants.forEach(function (q) {
        var cell = document.createElement('div');
        cell.className = 'mx-quadrant';
        cell.style.cssText = 'background:#4a4560;border-radius:8px;padding:.9rem 1rem;';
        var label = document.createElement('div');
        label.className = 'mx-q-label';
        label.style.cssText = "font-size:.85rem;font-weight:500;color:#fff;margin-bottom:.4rem;font-family:'DM Sans',sans-serif;";
        label.textContent = q.label || '';
        cell.appendChild(label);
        var ul = document.createElement('ul');
        ul.className = 'mx-q-items';
        ul.style.cssText = 'list-style:none;display:flex;flex-direction:column;gap:.2rem;';
        (q.items || []).slice(0, 3).forEach(function (item) {
          var li = document.createElement('li');
          li.style.cssText = "font-size:.68rem;font-weight:300;color:rgba(255,255,255,.65);font-family:'DM Sans',sans-serif;";
          li.textContent = item;
          ul.appendChild(li);
        });
        cell.appendChild(ul);
        grid.appendChild(cell);
      });
      slideEl.appendChild(grid);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.matrix_2x2.geometry;
      pptxSlide.addText(spec.title || '', {
        x: g.headline.x, y: g.headline.y, w: g.headline.w, h: g.headline.h,
        fontSize: 20, color: 'FF6B18', fontFace: 'DM Sans',
      });
      if (spec.yAxisLabel) {
        pptxSlide.addText(spec.yAxisLabel, {
          x: g.yAxisLabel.x, y: g.yAxisLabel.y, w: g.yAxisLabel.w, h: g.yAxisLabel.h,
          fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans', rotate: 270,
        });
      }
      if (spec.xAxisLabel) {
        pptxSlide.addText(spec.xAxisLabel, {
          x: g.xAxisLabel.x, y: g.xAxisLabel.y, w: g.xAxisLabel.w, h: g.xAxisLabel.h,
          fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans',
        });
      }
      // Same exactly-4 structural cap as render(): slice to 4, pad if fewer.
      var quadrants = (spec.quadrants || []).slice(0, 4);
      while (quadrants.length < 4) quadrants.push({ label: '', items: [] });
      var cellW = g.grid.w / 2;
      var cellH = g.grid.h / 2;
      quadrants.forEach(function (q, i) {
        var col = i % 2;
        var row = Math.floor(i / 2);
        var cx = g.grid.x + col * cellW;
        var cy = g.grid.y + row * cellH;
        pptxSlide.addShape('roundRect', {
          x: cx + 0.05, y: cy + 0.05, w: cellW - 0.1, h: cellH - 0.1, fill: { color: '4a4560' }, rectRadius: 0.06,
        });
        pptxSlide.addText(q.label || '', {
          x: cx + 0.2, y: cy + 0.15, w: cellW - 0.4, h: 0.35, fontSize: 13, color: 'FFFFFF', fontFace: 'DM Sans',
        });
        var items = (q.items || []).slice(0, 3);
        if (items.length) {
          pptxSlide.addText(items.join('\n'), {
            x: cx + 0.2, y: cy + 0.55, w: cellW - 0.4, h: cellH - 0.7, fontSize: 10, color: 'CCCCCC', fontFace: 'DM Sans',
          });
        }
      });
    },
  });

  // Geometry read from brand/Copy of Master Deck 2026.pptx, slides 11 and 16
  // (ppt/slides/slide11.xml / slide16.xml <a:off>/<a:ext> EMU values / 914400):
  // - event-cover (slide11): eventName x=0.500 y=2.293 w=4.500 h=0.520 (Google Shape;1399);
  //   date/location x=0.500 y=2.970 w=4.500 h=0.520 (Google Shape;1400, "Date | Time | Location").
  // - speaker-card (slide16, Panel Discussion): 4 cards are <p:grpSp> groups, each with its own
  //   <a:xfrm><a:off>; group x-offsets read as 0.476/2.402/4.388/6.489 (the 4 groups' a:off x,
  //   all sharing y=1.367in), each containing a photo placeholder w=1.429 h=1.485 and a
  //   name/designation/company text block at (rel) y=3.121 w=1.477 h=0.786.
  registerLayout('event_speaker', {
    geometry: {
      eventCover: {
        eventName: { x: 0.5, y: 2.293, w: 4.5, h: 0.52 },
        dateLocation: { x: 0.5, y: 2.970, w: 4.5, h: 0.52 },
      },
      speakerCard: {
        xs: [0.476, 2.402, 4.388, 6.489],
        cardW: 1.9,
        photo: { y: 1.367, w: 1.429, h: 1.485 },
        text: { y: 3.121, w: 1.477, h: 0.786 },
      },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2rem 3.5rem;';
      if (spec.speakers) {
        var row = document.createElement('div');
        row.className = 'speaker-row';
        row.style.cssText = 'display:flex;gap:1rem;justify-content:center;';
        // Structural cap: max 4 speaker cards, per the master deck's Panel Discussion 4-card layout.
        (spec.speakers || []).slice(0, 4).forEach(function (speaker) {
          var card = document.createElement('div');
          card.className = 'speaker-card';
          card.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;';
          var photo = document.createElement('div');
          photo.className = 'sp-photo';
          photo.style.cssText = 'width:5rem;height:5rem;border-radius:50%;background:#4a4560;margin-bottom:.75rem;';
          var name = document.createElement('div');
          name.className = 'sp-name';
          name.style.cssText = "font-size:.9rem;font-weight:500;color:#fff;font-family:'DM Sans',sans-serif;";
          name.textContent = speaker.name || '';
          var title = document.createElement('div');
          title.className = 'sp-title';
          title.style.cssText = "font-size:.75rem;font-weight:300;color:#FF6B18;font-family:'DM Sans',sans-serif;";
          title.textContent = speaker.title || '';
          var company = document.createElement('div');
          company.className = 'sp-company';
          company.style.cssText = "font-size:.72rem;font-weight:300;color:rgba(255,255,255,.5);font-family:'DM Sans',sans-serif;";
          company.textContent = speaker.company || '';
          card.appendChild(photo);
          card.appendChild(name);
          card.appendChild(title);
          card.appendChild(company);
          row.appendChild(card);
        });
        slideEl.appendChild(row);
      } else {
        var name2 = document.createElement('h1');
        name2.className = 'ev-name';
        name2.style.cssText = "font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:500;color:#fff;margin-bottom:.6rem;font-family:'DM Sans',sans-serif;";
        name2.textContent = spec.eventName || '';
        var datetime = document.createElement('p');
        datetime.className = 'ev-datetime';
        datetime.style.cssText = "font-size:1rem;font-weight:300;color:#FF6B18;font-family:'DM Sans',sans-serif;";
        datetime.textContent = [spec.date, spec.location].filter(Boolean).join(' | ');
        slideEl.appendChild(name2);
        slideEl.appendChild(datetime);
      }
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.event_speaker.geometry;
      if (spec.speakers) {
        var speakers = (spec.speakers || []).slice(0, 4); // same structural cap as render()
        speakers.forEach(function (speaker, i) {
          var cx = g.speakerCard.xs[i];
          pptxSlide.addShape('ellipse', {
            x: cx + 0.2, y: g.speakerCard.photo.y, w: g.speakerCard.photo.w - 0.4, h: g.speakerCard.photo.w - 0.4,
            fill: { color: '4a4560' },
          });
          pptxSlide.addText(speaker.name || '', {
            x: cx, y: g.speakerCard.text.y, w: g.speakerCard.text.w, h: 0.3,
            fontSize: 13, color: 'FFFFFF', fontFace: 'DM Sans', align: 'center',
          });
          pptxSlide.addText(speaker.title || '', {
            x: cx, y: g.speakerCard.text.y + 0.3, w: g.speakerCard.text.w, h: 0.25,
            fontSize: 10, color: 'FF6B18', fontFace: 'DM Sans', align: 'center',
          });
          pptxSlide.addText(speaker.company || '', {
            x: cx, y: g.speakerCard.text.y + 0.55, w: g.speakerCard.text.w, h: 0.25,
            fontSize: 9, color: 'CCCCCC', fontFace: 'DM Sans', align: 'center',
          });
        });
      } else {
        pptxSlide.addText(spec.eventName || '', {
          x: g.eventCover.eventName.x, y: g.eventCover.eventName.y, w: g.eventCover.eventName.w, h: g.eventCover.eventName.h,
          fontSize: 32, color: 'FFFFFF', fontFace: 'DM Sans',
        });
        var dl = [spec.date, spec.location].filter(Boolean).join(' | ');
        pptxSlide.addText(dl, {
          x: g.eventCover.dateLocation.x, y: g.eventCover.dateLocation.y, w: g.eventCover.dateLocation.w, h: g.eventCover.dateLocation.h,
          fontSize: 14, color: 'FF6B18', fontFace: 'DM Sans',
        });
      }
    },
  });

  // Geometry read from brand/Copy of Master Deck 2026.pptx, slide 31
  // (ppt/slides/slide31.xml <a:off>/<a:ext> EMU values / 914400):
  // - "Objective" label: x=0.396 y=0.383 w=3.039 h=0.520 (Google Shape;1697)
  // - the decorative right-side graphic panel starts at x=5.828 (Google Shape;1696), so the
  //   left content column runs from x=0.4 up to that edge — used here as the single wide
  //   paragraph body area for the "wide single-paragraph" objective variant.
  registerLayout('objective', {
    geometry: {
      label: { x: 0.396, y: 0.383, w: 3.039, h: 0.52 },
      body: { x: 0.4, y: 1.5, w: 5.2, h: 3.8 },
    },
    render: function (spec, slideEl) {
      slideEl.style.cssText = 'display:flex;flex-direction:column;justify-content:center;padding:2.5rem 3.5rem;';
      var label = document.createElement('p');
      label.className = 'obj-label';
      label.style.cssText = "font-size:1.1rem;font-weight:500;color:#FF6B18;margin-bottom:1.25rem;font-family:'DM Sans',sans-serif;";
      label.textContent = spec.label || '';
      var body = document.createElement('p');
      body.className = 'obj-body';
      body.style.cssText = "font-size:clamp(.95rem,1.7vw,1.3rem);font-weight:300;color:rgba(255,255,255,.82);line-height:1.7;max-width:56ch;font-family:'DM Sans',sans-serif;";
      body.textContent = spec.body || '';
      slideEl.appendChild(label);
      slideEl.appendChild(body);
    },
    exportPptx: function (pptxSlide, spec) {
      var g = registry.objective.geometry;
      pptxSlide.addText(spec.label || '', {
        x: g.label.x, y: g.label.y, w: g.label.w, h: g.label.h,
        fontSize: 18, color: 'FF6B18', fontFace: 'DM Sans',
      });
      pptxSlide.addText(spec.body || '', {
        x: g.body.x, y: g.body.y, w: g.body.w, h: g.body.h,
        fontSize: 16, color: 'FFFFFF', fontFace: 'DM Sans',
      });
    },
  });

  // Real DM Sans / IBM Plex Sans font binaries, extracted once from
  // brand/Copy of Master Deck 2026.pptx (ppt/fonts/*.fntdata) and vendored at
  // client/public/brand/fonts/. PptxGenJS 4.0.1 has no font-embedding API --
  // fontFace: 'DM Sans' only labels the intended font, it never embeds it --
  // so without this step, opening the exported .pptx on a machine that lacks
  // these fonts installed silently substitutes a fallback font and reflows
  // text inside its fixed-size box. embedFontsInPptx() is a post-processing
  // step, applied via direct OOXML zip surgery on the blob PptxGenJS already
  // produced, using the exact <p:embeddedFontLst> shape/element order/
  // relationship wiring already present in that same master deck file.
  var EMBEDDED_FONTS = [
    { typeface: 'DM Sans', regular: 'DMSans-regular.fntdata', bold: 'DMSans-bold.fntdata', italic: 'DMSans-italic.fntdata', boldItalic: 'DMSans-boldItalic.fntdata' },
    { typeface: 'IBM Plex Sans', regular: 'IBMPlexSans-regular.fntdata', bold: 'IBMPlexSans-bold.fntdata', italic: 'IBMPlexSans-italic.fntdata', boldItalic: 'IBMPlexSans-boldItalic.fntdata' },
  ];

  async function embedFontsInPptx(blob) {
    var zip = await window.JSZip.loadAsync(blob);

    // Idempotency guard: if this blob already has fonts embedded (e.g. embedFontsInPptx
    // was somehow invoked twice on the same output), return it unchanged rather than
    // fetching+writing the font parts again, which would append a second, ID-colliding
    // set of relationship entries into ppt/_rels/presentation.xml.rels.
    var existingPresentationXml = await zip.file('ppt/presentation.xml').async('string');
    if (existingPresentationXml.indexOf('<p:embeddedFontLst>') !== -1) {
      return blob;
    }

    // 1. Fetch and add each font binary under ppt/fonts/ -- origin-aware, same reasoning as
    // brandImagePath: this runs in the artifact's own context, which may be the cross-origin
    // Sandpack preview iframe when downloadPptx() is invoked from the live preview.
    var origin = (typeof window !== 'undefined' && typeof window._BRAND_ORIGIN === 'string') ? window._BRAND_ORIGIN : '';
    var relEntries = [];
    var embeddedFontXml = '';
    var nextRid = 200; // starts well above any rId PptxGenJS itself assigns, to avoid collisions
    for (var i = 0; i < EMBEDDED_FONTS.length; i++) {
      var font = EMBEDDED_FONTS[i];
      var ids = {};
      var variants = ['regular', 'bold', 'italic', 'boldItalic'];
      for (var v = 0; v < variants.length; v++) {
        var key = variants[v];
        var filename = font[key];
        var resp = await fetch(origin + '/brand/fonts/' + filename);
        var buf = await resp.arrayBuffer();
        zip.file('ppt/fonts/' + filename, buf);
        var rid = 'rId' + nextRid++;
        ids[key] = rid;
        relEntries.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/' + filename + '"/>');
      }
      embeddedFontXml += '<p:embeddedFont><p:font typeface="' + font.typeface + '"/>' +
        '<p:regular r:id="' + ids.regular + '"/><p:bold r:id="' + ids.bold + '"/>' +
        '<p:italic r:id="' + ids.italic + '"/><p:boldItalic r:id="' + ids.boldItalic + '"/></p:embeddedFont>';
    }

    // 2. [Content_Types].xml -- add the fntdata Default entry once, before </Types>.
    var contentTypes = await zip.file('[Content_Types].xml').async('string');
    if (contentTypes.indexOf('Extension="fntdata"') === -1) {
      contentTypes = contentTypes.replace('</Types>', '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>');
    }
    zip.file('[Content_Types].xml', contentTypes);

    // 3. ppt/_rels/presentation.xml.rels -- append the new font relationships before </Relationships>.
    var rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    rels = rels.replace('</Relationships>', relEntries.join('') + '</Relationships>');
    zip.file('ppt/_rels/presentation.xml.rels', rels);

    // 4. ppt/presentation.xml -- set embedTrueTypeFonts/saveSubsetFonts on <p:presentation>,
    // and insert <p:embeddedFontLst> right after the <p:notesSz/> element (confirmed exact
    // element order -- sldSz, notesSz, embeddedFontLst, defaultTextStyle -- against a real
    // PowerPoint-saved file). NOTE: <p:notesSz> is always self-closing (both in PptxGenJS's own
    // generated XML and in the master deck's own saved XML -- there is no literal "</p:notesSz>"
    // closing-tag substring anywhere to match against), so the insertion point must be matched
    // against the self-closing form "<p:notesSz .../>" instead.
    //
    // embedTrueTypeFonts and saveSubsetFonts are checked and inserted INDEPENDENTLY of each
    // other -- real PptxGenJS 4.0.1 output already emits saveSubsetFonts="1" on <p:presentation>
    // by default in every export (confirmed against a real pptx.write() blob), so gating both
    // attributes on a single check (e.g. "if embedTrueTypeFonts is missing, insert both") would
    // insert a second, duplicate saveSubsetFonts="1" into the same start tag -- which violates
    // XML's Unique Att Spec constraint and produces malformed XML in every real export, not just
    // an edge case.
    var presentationXml = await zip.file('ppt/presentation.xml').async('string');
    if (presentationXml.indexOf('embedTrueTypeFonts=') === -1) {
      presentationXml = presentationXml.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" ');
    }
    if (presentationXml.indexOf('saveSubsetFonts=') === -1) {
      presentationXml = presentationXml.replace('<p:presentation ', '<p:presentation saveSubsetFonts="1" ');
    }
    if (presentationXml.indexOf('<p:embeddedFontLst>') === -1) {
      presentationXml = presentationXml.replace(/(<p:notesSz\b[^>]*\/>)/, '$1<p:embeddedFontLst>' + embeddedFontXml + '</p:embeddedFontLst>');
    }
    zip.file('ppt/presentation.xml', presentationXml);

    return zip.generateAsync({ type: 'blob' });
  }

  async function downloadPptx() {
    var deck = window.DECK;
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // matches SW=10/SH=5.625
    (deck.slides || []).forEach(function (spec) {
      var layout = getLayout(spec.layout);
      var pptxSlide = pptx.addSlide();
      pptxSlide.background = { color: '25223B' };
      layout.exportPptx(pptxSlide, spec);
    });
    var blob = await pptx.write({ outputType: 'blob' });
    blob = await embedFontsInPptx(blob);
    var slug = (deck.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  window.DeckRenderer = {
    SW: SW,
    SH: SH,
    registerLayout: registerLayout,
    getLayout: getLayout,
    inchesToPercent: inchesToPercent,
    renderDeck: renderDeck,
    downloadPptx: downloadPptx,
    embedFontsInPptx: embedFontsInPptx,
    brandImagePath: brandImagePath,
    deckAssetPath: deckAssetPath,
    goTo: goTo,
    next: next,
    prev: prev,
  };
  window.downloadPptx = downloadPptx;
})();
