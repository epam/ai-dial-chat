import { IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { Menu, MenuItem } from '../../DropdownMenu';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
}

export const RuntimeVersionSelector = ({ value, onChange }: Props) => {
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const [isVersionSelectorOpen, setIsVersionSelectorOpen] = useState(false);

  return (
    <Menu
      onOpenChange={setIsVersionSelectorOpen}
      disabled={false}
      className="input-form relative cursor-pointer px-3"
      listClassName="w-full"
      trigger={
        <div className="flex gap-1">
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
  );
};
