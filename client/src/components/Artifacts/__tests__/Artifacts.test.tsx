import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Artifacts from '../Artifacts';

// Mutable so individual tests can control which tab is active and which
// artifact/version data useArtifacts() reports, without needing a real
// RecoilRoot or ArtifactsProvider tree (this component pulls artifact state
// through the useArtifacts hook, which we replace wholesale here).
let mockActiveTab = 'preview';
const mockSetActiveTab = jest.fn((tab: string) => {
  mockActiveTab = tab;
});

// Most tests only need a single version, but the compare-mode tests below
// need a second artifact id present so ArtifactVersion's "Compare with
// version 2" entry (rendered by our ArtifactVersion mock below) resolves to
// a real id that the recoil-store mock can look up.
let mockOrderedArtifactIds = ['artifact-1'];

jest.mock('~/hooks/Artifacts/useArtifacts', () => ({
  __esModule: true,
  default: () => ({
    activeTab: mockActiveTab,
    setActiveTab: mockSetActiveTab,
    currentIndex: 0,
    currentArtifact: { id: 'artifact-1', content: '<html></html>' },
    orderedArtifactIds: mockOrderedArtifactIds,
    setCurrentArtifactId: jest.fn(),
  }),
}));

// Artifacts.tsx renders on the assumption of a desktop viewport unless a test
// explicitly overrides this — the fullscreen toggle is desktop-only per the
// task spec, so most assertions here need isMobile === false.
let mockIsMobile = false;

jest.mock('@librechat/client', () => ({
  __esModule: true,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  useMediaQuery: () => mockIsMobile,
  Radio: ({ options, onChange }: any) => (
    <div>
      {options.map((opt: any) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

// artifactsState holds every artifact keyed by id (the same recoil atom
// useArtifacts.ts reads from). Artifacts.tsx reads it directly via
// useRecoilValue to look up the non-current artifact selected for
// comparison, since useArtifacts() only exposes the current artifact.
const mockArtifactsById: Record<string, { id: string; content: string }> = {
  'artifact-1': { id: 'artifact-1', content: '<html>v1</html>' },
  'artifact-2': { id: 'artifact-2', content: '<html>v2</html>' },
};

jest.mock('recoil', () => ({
  __esModule: true,
  useSetRecoilState: () => jest.fn(),
  useResetRecoilState: () => jest.fn(),
  useRecoilValue: () => mockArtifactsById,
}));

jest.mock('~/store', () => ({
  __esModule: true,
  default: {
    artifactsVisibility: 'artifactsVisibility',
    currentArtifactId: 'currentArtifactId',
    artifactsState: 'artifactsState',
  },
}));

jest.mock('~/Providers', () => ({
  __esModule: true,
  useShareContext: () => ({ isSharedConvo: false }),
  useMutationState: () => ({ isMutating: false }),
}));

// Mirrors the real English strings for the keys this component actually
// uses (from src/locales/en/translation.json), so assertions here exercise
// the same visible copy a user would see rather than raw i18n keys — this
// matters now that the fullscreen/zoom aria-labels go through localize()
// instead of being hardcoded.
const LOCALIZED_STRINGS: Record<string, string> = {
  com_ui_close: 'Close',
  com_ui_refresh: 'Refresh',
  com_ui_fullscreen: 'Fullscreen',
  com_ui_fullscreen_exit: 'Exit fullscreen',
  com_ui_zoom_in: 'Zoom in',
  com_ui_zoom_out: 'Zoom out',
  com_ui_reset_zoom: 'Reset Zoom',
  com_ui_stop_comparing: 'Stop comparing',
};

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string) => LOCALIZED_STRINGS[key] ?? key,
}));

jest.mock('../DownloadArtifact', () => ({
  __esModule: true,
  default: () => <div data-testid="download-artifact" />,
}));

// The real ArtifactVersion opens an Ariakit dropdown menu, which needs a
// full menu context to interact with in jsdom. We stand in a minimal version
// that exposes its onCompareVersion prop as a plain button, so tests can
// trigger the "compare with version 2" flow the same way a user would click
// through the real dropdown, without needing to drive Ariakit's popover.
jest.mock('../ArtifactVersion', () => ({
  __esModule: true,
  default: ({ onCompareVersion }: any) => (
    <div data-testid="artifact-version">
      <button onClick={() => onCompareVersion(1)}>Compare with version 2</button>
    </div>
  ),
}));

jest.mock('../ArtifactTabs', () => ({
  __esModule: true,
  default: () => <div data-testid="artifact-tabs" />,
}));

jest.mock('../Code', () => ({
  __esModule: true,
  CopyCodeButton: () => <div data-testid="copy-code-button" />,
}));

function renderArtifacts(overrides: { activeTab?: string } = {}) {
  mockActiveTab = overrides.activeTab ?? 'preview';
  return render(<Artifacts />);
}

beforeEach(() => {
  mockIsMobile = false;
  mockActiveTab = 'preview';
  mockOrderedArtifactIds = ['artifact-1'];
  jest.clearAllMocks();
});

describe('Artifacts — version compare', () => {
  it('renders a second read-only preview pane when a comparison version is selected', () => {
    mockOrderedArtifactIds = ['artifact-1', 'artifact-2'];
    const { container, getByText } = renderArtifacts();

    expect(container.querySelectorAll('[data-testid="artifact-preview-pane"]').length).toBe(1);

    fireEvent.click(getByText('Compare with version 2'));

    expect(container.querySelectorAll('[data-testid="artifact-preview-pane"]').length).toBe(2);
  });

  it('clears the comparison pane when "Stop comparing" is clicked', () => {
    mockOrderedArtifactIds = ['artifact-1', 'artifact-2'];
    const { container, getByText, getByRole, queryAllByTestId } = renderArtifacts();

    fireEvent.click(getByText('Compare with version 2'));
    expect(queryAllByTestId('artifact-preview-pane').length).toBe(2);

    fireEvent.click(getByRole('button', { name: /stop comparing/i }));

    expect(queryAllByTestId('artifact-preview-pane').length).toBe(1);
    expect(container.querySelector('[data-testid="artifact-preview-pane"]')).not.toBeNull();
  });
});

describe('Artifacts — fullscreen toggle', () => {
  it('renders a fullscreen toggle button in the header', () => {
    const { getByRole } = renderArtifacts();
    expect(getByRole('button', { name: /fullscreen|maximize/i })).toBeInTheDocument();
  });

  it('applies a fixed inset-0 full-viewport class when fullscreen is toggled on (desktop)', () => {
    const { getByRole, container } = renderArtifacts();
    fireEvent.click(getByRole('button', { name: /fullscreen|maximize/i }));
    expect(container.querySelector('.fixed.inset-0')).not.toBeNull();
  });

  it('does not render the fullscreen toggle on mobile', () => {
    mockIsMobile = true;
    const { queryByRole } = renderArtifacts();
    expect(queryByRole('button', { name: /fullscreen|maximize/i })).not.toBeInTheDocument();
  });

  it('removes the fixed inset-0 full-viewport class when fullscreen is toggled back off', () => {
    const { getByRole, container } = renderArtifacts();
    const toggle = getByRole('button', { name: /fullscreen|maximize/i });

    // On: the fixed/inset-0 escape-hatch class should be present.
    fireEvent.click(toggle);
    expect(container.querySelector('.fixed.inset-0')).not.toBeNull();

    // Off again: same button (now labeled "Exit fullscreen") toggles it back,
    // and the escape-hatch class must be gone — otherwise the panel would be
    // stuck full-viewport forever.
    fireEvent.click(getByRole('button', { name: /exit fullscreen/i }));
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });
});

describe('Artifacts — zoom controls', () => {
  it('shows zoom controls only on the preview tab', () => {
    const { queryByRole } = renderArtifacts({ activeTab: 'code' });
    expect(queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument();
    expect(queryByRole('button', { name: /zoom out/i })).not.toBeInTheDocument();
  });

  it('shows zoom controls on the preview tab', () => {
    const { getByRole } = renderArtifacts({ activeTab: 'preview' });
    expect(getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
  });

  it('clamps zoom level between 0.5 and 2 in steps of 0.25', () => {
    const { getByRole, container } = renderArtifacts({ activeTab: 'preview' });
    const zoomOut = getByRole('button', { name: /zoom out/i });
    const zoomIn = getByRole('button', { name: /zoom in/i });

    // Starting at 1, ten decrements of 0.25 should clamp at 0.5, not go negative.
    for (let i = 0; i < 10; i++) fireEvent.click(zoomOut);
    const scaledEl = container.querySelector('[style*="scale"]') as HTMLElement;
    expect(scaledEl.style.transform).toBe('scale(0.5)');

    // Ten increments of 0.25 from 0.5 should clamp at 2, not run away.
    for (let i = 0; i < 10; i++) fireEvent.click(zoomIn);
    expect(scaledEl.style.transform).toBe('scale(2)');
  });

  it('resets zoom back to 100% via the reset control', () => {
    const { getByRole, container } = renderArtifacts({ activeTab: 'preview' });
    const zoomIn = getByRole('button', { name: /zoom in/i });
    const resetZoom = getByRole('button', { name: /reset zoom/i });
    const scaledEl = container.querySelector('[style*="scale"]') as HTMLElement;

    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(scaledEl.style.transform).toBe('scale(1.5)');

    fireEvent.click(resetZoom);
    expect(scaledEl.style.transform).toBe('scale(1)');
  });
});
