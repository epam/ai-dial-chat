import { useTranslation } from 'react-i18next';

export interface SupportedLanguage {
  code: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', nativeName: 'English' },
];

export const useLanguage = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (code: string) => {
    void i18n.changeLanguage(code);
  };

  return {
    language: i18n.language,
    changeLanguage,
  };
};
