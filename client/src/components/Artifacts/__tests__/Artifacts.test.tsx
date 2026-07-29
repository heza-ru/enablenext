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

jest.mock('~/hooks/Artifacts/useArtifacts', () => ({
  __esModule: true,
  default: () => ({
    activeTab: mockActiveTab,
    setActiveTab: mockSetActiveTab,
    currentIndex: 0,
    currentArtifact: { id: 'artifact-1', content: '<html></html>' },
    orderedArtifactIds: ['artifact-1'],
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

jest.mock('recoil', () => ({
  __esModule: true,
  useSetRecoilState: () => jest.fn(),
  useResetRecoilState: () => jest.fn(),
}));

jest.mock('~/store', () => ({
  __esModule: true,
  default: {
    artifactsVisibility: 'artifactsVisibility',
    currentArtifactId: 'currentArtifactId',
  },
}));

jest.mock('~/Providers', () => ({
  __esModule: true,
  useShareContext: () => ({ isSharedConvo: false }),
  useMutationState: () => ({ isMutating: false }),
}));

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string) => key,
}));

jest.mock('../DownloadArtifact', () => ({
  __esModule: true,
  default: () => <div data-testid="download-artifact" />,
}));

jest.mock('../ArtifactVersion', () => ({
  __esModule: true,
  default: () => <div data-testid="artifact-version" />,
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
  jest.clearAllMocks();
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
});
