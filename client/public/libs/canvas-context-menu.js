// Contextual actions menu for the Konva canvas editor. Pure UI: every item
// calls straight into window.CanvasEditor's exposed action functions
// (deleteSelected/duplicateSelected/moveZOrder/moveZOrderExtreme) — the
// mutation logic lives entirely in canvas-editor.js (Task 5), this file only
// renders a floating menu and wires click/right-click/escape handling.
(function () {
  var menuEl = null;

  // Each item's action is looked up lazily (function wrapper) rather than
  // bound at module-load time, since window.CanvasEditor may not exist yet
  // when this script first runs depending on script load order.
  var ITEMS = [
    { label: 'Duplicate', action: function () { window.CanvasEditor.duplicateSelected(); } },
    { label: 'Bring to Front', action: function () { window.CanvasEditor.moveZOrderExtreme(true); } },
    { label: 'Bring Forward', action: function () { window.CanvasEditor.moveZOrder(1); } },
    { label: 'Send Backward', action: function () { window.CanvasEditor.moveZOrder(-1); } },
    { label: 'Send to Back', action: function () { window.CanvasEditor.moveZOrderExtreme(false); } },
    { label: 'Delete', action: function () { window.CanvasEditor.deleteSelected(); } },
  ];

  function buildMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.setAttribute('data-canvas-context-menu', 'true');
    menuEl.style.cssText = [
      'position:fixed',
      'z-index:100000',
      'display:none',
      'min-width:180px',
      'padding:4px 0',
      'background:#212121',
      'border:1px solid #171717',
      'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.45)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:13px',
      'color:#ececec',
      'user-select:none',
    ].join(';');
    ITEMS.forEach(function (item, i) {
      var row = document.createElement('div');
      row.textContent = item.label;
      row.setAttribute('data-menu-item', item.label);
      row.style.cssText = 'padding:7px 16px;cursor:pointer;white-space:nowrap;';
      if (i > 0 && (item.label === 'Delete')) {
        // Subtle divider before the destructive action.
        row.style.borderTop = '1px solid #171717';
        row.style.marginTop = '4px';
        row.style.paddingTop = '7px';
      }
      row.addEventListener('mouseenter', function () { row.style.background = '#2f2f2f'; });
      row.addEventListener('mouseleave', function () { row.style.background = 'transparent'; });
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        item.action();
        hide();
      });
      menuEl.appendChild(row);
    });
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function isVisible() {
    return !!menuEl && menuEl.style.display !== 'none';
  }

  function hide() {
    if (menuEl) menuEl.style.display = 'none';
  }

  // Clamps the menu's top-left so it never renders partially off-screen.
  // jsdom has no real layout engine (getBoundingClientRect always returns
  // 0-sized rects there), so this is a no-op in unit tests but does real
  // clamping in a real browser, where rect.width/height reflect the actual
  // rendered menu size.
  function show(x, y) {
    var el = buildMenu();
    el.style.display = 'block';
    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var clampedX = Math.max(4, Math.min(x, vw - rect.width - 4));
    var clampedY = Math.max(4, Math.min(y, vh - rect.height - 4));
    el.style.left = clampedX + 'px';
    el.style.top = clampedY + 'px';
  }

  document.addEventListener('mousedown', function (e) {
    if (!isVisible()) return;
    if (menuEl && menuEl.contains(e.target)) return;
    hide();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isVisible()) hide();
  });

  // Right-click on the canvas stage: show the menu if (and only if)
  // something is currently selected; on empty selection, do nothing (leave
  // the browser's native context menu suppressed only when we actually have
  // something to act on — otherwise let default behavior happen).
  document.addEventListener('contextmenu', function (e) {
    if (!window.CanvasEditor || !window.CanvasEditor.isMounted()) return;
    var stage = window.CanvasEditor.getStage();
    var container = stage && stage.container && stage.container();
    if (!container || !container.contains(e.target)) return;
    var selected = window.CanvasEditor.getSelectedIndices();
    if (!selected || selected.length === 0) {
      hide();
      return;
    }
    e.preventDefault();
    show(e.clientX, e.clientY);
  });

  // If the selection becomes empty while the menu is open (e.g. the user
  // pressed Delete via keyboard while a prior right-click's menu was still
  // open), the menu shouldn't linger with no valid target. All of Task 5's
  // mutating actions call notifyChange(), so this listener catches it.
  if (window.CanvasEditor && typeof window.CanvasEditor.onChange === 'function') {
    window.CanvasEditor.onChange(function () {
      if (!isVisible()) return;
      var selected = window.CanvasEditor.getSelectedIndices();
      if (!selected || selected.length === 0) hide();
    });
  }

  window.CanvasContextMenu = { show: show, hide: hide, isVisible: isVisible };
})();
