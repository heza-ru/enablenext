// client/public/libs/__tests__/download-bridge.test.js
const fs = require('fs');
const path = require('path');

// jsdom (as used by this repo's jest-environment-jsdom, v26.1.0) does not
// implement URL.createObjectURL / URL.revokeObjectURL — see
// https://github.com/jsdom/jsdom/issues/1721. download-bridge.js relies on
// wrapping these to capture blobs, so a minimal polyfill is required purely
// to make the test runnable; it has no bearing on the bridge's own logic,
// which is what these tests exercise.
let objectUrlCounter = 0;
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:mock/${objectUrlCounter++}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

describe('download-bridge.js', () => {
  const scriptSrc = fs.readFileSync(
    path.join(__dirname, '..', 'download-bridge.js'),
    'utf8',
  );

  function loadBridge() {
    const posted = [];
    // Minimal window.parent stub to capture postMessage calls.
    window.parent = { postMessage: (msg) => posted.push(msg) };
    // eslint-disable-next-line no-eval
    eval(scriptSrc);
    return posted;
  }

  it('posts bridge-ready on load', () => {
    const posted = loadBridge();
    expect(posted).toContainEqual({ type: 'bridge-ready' });
  });

  it('captures a blob created via URL.createObjectURL and intercepts the download click', async () => {
    const posted = loadBridge();
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'test.txt';
    document.body.appendChild(a);
    a.click();

    // FileReader.onload is async. jsdom's FileReader takes longer than a
    // single macrotask tick to fire (unlike real browsers), so poll briefly
    // instead of assuming one setTimeout(0) is enough.
    const deadline = Date.now() + 2000;
    while (!posted.some((m) => m.type === 'artifact-download') && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const downloadMsg = posted.find((m) => m.type === 'artifact-download');
    expect(downloadMsg).toBeDefined();
    expect(downloadMsg.filename).toBe('test.txt');
    expect(downloadMsg.mimeType).toBe('text/plain');
  });

  it('posts artifact-download-error when the message-triggered export function throws', async () => {
    // An async function whose body throws rejects the returned promise
    // (rather than throwing synchronously out of the message handler before
    // the .catch() is even attached) — this is the realistic shape of the
    // artifact export functions the bridge invokes.
    window.throwingFn = async () => {
      throw new Error('export blew up');
    };
    try {
      const posted = loadBridge();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-download-request', fn: 'throwingFn' },
        }),
      );

      const deadline = Date.now() + 2000;
      while (
        !posted.some((m) => m.type === 'artifact-download-error') &&
        Date.now() < deadline
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const errorMsg = posted.find((m) => m.type === 'artifact-download-error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.fn).toBe('throwingFn');
      expect(errorMsg.message).toBe('export blew up');
    } finally {
      delete window.throwingFn;
    }
  });

  it('does not intercept a click on an anchor with no blob: href', () => {
    loadBridge();
    let realClickCalled = false;
    const a = document.createElement('a');
    a.href = 'https://example.com/file.txt';
    a.download = 'file.txt';
    document.body.appendChild(a);
    a.addEventListener('click', (e) => {
      // Real navigation would happen here in a browser; jsdom just fires the event.
      realClickCalled = true;
      e.preventDefault();
    });
    a.click();
    expect(realClickCalled).toBe(true);
  });
});
