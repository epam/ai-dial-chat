import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ChineseLangIcon, EnglishLangIcon } from '@/src/icons';

const LanguageSwitcher = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation(Translation.Common);
  const { locale, locales, asPath, push } = useRouter();

  const onChangeLocale = (locale: string) => push(asPath, asPath, { locale });

  useEffect(() => {
    locale && dispatch(UIActions.setLanguage(locale));
  }, [locale, dispatch]);

  return (
    <Menu
      type="contextMenu"
      listClassName="min-w-[170px]"
      trigger={
        <div
          className="flex h-full items-center pr-5 hover:cursor-pointer"
          data-qa="locale-switcher"
        >
          {locale === 'en' && (
            <div className="text-base hover:text-accent-primary">EN</div>
          )}
          {locale === 'cn' && (
            <div className="text-base hover:text-accent-primary">CN</div>
          )}
        </div>
      }
    >
      {locales &&
        locales.map((language) => {
          return (
            <MenuItem
              key={language}
              item={
                <div className="flex items-center gap-2">
                  {language === 'en' && t('common.language.english')}
                  {language === 'cn' && t('common.language.chinese')}
                </div>
              }
              onClick={() => onChangeLocale(language)}
            />
          );
        })}
    </Menu>
  );
};

export default LanguageSwitcher;
