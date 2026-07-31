// Slide-level reorder/duplicate/delete for the Konva canvas editor.
//
// Ported from deck-editor.js's reorderSlide/duplicateSlide/deleteSlide (lines
// 199-216 of that file, read in full before writing this) — that DOM-based
// editor rendered every slide's chrome simultaneously, so each of its
// functions took an explicit `index` argument (a caller could act on any
// visible slide at any time). The Konva model only ever mounts ONE slide at
// a time, so "the slide being acted on" collapses unambiguously to
// `window.CanvasEditor.getActiveSlideIndex()` — no index parameter needed
// from callers, unlike the old editor.
//
// Same trigger-button lifecycle as Task 11/12's canvas-template-picker.js
// (always-visible chrome tied to CanvasEditor's mount()/unmount(), floating
// position:fixed buttons appended to document.body, positioned off
// getBoundingClientRect() the same way). These act on the WHOLE active
// slide, not a per-element selection — distinct from Task 6's per-element
// context menu and Task 7's per-element floating toolbar.
(function () {
  function reorderSlide(direction) {
    var idx = window.CanvasEditor.getActiveSlideIndex();
    var slides = window.DECK.slides;
    var target = idx + direction;
    if (target < 0 || target >= slides.length) return; // no-op at boundaries
    if (window.CanvasHistory) window.CanvasHistory.push();
    var tmp = slides[idx];
    slides[idx] = slides[target];
    slides[target] = tmp;
    // Content the user was editing is unchanged, only its position in
    // window.DECK.slides moved — remount at `target` so activeSlideIndex
    // correctly tracks the new position (visually nothing changes since the
    // same content re-renders, just under a different index).
    window.CanvasEditor.mount(window.CanvasEditor.getMountEl(), target);
    window.CanvasEditor.notifyChange();
  }

  function duplicateSlide() {
    var idx = window.CanvasEditor.getActiveSlideIndex();
    var slides = window.DECK.slides;
    if (window.CanvasHistory) window.CanvasHistory.push();
    var copy = JSON.parse(JSON.stringify(slides[idx]));
    slides.splice(idx + 1, 0, copy);
    // No remount/activeSlideIndex change: the currently-edited slide's own
    // content/position is unaffected by appending a copy after it (matches
    // Task 12's insertSlideAfter "no auto-navigate to the new thing"
    // precedent).
    window.CanvasEditor.notifyChange();
  }

  function deleteSlide() {
    var idx = window.CanvasEditor.getActiveSlideIndex();
    var slides = window.DECK.slides;
    if (slides.length <= 1) return; // never delete the last remaining slide
    if (window.CanvasHistory) window.CanvasHistory.push();
    slides.splice(idx, 1);
    var newIndex = Math.min(idx, slides.length - 1);
    window.CanvasEditor.mount(window.CanvasEditor.getMountEl(), newIndex);
    window.CanvasEditor.notifyChange();
  }

  // --- Trigger button lifecycle (always-visible chrome, same pattern as
  // canvas-template-picker.js's onMount()/onUnmount()) ----------------------
  var upBtn = null;
  var downBtn = null;
  var duplicateBtn = null;
  var deleteBtn = null;
  var triggerMountEl = null;

  var BASE_STYLE = [
    'position:fixed',
    'z-index:100000',
    'padding:5px 10px',
    'background:#212121',
    'border:1px solid #171717',
    'border-radius:6px',
    'color:#ececec',
    'font-size:12px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'cursor:pointer',
  ].join(';');

  function applyDisabled(btn, disabled) {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.4' : '1';
    btn.style.cursor = disabled ? 'default' : 'pointer';
  }

  function refreshButtonStates() {
    if (!window.DECK) return;
    var idx = window.CanvasEditor.getActiveSlideIndex();
    var total = window.DECK.slides.length;
    if (upBtn) applyDisabled(upBtn, idx <= 0);
    if (downBtn) applyDisabled(downBtn, idx >= total - 1);
    if (deleteBtn) applyDisabled(deleteBtn, total <= 1);
  }

  function positionButtons() {
    if (!triggerMountEl) return;
    var rect = triggerMountEl.getBoundingClientRect();
    // Bottom-left corner, stacked left-to-right: distinct corner from Task
    // 11's "Change layout…" (top-right) and Task 12's "+ Add slide"
    // (top-left), so none of this plan's always-visible chrome overlaps.
    var left = rect.left + 8;
    [upBtn, downBtn, duplicateBtn, deleteBtn].forEach(function (btn) {
      if (!btn) return;
      btn.style.bottom = (window.innerHeight - rect.bottom + 8) + 'px';
      btn.style.left = left + 'px';
      left += btn.offsetWidth + 6;
    });
  }

  function makeButton(attr, label, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(attr, 'true');
    btn.textContent = label;
    btn.style.cssText = BASE_STYLE;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.disabled) return;
      onClick();
      refreshButtonStates();
      positionButtons();
    });
    document.body.appendChild(btn);
    return btn;
  }

  function onMount(mountEl) {
    onUnmount();
    triggerMountEl = mountEl;

    upBtn = makeButton('data-canvas-slide-reorder-up', '↑', function () { reorderSlide(-1); });
    downBtn = makeButton('data-canvas-slide-reorder-down', '↓', function () { reorderSlide(1); });
    duplicateBtn = makeButton('data-canvas-slide-duplicate', 'Duplicate slide', function () { duplicateSlide(); });
    deleteBtn = makeButton('data-canvas-slide-delete', 'Delete slide', function () { deleteSlide(); });

    refreshButtonStates();
    positionButtons();
  }

  function onUnmount() {
    [upBtn, downBtn, duplicateBtn, deleteBtn].forEach(function (btn) {
      if (btn) btn.remove();
    });
    upBtn = downBtn = duplicateBtn = deleteBtn = null;
    triggerMountEl = null;
  }

  window.CanvasSlideActions = {
    reorderSlide: reorderSlide,
    duplicateSlide: duplicateSlide,
    deleteSlide: deleteSlide,
    // Called by canvas-editor.js's mount()/unmount() — same guarded
    // "if (window.CanvasSlideActions)" wiring style as CanvasTemplatePicker.
    _onMount: onMount,
    _onUnmount: onUnmount,
  };
})();
