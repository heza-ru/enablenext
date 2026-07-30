require('../canvas-autosave.js');

describe('CanvasAutosave.onDeckChanged', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.DECK = { title: 'T', slides: [] };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.DECK;
  });

  it('debounces rapid calls within the 1s window into a single post', () => {
    const postMessage = jest.fn();
    window.parent = { postMessage };

    window.CanvasAutosave.onDeckChanged();
    jest.advanceTimersByTime(300);
    window.CanvasAutosave.onDeckChanged();
    jest.advanceTimersByTime(300);
    window.CanvasAutosave.onDeckChanged();

    // Still within the debounce window of the last call — nothing posted yet.
    expect(postMessage).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('posts the artifact-deck-updated shape with the current window.DECK', () => {
    const postMessage = jest.fn();
    window.parent = { postMessage };

    window.CanvasAutosave.onDeckChanged();
    jest.advanceTimersByTime(1000);

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-deck-updated', deck: window.DECK },
      '*',
    );
  });

  it('fires again for a later, separate burst of changes after the first debounce settled', () => {
    const postMessage = jest.fn();
    window.parent = { postMessage };

    window.CanvasAutosave.onDeckChanged();
    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(1);

    window.CanvasAutosave.onDeckChanged();
    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('captures window.DECK as of when the debounce actually fires, not when onDeckChanged was first called', () => {
    const postMessage = jest.fn();
    window.parent = { postMessage };

    window.CanvasAutosave.onDeckChanged();
    window.DECK = { title: 'Changed', slides: [] };
    jest.advanceTimersByTime(1000);

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-deck-updated', deck: { title: 'Changed', slides: [] } },
      '*',
    );
  });

  it('wires itself up via window.CanvasEditor.onChange when CanvasEditor is present', () => {
    // canvas-autosave.js registers onDeckChanged with CanvasEditor.onChange at
    // load time (guarded). Simulate a fresh load with CanvasEditor present.
    delete window.CanvasAutosave;
    jest.resetModules();
    const registered = [];
    window.CanvasEditor = { onChange: (cb) => registered.push(cb) };
    require('../canvas-autosave.js');
    expect(registered).toContain(window.CanvasAutosave.onDeckChanged);
    delete window.CanvasEditor;
  });
});
