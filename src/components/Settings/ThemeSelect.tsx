import { ChangeEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

interface ThemeSelectProps {
  localTheme: string;
  onThemeChangeHandler: (theme: string) => void;
}

export const ThemeSelect = ({
  localTheme,
  onThemeChangeHandler,
}: ThemeSelectProps) => {
  const { t } = useTranslation(Translation.Settings);
  const availableThemes = useAppSelector(UISelectors.selectAvailableThemes);

  const onChangeHandler: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const theme = event.target.value;
    onThemeChangeHandler(theme);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="basis-1/3 md:basis-1/4">{t('Theme')}</div>
      <div className="grow rounded border border-primary px-3 focus-within:border-accent-primary focus:border-accent-primary">
        <select
          className="h-[38px] w-full cursor-pointer rounded border-none bg-transparent focus:outline-none"
          value={localTheme}
          onChange={onChangeHandler}
        >
          {availableThemes.map((theme) => (
            <option key={theme.id} value={theme.id} className='bg-layer-3'>
              {t(theme.displayName)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
