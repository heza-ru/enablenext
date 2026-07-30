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

  // download-bridge.js registers its 'message' listeners on the real global
  // `window`, which jsdom does NOT reset between tests in the same file.
  // Without cleanup, every test's listener stays live for the rest of the
  // suite — so a later test's message (e.g. one targeting a newly-defined
  // global fn) gets picked up and re-invoked by every earlier test's
  // still-registered listener too (since the handler resolves `fn` and
  // `window.parent` at dispatch time, not at registration time), multiplying
  // call counts. Track each loadBridge() call's listeners and remove them in
  // afterEach so tests are isolated from one another.
  let registeredListeners = [];
  afterEach(() => {
    registeredListeners.forEach(({ type, listener }) => window.removeEventListener(type, listener));
    registeredListeners = [];
  });

  function loadBridge() {
    const posted = [];
    // Minimal window.parent stub to capture postMessage calls.
    window.parent = { postMessage: (msg) => posted.push(msg) };
    const origAddEventListener = window.addEventListener.bind(window);
    const spy = jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, opts) => {
      registeredListeners.push({ type, listener });
      origAddEventListener(type, listener, opts);
    });
    // eslint-disable-next-line no-eval
    eval(scriptSrc);
    spy.mockRestore();
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

  it('calls the message-triggered export fn with zero arguments when no args are provided (regression)', () => {
    // This is the existing call shape every current trigger uses (PPTX, and
    // DOCX/XLSX before Task 14's options picker) — the .apply(null, args||[])
    // change must not alter it.
    const fn = jest.fn();
    window.zeroArgFn = fn;
    try {
      loadBridge();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-download-request', fn: 'zeroArgFn' },
        }),
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith();
      expect(fn.mock.calls[0].length).toBe(0);
    } finally {
      delete window.zeroArgFn;
    }
  });

  it('forwards e.data.args to the message-triggered export fn as individual arguments', () => {
    const fn = jest.fn();
    window.argsFn = fn;
    try {
      loadBridge();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-download-request',
            fn: 'argsFn',
            args: [{ pageSize: 'Letter' }],
          },
        }),
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({ pageSize: 'Letter' });
    } finally {
      delete window.argsFn;
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

  // Regression test (polish round 1, Finding M3): the real production
  // bootstrap script mounts the deck at #deck-root, not document.body
  // (agents/presentation-creator.skill.md's deck template calls
  // DeckRenderer.renderDeck(window.DECK, document.getElementById('deck-root'))).
  // Every structural mutator's renderDeck call does `mountEl.innerHTML = ''`
  // before rebuilding, so passing document.body itself as the mount would
  // wipe out document.body's own children -- including the #deck-root div --
  // on the very first chrome-driven mutation. The bridge must resolve
  // #deck-root and hand THAT to enableEditing/disableEditing, not document.body.
  it('relays artifact-editor-toggle to window.DeckEditor.enableEditing/disableEditing using #deck-root as the mount', () => {
    loadBridge();
    const deckRoot = document.createElement('div');
    deckRoot.id = 'deck-root';
    document.body.appendChild(deckRoot);
    const enableEditing = jest.fn();
    const disableEditing = jest.fn();
    window.DeckEditor = { enableEditing, disableEditing };
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-editor-toggle', enabled: true },
        }),
      );
      expect(enableEditing).toHaveBeenCalledWith(deckRoot);
      expect(enableEditing).not.toHaveBeenCalledWith(document.body);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-editor-toggle', enabled: false },
        }),
      );
      expect(disableEditing).toHaveBeenCalledWith(deckRoot);
      expect(disableEditing).not.toHaveBeenCalledWith(document.body);
    } finally {
      delete window.DeckEditor;
      deckRoot.remove();
    }
  });

  // Fallback path: if #deck-root genuinely doesn't exist (e.g. a future
  // template change), the bridge must still fall back to document.body
  // rather than passing null/undefined to the editor.
  it('falls back to document.body for artifact-editor-toggle when #deck-root does not exist', () => {
    loadBridge();
    const enableEditing = jest.fn();
    const disableEditing = jest.fn();
    window.DeckEditor = { enableEditing, disableEditing };
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-editor-toggle', enabled: true },
        }),
      );
      expect(enableEditing).toHaveBeenCalledWith(document.body);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-editor-toggle', enabled: false },
        }),
      );
      expect(disableEditing).toHaveBeenCalledWith(document.body);
    } finally {
      delete window.DeckEditor;
    }
  });

  it('ignores artifact-editor-toggle when window.DeckEditor is undefined (non-deck artifacts)', () => {
    loadBridge();
    delete window.DeckEditor;
    expect(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-editor-toggle', enabled: true },
        }),
      ),
    ).not.toThrow();
  });
});
