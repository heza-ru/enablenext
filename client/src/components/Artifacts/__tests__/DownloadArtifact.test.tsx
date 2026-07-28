import { render, fireEvent } from '@testing-library/react';
import DownloadArtifact from '../DownloadArtifact';

// Mock heavy provider hooks this component depends on so the test can focus
// on the timing logic under test.
jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: {} }),
}));
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ token: 'test-token' }),
}));
jest.mock('~/hooks/Artifacts/useArtifactProps', () => ({
  __esModule: true,
  default: () => ({ fileKey: 'test.pptx' }),
}));
jest.mock('~/Providers/EditorContext', () => ({
  useCodeState: () => ({ currentCode: '<html>...downloadPptx()...</html>' }),
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
