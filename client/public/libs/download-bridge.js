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

  function intercept(el, targetWindow) {
    if (!el.download || !el.href || el.href.indexOf('blob:') !== 0) return false;
    var blob = blobs.get(el.href);
    if (!blob) return false;
    var filename = el.download;
    var mimeType = blob.type || 'application/octet-stream';
    var reader = new FileReader();
    reader.onload = function () {
      var data = String(reader.result).split(',')[1];
      targetWindow.postMessage(
        { type: 'artifact-download', filename: filename, data: data, mimeType: mimeType },
        '*',
      );
    };
    reader.readAsDataURL(blob);
    return true;
  }

  var origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    if (this.tagName === 'A' && intercept(this, window.parent)) return;
    origClick.call(this);
  };

  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this.tagName === 'A' && intercept(this, window.parent)) {
      return true;
    }
    return origDispatch.call(this, ev);
  };

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'artifact-download-request') return;
    var fn = e.data.fn;
    if (typeof window[fn] !== 'function') return;
    var target = e.source || window.parent;
    // Re-run intercept() against the message's source window for this call,
    // since the global patches above default to window.parent.
    var origClickForRequest = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function () {
      if (this.tagName === 'A' && intercept(this, target)) return;
      origClickForRequest.call(this);
    };
    Promise.resolve(window[fn]()).catch(function (err) {
      // eslint-disable-next-line no-console
      console.error('[download-bridge] error running ' + fn + ':', err);
    });
  });

  window.parent.postMessage({ type: 'bridge-ready' }, '*');
})();
