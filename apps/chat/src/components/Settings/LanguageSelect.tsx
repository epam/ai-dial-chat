import { MouseEvent, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { SettingsI18nKeys } from '@/src/constants/i18n';
import { getLocaleDisplayName } from '@/src/constants/locale';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { Label } from '@/src/components/Common/Forms/Label';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

interface LanguageSelectProps {
  currentLocale: string;
  onLocaleChange: (locale: string) => void;
}

export const LanguageSelect = ({
  currentLocale,
  onLocaleChange,
}: LanguageSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const router = useRouter();
  const { t } = useTranslation(Translation.Settings);
  const availableLocales = router.locales ?? ['en'];

  const localeName = getLocaleDisplayName(currentLocale);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onLocaleChange(e.currentTarget.value);
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
              item={getLocaleDisplayName(locale)}
              value={locale}
              onClick={onChangeHandler}
            />
          ))}
        </Menu>
      </div>
    </div>
  );
};
