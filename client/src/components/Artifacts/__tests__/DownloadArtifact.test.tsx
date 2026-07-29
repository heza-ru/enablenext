import { render, fireEvent, act } from '@testing-library/react';
import { useUpdateMessageMutation } from 'librechat-data-provider/react-query';
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
}));
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ token: 'test-token' }),
}));
jest.mock('~/hooks/Artifacts/useArtifactProps', () => ({
  __esModule: true,
  default: () => ({ fileKey: 'test.pptx' }),
}));
jest.mock('~/Providers/EditorContext', () => ({
  useCodeState: () => ({ currentCode: mockCurrentCode }),
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (s: string) => s }));
jest.mock('~/Providers', () => ({
  useChatContext: () => ({ conversation: mockConversation }),
}));
jest.mock('librechat-data-provider/react-query', () => ({
  ...jest.requireActual('librechat-data-provider/react-query'),
  useUpdateMessageMutation: jest.fn(),
}));

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
  (useUpdateMessageMutation as jest.Mock).mockReturnValue({ mutate: jest.fn(), isLoading: false });
});

describe('DownloadArtifact — PDF (HD) button tooltip copy', () => {
  it('PDF (HD) button tooltip describes the client-side capture approach', () => {
    const { queryByTitle, getByTitle } = render(
      <DownloadArtifact artifact={{ content: '...downloadPptx()...' } as never} />,
    );
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

  it('does not create a hidden-iframe fallback if bridge-ready already arrived at mount, even across multiple download clicks', () => {
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

    fireEvent.click(getByLabelText('Download as PPTX'));

    // Advance well past FALLBACK_MS (10s) — since bridge-ready already
    // confirmed liveness before the click, no hidden iframe should appear.
    jest.advanceTimersByTime(15_000);

    // Click again to confirm the sticky ref still prevents a fallback on
    // subsequent downloads of the same (still-alive) artifact instance.
    fireEvent.click(getByLabelText('Download as PPTX'));
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('does create a hidden-iframe fallback if bridge-ready never arrives', () => {
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: '' } as never} previewRef={fakePreviewRef} />,
    );

    fireEvent.click(getByLabelText('Download as PPTX'));

    // No bridge-ready message — simulating an older artifact with no bridge script.
    jest.advanceTimersByTime(15_000);

    expect(document.querySelectorAll('iframe').length).toBeGreaterThan(0);
  });

  it('resets bridgeReadyRef when a different artifact.id is shown, so a stale ready-flag from a previous artifact does not suppress the fallback a new, dead artifact actually needs', () => {
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

  it('calls updateMessageMutation.mutate with reconstructed text on Save after an artifact-deck-updated message', () => {
    const mockMutate = jest.fn();
    (useUpdateMessageMutation as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
    });
    mockCurrentCode =
      '<script src="/libs/deck-renderer.js"></script>' +
      '<script>window.DECK = {"title":"Old"};</script>';
    mockConversation = { conversationId: 'conv-1', model: 'gpt-4' };

    const { getByRole } = render(
      <DownloadArtifact
        artifact={{ content: mockCurrentCode, messageId: 'msg-1' } as never}
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

    fireEvent.click(getByRole('button', { name: /^com_ui_save$/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        text: expect.stringContaining('"title":"New"'),
      }),
    );
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

  it('a zero-option PPTX download still posts a message with no args field at all (regression)', () => {
    const postMessage = jest.fn();
    const previewRef = {
      current: { getClient: () => ({ iframe: { contentWindow: { postMessage } } }) },
    } as never;
    mockCurrentCode = '<html>...downloadPptx()...</html>';
    const { getByLabelText } = render(
      <DownloadArtifact artifact={{ content: mockCurrentCode } as never} previewRef={previewRef} />,
    );
    fireEvent.click(getByLabelText('Download as PPTX'));
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'artifact-download-request', fn: 'downloadPptx' },
      '*',
    );
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
