// client/public/libs/download-bridge.js
//
// Shared blob-interceptor for artifact-generated file downloads (PPTX/DOCX/XLSX).
// Loaded via <script src="/libs/download-bridge.js"> by every LLM-generated
// artifact (presentation-creator, doc-creator, excel-creator skills) and by
// DownloadArtifact.tsx's hidden-iframe fallback path.
//
// Two ways this gets used:
//   1. Message-triggered: host posts { type: 'artifact-download-request', fn }
//      to this window; this script invokes window[fn](), captures the blob
//      the function creates via a download <a> click, and posts back
//      { type: 'artifact-download', filename, data, mimeType }.
//   2. Direct-invoke: the host calls window[fn]() itself (hidden-iframe path);
//      the global patches below are already active by the time it does, so
//      the same blob capture happens without needing the request message.
//
// On load, posts { type: 'bridge-ready' } so the host knows this artifact
// supports the protocol, instead of guessing with a fixed timeout.
(function () {
  var blobs = new Map();

  // Window to post the captured 'artifact-download' message to. Defaults to
  // window.parent (direct-invoke path); updated to the requesting window's
  // source right before running the export fn on message-triggered calls.
  var currentTarget = window.parent;

  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) {
    var u = origCreate(b);
    if (b instanceof Blob) blobs.set(u, b);
    return u;
  };

  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { blobs.delete(u); }, 90000);
    origRevoke(u);
  };

  function intercept(el) {
    if (!el.download || !el.href || el.href.indexOf('blob:') !== 0) return false;
    var blob = blobs.get(el.href);
    if (!blob) return false;
    var filename = el.download;
    var mimeType = blob.type || 'application/octet-stream';
    var reader = new FileReader();
    reader.onload = function () {
      var data = String(reader.result).split(',')[1];
      currentTarget.postMessage(
        { type: 'artifact-download', filename: filename, data: data, mimeType: mimeType },
        '*',
      );
    };
    reader.readAsDataURL(blob);
    return true;
  }

  var origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    if (this.tagName === 'A' && intercept(this)) return;
    origClick.call(this);
  };

  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this.tagName === 'A' && intercept(this)) {
      return true;
    }
    return origDispatch.call(this, ev);
  };

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'artifact-download-request') return;
    var fn = e.data.fn;
    if (typeof window[fn] !== 'function') return;
    // Point the single global click/dispatch patch at this request's source
    // window for the duration of this call.
    currentTarget = e.source || window.parent;
    Promise.resolve(window[fn]()).catch(function (err) {
      // eslint-disable-next-line no-console
      console.error('[download-bridge] error running ' + fn + ':', err);
      currentTarget.postMessage(
        { type: 'artifact-download-error', fn: fn, message: String(err && err.message || err) },
        '*',
      );
    });
  });

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'artifact-editor-toggle') return;
    if (typeof window.DeckEditor === 'undefined') return; // non-deck artifacts don't load deck-editor.js
    if (e.data.enabled) {
      window.DeckEditor.enableEditing(document.body);
    } else {
      window.DeckEditor.disableEditing(document.body);
    }
  });

  window.parent.postMessage({ type: 'bridge-ready' }, '*');
})();
