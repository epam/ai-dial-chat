export const DEFAULT_LOCAL = 'en';

export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  tr: 'Türkçe',
};

export const getLocaleDisplayName = (locale: string): string => {
  if (LOCALE_DISPLAY_NAMES[locale]) return LOCALE_DISPLAY_NAMES[locale];
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale
    );
  } catch {
    return locale;
  }
};
