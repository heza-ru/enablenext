// Task 9: autosave trigger for the Konva canvas editor.
//
// canvas-editor.js's mutation call sites already call notifyChange() (Tasks
// 4-7's shared change-notification mechanism, subscribed via
// window.CanvasEditor.onChange(cb)) on every commit (drag/resize/rotate end,
// delete, duplicate, z-order change, undo/redo, etc). This module is the sole
// subscriber that turns those notifications into a persisted save: it
// debounces bursts of changes (~1s, matching Presenton's own autosave
// cadence) and then posts the SAME wire message the old explicit Save button
// used to post on click — { type: 'artifact-deck-updated', deck: window.DECK }
// — to window.parent. The host app (DownloadArtifact.tsx) owns everything
// past that point: serializing concurrent saves, retries, and surfacing
// failures. This file only decides WHEN to ask for a save, never how the
// save itself is persisted.
(function () {
  var debounceTimer = null;
  var DEBOUNCE_MS = 1000;

  function postDeckUpdate() {
    debounceTimer = null;
    try {
      window.parent.postMessage({ type: 'artifact-deck-updated', deck: window.DECK }, '*');
    } catch (e) {
      // window.parent may be unavailable in isolated test/preview contexts —
      // never let a failed postMessage break the editor itself.
    }
  }

  function onDeckChanged() {
    if (debounceTimer) clearTimeout(debounceTimer);
    // window.DECK is read inside postDeckUpdate (at fire time), not here, so
    // whatever the deck looks like when the debounce actually settles is what
    // gets sent — not a stale snapshot from the first change in the burst.
    debounceTimer = setTimeout(postDeckUpdate, DEBOUNCE_MS);
  }

  window.CanvasAutosave = {
    onDeckChanged: onDeckChanged,
  };

  // Wire up automatically: every canvas-editor.js mutation already calls
  // notifyChange(), so subscribing here is the only wiring this file needs to
  // do to turn "a change happened" into "a debounced save will be requested".
  if (window.CanvasEditor && typeof window.CanvasEditor.onChange === 'function') {
    window.CanvasEditor.onChange(window.CanvasAutosave.onDeckChanged);
  }
}());
