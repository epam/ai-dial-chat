import { MouseEvent, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

interface ThemeSelectProps {
  localTheme: string;
  onThemeChangeHandler: (theme: string) => void;
}

export const ThemeSelect = ({
  localTheme,
  onThemeChangeHandler,
}: ThemeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { t } = useTranslation(Translation.Settings);
  const availableThemes = useAppSelector(UISelectors.selectAvailableThemes);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onThemeChangeHandler(e.currentTarget.value);
    setIsOpen(false);
  };

  if (availableThemes.length < 2) {
    return null;
  }

  return (
    <div className="flex items-center gap-5">
      <div className="basis-1/3 md:basis-1/4">{t('Theme')}</div>
      <div className="h-[38px] grow rounded border border-primary focus-within:border-accent-primary focus:border-accent-primary">
        <Menu
          className="w-full px-3"
          onOpenChange={setIsOpen}
          trigger={
            <div className="flex min-w-[120px] items-center justify-between gap-2 capitalize">
              {localTheme}
              <ChevronDownIcon
                className={classNames(
                  'shrink-0 text-primary transition-all',
                  isOpen && 'rotate-180',
                )}
                width={18}
                height={18}
              />
            </div>
          }
        >
          {availableThemes.map((theme) => (
            <MenuItem
              key={theme.id}
              className="max-w-[350px] hover:bg-accent-primary-alpha"
              item={t(theme.displayName)}
              value={theme.id}
              onClick={onChangeHandler}
            />
          ))}
        </Menu>
      </div>
    </div>
  );
};
