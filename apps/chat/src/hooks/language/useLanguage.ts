import { useTranslation } from 'react-i18next';

export interface SupportedLanguage {
  code: string;
  nativeName: string;
}

/** Language the UI falls back to when no translation bundle matches the detected one. */
export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: DEFAULT_LANGUAGE, nativeName: 'English' },
  // LOCAL ONLY — shows the Language row in Settings; do not commit.
  { code: 'ar', nativeName: 'العربية' },
];

export const useLanguage = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (code: string) => {
    void i18n.changeLanguage(code);
  };

  return {
    /* The detected language (e.g. the browser's `ru`), even when the UI fell
     * back to another bundle; it still selects user-authored content locales. */
    language: i18n.language,
    /* The language of the text actually rendered — pass it to `Intl`
     * formatters so dates and weekday names match the surrounding copy. */
    displayLanguage: i18n.resolvedLanguage ?? DEFAULT_LANGUAGE,
    changeLanguage,
  };
};
