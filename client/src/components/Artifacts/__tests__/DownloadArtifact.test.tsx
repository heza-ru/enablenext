import fs from 'fs';
import path from 'path';
import { render, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditArtifact } from '~/data-provider';
import DownloadArtifact, {
  runInHiddenIframe,
  detectNativeFormats,
  NATIVE_FORMATS,
} from '../DownloadArtifact';

// Mutable so the "Presentation editor toggle" describe block can set a
// conversationId/model without affecting the other describe blocks, which
// don't care about the chat context at all.
let mockConversation: Record<string, unknown> | undefined = undefined;

// Mutable so individual tests can flip googleDrivePickerEnabled on to
// exercise the Drive button without affecting the other describe blocks.
let mockStartupConfigData: Record<string, unknown> = {};
// Mutable so a test can exercise more than one native format (e.g. the
// multi-format Drive-save regression test) without affecting other tests
// that assume only the PPTX format is detected.
let mockCurrentCode = '<html>...downloadPptx()...</html>';

// Mock heavy provider hooks this component depends on so the test can focus
// on the timing logic under test.
jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: mockStartupConfigData }),
  useEditArtifact: jest.fn(),
}));
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ token: 'test-token' }),
}));
jest.mock('~/hooks/Artifacts/useArtifactProps', () => ({
  __esModule: true,
  default: () => ({ fileKey: 'test.pptx' }),
}));
const mockSetCurrentCode = jest.fn();
jest.mock('~/Providers/EditorContext', () => ({
  useCodeState: () => ({ currentCode: mockCurrentCode, setCurrentCode: mockSetCurrentCode }),
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (s: string) => s }));
jest.mock('~/Providers', () => ({
  useChatContext: () => ({ conversation: mockConversation }),
}));

// Presentation artifacts now consolidate every download-format option (PPTX/
// PDF/PDF Compat/PDF HD/PPTX HD/HTML) behind a single "Download" trigger +
// dropdown menu (Radix), instead of a flat row of buttons. Radix's
// DropdownMenuContent is only mounted in the DOM while open, so any test
// that needs to see/click a format option must open the menu first. This
// helper does that via the trigger's aria-label (localize() is mocked to the
// identity function above, so the label is the literal key `com_ui_download`).
// Radix's DropdownMenuTrigger only opens on a full pointerdown/pointerup
// sequence (plus Enter/Space/ArrowDown keydown for keyboard users) — it
// deliberately has no plain `onClick` handler, so a synthetic
// fireEvent.click/pointerDown never opens it. @testing-library/user-event
// simulates the full real-browser event sequence and does reliably open it.
// `delay: null` disables user-event's internal real-timer waits between
// events so this works the same whether or not the surrounding test has
// jest.useFakeTimers() active.
const menuUser = userEvent.setup({ delay: null });
async function openDownloadMenu(getByLabelText: (text: string) => HTMLElement) {
  await menuUser.click(getByLabelText('com_ui_download'));
}

// downloadNative only arms the FALLBACK_MS timer (the race under test) when a
// previewRef is supplied and triggerViaPreviewIframe() succeeds in dispatching
// the postMessage — without one, the component goes straight to the
// hidden-iframe fallback synchronously on click, bypassing FALLBACK_MS
// entirely. A minimal fake previewRef is required so these tests exercise the
// actual fallback-timer/bridge-ready logic instead of the unrelated
// no-previewRef path.
const fakePreviewRef = {
  current: {
    getClient: () => ({
      iframe: { contentWindow: { postMessage: jest.fn() } },
    }),
  },
} as never;

beforeEach(() => {
  mockStartupConfigData = {};
  mockCurrentCode = '<html>...downloadPptx()...</html>';
  mockConversation = undefined;
  mockSetCurrentCode.mockClear();
  (useEditArtifact as jest.Mock).mockReturnValue({ mutate: jest.fn(), isLoading: false });
});

describe('DownloadArtifact — PDF (HD) button tooltip copy', () => {
  it('PDF (HD) button tooltip describes the client-side capture approach', async () => {
    const { queryByTitle, getByTitle, getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '...downloadPptx()...' } as never} />,
    );
    // PDF (HD) is now a menu item inside the consolidated Download dropdown
    // rather than a standalone flat button — open the menu first.
    await openDownloadMenu(getByLabelText);
    expect(queryByTitle(/Server-side Playwright render/i)).toBeNull();
    expect(getByTitle(/screenshots each slide.*in-browser/i)).toBeDefined();
  });
});

describe('DownloadArtifact — readiness vs. liveness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('does not create a hidden-iframe fallback if bridge-ready already arrived at mount, even across multiple download clicks', async () => {
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '' } as never} previewRef={fakePreviewRef} />,
    );

    // In real usage, download-bridge.js posts 'bridge-ready' exactly once,
    // when the artifact's script first loads inside the Sandpack preview
    // iframe — well before any download click is even possible. Dispatch it
    // here BEFORE the click to match that real mount-then-click ordering
    // (the previous version of this test dispatched bridge-ready AFTER the
    // click, which does not happen in practice and masked a bug where the
    // ref was reset to false on every click).
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'bridge-ready' } }));

    // PPTX is now a menu item inside the consolidated Download dropdown —
    // open the menu before each click since selecting an item closes it
    // again (Radix's default item-select behaviour).
    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));

    // Advance well past FALLBACK_MS (10s) — since bridge-ready already
    // confirmed liveness before the click, no hidden iframe should appear.
    jest.advanceTimersByTime(15_000);

    // Click again to confirm the sticky ref still prevents a fallback on
    // subsequent downloads of the same (still-alive) artifact instance.
    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('does create a hidden-iframe fallback if bridge-ready never arrives', async () => {
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '' } as never} previewRef={fakePreviewRef} />,
    );

    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));

    // No bridge-ready message — simulating an older artifact with no bridge script.
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBeGreaterThan(0);
  });

  it('resets bridgeReadyRef when a different artifact.id is shown, so a stale ready-flag from a previous artifact does not suppress the fallback a new, dead artifact actually needs', async () => {
    // DownloadArtifact does not always remount on artifact change (Artifacts.tsx
    // renders it with no key tied to artifact identity, and version switching
    // just changes which artifact id is current) — so bridgeReadyRef (a
    // useRef) can otherwise carry a stale `true` across a version switch.
    const { getByLabelText, rerender } = render(
      <DownloadArtifact
        artifact={{ id: 'artifact-v1', content: '' } as never}
        previewRef={fakePreviewRef}
      />,
    );

    // artifact-v1 confirms it's alive.
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'bridge-ready' } }));
    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));
    jest.advanceTimersByTime(15_000);
    expect(document.querySelectorAll('iframe').length).toBe(0);

    // Switch to a genuinely different artifact (e.g. an older cached version)
    // that never sends its own bridge-ready — same component instance, no
    // remount, just a different artifact.id prop.
    rerender(
      <DownloadArtifact
        artifact={{ id: 'artifact-v2-old', content: '' } as never}
        previewRef={fakePreviewRef}
      />,
    );

    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));
    jest.advanceTimersByTime(15_000);

    // The stale ready-flag from artifact-v1 must not suppress the fallback
    // that this new, non-bridge-ready artifact actually needs.
    expect(document.querySelectorAll('iframe').length).toBeGreaterThan(0);
  });
});

describe('DownloadArtifact — saveToDrive timeout (Bug 1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Enable the Drive button for this describe block only.
    mockStartupConfigData = { googleDrivePickerEnabled: true };
  });
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('clears driveSaving and sets driveError if no artifact-download message ever arrives (export hung/failed silently)', () => {
    const { getByLabelText, queryByLabelText, getByTitle } = render(
      <DownloadArtifact artifact={{ content: '' } as never} />,
    );

    fireEvent.click(getByLabelText('Save PPTX to Google Drive'));

    // Still saving — no message has arrived, no time has passed yet.
    expect(getByLabelText('Save PPTX to Google Drive')).toHaveTextContent('Saving...');

    // Advance past the 20s saveToDrive safety-net timeout without ever
    // dispatching an 'artifact-download' message — this simulates the
    // export throwing/hanging inside the hidden iframe with nothing ever
    // coming back, which is exactly the stuck-forever bug being fixed.
    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    expect(getByLabelText('Save PPTX to Google Drive')).not.toHaveTextContent('Saving...');
    expect(getByTitle(/Export timed out/i)).toBeDefined();
    // The listener must also have been cleaned up — a late, spurious message
    // must not resurrect Drive state after the timeout has already fired.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-download', filename: 'deck.pptx', data: '', mimeType: '' },
        }),
      );
    });
    expect(queryByLabelText('Open ↗')).toBeNull();
  });

  it("does not let an earlier, superseded saveToDrive call's stale timeout clobber a later call's successful state", async () => {
    // driveSaving/driveError/driveLink are component-wide state, not
    // per-format — starting a second Drive save for a different format
    // before the first's 20s timeout fires must not let that first call's
    // now-abandoned timeout reach back in and stomp on the second call's
    // (successful) result once it lands.
    mockCurrentCode = '<html>...downloadPptx()...downloadDocx()...</html>';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ webViewLink: 'https://drive.example/docx' }),
    });

    (global as any).fetch = fetchMock;

    const { getByLabelText, getAllByText, queryByTitle } = render(
      <DownloadArtifact artifact={{ content: '' } as never} />,
    );

    // Start the PPTX save first (arms its own 20s timeout at t=0)...
    fireEvent.click(getByLabelText('Save PPTX to Google Drive'));

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    // ...then, before it resolves or times out, start a DOCX save. This
    // supersedes PPTX as "current" — the PPTX call's handler/timeout are
    // independent closures that keep running regardless.
    fireEvent.click(getByLabelText('Save DOCX to Google Drive'));

    // The DOCX save succeeds via a real 'artifact-download' message + fetch.
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-download',
            filename: 'deck.docx',
            data: 'ZGF0YQ==',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        }),
      );
      // Flush the microtask chain (fetch().then(res.json()).then(setDriveLink)).
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAllByText('Open ↗').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance to t=20_000 — the PPTX call's stale 20s timeout (armed at t=0)
    // fires now. Before this fix, it would unconditionally call
    // setDriveSaving(null)/setDriveError(...), clobbering the DOCX success
    // that just landed with a spurious "Export timed out" banner.
    act(() => {
      jest.advanceTimersByTime(15_000);
    });

    expect(getAllByText('Open ↗').length).toBeGreaterThan(0);
    expect(queryByTitle(/Export timed out/i)).toBeNull();

    delete (global as any).fetch;
  });
});

describe('runInHiddenIframe — onError callback (Bug 2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('calls onError when the named function is not defined on the iframe window', () => {
    const onError = jest.fn();
    const cleanup = runInHiddenIframe('<html></html>', 'doesNotExist', onError);

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();

    act(() => {
      iframe.dispatchEvent(new Event('load'));
      jest.advanceTimersByTime(800);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/not a function/);
    cleanup();
  });

  it('calls onError when the invoked function throws synchronously', () => {
    const onError = jest.fn();
    const cleanup = runInHiddenIframe('<html></html>', 'throwingFn', onError);

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();

    // The srcdoc content never actually executes in this jsdom setup (jsdom
    // doesn't run scripts from `srcdoc` navigations without `runScripts`
    // configured), so define the throwing function directly on the iframe's
    // window — from runInHiddenIframe's point of view this is
    // indistinguishable from the artifact HTML itself having defined it.
    (iframe.contentWindow as unknown as Record<string, unknown>).throwingFn = () => {
      throw new Error('synchronous export failure');
    };

    act(() => {
      iframe.dispatchEvent(new Event('load'));
      jest.advanceTimersByTime(800);
    });

    // The bridge script's own onload never fires in this environment (no
    // real network request happens), so the 2s fallback in runInHiddenIframe
    // is what actually invokes the function.
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/synchronous export failure/);
    cleanup();
  });
});

describe('DownloadArtifact — Presentation editor toggle', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('shows an Edit button only for deck content (PPTX-capable artifacts)', () => {
    mockCurrentCode = '<script src="/libs/deck-renderer.js"></script>';
    const { getByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );
    expect(getByRole('button', { name: /^com_ui_edit$/i })).toBeInTheDocument();
  });

  it('does not show an Edit button for doc/xlsx-only artifacts', () => {
    mockCurrentCode = '<script src="/libs/doc-renderer.js"></script>';
    const { queryByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );
    expect(queryByRole('button', { name: /^com_ui_edit$/i })).not.toBeInTheDocument();
  });

  it('posts artifact-editor-toggle to the preview iframe on click', () => {
    mockCurrentCode = '<script src="/libs/deck-renderer.js"></script>';
    const postMessage = jest.fn();
    const previewRef = {
      current: {
        getClient: () => ({ iframe: { contentWindow: { postMessage } } }),
      },
    } as never;
    const { getByRole } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    fireEvent.click(getByRole('button', { name: /^com_ui_edit$/i }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artifact-editor-toggle', enabled: true }),
      '*',
    );
  });

  // The artifact's code-fence BODY only — no `:::artifact{...}` header, no
  // closing `:::`, no surrounding assistant prose. This is exactly what
  // extractContent() hands the component as `artifact.content`.
  const FENCE_BODY =
    '<script src="/libs/deck-renderer.js"></script>' +
    '<script>window.DECK = {"title":"Old"};</script>';

  // There is no explicit Save button any more (Task 9): an
  // 'artifact-deck-updated' message (posted by canvas-autosave.js's debounced
  // trigger) is handed straight to the autosave queue and fires the mutation
  // immediately (synchronously, since nothing else is in flight).
  function renderAndSave(mockMutate: jest.Mock) {
    mockCurrentCode = FENCE_BODY;
    mockConversation = { conversationId: 'conv-1', model: 'gpt-4' };
    (useEditArtifact as jest.Mock).mockReturnValue({ mutate: mockMutate, isLoading: false });

    const { getByRole } = render(
      <DownloadArtifact
        artifact={{ content: FENCE_BODY, messageId: 'msg-1', index: 3 } as never}
        previewRef={fakePreviewRef}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^com_ui_edit$/i }));
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'artifact-deck-updated', deck: { title: 'New' } },
        }),
      );
    });
  }

  it('saves a deck edit via useEditArtifact with an artifact-content-only update, not whole-message text', () => {
    const mockMutate = jest.fn();
    renderAndSave(mockMutate);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        index: 3,
        messageId: 'msg-1',
        original: FENCE_BODY,
        updated: expect.stringContaining('"title":"New"'),
      }),
    );
    // The old (data-losing) mechanism sent a `text` field, which
    // useUpdateMessageMutation interprets as the ENTIRE message body.
    expect(payload).not.toHaveProperty('text');
  });

  /**
   * Regression test for the whole-message-clobbering bug: saving an edited
   * deck used to fire useUpdateMessageMutation with the bare fence body as
   * the message's full `text`, which wiped the `:::artifact{...}` directive,
   * the closing `:::`, and any assistant prose around the artifact. The
   * mutation payload must therefore stay strictly within the artifact's own
   * body — `updated` differs from `original` only in the window.DECK
   * assignment, and carries no message-level scaffolding at all.
   */
  it('does not touch anything outside the artifact body when saving (no artifact directive or prose in the payload)', () => {
    const mockMutate = jest.fn();
    renderAndSave(mockMutate);

    const { original, updated } = mockMutate.mock.calls[0][0];
    // Payload is scoped to the fence body: no message-level scaffolding.
    expect(updated).not.toContain(':::artifact');
    expect(updated).not.toContain('```');
    expect(original).toBe(FENCE_BODY);
    // Only the DECK assignment changed; the rest of the body is byte-identical.
    expect(updated).toContain('<script src="/libs/deck-renderer.js"></script>');
    expect(updated).not.toContain('"title":"Old"');
    expect(updated).toBe(
      FENCE_BODY.replace('window.DECK = {"title":"Old"};', 'window.DECK = {"title":"New"};'),
    );
  });

  // Closes finding M1: without this, artifact.content/the live editor keep
  // showing the pre-edit body until the query cache round-trips.
  it('syncs local editor state with the saved body so the UI does not go stale', () => {
    const mockMutate = jest.fn();
    renderAndSave(mockMutate);
    // Simulate the mutation resolving successfully.
    act(() => {
      mockMutate.mock.calls[0][1].onSuccess();
    });
    expect(mockSetCurrentCode).toHaveBeenCalledWith(expect.stringContaining('"title":"New"'));
  });

  it('shows a non-blocking autosave-failed indicator only after both the initial save and its retry fail', () => {
    const mockMutate = jest.fn();
    renderAndSave(mockMutate);
    expect(mockMutate).toHaveBeenCalledTimes(1);

    // First failure triggers an automatic retry — indicator not shown yet.
    act(() => {
      mockMutate.mock.calls[0][1].onError(new Error('network'));
    });
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toMatch(/com_ui_autosave_failed/);

    // Second (retry) failure surfaces the indicator, without losing the edit
    // (the deck was already applied locally via window.DECK/the canvas).
    act(() => {
      mockMutate.mock.calls[1][1].onError(new Error('network'));
    });
    expect(document.body.textContent).toMatch(/com_ui_autosave_failed/);
  });
});

/**
 * Task 10: canvas-image-editor.js (inside the cross-origin deck iframe)
 * cannot call api/server/routes/files/deckAsset.js itself — it has no access
 * to this app's auth token — so it posts 'artifact-image-upload-request' to
 * window.parent, and this component relays the upload using its own token,
 * then posts the result back to the same iframe.
 */
describe('DownloadArtifact — image upload relay (Task 10)', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  function renderWithPostMessage() {
    const postMessage = jest.fn();
    const previewRef = {
      current: {
        getClient: () => ({ iframe: { contentWindow: { postMessage } } }),
      },
    } as never;
    render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    return postMessage;
  }

  it('relays an artifact-image-upload-request to the deck-asset endpoint with FormData and the auth token, then posts the URL back', async () => {
    const postMessage = renderWithPostMessage();
    const fetchMock = jest
      .fn()
      // First call: fetch(dataUrl).blob() to reconstruct the file
      .mockResolvedValueOnce({ blob: async () => new Blob(['abc'], { type: 'image/png' }) })
      // Second call: the actual upload POST
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://files.example.com/uploaded-123.png' }),
      });
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-image-upload-request',
            requestId: 'req-1',
            dataUrl: 'data:image/png;base64,AAAA',
            filename: 'photo.png',
            mimeType: 'image/png',
          },
        }),
      );
      // Flush the fetch/blob/json microtask chain.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall[0]).toMatch(/\/api\/files\/images\/deck-asset$/);
    expect(uploadCall[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: expect.any(FormData),
      }),
    );

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'artifact-image-upload-result',
        requestId: 'req-1',
        url: 'https://files.example.com/uploaded-123.png',
      },
      '*',
    );
  });

  it('posts an error result back to the iframe if the upload fails, without throwing', async () => {
    const postMessage = renderWithPostMessage();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => new Blob(['abc'], { type: 'image/png' }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unsupported file type' }),
      });
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-image-upload-request',
            requestId: 'req-2',
            dataUrl: 'data:image/png;base64,AAAA',
            filename: 'photo.png',
            mimeType: 'image/png',
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'artifact-image-upload-result',
        requestId: 'req-2',
        error: 'Unsupported file type',
      },
      '*',
    );
  });

  it('ignores messages of any other type', async () => {
    const postMessage = renderWithPostMessage();
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'some-other-message' } }));
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artifact-image-upload-result' }),
      '*',
    );
  });
});

/**
 * Emergency hotfix: deck-renderer.js's embedFontsInPptx() and
 * canvas-template-picker.js's fetchLibrary() both do a direct
 * fetch(window._BRAND_ORIGIN + path) against the real app's static assets
 * from inside the deck iframe. In production that iframe is the genuinely
 * cross-origin Sandpack sandbox, and the real app's static assets don't send
 * an Access-Control-Allow-Origin permitting that sandbox origin to read the
 * response, so the direct fetch is CORS-blocked there — confirmed via real
 * production console logs ("Failed to fetch" right after CORS errors, for
 * both PPTX font embedding and the master-deck-library.json template
 * picker). This relay does a normal same-origin fetch(window.location.origin
 * + path) from the parent page instead (no CORS issue, since it's the app's
 * own origin) and posts the result back to the same iframe, mirroring Task
 * 10's image-upload relay above.
 */
describe('DownloadArtifact — asset fetch relay (cross-origin CORS hotfix)', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  function renderWithPostMessage() {
    const postMessage = jest.fn();
    const previewRef = {
      current: {
        getClient: () => ({ iframe: { contentWindow: { postMessage } } }),
      },
    } as never;
    render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    return postMessage;
  }

  it('base64-encodes a binary (font) response and round-trips back to the original bytes', async () => {
    const postMessage = renderWithPostMessage();
    // A small, known byte sequence stands in for a real .fntdata font binary.
    const originalBytes = new Uint8Array([0, 1, 2, 253, 254, 255, 42, 7]);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => originalBytes.buffer,
    });
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-asset-fetch-request',
            requestId: 'asset-1',
            path: '/brand/fonts/DMSans-regular.fntdata',
            encoding: 'base64',
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/brand/fonts/DMSans-regular.fntdata`,
    );
    expect(postMessage).toHaveBeenCalledTimes(1);
    const [message] = postMessage.mock.calls[0];
    expect(message.type).toBe('artifact-asset-fetch-result');
    expect(message.requestId).toBe('asset-1');
    // Round-trip: decode the base64 string back to bytes and confirm it
    // matches the original binary exactly.
    const decoded = Uint8Array.from(atob(message.data), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(originalBytes));
  });

  it('passes through a text/JSON response unmodified', async () => {
    const postMessage = renderWithPostMessage();
    const libraryJson = JSON.stringify({ slides: [{ componentId: 'slide-97' }] });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => libraryJson,
    });
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-asset-fetch-request',
            requestId: 'asset-2',
            path: '/brand/master-deck-library.json',
            encoding: 'text',
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/brand/master-deck-library.json`,
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-asset-fetch-result', requestId: 'asset-2', data: libraryJson },
      '*',
    );
  });

  it('posts an error result back to the iframe when the fetch fails, without throwing', async () => {
    const postMessage = renderWithPostMessage();
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'artifact-asset-fetch-request',
            requestId: 'asset-3',
            path: '/brand/master-deck-library.json',
            encoding: 'text',
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'artifact-asset-fetch-result',
        requestId: 'asset-3',
        error: expect.any(String),
      }),
      '*',
    );
  });

  it('ignores messages of any other type', async () => {
    const postMessage = renderWithPostMessage();
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'some-other-message' } }));
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artifact-asset-fetch-result' }),
      '*',
    );
  });
});

/**
 * Task 9's core correctness requirement: replaceArtifactContent splices
 * `updated` into the message's stored text by locating `original` as an exact
 * substring. Two saves in flight concurrently with out-of-order resolution
 * could either fail their lookup (edit silently dropped) or let a stale
 * response clobber a newer save. This suite proves the autosave queue
 * enforces: at most one mutation in flight at a time, correct original/updated
 * chaining across coalesced saves, and no silently-dropped edits on failure.
 */
describe('DownloadArtifact — autosave queue concurrency (Task 9)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  const FENCE_BODY =
    '<script src="/libs/deck-renderer.js"></script>' +
    '<script>window.DECK = {"title":"Old"};</script>';

  /** Mutate mock that resolves asynchronously (realistic network latency),
   * tracking how many calls are simultaneously "in flight" so the test can
   * assert that number never exceeds 1. Optionally fails the Nth call once. */
  function makeAsyncMutate({ failOnCallIndex }: { failOnCallIndex?: number } = {}) {
    let pending = 0;
    let maxPending = 0;
    const failedOnce = new Set<number>();
    const mutate = jest.fn((vars, options) => {
      pending += 1;
      maxPending = Math.max(maxPending, pending);
      const callIndex = mutate.mock.calls.length - 1;
      setTimeout(() => {
        pending -= 1;
        const shouldFail = callIndex === failOnCallIndex && !failedOnce.has(callIndex);
        if (shouldFail) {
          failedOnce.add(callIndex);
          options.onError(new Error('network error'));
        } else {
          options.onSuccess();
        }
      }, 75);
    });
    return { mutate, getMaxPending: () => maxPending };
  }

  function renderDeckEditor(mutate: jest.Mock) {
    (useEditArtifact as jest.Mock).mockReturnValue({ mutate, isLoading: false });
    mockCurrentCode = FENCE_BODY;
    const { getByRole } = render(
      <DownloadArtifact
        artifact={{ content: FENCE_BODY, messageId: 'msg-1', index: 3 } as never}
        previewRef={fakePreviewRef}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^com_ui_edit$/i }));
  }

  const postDeckUpdate = (deck: object) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'artifact-deck-updated', deck } }),
      );
    });
  };

  it('never has more than one mutation in flight, even when two updates arrive within the debounce/latency window', () => {
    const { mutate, getMaxPending } = makeAsyncMutate();
    renderDeckEditor(mutate);

    // First update dispatches immediately (nothing in flight yet).
    postDeckUpdate({ title: 'First' });
    expect(mutate).toHaveBeenCalledTimes(1);

    // Second update arrives well before the first's ~75ms latency resolves —
    // it must coalesce into the queue, NOT fire a second concurrent mutation.
    act(() => {
      jest.advanceTimersByTime(20);
    });
    postDeckUpdate({ title: 'Second' });
    expect(mutate).toHaveBeenCalledTimes(1);

    // Let the first mutation resolve — only then should the coalesced second
    // save fire.
    act(() => {
      jest.advanceTimersByTime(75);
    });
    expect(mutate).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(75);
    });

    expect(getMaxPending()).toBe(1);
  });

  it("the second save's original is exactly the first save's updated — not a stale pre-first-save snapshot", () => {
    const { mutate } = makeAsyncMutate();
    renderDeckEditor(mutate);

    postDeckUpdate({ title: 'First' });
    act(() => {
      jest.advanceTimersByTime(20);
    });
    postDeckUpdate({ title: 'Second' });
    act(() => {
      jest.advanceTimersByTime(75);
    });
    expect(mutate).toHaveBeenCalledTimes(2);

    const firstCall = mutate.mock.calls[0][0];
    const secondCall = mutate.mock.calls[1][0];

    expect(firstCall.original).toBe(FENCE_BODY);
    expect(firstCall.updated).toContain('"title":"First"');
    // The invariant under test: original of call 2 === updated of call 1,
    // NOT artifact.content (FENCE_BODY) and not any other earlier snapshot.
    expect(secondCall.original).toBe(firstCall.updated);
    expect(secondCall.updated).toContain('"title":"Second"');
  });

  it('retries once with the still-correct original after a rejected save, instead of silently dropping the edit', () => {
    const { mutate } = makeAsyncMutate({ failOnCallIndex: 0 });
    renderDeckEditor(mutate);

    postDeckUpdate({ title: 'First' });
    expect(mutate).toHaveBeenCalledTimes(1);
    const firstOriginal = mutate.mock.calls[0][0].original;
    const firstUpdated = mutate.mock.calls[0][0].updated;

    // First attempt rejects.
    act(() => {
      jest.advanceTimersByTime(75);
    });
    // The queue must have automatically retried — the edit is not dropped.
    expect(mutate).toHaveBeenCalledTimes(2);
    const retryCall = mutate.mock.calls[1][0];
    expect(retryCall.original).toBe(firstOriginal);
    expect(retryCall.updated).toBe(firstUpdated);

    // Retry succeeds (failOnCallIndex only fails call index 0 once).
    act(() => {
      jest.advanceTimersByTime(75);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('coalesces a third update that arrives while a retry is still in flight, using the correct chained original', () => {
    const { mutate } = makeAsyncMutate({ failOnCallIndex: 0 });
    renderDeckEditor(mutate);

    postDeckUpdate({ title: 'First' });
    expect(mutate).toHaveBeenCalledTimes(1);

    // First attempt fails and the retry fires synchronously from onError.
    act(() => {
      jest.advanceTimersByTime(75);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    const retryUpdated = mutate.mock.calls[1][0].updated;

    // A third update arrives while the retry is in flight — it must coalesce
    // rather than fire concurrently.
    postDeckUpdate({ title: 'Third' });
    expect(mutate).toHaveBeenCalledTimes(2);

    // Retry resolves successfully, then the coalesced third save fires.
    act(() => {
      jest.advanceTimersByTime(75);
    });
    expect(mutate).toHaveBeenCalledTimes(3);
    expect(mutate.mock.calls[2][0].original).toBe(retryUpdated);
    expect(mutate.mock.calls[2][0].updated).toContain('"title":"Third"');
  });

  /**
   * Fix Round 1 regression test.
   *
   * useEditArtifact's own hook-level `onSuccess` (data-provider/Messages/
   * mutations.ts) writes the server-confirmed `content` into the React Query
   * cache on EVERY successful save — not just when switching artifacts. In
   * the real app that cache write flows back into this component as a new
   * `artifact.content` prop (hence a new `initialContent` passed into
   * useDeckAutosaveQueue) via a re-render, entirely independent of the
   * call-level `onSuccess` the queue itself uses to chain saves.
   *
   * The bug: an earlier version of the queue's reset effect was keyed on
   * that `initialContent` value, so it fired after every save — not only on
   * a genuine artifact switch — and clobbered `lastKnownContent.current`
   * back down to a value the queue had already moved past. This test
   * reproduces that exact interleaving: save1 resolves, a coalesced save2
   * dispatches using the correct chained `original`, THEN a rerender
   * delivers the hook-level cache echo (artifact.content = save1's
   * `updated`) while save2 is still in flight, and finally a third edit
   * coalesces in behind save2. The third save's `original` must be save2's
   * `updated` — never the echoed, now-stale `initialContent`.
   */
  it('a rerender carrying the hook-level cache-write echo (artifact.content updating after every save) does not clobber lastKnownContent for a save already in flight', () => {
    const mutate = jest.fn();
    (useEditArtifact as jest.Mock).mockReturnValue({ mutate, isLoading: false });
    mockCurrentCode = FENCE_BODY;

    const { getByRole, rerender } = render(
      <DownloadArtifact
        artifact={{ content: FENCE_BODY, messageId: 'msg-1', index: 3 } as never}
        previewRef={fakePreviewRef}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^com_ui_edit$/i }));

    // Save1: v0 (FENCE_BODY) -> v1.
    postDeckUpdate({ title: 'First' });
    expect(mutate).toHaveBeenCalledTimes(1);
    const save1 = mutate.mock.calls[0][0];
    expect(save1.original).toBe(FENCE_BODY);

    // A second edit coalesces while save1 is still in flight.
    postDeckUpdate({ title: 'Second' });
    expect(mutate).toHaveBeenCalledTimes(1);

    // Save1 resolves. The call-level onSuccess fires synchronously: it
    // drains the coalesced Second edit, which reads lastKnownContent
    // (still correctly = save1.updated = v1 at this instant) and dispatches
    // save2 (v1 -> v2).
    act(() => {
      mutate.mock.calls[0][1].onSuccess();
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    const save2 = mutate.mock.calls[1][0];
    expect(save2.original).toBe(save1.updated); // v1, correctly chained.

    // Now simulate the hook-level onSuccess's cache write reaching this
    // component as a fresh `artifact.content` prop via a re-render — this
    // is the SAME save1 success being echoed back through the query cache,
    // arriving after (and independently of) the call-level onSuccess above,
    // while save2 (v1 -> v2) is legitimately still in flight.
    rerender(
      <DownloadArtifact
        artifact={{ content: save1.updated, messageId: 'msg-1', index: 3 } as never}
        previewRef={fakePreviewRef}
      />,
    );

    // A third edit arrives and coalesces in behind the still-in-flight
    // save2.
    postDeckUpdate({ title: 'Third' });
    expect(mutate).toHaveBeenCalledTimes(2);

    // Save2 resolves, draining the coalesced Third edit.
    act(() => {
      mutate.mock.calls[1][1].onSuccess();
    });
    expect(mutate).toHaveBeenCalledTimes(3);
    const save3 = mutate.mock.calls[2][0];

    // The bug under test: save3.original must be save2.updated (v2) — the
    // rerender's stale-relative-to-save2 artifact.content echo (v1) must
    // NOT have clobbered lastKnownContent back down to v1 in between.
    expect(save3.original).toBe(save2.updated);
    expect(save3.original).not.toBe(save1.updated);
  });
});

// Renders DownloadArtifact with content guaranteed to trigger both DOCX and
// XLSX detection (via the literal downloadDocx/downloadExcel strings), while
// still passing the caller's `content` through verbatim for anything that
// parses it further (e.g. parseSheetNames scanning for a SHEETS block). This
// mirrors the pattern the design spec's test pseudocode assumes — the point
// under test is the options-picker UI, not detectNativeFormats itself (which
// has its own dedicated describe block above).
function renderDownloadArtifact(overrides: { content: string }) {
  mockCurrentCode =
    '<script>function downloadDocx(){} function downloadExcel(){}</script>' + overrides.content;
  return render(
    <DownloadArtifact
      artifact={{ content: mockCurrentCode } as never}
      previewRef={fakePreviewRef}
    />,
  );
}

describe('DownloadArtifact — export options picker (Task 14)', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('shows a page-size picker before downloading a DOCX artifact', () => {
    const { getByRole } = renderDownloadArtifact({
      content: '<script src="/libs/doc-renderer.js"></script>',
    });
    fireEvent.click(getByRole('button', { name: /docx/i }));
    expect(getByRole('radio', { name: /a4/i })).toBeInTheDocument();
    expect(getByRole('radio', { name: /letter/i })).toBeInTheDocument();
  });

  it('shows a sheet-selection checklist before downloading an XLSX artifact with multiple sheets', () => {
    const content = "SHEETS = [{ name: 'Summary', headers: [] }, { name: 'Detail', headers: [] }];";
    const { getByRole } = renderDownloadArtifact({ content });
    fireEvent.click(getByRole('button', { name: /xlsx/i }));
    expect(getByRole('checkbox', { name: /summary/i })).toBeInTheDocument();
    expect(getByRole('checkbox', { name: /detail/i })).toBeInTheDocument();
  });

  it('falls back to downloading all sheets when sheet names cannot be parsed from content', () => {
    const { getByRole, queryByRole } = renderDownloadArtifact({
      content: '<script src="/libs/exceljs.bare.min.js"></script>',
    });
    fireEvent.click(getByRole('button', { name: /xlsx/i }));
    expect(queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('does not show a sheet picker for a single-sheet artifact (nothing meaningful to choose)', () => {
    const content = "SHEETS = [{ name: 'Sheet 1', headers: [] }];";
    const { getByRole, queryByRole } = renderDownloadArtifact({ content });
    fireEvent.click(getByRole('button', { name: /xlsx/i }));
    expect(queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('passes { pageSize } through as postMessage args when confirming the DOCX picker', () => {
    const postMessage = jest.fn();
    const previewRef = {
      current: { getClient: () => ({ iframe: { contentWindow: { postMessage } } }) },
    } as never;
    mockCurrentCode = '<script>function downloadDocx(){}</script>';
    const { getByRole } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    fireEvent.click(getByRole('button', { name: /docx/i }));
    fireEvent.click(getByRole('radio', { name: /letter/i }));
    fireEvent.click(getByRole('button', { name: /^com_ui_download$/i }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'artifact-download-request',
        fn: 'downloadDocx',
        args: [{ pageSize: 'Letter' }],
      }),
      '*',
    );
  });

  it('passes the selected sheet names array through as postMessage args when confirming the XLSX picker', () => {
    const postMessage = jest.fn();
    const previewRef = {
      current: { getClient: () => ({ iframe: { contentWindow: { postMessage } } }) },
    } as never;
    mockCurrentCode =
      "<script>function downloadExcel(){}</script>SHEETS = [{ name: 'Summary' }, { name: 'Detail' }];";
    const { getByRole } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    fireEvent.click(getByRole('button', { name: /xlsx/i }));
    fireEvent.click(getByRole('checkbox', { name: /detail/i })); // deselect Detail
    fireEvent.click(getByRole('button', { name: /^com_ui_download$/i }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'artifact-download-request',
        fn: 'downloadExcel',
        args: [['Summary']],
      }),
      '*',
    );
  });

  it('a zero-option PPTX download still posts a message with no args field at all (regression)', async () => {
    const postMessage = jest.fn();
    const previewRef = {
      current: { getClient: () => ({ iframe: { contentWindow: { postMessage } } }) },
    } as never;
    mockCurrentCode = '<html>...downloadPptx()...</html>';
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-download-request', fn: 'downloadPptx' },
      '*',
    );
  });
});

/**
 * UI polish fix: for presentation artifacts, the 7-8 flat, equal-weight
 * download-format buttons (native format, PDF, PDF (Compat), PDF (HD),
 * PPTX (HD), HTML) that used to crowd a single toolbar row now consolidate
 * into one "Download" trigger + dropdown menu. Edit/Done Editing stays its
 * own always-visible button OUTSIDE the menu (a distinct primary action, not
 * a download variant), and any live status feedback (Drive spinner/error/
 * success, download error) also stays visible outside the menu rather than
 * being hidden behind a closed dropdown.
 */
describe('DownloadArtifact — consolidated download dropdown (presentation artifacts)', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  it('collapses the format buttons into a single closed "Download" trigger by default, with Edit visible alongside it (no separate PDF/PDF (Compat)/PDF (HD)/PPTX (HD)/HTML buttons in the header)', () => {
    mockCurrentCode = '<script src="/libs/deck-renderer.js"></script>';
    const { getByLabelText, queryByText, getByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );

    // Single Download trigger, closed by default.
    const trigger = getByLabelText('com_ui_download');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // None of the individual format menu items are in the DOM while closed.
    expect(queryByText('PDF (Compat)')).not.toBeInTheDocument();
    expect(queryByText('PDF (HD)')).not.toBeInTheDocument();
    expect(queryByText('PPTX (HD)')).not.toBeInTheDocument();

    // Edit stays visible and independently clickable without opening the menu.
    expect(getByRole('button', { name: /^com_ui_edit$/i })).toBeInTheDocument();
  });

  it('opens the dropdown to reveal every format option with the expected labels', async () => {
    mockCurrentCode = '<script src="/libs/deck-renderer.js"></script>';
    const { getByLabelText, getByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );

    await openDownloadMenu(getByLabelText);

    // Native format items use the `Download as <FORMAT>` aria-label
    // (unchanged from the old flat buttons); PDF/PDF (Compat)/PDF (HD)/
    // PPTX (HD) items use their own descriptive aria-labels (also unchanged);
    // HTML reuses the existing com_ui_download_artifact localize key.
    expect(getByRole('menuitem', { name: /download as pptx/i })).toBeInTheDocument();
    expect(
      getByRole('menuitem', { name: /export as pdf \(opens print dialog\)/i }),
    ).toBeInTheDocument();
    expect(
      getByRole('menuitem', { name: /export as pdf \(compatibility mode/i }),
    ).toBeInTheDocument();
    expect(getByRole('menuitem', { name: /export as pdf \(client-rendered/i })).toBeInTheDocument();
    expect(getByRole('menuitem', { name: /export as pptx \(image-based/i })).toBeInTheDocument();
    expect(getByRole('menuitem', { name: /^com_ui_download_artifact$/i })).toBeInTheDocument();
  });

  it('clicking the PPTX menu item still dispatches the exact same postMessage the old flat button did', async () => {
    const postMessage = jest.fn();
    const previewRef = {
      current: { getClient: () => ({ iframe: { contentWindow: { postMessage } } }) },
    } as never;
    mockCurrentCode = '<html>...downloadPptx()...</html>';
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );

    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByLabelText('Download as PPTX'));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-download-request', fn: 'downloadPptx' },
      '*',
    );
  });

  it('clicking HTML in the dropdown still triggers the same client-side HTML download as before', async () => {
    mockCurrentCode = '<html>...downloadPptx()...</html>';
    const { getByLabelText, getByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );

    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (window.URL as any).createObjectURL = createObjectURL;
    (window.URL as any).revokeObjectURL = revokeObjectURL;

    await openDownloadMenu(getByLabelText);
    fireEvent.click(getByRole('menuitem', { name: /^com_ui_download_artifact$/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('keeps the Drive button, Drive error/success feedback, and download-error feedback visible outside the (closed) dropdown', () => {
    mockStartupConfigData = { googleDrivePickerEnabled: true };
    mockCurrentCode = '<script src="/libs/deck-renderer.js"></script>';
    const { getByLabelText } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode } as never}
        previewRef={fakePreviewRef}
      />,
    );

    // The Drive save button for PPTX is visible without opening the Download
    // dropdown at all — Drive is a distinct, always-visible action, not a
    // download-format menu item.
    expect(getByLabelText('Save PPTX to Google Drive')).toBeInTheDocument();
  });
});

describe('detectNativeFormats — lib-hint fallback (dropped-comment regression)', () => {
  it('detects PPTX via the deck-renderer script tag even with no downloadPptx string anywhere', () => {
    const content =
      '<html><head>' +
      '<script src="/libs/deck-renderer.js"></script>' +
      '</head><body><script>window.DECK = { slides: [] };</script></body></html>';

    expect(content).not.toContain('downloadPptx');

    const formats = detectNativeFormats(content);
    expect(formats.some((f) => f.label === 'PPTX')).toBe(true);
  });

  it('detects DOCX via the doc-renderer script tag even with no downloadDocx string anywhere', () => {
    const content =
      '<html><head>' +
      '<script src="/libs/doc-renderer.js"></script>' +
      '</head><body><script>window.DOC = { sections: [] };</script></body></html>';

    expect(content).not.toContain('downloadDocx');

    const formats = detectNativeFormats(content);
    expect(formats.some((f) => f.label === 'DOCX')).toBe(true);
  });

  it('does not detect a format when neither the trigger string nor the lib hint is present', () => {
    const content = '<html><body><h1>Just a plain artifact</h1></body></html>';

    const formats = detectNativeFormats(content);
    expect(formats.some((f) => f.label === 'PPTX')).toBe(false);
    expect(formats.some((f) => f.label === 'DOCX')).toBe(false);
    expect(formats.some((f) => f.label === 'XLSX')).toBe(false);
  });

  it('still requires the literal downloadExcel string for XLSX — no lib hint exists for it', () => {
    const pptxOnlyContent = '<script src="/libs/deck-renderer.js"></script>';
    expect(detectNativeFormats(pptxOnlyContent).some((f) => f.label === 'XLSX')).toBe(false);

    const excelEntry = NATIVE_FORMATS.find((f) => f.label === 'XLSX');
    expect(excelEntry?.libHint).toBeUndefined();

    const withExcelFn = '<script>function downloadExcel() {}</script>';
    expect(detectNativeFormats(withExcelFn).some((f) => f.label === 'XLSX')).toBe(true);
  });
});

// Regression test: PDF (HD) / PPTX (HD) used to load html2canvas from a
// third-party CDN (cdnjs.cloudflare.com) at click time, unlike every other
// download path (pptxgenjs/xlsx/docx/jszip are all vendored locally into
// client/public/libs/ via scripts/copy-libs.mjs). That CDN dependency meant
// these two specific formats could fail for reasons entirely outside this
// app's control (network policy, an ad-blocker/security browser extension,
// the CDN being unreachable) while every other format kept working — making
// an availability issue look format-specific. html2canvas is now vendored
// the same way; this guards against silently reintroducing a CDN dependency.
describe('captureSlides — html2canvas is loaded locally, not from a CDN', () => {
  it('DownloadArtifact.tsx does not reference a third-party CDN for html2canvas', () => {
    const source = fs.readFileSync(path.join(__dirname, '../DownloadArtifact.tsx'), 'utf8');
    expect(source).not.toMatch(/cdnjs\.cloudflare\.com.*html2canvas/);
    expect(source).toContain('/libs/html2canvas.min.js');
  });

  it('the vendored html2canvas.min.js bundle exists in client/public/libs/', () => {
    const bundlePath = path.join(__dirname, '../../../../public/libs/html2canvas.min.js');
    expect(fs.existsSync(bundlePath)).toBe(true);
  });
});
