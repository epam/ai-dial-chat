import { MouseEvent, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { SettingsI18nKeys } from '@/src/constants/i18n';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { Label } from '@/src/components/Common/Forms/Label';

import i18nextConfig from '@/next-i18next.config';
import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
};

interface LanguageSelectProps {
  localLocale: string;
  onLocaleChangeHandler: (locale: string) => void;
}

export const LanguageSelect = ({
  localLocale,
  onLocaleChangeHandler,
}: LanguageSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { t } = useTranslation(Translation.Settings);
  const availableLocales = i18nextConfig.i18n.locales;

  const localeName = useMemo(
    () => LOCALE_DISPLAY_NAMES[localLocale] ?? localLocale,
    [localLocale],
  );

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onLocaleChangeHandler(e.currentTarget.value);
    setIsOpen(false);
  };

  if (availableLocales.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <Label>{t(SettingsI18nKeys.Language)}</Label>
      <div
        className="h-[38px] grow rounded border border-primary focus-within:border-accent-primary focus:border-accent-primary"
        data-qa="language"
      >
        <Menu
          className="flex w-full items-center px-3"
          onOpenChange={setIsOpen}
          trigger={
            <div className="flex w-full min-w-[120px] cursor-pointer items-center justify-between gap-2">
              {localeName}
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
          {availableLocales.map((locale) => (
            <MenuItem
              key={locale}
              className="max-w-[350px] hover:bg-accent-primary-alpha"
              item={LOCALE_DISPLAY_NAMES[locale] ?? locale}
              value={locale}
              onClick={onChangeHandler}
            />
          ))}
        </Menu>
      </div>
    </div>
  );
};
