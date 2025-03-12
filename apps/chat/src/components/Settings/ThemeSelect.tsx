import { MouseEvent, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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

  const themeName = useMemo(() => {
    const name = availableThemes.find(
      ({ id }) => id === localTheme,
    )?.displayName;

    return name ?? localTheme;
  }, [availableThemes, localTheme]);

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
      <div
        className="h-[38px] grow basis-2/3 rounded border border-primary focus-within:border-accent-primary focus:border-accent-primary md:basis-3/4"
        data-qa="theme"
      >
        <Menu
          className="flex w-full items-center px-3"
          onOpenChange={setIsOpen}
          trigger={
            <div className="flex w-full min-w-[120px] cursor-pointer items-center justify-between gap-2 capitalize">
              {themeName}
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
