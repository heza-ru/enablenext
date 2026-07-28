import { render, fireEvent, act } from '@testing-library/react';
import DownloadArtifact, {
  runInHiddenIframe,
  detectNativeFormats,
  NATIVE_FORMATS,
} from '../DownloadArtifact';

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
});

describe('DownloadArtifact — PDF (HD) button tooltip copy', () => {
  it('PDF (HD) button tooltip describes the client-side capture approach', () => {
    const { queryByTitle, getByTitle } = render(
      <DownloadArtifact
        artifact={{ content: '...downloadPptx()...' } as never}
      />,
    );
    expect(
      queryByTitle(/Server-side Playwright render/i),
    ).toBeNull();
    expect(
      getByTitle(/screenshots each slide.*in-browser/i),
    ).toBeDefined();
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
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'bridge-ready' } }),
    );

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
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'bridge-ready' } }),
    );
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

  it('does not let an earlier, superseded saveToDrive call\'s stale timeout clobber a later call\'s successful state', async () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
