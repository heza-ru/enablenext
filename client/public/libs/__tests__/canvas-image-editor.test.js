require('../deck-renderer.js');
require('../konva.min.js');
require('../canvas-editor.js');
require('../canvas-toolbars.js');
require('../canvas-image-editor.js');

describe('CanvasImageEditor', () => {
  let mount;

  function overlay() {
    return document.querySelector('[data-canvas-image-editor]');
  }

  function isOpen() {
    const o = overlay();
    return !!o && o.style.display !== 'none';
  }

  function imageElement() {
    return window.DECK.slides[0].elements[2];
  }

  beforeEach(() => {
    mount = document.createElement('div');
    Object.defineProperty(mount, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      configurable: true,
    });
    document.body.appendChild(mount);
    window.DECK = {
      title: 'T',
      slides: [{
        layout: 'schema',
        elements: [
          { type: 'text', x: 1, y: 1, w: 3, h: 1, text: 'Hello' },
          { type: 'shape', shape: 'rect', x: 0, y: 0, w: 2, h: 1, fill: '4a4560' },
          { type: 'image', x: 2, y: 2, w: 2, h: 2, deckAsset: 'foo.png' },
        ],
      }],
    };
    window.CanvasEditor.mount(mount, 0);
  });

  afterEach(() => {
    window.CanvasImageEditor.close();
    window.CanvasEditor.unmount();
    mount.remove();
    delete window.DECK;
  });

  it('is closed until open() is called', () => {
    expect(isOpen()).toBe(false);
  });

  it('open() shows the modal, close() hides it', () => {
    window.CanvasImageEditor.open(2);
    expect(isOpen()).toBe(true);
    window.CanvasImageEditor.close();
    expect(isOpen()).toBe(false);
  });

  it('wires _imageEditorHook.replace/crop to open() on load', () => {
    expect(window.CanvasToolbars._imageEditorHook).toBeTruthy();
    window.CanvasToolbars._imageEditorHook.replace(2);
    expect(isOpen()).toBe(true);
    window.CanvasImageEditor.close();
    window.CanvasToolbars._imageEditorHook.crop(2);
    expect(isOpen()).toBe(true);
  });

  it('defaults to the Upload tab', () => {
    window.CanvasImageEditor.open(2);
    const uploadTab = overlay().querySelector('[data-image-editor-tab="upload"]');
    const assetsTab = overlay().querySelector('[data-image-editor-tab="assets"]');
    expect(overlay().querySelector('[data-image-editor="drop-zone"]')).toBeTruthy();
    expect(uploadTab).toBeTruthy();
    expect(assetsTab).toBeTruthy();
  });

  it('switches to the Existing assets tab and shows the brand asset grid', () => {
    window.CanvasImageEditor.open(2);
    overlay().querySelector('[data-image-editor-tab="assets"]').click();
    expect(overlay().querySelector('[data-image-editor="assets-grid"]')).toBeTruthy();
    expect(overlay().querySelectorAll('[data-image-editor="asset"]').length).toBe(
      window.CanvasImageEditor._BRAND_IMAGES.length,
    );
  });

  it('picking a brand asset sets el.brandImage and clears deckAsset/uploadedImageUrl, then closes', () => {
    imageElement().uploadedImageUrl = 'https://example.com/old.png';
    window.CanvasImageEditor.open(2);
    overlay().querySelector('[data-image-editor-tab="assets"]').click();
    const firstAsset = overlay().querySelector('[data-image-editor="asset"]');
    const key = firstAsset.getAttribute('data-asset-key');
    firstAsset.click();

    expect(imageElement().brandImage).toBe(key);
    expect(imageElement().deckAsset).toBeUndefined();
    expect(imageElement().uploadedImageUrl).toBeUndefined();
    expect(isOpen()).toBe(false);
  });

  it('the focus-point sliders default to 50/50 and write el.focusX/focusY', () => {
    window.CanvasImageEditor.open(2);
    const focusX = overlay().querySelector('[data-image-editor="focus-x"]');
    const focusY = overlay().querySelector('[data-image-editor="focus-y"]');
    expect(focusX.value).toBe('50');
    expect(focusY.value).toBe('50');

    focusX.value = '20';
    focusX.dispatchEvent(new Event('input', { bubbles: true }));
    focusY.value = '80';
    focusY.dispatchEvent(new Event('input', { bubbles: true }));

    expect(imageElement().focusX).toBeCloseTo(0.2);
    expect(imageElement().focusY).toBeCloseTo(0.8);
  });

  it('re-opening reflects a previously set focus point', () => {
    imageElement().focusX = 0.3;
    imageElement().focusY = 0.7;
    window.CanvasImageEditor.open(2);
    expect(overlay().querySelector('[data-image-editor="focus-x"]').value).toBe('30');
    expect(overlay().querySelector('[data-image-editor="focus-y"]').value).toBe('70');
  });

  describe('upload round-trip via postMessage', () => {
    let originalPostMessage;

    beforeEach(() => {
      originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = jest.fn();
    });

    afterEach(() => {
      window.parent.postMessage = originalPostMessage;
    });

    function fileInput() {
      return overlay().querySelector('[data-image-editor="file-input"]');
    }

    // FileReader.readAsDataURL runs asynchronously (a real macrotask in
    // jsdom, not a microtask) — waitForUpload polls until the mocked
    // postMessage has actually been called, instead of racing a single fixed
    // delay against jsdom's FileReader implementation.
    async function waitForUpload() {
      for (let i = 0; i < 50; i++) {
        if (window.parent.postMessage.mock.calls.length > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('Timed out waiting for artifact-image-upload-request postMessage');
    }

    it('selecting a file posts artifact-image-upload-request to window.parent', async () => {
      window.CanvasImageEditor.open(2);
      const file = new File(['abc'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(fileInput(), 'files', { value: [file] });
      fileInput().dispatchEvent(new Event('change', { bubbles: true }));

      await waitForUpload();
      expect(window.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'artifact-image-upload-request',
          filename: 'photo.png',
        }),
        '*',
      );
    });

    it('applies the result on a matching artifact-image-upload-result message and clears prior image fields', async () => {
      window.CanvasImageEditor.open(2);
      const file = new File(['abc'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(fileInput(), 'files', { value: [file] });
      fileInput().dispatchEvent(new Event('change', { bubbles: true }));

      await waitForUpload();
      const call = window.parent.postMessage.mock.calls[0][0];
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'artifact-image-upload-result',
          requestId: call.requestId,
          url: 'https://files.example.com/uploaded-123.png',
        },
      }));
      expect(imageElement().uploadedImageUrl).toBe('https://files.example.com/uploaded-123.png');
      expect(imageElement().deckAsset).toBeUndefined();
      expect(isOpen()).toBe(false);
    });

    it('ignores a result whose requestId does not match the in-flight upload', async () => {
      window.CanvasImageEditor.open(2);
      const file = new File(['abc'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(fileInput(), 'files', { value: [file] });
      fileInput().dispatchEvent(new Event('change', { bubbles: true }));

      await waitForUpload();
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'artifact-image-upload-result',
          requestId: 'some-other-request',
          url: 'https://files.example.com/should-not-apply.png',
        },
      }));
      expect(imageElement().uploadedImageUrl).toBeUndefined();
    });

    it('shows an error status and does not close on an error result', async () => {
      window.CanvasImageEditor.open(2);
      const file = new File(['abc'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(fileInput(), 'files', { value: [file] });
      fileInput().dispatchEvent(new Event('change', { bubbles: true }));

      await waitForUpload();
      const call = window.parent.postMessage.mock.calls[0][0];
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'artifact-image-upload-result',
          requestId: call.requestId,
          error: 'Unsupported file type',
        },
      }));
      expect(isOpen()).toBe(true);
      expect(overlay().querySelector('[data-image-editor="upload-status"]').textContent).toContain(
        'Unsupported file type',
      );
    });
  });
});
