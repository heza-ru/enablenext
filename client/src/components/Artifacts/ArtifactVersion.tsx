import React, { useState } from 'react';
import { MenuButton } from '@ariakit/react';
import { History, Check } from 'lucide-react';
import { DropdownPopup, TooltipAnchor, Button, useMediaQuery } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface ArtifactVersionProps {
  currentIndex: number;
  totalVersions: number;
  onVersionChange: (index: number) => void;
  onCompareVersion: (index: number) => void;
}

export default function ArtifactVersion({
  currentIndex,
  totalVersions,
  onVersionChange,
  onCompareVersion,
}: ArtifactVersionProps) {
  const localize = useLocalize();
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const menuId = 'version-dropdown-menu';

  const handleValueChange = (value: string) => {
    const index = parseInt(value, 10);
    onVersionChange(index);
    setIsPopoverActive(false);
  };

  if (totalVersions <= 1) {
    return null;
  }

  const options = Array.from({ length: totalVersions }, (_, index) => ({
    value: index.toString(),
    label: localize('com_ui_version_var', { 0: String(index + 1) }),
  }));

  const handleCompareClick = (value: string) => {
    const index = parseInt(value, 10);
    onCompareVersion(index);
    setIsPopoverActive(false);
  };

  const dropdownItems = options.map((option) => {
    const isSelected = option.value === String(currentIndex);
    return {
      label: option.label,
      onClick: () => handleValueChange(option.value),
      value: option.value,
      icon: isSelected ? (
        <Check size={16} className="text-text-primary" aria-hidden="true" />
      ) : undefined,
    };
  });

  const compareItems = options
    .filter((option) => option.value !== String(currentIndex))
    .map((option) => ({
      label: localize('com_ui_compare_version_var', {
        0: String(parseInt(option.value, 10) + 1),
      }),
      onClick: () => handleCompareClick(option.value),
      value: `compare-${option.value}`,
    }));

  return (
    <DropdownPopup
      menuId={menuId}
      portal
      focusLoop
      unmountOnHide
      isOpen={isPopoverActive}
      setIsOpen={setIsPopoverActive}
      trigger={
        <TooltipAnchor
          description={localize('com_ui_change_version')}
          render={
            <Button
              size="icon"
              variant="ghost"
              asChild
              aria-label={localize('com_ui_change_version')}
            >
              <MenuButton>
                <History
                  size={18}
                  className="text-text-secondary"
                  aria-hidden="true"
                  focusable="false"
                />
              </MenuButton>
            </Button>
          }
        />
      }
      items={[...dropdownItems, ...compareItems]}
      className={isSmallScreen ? '' : 'absolute right-0 top-0 mt-2'}
    />
  );
}
