import { ChangeEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import { Theme } from '@/src/types/settings';
import { Translation } from '@/src/types/translation';

interface ThemeSelectProps {
  localTheme: Theme;
  onThemeChangeHandler: (theme: Theme) => void;
}

export const ThemeSelect = ({
  localTheme,
  onThemeChangeHandler,
}: ThemeSelectProps) => {
  const { t } = useTranslation(Translation.Settings);

  const onChangeHandler: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const theme = event.target.value as Theme;
    onThemeChangeHandler(theme);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="w-[120px]">{t('Theme')}</div>
      <div className="grow rounded border border-gray-400 px-3 focus-within:border-blue-500 focus:border-blue-500 dark:border-gray-600">
        <select
          className="h-[38px] w-full cursor-pointer rounded border-none focus:outline-none dark:bg-gray-700"
          value={localTheme}
          onChange={onChangeHandler}
        >
          <option className="border-none dark:bg-gray-700" value="dark">
            {t('Dark')}
          </option>
          <option className="dark:bg-gray-700" value="light">
            {t('Light')}
          </option>
        </select>
      </div>
    </div>
  );
};
