import { IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { Menu, MenuItem } from '../../DropdownMenu';
import Tooltip from '../../Tooltip';

interface Props {
  value?: string;
  disabled?: boolean;
  tooltip?: string;
  onChange?: (value: string) => void;
}

export const RuntimeVersionSelector = ({
  value,
  disabled,
  tooltip,
  onChange,
}: Props) => {
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const [isVersionSelectorOpen, setIsVersionSelectorOpen] = useState(false);

  return (
    <Tooltip tooltip={tooltip}>
      <Menu
        onOpenChange={setIsVersionSelectorOpen}
        className={classNames(
          'input-form relative px-3',
          disabled
            ? 'cursor-not-allowed hover:border-primary'
            : 'cursor-pointer',
        )}
        isTriggerEnabled={!disabled}
        listClassName="w-full"
        trigger={
          <div
            className={classNames(
              'flex gap-1',
              disabled && 'cursor-not-allowed',
            )}
          >
            {value}
            <IconChevronDown
              className={classNames(
                'absolute right-3 top-1/2 shrink-0 -translate-y-1/2 transition-all',
                isVersionSelectorOpen && 'rotate-180',
              )}
              size={18}
            />
          </div>
        }
      >
        {pythonVersions.map((version) => {
          return (
            <MenuItem
              onClick={() => onChange?.(version)}
              disabled={version === value}
              className={classNames(
                'flex !max-w-full hover:bg-accent-primary-alpha',
                version === value && 'bg-accent-primary-alpha',
              )}
              key={version}
              item={version}
            />
          );
        })}
      </Menu>
    </Tooltip>
  );
};
