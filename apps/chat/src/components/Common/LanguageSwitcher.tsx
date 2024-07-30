import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ChineseLangIcon, EnglishLangIcon } from '@/src/icons';

const LanguageSwitcher = () => {
  const { t } = useTranslation(Translation.Header);
  const { locale, locales, asPath, push } = useRouter();

  const onChangeLocale = (locale: string) => push(asPath, asPath, { locale });

  return (
    <Menu
      type="contextMenu"
      listClassName="min-w-[170px]"
      trigger={
        <div
          className="flex h-full items-center pr-5 hover:cursor-pointer"
          data-qa="locale-switcher"
        >
          {locale === 'en' && <EnglishLangIcon width={29} height={20} />}
          {locale === 'cn' && <ChineseLangIcon width={29} height={29} />}
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
                  {language === 'en' && (
                    <>
                      <EnglishLangIcon />
                      {t('English')}
                    </>
                  )}
                  {language === 'cn' && (
                    <>
                      <ChineseLangIcon /> {t('Chinese（中文)')}
                    </>
                  )}
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
