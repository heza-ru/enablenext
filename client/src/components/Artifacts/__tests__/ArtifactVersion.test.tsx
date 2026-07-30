import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ArtifactVersion from '../ArtifactVersion';

// ArtifactVersion renders its menu via @librechat/client's DropdownPopup (built
// on @ariakit/react's Menu primitives), which requires a full Ariakit menu
// context to open/close in jsdom. Rather than exercise that machinery here,
// we replace both wholesale with simple passthroughs that render every menu
// item as a plain button, so tests can assert on the item list DropdownPopup
// receives without needing real popover open/close behavior.
jest.mock('@ariakit/react', () => ({
  __esModule: true,
  MenuButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@librechat/client', () => ({
  __esModule: true,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  TooltipAnchor: ({ render }: any) => render,
  useMediaQuery: () => false,
  DropdownPopup: ({ trigger, items }: any) => (
    <div>
      {trigger}
      {items.map((item: any) => (
        <button key={item.value} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

const LOCALIZED_STRINGS: Record<string, string> = {
  com_ui_change_version: 'Change Version',
  com_ui_version_var: 'Version {{0}}',
  com_ui_compare_version_var: 'Compare with version {{0}}',
};

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string, vars?: Record<string, string>) => {
    const template = LOCALIZED_STRINGS[key] ?? key;
    if (vars == null) {
      return template;
    }
    return Object.entries(vars).reduce(
      (acc, [_placeholderKey, value]) => acc.replace(/\{\{0\}\}/, value),
      template,
    );
  },
}));

function renderArtifactVersion(
  overrides: {
    currentIndex?: number;
    totalVersions?: number;
    onVersionChange?: jest.Mock;
    onCompareVersion?: jest.Mock;
  } = {},
) {
  const onVersionChange = overrides.onVersionChange ?? jest.fn();
  const onCompareVersion = overrides.onCompareVersion ?? jest.fn();
  const utils = render(
    <ArtifactVersion
      currentIndex={overrides.currentIndex ?? 0}
      totalVersions={overrides.totalVersions ?? 3}
      onVersionChange={onVersionChange}
      onCompareVersion={onCompareVersion}
    />,
  );
  return { ...utils, onVersionChange, onCompareVersion };
}

describe('ArtifactVersion — compare action', () => {
  it('includes a "Compare with" action for every non-current version', () => {
    const { getByText, onCompareVersion } = renderArtifactVersion({
      currentIndex: 0,
      totalVersions: 3,
    });

    expect(getByText(/compare with version 2/i)).toBeInTheDocument();
    expect(getByText(/compare with version 3/i)).toBeInTheDocument();

    fireEvent.click(getByText(/compare with version 2/i));
    expect(onCompareVersion).toHaveBeenCalledWith(1);
  });

  it('does not include a "Compare with" action for the current version', () => {
    const { queryByText } = renderArtifactVersion({ currentIndex: 0, totalVersions: 3 });
    expect(queryByText(/compare with version 1/i)).not.toBeInTheDocument();
  });

  it('does not call onVersionChange when a compare action is clicked', () => {
    const { getByText, onVersionChange } = renderArtifactVersion({
      currentIndex: 0,
      totalVersions: 3,
    });
    fireEvent.click(getByText(/compare with version 3/i));
    expect(onVersionChange).not.toHaveBeenCalled();
  });

  it('still calls onVersionChange for the existing version-switch entries', () => {
    const { getByText, onVersionChange } = renderArtifactVersion({
      currentIndex: 0,
      totalVersions: 3,
    });
    fireEvent.click(getByText('Version 2'));
    expect(onVersionChange).toHaveBeenCalledWith(1);
  });

  it('renders nothing when there is only one version', () => {
    const { container } = renderArtifactVersion({ currentIndex: 0, totalVersions: 1 });
    expect(container).toBeEmptyDOMElement();
  });
});
