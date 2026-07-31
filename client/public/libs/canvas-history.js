// Undo/redo history stack for the Konva canvas editor. One push() per
// logical user action (drag, resize, delete, duplicate, nudge, z-order,
// toolbar edit) — call sites live in canvas-editor.js's top-level action
// handlers and canvas-toolbars.js's shared mutate() helper, each invoked
// immediately before that action mutates window.DECK.
(function () {
  var past = []; // snapshots to undo back to, most recent last
  var future = []; // snapshots to redo forward to, most recent last
  var CAP = 50;

  // Deep-clones the ENTIRE window.DECK, matching this codebase's established
  // deep-clone convention (JSON.parse(JSON.stringify(...)), same technique
  // canvas-editor.js's duplicateSelected() already uses).
  function cloneDeck() {
    return JSON.parse(JSON.stringify(window.DECK));
  }

  function push() {
    past.push(cloneDeck());
    if (past.length > CAP) past.shift(); // drop oldest, bound memory growth
    future = []; // a new action invalidates the redo history
  }

  // window.DECK is a single global object other modules (deck-renderer.js,
  // download-bridge.js, etc.) hold direct references to — reassigning
  // window.DECK = snapshot would leave those other holders pointing at a
  // stale object. Mutate in place instead, copying every top-level key from
  // the snapshot (not just .slides) to stay correct if future fields are
  // added to the DECK shape.
  function restoreSnapshot(snapshot) {
    Object.assign(window.DECK, snapshot);
    if (window.CanvasEditor) {
      window.CanvasEditor.remount();
      // Old Konva node references are gone after remount(); any stale
      // selection must be cleared.
      window.CanvasEditor.deselect();
    }
    if (window.CanvasToolbars) window.CanvasToolbars.hide();
    // Every other mutating call site (canvas-editor.js, canvas-toolbars.js,
    // canvas-image-editor.js, canvas-template-picker.js, canvas-slide-actions.js)
    // calls notifyChange() immediately after mutating window.DECK, which is
    // what canvas-autosave.js listens for via CanvasEditor.onChange(...) to
    // persist edits to the server. Undo/redo must route through the same
    // path, or a reversion that isn't followed by another edit never gets
    // saved server-side.
    if (window.CanvasEditor) window.CanvasEditor.notifyChange();
  }

  function undo() {
    if (past.length === 0) return;
    future.push(cloneDeck());
    var snapshot = past.pop();
    restoreSnapshot(snapshot);
  }

  function redo() {
    if (future.length === 0) return;
    past.push(cloneDeck());
    var snapshot = future.pop();
    restoreSnapshot(snapshot);
  }

  function canUndo() {
    return past.length > 0;
  }

  function canRedo() {
    return future.length > 0;
  }

  window.CanvasHistory = {
    push: push,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    // Test-only: clears both stacks so test suites can start from a known
    // empty state instead of accumulating history across test cases (same
    // underscore-prefixed test-hook convention as canvas-editor.js's
    // _pxToInches/_updateElementFromNode).
    _resetForTests: function () { past = []; future = []; },
  };

  // Wires into canvas-editor.js's existing keyboard-shortcut stub
  // (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z). Guarded in case script load order ever
  // varies; the real template loads canvas-editor.js before this file.
  if (window.CanvasEditor) {
    window.CanvasEditor._undoRedoHook = { undo: undo, redo: redo };
  }
})();
